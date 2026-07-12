import * as React from "react";
import "./partition-tree.css";

import { DataGrid, type DataGridColumn } from "./components/data-grid";

type SkuListPayload = {
  columns?: Array<string | number | boolean | null>;
  rows?: any[][];
};

type Props = {
  data?: { sku_list?: SkuListPayload | null } | null;
};

// Hide these to keep the table readable (adjust if you want them visible)
const HIDE_COLS = new Set(["id", "case_id", "metadata_id", "pp_metadata_id"]);

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

  const gridColumns = React.useMemo<DataGridColumn<Record<string, any>>[]>(() => {
    return colFieldMap.map(({ name, field }) => {
      const numeric = numericFieldSet.has(field);
      return {
        key: field,
        field,
        header: name,
        filter: true,
        numeric,
        filterPlaceholder: numeric ? "Enter number" : "Search",
        cell: (row: Record<string, any>) => {
          const v = row?.[field];
          const s = v == null ? "" : String(v);
          return (
            <span className="sku-cell" title={s}>
              {s}
            </span>
          );
        },
      };
    });
  }, [colFieldMap, numericFieldSet]);

  React.useEffect(() => {
    setVisibleCount(tableRows.length);
  }, [tableRows.length]);

  const handleVisibleRowsChange = React.useCallback(
    (visibleRows: Record<string, any>[]) => {
      setVisibleCount(Array.isArray(visibleRows) ? visibleRows.length : 0);
    },
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
          <span className="text-xs text-gray-600">
            <span className="font-semibold">Available SKUs:</span> {visibleCount}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {headerBar}

      <div className="relative">
        <DataGrid<Record<string, any>>
          rows={tableRows}
          rowKey={(row) => String(row.__rowKey)}
          columns={gridColumns}
          showGridlines
          scrollable
          scrollHeight="65vh"
          className="app-table sku-selection-table cases-header-grey rounded-b-md"
          emptyMessage="No SKU rows."
          onVisibleRowsChange={handleVisibleRowsChange}
        />
      </div>
    </div>
  );
}
