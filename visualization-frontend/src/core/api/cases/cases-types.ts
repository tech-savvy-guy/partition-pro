import type { AssignableUser } from "@/core/api/user/user.types"

export const CaseStatus = {
  Draft: "draft",
  Active: "active",
  Archived: "archived",
  Completed: "completed",
} as const

export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus]

export type CaseAssignment = {
  user: AssignableUser
  role: CaseAssignmentRole
}

export type Case = {
  id: string
  name: string
  code: string
  description: string
  methodology: string
  status: CaseStatus
  category: string
  tags: Record<string, unknown>
  is_archived: boolean
  is_deleted: boolean
  created_by: AssignableUser | null
  updated_by: AssignableUser | null
  created_at: string
  updated_at: string
  user_case_role: CaseAssignmentRole | null
  can_create_partitions: boolean
  assignments?: CaseAssignment[]
}

export type CreateCasePayload = {
  name: string
  code: string
  description: string
  methodology: string
  status: CaseStatus
  category: string
  tags: Record<string, unknown>
  assignments: CaseAssignmentPayload[]
}

export type UpdateCasePayload = Partial<
  Omit<CreateCasePayload, "assignments">
>

export const CaseAssignmentRole = {
  Publisher: "publisher",
  Editor: "editor",
  Viewer: "viewer",
} as const

export type CaseAssignmentRole =
  (typeof CaseAssignmentRole)[keyof typeof CaseAssignmentRole]

export type CaseAssignmentPayload = {
  user_id: string
  role: CaseAssignmentRole
}

export const PartitionStatus = {
  Draft: "draft",
  Active: "active",
  Archived: "archived",
} as const

export type PartitionStatus =
  (typeof PartitionStatus)[keyof typeof PartitionStatus]

export type Partition = {
  id: string
  case_id: string
  name: string
  description: string
  status: PartitionStatus
  is_shared: boolean
  is_deleted: boolean
  tags: Record<string, unknown>
  base_partition: string | null
  locked_by: string | null
  locked_by_display_name: string
  lock_expires_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type CreatePartitionPayload = {
  name: string
  description: string
  status: PartitionStatus
  is_shared: boolean
  tags: Record<string, unknown>
  base_partition: string | null
  locked_by: string | null
  lock_expires_at: string | null
}

export const DatasetType = {
  Pos: "pos",
  Attributes: "attributes",
  CrossPurchase: "cross_purchase",
} as const

export type DatasetType = (typeof DatasetType)[keyof typeof DatasetType]

export const DatasetStatus = {
  Processing: "processing",
  Ready: "ready",
  Failed: "failed",
  Archived: "archived",
} as const

export type DatasetStatus = (typeof DatasetStatus)[keyof typeof DatasetStatus]

export type Dataset = {
  id: string
  case_id: string
  type: DatasetType
  version: number
  file_name: string
  file_size: string | null
  blob_name: string
  description: string
  status: DatasetStatus
  is_deleted: boolean
  is_selected: boolean
  tags: Record<string, unknown>
  created_by: AssignableUser | null
  created_at: string
  updated_at: string
}

export type CreateDatasetUploadPayload = {
  type: DatasetType
  file_name: string
  file_size: number
  content_type: string
  description: string
  tags: Record<string, unknown>
}

export type UpdateDatasetPayload = Partial<{
  description: string
  status: DatasetStatus
  is_selected: boolean
  tags: Record<string, unknown>
}>

export type DatasetUploadResponse = {
  dataset: Dataset
  upload_url: string
  blob_name: string
  expires_at: string
  headers: Record<string, string>
}

export type DatasetDownloadResponse = {
  dataset: Dataset
  download_url: string
  expires_at: string
}

export type SkuSelectionRow = {
  id: string
  [key: string]: unknown
}

export type SkuSelectionResponse = {
  columns: string[]
  rows: SkuSelectionRow[]
  selected_skus: string[]
  pagination: {
    mode: string
    total_rows: number
  }
  meta: {
    case_id: string
    partition_id: string
    source: string
    has_saved_selection: boolean
    dataset_ids: {
      pos: string | null
      attributes: string | null
      cross_purchase: string | null
    }
  }
}

export type UpdateSkuSelectionPayload = {
  selected_skus: string[]
}

export type VisualizationMetricName = "chi" | "phi"

export type VisualizationWorkflowStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "NOT_FOUND"

export type VisualizationTable = {
  columns: string[]
  rows: unknown[][]
  count: number
}

export type VisualizationMetricResult = {
  metadata?: Record<string, unknown>
  diagnostics?: VisualizationTable
  mds_2d?: VisualizationTable
  mds_3d?: VisualizationTable
  rep_overlap_matrix?: VisualizationTable
  roi_matrix?: VisualizationTable
}

export type VisualizationResult = {
  case_id: string
  partition_id: string
  metadata?: Record<string, unknown>
  metrics?: Partial<Record<VisualizationMetricName, VisualizationMetricResult>>
} & VisualizationMetricResult

export type RunVisualizationPayload = {
  metrics: VisualizationMetricName[]
  include_attributes: boolean
  include_roi_matrix: boolean
  random_state: number
}

export type VisualizationRunResponse = {
  status: VisualizationWorkflowStatus
  task_id?: string
  workflow_run_id?: string
  polling_url?: string
  result?: VisualizationResult
  error?: string
}

export type VisualizationStatusResponse = VisualizationRunResponse & {
  case_id?: string
  partition_id?: string
  percent?: number
}

export type VisualizationLatestResponse = {
  status: VisualizationWorkflowStatus
  case_id: string
  partition_id: string
  workflow_run_id?: string
  result?: VisualizationResult
  updated_on?: string
  message?: string
}

export type VisualizationMdsMetricsResponse = {
  status: VisualizationWorkflowStatus
  case_id: string
  partition_id: string
  workflow_run_id?: string
  metadata?: Record<string, unknown>
  diagnostics?: Partial<Record<VisualizationMetricName, VisualizationTable>>
  metrics?: Partial<Record<VisualizationMetricName, VisualizationMetricResult>>
  updated_on?: string
  message?: string
}

export type PartitionTreeWorkflowData = Record<string, unknown>

export type RunWorkflowResponse = {
  status?: string
  task_id?: string
  workflow_run_id?: string
  polling_url?: string
  result?: unknown
  data?: unknown
  error?: string
  message?: string
}

export type PartitionTreeNodeResponse = RunWorkflowResponse & {
  percent?: number
  progress?: number
  data?: Record<string, unknown>
}

export type AttributeValueCount = {
  sku_count: number
  client_count: number
}

/** value -> hex colour, e.g. { premium: "#D10001" } */
export type AttributeColorMap = Record<string, string>

/** attribute -> value -> hex colour, saved for a single node */
export type NodeAttributeColors = Record<string, AttributeColorMap>

export type PartitionTreeAttributeSelectionResponse = {
  attributes_for_test?: {
    columns: string[]
    rows: unknown[][]
  }
  /** Legacy shape consumed by the Attribute Selection tab: value -> client_count */
  attribute_values?: Record<string, Record<string, number>>
  /** Richer per-value counts for the visualization modal: value -> { sku_count, client_count } */
  attribute_value_counts?: Record<string, Record<string, AttributeValueCount>>
  /** attribute_name -> value -> saved hex colour for this node */
  attribute_colors?: NodeAttributeColors
  data?: unknown
  [key: string]: unknown
}

export type PartitionTreePreviewRollupPayload = {
  node_id: string
  attribute_name: string
  new_grouping_spec: Record<string, string[]>
}

export type PartitionTreePreviewRollupResponse = RunWorkflowResponse & {
  preview_id?: string
}

export type PartitionTreePreviewRollupStatusResponse = {
  status?: string
  base_testing_preview?: unknown
  result?: unknown
  data?: unknown
  error?: string
  message?: string
}

export type PartitionDatasetDataType = "GROUPING" | "rollup-sheet" | string

export type PartitionDatasetUploadUrlResponse = {
  upload_url: string
  blob_name: string
  version?: number
  warning?: string | null
  view_url?: string | null
  headers?: Record<string, string>
}

export type PartitionDatasetConfirmUploadPayload = {
  blob_name: string
  file_name: string
  file_size: number
  version?: number
}

export type PartitionDatasetConfirmUploadResponse = {
  success: boolean
  message?: string
  error?: string
  detail?: string
  hint?: string
}

export type PartitionDatasetDownloadResponse = {
  file_url: string
  blob_name?: string
  case_id?: string
  partition_id?: string
}

export type PartitionDatasetsResponse = {
  success?: boolean
  case_id?: string
  partition_id?: string
  partition_name?: string
  datasets?: Array<Record<string, unknown>>
}

export type DatasetPreviewUrlResponse = {
  dataset: Dataset
  preview_url: string
  expires_at: string
}

// Parsed, client-side preview shape consumed by the UI.
export type DatasetPreview = {
  columns: string[]
  rows: Record<string, string | number | null>[]
}
