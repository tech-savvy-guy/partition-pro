from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class RoiMatrixResult:
    """SKU x SKU ROI matrix plus per-SKU rollups (roi-backend's ``ingest.py``
    formula: ``roi[i,j] = buyer_matrix[i,j] * total_base_buyers / (row_max[i] * col_max[j])``,
    diagonal held at 0)."""

    matrix: np.ndarray
    sku_ids: list[str]
    row_max: np.ndarray
    avg_roi: np.ndarray


@dataclass(frozen=True)
class ObmResult:
    obm_df: pd.DataFrame
    leaf_meta: list[dict]
    compact: dict


@dataclass(frozen=True)
class LevelTestingResult:
    payload: dict
