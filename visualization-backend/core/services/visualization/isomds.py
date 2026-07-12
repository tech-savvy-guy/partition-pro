from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize
from scipy.spatial.distance import pdist
from sklearn.isotonic import IsotonicRegression


@dataclass(frozen=True)
class IsoMDSResult:
    points: np.ndarray
    stress: float
    n_iter: int


def cmdscale(distances: np.ndarray, k: int) -> np.ndarray:
    distances = np.asarray(distances, dtype=float)
    n = distances.shape[0]
    d2 = distances ** 2
    centering = np.eye(n) - np.ones((n, n)) / n
    gram = -0.5 * centering @ d2 @ centering
    gram = (gram + gram.T) / 2.0
    eigvals, eigvecs = np.linalg.eigh(gram)
    order = np.argsort(eigvals)[::-1]
    eigvals = eigvals[order]
    eigvecs = eigvecs[:, order]
    top_vals = np.clip(eigvals[:k], 0.0, None)
    return eigvecs[:, :k] * np.sqrt(top_vals)


def _dissimilarity_order(distances: np.ndarray) -> np.ndarray:
    upper = np.triu_indices(distances.shape[0], k=1)
    return np.argsort(distances[upper], kind="mergesort")


def _stress(points_flat: np.ndarray, *, n_rows: int, n_dims: int, order: np.ndarray) -> float:
    points = points_flat.reshape(n_rows, n_dims)
    config_distances = pdist(points, metric="euclidean")
    ranked = config_distances[order]
    fitted = IsotonicRegression(increasing=True).fit_transform(
        np.arange(ranked.size, dtype=float),
        ranked,
    )
    numerator = float(np.sum((ranked - fitted) ** 2))
    denominator = float(np.sum(ranked ** 2))
    if denominator <= 0:
        return 0.0
    return 100.0 * np.sqrt(numerator / denominator)


def iso_mds(
    distances: np.ndarray,
    k: int = 2,
    *,
    initial: np.ndarray | None = None,
    max_iter: int = 50,
    tol: float = 1e-3,
) -> IsoMDSResult:
    distances = np.asarray(distances, dtype=float)
    n_rows = distances.shape[0]
    if distances.shape[1] != n_rows:
        raise ValueError("distances must be square")
    if k < 1:
        raise ValueError("k must be positive")

    upper = np.triu_indices(n_rows, k=1)
    if np.any(distances[upper] <= 0):
        raise ValueError("isoMDS requires strictly positive off-diagonal dissimilarities")

    order = _dissimilarity_order(distances)
    x0 = cmdscale(distances, k) if initial is None else np.asarray(initial, dtype=float)
    if x0.shape != (n_rows, k):
        raise ValueError("initial configuration must have shape (n, k)")
    x0 = x0 - x0.mean(axis=0)

    evaluations = 0

    def objective(values: np.ndarray) -> float:
        nonlocal evaluations
        evaluations += 1
        return _stress(values, n_rows=n_rows, n_dims=k, order=order)

    result = minimize(
        objective,
        x0.ravel(),
        method="L-BFGS-B",
        options={"maxiter": max_iter, "ftol": tol, "gtol": 1e-8},
    )
    points = result.x.reshape(n_rows, k)
    points = points - points.mean(axis=0)
    return IsoMDSResult(
        points=points,
        stress=_stress(result.x, n_rows=n_rows, n_dims=k, order=order),
        n_iter=max(1, int(getattr(result, "nit", 0) or evaluations)),
    )

