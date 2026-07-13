"""Compare-coverage: pandas port of roi-backend's ``core.get_overall_coverage``
and ``core.get_attribute_coverage`` SQL functions (source:
``roi-tool/roi-backend/db_schema/migrations/sql/0001_baseline_existing_azure_dev/
core/functions/``). No stored procedures — computed in Python from the raw
dataset tables.

Differences from the SQL, both deliberate:

- roi-backend selected SKUs by ``preprocessed_sku_selection`` row UUIDs; here
  the selection is ``skuname_ean`` strings (``workflow_store.get_selected_skus``).
  The SQL immediately reduced ids to ``DISTINCT skuname_ean``, so filtering by
  name is equivalent. The SQL's ``temp2`` (that pre-joined table) is rebuilt
  here as CROSSPURCHASE rows left-joined to POS sales.
- The SQL read per-SKU attribute values from columns embedded in the POS file;
  here the ATTRIBUTES dataset is the single source (merged into every frame),
  matching how the rest of this backend treats attributes
  (``core.services.partition_tree.counts.load_context``).
"""

from __future__ import annotations

import re
from uuid import UUID

import pandas as pd
from django.utils import timezone

from core.models import (
    Dataset,
    RawAttributesData,
    RawCrossPurchaseData,
    RawPosData,
)
from core.services.partition_tree.counts import _NON_ATTRIBUTE_COLUMNS, _is_client_flag
from core.services.visualization.adapter import dataset_from_context, rows_to_dataframe
from core.services.visualization.serialization import json_safe_value

# CROSSPURCHASE columns that are metadata, not per-SKU buyer counts (the SQL's
# exclusion list; the BOM variant is kept even though ingestion decodes
# utf-8-sig, mirroring the SQL verbatim).
_CP_META_KEYS = {
    "is_client",
    "is_branded",
    "raw_buyers",
    "skuname_ean",
    "total_base_buyers",
    "category",
    "﻿category",
}

# Model columns added by rows_to_dataframe on top of the raw CSV columns.
_LOADER_COLUMNS = ("id",)

# The SQL's numeric guard for buyer-matrix cells (`^[+-]?\d+(\.\d+)?$`).
_NUMERIC_CELL_PATTERN = re.compile(r"^[+-]?\d+(\.\d+)?$")


def compute_coverage(
    *,
    case_id: UUID | str,
    selected_skus: list[str],
    dataset_ids: dict[str, str | None] | None = None,
) -> dict | None:
    """Overall + per-attribute POS coverage for the current SKU selection.

    Returns ``None`` when the POS or CROSSPURCHASE dataset is missing —
    coverage is meaningless without both sides of the panel.
    """
    pos_dataset = dataset_from_context(case_id, Dataset.Type.POS, dataset_ids)
    cp_dataset = dataset_from_context(case_id, Dataset.Type.CROSS_PURCHASE, dataset_ids)
    if pos_dataset is None or cp_dataset is None:
        return None
    att_dataset = dataset_from_context(case_id, Dataset.Type.ATTRIBUTES, dataset_ids)

    pos_df = _load_pos_frame(case_id, pos_dataset)
    cp_df = _load_cp_frame(case_id, cp_dataset)
    panel_df = _build_panel_frame(cp_df, pos_df)

    selected = {str(sku).strip() for sku in selected_skus if str(sku).strip()}
    sel_df = panel_df[panel_df["skuname_ean"].isin(selected)]

    attr_map, attribute_columns = _attribute_values(case_id, att_dataset)

    return {
        "overall_coverage": _overall_coverage(pos_df, panel_df, sel_df, cp_df),
        "coverage": _attribute_coverage(
            pos_df, panel_df, sel_df, attr_map, attribute_columns
        ),
        "generated_at": timezone.now().isoformat(),
    }


# --- loaders -----------------------------------------------------------------


def _load_pos_frame(case_id, dataset: Dataset) -> pd.DataFrame:
    df = rows_to_dataframe(
        RawPosData.objects.filter(case_id=case_id, metadata_id=dataset.id).order_by(
            "row_num"
        ),
        base_cols=_LOADER_COLUMNS,
    )
    if df.empty or "skuname_ean" not in df.columns:
        return pd.DataFrame(
            columns=["skuname_ean", "is_client", "dollar_sales", "volume_sales"]
        )
    return pd.DataFrame(
        {
            "skuname_ean": df["skuname_ean"].astype(str).str.strip(),
            "is_client": df.get("is_client", pd.Series(index=df.index, dtype=object))
            .map(_is_client_flag)
            .astype(int),
            "dollar_sales": _coalesced_numeric(df.get("dollar_sales"), df.index),
            "volume_sales": _coalesced_numeric(df.get("volume_sales"), df.index),
        }
    )


def _load_cp_frame(case_id, dataset: Dataset) -> pd.DataFrame:
    df = rows_to_dataframe(
        RawCrossPurchaseData.objects.filter(
            case_id=case_id, metadata_id=dataset.id
        ).order_by("row_num"),
        base_cols=_LOADER_COLUMNS,
    )
    if df.empty or "skuname_ean" not in df.columns:
        return pd.DataFrame(columns=["skuname_ean"])
    df = df.copy()
    df["skuname_ean"] = df["skuname_ean"].astype(str).str.strip()
    return df


def _build_panel_frame(cp_df: pd.DataFrame, pos_df: pd.DataFrame) -> pd.DataFrame:
    """The SQL's ``temp2``: one row per panel SKU with is_client/raw_buyers
    from CROSSPURCHASE and sales from POS (0 when the SKU has no POS row)."""
    if cp_df.empty:
        return pd.DataFrame(
            columns=[
                "skuname_ean",
                "is_client",
                "raw_buyers",
                "dollar_sales",
                "volume_sales",
            ]
        )
    panel = pd.DataFrame(
        {
            "skuname_ean": cp_df["skuname_ean"],
            "is_client": cp_df.get(
                "is_client", pd.Series(index=cp_df.index, dtype=object)
            )
            .map(_is_client_flag)
            .astype(int),
            "raw_buyers": _coalesced_numeric(cp_df.get("raw_buyers"), cp_df.index),
        }
    ).drop_duplicates(subset=["skuname_ean"], keep="first")

    pos_sales = pos_df.drop_duplicates(subset=["skuname_ean"], keep="first")[
        ["skuname_ean", "dollar_sales", "volume_sales"]
    ]
    panel = panel.merge(pos_sales, on="skuname_ean", how="left")
    panel[["dollar_sales", "volume_sales"]] = panel[
        ["dollar_sales", "volume_sales"]
    ].fillna(0.0)
    return panel


def _attribute_values(case_id, dataset: Dataset | None) -> tuple[pd.DataFrame, list[str]]:
    """``skuname_ean`` → attribute-value map (first row per SKU wins) plus the
    ordered attribute column list (sheet columns minus non-attribute keys)."""
    if dataset is None:
        return pd.DataFrame(columns=["skuname_ean"]), []
    df = rows_to_dataframe(
        RawAttributesData.objects.filter(
            case_id=case_id, metadata_id=dataset.id
        ).order_by("row_num"),
        base_cols=_LOADER_COLUMNS,
    )
    if df.empty or "skuname_ean" not in df.columns:
        return pd.DataFrame(columns=["skuname_ean"]), []
    df = df.copy()
    df["skuname_ean"] = df["skuname_ean"].astype(str).str.strip()
    df = df.drop_duplicates(subset=["skuname_ean"], keep="first")
    attribute_columns = [
        column for column in df.columns if column not in _NON_ATTRIBUTE_COLUMNS
    ]
    return df[["skuname_ean", *attribute_columns]], attribute_columns


def _coalesced_numeric(series: pd.Series | None, index) -> pd.Series:
    """SQL ``COALESCE((data->>'x')::numeric, 0)`` — non-numeric/absent → 0."""
    if series is None:
        return pd.Series(0.0, index=index)
    normalized = series.astype(str).str.replace(",", "", regex=False).str.strip()
    return pd.to_numeric(normalized, errors="coerce").fillna(0.0)


# --- overall coverage --------------------------------------------------------


def _overall_coverage(
    pos_df: pd.DataFrame,
    panel_df: pd.DataFrame,
    sel_df: pd.DataFrame,
    cp_df: pd.DataFrame,
) -> dict:
    pos_agg = _sales_agg(pos_df)
    sel_agg = _sales_agg(sel_df)
    panel_agg = _sales_agg(panel_df)

    return {
        "total_pos": {
            "skus": pos_agg["skus"],
            "client_skus": pos_agg["client_skus"],
            "value": json_safe_value(pos_agg["value"]),
            "volume": json_safe_value(pos_agg["volume"]),
        },
        "current_selection": {
            "min_n_cutoff_selected": json_safe_value(_min_raw_buyers(sel_df)),
            "skus": sel_agg["skus"],
            "client_skus": sel_agg["client_skus"],
            **_coverage_pcts(sel_agg, pos_agg),
            "percent_zeroes": json_safe_value(
                _percent_zeroes(cp_df, set(sel_df["skuname_ean"]))
            ),
        },
        "all_panel_skus": {
            "min_n": json_safe_value(_min_raw_buyers(panel_df)),
            "skus": panel_agg["skus"],
            "client_skus": panel_agg["client_skus"],
            **_coverage_pcts(panel_agg, pos_agg),
            "percent_zeroes": json_safe_value(
                _percent_zeroes(cp_df, set(panel_df["skuname_ean"]))
            ),
        },
    }


def _sales_agg(df: pd.DataFrame) -> dict:
    if df.empty:
        return {
            "skus": 0,
            "client_skus": 0,
            "value": 0.0,
            "volume": 0.0,
            "client_value": 0.0,
            "client_volume": 0.0,
        }
    client = df[df["is_client"] == 1]
    return {
        "skus": int(df["skuname_ean"].nunique()),
        "client_skus": int(df["is_client"].sum()),
        "value": float(df["dollar_sales"].sum()),
        "volume": float(df["volume_sales"].sum()),
        "client_value": float(client["dollar_sales"].sum()),
        "client_volume": float(client["volume_sales"].sum()),
    }


def _min_raw_buyers(df: pd.DataFrame) -> float | None:
    # SQL ``MIN(raw_buyers)`` over per-row-coalesced values; NULL on no rows.
    if df.empty or "raw_buyers" not in df.columns:
        return None
    return float(df["raw_buyers"].min())


def _coverage_pcts(agg: dict, pos_agg: dict) -> dict:
    def pct(numerator: float, denominator: float) -> float:
        return (numerator / denominator) * 100.0 if denominator > 0 else 0.0

    return {
        "pos_coverage_value_pct": json_safe_value(pct(agg["value"], pos_agg["value"])),
        "pos_coverage_volume_pct": json_safe_value(
            pct(agg["volume"], pos_agg["volume"])
        ),
        "client_coverage_value_pct": json_safe_value(
            pct(agg["client_value"], pos_agg["client_value"])
        ),
        "client_coverage_volume_pct": json_safe_value(
            pct(agg["client_volume"], pos_agg["client_volume"])
        ),
    }


def _percent_zeroes(cp_df: pd.DataFrame, sku_scope: set[str]) -> float | None:
    """Share of zero cells among numeric buyer-matrix cells for the scoped
    CROSSPURCHASE **rows** (columns stay full-panel, exactly like the SQL's
    ``jsonb_each_text`` over the whole row minus meta keys)."""
    if cp_df.empty:
        return None
    scoped = cp_df[cp_df["skuname_ean"].isin(sku_scope)]
    value_columns = [
        column
        for column in scoped.columns
        if column not in _CP_META_KEYS and column not in _LOADER_COLUMNS
    ]
    if scoped.empty or not value_columns:
        return None
    cells = scoped[value_columns].astype(str).apply(lambda s: s.str.strip())
    numeric_mask = cells.apply(lambda s: s.str.fullmatch(_NUMERIC_CELL_PATTERN).fillna(False))
    total = int(numeric_mask.to_numpy().sum())
    if total == 0:
        return None
    values = pd.to_numeric(cells.to_numpy()[numeric_mask.to_numpy()], errors="coerce")
    zeros = int((values == 0).sum())
    return (zeros / total) * 100.0


# --- attribute coverage -------------------------------------------------------


def _attribute_coverage(
    pos_df: pd.DataFrame,
    panel_df: pd.DataFrame,
    sel_df: pd.DataFrame,
    attr_map: pd.DataFrame,
    attribute_columns: list[str],
) -> list[dict]:
    coverage: list[dict] = []
    for index, attribute in enumerate(attribute_columns, start=1):
        values = attr_map[["skuname_ean", attribute]].rename(
            columns={attribute: "attribute_value"}
        )
        pos_a = pos_df.merge(values, on="skuname_ean", how="left")
        panel_a = panel_df.merge(values, on="skuname_ean", how="left")
        sel_a = sel_df.merge(values, on="skuname_ean", how="left")

        pos_groups = _group_sales(pos_a, sku_col="pos_skus")
        tbl_all = _split_joined(_group_sales(panel_a, sku_col="panel_skus"), pos_groups)
        tbl_sel = _split_joined(_group_sales(sel_a, sku_col="panel_skus"), pos_groups)
        pos_split = _split_pure_pos(pos_a)

        coverage.append(
            {
                "id": index,
                "attribute": attribute,
                "color_flag": _color_flag(tbl_sel, tbl_all, pos_split),
                "details": [
                    {
                        "pos_sales_split_custom": _joined_rows(tbl_sel),
                        "pos_sales_split_panel": _joined_rows(tbl_all),
                        "pos_sales_split": _pure_pos_rows(pos_split),
                    }
                ],
            }
        )
    return coverage


def _group_sales(df: pd.DataFrame, *, sku_col: str) -> pd.DataFrame:
    """Group sales by attribute value, dropping the NULL group (the SQL's
    subsequent ``JOIN ... ON attribute_value`` never matches NULL keys)."""
    if df.empty:
        return pd.DataFrame(columns=["attribute_value", sku_col, "value", "volume"])
    grouped = (
        df.dropna(subset=["attribute_value"])
        .groupby("attribute_value", sort=False)
        .agg(
            **{
                sku_col: ("skuname_ean", "nunique"),
                "value": ("dollar_sales", "sum"),
                "volume": ("volume_sales", "sum"),
            }
        )
        .reset_index()
    )
    return grouped


def _split_joined(mapped: pd.DataFrame, pos_groups: pd.DataFrame) -> pd.DataFrame:
    """The SQL's ``tbl_all``/``tbl_sel``: inner-join panel-mapped sales onto
    pure-POS sales per attribute value; covered pcts row-wise, shares over the
    post-join window."""
    tbl = mapped.merge(
        pos_groups,
        on="attribute_value",
        how="inner",
        suffixes=("_mapped", "_pos"),
    )
    if tbl.empty:
        return tbl
    value_total = tbl["value_mapped"].sum()
    volume_total = tbl["volume_mapped"].sum()
    tbl["pos_value_covered"] = [
        round((mapped_value / pos_value) * 100.0, 3) if pos_value > 0 else 0.0
        for mapped_value, pos_value in zip(tbl["value_mapped"], tbl["value_pos"])
    ]
    tbl["pos_volume_covered"] = [
        round((mapped_volume / pos_volume) * 100.0, 3) if pos_volume > 0 else 0.0
        for mapped_volume, pos_volume in zip(tbl["volume_mapped"], tbl["volume_pos"])
    ]
    tbl["value_share"] = [
        round((v / value_total) * 100.0, 3) if value_total != 0 else None
        for v in tbl["value_mapped"]
    ]
    tbl["volume_share"] = [
        round((v / volume_total) * 100.0, 3) if volume_total != 0 else None
        for v in tbl["volume_mapped"]
    ]
    return tbl


def _split_pure_pos(pos_a: pd.DataFrame) -> pd.DataFrame:
    """The SQL's ``g_pos_split``: pure POS split keeping the NULL group (the
    frontend renders an empty ``sub_attribute`` as "Overall")."""
    if pos_a.empty:
        return pd.DataFrame(
            columns=["attribute_value", "skus_number", "pos_value", "pos_volume"]
        )
    grouped = (
        pos_a.groupby("attribute_value", sort=False, dropna=False)
        .agg(
            skus_number=("skuname_ean", "nunique"),
            pos_value=("dollar_sales", "sum"),
            pos_volume=("volume_sales", "sum"),
        )
        .reset_index()
    )
    value_total = grouped["pos_value"].sum()
    volume_total = grouped["pos_volume"].sum()
    grouped["value_share"] = [
        round((v / value_total) * 100.0, 3) if value_total != 0 else None
        for v in grouped["pos_value"]
    ]
    grouped["volume_share"] = [
        round((v / volume_total) * 100.0, 3) if volume_total != 0 else None
        for v in grouped["pos_volume"]
    ]
    return grouped


def _color_flag(
    tbl_sel: pd.DataFrame, tbl_all: pd.DataFrame, pos_split: pd.DataFrame
) -> str:
    if pos_split.empty:
        return "RED"
    if not tbl_sel.empty and not tbl_all.empty:
        compared = tbl_sel.merge(
            tbl_all, on="attribute_value", how="inner", suffixes=("_sel", "_all")
        )
        diverges = (
            (compared["value_mapped_sel"] - compared["value_mapped_all"]).abs()
            > 0.10 * compared["value_mapped_all"].abs()
        ) | (
            (compared["volume_mapped_sel"] - compared["volume_mapped_all"]).abs()
            > 0.10 * compared["volume_mapped_all"].abs()
        )
        if bool(diverges.any()):
            return "YELLOW"
    return "GREEN"


def _sort_rows(rows: list[dict]) -> list[dict]:
    # Deterministic output (the SQL had no ORDER BY): by sub_attribute, None last.
    return sorted(
        rows, key=lambda row: (row["sub_attribute"] is None, str(row["sub_attribute"]))
    )


def _joined_rows(tbl: pd.DataFrame) -> list[dict]:
    return _sort_rows(
        [
            {
                "sub_attribute": json_safe_value(row["attribute_value"]),
                "skus_number": int(row["panel_skus"]),
                "pos_volume_covered": json_safe_value(row["pos_volume_covered"]),
                "pos_value_covered": json_safe_value(row["pos_value_covered"]),
                "value_share": json_safe_value(row["value_share"]),
                "volume_share": json_safe_value(row["volume_share"]),
            }
            for row in tbl.to_dict("records")
        ]
    )


def _pure_pos_rows(pos_split: pd.DataFrame) -> list[dict]:
    return _sort_rows(
        [
            {
                "sub_attribute": (
                    None if pd.isna(row["attribute_value"]) else str(row["attribute_value"])
                ),
                "skus_number": int(row["skus_number"]),
                "pos_volume": json_safe_value(row["pos_volume"]),
                "pos_value": json_safe_value(row["pos_value"]),
                "value_share": json_safe_value(row["value_share"]),
                "volume_share": json_safe_value(row["volume_share"]),
            }
            for row in pos_split.to_dict("records")
        ]
    )
