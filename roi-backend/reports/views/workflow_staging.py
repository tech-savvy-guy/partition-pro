from .base_json_staging import JsonStagingTableView
from ..models import PreprocessedSkuSelection,PreprocessedBaseMath
from ..serializers.dynamic_json_rows import DynamicJsonRowSerializer


class WorkflowSkuSelectionView(JsonStagingTableView):
    """
    Step 1: SKU selection staging table, with:
      - dynamic filters on any JSON key
      - choice of offset or cursor pagination
    """
    model = PreprocessedSkuSelection
    serializer_class = DynamicJsonRowSerializer
    base_fields = ("id", "case_id", "pp_metadata_id")
    cursor_field = "id"

class WorkflowBaseMathView(JsonStagingTableView):
    """
        Step 2: Base Math staging table, with:
          - dynamic filters on any JSON key
          - choice of offset or cursor pagination
        """
    model = PreprocessedBaseMath
    serializer_class = DynamicJsonRowSerializer
    base_fields = ("id", "case_id", "pp_metadata_id")
    cursor_field = "id"