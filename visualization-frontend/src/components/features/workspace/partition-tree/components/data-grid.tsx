import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Filtering                                                                   */
/* -------------------------------------------------------------------------- */

export const FilterMatchMode = {
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
} as const;

export type FilterMatchModeValue =
  (typeof FilterMatchMode)[keyof typeof FilterMatchMode];

export type FilterModeOption = { label: string; value: FilterMatchModeValue };

const TEXT_FILTER_MODES: FilterModeOption[] = [
  { label: "Contains", value: FilterMatchMode.CONTAINS },
  { label: "Starts with", value: FilterMatchMode.STARTS_WITH },
  { label: "Ends with", value: FilterMatchMode.ENDS_WITH },
  { label: "Equals", value: FilterMatchMode.EQUALS },
  { label: "Does not contain", value: FilterMatchMode.NOT_CONTAINS },
];

const NUMERIC_FILTER_MODES: FilterModeOption[] = [
  { label: "Equals", value: FilterMatchMode.EQUALS },
  { label: "Not equals", value: FilterMatchMode.NOT_EQUALS },
  { label: "Less than", value: FilterMatchMode.LESS_THAN },
  { label: "Less or equal", value: FilterMatchMode.LESS_THAN_OR_EQUAL_TO },
  { label: "Greater than", value: FilterMatchMode.GREATER_THAN },
  { label: "Greater or equal", value: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO },
];

function compareValue(
  value: unknown,
  needle: unknown,
  mode: FilterMatchModeValue,
): boolean {
  if (needle == null || String(needle).trim() === "") return true;

  const valueText = String(value ?? "").toLowerCase();
  const needleText = String(needle).toLowerCase();
  const valueNumber = Number(value);
  const needleNumber = Number(needle);

  switch (mode) {
    case FilterMatchMode.STARTS_WITH:
      return valueText.startsWith(needleText);
    case FilterMatchMode.ENDS_WITH:
      return valueText.endsWith(needleText);
    case FilterMatchMode.EQUALS:
      return valueText === needleText;
    case FilterMatchMode.NOT_CONTAINS:
      return !valueText.includes(needleText);
    case FilterMatchMode.NOT_EQUALS:
      return valueText !== needleText;
    case FilterMatchMode.LESS_THAN:
      return Number.isFinite(valueNumber) && valueNumber < needleNumber;
    case FilterMatchMode.LESS_THAN_OR_EQUAL_TO:
      return Number.isFinite(valueNumber) && valueNumber <= needleNumber;
    case FilterMatchMode.GREATER_THAN:
      return Number.isFinite(valueNumber) && valueNumber > needleNumber;
    case FilterMatchMode.GREATER_THAN_OR_EQUAL_TO:
      return Number.isFinite(valueNumber) && valueNumber >= needleNumber;
    case FilterMatchMode.CONTAINS:
    default:
      return valueText.includes(needleText);
  }
}

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type DataGridAlign = "left" | "center" | "right";

export type DataGridColumn<Row> = {
  /** Stable identity for the column. */
  key: string;
  header?: React.ReactNode;
  /** Field used for default cell rendering and filtering. */
  field?: string;
  /** Custom cell renderer. Falls back to `String(row[field])`. */
  cell?: (row: Row, rowIndex: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  headerStyle?: React.CSSProperties;
  cellStyle?: React.CSSProperties;
  align?: DataGridAlign;
  /** Enable a per-column filter input + match-mode select in the header. */
  filter?: boolean;
  filterPlaceholder?: string;
  /** Use numeric match modes / comparisons for this column. */
  numeric?: boolean;
};

export type DataGridHeaderCell = {
  content?: React.ReactNode;
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  style?: React.CSSProperties;
};

export type DataGridProps<Row> = {
  rows: Row[];
  columns: DataGridColumn<Row>[];
  rowKey: (row: Row, index: number) => string;
  /** Applied to the underlying <table> element. */
  className?: string;
  tableStyle?: React.CSSProperties;
  emptyMessage?: React.ReactNode;
  showGridlines?: boolean;
  stripedRows?: boolean;
  scrollable?: boolean;
  scrollHeight?: string;
  /** Multi-row grouped header rendered above the column headers. */
  headerGroups?: DataGridHeaderCell[][];

  /* selection */
  selectionMode?: "single" | "multiple";
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>, rows: Row[]) => void;
  selectionHeaderClassName?: string;
  selectionCellClassName?: string;

  /* pagination */
  paginate?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];

  /* filtering */
  onVisibleRowsChange?: (rows: Row[]) => void;

  /* row behaviour */
  rowClassName?: (row: Row) => string;
  onRowClick?: (row: Row, index: number) => void;
};

const alignClass: Record<DataGridAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export function DataGrid<Row>({
  rows,
  columns,
  rowKey,
  className,
  tableStyle,
  emptyMessage = "No data.",
  showGridlines,
  stripedRows,
  scrollable,
  scrollHeight,
  headerGroups,
  selectionMode,
  selectedKeys,
  onSelectionChange,
  selectionHeaderClassName,
  selectionCellClassName,
  paginate,
  pageSize = 15,
  pageSizeOptions,
  onVisibleRowsChange,
  rowClassName,
  onRowClick,
}: DataGridProps<Row>) {
  const hasFilters = columns.some((col) => col.filter);

  const [filterValues, setFilterValues] = React.useState<
    Record<string, string>
  >({});
  const [filterModes, setFilterModes] = React.useState<
    Record<string, FilterMatchModeValue>
  >({});
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(pageSize);

  React.useEffect(() => {
    setRowsPerPage(pageSize);
  }, [pageSize]);

  const filteredRows = React.useMemo(() => {
    if (!hasFilters) return rows;
    return rows.filter((row) =>
      columns.every((col) => {
        if (!col.filter || !col.field) return true;
        const needle = filterValues[col.field];
        if (needle == null || needle.trim() === "") return true;
        const mode =
          filterModes[col.field] ??
          (col.numeric ? FilterMatchMode.EQUALS : FilterMatchMode.CONTAINS);
        return compareValue(
          (row as Record<string, unknown>)[col.field],
          needle,
          mode,
        );
      }),
    );
  }, [rows, columns, filterValues, filterModes, hasFilters]);

  React.useEffect(() => {
    onVisibleRowsChange?.(filteredRows);
  }, [filteredRows, onVisibleRowsChange]);

  React.useEffect(() => {
    setPage(0);
  }, [filteredRows.length, rowsPerPage]);

  const pageCount = paginate
    ? Math.max(1, Math.ceil(filteredRows.length / Math.max(rowsPerPage, 1)))
    : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = paginate
    ? filteredRows.slice(
        safePage * rowsPerPage,
        safePage * rowsPerPage + rowsPerPage,
      )
    : filteredRows;

  const toggleSelection = (key: string, row: Row) => {
    if (!onSelectionChange) return;
    if (selectionMode === "single") {
      const isSelected = selectedKeys?.has(key);
      onSelectionChange(
        isSelected ? new Set() : new Set([key]),
        isSelected ? [] : [row],
      );
      return;
    }
    const next = new Set(selectedKeys ?? []);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const selectedRows = filteredRows.filter((candidate, index) =>
      next.has(rowKey(candidate, index)),
    );
    onSelectionChange(next, selectedRows);
  };

  const totalColumns = columns.length + (selectionMode ? 1 : 0);

  const wrapperStyle: React.CSSProperties | undefined =
    scrollable && scrollHeight
      ? { maxHeight: scrollHeight, overflow: "auto" }
      : undefined;

  return (
    <div className="partition-tree-data-table" style={wrapperStyle}>
      <Table
        className={cn(
          showGridlines && "[&_td]:border [&_th]:border",
          className,
        )}
        style={tableStyle}
      >
        <TableHeader>
          {headerGroups?.map((groupRow, rowIndex) => (
            <TableRow key={`group-${rowIndex}`}>
              {groupRow.map((cell, cellIndex) => (
                <TableHead
                  key={`group-${rowIndex}-${cellIndex}`}
                  colSpan={cell.colSpan}
                  rowSpan={cell.rowSpan}
                  className={cn("text-center", cell.className)}
                  style={cell.style}
                >
                  {cell.content}
                </TableHead>
              ))}
            </TableRow>
          ))}
          <TableRow>
            {selectionMode ? (
              <TableHead className={selectionHeaderClassName} />
            ) : null}
            {columns.map((col) => {
              const filterActive =
                col.filter &&
                col.field != null &&
                (filterValues[col.field]?.trim().length ?? 0) > 0;
              return (
                <TableHead
                  key={col.key}
                  className={cn(
                    col.align && alignClass[col.align],
                    filterActive && "col-filter-active",
                    col.headerClassName,
                  )}
                  style={col.headerStyle}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate">{col.header}</span>
                    {col.filter && col.field ? (
                      <ColumnFilter
                        field={col.field}
                        numeric={col.numeric}
                        placeholder={col.filterPlaceholder}
                        value={filterValues[col.field] ?? ""}
                        mode={
                          filterModes[col.field] ??
                          (col.numeric
                            ? FilterMatchMode.EQUALS
                            : FilterMatchMode.CONTAINS)
                        }
                        onValueChange={(value) =>
                          setFilterValues((prev) => ({
                            ...prev,
                            [col.field!]: value,
                          }))
                        }
                        onModeChange={(mode) =>
                          setFilterModes((prev) => ({
                            ...prev,
                            [col.field!]: mode,
                          }))
                        }
                      />
                    ) : null}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={Math.max(totalColumns, 1)}>
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            visibleRows.map((row, rowIndex) => {
              const absoluteIndex = safePage * rowsPerPage + rowIndex;
              const key = rowKey(row, absoluteIndex);
              const selected = selectedKeys?.has(key) ?? false;
              return (
                <TableRow
                  key={key}
                  data-state={selected ? "selected" : undefined}
                  className={cn(
                    stripedRows && rowIndex % 2 === 1 && "bg-muted/30",
                    onRowClick && "cursor-pointer",
                    rowClassName?.(row),
                  )}
                  onClick={
                    onRowClick
                      ? () => onRowClick(row, absoluteIndex)
                      : undefined
                  }
                >
                  {selectionMode ? (
                    <TableCell className={selectionCellClassName}>
                      {selectionMode === "multiple" ? (
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleSelection(key, row)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label="Select row"
                        />
                      ) : (
                        <input
                          type="radio"
                          checked={selected}
                          onChange={() => toggleSelection(key, row)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label="Select row"
                        />
                      )}
                    </TableCell>
                  ) : null}
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.align && alignClass[col.align],
                        col.cellClassName,
                      )}
                      style={col.cellStyle}
                    >
                      {col.cell
                        ? col.cell(row, absoluteIndex)
                        : col.field
                          ? String(
                              (row as Record<string, unknown>)[col.field] ?? "",
                            )
                          : null}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {paginate ? (
        <div className="flex items-center justify-between gap-3 border-t bg-background px-3 py-2 text-xs text-muted-foreground">
          <span>
            {filteredRows.length === 0
              ? "0 items"
              : `${safePage * rowsPerPage + 1} - ${Math.min(
                  (safePage + 1) * rowsPerPage,
                  filteredRows.length,
                )} of ${filteredRows.length} items`}
          </span>
          <div className="flex items-center gap-2">
            {pageSizeOptions?.length ? (
              <NativeSelect
                size="sm"
                value={rowsPerPage}
                onChange={(event) =>
                  setRowsPerPage(Number(event.target.value))
                }
                aria-label="Rows per page"
              >
                {pageSizeOptions.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage <= 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() =>
                setPage((current) => Math.min(pageCount - 1, current + 1))
              }
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ColumnFilter({
  numeric,
  placeholder,
  value,
  mode,
  onValueChange,
  onModeChange,
}: {
  field: string;
  numeric?: boolean;
  placeholder?: string;
  value: string;
  mode: FilterMatchModeValue;
  onValueChange: (value: string) => void;
  onModeChange: (mode: FilterMatchModeValue) => void;
}) {
  const modes = numeric ? NUMERIC_FILTER_MODES : TEXT_FILTER_MODES;
  return (
    <div className="flex items-center gap-1">
      <input
        className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs font-normal outline-none focus:border-ring"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
      />
      <NativeSelect
        size="sm"
        value={mode}
        onChange={(event) =>
          onModeChange(event.target.value as FilterMatchModeValue)
        }
        onClick={(event) => event.stopPropagation()}
        aria-label="Filter mode"
      >
        {modes.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
