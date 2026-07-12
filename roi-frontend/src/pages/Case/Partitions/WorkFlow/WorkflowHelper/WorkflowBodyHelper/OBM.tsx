import * as React from "react";
import { useParams } from "react-router-dom";
import { Col as Column } from "@/components/table/Table";
import { Table } from "@/components/table/Table";
import "@/components/table/Table.css";
import { HeatmapStartStepEditor } from "@/components/HeatmapStartStepEditor";
import {
  loadHeatmapOverride as loadOverride,
  patchHeatmapOverride,
} from "@/core/storage/workflowMetadata";

import {
  computeObmHeatmapMetaFromMatrix,
  getObmHeatmapLegendBins,
  getObmHeatmapStyle,
  formatHeatmapNumber,
  DEFAULT_HEATMAP_DECIMAL_PLACES,
  clampHeatmapDecimalPlaces,
  type ObmHeatmapMeta,
} from "@/components/heatmap";
import { HeatmapDecimalPlacesSelect } from "@/components/HeatmapDecimalPlacesSelect";
import { ObmHoldsBadge } from "@/components/ObmHoldsBadge";
import { exportExcelTable, type ExcelCell } from "@/utils/excelExport";

type Props = {
  workflowData?: any;
};

type ObmMatrixTableProps = {
  columnsRaw: string[];
  rowsRaw: any[];
  obmHolds: boolean | null;
  caseId?: string;
  partitionId?: string;
};

function isCompletedStatus(status: any) {
  const s = String(status ?? "").toUpperCase();
  return s === "COMPLETED" || s === "SUCCESS" || s === "DONE";
}

function toMaybeNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const num = typeof v === "number" ? v : Number(v);
  return Number.isFinite(num) ? num : null;
}

/** Single source of truth for ellipsis behavior */
const ellipsisBlock: React.CSSProperties = {
  display: "block",
  width: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function HeaderCell({ text }: { text: string }) {
  return (
    <span style={ellipsisBlock} title={text}>
      {text}
    </span>
  );
}

function BodyTextCell({ text }: { text: string }) {
  return (
    <span style={ellipsisBlock} title={text}>
      {text}
    </span>
  );
}

function ObmHeatCell({
  value,
  displayText,
  meta,
}: {
  value: number | null;
  displayText: string;
  meta: ObmHeatmapMeta;
}) {
  if (value == null) {
    return (
      <div className="obm-heat-cell">
        <div className="obm-heat-cell-inner" />
      </div>
    );
  }

  const style = getObmHeatmapStyle(value, meta);

  return (
    <div className="obm-heat-cell" title={displayText}>
      <div className="obm-heat-cell-inner" style={style}>
        {displayText}
      </div>
    </div>
  );
}

function HeatmapLegendInline({
  meta,
  obmHolds,
  decimalPlaces,
  onDecimalPlacesChange,
  onSubmitStartStep,
}: {
  meta: ObmHeatmapMeta;
  obmHolds: boolean | null;
  decimalPlaces: number;
  onDecimalPlacesChange: (decimalPlaces: number) => void;
  onSubmitStartStep: (start: number, step: number) => void;
}) {
  const bins = React.useMemo(
    () => getObmHeatmapLegendBins(meta, decimalPlaces),
    [meta, decimalPlaces],
  );

  return (
    <div className="border border-gray-200 rounded-md bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-4 text-xs">
        <ObmHoldsBadge value={obmHolds} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1">
          <span className="font-semibold text-gray-800">
            OBM Shading Gradient
          </span>

          <HeatmapStartStepEditor
            startLabel="Start"
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
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: b.color,
                  border: "1px solid #cfcfcf",
                  display: "inline-block",
                }}
              />
              <span className="text-gray-700 whitespace-nowrap">{b.label}</span>
            </span>
          ))}
        </div>
        <div className="shrink-0" />
      </div>
    </div>
  );
}

function ObmMatrixTable({
  columnsRaw,
  rowsRaw,
  obmHolds,
  caseId,
  partitionId,
}: ObmMatrixTableProps) {
  const baseCount = Math.min(3, columnsRaw.length);
  const baseColumns = React.useMemo(
    () => columnsRaw.slice(0, baseCount),
    [columnsRaw, baseCount],
  );
  const heatColumns = React.useMemo(
    () => columnsRaw.slice(baseCount),
    [columnsRaw, baseCount],
  );

  const dataSignature = React.useMemo(
    () => JSON.stringify({ columnsRaw, rowsRaw }),
    [columnsRaw, rowsRaw],
  );

  const parsedRows = React.useMemo(() => {
    return rowsRaw.map((r: any, idx: number) => {
      const out: any = { __rowKey: String(idx) };

      baseColumns.forEach((colName, i) => {
        if (Array.isArray(r)) out[colName] = r[i];
        else if (r && typeof r === "object") out[colName] = r[colName];
        else out[colName] = "";
      });

      const values: Record<string, number | null> = {};
      if (Array.isArray(r)) {
        const maybeArr = r[baseCount];
        if (Array.isArray(maybeArr)) {
          heatColumns.forEach((colName, j) => {
            values[colName] = toMaybeNumber(maybeArr[j]);
          });
        } else {
          heatColumns.forEach((colName, j) => {
            values[colName] = toMaybeNumber(r[baseCount + j]);
          });
        }
      } else if (r && typeof r === "object") {
        heatColumns.forEach((colName) => {
          values[colName] = toMaybeNumber(r[colName]);
        });
      } else {
        heatColumns.forEach((colName) => {
          values[colName] = null;
        });
      }

      out.__values = values;
      return out;
    });
  }, [rowsRaw, baseColumns, heatColumns, baseCount]);

  const [orderedRows, setOrderedRows] = React.useState<any[]>(() => parsedRows);
  const [heatColumnOrder, setHeatColumnOrder] = React.useState<number[]>(() =>
    heatColumns.map((_, idx) => idx),
  );

  React.useEffect(() => {
    setOrderedRows(parsedRows);
    setHeatColumnOrder(heatColumns.map((_, idx) => idx));
    // Reset row/column order only when backend data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSignature]);

  const baseRowIndexByKey = React.useMemo(() => {
    const map = new Map<string, number>();
    parsedRows.forEach((row, idx) => {
      map.set(String(row?.__rowKey ?? ""), idx);
    });
    return map;
  }, [parsedRows]);

  const displayedHeatColumns = React.useMemo(() => {
    return heatColumnOrder.map((idx) => heatColumns[idx]);
  }, [heatColumnOrder, heatColumns]);

  const handleRowReorder = React.useCallback(
    (e: any) => {
      if (!Array.isArray(e?.value)) return;

      const nextRows = e.value.map((row: any) => {
        const core: any = { ...row };
        delete core.__formattedHeat;
        displayedHeatColumns.forEach((_, heatIdx) => {
          delete core[`__heat_${heatIdx}`];
        });
        return core;
      });
      setOrderedRows(nextRows);

      const seen = new Set<number>();
      const nextOrder: number[] = [];

      nextRows.forEach((row: any) => {
        const baseIdx = baseRowIndexByKey.get(String(row?.__rowKey ?? ""));
        if (
          typeof baseIdx === "number" &&
          baseIdx >= 0 &&
          baseIdx < heatColumns.length &&
          !seen.has(baseIdx)
        ) {
          nextOrder.push(baseIdx);
          seen.add(baseIdx);
        }
      });

      heatColumns.forEach((_, idx) => {
        if (!seen.has(idx)) nextOrder.push(idx);
      });

      if (nextOrder.length === heatColumns.length) {
        setHeatColumnOrder(nextOrder);
      }
    },
    [baseRowIndexByKey, heatColumns, displayedHeatColumns],
  );

  const matrix = React.useMemo(() => {
    return parsedRows.map((row: any) =>
      heatColumns.map((col) => row?.__values?.[col] ?? null),
    );
  }, [parsedRows, heatColumns]);

  const heatmapMeta: ObmHeatmapMeta = React.useMemo(() => {
    return computeObmHeatmapMetaFromMatrix(matrix);
  }, [matrix]);

  const [override, setOverride] = React.useState<{
    start: number;
    step: number;
  } | null>(null);
  const [decimalPlaces, setDecimalPlaces] = React.useState(
    DEFAULT_HEATMAP_DECIMAL_PLACES,
  );

  React.useEffect(() => {
    if (!caseId || !partitionId) return;

    const stored = loadOverride(caseId, partitionId, "obm");
    if (stored?.start != null && stored?.step != null) {
      setOverride({ start: stored.start, step: stored.step });
    } else {
      setOverride(null);
    }
    if (stored?.decimalPlaces != null) {
      setDecimalPlaces(clampHeatmapDecimalPlaces(stored.decimalPlaces));
    } else {
      setDecimalPlaces(DEFAULT_HEATMAP_DECIMAL_PLACES);
    }
  }, [caseId, partitionId]);

  const tableRows = React.useMemo(() => {
    return orderedRows.map((row) => {
      const formattedHeat: Record<string, string> = {};
      const nextRow: any = { ...row, __formattedHeat: formattedHeat };

      displayedHeatColumns.forEach((colKey, heatIdx) => {
        const val = row?.__values?.[colKey] ?? null;
        const text = val == null ? "" : formatHeatmapNumber(val, decimalPlaces);
        formattedHeat[colKey] = text;
        nextRow[`__heat_${heatIdx}`] = text;
      });

      return nextRow;
    });
  }, [orderedRows, displayedHeatColumns, decimalPlaces]);

  const persistHeatmapSettings = React.useCallback(
    (patch: {
      start?: number | null;
      step?: number | null;
      decimalPlaces?: number;
    }) => {
      if (!caseId || !partitionId) return;

      patchHeatmapOverride(caseId, partitionId, "obm", {
        start:
          patch.start !== undefined
            ? patch.start
            : (override?.start ?? null),
        step:
          patch.step !== undefined ? patch.step : (override?.step ?? null),
        decimalPlaces:
          patch.decimalPlaces !== undefined
            ? patch.decimalPlaces
            : decimalPlaces,
      });
    },
    [caseId, partitionId, override, decimalPlaces],
  );

  const effectiveMeta: ObmHeatmapMeta = React.useMemo(() => {
    if (!override) return heatmapMeta;

    const start = override.start;
    const step = override.step;

    if (!Number.isFinite(start) || !Number.isFinite(step) || step <= 0)
      return heatmapMeta;

    const t1 = start;
    const t2 = start + step;
    const t3 = start + 2 * step;
    const t4 = start + 3 * step;

    return { ...heatmapMeta, start, step, thresholds: { t1, t2, t3, t4 } };
  }, [heatmapMeta, override]);

  const formatBaseCell = (v: any) => {
    if (v === true) return "TRUE";
    if (v === false) return "FALSE";
    if (v == null) return "";
    return String(v);
  };

  const formatMetric = React.useCallback(
    (v: number | null) => {
      if (v == null) return "";
      return formatHeatmapNumber(v, decimalPlaces);
    },
    [decimalPlaces],
  );

  const baseWidths = (idx: number) => {
    if (idx === 0) return "72px";
    if (idx === 1) return "88px";
    return "200px";
  };

  const exportObmExcel = () => {
    if (!baseColumns.length || !heatColumns.length || !orderedRows.length)
      return;

    const header: ExcelCell[] = [...baseColumns, ...displayedHeatColumns].map(
      (value) => ({ value, header: true }),
    );

    const rows: ExcelCell[][] = orderedRows.map((row: any) => {
      const baseValues: ExcelCell[] = baseColumns.map((c, idx) => {
        const v = row?.[c];

        if (idx === 0) {
          const isTrue = v === true || String(v).toUpperCase() === "TRUE";
          const isFalse = v === false || String(v).toUpperCase() === "FALSE";

          return {
            value: formatBaseCell(v),
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
                    color: "#991b1b",
                    fontWeight: 700,
                    textAlign: "center",
                  }
                : { textAlign: "center" },
          };
        }

        return {
          value: formatBaseCell(v),
          style: idx === 1 ? { textAlign: "center" } : undefined,
        };
      });

      const heatValues: ExcelCell[] = displayedHeatColumns.map((c) => {
        const v = row?.__values?.[c];
        return {
          value: v == null ? "" : formatMetric(v),
          style: v == null ? undefined : getObmHeatmapStyle(v, effectiveMeta),
        };
      });

      return [...baseValues, ...heatValues];
    });

    exportExcelTable({
      filename: "obm_matrix.xlsx",
      sheetName: "OBM",
      rows: [header, ...rows],
    });
  };

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center justify-between gap-4">
        <HeatmapLegendInline
          meta={effectiveMeta}
          obmHolds={obmHolds}
          decimalPlaces={decimalPlaces}
          onDecimalPlacesChange={(next) => {
            const clamped = clampHeatmapDecimalPlaces(next);
            setDecimalPlaces(clamped);
            persistHeatmapSettings({ decimalPlaces: clamped });
          }}
          onSubmitStartStep={(start, step) => {
            if (
              heatmapMeta.start != null &&
              heatmapMeta.step != null &&
              start === heatmapMeta.start &&
              step === heatmapMeta.step
            ) {
              setOverride(null);
              persistHeatmapSettings({ start: null, step: null });
            } else {
              setOverride({ start, step });
              persistHeatmapSettings({ start, step });
            }
          }}
        />

        <button
          type="button"
          onClick={exportObmExcel}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
          title="Download Excel"
          aria-label="Download Excel"
        >
          <i className="pi pi-download text-[14px]" />
        </button>
      </div>

      <Table
        key={`obm-${effectiveMeta.start ?? "auto"}-${effectiveMeta.step ?? "auto"}-${decimalPlaces}`}
        value={tableRows}
        dataKey="__rowKey"
        showGridlines
        scrollable
        scrollHeight="480px"
        resizableColumns
        columnResizeMode="expand"
        reorderableRows
        onRowReorder={handleRowReorder}
        className="app-table obm-table heatmap-table"
        emptyMessage="No OBM rows."
      >
        <Column
          rowReorder
          headerStyle={{ width: "1.75rem", minWidth: "1.75rem", maxWidth: "1.75rem" }}
          bodyClassName="obm-row-reorder-cell"
        />

        {baseColumns.map((col, idx) => (
          <Column
            key={col}
            header={<HeaderCell text={col} />}
            style={{ width: baseWidths(idx) }}
            headerStyle={{ width: baseWidths(idx) }}
            headerClassName={idx === 1 ? "col-center" : undefined}
            bodyClassName={
              idx === 0 ? "obm-holds-td" : idx === 1 ? "col-center" : undefined
            }
            body={(row: any) => {
              const v = row?.[col];

              if (idx === 0) {
                const isTrue = v === true || String(v).toUpperCase() === "TRUE";
                const isFalse =
                  v === false || String(v).toUpperCase() === "FALSE";

                const label = isTrue
                  ? "TRUE"
                  : isFalse
                    ? "FALSE"
                    : String(v ?? "");

                return (
                  <span
                    title={label}
                    className={`obm-holds-badge${
                      isTrue
                        ? " obm-holds-badge--true"
                        : isFalse
                          ? " obm-holds-badge--false"
                          : ""
                    }`}
                  >
                    {label}
                  </span>
                );
              }

              return <BodyTextCell text={formatBaseCell(v)} />;
            }}
          />
        ))}

        {displayedHeatColumns.map((colKey, heatIdx) => (
          <Column
            key={`${colKey}-${decimalPlaces}`}
            field={`__heat_${heatIdx}`}
            header={<HeaderCell text={colKey} />}
            style={{ width: "110px" }}
            headerStyle={{ width: "110px" }}
            bodyClassName="obm-heat-td"
            body={(row: any) => {
              const val: number | null = row?.__values?.[colKey] ?? null;
              const displayText =
                row?.__formattedHeat?.[colKey] ?? row?.[`__heat_${heatIdx}`] ?? "";

              return (
                <ObmHeatCell
                  value={val}
                  displayText={displayText}
                  meta={effectiveMeta}
                />
              );
            }}
          />
        ))}
      </Table>
    </div>
  );
}

export default function OBM({ workflowData }: Props = {}) {
  const { caseId, partitionId } = useParams<{
    caseId: string;
    partitionId: string;
  }>();
  const obmStep =
    workflowData?.data?.partition_obm ??
    workflowData?.data?.steps?.partition_obm ??
    workflowData?.steps?.partition_obm ??
    workflowData?.workflow_meta?.data?.steps?.partition_obm ??
    null;

  const status = String(obmStep?.status ?? "").toUpperCase();
  const result = obmStep?.result ?? null;

  const columnsRaw = React.useMemo(
    () =>
      Array.isArray(result?.columns)
        ? result.columns.map((x: any) => String(x))
        : [],
    [result?.columns],
  );

  const rowsRaw = React.useMemo(
    () => (Array.isArray(result?.rows) ? result.rows : []),
    [result?.rows],
  );

  if (!workflowData) {
    return <div className="mt-3 text-sm text-gray-600">Loading workflow…</div>;
  }

  if (!obmStep || !status || status === "NOT_STARTED") {
    return (
      <div className="mt-3 text-sm text-gray-600">
        OBM will be available after Level Testing attribute selection.
      </div>
    );
  }

  if (!isCompletedStatus(status)) {
    return (
      <div className="mt-3 text-sm text-gray-600">
        OBM is processing (status: <b>{status || "UNKNOWN"}</b>)…
      </div>
    );
  }

  if (!columnsRaw.length || !rowsRaw.length) {
    return (
      <div className="mt-3 text-sm text-gray-600">
        OBM completed but no data returned.
      </div>
    );
  }

  const obmHolds: boolean | null =
    typeof result?.obm_holds === "boolean" ? result.obm_holds : null;

  return (
    <ObmMatrixTable
      columnsRaw={columnsRaw}
      rowsRaw={rowsRaw}
      obmHolds={obmHolds}
      caseId={caseId}
      partitionId={partitionId}
    />
  );
}
