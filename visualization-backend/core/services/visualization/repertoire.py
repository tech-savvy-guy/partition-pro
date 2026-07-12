from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans


def roi_matrix(cross: np.ndarray, base: float) -> np.ndarray:
    cross = np.asarray(cross, dtype=float)
    if cross.ndim != 2 or cross.shape[0] != cross.shape[1]:
        raise ValueError("cross must be a square matrix")
    if base <= 0:
        raise ValueError("base must be positive")
    diagonal = np.diag(cross)
    with np.errstate(divide="ignore", invalid="ignore"):
        expected = np.outer(diagonal, diagonal) / float(base)
        out = cross / expected
    np.fill_diagonal(out, np.nan)
    return out


def _renumber_by_first_occurrence(labels: np.ndarray) -> np.ndarray:
    mapping: dict[int, int] = {}
    out = np.empty_like(labels, dtype=int)
    next_id = 1
    for index, label in enumerate(labels):
        label = int(label)
        if label not in mapping:
            mapping[label] = next_id
            next_id += 1
        out[index] = mapping[label]
    return out


def cluster_repertoires(
    coords_2d: np.ndarray,
    *,
    n_clusters: int = 10,
    random_state: int = 1234,
    n_init: int = 50,
) -> tuple[np.ndarray, list[str]]:
    coords = np.asarray(coords_2d, dtype=float)
    if coords.ndim != 2 or coords.shape[1] < 2:
        raise ValueError("coords_2d must have at least 2 columns")
    n_clusters = max(1, min(int(n_clusters), coords.shape[0]))
    raw = KMeans(
        n_clusters=n_clusters,
        random_state=random_state,
        n_init=n_init,
    ).fit_predict(coords[:, :2])
    labels = _renumber_by_first_occurrence(raw)
    names = [f"Repertoire {label:02d}" for label in labels]
    return labels, names


def rep_overlap_matrix(
    roi: np.ndarray,
    labels: np.ndarray,
    names: list[str] | None = None,
) -> pd.DataFrame:
    roi = np.asarray(roi, dtype=float)
    labels = np.asarray(labels, dtype=int)
    unique = sorted(set(labels.tolist()))
    name_map = {label: f"Repertoire {label:02d}" for label in unique}
    if names is not None:
        for label, name in zip(labels, names):
            name_map[int(label)] = name

    rows = []
    for col_cluster in unique:
        col_idx = np.where(labels == col_cluster)[0]
        for row_cluster in unique:
            row_idx = np.where(labels == row_cluster)[0]
            sub = roi[np.ix_(col_idx, row_idx)]
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", message="Mean of empty slice", category=RuntimeWarning)
                mean = float(np.nanmean(sub)) if sub.size else float("nan")
            rows.append(
                {
                    "col_cluster": name_map[col_cluster],
                    "row_cluster": name_map[row_cluster],
                    "mean_overlap": mean,
                }
            )
    return pd.DataFrame(rows)

