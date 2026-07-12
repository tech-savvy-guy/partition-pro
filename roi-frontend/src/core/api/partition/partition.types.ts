/** ===== Backend DTOs ===== */
export type BackendPartition = {
  id: string;
  partition_name: string;
  description: string;
  status: string;
  end_date?: string | null;
  created_on?: string | null;
  is_shared: boolean;
  created_by: string;
  base_partition?: { id: string; partition_name: string } | null;
};

export type GetPartitionsResponse = {
  case_id: string;
  case_name: string;
  partitions: BackendPartition[];
};

/** ===== Create Partition ===== */
export type CreatePartitionPayload = {
  partitionName: string;
  description: string;
  basePartitionId?: string | null;
  status?: string;     // backend expects string
  stepStatus?: string; // backend expects string
};

export type CreatePartitionResponse = {
  success: boolean;
  partition: any;
  message: string;
};
export type SharePartitionResponse = {
  success: boolean;
  message: string;
  partition_id: string;
  is_shared: boolean;
};

export type ClosePartitionResponse = {
  success: boolean;
  message: string;
  partition_id: string;
  status: string;
  end_date: string | null;
};
export type PartitionLockResponse = {
  acquired: boolean;
  locked_by_name?: string | null;
  lock_expires_at?: string | null;
};

export type PartitionUnlockResponse = {
  unlocked: boolean;
};

export type PartitionDatasetDataType = "GROUPING";

export type PartitionDatasetUploadUrlResponse = {
  upload_url: string;
  blob_name: string;
  version: number;
  warning?: string | null;
  view_url?: string | null;
};

export type PartitionDatasetConfirmUploadPayload = {
  file_name: string;
  blob_name: string;
  version: number;
  file_size?: number;
};

export type PartitionDatasetUploadErrorResponse = {
  tags?: {
    columns_order?: Record<string, string[]>;
    error_message?: string;
    error_hint?: string;
  };
  detail?: string;
  error?: string;
  hint?: string;
};

export type PartitionDatasetConfirmUploadResponse = {
  success: boolean;
  message?: string;
  error?: string;
  hint?: string;
  dataset?: {
    id: string;
    status: string;
  };
};
