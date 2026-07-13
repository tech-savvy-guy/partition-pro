"""OBM (attribute-level ROI rollup).

Port of roi-backend's ``reports/services/workflow/obm.py``
(``compute_obm_from_mapping`` / ``obm_to_compact_json``), adapted to
visualization-backend's partition-tree representation: leaves come from the
flat ``{"nodes": [...]}`` graph (``core.services.partition_tree``) instead of
roi-backend's PPM-backed leaf/DB rows, and the SKU->attribute lookup reuses
``core.services.partition_tree.counts.load_context`` instead of a second DB
round trip.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from core.services.partition_tree.counts import PartitionTreeContext, _skus_matching_path

from .types import ObmResult

Node = dict[str, Any]


def collect_leaf_value_nodes(nodes: list[Node]) -> list[Node]:
    """``value`` nodes with no children, i.e. the tree's current leaves."""
    return [
        node
        for node in nodes
        if node.get("type") == "value" and not (node.get("children") or [])
    ]


def build_leaf_mapping(
    ctx: PartitionTreeContext, nodes: list[Node]
) -> tuple[pd.DataFrame, list[dict]]:
    """``(sku_to_leaf, leaf_meta)`` for every current leaf in the tree.

    ``sku_to_leaf`` columns: ``skuname_ean``, ``leaf_id``, ``leaf_label``.
    ``leaf_meta`` entries: ``{leaf_id, leaf_label, sku_count}``.
    """
    leaves = collect_leaf_value_nodes(nodes)
    mapping_rows: list[dict] = []
    leaf_meta: list[dict] = []

    for leaf in leaves:
        leaf_id = leaf.get("id")
        leaf_label = leaf.get("branch")
        skus = _skus_matching_path(ctx, leaf.get("path") or [])
        leaf_meta.append({"leaf_id": leaf_id, "leaf_label": leaf_label, "sku_count": len(skus)})
        for sku in skus:
            mapping_rows.append({"skuname_ean": sku, "leaf_id": leaf_id, "leaf_label": leaf_label})

    sku_to_leaf = pd.DataFrame(mapping_rows, columns=["skuname_ean", "leaf_id", "leaf_label"])
    return sku_to_leaf, leaf_meta


def compute_obm_from_mapping(df_roi_long: pd.DataFrame, sku_to_leaf: pd.DataFrame) -> pd.DataFrame:
    """``sku_to_leaf`` columns: skuname_ean, leaf_id, leaf_label.

    ``df_roi_long`` columns: skuname_ean_l, skuname_ean_r, roi.
    """
    left = sku_to_leaf.rename(
        columns={"skuname_ean": "skuname_ean_l", "leaf_id": "leaf_l_id", "leaf_label": "leaf_l_label"}
    )
    right = sku_to_leaf.rename(
        columns={"skuname_ean": "skuname_ean_r", "leaf_id": "leaf_r_id", "leaf_label": "leaf_r_label"}
    )

    df = df_roi_long.merge(left, on="skuname_ean_l", how="inner")
    df = df.merge(right, on="skuname_ean_r", how="inner")
    # Exclude self-pairs, else the diagonal (roi=0 by construction) drags the
    # cell mean down.
    df = df[df["skuname_ean_l"] != df["skuname_ean_r"]]
    obm = (
        df.groupby(["leaf_l_id", "leaf_r_id", "leaf_l_label", "leaf_r_label"], as_index=False)["roi"]
        .agg(roi_mean="mean", pair_count="size")
    )
    return obm


def obm_to_compact_json(obm_df: pd.DataFrame, leaf_meta: list[dict]) -> dict:
    """``leaf_meta``: list of ``{leaf_id, leaf_label, sku_count}``."""
    leaf_meta_sorted = sorted(leaf_meta, key=lambda x: x["leaf_label"] or "")
    labels = [x["leaf_label"] for x in leaf_meta_sorted]
    sku_counts = {x["leaf_label"]: int(x["sku_count"]) for x in leaf_meta_sorted}

    pivot = (
        obm_df.pivot(index="leaf_l_label", columns="leaf_r_label", values="roi_mean")
        .reindex(index=labels, columns=labels)
    )
    mat = pivot.to_numpy()

    columns = ["Holds", "SKU Count", "Partition"] + labels
    rows = []
    holds_flags: list[bool] = []
    for i, row_label in enumerate(labels):
        row_vals = mat[i].tolist()
        numeric_vals = [v for v in row_vals if pd.notna(v)]
        row_max = max(numeric_vals) if numeric_vals else None

        diag_val = pivot.loc[row_label, row_label]
        holds = pd.notna(diag_val) and row_max is not None and float(diag_val) == float(row_max)
        holds_flags.append(bool(holds))
        cells = [None if pd.isna(v) else float(round(v, 6)) for v in row_vals]
        rows.append([bool(holds), sku_counts.get(row_label, 0), row_label, cells])

    overall_holds = all(holds_flags) if holds_flags else False
    return {"columns": columns, "rows": rows, "obm_holds": overall_holds}


def compute_obm(
    ctx: PartitionTreeContext,
    nodes: list[Node],
    roi_long_df: pd.DataFrame,
) -> ObmResult | None:
    sku_to_leaf, leaf_meta = build_leaf_mapping(ctx, nodes)
    if sku_to_leaf.empty:
        return None
    obm_df = compute_obm_from_mapping(roi_long_df, sku_to_leaf)
    compact = obm_to_compact_json(obm_df, leaf_meta)
    return ObmResult(obm_df=obm_df, leaf_meta=leaf_meta, compact=compact)
