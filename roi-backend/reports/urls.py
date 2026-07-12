from django.urls import path

from reports.views.changelogs import ChangelogsView

from .views.cases import (
    CaseDetailsView,
    CaseAssignmentView,
)
from .views.partitions import PartitionCloseView, PartitionDetailsView, PartitionUnlockView
from .views.datasets import (DatasetBulkSelectView, DatasetUploadUrlView, DatasetConfirmUploadView,
                             DatasetListView, DatasetVersionsView,
                             DatasetActionsView, DatasetFileUrlView, PartitionDatasetUploadUrlView,
                             PartitionDatasetConfirmUploadView, PartitionDatasetListView, PartitionDatasetFileUrlView)
from .views.workflow_api_views import RunWorkflowStepView, WorkflowStatusView, UpdatedPartitionTreeView, \
    NodeAttributeAndSkusView, VirtualRollupPreviewView, VirtualRollupStatusView
from .views.workflow_staging import WorkflowSkuSelectionView, WorkflowBaseMathView

urlpatterns = [
    #changelogs
    path("changelogs", ChangelogsView.as_view(), name="changelogs"),
    path("changelogs/<uuid:changelog_id>/", ChangelogsView.as_view()),
     
    #cases
    path("cases", CaseDetailsView.as_view(), name="cases"),
    path("cases/<uuid:case_id>", CaseDetailsView.as_view(), name="case_update"),
    path("cases/<uuid:case_id>/assignments", CaseAssignmentView.as_view(), name="case_assign"),
    path("cases/<uuid:case_id>/assignments/role", CaseAssignmentView.as_view(), name="case_assign"),

    #partitions
    path("cases/<uuid:case_id>/partitions", PartitionDetailsView.as_view(), name="partitions"),
    path("cases/<uuid:case_id>/partitions/<uuid:partition_id>", PartitionDetailsView.as_view(), name="partition_item"),
    path("cases/<uuid:case_id>/partitions/<uuid:partition_id>/close", PartitionCloseView.as_view(), name="partition_close"),
    path("cases/<uuid:case_id>/partitions/<uuid:partition_id>/lock", PartitionDetailsView.as_view()),
    path("cases/<uuid:case_id>/partitions/<uuid:partition_id>/unlock", PartitionUnlockView.as_view()),

    # Dataset upload
    path("cases/<uuid:case_id>/datasets/<str:data_type>/upload-url", DatasetUploadUrlView.as_view(), name="dataset_upload_url"),
    path("cases/<uuid:case_id>/datasets/<str:data_type>/confirm", DatasetConfirmUploadView.as_view(), name="dataset_confirm_upload"),
    #  Dataset upload within a partition
    path("cases/<uuid:case_id>/partitions/<uuid:partition_id>/datasets/<str:data_type>/upload-url", PartitionDatasetUploadUrlView.as_view(), name="partition_dataset_upload_url"),
    path("cases/<uuid:case_id>/partitions/<uuid:partition_id>/datasets/<str:data_type>/confirm", PartitionDatasetConfirmUploadView.as_view(), name="partition_dataset_confirm_upload"),
    path("cases/<uuid:case_id>/partitions/<uuid:partition_id>/datasets", PartitionDatasetListView.as_view(), name="partition_dataset_list"),

    # Dataset listings
    path("cases/<uuid:case_id>/datasets", DatasetListView.as_view(), name="dataset_list"),
    path("cases/<uuid:case_id>/datasets/<uuid:dataset_id>", DatasetFileUrlView.as_view(), name="dataset_view"),
    path("cases/<uuid:case_id>/datasets/select", DatasetBulkSelectView.as_view(), name="dataset_bulk_select"),
    path("cases/<uuid:case_id>/datasets/<str:data_type>/versions", DatasetVersionsView.as_view(), name="dataset_versions"),
    path("cases/<uuid:case_id>/datasets/<str:data_type>/versions/<uuid:dataset_id>/select", DatasetActionsView.as_view(), name="dataset_select"),
    path("cases/<uuid:case_id>/partitions/<uuid:partition_id>/raw-datasets", DatasetActionsView.as_view(), name="dataset_mappings"),

    # Dataset listing within a partition
    path("cases/<uuid:case_id>/partitions/<uuid:partition_id>/datasets/<uuid:dataset_id>", PartitionDatasetFileUrlView.as_view(), name="partition_dataset_view"),

    path("cases/<uuid:case_id>/partitions/<uuid:partition_id>/sku-selection",WorkflowSkuSelectionView.as_view(),name="workflow_step1_sku_selection",),
    path("cases/<uuid:case_id>/partitions/<uuid:partition_id>/base-math",WorkflowBaseMathView.as_view(),name="workflow_step2_base_math",),

    path("workflows/<uuid:case_id>/<uuid:partition_id>/<str:process_name>/run",RunWorkflowStepView.as_view(),name="process-workflow",),
    #process-workflow/process-partition-tree
    path("workflows/<uuid:case_id>/<uuid:partition_id>/node/<str:node_id>", UpdatedPartitionTreeView.as_view(),name="poll-testings",),
    path("workflows/<uuid:case_id>/<uuid:partition_id>",WorkflowStatusView.as_view(),name="poll-workflow",),
    path("workflows/<uuid:case_id>/<uuid:partition_id>/node-attributes-skus", NodeAttributeAndSkusView.as_view(), name="fetch-skuList-attributes",),
    
    # Virtual roll-up preview endpoints
    path("workflows/<uuid:case_id>/<uuid:partition_id>/preview-rollup/", VirtualRollupPreviewView.as_view(), name="preview_virtual_rollup"),
    path("workflows/<uuid:case_id>/<uuid:partition_id>/preview-rollup-status/<str:task_id>/", VirtualRollupStatusView.as_view(), name="preview_virtual_rollup_status"),

]