"""Case-readiness gate.

"The case should only enable once preprocessing is complete" — mutating
partition endpoints (SKU selection, partition-tree edits, ROI/visualization
runs) call ``require_case_ready`` before doing anything else. There is no
graceful on-the-fly fallback: if the case's current dataset combination
hasn't reached ``READY``, the request is rejected outright.
"""

from __future__ import annotations

from core.models import Metadata
from core.services.preprocessing.read import metadata_for_current_selection_any_status


class CaseNotReadyError(Exception):
    def __init__(self, status: str, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def require_case_ready(case_id) -> Metadata:
    current = metadata_for_current_selection_any_status(case_id)
    if current is None:
        raise CaseNotReadyError(
            "NOT_STARTED",
            "Select datasets for this case (with a CROSSPURCHASE dataset) "
            "before running compute.",
        )
    if current.status == Metadata.Status.READY:
        return current
    if current.status == Metadata.Status.RUNNING:
        raise CaseNotReadyError(
            "RUNNING",
            "Datasets are still being prepared for this case.",
        )
    if current.status == Metadata.Status.FAILED:
        raise CaseNotReadyError(
            "FAILED",
            f"Dataset preprocessing failed: {current.error}",
        )
    raise CaseNotReadyError(
        "PENDING",
        "Datasets are queued for preparation.",
    )
