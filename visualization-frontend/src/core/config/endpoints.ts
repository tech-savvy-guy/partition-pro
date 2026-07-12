export const Endpoints = {
  auth: {
    exchange: "/api/auth/exchange/",
    refresh: "/api/auth/refresh/",
    logout: "/api/auth/logout/",
  },
  users: {
    me: "/api/me/",
    list: "/api/users/",
  },
  cases: {
    list: "/api/cases/",
    detail: (caseId: string) => `/api/cases/${caseId}/`,
    datasets: (caseId: string) => `/api/cases/${caseId}/datasets/`,
    datasetUploads: (caseId: string) => `/api/cases/${caseId}/datasets/uploads/`,
    datasetDetail: (caseId: string, datasetId: string) =>
      `/api/cases/${caseId}/datasets/${datasetId}/`,
    datasetUploadComplete: (caseId: string, datasetId: string) =>
      `/api/cases/${caseId}/datasets/${datasetId}/complete/`,
    datasetDownload: (caseId: string, datasetId: string) =>
      `/api/cases/${caseId}/datasets/${datasetId}/download/`,
    datasetPreview: (caseId: string, datasetId: string) =>
      `/api/cases/${caseId}/datasets/${datasetId}/preview/`,
    partitions: (caseId: string) => `/api/cases/${caseId}/partitions/`,
    partitionDetail: (caseId: string, partitionId: string) =>
      `/api/cases/${caseId}/partitions/${partitionId}/`,
    partitionSkuSelection: (caseId: string, partitionId: string) =>
      `/api/cases/${caseId}/partitions/${partitionId}/sku-selection/`,
    partitionDatasets: (caseId: string, partitionId: string) =>
      `/api/cases/${caseId}/partitions/${partitionId}/datasets/`,
    partitionDatasetDownload: (
      caseId: string,
      partitionId: string,
      datasetId: string
    ) =>
      `/api/cases/${caseId}/partitions/${partitionId}/datasets/${datasetId}/download/`,
    partitionDatasetUploadUrl: (
      caseId: string,
      partitionId: string,
      dataType: string
    ) =>
      `/api/cases/${caseId}/partitions/${partitionId}/datasets/${dataType}/upload-url/`,
    partitionDatasetConfirmUpload: (
      caseId: string,
      partitionId: string,
      dataType: string
    ) =>
      `/api/cases/${caseId}/partitions/${partitionId}/datasets/${dataType}/confirm/`,
    workflowStatus: (caseId: string, partitionId: string) =>
      `/api/cases/${caseId}/partitions/${partitionId}/workflow/`,
    workflowRun: (
      caseId: string,
      partitionId: string,
      processName: string
    ) =>
      `/api/cases/${caseId}/partitions/${partitionId}/workflow/${processName}/run/`,
    partitionTreeRun: (caseId: string, partitionId: string) =>
      `/api/cases/${caseId}/partitions/${partitionId}/partition-tree/run/`,
    partitionTreeAttributeSelection: (caseId: string, partitionId: string) =>
      `/api/cases/${caseId}/partitions/${partitionId}/partition-tree/attribute-selection/`,
    partitionTreeNode: (
      caseId: string,
      partitionId: string,
      nodeId: string
    ) =>
      `/api/cases/${caseId}/partitions/${partitionId}/partition-tree/nodes/${nodeId}/`,
    partitionTreeNodeColors: (
      caseId: string,
      partitionId: string,
      nodeId: string
    ) =>
      `/api/cases/${caseId}/partitions/${partitionId}/partition-tree/nodes/${nodeId}/colors/`,
    partitionTreePreviewRollup: (caseId: string, partitionId: string) =>
      `/api/cases/${caseId}/partitions/${partitionId}/partition-tree/preview-rollup/`,
    partitionTreePreviewRollupStatus: (
      caseId: string,
      partitionId: string,
      previewId: string
    ) =>
      `/api/cases/${caseId}/partitions/${partitionId}/partition-tree/preview-rollup-status/${previewId}/`,
    visualizationRun: (caseId: string, partitionId: string) =>
      `/api/cases/${caseId}/partitions/${partitionId}/visualization/run/`,
    visualizationStatus: (
      caseId: string,
      partitionId: string,
      taskId: string
    ) =>
      `/api/cases/${caseId}/partitions/${partitionId}/visualization/status/${taskId}/`,
    visualizationLatest: (caseId: string, partitionId: string) =>
      `/api/cases/${caseId}/partitions/${partitionId}/visualization/`,
    visualizationMdsMetrics: (caseId: string, partitionId: string) =>
      `/api/cases/${caseId}/partitions/${partitionId}/visualization/mds-metrics/`,
  },
} as const

export function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false
  return url.startsWith("/api/auth/")
}
