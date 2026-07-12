import * as React from "react"

import { useAuth } from "@/core/auth/authContext"
import type { Permission } from "@/core/rbac/permissions"
import {
  can,
  canAll,
  canAny,
  getPermissions,
} from "@/core/rbac/rbac-service"

export function useRbac() {
  const { user } = useAuth()

  return React.useMemo(
    () => ({
      permissions: getPermissions(user),
      can: (permission: Permission) => can(user, permission),
      canAny: (permissions: readonly Permission[]) => canAny(user, permissions),
      canAll: (permissions: readonly Permission[]) => canAll(user, permissions),
    }),
    [user]
  )
}
