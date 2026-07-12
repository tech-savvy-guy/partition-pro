from __future__ import annotations

import numpy as np


def pairwise_distance(col_i: np.ndarray, col_j: np.ndarray, metric: str = "chi") -> float:
    tab = np.column_stack([col_i.astype(float), col_j.astype(float)])
    row_sums = tab.sum(axis=1)
    col_sums = tab.sum(axis=0)
    grand = float(tab.sum())
    if grand <= 0:
        raise ValueError("Sum of contingency table must be positive")
    expected = np.outer(row_sums, col_sums) / grand
    expected = np.where(expected == 0, np.finfo(float).eps, expected)
    chi_sq = np.sum((tab - expected) ** 2 / expected)
    dist = float(np.sqrt(chi_sq))
    if metric == "phi":
        return dist / float(np.sqrt(grand))
    if metric != "chi":
        raise ValueError("metric must be 'chi' or 'phi'")
    return dist


def distance_matrix(mat: np.ndarray, metric: str = "chi", epsilon: float = 0.001) -> np.ndarray:
    mat = np.asarray(mat, dtype=float)
    if mat.ndim != 2 or mat.shape[0] != mat.shape[1]:
        raise ValueError("mat must be a square matrix")
    mat = mat + epsilon
    n = mat.shape[0]
    out = np.zeros((n, n), dtype=float)
    for j in range(n):
        for k in range(j + 1, n):
            d = pairwise_distance(mat[:, j], mat[:, k], metric=metric)
            out[j, k] = d
            out[k, j] = d
    return out

