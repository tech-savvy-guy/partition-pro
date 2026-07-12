import type { Header, Table } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import { ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon } from "lucide-react"

import { ColumnFilterPopover } from "./column-filter-popover"

export function DataTableColumnHeader<TData>({
  header,
}: {
  header: Header<TData, unknown>
  table: Table<TData>
}) {
  const column = header.column
  const canSort = column.getCanSort()
  const canFilter = column.getCanFilter() && column.columnDef.meta?.filterable
  const sortDir = column.getIsSorted()
  const label = flexRender(column.columnDef.header, header.getContext())

  return (
    <div className="flex w-full items-center gap-1">
      {canSort ? (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          className="flex min-w-0 flex-1 items-center gap-1 text-left transition-colors hover:text-foreground"
        >
          <span className="truncate">{label}</span>
          <SortIcon direction={sortDir} />
        </button>
      ) : (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      )}
      {canFilter && <ColumnFilterPopover column={column} />}
    </div>
  )
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") {
    return <ChevronUpIcon className="size-3 text-foreground" aria-hidden="true" />
  }
  if (direction === "desc") {
    return (
      <ChevronDownIcon className="size-3 text-foreground" aria-hidden="true" />
    )
  }
  return (
    <ChevronsUpDownIcon
      className="size-3 shrink-0 text-muted-foreground/40"
      aria-hidden="true"
    />
  )
}
