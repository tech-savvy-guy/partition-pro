import { useMemo, useRef } from "react"
import type { ReactNode } from "react"
import type { ColumnDef, Row } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { SELECT_COLUMN_ID, buildColumnDefs } from "./column-builder"
import { DataTableColumnHeader } from "./column-header"
import { DataTablePaginationFooter } from "./pagination-footer"
import { DataTableToolbar } from "./data-table-toolbar"
import { useDataTable } from "./use-data-table"
import type {
  ColumnAlign,
  DataTableColumn,
  DataTableSelection,
  DisplayMode,
} from "./types"
import { VirtualTableBody } from "./virtual-body"

const ALIGN_CLASS: Record<ColumnAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
}

export type DataTableProps<TData> = {
  data: TData[]
  columns: DataTableColumn<TData>[]
  getRowId?: (row: TData) => string

  displayMode?: DisplayMode
  pageSize?: number
  virtualRowHeight?: number
  virtualHeight?: string | number

  enableSorting?: boolean
  enableColumnResizing?: boolean
  enableColumnFilters?: boolean
  enableColumnVisibility?: boolean
  enableGlobalFilter?: boolean
  enableExport?: boolean
  exportFileName?: string
  showToolbar?: boolean

  globalFilter?: string
  onGlobalFilterChange?: (value: string) => void
  onFilteredRowCountChange?: (count: number) => void

  selection?: DataTableSelection
  emptyMessage?: ReactNode
  rowClassName?: (row: TData) => string
  classNames?: { root?: string; tableWrapper?: string; toolbar?: string }
}

export function DataTable<TData>({
  data,
  columns,
  getRowId = (row) => String((row as Record<string, unknown>).id),
  displayMode = "pagination",
  pageSize = 25,
  virtualRowHeight = 36,
  virtualHeight = "60vh",
  enableSorting = true,
  enableColumnResizing = true,
  enableColumnFilters = true,
  enableColumnVisibility = true,
  enableGlobalFilter = true,
  enableExport = true,
  exportFileName,
  showToolbar = true,
  globalFilter,
  onGlobalFilterChange,
  onFilteredRowCountChange,
  selection,
  emptyMessage = "No results",
  rowClassName,
  classNames,
}: DataTableProps<TData>) {
  const selectedSet = useMemo(
    () => new Set(selection?.selectedIds ?? []),
    [selection?.selectedIds],
  )

  const tableColumns = useMemo<ColumnDef<TData>[]>(() => {
    const selectColumn: ColumnDef<TData> | undefined = selection
      ? {
          id: SELECT_COLUMN_ID,
          enableSorting: false,
          enableResizing: false,
          enableHiding: false,
          enableColumnFilter: false,
          size: 40,
          header: () => (
            <FlatCheckbox
              checked={selection.allSelected}
              ariaLabel="Select all"
              onCheckedChange={(checked) => selection.onToggleAll?.(checked)}
            />
          ),
          cell: ({ row }) => (
            <FlatCheckbox
              checked={selectedSet.has(row.id)}
              ariaLabel={`Select row ${row.id}`}
              onCheckedChange={(checked) =>
                selection.onToggleRow?.(row.id, checked)
              }
            />
          ),
        }
      : undefined

    return buildColumnDefs(columns, {
      enableSorting,
      enableResizing: enableColumnResizing,
      enableColumnFilters,
      selectColumn,
    })
  }, [
    columns,
    selection,
    selectedSet,
    enableSorting,
    enableColumnResizing,
    enableColumnFilters,
  ])

  const table = useDataTable<TData>({
    data,
    columns: tableColumns,
    getRowId,
    displayMode,
    pageSize,
    enableColumnResizing,
    globalFilter,
    onGlobalFilterChange,
    onFilteredRowCountChange,
  })

  const scrollRef = useRef<HTMLDivElement>(null)
  const isVirtual = displayMode === "virtual"

  // CSS-variable widths so resizing doesn't re-render every cell on each move.
  const columnSizingInfo = table.getState().columnSizingInfo
  const columnSizing = table.getState().columnSizing
  const visibleLeafCount = table.getVisibleLeafColumns().length
  const columnSizeVars = useMemo(() => {
    if (!enableColumnResizing) return {}
    const vars: Record<string, string> = {}
    for (const header of table.getFlatHeaders()) {
      vars[`--header-${header.id}-size`] = `${header.getSize()}px`
      vars[`--col-${header.column.id}-size`] = `${header.column.getSize()}px`
    }
    return vars
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableColumnResizing, columnSizingInfo, columnSizing, visibleLeafCount])

  const totalRows = table.getFilteredRowModel().rows.length

  function headWidthStyle(headerId: string) {
    return enableColumnResizing
      ? { width: `var(--header-${headerId}-size)` }
      : undefined
  }
  function cellWidthStyle(columnId: string) {
    return enableColumnResizing
      ? { width: `var(--col-${columnId}-size)` }
      : undefined
  }

  function renderRow(row: Row<TData>) {
    const selected = selectedSet.has(row.id)
    return (
      <TableRow
        key={row.id}
        data-state={selected ? "selected" : undefined}
        className={cn(
          "border-b transition-colors last:border-0",
          selected ? "bg-muted/50" : "hover:bg-muted/40",
          rowClassName?.(row.original),
        )}
      >
        {row.getVisibleCells().map((cell) => {
          const isSelect = cell.column.id === SELECT_COLUMN_ID
          const meta = cell.column.columnDef.meta
          return (
            <TableCell
              key={cell.id}
              style={cellWidthStyle(cell.column.id)}
              className={cn(
                "py-2.5 text-xs text-muted-foreground",
                isSelect ? "px-4" : "max-w-56 truncate",
                meta?.align && ALIGN_CLASS[meta.align],
                meta?.className,
              )}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          )
        })}
      </TableRow>
    )
  }

  const tableEl = (
    <Table
      style={{
        ...columnSizeVars,
        ...(enableColumnResizing ? { width: table.getTotalSize() } : {}),
      }}
    >
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow
            key={headerGroup.id}
            className={cn(
              "border-b bg-muted/50 hover:bg-muted/50",
              isVirtual && "sticky top-0 z-10",
            )}
          >
            {headerGroup.headers.map((header) => {
              const isSelect = header.column.id === SELECT_COLUMN_ID
              const meta = header.column.columnDef.meta
              return (
                <TableHead
                  key={header.id}
                  style={headWidthStyle(header.id)}
                  className={cn(
                    "relative py-3 text-[11px] font-medium whitespace-nowrap text-muted-foreground",
                    isSelect ? "w-10 px-4" : "max-w-56",
                    meta?.align && ALIGN_CLASS[meta.align],
                    meta?.headerClassName,
                  )}
                >
                  {isSelect ? (
                    flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )
                  ) : (
                    <DataTableColumnHeader header={header} table={table} />
                  )}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onClick={(event) => event.stopPropagation()}
                      role="separator"
                      aria-orientation="vertical"
                      className={cn(
                        "absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none",
                        "before:absolute before:top-0 before:right-0 before:h-full before:w-px before:bg-border/0 before:transition-colors hover:before:bg-border",
                        header.column.getIsResizing() &&
                          "before:bg-primary before:w-0.5",
                      )}
                    />
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>

      {isVirtual ? (
        <VirtualTableBody
          rows={table.getRowModel().rows}
          renderRow={renderRow}
          scrollRef={scrollRef}
          rowHeight={virtualRowHeight}
          colSpan={visibleLeafCount}
        />
      ) : (
        <TableBody>{table.getRowModel().rows.map(renderRow)}</TableBody>
      )}
    </Table>
  )

  return (
    <div className={cn("flex flex-col gap-3", classNames?.root)}>
      {showToolbar && (
        <DataTableToolbar
          table={table}
          enableGlobalFilter={enableGlobalFilter}
          enableColumnVisibility={enableColumnVisibility}
          enableExport={enableExport}
          exportFileName={exportFileName}
          className={classNames?.toolbar}
        />
      )}

      <div className={cn("overflow-hidden border", classNames?.tableWrapper)}>
        {isVirtual ? (
          <div
            ref={scrollRef}
            className="overflow-auto"
            style={{ height: virtualHeight }}
          >
            {tableEl}
          </div>
        ) : (
          <div className="overflow-x-auto">{tableEl}</div>
        )}

        {totalRows === 0 && (
          <div className="py-12 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        )}

        {!isVirtual && totalRows > 0 && (
          <DataTablePaginationFooter table={table} totalRows={totalRows} />
        )}
      </div>
    </div>
  )
}

function FlatCheckbox({
  checked,
  ariaLabel,
  onCheckedChange,
}: {
  checked: boolean
  ariaLabel: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Checkbox
      checked={checked}
      aria-label={ariaLabel}
      className="rounded-none border-muted-foreground/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground"
      onCheckedChange={(value) => onCheckedChange(Boolean(value))}
    />
  )
}
