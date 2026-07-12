import { useParams } from "react-router-dom";
import { CasePermissionProvider } from "../CasePermissionProvider";

export default function CasePermissionRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { caseId, id } = useParams<{ caseId?: string; id?: string }>();
  const resolvedCaseId = caseId ?? id;

  if (!resolvedCaseId) return <>{children}</>;

  return (
    <CasePermissionProvider caseId={resolvedCaseId}>
      {children}
    </CasePermissionProvider>
  );
}
