import { AuthUser } from "../auth/auth.types";
import { Permission } from "./permissions.enum";
import { CasePermissionContextValue } from "@/core/case/CasePermissionContext";

export function getGlobalPermissions(user: AuthUser | null): Permission[] {
  return user?.permissions ?? [];
}

export function canGlobal(
  user: AuthUser | null,
  permission: Permission
): boolean {
  return user?.permissions?.includes(permission) ?? false;
}

export function canCase(
  caseCtx: CasePermissionContextValue | null,
  permission: Permission
): boolean {
  return caseCtx?.permissions?.includes(permission) ?? false;
}
