import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckIcon, LockIcon, RefreshCwIcon, SearchIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import {
  CompareCoverageWorkspace,
  DatasetChip,
  MdsWorkspace,
  ObmWorkspace,
  SkuMathWorkspace,
  WorkspaceProvider,
  PartitionWorkspaceSkeleton,
  PartitionTreeWorkspace,
  SkuSelectionHeader,
  SkuSelectionTable,
  TabBtn,
  VisualizationWorkspace,
  WorkflowModal,
  useRoiResult,
  useWorkspace,
  visualizationDisplayStatus,
  visualizationResultOf,
  visualizationTaskIdOf,
  type SkuRow,
} from "@/components/features/workspace"
import {
  ApiError,
  CaseApi,
  PartitionApi,
  WorkflowApi,
  UserApi,
} from "@/core/api"
import type {
  Case,
  Partition,
  RunVisualizationPayload,
  VisualizationWorkflowStatus,
} from "@/core/api"
import { Permission, RequirePermission } from "@/core/rbac"
import { useUI } from "@/core/ui"
import { WorkflowProvider, useWorkflow } from "@/core/workflow"

export const Route = createFileRoute(
  "/_authed/cases/$caseId/partitions/$partitionId"
)({
  component: PartitionWorkspacePage,
})

const datasetBadges = [
  { name: "POS", version: "V1" },
  { name: "Attributes", version: "V1" },
  { name: "Crosspurchase", version: "V1" },
]

// Well under the backend's default 10-minute lock TTL, so a renewal is never
// missed even if the tab is briefly backgrounded/throttled.
const LOCK_RENEW_INTERVAL_MS = 4 * 60 * 1000
// While we hold the lock, poll for it having been force-released elsewhere
// (e.g. a publisher releasing all locks to unblock dataset preprocessing).
const LOCK_WATCH_INTERVAL_MS = 20 * 1000

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
  const params = Route.useParams()
  const caseId = params.caseId
  const partitionId = params.partitionId
  const navigate = useNavigate()
  const { showToast } = useUI()

  const caseQuery = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => CaseApi.getCase(caseId),
  })
  // Share caches with the identical-key queries further down the tree.
  const currentUserQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: UserApi.getCurrentUser,
  })
  const usersQuery = useQuery({
    queryKey: ["assignable-users"],
    queryFn: UserApi.listUsers,
  })
  // `/me/` doesn't expose a user id; resolve it via email against the
  // assignable-users list (same approach the lock banner below uses).
  const selfUserId = useMemo(
    () =>
      usersQuery.data?.find((u) => u.email === currentUserQuery.data?.email)
        ?.id ?? null,
    [currentUserQuery.data?.email, usersQuery.data]
  )

  // Best-effort edit lock: acquired on entering the workspace, renewed on an
  // interval, released on leaving. While held, we also poll for it having
  // been force-released (e.g. a publisher unblocking dataset preprocessing)
  // and redirect out if so — there's no real-time push for this yet.
  const holdsLockRef = useRef(false)
  const [selfLockActive, setSelfLockActive] = useState(false)

  const partitionQuery = useQuery({
    queryKey: ["partition", caseId, partitionId],
    queryFn: () => PartitionApi.getPartition(caseId, partitionId),
    refetchInterval: selfLockActive ? LOCK_WATCH_INTERVAL_MS : false,
  })

  useEffect(() => {
    let cancelled = false

    PartitionApi.acquireLock(caseId, partitionId)
      .then(() => {
        if (cancelled) return
        holdsLockRef.current = true
        setSelfLockActive(true)
      })
      .catch(() => {
        // Someone else holds it, or the request failed — proceed read-only;
        // the lock banner below reflects whoever currently holds it.
      })
      .finally(() => {
        if (!cancelled) void partitionQuery.refetch()
      })

    return () => {
      cancelled = true
      if (holdsLockRef.current) {
        holdsLockRef.current = false
        void PartitionApi.releaseLock(caseId, partitionId).catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, partitionId])

  useEffect(() => {
    if (!selfLockActive) return
    const interval = setInterval(() => {
      PartitionApi.acquireLock(caseId, partitionId).catch(() => {
        // Renewal failed (e.g. force-released mid-interval) — the watch
        // effect below picks this up on its next partition refetch.
      })
    }, LOCK_RENEW_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [caseId, partitionId, selfLockActive])

  useEffect(() => {
    if (!holdsLockRef.current || !selfUserId) return
    const lockedBy = partitionQuery.data?.locked_by
    if (lockedBy && lockedBy === selfUserId) return

    // We held the lock but it's no longer ours — force-released elsewhere.
    holdsLockRef.current = false
    setSelfLockActive(false)
    showToast("This partition was unlocked", "info", {
      description:
        "A publisher updated this case's datasets and released active partition locks. Returning to the case overview.",
    })
    void navigate({ to: "/cases/$caseId", params: { caseId } })
  }, [caseId, navigate, partitionQuery.data?.locked_by, selfUserId, showToast])

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
      <PartitionWorkspaceContent
        caseData={caseQuery.data}
        partitionData={partitionQuery.data}
      />
    </WorkflowProvider>
  )
}

function PartitionWorkspaceContent({
  caseData,
  partitionData,
}: {
  caseData: Case
  partitionData: Partition
}) {
  const workflow = useWorkflow()

  return (
    <WorkspaceProvider workflow={workflow} methodology={caseData.methodology}>
      <PartitionWorkspaceContentInner
        caseData={caseData}
        partitionData={partitionData}
      />
    </WorkspaceProvider>
  )
}

function PartitionWorkspaceContentInner({
  caseData,
  partitionData,
}: {
  caseData: Case
  partitionData: Partition
}) {
  const workflow = useWorkflow()
  const queryClient = useQueryClient()
  const { showToast } = useUI()
  const {
    state: {
      primaryTab,
      secondaryTab,
      selectedSkus,
      skuSelectionDirty,
      search,
      runModal,
      visualization,
    },
    actions: {
      selectPrimaryTab,
      selectSecondaryTab,
      setSearch,
      setSkuSelection,
      markSkuDirty,
      markSkuSelectionSaved,
      openRunModal,
      closeRunModal,
      startVisualization,
      setVisualizationRunning,
      completeVisualization,
      failVisualization,
    },
    meta: { isVisualization, postSelectionUnlocked, secondaryTabs },
  } = useWorkspace()

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
    // A taskId only exists while the run is in flight, so its presence alone
    // is the poll signal.
    enabled: Boolean(visualizationTaskId),
    refetchInterval: visualizationTaskId ? 2000 : false,
  })

  const roiTabActive =
    primaryTab === "sku-math" ||
    primaryTab === "obm" ||
    (primaryTab === "sku-selection" && secondaryTab === "compare-coverage")

  const roi = useRoiResult({
    caseId: caseData.id,
    partitionId: partitionData.id,
    savedSelectedSkus: skuSelectionQuery.data?.selected_skus,
    enabled: roiTabActive && !isVisualization,
  })

  const goToSkuSelection = useCallback(() => {
    selectPrimaryTab("sku-selection")
    selectSecondaryTab("overview")
  }, [selectPrimaryTab, selectSecondaryTab])

  const currentUserQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: UserApi.getCurrentUser,
  })

  const usersQuery = useQuery({
    queryKey: ["assignable-users"],
    queryFn: UserApi.listUsers,
  })

  const isLockedBySelf = useMemo(() => {
    const email = currentUserQuery.data?.email
    if (!email || !partitionData.locked_by) return false

    // Direct email match (if backend stores email for locked_by)
    if (partitionData.locked_by === email) return true

    // ID match by looking up ID in the users list
    if (usersQuery.data) {
      const selfUser = usersQuery.data.find((u) => u.email === email)
      if (selfUser && selfUser.id === partitionData.locked_by) return true
    }

    return false
  }, [currentUserQuery.data?.email, partitionData.locked_by, usersQuery.data])

  const showLockBanner = Boolean(partitionData.locked_by) && !isLockedBySelf

  const runVisualizationMutation = useMutation({
    mutationFn: () =>
      WorkflowApi.runVisualization(
        caseData.id,
        partitionData.id,
        VISUALIZATION_RUN_PAYLOAD
      ),
    onMutate: () => {
      startVisualization()
    },
    onSuccess: async (response) => {
      if (response.status === "COMPLETED" && response.result) {
        completeVisualization(response.result)
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
    mutationFn: () =>
      WorkflowApi.updateSkuSelection(caseData.id, partitionData.id, {
        selected_skus: selectedSkus,
      }),
    onSuccess: async (response) => {
      setSkuSelection(response.selected_skus)
      markSkuDirty(false)
      markSkuSelectionSaved(true)
      await queryClient.invalidateQueries({ queryKey: skuSelectionQueryKey })
      showToast("SKU selection saved", "success", {
        description: isVisualization
          ? "Your selection was updated and computation has started."
          : "Your selection was updated.",
      })
      // Only the visualization methodology runs the chi/phi association
      // pipeline here. ROI's sku-math/obm/coverage tabs pick up the new
      // selection on their own via useRoiResult's auto-run (keyed off the
      // saved-selection signature) — dispatching the visualization workflow
      // for ROI cases would run the wrong pipeline entirely.
      if (isVisualization) {
        runVisualizationMutation.mutate()
      }
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

  const skuRows = useMemo(
    () => (skuSelectionQuery.data?.rows ?? []).map(normalizeSkuSelectionRow),
    [skuSelectionQuery.data?.rows]
  )
  const skuColumns = useMemo(
    () => skuSelectionQuery.data?.columns ?? [],
    [skuSelectionQuery.data?.columns]
  )

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return skuRows
    return skuRows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(q))
    )
  }, [search, skuRows])

  // Count of rows actually shown after the table's per-column filters.
  const [skuShownCount, setSkuShownCount] = useState(filteredRows.length)

  const selectedCount = selectedSkus.length
  const allSelected = skuRows.length > 0 && selectedCount === skuRows.length
  const canSubmitSkuSelection = caseData.can_create_partitions
  const submitDisabled =
    saveSkuSelectionMutation.isPending ||
    runVisualizationMutation.isPending ||
    !canSubmitSkuSelection ||
    selectedCount < 3
  const submitLabel =
    postSelectionUnlocked && skuSelectionDirty ? "Re-Compute" : "Submit"

  const lockedBy = useMemo(
    () =>
      `${
        partitionData.locked_by_display_name ||
        partitionData.locked_by ||
        "soham.datta@bain.com"
      } `,
    [partitionData]
  )

  function toggleSku(skuId: string, checked: boolean) {
    markSkuDirty(true)
    setSkuSelection((cur) =>
      checked
        ? Array.from(new Set([...cur, skuId]))
        : cur.filter((id) => id !== skuId)
    )
  }

  function toggleAll(checked: boolean) {
    markSkuDirty(true)
    setSkuSelection(checked ? skuRows.map((s) => s.id) : [])
  }

  function excludeMdsSkus(skuIds: string[]) {
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
    if (!canSubmitSkuSelection) {
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
    }
  }, [completeVisualization, visualizationLatestQuery.data?.result])

  useEffect(() => {
    const statusData = visualizationStatusQuery.data
    if (!statusData) return

    if (statusData.status === "COMPLETED" && statusData.result) {
      completeVisualization(statusData.result)
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
    queryClient,
    setVisualizationRunning,
    visualizationLatestQueryKey,
    visualizationStatusQuery.data,
    visualizationTaskId,
  ])

  useEffect(() => {
    if (!workflow.primaryTabs.some((tab) => tab.value === primaryTab)) {
      selectPrimaryTab(workflow.primaryTabs[0]?.value ?? "")
    }
    if (primaryTab === "visualization" && !postSelectionUnlocked) {
      selectPrimaryTab("sku-selection")
    }
    if (primaryTab === "partition-tree" && !postSelectionUnlocked) {
      selectPrimaryTab("sku-selection")
    }
  }, [
    isVisualization,
    primaryTab,
    selectPrimaryTab,
    postSelectionUnlocked,
    workflow.primaryTabs,
  ])

  useEffect(() => {
    if (secondaryTabs.length === 0) {
      if (secondaryTab) {
        selectSecondaryTab("")
      }
      return
    }

    if (!secondaryTabs.some((tab) => tab.value === secondaryTab)) {
      selectSecondaryTab(secondaryTabs[0]?.value ?? "")
    }
    if (
      (secondaryTab === "multi-dimensional-scaling" ||
        secondaryTab === "compare-coverage") &&
      !postSelectionUnlocked
    ) {
      selectSecondaryTab("overview")
    }
  }, [secondaryTab, secondaryTabs, selectSecondaryTab, postSelectionUnlocked])

  return (
    <div className="-my-6 ml-[calc(50%-50vw)] flex min-h-[calc(100svh-3.5rem)] w-screen flex-col bg-background lg:-my-8">
      {/* Lock notice */}
      {showLockBanner && (
        <div className="flex h-8 shrink-0 items-center justify-center gap-2 border-b bg-primary text-xs text-primary-foreground/80">
          <LockIcon size={11} aria-hidden="true" />
          <span>
            This partition is currently in use by{" "}
            <span className="text-primary-foreground">{lockedBy}</span>
          </span>
        </div>
      )}

      {/* Header */}
      <header className="relative flex shrink-0 overflow-hidden border-b border-border bg-background text-foreground select-none">
        <div
          className="absolute inset-0 bg-cover bg-position-[500px_750px] opacity-20"
          style={{ backgroundImage: "url('/header-bg.jpg')" }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center justify-between gap-6 px-8 py-5">
          <div className="flex min-w-0 flex-col gap-2">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link className="hover:text-foreground" to="/cases">
                Cases
              </Link>
              <span className="opacity-40">/</span>
              <Link
                className="hover:text-foreground"
                to="/cases/$caseId"
                params={{ caseId: caseData.id }}
              >
                {caseData.name ?? "Partitions"}
              </Link>
              <span className="opacity-40">/</span>
              <span className="text-foreground/85">Workflow</span>
            </nav>

            {/* Title row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="text-base font-semibold tracking-tight">
                {partitionData.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {datasetBadges.map((dataset) => (
                  <DatasetChip key={dataset.name} dataset={dataset} />
                ))}
              </div>
              <div className="hidden">
                {datasetBadges
                  .map((dataset) => `${dataset.name} ${dataset.version}`)
                  .join(" / ")}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Primary tabs */}
      <TooltipProvider>
        <div className="sticky top-13 z-31 border-b bg-background">
          <div className="flex h-12 items-center gap-0 overflow-x-auto px-8">
            {workflow.primaryTabs.map((tab) => {
              const isLocked =
                tab.value === "partition-tree" && !postSelectionUnlocked

              const isDisabled =
                (tab.value === "visualization" && !postSelectionUnlocked) ||
                isLocked

              const tabBtn = (
                <TabBtn
                  key={tab.value}
                  isActive={primaryTab === tab.value}
                  onClick={() => selectPrimaryTab(tab.value)}
                  size="md"
                  disabled={isDisabled}
                >
                  {tab.label}
                </TabBtn>
              )

              if (isLocked) {
                return (
                  <Tooltip key={tab.value}>
                    <TooltipTrigger
                      render={
                        <span className="inline-block cursor-not-allowed">
                          {tabBtn}
                        </span>
                      }
                    />
                    <TooltipContent>
                      Run the workflow in SKU Selection to unlock this tab
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return tabBtn
            })}
          </div>
        </div>
      </TooltipProvider>

      {/* Main */}
      <div className="flex flex-1 flex-col bg-background">
        <div className="flex flex-1 flex-col">
          {primaryTab === "sku-selection" && (
            <>
              <SkuSelectionHeader
                tabs={secondaryTabs}
                activeTab={secondaryTab}
                onTabChange={selectSecondaryTab}
                disabledTabs={
                  postSelectionUnlocked
                    ? []
                    : ["multi-dimensional-scaling", "compare-coverage"]
                }
              />

              {secondaryTab === "overview" && (
                <>
                  {/* Toolbar */}
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
                          !canSubmitSkuSelection
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
                    isPolling={visualizationStatusQuery.isFetching}
                    errorMessage={
                      visualizationStatusQuery.data?.error ??
                      (visualizationStatusQuery.error instanceof Error
                        ? visualizationStatusQuery.error.message
                        : undefined)
                    }
                    onRetry={() => runVisualizationMutation.mutate()}
                  />

                  {skuSelectionQuery.isLoading && (
                    <p className="px-8 py-12 text-center text-xs text-muted-foreground">
                      Loading SKU selection...
                    </p>
                  )}

                  {skuSelectionQuery.error && (
                    <div className="px-8 pt-4">
                      <Alert variant="destructive">
                        <RefreshCwIcon aria-hidden="true" />
                        <AlertTitle>
                          SKU selection could not be loaded
                        </AlertTitle>
                        <AlertDescription className="flex flex-col gap-3">
                          <span>
                            {skuSelectionQuery.error instanceof Error
                              ? skuSelectionQuery.error.message
                              : "Unknown error"}
                          </span>
                          <Button
                            variant="outline"
                            onClick={() => void skuSelectionQuery.refetch()}
                          >
                            <RefreshCwIcon data-icon="inline-start" />
                            Retry
                          </Button>
                        </AlertDescription>
                      </Alert>
                    </div>
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

              {secondaryTab === "compare-coverage" && (
                <CompareCoverageWorkspace
                  roi={roi}
                  onGoToSkuSelection={goToSkuSelection}
                />
              )}
            </>
          )}

          {primaryTab === "visualization" && (
            <VisualizationWorkspace visualizationResult={visualizationResult} />
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
              canEdit={caseData.can_create_partitions}
              // Visualization methodology delegates node runs to the
              // Sheet-based WorkflowModal (bubble charts + SKU list). ROI
              // omits the handler so the tree opens its own workflow dialog
              // (Attribute Selection / Overview / Base Testing / Level
              // Testing) — the flow ported from roi-tool.
              onRunNode={
                isVisualization
                  ? ({ nodeName, node }) => {
                      openRunModal(node ?? null, nodeName)
                    }
                  : undefined
              }
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
        </div>
      </div>

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
      />
    </div>
  )
}

function normalizeSkuSelectionRow(row: Record<string, unknown>): SkuRow {
  return {
    ...row,
    id: String(row.skuname_ean ?? row.id ?? ""),
  }
}

function VisualizationWorkflowNotice({
  status,
  errorMessage,
  onRetry,
}: {
  status: VisualizationWorkflowStatus | null
  isPolling?: boolean
  errorMessage?: string
  onRetry: () => void
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
            <Button variant="outline" onClick={onRetry}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry workflow
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Queued/running progress is shown inline by the toolbar tick bar.
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
