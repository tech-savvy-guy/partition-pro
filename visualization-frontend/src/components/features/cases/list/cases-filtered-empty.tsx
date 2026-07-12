import { SearchIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export function CasesFilteredEmpty({
  onClearFilters,
}: {
  onClearFilters: () => void
}) {
  return (
    <Empty className="border-0 bg-transparent py-12 shadow-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>No matching cases</EmptyTitle>
        <EmptyDescription>
          Adjust or clear your search to find matching cases.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="ghost" onClick={onClearFilters}>
          <XIcon data-icon="inline-start" />
          Clear search
        </Button>
      </EmptyContent>
    </Empty>
  )
}
