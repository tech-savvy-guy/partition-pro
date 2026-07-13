import type { ReactNode } from "react"
import { DownloadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { HeatmapLegendBin } from "@/lib/partition-tree/heatmap"

import {
  HeatmapStartStepEditor,
  HeatmapDecimalPlacesSelect,
} from "../partition-tree/heatmap-controls"
import { HeatmapSwatches } from "./heatmap-swatches"

/**
 * The heatmap legend/actions toolbar shared by the SKU Math and OBM tabs:
 * start/step editor, decimal-places select, legend swatches and Excel export.
 * `children` renders extra chips (e.g. the OBM-holds badge) after the title.
 */
export function RoiHeatmapToolbar({
  title,
  start,
  step,
  startLabel = "Start (less than)",
  decimalPlaces,
  bins,
  onStartStepSubmit,
  onDecimalPlacesChange,
  onExport,
  children,
}: {
  title: string
  start: number | null
  step: number | null
  startLabel?: string
  decimalPlaces: number
  bins: HeatmapLegendBin[]
  onStartStepSubmit: (next: { start: number; step: number }) => void
  onDecimalPlacesChange: (value: number) => void
  /** Omit to render the Excel button disabled. */
  onExport?: () => void
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-card px-6 py-3">
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </span>
        {children}
        <HeatmapStartStepEditor
          startLabel={startLabel}
          stepLabel="Step"
          startValue={start}
          stepValue={step}
          onSubmit={onStartStepSubmit}
        />
        <HeatmapDecimalPlacesSelect
          value={decimalPlaces}
          onChange={onDecimalPlacesChange}
        />
        <HeatmapSwatches bins={bins} />
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 rounded-none px-3 text-xs font-medium"
        disabled={!onExport}
        title={
          onExport
            ? undefined
            : "Download becomes available once results are loaded"
        }
        onClick={onExport}
      >
        <DownloadIcon data-icon="inline-start" />
        Excel
      </Button>
    </div>
  )
}
