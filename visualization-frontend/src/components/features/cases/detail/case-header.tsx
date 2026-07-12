import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Case } from "@/core/api"
import { formatDate } from "@/lib/format"

const caseStatusLabels: Record<Case["status"], string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
  completed: "Completed",
}

export { caseStatusLabels }

export function CaseHeader({ caseItem }: { caseItem: Case }) {
  return (
    <header className="border-l-2 border-l-primary bg-background p-5">
      <Button
        variant="link"
        size="sm"
        className="mb-4 h-auto w-fit p-0 text-muted-foreground hover:text-foreground"
        render={<Link to="/cases" />}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Cases
      </Button>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{caseItem.code}</Badge>
            <Badge variant="secondary">
              {caseStatusLabels[caseItem.status]}
            </Badge>
          </div>
          <h1 className="text-xl font-medium tracking-tight">
            {caseItem.name}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {caseItem.description || "No description added."}
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <CaseMeta label="Methodology" value={caseItem.methodology || "None"} />
          <CaseMeta label="Category" value={caseItem.category || "None"} />
          <CaseMeta label="Updated" value={formatDate(caseItem.updated_at)} />
        </dl>
      </div>
    </header>
  )
}

function CaseMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-xs text-foreground">{value}</dd>
    </div>
  )
}
