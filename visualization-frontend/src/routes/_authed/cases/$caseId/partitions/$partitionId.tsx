import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { RefreshCwIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  PartitionWorkspaceSkeleton,
  MethodologyPartitionWorkspace,
} from "@/components/features/workspace"
import { usePartitionLock } from "@/components/features/workspace/shared/use-partition-lock"
import { CaseApi } from "@/core/api"
import { Permission, RequirePermission } from "@/core/rbac"
import { WorkflowProvider } from "@/core/workflow"

export const Route = createFileRoute(
  "/_authed/cases/$caseId/partitions/$partitionId"
)({
  component: PartitionWorkspacePage,
})

function PartitionWorkspacePage() {
  return (
    <RequirePermission
      anyOf={[Permission.ViewPartitions, Permission.ViewCases]}
    >
      <PartitionWorkspace />
    </RequirePermission>
  )
}

function PartitionWorkspace() {
  const { caseId, partitionId } = Route.useParams()

  const caseQuery = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => CaseApi.getCase(caseId),
  })
  const { lock, retry, partitionQuery } = usePartitionLock(
    caseId,
    partitionId
  )

  const pageError = caseQuery.error || partitionQuery.error

  if (pageError) {
    return (
      <Alert variant="destructive">
        <RefreshCwIcon aria-hidden="true" />
        <AlertTitle>Partition workspace could not be loaded</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>
            {pageError instanceof Error ? pageError.message : "Unknown error"}
          </span>
          <Button
            variant="outline"
            onClick={() => {
              void caseQuery.refetch()
              void partitionQuery.refetch()
              retry()
            }}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (
    caseQuery.isLoading ||
    partitionQuery.isLoading ||
    !caseQuery.data ||
    !partitionQuery.data
  ) {
    return <PartitionWorkspaceSkeleton />
  }

  return (
    <WorkflowProvider methodology={caseQuery.data.methodology}>
      <MethodologyPartitionWorkspace
        caseData={caseQuery.data}
        partitionData={partitionQuery.data}
        partitionLock={lock}
        onRetryPartitionLock={retry}
      />
    </WorkflowProvider>
  )
}
