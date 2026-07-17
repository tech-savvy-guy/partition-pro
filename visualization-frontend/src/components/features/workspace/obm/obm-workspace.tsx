import { useCallback, useMemo, useState } from "react"
import { NetworkIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import type { RoiResult } from "@/core/api"
import { cn } from "@/lib/utils"
import {
  DEFAULT_HEATMAP_DECIMAL_PLACES,
  buildHeatmapMetaFromStartStep,
  computeBaseTestingHeatmapMetaFromMatrix,
  formatHeatmapNumber,
  getBaseTestingHeatmapLegendBins,
  getBaseTestingHeatmapStyle,
} from "@/lib/partition-tree/heatmap"
import {
  exportExcelTable,
  type ExcelCell,
} from "@/lib/partition-tree/excel-export"
import { buildObmView, roiExportFilename, type ObmView } from "@/lib/roi"

import { RoiGate } from "../shared/roi-gate"
import { RoiHeatmapToolbar } from "../shared/roi-heatmap-toolbar"
import type { UseRoiResultReturn } from "../shared/use-roi-result"
import { ObmTable } from "./obm-table"
import { ObmSkeleton } from "./obm-skeleton"

/**
 * OBM workspace (re-skin of the ROI OBM screen): heatmap legend toolbar with
 * the "OBM holds" verdict badge over the leaf-by-leaf ROI rollup table, fed
 * by the shared route-level ROI state.
 */
export function ObmWorkspace({
  roi,
  caseName,
  partitionName,
  onGoToSkuSelection,
}: {
  roi: UseRoiResultReturn
  caseName?: string
  partitionName?: string
  onGoToSkuSelection?: () => void
}) {
  return (
    <RoiGate
      state={roi.state}
      retry={roi.retry}
      skeleton={<ObmSkeleton />}
      onGoToSkuSelection={onGoToSkuSelection}
    >
      {(result, isRefreshing) => (
        <ObmContent
          result={result}
          isRefreshing={isRefreshing}
          caseName={caseName}
          partitionName={partitionName}
        />
      )}
    </RoiGate>
  )
}

function ObmContent({
  result,
  isRefreshing,
  caseName,
  partitionName,
}: {
  result: RoiResult
  isRefreshing: boolean
  caseName?: string
  partitionName?: string
}) {
  const view = useMemo(
    () => (result.obm ? buildObmView(result.obm) : null),
    [result.obm]
  )

  if (!view) {
    return (
      <div className="flex flex-1 flex-col bg-background p-6">
        <Empty className="flex-1 border border-dashed border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <NetworkIcon />
            </EmptyMedia>
            <EmptyTitle>No OBM results</EmptyTitle>
            <EmptyDescription>
              OBM needs at least one partition-tree leaf. Build the partition
              tree, then re-run the workflow.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <ObmResultView
      view={view}
      isRefreshing={isRefreshing}
      caseName={caseName}
      partitionName={partitionName}
    />
  )
}

function ObmResultView({
  view,
  isRefreshing,
  caseName,
  partitionName,
}: {
  view: ObmView
  isRefreshing: boolean
  caseName?: string
  partitionName?: string
}) {
  // Heatmap controls are client-side view state only (no persistence). The
  // OBM diagonal is a real mean ROI, so the diagonal-min autostart applies.
  const [override, setOverride] = useState<{
    start: number
    step: number
  } | null>(null)
  const [decimalPlaces, setDecimalPlaces] = useState(
    DEFAULT_HEATMAP_DECIMAL_PLACES
  )

  const autoMeta = useMemo(
    () => computeBaseTestingHeatmapMetaFromMatrix(view.cellMatrix),
    [view.cellMatrix]
  )
  const meta = useMemo(() => {
    if (!override) return autoMeta
    const overrideMeta = buildHeatmapMetaFromStartStep(
      override.start,
      override.step
    )
    return overrideMeta.thresholds ? overrideMeta : autoMeta
  }, [autoMeta, override])
  const bins = useMemo(
    () => getBaseTestingHeatmapLegendBins(meta, decimalPlaces),
    [meta, decimalPlaces]
  )

  const exportAsExcel = useCallback(() => {
    const headers: ExcelCell[] = [
      "Holds",
      "#SKUs",
      "Partition",
      ...view.valueColumns,
    ].map((value) => ({ value, header: true }))
    const rows: ExcelCell[][] = view.rows.map((row) => [
      {
        value: row.holds ? "TRUE" : "FALSE",
        style: row.holds
          ? {
              backgroundColor: "#dcfce7",
              color: "#166534",
              fontWeight: 700,
              textAlign: "center",
            }
          : {
              backgroundColor: "#fee2e2",
              color: "#7f1d1d",
              fontWeight: 700,
              textAlign: "center",
            },
      },
      { value: row.skuCount, style: { textAlign: "center" } },
      { value: row.label, style: { backgroundColor: "#f9fafb" } },
      ...row.cells.map((cell) => ({
        value: formatHeatmapNumber(cell, decimalPlaces),
        style: getBaseTestingHeatmapStyle(cell, meta),
      })),
    ])
    exportExcelTable({
      filename: roiExportFilename([caseName, partitionName], "obm"),
      sheetName: "OBM",
      rows: [headers, ...rows],
    })
  }, [caseName, decimalPlaces, meta, partitionName, view])

  return (
    <div className="flex flex-1 flex-col gap-4 bg-background p-6">
      <RoiHeatmapToolbar
        title="OBM"
        start={meta.start}
        step={meta.step}
        startLabel="Start (min non-zero diagonal)"
        decimalPlaces={decimalPlaces}
        bins={bins}
        onStartStepSubmit={setOverride}
        onDecimalPlacesChange={setDecimalPlaces}
        onReset={override ? () => setOverride(null) : undefined}
        onExport={view.rows.length ? exportAsExcel : undefined}
      >
        <Badge
          variant="outline"
          className={cn(
            "rounded-none",
            view.obmHolds ? "text-primary" : "text-destructive"
          )}
        >
          OBM holds: {view.obmHolds ? "Yes" : "No"}
        </Badge>
        {isRefreshing ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Spinner className="size-3" aria-hidden="true" />
            Recomputing with the new SKU selection…
          </span>
        ) : null}
      </RoiHeatmapToolbar>

      <ObmTable view={view} meta={meta} decimalPlaces={decimalPlaces} />
    </div>
  )
}
