import React from "react";
import { useParams } from "react-router-dom";
import { Table, Col as Column } from "@/components/table/Table";
import "@/components/table/Table.css";
import { Button } from "@bain/design-system";
import "../Workflow.css";
import { WorkflowApi } from "@/core/api";
import { DataTableFilterMeta } from "primereact/datatable";
import { FilterMatchMode, FilterOperator } from "primereact/api";
import { useCasePermissions } from "@/core/case/CasePermissionContext";
import { Permission } from "@/core/rbac";

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

type Props = {
  skuSelectedIdsFromBackend: string[];
  skuRefreshToken: number;
  processing: boolean;
  onSubmitSelectedIds: (ids: string[]) => Promise<void> | void;
  readOnly?: boolean;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
};

const HIDE_COLS = new Set(["id", "case_id", "pp_metadata_id"]);

function normalizeIds(ids: any[] | undefined | null): string[] {
  return (ids ?? [])
    .map((x) => String(x ?? "").trim())
    .filter((s) => s && s !== "null" && s !== "undefined");
}

function isNonEmptyFilterValue(v: any): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
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

function isColumnFilterActive(meta: any): boolean {
  if (!meta) return false;

  // menu mode shape: { operator, constraints: [{ value, matchMode }, ...] }
  if (Array.isArray(meta.constraints)) {
    return meta.constraints.some((c: any) => isNonEmptyFilterValue(c?.value));
  }

  // simple shape: { value, matchMode }
  return isNonEmptyFilterValue(meta.value);
}

export default function Overview({
  skuSelectedIdsFromBackend,
  skuRefreshToken,
  processing,
  onSubmitSelectedIds,
  selectedIds,
  onSelectedIdsChange,
  readOnly = false,
}: Props) {
  const { caseId, partitionId } = useParams<{
    caseId: string;
    partitionId: string;
  }>();

  const [rows, setRows] = React.useState<any[]>([]);
  const [cols, setCols] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // controlled filters (CaseBody style)
  const [filters, setFilters] = React.useState<DataTableFilterMeta>({});

  // filtered count (changes when user filters)
  const [visibleCount, setVisibleCount] = React.useState<number>(0);

  // apply backend selection only after refreshToken changes
  const lastAppliedTokenRef = React.useRef<number>(-1);

  const { permissions } = useCasePermissions();
  const canEditWorkflow = permissions.includes(Permission.EditPartitions);

  React.useEffect(() => {
    if (!caseId || !partitionId) return;

    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await WorkflowApi.getSkuSelection(caseId, partitionId);
        if (!mounted) return;

        setRows(res.rows ?? []);
        setCols(res.columns ?? []);
      } catch (e: any) {
        if (!mounted) return;
        const msg =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          "Failed to load SKU selection data.";
        setError(msg);
        setRows([]);
        setCols([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [caseId, partitionId]);

  const visibleCols = React.useMemo(
    () => (cols ?? []).filter((c) => !HIDE_COLS.has(c)),
    [cols],
  );

  const colFieldMap = React.useMemo(
    () => visibleCols.map((name, idx) => ({ name, field: `c_${idx}` })),
    [visibleCols],
  );

  const numericFieldSet = React.useMemo(() => {
    const set = new Set<string>();

    // Decide numeric based on a sample of rows to keep it fast
    const sample = (rows ?? []).slice(0, 100);

    for (const { name, field } of colFieldMap) {
      let seen = 0;
      let numeric = 0;

      for (const r of sample) {
        const v = r?.[name];
        if (v == null || String(v).trim() === "") continue;

        seen += 1;
        if (isFiniteNumberLike(v)) numeric += 1;

        // early exit: if we saw enough and most are numeric
        if (seen >= 10) break;
      }

      // if most non-empty values look numeric => numeric column
      if (seen > 0 && numeric / seen >= 0.8) {
        set.add(field);
      }
    }

    return set;
  }, [rows, colFieldMap]);

  // Build lightweight rows. Numeric fields are converted to numbers so Prime
  // filters compare 7, 20, 596 numerically instead of lexicographically.
  const tableRows = React.useMemo(() => {
    return (rows ?? []).map((r) => {
      const out: any = { id: r?.id };
      colFieldMap.forEach(({ name, field }) => {
        const value = r?.[name];
        out[field] =
          numericFieldSet.has(field) && isFiniteNumberLike(value)
            ? Number(value)
            : value;
      });
      return out;
    });
  }, [rows, colFieldMap, numericFieldSet]);

  const isNumericField = React.useCallback(
    (field: string) => numericFieldSet.has(field),
    [numericFieldSet],
  );

  // keep visibleCount synced initially (before any filter applied)
  React.useEffect(() => {
    setVisibleCount(tableRows.length);
  }, [tableRows.length]);

  const rowById = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const r of tableRows) {
      const id = r?.id != null ? String(r.id) : "";
      if (id) m.set(id, r);
    }
    return m;
  }, [tableRows]);

  const backendSelectedIds = React.useMemo(
    () => normalizeIds(skuSelectedIdsFromBackend),
    [skuSelectedIdsFromBackend],
  );

  // Auto-apply backend selection ONLY when token changes (or first time)
  React.useEffect(() => {
    if (!tableRows.length) return;
    if (lastAppliedTokenRef.current === skuRefreshToken) return;

    lastAppliedTokenRef.current = skuRefreshToken;

    // allow clearing selection too
    const valid = backendSelectedIds.filter((id) => rowById.has(id));
    onSelectedIdsChange(valid);
  }, [
    skuRefreshToken,
    tableRows.length,
    backendSelectedIds,
    rowById,
    onSelectedIdsChange,
  ]);

  const selectedRows = React.useMemo(() => {
    return normalizeIds(selectedIds)
      .map((id) => rowById.get(id))
      .filter(Boolean);
  }, [selectedIds, rowById]);

  // Unsaved pill: current selection differs from backend selection
  const skuDirty = React.useMemo(() => {
    const a = new Set(normalizeIds(selectedIds));
    const b = new Set(backendSelectedIds);
    if (a.size !== b.size) return true;
    for (const id of a) if (!b.has(id)) return true;
    return false;
  }, [selectedIds, backendSelectedIds]);

  const virtualScrollerOptions = React.useMemo(
    () => ({
      itemSize: 40,
      delay: 0,
    }),
    [],
  );

  // Initialize filter model for dynamic fields (fix blank filter menu)
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
        } else {
          // If it exists but has empty constraints, keep it consistent
          if (
            Array.isArray(next[field]?.constraints) &&
            next[field].constraints.length > 0
          ) {
            // don't override user's selected matchMode/value
          }
        }
      });

      Object.keys(next).forEach((k) => {
        if (k === "global") return;
        if (!colFieldMap.some((c) => c.field === k)) delete next[k];
      });

      return next;
    });
  }, [colFieldMap, isNumericField]);

  const headerBar = (
    <div className="sku-selection-overview-toolbar">
      <div className="sku-selection-overview-toolbar__copy">
        <span className="sku-selection-overview-toolbar__title">
          Select SKUs to include and submit
        </span>

        <div className="sku-selection-overview-toolbar__meta">
          <span>{visibleCount} SKUs</span>
          <span>•</span>
          <span>{normalizeIds(selectedIds).length} selected</span>
          {skuDirty && (
            <>
              <span>•</span>
              <span className="sku-unsaved-pill">Unsaved changes</span>
            </>
          )}
        </div>
      </div>

      {canEditWorkflow && (
        <Button
          kind="primary"
          size="sm"
          onClick={() => onSubmitSelectedIds(normalizeIds(selectedIds))}
          disabled={
            readOnly || processing || normalizeIds(selectedIds).length === 0
          }
        >
          Submit
        </Button>
      )}
    </div>
  );

  return (
    <div>
      {headerBar}

      <div className="workflow-sku-selection-table-wrap">
        {error && (
          <div className="border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <div className="relative">
          <Table<any>
          value={tableRows}
          dataKey="id"
          showGridlines
          loading={loading}
          filters={filters}
          onFilter={(e: any) => setFilters(e.filters)}
          filterDisplay="menu"
          scrollable
          isDataSelectable={(e: any) => canEditWorkflow}
          scrollHeight="65vh"
          virtualScrollerOptions={virtualScrollerOptions}
          selection={selectedRows as any}
          onSelectionChange={(e: any) => {
            if (!canEditWorkflow) return;
            const val = Array.isArray(e.value)
              ? e.value
              : e.value
                ? [e.value]
                : [];
            const ids = val
              .map((r: any) => String(r?.id ?? "").trim())
              .filter((s: string) => s && s !== "null" && s !== "undefined");
            onSelectedIdsChange(Array.from(new Set(ids)));
          }}
          onValueChange={(visibleRows: any[]) => {
            setVisibleCount(
              Array.isArray(visibleRows) ? visibleRows.length : 0,
            );
          }}
          responsiveLayout="scroll"
          className="app-table sku-selection-table cases-header-grey"
          emptyMessage={loading ? "Loading SKU selection..." : "No SKUs found."}
        >
          <Column
            selectionMode="multiple"
            headerClassName="col-checkbox"
            bodyClassName="col-checkbox"
          />
          {colFieldMap.map(({ name, field }) => {
            const filtered = isColumnFilterActive((filters as any)?.[field]);
            const numeric = isNumericField(field);

            return (
              <Column
                key={name}
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

        {loading && tableRows.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <i className="pi pi-spin pi-spinner text-2xl text-gray-600" />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
