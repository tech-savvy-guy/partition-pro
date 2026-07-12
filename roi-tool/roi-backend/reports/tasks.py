from __future__ import annotations


from typing import Any
from uuid import uuid4

from celery import shared_task

from .models import Workflow, DatasetMetadata, Case
from .services.workflow.processes import PROCESS_WORKFLOW, PROCESS_PARTITION_TREE, run_process_step
from .services.workflow.state import update_workflow_step_status, update_workflow_overall_status
from .services.workflow.progress import publish_progress, partition_tree_publish_progress
from .services.ingestion.ingest import ingest_dataset_task_logic, ingest_partition_grouping_logic
from .services.ingestion.errors import IngestionDataError, format_ingestion_error
from .services.workflow.obm import update_obm
from .services.workflow.virtual_rollup import compute_virtual_rollup_preview, normalize_grouping_spec


def _set_dataset_error_tag(
    dataset_id: str,
    error_message: str | None,
    error_hint: str | None = None,
) -> None:
    dataset = DatasetMetadata.objects.filter(id=dataset_id).first()
    if not dataset:
        return

    tags = dict(dataset.tags or {})
    if error_message:
        tags["error_message"] = error_message
    else:
        tags.pop("error_message", None)

    if error_hint:
        tags["error_hint"] = error_hint
    else:
        tags.pop("error_hint", None)

    dataset.tags = tags
    dataset.save(update_fields=["tags"])


def _get_or_create_workflow(case_id: str, partition_id: str, user_identifier: str | None) -> Workflow:
    wf, _ = Workflow.objects.get_or_create(
        case_id=case_id,
        partition_id=partition_id,
        is_deleted=False,
        defaults={
            "status": "PENDING",
            "data": {},
            "tags": {},
            "updated_by": user_identifier,
        },
    )
    return wf

def _run_steps_sequentially(
    run_id: str,
    wf: Workflow,
    process_name: str,
    step_numbers: list[int],
    case_id: str,
    partition_id: str,
    user_identifier: str | None,
    node_id_update: str,
    params: dict | None,
):
    params = params or {}

    total = len(step_numbers)
    # Optional: store which process last ran
    wf.data = wf.data or {}
    wf.data["last_process"] = process_name
    wf.save(update_fields=["data"])

    for idx, step_no in enumerate(step_numbers, start=1):
        step_key = str(step_no)

        # Step RUNNING
        if process_name != "process_partition_tree":
            update_workflow_step_status(wf, step_key, "RUNNING", progress=0.0, updated_by=user_identifier)
            # Push Redis progress (process-level)
            publish_progress(case_id, partition_id, {
                "run_id": run_id,
                "process": process_name,
                "current_step": step_no,
                "status": "RUNNING",
                "percent": round(((idx - 1) / total) * 100, 2),
                "data": (wf.data or {}),
            })
        else:
            # Push Redis progress (process-level)
            partition_tree_publish_progress(case_id, partition_id,node_id_update, {
                "run_id": run_id,
                "process": process_name,
                "current_step": step_no,
                "status": "RUNNING",
                "percent": round(((idx - 1) / total) * 100, 2)
            })


        try:
            result = run_process_step(case_id, partition_id, step_no, params)
            if step_key=='base_math':
                params['base_math_data']=result
            # Step COMPLETED

            if process_name != "process_partition_tree":
                update_workflow_step_status(
                    wf,
                    step_key,
                    "COMPLETED",
                    progress=100.0,
                    result=result,
                    updated_by=user_identifier,
                )
                publish_progress(case_id, partition_id, {
                    "run_id": run_id,
                    "process": process_name,
                    "current_step": step_no,
                    "status": "COMPLETED",
                    "percent": round((idx / total) * 100, 2),
                    "data": (wf.data or {}),
                })
            else:
                partition_tree_publish_progress(case_id, partition_id,node_id_update, {
                    "run_id": run_id,
                    "process": process_name,
                    "current_step": step_no,
                    "status": "COMPLETED",
                    "percent": round((idx / total) * 100, 2),
                    "data": result,
                })


        except Exception as exc:
            if process_name != "process_partition_tree":
                update_workflow_step_status(
                    wf,
                    step_key,
                    "FAILED",
                    progress=100.0,
                    error_message=str(exc),
                    updated_by=user_identifier,
                )
                publish_progress(case_id, partition_id, {
                    "run_id": run_id,
                    "process": process_name,
                    "current_step": step_no,
                    "status": "FAILED",
                    "percent": round(((idx - 1) / total) * 100, 2),
                    "error": str(exc),
                })

                # Mark overall workflow failed and re-raise
                update_workflow_overall_status(wf, "FAILED", updated_by=user_identifier)

            else:
                partition_tree_publish_progress(case_id, partition_id, node_id_update,{
                    "run_id": run_id,
                    "process": process_name,
                    "current_step": step_no,
                    "status": "FAILED",
                    "percent": round(((idx - 1) / total) * 100, 2),
                    "error": str(exc),
                })
            raise


@shared_task(time_limit=960, soft_time_limit=900,bind=True, name="reports.tasks.process_workflow_task")
def process_workflow_task(
    self,
    case_id: str,
    partition_id: str,
    user_identifier: str | None,
    params: dict | None = None,
):
    # Clear previous snapshot so UI doesn't see old run
    run_id = str(uuid4())
    wf = _get_or_create_workflow(case_id, partition_id, user_identifier)
    wf.data={}
    wf.status='PENDING'
    wf.save(update_fields=["data", "status"])
    # overall RUNNING
    update_workflow_overall_status(wf, "RUNNING", updated_by=user_identifier)

    publish_progress(case_id, partition_id, {
        "run_id": run_id,
        "process": PROCESS_WORKFLOW.name,
        "status": "RUNNING",
        "percent": 0.0,
    })

    _run_steps_sequentially(
        run_id=run_id,
        wf=wf,
        process_name=PROCESS_WORKFLOW.name,
        step_numbers=PROCESS_WORKFLOW.steps,
        case_id=case_id,
        partition_id=partition_id,
        node_id_update='',
        user_identifier=user_identifier,
        params=params,
    )

    # overall COMPLETED + increment execution_number
    update_workflow_overall_status(
        wf,
        "COMPLETED",
        updated_by=user_identifier,
        increment_execution=True,
    )

    publish_progress(case_id, partition_id, {
        "run_id": run_id,
        "process": PROCESS_WORKFLOW.name,
        "status": "COMPLETED",
        "percent": 100.0,
        "step_number": wf.step_number,
        "data": (wf.data or {}),
    })

    return {"status": "COMPLETED", "step_number": wf.step_number}


@shared_task(time_limit=960, soft_time_limit=900,bind=True, name="reports.tasks.process_partition_tree_task")
def process_partition_tree_task(
    self,
    case_id: str,
    partition_id: str,
    user_identifier: str | None,
    params: dict | None = None,
):

    wf = _get_or_create_workflow(case_id, partition_id, user_identifier)
    run_id = str(uuid4())
    node_id_update=params.get("node_obj",{}).get("id","") or ""

    _run_steps_sequentially(
        run_id=run_id,
        wf=wf,
        process_name=PROCESS_PARTITION_TREE.name,
        step_numbers=PROCESS_PARTITION_TREE.steps,
        case_id=case_id,
        partition_id=partition_id,
        user_identifier=user_identifier,
        node_id_update=node_id_update,
        params=params,
    )

    return {"status": "COMPLETED", "step_number": wf.step_number}


@shared_task(time_limit=960, soft_time_limit=900,bind=True, name="reports.tasks.ingest_dataset_task")
def ingest_dataset_task(self, payload: dict, user_identifier: str | None = None):
    """
    Celery ingestion task. Route this to 'ingest' queue.
    payload should contain:
      dataset_id, case_id, data_type, version, blob_name
    """
    dataset_id = payload.get("dataset_id", None)
    case_id = payload.get("case_id", None)
    run_id = str(uuid4())
    is_preprocessed=False
    # (Optional) progress key pattern of your choice
    if case_id and dataset_id:
        publish_progress(str(case_id), "dataset", {
            "run_id": run_id,
            "type": "ingest",
            "dataset_id": str(dataset_id),
            "status": "RUNNING",
            "percent": 1.0
        })

    # Update dataset status in DB
    if dataset_id:
        DatasetMetadata.objects.filter(id=dataset_id).update(status="Processing")
        _set_dataset_error_tag(str(dataset_id), None, None)


    try:
        is_preprocessed = ingest_dataset_task_logic(payload)


        if dataset_id:
            DatasetMetadata.objects.filter(id=dataset_id).update(status="Ready")
            _set_dataset_error_tag(str(dataset_id), None, None)
        if is_preprocessed:
            Case.objects.filter(id=case_id).update(is_preprocessed=True)

        if case_id and dataset_id:
            publish_progress(str(case_id), "dataset", {
                "run_id": run_id,
                "type": "ingest",
                "dataset_id": str(dataset_id),
                "status": "COMPLETED",
                "percent": 100.0
            })

        return {"dataset_id": str(dataset_id), "status": "Ready"}

    except Exception as exc:
        error_message = format_ingestion_error(exc, include_hint=False)
        error_hint = exc.hint if isinstance(exc, IngestionDataError) else None
        if dataset_id:
            DatasetMetadata.objects.filter(id=dataset_id).update(status="Failed")
            _set_dataset_error_tag(str(dataset_id), error_message, error_hint)

        if case_id and dataset_id:
            publish_progress(str(case_id), "dataset", {
                "run_id": run_id,
                "type": "ingest",
                "dataset_id": str(dataset_id),
                "status": "FAILED",
                "percent": 100.0,
                "error": error_message
            })
        raise

@shared_task(time_limit=960, soft_time_limit=900,bind=True, name="reports.tasks.compute_obm_task")
def compute_obm(self,case_id:str, partition_id:str, user_identifier:str | None, tree:dict):
    wf = _get_or_create_workflow(case_id, partition_id, user_identifier)
    data = wf.data or {}
    # Mark step RUNNING
    update_workflow_step_status(wf, "partition_obm", "RUNNING", progress=1.0, updated_by=user_identifier)
    # front-end is polling this result
    publish_progress(case_id, partition_id, {
        "process": PROCESS_WORKFLOW.name,
        "status": "RUNNING",
        "percent": 1.0,
        "data": (wf.data or {}),
    })

    obm_json, obm_status = update_obm(case_id, partition_id,tree)
    wf.refresh_from_db(fields=["data"])
    data = wf.data or {}
    if obm_status:
        data["steps"]["partition_obm"]["result"]= obm_json
        data["steps"]["partition_obm"]["status"] = "Completed"
    else:
        data["steps"]["partition_obm"]["status"] = "Failed"

    wf.save()

    update_workflow_step_status(
        wf,
        "partition_obm",
        "COMPLETED",
        progress=100.0,
        updated_by=user_identifier,
    )
    publish_progress(case_id, partition_id, {
        "process": PROCESS_WORKFLOW.name,
        "status": "COMPLETED",
        "percent": 100.0,
        "data": (wf.data or {}),
    })


@shared_task(time_limit=960, soft_time_limit=900, bind=True, name="reports.tasks.compute_virtual_rollup_task")
def compute_virtual_rollup_task(
    self,
    case_id: str,
    partition_id: str,
    node_id: str,
    attribute_name: str,
    new_grouping_spec: dict[str, list[str]] | list[dict[str, Any]] | str,
    grouping_labels: dict[str, str] | None = None,
):
    """
    Async Celery task to compute virtual attribute roll-up preview.
    
    Does NOT persist to DB. Results cached in Redis with 1-hour TTL.
    Uses only selected_skus for df_long fetch (optimized subset).
    
    Returns preview result with base_testing structure.
    """
    run_id = str(uuid4())
    
    try:
        try:
            normalized_grouping_spec = normalize_grouping_spec(
                new_grouping_spec,
                grouping_labels=grouping_labels,
            )
        except ValueError as exc:
            return {
                "status": "error",
                "error": str(exc),
                "error_type": "invalid_new_grouping_spec",
            }

        result = compute_virtual_rollup_preview(
            run_id=run_id,
            case_id=case_id,
            partition_id=partition_id,
            node_id=node_id,
            attribute_name=attribute_name,
            new_grouping_spec=normalized_grouping_spec,
            grouping_labels=None,
        )
        return result
    except Exception as exc:
        return {
            "status": "error",
            "error": str(exc),
            "error_type": type(exc).__name__,
        }


# @shared_task(time_limit=960, soft_time_limit=900, bind=True, name="reports.tasks.ingest_partition_dataset_task")
# def ingest_partition_dataset_task(self, payload: dict, user_identifier: str | None = None):
#     """
#     Celery ingestion task for partition grouping data. Route to 'ingest' queue.
    
#     payload should contain:
#       partition_dataset_id, partition_id, case_id, blob_name
#     """
#     partition_dataset_id = payload.get("partition_dataset_id", None)
#     partition_id = payload.get("partition_id", None)
#     case_id = payload.get("case_id", None)
#     run_id = str(uuid4())

#     # (Optional) publish progress
#     if case_id and partition_dataset_id:
#         publish_progress(str(case_id), str(partition_id), {
#             "run_id": run_id,
#             "type": "partition_ingest",
#             "partition_dataset_id": str(partition_dataset_id),
#             "status": "RUNNING",
#             "percent": 1.0
#         })

#     # Update metadata status in DB
#     if partition_dataset_id:
#         from reports.models import PartitionDatasetMetadata
#         PartitionDatasetMetadata.objects.filter(id=partition_dataset_id).update(status="Processing")

#     try:
#         ingest_partition_grouping_logic(payload)

#         if partition_dataset_id:
#             from reports.models import PartitionDatasetMetadata
#             PartitionDatasetMetadata.objects.filter(id=partition_dataset_id).update(status="Ready")

#         if case_id and partition_dataset_id:
#             publish_progress(str(case_id), str(partition_id), {
#                 "run_id": run_id,
#                 "type": "partition_ingest",
#                 "partition_dataset_id": str(partition_dataset_id),
#                 "status": "COMPLETED",
#                 "percent": 100.0
#             })

#         return {"partition_dataset_id": str(partition_dataset_id), "status": "Ready"}

#     except Exception as exc:
#         if partition_dataset_id:
#             from reports.models import PartitionDatasetMetadata
#             PartitionDatasetMetadata.objects.filter(id=partition_dataset_id).update(status="Failed")

#         if case_id and partition_dataset_id:
#             publish_progress(str(case_id), str(partition_id), {
#                 "run_id": run_id,
#                 "type": "partition_ingest",
#                 "partition_dataset_id": str(partition_dataset_id),
#                 "status": "FAILED",
#                 "percent": 100.0,
#                 "error": str(exc)
#             })
#         raise


# ingest_dataset_task({"case_id":"f2c314aa-0334-4088-8753-842adff0e1c2","test":True})
