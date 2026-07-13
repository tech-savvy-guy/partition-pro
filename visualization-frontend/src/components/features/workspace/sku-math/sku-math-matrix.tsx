import type { CSSProperties } from "react"
import { TableIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  formatHeatmapNumber,
  getBaseTestingHeatmapStyle,
  type DiagonalBucketHeatmapMeta,
} from "@/lib/partition-tree/heatmap"
import type { SkuMathView } from "@/lib/roi"

/** The SKU×SKU diagonal is a sentinel 0 — always rendered black. */
export const DIAGONAL_CELL_STYLE: CSSProperties = {
  backgroundColor: "#000000",
  color: "#ffffff",
  textAlign: "center",
}

/**
 * SKU x SKU ROI heatmap: frozen SKU label column + Avg ROI / Abs Pen%
 * metrics, then one heatmap column per selected SKU. Plain table rendering —
 * selections are bounded (typically ≤ a few hundred SKUs), so no
 * virtualization until proven necessary.
 */
export function SkuMathMatrix({
  view,
  meta,
  decimalPlaces,
}: {
  view: SkuMathView
  meta: DiagonalBucketHeatmapMeta
  decimalPlaces: number
}) {
  if (!view.rows.length) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden border border-border bg-card">
        <Empty className="flex-1 rounded-none border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TableIcon />
            </EmptyMedia>
            <EmptyTitle>No SKU Math yet</EmptyTitle>
            <EmptyDescription>
              The SKU-by-SKU math matrix will appear here once the workflow has
              run for this partition.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="max-h-[70vh] flex-1 overflow-auto border border-border bg-card">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <th className="sticky top-0 left-0 z-30 w-56 min-w-56 border-r border-b border-border bg-muted px-3 py-2 text-left">
              SKU
            </th>
            <th className="sticky top-0 z-20 w-24 border-r border-b border-border bg-muted/95 px-3 py-2 text-center">
              Avg ROI
            </th>
            <th className="sticky top-0 z-20 w-24 border-r border-b border-border bg-muted/95 px-3 py-2 text-center">
              Abs Pen%
            </th>
            {view.skuColumns.map((column) => (
              <th
                key={column}
                title={column}
                className="sticky top-0 z-20 w-28 max-w-28 min-w-28 truncate border-r border-b border-border bg-muted/95 px-3 py-2 text-center last:border-r-0"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => (
            <tr key={row.sku}>
              <td
                title={row.sku}
                className="sticky left-0 z-10 w-56 max-w-56 min-w-56 truncate border-r border-b border-border bg-card px-3 py-1.5 font-medium"
              >
                {row.sku}
              </td>
              <td className="border-r border-b border-border px-3 py-1.5 text-center">
                {formatHeatmapNumber(row.avgRoi, decimalPlaces)}
              </td>
              <td className="border-r border-b border-border px-3 py-1.5 text-center">
                {formatHeatmapNumber(row.absPenPct, decimalPlaces)}
              </td>
              {row.values.map((value, columnIndex) => (
                <td
                  key={view.skuColumns[columnIndex]}
                  className="border-r border-b border-border px-3 py-1.5 text-center last:border-r-0"
                  style={
                    view.skuColumns[columnIndex] === row.sku
                      ? DIAGONAL_CELL_STYLE
                      : getBaseTestingHeatmapStyle(value, meta)
                  }
                >
                  {formatHeatmapNumber(value, decimalPlaces)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
