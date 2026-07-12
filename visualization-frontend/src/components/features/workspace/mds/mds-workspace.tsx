import { useEffect, useMemo, useState } from "react"

import {
  MDS_DEFAULT_THRESHOLD,
  clampMdsThreshold,
  type MdsDistanceFunction,
} from "@/lib/mds"
import type { VisualizationResult } from "@/core/api"
import {
  buildMdsHistogram,
  buildMdsMetrics,
  buildMdsSkuRows,
  getAvailableVisualizationMetrics,
  getExcludedMdsRows,
} from "@/lib/visualization"

import { MdsControlBar } from "./mds-control-bar"
import { MdsExcludedTable } from "./mds-excluded-table"
import { MdsHistogram } from "./mds-histogram"
import { MdsSummaryGrid } from "./mds-summary-grid"
import type { SkuRow } from "../sku-selection/sku-selection-table"

export function MdsWorkspace({
  visualizationResult,
  skuRows: selectionSkuRows = [],
  skuColumns = [],
  onExcludeSkus,
}: {
  visualizationResult?: VisualizationResult | null
  skuRows?: SkuRow[]
  skuColumns?: string[]
  onExcludeSkus?: (skuIds: string[]) => void
}) {
  const [distanceFunction, setDistanceFunction] =
    useState<MdsDistanceFunction>("chi")
  const [threshold, setThreshold] = useState(MDS_DEFAULT_THRESHOLD)
  const [search, setSearch] = useState("")
  const [entries, setEntries] = useState(10)
  const availableMetrics = useMemo(
    () => getAvailableVisualizationMetrics(visualizationResult),
    [visualizationResult]
  )
  const metrics = useMemo(
    () => buildMdsMetrics(visualizationResult),
    [visualizationResult]
  )
  const skuRows = useMemo(
    () => buildMdsSkuRows(visualizationResult),
    [visualizationResult]
  )

  const histogram = useMemo(
    () => buildMdsHistogram(skuRows, distanceFunction),
    [distanceFunction, skuRows]
  )
  const excludedCount = useMemo(
    () =>
      getExcludedMdsRows(skuRows, distanceFunction, threshold, "").length,
    [distanceFunction, skuRows, threshold]
  )
  const excludedSelectionRows = useMemo(() => {
    const excludedIds = new Set(
      getExcludedMdsRows(skuRows, distanceFunction, threshold, "").map(
        (row) => row.id
      )
    )
    const rows = selectionSkuRows.filter((row) => excludedIds.has(row.id))
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) return rows

    return rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(normalizedSearch)
      )
    )
  }, [distanceFunction, search, selectionSkuRows, skuRows, threshold])
  const excludedSkuIds = useMemo(
    () => excludedSelectionRows.map((row) => row.id),
    [excludedSelectionRows]
  )

  useEffect(() => {
    if (!availableMetrics.includes(distanceFunction)) {
      setDistanceFunction(availableMetrics[0] ?? "chi")
    }
  }, [availableMetrics, distanceFunction])

  function handleThresholdChange(value: number) {
    setThreshold(clampMdsThreshold(value))
  }

  if (!visualizationResult) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background px-8 py-12 text-sm text-muted-foreground">
        Visualization results are not available yet.
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <MdsControlBar
        totalSkus={skuRows.length}
        excludedSkus={excludedCount}
        distanceFunction={distanceFunction}
        availableDistanceFunctions={availableMetrics}
        threshold={threshold}
        onDistanceFunctionChange={setDistanceFunction}
        onThresholdChange={handleThresholdChange}
      />

      <MdsSummaryGrid metrics={metrics} />
      <MdsHistogram bins={histogram} threshold={threshold} />
      <MdsExcludedTable
        columns={skuColumns}
        rows={excludedSelectionRows}
        skuIds={excludedSkuIds}
        search={search}
        entries={entries}
        onExcludeSkus={onExcludeSkus}
        onSearchChange={setSearch}
        onEntriesChange={setEntries}
      />
    </div>
  )
}
