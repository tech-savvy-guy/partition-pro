import { useEffect, useState } from "react"
import type { Table } from "@tanstack/react-table"
import {
  DownloadIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { SELECT_COLUMN_ID } from "./column-builder"
import { exportTableToXlsx } from "./export-xlsx"

export function DataTableToolbar<TData>({
  table,
  enableGlobalFilter = true,
  enableColumnVisibility = true,
  enableExport = true,
  exportFileName,
  className,
}: {
  table: Table<TData>
  enableGlobalFilter?: boolean
  enableColumnVisibility?: boolean
  enableExport?: boolean
  exportFileName?: string
  className?: string
}) {
  const globalFilter = (table.getState().globalFilter as string) ?? ""
  const hasActiveFilters =
    table.getState().columnFilters.length > 0 || globalFilter.trim() !== ""

  const hideableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.id !== SELECT_COLUMN_ID && column.getCanHide())

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {enableGlobalFilter && (
        <GlobalSearch
          value={globalFilter}
          onChange={(value) => table.setGlobalFilter(value)}
        />
      )}

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => {
            table.resetColumnFilters()
            table.setGlobalFilter("")
          }}
        >
          <XIcon data-icon="inline-start" />
          Clear filters
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {enableColumnVisibility && hideableColumns.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="outline" size="sm">
                  <SlidersHorizontalIcon data-icon="inline-start" />
                  Columns
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="max-h-72 w-48">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hideableColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  closeOnClick={false}
                  onCheckedChange={(checked) =>
                    column.toggleVisibility(!!checked)
                  }
                >
                  <span className="truncate capitalize">
                    {String(column.columnDef.meta?.exportHeader ?? column.id)}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {enableExport && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void exportTableToXlsx(table, { fileName: exportFileName })
            }}
          >
            <DownloadIcon data-icon="inline-start" />
            Export
          </Button>
        )}
      </div>
    </div>
  )
}

function GlobalSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [local, setLocal] = useState(value)

  // Keep in sync when the value is reset externally (e.g. Clear filters).
  useEffect(() => {
    setLocal(value)
  }, [value])

  // Debounce propagation to the table to avoid filtering on every keystroke.
  useEffect(() => {
    if (local === value) return
    const id = setTimeout(() => onChange(local), 200)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local])

  return (
    <div className="relative">
      <SearchIcon
        size={12}
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={local}
        placeholder="Search…"
        onChange={(event) => setLocal(event.target.value)}
        className="h-8 w-48 pr-3 pl-7 text-xs"
      />
    </div>
  )
}
