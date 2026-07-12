import { Link } from "@tanstack/react-router"
import { BriefcaseBusinessIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export function CasesEmpty() {
  return (
    <Empty className="border-0 bg-transparent py-12 shadow-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BriefcaseBusinessIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>No cases yet</EmptyTitle>
        <EmptyDescription>
          Start with a draft case, then add datasets and partitions as the work
          becomes concrete.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link to="/cases/new" />}>
          <PlusIcon data-icon="inline-start" />
          New case
        </Button>
      </EmptyContent>
    </Empty>
  )
}
