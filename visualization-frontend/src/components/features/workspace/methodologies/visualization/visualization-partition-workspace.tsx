import { useEffect, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckIcon, RefreshCwIcon, SearchIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  ApiError,
  WorkflowApi,
  type Case,
  type Partition,
  type RunVisualizationPayload,
  type VisualizationWorkflowStatus,
} from "@/core/api"
import { useUI } from "@/core/ui"
import { MdsWorkspace } from "../../mds/mds-workspace"
import { PartitionTreeWorkspace } from "../../partition-tree"
import { SkuSelectionHeader } from "../../sku-selection/sku-selection-header"
import { SkuSelectionTable } from "../../sku-selection/sku-selection-table"
import { WorkflowModal } from "../../workflow/workflow-modal"
import {
  PartitionWorkspaceFrame,
  SkuSelectionLoadError,
  useSkuSelectionRows,
} from "../../shared/partition-workspace-helpers"
import { useWorkspace } from "../../workspace-provider"
import {
  useVisualizationWorkspace,
  visualizationDisplayStatus,
  visualizationResultOf,
  visualizationTaskIdOf,
} from "./visualization-workspace-provider"

const VISUALIZATION_RUN_PAYLOAD = {
  metrics: ["chi", "phi"],
  include_attributes: true,
  include_roi_matrix: false,
  random_state: 1234,
} satisfies RunVisualizationPayload

const ACTIVE_VISUALIZATION_STATUSES = new Set<VisualizationWorkflowStatus>([
  "QUEUED",
  "RUNNING",
])

export function VisualizationPartitionWorkspace({
  caseData,
  partitionData,
}: {
  caseData: Case
  partitionData: Partition
}) {
  const queryClient = useQueryClient()
  const { showToast } = useUI()
  const {
    state: {
      primaryTab,
      secondaryTab,
      selectedSkus,
      skuSelectionDirty,
      search,
    },
    actions: {
      selectPrimaryTab,
      selectSecondaryTab,
      setSearch,
      setSkuSelection,
      markSkuDirty,
      markSkuSelectionSaved,
      markVisualizationCompleted,
    },
    meta: { postSelectionUnlocked, secondaryTabs, canEditPartition },
  } = useWorkspace()

  const {
    state: { runModal, visualization },
    actions: {
      openRunModal,
      closeRunModal,
      startVisualization,
      setVisualizationRunning,
      completeVisualization,
      failVisualization,
    },
  } = useVisualizationWorkspace()

  const visualizationStatus = visualizationDisplayStatus(visualization)
  const visualizationResult = visualizationResultOf(visualization)
  const visualizationTaskId = visualizationTaskIdOf(visualization)

  const skuSelectionQueryKey = useMemo(
    () => ["sku-selection", caseData.id, partitionData.id] as const,
    [caseData.id, partitionData.id]
  )
  const visualizationLatestQueryKey = useMemo(
    () => ["visualization-latest", caseData.id, partitionData.id] as const,
    [caseData.id, partitionData.id]
  )

  const skuSelectionQuery = useQuery({
    queryKey: skuSelectionQueryKey,
    queryFn: () => WorkflowApi.getSkuSelection(caseData.id, partitionData.id),
  })
  const visualizationLatestQuery = useQuery({
    queryKey: visualizationLatestQueryKey,
    queryFn: async () => {
      try {
        return await WorkflowApi.getVisualizationLatest(
          caseData.id,
          partitionData.id
        )
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null
        }
        throw error
      }
    },
    retry: false,
  })
  const visualizationStatusQuery = useQuery({
    queryKey: [
      "visualization-status",
      caseData.id,
      partitionData.id,
      visualizationTaskId,
    ],
    queryFn: () =>
      WorkflowApi.pollVisualizationStatus(
        caseData.id,
        partitionData.id,
        visualizationTaskId ?? ""
      ),
    enabled: Boolean(visualizationTaskId),
    refetchInterval: visualizationTaskId ? 2000 : false,
  })

  const runVisualizationMutation = useMutation({
    mutationFn: () => {
      if (!canEditPartition) {
        throw new Error("Acquire the partition lock before running visualization.")
      }
      return WorkflowApi.runVisualization(
        caseData.id,
        partitionData.id,
        VISUALIZATION_RUN_PAYLOAD
      )
    },
    onMutate: () => {
      startVisualization()
    },
    onSuccess: async (response) => {
      if (response.status === "COMPLETED" && response.result) {
        completeVisualization(response.result)
        markVisualizationCompleted(true)
        await queryClient.invalidateQueries({
          queryKey: visualizationLatestQueryKey,
        })
        showToast("Workflow completed", "success", {
          description: "Visualization workflow completed successfully.",
        })
      } else if (ACTIVE_VISUALIZATION_STATUSES.has(response.status)) {
        setVisualizationRunning(response.status, response.task_id ?? null)
        showToast("Workflow started", "success", {
          description: "Visualization workflow has started running.",
        })
      }
    },
    onError: (error) => {
      failVisualization(error instanceof Error ? error.message : undefined)
      showToast("Workflow execution failed", "error", {
        description:
          error instanceof Error
            ? error.message
            : "Visualization workflow could not be started.",
      })
    },
  })

  const saveSkuSelectionMutation = useMutation({
    mutationFn: () => {
      if (!canEditPartition) {
        throw new Error("Acquire the partition lock before saving SKU selections.")
      }
      return WorkflowApi.updateSkuSelection(caseData.id, partitionData.id, {
        selected_skus: selectedSkus,
      })
    },
    onSuccess: async (response) => {
      setSkuSelection(response.selected_skus)
      markSkuDirty(false)
      markSkuSelectionSaved(true)
      await queryClient.invalidateQueries({ queryKey: skuSelectionQueryKey })
      showToast("SKU selection saved", "success", {
        description: "Your selection was updated and computation has started.",
      })
      runVisualizationMutation.mutate()
    },
    onError: (error) => {
      showToast("Save failed", "error", {
        description:
          error instanceof Error
            ? error.message
            : "SKU selection could not be saved.",
      })
    },
  })

  const { skuRows, filteredRows, skuShownCount, setSkuShownCount } =
    useSkuSelectionRows(skuSelectionQuery.data?.rows, search)
  const skuColumns = useMemo(
    () => skuSelectionQuery.data?.columns ?? [],
    [skuSelectionQuery.data?.columns]
  )

  const selectedCount = selectedSkus.length
  const allSelected = skuRows.length > 0 && selectedCount === skuRows.length
  const canSubmitSkuSelection =
    canEditPartition && caseData.can_create_partitions
  const submitDisabled =
    saveSkuSelectionMutation.isPending ||
    runVisualizationMutation.isPending ||
    !canSubmitSkuSelection ||
    selectedCount < 3
  const submitLabel =
    postSelectionUnlocked && skuSelectionDirty ? "Re-Compute" : "Submit"

  function toggleSku(skuId: string, checked: boolean) {
    if (!canEditPartition) return
    markSkuDirty(true)
    setSkuSelection((cur) =>
      checked
        ? Array.from(new Set([...cur, skuId]))
        : cur.filter((id) => id !== skuId)
    )
  }

  function toggleAll(checked: boolean) {
    if (!canEditPartition) return
    markSkuDirty(true)
    setSkuSelection(checked ? skuRows.map((s) => s.id) : [])
  }

  function excludeMdsSkus(skuIds: string[]) {
    if (!canEditPartition) {
      showToast("Read-only partition", "error", {
        description: "Acquire the partition lock before changing SKU selections.",
      })
      return
    }
    const excludedIds = new Set(skuIds)
    const excludedSelectedCount = selectedSkus.filter((id) =>
      excludedIds.has(id)
    ).length

    selectPrimaryTab("sku-selection")
    selectSecondaryTab("overview")

    if (excludedSelectedCount === 0) {
      showToast("No action required", "info", {
        description: "Current excluded SKUs are already unchecked.",
      })
      return
    }

    markSkuDirty(true)
    setSkuSelection((cur) => cur.filter((id) => !excludedIds.has(id)))
    showToast("SKUs excluded", "success", {
      description: `Excluded ${excludedSelectedCount} ${
        excludedSelectedCount === 1 ? "SKU" : "SKUs"
      }. Review changes and re-compute.`,
    })
  }

  function submitSkuSelection() {
    if (!canEditPartition) {
      showToast("Read-only partition", "error", {
        description: "Acquire the partition lock before saving SKU selections.",
      })
      return
    }
    if (!caseData.can_create_partitions) {
      showToast("Permission denied", "error", {
        description: "You do not have permission to save SKU selections.",
      })
      return
    }
    if (selectedCount < 3) {
      showToast("Invalid SKU selection", "error", {
        description: "Please select at least 3 SKUs to proceed.",
      })
      return
    }
    saveSkuSelectionMutation.mutate()
  }

  useEffect(() => {
    if (skuSelectionDirty) return
    setSkuSelection(skuSelectionQuery.data?.selected_skus ?? [])
  }, [
    setSkuSelection,
    skuSelectionDirty,
    skuSelectionQuery.data?.selected_skus,
  ])

  useEffect(() => {
    if (skuSelectionQuery.data?.meta.has_saved_selection) {
      markSkuSelectionSaved(true)
    }
  }, [markSkuSelectionSaved, skuSelectionQuery.data?.meta.has_saved_selection])

  useEffect(() => {
    if (visualizationLatestQuery.data?.result) {
      completeVisualization(visualizationLatestQuery.data.result)
      markVisualizationCompleted(true)
    }
  }, [
    completeVisualization,
    markVisualizationCompleted,
    visualizationLatestQuery.data?.result,
  ])

  useEffect(() => {
    const statusData = visualizationStatusQuery.data
    if (!statusData) return

    if (statusData.status === "COMPLETED" && statusData.result) {
      completeVisualization(statusData.result)
      markVisualizationCompleted(true)
      void queryClient.invalidateQueries({
        queryKey: visualizationLatestQueryKey,
      })
    } else if (statusData.status === "FAILED") {
      failVisualization(statusData.error)
    } else if (ACTIVE_VISUALIZATION_STATUSES.has(statusData.status)) {
      setVisualizationRunning(statusData.status, visualizationTaskId)
    }
  }, [
    completeVisualization,
    failVisualization,
    markVisualizationCompleted,
    queryClient,
    setVisualizationRunning,
    visualizationLatestQueryKey,
    visualizationStatusQuery.data,
    visualizationTaskId,
  ])

  return (
    <PartitionWorkspaceFrame
      caseData={caseData}
      partitionData={partitionData}
    >
      {primaryTab === "sku-selection" && (
        <>
          <SkuSelectionHeader
            tabs={secondaryTabs}
            activeTab={secondaryTab}
            onTabChange={selectSecondaryTab}
            disabledTabs={
              postSelectionUnlocked ? [] : ["multi-dimensional-scaling"]
            }
          />

          {secondaryTab === "overview" && (
            <>
              <div className="flex flex-col gap-3 px-8 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Select SKUs to include and submit
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedCount} of {skuRows.length} selected
                    {skuShownCount !== skuRows.length &&
                      ` · ${skuShownCount} shown`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <VisualizationWorkflowCompleteBadge
                    status={visualizationStatus}
                  />
                  <div className="relative">
                    <SearchIcon
                      size={12}
                      className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="text"
                      placeholder="Filter…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 w-44 rounded-none border-b border-border bg-transparent pr-3 pl-7 text-xs transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                    />
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 rounded-none px-3 text-xs font-medium"
                    disabled={submitDisabled}
                    title={
                      !canEditPartition
                        ? "Acquire the partition lock to save SKU selections."
                        : !caseData.can_create_partitions
                          ? "You do not have permission to save SKU selections."
                          : selectedCount < 3
                          ? "Select at least 3 SKUs."
                          : undefined
                    }
                    onClick={submitSkuSelection}
                  >
                    {saveSkuSelectionMutation.isPending ||
                    runVisualizationMutation.isPending ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <CheckIcon data-icon="inline-start" />
                    )}
                    {submitLabel}
                  </Button>
                </div>
              </div>

              <VisualizationWorkflowNotice
                status={visualizationStatus}
                errorMessage={
                  visualizationStatusQuery.data?.error ??
                  (visualizationStatusQuery.error instanceof Error
                    ? visualizationStatusQuery.error.message
                    : undefined)
                }
                onRetry={() => {
                  if (canEditPartition) runVisualizationMutation.mutate()
                }}
                canRetry={canEditPartition}
              />

              {skuSelectionQuery.isLoading && (
                <p className="px-8 py-12 text-center text-xs text-muted-foreground">
                  Loading SKU selection...
                </p>
              )}

              {skuSelectionQuery.error && (
                <SkuSelectionLoadError
                  error={skuSelectionQuery.error}
                  onRetry={() => void skuSelectionQuery.refetch()}
                />
              )}

              {!skuSelectionQuery.isLoading && !skuSelectionQuery.error && (
                <SkuSelectionTable
                  columns={skuColumns}
                  rows={filteredRows}
                  selectedIds={selectedSkus}
                  allSelected={allSelected}
                  onToggleAll={toggleAll}
                  onToggleSku={toggleSku}
                  onFilteredRowCountChange={setSkuShownCount}
                  showSelection={canEditPartition}
                />
              )}
            </>
          )}

          {secondaryTab === "multi-dimensional-scaling" && (
            <MdsWorkspace
              visualizationResult={visualizationResult}
              skuRows={skuRows}
              skuColumns={skuColumns}
              onExcludeSkus={excludeMdsSkus}
            />
          )}
        </>
      )}

      {primaryTab === "partition-tree" && (
        <PartitionTreeWorkspace
          caseId={caseData.id}
          partitionId={partitionData.id}
          partitionName={partitionData.name}
          canEdit={canEditPartition && caseData.can_create_partitions}
          onRunNode={({ nodeName, node }) => {
            if (!canEditPartition) return
            openRunModal(node ?? null, nodeName)
          }}
        />
      )}

      <WorkflowModal
        open={runModal !== null}
        onOpenChange={(open) => {
          if (!open) closeRunModal()
        }}
        title={runModal?.title}
        visualizationResult={visualizationResult}
        caseId={caseData.id}
        partitionId={partitionData.id}
        node={runModal?.node ?? null}
        canEdit={canEditPartition && caseData.can_create_partitions}
      />
    </PartitionWorkspaceFrame>
  )
}

function VisualizationWorkflowNotice({
  status,
  errorMessage,
  onRetry,
  canRetry,
}: {
  status: VisualizationWorkflowStatus | null
  errorMessage?: string
  onRetry: () => void
  canRetry: boolean
}) {
  if (!status || status === "NOT_FOUND" || status === "COMPLETED") return null

  if (status === "FAILED") {
    return (
      <div className="px-8 pt-4">
        <Alert variant="destructive">
          <RefreshCwIcon aria-hidden="true" />
          <AlertTitle>Visualization workflow failed</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              {errorMessage || "The workflow could not be completed."}
            </span>
            <Button variant="outline" onClick={onRetry} disabled={!canRetry}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry workflow
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return null
}

function VisualizationWorkflowCompleteBadge({
  status,
}: {
  status: VisualizationWorkflowStatus | null
}) {
  const isActive = status === "QUEUED" || status === "RUNNING"
  const isComplete = status === "COMPLETED"

  if (!isActive && !isComplete) return null

  return (
    <div
      className="flex h-8 shrink-0 items-center gap-2 text-[11px] leading-none text-muted-foreground"
      role="status"
      aria-label={
        isComplete
          ? "Workflow progress complete."
          : "Workflow progress running."
      }
    >
      {isComplete ? (
        <CheckIcon aria-hidden="true" className="size-3.5 text-primary" />
      ) : (
        <Spinner aria-hidden="true" className="size-3.5" />
      )}
      <span className="font-medium tracking-wide">Workflow Progress</span>
    </div>
  )
}
