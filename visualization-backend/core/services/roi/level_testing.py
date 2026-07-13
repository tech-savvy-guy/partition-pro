"""Level Testing: pairwise attribute win/loss/tie via weighted-average ROI.

Port of roi-backend's ``reports/services/workflow/level_testing.py``. The
core scoring math (``_build_level_cells`` / ``_compute_level_scores`` /
``_compute_round_winner`` / ``build_level_testing_json``) is kept verbatim —
it was already pure pandas there, with no DB dependency. What changes is how
the per-SKU attribute values and the long-form ROI pairs are sourced: here
they come from ``core.services.partition_tree.counts.PartitionTreeContext``
and the in-memory ROI matrix (``core.services.roi.base_math``) instead of
roi-backend's PPM-backed DB rows.
"""

from __future__ import annotations

import logging
import uuid
from itertools import combinations

import numpy as np
import pandas as pd

from core.services.partition_tree.counts import PartitionTreeContext

logger = logging.getLogger(__name__)

# Above this many attribute pairs, log a warning — O(pairs) pandas groupbys
# over the full non-diagonal SKU x SKU long form can get slow for wide
# attribute sets. See plan's "vectorize the OBM leaf aggregation" note.
LEVEL_TESTING_PAIR_WARNING_THRESHOLD = 200


def _attr_uuid(attr_name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"ATTR::{attr_name}"))


def _pair_uuid(attr1: str, attr2: str) -> str:
    a, b = sorted([attr1, attr2])
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"PAIR::{a}__{b}"))


def _round3(x):
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    return float(np.round(float(x), 3))


def attribute_frame(ctx: PartitionTreeContext, attribute_columns: list[str]) -> pd.DataFrame:
    """``skuname_ean`` + one column per attribute, restricted to selected SKUs."""
    rows = []
    for sku in ctx.selected_skus:
        attrs = ctx.attributes_by_sku.get(sku, {})
        row = {"skuname_ean": sku}
        for column in attribute_columns:
            row[column] = attrs.get(column)
        rows.append(row)
    return pd.DataFrame(rows, columns=["skuname_ean", *attribute_columns])


def _build_level_cells(
    df_roi_nondiag: pd.DataFrame,
    attr_L1: str,
    attr_L2: str,
    df_attribute: pd.DataFrame,
) -> dict:
    """Build the ``a x b`` cell matrix for Level Testing.

    Each row is a combination ``(l, m)`` with:
      ``ROI_cell(l, m)`` = mean roi over SKU pairs in that cell
      ``N(l, m)``         = number of SKUs in that cell
    """
    sku_attrs = df_attribute[["skuname_ean", attr_L1, attr_L2]]
    left = sku_attrs.rename(
        columns={"skuname_ean": "skuname_ean_l", attr_L1: f"{attr_L1}_ll", attr_L2: f"{attr_L2}_ll"}
    )
    right = sku_attrs.rename(
        columns={"skuname_ean": "skuname_ean_r", attr_L1: f"{attr_L1}_rr", attr_L2: f"{attr_L2}_rr"}
    )
    df_sku = df_roi_nondiag.merge(left, on="skuname_ean_l", how="inner")
    df_sku = df_sku.merge(right, on="skuname_ean_r", how="inner")

    attr_L1_l, attr_L2_l = f"{attr_L1}_ll", f"{attr_L2}_ll"
    attr_L1_r, attr_L2_r = f"{attr_L1}_rr", f"{attr_L2}_rr"

    cells = (
        df_sku.groupby([attr_L1_l, attr_L2_l, attr_L1_r, attr_L2_r])["roi"]
        .agg(ROI_cell="mean")
        .reset_index()
    )
    cells = cells.rename(
        columns={
            attr_L1_l: "L1_value_l",
            attr_L2_l: "L2_value_l",
            attr_L1_r: "L1_value_r",
            attr_L2_r: "L2_value_r",
        }
    )

    counts = (
        df_attribute.groupby([attr_L1, attr_L2])["skuname_ean"]
        .count()
        .reset_index(name="sku_count")
        .rename(columns={attr_L1: "L1_value", attr_L2: "L2_value"})
    )

    return {"level_df": cells, "counts_df": counts}


def _compute_level_scores(level_result: dict) -> pd.DataFrame:
    scores = level_result["counts_df"]

    def _wtd_avg(row, *, keep_l1_fixed: bool):
        L1_value, L2_value = row["L1_value"], row["L2_value"]
        level_df = level_result["level_df"]
        if keep_l1_fixed:
            sub = level_df[
                (level_df["L1_value_r"] == L1_value)
                & (level_df["L2_value_r"] == L2_value)
                & (level_df["L1_value_l"] == L1_value)
                & (level_df["L2_value_l"] != L2_value)
            ]
        else:
            sub = level_df[
                (level_df["L1_value_r"] == L1_value)
                & (level_df["L2_value_r"] == L2_value)
                & (level_df["L1_value_l"] != L1_value)
                & (level_df["L2_value_l"] == L2_value)
            ]
        merged = sub.merge(
            level_result["counts_df"],
            left_on=["L1_value_l", "L2_value_l"],
            right_on=["L1_value", "L2_value"],
            how="left",
        )
        vals = merged["ROI_cell"].to_numpy(dtype=float)
        wts = merged["sku_count"].fillna(0).to_numpy(dtype=float)
        mask_w = wts > 0
        vals, wts = vals[mask_w], wts[mask_w]
        if wts.sum() == 0:
            return float("nan")
        return round(float((vals * wts).sum() / wts.sum()), 2)

    def decide_winner(row):
        if row["sku_count"] == 1:
            return "NA - Only 1 SKU"
        L1s, L2s = row["L1_wtd_avg_roi"], row["L2_wtd_avg_roi"]
        if pd.isna(L1s) or pd.isna(L2s):
            return "NA - Only 1 Combo"
        diff = L1s - L2s
        if abs(diff) == 0.0:
            return "EQUAL"
        return "L1" if diff > 0 else "L2"

    scores["L1_wtd_avg_roi"] = scores.apply(lambda row: _wtd_avg(row, keep_l1_fixed=True), axis=1)
    scores["L2_wtd_avg_roi"] = scores.apply(lambda row: _wtd_avg(row, keep_l1_fixed=False), axis=1)
    scores["winner"] = scores.apply(decide_winner, axis=1)
    return scores


def _compute_round_winner(level_df: pd.DataFrame) -> dict:
    counts = level_df["winner"].value_counts().to_dict()
    wins_L1 = counts.get("L1", 0)
    wins_L2 = counts.get("L2", 0)
    wins_Tie = counts.get("EQUAL", 0)
    wins_NA = counts.get("NA - Only 1 SKU", 0) + counts.get("NA - Only 1 Combo", 0)

    if wins_L1 > wins_L2:
        round_winner = "L1"
    elif wins_L2 > wins_L1:
        round_winner = "L2"
    else:
        round_winner = "None"

    comments = "Weak Win" if abs(wins_L1 - wins_L2) == 1 else ""

    return {
        "wins_L1": wins_L1,
        "wins_L2": wins_L2,
        "wins_Tie": wins_Tie,
        "wins_NA": wins_NA,
        "round_winner": round_winner,
        "comments": comments,
    }


def _build_math_json(pair_data: dict, total_sku_count: int | None = None) -> dict:
    L1_name, L2_name = pair_data["L1"], pair_data["L2"]
    df_math: pd.DataFrame = pair_data["math"]
    df_res: pd.DataFrame = pair_data["results"]

    valid_combos = (
        df_res.loc[df_res["sku_count"] > 0, ["L1_value", "L2_value"]]
        .drop_duplicates()
        .rename(columns={"L1_value": "L1_value_l", "L2_value": "L2_value_l"})
    )
    pivot = (
        df_math.pivot(
            index=["L1_value_l", "L2_value_l"],
            columns=["L1_value_r", "L2_value_r"],
            values="ROI_cell",
        )
        .reindex(index=pd.MultiIndex.from_frame(valid_combos))
        .reindex(
            columns=pd.MultiIndex.from_frame(
                valid_combos.rename(
                    columns={"L1_value_l": "L1_value_r", "L2_value_l": "L2_value_r"}
                )
            )
        )
        .fillna(0.0)
    )
    col_pairs = list(pivot.columns)

    top_hdr = ["", "", ""] + [l1 for (l1, _l2) in col_pairs]
    if total_sku_count is None:
        total_sku_count = int(df_res["sku_count"].sum()) if "sku_count" in df_res.columns else 0
    bot_hdr = [int(total_sku_count), L1_name, L2_name] + [l2 for (_l1, l2) in col_pairs]

    sku_count_map = {(r["L1_value"], r["L2_value"]): int(r["sku_count"]) for _, r in df_res.iterrows()}

    rows = []
    for (l1_l, l2_l), row_vals in zip(pivot.index.tolist(), pivot.to_numpy()):
        cells = [_round3(v) for v in row_vals.tolist()]
        rows.append([int(sku_count_map.get((l1_l, l2_l), 0)), l1_l, l2_l, cells])

    return {"columns": [top_hdr, bot_hdr], "rows": rows}


def _build_results_json(pair_data: dict) -> dict:
    L1_name, L2_name = pair_data["L1"], pair_data["L2"]
    df_res: pd.DataFrame = pair_data["results"]
    cols = ["SKU Count", L1_name, L2_name, L1_name, L2_name, "Winner"]

    rows = []
    for _, r in df_res.iterrows():
        winner = r.get("winner")
        if winner == "L1":
            winner_label = L1_name
        elif winner == "L2":
            winner_label = L2_name
        else:
            winner_label = str(winner) if winner is not None else None
        rows.append(
            [
                int(r["sku_count"]),
                r["L1_value"],
                r["L2_value"],
                _round3(r["L1_wtd_avg_roi"]),
                _round3(r["L2_wtd_avg_roi"]),
                winner_label,
            ]
        )
    return {"columns": cols, "rows": rows}


def build_level_testing_json(level_result: dict) -> dict:
    pairs_dict = level_result.get("pairs", {})
    attr_summary = level_result.get("attribute_summary", {})

    attrs = [
        (name, int(s.get("wins", 0)), int(s.get("losses", 0)), int(s.get("ties", 0)))
        for name, s in attr_summary.items()
    ]
    attrs.sort(key=lambda x: (-x[1], -x[3], x[2], x[0]))

    lhs_columns = ["id", "rank", "attribute", "win_times", "loss_times", "tie_times", "comment"]
    attr_uuid_map = {a[0]: _attr_uuid(a[0]) for a in attrs}
    lhs_rows = [
        [attr_uuid_map[name], rank, name, wins, losses, ties, ""]
        for rank, (name, wins, losses, ties) in enumerate(attrs, start=1)
    ]

    pair_objs_by_uuid: dict[str, dict] = {}
    for pair_name, pair_data in pairs_dict.items():
        a1, a2 = pair_data["L1"], pair_data["L2"]
        p_uuid = _pair_uuid(a1, a2)
        if p_uuid in pair_objs_by_uuid:
            continue
        df_res = pair_data.get("results")
        total_skus = int(df_res["sku_count"].sum()) if isinstance(df_res, pd.DataFrame) and "sku_count" in df_res.columns else None
        winner = pair_data.get("summary", {}).get("round_winner")
        final_winner = a1 if winner == "L1" else a2 if winner == "L2" else str(winner)
        pair_objs_by_uuid[p_uuid] = {
            "pair_key": p_uuid,
            "attribute_1": a1,
            "attribute_2": a2,
            "final_winner": final_winner,
            "math": _build_math_json(pair_data, total_sku_count=total_skus),
            "results": _build_results_json(pair_data),
        }

    rhs_blocks = []
    for attr_name, _wins, _losses, _ties in attrs:
        detailed = [
            pobj
            for pobj in pair_objs_by_uuid.values()
            if pobj["attribute_1"] == attr_name or pobj["attribute_2"] == attr_name
        ]
        detailed.sort(key=lambda x: (x["attribute_1"], x["attribute_2"]))
        rhs_blocks.append(
            {
                "attribute_id": attr_uuid_map[attr_name],
                "attribute_name": attr_name,
                "detailed_result": detailed,
            }
        )

    return {"lhs": {"columns": lhs_columns, "rows": lhs_rows}, "rhs": rhs_blocks}


def run_level_testing(
    roi_long_df: pd.DataFrame,
    df_attribute: pd.DataFrame,
    attribute_columns: list[str],
) -> dict:
    """Pairwise-test every candidate attribute against every other one.

    Unlike roi-backend, there is no upstream "base testing" prequalification
    step here yet, so every attribute in ``attribute_columns`` is a
    candidate. ``attribute_columns`` should already exclude attributes with
    a single distinct value (nothing to test).
    """
    valid_attrs = [
        attr
        for attr in attribute_columns
        if df_attribute[attr].dropna().nunique() > 1
    ]
    pair_count = len(valid_attrs) * (len(valid_attrs) - 1) // 2
    if pair_count > LEVEL_TESTING_PAIR_WARNING_THRESHOLD:
        logger.warning(
            "level_testing: %d attribute pairs (%d attributes) — this may be slow",
            pair_count,
            len(valid_attrs),
        )

    df_nondiag = roi_long_df[roi_long_df["skuname_ean_l"] != roi_long_df["skuname_ean_r"]]

    pair_results: dict[str, dict] = {}
    attribute_summary = {attr: {"wins": 0, "losses": 0, "ties": 0} for attr in valid_attrs}

    for attr_L1, attr_L2 in combinations(valid_attrs, 2):
        cells = _build_level_cells(df_nondiag, attr_L1, attr_L2, df_attribute)
        level_df = _compute_level_scores(cells)
        round_info = _compute_round_winner(level_df)
        pair_results[f"{attr_L1}_vs_{attr_L2}"] = {
            "L1": attr_L1,
            "L2": attr_L2,
            "math": cells["level_df"],
            "results": level_df,
            "summary": round_info,
        }

        winner = round_info.get("round_winner")
        if winner == "L1":
            attribute_summary[attr_L1]["wins"] += 1
            attribute_summary[attr_L2]["losses"] += 1
        elif winner == "L2":
            attribute_summary[attr_L2]["wins"] += 1
            attribute_summary[attr_L1]["losses"] += 1
        elif winner == "None":
            attribute_summary[attr_L1]["ties"] += 1
            attribute_summary[attr_L2]["ties"] += 1

    return build_level_testing_json({"pairs": pair_results, "attribute_summary": attribute_summary})
