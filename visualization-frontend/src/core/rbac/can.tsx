import type { ReactNode } from "react"

import type { Permission } from "@/core/rbac/permissions"
import { useRbac } from "@/core/rbac/use-rbac"

type CanProps = {
  permission?: Permission
  anyOf?: readonly Permission[]
  allOf?: readonly Permission[]
  children: ReactNode
  fallback?: ReactNode
}

export function Can({ permission, anyOf, allOf, children, fallback = null }: CanProps) {
  const rbac = useRbac()
  const isAllowed =
    (permission ? rbac.can(permission) : true) &&
    (anyOf ? rbac.canAny(anyOf) : true) &&
    (allOf ? rbac.canAll(allOf) : true)

  return <>{isAllowed ? children : fallback}</>
}
