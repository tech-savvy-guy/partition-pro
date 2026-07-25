import { Link, useNavigate } from "@tanstack/react-router"
import type { KeyboardEvent } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Case } from "@/core/api"
import { formatDate } from "@/lib/format"

import { CaseActionsMenu } from "./case-actions-menu"

const statusConfig: Record<
  Case["status"],
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "text-muted-foreground",
  },
  active: {
    label: "Active",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  archived: {
    label: "Archived",
    className: "text-muted-foreground",
  },
  completed: {
    label: "Completed",
    className: "text-blue-600 dark:text-blue-400",
  },
}

export function CasesTable({
  cases,
  archivingCaseId,
  deletingCaseId,
  onArchiveCase,
  onDeleteCase,
}: {
  cases: Case[]
  archivingCaseId?: string
  deletingCaseId?: string
  onArchiveCase: (caseItem: Case) => void
  onDeleteCase?: (caseItem: Case) => void
}) {
  const navigate = useNavigate()

  function openCase(caseId: string) {
    void navigate({ to: "/cases/$caseId", params: { caseId } })
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    caseId: string
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    event.preventDefault()
    openCase(caseId)
  }

  return (
    <div className="overflow-hidden border bg-background">
      <Table>
        <TableHeader className="bg-taupe-200">
          <TableRow className="border-b border-border">
            <TableHead className="h-11 px-4 text-[11px] font-medium uppercase">
              Case
            </TableHead>
            <TableHead className="h-11 text-[11px] font-medium uppercase">
              Case Code
            </TableHead>
            <TableHead className="h-11 text-[11px] font-medium uppercase">
              Created by
            </TableHead>
            <TableHead className="h-11 text-[11px] font-medium uppercase">
              Start
            </TableHead>
            <TableHead className="h-11 text-[11px] font-medium uppercase">
              End
            </TableHead>
            <TableHead className="h-11 text-[11px] font-medium uppercase">
              Description
            </TableHead>
            <TableHead className="h-11 text-[11px] font-medium uppercase">
              Status
            </TableHead>
            <TableHead className="h-11 w-12 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((caseItem) => {
            const status = statusConfig[caseItem.status]
            const isActive = caseItem.status === "active"

            return (
              <TableRow
                key={caseItem.id}
                role="link"
                tabIndex={0}
                aria-label={`Open ${caseItem.name}`}
                onClick={() => openCase(caseItem.id)}
                onKeyDown={(event) => handleRowKeyDown(event, caseItem.id)}
                className="group cursor-pointer border-b border-border/30 bg-transparent hover:bg-muted/20 focus-visible:bg-muted/30 focus-visible:outline-none"
              >
                <TableCell className="px-4 py-3.5">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span
                      className={`text-sm font-medium transition-colors group-hover:text-primary group-hover:underline decoration-primary underline-offset-4 ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {caseItem.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-3.5">
                  <span className="font-mono text-xs text-muted-foreground">
                    {caseItem.code || "NA"}
                  </span>
                </TableCell>
                <TableCell className="py-3.5" onClick={(event) => event.stopPropagation()}>
                  {caseItem.created_by?.email ? (
                    <Link
                      to="/profile"
                      search={{ email: caseItem.created_by.email } as any}
                      className="text-sm text-muted-foreground hover:text-primary hover:underline underline-offset-4"
                    >
                      {caseItem.created_by.display_name}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {caseItem.created_by?.display_name ?? "-"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3.5">
                  <span className="text-sm text-muted-foreground">
                    {formatDate(caseItem.created_at)}
                  </span>
                </TableCell>
                <TableCell className="py-3.5">
                  <span className="text-sm text-muted-foreground">-</span>
                </TableCell>
                <TableCell className="max-w-xs py-3.5">
                  <span className="line-clamp-1 text-sm text-muted-foreground">
                    {caseItem.description || "-"}
                  </span>
                </TableCell>
                <TableCell className="py-3.5">
                  <span
                    className={`inline-flex items-center rounded text-xs font-medium ${status.className}`}
                  >
                    {status.label}
                  </span>
                </TableCell>
                <TableCell
                  className="py-3.5 pr-3 text-right"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <div className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <CaseActionsMenu
                      caseItem={caseItem}
                      isArchiving={archivingCaseId === caseItem.id}
                      isDeleting={deletingCaseId === caseItem.id}
                      onArchiveCase={onArchiveCase}
                      onDeleteCase={onDeleteCase}
                    />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
