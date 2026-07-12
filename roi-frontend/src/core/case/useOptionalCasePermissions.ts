import { useContext } from "react";
import { CasePermissionContext } from "./CasePermissionContext";

export function useOptionalCasePermissions() {
  return useContext(CasePermissionContext);
}
