import React from "react";
import { CaseApi } from "@/core/api";
import { useAuth } from "@/core/auth/authContext";
import {
  CasePermissionContext,
  CasePermissionContextValue,
} from "./CasePermissionContext";
import { CaseRole } from "../auth/auth.types";
import { mapCasePermissions } from "../rbac/case-permission.map";
import { Permission } from "../rbac/permissions.enum";

// Adjust to whatever you use for TECH_ADMIN identification.
// Best is a dedicated permission in user.permissions:
const isTechAdmin = (user: any) =>
  user?.role === "TECH_ADMIN" || user?.role === "BBA_ADMIN";

export function CasePermissionProvider({
  caseId,
  children,
}: {
  caseId: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [state, setState] = React.useState<CasePermissionContextValue | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        setError(null);

        // TECH_ADMIN bypass: resolve immediately (no need to fetch assignments)
        if (isTechAdmin(user)) {
          const permissions = Object.values(Permission) as Permission[];

          if (!active) return;
          setState({
            caseId,
            role: "PUBLISHER" as CaseRole, // arbitrary but "highest" is fine
            permissions,
          });
          return;
        }

        // Normal users: fetch assignments
        const res = await CaseApi.getAssignments(caseId);
        if (!active) return;

        const me = (res.assignments ?? []).find(
          (a: any) => a.user_id === user?.id
        );

        // If not assigned, do NOT hang forever.
        // Decide: either treat as no-access or viewer-only.
        // Safer: treat as no access (empty permissions).
        if (!me) {
          setState({
            caseId,
            role: "VIEWER" as CaseRole,
            permissions: [], // no case access
          });
          return;
        }

        const permissions = mapCasePermissions({
          viewer: true,
          editor: me.role === "EDITOR" || me.role === "PUBLISHER",
          publisher: me.role === "PUBLISHER",
        });

        setState({
          caseId,
          role: me.role as CaseRole,
          permissions,
        });
      } catch (e) {
        console.error("Failed to load case permissions:", e);
        if (!active) return;
        setError("Failed to load case permissions.");
        // still resolve state so UI doesn't hang
        setState({
          caseId,
          role: "VIEWER" as CaseRole,
          permissions: [],
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [caseId, user?.id, user?.permissions]);

  // Optional: keep this, but now it should never be stuck forever.
  if (!state) {
    return <div className="p-6">Loading case permissions…</div>;
  }

  // Optional: show non-blocking error banner (but still render children)
  return (
    <CasePermissionContext.Provider value={state}>
      {error ? (
        <div className="px-6 pt-4 text-sm text-red-700">{error}</div>
      ) : null}
      {children}
    </CasePermissionContext.Provider>
  );
}
