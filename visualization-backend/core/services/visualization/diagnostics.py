from __future__ import annotations

import numpy as np
from scipy.spatial.distance import pdist, squareform


def _safe_r_squared(x: np.ndarray, y: np.ndarray, digits: int) -> float:
    if x.size == 0 or y.size == 0 or np.std(x) == 0 or np.std(y) == 0:
        return 0.0
    r = np.corrcoef(x, y)[0, 1]
    if np.isnan(r):
        return 0.0
    return float(round(r * r, digits))


def rsquared_mds(dist_input: np.ndarray, coordinates: np.ndarray) -> float:
    dist_input = np.asarray(dist_input, dtype=float)
    coordinates = np.asarray(coordinates, dtype=float)
    if dist_input.shape[0] != dist_input.shape[1]:
        raise ValueError("dist_input must be square")
    n = dist_input.shape[0]
    if coordinates.shape[0] != n:
        raise ValueError("coordinates rows must match distance matrix size")
    d_mds = squareform(pdist(coordinates, metric="euclidean"))
    iu = np.triu_indices(n, k=1)
    return _safe_r_squared(d_mds[iu], dist_input[iu], 3)


def rsquared_sku(
    dist_input: np.ndarray,
    coordinates: np.ndarray,
    labels: list[str] | None = None,
) -> dict[str, float]:
    dist_input = np.asarray(dist_input, dtype=float)
    coordinates = np.asarray(coordinates, dtype=float)
    n = dist_input.shape[0]
    d_mds = squareform(pdist(coordinates, metric="euclidean"))
    labels = labels or [str(i) for i in range(n)]
    return {
        labels[j]: _safe_r_squared(d_mds[:, j], dist_input[:, j], 2)
        for j in range(n)
    }

