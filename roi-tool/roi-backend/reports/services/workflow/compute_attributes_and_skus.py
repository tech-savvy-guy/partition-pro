from typing import Dict, Any

from django.core.exceptions import ObjectDoesNotExist

from reports.models import Workflow, PreprocessedSkuSelection, RawAttributesData, WorkingAttributesData, \
    PartitionDatasetMetadata
from reports.services.workflow.base import get_partition
from reports.services.workflow.base_testing import  df_to_compact_table
from reports.services.workflow.shared_utils import (
    _qs_json_to_df,
    client_flag_mask,
    client_skus_from_selection_df,
    get_filtered_attribute_rows,
    _get_attribute_base_cols,
)

from typing import Dict, Any
import pandas as pd
from django.core.exceptions import ObjectDoesNotExist


def compute_attributes_and_skus(case_id, partition_id, node_obj: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compute SKU list + attribute columns for a partition node.

    Prefers working merged attributes (ATTRIBUTES + GROUPING) for the partition if available;
    falls back to raw ATTRIBUTES if working rows are missing.

    Returns:
      - sku_list: compact table of selected SKUs (rows)
      - attrs_list: compact table of attribute column names
            - attribute_values: mapping of attribute name -> {value -> client SKU count}
      - merged_attributes_used: bool
    """
    node_id = node_obj.get("id")
    if not node_id:
        raise ValueError("node_obj.id is required")

    partition = get_partition(case_id, partition_id)
    ppm = partition.ppm

    try:
        wf = Workflow.objects.get(case_id=case_id, partition_id=partition_id, is_deleted=False)
    except ObjectDoesNotExist:
        raise ValueError("Workflow does not exist for this partition")

    steps = (wf.data or {}).get("steps", {})
    selected_ids = steps.get("sku_selection", {}).get("result", {}).get("selected_ids", []) or []

    # ---- Load selected SKUs (from preprocessed selection) ----
    df_sel = _qs_json_to_df(
        PreprocessedSkuSelection.objects.filter(
            case_id=case_id,
            pp_metadata_id=partition.ppm_id,
            id__in=selected_ids,
        ),
        base_cols=("id", "case_id", "pp_metadata_id"),
    )

    if "skuname_ean" not in df_sel.columns:
        raise ValueError("preprocessed_sku_selection.data must contain 'skuname_ean'")

    selected_skus = set(df_sel["skuname_ean"].astype(str).tolist())
    selected_client_skus = client_skus_from_selection_df(df_sel)

    # ---- Prefer merged working attributes (keyed by GROUPING metadata) ----


    grouping_md = PartitionDatasetMetadata.objects.filter(
        case_id=case_id,
        partition_id=partition_id,
        data_type="GROUPING",
        status="Ready",
        is_deleted=False,
        is_selected=True,          # drop if you don't use selection semantics
    ).order_by("-created_on").first()

    merged_used = False

    if node_obj.get("path"):
        # get_filtered_attribute_rows now prefers WorkingAttributesData internally
        qs_attr = get_filtered_attribute_rows(
            node=node_obj,
            case_id=case_id,
            partition_id=partition_id,
            metadata_id=ppm.att_dataset_id,  # fallback attributes metadata
        )
        # determine if working table was actually used
        merged_used = qs_attr.model is WorkingAttributesData
    else:
        # No path filter => pull full table, prefer working if present and non-empty
        qs_attr = None
        if grouping_md:
            qs_working = WorkingAttributesData.objects.filter(grouping_metadata_id=grouping_md.id)
            if qs_working.exists():
                qs_attr = qs_working
                merged_used = True

        if qs_attr is None:
            qs_attr = RawAttributesData.objects.filter(case_id=case_id, metadata_id=ppm.att_dataset_id)
            merged_used = False

    # ---- Convert to dataframe ----
    # Note: WorkingAttributesData does not have metadata_id; so base_cols must be compatible.
    # If _qs_json_to_df expects columns to exist, keep base_cols minimal.
    df_attribute = _qs_json_to_df(
        qs_attr,
        base_cols=_get_attribute_base_cols(qs_attr),
    )

    if "skuname_ean" not in df_attribute.columns:
        raise ValueError("Attribute data must contain 'skuname_ean' column")

    # ---- Filter to selected SKUs ----
    sku_list_df = df_attribute[df_attribute["skuname_ean"].astype(str).isin(selected_skus)]

    # Prepare SKU list output
    EXCLUDE_COLS = {
        "id", "case_id", "metadata_id", "pp_metadata_id", "partition_id", "version", "row_num"
    }
    sku_list_df = sku_list_df.drop(columns=[c for c in EXCLUDE_COLS if c in sku_list_df.columns], errors="ignore")
    sku_list_json = df_to_compact_table(sku_list_df)

    # Collect attributes (columns)
    attrs_cols = [
        c for c in df_attribute.columns
        if c not in {"id", "case_id", "metadata_id", "version", "partition_id", "row_num", "skuname_ean"}
    ]

    attrs_list = df_to_compact_table(
        pd.DataFrame(
            {
                "is_selected": [False] * len(attrs_cols),
                "Attribute Name": sorted(attrs_cols),
            }
        )
    )

    # Build per-value client SKU counts for each attribute from the same filtered SKU scope used above.
    attribute_values: dict[str, dict[str, int]] = {}
    sorted_attrs = sorted(attrs_cols)
    has_selection_client_flag = "is_client" in df_sel.columns
    has_attribute_client_flag = "is_client" in sku_list_df.columns
    if has_selection_client_flag:
        client_sku_mask = sku_list_df["skuname_ean"].astype(str).isin(selected_client_skus)
    elif has_attribute_client_flag:
        client_sku_mask = client_flag_mask(sku_list_df["is_client"])
    else:
        client_sku_mask = None

    for attr_name in sorted_attrs:
        if attr_name not in sku_list_df.columns:
            attribute_values[attr_name] = {}
            continue

        ser = sku_list_df[attr_name].dropna().astype(str).str.strip()
        ser = ser[ser != ""]
        values = sorted(ser.drop_duplicates().tolist())

        if client_sku_mask is None:
            attribute_values[attr_name] = {v: 0 for v in values}
            continue

        df_attr_client = sku_list_df[client_sku_mask].copy()
        if df_attr_client.empty:
            attribute_values[attr_name] = {v: 0 for v in values}
            continue

        client_ser = df_attr_client[attr_name].dropna().astype(str).str.strip()
        client_ser = client_ser[client_ser != ""]
        counts_map = client_ser.value_counts().to_dict()
        attribute_values[attr_name] = {v: int(counts_map.get(v, 0)) for v in values}

    return {
        "success": True,
        "sku_list": sku_list_json,
        "attrs_list": attrs_list,
        "attribute_values": attribute_values,
        "merged_attributes_used": merged_used,
    }



