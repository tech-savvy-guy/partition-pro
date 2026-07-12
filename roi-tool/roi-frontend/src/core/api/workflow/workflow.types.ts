export type StagingPaginationMeta = {
  mode?: "offset" | "cursor" | "none" | string;
  page?: number;
  per_page?: number;
  total_rows?: number;
  total_pages?: number;

  cursor?: string | null;
  next_cursor?: string | null;
  has_next?: boolean;
};

export type WorkflowMeta = {
  id: string;
  step_number: number;
  status: string;
  data: any;
};

export type WorkflowStagingResponse<Row extends Record<string, any> = Record<string, any>> = {
  columns: string[];
  rows: (Row & { id: string })[];
  pagination: StagingPaginationMeta | null;
  meta: {
    case_id: string;
    partition_id: string;
    ppm_id: string;
    pagination_mode: string;
  };
  workflow_meta: WorkflowMeta | null;
};

export type WorkflowStagingQueryParams = {
  pagination?: "offset" | "cursor" | "none";
  page?: number;
  per_page?: number;
  cursor?: string;

  sort?: string;
  direction?: "asc" | "desc";

  filters?: string; // JSON string list
};

export type RunWorkflowResponse = {
  task_id: string;
  status: string; // QUEUED
};

// This is intentionally loose because Redis payload can differ.
// We normalize it in frontend.
export type WorkflowStatusResponse = any;
