from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .isomds import iso_mds


@dataclass(frozen=True)
class MDSResult:
    coordinates: np.ndarray
    stress: float
    n_dims: int
    n_iter: int


def run_mds(
    distances: np.ndarray,
    n_dims: int,
    *,
    random_state: int = 1234,
    max_iter: int = 50,
    tol: float = 1e-3,
) -> MDSResult:
    del random_state
    result = iso_mds(distances, k=n_dims, max_iter=max_iter, tol=tol)
    return MDSResult(
        coordinates=np.asarray(result.points, dtype=float),
        stress=float(result.stress),
        n_dims=n_dims,
        n_iter=int(result.n_iter),
    )

