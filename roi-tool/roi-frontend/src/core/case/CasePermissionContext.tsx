import React from "react";
import { Permission } from "@/core/rbac";

export type CasePermissionContextValue = {
  caseId: string;
  permissions: Permission[];
  role: "Viewer" | "Editor" | "Publisher";
};

export const CasePermissionContext =
  React.createContext<CasePermissionContextValue | null>(null);

const EMPTY_PERMISSIONS: Permission[] = [];

export function useCasePermissions() {
  const ctx = React.useContext(CasePermissionContext);

  if (!ctx) {
    return {
      hasCaseContext: false,
      permissions: EMPTY_PERMISSIONS,
      role: null as null,
    };
  }

  return {
    hasCaseContext: true,
    permissions: ctx.permissions,
    role: ctx.role,
  };
}
