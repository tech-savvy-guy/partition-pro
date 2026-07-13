import type { RoiCoverageSplitRow } from "@/core/api"

/**
 * Column labels/formatting for the coverage split tables, ported from
 * roi-tool's CompareCoverage.tsx. Status dots come from the backend's
 * `color_flag` — there is deliberately no client-side status computation.
 */
export const COVERAGE_HEADER_MAP: Record<string, string> = {
  sub_attribute: "Attribute Value",
  skus_number: "#SKUs",
  value_share: "Value% Share",
  volume_share: "Volume% Share",
  pos_value: "PoS Value",
  pos_volume: "PoS Volume",
  pos_value_covered: "PoS Value Covered%",
  pos_volume_covered: "PoS Volume Covered%",
}

/** Column order for the joined (custom-selection / panel) splits. */
export const JOINED_SPLIT_COLUMNS = [
  "sub_attribute",
  "skus_number",
  "pos_value_covered",
  "pos_volume_covered",
  "value_share",
  "volume_share",
] as const

/** Column order for the pure POS split. */
export const PURE_POS_SPLIT_COLUMNS = [
  "sub_attribute",
  "skus_number",
  "value_share",
  "volume_share",
  "pos_value",
  "pos_volume",
] as const

export function formatCoverageCell(key: string, value: unknown): string {
  if (key === "sub_attribute") {
    return value == null || value === "" ? "Overall" : String(value)
  }
  if (value == null) return ""

  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return ""

  if (key === "value_share" || key === "volume_share") {
    return String(Math.round(n))
  }
  // skus_number, pos_value(_covered), pos_volume(_covered)
  return Math.round(n).toLocaleString()
}

export function coverageSplitRowCells(
  row: RoiCoverageSplitRow,
  columns: readonly string[]
): string[] {
  return columns.map((key) =>
    formatCoverageCell(key, (row as Record<string, unknown>)[key])
  )
}

export const fmtPct = (value: number | null | undefined): string =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(2)}%`
    : "-"

export const fmtInt = (value: number | null | undefined): string =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.round(value).toLocaleString()
    : "-"

export const fmtNum2 = (value: number | null | undefined): string =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-"
