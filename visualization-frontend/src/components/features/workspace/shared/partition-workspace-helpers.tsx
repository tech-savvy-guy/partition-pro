import { useEffect, useMemo, useState } from "react"
import { RefreshCwIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { type Case, type Partition } from "@/core/api"
import { useWorkspace } from "../workspace-provider"
import { PartitionWorkspaceShell } from "./partition-workspace-shell"
import type { SkuRow } from "../sku-selection/sku-selection-table"

export function normalizeSkuSelectionRow(
  row: Record<string, unknown>
): SkuRow {
  return {
    ...row,
    id: String(row.skuname_ean ?? row.id ?? ""),
  }
}

export function useWorkspaceTabGuards() {
  const {
    state: { primaryTab, secondaryTab },
    actions: { selectPrimaryTab, selectSecondaryTab },
    meta: { postSelectionUnlocked, secondaryTabs },
    workflow,
  } = useWorkspace()

  useEffect(() => {
    if (!workflow.primaryTabs.some((tab) => tab.value === primaryTab)) {
      selectPrimaryTab(workflow.primaryTabs[0]?.value ?? "")
    }
    if (primaryTab === "partition-tree" && !postSelectionUnlocked) {
      selectPrimaryTab("sku-selection")
    }
  }, [
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
}

export function useSkuSelectionRows(
  rows: Array<Record<string, unknown>> | undefined,
  search: string
) {
  const skuRows = useMemo(
    () => (rows ?? []).map(normalizeSkuSelectionRow),
    [rows]
  )

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return skuRows
    return skuRows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(q))
    )
  }, [search, skuRows])

  const [skuShownCount, setSkuShownCount] = useState(filteredRows.length)

  return { skuRows, filteredRows, skuShownCount, setSkuShownCount }
}

export function PartitionWorkspaceFrame({
  caseData,
  partitionData,
  children,
}: {
  caseData: Case
  partitionData: Partition
  children: React.ReactNode
}) {
  useWorkspaceTabGuards()

  return (
    <PartitionWorkspaceShell caseData={caseData} partitionData={partitionData}>
      {children}
    </PartitionWorkspaceShell>
  )
}

export function SkuSelectionLoadError({
  error,
  onRetry,
}: {
  error: unknown
  onRetry: () => void
}) {
  return (
    <div className="px-8 pt-4">
      <Alert variant="destructive">
        <RefreshCwIcon aria-hidden="true" />
        <AlertTitle>SKU selection could not be loaded</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>
            {error instanceof Error ? error.message : "Unknown error"}
          </span>
          <Button variant="outline" onClick={onRetry}>
            <RefreshCwIcon data-icon="inline-start" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
