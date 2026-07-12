import { CasePermissionProvider } from "@/core/case/CasePermissionProvider";
import { Outlet, useParams } from "react-router-dom";

export default function CaseLayout() {
  const { caseId } = useParams<{ caseId: string }>();

  if (!caseId) return null;

  return (
    <CasePermissionProvider caseId={caseId}>
      <Outlet />
    </CasePermissionProvider>
  );
}
