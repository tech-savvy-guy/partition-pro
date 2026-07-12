import { GitPullRequestCreate } from "lucide-react"

type ChangelogEntry = {
  version: string
  date: string
  type: "feature" | "fix" | "improvement"
  title: string
  description: string
}

export function ChangelogPanel({
  entries,
}: {
  entries: ChangelogEntry[]
}) {
  return (
    <div className="flex flex-col border-t-2 border-t-primary bg-background p-4 transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
          What's new
        </p>
        <GitPullRequestCreate
          aria-hidden="true"
          className="size-3.5 text-muted-foreground"
        />
      </div>
      {entries.map((entry, index) => (
        <div
          key={entry.version}
          className={`py-3 ${
            index < entries.length - 1 ? "border-b border-border" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm leading-snug font-medium">{entry.title}</p>
            <span className="shrink-0 text-[10px] text-muted-foreground/40 tabular-nums">
              {entry.version} &middot; {entry.date}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {entry.description}
          </p>
        </div>
      ))}
    </div>
  )
}
