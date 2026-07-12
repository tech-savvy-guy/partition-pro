from __future__ import annotations

from celery import shared_task
from django.utils import timezone

from core.models import WorkflowRun
from core.services.visualization.analysis import (
    compute_visualization_result,
    compute_visualization_results,
)
from core.services.visualization.progress import publish_visualization_progress
from core.services.visualization.workflow import VISUALIZATION_RESULT_KEY


@shared_task(time_limit=960, soft_time_limit=900, bind=True, name="core.tasks.compute_visualization_task")
def compute_visualization_task(self, workflow_run_id: str):
    workflow = WorkflowRun.objects.select_related("partition").get(id=workflow_run_id)
    task_id = str(self.request.id)
    case_id = str(workflow.partition.case_id)
    partition_id = str(workflow.partition_id)

    tags = dict(workflow.tags or {})
    tags["task_id"] = task_id
    workflow.tags = tags
    workflow.status = WorkflowRun.Status.RUNNING
    workflow.error = ""
    workflow.save(update_fields=["tags", "status", "error"])

    _publish_progress(
        case_id,
        partition_id,
        task_id,
        {
            "status": "RUNNING",
            "task_id": task_id,
            "workflow_run_id": str(workflow.id),
            "case_id": case_id,
            "partition_id": partition_id,
            "percent": 1.0,
        },
    )

    params = workflow.parameters or {}
    try:
        selected_skus = list(params.get("selected_skus") or [])
        dataset_ids = workflow.datasets or {}
        if params.get("metrics") is not None:
            result = compute_visualization_results(
                case_id=case_id,
                partition_id=partition_id,
                selected_skus=selected_skus,
                dataset_ids=dataset_ids,
                metrics=list(params.get("metrics") or []),
                include_attributes=bool(params.get("include_attributes", True)),
                include_roi_matrix=bool(params.get("include_roi_matrix", False)),
                random_state=int(params.get("random_state") or 1234),
            )
        else:
            result = compute_visualization_result(
                case_id=case_id,
                partition_id=partition_id,
                selected_skus=selected_skus,
                dataset_ids=dataset_ids,
                metric=str(params.get("metric") or "chi"),
                include_attributes=bool(params.get("include_attributes", True)),
                include_roi_matrix=bool(params.get("include_roi_matrix", False)),
                random_state=int(params.get("random_state") or 1234),
            )

        workflow.result = {**(workflow.result or {}), VISUALIZATION_RESULT_KEY: result}
        workflow.status = WorkflowRun.Status.COMPLETED
        workflow.finished_at = timezone.now()
        workflow.error = ""
        workflow.save(update_fields=["result", "status", "finished_at", "error"])

        payload = {
            "status": "COMPLETED",
            "task_id": task_id,
            "workflow_run_id": str(workflow.id),
            "case_id": case_id,
            "partition_id": partition_id,
            "percent": 100.0,
            "result": result,
        }
        _publish_progress(case_id, partition_id, task_id, payload)
        return {"status": "COMPLETED", "result": result}
    except Exception as exc:
        workflow.status = WorkflowRun.Status.FAILED
        workflow.finished_at = timezone.now()
        workflow.error = str(exc)
        workflow.save(update_fields=["status", "finished_at", "error"])

        _publish_progress(
            case_id,
            partition_id,
            task_id,
            {
                "status": "FAILED",
                "task_id": task_id,
                "workflow_run_id": str(workflow.id),
                "case_id": case_id,
                "partition_id": partition_id,
                "percent": 100.0,
                "error": str(exc),
                "error_type": type(exc).__name__,
            },
        )
        raise


def _publish_progress(case_id: str, partition_id: str, task_id: str, payload: dict) -> None:
    try:
        publish_visualization_progress(case_id, partition_id, task_id, payload)
    except Exception:
        pass
