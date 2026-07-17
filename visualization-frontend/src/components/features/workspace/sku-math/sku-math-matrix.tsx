import { useState, useCallback, useRef, memo } from "react"
import type { CSSProperties } from "react"
import { TableIcon } from "lucide-react"
import { useVirtualizer } from "@tanstack/react-virtual"

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

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute top-0 right-0 h-full w-2 -mr-1 cursor-col-resize select-none group/resize z-40"
      title="Drag to resize"
    >
      <div className="absolute right-[3px] top-0 h-full w-[1px] bg-transparent group-hover/resize:bg-primary/50 group-active/resize:bg-primary transition-colors duration-150" />
    </div>
  )
}

type SkuMathRowData = SkuMathView["rows"][number]

const SkuMathRow = memo(function SkuMathRow({
  row,
  skuColumns,
  decimalPlaces,
  meta,
  widths,
  skuWidth,
  avgRoiWidth,
  absPenPctWidth,
}: {
  row: SkuMathRowData
  skuColumns: string[]
  decimalPlaces: number
  meta: DiagonalBucketHeatmapMeta
  widths: Record<string, number>
  skuWidth: number
  avgRoiWidth: number
  absPenPctWidth: number
}) {
  return (
    <tr className="group hover:bg-muted/15 transition-colors duration-75">
      <td
        title={row.sku}
        style={{ width: skuWidth, minWidth: skuWidth, maxWidth: skuWidth }}
        className="sticky left-0 z-10 truncate border-r border-b border-border/40 bg-card group-hover:bg-muted px-3 py-1.5 font-medium text-foreground/90 transition-colors duration-75"
      >
        {row.sku}
      </td>
      <td
        style={{ width: avgRoiWidth, minWidth: avgRoiWidth, maxWidth: avgRoiWidth }}
        className="border-r border-b border-border/40 px-2 py-1.5 text-center text-foreground/80 tabular-nums truncate"
      >
        {formatHeatmapNumber(row.avgRoi, decimalPlaces)}
      </td>
      <td
        style={{ width: absPenPctWidth, minWidth: absPenPctWidth, maxWidth: absPenPctWidth }}
        className="border-r border-b border-border/40 px-2 py-1.5 text-center text-foreground/80 tabular-nums truncate"
      >
        {formatHeatmapNumber(row.absPenPct, decimalPlaces)}
      </td>
      {row.values.map((value, columnIndex) => {
        const colSku = skuColumns[columnIndex]
        const colWidth = widths[colSku] ?? 96
        return (
          <td
            key={colSku}
            className="border-r border-b border-border/40 px-2 py-1.5 text-center tabular-nums transition-all duration-75 last:border-r-0 hover:brightness-95 dark:hover:brightness-110 truncate"
            style={{
              width: colWidth,
              minWidth: colWidth,
              maxWidth: colWidth,
              ...(colSku === row.sku
                ? DIAGONAL_CELL_STYLE
                : getBaseTestingHeatmapStyle(value, meta)),
            }}
          >
            {formatHeatmapNumber(value, decimalPlaces)}
          </td>
        )
      })}
    </tr>
  )
})

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
  const [widths, setWidths] = useState<Record<string, number>>({})
  const parentRef = useRef<HTMLDivElement>(null)

  const skuWidth = widths["sku"] ?? 120
  const avgRoiWidth = widths["avg_roi"] ?? 80
  const absPenPctWidth = widths["abs_pen_pct"] ?? 80
  const getColWidth = (column: string) => widths[column] ?? 96

  const rowVirtualizer = useVirtualizer({
    count: view.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 29,
    overscan: 40,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()

  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string, currentWidth: number) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const nextWidth = Math.max(50, currentWidth + deltaX)
      setWidths((prev) => ({
        ...prev,
        [columnKey]: nextWidth,
      }))
    }

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
  }, [])

  if (!view.rows.length) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden border border-border/40 bg-card/60 backdrop-blur-xs">
        <Empty className="flex-1 rounded-none border-0 bg-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="text-muted-foreground/60">
              <TableIcon />
            </EmptyMedia>
            <EmptyTitle className="text-foreground/90 font-mono text-sm tracking-tight uppercase">No SKU Math yet</EmptyTitle>
            <EmptyDescription className="text-muted-foreground/80 text-xs">
              The SKU-by-SKU math matrix will appear here once the workflow has
              run for this partition.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const colSpan = 3 + view.skuColumns.length

  return (
    <div
      ref={parentRef}
      className="max-h-[72vh] flex-1 overflow-auto border border-border/40 bg-card/50 shadow-2xs"
    >
      <table className="w-full border-separate border-spacing-0 text-[11px] font-mono select-none">
        <thead>
          <tr className="text-[10px] tracking-wider text-foreground/80 uppercase">
            <th
              style={{ width: skuWidth, minWidth: skuWidth, maxWidth: skuWidth }}
              className="sticky top-0 left-0 z-30 border-r border-b border-border/40 bg-muted px-3 py-2 text-left relative"
            >
              <span className="truncate block">SKU</span>
              <ResizeHandle onMouseDown={(e) => handleResizeStart(e, "sku", skuWidth)} />
            </th>
            <th
              style={{ width: avgRoiWidth, minWidth: avgRoiWidth, maxWidth: avgRoiWidth }}
              className="sticky top-0 z-20 border-r border-b border-border/40 bg-muted px-2 py-2 text-center relative"
            >
              <span className="truncate block">Avg ROI</span>
              <ResizeHandle onMouseDown={(e) => handleResizeStart(e, "avg_roi", avgRoiWidth)} />
            </th>
            <th
              style={{ width: absPenPctWidth, minWidth: absPenPctWidth, maxWidth: absPenPctWidth }}
              className="sticky top-0 z-20 border-r border-b border-border/40 bg-muted px-2 py-2 text-center relative"
            >
              <span className="truncate block">Abs Pen%</span>
              <ResizeHandle onMouseDown={(e) => handleResizeStart(e, "abs_pen_pct", absPenPctWidth)} />
            </th>
            {view.skuColumns.map((column) => {
              const colWidth = getColWidth(column)
              return (
                <th
                  key={column}
                  title={column}
                  style={{ width: colWidth, minWidth: colWidth, maxWidth: colWidth }}
                  className="sticky top-0 z-20 border-r border-b border-border/40 bg-muted px-2 py-2 text-center last:border-r-0 relative"
                >
                  <span className="truncate block">{column}</span>
                  <ResizeHandle onMouseDown={(e) => handleResizeStart(e, column, colWidth)} />
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {virtualRows.length > 0 && virtualRows[0].start > 0 && (
            <tr aria-hidden="true">
              <td
                colSpan={colSpan}
                style={{ height: virtualRows[0].start, padding: 0, border: 0 }}
              />
            </tr>
          )}

          {virtualRows.map((virtualRow) => {
            const row = view.rows[virtualRow.index]
            return (
              <SkuMathRow
                key={row.sku}
                row={row}
                skuColumns={view.skuColumns}
                decimalPlaces={decimalPlaces}
                meta={meta}
                widths={widths}
                skuWidth={skuWidth}
                avgRoiWidth={avgRoiWidth}
                absPenPctWidth={absPenPctWidth}
              />
            )
          })}

          {virtualRows.length > 0 &&
            rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={colSpan}
                  style={{
                    height: rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end,
                    padding: 0,
                    border: 0,
                  }}
                />
              </tr>
            )}
        </tbody>
      </table>
    </div>
  )
}
