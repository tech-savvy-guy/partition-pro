import { Permission } from "./permissions.enum";

export function mapBackendPermissions(backend: {
  can_manage_admins: boolean;
  can_see_all_requests: boolean;
  can_edit_all_requests: boolean;
  can_create_requests: boolean;
}): Permission[] {
  const permissions: Permission[] = [];

  if (backend.can_manage_admins) {
    permissions.push(
      Permission.ViewUsers,
      Permission.CreateUser,
      Permission.EditUser,
      Permission.DeleteUser,
      Permission.ViewSettings
    );
  }

  if (backend.can_see_all_requests) {
    permissions.push(
      Permission.ViewCases,
      Permission.ViewPartitions,
      Permission.ViewFiles,
      Permission.ViewDatasets,
      Permission.ViewWorkflows
    );
  }

  if (backend.can_edit_all_requests) {
    permissions.push(
      Permission.CreatePartitions,
      Permission.EditPartitions,
      Permission.UploadFiles,
      Permission.EditCases,
      Permission.CloseCases
    );
  }

  if (backend.can_create_requests) {
    permissions.push(Permission.CreateCases, Permission.ArchiveCases);
  }

  return permissions;
}
