import type { ReactNode } from "react"

import { ForbiddenState } from "@/core/rbac/forbidden-state"
import type { Permission } from "@/core/rbac/permissions"
import { useRbac } from "@/core/rbac/use-rbac"

type RequirePermissionProps = {
  permission?: Permission
  anyOf?: readonly Permission[]
  allOf?: readonly Permission[]
  children: ReactNode
}

export function RequirePermission({
  permission,
  anyOf,
  allOf,
  children,
}: RequirePermissionProps) {
  const rbac = useRbac()

  const isAllowed =
    (permission ? rbac.can(permission) : true) &&
    (anyOf ? rbac.canAny(anyOf) : true) &&
    (allOf ? rbac.canAll(allOf) : true)

  if (!isAllowed) {
    return <ForbiddenState />
  }

  return <>{children}</>
}
