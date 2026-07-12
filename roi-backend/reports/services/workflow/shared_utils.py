import uuid
from typing import Any, Dict, List, Optional, Tuple
from django.db.models import Q, QuerySet
from ...models import PreprocessedSkuSelection, PartitionDatasetMetadata, WorkingAttributesData, RawAttributesData
import pandas as pd
Node = Dict[str, Any]

CLIENT_FLAG_TRUE_STRINGS = {"1", "true", "t", "yes", "y"}
CLIENT_FLAG_TRUE_VALUES = ["1", 1, True, "true", "True", "TRUE", "t", "T", "yes", "Yes", "YES", "y", "Y"]


def build_client_flag_q(jsonb_field: str = "data", client_flag_key: str = "is_client") -> Q:
    return Q(**{f"{jsonb_field}__{client_flag_key}__in": CLIENT_FLAG_TRUE_VALUES})


def client_flag_mask(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip().str.lower().isin(CLIENT_FLAG_TRUE_STRINGS)


def client_skus_from_selection_df(df_sel: pd.DataFrame) -> set[str]:
    if "skuname_ean" not in df_sel.columns or "is_client" not in df_sel.columns:
        return set()
    return set(df_sel.loc[client_flag_mask(df_sel["is_client"]), "skuname_ean"].astype(str))

def clear_node_children(parent_node: dict) -> None:
    """Remove all children from a node in-place."""
    parent_node["children"] = []


def remove_attribute_children(parent_node: dict) -> None:
    """Backward-compatible wrapper for clearing a node's children."""
    clear_node_children(parent_node)

def has_attribute_child(parent_node: dict,attribute_name:str) -> bool:
    """Return True if parent already has any child node with type == 'attribute' and same attribute name."""
    for child in (parent_node.get("children") or []):
        if (child or {}).get("type") == "attribute":
            if parent_node.get("children")[0].get("attribute") == attribute_name:
                return True
    return False

def find_node_by_id(root: Node, target_id: Any) -> Optional[Node]:
    """
    Locate and return a node with the given ID from a partition tree.

    Parameters
    ----------
    root : Node
        The root node of the partition tree. Each node is a dictionary
        following the node schema and contains a "children" list.
    target_id : Any
        The unique identifier of the node to find.
    Returns
    -------
    Optional[Node]
        The node dictionary whose "id" matches `target_id` if found,
        otherwise None.
    Notes
    -----
    - The search is performed using an iterative depth-first traversal.
    - This function is used when:
        * Expanding a selected node in the partition tree
    """
    stack = [root]
    while stack:
        n = stack.pop()
        if n.get("id") == target_id:
            return n
        stack.extend(n.get("children", []) or [])
    return None


def update_children_by_id_append(root: Node, target_id: Any, new_child: Node) -> Tuple[Node, bool]:
    if root.get("id") == target_id:
        root.setdefault("children", [])
        root["children"].append(new_child)
        return root, True

    for child in root.get("children", []) or []:
        _, updated = update_children_by_id_append(child, target_id, new_child)
        if updated:
            return root, True

    return root, False


def build_q_from_path(path: List[dict], jsonb_field: str = "data") -> Q:
    q = Q()
    for step in path or []:
        attr = step.get("attribute")
        val = step.get("value")
        if attr is not None and val is not None:
            q &= Q(**{f"{jsonb_field}__{attr}": val})
    return q


def compute_counts_for_path(
    *,

    case_id,
    pp_metadata_id,
    selected_ids: List[Any],
    path: List[dict],
    jsonb_field: str = "data",
    client_flag_key: str = "is_client",
) -> Tuple[int, int]:
    qs = (
        PreprocessedSkuSelection.objects
        .filter(
            case_id=case_id,
            pp_metadata_id=pp_metadata_id,
            id__in=selected_ids,
        )
        .filter(build_q_from_path(path, jsonb_field=jsonb_field))
    )

    sku_count = qs.count()
    client_sku_count = qs.filter(build_client_flag_q(jsonb_field, client_flag_key)).count()

    return int(sku_count), int(client_sku_count)


def make_attribute_node(parent: Node, parent_id: str, attribute_name: str) -> Node:

    parent_level = int(parent.get("level", 0))
    parent_path = list(parent.get("path", []) or [])
    parent_branch = parent.get("branch")

    level = parent_level + 1 if parent.get("type") == "value" or parent.get("type") == "root"  else parent_level


    return {
        "id": uuid.uuid4().hex,
        "parent_id": parent_id,
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
        "children": [],
    }


def make_value_node(parent: Node, parent_id: str, attribute_name: str, value_name: str) -> Node:
    """
    Create a value node under an attribute node in the partition tree.

    A value node represents a concrete selection for an attribute
    (e.g. Pack Size=Small). It updates the partition path
    and inherits the level semantics defined for the tree.

    Parameters
    ----------
    parent : Node
        The parent attribute node under which this value node is created.
    parent_id : str
        The unique identifier of the parent node.
    attribute_name : str
        The attribute this value belongs to (e.g. "Pack Size", "Brand").
    value_name : str
        The selected value for the attribute (e.g. "Small",).

    Returns
    -------
    Node
        A dictionary representing the newly created value node, populated with:
          - updated `path` including this attribute/value
          - human-readable `branch` string
          - correct `level` (same as parent attribute node)
          - empty `children` list (ready for further expansion)

    Notes
    -----
    - Value nodes:
        * Have `type = "value"`
        * Always append one element to the partition `path`
        * Are marked `is_clickable = True` so they can be expanded further
    - The node's `level` is the same as its parent attribute node, following
      the decision-level semantics of the partition tree.
    - `sku_count` and `client_sku_count` are initialized as None and must be
      computed separately after node creation.
    """
    parent_level = int(parent.get("level", 0))
    parent_path = list(parent.get("path", []) or [])
    new_path = parent_path + [{"attribute": attribute_name, "value": value_name}]

    branch = " | ".join(
        f"{p['value']}" for p in new_path
    )

    return {
        "id": uuid.uuid4().hex,
        "parent_id": parent_id,
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
        "children": [],
    }

def _collect_leaf_value_nodes(root: Node) -> List[Node]:
    leaf_nodes: List[Node] = []
    stack = [root]
    while stack:
        n = stack.pop()
        children = n.get("children") or []
        if n.get("type") == "value" and not children:
            leaf_nodes.append(n)
        else:
            stack.extend(children)
    return leaf_nodes


def _qs_json_to_df(qs, base_cols):
    records = qs.values(*base_cols, "data")
    df = pd.DataFrame.from_records(records)
    if "data" in df.columns:
        data_df = pd.json_normalize(df.pop("data").fillna({}))
        df = pd.concat([df, data_df], axis=1)
    if not df.empty:
        df.columns = df.columns.str.replace(
            r'[\u200b\u200c\u200d\uFEFF]', '', regex=True
        )
    return df

def get_filtered_attribute_rows(
    node,
    case_id,
    partition_id,
    metadata_id,  # raw ATTRIBUTES metadata_id (fallback)
    base_queryset_kwargs=None,
) -> QuerySet:
    """
    Filters attribute rows at DB level using jsonb lookups.

    Prefers working merged table (ATTRIBUTES + GROUPING) if available for this partition,
    else falls back to raw ATTRIBUTES rows.

    Assumption:
      - working table rows are keyed by GROUPING PartitionDatasetMetadata.id (grouping_metadata_id)
      - GROUPING upload is the trigger and is the authoritative "current" partition grouping
    """
    base_queryset_kwargs = base_queryset_kwargs or {}
    node_path = node.get("path") or []
    q_filter = build_q_from_path(node_path, jsonb_field="data")


    # Find current GROUPING metadata for this partition
    grouping_md = PartitionDatasetMetadata.objects.filter(
        case_id=case_id,
        partition_id=partition_id,
        data_type="GROUPING",
        status="Ready",
        is_deleted=False,
        is_selected=True,  # keep if you rely on it; otherwise remove
    ).order_by("-created_on").first()

    if grouping_md:
        # Prefer working merged rows (created right after grouping ingestion)
        qs = WorkingAttributesData.objects.filter(
            grouping_metadata_id=grouping_md.id,
            **base_queryset_kwargs,
        ).filter(q_filter)

        # If the working table is empty for some reason, fall back to raw attributes
        if qs.exists():
            return qs

    # Fallback to raw ATTRIBUTES data
    return (
        RawAttributesData.objects.filter(
            case_id=case_id,
            metadata_id=metadata_id,
            **base_queryset_kwargs,
        )
        .filter(q_filter)
    )


def _get_attribute_base_cols(qs_attr) -> tuple:
    """
    Pick base columns that exist for the queryset model.
    WorkingAttributesData and RawAttributesData have different schemas.
    """
    if qs_attr.model is WorkingAttributesData:
        return ("id", "case_id", "partition_id", "row_num")
    if qs_attr.model is RawAttributesData:
        return ("id", "case_id", "metadata_id", "version", "row_num")

    # Fallback: include only known columns that exist on the model
    field_names = {f.name for f in qs_attr.model._meta.get_fields()}
    preferred = ["id", "case_id", "partition_id", "metadata_id", "version", "row_num"]
    return tuple([c for c in preferred if c in field_names])
