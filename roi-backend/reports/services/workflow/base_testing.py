from __future__ import annotations

import uuid
from typing import Dict, Any, List, Tuple
from .base_math import _call_db_get_basemath_long_skuname
import numpy as np
import pandas as pd
from django.db.models import QuerySet
from django.utils import timezone

from .shared_utils import build_q_from_path, _qs_json_to_df, get_filtered_attribute_rows, _get_attribute_base_cols
from ...models import (
    PreprocessedSkuSelection,
    RawAttributesData,
    RawCrossPurchaseData, PartitionDatasetMetadata, WorkingAttributesData,
)
Node = Dict[str, Any]
from decimal import Decimal
import math
from .observability import log_event, Timer
import time

def df_to_compact_table(df: pd.DataFrame):
    columns = df.columns.tolist()
    out = df.loc[:, columns]
    rows = out.to_numpy(dtype=object, copy=False).tolist()

    for r in rows:
        for j, v in enumerate(r):

            # NULLs / missing
            if v is None or v is pd.NA or v is pd.NaT:
                r[j] = None
                continue

            # float + numpy float (NaN / inf)
            if isinstance(v, (float, np.floating)):
                if not math.isfinite(v):
                    r[j] = None
                else:
                    r[j] = v
                continue

            # Decimal NaN / Inf
            if isinstance(v, Decimal):
                if not v.is_finite():
                    r[j] = None
                else:
                    r[j] = str(v)
                continue

            # Everything else → string-safe
            r[j] = str(v)

    return {"columns": columns, "rows": rows}

# def _qs_json_to_df(qs, base_cols: Tuple[str, ...]) -> pd.DataFrame:
#     rows: List[Dict[str, Any]] = []
#     for obj in qs:
#         row = {}
#         for c in base_cols:
#             row[c] = getattr(obj, c)
#         data = obj.data or {}
#         if isinstance(data, dict):
#             row.update(data)
#         rows.append(row)
#     df= pd.DataFrame(rows)
#     if df.shape[0]!=0:
#         df.columns = df.columns.str.replace(r'[\u200b\u200c\u200d\uFEFF]', '', regex=True)
#     return df




def _get_labels_from_cp_df(df_cp: pd.DataFrame) -> List[str]:
    cols = list(df_cp.columns)
    if len(cols) <= 6:
        return []
    return [str(c) for c in cols[6:]]


# def _build_roi_long_with_attributes(
#     base_math_data:dict,
#     df_attribute: pd.DataFrame, # Node Filtered and SKU Selection filtered
#  ) -> pd.DataFrame:
#
#     #Convert the Ordered Dict received from _call_db_get_joined into dataframe
#     df_matrix = pd.DataFrame(base_math_data)
#
#     assert not df_matrix.empty
#
#     # Universe should match df_attribute (node ∩ selected)
#     effective_selected = set(df_attribute["skuname_ean"].astype(str))
#
#     # filter rows (left SKU)
#     df_matrix = df_matrix[df_matrix["skuname_ean"].astype(str).isin(effective_selected)]
#
#     # filter columns (right SKU)
#     keep_cols = ["skuname_ean"] + [
#         c for c in df_matrix.columns
#         if c in effective_selected
#     ]
#     df_matrix = df_matrix[keep_cols]
#
#     # Unpivot and convert ROI Matrix to long format
#     df_long = (
#         df_matrix.melt(
#             id_vars="skuname_ean",
#             var_name="skuname_ean_r",
#             value_name="roi",
#         )
#         .rename(columns={"skuname_ean": "skuname_ean_l"})
#     )
#
#     df_long = df_long.merge(df_attribute, left_on="skuname_ean_r", right_on="skuname_ean", how="left")
#     df_long = df_long.merge(
#         df_attribute,
#         left_on="skuname_ean_l",
#         right_on="skuname_ean",
#         how="left",
#         suffixes=("_rr", "_ll"),
#     )
#     df_long.drop(columns=["skuname_ean_rr", "skuname_ean_ll"], inplace=True, errors="ignore")
#     df_long["roi"] = pd.to_numeric(df_long["roi"], errors="coerce")
#     return df_long

def _build_roi_long_with_attributes_skuname(run_id,
    df_attribute: pd.DataFrame, # Node Filtered and SKU Selection filtered
    case_id, basemath_id
 ) -> pd.DataFrame:
    try:
        # Universe should match df_attribute (node ∩ selected)
        effective_selected = set(df_attribute["skuname_ean"].astype(str))
        final_skunames = list(effective_selected)
        df_long = _call_db_get_basemath_long_skuname(run_id,case_id, basemath_id, final_skunames)
        log_event( "roi_long.db_returned",run_id=run_id,rows=len(df_long),cols=len(df_long.columns))
        if df_long.empty:
            log_event("roi_long.empty_after_db",run_id=run_id,level="warning")
        t = Timer()
        df_long = df_long.merge(df_attribute, left_on="skuname_ean_r", right_on="skuname_ean", how="left")
        log_event("df_long merged to get right attributes",run_id=run_id, rows=len(df_long), duration_ms=t.ms())
        t = time.perf_counter()
        df_long = df_long.merge(
            df_attribute,
            left_on="skuname_ean_l",
            right_on="skuname_ean",
            how="left",
            suffixes=("_rr", "_ll"),
        )
        t = Timer()
        log_event("df_long merged to get left attributes",run_id=run_id, rows=len(df_long), duration_ms=t.ms())
        df_long.drop(columns=["skuname_ean_rr", "skuname_ean_ll"], inplace=True, errors="ignore")
        df_long["roi"] = pd.to_numeric(df_long["roi"], errors="coerce")
        return df_long
    except Exception as e:
        log_event("roi_long.build.failed",run_id=run_id,error=str(e),error_type=type(e).__name__)
        raise

def _build_attribute_uuid_map(base_testing_results: dict) -> dict:

    return { attr_name: str(uuid.uuid5(uuid.NAMESPACE_DNS, f"BASE_ATTR::{attr_name}")) for attr_name in base_testing_results.keys() }

def _compute_Mk(df: pd.DataFrame, attribute: str, df_attribute: pd.DataFrame) -> Dict[str, Any]:
    col_l = f"{attribute}_ll"
    col_r = f"{attribute}_rr"

    mask = df["skuname_ean_l"] != df["skuname_ean_r"]
    df_use = df.loc[mask, [col_l, col_r, "roi"]]

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


def _compute_row_status(Mk_df: pd.DataFrame) -> Dict[Any, Any]:
    values = Mk_df["v"].dropna().unique().tolist()
    if len(values) == 1:
        return {values[0]: "ONLY_ONE_COMBINATION"}

    diag = Mk_df[Mk_df["v"] == Mk_df["w"]].set_index("v")["M_k"].to_dict()
    max_row = Mk_df.groupby("v")["M_k"].max().to_dict()

    out: Dict[Any, Any] = {}
    for v in values:
        d_v = diag.get(v, np.nan)
        m_v = max_row.get(v, np.nan)
        out[v] = bool(pd.notna(d_v) and d_v == m_v)
    return out


def _compute_base_result(row_status: Dict[Any, Any]) -> Any:
    values = list(row_status.keys())
    if len(values) == 1:
        return "ONLY_ONE_COMBINATION"
    if all(row_status[v] is True for v in values):
        return True
    return False


def _attribute_base_testing(df_long: pd.DataFrame, df_attribute: pd.DataFrame, attributes: List[str]) -> Dict[str, Any]:
    results: Dict[str, Any] = {}
    for attr in attributes:
        mk = _compute_Mk(df_long, attr, df_attribute)
        row_status = _compute_row_status(mk["Mk_df"])
        base_res = _compute_base_result(row_status)

        results[attr] = {
            "Mk": mk["Mk_df"],
            "row_status": row_status,
            "base_result": base_res,
            "sku_counts": mk["counts_df"],
        }
    return results


def _build_attribute_item_compact(attribute_name: str, attr_result: dict, attr_uuid: str) -> dict:
    Mk_df: pd.DataFrame = attr_result["Mk"]
    row_status: dict = attr_result["row_status"]
    counts_df: pd.DataFrame = attr_result["sku_counts"]
    Mk_df["v"] = Mk_df["v"].fillna("None")
    Mk_df["w"] = Mk_df["w"].fillna("None")
    row_vals = sorted(Mk_df["v"].unique().tolist())
    col_vals = sorted(Mk_df["w"].unique().tolist())

    pivot = (
        Mk_df
        .pivot(index="v", columns="w", values="M_k")
        .reindex(index=row_vals, columns=col_vals)
        .fillna(0.00) #adding to handle because self -pairs are removed so if an attribute has a single SKU the diagonal will be blank
    )
    matrix_np = pivot.to_numpy(dtype=float)

    sku_count_map = dict(zip(counts_df["v"], counts_df["sku_count"]))
    total_sku_count = int(counts_df["sku_count"].sum())

    rows_array = []
    for row_index, v in enumerate(row_vals):
        rows_array.append([
            bool(row_status.get(v, False)),
            int(sku_count_map.get(v, 0)),
            v,
            matrix_np[row_index].tolist()
        ])

    columns_array = ["", total_sku_count, attribute_name] + col_vals

    return {
        "attribute": attribute_name,
        "id": attr_uuid,
        "columns": columns_array,
        "rows": rows_array,
    }

def _build_all_items_compact(base_testing_results: dict, uuid_map: dict) -> dict:
    items = []
    for attr_name, attr_result in base_testing_results.items():
        items.append(
            _build_attribute_item_compact(attr_name, attr_result, uuid_map[attr_name])
        )
    return {"items": items}

def _compute_wtd_average_roi(attr_result: dict) -> float:
    mk_df: pd.DataFrame = attr_result["Mk"]
    counts_df: pd.DataFrame = attr_result["sku_counts"]

    # Map v -> sku_count
    sku_count_map = dict(zip(counts_df["v"], counts_df["sku_count"]))

    # Extract diagonal elements
    diag_df = mk_df[mk_df["v"] == mk_df["w"]].copy()
    diag_df["sku_count"] = diag_df["v"].map(sku_count_map).fillna(0).astype(int)
    diag_df["weighted_roi"] = diag_df["M_k"] * diag_df["sku_count"]

    total_weighted_roi = diag_df["weighted_roi"].sum()
    total_sku_count = diag_df["sku_count"].sum()

    if total_sku_count == 0:
        return float('nan')

    return float(total_weighted_roi / total_sku_count)

def _build_base_testing_summary(base_testing_results: dict, uuid_map: dict) -> dict:
    rows = []

    for idx, (attr_name, attr_result) in enumerate(base_testing_results.items(), start=1):
        base_result = attr_result.get("base_result")

        if base_result is True:
            testing_result = "TRUE"
        elif base_result is False:
            testing_result = "FALSE"
        else:
            testing_result = str(base_result)

        wtd_avg_roi = _compute_wtd_average_roi(attr_result)

        rows.append([
            uuid_map[attr_name],  # <- UUID included here
            idx,
            attr_name,
            testing_result,
            None if pd.isna(wtd_avg_roi) else round(wtd_avg_roi, 3),
            ""
        ])

    return {
        "summary": {
            "columns": ["id","Sno.", "Attribute", "Testing Result", "Wtd Average ROI", "Comments"],
            "rows": rows
        }
    }

def _build_base_testing_payload(
    base_testing_results: dict,
    uuid_map: dict
) -> dict:
    """
    Build the full Base Testing JSON payload.

    Returns:
    {
      "items": [...],
      "summary": {
          "columns": [...],
          "rows": [...] }

    }
    """

    items_block = _build_all_items_compact(
        base_testing_results=base_testing_results,
        uuid_map=uuid_map
    )

    summary_block = _build_base_testing_summary(
        base_testing_results=base_testing_results,
        uuid_map=uuid_map
    )

    d_data = json_safe({
        **items_block,           # contains "items"
        **summary_block          # contains "summary"
    })

    return d_data


def json_safe(obj):
    # Missing / null-like
    if obj is None or obj is pd.NA or obj is pd.NaT:
        return None

    # Floats (python + numpy) -> block NaN/inf
    if isinstance(obj, (float, np.floating)):
        return obj if math.isfinite(float(obj)) else None

    # Decimals can be NaN/Inf too
    if isinstance(obj, Decimal):
        return str(obj) if obj.is_finite() else None

    # Dict
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}

    # List / tuple
    if isinstance(obj, (list, tuple)):
        return [json_safe(v) for v in obj]

    # Leave other JSON-safe scalars as-is; stringify unknown objects
    if isinstance(obj, (str, int, bool)):
        return obj

    return str(obj)


# ----------------------------
# calculator
# ----------------------------

def _calculate_base_testing(
    run_id,
    case_id,
    partition_id,
    node_obj,
    attributes_list,
    selected_ids,
    ppm_id,
    att_dataset_id,
    cp_dataset_id,
    basemath_ppm_id,
) -> dict:
    t_total = Timer()
    log_event("base_testing.start", run_id=run_id, case_id=str(case_id))

    # ---- Load selected SKUs ----
    t = Timer()
    df_temp2 = _qs_json_to_df(
        PreprocessedSkuSelection.objects.filter(case_id=case_id, pp_metadata_id=ppm_id, id__in=selected_ids),
        base_cols=("id", "case_id", "pp_metadata_id"),
    )
    log_event("sku_selection.loaded", run_id=run_id, rows=len(df_temp2), duration_ms=t.ms())

    if "skuname_ean" not in df_temp2.columns:
        raise ValueError("preprocessed_sku_selection.data must contain 'skuname_ean'")
    selected_skus = set(df_temp2["skuname_ean"].astype(str).tolist())

    # ---- Load attributes (prefer WorkingAttributesData via helper; fallback to raw ATTRIBUTES) ----
    # get_filtered_attribute_rows already prefers WorkingAttributesData (keyed by GROUPING metadata)
    t = Timer()
    if node_obj.get("path"):
        qs = get_filtered_attribute_rows(
            node=node_obj,
            case_id=case_id,
            partition_id=partition_id,
            metadata_id=att_dataset_id,  # fallback attributes metadata id
        )
        df_attribute = _qs_json_to_df(
            qs,
            # Works for BOTH WorkingAttributesData and RawAttributesData
            base_cols=_get_attribute_base_cols(qs),
        )
    else:
        # No path filter => prefer working table if it exists & has rows, else fallback

        grouping_md = PartitionDatasetMetadata.objects.filter(
            case_id=case_id,
            partition_id=partition_id,
            data_type="GROUPING",
            status="Ready",
            is_deleted=False,
            is_selected=True,  # remove if not used
        ).order_by("-created_on").first()

        if grouping_md and WorkingAttributesData.objects.filter(grouping_metadata_id=grouping_md.id).exists():
            qs = WorkingAttributesData.objects.filter(grouping_metadata_id=grouping_md.id)
            df_attribute = _qs_json_to_df(qs, base_cols=("id", "case_id", "partition_id", "row_num"))
        else:
            qs = RawAttributesData.objects.filter(case_id=case_id, metadata_id=att_dataset_id)
            df_attribute = _qs_json_to_df(qs, base_cols=("id", "case_id", "metadata_id", "version"))

    log_event(
        "attributes.loaded",
        run_id=run_id,
        rows=len(df_attribute),
        cols=len(df_attribute.columns),
        duration_ms=t.ms(),
    )

    if "skuname_ean" not in df_attribute.columns:
        raise ValueError("attribute data must contain 'skuname_ean'")

    # ---- Filter to selected SKUs ----
    sku_list_df = df_attribute[df_attribute["skuname_ean"].astype(str).isin(selected_skus)]

    # ---- Build ROI long ----
    t = Timer()
    df_long = _build_roi_long_with_attributes_skuname(
        run_id,
        sku_list_df,
        case_id,
        basemath_ppm_id,
    )
    log_event("roi_long.loaded", run_id=run_id, rows=len(df_long), duration_ms=t.ms())

    sku_list_json = df_to_compact_table(sku_list_df)

    # ---- Base testing ----
    skip_cols = {
        "id", "case_id", "metadata_id", "version", "tags", "row_num", "partition_id",
        "skuname_ean", "Brand", "Sub-brand", "EAN Code", "Manufacturer"
    }
    attributes = [c for c in df_attribute.columns if c not in skip_cols]
    log_event("base_testing.attrs", run_id=run_id, attribute_count=len(attributes))

    base_testing_results = _attribute_base_testing(
        df_long,
        sku_list_df,
        attributes_list,
    )

    log_event("base_testing.done", run_id=run_id, duration_ms=t_total.ms())

    uuid_map = _build_attribute_uuid_map(base_testing_results)
    payload = _build_base_testing_payload(base_testing_results, uuid_map)

    result = {
        **payload,
        "calculated_at": timezone.now().isoformat(),
    }

    return {
        "result": result,
        "df_long": df_long,
        "df_sku_list": sku_list_df,
        "base_testing_results": base_testing_results,
        "sku_list_json": sku_list_json,
    }


# register_step_calculator('base_testing', _calculate_base_testing)
