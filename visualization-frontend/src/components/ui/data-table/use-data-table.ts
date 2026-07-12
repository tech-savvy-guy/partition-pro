import { useEffect, useRef, useState } from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnSizingState,
  type PaginationState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { advancedFilterFn } from "./filter-fn"
import type { DisplayMode } from "./types"

type UseDataTableArgs<TData> = {
  data: TData[]
  columns: ColumnDef<TData>[]
  getRowId: (row: TData) => string
  displayMode: DisplayMode
  pageSize: number
  enableColumnResizing: boolean
  /** Controlled global filter (optional). When omitted, managed internally. */
  globalFilter?: string
  onGlobalFilterChange?: (value: string) => void
  onFilteredRowCountChange?: (count: number) => void
}

export function useDataTable<TData>({
  data,
  columns,
  getRowId,
  displayMode,
  pageSize,
  enableColumnResizing,
  globalFilter,
  onGlobalFilterChange,
  onFilteredRowCountChange,
}: UseDataTableArgs<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [internalGlobalFilter, setInternalGlobalFilter] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })

  const isGlobalControlled = globalFilter !== undefined
  const globalValue = isGlobalControlled ? globalFilter : internalGlobalFilter

  const table = useReactTable<TData>({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      globalFilter: globalValue,
      ...(displayMode === "pagination" ? { pagination } : {}),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onGlobalFilterChange: isGlobalControlled
      ? (updater) => {
          const next =
            typeof updater === "function"
              ? (updater as (old: string) => string)(globalValue)
              : updater
          onGlobalFilterChange?.(next)
        }
      : setInternalGlobalFilter,
    onPaginationChange: setPagination,
    getRowId,
    filterFns: { advanced: advancedFilterFn },
    globalFilterFn: "includesString",
    columnResizeMode: "onChange",
    enableColumnResizing,
    defaultColumn: { minSize: 60, size: 160, maxSize: 800 },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(displayMode === "pagination"
      ? { getPaginationRowModel: getPaginationRowModel() }
      : {}),
  })

  // Keep page size in sync if the prop changes.
  useEffect(() => {
    setPagination((prev) =>
      prev.pageSize === pageSize ? prev : { ...prev, pageSize },
    )
  }, [pageSize])

  // Report the post-filter row count without depending on callback identity.
  const filteredCount = table.getFilteredRowModel().rows.length
  const countCallbackRef = useRef(onFilteredRowCountChange)
  countCallbackRef.current = onFilteredRowCountChange
  useEffect(() => {
    countCallbackRef.current?.(filteredCount)
  }, [filteredCount])

  return table
}
