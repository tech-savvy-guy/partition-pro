"""Case-level dataset preprocessing.

Runs once per (case, dataset-combination signature) and persists the one
expensive artifact worth precomputing — the full-panel SKU x SKU ROI matrix —
directly on a single ``Metadata`` row as nested JSONB. Everything else
(avg_roi, abs_pen%, attributes, selected SKUs) is cheap to derive at read time
from data that already exists elsewhere (the persisted matrix itself,
``RawAttributesData``, ``WorkflowRun.parameters['selected_skus']``), so no
child "universe" table is needed.

A signature's row is never deleted once created: re-selecting a previously
computed dataset combination reuses the ``READY`` row instantly instead of
recomputing (see ``run_preprocessing``).
"""

from __future__ import annotations

import hashlib
import json

from django.db import transaction
from django.utils import timezone

from core.models import Dataset, Metadata
from core.services.roi.base_math import compute_roi_matrix
from core.services.sku_selection import _get_selected_raw_datasets, _normalize_key
from core.services.visualization.adapter import build_visualization_input_from_database
from core.services.visualization.serialization import json_safe_value


class PreprocessingError(Exception):
    pass


def preprocessing_signature(
    pos: Dataset | None,
    attributes: Dataset | None,
    cross_purchase: Dataset,
) -> str:
    def _ref(dataset: Dataset | None):
        return [str(dataset.id), dataset.version] if dataset else None

    payload = {
        "pos": _ref(pos),
        "att": _ref(attributes),
        "cp": _ref(cross_purchase),
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _full_panel_skus(case_id, cross_purchase: Dataset) -> list[str]:
    """Every SKU present in the CROSSPURCHASE dataset, in row order."""
    from core.models import RawCrossPurchaseData

    skus: list[str] = []
    seen: set[str] = set()
    for row in RawCrossPurchaseData.objects.filter(
        case_id=case_id,
        metadata_id=cross_purchase.id,
    ).order_by("row_num"):
        sku = _normalize_key((row.data or {}).get("skuname_ean"))
        if sku and sku not in seen:
            seen.add(sku)
            skus.append(sku)
    return skus


def run_preprocessing(case_id) -> Metadata:
    """Build (or reuse) the preprocessing artifacts for the case's currently
    selected datasets. Idempotent by ``(case_id, signature)`` — a combination
    that has already reached ``READY`` is never recomputed."""
    case_id = str(case_id)
    selected = _get_selected_raw_datasets(case_id)
    if selected.cross_purchase is None:
        raise PreprocessingError(
            "No selected CROSSPURCHASE dataset to preprocess for this case."
        )

    signature = preprocessing_signature(selected.pos, selected.attributes, selected.cross_purchase)

    with transaction.atomic():
        metadata, created = Metadata.objects.select_for_update().get_or_create(
            case_id=case_id,
            signature=signature,
            defaults={
                "pos_dataset_id": selected.pos.id if selected.pos else None,
                "att_dataset_id": selected.attributes.id if selected.attributes else None,
                "cp_dataset_id": selected.cross_purchase.id,
                "status": Metadata.Status.PENDING,
            },
        )
        if metadata.status in (Metadata.Status.READY, Metadata.Status.RUNNING):
            # Already computed (reuse — this is the "preserve combinations"
            # behavior) or already in flight (avoid a duplicate compute).
            return metadata

        metadata.status = Metadata.Status.RUNNING
        metadata.error = ""
        metadata.save(update_fields=["status", "error", "updated_at"])

    try:
        full_skus = _full_panel_skus(case_id, selected.cross_purchase)
        if len(full_skus) < 3:
            raise PreprocessingError(
                "CROSSPURCHASE has fewer than 3 SKUs; nothing to preprocess."
            )

        data = build_visualization_input_from_database(
            case_id,
            None,
            selected_skus=full_skus,
            dataset_ids={
                Dataset.Type.POS: str(selected.pos.id) if selected.pos else None,
                Dataset.Type.ATTRIBUTES: (
                    str(selected.attributes.id) if selected.attributes else None
                ),
                Dataset.Type.CROSS_PURCHASE: str(selected.cross_purchase.id),
            },
            include_attributes=False,
        )
        roi = compute_roi_matrix(data)

        roi_matrix = {
            sku: {
                other_sku: json_safe_value(roi.matrix[index, other_index])
                for other_index, other_sku in enumerate(roi.sku_ids)
            }
            for index, sku in enumerate(roi.sku_ids)
        }
        row_max = {
            sku: json_safe_value(roi.row_max[index])
            for index, sku in enumerate(roi.sku_ids)
        }
        # Full-panel mean ROI per SKU (roi-backend's `row_avg_roi`) — computed
        # once here over the WHOLE panel and persisted, not re-derived at read
        # time from a selection-filtered subset (which would make avg_roi
        # depend on which SKUs happen to be selected).
        avg_roi = {
            sku: json_safe_value(roi.avg_roi[index])
            for index, sku in enumerate(roi.sku_ids)
        }

        metadata.roi_matrix = roi_matrix
        metadata.row_max = row_max
        metadata.avg_roi = avg_roi
        metadata.base = float(data.base)
        metadata.sku_count = data.n_skus
        metadata.status = Metadata.Status.READY
        metadata.error = ""
        metadata.save(
            update_fields=[
                "roi_matrix",
                "row_max",
                "avg_roi",
                "base",
                "sku_count",
                "status",
                "error",
                "updated_at",
            ]
        )
    except Exception as exc:
        metadata.status = Metadata.Status.FAILED
        metadata.error = str(exc)
        metadata.save(update_fields=["status", "error", "updated_at"])
        if isinstance(exc, PreprocessingError):
            raise
        raise PreprocessingError(str(exc)) from exc

    return metadata
