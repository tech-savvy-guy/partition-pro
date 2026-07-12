# reports/views/workflow_api_views.py
import json
from django.core.cache import cache

from django.core.exceptions import ObjectDoesNotExist
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from celery.result import AsyncResult
from ..models import Workflow, PreprocessedSkuSelection, RawAttributesData, WorkingAttributesData
from ..redis_client import get_redis_client
from ..services.workflow.base import get_partition
from ..services.workflow.compute_attributes_and_skus import compute_attributes_and_skus
from ..services.workflow.obm import update_obm
from ..services.workflow.processes import PROCESS_WORKFLOW
from ..services.workflow.progress import workflow_progress_key, partition_tree_progress_key, publish_progress, \
    clear_workflow_progress
from ..tasks import process_workflow_task, process_partition_tree_task, compute_obm, compute_virtual_rollup_task
from ..services.workflow.shared_utils import find_node_by_id, update_children_by_id_append, _qs_json_to_df, \
    make_attribute_node, make_value_node, has_attribute_child, clear_node_children, get_filtered_attribute_rows, \
    _get_attribute_base_cols, client_flag_mask, client_skus_from_selection_df
from ..services.workflow.virtual_rollup import normalize_grouping_spec
import logging
logger = logging.getLogger(__name__)

def _selected_attributes(attrs_list_obj: dict | None) -> list[str]:
    rows = (attrs_list_obj or {}).get("rows", []) or []
    return [str(r[1]) for r in rows if r and len(r) > 1 and bool(r[0])]


def _cached_selected_attributes(cached_payload: dict) -> list[str]:
    result = (cached_payload or {}).get("data", {}) or {}
    return _selected_attributes(result.get("attributes_for_test") or {})


class RunWorkflowStepView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, case_id, partition_id, process_name: str):
        params = request.data or {}
        async_res={id:None}
        if process_name=='process_workflow':
            try:
                clear_workflow_progress(case_id, partition_id)
            except Exception:
                # If Redis is down, ignore; DB is source of truth anyway
                pass
            async_res = process_workflow_task.delay(str(case_id), str(partition_id), str(request.user), params)
        elif process_name=='process_partition_tree':
            client = get_redis_client()
            key = partition_tree_progress_key(str(case_id), str(partition_id), str(params.get("node_obj",{}).get("id","") or ""))
            cached = client.get(key)
            if cached is not None:
                try:
                    cached_payload = json.loads(cached)
                except Exception:
                    cached_payload = None

                requested_attrs = _selected_attributes(params.get("attrs_list") or {})
                cached_attrs = _cached_selected_attributes(cached_payload or {})

                if cached_payload is not None and cached_attrs == requested_attrs:
                    cached_status = str(cached_payload.get("status") or "").upper()
                    if cached_status == "COMPLETED":
                        return Response({"data": cached_payload, "status": "COMPLETED"}, status=status.HTTP_202_ACCEPTED)
                    if cached_status in {"RUNNING", "QUEUED"}:
                        return Response({"data": cached_payload, "status": cached_status}, status=status.HTTP_202_ACCEPTED)

                try:
                    client.delete(key)
                except Exception:
                    pass
            async_res = process_partition_tree_task.delay(str(case_id), str(partition_id), str(request.user), params)
        return Response({"task_id": async_res.id, "status": "QUEUED"}, status=status.HTTP_202_ACCEPTED)


class WorkflowStatusView(APIView):
    """
    GET /api/reports/workflows/<case_id>/<partition_id>
    Returns Workflow row including data(status/progress/result).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, case_id, partition_id):
        # ---- 1) Try Redis (fast path) ----
        try:
            client = get_redis_client()
            key = workflow_progress_key(str(case_id), str(partition_id))
            val = client.get(key)
            if val:
                try:
                    payload = json.loads(val)
                except Exception:
                    payload = {"status": "REDIS_BAD_PAYLOAD"}

                # if payload.get("include_db") is True:
                #     wf = Workflow.objects.get(case_id=case_id, partition_id=partition_id, is_deleted=False)
                #     payload.setdefault("workflow_status", wf.status)
                #     payload.setdefault("data", (wf.data or {}))
                return Response(payload, status=status.HTTP_200_OK)

        except Exception:
            # Redis down/timeout/etc -> ignore and fall back to DB
            pass

        # ---- 2) DB fallback ----
        try:
            wf = Workflow.objects.get(case_id=case_id, partition_id=partition_id, is_deleted=False)
        except ObjectDoesNotExist:
            return Response(
                {"status": "NOT_FOUND", "case_id": str(case_id), "partition_id": str(partition_id)},
                status=status.HTTP_404_NOT_FOUND,
            )

        data = wf.data or {}
        steps = data.get("steps", {})

        # Provide a consistent response shape to the UI
        return Response(
            {
                "status": wf.status or "UNKNOWN",
                "workflow_status": wf.status,
                "case_id": str(case_id),
                "partition_id": str(partition_id),
                "execution_number": getattr(wf, "execution_number", None),
                "data": steps,  # includes completed step results
                "source": "db",
            },
            status=status.HTTP_200_OK,
        )
        # client = get_redis_client()
        # key = workflow_progress_key(str(case_id), str(partition_id))
        # try:
        #     val = client.get(key)
        # except Exception as e:
        #     print(e)
        # if not val:
        #     return Response({"status": "NO_PROGRESS"}, status=status.HTTP_200_OK)
        # return Response(json.loads(val), status=status.HTTP_200_OK)

class UpdatedPartitionTreeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _load_tree_context(self, case_id, partition_id, node_id):
        try:
            wf = Workflow.objects.get(
                case_id=case_id,
                partition_id=partition_id,
                is_deleted=False,
            )
        except ObjectDoesNotExist:
            return Response(
                {"status": "NOT_FOUND", "case_id": case_id, "partition_id": partition_id},
                status=status.HTTP_404_NOT_FOUND,
            )

        data = wf.data or {}
        partition_data = data.setdefault("steps", {}).setdefault("partition_tree", {}).setdefault("result", {})
        existing_partition_tree = partition_data.get('tree', {}) or {}
        # this is not exactly parent node - it is the node itself with matching id
        parent_node = find_node_by_id(existing_partition_tree, node_id)
        if parent_node is None:
            return Response(
                {"success": False, "error": f"node_id={node_id} not found"},
                status=status.HTTP_400_BAD_REQUEST
            )

        return {
            "workflow": wf,
            "partition": get_partition(case_id, partition_id),
            "data": data,
            "partition_data": partition_data,
            "existing_partition_tree": existing_partition_tree,
            "parent_node": parent_node,
        }

    def _queue_obm_refresh(self, wf, case_id, partition_id, updated_tree, user_identifier):
        data = wf.data or {}
        data.setdefault("steps", {}).setdefault("partition_obm", {}).setdefault("result", {})
        data["steps"]["partition_obm"]["status"] = "Processing"
        wf.data = data
        wf.save()

        async_res = compute_obm.delay(str(case_id), str(partition_id), str(user_identifier), updated_tree)
        publish_progress(case_id, partition_id, {
            "process": PROCESS_WORKFLOW.name,
            "status": "COMPLETED",
            "percent": 100.0,
            "step_number": wf.step_number,
            "data": (wf.data or {}),
        })
        return async_res

    def post(self, request, case_id, partition_id, node_id):
        params = request.data or {}
        attribute_name = (params.get("attribute_name") or "").strip()

        if not attribute_name:
            return Response(
                {"status": False, "error": "attribute_name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        context = self._load_tree_context(case_id, partition_id, node_id)
        if isinstance(context, Response):
            return context

        wf = context["workflow"]
        partition = context["partition"]
        data = context["data"]
        existing_partition_tree = context["existing_partition_tree"]
        parent_node = context["parent_node"]
        steps = data.setdefault("steps", {})
        selected_ids = steps.get('sku_selection', {}).get('result', {}).get('selected_ids', []) or []
        df_sel = _qs_json_to_df(
            PreprocessedSkuSelection.objects.filter(
                case_id=case_id,
                pp_metadata_id=partition.ppm_id,
                id__in=selected_ids,
            ),
            base_cols=("id", "case_id", "pp_metadata_id"),
        )
        if "skuname_ean" not in df_sel.columns:
            return Response(
                {"success": False, "error": "preprocessed_sku_selection.data must contain 'skuname_ean'"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        selected_skus = set(df_sel["skuname_ean"].astype(str).tolist())
        selected_client_skus = client_skus_from_selection_df(df_sel)

        if has_attribute_child(parent_node,attribute_name):
            return Response(
                {
                    "success": False,
                    "error": f"This parent node already has an attribute child with the {attribute_name}."
                },
                status=status.HTTP_403_FORBIDDEN
            )
        else:
            clear_node_children(parent_node)
            attr_node = make_attribute_node(parent_node, node_id, attribute_name)

        try:
            qs_attr = get_filtered_attribute_rows(
                node=parent_node,
                case_id=case_id,
                partition_id=partition_id,
                metadata_id=partition.ppm.att_dataset_id,
            )
            df_attr = _qs_json_to_df(
                qs_attr,
                base_cols=_get_attribute_base_cols(qs_attr),
            )
            value_counts = {}
            client_counts = {}
            if not df_attr.empty:
                if "skuname_ean" not in df_attr.columns:
                    return Response(
                        {"success": False, "error": "attribute data must contain 'skuname_ean'"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if attribute_name in df_attr.columns:
                    df_attr = df_attr[df_attr["skuname_ean"].astype(str).isin(selected_skus)]
                    if not df_attr.empty:
                        df_attr = df_attr[df_attr[attribute_name].notna()].copy()
                        df_attr[attribute_name] = df_attr[attribute_name].astype(str)
                        value_counts = (
                            df_attr.groupby(attribute_name)["skuname_ean"]
                            .size()
                            .to_dict()
                        )
                        if selected_client_skus:
                            client_counts = (
                                df_attr[df_attr["skuname_ean"].astype(str).isin(selected_client_skus)]
                                .groupby(attribute_name)["skuname_ean"]
                                .size()
                                .to_dict()
                            )
                        elif "is_client" in df_attr.columns and "is_client" not in df_sel.columns:
                            client_counts = (
                                df_attr[client_flag_mask(df_attr["is_client"])]
                                .groupby(attribute_name)["skuname_ean"]
                                .size()
                                .to_dict()
                            )

            for val in sorted(value_counts.keys()):
                sku_count = int(value_counts.get(val, 0))
                if sku_count == 0:
                    continue
                v_node = make_value_node(attr_node, attr_node["id"], attribute_name, str(val))
                v_node["sku_count"] = sku_count
                v_node["client_sku_count"] = int(client_counts.get(val, 0))
                attr_node["children"].append(v_node)

            updated_tree, updated_status = update_children_by_id_append(
                existing_partition_tree,
                target_id=node_id,
                new_child=attr_node,
            )

            if not updated_status:
                return Response(
                    {"status": False, "error": "failed to update tree"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                context["partition_data"]["tree"] = updated_tree
                async_res = self._queue_obm_refresh(wf, case_id, partition_id, updated_tree, request.user)

            return Response(
                {"success": True, "data": wf.data, "task_id": async_res.id, "status": "QUEUED"},
                status=status.HTTP_202_ACCEPTED
            )

        except Exception:
            logger.exception(
                    "select-attribute failed: case_id=%s ppm_id=%s attr=%s selected_ids_count=%s",
                    case_id, partition.ppm_id, attribute_name, len(selected_ids)
                )
            raise

    def delete(self, request, case_id, partition_id, node_id):
        context = self._load_tree_context(case_id, partition_id, node_id)
        if isinstance(context, Response):
            return context

        wf = context["workflow"]
        parent_node = context["parent_node"]
        updated_tree = context["existing_partition_tree"]

        if not (parent_node.get("children") or []):
            return Response(
                {"success": True, "data": wf.data, "message": "node has no children to remove"},
                status=status.HTTP_200_OK
            )

        clear_node_children(parent_node)
        context["partition_data"]["tree"] = updated_tree
        async_res = self._queue_obm_refresh(wf, case_id, partition_id, updated_tree, request.user)

        return Response(
            {"success": True, "data": wf.data, "task_id": async_res.id, "status": "QUEUED"},
            status=status.HTTP_202_ACCEPTED
        )

    def get(self, request, case_id, partition_id, node_id):
        try:
            client = get_redis_client()
            key = partition_tree_progress_key(str(case_id), str(partition_id), str(node_id))
            try:
                val = client.get(key)
            except Exception as e:
                print(e)
            if not val:
                return Response({"status": "NO_PROGRESS"}, status=status.HTTP_200_OK)
            return Response(json.loads(val), status=status.HTTP_200_OK)
        except Exception as ex:
            print(ex)
            return Response({"status": "FAILED"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class NodeAttributeAndSkusView(APIView):
    '''
    STEP - 1: Check Redis basis the CaseID,PartitionID,NodeID if the result is there or not
    STEP -2: If not there we call our function get_attributes_sku_list and pass on the params and above details
    STEP 2.1: We do node and SKU Filtering to get to our final SKU SET and the attributes
    STEP 1.2: Cache the result generated
    '''
    """
    POST /api/reports/workflows/<case_id>/<partition_id>/

    Returns:
      - attributes_table
      - sku_table
    Both in rows+columns format.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, case_id, partition_id):
        params = request.data or {}
        node_obj = params.get("node_obj") or {}
        node_id = node_obj.get("id")

        if not node_id:
            return Response(
                {"success": False, "error": "node_obj.id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client = get_redis_client()
        key = partition_tree_progress_key(str(case_id), str(partition_id),
                                          str(params.get("node_obj", {}).get("id", "") or ""))
        cached = client.get(key)
        if cached is not None:
            return Response({"data": json.loads(cached), "status": "COMPLETED"}, status=status.HTTP_202_ACCEPTED)

        # STEP-2: Compute
        try:
            payload = compute_attributes_and_skus(case_id, partition_id, node_obj)
        except ValueError as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # # STEP-3: Cache
        # cache_set(case_id, partition_id, node_id, payload, ttl_seconds=300)

        return Response(payload, status=status.HTTP_200_OK)


class VirtualRollupPreviewView(APIView):
    """
    POST: Enqueue async virtual roll-up preview computation.
    
    Request:
    {
        "node_id": "node_123_abc",
        "attribute_name": "brand_tier",
        "new_grouping_spec": {
            "Mainstream": ["Value", "Mid Tier"],
            "Premium": ["Premium"]
        }
    }
    
    Returns (202 Accepted):
    {
        "status": "queued",
        "task_id": "celery-task-uuid",
        "polling_url": "/api/reports/workflows/<case_id>/<partition_id>/preview-rollup-status/<task_id>/"
    }
    """
    
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, case_id, partition_id):
        case_id = str(case_id)
        partition_id = str(partition_id)
        
        # Extract parameters
        node_id = request.data.get('node_id')
        attribute_name = request.data.get('attribute_name')
        new_grouping_spec = request.data.get('new_grouping_spec')
        grouping_labels = request.data.get('grouping_labels')
        
        # Validate inputs
        if not node_id or not attribute_name or new_grouping_spec is None:
            return Response(
                {"error": "missing_fields", "required": ["node_id", "attribute_name", "new_grouping_spec"]},
                status=status.HTTP_400_BAD_REQUEST
            )
        if grouping_labels is not None and not isinstance(grouping_labels, dict):
            return Response(
                {"error": "invalid_grouping_labels", "detail": "grouping_labels must be an object/dictionary"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            normalized_grouping_spec = normalize_grouping_spec(
                new_grouping_spec,
                grouping_labels=grouping_labels,
            )
        except ValueError as exc:
            return Response(
                {"error": "invalid_new_grouping_spec", "detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Enqueue async task
        task = compute_virtual_rollup_task.delay(
            case_id,
            partition_id,
            node_id,
            attribute_name,
            normalized_grouping_spec,
            None,
        )
        
        return Response({
            "status": "queued",
            "task_id": task.id,
            "polling_url": f"/api/reports/workflows/{case_id}/{partition_id}/preview-rollup-status/{task.id}/"
        }, status=status.HTTP_202_ACCEPTED)


class VirtualRollupStatusView(APIView):
    """
    GET: Poll for virtual roll-up preview computation status and results.
    
    Returns:
    - If processing: {
        "status": "processing",
        "task_id": "celery-task-uuid"
    }
    
    - If completed: {
        "status": "completed",
        "result": {...preview_result...}
    }
    
    - If failed: {
        "status": "failed",
        "error": "error message"
    }
    """
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, case_id, partition_id, task_id):
        task_result = AsyncResult(task_id)
        
        if task_result.ready():
            # Task completed
            if task_result.successful():
                return Response({
                    "status": "completed",
                    "result": task_result.result,
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    "status": "failed",
                    "error": str(task_result.info),
                }, status=status.HTTP_200_OK)
        else:
            # Still running
            return Response({
                "status": "processing",
                "task_id": task_id,
            }, status=status.HTTP_202_ACCEPTED)
