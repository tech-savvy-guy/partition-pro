from django.db import migrations


def _convert_graph(graph):
    """Rewrite an ``{nodes, edges}`` partition tree into ``{nodes}`` where each
    node carries ``parent_id`` and ``children`` (list of child ids).

    Returns the new graph dict, or ``None`` if nothing needs changing.
    """
    if not isinstance(graph, dict):
        return None
    nodes = graph.get("nodes")
    if not isinstance(nodes, list):
        return None

    # Already migrated: every node has a ``children`` list and there is no
    # ``edges`` array. Skip to keep the migration idempotent.
    if "edges" not in graph and all(
        isinstance(n, dict) and "children" in n for n in nodes
    ):
        return None

    edges = graph.get("edges") or []
    children_by_id = {}
    parent_by_id = {}
    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if source is None or target is None:
            continue
        children_by_id.setdefault(source, []).append(target)
        parent_by_id[target] = source

    new_nodes = []
    for node in nodes:
        if not isinstance(node, dict):
            new_nodes.append(node)
            continue
        node_id = node.get("id")
        node = dict(node)
        # Preserve an explicit parent_id if present, else derive from edges.
        if node.get("parent_id") is None:
            node["parent_id"] = parent_by_id.get(node_id)
        node["children"] = children_by_id.get(node_id, [])
        new_nodes.append(node)

    new_graph = {"nodes": new_nodes}
    if "calculated_at" in graph:
        new_graph["calculated_at"] = graph["calculated_at"]
    return new_graph


def edges_to_children(apps, schema_editor):
    WorkflowRun = apps.get_model("core", "WorkflowRun")
    for run in WorkflowRun.objects.all().iterator():
        result = run.result or {}
        graph = result.get("partition_tree")
        new_graph = _convert_graph(graph)
        if new_graph is None:
            continue
        result = dict(result)
        result["partition_tree"] = new_graph
        run.result = result
        run.save(update_fields=["result"])


def noop_reverse(apps, schema_editor):
    """The flat node-tree is a superset of the edge form; no reverse needed."""


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0025_unify_workflow_rows"),
    ]

    operations = [
        migrations.RunPython(edges_to_children, noop_reverse),
    ]
