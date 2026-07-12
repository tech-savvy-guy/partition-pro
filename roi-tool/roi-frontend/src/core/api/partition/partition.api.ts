import { http } from "../http";
import { Endpoints } from "@/core/config";
import {
  GetPartitionsResponse,
  CreatePartitionPayload,
  CreatePartitionResponse,
  ClosePartitionResponse,
  PartitionUnlockResponse,
  PartitionLockResponse,
  PartitionDatasetDataType,
  PartitionDatasetUploadUrlResponse,
  PartitionDatasetConfirmUploadPayload,
  PartitionDatasetConfirmUploadResponse,
} from "./partition.types";

export const PartitionApi = {
  getPartitionByCaseId: (caseId: string) =>
    http.get<GetPartitionsResponse>(Endpoints.partitions.listByCase(caseId)),
   getPartition: (caseId: string, partitionId: string) =>
    http.get<any>(Endpoints.partitions.item(caseId, partitionId)),
  getPartitionDatasets: (caseId: string, partitionId: string) =>
    http.get<any>(Endpoints.partitions.datasets(caseId, partitionId)),
  getPartitionRawDatasets: (caseId: string, partitionId: string) =>
    http.get<any>(Endpoints.partitions.rawDatasets(caseId, partitionId)),
  downloadDataset: (caseId: string, partitionId: string, datasetId: string) =>
    http.get<{ file_url: string; blob_name: string; case_id: string; partition_id: string }>(
      Endpoints.partitions.datasetDownload(caseId, partitionId, datasetId)
    ),
  create: (caseId: string, payload: CreatePartitionPayload) =>
    http.post<CreatePartitionResponse>(Endpoints.partitions.create(caseId), {
      partition_name: payload.partitionName,
      description: payload.description,
      status: payload.status ?? "ACTIVE",
      step_status: payload.stepStatus ?? "DRAFT",
      base_partition_id: payload.basePartitionId ?? null,
    }),
  delete: (caseId: string, partitionId: string) =>
    http.delete<{ success: boolean; message: string }>(
      Endpoints.partitions.item(caseId, partitionId)
    ),
  share: (caseId: string, partitionId: string) =>
    http.patch<{ success: boolean; message: string; is_shared: boolean }>(
      Endpoints.partitions.item(caseId, partitionId),
      { is_shared: true }
    ),
  setShared: (caseId: string, partitionId: string, isShared: boolean) =>
    http.patch<{ success: boolean; message?: string }>(
      Endpoints.partitions.item(caseId, partitionId),
      { is_shared: isShared }
    ),
    closePartition: (caseId: string, partitionId: string) =>
    http.post<ClosePartitionResponse>(
      Endpoints.partitions.close(caseId, partitionId)
    ),
    acquireLock: (caseId: string, partitionId: string) =>
    http.put<PartitionLockResponse>(Endpoints.partitions.lock(caseId, partitionId)),

  refreshLock: (caseId: string, partitionId: string) =>
    http.patch<PartitionLockResponse>(
      Endpoints.partitions.lock(caseId, partitionId),
      { _refresh_lock: true }
    ),

  unlock: (caseId: string, partitionId: string) =>
    http.post<PartitionUnlockResponse>(Endpoints.partitions.unlock(caseId, partitionId)),

  getDatasetUploadUrl: (
    caseId: string,
    partitionId: string,
    dataType: PartitionDatasetDataType,
    fileName: string
  ) =>
    http.post<PartitionDatasetUploadUrlResponse>(
      Endpoints.partitions.datasetUploadUrl(caseId, partitionId, dataType),
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
    partitionId: string,
    dataType: PartitionDatasetDataType,
    payload: PartitionDatasetConfirmUploadPayload
  ) =>
    http.post<PartitionDatasetConfirmUploadResponse>(
      Endpoints.partitions.datasetConfirmUpload(caseId, partitionId, dataType),
      payload
    ),
};
