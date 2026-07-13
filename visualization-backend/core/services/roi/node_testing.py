"""Per-node Base Testing + Level Testing for the partition-tree "Run" flow.

Faithful port of roi-backend's ``reports/services/workflow/base_testing.py``
math (``_compute_Mk`` / ``_compute_row_status`` / ``_compute_base_result`` and
the compact items/summary payload builders — including the deterministic
``uuid5("BASE_ATTR::<name>")`` attribute ids), orchestrated against this
backend's data model: node SKUs come from the partition-tree context
(``load_context`` + ``_skus_matching_path``) and the ROI long form comes from
the preprocessed ``Metadata`` row instead of Postgres stored functions.

Level testing runs only on the attributes whose base result is True, matching
roi-backend's ``_run_level_testing_for_all_pairs`` prequalification.
"""

from __future__ import annotations

import math
import uuid
from typing import Any

import numpy as np
import pandas as pd
from django.utils import timezone

from core.models import Partition
from core.services.partition_tree.counts import _skus_matching_path, load_context
from core.services.preprocessing.read import (
    metadata_for_current_selection,
    roi_long_from_db,
)

from . import level_testing as level_testing_service
from .analysis import RoiNotReadyError

EMPTY_LEVEL_TESTING = {"lhs": {"columns": [], "rows": []}, "rhs": []}


def _attribute_uuid(attribute_name: str) -> str:
    # Must match roi-backend exactly so attribute ids stay stable across tools.
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"BASE_ATTR::{attribute_name}"))


def _json_safe(obj: Any) -> Any:
    if obj is None or obj is pd.NA or obj is pd.NaT:
        return None
    if isinstance(obj, (float, np.floating)):
        return float(obj) if math.isfinite(float(obj)) else None
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, dict):
        return {key: _json_safe(value) for key, value in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(value) for value in obj]
    if isinstance(obj, (str, int, bool)):
        return obj
    return str(obj)


# --- base testing math (port of roi-backend base_testing.py) -----------------


def _merge_attributes_both_sides(
    roi_long_df: pd.DataFrame, df_attribute: pd.DataFrame
) -> pd.DataFrame:
    """roi-backend's ``_build_roi_long_with_attributes_skuname`` merge step:
    every attribute column appears twice, suffixed ``_rr`` (right SKU) and
    ``_ll`` (left SKU)."""
    merged = roi_long_df.merge(
        df_attribute, left_on="skuname_ean_r", right_on="skuname_ean", how="left"
    )
    merged = merged.merge(
        df_attribute,
        left_on="skuname_ean_l",
        right_on="skuname_ean",
        how="left",
        suffixes=("_rr", "_ll"),
    )
    merged = merged.drop(columns=["skuname_ean_rr", "skuname_ean_ll"], errors="ignore")
    merged["roi"] = pd.to_numeric(merged["roi"], errors="coerce")
    return merged


def _compute_mk(
    df_long: pd.DataFrame, attribute: str, df_attribute: pd.DataFrame
) -> dict[str, pd.DataFrame]:
    col_l = f"{attribute}_ll"
    col_r = f"{attribute}_rr"

    mask = df_long["skuname_ean_l"] != df_long["skuname_ean_r"]
    df_use = df_long.loc[mask, [col_l, col_r, "roi"]]

    grouped = (
        df_use.groupby([col_l, col_r], dropna=False)["roi"]
        .mean()
        .reset_index(name="M_k")
        .rename(columns={col_l: "v", col_r: "w"})
    )
    counts = (
        df_attribute.groupby(attribute, dropna=False)["skuname_ean"]
        .count()
        .reset_index(name="sku_count")
        .rename(columns={attribute: "v"})
    )
    return {"Mk_df": grouped[["v", "w", "M_k"]], "counts_df": counts}


def _compute_row_status(mk_df: pd.DataFrame) -> dict[Any, Any]:
    values = mk_df["v"].dropna().unique().tolist()
    if len(values) == 1:
        return {values[0]: "ONLY_ONE_COMBINATION"}

    diagonal = mk_df[mk_df["v"] == mk_df["w"]].set_index("v")["M_k"].to_dict()
    row_max = mk_df.groupby("v")["M_k"].max().to_dict()

    out: dict[Any, Any] = {}
    for value in values:
        diagonal_value = diagonal.get(value, np.nan)
        max_value = row_max.get(value, np.nan)
        out[value] = bool(pd.notna(diagonal_value) and diagonal_value == max_value)
    return out


def _compute_base_result(row_status: dict[Any, Any]) -> Any:
    values = list(row_status.keys())
    if len(values) == 1:
        return "ONLY_ONE_COMBINATION"
    return all(row_status[value] is True for value in values)


def _attribute_base_testing(
    df_long: pd.DataFrame, df_attribute: pd.DataFrame, attributes: list[str]
) -> dict[str, dict]:
    results: dict[str, dict] = {}
    for attribute in attributes:
        mk = _compute_mk(df_long, attribute, df_attribute)
        row_status = _compute_row_status(mk["Mk_df"])
        results[attribute] = {
            "Mk": mk["Mk_df"],
            "row_status": row_status,
            "base_result": _compute_base_result(row_status),
            "sku_counts": mk["counts_df"],
        }
    return results


def _build_attribute_item_compact(
    attribute_name: str, attr_result: dict, attr_uuid: str
) -> dict:
    mk_df: pd.DataFrame = attr_result["Mk"].copy()
    row_status: dict = attr_result["row_status"]
    counts_df: pd.DataFrame = attr_result["sku_counts"]
    mk_df["v"] = mk_df["v"].fillna("None")
    mk_df["w"] = mk_df["w"].fillna("None")
    row_vals = sorted(mk_df["v"].unique().tolist())
    col_vals = sorted(mk_df["w"].unique().tolist())

    pivot = (
        mk_df.pivot(index="v", columns="w", values="M_k")
        .reindex(index=row_vals, columns=col_vals)
        # Self-pairs are excluded upstream, so a single-SKU value's diagonal
        # cell would otherwise be blank (matches roi-backend).
        .fillna(0.00)
    )
    matrix = pivot.to_numpy(dtype=float)

    sku_count_map = dict(zip(counts_df["v"], counts_df["sku_count"]))
    total_sku_count = int(counts_df["sku_count"].sum())

    rows = [
        [
            bool(row_status.get(value, False)),
            int(sku_count_map.get(value, 0)),
            value,
            matrix[row_index].tolist(),
        ]
        for row_index, value in enumerate(row_vals)
    ]
    return {
        "attribute": attribute_name,
        "id": attr_uuid,
        "columns": ["", total_sku_count, attribute_name, *col_vals],
        "rows": rows,
    }


def _compute_wtd_average_roi(attr_result: dict) -> float:
    mk_df: pd.DataFrame = attr_result["Mk"]
    counts_df: pd.DataFrame = attr_result["sku_counts"]

    sku_count_map = dict(zip(counts_df["v"], counts_df["sku_count"]))
    diagonal = mk_df[mk_df["v"] == mk_df["w"]].copy()
    diagonal["sku_count"] = diagonal["v"].map(sku_count_map).fillna(0).astype(int)
    diagonal["weighted_roi"] = diagonal["M_k"] * diagonal["sku_count"]

    total_sku_count = diagonal["sku_count"].sum()
    if total_sku_count == 0:
        return float("nan")
    return float(diagonal["weighted_roi"].sum() / total_sku_count)


def _build_base_testing_summary(
    base_testing_results: dict, uuid_map: dict[str, str]
) -> dict:
    rows = []
    for index, (attribute_name, attr_result) in enumerate(
        base_testing_results.items(), start=1
    ):
        base_result = attr_result.get("base_result")
        if base_result is True:
            testing_result = "TRUE"
        elif base_result is False:
            testing_result = "FALSE"
        else:
            testing_result = str(base_result)

        wtd_avg_roi = _compute_wtd_average_roi(attr_result)
        rows.append(
            [
                uuid_map[attribute_name],
                index,
                attribute_name,
                testing_result,
                None if pd.isna(wtd_avg_roi) else round(wtd_avg_roi, 3),
                "",
            ]
        )

    return {
        "columns": ["id", "Sno.", "Attribute", "Testing Result", "Wtd Average ROI", "Comments"],
        "rows": rows,
    }


def build_base_testing_payload(base_testing_results: dict) -> dict:
    uuid_map = {name: _attribute_uuid(name) for name in base_testing_results}
    return _json_safe(
        {
            "items": [
                _build_attribute_item_compact(name, attr_result, uuid_map[name])
                for name, attr_result in base_testing_results.items()
            ],
            "summary": _build_base_testing_summary(base_testing_results, uuid_map),
        }
    )


# --- orchestration ------------------------------------------------------------


def run_node_testing(
    *,
    case_id: str,
    partition: Partition,
    node: dict,
    attributes: list[str],
) -> dict[str, Any]:
    """Base + level testing scoped to one partition-tree node's SKUs.

    ``attributes`` is the user's Attribute Selection; unknown names are
    dropped. Returns ``{"base_testing": {items, summary, calculated_at},
    "level_testing": {lhs, rhs}}`` — the payloads the tree dialog's Base
    Testing / Level Testing / Overview tabs consume.
    """
    metadata = metadata_for_current_selection(case_id)
    if metadata is None:
        raise RoiNotReadyError(
            "This case's current dataset combination has not been preprocessed yet."
        )

    ctx = load_context(partition)
    requested = [a for a in attributes if a in ctx.attribute_columns]
    if not requested:
        raise ValueError("Select at least one attribute to test.")

    path = node.get("path") or []
    node_skus = _skus_matching_path(ctx, path) if path else list(ctx.selected_skus)
    if len(node_skus) < 2:
        raise ValueError("This node has fewer than 2 SKUs — nothing to test.")

    roi_long = roi_long_from_db(metadata.id, node_skus)
    df_attribute = level_testing_service.attribute_frame(ctx, requested)
    df_attribute = df_attribute[
        df_attribute["skuname_ean"].isin(set(node_skus))
    ].reset_index(drop=True)

    df_long = _merge_attributes_both_sides(roi_long, df_attribute)
    base_testing_results = _attribute_base_testing(df_long, df_attribute, requested)

    base_payload = build_base_testing_payload(base_testing_results)
    base_payload["calculated_at"] = timezone.now().isoformat()

    passing = [
        name
        for name, attr_result in base_testing_results.items()
        if attr_result["base_result"] is True
    ]
    level_payload = (
        level_testing_service.run_level_testing(roi_long, df_attribute, passing)
        if len(passing) >= 2
        else dict(EMPTY_LEVEL_TESTING)
    )

    return {"base_testing": base_payload, "level_testing": level_payload}
