export const SECURITY_API_PREFIX = "/security/v1.0";
export const REPORT_API_PREFIX = "/reports/v1.0";

export const Endpoints = {
  auth: {
    login: `${SECURITY_API_PREFIX}/login`,
    refresh: `${SECURITY_API_PREFIX}/token/refresh`,
    me: `${SECURITY_API_PREFIX}/me`,
    logout: `${SECURITY_API_PREFIX}/logout`,
  },

  users: {
    root: `${SECURITY_API_PREFIX}/users`,
    list: `${SECURITY_API_PREFIX}/users`,
    create: `${SECURITY_API_PREFIX}/users/create`,
    byId: (id: string) => `${SECURITY_API_PREFIX}/users/${id}`,
    update: (id: string) => `${SECURITY_API_PREFIX}/users/${id}/update`,
    delete: (id: string) => `${SECURITY_API_PREFIX}/users/${id}/delete`,
  },

  settings: {
    root: `${SECURITY_API_PREFIX}/settings`,
    update: `${SECURITY_API_PREFIX}/settings`,
  },

  cases: {
    root: `${REPORT_API_PREFIX}/cases`,
    list: `${REPORT_API_PREFIX}/cases`,
    create: `${REPORT_API_PREFIX}/cases`,
    byId: (id: string) => `${REPORT_API_PREFIX}/cases/${id}`,
    update: (id: string) => `${REPORT_API_PREFIX}/cases/${id}`,
    delete: (id: string) => `${REPORT_API_PREFIX}/cases/${id}`,
    assignments: (caseId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/assignments`,
    assignmentRole: (caseId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/assignments/role`,
  },

  caseAssignments: {
    list: (caseId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/assignments`,
    create: (caseId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/assignments`,
    updateRole: (caseId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/assignments/role`,
    remove: (caseId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/assignments`,
  },

  datasets: {
    listByCase: (caseId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/datasets`,

    uploadUrl: (caseId: string, dataType: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/datasets/${dataType}/upload-url`,

    confirmUpload: (caseId: string, dataType: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/datasets/${dataType}/confirm`,

    selectDatasets: (caseId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/datasets/select`,

    viewById: (caseId: string, datasetId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/datasets/${datasetId}`,
  },

  partitions: {
    root: `${REPORT_API_PREFIX}/partitions`,
    byId: (id: string) => `${REPORT_API_PREFIX}/partitions/${id}`,
    listByCase: (caseId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/partitions`,
    create: (caseId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/partitions`,
    item: (caseId: string, partitionId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/partitions/${partitionId}`,
    lock: (caseId: string, partitionId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/partitions/${partitionId}/lock`,
    unlock: (caseId: string, partitionId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/partitions/${partitionId}/unlock`,
    close: (caseId: string, partitionId: string) =>
    `${REPORT_API_PREFIX}/cases/${caseId}/partitions/${partitionId}/close`,

    datasets: (caseId: string, partitionId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/partitions/${partitionId}/datasets`,
    rawDatasets: (caseId: string, partitionId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/partitions/${partitionId}/raw-datasets`,


    datasetDownload: (caseId: string, partitionId: string, datasetId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/partitions/${partitionId}/datasets/${datasetId}`,

    datasetUploadUrl: (caseId: string, partitionId: string, dataType: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/partitions/${partitionId}/datasets/${dataType}/upload-url`,

    datasetConfirmUpload: (caseId: string, partitionId: string, dataType: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/partitions/${partitionId}/datasets/${dataType}/confirm`,

  },

  workflows: {
    root: `${REPORT_API_PREFIX}/workflows`,

    byId: (id: string) => `${REPORT_API_PREFIX}/workflows/${id}`,

    skuSelection: (caseId: string, partitionId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/partitions/${partitionId}/sku-selection`,

    attributeSelection: (caseId: string, partitionId: string) =>
      `${REPORT_API_PREFIX}/workflows/${caseId}/${partitionId}/node-attributes-skus`,

    baseMath: (caseId: string, partitionId: string) =>
      `${REPORT_API_PREFIX}/cases/${caseId}/partitions/${partitionId}/base-math`,

    run: (caseId: string, partitionId: string, processName: string) =>
      `${REPORT_API_PREFIX}/workflows/${caseId}/${partitionId}/${processName}/run`,

    status: (caseId: string, partitionId: string) =>
      `${REPORT_API_PREFIX}/workflows/${caseId}/${partitionId}`,
    
    partitionTreeNode: (caseId: string, partitionId: string, nodeId: string) =>
      `/reports/v1.0/workflows/${caseId}/${partitionId}/node/${nodeId}`,

    previewRollup: (caseId: string, partitionId: string) =>
      `${REPORT_API_PREFIX}/workflows/${caseId}/${partitionId}/preview-rollup/`,

    previewRollupStatus: (
      caseId: string,
      partitionId: string,
      previewId: string,
    ) =>
      `${REPORT_API_PREFIX}/workflows/${caseId}/${partitionId}/preview-rollup-status/${previewId}/`,
  },
  changelogs: {
    root: `${REPORT_API_PREFIX}/changelogs`,
  },

  roles: {
    root: `${SECURITY_API_PREFIX}/roles`,
  },
} as const;
