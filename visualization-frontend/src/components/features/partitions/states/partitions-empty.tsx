import { Link } from "@tanstack/react-router"
import { GitBranchIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export function PartitionsEmpty({
  caseId,
  canCreate,
}: {
  caseId: string
  canCreate: boolean
}) {
  return (
    <Empty className="border bg-background py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <GitBranchIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>No partitions yet</EmptyTitle>
        <EmptyDescription>
          Create the first partition to begin shaping this case into working
          segments.
        </EmptyDescription>
      </EmptyHeader>
      {canCreate ? (
        <EmptyContent>
          <Button
            render={
              <Link
                to="/cases/$caseId/partitions/new"
                params={{ caseId }}
              />
            }
          >
            <PlusIcon data-icon="inline-start" />
            New partition
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}
