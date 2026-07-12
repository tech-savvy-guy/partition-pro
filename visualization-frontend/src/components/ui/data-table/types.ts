import type { ReactNode } from "react"
import type { FilterFn, RowData } from "@tanstack/react-table"

/* -------------------------------------------------------------------------- */
/* Column / filter primitives                                                  */
/* -------------------------------------------------------------------------- */

export type ColumnType = "text" | "number"
export type ColumnAlign = "left" | "center" | "right"
export type JoinOp = "AND" | "OR"

export type TextOperator =
  | "contains"
  | "notContains"
  | "equals"
  | "notEquals"
  | "startsWith"
  | "endsWith"
  | "blank"
  | "notBlank"

export type NumberOperator =
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "blank"
  | "notBlank"

export type FilterOperator = TextOperator | NumberOperator

export type FilterCondition = { op: FilterOperator; value: string }

/** Value stored in TanStack column filter state for the `advanced` filterFn. */
export type AdvancedFilterValue = {
  join: JoinOp
  conditions: FilterCondition[]
}

/* -------------------------------------------------------------------------- */
/* Public column spec (ergonomic — converted to ColumnDef internally)          */
/* -------------------------------------------------------------------------- */

export type DataTableColumn<TData> = {
  /** Stable column id (also the default accessor key). */
  id: string
  header: ReactNode
  accessorKey?: keyof TData & string
  accessorFn?: (row: TData) => unknown
  /** Drives the operator set in the filter popover + numeric comparisons. */
  type?: ColumnType
  filterable?: boolean
  enableSorting?: boolean
  enableResizing?: boolean
  size?: number
  minSize?: number
  maxSize?: number
  align?: ColumnAlign
  className?: string
  headerClassName?: string
  cell?: (ctx: { value: unknown; row: TData }) => ReactNode
  /** Override the value written to the Excel export for this column. */
  exportValue?: (row: TData) => string | number | null
}

/* -------------------------------------------------------------------------- */
/* Selection (controlled)                                                      */
/* -------------------------------------------------------------------------- */

export type DataTableSelection = {
  selectedIds: string[]
  allSelected: boolean
  onToggleAll?: (checked: boolean) => void
  onToggleRow?: (id: string, checked: boolean) => void
}

export type DisplayMode = "pagination" | "virtual"

/* -------------------------------------------------------------------------- */
/* ColumnMeta augmentation — carries spec details onto the TanStack column      */
/* -------------------------------------------------------------------------- */

declare module "@tanstack/react-table" {
  interface FilterFns {
    advanced: FilterFn<unknown>
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    type?: ColumnType
    align?: ColumnAlign
    className?: string
    headerClassName?: string
    exportHeader?: string
    exportValue?: (row: TData) => string | number | null
    filterable?: boolean
  }
}
