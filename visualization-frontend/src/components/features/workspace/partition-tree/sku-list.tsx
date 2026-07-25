import * as React from "react";
import "./partition-tree.css";

import { DataGrid, type DataGridColumn } from "./components/data-grid";
import { PackageSearchIcon } from "lucide-react";

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
      <div className="flex h-full min-h-0 items-center justify-center bg-background p-8">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <PackageSearchIcon className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              SKU list is not available yet
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              SKUs will appear here after the workflow has prepared the
              partition data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!columns.length || !tableRows.length) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-background p-8">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <PackageSearchIcon className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">No SKUs found</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              This workflow completed without returning SKU rows.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const headerBar = (
    <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/20 px-6 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-xs">
          <PackageSearchIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Available SKUs</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Filter any column to narrow the result set.
          </p>
        </div>
      </div>
      <div className="shrink-0 rounded-md border border-border bg-background px-3 py-2 text-xs tabular-nums text-muted-foreground shadow-xs">
        <span className="font-semibold text-foreground">{visibleCount}</span>{" "}
        {visibleCount === 1 ? "SKU" : "SKUs"}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-background">
      {headerBar}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <DataGrid<Record<string, any>>
          rows={tableRows}
          rowKey={(row) => String(row.__rowKey)}
          columns={gridColumns}
          showGridlines
          scrollable
          scrollHeight="100%"
          wrapperClassName="h-full w-full"
          className="app-table sku-selection-table cases-header-grey [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-muted/95 [&_thead]:backdrop-blur-sm"
          emptyMessage="No SKUs match the current filters."
          onVisibleRowsChange={handleVisibleRowsChange}
        />
      </div>
    </div>
  );
}
