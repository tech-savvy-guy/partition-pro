import * as React from "react";
import "../Workflow.css";
import "@/components/table/Table.css";

import { Table, Col as Column } from "@/components/table/Table";
import type { DataTableFilterMeta } from "primereact/datatable";
import { FilterMatchMode, FilterOperator } from "primereact/api";

type SkuListPayload = {
  columns?: Array<string | number | boolean | null>;
  rows?: any[][];
};

type Props = {
  data?: { sku_list?: SkuListPayload | null } | null;
};

// Hide these to keep the table readable (adjust if you want them visible)
const HIDE_COLS = new Set(["id", "case_id", "metadata_id", "pp_metadata_id"]);

const TEXT_FILTER_MODES = [
  { label: "Contains", value: FilterMatchMode.CONTAINS },
  { label: "Starts with", value: FilterMatchMode.STARTS_WITH },
  { label: "Ends with", value: FilterMatchMode.ENDS_WITH },
  { label: "Equals", value: FilterMatchMode.EQUALS },
  { label: "Does not contain", value: FilterMatchMode.NOT_CONTAINS },
];

const NUMERIC_FILTER_MODES = [
  { label: "Equals", value: FilterMatchMode.EQUALS },
  { label: "Not equals", value: FilterMatchMode.NOT_EQUALS },
  { label: "Less than", value: FilterMatchMode.LESS_THAN },
  { label: "Less or equal", value: FilterMatchMode.LESS_THAN_OR_EQUAL_TO },
  { label: "Greater than", value: FilterMatchMode.GREATER_THAN },
  {
    label: "Greater or equal",
    value: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO,
  },
];

function safeString(v: any) {
  if (v == null) return "";
  return String(v);
}

function isNonEmptyFilterValue(v: any): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

function isColumnFilterActive(meta: any): boolean {
  if (!meta) return false;

  if (Array.isArray(meta.constraints)) {
    return meta.constraints.some((c: any) => isNonEmptyFilterValue(c?.value));
  }
  return isNonEmptyFilterValue(meta.value);
}

function isFiniteNumberLike(v: any): boolean {
  if (v == null) return false;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return false;
    const n = Number(s);
    return Number.isFinite(n);
  }
  return false;
}

export default function SKUList({ data }: Props) {

  const skuList = data?.sku_list;

  const columns: string[] = React.useMemo(() => {
    const cols = Array.isArray(skuList?.columns) ? skuList!.columns! : [];
    return cols.map((c) => String(c));
  }, [skuList]);

  const colFieldMap = React.useMemo(() => {
    const out: Array<{ name: string; field: string; index: number }> = [];
    columns.forEach((name, idx) => {
      if (!HIDE_COLS.has(String(name))) {
        out.push({ name: String(name), field: `c_${out.length}`, index: idx });
      }
    });
    return out;
  }, [columns]);

  const [filters, setFilters] = React.useState<DataTableFilterMeta>({});
  const [visibleCount, setVisibleCount] = React.useState<number>(0);

  const tableRows = React.useMemo(() => {
    const rowsRaw = Array.isArray(skuList?.rows) ? skuList!.rows! : [];

    // Backend shape: rows are arrays aligned to columns
    return rowsRaw.map((r: any, idx: number) => {
      const obj: any = {};
      obj.__rowKey = String(idx);

      if (Array.isArray(r)) {
        colFieldMap.forEach(({ field, index }) => {
          obj[field] = r[index];
        });

        // If "id" exists, use it as stable key
        const idIndex = columns.indexOf("id");
        if (idIndex >= 0 && r[idIndex] != null) {
          obj.__rowKey = String(r[idIndex]);
        }
      } else if (r && typeof r === "object") {
        // If backend ever sends object rows, support that too
        colFieldMap.forEach(({ name, field }) => {
          obj[field] = (r as any)[name];
        });
        if ((r as any).id != null) obj.__rowKey = String((r as any).id);
      }

      return obj;
    });
  }, [skuList, columns, colFieldMap]);

  const numericFieldSet = React.useMemo(() => {
    const set = new Set<string>();
    const sample = tableRows.slice(0, 100);

    for (const { field } of colFieldMap) {
      let seen = 0;
      let numeric = 0;

      for (const r of sample) {
        const v = r?.[field];
        if (v == null || String(v).trim() === "") continue;

        seen += 1;
        if (isFiniteNumberLike(v)) numeric += 1;

        if (seen >= 10) break;
      }

      if (seen > 0 && numeric / seen >= 0.8) {
        set.add(field);
      }
    }

    return set;
  }, [tableRows, colFieldMap]);

  const isNumericField = React.useCallback(
    (field: string) => numericFieldSet.has(field),
    [numericFieldSet],
  );

  // Initialize filter model for dynamic fields (must run after numeric detection)
  React.useEffect(() => {
    if (!colFieldMap.length) return;

    setFilters((prev) => {
      const next: any = { ...(prev || {}) };

      if (!next.global) {
        next.global = { value: null, matchMode: FilterMatchMode.CONTAINS };
      }

      colFieldMap.forEach(({ field }) => {
        const numeric = isNumericField(field);

        if (!next[field]) {
          next[field] = {
            operator: FilterOperator.AND,
            constraints: [
              {
                value: null,
                matchMode: numeric
                  ? FilterMatchMode.EQUALS
                  : FilterMatchMode.CONTAINS,
              },
            ],
          };
        }
      });

      Object.keys(next).forEach((k) => {
        if (k === "global") return;
        if (!colFieldMap.some((c) => c.field === k)) delete next[k];
      });

      return next;
    });
  }, [colFieldMap, isNumericField]);

  React.useEffect(() => {
    setVisibleCount(tableRows.length);
  }, [tableRows.length]);

  const virtualScrollerOptions = React.useMemo(
    () => ({
      itemSize: 40,
      delay: 0,
    }),
    [],
  );

  if (!skuList) {
    return (
      <div className="p-4 text-[13px] text-gray-600">
        SKU List is not available yet.
      </div>
    );
  }

  if (!columns.length || !tableRows.length) {
    return (
      <div className="p-4 text-[13px] text-gray-600">
        No SKU List data returned.
      </div>
    );
  }

  const headerBar = (
    <div className="flex items-center justify-between border border-gray-200 rounded-t-md bg-gray-50 px-3 py-2">
      <div className="flex flex-col">
        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
          <span className="text-xs text-gray-600"><span className="font-semibold">Available SKUs:</span> {visibleCount}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {headerBar}

      <div className="relative">
        <Table<any[]>
          value={tableRows}
          dataKey="__rowKey"
          showGridlines
          scrollable
          scrollHeight="65vh"
          virtualScrollerOptions={virtualScrollerOptions}
          className="app-table sku-selection-table cases-header-grey rounded-b-md"
          emptyMessage="No SKU rows."
          filters={filters}
          onFilter={(e: any) => setFilters(e.filters)}
          filterDisplay="menu"
          onValueChange={(visibleRows: any[]) => {
            setVisibleCount(
              Array.isArray(visibleRows) ? visibleRows.length : 0,
            );
          }}
        >
          {colFieldMap.map(({ name, field }) => {
            const filtered = isColumnFilterActive((filters as any)?.[field]);
            const numeric = isNumericField(field);

            return (
              <Column
                key={field}
                field={field}
                header={name}
                filter
                filterPlaceholder={numeric ? "Enter number" : "Search"}
                headerClassName={filtered ? "col-filter-active" : undefined}
                dataType={numeric ? "numeric" : "text"}
                filterMatchModeOptions={
                  numeric ? NUMERIC_FILTER_MODES : TEXT_FILTER_MODES
                }
                body={(row: any) => {
                  const v = row?.[field];
                  const s = v == null ? "" : String(v);
                  return (
                    <span className="sku-cell" title={s}>
                      {s}
                    </span>
                  );
                }}
              />
            );
          })}
        </Table>
      </div>
    </div>
  );
}
