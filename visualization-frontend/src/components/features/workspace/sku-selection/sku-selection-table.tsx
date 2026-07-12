import { useMemo } from "react"

import {
  DataTable,
  type DataTableColumn,
  detectNumericFields,
  formatCellValue,
} from "@/components/ui/data-table"
import { cn } from "@/lib/utils"

const HIDDEN_COLUMNS = new Set([
  "id",
  "case_id",
  "metadata_id",
  "category",
  "total_base_buyers",
  "raw_buyers",
])

const MONO_COLUMNS = new Set(["id", "skuname_ean"])

type SkuRow = {
  id: string
  [key: string]: unknown
}

export type { SkuRow }

export function SkuSelectionTable({
  columns,
  rows,
  selectedIds = [],
  allSelected = false,
  onToggleAll,
  onToggleSku,
  pageSize = 25,
  showSelection = true,
  onFilteredRowCountChange,
}: {
  columns: string[]
  rows: SkuRow[]
  selectedIds?: string[]
  allSelected?: boolean
  onToggleAll?: (checked: boolean) => void
  onToggleSku?: (skuId: string, checked: boolean) => void
  pageSize?: number
  showSelection?: boolean
  onFilteredRowCountChange?: (count: number) => void
}) {
  const visibleColumns = useMemo(() => {
    const source =
      columns.length > 0 ? columns : rows.flatMap((row) => Object.keys(row))
    const seen = new Set<string>()
    return source.filter((column) => {
      if (HIDDEN_COLUMNS.has(column)) return false
      if (seen.has(column)) return false
      seen.add(column)
      return true
    })
  }, [columns, rows])

  const numericColumns = useMemo(
    () => detectNumericFields(rows, visibleColumns),
    [rows, visibleColumns],
  )

  const tableColumns = useMemo<DataTableColumn<SkuRow>[]>(
    () =>
      visibleColumns.map((column) => {
        const mono = MONO_COLUMNS.has(column)
        return {
          id: column,
          header: column,
          accessorFn: (row) => row[column],
          type: numericColumns.has(column) ? "number" : "text",
          className: cn(mono && "font-mono text-[11px]"),
          cell: ({ value }) => {
            const text = formatCellValue(value)
            return (
              <span className="block truncate" title={text}>
                {text}
              </span>
            )
          },
        }
      }),
    [visibleColumns, numericColumns],
  )

  return (
    <DataTable<SkuRow>
      data={rows}
      columns={tableColumns}
      getRowId={(row) => row.id}
      displayMode="pagination"
      pageSize={pageSize}
      enableGlobalFilter={false}
      exportFileName="sku-selection.xlsx"
      onFilteredRowCountChange={onFilteredRowCountChange}
      selection={
        showSelection
          ? {
              selectedIds,
              allSelected,
              onToggleAll,
              onToggleRow: onToggleSku,
            }
          : undefined
      }
      classNames={{ root: "mx-8 mt-4 mb-8", toolbar: "px-0.5" }}
    />
  )
}
