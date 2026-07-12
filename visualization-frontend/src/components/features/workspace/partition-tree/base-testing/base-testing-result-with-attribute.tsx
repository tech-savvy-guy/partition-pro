import * as React from "react";
import { usePartitionTreeContext } from "../context";
import { DataGrid } from "../components/data-grid";
import "../partition-tree.css";
import type { BaseTestingItem } from "./base-testing-result";
import {
  getBaseTestingHeatmapLegendBins,
  computeBaseTestingHeatmapMetaFromMatrix,
  getBaseTestingHeatmapStyle,
  formatHeatmapNumber,
  DEFAULT_HEATMAP_DECIMAL_PLACES,
  clampHeatmapDecimalPlaces,
  type DiagonalBucketHeatmapMeta,
} from "@/lib/partition-tree/heatmap";
import { HeatmapStartStepEditor } from "../heatmap-controls";
import { HeatmapDecimalPlacesSelect } from "../heatmap-controls";
import {
  loadHeatmapOverride as loadOverride,
  patchHeatmapOverride,
} from "@/lib/partition-tree/storage";
import { exportExcelTable, type ExcelCell } from "@/lib/partition-tree/excel-export";

type Props = {
  item: BaseTestingItem;
  /** When false, table expands to content height; parent should handle scroll. Use in modals to avoid nested scrollbars. */
  scrollable?: boolean;
  /** Hide the top attribute title/meta row when embedding inside another panel header. */
  showAttributeHeader?: boolean;
  /** Controls whether the CSV icon appears in the top meta row. */
  showCsvDownload?: boolean;
};

function isOldShapeColumns(cols: any): cols is { id: string; label: string }[] {
  return Array.isArray(cols) && cols.length > 0 && typeof cols[0] === "object";
}

function formatCell(v: any, decimalPlaces: number = DEFAULT_HEATMAP_DECIMAL_PLACES) {
  if (v == null) return "";
  const num = typeof v === "number" ? v : Number(v);
  if (Number.isFinite(num)) return formatHeatmapNumber(num, decimalPlaces);
  return String(v);
}

function formatRowStatus(v: any) {
  const isTrue = v === true || String(v).toUpperCase() === "TRUE";
  const isFalse = v === false || String(v).toUpperCase() === "FALSE";
  if (isTrue) return "TRUE";
  if (isFalse) return "FALSE";
  return String(v ?? "");
}

function sanitizeFilenamePart(v: string) {
  const sanitized = String(v)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "attribute";
}

function flattenRow(
  r: any,
  colLabels: string[],
  shape: "old" | "new",
): Record<string, any> {
  const flat: Record<string, any> = {
    __rowKey: r.__rowKey,
    rowStatus: r.rowStatus ?? "",
    nRow: r.nRow ?? "",
    rowLabel: r.rowLabel ?? "",
  };
  colLabels.forEach((lbl, i) => {
    flat[`__val_${i}`] =
      shape === "new" ? r?.values?.[i] : r?.values?.[lbl];
  });
  return flat;
}

function HeatmapLegendInline({
  meta,
  decimalPlaces,
  onDecimalPlacesChange,
  onSubmitStartStep,
}: {
  meta: DiagonalBucketHeatmapMeta;
  decimalPlaces: number;
  onDecimalPlacesChange: (decimalPlaces: number) => void;
  onSubmitStartStep: (start: number, step: number) => void;
}) {
  const bins = React.useMemo(
    () => getBaseTestingHeatmapLegendBins(meta, decimalPlaces),
    [meta, decimalPlaces],
  );

  return (
    <div className="border border-gray-200 rounded-md bg-white px-3 py-2 mb-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="font-semibold text-gray-800">Heatmap legend</span>

        <HeatmapStartStepEditor
          startLabel="Start (min non-zero diagonal)"
          stepLabel="Step"
          startValue={meta.start}
          stepValue={meta.step}
          onSubmit={({ start, step }) => onSubmitStartStep(start, step)}
        />

        <HeatmapDecimalPlacesSelect
          value={decimalPlaces}
          onChange={onDecimalPlacesChange}
        />

        {bins.map((b) => (
          <span key={b.label} className="inline-flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 border border-gray-300"
              style={{ backgroundColor: b.color }}
            />
            <span className="text-gray-700 whitespace-nowrap">{b.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function EditableHeader({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onChange(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onChange(draft); setEditing(false); }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full border-0 border-b border-gray-400 outline-none bg-transparent p-0"
      />
    );
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      title="Click to edit header"
      className="cursor-text block w-full min-w-0"
    >
      {value || "\u00a0"}
    </span>
  );
}

/**  Single source of truth for ellipsis behavior */
const ellipsisClassName = "block w-full overflow-hidden text-ellipsis whitespace-nowrap";

export default function BaseTestingResultWithAttribute({
  item,
  scrollable = true,
  showAttributeHeader = true,
  showCsvDownload = true,
}: Props) {
  const { caseId, partitionId } = usePartitionTreeContext();
  
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollHeight, setScrollHeight] = React.useState<string>("400px");

  React.useEffect(() => {
    if (!scrollable) return;
    const updateScrollHeight = () => {
      if (tableContainerRef.current) {
        const height = tableContainerRef.current.clientHeight;
        if (height > 0) {
          setScrollHeight(`${height}px`);
        }
      }
    };

    updateScrollHeight();
    const resizeObserver = new ResizeObserver(updateScrollHeight);
    if (tableContainerRef.current) {
      resizeObserver.observe(tableContainerRef.current);
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(updateScrollHeight);
    });

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [scrollable]);

  const parsed = React.useMemo(() => {
    const colsRaw: any = (item as any)?.columns ?? [];
    const rowsRaw: any[] = Array.isArray((item as any)?.rows)
      ? (item as any).rows
      : [];

    // ---------- OLD SHAPE ----------
    // columns: [{id,label}], rows: [{label,n_row,cells:[{column_id,value}]}]
    if (isOldShapeColumns(colsRaw)) {
      const colLabels = colsRaw.map((c) => String(c?.label ?? c?.id ?? ""));

      const tableRows = rowsRaw.map((r: any, idx: number) => {
        const cells = Array.isArray(r?.cells) ? r.cells : [];
        const valueByCol: Record<string, any> = {};
        colLabels.forEach((lbl) => (valueByCol[lbl] = ""));

        cells.forEach((c: any) => {
          const colId = String(c?.column_id ?? "");
          const colObj = colsRaw.find((x) => String(x.id) === colId);
          const header = String(colObj?.label ?? colId);
          valueByCol[header] = c?.value;
        });

        return {
          __rowKey: `${idx}-${String(r?.id ?? r?.label ?? idx)}`,
          rowLabel: String(r?.label ?? r?.id ?? ""),
          nRow: r?.n_row ?? "",
          values: valueByCol,
        };
      });

      return {
        shape: "old" as const,
        nTotal: (item as any)?.n_total ?? "",
        attribute: String((item as any)?.attribute ?? ""),
        colLabels,
        tableRows,
      };
    }

    // ---------- NEW SHAPE ----------
    // columns: ["", 803, "Brand", "A", "B", ...]
    // rows: [row_status, n_row, row_label, [values...]]
    const colsArr: any[] = Array.isArray(colsRaw) ? colsRaw : [];

    const nTotal =
      typeof colsArr?.[1] === "number" || typeof colsArr?.[1] === "string"
        ? colsArr[1]
        : "";

    // actual matrix headers start at index 3
    const colLabels = colsArr.slice(3).map((x) => String(x));

    const tableRows = rowsRaw.map((r: any, idx: number) => {
      const rowStatus = Array.isArray(r) ? r[0] : r?.row_status;
      const nRow = Array.isArray(r) ? r[1] : r?.n_row;
      const rowLabel = Array.isArray(r) ? r[2] : r?.label;

      const values = Array.isArray(r) ? r[3] : r?.values;
      const safeValues: any[] = Array.isArray(values) ? values : [];

      return {
        __rowKey: `${idx}-${String(rowLabel ?? idx)}`,
        rowStatus,
        nRow,
        rowLabel: String(rowLabel ?? ""),
        values: safeValues,
      };
    });

    return {
      shape: "new" as const,
      nTotal,
      attribute: String((item as any)?.attribute ?? ""),
      colLabels,
      tableRows,
    };
  }, [item]);

  // Derived directly from `parsed` — nothing edits these back into state, so
  // compute during render (useMemo) instead of mirroring through useState +
  // useEffect, which forced an extra render on every `parsed` change.
  const editableRows = React.useMemo<any[]>(
    () =>
      parsed.tableRows.map((r) => flattenRow(r, parsed.colLabels, parsed.shape)),
    [parsed.tableRows, parsed.colLabels, parsed.shape],
  );
  const columnOrder = React.useMemo<number[]>(
    () => parsed.colLabels.map((_, idx) => idx),
    [parsed.colLabels],
  );
  // ---- Build matrix + compute heatmap meta (front-end enrichment) ----
  const heatMeta = React.useMemo(() => {
    const matrix: any[][] = editableRows.map((r: any) =>
      columnOrder.map((colIdx) => r[`__val_${colIdx}`]),
    );
    return computeBaseTestingHeatmapMetaFromMatrix(matrix);
  }, [editableRows, columnOrder]);

  const [override, setOverride] = React.useState<{
    start: number;
    step: number;
  } | null>(null);
  const [decimalPlaces, setDecimalPlaces] = React.useState(
    DEFAULT_HEATMAP_DECIMAL_PLACES,
  );

  // reset override when attribute changes (prevents leaking edits between attributes)
  // also load from localStorage for the new attribute
  React.useEffect(() => {
    if (!caseId || !partitionId || !parsed.attribute) {
      setOverride(null);
      setDecimalPlaces(DEFAULT_HEATMAP_DECIMAL_PLACES);
      return;
    }

    const componentType = `basetesting:${parsed.attribute}`;
    const stored = loadOverride(caseId, partitionId, componentType);
    if (stored && stored.start != null && stored.step != null) {
      setOverride({ start: stored.start, step: stored.step });
    } else {
      setOverride(null);
    }
    if (stored?.decimalPlaces != null) {
      setDecimalPlaces(clampHeatmapDecimalPlaces(stored.decimalPlaces));
    } else {
      setDecimalPlaces(DEFAULT_HEATMAP_DECIMAL_PLACES);
    }
  }, [parsed.attribute, caseId, partitionId]);

  const effectiveMeta = React.useMemo(() => {
    if (!override) return heatMeta;

    const start = override.start;
    const step = override.step;

    if (!Number.isFinite(start) || !Number.isFinite(step) || step <= 0)
      return heatMeta;

    const t1 = start;
    const t2 = start + step;
    const t3 = start + 2 * step;
    const t4 = start + 3 * step;

    return { ...heatMeta, start, step, thresholds: { t1, t2, t3, t4 } };
  }, [heatMeta, override]);

  const [headerLabels, setHeaderLabels] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {
      rowStatus: "Holds",
      nRow: "#SKUs",
      rowLabel: parsed.attribute || "Attribute value",
    };
    parsed.colLabels.forEach((lbl, i) => { init[`__val_${i}`] = lbl; });
    return init;
  });

  React.useEffect(() => {
    setHeaderLabels({
      rowStatus: "Holds",
      nRow: "#SKUs",
      rowLabel: parsed.attribute || "Attribute value",
      ...Object.fromEntries(parsed.colLabels.map((lbl, i) => [`__val_${i}`, lbl])),
    });
  }, [parsed.attribute, parsed.colLabels]);

  const exportAsExcel = React.useCallback(() => {
    const headers: ExcelCell[] = [
      headerLabels.rowStatus ?? "Holds",
      headerLabels.nRow ?? "#SKUs",
      headerLabels.rowLabel ?? (parsed.attribute || "Attribute value"),
      ...columnOrder.map(
        (colIdx) =>
          headerLabels[`__val_${colIdx}`] ?? parsed.colLabels[colIdx] ?? "",
      ),
    ].map((value) => ({ value, header: true }));

    const rows: ExcelCell[][] = editableRows.map((row: any) => {
      const rowStatus = formatRowStatus(row.rowStatus);
      const isTrue = rowStatus === "TRUE";
      const isFalse = rowStatus === "FALSE";

      return [
        {
          value: rowStatus,
          style: isTrue
            ? {
                backgroundColor: "#dcfce7",
                color: "#166534",
                fontWeight: 700,
                textAlign: "center",
              }
            : isFalse
              ? {
                  backgroundColor: "#fee2e2",
                  color: "#7f1d1d",
                  fontWeight: 700,
                  textAlign: "center",
                }
              : { textAlign: "center" },
        },
        { value: row.nRow ?? "", style: { textAlign: "center" } },
        { value: row.rowLabel ?? "", style: { backgroundColor: "#f9fafb" } },
        ...columnOrder.map((colIdx) => {
          const raw = row[`__val_${colIdx}`];
          return {
            value: formatCell(raw, decimalPlaces),
            style: getBaseTestingHeatmapStyle(raw, effectiveMeta),
          };
        }),
      ];
    });

    exportExcelTable({
      filename: `base_testing_${sanitizeFilenamePart(parsed.attribute)}.xlsx`,
      sheetName: "Base Testing Math",
      rows: [headers, ...rows],
    });
  }, [
    editableRows,
    headerLabels,
    parsed.attribute,
    parsed.colLabels,
    columnOrder,
    effectiveMeta,
    decimalPlaces,
  ]);

  if (!parsed.colLabels.length || !parsed.tableRows.length) {
    return (
      <div className="p-4 h-full flex items-center justify-center text-[13px] text-gray-700">
        No detailed results available for this attribute.
      </div>
    );
  } 

  return (
    <div className="w-full min-w-0 p-4 h-full flex flex-col min-h-0">
      {showAttributeHeader ? (
        <div className="mb-3 flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-gray-900">
                {parsed.attribute || "Attribute"}
              </div>
              {parsed.nTotal !== "" ? (
                <div className="text-[12px] text-gray-600">
                  Total SKUs: <b>{String(parsed.nTotal)}</b>
                </div>
              ) : null}
            </div>
            {showCsvDownload ? (
              <button
                type="button"
                onClick={exportAsExcel}
                className="inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
                title="Download Excel"
                aria-label="Download Excel"
              >
                <i className="pi pi-download text-[14px]" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/*  Legend (same pattern as OBM/BaseMath; does NOT affect existing table behavior) */}
      <div className="mb-3 flex-shrink-0">
        <HeatmapLegendInline
          meta={effectiveMeta}
          decimalPlaces={decimalPlaces}
          onDecimalPlacesChange={(next) => {
            const clamped = clampHeatmapDecimalPlaces(next);
            setDecimalPlaces(clamped);
            if (caseId && partitionId && parsed.attribute) {
              patchHeatmapOverride(
                caseId,
                partitionId,
                `basetesting:${parsed.attribute}`,
                { decimalPlaces: clamped },
              );
            }
          }}
          onSubmitStartStep={(start, step) => {
            if (
              heatMeta.start != null &&
              heatMeta.step != null &&
              start === heatMeta.start &&
              step === heatMeta.step
            ) {
              setOverride(null);
              if (caseId && partitionId && parsed.attribute) {
                patchHeatmapOverride(
                  caseId,
                  partitionId,
                  `basetesting:${parsed.attribute}`,
                  { start: null, step: null },
                );
              }
            } else {
              setOverride({ start, step });
              if (caseId && partitionId && parsed.attribute) {
                patchHeatmapOverride(
                  caseId,
                  partitionId,
                  `basetesting:${parsed.attribute}`,
                  { start, step },
                );
              }
            }
          }}
        />
      </div>
      <div ref={tableContainerRef} className="flex-1 min-h-0">
        <DataGrid<Record<string, any>>
          key={`bt-${effectiveMeta.start ?? "auto"}-${effectiveMeta.step ?? "auto"}-${decimalPlaces}`}
          rows={editableRows}
          rowKey={(row) => String(row.__rowKey)}
          showGridlines
          className="app-table cases-header-grey base-testing-heatmap-table"
          emptyMessage="No detailed results."
          scrollable={scrollable}
          scrollHeight={scrollable ? scrollHeight : undefined}
          columns={[
            // Row Status — header editable, cells read-only
            {
              key: "rowStatus",
              field: "rowStatus",
              header: (
                <EditableHeader
                  value={headerLabels.rowStatus ?? "Holds"}
                  onChange={(v) =>
                    setHeaderLabels((prev) => ({ ...prev, rowStatus: v }))
                  }
                />
              ),
              headerClassName: "col-center",
              cellClassName: "col-center",
              headerStyle: { width: "90px" },
              cell: (row) => {
                const v = row.rowStatus;
                const isTrue = v === true || String(v).toUpperCase() === "TRUE";
                const isFalse =
                  v === false || String(v).toUpperCase() === "FALSE";
                const label = formatRowStatus(v);
                return (
                  <span
                    title={label}
                    className={`${ellipsisClassName} text-center font-bold rounded px-2 py-1 ${
                      isTrue
                        ? "bg-green-100 text-green-800 border border-gray-100"
                        : isFalse
                          ? "bg-red-100 text-red-900 border border-gray-100"
                          : ""
                    }`}
                  >
                    {label}
                  </span>
                );
              },
            },
            // SKU count — header editable, cells read-only
            {
              key: "nRow",
              field: "nRow",
              header: (
                <EditableHeader
                  value={headerLabels.nRow ?? "#SKUs"}
                  onChange={(v) =>
                    setHeaderLabels((prev) => ({ ...prev, nRow: v }))
                  }
                />
              ),
              headerClassName: "col-center",
              cellClassName: "col-center",
              headerStyle: { width: "90px" },
              cell: (row) => row.nRow ?? "",
            },
            // Attribute value — header editable, cells read-only
            {
              key: "rowLabel",
              field: "rowLabel",
              header: (
                <EditableHeader
                  value={
                    headerLabels.rowLabel ??
                    (parsed.attribute || "Attribute value")
                  }
                  onChange={(v) =>
                    setHeaderLabels((prev) => ({ ...prev, rowLabel: v }))
                  }
                />
              ),
              cellClassName: "base-testing-attribute-value-cell",
              headerStyle: { minWidth: "220px", maxWidth: "300px" },
              cellStyle: { maxWidth: "300px" },
              cell: (row) => {
                const val = String(row.rowLabel ?? "");
                return (
                  <div className={ellipsisClassName} title={val}>
                    {val}
                  </div>
                );
              },
            },
            // Heatmap columns — header editable, cells read-only
            ...columnOrder.map((colIdx) => {
              const lbl = parsed.colLabels[colIdx] ?? "";
              const field = `__val_${colIdx}`;
              return {
                key: `${lbl}-${colIdx}`,
                field,
                header: (
                  <EditableHeader
                    value={headerLabels[field] ?? lbl}
                    onChange={(v) =>
                      setHeaderLabels((prev) => ({ ...prev, [field]: v }))
                    }
                  />
                ),
                headerClassName: "base-testing-heatmap-header",
                headerStyle: { maxWidth: "140px" },
                cell: (row: Record<string, any>) => {
                  const raw = row[field];
                  const styleObj = getBaseTestingHeatmapStyle(
                    raw,
                    effectiveMeta,
                  );
                  const txt = formatCell(raw, decimalPlaces);
                  return (
                    <div
                      className="base-testing-heatmap-cell"
                      style={styleObj}
                      title={txt}
                    >
                      <span className="base-testing-heatmap-cell-text">
                        {txt}
                      </span>
                    </div>
                  );
                },
              };
            }),
          ]}
        />
      </div>
    </div>
  );
}
