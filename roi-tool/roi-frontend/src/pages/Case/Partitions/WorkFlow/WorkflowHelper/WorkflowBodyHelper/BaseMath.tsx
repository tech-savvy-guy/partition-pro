import * as React from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import "@/components/table/Table.css";
import {
  HEATMAP_STEP_PRESETS,
  getSteppedHeatmapLegendBins,
  getSteppedHeatmapStyle,
  formatHeatmapNumber,
  DEFAULT_HEATMAP_DECIMAL_PLACES,
  clampHeatmapDecimalPlaces,
  type HeatmapStepPreset,
} from "@/components/heatmap";
import { HeatmapDecimalPlacesSelect } from "@/components/HeatmapDecimalPlacesSelect";
import { VirtualScroller } from "primereact/virtualscroller";
import { MultiSelect } from "primereact/multiselect";
import type { MultiSelectChangeEvent } from "primereact/multiselect";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { HeatmapStartStepEditor } from "@/components/HeatmapStartStepEditor";
import { CaseApi, PartitionApi } from "@/core/api";
import {
  loadHeatmapOverride as loadOverride,
  patchHeatmapOverride,
} from "@/core/storage/workflowMetadata";
import { exportExcelTable, type ExcelCell } from "@/utils/excelExport";

import "@/pages/Case/Partitions/WorkFlow/WorkflowHelper/WorkflowBodyHelper/Workflow.css";
import "./BaseMath.css";

type Props = {
  workflowData?: any;
};

type FilterableColumn = {
  key: string;
  title: string;
  rawIdx: number;
};

type ColumnRule = {
  id: string;
  fieldKey: string;
  values: string[];
};

type BaseMathFilterState = {
  rowFilterSelections: Record<string, string[]>;
  rowFilterSearch: Record<string, string>;
  columnRules: ColumnRule[];
  nextRuleId: number;
};

type SortDirection = "asc" | "desc";

type SortState = {
  fieldKey: string | null;
  direction: SortDirection | null;
};

function HeatmapLegendInline({
  preset,
  decimalPlaces,
  onDecimalPlacesChange,
  showDiagonal = true,
  onSubmitStartStep,
}: {
  preset: HeatmapStepPreset;
  decimalPlaces: number;
  onDecimalPlacesChange: (decimalPlaces: number) => void;
  showDiagonal?: boolean;
  onSubmitStartStep: (startLessThan: number, step: number) => void;
}) {
  const bins = React.useMemo(
    () => getSteppedHeatmapLegendBins(preset, decimalPlaces),
    [preset, decimalPlaces],
  );

  return (
    <div className="border border-gray-200 rounded-md bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="font-semibold text-gray-800">{preset.label}</span>
        <HeatmapStartStepEditor
          startLabel="Start (less than)"
          stepLabel="Step"
          startValue={preset.startLessThan}
          stepValue={preset.step}
          onSubmit={({ start, step }) => onSubmitStartStep(start, step)}
        />

        <HeatmapDecimalPlacesSelect
          value={decimalPlaces}
          onChange={onDecimalPlacesChange}
        />

        {bins.map((b) => (
          <span key={b.label} className="inline-flex items-center gap-2">
            <span
              className="basemath-legend-swatch"
              style={{ backgroundColor: b.color }}
            />
            <span className="text-gray-700 whitespace-nowrap">{b.label}</span>
          </span>
        ))}

        {showDiagonal && (
          <span className="inline-flex items-center gap-2">
            <span
              className="basemath-legend-swatch"
              style={{ backgroundColor: "#000" }}
            />
            <span className="text-gray-700 whitespace-nowrap">Diagonal</span>
          </span>
        )}
      </div>
    </div>
  );
}

const VIRTUAL_THRESHOLD = 80;
const ROW_HEIGHT = 32;
const LABEL_COL_WIDTH = 200;
const MATRIX_COL_WIDTH = 120;
const BASEMATH_FILTER_STORAGE_PREFIX = "basemath_filters";
const SORT_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function safeStr(v: any) {
  return v == null ? "" : String(v);
}

// removes characters that are not allowed in filenames
// replaces whitespace with underscores, and collapses multiple underscores
function sanitizeFilenameSegment(value: any) {
  return safeStr(value)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toFilenameSegment(value: any, fallback: string) {
  const cleaned = sanitizeFilenameSegment(value);

  if (cleaned) return cleaned;

  const fallbackCleaned = sanitizeFilenameSegment(fallback);

  return fallbackCleaned || "value";
}

function toFiniteNumber(value: any): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function cssVars(vars: Record<string, string | number>): React.CSSProperties {
  return vars as React.CSSProperties;
}

function arraysEqual(a: string[], b: string[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function rowFilterSelectionsEqual(
  a: Record<string, string[]>,
  b: Record<string, string[]>,
) {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();

  if (!arraysEqual(aKeys, bKeys)) return false;

  for (const key of aKeys) {
    if (!arraysEqual(a[key] ?? [], b[key] ?? [])) return false;
  }

  return true;
}

function columnRulesEqual(a: ColumnRule[], b: ColumnRule[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id) return false;
    if (a[i].fieldKey !== b[i].fieldKey) return false;
    if (!arraysEqual(a[i].values, b[i].values)) return false;
  }

  return true;
}

function stringRecordEqual(
  a: Record<string, string>,
  b: Record<string, string>,
) {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();

  if (!arraysEqual(aKeys, bKeys)) return false;

  for (const key of aKeys) {
    if ((a[key] ?? "") !== (b[key] ?? "")) return false;
  }

  return true;
}

function getBaseMathFilterStorageKey(caseId: string, partitionId: string) {
  return `${BASEMATH_FILTER_STORAGE_PREFIX}:${caseId}:${partitionId}`;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function sanitizeRowFilterSelections(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const next: Record<string, string[]> = {};
  Object.entries(value).forEach(([fieldKey, selections]) => {
    if (!fieldKey) return;
    next[fieldKey] = sanitizeStringArray(selections);
  });

  return next;
}

function sanitizeRowFilterSearch(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const next: Record<string, string> = {};
  Object.entries(value).forEach(([fieldKey, searchValue]) => {
    if (!fieldKey || typeof searchValue !== "string") return;
    next[fieldKey] = searchValue;
  });

  return next;
}

function sanitizeColumnRules(value: unknown): ColumnRule[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const candidate = item as Partial<ColumnRule>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.fieldKey !== "string"
    ) {
      return [];
    }

    return [
      {
        id: candidate.id,
        fieldKey: candidate.fieldKey,
        values: sanitizeStringArray(candidate.values),
      },
    ];
  });
}

function deriveNextRuleId(columnRules: ColumnRule[]) {
  const baseNextId = columnRules.length + 1;

  return columnRules.reduce((maxId, rule) => {
    const match = /^rule_(\d+)$/.exec(rule.id);
    if (!match) return maxId;

    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) return maxId;

    return Math.max(maxId, parsed + 1);
  }, baseNextId);
}

function loadBaseMathFilterState(
  storageKey: string,
): BaseMathFilterState | null {
  try {
    if (typeof window === "undefined") return null;

    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const rowFilterSelections = sanitizeRowFilterSelections(
      parsed.rowFilterSelections,
    );
    const rowFilterSearch = sanitizeRowFilterSearch(parsed.rowFilterSearch);
    const columnRules = sanitizeColumnRules(parsed.columnRules);

    const nextRuleIdRaw = parsed.nextRuleId;
    const nextRuleId =
      typeof nextRuleIdRaw === "number" && Number.isFinite(nextRuleIdRaw)
        ? Math.max(1, Math.floor(nextRuleIdRaw))
        : deriveNextRuleId(columnRules);

    return {
      rowFilterSelections,
      rowFilterSearch,
      columnRules,
      nextRuleId,
    };
  } catch {
    return null;
  }
}

function saveBaseMathFilterState(
  storageKey: string,
  state: BaseMathFilterState,
): void {
  try {
    if (typeof window === "undefined") return;

    const hasFilters =
      Object.values(state.rowFilterSelections).some(
        (values) => values.length > 0,
      ) ||
      Object.values(state.rowFilterSearch).some(
        (value) => value.trim().length > 0,
      ) ||
      state.columnRules.length > 0;

    if (!hasFilters) {
      localStorage.removeItem(storageKey);
      return;
    }

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        rowFilterSelections: state.rowFilterSelections,
        rowFilterSearch: state.rowFilterSearch,
        columnRules: state.columnRules,
        nextRuleId: state.nextRuleId,
      }),
    );
  } catch (error) {
    console.error("Failed to persist Base Math filters", error);
  }
}

function compareSortValues(a: string, b: string) {
  const aNum = toFiniteNumber(a);
  const bNum = toFiniteNumber(b);

  if (aNum != null && bNum != null) {
    return aNum - bNum;
  }

  return SORT_COLLATOR.compare(a, b);
}

function getSortIconClass(direction: SortDirection | null) {
  if (direction === "asc") return "pi pi-sort-amount-up-alt";
  if (direction === "desc") return "pi pi-sort-amount-down";
  return "pi pi-sort-alt";
}

function getSelectedSkuCount(workflowData: any): number {
  const skuStep =
    workflowData?.data?.sku_selection ??
    workflowData?.data?.steps?.sku_selection ??
    workflowData?.steps?.sku_selection ??
    workflowData?.workflow_meta?.data?.steps?.sku_selection ??
    null;

  if (!skuStep) return 0;

  const ids =
    skuStep?.selected_ids ??
    skuStep?.selectedSkuIds ??
    skuStep?.result?.selected_ids ??
    skuStep?.result?.selected_sku_ids ??
    skuStep?.result?.selectedSkuIds ??
    null;

  if (Array.isArray(ids)) return ids.length;

  const n =
    skuStep?.result?.overall_coverage?.current_selection?.skus ??
    skuStep?.result?.overallCoverage?.currentSelection?.skus ??
    skuStep?.overall_coverage?.current_selection?.skus ??
    skuStep?.overallCoverage?.currentSelection?.skus ??
    null;

  const num = Number(n);
  if (Number.isFinite(num) && num > 0) return num;

  return 0;
}

export default function BaseMath({ workflowData }: Props) {
  const { caseId, partitionId } = useParams<{
    caseId: string;
    partitionId: string;
  }>();

  const baseHeatmapPreset = HEATMAP_STEP_PRESETS.full_math;

  const [presetOverride, setPresetOverride] = React.useState<{
    startLessThan: number;
    step: number;
  } | null>(null);
  const [decimalPlaces, setDecimalPlaces] = React.useState(
    DEFAULT_HEATMAP_DECIMAL_PLACES,
  );

  const [rowFilterSelections, setRowFilterSelections] = React.useState<
    Record<string, string[]>
  >({});
  const [rowFilterSearch, setRowFilterSearch] = React.useState<
    Record<string, string>
  >({});
  const [openRowFilterField, setOpenRowFilterField] = React.useState<
    string | null
  >(null);
  const [rowFilterPanelStyle, setRowFilterPanelStyle] =
    React.useState<React.CSSProperties>({});

  const [columnRules, setColumnRules] = React.useState<ColumnRule[]>([]);
  const [nextRuleId, setNextRuleId] = React.useState(1);
  const [sortState, setSortState] = React.useState<SortState>({
    fieldKey: null,
    direction: null,
  });

  const [manualOrderedCols, setManualOrderedCols] = React.useState<string[]>(
    [],
  );
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [viewportWidth, setViewportWidth] = React.useState(1200);
  const [hydratedFilterStorageKey, setHydratedFilterStorageKey] =
    React.useState<string | null>(null);
  const [exportCaseName, setExportCaseName] = React.useState("");
  const [exportPartitionName, setExportPartitionName] = React.useState("");

  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const filterStorageKey = React.useMemo(
    () =>
      caseId && partitionId
        ? getBaseMathFilterStorageKey(caseId, partitionId)
        : null,
    [caseId, partitionId],
  );

  React.useEffect(() => {
    if (!caseId || !partitionId) return;

    const stored = loadOverride(caseId, partitionId, "basemath");
    if (stored?.start != null && stored?.step != null) {
      setPresetOverride({ startLessThan: stored.start, step: stored.step });
    } else {
      setPresetOverride(null);
    }
    if (stored?.decimalPlaces != null) {
      setDecimalPlaces(clampHeatmapDecimalPlaces(stored.decimalPlaces));
    } else {
      setDecimalPlaces(DEFAULT_HEATMAP_DECIMAL_PLACES);
    }
  }, [caseId, partitionId]);

  const persistHeatmapSettings = React.useCallback(
    (patch: {
      start?: number | null;
      step?: number | null;
      decimalPlaces?: number;
    }) => {
      if (!caseId || !partitionId) return;

      patchHeatmapOverride(caseId, partitionId, "basemath", {
        start:
          patch.start !== undefined
            ? patch.start
            : (presetOverride?.startLessThan ?? null),
        step:
          patch.step !== undefined ? patch.step : (presetOverride?.step ?? null),
        decimalPlaces:
          patch.decimalPlaces !== undefined
            ? patch.decimalPlaces
            : decimalPlaces,
      });
    },
    [caseId, partitionId, presetOverride, decimalPlaces],
  );

  React.useEffect(() => {
    if (!caseId || !partitionId) {
      setExportCaseName("");
      setExportPartitionName("");
      return;
    }

    let cancelled = false;

    const loadExportNames = async () => {
      const [caseResult, partitionResult] = await Promise.allSettled([
        CaseApi.getCaseDetails(caseId),
        PartitionApi.getPartition(caseId, partitionId),
      ]);
      if (cancelled) return;

      if (caseResult.status === "fulfilled") {
        setExportCaseName(safeStr(caseResult.value?.caseName ?? ""));
      } else {
        setExportCaseName("");
      }

      if (partitionResult.status === "fulfilled") {
        const payload = partitionResult.value as any;
        const nameCandidate =
          payload?.partitions[0]?.partition_name ??
          "";

        setExportPartitionName(safeStr(nameCandidate));
      } else {
        setExportPartitionName("");
      }
    };

    loadExportNames().catch(() => {
      if (cancelled) return;
      setExportCaseName("");
      setExportPartitionName("");
    });

    return () => {
      cancelled = true;
    };
  }, [caseId, partitionId]);

  React.useEffect(() => {
    setHydratedFilterStorageKey(null);
    setOpenRowFilterField(null);
    setRowFilterSearch({});

    if (!filterStorageKey) {
      setRowFilterSelections({});
      setColumnRules([]);
      setNextRuleId(1);
      return;
    }

    const stored = loadBaseMathFilterState(filterStorageKey);

    setRowFilterSelections(stored?.rowFilterSelections ?? {});
    setRowFilterSearch(stored?.rowFilterSearch ?? {});
    setColumnRules(stored?.columnRules ?? []);
    setNextRuleId(stored?.nextRuleId ?? 1);
    setHydratedFilterStorageKey(filterStorageKey);
  }, [filterStorageKey]);

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-row-filter-panel='true']")) return;
      if (target?.closest("[data-row-filter-trigger='true']")) return;
      setOpenRowFilterField(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      setViewportWidth(el.clientWidth);
    });

    ro.observe(el);
    setViewportWidth(el.clientWidth);

    return () => ro.disconnect();
  }, []);

  function EllipsisText({
    text,
    title,
    align = "left",
  }: {
    text: string;
    title?: string;
    align?: "left" | "center" | "right";
  }) {
    return (
      <div
        className={`basemath-ellipsis basemath-ellipsis-${align}`}
        title={title ?? text}
      >
        {text}
      </div>
    );
  }

  const baseStep =
    workflowData?.data?.base_math ??
    workflowData?.data?.steps?.base_math ??
    workflowData?.steps?.base_math ??
    workflowData?.workflow_meta?.data?.steps?.base_math ??
    null;

  const status = String(baseStep?.status ?? "").toUpperCase();
  const result = baseStep?.result ?? null;

  const rawColumns: string[] = Array.isArray(result?.columns)
    ? result.columns
    : [];
  const rawRows: any[] = Array.isArray(result?.rows) ? result.rows : [];

  const rowsAreArrays =
    rawRows.every((r) => Array.isArray(r)) &&
    rawRows.every((r) => (r as any[])?.length === rawColumns.length);

  const hasLeadingLabelCol = rawColumns.length > 0 && rowsAreArrays;
  const matrixCountFromRows = rowsAreArrays ? rawRows.length : 0;

  const selectedSkuCount =
    Number(
      result?.selected_skus_count ?? result?.sku_count ?? result?.skus ?? 0,
    ) ||
    getSelectedSkuCount(workflowData) ||
    matrixCountFromRows ||
    0;

  let fixedMetaCount = hasLeadingLabelCol ? 1 : 0;
  const diff =
    selectedSkuCount > 0 ? rawColumns.length - selectedSkuCount : NaN;

  if (
    Number.isFinite(diff) &&
    diff >= (hasLeadingLabelCol ? 1 : 0) &&
    diff < rawColumns.length
  ) {
    fixedMetaCount = diff;
  } else if (hasLeadingLabelCol) {
    const labelSet = new Set<string>(
      rawRows
        .map((r) => (Array.isArray(r) ? safeStr(r[0]) : ""))
        .filter(Boolean),
    );

    let suffixLen = 0;
    for (let i = rawColumns.length - 1; i >= 1; i -= 1) {
      if (labelSet.has(String(rawColumns[i]))) suffixLen += 1;
      else break;
    }

    if (suffixLen >= 2) fixedMetaCount = rawColumns.length - suffixLen;
  }

  const metaColumns = React.useMemo(
    () => rawColumns.slice(0, fixedMetaCount),
    [rawColumns, fixedMetaCount],
  );

  const matrixColumns = React.useMemo(
    () => rawColumns.slice(fixedMetaCount),
    [rawColumns, fixedMetaCount],
  );

  const metaDataColumns = React.useMemo(
    () => metaColumns.slice(1),
    [metaColumns],
  );

  const labelColumnTitle = React.useMemo(
    () => safeStr(metaColumns[0] ?? rawColumns[0] ?? ""),
    [metaColumns, rawColumns],
  );

  const normalizedMetaColumns = React.useMemo(
    () => metaColumns.map((col) => safeStr(col).toLowerCase()),
    [metaColumns],
  );

  const skuNameColumnIndex = React.useMemo(() => {
    if (!hasLeadingLabelCol) return -1;
    const keywords = ["skuname", "sku_name", "sku", "ean"];
    const idx = normalizedMetaColumns.findIndex((name) =>
      keywords.some((key) => name.includes(key)),
    );
    return idx >= 0 ? idx : 0;
  }, [normalizedMetaColumns, hasLeadingLabelCol]);

  const filterableColumns = React.useMemo<FilterableColumn[]>(() => {
    const cols: FilterableColumn[] = [];

    if (hasLeadingLabelCol) {
      cols.push({
        key: "__label__",
        title: labelColumnTitle || "SKU",
        rawIdx: 0,
      });
    }

    metaDataColumns.forEach((title, idx) => {
      cols.push({
        key: `meta_${idx + 1}`,
        title: safeStr(title),
        rawIdx: idx + 1,
      });
    });

    return cols;
  }, [hasLeadingLabelCol, labelColumnTitle, metaDataColumns]);

  const filterableColumnMap = React.useMemo(() => {
    const map = new Map<string, FilterableColumn>();
    filterableColumns.forEach((col) => map.set(col.key, col));
    return map;
  }, [filterableColumns]);

  const uniqueValuesByField = React.useMemo(() => {
    const out: Record<string, string[]> = {};

    filterableColumns.forEach((col) => {
      const seen = new Set<string>();
      const values: string[] = [];

      rawRows.forEach((row) => {
        if (!Array.isArray(row) || row.length <= col.rawIdx) return;
        const value = safeStr(row[col.rawIdx]);
        if (seen.has(value)) return;
        seen.add(value);
        values.push(value);
      });

      out[col.key] = values;
    });

    return out;
  }, [filterableColumns, rawRows]);

  React.useEffect(() => {
    setRowFilterSearch((prev) => {
      const next: Record<string, string> = {};

      Object.entries(prev).forEach(([fieldKey, searchValue]) => {
        if (!filterableColumnMap.has(fieldKey) || !searchValue.trim()) return;
        next[fieldKey] = searchValue;
      });

      return stringRecordEqual(prev, next) ? prev : next;
    });

    setRowFilterSelections((prev) => {
      const next: Record<string, string[]> = {};

      Object.entries(prev).forEach(([fieldKey, values]) => {
        const allowed = new Set(uniqueValuesByField[fieldKey] ?? []);
        const kept = values.filter((value) => allowed.has(value));
        if (kept.length > 0) next[fieldKey] = kept;
      });

      return rowFilterSelectionsEqual(prev, next) ? prev : next;
    });

    setColumnRules((prev) => {
      const fallback = filterableColumns[0]?.key ?? "";

      const next = prev
        .map((rule) => {
          if (!filterableColumnMap.has(rule.fieldKey)) {
            return fallback
              ? { ...rule, fieldKey: fallback, values: [] }
              : { ...rule, fieldKey: "", values: [] };
          }

          const allowed = new Set(uniqueValuesByField[rule.fieldKey] ?? []);
          const values = rule.values.filter((value) => allowed.has(value));

          return arraysEqual(values, rule.values) ? rule : { ...rule, values };
        })
        .filter((rule) => Boolean(rule.fieldKey));

      return columnRulesEqual(prev, next) ? prev : next;
    });
  }, [uniqueValuesByField, filterableColumnMap, filterableColumns]);

  React.useEffect(() => {
    setSortState((prev) => {
      if (!prev.fieldKey || !prev.direction) return prev;
      if (filterableColumnMap.has(prev.fieldKey)) return prev;
      return { fieldKey: null, direction: null };
    });
  }, [filterableColumnMap]);

  React.useEffect(() => {
    if (!filterStorageKey || hydratedFilterStorageKey !== filterStorageKey) {
      return;
    }

    saveBaseMathFilterState(filterStorageKey, {
      rowFilterSelections,
      rowFilterSearch,
      columnRules,
      nextRuleId,
    });
  }, [
    filterStorageKey,
    hydratedFilterStorageKey,
    rowFilterSelections,
    rowFilterSearch,
    columnRules,
    nextRuleId,
  ]);

  const matrixMinValue = React.useMemo<number | null>(() => {
    if (!rawRows.length || matrixColumns.length === 0) return null;

    let min: number | null = null;
    rawRows.forEach((row) => {
      if (!Array.isArray(row)) return;
      for (let idx = 0; idx < matrixColumns.length; idx += 1) {
        const rawIdx = fixedMetaCount + idx;
        if (rawIdx >= row.length) continue;
        const num = toFiniteNumber(row[rawIdx]);
        if (num == null || num <= 0) continue;
        min = min == null ? num : Math.min(min, num);
      }
    });
    return min;
  }, [rawRows, matrixColumns, fixedMetaCount]);

  const autoPreset: HeatmapStepPreset = React.useMemo(() => {
    const startLessThan =
      matrixMinValue != null ? matrixMinValue : baseHeatmapPreset.startLessThan;
    return {
      ...baseHeatmapPreset,
      startLessThan,
    };
  }, [matrixMinValue, baseHeatmapPreset]);

  const preset: HeatmapStepPreset = React.useMemo(() => {
    if (!presetOverride) return autoPreset;
    return {
      ...autoPreset,
      startLessThan: presetOverride.startLessThan,
      step: presetOverride.step,
    };
  }, [autoPreset, presetOverride]);

  const rowFilterIsActive = React.useCallback(
    (fieldKey: string) => (rowFilterSelections[fieldKey] ?? []).length > 0,
    [rowFilterSelections],
  );

  const getSortDirectionForField = React.useCallback(
    (fieldKey: string) =>
      sortState.fieldKey === fieldKey ? sortState.direction : null,
    [sortState],
  );

  const toggleSort = React.useCallback((fieldKey: string) => {
    setSortState((prev) => {
      if (prev.fieldKey !== fieldKey) {
        return { fieldKey, direction: "asc" };
      }

      if (prev.direction === "asc") {
        return { fieldKey, direction: "desc" };
      }

      return { fieldKey: null, direction: null };
    });
  }, []);

  const rowIndexes = React.useMemo(
    () => Array.from({ length: rawRows.length }, (_, i) => i),
    [rawRows.length],
  );

  const filteredRowIndexes = React.useMemo(() => {
    const activeEntries = Object.entries(rowFilterSelections).filter(
      ([, values]) => values.length > 0,
    );

    if (activeEntries.length === 0) return rowIndexes;

    return rowIndexes.filter((idx) => {
      const rowArr = rawRows[idx];
      if (!Array.isArray(rowArr)) return false;

      for (const [fieldKey, values] of activeEntries) {
        const field = filterableColumnMap.get(fieldKey);
        if (!field || rowArr.length <= field.rawIdx) return false;
        const rowValue = safeStr(rowArr[field.rawIdx]);
        if (!values.includes(rowValue)) return false;
      }

      return true;
    });
  }, [rowIndexes, rawRows, rowFilterSelections, filterableColumnMap]);

  const sortedFilteredRowIndexes = React.useMemo(() => {
    if (!sortState.fieldKey || !sortState.direction) {
      return filteredRowIndexes;
    }

    const field = filterableColumnMap.get(sortState.fieldKey);
    if (!field) return filteredRowIndexes;

    const directionMultiplier = sortState.direction === "asc" ? 1 : -1;

    return [...filteredRowIndexes].sort((aIdx, bIdx) => {
      const aRow = rawRows[aIdx];
      const bRow = rawRows[bIdx];

      const aValue =
        Array.isArray(aRow) && aRow.length > field.rawIdx
          ? safeStr(aRow[field.rawIdx])
          : "";
      const bValue =
        Array.isArray(bRow) && bRow.length > field.rawIdx
          ? safeStr(bRow[field.rawIdx])
          : "";

      const result = compareSortValues(aValue, bValue);
      if (result !== 0) return result * directionMultiplier;

      return aIdx - bIdx;
    });
  }, [filteredRowIndexes, sortState, filterableColumnMap, rawRows]);

  const rowFilterOptionsByField = React.useMemo(() => {
    const out: Record<string, string[]> = {};

    filterableColumns.forEach((targetField) => {
      const activeEntries = Object.entries(rowFilterSelections).filter(
        ([fieldKey, values]) =>
          fieldKey !== targetField.key && values.length > 0,
      );

      const seen = new Set<string>();
      const values: string[] = [];

      rowIndexes.forEach((idx) => {
        const rowArr = rawRows[idx];
        if (!Array.isArray(rowArr) || rowArr.length <= targetField.rawIdx)
          return;

        const matchesOtherFilters = activeEntries.every(
          ([fieldKey, selected]) => {
            const field = filterableColumnMap.get(fieldKey);
            if (!field || rowArr.length <= field.rawIdx) return false;
            return selected.includes(safeStr(rowArr[field.rawIdx]));
          },
        );

        if (!matchesOtherFilters) return;

        const value = safeStr(rowArr[targetField.rawIdx]);
        if (seen.has(value)) return;

        seen.add(value);
        values.push(value);
      });

      const selectedValues = rowFilterSelections[targetField.key] ?? [];
      selectedValues.forEach((value) => {
        if (seen.has(value)) return;
        seen.add(value);
        values.push(value);
      });

      out[targetField.key] = values;
    });

    return out;
  }, [
    filterableColumns,
    rowFilterSelections,
    rowIndexes,
    rawRows,
    filterableColumnMap,
  ]);

  const activeColumnRules = React.useMemo(
    () => columnRules.filter((rule) => rule.fieldKey && rule.values.length > 0),
    [columnRules],
  );

  const columnRuleValueOptionsByRuleId = React.useMemo(() => {
    const out: Record<string, { label: string; value: string }[]> = {};

    columnRules.forEach((targetRule) => {
      const targetField = filterableColumnMap.get(targetRule.fieldKey);
      if (!targetField) {
        out[targetRule.id] = [];
        return;
      }

      const otherActiveRules = columnRules.filter(
        (rule) =>
          rule.id !== targetRule.id && rule.fieldKey && rule.values.length > 0,
      );

      const seen = new Set<string>();
      const values: string[] = [];

      rawRows.forEach((row) => {
        if (!Array.isArray(row) || row.length <= targetField.rawIdx) return;

        const matchesOtherRules = otherActiveRules.every((rule) => {
          const field = filterableColumnMap.get(rule.fieldKey);
          if (!field || row.length <= field.rawIdx) return false;
          return rule.values.includes(safeStr(row[field.rawIdx]));
        });

        if (!matchesOtherRules) return;

        const value = safeStr(row[targetField.rawIdx]);
        if (seen.has(value)) return;

        seen.add(value);
        values.push(value);
      });

      targetRule.values.forEach((value) => {
        if (seen.has(value)) return;
        seen.add(value);
        values.push(value);
      });

      out[targetRule.id] = values.map((value) => ({
        label: value || "(blank)",
        value,
      }));
    });

    return out;
  }, [columnRules, rawRows, filterableColumnMap]);

  const filteredMatrixColumns = React.useMemo(() => {
    if (activeColumnRules.length === 0 || skuNameColumnIndex < 0) {
      return matrixColumns;
    }

    const matchingSkuSet = new Set<string>();

    rawRows.forEach((row) => {
      if (!Array.isArray(row)) return;

      const matches = activeColumnRules.every((rule) => {
        const field = filterableColumnMap.get(rule.fieldKey);
        if (!field || row.length <= field.rawIdx) return false;
        return rule.values.includes(safeStr(row[field.rawIdx]));
      });

      if (!matches || row.length <= skuNameColumnIndex) return;
      matchingSkuSet.add(safeStr(row[skuNameColumnIndex]));
    });

    return matrixColumns.filter((col) => matchingSkuSet.has(safeStr(col)));
  }, [
    activeColumnRules,
    skuNameColumnIndex,
    matrixColumns,
    rawRows,
    filterableColumnMap,
  ]);

  /** Heatmap columns in the same order as visible rows (symmetric matrix). */
  const rowOrderedMatrixColumns = React.useMemo(() => {
    if (filteredMatrixColumns.length === 0) return filteredMatrixColumns;

    const allowed = new Set(filteredMatrixColumns.map(safeStr));
    const ordered: string[] = [];
    const seen = new Set<string>();

    sortedFilteredRowIndexes.forEach((rowIndex) => {
      if (rowIndex < 0 || rowIndex >= matrixColumns.length) return;
      const colKey = safeStr(matrixColumns[rowIndex]);
      if (!allowed.has(colKey) || seen.has(colKey)) return;
      seen.add(colKey);
      ordered.push(colKey);
    });

    filteredMatrixColumns.forEach((col) => {
      const colKey = safeStr(col);
      if (seen.has(colKey)) return;
      seen.add(colKey);
      ordered.push(colKey);
    });

    return ordered;
  }, [sortedFilteredRowIndexes, matrixColumns, filteredMatrixColumns]);

  const isFilterDirty =
    Object.values(rowFilterSelections).some((values) => values.length > 0) ||
    activeColumnRules.length > 0;

  const useVirtual = filteredMatrixColumns.length >= VIRTUAL_THRESHOLD;

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (manualOrderedCols.length > 0) {
      setManualOrderedCols([]);
    }
  }, [sortState.fieldKey, sortState.direction]);

  const scrollColumns = React.useMemo(() => {
    const next = [...metaDataColumns, ...rowOrderedMatrixColumns];

    if (manualOrderedCols.length === 0) return next;

    const manualSet = new Set(manualOrderedCols);
    const kept = manualOrderedCols.filter((c) => next.includes(c));
    const added = next.filter((c) => !manualSet.has(c));

    return [...kept, ...added];
  }, [metaDataColumns, rowOrderedMatrixColumns, manualOrderedCols]);

  const exportFilename = React.useMemo(() => {
    const caseNameCandidate = exportCaseName || caseId || "case";

    const partitionNameCandidate =
      exportPartitionName || partitionId || "partition";

    const caseSegment = toFilenameSegment(caseNameCandidate, caseId ?? "case");
    const partitionSegment = toFilenameSegment(
      partitionNameCandidate,
      partitionId ?? "partition",
    );

    return `${caseSegment}_${partitionSegment}_sku_math.xlsx`;
  }, [exportCaseName, exportPartitionName, caseId, partitionId]);

  const exportBaseMathExcel = React.useCallback(() => {
    if (!rawRows.length) return;

    const header: ExcelCell[] = [labelColumnTitle, ...scrollColumns].map(
      (value) => ({ value, header: true }),
    );

    const rows: ExcelCell[][] = sortedFilteredRowIndexes.map((rowIndex) => {
      const rowArr = rawRows[rowIndex];
      const skuId = safeStr(rawColumns[rowIndex] ?? `row-${rowIndex}`);
      const skuName =
        hasLeadingLabelCol && Array.isArray(rowArr)
          ? safeStr(rowArr[0])
          : skuId;

      const visibleValues: ExcelCell[] = scrollColumns.map((colKey) => {
        if (!Array.isArray(rowArr)) return { value: "" };

        const metaIdx = metaDataColumns.indexOf(colKey);
        if (metaIdx >= 0) {
          const value = rowArr[1 + metaIdx];
          return {
            value: value == null ? "" : String(value),
            style: { backgroundColor: "#f9fafb", textAlign: "center" },
          };
        }

        const matrixIdx = matrixColumns.indexOf(colKey);
        if (matrixIdx < 0) return { value: "" };

        const value = rowArr[fixedMetaCount + matrixIdx];
        const num = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(num)) return { value: "" };

        const isDiagonal = matrixIdx === rowIndex;
        return {
          value: formatHeatmapNumber(num, decimalPlaces),
          style: isDiagonal
            ? {
                backgroundColor: "#000000",
                color: "#ffffff",
                textAlign: "center",
                fontWeight: 600,
              }
            : getSteppedHeatmapStyle(num, preset),
        };
      });

      return [
        {
          value: skuName,
          style: { backgroundColor: "#f9fafb", fontWeight: 600 },
        },
        ...visibleValues,
      ];
    });

    exportExcelTable({
      filename: exportFilename,
      sheetName: "SKU Math",
      rows: [header, ...rows],
    });
  }, [
    rawRows,
    labelColumnTitle,
    scrollColumns,
    sortedFilteredRowIndexes,
    rawColumns,
    hasLeadingLabelCol,
    metaDataColumns,
    matrixColumns,
    fixedMetaCount,
    exportFilename,
    preset,
    decimalPlaces,
  ]);

  const isMetaColumn = React.useCallback(
    (colKey: string) => metaDataColumns.includes(colKey),
    [metaDataColumns],
  );

  const gridWidth = LABEL_COL_WIDTH + MATRIX_COL_WIDTH * scrollColumns.length;

  const onHScroll = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setScrollLeft(el.scrollLeft);
    });
  }, []);

  const visibleRange = React.useMemo(() => {
    const total = scrollColumns.length;
    if (total === 0) return { start: 0, end: -1 };

    const leftFixed = LABEL_COL_WIDTH;
    const maxMatrixScroll = Math.max(
      0,
      total * MATRIX_COL_WIDTH - viewportWidth,
    );
    const matrixScroll = Math.max(
      0,
      Math.min(maxMatrixScroll, scrollLeft - leftFixed),
    );

    const startUnclamped = Math.floor(matrixScroll / MATRIX_COL_WIDTH);
    const start = Math.min(Math.max(0, startUnclamped), total - 1);
    const visibleCount = Math.ceil(viewportWidth / MATRIX_COL_WIDTH) + 1;
    const overscan = 4;

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(total - 1, start + visibleCount + overscan),
    };
  }, [scrollColumns.length, viewportWidth, scrollLeft]);

  const getRowFilterPanelPosition = React.useCallback(
    (triggerEl: HTMLElement) => {
      const rect = triggerEl.getBoundingClientRect();

      const documentTop = window.scrollY + rect.bottom + 8;
      const documentLeft = window.scrollX + rect.left;

      const maxLeft =
        window.scrollX + window.innerWidth - ROW_FILTER_PANEL_WIDTH - 12;
      const maxTop =
        window.scrollY + window.innerHeight - ROW_FILTER_PANEL_HEIGHT - 12;

      const top = Math.min(maxTop, documentTop);
      const left = Math.min(
        maxLeft,
        Math.max(window.scrollX + 12, documentLeft),
      );

      return {
        position: "absolute" as const,
        top,
        left,
        width: ROW_FILTER_PANEL_WIDTH,
        zIndex: 2000,
      };
    },
    [],
  );

  const openRowFilter = React.useCallback(
    (fieldKey: string, event: React.MouseEvent<HTMLElement>) => {
      const triggerEl = event.currentTarget;
      activeRowFilterTriggerRef.current = triggerEl;

      setRowFilterPanelStyle(getRowFilterPanelPosition(triggerEl));
      setOpenRowFilterField((prev) => (prev === fieldKey ? null : fieldKey));
    },
    [getRowFilterPanelPosition],
  );

  React.useEffect(() => {
    if (!openRowFilterField) return;

    const updatePanelPosition = () => {
      const triggerEl = activeRowFilterTriggerRef.current;
      if (!triggerEl) return;

      setRowFilterPanelStyle(getRowFilterPanelPosition(triggerEl));
    };

    window.addEventListener("scroll", updatePanelPosition, true);
    window.addEventListener("resize", updatePanelPosition);

    return () => {
      window.removeEventListener("scroll", updatePanelPosition, true);
      window.removeEventListener("resize", updatePanelPosition);
    };
  }, [openRowFilterField, getRowFilterPanelPosition]);

  const toggleRowFilterValue = React.useCallback(
    (fieldKey: string, value: string) => {
      setRowFilterSelections((prev) => {
        const existing = prev[fieldKey] ?? [];
        const nextValues = existing.includes(value)
          ? existing.filter((item) => item !== value)
          : [...existing, value];

        if (nextValues.length === 0) {
          const next = { ...prev };
          delete next[fieldKey];
          return next;
        }

        return { ...prev, [fieldKey]: nextValues };
      });
    },
    [],
  );

  const rowFilterPanelField = openRowFilterField
    ? (filterableColumnMap.get(openRowFilterField) ?? null)
    : null;

  const rowFilterPanelOptions = rowFilterPanelField
    ? (rowFilterOptionsByField[rowFilterPanelField.key] ?? [])
    : [];

  const rowFilterPanelSearchValue = rowFilterPanelField
    ? (rowFilterSearch[rowFilterPanelField.key] ?? "")
    : "";

  const rowFilterPanelVisibleOptions = React.useMemo(() => {
    const query = rowFilterPanelSearchValue.trim().toLowerCase();
    if (!query) return rowFilterPanelOptions;
    return rowFilterPanelOptions.filter((value) =>
      safeStr(value).toLowerCase().includes(query),
    );
  }, [rowFilterPanelOptions, rowFilterPanelSearchValue]);

  const rowFilterPanelSelectedValues = rowFilterPanelField
    ? (rowFilterSelections[rowFilterPanelField.key] ?? [])
    : [];

  const rowFilterPanelVisibleSelectedCount = React.useMemo(() => {
    if (!rowFilterPanelField) return 0;
    const selected = new Set(rowFilterPanelSelectedValues);
    return rowFilterPanelVisibleOptions.filter((value) => selected.has(value))
      .length;
  }, [
    rowFilterPanelField,
    rowFilterPanelSelectedValues,
    rowFilterPanelVisibleOptions,
  ]);

  const rowFilterPanelAllVisibleChecked =
    rowFilterPanelVisibleOptions.length > 0 &&
    rowFilterPanelVisibleSelectedCount === rowFilterPanelVisibleOptions.length;

  const rowFilterPanelSomeVisibleChecked =
    rowFilterPanelVisibleSelectedCount > 0 &&
    rowFilterPanelVisibleSelectedCount < rowFilterPanelVisibleOptions.length;

  const activeRowFilterTriggerRef = React.useRef<HTMLElement | null>(null);
  const ROW_FILTER_PANEL_WIDTH = 320;
  const ROW_FILTER_PANEL_HEIGHT = 360;

  const toggleAllVisibleRowFilterValues = React.useCallback(
    (fieldKey: string) => {
      setRowFilterSelections((prev) => {
        const existing = prev[fieldKey] ?? [];
        const existingSet = new Set(existing);
        const visibleValues = rowFilterPanelVisibleOptions;

        const allVisibleAlreadySelected =
          visibleValues.length > 0 &&
          visibleValues.every((value) => existingSet.has(value));

        let nextValues: string[];

        if (allVisibleAlreadySelected) {
          nextValues = existing.filter(
            (value) => !visibleValues.includes(value),
          );
        } else {
          const merged = [...existing];
          visibleValues.forEach((value) => {
            if (!existingSet.has(value)) merged.push(value);
          });
          nextValues = merged;
        }

        if (nextValues.length === 0) {
          const next = { ...prev };
          delete next[fieldKey];
          return next;
        }

        return { ...prev, [fieldKey]: nextValues };
      });
    },
    [rowFilterPanelVisibleOptions],
  );

  const addColumnRule = React.useCallback(() => {
    const defaultFieldKey = filterableColumns[0]?.key ?? "";
    if (!defaultFieldKey) return;

    setColumnRules((prev) => [
      ...prev,
      {
        id: `rule_${nextRuleId}`,
        fieldKey: defaultFieldKey,
        values: [],
      },
    ]);
    setNextRuleId((prev) => prev + 1);
  }, [filterableColumns, nextRuleId]);

  const rootVars = cssVars({
    "--bm-grid-width": `${gridWidth}px`,
    "--bm-label-col-width": `${LABEL_COL_WIDTH}px`,
    "--bm-matrix-col-width": `${MATRIX_COL_WIDTH}px`,
  });

  const header = (
    <div className="basemath-grid-row basemath-grid-header">
      <div className="basemath-label-header-cell" title={labelColumnTitle}>
        <div className="basemath-header-content">
          <div className="basemath-header-text">{labelColumnTitle}</div>
          <button
            type="button"
            className="basemath-sort-trigger"
            onClick={() => toggleSort("__label__")}
            title="Sort rows"
          >
            <i
              className={`${getSortIconClass(getSortDirectionForField("__label__"))} text-[11px]`}
              style={{
                color: getSortDirectionForField("__label__")
                  ? "#dc2626"
                  : "#6b7280",
              }}
            />
          </button>
          {hasLeadingLabelCol && (
            <button
              type="button"
              data-row-filter-trigger="true"
              className="basemath-filter-trigger"
              onClick={(e) => openRowFilter("__label__", e)}
              title="Filter rows"
            >
              <i
                className="pi pi-filter text-[11px]"
                style={{
                  color: rowFilterIsActive("__label__") ? "#dc2626" : "#6b7280",
                }}
              />
            </button>
          )}
        </div>
      </div>
      <div
        className="basemath-spacer"
        style={cssVars({
          "--bm-spacer-width": `${visibleRange.start * MATRIX_COL_WIDTH}px`,
        })}
      />

      {visibleRange.end >= visibleRange.start &&
        scrollColumns
          .slice(visibleRange.start, visibleRange.end + 1)
          .map((colKey) => {
            const metaFilter = filterableColumns.find(
              (col) => col.title === colKey,
            );
            const metaSortDirection = metaFilter
              ? getSortDirectionForField(metaFilter.key)
              : null;

            return (
              <div
                key={colKey}
                className="basemath-matrix-header-cell"
                title={colKey}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", colKey);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = e.dataTransfer.getData("text/plain");
                  const to = colKey;
                  if (!from || !to || from === to) return;

                  setManualOrderedCols((prev) => {
                    const current =
                      prev.length > 0 ? [...prev] : [...scrollColumns];
                    const i = current.indexOf(from);
                    const j = current.indexOf(to);
                    if (i === -1 || j === -1) return prev;
                    current.splice(i, 1);
                    current.splice(j, 0, from);
                    return current;
                  });
                }}
              >
                <div className="basemath-header-content basemath-header-content-center">
                  <div className="basemath-header-text">{colKey}</div>
                  {metaFilter && (
                    <button
                      type="button"
                      className="basemath-sort-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSort(metaFilter.key);
                      }}
                      draggable={false}
                      title="Sort rows"
                    >
                      <i
                        className={`${getSortIconClass(metaSortDirection)} text-[11px]`}
                        style={{
                          color: metaSortDirection ? "#dc2626" : "#6b7280",
                        }}
                      />
                    </button>
                  )}
                  {metaFilter && (
                    <button
                      type="button"
                      data-row-filter-trigger="true"
                      className="basemath-filter-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRowFilter(metaFilter.key, e);
                      }}
                      draggable={false}
                      title="Filter rows"
                    >
                      <i
                        className="pi pi-filter text-[11px]"
                        style={{
                          color: rowFilterIsActive(metaFilter.key)
                            ? "#dc2626"
                            : "#6b7280",
                        }}
                      />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

      <div
        className="basemath-spacer"
        style={cssVars({
          "--bm-spacer-width": `${Math.max(0, scrollColumns.length - (visibleRange.end + 1)) * MATRIX_COL_WIDTH}px`,
        })}
      />
    </div>
  );

  const renderRow = (rowIndex: number) => {
    const rowArr = rawRows[rowIndex];
    const skuId = safeStr(rawColumns[rowIndex] ?? `row-${rowIndex}`);
    const skuName =
      hasLeadingLabelCol && Array.isArray(rowArr) ? safeStr(rowArr[0]) : skuId;

    return (
      <div
        key={rowIndex}
        className={`basemath-grid-row ${rowIndex % 2 ? "basemath-grid-row-alt" : ""}`}
      >
        <div className="basemath-label-body-cell">
          <EllipsisText text={skuName} />
        </div>
        <div
          className="basemath-spacer"
          style={cssVars({
            "--bm-spacer-width": `${visibleRange.start * MATRIX_COL_WIDTH}px`,
          })}
        />

        {visibleRange.end >= visibleRange.start &&
          scrollColumns
            .slice(visibleRange.start, visibleRange.end + 1)
            .map((colKey, jLocal) => {
              const globalColIndex = visibleRange.start + jLocal;
              const isMetaCol = isMetaColumn(colKey);
              const metaIdx = metaDataColumns.indexOf(colKey);
              const matrixIdx = rowOrderedMatrixColumns.indexOf(colKey);

              const rawIdx = isMetaCol
                ? metaIdx >= 0
                  ? 1 + metaIdx
                  : -1
                : matrixIdx >= 0
                  ? fixedMetaCount + matrixColumns.indexOf(colKey)
                  : -1;

              const rawVal =
                Array.isArray(rowArr) && rawIdx >= 0 ? rowArr[rawIdx] : null;

              if (isMetaCol) {
                const s = rawVal == null ? "" : String(rawVal);
                return (
                  <div
                    key={`${rowIndex}-${globalColIndex}`}
                    className="basemath-body-cell"
                  >
                    <EllipsisText text={s} align="center" />
                  </div>
                );
              }

              const num = typeof rawVal === "number" ? rawVal : Number(rawVal);
              const val = Number.isFinite(num) ? num : null;

              if (val == null) {
                return (
                  <div
                    key={`${rowIndex}-${globalColIndex}`}
                    className="basemath-body-cell"
                  />
                );
              }

              const originalMatrixIdx = matrixColumns.indexOf(colKey);
              const isDiagonal = originalMatrixIdx === rowIndex;

              if (isDiagonal) {
                return (
                  <div
                    key={`${rowIndex}-${globalColIndex}`}
                    className="basemath-body-cell basemath-diagonal-cell"
                    title={formatHeatmapNumber(val, decimalPlaces)}
                  >
                    {formatHeatmapNumber(val, decimalPlaces)}
                  </div>
                );
              }

              return (
                <div
                  key={`${rowIndex}-${globalColIndex}`}
                  className="basemath-body-cell"
                  style={getSteppedHeatmapStyle(val, preset)}
                  title={formatHeatmapNumber(val, decimalPlaces)}
                >
                  {formatHeatmapNumber(val, decimalPlaces)}
                </div>
              );
            })}

        <div
          className="basemath-spacer"
          style={cssVars({
            "--bm-spacer-width": `${Math.max(0, scrollColumns.length - (visibleRange.end + 1)) * MATRIX_COL_WIDTH}px`,
          })}
        />
      </div>
    );
  };

  if (!workflowData) {
    return (
      <div className="mt-3 text-sm text-gray-600">Loading workflow...</div>
    );
  }

  if (!baseStep) {
    return (
      <div className="mt-3 text-sm text-gray-600">
        Base Math is not available yet.
      </div>
    );
  }

  if (status !== "COMPLETED") {
    return (
      <div className="mt-3 text-sm text-gray-600">
        Base Math is processing (status: <b>{status || "UNKNOWN"}</b>)...
      </div>
    );
  }

  if (rawColumns.length === 0 || rawRows.length === 0) {
    return (
      <div className="mt-3 text-sm text-gray-600">
        Base Math completed but no matrix data returned.
      </div>
    );
  }

  return (
    <div className="mt-3 basemath-root" style={rootVars}>
      <div className="mb-2 flex items-center justify-between gap-4">
        <HeatmapLegendInline
          preset={preset}
          decimalPlaces={decimalPlaces}
          onDecimalPlacesChange={(next) => {
            const clamped = clampHeatmapDecimalPlaces(next);
            setDecimalPlaces(clamped);
            persistHeatmapSettings({ decimalPlaces: clamped });
          }}
          onSubmitStartStep={(startLessThan, step) => {
            if (
              startLessThan === autoPreset.startLessThan &&
              step === autoPreset.step
            ) {
              setPresetOverride(null);
              persistHeatmapSettings({ start: null, step: null });
            } else {
              setPresetOverride({ startLessThan, step });
              persistHeatmapSettings({ start: startLessThan, step });
            }
          }}
        />
        <div className="flex items-center gap-2">
          <div className="basemath-reorder-hint" role="note">
            <span className="basemath-reorder-hint__icon" aria-hidden>
              <i className="pi pi-arrows-h" />
            </span>
            <span className="basemath-reorder-hint__text">
              Please drag by heading to reorder
            </span>
          </div>
          <button
            type="button"
            onClick={exportBaseMathExcel}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
            title="Download Excel"
            aria-label="Download Excel"
          >
            <i className="pi pi-download text-[14px]" />
          </button>
        </div>
      </div>
      <div className="mb-2 rounded-md border border-gray-200 bg-gray-50 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-gray-500">
            Showing {filteredRowIndexes.length} of {rowIndexes.length} rows •{" "}
            {filteredMatrixColumns.length} of {matrixColumns.length} heatmap
            columns
          </div>
        </div>
        <div className="border-t border-gray-200">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-gray-800">
                Heatmap column filters
              </div>
            </div>
            <button
              type="button"
              onClick={addColumnRule}
              className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:border-gray-300"
            >
              <i className="pi pi-plus mr-2 text-[10px]" />
              Add rule
            </button>
          </div>
          <div className="basemath-rules-strip">
            {columnRules.length === 0 ? (
              <div className="basemath-empty-rule-state">
                No column filter rules added. All heatmap columns are currently
                visible.
              </div>
            ) : (
              columnRules.map((rule) => {
                const valueOptions =
                  columnRuleValueOptionsByRuleId[rule.id] ?? [];

                return (
                  <div
                    key={rule.id}
                    className="basemath-rule-card basemath-rule-card--compact"
                  >
                    <div className="basemath-rule-card__topbar">
                      <div className="basemath-rule-card__title">
                        Column rule
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setColumnRules((prev) =>
                            prev.filter((item) => item.id !== rule.id),
                          );
                        }}
                        className="basemath-rule-card__remove"
                      >
                        <i className="pi pi-trash text-[10px]" />
                        Remove
                      </button>
                    </div>
                    <div className="basemath-rule-card__grid">
                      <div className="basemath-rule-field">
                        <label className="basemath-rule-label">
                          Metadata field
                        </label>
                        <Dropdown
                          value={rule.fieldKey}
                          options={filterableColumns.map((col) => ({
                            label: col.title,
                            value: col.key,
                          }))}
                          onChange={(e) => {
                            const nextFieldKey = String(e.value ?? "");
                            setColumnRules((prev) =>
                              prev.map((item) =>
                                item.id === rule.id
                                  ? {
                                      ...item,
                                      fieldKey: nextFieldKey,
                                      values: [],
                                    }
                                  : item,
                              ),
                            );
                          }}
                          className="basemath-rule-dropdown"
                          placeholder="Select field"
                        />
                      </div>
                      <div className="basemath-rule-field basemath-rule-field--grow">
                        <label className="basemath-rule-label">Values</label>
                        <MultiSelect
                          value={rule.values}
                          options={valueOptions}
                          onChange={(e: MultiSelectChangeEvent) => {
                            const nextValues = Array.isArray(e.value)
                              ? (e.value as string[])
                              : [];
                            setColumnRules((prev) =>
                              prev.map((item) =>
                                item.id === rule.id
                                  ? { ...item, values: nextValues }
                                  : item,
                              ),
                            );
                          }}
                          filter
                          display="chip"
                          showSelectAll
                          maxSelectedLabels={2}
                          placeholder="Select values"
                          className="basemath-rule-multiselect"
                          panelClassName="basemath-multiselect-panel"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {isFilterDirty && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setRowFilterSelections({});
                setRowFilterSearch({});
                setOpenRowFilterField(null);
                setColumnRules([]);
                setNextRuleId(1);
                setManualOrderedCols([]);
              }}
              className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {rowFilterPanelField &&
        openRowFilterField &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-row-filter-panel="true"
            className="basemath-filter-panel"
            style={rowFilterPanelStyle}
          >
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-medium text-gray-800">
                {rowFilterPanelField.title}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Inline row filter
              </div>
            </div>
            <div className="p-4">
              <div className="basemath-row-filter-search">
                <label className="basemath-row-filter-label">
                  Search values
                </label>
                <div className="basemath-row-filter-searchbox">
                  <i className="pi pi-search basemath-row-filter-searchbox__icon" />
                  <InputText
                    value={rowFilterPanelSearchValue}
                    onChange={(e) => {
                      setRowFilterSearch((prev) => ({
                        ...prev,
                        [rowFilterPanelField.key]: e.target.value,
                      }));
                    }}
                    className="basemath-row-filter-searchbox__input"
                    placeholder="Search"
                  />
                </div>
              </div>
              <div className="basemath-filter-values-list">
                {rowFilterPanelVisibleOptions.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-gray-500">
                    No values found.
                  </div>
                ) : (
                  <>
                    <label className="basemath-filter-value-item basemath-filter-value-item--select-all">
                      <input
                        type="checkbox"
                        checked={rowFilterPanelAllVisibleChecked}
                        ref={(el) => {
                          if (el)
                            el.indeterminate = rowFilterPanelSomeVisibleChecked;
                        }}
                        onChange={() =>
                          toggleAllVisibleRowFilterValues(
                            rowFilterPanelField.key,
                          )
                        }
                      />
                      <span className="font-medium">Select all</span>
                    </label>

                    {rowFilterPanelVisibleOptions.map((value) => {
                      const checked = (
                        rowFilterSelections[rowFilterPanelField.key] ?? []
                      ).includes(value);

                      return (
                        <label
                          key={value || "__blank__"}
                          className="basemath-filter-value-item"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleRowFilterValue(
                                rowFilterPanelField.key,
                                value,
                              )
                            }
                          />
                          <span className="truncate" title={value || "(blank)"}>
                            {value || "(blank)"}
                          </span>
                        </label>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setRowFilterSelections((prev) => {
                    const next = { ...prev };
                    delete next[rowFilterPanelField.key];
                    return next;
                  });
                }}
                className="text-xs font-medium text-gray-500 hover:text-gray-800"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  activeRowFilterTriggerRef.current = null;
                  setOpenRowFilterField(null);
                }}
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
              >
                Apply
              </button>
            </div>
          </div>,
          document.body,
        )}

      <div
        ref={scrollerRef}
        onScroll={onHScroll}
        className="basemath-grid-shell"
        style={{ marginTop: 4 }}
      >
        <div className="basemath-grid-frame">
          {header}

          {sortedFilteredRowIndexes.length === 0 ? (
            <div className="basemath-empty-state">
              No rows match the selected row filters.
            </div>
          ) : scrollColumns.length === 0 ? (
            <div className="basemath-empty-state">
              No heatmap columns match the selected column filters.
            </div>
          ) : useVirtual ? (
            <VirtualScroller
              key={`basemath-rows-${decimalPlaces}`}
              items={sortedFilteredRowIndexes}
              itemSize={ROW_HEIGHT}
              orientation="vertical"
              className="basemath-virtual-scroller"
              itemTemplate={(idx: number) => renderRow(idx)}
            />
          ) : (
            <div key={`basemath-rows-${decimalPlaces}`}>
              {sortedFilteredRowIndexes.map((idx) => renderRow(idx))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
