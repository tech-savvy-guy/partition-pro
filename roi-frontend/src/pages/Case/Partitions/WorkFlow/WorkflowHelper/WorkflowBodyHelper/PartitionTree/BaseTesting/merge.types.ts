export type MergePreviewStatus =
  | "idle"
  | "submitting"
  | "polling"
  | "ready"
  | "error";

export type PreviewRollupRequest = {
  node_id: string;
  attribute_name: string;
  new_grouping_spec: Record<string, string[]>;
};

export type PreviewRollupStatusResponse = any;

export type BaseTestingPreviewItem = {
  attribute?: string;
  attribute_id?: number | string;
  base_result?: boolean | string;
  n_total?: number;
  columns?: any[];
  rows?: any[];
  [key: string]: any;
};

export type BaseTestingPreviewResult = {
  passed: boolean | string | null;
  edge_cases: any;
  items: BaseTestingPreviewItem[];
  raw: any;
};

export type AttributeMergeState = {
  attributeName: string;
  nodeId: string;
  groups: string[][];
  previewId?: string;
  status: MergePreviewStatus;
  result?: BaseTestingPreviewResult;
  error?: string;
};
