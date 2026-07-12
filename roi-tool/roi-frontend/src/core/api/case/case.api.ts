import { Endpoints } from "@/core/config";
import { http } from "../http";
import {
  Case,
  CaseStatus,
  BackendCase,
  GetCasesResponse,
  CreateCasePayload,
  CreateCaseResponse,
  CaseDetailsDto,
  GetAssignmentsResponse,
  AssignUserPayload,
  GetDatasetsResponse,
  DatasetDataType,
  DatasetUploadUrlResponse,
  DatasetConfirmUploadPayload,
} from "./case.types";

export type ViewDatasetResponse = {
  file_url: string;
  blob_name: string;
  case_id: string;
};

export const CaseApi = {
  getAll: async (params?: {
    status?: string;
    case_id?: string;
    is_archived?: boolean;
  }): Promise<Case[]> => {
    const res = await http.get<GetCasesResponse>(Endpoints.cases.list, params);

    return res.results.map((c: BackendCase) => ({
      id: c.id,
      name: c.case_name,
      code: c.case_code,
      status: c.status as CaseStatus,
      category: c.category,
      tenantId: c.tenant_id,
      createdOn: c.created_on,
      updatedOn: c.updated_on ?? null,
      createdBy: c.created_by,
      userCaseRole: c.user_case_role,
      description: c.description,
      endDate: c.end_date ?? null,
      productType: (c as any).product_type ?? null,
      isPreprocessed: c.is_preprocessed ?? false,
      finalAnswerId: c.final_answer,
    }));
  },

  getCaseDetails: async (caseId: string): Promise<CaseDetailsDto> => {
    const res = await http.get<GetCasesResponse>(Endpoints.cases.list, {
      case_id: caseId,
    });

    const c = res.results?.[0];
    if (!c) throw new Error("Case not found");

    return {
      id: c.id,
      caseName: c.case_name,
      caseCode: c.case_code,
      methodology: (c as any).methodology ?? "",
      requestedBy: (c as any).requested_by ?? "",
      caseManager: (c as any).case_manager ?? "",
      npsContact: (c as any).nps_contact ?? "",
      category: c.category ?? "",
      description: c.description ?? "",
      status: c.status ?? "",
      endDate: (c as any).end_date ?? null,
      tags: (c as any).tags ?? undefined,
    };
  },

  updateCaseDetails: async (caseId: string, payload: CreateCasePayload) => {
    return http.put<{ success: boolean; message: string }>(
      Endpoints.cases.update(caseId),
      {
        case_name: payload.caseName,
        methodology: payload.methodology,
        case_code: payload.caseCode,
        requested_by: payload.requestedBy,
        case_manager: payload.caseManager,
        nps_contact: payload.npsContact,
        category: payload.category,
        description: payload.description,
        status: payload.status,
        product_type: payload.productType,
        tags: payload.tags,
        end_date: payload.endDate,
        final_answer: payload.finalAnswer,
      }
    );
  },

  getById: (id: string) => http.get<Case>(Endpoints.cases.byId(id)),

  update: (id: string, payload: Partial<Case>) =>
    http.put<Case>(Endpoints.cases.update(id), payload),

  delete: (id: string) => http.delete<void>(Endpoints.cases.delete(id)),

  createCaseDetails: (tenantId: string, payload: CreateCasePayload) =>
    http.post<CreateCaseResponse>(Endpoints.cases.create, {
      case_name: payload.caseName,
      methodology: payload.methodology,
      case_code: payload.caseCode,
      requested_by: payload.requestedBy,
      case_manager: payload.caseManager,
      nps_contact: payload.npsContact,
      category: payload.category,
      description: payload.description,
      tenant_id: tenantId,
      status: payload.status,
      product_type: payload.productType,
      tags: payload.tags,
      end_date: payload.endDate,
    }),

  getAssignments: (caseId: string) =>
    http.get<GetAssignmentsResponse>(Endpoints.cases.assignments(caseId)),

  assignUser: (caseId: string, payload: AssignUserPayload) =>
    http.post<{ success: boolean; message: string }>(
      Endpoints.cases.assignments(caseId),
      payload
    ),

  getDatasets: (caseId: string) =>
    http.get<GetDatasetsResponse>(Endpoints.datasets.listByCase(caseId)),

  removeUser: (caseId: string, userId: string) =>
    http.delete<{ success: boolean; message: string }>(
      Endpoints.cases.assignments(caseId),
      { user_id: userId }
    ),

  updateUserRole: (caseId: string, payload: AssignUserPayload) =>
    http.put<{ success: boolean; message: string }>(
      Endpoints.cases.assignmentRole(caseId),
      payload
    ),

  getDatasetUploadUrl: (
    caseId: string,
    dataType: DatasetDataType,
    fileName: string
  ) =>
    http.post<DatasetUploadUrlResponse>(
      Endpoints.datasets.uploadUrl(caseId, dataType),
      { file_name: fileName }
    ),

  uploadToBlob: async (uploadUrl: string, file: File): Promise<void> => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Blob upload failed (${res.status}). ${txt}`);
    }
  },

  confirmDatasetUpload: (
    caseId: string,
    dataType: DatasetDataType,
    payload: DatasetConfirmUploadPayload
  ) =>
    http.post<{ success: boolean; message: string; dataset: any }>(
      Endpoints.datasets.confirmUpload(caseId, dataType),
      payload
    ),

  selectDatasets: (caseId: string, datasetIds: string[]) =>
    http.post<{ success: boolean; message: string }>(
      Endpoints.datasets.selectDatasets(caseId),
      { dataset_ids: datasetIds }
    ),

  viewDataset: async (
    caseId: string,
    datasetId: string
  ): Promise<ViewDatasetResponse> => {
    return http.get<ViewDatasetResponse>(
      Endpoints.datasets.viewById(caseId, datasetId)
    );
  },
};
