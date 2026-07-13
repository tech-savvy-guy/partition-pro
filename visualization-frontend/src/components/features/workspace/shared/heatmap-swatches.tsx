import type { HeatmapLegendBin } from "@/lib/partition-tree/heatmap"
import { cn } from "@/lib/utils"

/**
 * Color-swatch strip mirroring the ROI heatmap legend bins (from
 * `getBaseTestingHeatmapLegendBins(meta, decimalPlaces)`). The black "0" bin
 * is rendered as the standalone "Diagonal" chip, not inside the strip.
 */
export function HeatmapSwatches({
  bins,
  showDiagonal = true,
  className,
}: {
  bins: HeatmapLegendBin[]
  showDiagonal?: boolean
  className?: string
}) {
  const valueBins = bins.filter(
    (bin) => bin.label !== "0" && bin.color !== "transparent"
  )

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className="inline-flex items-center gap-1.5">
        {valueBins.map((bin) => (
          <span
            key={bin.label}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          >
            <span
              className="h-4 w-4 border border-border"
              style={{ backgroundColor: bin.color }}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap">{bin.label}</span>
          </span>
        ))}
      </span>
      {showDiagonal ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="h-4 w-4 border border-border bg-neutral-900"
            aria-hidden="true"
          />
          Diagonal
        </span>
      ) : null}
    </span>
  )
}
