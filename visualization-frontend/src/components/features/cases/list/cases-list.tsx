import type { Case } from "@/core/api"

import { CaseRow } from "./case-row"

export function CasesList({
  cases,
  archivingCaseId,
  onArchiveCase,
}: {
  cases: Case[]
  archivingCaseId?: string
  onArchiveCase: (caseItem: Case) => void
}) {
  return (
    <div className="flex flex-col border border-border/70 bg-card shadow-xs">
      {cases.map((caseItem, index) => (
        <CaseRow
          key={caseItem.id}
          caseItem={caseItem}
          isLast={index === cases.length - 1}
          isArchiving={archivingCaseId === caseItem.id}
          onArchiveCase={onArchiveCase}
        />
      ))}
    </div>
  )
}
