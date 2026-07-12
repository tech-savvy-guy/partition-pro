from itertools import combinations
from .observability import log_event, Timer
import uuid
import pandas as pd
import numpy as np


def _attr_uuid(attr_name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"ATTR::{attr_name}"))

def _pair_uuid(attr1: str, attr2: str) -> str:
    a, b = sorted([attr1, attr2])
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"PAIR::{a}__{b}"))

def _round3(x):
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    return float(np.round(float(x), 3))

def _build_math_json(pair_data: dict, total_sku_count: int | None = None) -> dict:
    L1_name = pair_data["L1"]
    L2_name = pair_data["L2"]

    df_math: pd.DataFrame = pair_data["math"]
    df_res: pd.DataFrame = pair_data["results"]

    # stable ordering
    l1_vals = sorted(df_math["L1_value_r"].dropna().unique().tolist())
    l2_vals = sorted(df_math["L2_value_r"].dropna().unique().tolist())

    # build ROI matrix for fast row extraction

    pivot = (
        df_math
        .pivot(index=["L1_value_l", "L2_value_l"], columns=["L1_value_r", "L2_value_r"], values="ROI_cell")
        .reindex(index=pd.MultiIndex.from_frame(
            df_res.loc[df_res["sku_count"] > 0, ["L1_value", "L2_value"]] #this is just a check and it gives a stable order
            .drop_duplicates()
            .rename(columns={"L1_value": "L1_value_l", "L2_value": "L2_value_l"})
        ))
        .reindex(columns=pd.MultiIndex.from_frame(
            df_res.loc[df_res["sku_count"] > 0, ["L1_value", "L2_value"]]
            .drop_duplicates()
            .rename(columns={"L1_value": "L1_value_r", "L2_value": "L2_value_r"})
        )).fillna(0.0)
    )
    col_pairs = list(pivot.columns)  # list of (L1_value_r, L2_value_r) tuples

    # header rows
    top_hdr = ["", "", ""] + [l1 for (l1, l2) in col_pairs]
    if total_sku_count is None:
        # best-effort: use sum of sku_count in results
        total_sku_count = int(df_res["sku_count"].sum()) if "sku_count" in df_res.columns else 0
    bot_hdr = [int(total_sku_count), L1_name, L2_name] + [l2 for (l1, l2) in col_pairs]

    # map (L1_value, L2_value) -> sku_count
    sku_count_map = {
        (r["L1_value"], r["L2_value"]): int(r["sku_count"])
        for _, r in df_res.iterrows()
    }

    # rows in the same order as pivot index
    rows = []
    for (l1_l, l2_l), row_vals in zip(pivot.index.tolist(), pivot.to_numpy()):
        cells = [_round3(v) for v in row_vals.tolist()]
        rows.append([
            int(sku_count_map.get((l1_l, l2_l), 0)),
            l1_l,
            l2_l,
            cells
        ])

    return {"columns": [top_hdr, bot_hdr], "rows": rows}

def _build_results_json(pair_data: dict) -> dict:
    L1_name = pair_data["L1"]
    L2_name = pair_data["L2"]
    df_res: pd.DataFrame = pair_data["results"]

    cols = ["SKU Count", L1_name, L2_name, L1_name, L2_name, "Winner"]

    rows = []
    for _, r in df_res.iterrows():
        winner = r.get("winner")
        if winner == "L1":
            winner_label = L1_name
        elif winner == "L2":
            winner_label = L2_name
        elif winner in ("Tie", "NA", "NA_ONLY_ONE_COMBO"):
            winner_label = str(winner)
        else:
            winner_label = str(winner) if winner is not None else None

        rows.append([
            int(r["sku_count"]),
            r["L1_value"],
            r["L2_value"],
            _round3(r["L1_wtd_avg_roi"]),
            _round3(r["L2_wtd_avg_roi"]),
            winner_label
        ])

    return {"columns": cols, "rows": rows}

def build_level_testing_json(level_result: dict) -> dict:
    """
    level_result shape:
      {
        "pairs": {
          "<pair_name>": {
            "L1": str, "L2": str,
            "math": pd.DataFrame,
            "results": pd.DataFrame,
            "summary": dict
          }, ...
        },
        "attribute_summary": {
          "<attr>": {"wins": int, "losses": int, "ties": int}, ...
        }
      }
    Output follows the finalized contract:
      level_testing: { lhs: {columns, rows}, rhs: [{attribute_id, attribute_name, detailed_result: [...]}, ...] }
    """
    pairs_dict = level_result.get("pairs", {})
    attr_summary = level_result.get("attribute_summary", {})

    # stable attribute list in LHS: rank by wins desc, then ties desc, then losses asc, then name
    attrs = []
    for attr_name, s in attr_summary.items():
        attrs.append((
            attr_name,
            int(s.get("wins", 0)),
            int(s.get("losses", 0)),
            int(s.get("ties", 0)),
        ))
    attrs.sort(key=lambda x: (-x[1], -x[3], x[2], x[0]))

    lhs_columns = ["id", "rank", "attribute", "win_times", "loss_times", "tie_times", "comment"]
    lhs_rows = []
    attr_uuid_map = {a[0]: _attr_uuid(a[0]) for a in attrs}

    for rank, (attr_name, wins, losses, ties) in enumerate(attrs, start=1):
        is_valid = wins > losses
        lhs_rows.append([
            attr_uuid_map[attr_name],
            rank,
            attr_name,
            wins,
            losses,
            ties,
            ""
        ])

    # build rhs blocks: for each attribute, collect all pairs it participates in
    rhs_blocks = []
    # Precompute pair objects once, keyed by unordered pair UUID (so we can reuse)
    pair_objs_by_uuid = {}

    for pair_name, pair_data in pairs_dict.items():
        a1 = pair_data["L1"]
        a2 = pair_data["L2"]
        p_uuid = _pair_uuid(a1, a2)

        if p_uuid not in pair_objs_by_uuid:
            total_skus = None
            df_res = pair_data.get("results")
            if isinstance(df_res, pd.DataFrame) and "sku_count" in df_res.columns:
                total_skus = int(df_res["sku_count"].sum())

            pair_objs_by_uuid[p_uuid] = {
                "pair_key": p_uuid,
                "attribute_1": a1,
                "attribute_2": a2,
                "final_winner": a1 if pair_data.get("summary", {}).get("round_winner") == "L1"
                                else a2 if pair_data.get("summary", {}).get("round_winner") == "L2"
                                else str(pair_data.get("summary", {}).get("round_winner")),
                "math": _build_math_json(pair_data, total_sku_count=total_skus),
                "results": _build_results_json(pair_data),
            }

    # attach pairs to each attribute RHS panel
    for attr_name, _, _, _ in attrs:
        a_uuid = attr_uuid_map[attr_name]
        detailed = []

        for p_uuid, pobj in pair_objs_by_uuid.items():
            if pobj["attribute_1"] == attr_name or pobj["attribute_2"] == attr_name:
                detailed.append(pobj)

        # stable order: by attribute_1, attribute_2
        detailed.sort(key=lambda x: (x["attribute_1"], x["attribute_2"]))

        rhs_blocks.append({
            "attribute_id": a_uuid,
            "attribute_name": attr_name,
            "detailed_result": detailed
        })

    return {
            "lhs": {"columns": lhs_columns, "rows": lhs_rows},
            "rhs": rhs_blocks
    }



def _build_level_cells(
        df_sku: pd.DataFrame,
        attr_L1: str,
        attr_L2: str,
        df_attribute: pd.DataFrame,
        roi_col: str = "roi",
) -> dict:
    """
    Build the a x b cell matrix for Level Testing.

    Each row is a combination (l, m) with:
      ROI(l, m) = mean roi over SKUs in that cell
      N(l, m)   = number of SKUs in that cell

    Returns columns:
      [L1, L2, "ROI_cell", "N_cell"]
    """
    attr_L1_l = attr_L1 + "_ll"
    attr_L2_l = attr_L2 + "_ll"
    attr_L1_r = attr_L1 + "_rr"
    attr_L2_r = attr_L2 + "_rr"
    # df_nondiag = df_sku[df_sku["skuname_ean_l"] != df_sku["skuname_ean_r"]].copy()
    cells = (
        df_sku
        .groupby([attr_L1_l, attr_L2_l, attr_L1_r, attr_L2_r])[roi_col]
        .agg(ROI_cell="mean")
        .reset_index()
    )

    cells = cells.rename(columns={
        attr_L1_l: "L1_value_l",
        attr_L2_l: "L2_value_l",
        attr_L1_r: "L1_value_r",
        attr_L2_r: "L2_value_r",
    })

    counts = (
        df_attribute
        .groupby([attr_L1, attr_L2])["skuname_ean"]
        .count()
        .reset_index(name="sku_count")
    )

    counts.rename(columns={attr_L1: "L1_value", attr_L2: "L2_value"}, inplace=True)

    return {'level_df': cells, 'counts_df': counts}


def _compute_level_scores(level_result: dict) -> pd.DataFrame:
    scores = level_result['counts_df']

    def calculate_wtd_avg_roi_L1(row):
        L1_value = row['L1_value']
        L2_value = row['L2_value']

        sub = level_result['level_df'][(level_result['level_df']['L1_value_r'] == L1_value) & (
                    level_result['level_df']['L2_value_r'] == L2_value) & (
                                                   level_result['level_df']['L1_value_l'] == L1_value) & (
                                                   level_result['level_df']['L2_value_l'] != L2_value)]
        merged = sub.merge(level_result['counts_df'], left_on=["L1_value_l", "L2_value_l"],
                           right_on=['L1_value', 'L2_value'], how="left")
        # calulate weighted average roi by using level_result['counts_df'] in case we get multiple rows
        vals = merged["ROI_cell"].to_numpy(dtype=float)
        wts = merged["sku_count"].fillna(0).to_numpy(dtype=float)
        # drop zero-weight entries
        mask_w = wts > 0
        vals = vals[mask_w]
        wts = wts[mask_w]

        wtd_avg = (vals * wts).sum() / wts.sum()

        return wtd_avg.round(2)

    def calculate_wtd_avg_roi_L2(row):
        L1_value = row['L1_value']
        L2_value = row['L2_value']

        sub = level_result['level_df'][(level_result['level_df']['L1_value_r'] == L1_value) & (
                    level_result['level_df']['L2_value_r'] == L2_value) & (
                                                   level_result['level_df']['L1_value_l'] != L1_value) & (
                                                   level_result['level_df']['L2_value_l'] == L2_value)]
        merged = sub.merge(level_result['counts_df'], left_on=["L1_value_l", "L2_value_l"],
                           right_on=['L1_value', 'L2_value'], how="left")
        # calulate weighted average roi by using level_result['counts_df'] in case we get multiple rows
        vals = merged["ROI_cell"].to_numpy(dtype=float)
        wts = merged["sku_count"].fillna(0).to_numpy(dtype=float)
        # drop zero-weight entries
        mask_w = wts > 0
        vals = vals[mask_w]
        wts = wts[mask_w]

        wtd_avg = (vals * wts).sum() / wts.sum()

        return wtd_avg.round(2)

    def decide_winner(row):
        # NaN weighted average will be basically NA only 1 combo
        # SKU_Count 1 will be NA -Only 1 SKU

        L1s = row["L1_wtd_avg_roi"]
        L2s = row["L2_wtd_avg_roi"]

        if row["sku_count"] == 1:
            return "NA - Only 1 SKU"

        if pd.isna(L1s) or pd.isna(L2s):
            return "NA - Only 1 Combo"

        diff = L1s - L2s
        if abs(diff) == 0.0:
            return "EQUAL"
        elif diff > 0:
            return "L1"
        else:
            return "L2"

    scores['L1_wtd_avg_roi'] = scores.apply(calculate_wtd_avg_roi_L1, axis=1)
    scores['L2_wtd_avg_roi'] = scores.apply(calculate_wtd_avg_roi_L2, axis=1)
    scores['winner'] = scores.apply(decide_winner, axis=1)
    return scores

def _compute_round_winner(level_df: pd.DataFrame) -> dict:
    """
    level_df: output of compute_level_scores()

    Returns dict with:
      "wins_L1", "wins_L2", "wins_Tie", "wins_NA", "round_winner"
    """

    counts = level_df["winner"].value_counts().to_dict()

    wins_L1  = counts.get("L1", 0)
    wins_L2  = counts.get("L2", 0)
    wins_Tie = counts.get("EQUAL", 0)
    wins_NA  = counts.get("NA - Only 1 SKU", 0) + counts.get("NA - Only 1 Combo", 0)

    if wins_L1 > wins_L2:
        round_winner = "L1"
    elif wins_L2 > wins_L1:
        round_winner = "L2"
    else:
        round_winner = "None"

    if abs(wins_L1 - wins_L2) == 1:
            comments = "Weak Win"
    else:
         comments = ""

    return {
        "wins_L1": wins_L1,
        "wins_L2": wins_L2,
        "wins_Tie": wins_Tie,
        "wins_NA": wins_NA,
        "round_winner": round_winner,
        "comments": comments

    }

# df_sku is df_pivot_down_2/df_long
def _run_level_testing_for_all_pairs(run_id,df_sku: pd.DataFrame, df_attribute: pd.DataFrame, base_results: dict):

    df_nondiag = df_sku[df_sku["skuname_ean_l"] != df_sku["skuname_ean_r"]].copy()

    valid_attrs = [
        attr for attr, res in base_results.items()
        if res.get("base_result") is True
    ]
    pair_count = len(valid_attrs) * (len(valid_attrs) - 1) // 2
    log_event("level_testing.start",run_id=run_id,valid_attrs=len(valid_attrs),pair_count=pair_count)
    pair_results = {}

    # initialize per-attribute summary
    attribute_summary = {
        attr: {
            "wins": 0,
            "losses": 0,
            "ties": 0,
        }
        for attr in valid_attrs
    }

    for attr_L1, attr_L2 in combinations(valid_attrs, 2):
        pair_timer = Timer()


        cells = _build_level_cells(df_nondiag, attr_L1, attr_L2, df_attribute)
        level_df = _compute_level_scores(cells)
        round_info = _compute_round_winner(level_df)
        pair_key = f"{attr_L1}_vs_{attr_L2}"
        pair_results[pair_key] = {
            "L1": attr_L1,
            "L2": attr_L2,
            "math": cells['level_df'],
            "results": level_df,
            "summary": round_info,
        }

        if pair_timer.ms() > 500:
            log_event("level_testing.slow_pair",run_id=run_id,
                attr_L1=attr_L1,attr_L2=attr_L2,duration_ms=pair_timer.ms(),level_df_rows=len(level_df))

        winner = round_info.get("round_winner")

        if winner == "L1":
            # attr_L1 wins, attr_L2 loses
            attribute_summary[attr_L1]["wins"] += 1
            attribute_summary[attr_L2]["losses"] += 1

        elif winner == "L2":
            # attr_L2 wins, attr_L1 loses
            attribute_summary[attr_L2]["wins"] += 1
            attribute_summary[attr_L1]["losses"] += 1

        elif winner == "None":
            # tie
            attribute_summary[attr_L2]["ties"] += 1
            attribute_summary[attr_L1]["ties"] += 1

    level_results = {
        "pairs": pair_results,
        "attribute_summary": attribute_summary}

    return build_level_testing_json(level_results)

