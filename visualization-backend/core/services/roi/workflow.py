from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from uuid import uuid4

from django.db import transaction
from django.utils import timezone

from core.models import Dataset, Partition, WorkflowRun
from core.services import workflow_store

# ROI runs track their own lifecycle in `tags.roi_*`, distinct from the
# visualization pipeline's `status`/`tags.task_id` fields (see
# workflow_store.py's module docstring) — both pipelines share one
# WorkflowRun row per partition, so they must not clobber each other's
# in-flight/task bookkeeping even though today `Case.methodology` normally
# only drives one of them at a time.
ACTIVE_ROI_STATUSES = {"queued", "running"}


@dataclass(frozen=True)
class RoiContext:
    selected_skus: list[str]
    dataset_ids: dict[str, str | None]


@dataclass(frozen=True)
class RoiWorkflowDecision:
    workflow: WorkflowRun
    task_id: str | None
    should_enqueue: bool
    reused_completed_result: bool


def current_roi_context(partition: Partition) -> RoiContext:
    selected_skus = _current_selected_skus(partition)
    dataset_ids = _selected_dataset_ids(partition.case_id)
    if not dataset_ids.get(Dataset.Type.CROSS_PURCHASE):
        raise ValueError("Select a ready CROSSPURCHASE dataset before running ROI")
    return RoiContext(selected_skus=selected_skus, dataset_ids=dataset_ids)


def latest_roi_run(partition_id) -> WorkflowRun | None:
    return WorkflowRun.objects.filter(partition_id=partition_id).order_by("-started_at").first()


def roi_run_for_task(case_id, partition_id, task_id: str) -> WorkflowRun | None:
    return (
        WorkflowRun.objects.filter(
            partition_id=partition_id,
            partition__case_id=case_id,
            tags__roi_task_id=str(task_id),
        )
        .order_by("-started_at")
        .first()
    )


def prepare_roi_workflow(*, partition: Partition, user, task_params: dict) -> RoiWorkflowDecision:
    context = current_roi_context(partition)
    signature, signature_payload = roi_parameter_signature(context=context, task_params=task_params)

    with transaction.atomic():
        latest = (
            WorkflowRun.objects.select_for_update()
            .filter(partition=partition)
            .order_by("-started_at")
            .first()
        )
        if latest and (latest.tags or {}).get("roi_parameter_signature") == signature:
            task_id = (latest.tags or {}).get("roi_task_id")
            roi_status = (latest.tags or {}).get("roi_status")
            if roi_status in ACTIVE_ROI_STATUSES:
                return RoiWorkflowDecision(
                    workflow=latest,
                    task_id=task_id,
                    should_enqueue=False,
                    reused_completed_result=False,
                )
            if roi_status == "completed" and workflow_store.get_sku_math(latest) is not None:
                return RoiWorkflowDecision(
                    workflow=latest,
                    task_id=task_id,
                    should_enqueue=False,
                    reused_completed_result=True,
                )

        # Deliberately does NOT touch workflow.status/started_at/finished_at/
        # error — those top-level fields belong to the visualization
        # pipeline's lifecycle (see core.services.visualization.workflow).
        # ROI's own lifecycle lives entirely under tags.roi_*.
        workflow = latest or WorkflowRun(partition=partition)

        task_id = str(uuid4())
        workflow.triggered_by = workflow.triggered_by or user
        workflow.datasets = {**(workflow.datasets or {}), **context.dataset_ids}
        workflow.parameters = {
            **(workflow.parameters or {}),
            **task_params,
            "selected_skus": context.selected_skus,
        }
        # Re-running ROI invalidates only the ROI results; visualization and
        # partition-tree results are preserved.
        workflow_store.clear_sku_math(workflow)
        workflow_store.clear_obm(workflow)
        workflow_store.clear_level_testing(workflow)
        workflow_store.clear_coverage(workflow)
        workflow.tags = {
            **(workflow.tags or {}),
            "roi_task_id": task_id,
            "roi_status": "queued",
            "roi_error": "",
            "roi_parameter_signature": signature,
            "roi_parameter_signature_payload": signature_payload,
        }
        workflow.save()

    return RoiWorkflowDecision(workflow=workflow, task_id=task_id, should_enqueue=True, reused_completed_result=False)


def roi_parameter_signature(*, context: RoiContext, task_params: dict) -> tuple[str, dict]:
    payload = {
        "selected_skus": context.selected_skus,
        "dataset_ids": context.dataset_ids,
        "include_attributes": task_params.get("include_attributes"),
        "include_obm": task_params.get("include_obm"),
        "include_level_testing": task_params.get("include_level_testing"),
        "include_coverage": task_params.get("include_coverage"),
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest(), payload


def workflow_roi_payload(workflow: WorkflowRun) -> dict | None:
    sku_math = workflow_store.get_sku_math(workflow)
    if sku_math is None:
        return None
    return {
        "sku_math": sku_math,
        "obm": workflow_store.get_obm(workflow),
        "level_testing": workflow_store.get_level_testing(workflow),
        "coverage": workflow_store.get_coverage(workflow),
    }


def roi_status_payload(workflow: WorkflowRun, task_id: str | None = None) -> dict:
    tags = workflow.tags or {}
    roi_status = tags.get("roi_status", "queued")
    payload = {
        "status": roi_status.upper(),
        "task_id": task_id or tags.get("roi_task_id"),
        "workflow_run_id": str(workflow.id),
        "case_id": str(workflow.partition.case_id),
        "partition_id": str(workflow.partition_id),
    }
    if roi_status == "completed":
        payload["result"] = workflow_roi_payload(workflow)
    if roi_status == "failed":
        payload["error"] = tags.get("roi_error", "")
    return payload


def _current_selected_skus(partition: Partition) -> list[str]:
    workflow = workflow_store.get_partition_workflow(partition)
    if workflow is None or "selected_skus" not in (workflow.parameters or {}):
        raise ValueError("Run SKU selection before running ROI")

    selected_skus = workflow_store.get_selected_skus(workflow)
    # Matches build_visualization_input_from_database's minimum (shared
    # dataset-loading code between the two pipelines).
    if len(selected_skus) < 3:
        raise ValueError("ROI requires at least 3 selected SKUs")
    return selected_skus


def _selected_dataset_ids(case_id) -> dict[str, str | None]:
    selected = {
        dataset.type: str(dataset.id)
        for dataset in Dataset.objects.filter(
            case_id=case_id,
            is_selected=True,
            is_deleted=False,
            status=Dataset.Status.READY,
        )
    }
    return {
        Dataset.Type.POS: selected.get(Dataset.Type.POS),
        Dataset.Type.ATTRIBUTES: selected.get(Dataset.Type.ATTRIBUTES),
        Dataset.Type.CROSS_PURCHASE: selected.get(Dataset.Type.CROSS_PURCHASE),
    }
