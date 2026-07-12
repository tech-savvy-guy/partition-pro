import { Permission } from "./permissions.enum";

export function mapCasePermissions(casePermissions: {
  viewer: boolean;
  editor: boolean;
  publisher: boolean;
}): Permission[] {
  const permissions: Permission[] = [];

  if (casePermissions.viewer) {
    permissions.push(Permission.ViewCases);
    permissions.push(Permission.ViewPartitions);
    permissions.push(Permission.ViewDatasets);
    permissions.push(Permission.ViewWorkflows);
  }

  if (casePermissions.editor) {
    permissions.push(Permission.ViewCases);
    permissions.push(Permission.ViewPartitions);
    permissions.push(Permission.ViewDatasets);
    permissions.push(Permission.ViewWorkflows);
    permissions.push(Permission.CreatePartitions);
    permissions.push(Permission.EditPartitions);
    permissions.push(Permission.EditDatasets);
    permissions.push(Permission.EditWorkflows);
    permissions.push(Permission.EditCases);
  }

  if (casePermissions.publisher) {
    permissions.push(Permission.ViewCases);
    permissions.push(Permission.ViewPartitions);
    permissions.push(Permission.ViewDatasets);
    permissions.push(Permission.ViewWorkflows);
    permissions.push(Permission.CreateCases);
    permissions.push(Permission.CreatePartitions);
    permissions.push(Permission.EditPartitions);
    permissions.push(Permission.EditDatasets);
    permissions.push(Permission.EditWorkflows);
    permissions.push(Permission.ArchiveCases);
    permissions.push(Permission.EditCases);
    permissions.push(Permission.EditCaseDetails);
    permissions.push(Permission.AddCaseMembers);
  }

  return permissions;
}
