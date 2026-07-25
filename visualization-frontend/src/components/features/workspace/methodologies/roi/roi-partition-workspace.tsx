import { useCallback, useEffect, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { Case, Partition } from "@/core/api"
import { WorkflowApi } from "@/core/api"
import { useUI } from "@/core/ui"
import { CompareCoverageWorkspace } from "../../compare-coverage"
import { ObmWorkspace } from "../../obm"
import { PartitionTreeWorkspace } from "../../partition-tree"
import { SkuMathWorkspace } from "../../sku-math"
import { SkuSelectionHeader } from "../../sku-selection/sku-selection-header"
import { SkuSelectionTable } from "../../sku-selection/sku-selection-table"
import { useRoiResult } from "../../shared/use-roi-result"
import {
  PartitionWorkspaceFrame,
  SkuSelectionLoadError,
  useSkuSelectionRows,
} from "../../shared/partition-workspace-helpers"
import { useWorkspace } from "../../workspace-provider"

export function RoiPartitionWorkspace({
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
    },
    meta: { postSelectionUnlocked, secondaryTabs, canEditPartition },
  } = useWorkspace()

  const skuSelectionQueryKey = useMemo(
    () => ["sku-selection", caseData.id, partitionData.id] as const,
    [caseData.id, partitionData.id]
  )

  const skuSelectionQuery = useQuery({
    queryKey: skuSelectionQueryKey,
    queryFn: () => WorkflowApi.getSkuSelection(caseData.id, partitionData.id),
  })

  const roiTabActive =
    primaryTab === "sku-math" ||
    primaryTab === "obm" ||
    (primaryTab === "sku-selection" && secondaryTab === "compare-coverage")

  const roi = useRoiResult({
    caseId: caseData.id,
    partitionId: partitionData.id,
    savedSelectedSkus: skuSelectionQuery.data?.selected_skus,
    enabled: roiTabActive,
    canRun: canEditPartition,
  })

  const goToSkuSelection = useCallback(() => {
    selectPrimaryTab("sku-selection")
    selectSecondaryTab("overview")
  }, [selectPrimaryTab, selectSecondaryTab])

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
        description: "Your selection was updated.",
      })
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
            disabledTabs={postSelectionUnlocked ? [] : ["compare-coverage"]}
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
                    {saveSkuSelectionMutation.isPending ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <CheckIcon data-icon="inline-start" />
                    )}
                    {submitLabel}
                  </Button>
                </div>
              </div>

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

          {secondaryTab === "compare-coverage" && (
            <CompareCoverageWorkspace
              roi={roi}
              onGoToSkuSelection={goToSkuSelection}
            />
          )}
        </>
      )}

      {primaryTab === "sku-math" && (
        <SkuMathWorkspace
          roi={roi}
          caseName={caseData.name}
          partitionName={partitionData.name}
          onGoToSkuSelection={goToSkuSelection}
        />
      )}

      {primaryTab === "partition-tree" && (
        <PartitionTreeWorkspace
          caseId={caseData.id}
          partitionId={partitionData.id}
          partitionName={partitionData.name}
          canEdit={canEditPartition && caseData.can_create_partitions}
        />
      )}

      {primaryTab === "obm" && (
        <ObmWorkspace
          roi={roi}
          caseName={caseData.name}
          partitionName={partitionData.name}
          onGoToSkuSelection={goToSkuSelection}
        />
      )}
    </PartitionWorkspaceFrame>
  )
}
