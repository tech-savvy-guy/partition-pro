"""
Virtual Attribute Roll-Up Preview Service

Provides stateless computation of attribute roll-up previews without persisting to DB.
Uses Redis caching with 1-hour TTL for session-based preview results.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List, Optional
from uuid import UUID

import pandas as pd
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone

from .base_testing import (
    _compute_Mk,
    _compute_row_status,
    _compute_base_result,
    _build_attribute_item_compact,
    _build_attribute_uuid_map,
    json_safe,
)
from .base_math import _call_db_get_basemath_long_skuname
from .base import get_partition
from .observability import log_event, Timer
from .shared_utils import build_q_from_path, _qs_json_to_df, get_filtered_attribute_rows, _get_attribute_base_cols
from ...models import Workflow, PreprocessedSkuSelection, WorkingAttributesData, RawAttributesData, PartitionDatasetMetadata


def _clean_group_value(value: Any, field_name: str) -> str:
    if value is None:
        raise ValueError(f"{field_name} cannot be null")

    cleaned = str(value).strip()
    if not cleaned:
        raise ValueError(f"{field_name} cannot be empty")
    return cleaned


def _clean_old_values(values: Any, group_name: str) -> list[str]:
    if not isinstance(values, list):
        raise ValueError(f"new_grouping_spec.{group_name} must be a list of existing attribute values")

    old_values = [_clean_group_value(value, f"new_grouping_spec.{group_name}[]") for value in values]
    if not old_values:
        raise ValueError(f"new_grouping_spec.{group_name} must include at least one existing attribute value")
    return old_values


def _validate_no_duplicate_sources(mapping: dict[str, list[str]]) -> None:
    seen: dict[str, str] = {}
    for group_name, old_values in mapping.items():
        for old_value in old_values:
            previous_group = seen.get(old_value)
            if previous_group is not None:
                raise ValueError(
                    f"attribute value '{old_value}' is mapped to both '{previous_group}' and '{group_name}'"
                )
            seen[old_value] = group_name


def normalize_grouping_spec(
    grouping_spec: Any,
    grouping_labels: dict[str, str] | None = None,
) -> dict[str, list[str]]:
    """
    Normalize supported virtual roll-up grouping payloads into:
    {
        "New Group": ["Existing Value", "Another Existing Value"]
    }

    Preferred request payload:
    {
        "new_grouping_spec": {
            "Mainstream": ["Value", "Mid Tier"],
            "Premium": ["Premium"]
        }
    }

    Legacy string payloads such as "[Value | Mid Tier, Premium]" are still
    accepted for older clients.
    """
    if isinstance(grouping_spec, dict):
        mapping: dict[str, list[str]] = {}
        for group_name, old_values in grouping_spec.items():
            cleaned_group_name = _clean_group_value(group_name, "new_grouping_spec group name")
            mapping[cleaned_group_name] = _clean_old_values(old_values, cleaned_group_name)

        if not mapping:
            raise ValueError("new_grouping_spec must include at least one group")

        _validate_no_duplicate_sources(mapping)
        return mapping

    if isinstance(grouping_spec, list):
        mapping = {}
        for index, group in enumerate(grouping_spec):
            if not isinstance(group, dict):
                raise ValueError(f"new_grouping_spec[{index}] must be an object")

            group_name = (
                group.get("name")
                or group.get("label")
                or group.get("new_value")
                or group.get("group_name")
            )
            old_values = group.get("values") or group.get("old_values") or group.get("source_values")
            cleaned_group_name = _clean_group_value(group_name, f"new_grouping_spec[{index}].name")
            if cleaned_group_name in mapping:
                raise ValueError(f"new_grouping_spec contains duplicate group '{cleaned_group_name}'")
            mapping[cleaned_group_name] = _clean_old_values(old_values, cleaned_group_name)

        if not mapping:
            raise ValueError("new_grouping_spec must include at least one group")

        _validate_no_duplicate_sources(mapping)
        return mapping

    if isinstance(grouping_spec, str):
        spec_str = grouping_spec.strip()
        if not spec_str:
            raise ValueError("new_grouping_spec cannot be empty")

        groups = spec_str.strip("[]").strip().split(",")
        mapping = {}
        grouping_labels = grouping_labels or {}
        for group_str in groups:
            old_values = [v.strip() for v in group_str.split("|") if v.strip()]
            if not old_values:
                raise ValueError("new_grouping_spec contains an empty group")
            raw_group_name = " | ".join(old_values)
            new_name = grouping_labels.get(raw_group_name, raw_group_name)
            cleaned_group_name = _clean_group_value(new_name, "grouping_labels value")
            if cleaned_group_name in mapping:
                raise ValueError(f"new_grouping_spec contains duplicate group '{cleaned_group_name}'")
            mapping[cleaned_group_name] = old_values

        _validate_no_duplicate_sources(mapping)
        return mapping

    raise ValueError("new_grouping_spec must be an object, an array of objects, or a legacy string")


def parse_grouping_spec(
    spec_str: Any,
    grouping_labels: dict[str, str] | None = None,
) -> dict[str, list[str]]:
    """
    Parse grouping specification format.

    Preferred format:
    {"Mainstream": ["Value", "Mid Tier"], "Premium": ["Premium"]}

    Legacy format:
    "[Value | Mid Tier, Premium]"
    
    Returns mapping: {
        "Mainstream": ["Value", "Mid Tier"],
        "Premium": ["Premium"]
    }
    """
    return normalize_grouping_spec(spec_str, grouping_labels=grouping_labels)


def apply_grouping_to_df(
    df: pd.DataFrame,
    attribute_name: str,
    spec_mapping: dict[str, list[str]],
) -> pd.DataFrame:
    """
    Apply synthetic attribute transformation to DataFrame.
    
    Transforms old attribute values to new grouped values based on spec_mapping.
    Marks unmapped values and keeps track of them.
    
    Args:
        df: DataFrame with 'data' column (normalized JSONB from get_filtered_attribute_rows)
        attribute_name: Source attribute name to transform (e.g., "brand_tier")
        spec_mapping: {new_group_name: [old_values...]}
        
    Returns:
        DataFrame with new column '{attribute_name}' containing grouped values,
        plus '_old_value' and '_is_unmapped' tracking columns
    """
    df = df.copy()
    
    # Extract old value from flattened column when present; fall back to data dict
    if attribute_name in df.columns:
        df["_old_value"] = df[attribute_name]
    elif "data" in df.columns:
        df["_old_value"] = df["data"].apply(
            lambda x: x.get(attribute_name) if isinstance(x, dict) else None
        )
    else:
        raise ValueError(f"Attribute '{attribute_name}' not found in data")
    
    # Build reverse mapping (old_value -> new_group_name)
    reverse_mapping = {}
    for new_group, old_values in spec_mapping.items():
        for old_val in old_values:
            reverse_mapping[old_val] = new_group
    
    # Apply mapping
    df[attribute_name] = df['_old_value'].map(reverse_mapping)
    
    # Track unmapped values
    df['_is_unmapped'] = df[attribute_name].isna()
    df[attribute_name] = df[attribute_name].fillna('__unmapped')
    
    return df


def compute_preview_hash(source_path: List[dict], spec_mapping: dict) -> str:
    """
    Generate deterministic hash for cache key.
    
    Hashes (source_path + spec_mapping) to create stable preview_id.
    """
    key_str = json.dumps({
        "path": source_path,
        "mappings": spec_mapping
    }, sort_keys=True)
    return hashlib.sha256(key_str.encode()).hexdigest()[:16]

# TO-DO: Can use shared utils
def get_partition_tree_node(
    case_id: UUID,
    partition_id: UUID,
    node_id: str,
) -> Optional[dict]:
    """
    Fetch node object from Workflow.data partition tree.
    
    Args:
        case_id: Case UUID
        partition_id: Partition UUID
        node_id: Node ID string to find
        
    Returns:
        Node dict if found, None otherwise
    """
    try:
        wf = Workflow.objects.get(
            case_id=case_id,
            partition_id=partition_id,
            is_deleted=False,
        )
    except Workflow.DoesNotExist:
        return None
    
    data = wf.data or {}
    steps = data.get("steps", {})
    partition_tree_result = steps.get("partition_tree", {}).get("result", {})
    tree = partition_tree_result.get("tree", {})
    
    # Find node by ID via DFS
    return _find_node_by_id_dfs(tree, node_id)


def _load_selected_skus_for_workflow(
    case_id: UUID,
    partition_id: UUID,
    pp_metadata_id: UUID,
) -> set[str]:
    try:
        wf = Workflow.objects.get(
            case_id=case_id,
            partition_id=partition_id,
            is_deleted=False,
        )
    except Workflow.DoesNotExist:
        return set()

    steps = (wf.data or {}).get("steps", {})
    selected_ids = steps.get("sku_selection", {}).get("result", {}).get("selected_ids", []) or []
    if not selected_ids:
        return set()

    df_selection = _qs_json_to_df(
        PreprocessedSkuSelection.objects.filter(
            case_id=case_id,
            pp_metadata_id=pp_metadata_id,
            id__in=selected_ids,
        ),
        base_cols=("id", "case_id", "pp_metadata_id"),
    )
    if df_selection.empty:
        return set()
    if "skuname_ean" not in df_selection.columns:
        raise ValueError("preprocessed_sku_selection.data must contain 'skuname_ean'")

    return set(df_selection["skuname_ean"].dropna().astype(str).tolist())


# TO-DO: Can use shared utils
def _find_node_by_id_dfs(root: dict, target_id: str) -> Optional[dict]:
    """
    Depth-first search to find node by ID in partition tree.
    """
    stack = [root]
    while stack:
        node = stack.pop()
        if node.get("id") == target_id:
            return node
        stack.extend(node.get("children", []) or [])
    return None


def compute_virtual_rollup_preview(
    run_id: str,
    case_id: UUID,
    partition_id: UUID,
    node_id: str,
    attribute_name: str,
    new_grouping_spec: dict[str, list[str]] | list[dict[str, Any]] | str,
    grouping_labels: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Main async computation for virtual roll-up preview.
    
    Flow:
    1. Fetch node from partition tree → get source_path
    2. Parse grouping spec → build mapping
    3. Fetch filtered attribute rows for source_path
    4. Apply synthetic grouping
    5. Fetch df_long (ROI matrix) only for selected_skus
    6. Merge grouped attributes to df_long
    7. Compute base testing metrics
    8. Cache result with TTL 1 hour
    
    Args:
        run_id: Unique run identifier for logging
        case_id: Case UUID
        partition_id: Partition UUID
        node_id: Node ID in partition tree
        attribute_name: Attribute to group (e.g., "brand_tier")
        new_grouping_spec: Preferred mapping of new group names to existing values,
            e.g. {"Mainstream": ["Value", "Mid"]}. Legacy strings such as
            "[Value | Mid, Premium]" are still supported.
        grouping_labels: Optional display-name overrides keyed by raw grouped values
            for legacy string payloads.
        
    Returns:
        Preview result dict with base_testing structure matching existing format
    """
    t_total = Timer()
    
    log_event("virtual_rollup.start",
        run_id=run_id,
        case_id=str(case_id),
        partition_id=str(partition_id),
        node_id=node_id,
        attribute_name=attribute_name,
    )
    # Fetch partition metadata for basemath_id
    try:
        partition = get_partition(case_id, partition_id)
        ppm = partition.ppm
        basemath_ppm_id = ppm.id
        att_dataset_id = partition.ppm.att_dataset_id
    except Exception as e:
        log_event("virtual_rollup.partition_fetch_failed",
                  run_id=run_id,
                  error=str(e),
                  )
        return {"status": "error", "reason": "partition_fetch_failed"}
    
    try:
        # Step 1: Fetch node from partition tree
        t = Timer()
        node_obj = get_partition_tree_node(case_id, partition_id, node_id)
        if not node_obj:
            log_event("virtual_rollup.node_not_found", run_id=run_id, node_id=node_id)
            return {"status": "error", "reason": "node_not_found"}
        
        source_path = node_obj.get("path", [])
        log_event("virtual_rollup.node_fetched", run_id=run_id, duration_ms=t.ms(), path_len=len(source_path))
        
        # Step 2: Parse grouping spec
        t = Timer()
        spec_mapping = parse_grouping_spec(new_grouping_spec, grouping_labels=grouping_labels)
        log_event("virtual_rollup.spec_parsed", run_id=run_id, duration_ms=t.ms(), groups=len(spec_mapping))
        
        # Step 3: Fetch filtered attribute rows
        t = Timer()
        qs = get_filtered_attribute_rows(
            node=node_obj,
            case_id=case_id,
            partition_id=partition_id,
            metadata_id=att_dataset_id,  # Will use default logic in get_filtered_attribute_rows
        )
        df_attribute = _qs_json_to_df(
            qs,
            base_cols=_get_attribute_base_cols(qs),
        )
        
        if df_attribute.empty:
            log_event("virtual_rollup.no_filtered_rows", run_id=run_id)
            return {"status": "error", "reason": "no_filtered_rows"}
        
        log_event("virtual_rollup.attr_rows_fetched",
            run_id=run_id,
            duration_ms=t.ms(),
            rows=len(df_attribute),
        )

        if "skuname_ean" not in df_attribute.columns:
            raise ValueError("attribute data must contain 'skuname_ean'")

        selected_skus = _load_selected_skus_for_workflow(
            case_id=case_id,
            partition_id=partition_id,
            pp_metadata_id=partition.ppm_id,
        )
        path_filtered_rows = len(df_attribute)
        df_attribute = df_attribute[df_attribute["skuname_ean"].notna()].copy()
        df_attribute["skuname_ean"] = df_attribute["skuname_ean"].astype(str)
        df_attribute = df_attribute[df_attribute["skuname_ean"].isin(selected_skus)].copy()
        duplicate_rows_removed = int(df_attribute.duplicated(subset=["skuname_ean"]).sum())
        if duplicate_rows_removed:
            df_attribute = df_attribute.drop_duplicates(subset=["skuname_ean"], keep="first")

        if df_attribute.empty:
            log_event(
                "virtual_rollup.no_filtered_rows",
                run_id=run_id,
                path_filtered_rows=path_filtered_rows,
                selected_sku_count=len(selected_skus),
            )
            return {"status": "error", "reason": "no_filtered_rows"}

        log_event(
            "virtual_rollup.selected_sku_filtered",
            run_id=run_id,
            path_filtered_rows=path_filtered_rows,
            selected_sku_count=len(selected_skus),
            filtered_rows=len(df_attribute),
            duplicate_rows_removed=duplicate_rows_removed,
        )
        
        # Step 4: Apply synthetic grouping
        t = Timer()
        grouped_df = apply_grouping_to_df(df_attribute, attribute_name, spec_mapping)
        log_event("virtual_rollup.grouped",
            run_id=run_id,
            duration_ms=t.ms(),
        )
        
        # Track unmapped values
        unmapped_values = [
            None if pd.isna(value) else str(value)
            for value in grouped_df[grouped_df['_is_unmapped']]['_old_value'].unique().tolist()
        ]
        unmapped_sku_count = int(grouped_df['_is_unmapped'].sum())
        
        # Get effective selected SKUs for df_long fetch
        effective_skus = list(grouped_df['skuname_ean'].unique())

        
        # Step 5: Fetch df_long (ROI matrix) ONLY for effective_skus
        t = Timer()
        try:
            df_long = _call_db_get_basemath_long_skuname(
                run_id,
                case_id,
                basemath_ppm_id,
                effective_skus,
            )
            log_event("virtual_rollup.df_long_fetched",
                run_id=run_id,
                duration_ms=t.ms(),
                rows=len(df_long),
            )
        except Exception as e:
            log_event("virtual_rollup.df_long_fetch_failed",
                run_id=run_id,
                error=str(e),
            )
            return {"status": "error", "reason": "df_long_fetch_failed"}
        
        if df_long.empty:
            log_event("virtual_rollup.df_long_empty", run_id=run_id)
            return {"status": "error", "reason": "df_long_empty"}
        
        # Step 6: Merge grouped attributes to df_long
        t = Timer()
        
        # Prepare grouped dataframe for merge (only needed columns)
        df_attr_merge = grouped_df[['skuname_ean', attribute_name]].drop_duplicates(subset=['skuname_ean'])
        
        # Merge right attributes
        df_long = df_long.merge(
            df_attr_merge,
            left_on='skuname_ean_r',
            right_on='skuname_ean',
            how='left',
        )
        
        # Merge left attributes with suffix
        df_long = df_long.merge(
            df_attr_merge,
            left_on='skuname_ean_l',
            right_on='skuname_ean',
            how='left',
            suffixes=('_rr', '_ll'),
        )
        
        df_long.drop(
            columns=['skuname_ean_rr', 'skuname_ean_ll'],
            inplace=True,
            errors='ignore',
        )
        
        log_event("virtual_rollup.merged_attributes",
            run_id=run_id,
            duration_ms=t.ms(),
            rows=len(df_long),
        )
        
        # Step 7: Compute base testing
        t = Timer()
        mk_result = _compute_Mk(df_long, attribute_name, grouped_df)
        row_status = _compute_row_status(mk_result["Mk_df"])
        base_result = _compute_base_result(row_status)
        
        # Build results dict (matching base_testing structure)
        base_testing_results = {
            attribute_name: {
                "Mk": mk_result["Mk_df"],
                "row_status": row_status,
                "base_result": base_result,
                "sku_counts": mk_result["counts_df"],
            }
        }
        
        # Build UUID map for consistency
        uuid_map = _build_attribute_uuid_map(base_testing_results)
        
        # Build compact items (matching existing format)
        attr_item = _build_attribute_item_compact(
            attribute_name,
            base_testing_results[attribute_name],
            uuid_map[attribute_name],
        )
        
        log_event("virtual_rollup.base_testing_computed",
            run_id=run_id,
            duration_ms=t.ms(),
            passed=base_result,
        )
        
        # Step 8: Build preview result
        preview_hash = compute_preview_hash(source_path, spec_mapping)
        
        preview_result = json_safe({
            "status": "success",
            "preview_id": preview_hash,
            "base_testing_preview": {
                "attribute": attribute_name,
                "passed": base_result,
                "item": attr_item,
            },
            "edge_cases": {
                "unmapped_values": unmapped_values,
                "unmapped_sku_count": unmapped_sku_count,
            },
            "computed_at": timezone.now().isoformat(),
        })
        
        # Cache with TTL 1 hour
        cache_key = f"rollup_preview:{case_id}:{partition_id}:{node_id}:{preview_hash}"
        cache.set(cache_key, preview_result, timeout=3600)
        
        log_event("virtual_rollup.completed",
            run_id=run_id,
            duration_ms=t_total.ms(),
            cache_key=cache_key,
        )
        
        return preview_result
        
    except Exception as e:
        log_event("virtual_rollup.failed",
            run_id=run_id,
            error=str(e),
            error_type=type(e).__name__,
            duration_ms=t_total.ms(),
        )
        raise
