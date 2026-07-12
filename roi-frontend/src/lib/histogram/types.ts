// ─────────────────────────────────────────────────────────────────────────────
// Histogram — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HistogramBin {
  bin: string       // e.g. "0.25"
  count: number
}

export interface HistogramData {
  bins: HistogramBin[]
  cumulative: number[]
}

export interface HistogramMargins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface HistogramConfig {
  /** Gap between bars in pixels */
  barGap?: number
  /** Bar fill color */
  barColor?: string
  /** Bar hover color */
  barHoverColor?: string
  /** Grid line color */
  gridColor?: string
  /** Axis line color */
  axisColor?: string
  /** Text color */
  textColor?: string
  /** Threshold reference line color */
  thresholdColor?: string
  /** Whether to show the cumulative row */
  showCumulative?: boolean
  /** Height of the cumulative row */
  cumulativeRowHeight?: number
  /** Chart margins */
  margins?: HistogramMargins
  /** X-axis label */
  xAxisLabel?: string
  /** Y-axis label */
  yAxisLabel?: string
}

export interface HistogramProps {
  /** Histogram bin data */
  data: HistogramBin[]
  /** Threshold value for the reference line (0-1 scale) */
  threshold?: number
  /** Configuration options */
  config?: HistogramConfig
  /** Chart height in pixels */
  height?: number
  /** CSS class name */
  className?: string
}

// Default configuration
export const DEFAULT_HISTOGRAM_CONFIG: Required<HistogramConfig> = {
  barGap: 2,
  barColor: "#c4c9d4",
  barHoverColor: "#a1a8b8",
  gridColor: "#e5e7eb",
  axisColor: "#d1d5db",
  textColor: "#6b7280",
  thresholdColor: "#dc2626",
  showCumulative: true,
  cumulativeRowHeight: 32,
  margins: { top: 20, right: 20, bottom: 50, left: 80 },
  xAxisLabel: "R-squared",
  yAxisLabel: "Number of SKUs",
}
