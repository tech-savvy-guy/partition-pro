import type { PermissionValue, RoleValue } from "@/core/rbac"

export type CurrentUser = {
  email: string
  display_name: string
  first_name: string
  last_name: string
  job_title: string
  department: string
  role: RoleValue
  permissions: PermissionValue[]
  image: string | null
}

export type AssignableUser = {
  id: string
  email: string
  display_name: string
  first_name: string
  last_name: string
  job_title: string
  department: string
  role: RoleValue
  image: string | null
}
