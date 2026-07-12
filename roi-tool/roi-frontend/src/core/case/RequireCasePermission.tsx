import { Navigate } from "react-router-dom";
import { useCasePermissions } from "@/core/case/CasePermissionContext";
import { Permission } from "@/core/rbac";

export function RequireCasePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { permissions } = useCasePermissions();  

  if (!permissions.includes(permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
