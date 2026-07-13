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
import type { ObmView } from "@/lib/roi"
import { cn } from "@/lib/utils"

/**
 * OBM leaf-by-leaf ROI rollup: per-row Holds verdict, SKU count, the leaf
 * label, then one heatmap cell per leaf. Unlike SKU Math, the diagonal is a
 * real mean ROI — no sentinel black styling.
 */
export function ObmTable({
  view,
  meta,
  decimalPlaces,
}: {
  view: ObmView
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
            <EmptyTitle>No OBM results yet</EmptyTitle>
            <EmptyDescription>
              The OBM matrix will appear here once the workflow has run for this
              partition.
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
            <th className="sticky top-0 z-20 w-24 border-r border-b border-border bg-muted/95 px-3 py-2 text-center">
              Holds
            </th>
            <th className="sticky top-0 z-20 w-20 border-r border-b border-border bg-muted/95 px-3 py-2 text-center">
              #SKUs
            </th>
            <th className="sticky top-0 z-20 w-48 min-w-48 border-r border-b border-border bg-muted/95 px-3 py-2 text-left">
              Partition
            </th>
            {view.valueColumns.map((column) => (
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
            <tr key={row.label}>
              <td className="border-r border-b border-border px-3 py-1.5 text-center">
                <span
                  className={cn(
                    "inline-block px-2 py-0.5 text-[11px] font-bold",
                    row.holds
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-900"
                  )}
                >
                  {row.holds ? "TRUE" : "FALSE"}
                </span>
              </td>
              <td className="border-r border-b border-border px-3 py-1.5 text-center">
                {row.skuCount}
              </td>
              <td
                title={row.label}
                className="w-48 max-w-48 truncate border-r border-b border-border bg-muted/30 px-3 py-1.5 font-medium"
              >
                {row.label}
              </td>
              {row.cells.map((cell, columnIndex) => (
                <td
                  key={view.valueColumns[columnIndex]}
                  className="border-r border-b border-border px-3 py-1.5 text-center last:border-r-0"
                  style={getBaseTestingHeatmapStyle(cell, meta)}
                >
                  {formatHeatmapNumber(cell, decimalPlaces)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
