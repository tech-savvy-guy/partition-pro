"""Partition-tree node builders.

The node fields mirror roi-backend
(`reports/services/workflow/partition_tree.py` and
`reports/services/workflow/shared_utils.py`). The tree is stored as a flat
`{nodes}` list; hierarchy lives on each node via `parent_id` (id of the parent,
`None` for the root) and `children` (list of child node ids, `[]` for leaves).
Builders create fresh leaves, so `children` always starts empty.
"""

from __future__ import annotations

import uuid
from typing import Any

Node = dict[str, Any]

ROOT_NODE_NAME = "Shopper's Partition"


def make_root_node(*, sku_count: int | None, client_sku_count: int | None) -> Node:
    """Build the root ("Shopper's Partition") node.

    Mirrors roi-backend `_calculate_partition_tree` (partition_tree.py:94-118):
    a fresh root with a stable uuid hex id.
    """
    return {
        "id": uuid.uuid4().hex,
        "parent_id": None,
        "children": [],
        "type": "root",
        "level": 0,
        "branch": None,
        "path": [],
        "attribute": None,
        "value": None,
        "sku_count": sku_count,
        "client_sku_count": client_sku_count,
        "node_name": ROOT_NODE_NAME,
        "is_clickable": True,
        "comments": None,
    }


def make_attribute_node(parent: Node, parent_id: str, attribute_name: str) -> Node:
    """Create an attribute node under ``parent``.

    Verbatim port of roi-backend `make_attribute_node` (shared_utils.py:123-147).
    """
    parent_level = int(parent.get("level", 0))
    parent_path = list(parent.get("path", []) or [])
    parent_branch = parent.get("branch")

    level = (
        parent_level + 1
        if parent.get("type") == "value" or parent.get("type") == "root"
        else parent_level
    )

    return {
        "id": uuid.uuid4().hex,
        "parent_id": parent_id,
        "children": [],
        "type": "attribute",
        "level": level,
        "branch": parent_branch,
        "path": parent_path,
        "attribute": attribute_name,
        "value": None,
        "sku_count": parent.get("sku_count"),
        "client_sku_count": parent.get("client_sku_count"),
        "node_name": attribute_name,
        "is_clickable": False,
        "comments": None,
    }


def make_value_node(
    parent: Node, parent_id: str, attribute_name: str, value_name: str
) -> Node:
    """Create a value node under an attribute node.

    Verbatim port of roi-backend `make_value_node` (shared_utils.py:150-212).
    ``sku_count``/``client_sku_count`` are initialised to None and filled in by
    the caller after counting.
    """
    parent_level = int(parent.get("level", 0))
    parent_path = list(parent.get("path", []) or [])
    new_path = parent_path + [{"attribute": attribute_name, "value": value_name}]

    branch = " | ".join(f"{p['value']}" for p in new_path)

    return {
        "id": uuid.uuid4().hex,
        "parent_id": parent_id,
        "children": [],
        "type": "value",
        "level": parent_level,
        "branch": branch,
        "path": new_path,
        "attribute": attribute_name,
        "value": value_name,
        "sku_count": None,
        "client_sku_count": None,
        "node_name": value_name,
        "is_clickable": True,
        "comments": None,
    }
