from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from django.utils import timezone

from .adapter import build_visualization_input_from_database
from .diagnostics import rsquared_mds, rsquared_sku
from .distances import distance_matrix
from .mds import run_mds
from .repertoire import cluster_repertoires, rep_overlap_matrix, roi_matrix
from .serialization import dataframe_to_table
from .types import DimensionResult, VisualizationInput, VisualizationResult


def _penetration_table(data: VisualizationInput) -> pd.DataFrame:
    penetration = np.diag(data.matrix) / data.base
    return pd.DataFrame(
        {
            "ID": data.sku_ids,
            "sku_name": data.sku_ids,
            "penetration": penetration,
        }
    )


def _merge_coordinates(
    *,
    coords: np.ndarray,
    sku_ids: list[str],
    rsq_map: dict[str, float],
    penetration_df: pd.DataFrame,
    n_dims: int,
    attributes_df: pd.DataFrame | None,
    include_attributes: bool,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    coord_cols = {1: ["x"], 2: ["x", "y"], 3: ["x", "y", "z"]}[n_dims]
    coord_df = pd.DataFrame(coords, columns=coord_cols)
    coord_df.insert(0, "ID", sku_ids)
    coord_df["RSQ SKU"] = [rsq_map[sku] for sku in sku_ids]
    coord_df = coord_df.merge(penetration_df, on="ID", how="left")
    coord_df = coord_df[["ID", "sku_name", "penetration", *coord_cols, "RSQ SKU"]]
    full = coord_df.copy()
    if include_attributes and attributes_df is not None:
        attrs = attributes_df.drop(columns=["sku_name"], errors="ignore")
        full = full.merge(attrs, on="ID", how="left")
    return coord_df, full


def run_visualization_analysis(
    data: VisualizationInput,
    *,
    metric: str = "chi",
    include_attributes: bool = True,
    random_state: int = 1234,
) -> VisualizationResult:
    metric = metric.lower().strip()
    if metric not in {"chi", "phi"}:
        raise ValueError("metric must be 'chi' or 'phi'")

    distances = distance_matrix(data.matrix, metric=metric, epsilon=0.001)
    upper = np.triu_indices(data.n_skus, k=1)
    distances[upper] = np.where(distances[upper] <= 0, np.finfo(float).eps, distances[upper])
    distances[(upper[1], upper[0])] = distances[upper]

    penetration_df = _penetration_table(data)
    dim_results: dict[int, DimensionResult] = {}
    for n_dims in (1, 2, 3):
        mds_result = run_mds(distances, n_dims, random_state=random_state)
        rsq = rsquared_sku(distances, mds_result.coordinates, labels=data.sku_ids)
        coord_df, coord_full_df = _merge_coordinates(
            coords=mds_result.coordinates,
            sku_ids=data.sku_ids,
            rsq_map=rsq,
            penetration_df=penetration_df,
            n_dims=n_dims,
            attributes_df=data.attributes,
            include_attributes=include_attributes and data.attributes is not None,
        )
        dim_results[n_dims] = DimensionResult(
            n_dims=n_dims,
            coordinates=mds_result.coordinates,
            stress=mds_result.stress,
            n_iter=mds_result.n_iter,
            df_coord=coord_df,
            df_coord_full=coord_full_df,
        )

    diagnostics = pd.DataFrame(
        [
            {
                "dim": n_dims,
                "stress": dim_results[n_dims].stress / 100.0,
                "rsquare": rsquared_mds(distances, dim_results[n_dims].coordinates),
            }
            for n_dims in (1, 2, 3)
        ]
    )
    roi = roi_matrix(data.matrix, data.base)
    roi_df = pd.DataFrame(roi, index=data.sku_ids, columns=data.sku_ids).reset_index(names="ID")
    labels, names = cluster_repertoires(
        dim_results[2].coordinates,
        random_state=random_state,
    )
    overlap_df = rep_overlap_matrix(roi, labels, names)

    return VisualizationResult(
        distance_matrix=distances,
        dim2=dim_results[2],
        dim3=dim_results[3],
        diagnostics_table=diagnostics,
        roi_matrix=roi_df,
        rep_overlap_matrix=overlap_df,
    )


def compute_visualization_result(
    *,
    case_id: str,
    partition_id: str,
    selected_skus: list[str],
    dataset_ids: dict[str, str | None] | None = None,
    metric: str = "chi",
    include_attributes: bool = True,
    include_roi_matrix: bool = False,
    random_state: int = 1234,
) -> dict[str, Any]:
    data = build_visualization_input_from_database(
        case_id,
        partition_id,
        selected_skus=selected_skus,
        dataset_ids=dataset_ids,
        include_attributes=include_attributes,
    )
    result = run_visualization_analysis(
        data,
        metric=metric,
        include_attributes=include_attributes,
        random_state=random_state,
    )
    payload: dict[str, Any] = {
        "case_id": str(case_id),
        "partition_id": str(partition_id),
        "metadata": {
            "metric": metric,
            "selected_sku_count": data.n_skus,
            "include_attributes": include_attributes,
            "include_roi_matrix": include_roi_matrix,
            "random_state": random_state,
            "generated_at": timezone.now().isoformat(),
        },
        "mds_2d": dataframe_to_table(result.dim2.df_coord_full),
        "mds_3d": dataframe_to_table(result.dim3.df_coord_full),
        "diagnostics": dataframe_to_table(result.diagnostics_table),
        "rep_overlap_matrix": dataframe_to_table(result.rep_overlap_matrix),
    }
    if include_roi_matrix:
        payload["roi_matrix"] = dataframe_to_table(result.roi_matrix)
    return payload


def compute_visualization_results(
    *,
    case_id: str,
    partition_id: str,
    selected_skus: list[str],
    dataset_ids: dict[str, str | None] | None = None,
    metrics: list[str] | tuple[str, ...],
    include_attributes: bool = True,
    include_roi_matrix: bool = False,
    random_state: int = 1234,
) -> dict[str, Any]:
    normalized_metrics: list[str] = []
    for metric in metrics:
        normalized = str(metric).lower().strip()
        if normalized not in {"chi", "phi"}:
            raise ValueError("metric must be 'chi' or 'phi'")
        if normalized not in normalized_metrics:
            normalized_metrics.append(normalized)

    if not normalized_metrics:
        normalized_metrics = ["chi"]

    data = build_visualization_input_from_database(
        case_id,
        partition_id,
        selected_skus=selected_skus,
        dataset_ids=dataset_ids,
        include_attributes=include_attributes,
    )

    metric_results: dict[str, Any] = {}
    generated_at = timezone.now().isoformat()

    for metric in normalized_metrics:
        result = run_visualization_analysis(
            data,
            metric=metric,
            include_attributes=include_attributes,
            random_state=random_state,
        )
        payload: dict[str, Any] = {
            "metadata": {
                "metric": metric,
                "selected_sku_count": data.n_skus,
                "include_attributes": include_attributes,
                "include_roi_matrix": include_roi_matrix,
                "random_state": random_state,
                "generated_at": generated_at,
            },
            "mds_2d": dataframe_to_table(result.dim2.df_coord_full),
            "mds_3d": dataframe_to_table(result.dim3.df_coord_full),
            "diagnostics": dataframe_to_table(result.diagnostics_table),
            "rep_overlap_matrix": dataframe_to_table(result.rep_overlap_matrix),
        }
        if include_roi_matrix:
            payload["roi_matrix"] = dataframe_to_table(result.roi_matrix)
        metric_results[metric] = payload

    return {
        "case_id": str(case_id),
        "partition_id": str(partition_id),
        "metadata": {
            "metrics": normalized_metrics,
            "selected_sku_count": data.n_skus,
            "include_attributes": include_attributes,
            "include_roi_matrix": include_roi_matrix,
            "random_state": random_state,
            "generated_at": generated_at,
        },
        "metrics": metric_results,
    }
