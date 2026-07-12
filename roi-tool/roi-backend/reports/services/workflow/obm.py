from typing import List, Dict, Tuple, Any, Optional

import numpy as np
import pandas as pd
import uuid
from .base_math import _call_db_get_joined, merged_list_to_df_like,_call_db_get_basemath_long_skuname
from ...models import Workflow, PreprocessedSkuSelection
from .base import  get_partition
from django.core.exceptions import ObjectDoesNotExist
from .shared_utils import _collect_leaf_value_nodes, _qs_json_to_df, get_filtered_attribute_rows, \
    _get_attribute_base_cols

Node = Dict[str, Any]





def attach_leaf_label_to_base_math(base_math: dict, sku_leaf_df) -> dict:
    """
    base_math: workflow step result containing {"columns": [...], "rows": [[...], ...]}
    sku_leaf_df: DataFrame with columns ["skuname_ean", "leaf_label"] OR any iterable of rows
    """

    cols = base_math["columns"]
    rows = base_math["rows"]

    # indexes (computed once)
    sku_idx = cols.index("skuname_ean")

    # Build mapping dict once (O(M))
    # If sku_leaf_df is a pandas df:
    sku_to_label = dict(zip(
        sku_leaf_df["skuname_ean"].astype(str),
        sku_leaf_df["leaf_label"]
    ))

    # Add/locate output column once
    out_col = "Partition"
    if out_col not in cols:
        # First iteration: add + shift by inserting at 0
        cols.insert(0, out_col)
        for r in rows:
            r.insert(0, sku_to_label.get(str(r[sku_idx]).strip()))
        return {"columns": cols, "rows": rows}
        # out_idx = cols.index(out_col)
        # # overwrite in place (O(N))
        # for r in rows:
        #     r[out_idx] = sku_to_label.get(str(r[sku_idx]))
    else:
        for r in rows:
            r[0] = sku_to_label.get(str(r[sku_idx]).strip())

    return {"columns": cols, "rows": rows}

def persist_leaf_label_in_workflow(wf, sku_leaf_df):
    data = wf.data
    base_math = data["steps"]["base_math"]["result"]  # adjust path if different
    base_math_dict = attach_leaf_label_to_base_math(base_math, sku_leaf_df)
    data["steps"]["base_math"]["result"]["rows"] = base_math_dict['rows']
    data["steps"]["base_math"]["result"]["columns"] = base_math_dict['columns']
    wf.data = data
    wf.save()

''' Optimisation - 2 -END'''
def _build_roi_long_with_attributes_skuname(
    selected_skus, # Node Filtered and SKU Selection filtered
    case_id, basemath_id
 ) -> pd.DataFrame:

    # Universe should match df_attribute (node ∩ selected)
    final_skunames = list(selected_skus) #for db type matching
    run_id = uuid.uuid4().hex
    df_long = _call_db_get_basemath_long_skuname(run_id,case_id, basemath_id, final_skunames)
    df_long["roi"] = pd.to_numeric(df_long["roi"], errors="coerce")
    return df_long



def compute_obm_from_mapping(df_roi_long: pd.DataFrame, sku_to_leaf: pd.DataFrame) -> pd.DataFrame:
    """
    sku_to_leaf columns: ["skuname_ean", "leaf_id", "leaf_label"]
    df_roi_long columns: ["skuname_ean_l", "skuname_ean_r", "roi"]
    """
    left = sku_to_leaf.rename(columns={
        "skuname_ean": "skuname_ean_l",
        "leaf_id": "leaf_l_id",
        "leaf_label": "leaf_l_label",
    })
    right = sku_to_leaf.rename(columns={
        "skuname_ean": "skuname_ean_r",
        "leaf_id": "leaf_r_id",
        "leaf_label": "leaf_r_label",
    })

    df = df_roi_long.merge(left, on="skuname_ean_l", how="inner")
    df = df.merge(right, on="skuname_ean_r", how="inner")
    # crucial fix else mean of diagonal values will be wrong slightly because of greater denominator
    df = df[df["skuname_ean_l"] != df["skuname_ean_r"]]
    obm = (
        df.groupby(["leaf_l_id", "leaf_r_id", "leaf_l_label", "leaf_r_label"], as_index=False)["roi"]
          .agg(roi_mean="mean", pair_count="size")
    )
    return obm

def obm_to_compact_json(obm_df: pd.DataFrame, leaf_meta: list[dict]) -> dict:
    """
    leaf_meta: list of {leaf_id, leaf_label, sku_count}
    """
    # stable order (can be leaf_label sort)
    leaf_meta_sorted = sorted(leaf_meta, key=lambda x: x["leaf_label"])
    labels = [x["leaf_label"] for x in leaf_meta_sorted]
    sku_counts = {x["leaf_label"]: int(x["sku_count"]) for x in leaf_meta_sorted}

    pivot = (
        obm_df.pivot(index="leaf_l_label", columns="leaf_r_label", values="roi_mean")
              .reindex(index=labels, columns=labels)
    )
    mat = pivot.to_numpy()

    columns = ["Holds", "SKU Count", "Partition"] + labels
    rows = []
    holds_flags = []  # collect all row-level holds
    for i, row_label in enumerate(labels):
        row_vals = mat[i].tolist()
        # compute row max (ignore NaNs)
        numeric_vals = [v for v in row_vals if pd.notna(v)]
        row_max = max(numeric_vals) if numeric_vals else None

        diag_val = pivot.loc[row_label, row_label]
        holds = (
                pd.notna(diag_val)
                and row_max is not None
                and float(diag_val) == float(row_max)
        )
        holds_flags.append(bool(holds))
        cells = [None if pd.isna(v) else float(round(v, 6)) for v in row_vals]
        rows.append([bool(holds),sku_counts.get(row_label, 0), row_label, cells])
        overall_holds = all(holds_flags) if holds_flags else False
    return {"columns": columns, "rows": rows,"obm_holds": overall_holds}


def build_leaf_mapping_for_tree(
    selected_skus,
    case_id,
    partition_id,
    att_dataset_id,
    tree_json: dict,
    sku_field="skuname_ean",
):

    leaf_nodes = _collect_leaf_value_nodes(tree_json)

    mapping_rows: List[dict] = []
    leaf_meta: List[dict] = []

    for leaf in leaf_nodes:
        leaf_id = leaf["id"]

        path = leaf.get("path") or []
        if not path:
            continue
        leaf_label = leaf.get("branch")

        qs_attr = get_filtered_attribute_rows(
            node={"path": path},
            case_id=case_id,
            partition_id=partition_id,
            metadata_id=att_dataset_id,
        )
        df_attr = _qs_json_to_df(
            qs_attr,
            base_cols=_get_attribute_base_cols(qs_attr),
        )
        if df_attr.empty or sku_field not in df_attr.columns:
            continue
        df_attr = df_attr[df_attr[sku_field].astype(str).isin(selected_skus)]
        skus = (
            df_attr[sku_field]
            .dropna()
            .astype(str)
            .unique()
            .tolist()
        )

        leaf_meta.append({"leaf_id": leaf_id, "leaf_label": leaf_label, "sku_count": len(skus)})

        for s in skus:
            mapping_rows.append({"skuname_ean": s, "leaf_id": leaf_id, "leaf_label": leaf_label})

    sku_to_leaf = pd.DataFrame(mapping_rows)
    return sku_to_leaf, leaf_meta



def update_obm(case_id, partition_id,updated_tree):
    try:
        wf = Workflow.objects.get(case_id=case_id, partition_id=partition_id, is_deleted=False)
    except ObjectDoesNotExist:
        raise ValueError("wf does not exist")
    partition = get_partition(case_id, partition_id)
    ppm = partition.ppm
    data = wf.data or {}
    steps = data.get("steps", {})
    selected_ids = steps.get('sku_selection', {}).get('result', {}).get('selected_ids', []) or []
    basemath_ppm_id = getattr(ppm, "id", None)

    df_temp2 = _qs_json_to_df(
        PreprocessedSkuSelection.objects.filter(case_id=case_id, pp_metadata_id=partition.ppm_id, id__in=selected_ids),
        base_cols=("id", "case_id", "pp_metadata_id"),
    )
    if "skuname_ean" not in df_temp2.columns:
        raise ValueError("preprocessed_sku_selection.data must contain 'skuname_ean'")
    selected_skus = set(df_temp2["skuname_ean"].astype(str).tolist())

    df_roi_long = _build_roi_long_with_attributes_skuname(selected_skus,case_id,basemath_ppm_id)
    sku_to_leaf, leaf_meta = build_leaf_mapping_for_tree(
        selected_skus,
        case_id=case_id,
        partition_id=partition_id,
        att_dataset_id=ppm.att_dataset_id,
        tree_json=updated_tree,
        sku_field="skuname_ean",
    )
    persist_leaf_label_in_workflow(wf,sku_to_leaf)

    if sku_to_leaf.empty:
        return {"columns": [], "rows": []}, False

    obm_df = compute_obm_from_mapping(df_roi_long, sku_to_leaf)
    # to-do with the true/false flag
    obm_json = obm_to_compact_json(obm_df, leaf_meta)
    return obm_json, True
