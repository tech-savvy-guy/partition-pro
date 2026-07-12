"""SKU / client-SKU counting for partition-tree nodes.

Unlike roi-backend (which queries ``PreprocessedSkuSelection``), counts here are
derived from the visualization-backend raw datasets: the selected ATTRIBUTES
dataset supplies per-SKU attribute values and the CROSSPURCHASE dataset supplies
the ``is_client`` flag. Selected SKUs come from the non-visualization
``WorkflowRun.parameters['selected_skus']``.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from core.models import (
    Partition,
    RawAttributesData,
    RawCrossPurchaseData,
)
from core.services import workflow_store
from core.services.sku_selection import (
    SKU_JOIN_KEY,
    _get_selected_raw_datasets,
    _normalize_key,
)

# Same truthy set roi-backend uses for the client flag (shared_utils.py:8).
CLIENT_FLAG_TRUE_STRINGS = {"1", "true", "t", "yes", "y"}

# Columns that live in the raw rows but are not selectable partition attributes.
_NON_ATTRIBUTE_COLUMNS = {
    SKU_JOIN_KEY,
    "id",
    "case_id",
    "metadata_id",
    "row_num",
    "version",
    "category",
    "total_base_buyers",
    "raw_buyers",
    "is_branded",
    "is_client",
}


def _is_client_flag(value) -> bool:
    return str(value or "").strip().lower() in CLIENT_FLAG_TRUE_STRINGS


@dataclass
class PartitionTreeContext:
    selected_skus: list[str] = field(default_factory=list)
    attributes_by_sku: dict[str, dict] = field(default_factory=dict)
    client_skus: set[str] = field(default_factory=set)
    attribute_columns: list[str] = field(default_factory=list)


def _selected_skus_for_partition(partition: Partition) -> list[str]:
    workflow = workflow_store.get_partition_workflow(partition)
    return workflow_store.get_selected_skus(workflow)


def load_context(partition: Partition) -> PartitionTreeContext:
    """Load selected SKUs, per-SKU attribute values and client flags."""
    case_id = partition.case_id
    selected_skus = _selected_skus_for_partition(partition)
    selected_set = set(selected_skus)

    datasets = _get_selected_raw_datasets(case_id)

    attributes_by_sku: dict[str, dict] = {}
    attribute_columns: list[str] = []
    if datasets.attributes is not None:
        rows = RawAttributesData.objects.filter(
            case_id=case_id,
            metadata_id=datasets.attributes.id,
        ).order_by("row_num")
        seen_cols: set[str] = set()
        for row in rows:
            data = row.data or {}
            sku = _normalize_key(data.get(SKU_JOIN_KEY))
            if not sku or sku not in selected_set or sku in attributes_by_sku:
                continue
            attributes_by_sku[sku] = data
            for column in data.keys():
                if column in _NON_ATTRIBUTE_COLUMNS or column in seen_cols:
                    continue
                seen_cols.add(column)
                attribute_columns.append(column)

    client_skus: set[str] = set()
    if datasets.cross_purchase is not None:
        cross_rows = RawCrossPurchaseData.objects.filter(
            case_id=case_id,
            metadata_id=datasets.cross_purchase.id,
        ).order_by("row_num")
        for row in cross_rows:
            data = row.data or {}
            sku = _normalize_key(data.get(SKU_JOIN_KEY))
            if sku in selected_set and _is_client_flag(data.get("is_client")):
                client_skus.add(sku)

    return PartitionTreeContext(
        selected_skus=selected_skus,
        attributes_by_sku=attributes_by_sku,
        client_skus=client_skus,
        attribute_columns=attribute_columns,
    )


def _skus_matching_path(ctx: PartitionTreeContext, path: list[dict]) -> list[str]:
    matched = []
    for sku in ctx.selected_skus:
        attrs = ctx.attributes_by_sku.get(sku, {})
        ok = True
        for step in path or []:
            attribute = step.get("attribute")
            value = step.get("value")
            if attribute is None or value is None:
                continue
            if _normalize_key(attrs.get(attribute)) != _normalize_key(value):
                ok = False
                break
        if ok:
            matched.append(sku)
    return matched


def compute_counts_for_path(
    ctx: PartitionTreeContext, path: list[dict]
) -> tuple[int, int]:
    """Return (sku_count, client_sku_count) for the SKUs matching ``path``."""
    matched = _skus_matching_path(ctx, path)
    sku_count = len(matched)
    client_sku_count = sum(1 for sku in matched if sku in ctx.client_skus)
    return int(sku_count), int(client_sku_count)


def attribute_value_counts(
    ctx: PartitionTreeContext, path: list[dict], attribute_name: str
) -> dict[str, tuple[int, int]]:
    """Group SKUs matching ``path`` by ``attribute_name`` value.

    Returns ``{value: (sku_count, client_sku_count)}``, skipping blank values.
    """
    counts: dict[str, tuple[int, int]] = {}
    for sku in _skus_matching_path(ctx, path):
        attrs = ctx.attributes_by_sku.get(sku, {})
        value = _normalize_key(attrs.get(attribute_name))
        if not value:
            continue
        sku_count, client_count = counts.get(value, (0, 0))
        is_client = 1 if sku in ctx.client_skus else 0
        counts[value] = (sku_count + 1, client_count + is_client)
    return counts


def selectable_attributes(ctx: PartitionTreeContext, node: dict) -> list[str]:
    """Attribute columns still available to expand under ``node``.

    Excludes any attribute already constrained by the node's path.
    """
    used = {
        step.get("attribute")
        for step in (node.get("path") or [])
        if step.get("attribute")
    }
    return [column for column in ctx.attribute_columns if column not in used]
