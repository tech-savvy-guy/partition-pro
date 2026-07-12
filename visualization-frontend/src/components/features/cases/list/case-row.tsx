import { Badge } from "@/components/ui/badge"
import type { Case } from "@/core/api"
import { formatDate } from "@/lib/format"

import { CaseActionsMenu } from "./case-actions-menu"

const statusLabels: Record<Case["status"], string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
  completed: "Completed",
}

export function CaseRow({
  caseItem,
  isLast,
  isArchiving,
  onArchiveCase,
}: {
  caseItem: Case
  isLast: boolean
  isArchiving: boolean
  onArchiveCase: (caseItem: Case) => void
}) {
  const updatedAt = formatDate(caseItem.updated_at)

  return (
    <article
      className={`group p-4 transition-colors hover:bg-muted/25 ${
        isLast ? "" : "border-b border-border/60"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-medium">{caseItem.name}</h2>
            <Badge variant="outline" className="font-mono">
              {caseItem.code}
            </Badge>
            <Badge variant="secondary">{statusLabels[caseItem.status]}</Badge>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {caseItem.description || "No description added."}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-5 sm:justify-end">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase">
              Updated
            </p>
            <p className="text-xs text-foreground">{updatedAt}</p>
          </div>
          <CaseActionsMenu
            caseItem={caseItem}
            isArchiving={isArchiving}
            onArchiveCase={onArchiveCase}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{caseItem.methodology || "No methodology"}</span>
        <span aria-hidden="true">/</span>
        <span>{caseItem.category || "No category"}</span>
      </div>
    </article>
  )
}
