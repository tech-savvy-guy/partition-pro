import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCwIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ApiError, WorkflowApi } from "@/core/api"
import type { PartitionTreeWorkflowData } from "@/core/api"
import type { RunNodeInfo } from "@/lib/partition-tree/types"
import { useUI } from "@/core/ui"

const LazyPartitionTree = React.lazy(() =>
  import("@/components/features/workspace/partition-tree").then((module) => ({
    default: module.PartitionTree,
  }))
)

export function PartitionTreeWorkspace({
  caseId,
  partitionId,
  partitionName,
  canEdit,
  onRunNode,
}: {
  caseId: string
  partitionId: string
  partitionName?: string
  canEdit?: boolean
  onRunNode?: (info: RunNodeInfo) => void
}) {
  const queryClient = useQueryClient()
  const { showToast } = useUI()
  const queryKey = React.useMemo(
    () => ["partition-tree-workflow", caseId, partitionId] as const,
    [caseId, partitionId]
  )

  const workflowQuery = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await WorkflowApi.getStatus(caseId, partitionId)
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null
        }
        throw error
      }
    },
    retry: false,
  })

  if (workflowQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Loading partition tree...
      </div>
    )
  }

  if (workflowQuery.error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <RefreshCwIcon aria-hidden="true" />
          <AlertTitle>Partition tree could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              {workflowQuery.error instanceof Error
                ? workflowQuery.error.message
                : "Unknown error"}
            </span>
            <Button variant="outline" onClick={() => void workflowQuery.refetch()}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <React.Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading partition tree...
        </div>
      }
    >
      <LazyPartitionTree
        caseId={caseId}
        partitionId={partitionId}
        workflowData={workflowQuery.data as PartitionTreeWorkflowData | null}
        partitionName={partitionName}
        readOnly={!canEdit}
        permissions={{
          canEdit: Boolean(canEdit),
          canRunNode: Boolean(canEdit),
          canUploadRollups: Boolean(canEdit),
        }}
        onWorkflowDataPatch={(payload) => {
          queryClient.setQueryData(queryKey, payload)
        }}
        onNotify={(message, variant = "default", options) => {
          showToast(message, variant === "info" ? "default" : variant, options)
        }}
        onRunNode={onRunNode}
      />
    </React.Suspense>
  )
}
