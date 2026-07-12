# reports/views/base_json_staging_view.py
import json
import hashlib
from typing import Any, Dict, Type, Optional

from django.db.models import QuerySet
from django.core.exceptions import ObjectDoesNotExist
from django.core.cache import cache

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from utilities.common_functions import apply_dynamic_json_filters, cursor_paginate, offset_paginate
from ..serializers.dynamic_json_rows import DynamicJsonRowSerializer
from ..models import Partitions, Workflow


class JsonStagingTableView(APIView):
    """
    Base reusable view for staging tables with:
      - case_id, pp_metadata_id, data (JSON)
    """
    permission_classes = [IsAuthenticated]

    model: Type[Any] = None
    serializer_class = DynamicJsonRowSerializer
    base_fields = ("id", "case_id")
    cursor_field = "id"
    cache_timeout = 60  # seconds

    def get_model(self):
        if self.model is None:
            raise RuntimeError("JsonStagingTableView.model is not set")
        return self.model

    def _build_cache_key(self, case_id, partition_id, request) -> str:
        model_name = self.get_model().__name__
        params = request.query_params.dict()
        raw = f"{model_name}:{case_id}:{partition_id}:{sorted(params.items())}"
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        return f"staging:{model_name}:{digest}"

    # --------- main GET handler ----------

    def get(self, request, case_id, partition_id):
        cache_key = self._build_cache_key(case_id, partition_id, request)
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached, status=status.HTTP_200_OK)

        try:
            partition = Partitions.objects.get(
                id=partition_id,
                case_id=case_id,
                is_deleted=False,
            )
        except ObjectDoesNotExist:
            return Response(
                {"error": "Partition not found for this case"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not partition.ppm_id:
            return Response(
                {"error": "Partition has no ppm_id assigned yet"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1) base queryset
        qs = self.get_base_queryset(request, case_id, partition)

        # # 2) filters
        # qs = self.apply_filters(request, qs)

        # # 3) sort
        # qs = self.apply_sorting(request, qs)

        # 4) pagination mode
        pagination_mode = request.query_params.get("pagination", "none")
        per_page = int(request.query_params.get("per_page", 3000))

        pagination_meta = None

        if pagination_mode == "none":
            items = list(qs)
        elif pagination_mode == "cursor":
            cursor = request.query_params.get("cursor")
            items, pagination_meta = cursor_paginate(
                qs,
                per_page=per_page,
                cursor=cursor,
                cursor_field=self.cursor_field,
            )
        else:
            page = int(request.query_params.get("page", 1))
            items, pagination_meta = offset_paginate(
                qs,
                page=page,
                per_page=per_page,
            )

        # 5) serialize
        serializer = self.serializer_class(items, many=True)
        if hasattr(self.serializer_class, "base_fields"):
            serializer.child.base_fields = self.base_fields  # type: ignore

        rows = serializer.data

        if pagination_mode == "none":
            pagination_meta = {
                "mode": "none",
                "total_rows": len(rows),
            }

        # 6) dynamic columns
        columns = sorted({k for row in rows for k in row.keys()})

        # 7) workflow meta
        # workflow_meta = self.get_workflow_meta(case_id, partition_id)

        response_data = {
            "columns": columns,
            "rows": rows,
            "pagination": pagination_meta,
            "meta": {
                "case_id": str(case_id),
                "partition_id": str(partition_id),
                "ppm_id": str(partition.ppm_id),
                "pagination_mode": pagination_mode,
            },
            # "workflow_meta": workflow_meta,
        }

        cache.set(cache_key, response_data, timeout=self.cache_timeout)
        return Response(response_data, status=status.HTTP_200_OK)

    # hooks

    def get_base_queryset(self, request, case_id, partition) -> QuerySet:
        model = self.get_model()
        return model.objects.filter(
            case_id=case_id,
            pp_metadata_id=partition.ppm_id,
        )

    def apply_filters(self, request, qs: QuerySet) -> QuerySet:
        filters_param = request.query_params.get("filters")
        if not filters_param:
            return qs

        try:
            filters = json.loads(filters_param)
        except json.JSONDecodeError:
            return qs

        if not isinstance(filters, list):
            return qs

        return apply_dynamic_json_filters(qs, filters)

    def apply_sorting(self, request, qs: QuerySet) -> QuerySet:
        sort_col = request.query_params.get("sort")
        direction = request.query_params.get("direction", "asc")

        if not sort_col:
            order_field = self.cursor_field
        else:
            order_field = f"data__{sort_col}"

        if direction == "desc":
            order_field = f"-{order_field}"

        return qs.order_by(order_field)

    def get_workflow_meta(self, case_id, partition_id) -> Optional[Dict[str, Any]]:
        try:
            wf = Workflow.objects.get(
                case_id=case_id,
                partition_id=partition_id,
            )
        except Workflow.DoesNotExist:
            return None

        return {
            "id": str(wf.id),
            "step_number": wf.step_number,
            "status": wf.status,
            "data": wf.data,
        }
