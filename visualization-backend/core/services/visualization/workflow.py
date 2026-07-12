from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from uuid import uuid4

from django.db import transaction
from django.utils import timezone

from core.models import Dataset, Partition, WorkflowRun
from core.services import workflow_store

VISUALIZATION_RESULT_KEY = workflow_store.VISUALIZATION_KEY
# Retained for backwards-compatible imports; the unified row no longer tags rows
# by workflow type.
VISUALIZATION_WORKFLOW_TYPE = "visualization"
SKU_SELECTION_WORKFLOW_TYPE = "sku_selection"
ACTIVE_STATUSES = {WorkflowRun.Status.QUEUED, WorkflowRun.Status.RUNNING}


@dataclass(frozen=True)
class VisualizationContext:
    selected_skus: list[str]
    dataset_ids: dict[str, str | None]


@dataclass(frozen=True)
class VisualizationWorkflowDecision:
    workflow: WorkflowRun
    task_id: str | None
    should_enqueue: bool
    reused_completed_result: bool


def current_visualization_context(partition: Partition) -> VisualizationContext:
    selected_skus = _current_selected_skus(partition)
    dataset_ids = _selected_dataset_ids(partition.case_id)
    if not dataset_ids.get(Dataset.Type.CROSS_PURCHASE):
        raise ValueError("Select a ready CROSSPURCHASE dataset before visualization")
    return VisualizationContext(
        selected_skus=selected_skus,
        dataset_ids=dataset_ids,
    )


def latest_visualization_run(partition_id) -> WorkflowRun | None:
    """The unified workflow row for the partition (visualization lives in its
    ``result['visualization']``)."""
    return (
        WorkflowRun.objects.filter(partition_id=partition_id)
        .order_by("-started_at")
        .first()
    )


def visualization_run_for_task(
    case_id,
    partition_id,
    task_id: str,
) -> WorkflowRun | None:
    return (
        WorkflowRun.objects.filter(
            partition_id=partition_id,
            partition__case_id=case_id,
            tags__task_id=str(task_id),
        )
        .order_by("-started_at")
        .first()
    )


def prepare_visualization_workflow(
    *,
    partition: Partition,
    user,
    task_params: dict,
) -> VisualizationWorkflowDecision:
    context = current_visualization_context(partition)
    signature, signature_payload = visualization_parameter_signature(
        context=context,
        task_params=task_params,
    )

    with transaction.atomic():
        latest = (
            WorkflowRun.objects.select_for_update()
            .filter(partition=partition)
            .order_by("-started_at")
            .first()
        )
        if latest and (latest.tags or {}).get("parameter_signature") == signature:
            task_id = (latest.tags or {}).get("task_id")
            if latest.status in ACTIVE_STATUSES:
                return VisualizationWorkflowDecision(
                    workflow=latest,
                    task_id=task_id,
                    should_enqueue=False,
                    reused_completed_result=False,
                )
            if (
                latest.status == WorkflowRun.Status.COMPLETED
                and workflow_store.get_visualization(latest) is not None
            ):
                return VisualizationWorkflowDecision(
                    workflow=latest,
                    task_id=task_id,
                    should_enqueue=False,
                    reused_completed_result=True,
                )

        workflow = latest or WorkflowRun(partition=partition)
        workflow.started_at = timezone.now()
        workflow.finished_at = None

        task_id = str(uuid4())
        workflow.status = WorkflowRun.Status.QUEUED
        workflow.triggered_by = user
        workflow.datasets = context.dataset_ids
        workflow.parameters = {
            **(workflow.parameters or {}),
            **task_params,
            "selected_skus": context.selected_skus,
        }
        # Re-running visualization invalidates only the visualization result;
        # the partition tree (counts depend on SKUs, not MDS params) is preserved.
        workflow_store.clear_visualization(workflow)
        workflow.error = ""
        workflow.tags = {
            **(workflow.tags or {}),
            "task_id": task_id,
            "parameter_signature": signature,
            "parameter_signature_payload": signature_payload,
        }
        workflow.save()

    return VisualizationWorkflowDecision(
        workflow=workflow,
        task_id=task_id,
        should_enqueue=True,
        reused_completed_result=False,
    )


def visualization_parameter_signature(
    *,
    context: VisualizationContext,
    task_params: dict,
) -> tuple[str, dict]:
    payload = {
        "selected_skus": context.selected_skus,
        "dataset_ids": context.dataset_ids,
        "metrics": task_params.get("metrics"),
        "metric": task_params.get("metric"),
        "include_attributes": task_params.get("include_attributes"),
        "include_roi_matrix": task_params.get("include_roi_matrix"),
        "random_state": task_params.get("random_state"),
    }
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest(), payload


def workflow_visualization_payload(workflow: WorkflowRun) -> dict | None:
    return (workflow.result or {}).get(VISUALIZATION_RESULT_KEY)


def workflow_status_payload(workflow: WorkflowRun, task_id: str | None = None) -> dict:
    visualization = workflow_visualization_payload(workflow)
    payload = {
        "status": workflow.status.upper(),
        "task_id": task_id or (workflow.tags or {}).get("task_id"),
        "workflow_run_id": str(workflow.id),
        "case_id": str(workflow.partition.case_id),
        "partition_id": str(workflow.partition_id),
    }
    if workflow.status == WorkflowRun.Status.COMPLETED:
        payload["result"] = visualization
    if workflow.status == WorkflowRun.Status.FAILED:
        payload["error"] = workflow.error
    return payload


def _current_selected_skus(partition: Partition) -> list[str]:
    workflow = workflow_store.get_partition_workflow(partition)
    if workflow is None or "selected_skus" not in (workflow.parameters or {}):
        raise ValueError("Run SKU selection before visualization")

    selected_skus = workflow_store.get_selected_skus(workflow)
    if len(selected_skus) < 3:
        raise ValueError("Visualization requires at least 3 selected SKUs")
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
