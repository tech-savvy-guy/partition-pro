import { useCallback, useMemo, useState } from "react"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { RoiResult } from "@/core/api"
import {
  DEFAULT_HEATMAP_DECIMAL_PLACES,
  buildHeatmapMetaFromStartStep,
  formatHeatmapNumber,
  getBaseTestingHeatmapLegendBins,
  getBaseTestingHeatmapStyle,
} from "@/lib/partition-tree/heatmap"
import {
  exportExcelTable,
  type ExcelCell,
} from "@/lib/partition-tree/excel-export"
import {
  SKU_MATH_HEATMAP_DEFAULTS,
  buildSkuMathView,
  roiExportFilename,
} from "@/lib/roi"

import { RoiGate } from "../shared/roi-gate"
import { RoiHeatmapToolbar } from "../shared/roi-heatmap-toolbar"
import type { UseRoiResultReturn } from "../shared/use-roi-result"
import { SkuMathMatrix, DIAGONAL_CELL_STYLE } from "./sku-math-matrix"
import { SkuMathSkeleton } from "./sku-math-skeleton"

/**
 * SKU Math workspace (re-skin of the ROI BaseMath screen): heatmap legend
 * toolbar, a heatmap-column filter card, then the SKU x SKU ROI matrix, fed
 * by the shared route-level ROI state.
 */
export function SkuMathWorkspace({
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
      skeleton={<SkuMathSkeleton />}
      onGoToSkuSelection={onGoToSkuSelection}
    >
      {(result, isRefreshing) => (
        <SkuMathContent
          result={result}
          isRefreshing={isRefreshing}
          caseName={caseName}
          partitionName={partitionName}
        />
      )}
    </RoiGate>
  )
}

function SkuMathContent({
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
  // Heatmap controls are client-side view state only (no persistence).
  const [override, setOverride] = useState<{
    start: number
    step: number
  } | null>(null)
  const [decimalPlaces, setDecimalPlaces] = useState(
    DEFAULT_HEATMAP_DECIMAL_PLACES
  )

  const view = useMemo(
    () => (result.sku_math ? buildSkuMathView(result.sku_math) : null),
    [result.sku_math]
  )
  const meta = useMemo(
    () =>
      buildHeatmapMetaFromStartStep(
        override?.start ?? SKU_MATH_HEATMAP_DEFAULTS.start,
        override?.step ?? SKU_MATH_HEATMAP_DEFAULTS.step
      ),
    [override]
  )
  const bins = useMemo(
    () => getBaseTestingHeatmapLegendBins(meta, decimalPlaces),
    [meta, decimalPlaces]
  )

  const exportAsExcel = useCallback(() => {
    if (!view) return
    const headers: ExcelCell[] = [
      "SKU",
      "Avg ROI",
      "Abs Pen%",
      ...view.skuColumns,
    ].map((value) => ({ value, header: true }))
    const rows: ExcelCell[][] = view.rows.map((row) => [
      { value: row.sku },
      {
        value: formatHeatmapNumber(row.avgRoi, decimalPlaces),
        style: { textAlign: "center" },
      },
      {
        value: formatHeatmapNumber(row.absPenPct, decimalPlaces),
        style: { textAlign: "center" },
      },
      ...row.values.map((value, columnIndex) => ({
        value: formatHeatmapNumber(value, decimalPlaces),
        style:
          view.skuColumns[columnIndex] === row.sku
            ? DIAGONAL_CELL_STYLE
            : getBaseTestingHeatmapStyle(value, meta),
      })),
    ])
    exportExcelTable({
      filename: roiExportFilename([caseName, partitionName], "sku_math"),
      sheetName: "SKU Math",
      rows: [headers, ...rows],
    })
  }, [caseName, decimalPlaces, meta, partitionName, view])

  return (
    <div className="flex flex-1 flex-col gap-4 bg-background p-6">
      <RoiHeatmapToolbar
        title="Heatmap Legend"
        start={meta.start}
        step={meta.step}
        decimalPlaces={decimalPlaces}
        bins={bins}
        onStartStepSubmit={setOverride}
        onDecimalPlacesChange={setDecimalPlaces}
        onReset={override ? () => setOverride(null) : undefined}
        onExport={view && view.rows.length ? exportAsExcel : undefined}
      >
        {isRefreshing ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Spinner className="size-3" aria-hidden="true" />
            Recomputing with the new SKU selection…
          </span>
        ) : null}
      </RoiHeatmapToolbar>

      {/* Heatmap column filters — rule building is a later pass. */}
      <div className="flex flex-col gap-2.5 border border-border/40 bg-card/40 p-3 shadow-2xs backdrop-blur-xs">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Heatmap Column Filters
            </p>
            <p className="mt-0.5 text-[11px] font-mono text-muted-foreground/80">
              Showing {view?.rows.length ?? 0} of {view?.rows.length ?? 0} rows
              · {view?.skuColumns.length ?? 0} of {view?.skuColumns.length ?? 0}{" "}
              columns
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 rounded-none border-border/40 px-2.5 text-[10px] font-medium tracking-wide uppercase disabled:opacity-40"
            disabled
            title="Column rules are coming in a later pass"
          >
            <PlusIcon data-icon="inline-start" className="size-3" />
            Add rule
          </Button>
        </div>
        <p className="rounded-none border border-dashed border-border/30 bg-muted/5 py-3 text-center font-mono text-[10px] text-muted-foreground/60">
          No filters applied. Add a rule to narrow the heatmap columns.
        </p>
      </div>

      {view ? (
        <SkuMathMatrix view={view} meta={meta} decimalPlaces={decimalPlaces} />
      ) : null}
    </div>
  )
}
