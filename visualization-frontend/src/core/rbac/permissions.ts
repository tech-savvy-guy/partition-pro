export const Permission = {
  ViewUsers: "users.view",
  CreateUsers: "users.create",
  EditUsers: "users.edit",
  DeleteUsers: "users.delete",

  ViewDashboards: "dashboards.view",

  ViewCases: "cases.view",
  CreateCases: "cases.create",
  DeleteCases: "cases.delete",

  ViewPartitions: "partitions.view",
  CreatePartitions: "partitions.create",

  ViewDatasets: "datasets.view",
  EditDatasets: "datasets.edit",

  ViewFiles: "files.view",
  UploadFiles: "files.upload",
  DownloadFiles: "files.download",
  DeleteFiles: "files.delete",

  ViewSettings: "settings.view",
  EditSettings: "settings.edit",

  ViewAudit: "audit.view",
  ViewAdmin: "admin.view",
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]
