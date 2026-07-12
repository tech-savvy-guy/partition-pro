import type { FilterFn } from "@tanstack/react-table"

import type {
  AdvancedFilterValue,
  ColumnType,
  FilterCondition,
  FilterOperator,
  TextOperator,
} from "./types"

/* -------------------------------------------------------------------------- */
/* Legacy match modes (ported from partition-tree DataGrid) + comparison       */
/* -------------------------------------------------------------------------- */

const FilterMatchMode = {
  CONTAINS: "contains",
  STARTS_WITH: "startsWith",
  ENDS_WITH: "endsWith",
  EQUALS: "equals",
  NOT_CONTAINS: "notContains",
  NOT_EQUALS: "notEquals",
  LESS_THAN: "lt",
  LESS_THAN_OR_EQUAL_TO: "lte",
  GREATER_THAN: "gt",
  GREATER_THAN_OR_EQUAL_TO: "gte",
} as const

type FilterMatchModeValue = (typeof FilterMatchMode)[keyof typeof FilterMatchMode]

function compareValue(
  value: unknown,
  needle: unknown,
  mode: FilterMatchModeValue,
): boolean {
  if (needle == null || String(needle).trim() === "") return true

  const valueText = String(value ?? "").toLowerCase()
  const needleText = String(needle).toLowerCase()
  const valueNumber = Number(value)
  const needleNumber = Number(needle)

  switch (mode) {
    case FilterMatchMode.STARTS_WITH:
      return valueText.startsWith(needleText)
    case FilterMatchMode.ENDS_WITH:
      return valueText.endsWith(needleText)
    case FilterMatchMode.EQUALS:
      return valueText === needleText
    case FilterMatchMode.NOT_CONTAINS:
      return !valueText.includes(needleText)
    case FilterMatchMode.NOT_EQUALS:
      return valueText !== needleText
    case FilterMatchMode.LESS_THAN:
      return Number.isFinite(valueNumber) && valueNumber < needleNumber
    case FilterMatchMode.LESS_THAN_OR_EQUAL_TO:
      return Number.isFinite(valueNumber) && valueNumber <= needleNumber
    case FilterMatchMode.GREATER_THAN:
      return Number.isFinite(valueNumber) && valueNumber > needleNumber
    case FilterMatchMode.GREATER_THAN_OR_EQUAL_TO:
      return Number.isFinite(valueNumber) && valueNumber >= needleNumber
    case FilterMatchMode.CONTAINS:
    default:
      return valueText.includes(needleText)
  }
}

/* -------------------------------------------------------------------------- */
/* Operator option lists for the filter popover                                */
/* -------------------------------------------------------------------------- */

export type OperatorOption = { label: string; value: FilterOperator }

export const TEXT_OPERATORS: OperatorOption[] = [
  { label: "Contains", value: "contains" },
  { label: "Does not contain", value: "notContains" },
  { label: "Equals", value: "equals" },
  { label: "Not equal to", value: "notEquals" },
  { label: "Begins with", value: "startsWith" },
  { label: "Ends with", value: "endsWith" },
  { label: "Is blank", value: "blank" },
  { label: "Is not blank", value: "notBlank" },
]

export const NUMBER_OPERATORS: OperatorOption[] = [
  { label: "Equals (=)", value: "eq" },
  { label: "Not equal (≠)", value: "neq" },
  { label: "Less than (<)", value: "lt" },
  { label: "Less or equal (≤)", value: "lte" },
  { label: "Greater than (>)", value: "gt" },
  { label: "Greater or equal (≥)", value: "gte" },
  { label: "Is blank", value: "blank" },
  { label: "Is not blank", value: "notBlank" },
]

export function operatorsForType(type?: ColumnType): OperatorOption[] {
  return type === "number" ? NUMBER_OPERATORS : TEXT_OPERATORS
}

export function defaultOperator(type?: ColumnType): FilterOperator {
  return type === "number" ? "eq" : "contains"
}

/** Operators that don't need a value (the value input is hidden for these). */
export function isValuelessOperator(op: FilterOperator): boolean {
  return op === "blank" || op === "notBlank"
}

const OP_TO_MODE: Partial<Record<FilterOperator, FilterMatchModeValue>> = {
  // text
  contains: FilterMatchMode.CONTAINS,
  notContains: FilterMatchMode.NOT_CONTAINS,
  equals: FilterMatchMode.EQUALS,
  notEquals: FilterMatchMode.NOT_EQUALS,
  startsWith: FilterMatchMode.STARTS_WITH,
  endsWith: FilterMatchMode.ENDS_WITH,
  // number
  eq: FilterMatchMode.EQUALS,
  neq: FilterMatchMode.NOT_EQUALS,
  lt: FilterMatchMode.LESS_THAN,
  lte: FilterMatchMode.LESS_THAN_OR_EQUAL_TO,
  gt: FilterMatchMode.GREATER_THAN,
  gte: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO,
}

function isBlank(cell: unknown): boolean {
  return cell == null || String(cell).trim() === ""
}

/** A condition is inert when it requires a value but none was entered. */
function isActiveCondition(cond: FilterCondition): boolean {
  if (isValuelessOperator(cond.op)) return true
  return (cond.value?.trim() ?? "") !== ""
}

function evalCondition(cell: unknown, cond: FilterCondition): boolean {
  if (cond.op === "blank") return isBlank(cell)
  if (cond.op === "notBlank") return !isBlank(cell)

  const mode = OP_TO_MODE[cond.op]
  if (!mode) return true
  return compareValue(cell, cond.value, mode)
}

/* -------------------------------------------------------------------------- */
/* TanStack filter function                                                     */
/* -------------------------------------------------------------------------- */

export function isFilterActive(value?: AdvancedFilterValue): boolean {
  return !!value && value.conditions.some(isActiveCondition)
}

export const advancedFilterFn: FilterFn<unknown> = (
  row,
  columnId,
  filterValue: AdvancedFilterValue,
) => {
  if (!filterValue?.conditions?.length) return true
  const active = filterValue.conditions.filter(isActiveCondition)
  if (active.length === 0) return true

  const cell = row.getValue(columnId)
  const results = active.map((cond) => evalCondition(cell, cond))
  return filterValue.join === "OR"
    ? results.some(Boolean)
    : results.every(Boolean)
}

// Let TanStack drop the filter automatically once it becomes inert.
advancedFilterFn.autoRemove = (value: AdvancedFilterValue) =>
  !isFilterActive(value)

export function makeEmptyFilter(type?: ColumnType): AdvancedFilterValue {
  const op = defaultOperator(type)
  return {
    join: "AND",
    conditions: [
      { op, value: "" },
      { op, value: "" },
    ],
  }
}

export type { TextOperator }
