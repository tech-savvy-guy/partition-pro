import * as React from "react";
import { useParams } from "react-router-dom";
import { Table, Col as Column } from "@/components/table/Table";
import "@/components/table/Table.css";
import { ColumnGroup } from "primereact/columngroup";
import { Row } from "primereact/row";
import {
  computeLevelTestingHeatmapMetaFromMatrix,
  getLevelTestingHeatmapLegendBins,
  getLevelTestingHeatmapStyle,
  formatHeatmapNumber,
  DEFAULT_HEATMAP_DECIMAL_PLACES,
  clampHeatmapDecimalPlaces,
  type LevelTestingHeatmapMeta,
} from "@/components/heatmap";
import { HeatmapStartStepEditor } from "@/components/HeatmapStartStepEditor";
import { HeatmapDecimalPlacesSelect } from "@/components/HeatmapDecimalPlacesSelect";
import {
  loadHeatmapOverride as loadOverride,
  patchHeatmapOverride,
} from "@/core/storage/workflowMetadata";
import type { LevelTestingPair } from "../../Index";
import { exportExcelTable, type ExcelCell } from "@/utils/excelExport";

type Props = {
  pair: LevelTestingPair;
};

function toNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtNum(v: number | null, decimalPlaces: number) {
  if (v == null) return "-";
  return formatHeatmapNumber(v, decimalPlaces);
}

function roundWinnerLabel(roundWinner: any) {
  const rw = String(roundWinner ?? "").trim();
  if (!rw || rw.toLowerCase() === "none") return "None";
  return rw;
}

function sanitizeFilenamePart(v: string) {
  const sanitized = String(v)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "level_testing";
}

function isBackendMatrixMath(pair: LevelTestingPair) {
  const cols = (pair as any)?.math?.columns;
  const rows = (pair as any)?.math?.rows;

  return (
    Array.isArray(cols) &&
    Array.isArray(cols[0]) &&
    Array.isArray(cols[1]) &&
    Array.isArray(rows) &&
    rows.some((r: any) => Array.isArray(r?.[3])) // ROI array present
  );
}
function HeatmapLegendInline({
  meta,
  decimalPlaces,
  onDecimalPlacesChange,
  onSubmitStartStep,
}: {
  meta: LevelTestingHeatmapMeta;
  decimalPlaces: number;
  onDecimalPlacesChange: (decimalPlaces: number) => void;
  onSubmitStartStep: (start: number, step: number) => void;
}) {
  const bins = React.useMemo(
    () => getLevelTestingHeatmapLegendBins(meta, decimalPlaces),
    [meta, decimalPlaces],
  );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-gray-700">
      <span className="font-semibold text-gray-900">Heatmap legend</span>

      <HeatmapStartStepEditor
        startLabel="Start (min non-zero diagonal)"
        stepLabel="Step"
        startValue={meta.start}
        stepValue={meta.step}
        inputStep={0.5}
        onSubmit={({ start, step }) => onSubmitStartStep(start, step)}
      />

      <HeatmapDecimalPlacesSelect
        value={decimalPlaces}
        onChange={onDecimalPlacesChange}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {bins
          .filter((b) => b.color !== "transparent")
          .map((b) => (
            <span key={b.label} className="inline-flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-[2px] border border-gray-300"
                style={{ backgroundColor: b.color }}
              />
              <span>{b.label}</span>
            </span>
          ))}
      </div>

      <span className="text-gray-500">0 values are shown in black.</span>
    </div>
  );
}

export default function LevelTestingMath({ pair }: Props) {
  const { caseId, partitionId } = useParams<{
    caseId: string;
    partitionId: string;
  }>();
  const storageKey = React.useMemo(
    () => `leveltesting-math:${pair.L1 ?? ""}_${pair.L2 ?? ""}`,
    [pair.L1, pair.L2],
  );

  const [override, setOverride] = React.useState<{
    start: number;
    step: number;
  } | null>(null);
  const [decimalPlaces, setDecimalPlaces] = React.useState(
    DEFAULT_HEATMAP_DECIMAL_PLACES,
  );

  React.useEffect(() => {
    setOverride(null);

    if (!caseId || !partitionId) {
      setDecimalPlaces(DEFAULT_HEATMAP_DECIMAL_PLACES);
      return;
    }

    const stored = loadOverride(caseId, partitionId, storageKey);
    if (stored?.start != null && stored?.step != null) {
      setOverride({ start: stored.start, step: stored.step });
    }
    if (stored?.decimalPlaces != null) {
      setDecimalPlaces(clampHeatmapDecimalPlaces(stored.decimalPlaces));
    } else {
      setDecimalPlaces(DEFAULT_HEATMAP_DECIMAL_PLACES);
    }
  }, [pair, caseId, partitionId, storageKey]);

  const persistHeatmapSettings = React.useCallback(
    (patch: {
      start?: number | null;
      step?: number | null;
      decimalPlaces?: number;
    }) => {
      if (!caseId || !partitionId) return;

      patchHeatmapOverride(caseId, partitionId, storageKey, {
        start:
          patch.start !== undefined ? patch.start : (override?.start ?? null),
        step: patch.step !== undefined ? patch.step : (override?.step ?? null),
        decimalPlaces:
          patch.decimalPlaces !== undefined
            ? patch.decimalPlaces
            : decimalPlaces,
      });
    },
    [caseId, partitionId, storageKey, override, decimalPlaces],
  );
  /**
   *  BACKEND MATRIX VIEW
   * columns: [topHeaderRow[], secondHeaderRow[]]
   * rows: [skuCount, leftVal1, leftVal2, roiArray[]]
   */
  if (isBackendMatrixMath(pair)) {
    const colsRaw = (pair as any).math.columns as any[][];
    const rowsRaw = Array.isArray((pair as any).math.rows)
      ? ((pair as any).math.rows as any[])
      : [];

    const h0 = colsRaw[0].map((c) => String(c ?? "")); // top header row
    const h1 = colsRaw[1].map((c) => String(c ?? "")); // second header row

    // h1[0] often contains total N
    const totalN = h1?.[0] ? String(h1[0]) : "";
    const leftAttr1Name = h1?.[1] ? String(h1[1]) : ""; // Branded vs PL
    const leftAttr2Name = h1?.[2] ? String(h1[2]) : ""; // BFY Rolled up

    // Right-side columns begin after 3 slots: ["", "", ""]
    const startIdx = 3;
    const rightCount = Math.max(0, Math.min(h0.length, h1.length) - startIdx);

    // Each ROI index corresponds to (h0[startIdx+j], h1[startIdx+j])
    const rightCols = Array.from({ length: rightCount }, (_, j) => {
      const i = startIdx + j;
      return {
        key: `c${j}`,
        top: h0[i] ?? "",
        sub: h1[i] ?? "",
        roiIndex: j,
      };
    });

    // Build rows: skuCount + leftAttr1Val + leftAttr2Val + c0..cN
    const tableRows = React.useMemo(() => {
      return rowsRaw.map((r: any, k: number) => {
        const skuCount = String(r?.[0] ?? "");
        const left1 = String(r?.[1] ?? "");
        const left2 = String(r?.[2] ?? "");
        const roiArr: any[] = Array.isArray(r?.[3]) ? r[3] : [];

        const obj: any = {
          id: String(k),
          skuCount,
          left1,
          left2,
        };

        rightCols.forEach((c) => {
          obj[c.key] = roiArr?.[c.roiIndex] ?? null;
        });

        return obj;
      });
    }, [rowsRaw, rightCols]);
    // Build a square-ish ROI matrix directly from backend rows[][3]
    const roiMatrix = React.useMemo(() => {
      return rowsRaw.map((r: any) => (Array.isArray(r?.[3]) ? r[3] : []));
    }, [rowsRaw]);

    const heatMeta = React.useMemo(() => {
      return computeLevelTestingHeatmapMetaFromMatrix(roiMatrix);
    }, [roiMatrix]);

    const effectiveMeta: LevelTestingHeatmapMeta = React.useMemo(() => {
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

    const headerGroup = (
      <ColumnGroup>
        {/* Row 1: show BFY, BFY, Non BFY, Non BFY (NO grouping / NO colSpan) */}
        <Row>
          <Column header={totalN ? `N = ${totalN}` : "#SKUS"} rowSpan={2} />

          {/* two left columns exist, but backend top row has blanks -> keep blank */}
          <Column header="" colSpan={2} />

          {/*  this is the key change: render EACH top header cell */}
          {rightCols.map((c) => (
            <Column key={`top-${c.key}`} header={c.top} />
          ))}
        </Row>

        {/* Row 2: left attribute names + right-side sub headers */}
        <Row>
          <Column header={leftAttr1Name} />
          <Column header={leftAttr2Name} />
          {rightCols.map((c) => (
            <Column key={`sub-${c.key}`} header={c.sub} />
          ))}
        </Row>
      </ColumnGroup>
    );

    if (!tableRows.length || !rightCols.length) {
      return (
        <div className="p-4 text-[13px] text-gray-700">
          No level testing math available.
        </div>
      );
    }

    const exportAsExcel = () => {
      const headerRow1: ExcelCell[] = [
        { value: totalN ? `N = ${totalN}` : "#SKUS", header: true },
        { value: "", header: true },
        { value: "", header: true },
        ...rightCols.map((c) => ({ value: c.top, header: true })),
      ];

      const headerRow2: ExcelCell[] = [
        { value: "", header: true },
        { value: leftAttr1Name, header: true },
        { value: leftAttr2Name, header: true },
        ...rightCols.map((c) => ({ value: c.sub, header: true })),
      ];

      const rows: ExcelCell[][] = tableRows.map((row: any) => [
        {
          value: row.skuCount,
          style: { backgroundColor: "#f9fafb", textAlign: "center" },
        },
        { value: row.left1, style: { backgroundColor: "#f9fafb" } },
        { value: row.left2, style: { backgroundColor: "#f9fafb" } },
        ...rightCols.map((c) => {
          const n = toNum(row?.[c.key]);
          return {
            value: n == null ? "-" : fmtNum(n, decimalPlaces),
            style: n == null ? { textAlign: "center" } : getLevelTestingHeatmapStyle(n, effectiveMeta),
          };
        }),
      ]);

      exportExcelTable({
        filename: `level_testing_math_${sanitizeFilenamePart(
          `${leftAttr1Name}_${leftAttr2Name}`,
        )}.xlsx`,
        sheetName: "Level Testing Math",
        rows: [headerRow1, headerRow2, ...rows],
      });
    };

    return (
      <div className="mt-3 px-4">
        <div className="mt-2 mb-3 flex items-start justify-between gap-3 overflow-x-auto whitespace-nowrap">
          <div>
            <HeatmapLegendInline
              meta={effectiveMeta}
              decimalPlaces={decimalPlaces}
              onDecimalPlacesChange={(next) => {
                const clamped = clampHeatmapDecimalPlaces(next);
                setDecimalPlaces(clamped);
                persistHeatmapSettings({ decimalPlaces: clamped });
              }}
              onSubmitStartStep={(start, step) => {
                if (
                  heatMeta.start != null &&
                  heatMeta.step != null &&
                  start === heatMeta.start &&
                  step === heatMeta.step
                ) {
                  setOverride(null);
                  persistHeatmapSettings({ start: null, step: null });
                } else {
                  setOverride({ start, step });
                  persistHeatmapSettings({ start, step });
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={exportAsExcel}
            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
            title="Download Excel"
            aria-label="Download Excel"
          >
            <i className="pi pi-download text-[14px]" />
          </button>
        </div>

        <Table<any[]>
          key={`lt-${effectiveMeta.start ?? "auto"}-${effectiveMeta.step ?? "auto"}-${decimalPlaces}`}
          value={tableRows}
          dataKey="id"
          showGridlines
          headerColumnGroup={headerGroup}
          responsiveLayout="scroll"
          className="app-table rounded-md cases-header-grey level-testing-math-table"
        >
          <Column field="skuCount" />
          <Column field="left1" />
          <Column field="left2" />

          {rightCols.map((c) => (
            <Column
              key={`${c.key}-${decimalPlaces}`}
              body={(row: any) => {
                const n = toNum(row?.[c.key]);
                const style =
                  n == null
                    ? {}
                    : getLevelTestingHeatmapStyle(n, effectiveMeta);

                return (
                  <div className="lt-heatmap-cell" style={style}>
                    {n == null ? "-" : fmtNum(n, decimalPlaces)}
                  </div>
                );
              }}
            />
          ))}
        </Table>
      </div>
    );
  }

  /**
   * Fallback: if backend ever sends old format, keep current behavior
   */
  return (
    <div className="p-4 text-[13px] text-gray-700">
      No level testing math available.
    </div>
  );
}
