import { Link } from "@tanstack/react-router"
import { PlusIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function CasesToolbar({
  search,
  onSearchChange,
}: {
  search: string
  onSearchChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-1.5">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-8 rounded-none border-0 border-b border-border bg-transparent pl-9 text-sm placeholder:text-muted-foreground/60 transition-colors focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder="Search cases"
          aria-label="Search cases"
        />
      </div>

      <div className="ml-auto">
        <Button size="sm" className="shadow-none" render={<Link to="/cases/new" />}>
          <PlusIcon data-icon="inline-start" />
          New case
        </Button>
      </div>
    </div>
  )
}
