import type { RefObject, ReactNode } from "react"
import type { Row } from "@tanstack/react-table"
import { useVirtualizer } from "@tanstack/react-virtual"

import { TableBody } from "@/components/ui/table"

export function VirtualTableBody<TData>({
  rows,
  renderRow,
  scrollRef,
  rowHeight,
  colSpan,
}: {
  rows: Row<TData>[]
  renderRow: (row: Row<TData>) => ReactNode
  scrollRef: RefObject<HTMLDivElement | null>
  rowHeight: number
  colSpan: number
}) {
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  })

  const items = virtualizer.getVirtualItems()
  const paddingTop = items.length ? items[0].start : 0
  const paddingBottom = items.length
    ? virtualizer.getTotalSize() - items[items.length - 1].end
    : 0

  return (
    <TableBody>
      {paddingTop > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={colSpan}
            style={{ height: paddingTop, padding: 0, border: 0 }}
          />
        </tr>
      )}
      {items.map((item) => renderRow(rows[item.index]))}
      {paddingBottom > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={colSpan}
            style={{ height: paddingBottom, padding: 0, border: 0 }}
          />
        </tr>
      )}
    </TableBody>
  )
}
