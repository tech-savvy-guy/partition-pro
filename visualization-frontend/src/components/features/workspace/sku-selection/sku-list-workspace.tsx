import { useQuery } from "@tanstack/react-query"
import { RefreshCwIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { WorkflowApi } from "@/core/api"
import type { PartitionTreeAttributeSelectionResponse } from "@/core/api"
import { SKUList } from "@/components/features/workspace/partition-tree"
import type { WorkflowNodeObject } from "@/lib/partition-tree/tree.types"

function normalizeAttributeSelectionPayload(
  response: PartitionTreeAttributeSelectionResponse | undefined
) {
  if (!response) return undefined
  if (Object.prototype.hasOwnProperty.call(response, "data")) {
    const wrapped = response as {
      data?: ({ data?: unknown } & Record<string, unknown>) | null
    }
    return (wrapped.data?.data ?? wrapped.data ?? response) as Record<
      string,
      unknown
    >
  }
  return response as Record<string, unknown>
}

export function SkuListWorkspace({
  caseId,
  partitionId,
  node,
}: {
  caseId?: string
  partitionId?: string
  node?: WorkflowNodeObject | null
}) {
  const canLoad = Boolean(caseId && partitionId && node?.id)

  const skuListQuery = useQuery({
    queryKey: ["attribute-selection", caseId, partitionId, node?.id] as const,
    enabled: canLoad,
    queryFn: () =>
      WorkflowApi.attributeSelection(caseId!, partitionId!, { node_obj: node }),
    retry: false,
  })

  if (!canLoad) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 py-12 text-sm text-muted-foreground">
        Run a partition-tree node to view its SKU list.
      </div>
    )
  }

  if (skuListQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Loading SKU list…
      </div>
    )
  }

  if (skuListQuery.error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <RefreshCwIcon aria-hidden="true" />
          <AlertTitle>SKU list could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              {skuListQuery.error instanceof Error
                ? skuListQuery.error.message
                : "Unknown error"}
            </span>
            <Button variant="outline" onClick={() => void skuListQuery.refetch()}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const payload = normalizeAttributeSelectionPayload(skuListQuery.data)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto px-8 py-6">
      <SKUList data={payload} />
    </div>
  )
}
