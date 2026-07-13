import type { CSSProperties } from "react";

export type HeatmapLegendBin = {
  label: string;
  color: string;
};

export const DEFAULT_HEATMAP_DECIMAL_PLACES = 2;
export const MIN_HEATMAP_DECIMAL_PLACES = 0;
export const MAX_HEATMAP_DECIMAL_PLACES = 6;

export function clampHeatmapDecimalPlaces(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HEATMAP_DECIMAL_PLACES;
  return Math.min(
    MAX_HEATMAP_DECIMAL_PLACES,
    Math.max(MIN_HEATMAP_DECIMAL_PLACES, Math.round(value)),
  );
}

export function formatHeatmapNumber(
  value: number | null | undefined,
  decimalPlaces = DEFAULT_HEATMAP_DECIMAL_PLACES,
  options?: {
    empty?: string;
    stripTrailingZeros?: boolean;
  },
) {
  const empty = options?.empty ?? "";
  if (value == null || !Number.isFinite(value)) return empty;

  const dp = clampHeatmapDecimalPlaces(decimalPlaces);
  let formatted = value.toFixed(dp);

  if (options?.stripTrailingZeros && dp > 0) {
    formatted = formatted.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  return formatted;
}

export type DiagonalBucketHeatmapMeta = {
  start: number | null;
  step: number | null;
  thresholds: { t1: number; t2: number; t3: number; t4: number } | null;
  cell_colors: (string | null)[][];
};

export type BaseTestingHeatmapMeta = DiagonalBucketHeatmapMeta;
export type LevelTestingHeatmapMeta = DiagonalBucketHeatmapMeta;

const COLORS = {
  black: "#000000",
  grey: "#DDDDDD",
  yellow: "#FFC000",
  orange: "#E27804",
  red: "#D20000",
  darkRed: "#C00000",
} as const;

function isBlank(value: unknown) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function toNumber(value: unknown): number | null {
  if (isBlank(value)) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function flattenNumeric(matrix: unknown[][], includeZeros = false): number[] {
  const out: number[] = [];
  for (const row of matrix) {
    for (const value of row) {
      const n = toNumber(value);
      if (n == null) continue;
      if (!includeZeros && n === 0) continue;
      out.push(n);
    }
  }
  return out;
}

function computeStartMinNonZeroDiagonal(matrix: unknown[][]): number | null {
  const k = Math.min(
    matrix.length,
    Array.isArray(matrix[0]) ? matrix[0].length : 0,
  );
  const diagonal: number[] = [];

  for (let i = 0; i < k; i += 1) {
    const n = toNumber(matrix[i]?.[i]);
    if (n != null && n !== 0) diagonal.push(n);
  }

  return diagonal.length ? Math.min(...diagonal) : null;
}

function excelCeiling(value: number, significance: number) {
  if (!Number.isFinite(value) || significance <= 0) return value;
  return Math.ceil(value / significance) * significance;
}

function computeBaseStep(matrix: unknown[][]): number | null {
  const values = flattenNumeric(matrix, false);
  if (!values.length) return null;
  const range = Math.max(...values) - Math.min(...values);
  return Math.ceil(range / Math.sqrt(values.length));
}

function computeLevelStep(matrix: unknown[][]): number | null {
  const values = flattenNumeric(matrix, false);
  if (!values.length) return null;
  const range = Math.max(...values) - Math.min(...values);
  const base = range / Math.sqrt(values.length);
  return excelCeiling(base, range < 1 ? 1 : 0.5);
}

function colorForValue(
  value: unknown,
  thresholds: { t1: number; t2: number; t3: number; t4: number },
): string | null {
  const n = toNumber(value);
  if (n == null) return null;
  if (n === 0) return COLORS.black;
  if (n < thresholds.t1) return COLORS.grey;
  if (n <= thresholds.t2) return COLORS.yellow;
  if (n <= thresholds.t3) return COLORS.orange;
  if (n <= thresholds.t4) return COLORS.red;
  return COLORS.darkRed;
}

function computeMeta(
  matrix: unknown[][],
  computeStep: (matrix: unknown[][]) => number | null,
): DiagonalBucketHeatmapMeta {
  const safe = Array.isArray(matrix) ? matrix : [];
  const start = computeStartMinNonZeroDiagonal(safe);
  const step = computeStep(safe);

  if (start == null || step == null) {
    return {
      start,
      step,
      thresholds: null,
      cell_colors: safe.map((row) =>
        (Array.isArray(row) ? row : []).map((value) =>
          toNumber(value) === 0 ? COLORS.black : null,
        ),
      ),
    };
  }

  const thresholds = {
    t1: start,
    t2: start + step,
    t3: start + 2 * step,
    t4: start + 3 * step,
  };

  return {
    start,
    step,
    thresholds,
    cell_colors: safe.map((row) =>
      (Array.isArray(row) ? row : []).map((value) =>
        colorForValue(value, thresholds),
      ),
    ),
  };
}

function fmt(value: number, decimalPlaces = DEFAULT_HEATMAP_DECIMAL_PLACES) {
  return formatHeatmapNumber(value, decimalPlaces, {
    stripTrailingZeros: true,
  });
}

function legendBins(
  meta: DiagonalBucketHeatmapMeta,
  decimalPlaces = DEFAULT_HEATMAP_DECIMAL_PLACES,
): HeatmapLegendBin[] {
  const bins: HeatmapLegendBin[] = [{ label: "0", color: COLORS.black }];

  if (!meta.thresholds || meta.start == null || meta.step == null) {
    bins.push({ label: "blank", color: "transparent" });
    return bins;
  }

  const { t1, t2, t3, t4 } = meta.thresholds;
  bins.push(
    { label: `< ${fmt(t1, decimalPlaces)}`, color: COLORS.grey },
    {
      label: `${fmt(t1, decimalPlaces)} - ${fmt(t2, decimalPlaces)}`,
      color: COLORS.yellow,
    },
    {
      label: `${fmt(t2, decimalPlaces)} - ${fmt(t3, decimalPlaces)}`,
      color: COLORS.orange,
    },
    {
      label: `${fmt(t3, decimalPlaces)} - ${fmt(t4, decimalPlaces)}`,
      color: COLORS.red,
    },
    { label: `> ${fmt(t4, decimalPlaces)}`, color: COLORS.darkRed },
  );

  return bins;
}

function styleForValue(
  value: unknown,
  meta: DiagonalBucketHeatmapMeta,
  options?: { textColor?: string },
): CSSProperties {
  const n = toNumber(value);
  if (n == null) return {};
  if (n === 0) {
    return {
      backgroundColor: COLORS.black,
      color: "#ffffff",
      textAlign: "center",
    };
  }
  if (!meta.thresholds) return { textAlign: "center" };

  const backgroundColor = colorForValue(n, meta.thresholds);
  return backgroundColor
    ? {
        backgroundColor,
        color: backgroundColor === COLORS.black ? "#ffffff" : options?.textColor ?? "#000000",
        textAlign: "center",
      }
    : {};
}

/**
 * Meta from an explicit start/step override (or preset defaults). Used by the
 * SKU Math tab, whose ROI diagonal is 0 by construction — the diagonal-min
 * autostart of `computeMeta` would always yield null there — and by the
 * base-testing / OBM start-step editors to apply user overrides.
 */
export function buildHeatmapMetaFromStartStep(
  start: number | null,
  step: number | null,
): DiagonalBucketHeatmapMeta {
  if (
    start == null ||
    step == null ||
    !Number.isFinite(start) ||
    !Number.isFinite(step) ||
    step <= 0
  ) {
    return { start, step, thresholds: null, cell_colors: [] };
  }
  return {
    start,
    step,
    thresholds: {
      t1: start,
      t2: start + step,
      t3: start + 2 * step,
      t4: start + 3 * step,
    },
    cell_colors: [],
  };
}

export function computeBaseTestingHeatmapMetaFromMatrix(
  matrix: unknown[][],
): BaseTestingHeatmapMeta {
  return computeMeta(matrix, computeBaseStep);
}

export function getBaseTestingHeatmapLegendBins(
  meta: BaseTestingHeatmapMeta,
  decimalPlaces = DEFAULT_HEATMAP_DECIMAL_PLACES,
) {
  return legendBins(meta, decimalPlaces);
}

export function getBaseTestingHeatmapStyle(
  value: unknown,
  meta: BaseTestingHeatmapMeta,
  options?: { textColor?: string },
) {
  return styleForValue(value, meta, options);
}

export function computeLevelTestingHeatmapMetaFromMatrix(
  matrix: unknown[][],
): LevelTestingHeatmapMeta {
  return computeMeta(matrix, computeLevelStep);
}

export function getLevelTestingHeatmapLegendBins(
  meta: LevelTestingHeatmapMeta,
  decimalPlaces = DEFAULT_HEATMAP_DECIMAL_PLACES,
) {
  return legendBins(meta, decimalPlaces);
}

export function getLevelTestingHeatmapStyle(
  value: unknown,
  meta: LevelTestingHeatmapMeta,
  options?: { textColor?: string },
) {
  return styleForValue(value, meta, options);
}
