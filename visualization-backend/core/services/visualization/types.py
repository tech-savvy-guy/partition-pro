from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class VisualizationInput:
    cross_df: pd.DataFrame
    matrix: np.ndarray
    sku_ids: list[str]
    base: float
    attributes: pd.DataFrame | None = None

    @property
    def n_skus(self) -> int:
        return len(self.sku_ids)


@dataclass(frozen=True)
class DimensionResult:
    n_dims: int
    coordinates: np.ndarray
    stress: float
    n_iter: int
    df_coord: pd.DataFrame
    df_coord_full: pd.DataFrame


@dataclass(frozen=True)
class VisualizationResult:
    distance_matrix: np.ndarray
    dim2: DimensionResult
    dim3: DimensionResult
    diagnostics_table: pd.DataFrame
    roi_matrix: pd.DataFrame
    rep_overlap_matrix: pd.DataFrame

