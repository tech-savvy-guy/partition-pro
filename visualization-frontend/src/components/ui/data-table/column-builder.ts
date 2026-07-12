import type { ColumnDef } from "@tanstack/react-table"

import type { DataTableColumn } from "./types"

export const SELECT_COLUMN_ID = "__select"

type BuildOptions<TData> = {
  enableSorting: boolean
  enableResizing: boolean
  enableColumnFilters: boolean
  /** Pre-built selection column injected at the front when provided. */
  selectColumn?: ColumnDef<TData>
}

/** Convert the ergonomic column specs into TanStack ColumnDefs. */
export function buildColumnDefs<TData>(
  specs: DataTableColumn<TData>[],
  opts: BuildOptions<TData>,
): ColumnDef<TData>[] {
  const defs: ColumnDef<TData>[] = []

  if (opts.selectColumn) defs.push(opts.selectColumn)

  for (const spec of specs) {
    const filterable = opts.enableColumnFilters && (spec.filterable ?? true)

    defs.push({
      id: spec.id,
      ...(spec.accessorKey
        ? { accessorKey: spec.accessorKey }
        : {
            accessorFn:
              spec.accessorFn ??
              ((row: TData) => (row as Record<string, unknown>)[spec.id]),
          }),
      header: () => spec.header,
      enableSorting: opts.enableSorting && (spec.enableSorting ?? true),
      enableResizing: opts.enableResizing && (spec.enableResizing ?? true),
      enableColumnFilter: filterable,
      filterFn: "advanced",
      size: spec.size,
      minSize: spec.minSize,
      maxSize: spec.maxSize,
      meta: {
        type: spec.type ?? "text",
        align: spec.align,
        className: spec.className,
        headerClassName: spec.headerClassName,
        exportHeader: typeof spec.header === "string" ? spec.header : spec.id,
        exportValue: spec.exportValue,
        filterable,
      },
      cell: spec.cell
        ? (ctx) => spec.cell!({ value: ctx.getValue(), row: ctx.row.original })
        : (ctx) => {
            const v = ctx.getValue()
            return v == null ? "" : String(v)
          },
    })
  }

  return defs
}
