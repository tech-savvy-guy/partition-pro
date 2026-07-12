"""Node-tree operations for the partition tree.

The tree is stored as a flat ``{ "nodes": [...] }`` list (there is no separate
``edges`` array). Hierarchy lives on the nodes themselves:

- ``parent_id`` — id of the node's parent (``None`` for the root).
- ``children`` — list of child node ids (empty ``[]`` for leaves).

Nodes stay in a flat list (rather than physically nesting children) so lookups
by id remain O(1)-ish and the JSON shape is easy to mutate in place.
"""

from __future__ import annotations

from typing import Any

Node = dict[str, Any]


def find_node(nodes: list[Node], node_id: Any) -> Node | None:
    for node in nodes:
        if node.get("id") == node_id:
            return node
    return None


def child_ids(nodes: list[Node], parent_id: Any) -> list[str]:
    parent = find_node(nodes, parent_id)
    if parent is None:
        return []
    return list(parent.get("children") or [])


def child_nodes(nodes: list[Node], parent_id: Any) -> list[Node]:
    by_id = {n.get("id"): n for n in nodes}
    return [by_id[cid] for cid in child_ids(nodes, parent_id) if cid in by_id]


def descendant_ids(nodes: list[Node], parent_id: Any) -> set[str]:
    """All ids strictly below ``parent_id`` (BFS over ``children``)."""
    out: set[str] = set()
    frontier = list(child_ids(nodes, parent_id))
    while frontier:
        current = frontier.pop()
        if current in out:
            continue
        out.add(current)
        frontier.extend(child_ids(nodes, current))
    return out


def has_attribute_child(
    nodes: list[Node], parent_id: Any, attribute_name: str
) -> bool:
    for child in child_nodes(nodes, parent_id):
        if child.get("type") == "attribute" and child.get("attribute") == attribute_name:
            return True
    return False


def remove_children(nodes: list[Node], parent_id: Any) -> list[Node]:
    """Drop the entire subtree below ``parent_id`` and clear its ``children``."""
    drop = descendant_ids(nodes, parent_id)
    if not drop:
        return nodes
    new_nodes = [n for n in nodes if n.get("id") not in drop]
    parent = find_node(new_nodes, parent_id)
    if parent is not None:
        parent["children"] = []
    return new_nodes


def add_child(nodes: list[Node], parent_node: Node, child_node: Node) -> list[Node]:
    """Append ``child_node`` and link it to ``parent_node`` (both directions)."""
    child_node["parent_id"] = parent_node.get("id")
    child_node.setdefault("children", [])
    nodes.append(child_node)
    siblings = parent_node.setdefault("children", [])
    if child_node["id"] not in siblings:
        siblings.append(child_node["id"])
    return nodes
