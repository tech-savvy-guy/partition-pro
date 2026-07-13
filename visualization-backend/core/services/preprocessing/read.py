"""Compute-time read path for the preprocessed ROI matrix.

``roi_long_from_db`` unpivots the persisted nested ``roi_matrix`` JSONB to long
form via the ``core.get_roi_matrix_rows_by_skuname`` stored function (two
levels of ``jsonb_each``/``jsonb_each_text``, since the whole matrix now lives
on one ``Metadata`` row instead of one row per SKU).
"""

from __future__ import annotations

import pandas as pd
from django.db import connection

from core.models import Metadata
from core.services.preprocessing.build import preprocessing_signature
from core.services.sku_selection import _get_selected_raw_datasets


def metadata_for_current_selection_any_status(case_id) -> Metadata | None:
    """The Metadata row matching the case's currently selected
    POS/ATTRIBUTES/CROSSPURCHASE datasets, regardless of status — or ``None``
    if that exact combination has never been (even started to be)
    preprocessed, or there's no selected CROSSPURCHASE dataset at all."""
    case_id = str(case_id)
    selected = _get_selected_raw_datasets(case_id)
    if selected.cross_purchase is None:
        return None

    signature = preprocessing_signature(selected.pos, selected.attributes, selected.cross_purchase)
    return Metadata.objects.filter(case_id=case_id, signature=signature).first()


def metadata_for_current_selection(case_id) -> Metadata | None:
    """The ``READY`` Metadata row matching the case's currently selected
    POS/ATTRIBUTES/CROSSPURCHASE datasets, or ``None`` if that combination
    hasn't been (successfully) preprocessed yet."""
    metadata = metadata_for_current_selection_any_status(case_id)
    if metadata is not None and metadata.status == Metadata.Status.READY:
        return metadata
    return None


def roi_long_from_db(
    metadata_id,
    selected_skus: list[str],
    *,
    batch_size: int = 100_000,
) -> pd.DataFrame:
    """Long-form ``(skuname_ean_l, skuname_ean_r, roi)`` for the selected SKUs.

    Chunked fetch mirrors roi-backend's ``_call_db_get_basemath_long_skuname``.
    """
    selected = list(selected_skus) or None
    frames: list[pd.DataFrame] = []
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT sku_l, sku_r, roi "
            "FROM core.get_roi_matrix_rows_by_skuname(%s, %s)",
            [str(metadata_id), selected],
        )
        while True:
            rows = cursor.fetchmany(batch_size)
            if not rows:
                break
            chunk = pd.DataFrame(
                rows, columns=["skuname_ean_l", "skuname_ean_r", "roi"]
            )
            chunk["roi"] = chunk["roi"].astype("float32")
            frames.append(chunk)

    if not frames:
        return pd.DataFrame(columns=["skuname_ean_l", "skuname_ean_r", "roi"])
    return pd.concat(frames, ignore_index=True)


def abs_pen_pct_for_skus(metadata: Metadata, selected_skus: list[str]) -> dict[str, float | None]:
    """``{sku: abs_pen%}`` derived from ``Metadata.row_max``/``base`` — no DB
    round-trip beyond the already-loaded ``Metadata`` row."""
    row_max = metadata.row_max or {}
    base = metadata.base or 0.0
    if not base:
        return {sku: None for sku in selected_skus}
    return {
        sku: (round((row_max[sku] / base) * 100.0, 3) if sku in row_max else None)
        for sku in selected_skus
    }


def avg_roi_for_skus(metadata: Metadata, selected_skus: list[str]) -> dict[str, float | None]:
    """``{sku: avg_roi}`` — the full-panel mean ROI per SKU persisted on
    ``Metadata`` at preprocessing time. NOT recomputed from a
    selection-filtered subset: avg_roi is a full-panel constant, independent
    of which SKUs happen to be selected right now (matches roi-backend)."""
    avg_roi = metadata.avg_roi or {}
    return {sku: avg_roi.get(sku) for sku in selected_skus}
