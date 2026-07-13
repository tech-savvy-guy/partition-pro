"""SKU x SKU ROI matrix ("SKU Math").

Verbatim port of roi-backend's ingestion formula
(``roi-backend/reports/services/ingestion/ingest.py::pre_process_data``,
the ``roi_matrix`` block), vectorized with numpy instead of the original
nested Python loop. The nested-loop original computes, for every ordered
pair ``(i, j)``::

    roi[i, j] = buyer_matrix[i, j] * total_base_buyers / (row_max[i] * col_max[j])
    roi[j, i] = roi[i, j]   # mirrored on every iteration

For a symmetric ``buyer_matrix`` (guaranteed by
``core.services.visualization.adapter``, which validates
``np.allclose(matrix, matrix.T)`` before this ever runs) ``row_max`` and
``col_max`` are identical vectors, so the pair-order-dependent "last write
wins" behaviour of the original loop is a no-op: both write the same value.
That makes the vectorized form below numerically identical to the original
for every input this service will ever see, while being O(n^2) numpy instead
of O(n^2) Python.
"""

from __future__ import annotations

import numpy as np

from core.services.visualization.types import VisualizationInput

from .types import RoiMatrixResult


def compute_roi_matrix(data: VisualizationInput) -> RoiMatrixResult:
    buyer_matrix = np.asarray(data.matrix, dtype=float)
    sku_ids = list(data.sku_ids)
    n = buyer_matrix.shape[0]
    total_base_buyers = float(data.base)

    row_max = buyer_matrix.max(axis=1)
    denom = np.outer(row_max, row_max)
    with np.errstate(divide="ignore", invalid="ignore"):
        roi = np.where(denom == 0, 0.0, (buyer_matrix * total_base_buyers) / denom)
    np.fill_diagonal(roi, 0.0)

    # mean ROI per row excluding the (zero) diagonal, matching roi-backend's
    # `roi_matrix[mask].reshape(n, n - 1).mean(axis=1)`.
    avg_roi = roi.sum(axis=1) / max(n - 1, 1)

    return RoiMatrixResult(
        matrix=roi,
        sku_ids=sku_ids,
        row_max=row_max,
        avg_roi=avg_roi,
    )
