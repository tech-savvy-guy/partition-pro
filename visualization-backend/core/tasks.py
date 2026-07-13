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
from core.services.roi.analysis import compute_roi_result
from core.services.roi.node_testing import run_node_testing
from core.services.roi.obm import compute_obm
from core.services.roi.progress import (
    publish_node_testing_progress,
    publish_roi_progress,
)
from core.services.partition_tree.counts import load_context
from core.services.partition_tree.store import load_graph
from core.services.preprocessing.build import run_preprocessing
from core.services.preprocessing.progress import publish_preprocessing_progress
from core.services.preprocessing.read import (
    metadata_for_current_selection,
    roi_long_from_db,
)
from core.services import workflow_store


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


@shared_task(time_limit=960, soft_time_limit=900, bind=True, name="core.tasks.compute_roi_task")
def compute_roi_task(self, workflow_run_id: str):
    """Mirrors compute_visualization_task, but writes exclusively to
    tags.roi_* and the sku_math/obm/level_testing/coverage result keys — it
    never touches workflow.status/started_at/finished_at/error, which belong
    to the visualization pipeline's lifecycle (see core.services.roi.workflow).
    """
    workflow = WorkflowRun.objects.select_related("partition").get(id=workflow_run_id)
    task_id = str(self.request.id)
    case_id = str(workflow.partition.case_id)
    partition_id = str(workflow.partition_id)

    tags = dict(workflow.tags or {})
    tags["roi_task_id"] = task_id
    tags["roi_status"] = "running"
    tags["roi_error"] = ""
    tags["roi_started_at"] = timezone.now().isoformat()
    workflow.tags = tags
    workflow.save(update_fields=["tags"])

    _publish_roi_progress(
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
        result = compute_roi_result(
            case_id=case_id,
            partition_id=partition_id,
            selected_skus=selected_skus,
            include_obm=bool(params.get("include_obm", True)),
            include_level_testing=bool(params.get("include_level_testing", True)),
            include_coverage=bool(params.get("include_coverage", True)),
            dataset_ids=workflow.datasets or {},
        )

        workflow_store.set_sku_math(workflow, result.get("sku_math"))
        workflow_store.set_obm(workflow, result.get("obm"))
        workflow_store.set_level_testing(workflow, result.get("level_testing"))
        workflow_store.set_coverage(workflow, result.get("coverage"))
        tags = dict(workflow.tags or {})
        tags["roi_status"] = "completed"
        tags["roi_error"] = ""
        tags["roi_finished_at"] = timezone.now().isoformat()
        workflow.tags = tags
        workflow.save(update_fields=["result", "tags"])

        payload = {
            "status": "COMPLETED",
            "task_id": task_id,
            "workflow_run_id": str(workflow.id),
            "case_id": case_id,
            "partition_id": partition_id,
            "percent": 100.0,
            "result": {
                "sku_math": result.get("sku_math"),
                "obm": result.get("obm"),
                "level_testing": result.get("level_testing"),
                "coverage": result.get("coverage"),
            },
        }
        _publish_roi_progress(case_id, partition_id, task_id, payload)
        return {"status": "COMPLETED", "result": result}
    except Exception as exc:
        tags = dict(workflow.tags or {})
        tags["roi_status"] = "failed"
        tags["roi_error"] = str(exc)
        tags["roi_finished_at"] = timezone.now().isoformat()
        workflow.tags = tags
        workflow.save(update_fields=["tags"])

        _publish_roi_progress(
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


def _publish_roi_progress(case_id: str, partition_id: str, task_id: str, payload: dict) -> None:
    try:
        publish_roi_progress(case_id, partition_id, task_id, payload)
    except Exception:
        pass


@shared_task(time_limit=960, soft_time_limit=900, bind=True, name="core.tasks.preprocess_case_task")
def preprocess_case_task(self, case_id: str):
    """Build the case's preprocessing artifacts (the full-panel ROI matrix).

    Case-level and dataset-driven — unlike the workflow_run-keyed compute tasks,
    this is keyed by case_id and triggered from the atomic dataset-selection
    endpoint. Idempotent via ``Metadata``'s ``(case_id, signature)`` unique
    constraint — a combination already ``READY`` is reused, never recomputed.
    """
    case_id = str(case_id)
    _publish_preprocessing_progress(case_id, {"status": "RUNNING", "case_id": case_id, "percent": 1.0})
    try:
        metadata = run_preprocessing(case_id)
        _publish_preprocessing_progress(
            case_id,
            {
                "status": metadata.status.upper(),
                "case_id": case_id,
                "metadata_id": str(metadata.id),
                "sku_count": metadata.sku_count,
                "percent": 100.0,
            },
        )
        return {"status": metadata.status.upper(), "metadata_id": str(metadata.id)}
    except Exception as exc:
        _publish_preprocessing_progress(
            case_id,
            {
                "status": "FAILED",
                "case_id": case_id,
                "percent": 100.0,
                "error": str(exc),
                "error_type": type(exc).__name__,
            },
        )
        raise


def _publish_preprocessing_progress(case_id: str, payload: dict) -> None:
    try:
        publish_preprocessing_progress(case_id, payload)
    except Exception:
        pass


@shared_task(time_limit=960, soft_time_limit=900, bind=True, name="core.tasks.compute_node_testing_task")
def compute_node_testing_task(self, workflow_run_id: str, node_id: str, attributes: list[str]):
    """Per-node Base/Level Testing for the partition-tree dialog. Progress is
    published to Redis keyed by node (the frontend polls the node, not the
    task); the completed payload is persisted under the workflow's
    ``node_testing`` result key (latest node run wins)."""
    workflow = WorkflowRun.objects.select_related("partition").get(id=workflow_run_id)
    partition = workflow.partition
    case_id = str(partition.case_id)
    partition_id = str(partition.id)
    node_id = str(node_id)

    def publish(payload: dict) -> None:
        try:
            publish_node_testing_progress(case_id, partition_id, node_id, payload)
        except Exception:
            pass

    publish({"status": "RUNNING", "node_id": node_id, "percent": 10.0})

    graph = load_graph(workflow) or {}
    node = next(
        (n for n in (graph.get("nodes") or []) if str(n.get("id")) == node_id),
        None,
    )
    if node is None:
        publish(
            {
                "status": "FAILED",
                "node_id": node_id,
                "percent": 100.0,
                "error": f"node_id={node_id} not found",
            }
        )
        raise ValueError(f"node_id={node_id} not found in partition tree")

    try:
        result = run_node_testing(
            case_id=case_id,
            partition=partition,
            node=node,
            attributes=list(attributes or []),
        )

        workflow_store.set_node_testing(
            workflow,
            {
                "node_id": node_id,
                "status": "completed",
                "base_testing": result["base_testing"],
                "level_testing": result["level_testing"],
                "updated_on": timezone.now().isoformat(),
            },
        )
        workflow.save(update_fields=["result"])

        publish(
            {
                "status": "COMPLETED",
                "node_id": node_id,
                "percent": 100.0,
                "data": {
                    "base_testing": result["base_testing"],
                    "level_testing": result["level_testing"],
                },
            }
        )
        return {"status": "COMPLETED", "node_id": node_id}
    except Exception as exc:
        workflow_store.set_node_testing(
            workflow,
            {
                "node_id": node_id,
                "status": "failed",
                "error": str(exc),
                "updated_on": timezone.now().isoformat(),
            },
        )
        workflow.save(update_fields=["result"])
        publish(
            {
                "status": "FAILED",
                "node_id": node_id,
                "percent": 100.0,
                "error": str(exc),
                "error_type": type(exc).__name__,
            }
        )
        raise


@shared_task(time_limit=960, soft_time_limit=900, bind=True, name="core.tasks.compute_obm_task")
def compute_obm_task(self, workflow_run_id: str):
    """Recompute the partition's OBM after a tree mutation (attribute selected
    / children deleted) — mirrors roi-backend's ``compute_obm`` queue task.
    Lifecycle lives in ``tags.obm_*``; the compact result replaces the
    workflow's ``obm`` key (or clears it when the tree has no value leaves),
    keeping the OBM tab consistent with the current tree."""
    workflow = WorkflowRun.objects.select_related("partition").get(id=workflow_run_id)
    partition = workflow.partition
    case_id = str(partition.case_id)

    tags = dict(workflow.tags or {})
    tags["obm_status"] = "running"
    tags["obm_error"] = ""
    workflow.tags = tags
    workflow.save(update_fields=["tags"])

    try:
        selected_skus = workflow_store.get_selected_skus(workflow)
        metadata = metadata_for_current_selection(case_id)
        if metadata is None:
            raise ValueError(
                "This case's current dataset combination has not been preprocessed yet."
            )

        ctx = load_context(partition)
        graph = load_graph(workflow) or {}
        nodes = graph.get("nodes") or []
        roi_long = roi_long_from_db(metadata.id, selected_skus)
        obm_result = compute_obm(ctx, nodes, roi_long)

        workflow_store.set_obm(
            workflow, obm_result.compact if obm_result is not None else None
        )
        tags = dict(workflow.tags or {})
        tags["obm_status"] = "completed"
        tags["obm_error"] = ""
        tags["obm_finished_at"] = timezone.now().isoformat()
        workflow.tags = tags
        workflow.save(update_fields=["result", "tags"])
        return {"status": "COMPLETED"}
    except Exception as exc:
        tags = dict(workflow.tags or {})
        tags["obm_status"] = "failed"
        tags["obm_error"] = str(exc)
        tags["obm_finished_at"] = timezone.now().isoformat()
        workflow.tags = tags
        workflow.save(update_fields=["tags"])
        raise
