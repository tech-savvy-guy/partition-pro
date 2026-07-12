from __future__ import annotations

from django.utils import timezone
from django.db import transaction
from ...models import Workflow


def update_workflow_step_status(
    wf: Workflow,
    step_key: str,
    status: str,
    progress: float | None = None,
    result: dict | None = None,
    error_message: str | None = None,
    updated_by: str | None = None,
):
    """
    Update wf.data JSON under: data -> steps -> <step_key>
    """
    data = wf.data or {}
    steps = data.get("steps", {})

    entry = steps.get(step_key, {})
    entry["status"] = status

    if progress is not None:
        entry["progress"] = progress
    if result is not None:
        entry["result"] = result
    if error_message is not None:
        entry["error_message"] = error_message

    entry["updated_on"] = timezone.now().isoformat()
    if updated_by:
        entry["updated_by"] = updated_by

    steps[step_key] = entry
    data["steps"] = steps

    wf.data = data
    wf.updated_on = timezone.now()
    if updated_by:
        wf.updated_by = updated_by

    wf.save(update_fields=["data", "updated_on", "updated_by"])


def update_workflow_overall_status(
    wf: Workflow,
    status: str,
    updated_by: str | None = None,
    increment_execution: bool = False,
):
    """
    Update Workflow.status column (overall) and optionally bump step_number.
    """
    wf.status = status
    wf.updated_on = timezone.now()
    if updated_by:
        wf.updated_by = updated_by

    update_fields = ["status", "updated_on", "updated_by"]

    if increment_execution:
        wf.step_number = (wf.step_number or 0) + 1
        update_fields.append("step_number")

    wf.save(update_fields=update_fields)
