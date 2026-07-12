"""Persistence for the partition tree.

The tree lives in the unified workflow row's ``result["partition_tree"]`` as a
flat node list::

    result["partition_tree"] = {
        "nodes": [ <node>, ... ],   # each node carries parent_id + children[]
        "calculated_at": "<iso>",
    }

Partition-tree mutations never touch the row's top-level ``status``/``finished_at``
— that field tracks the asynchronous visualization lifecycle.
"""

from __future__ import annotations

from typing import Any

from django.db import transaction
from django.utils import timezone

from core.models import Partition, WorkflowRun
from core.services import workflow_store

from .counts import compute_counts_for_path, load_context
from .nodes import make_root_node

Node = dict[str, Any]


def load_graph(workflow: WorkflowRun) -> dict | None:
    """Return ``{nodes, ...}`` or None if the tree hasn't been seeded."""
    graph = workflow_store.get_partition_tree(workflow)
    if not graph:
        return None
    return graph


def save_graph(workflow: WorkflowRun, nodes: list[Node]) -> dict:
    # Preserve the saved attribute-colour map across structural saves — it is a
    # sibling of ``nodes`` inside the partition_tree graph, not derived from it.
    existing = load_graph(workflow) or {}
    graph = {
        "nodes": nodes,
        "calculated_at": timezone.now().isoformat(),
        "attribute_colors": existing.get("attribute_colors") or {},
    }
    workflow_store.set_partition_tree(workflow, graph)
    workflow.save(update_fields=["result"])
    return graph


def get_attribute_colors(workflow: WorkflowRun) -> dict:
    """Return ``{node_id: {attribute: {value: "#RRGGBB"}}}`` (empty if unset)."""
    graph = load_graph(workflow) or {}
    return graph.get("attribute_colors") or {}


def save_attribute_colors(
    workflow: WorkflowRun,
    node_id: str,
    attribute_name: str,
    colors: dict[str, str],
) -> dict:
    """Merge ``colors`` (value -> hex) for ``(node_id, attribute_name)`` and persist.

    Returns the full updated partition_tree graph.
    """
    graph = dict(load_graph(workflow) or {"nodes": []})
    attribute_colors = dict(graph.get("attribute_colors") or {})
    node_colors = dict(attribute_colors.get(node_id) or {})
    attr_colors = dict(node_colors.get(attribute_name) or {})
    attr_colors.update(colors)
    node_colors[attribute_name] = attr_colors
    attribute_colors[node_id] = node_colors
    graph["attribute_colors"] = attribute_colors
    workflow_store.set_partition_tree(workflow, graph)
    workflow.save(update_fields=["result"])
    return graph


def seed_root(partition: Partition, workflow: WorkflowRun) -> dict:
    """Build and persist the root ("Shopper's Partition") node as a 1-node tree."""
    ctx = load_context(partition)
    sku_count, client_sku_count = compute_counts_for_path(ctx, [])
    root = make_root_node(sku_count=sku_count, client_sku_count=client_sku_count)
    return save_graph(workflow, [root])


def get_or_seed_graph(partition: Partition, *, user=None) -> tuple[WorkflowRun, dict]:
    """Return ``(workflow, graph)``, seeding the root on first access.

    The lazy-seed is what makes the root node available to the frontend the
    first time the Partition Tree tab is opened.
    """
    with transaction.atomic():
        workflow = workflow_store.get_or_create_workflow(partition, user=user)
        graph = load_graph(workflow)
        if graph is None:
            graph = seed_root(partition, workflow)
    return workflow, graph
