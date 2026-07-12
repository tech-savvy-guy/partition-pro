import type { WorkflowNodeObject } from "./tree.types";

export type NotificationVariant = "default" | "success" | "error" | "info";

export type RunNodeInfo = {
  nodeId: string;
  nodeName?: string;
  /** Full backend node object (id, path, level, ...) when resolvable. */
  node?: WorkflowNodeObject;
};

export type PartitionTreeWorkflowData = Record<string, unknown>;

export type PartitionTreePermissions = {
  canEdit?: boolean;
  canRunNode?: boolean;
  canUploadRollups?: boolean;
};

export type PartitionTreeProps = {
  caseId: string;
  partitionId: string;
  workflowData: PartitionTreeWorkflowData | null;
  partitionName?: string;
  readOnly?: boolean;
  permissions?: PartitionTreePermissions;
  onWorkflowDataPatch?: (payload: PartitionTreeWorkflowData) => void;
  onNotify?: (
    message: string,
    variant?: NotificationVariant,
    options?: { description?: string }
  ) => void;
  onRunNode?: (info: RunNodeInfo) => void;
};

export type PartitionTreeContextValue = {
  caseId: string;
  partitionId: string;
  permissions: Required<PartitionTreePermissions>;
  readOnly: boolean;
  notify: (
    message: string,
    variant?: NotificationVariant,
    options?: { description?: string }
  ) => void;
};

export type PartitionDatasetDataType = "GROUPING" | "rollup-sheet" | string;

export type PartitionDatasetUploadErrorResponse = {
  error?: string;
  detail?: string;
  hint?: string;
  message?: string;
  tags?: {
    error_message?: string;
    [key: string]: unknown;
  };
};
