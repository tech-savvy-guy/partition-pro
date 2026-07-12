import type { Table } from "@tanstack/react-table"

import { SELECT_COLUMN_ID } from "./column-builder"

export type ExportXlsxOptions = {
  fileName?: string
  sheetName?: string
  /** When false, export the unfiltered/unsorted core rows instead of the view. */
  useFilteredSorted?: boolean
}

/**
 * Export the current (filtered + sorted + visible) table view to an .xlsx file.
 * `xlsx` is dynamically imported so it stays out of the main bundle.
 */
export async function exportTableToXlsx<TData>(
  table: Table<TData>,
  opts: ExportXlsxOptions = {},
): Promise<void> {
  const XLSX = await import("xlsx")

  const columns = table
    .getVisibleLeafColumns()
    .filter((column) => column.id !== SELECT_COLUMN_ID)

  const headers = columns.map(
    (column) => column.columnDef.meta?.exportHeader ?? column.id,
  )

  const rows =
    opts.useFilteredSorted === false
      ? table.getCoreRowModel().rows
      : table.getSortedRowModel().rows

  const aoa: (string | number | null)[][] = [headers]
  for (const row of rows) {
    aoa.push(
      columns.map((column) => {
        const exportValue = column.columnDef.meta?.exportValue
        if (exportValue) return exportValue(row.original)
        const value = row.getValue(column.id)
        if (value == null) return ""
        if (typeof value === "number") return value
        return String(value)
      }),
    )
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, opts.sheetName ?? "Sheet1")
  XLSX.writeFile(workbook, opts.fileName ?? "export.xlsx")
}
