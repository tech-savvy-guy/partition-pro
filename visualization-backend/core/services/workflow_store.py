"""Canonical accessor for the single unified ``WorkflowRun`` per partition.

The workflow JSON is consolidated into ONE row per partition:

- ``parameters`` holds ``selected_skus`` plus the visualization/ROI parameters.
- ``result`` holds up to seven keys: ``visualization``, ``partition_tree``,
  ``sku_math``, ``obm``, ``level_testing``, ``coverage`` (the ROI
  methodology's partition-level outputs) and ``node_testing`` (the latest
  per-node Base/Level Testing run from the tree dialog).
- ``status``/``tags.task_id`` track the asynchronous visualization lifecycle;
  the ROI pipeline tracks its own lifecycle via ``tags.roi_task_id`` (see
  ``core.services.roi.workflow``) so the two async jobs never clobber each
  other's tags. Partition-tree mutations never touch either.

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
SKU_MATH_KEY = "sku_math"
OBM_KEY = "obm"
LEVEL_TESTING_KEY = "level_testing"
COVERAGE_KEY = "coverage"
NODE_TESTING_KEY = "node_testing"


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


# --- result: sku_math (ROI matrix) ------------------------------------------

def get_sku_math(workflow: WorkflowRun) -> dict | None:
    return (workflow.result or {}).get(SKU_MATH_KEY)


def set_sku_math(workflow: WorkflowRun, payload: Any) -> WorkflowRun:
    result = dict(workflow.result or {})
    result[SKU_MATH_KEY] = payload
    workflow.result = result
    return workflow


def clear_sku_math(workflow: WorkflowRun) -> WorkflowRun:
    return set_sku_math(workflow, None)


# --- result: obm -------------------------------------------------------------

def get_obm(workflow: WorkflowRun) -> dict | None:
    return (workflow.result or {}).get(OBM_KEY)


def set_obm(workflow: WorkflowRun, payload: Any) -> WorkflowRun:
    result = dict(workflow.result or {})
    result[OBM_KEY] = payload
    workflow.result = result
    return workflow


def clear_obm(workflow: WorkflowRun) -> WorkflowRun:
    return set_obm(workflow, None)


# --- result: level_testing -----------------------------------------------

def get_level_testing(workflow: WorkflowRun) -> dict | None:
    return (workflow.result or {}).get(LEVEL_TESTING_KEY)


def set_level_testing(workflow: WorkflowRun, payload: Any) -> WorkflowRun:
    result = dict(workflow.result or {})
    result[LEVEL_TESTING_KEY] = payload
    workflow.result = result
    return workflow


def clear_level_testing(workflow: WorkflowRun) -> WorkflowRun:
    return set_level_testing(workflow, None)


# --- result: coverage ---------------------------------------------------------

def get_coverage(workflow: WorkflowRun) -> dict | None:
    return (workflow.result or {}).get(COVERAGE_KEY)


def set_coverage(workflow: WorkflowRun, payload: Any) -> WorkflowRun:
    result = dict(workflow.result or {})
    result[COVERAGE_KEY] = payload
    workflow.result = result
    return workflow


def clear_coverage(workflow: WorkflowRun) -> WorkflowRun:
    return set_coverage(workflow, None)


# --- result: node_testing (latest per-node Base/Level Testing run) -----------

def get_node_testing(workflow: WorkflowRun) -> dict | None:
    return (workflow.result or {}).get(NODE_TESTING_KEY)


def set_node_testing(workflow: WorkflowRun, payload: Any) -> WorkflowRun:
    result = dict(workflow.result or {})
    result[NODE_TESTING_KEY] = payload
    workflow.result = result
    return workflow


def clear_node_testing(workflow: WorkflowRun) -> WorkflowRun:
    return set_node_testing(workflow, None)


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
