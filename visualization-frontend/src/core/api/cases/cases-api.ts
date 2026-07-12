import axios, { type AxiosProgressEvent } from "axios"

import { http } from "@/core/api/http"
import type {
  AttributeColorMap,
  Case,
  CreateCasePayload,
  CreateDatasetUploadPayload,
  CreatePartitionPayload,
  Dataset,
  DatasetDownloadResponse,
  DatasetUploadResponse,
  SkuSelectionResponse,
  Partition,
  PartitionDatasetConfirmUploadPayload,
  PartitionDatasetConfirmUploadResponse,
  PartitionDatasetDataType,
  PartitionDatasetDownloadResponse,
  PartitionDatasetsResponse,
  PartitionDatasetUploadUrlResponse,
  PartitionTreeAttributeSelectionResponse,
  PartitionTreeNodeResponse,
  PartitionTreePreviewRollupPayload,
  PartitionTreePreviewRollupResponse,
  PartitionTreePreviewRollupStatusResponse,
  PartitionTreeWorkflowData,
  RunVisualizationPayload,
  RunWorkflowResponse,
  UpdateDatasetPayload,
  UpdateCasePayload,
  UpdateSkuSelectionPayload,
  VisualizationLatestResponse,
  VisualizationMdsMetricsResponse,
  VisualizationRunResponse,
  VisualizationStatusResponse,
  DatasetPreviewUrlResponse,
} from "@/core/api/cases/cases-types"
import { Endpoints } from "@/core/config"

export const CaseApi = {
  listCases: () => http.get<Case[]>(Endpoints.cases.list),
  getCase: (caseId: string) => http.get<Case>(Endpoints.cases.detail(caseId)),
  createCase: (payload: CreateCasePayload) =>
    http.post<Case>(Endpoints.cases.list, payload),
  updateCase: (caseId: string, payload: UpdateCasePayload) =>
    http.patch<Case>(Endpoints.cases.detail(caseId), payload),
}

export const PartitionApi = {
  listPartitions: (caseId: string) =>
    http.get<Partition[]>(Endpoints.cases.partitions(caseId)),
  getPartition: (caseId: string, partitionId: string) =>
    http.get<Partition>(Endpoints.cases.partitionDetail(caseId, partitionId)),
  createPartition: (caseId: string, payload: CreatePartitionPayload) =>
    http.post<Partition>(Endpoints.cases.partitions(caseId), payload),
  getPartitionDatasets: (caseId: string, partitionId: string) =>
    http.get<PartitionDatasetsResponse>(
      Endpoints.cases.partitionDatasets(caseId, partitionId)
    ),
  downloadDataset: (caseId: string, partitionId: string, datasetId: string) =>
    http.get<PartitionDatasetDownloadResponse>(
      Endpoints.cases.partitionDatasetDownload(caseId, partitionId, datasetId)
    ),
  getDatasetUploadUrl: (
    caseId: string,
    partitionId: string,
    dataType: PartitionDatasetDataType,
    fileName: string
  ) =>
    http.post<PartitionDatasetUploadUrlResponse>(
      Endpoints.cases.partitionDatasetUploadUrl(caseId, partitionId, dataType),
      { file_name: fileName }
    ),
  async uploadToBlob(uploadUrl: string, file: File): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Type": file.type || "application/octet-stream",
      },
    })
  },
  confirmDatasetUpload: (
    caseId: string,
    partitionId: string,
    dataType: PartitionDatasetDataType,
    payload: PartitionDatasetConfirmUploadPayload
  ) =>
    http.post<PartitionDatasetConfirmUploadResponse>(
      Endpoints.cases.partitionDatasetConfirmUpload(caseId, partitionId, dataType),
      payload
    ),
}

export const WorkflowApi = {
  getStatus: (caseId: string, partitionId: string) =>
    http.get<PartitionTreeWorkflowData>(
      Endpoints.cases.workflowStatus(caseId, partitionId)
    ),
  runProcess: (
    caseId: string,
    partitionId: string,
    processName: string,
    payload?: unknown
  ) =>
    http.post<RunWorkflowResponse>(
      Endpoints.cases.workflowRun(caseId, partitionId, processName),
      payload
    ),
  runPartitionTree: (caseId: string, partitionId: string, nodeObj: unknown) =>
    http.post<RunWorkflowResponse>(
      Endpoints.cases.partitionTreeRun(caseId, partitionId),
      { node_obj: nodeObj }
    ),
  attributeSelection: (
    caseId: string,
    partitionId: string,
    payload?: unknown
  ) =>
    http.post<PartitionTreeAttributeSelectionResponse>(
      Endpoints.cases.partitionTreeAttributeSelection(caseId, partitionId),
      payload
    ),
  pollPartitionTreeNode: (
    caseId: string,
    partitionId: string,
    nodeId: string
  ) =>
    http.get<PartitionTreeNodeResponse>(
      Endpoints.cases.partitionTreeNode(caseId, partitionId, nodeId)
    ),
  selectPartitionTreeAttribute: (
    caseId: string,
    partitionId: string,
    nodeId: string,
    attributeName: string
  ) =>
    http.post<PartitionTreeWorkflowData>(
      Endpoints.cases.partitionTreeNode(caseId, partitionId, nodeId),
      { attribute_name: attributeName }
    ),
  deletePartitionTreeNode: (
    caseId: string,
    partitionId: string,
    nodeId: string
  ) =>
    http.delete<PartitionTreeWorkflowData>(
      Endpoints.cases.partitionTreeNode(caseId, partitionId, nodeId)
    ),
  savePartitionTreeColors: (
    caseId: string,
    partitionId: string,
    nodeId: string,
    attributeName: string,
    colors: AttributeColorMap
  ) =>
    http.put<PartitionTreeWorkflowData>(
      Endpoints.cases.partitionTreeNodeColors(caseId, partitionId, nodeId),
      { attribute_name: attributeName, colors }
    ),
  previewRollup: (
    caseId: string,
    partitionId: string,
    body: PartitionTreePreviewRollupPayload
  ) =>
    http.post<PartitionTreePreviewRollupResponse>(
      Endpoints.cases.partitionTreePreviewRollup(caseId, partitionId),
      body
    ),
  previewRollupStatus: (
    caseId: string,
    partitionId: string,
    previewId: string
  ) =>
    http.get<PartitionTreePreviewRollupStatusResponse>(
      Endpoints.cases.partitionTreePreviewRollupStatus(
        caseId,
        partitionId,
        previewId
      )
    ),
  getSkuSelection: (caseId: string, partitionId: string) =>
    http.get<SkuSelectionResponse>(
      Endpoints.cases.partitionSkuSelection(caseId, partitionId)
    ),
  updateSkuSelection: (
    caseId: string,
    partitionId: string,
    payload: UpdateSkuSelectionPayload
  ) =>
    http.patch<SkuSelectionResponse>(
      Endpoints.cases.partitionSkuSelection(caseId, partitionId),
      payload
    ),
  runVisualization: (
    caseId: string,
    partitionId: string,
    payload: RunVisualizationPayload
  ) =>
    http.post<VisualizationRunResponse>(
      Endpoints.cases.visualizationRun(caseId, partitionId),
      payload
    ),
  pollVisualizationStatus: (
    caseId: string,
    partitionId: string,
    taskId: string
  ) =>
    http.get<VisualizationStatusResponse>(
      Endpoints.cases.visualizationStatus(caseId, partitionId, taskId)
    ),
  getVisualizationLatest: (caseId: string, partitionId: string) =>
    http.get<VisualizationLatestResponse>(
      Endpoints.cases.visualizationLatest(caseId, partitionId)
    ),
  getVisualizationMdsMetrics: (caseId: string, partitionId: string) =>
    http.get<VisualizationMdsMetricsResponse>(
      Endpoints.cases.visualizationMdsMetrics(caseId, partitionId)
    ),
}

export const DatasetApi = {
  listDatasets: (caseId: string) =>
    http.get<Dataset[]>(Endpoints.cases.datasets(caseId)),
  createUpload: (caseId: string, payload: CreateDatasetUploadPayload) =>
    http.post<DatasetUploadResponse>(Endpoints.cases.datasetUploads(caseId), payload),
  updateDataset: (
    caseId: string,
    datasetId: string,
    payload: UpdateDatasetPayload
  ) => http.patch<Dataset>(Endpoints.cases.datasetDetail(caseId, datasetId), payload),
  completeUpload: (caseId: string, datasetId: string) =>
    http.post<Dataset>(
      Endpoints.cases.datasetUploadComplete(caseId, datasetId)
    ),
  getDownloadUrl: (caseId: string, datasetId: string) =>
    http.get<DatasetDownloadResponse>(
      Endpoints.cases.datasetDownload(caseId, datasetId)
    ),
  getPreview: (caseId: string, datasetId: string) =>
    http.get<DatasetPreviewUrlResponse>(
      Endpoints.cases.datasetPreview(caseId, datasetId)
    ),
  async uploadToAzure(
    uploadUrl: string,
    file: File,
    headers: Record<string, string>,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers,
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (!event.total) return
        onProgress?.(Math.round((event.loaded / event.total) * 100))
      },
    })
  },
}
