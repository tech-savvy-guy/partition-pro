import { ArrowRightIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"

type RecentCaseData = {
  name: string
  caseCode: string
  method: string
  status: string
  lastEdited: string
  description: string
  lastPartition: string
  members: Array<{ name: string; initials: string }>
}

export function RecentCaseCard({ recentCase }: { recentCase: RecentCaseData }) {
  return (
    <div className="group flex flex-col gap-4 border-l-2 border-primary bg-background p-4 pl-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              Recent case
            </span>
            <span className="text-xs text-muted-foreground">
              &middot; {recentCase.lastEdited}
            </span>
          </div>
          <p className="text-base leading-snug font-semibold">
            {recentCase.name}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant="outline" className="text-xs">
              {recentCase.caseCode}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {recentCase.method}
            </Badge>
            <Badge className="border-0 bg-primary/10 text-xs text-primary hover:bg-primary/20">
              {recentCase.status}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 -space-x-2">
          {recentCase.members.map((member) => (
            <div
              key={member.name}
              title={member.name}
              className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-primary text-[10px] font-medium text-primary-foreground"
            >
              {member.initials}
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {recentCase.description}
      </p>

      <div className="flex items-center justify-between gap-5">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          Last partition &mdash;{" "}
          <span className="text-foreground">{recentCase.lastPartition}</span>
        </p>
        <a
          href="#"
          className="mr-2 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground transition-colors group-hover:text-primary"
        >
          Continue
          <ArrowRightIcon aria-hidden="true" className="size-3.5" />
        </a>
      </div>
    </div>
  )
}
