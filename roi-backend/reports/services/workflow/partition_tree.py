from __future__ import annotations

import uuid
from typing import Dict, Any
from uuid import UUID
from django.db.models import Q
from .observability import log_event, Timer


from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone

from .base import register_step_calculator, build_cache_key, get_partition
from .base_math import _call_db_get_joined, merged_list_to_df_like
from .base_testing import _calculate_base_testing
from .level_testing import _run_level_testing_for_all_pairs
from .shared_utils import build_client_flag_q
from ...models import (
    Workflow,
    PreprocessedSkuSelection,
)


# ----------------------------
# calculator
# ----------------------------



def _get_child_data():
    data={}
    return data

def _build_q_from_node_path(node, *, jsonb_field="data"):
    q = Q()
    for p in node.get("path", []):
        attr = p["attribute"]
        val = p["value"]
        q &= Q(**{f"{jsonb_field}__{attr}": val})
    return q

def _compute_node_counts(
    case_id,
    pp_metadata_id,
    selected_ids,
    jsonb_field="data",
    client_flag_key="is_client",
):
    """
    Computes sku_count and client_sku_count for the ROOT node.

    Counts are derived from PreprocessedSkuSelection:
      - sku_count = number of selected SKUs
      - client_sku_count = number of selected SKUs where data__is_client == True
    """

    base_qs = PreprocessedSkuSelection.objects.filter(
        case_id=case_id,
        pp_metadata_id=pp_metadata_id,
        id__in=selected_ids,
    )

    sku_count = base_qs.count()

    client_sku_count = base_qs.filter(build_client_flag_q(jsonb_field, client_flag_key)).count()

    return sku_count, client_sku_count


def _calculate_partition_tree(case_id: UUID, partition_id: UUID, params: Dict[str, Any]) -> Dict[str, Any]:

    run_id = uuid.uuid4().hex
    t_total = Timer()

    log_event("partition_tree.start",
        run_id=run_id,
        case_id=str(case_id),
        partition_id=str(partition_id),
        node_id=params.get("node_obj", {}).get("id"),
    )

    partition = get_partition(case_id, partition_id)
    ppm = partition.ppm
    try:
        wf = Workflow.objects.get(case_id=case_id, partition_id=partition_id, is_deleted=False)
    except ObjectDoesNotExist:
        raise ValueError("wf does not exist")
    data = wf.data or {}
    steps = data.get("steps", {})
    selected_ids = steps.get('sku_selection', {}).get('result', {}).get('selected_ids', []) or []
    sku_count,client_sku_count = _compute_node_counts(case_id,ppm,selected_ids)

    temp_node={
        "id": None, # str (uuid hex) - stable identifier
        "parent_id": None, # str | None
        "type":"root", # "root" | "attribute" | "value" - used for the query building and deciding is_clickable
        "level":0,  # int (root=0, increments down the tree, each attribute expanded will increase the level; values of attribute will have the same level)
        "branch": None, # str | None - for display
        # Track the Partition Name (e.g. Branded X Premium x Medium) for root, branch will be "node_name"
        "path" : [], # list of {"attribute": ..., "value": ...}
        "attribute":None,  # str | None
        # For attribute nodes: attribute="Brand"
        # For value nodes: attribute="Brand" (so value nodes know which attr they belong to)
        "value": None,
        # Only for value nodes: value="Brand Name 1"
        "sku_count": sku_count,  # int | None (count of SKUs in this partition/node)
        "client_sku_count": client_sku_count, # int | None
        "node_name": 'Shoppers Partition',
        "is_clickable": True, # bool (UI: can expand this node)
        "comments": None,
        "children": [] # list[Node]
    }

    node_obj = params.get("node_obj", temp_node) or temp_node

    if node_obj["id"] is None:
        node_obj["id"]=uuid.uuid4().hex
        # node_obj["id"] = uuid.uuid5(uuid.NAMESPACE_DNS,f"NODE::{case_id}::{partition_id}::{node_obj['path']}")
        result = {
            "tree": node_obj,
            "calculated_at": timezone.now().isoformat(),
        }
    else:
        '''Optimization-1'''
        # base_math_data = steps.get('base_math', {}).get('result', {}) or {}
        '''Optimization - 1 - END'''
        '''Optimization-2'''
        basemath_ppm_id = getattr(ppm, "id", None)
        # base_math = _call_db_get_joined(
        #     case_id=case_id,
        #     partition=partition,
        #     basemath_ppm_id=basemath_ppm_id,
        #     selected_ids=selected_ids,
        #     view_type='MATRIX'
        # ) #returns List of SKUs in Ordered Dict
        '''Optimization-2-END'''

        '''Optimization-1'''
        # base_math_data=merged_list_to_df_like(base_math)
        '''Optimization - 1 - END'''
        '''Optimization-2'''
        # cal_base_testing_res = _calculate_base_testing(case_id, node_obj, selected_ids, base_math,partition.ppm_id,ppm.att_dataset_id,ppm.cp_dataset_id)
        '''Optimization - 2 - END'''

        t_bt = Timer()
        rows = (params or {}).get("attrs_list", {}).get("rows", []) or []
        attributes_list = [r[1] for r in rows if r and len(r) > 1 and bool(r[0])]
        cal_base_testing_res = _calculate_base_testing(run_id,case_id,partition_id, node_obj,attributes_list, selected_ids, partition.ppm_id,
                                                       ppm.att_dataset_id, ppm.cp_dataset_id,basemath_ppm_id)
        log_event("base_testing.done",
            run_id=run_id,
            duration_ms=t_bt.ms(),
            df_long_rows=len(cal_base_testing_res["df_long"]),
            sku_rows=len(cal_base_testing_res["df_sku_list"]),
        )
        t_lt = Timer()
        level_testing = _run_level_testing_for_all_pairs(run_id,cal_base_testing_res["df_long"],cal_base_testing_res["df_sku_list"],cal_base_testing_res["base_testing_results"])
        log_event("level_testing.done",
            run_id=run_id,
            duration_ms=t_lt.ms(),
        )
        result = {
            "base_testing": cal_base_testing_res['result'],
            "level_testing":level_testing,
            "sku_list": cal_base_testing_res['sku_list_json'],
            "attributes_for_test": params["attrs_list"],
            "calculated_at": timezone.now().isoformat(),
        }
        log_event("partition_tree.done",
            run_id=run_id,
            duration_ms=t_total.ms(),
        )

    return result


register_step_calculator('partition_tree', _calculate_partition_tree)
# sample_json={
#     "node_obj": {
#         "id": "03b07a0290c840a4a3f63ea7f21aec4e",
#         "path": [],
#         "type": "root",
#         "level": 0,
#         "value": None,
#         "branch": None,
#         "children": [],
#         "comments": None,
#         "attribute": None,
#         "node_name": "Shoppers Partition",
#         "parent_id": None,
#         "sku_count": 803,
#         "is_clickable": True,
#         "client_sku_count": 130
#     }
# }
# final_return = _calculate_partition_tree("437f8314-5562-4393-af8e-6accb61ac945","77bc76c9-1648-4365-b09c-d6942f8e96af",sample_json)
# print(final_return)
