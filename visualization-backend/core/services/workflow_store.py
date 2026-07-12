"""Canonical accessor for the single unified ``WorkflowRun`` per partition.

The workflow JSON is consolidated into ONE row per partition:

- ``parameters`` holds ``selected_skus`` plus the visualization parameters.
- ``result`` holds exactly two keys: ``visualization`` and ``partition_tree``.
- ``status`` tracks the asynchronous visualization lifecycle; partition-tree
  mutations never touch it.

All former ``tags.workflow_type`` discrimination is gone — there is one row, so
lookups resolve by partition alone.

Result/param helpers are pure in-memory mutators (they do NOT save); callers
decide when to persist so they can batch a single ``save()`` inside their own
transaction.
"""

from __future__ import annotations

from typing import Any

from core.models import Partition, WorkflowRun

VISUALIZATION_KEY = "visualization"
PARTITION_TREE_KEY = "partition_tree"


def get_partition_workflow(partition: Partition) -> WorkflowRun | None:
    return (
        WorkflowRun.objects.filter(partition=partition)
        .order_by("-started_at")
        .first()
    )


def get_or_create_workflow(partition: Partition, *, user=None) -> WorkflowRun:
    run = get_partition_workflow(partition)
    if run is None:
        run = WorkflowRun.objects.create(partition=partition, triggered_by=user)
    return run


# --- result: visualization -------------------------------------------------

def get_visualization(workflow: WorkflowRun) -> dict | None:
    return (workflow.result or {}).get(VISUALIZATION_KEY)


def set_visualization(workflow: WorkflowRun, payload: Any) -> WorkflowRun:
    result = dict(workflow.result or {})
    result[VISUALIZATION_KEY] = payload
    workflow.result = result
    return workflow


def clear_visualization(workflow: WorkflowRun) -> WorkflowRun:
    return set_visualization(workflow, None)


# --- result: partition_tree ------------------------------------------------

def get_partition_tree(workflow: WorkflowRun) -> dict | None:
    return (workflow.result or {}).get(PARTITION_TREE_KEY)


def set_partition_tree(workflow: WorkflowRun, graph: Any) -> WorkflowRun:
    result = dict(workflow.result or {})
    result[PARTITION_TREE_KEY] = graph
    workflow.result = result
    return workflow


def clear_partition_tree(workflow: WorkflowRun) -> WorkflowRun:
    return set_partition_tree(workflow, None)


# --- parameters: selected SKUs ---------------------------------------------

def get_selected_skus(workflow: WorkflowRun | None) -> list[str]:
    if workflow is None:
        return []
    # Local import avoids a circular import with core.services.sku_selection.
    from core.services.sku_selection import normalize_selected_skus

    parameters = workflow.parameters or {}
    if "selected_skus" not in parameters:
        return []
    try:
        return normalize_selected_skus(parameters.get("selected_skus"))
    except ValueError:
        return []


def set_selected_skus(workflow: WorkflowRun, skus: list[str]) -> WorkflowRun:
    parameters = dict(workflow.parameters or {})
    parameters["selected_skus"] = list(skus)
    workflow.parameters = parameters
    return workflow
