// src/components/heatmap.tsx
import { interpolateRdYlGn } from "d3-scale-chromatic";
import type { CSSProperties } from "react";

/**
 * Existing continuous gradient (kept for backward compatibility).
 * Some pages may still use this.
 */
export function getHeatmapStyle(value: number, min: number, max: number): CSSProperties {
  if (!Number.isFinite(value) || max === min) return {};
  const t = (value - min) / (max - min);
  return {
    backgroundColor: interpolateRdYlGn(1 - t),
    color: "#000",
    textAlign: "center",
  };
}

/**
 * Existing helper — compute numeric min/max from rows.
 * Safe to reuse everywhere.
 */
export function computeMinMax(values: number[]): { min: number; max: number } {
  const filtered = values.filter((v) => Number.isFinite(v));
  if (filtered.length === 0) return { min: 0, max: 1 };

  const min = Math.min(...filtered);
  const max = Math.max(...filtered);

  return min === max ? { min, max: min + 1 } : { min, max };
}

/**
 * Existing stepped heatmap (kept as-is for BaseMath etc).
 */
export type HeatmapStepPreset = {
  label: string;
  startLessThan: number;
  step: number;
  palette?: readonly [string, string, string, string, string];
  textColor?: string;
};

export type HeatmapLegendBin = {
  label: string;
  color: string;
};

const DEFAULT_STEP_PALETTE = [
  "#E0E0E0", // grey
  "#FFC107", // yellow/amber
  "#FB8C00", // orange
  "#E53935", // red
  "#B71C1C", // dark red
] as const;

export const HEATMAP_STEP_PRESETS = {
  full_math: {
    label: "Shading gradient (full math)",
    startLessThan: 15,
    step: 5,
    palette: DEFAULT_STEP_PALETTE,
  },
  average_overlap: {
    label: "Shading gradient (average overlap)",
    startLessThan: 1.96,
    step: 3,
    palette: DEFAULT_STEP_PALETTE,
  },
} satisfies Record<string, HeatmapStepPreset>;

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
  decimalPlaces: number = DEFAULT_HEATMAP_DECIMAL_PLACES,
  options?: {
    empty?: string;
    stripTrailingZeros?: boolean;
  },
): string {
  const empty = options?.empty ?? "";
  if (value == null || !Number.isFinite(value)) return empty;

  const dp = clampHeatmapDecimalPlaces(decimalPlaces);
  let formatted = value.toFixed(dp);

  if (options?.stripTrailingZeros && dp > 0) {
    formatted = formatted
      .replace(/(\.\d*?)0+$/, "$1")
      .replace(/\.$/, "");
  }

  return formatted;
}

function fmt(n: number, decimalPlaces = DEFAULT_HEATMAP_DECIMAL_PLACES) {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n) && decimalPlaces === 0) return String(n);
  return formatHeatmapNumber(n, decimalPlaces);
}

export function getSteppedHeatmapLegendBins(
  preset: HeatmapStepPreset,
  decimalPlaces = DEFAULT_HEATMAP_DECIMAL_PLACES,
): HeatmapLegendBin[] {
  const start = preset.startLessThan;
  const step = preset.step;

  const t1 = start + step;
  const t2 = start + step * 2;
  const t3 = start + step * 3;

  const palette = preset.palette ?? DEFAULT_STEP_PALETTE;

  return [
    { label: `≤ ${fmt(start, decimalPlaces)}`, color: palette[0] },
    { label: `${fmt(start, decimalPlaces)} – ${fmt(t1, decimalPlaces)}`, color: palette[1] },
    { label: `${fmt(t1, decimalPlaces)} – ${fmt(t2, decimalPlaces)}`, color: palette[2] },
    { label: `${fmt(t2, decimalPlaces)} – ${fmt(t3, decimalPlaces)}`, color: palette[3] },
    { label: `> ${fmt(t3, decimalPlaces)}`, color: palette[4] },
  ];
}

export function getSteppedHeatmapStyle(value: number, preset: HeatmapStepPreset): CSSProperties {
  if (!Number.isFinite(value)) return {};

  const start = preset.startLessThan;
  const step = preset.step;

  const t1 = start + step;
  const t2 = start + step * 2;
  const t3 = start + step * 3;

  const palette = preset.palette ?? DEFAULT_STEP_PALETTE;

  let bg = palette[0];
  if (value <= start) bg = palette[0];
  else if (value <= t1) bg = palette[1];
  else if (value <= t2) bg = palette[2];
  else if (value <= t3) bg = palette[3];
  else bg = palette[4];

  return {
    backgroundColor: bg,
    color: preset.textColor ?? "#000",
    textAlign: "center",
  };
}

/* =========================================================================================
 * NEW: Lead's diagonal-min + CEILING step logic (used for OBM & Base Testing)
 * =======================================================================================*/

const LEAD_COLOR_MAP = {
  black: "#000000",
  grey: "#DDDDDD",
  yellow: "#FFC000",
  orange: "#E27804",
  red: "#D20000",
  dark_red: "#C00000",
} as const;

type LeadColorName = keyof typeof LEAD_COLOR_MAP;

function isBlank(v: any) {
  return v == null || (typeof v === "string" && v.trim() === "");
}

function toNum(v: any): number | null {
  if (isBlank(v)) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function flattenNumeric(matrix: any[][], includeZeros = false): number[] {
  const out: number[] = [];
  for (const row of matrix) {
    for (const v of row) {
      const n = toNum(v);
      if (n == null) continue;
      if (!includeZeros && n === 0) continue;
      out.push(n);
    }
  }
  return out;
}

/**
 * start = MIN(non-zero diagonal), ignoring blanks and zeros.
 */
function computeStartMinNonZeroDiagonal(matrix: any[][]): number | null {
  if (!Array.isArray(matrix) || matrix.length === 0) return null;
  const k = Math.min(matrix.length, Array.isArray(matrix[0]) ? matrix[0].length : 0);
  if (k === 0) return null;

  const diag: number[] = [];
  for (let i = 0; i < k; i++) {
    const n = toNum(matrix[i]?.[i]);
    if (n == null) continue;
    if (n !== 0) diag.push(n);
  }
  return diag.length ? Math.min(...diag) : null;
}

/**
 * step = CEILING((max-min)/sqrt(count), 1)  -> Math.ceil(...)
 * where count ignores blanks and ignores zeros (zeros are colored black separately).
 */
function computeCeilStepFromMatrix(matrix: any[][]): number | null {
  const vals = flattenNumeric(matrix, false);
  const n = vals.length;
  if (n === 0) return null;
  const mx = Math.max(...vals);
  const mn = Math.min(...vals);
  const base = (mx - mn) / Math.sqrt(n);
  return Math.ceil(base);
}

function leadColorForValue(
  v: any,
  t1: number,
  t2: number,
  t3: number,
  t4: number
): string | null {
  if (isBlank(v)) return null;
  const n = toNum(v);
  if (n == null) return null;

  if (n === 0) return LEAD_COLOR_MAP.black;
  if (n < t1) return LEAD_COLOR_MAP.grey;
  if (t1 <= n && n <= t2) return LEAD_COLOR_MAP.yellow;
  if (t2 < n && n <= t3) return LEAD_COLOR_MAP.orange;
  if (t3 < n && n <= t4) return LEAD_COLOR_MAP.red;
  return LEAD_COLOR_MAP.dark_red;
}

/**
 * Generic meta shape for lead-style heatmap.
 */
export type DiagonalBucketHeatmapMeta = {
  start: number | null;
  step: number | null;
  thresholds: { t1: number; t2: number; t3: number; t4: number } | null;
  cell_colors: (string | null)[][];
};

// Alias (because your TS error hinted something else was imported earlier)
export type LeadBucketHeatmapMeta = DiagonalBucketHeatmapMeta;

/**
 * Compute lead-style heatmap meta from a numeric matrix.
 * (Used by BOTH OBM and Base Testing UI)
 */
function computeLeadHeatmapMetaFromMatrix(matrix: any[][]): DiagonalBucketHeatmapMeta {
  const safe = Array.isArray(matrix) ? matrix : [];

  const start = computeStartMinNonZeroDiagonal(safe);
  const step = computeCeilStepFromMatrix(safe);

  const fallbackColors = safe.map((row) =>
    (Array.isArray(row) ? row : []).map((vv) => {
      const n = toNum(vv);
      if (n == null) return null;
      if (n === 0) return LEAD_COLOR_MAP.black;
      return null;
    })
  );

  if (start == null || step == null) {
    return { start, step, thresholds: null, cell_colors: fallbackColors };
  }

  const t1 = start;
  const t2 = start + step;
  const t3 = start + 2 * step;
  const t4 = start + 3 * step;

  return {
    start,
    step,
    thresholds: { t1, t2, t3, t4 },
    cell_colors: safe.map((row) =>
      (Array.isArray(row) ? row : []).map((vv) => leadColorForValue(vv, t1, t2, t3, t4))
    ),
  };
}

/* =========================
 * OBM exports (names must match your imports)
 * =========================*/

export type ObmHeatmapMeta = DiagonalBucketHeatmapMeta;

/**
 * IMPORTANT: Your OBM.tsx is importing THIS exact name.
 */
export function computeObmHeatmapMetaFromMatrix(matrix: any[][]): ObmHeatmapMeta {
  return computeLeadHeatmapMetaFromMatrix(matrix);
}

/**
 * Alias to avoid future rename breakages (your screenshot hinted this existed before).
 */
export const getObmHeatmapMetaFromMatrix = computeObmHeatmapMetaFromMatrix;

export function getObmHeatmapLegendBins(
  meta: ObmHeatmapMeta,
  decimalPlaces = DEFAULT_HEATMAP_DECIMAL_PLACES,
): HeatmapLegendBin[] {
  // show "0" bucket always; thresholds might be null if start/step couldn't be computed
  const bins: HeatmapLegendBin[] = [{ label: "0", color: LEAD_COLOR_MAP.black }];

  if (!meta.thresholds || meta.start == null || meta.step == null) {
    bins.push({ label: "blank", color: "transparent" });
    return bins;
  }

  const { t1, t2, t3, t4 } = meta.thresholds;
  bins.push(
    { label: `< ${fmt(t1, decimalPlaces)}`, color: LEAD_COLOR_MAP.grey },
    { label: `${fmt(t1, decimalPlaces)} – ${fmt(t2, decimalPlaces)}`, color: LEAD_COLOR_MAP.yellow },
    { label: `${fmt(t2, decimalPlaces)} – ${fmt(t3, decimalPlaces)}`, color: LEAD_COLOR_MAP.orange },
    { label: `${fmt(t3, decimalPlaces)} – ${fmt(t4, decimalPlaces)}`, color: LEAD_COLOR_MAP.red },
    { label: `> ${fmt(t4, decimalPlaces)}`, color: LEAD_COLOR_MAP.dark_red }
  );
  return bins;
}

export function getObmHeatmapStyle(
  value: any,
  meta: ObmHeatmapMeta,
  opts?: { textColor?: string }
): CSSProperties {
  if (isBlank(value)) return {};
  const n = toNum(value);
  if (n == null) return {};

  const textColor = opts?.textColor ?? "#000";

  if (n === 0) return { backgroundColor: LEAD_COLOR_MAP.black, color: "#fff", textAlign: "center" };
  if (!meta.thresholds) return { textAlign: "center" };

  const { t1, t2, t3, t4 } = meta.thresholds;
  const bg = leadColorForValue(n, t1, t2, t3, t4);
  return bg ? { backgroundColor: bg, color: bg === LEAD_COLOR_MAP.black ? "#fff" : textColor, textAlign: "center" } : {};
}

/* =========================
 * Base Testing exports
 * =========================*/

export type BaseTestingHeatmapMeta = DiagonalBucketHeatmapMeta;

export function computeBaseTestingHeatmapMetaFromMatrix(matrix: any[][]): BaseTestingHeatmapMeta {
  return computeLeadHeatmapMetaFromMatrix(matrix);
}

export function getBaseTestingHeatmapLegendBins(
  meta: BaseTestingHeatmapMeta,
  decimalPlaces = DEFAULT_HEATMAP_DECIMAL_PLACES,
): HeatmapLegendBin[] {
  return getObmHeatmapLegendBins(meta, decimalPlaces);
}

export function getBaseTestingHeatmapStyle(
  value: any,
  meta: BaseTestingHeatmapMeta,
  opts?: { textColor?: string }
): CSSProperties {
  // Same coloring behavior as OBM (same logic)
  return getObmHeatmapStyle(value, meta, opts);
}

/* =========================
 * Level Testing exports (Lead formula)
 * =========================*/

export type LevelTestingHeatmapMeta = DiagonalBucketHeatmapMeta;

function excelCeiling(x: number, significance: number) {
  // Excel CEILING(x, significance) for positive significance
  if (!Number.isFinite(x) || !Number.isFinite(significance) || significance <= 0) return x;
  return Math.ceil(x / significance) * significance;
}

/**
 * step = IF((MAX-MIN)<1,
 *            CEILING(((MAX-MIN)/SQRT(COUNT)), 1),
 *            CEILING(((MAX-MIN)/SQRT(COUNT)), 0.5)
 *          )
 *
 * COUNT ignores blanks; we also ignore zeros (0 is its own black bucket).
 */
function computeLevelTestingStepFromMatrix(matrix: any[][]): number | null {
  const vals = flattenNumeric(matrix, false); // ignore zeros, ignore blanks
  const n = vals.length;
  if (n === 0) return null;

  const mx = Math.max(...vals);
  const mn = Math.min(...vals);
  const rng = mx - mn;

  const base = rng / Math.sqrt(n);
  const significance = rng < 1 ? 1 : 0.5;

  const step = excelCeiling(base, significance);
  return Number.isFinite(step) ? step : null;
}

export function computeLevelTestingHeatmapMetaFromMatrix(matrix: any[][]): LevelTestingHeatmapMeta {
  const safe = Array.isArray(matrix) ? matrix : [];

  const start = computeStartMinNonZeroDiagonal(safe);
  const step = computeLevelTestingStepFromMatrix(safe);

  const fallbackColors = safe.map((row) =>
    (Array.isArray(row) ? row : []).map((vv) => {
      const n = toNum(vv);
      if (n == null) return null;
      if (n === 0) return LEAD_COLOR_MAP.black;
      return null;
    })
  );

  if (start == null || step == null) {
    return { start, step, thresholds: null, cell_colors: fallbackColors };
  }

  const t1 = start;
  const t2 = start + step;
  const t3 = start + 2 * step;
  const t4 = start + 3 * step;

  return {
    start,
    step,
    thresholds: { t1, t2, t3, t4 },
    cell_colors: safe.map((row) =>
      (Array.isArray(row) ? row : []).map((vv) => leadColorForValue(vv, t1, t2, t3, t4))
    ),
  };
}

export function getLevelTestingHeatmapLegendBins(
  meta: LevelTestingHeatmapMeta,
  decimalPlaces = DEFAULT_HEATMAP_DECIMAL_PLACES,
): HeatmapLegendBin[] {
  const bins: HeatmapLegendBin[] = [{ label: "0", color: LEAD_COLOR_MAP.black }];

  if (!meta.thresholds || meta.start == null || meta.step == null) {
    bins.push({ label: "blank", color: "transparent" });
    return bins;
  }

  const { t1, t2, t3, t4 } = meta.thresholds;

  bins.push(
    { label: `< ${fmt(t1, decimalPlaces)}`, color: LEAD_COLOR_MAP.grey },
    { label: `${fmt(t1, decimalPlaces)} – ${fmt(t2, decimalPlaces)}`, color: LEAD_COLOR_MAP.yellow },
    { label: `${fmt(t2, decimalPlaces)} – ${fmt(t3, decimalPlaces)}`, color: LEAD_COLOR_MAP.orange },
    { label: `${fmt(t3, decimalPlaces)} – ${fmt(t4, decimalPlaces)}`, color: LEAD_COLOR_MAP.red },
    { label: `> ${fmt(t4, decimalPlaces)}`, color: LEAD_COLOR_MAP.dark_red }
  );

  return bins;
}

export function getLevelTestingHeatmapStyle(
  value: any,
  meta: LevelTestingHeatmapMeta,
  opts?: { textColor?: string }
): CSSProperties {
  if (isBlank(value)) return {};
  const n = toNum(value);
  if (n == null) return {};

  const textColor = opts?.textColor ?? "#000";

  if (n === 0) return { backgroundColor: LEAD_COLOR_MAP.black, color: "#fff", textAlign: "center" };
  if (!meta.thresholds) return { textAlign: "center" };

  const { t1, t2, t3, t4 } = meta.thresholds;
  const bg = leadColorForValue(n, t1, t2, t3, t4);

  return bg
    ? { backgroundColor: bg, color: bg === LEAD_COLOR_MAP.black ? "#fff" : textColor, textAlign: "center" }
    : {};
}
