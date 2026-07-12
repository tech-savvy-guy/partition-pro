import type { CurrentUser } from "@/core/api"
import type { Permission } from "@/core/rbac/permissions"

type PermissionSource = Pick<CurrentUser, "permissions"> | null | undefined

export function getPermissions(source: PermissionSource): readonly Permission[] {
  return source?.permissions ?? []
}

export function can(source: PermissionSource, permission: Permission): boolean {
  return getPermissions(source).includes(permission)
}

export function canAny(
  source: PermissionSource,
  permissions: readonly Permission[]
): boolean {
  return permissions.some((permission) => can(source, permission))
}

export function canAll(
  source: PermissionSource,
  permissions: readonly Permission[]
): boolean {
  return permissions.every((permission) => can(source, permission))
}
