export type CaseStatus = "Active" | "Closed" | "Paused";

export type TagType = "green" | "red" | "gray";

export type Case = {
  id: string;
  name: string;
  code: string;
  status: CaseStatus;
  category: string;
  createdOn: string; // ISO string
  createdBy: string;
  tenantId: string;
  userCaseRole?: string | null;
  updatedOn?: string | null;
  description?: string;
  endDate?: string | null;
  isPreprocessed: boolean;
  finalAnswerId?: string;
};

export type CaseRow = {
  id: string; // case id
  caseName: string; // "US-Sun-Refresh"
  caseCode: string;
  createdBy: string; // "Rajat Dhiman"
  start: string; // "19-11-25"
  end: string; // "-" or a date
  description: string; // "Caveats"
  status: CaseStatus;
  isPreprocessed: boolean;
  finalAnswerId?: string;
  userCaseRole?:string;
};

/** ===== Cases list ===== */
export type BackendCase = {
  id: string;
  case_name: string;
  case_code: string;

  description?: string;

  methodology?: string;
  requested_by?: string;

  case_manager?: string;
  nps_contact?: string;

  product_type?: string | null;

  category: string;
  end_date?: string | null;

  status: string;
  tenant_id: string;

  created_on: string;
  created_by: string;

  user_case_role: string | null;
  is_archived?: boolean;

  updated_on?: string | null;

  is_preprocessed?: boolean;

  final_answer?: string;
};

export type GetCasesResponse = {
  results: BackendCase[];
};

/** ===== Create / Update Case ===== */
export type CreateCasePayload = {
  caseName: string;
  methodology: string;
  caseCode: string;
  requestedBy: string;
  caseManager: string;
  npsContact: string;
  category: string;
  description: string;
  status?: string;
  productType?: string;
  tags?: Record<string, any>;
  endDate?: string | null;
  finalAnswer?: string;
};

export type CreateCaseResponse = {
  success: boolean;
  id: string;
  case_name: string;
};

/** ===== Assignments ===== */
export type BackendAssignment = {
  assignment_id: string;
  user_id: string;
  name: string;
  email: string;
  role: string; // "PUBLISHER" | "EDITOR" | "VIEWER"
  created_on: string;
  created_by: string;
  tags: any;
};

export type GetAssignmentsResponse = {
  case_id: string;
  case_name: string;
  assignments: BackendAssignment[];
};

export type AssignUserPayload = {
  user_id: string;
  role: "PUBLISHER" | "EDITOR" | "VIEWER";
};

/** ===== Datasets ===== */
export type BackendDataset = {
  id: string;
  data_type: "POS" | "ATTRIBUTES" | "CROSSPURCHASE";
  version: number;
  file_name: string;
  blob_name: string;
  is_selected: boolean;
  status: string;
  created_on: string;
  created_by: string;
  tags: any;
};

export type GetDatasetsResponse = {
  case_id: string;
  datasets: BackendDataset[];
};

/** ===== Case Details ===== */
export type BackendCaseDetails = {
  id: string;
  case_name: string;
  case_code: string;
  methodology: string;
  requested_by: string;
  case_manager: string;
  nps_contact: string;
  status: string;
  product_type?: string | null;
  category: string;
  description: string;
  tags?: Record<string, any>;
  end_date?: string | null;
  tenant_id: string;
  created_on?: string | null;
  created_by?: string | null;
  updated_on?: string | null;
  updated_by?: string | null;
  is_archived?: boolean;
};

export type CaseDetailsDto = {
  id: string;
  caseName: string;
  caseCode: string;
  methodology: string;
  requestedBy: string;
  caseManager: string;
  npsContact: string;
  category: string;
  description: string;
  status: string;
  endDate?: string | null;
  productType?: string | null;
  tags?: Record<string, any>;
};

/** ===== Dataset Upload ===== */
export type DatasetDataType = "POS" | "ATTRIBUTES" | "CROSSPURCHASE";

export type DatasetUploadUrlResponse = {
  upload_url: string;
  blob_name: string;
  version: number;
  case_id: string;
  data_type: DatasetDataType;
};

export type DatasetConfirmUploadPayload = {
  file_name: string;
  blob_name: string;
  version: number;
  description?: string;
  file_size?: number;
};

export type DatasetUploadErrorResponse = {
  tags?: {
    columns_order?: Record<string, string[]>;
    error_message?: string;
    error_hint?: string;
  };
  detail?: string;
  error?: string;
};
