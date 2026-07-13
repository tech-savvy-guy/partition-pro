"""ROI methodology orchestrator.

Reads exclusively from the preprocessed ``Metadata`` row for the case's
current dataset selection — there is no on-the-fly fallback. Callers
(``RoiRunView.post``) must call ``core.services.preprocessing.guard.
require_case_ready`` before dispatching compute at all; this module re-checks
readiness itself as a safety net in case dataset selection changed between
dispatch and task execution.

``avg_roi``/``abs_pen%`` are full-panel per-SKU constants persisted on
``Metadata`` at preprocessing time (``Metadata.avg_roi``/``row_max``+``base``)
— NOT recomputed from a selection-filtered subset, since both depend on the
whole ingested panel, not on which SKUs happen to be selected right now
(matches roi-backend). Attributes and selected SKUs continue to come from
``RawAttributesData``/``WorkflowRun.parameters`` exactly as before
(``core.services.partition_tree.counts.load_context``) — nothing new to
build there.
"""

from __future__ import annotations

from typing import Any

import pandas as pd
from django.utils import timezone

from core.models import Partition
from core.services import workflow_store
from core.services.partition_tree.counts import load_context
from core.services.partition_tree.store import load_graph
from core.services.preprocessing.read import (
    abs_pen_pct_for_skus,
    avg_roi_for_skus,
    metadata_for_current_selection,
    roi_long_from_db,
)
from core.services.sku_selection import _normalize_key

from . import level_testing as level_testing_service
from .coverage import compute_coverage
from .obm import compute_obm

# Metric columns that precede the per-SKU ROI block in the SKU Math table.
_SKU_MATH_METRIC_COLUMNS = ("avg_roi", "abs_pen%")


class RoiNotReadyError(Exception):
    pass


def compute_roi_result(
    *,
    case_id: str,
    partition_id: str,
    selected_skus: list[str],
    include_obm: bool = True,
    include_level_testing: bool = True,
    include_coverage: bool = True,
    dataset_ids: dict[str, str | None] | None = None,
) -> dict[str, Any]:
    selected_skus = [
        sku for sku in (_normalize_key(s) for s in selected_skus) if sku
    ]

    metadata = metadata_for_current_selection(case_id)
    if metadata is None:
        raise RoiNotReadyError(
            "This case's current dataset combination has not been preprocessed yet."
        )

    roi_long = roi_long_from_db(metadata.id, selected_skus)
    abs_pen_pct = abs_pen_pct_for_skus(metadata, selected_skus)
    avg_roi = avg_roi_for_skus(metadata, selected_skus)

    partition = Partition.objects.filter(id=partition_id, case_id=case_id).first()
    attributes_by_sku: dict[str, dict] = {}
    attribute_columns: list[str] = []
    ctx = None
    if partition is not None:
        ctx = load_context(partition)
        attributes_by_sku = ctx.attributes_by_sku
        attribute_columns = ctx.attribute_columns

    sku_math_table = _build_sku_math_table(
        selected_skus=selected_skus,
        roi_long_df=roi_long,
        avg_roi=avg_roi,
        abs_pen_pct=abs_pen_pct,
        attributes_by_sku=attributes_by_sku,
        attribute_columns=attribute_columns,
    )

    payload: dict[str, Any] = {
        "case_id": str(case_id),
        "partition_id": str(partition_id),
        "metadata": {
            "selected_sku_count": len(selected_skus),
            "full_panel_sku_count": metadata.sku_count,
            "metadata_id": str(metadata.id),
            "generated_at": timezone.now().isoformat(),
        },
        "sku_math": _dataframe_to_table(sku_math_table),
    }

    # Coverage is independent of partition attributes, so it must land before
    # the no-attributes early return below.
    if include_coverage:
        payload["coverage"] = compute_coverage(
            case_id=case_id,
            selected_skus=selected_skus,
            dataset_ids=dataset_ids,
        )

    if not include_obm and not include_level_testing:
        return payload
    if partition is None or ctx is None or not ctx.attribute_columns:
        return payload

    if include_obm:
        workflow = workflow_store.get_partition_workflow(partition)
        graph = load_graph(workflow) if workflow is not None else None
        nodes = (graph or {}).get("nodes") or []
        obm_result = compute_obm(ctx, nodes, roi_long)
        if obm_result is not None:
            payload["obm"] = obm_result.compact

    if include_level_testing:
        df_attribute = level_testing_service.attribute_frame(ctx, ctx.attribute_columns)
        payload["level_testing"] = level_testing_service.run_level_testing(
            roi_long,
            df_attribute,
            ctx.attribute_columns,
        )

    return payload


def _build_sku_math_table(
    *,
    selected_skus: list[str],
    roi_long_df: pd.DataFrame,
    avg_roi: dict[str, float | None],
    abs_pen_pct: dict[str, float | None],
    attributes_by_sku: dict[str, dict],
    attribute_columns: list[str],
) -> pd.DataFrame:
    roi_wide = _roi_long_to_wide(roi_long_df, selected_skus)

    rows = []
    for sku in selected_skus:
        row = {col: attributes_by_sku.get(sku, {}).get(col) for col in attribute_columns}
        row["skuname_ean"] = sku
        row["avg_roi"] = avg_roi.get(sku)
        row["abs_pen%"] = abs_pen_pct.get(sku)
        rows.append(row)
    table = pd.DataFrame(rows)
    table = table.merge(roi_wide, on="skuname_ean", how="left")

    ordered = (
        list(attribute_columns)
        + ["skuname_ean"]
        + list(_SKU_MATH_METRIC_COLUMNS)
        + [c for c in selected_skus if c in table.columns]
    )
    ordered = [c for c in ordered if c in table.columns]
    return table[ordered]


def _roi_long_to_wide(roi_long_df: pd.DataFrame, selected_skus: list[str]) -> pd.DataFrame:
    if roi_long_df.empty:
        return pd.DataFrame({"skuname_ean": selected_skus})
    wide = (
        roi_long_df.pivot_table(
            index="skuname_ean_l",
            columns="skuname_ean_r",
            values="roi",
            aggfunc="first",
        )
        .reindex(index=selected_skus, columns=selected_skus)
    )
    wide = wide.fillna(0.0)
    wide.index.name = "skuname_ean"
    return wide.reset_index()


def _dataframe_to_table(df: pd.DataFrame) -> dict:
    from core.services.visualization.serialization import dataframe_to_table

    return dataframe_to_table(df)
