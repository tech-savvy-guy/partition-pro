import type { RoiTable } from "@/core/api"

/**
 * roi-tool BaseMath's fixed heatmap preset (`HEATMAP_STEP_PRESETS.full_math`).
 * The SKU Math ROI diagonal is 0 by construction, so the diagonal-min
 * autostart used elsewhere would always come back null.
 */
export const SKU_MATH_HEATMAP_DEFAULTS = { start: 15, step: 5 } as const

export type SkuMathView = {
  /** Attribute columns preceding "skuname_ean" in the payload. */
  attributeColumns: string[]
  /** The SKU×SKU heatmap columns (everything after "abs_pen%"). */
  skuColumns: string[]
  rows: {
    sku: string
    avgRoi: number | null
    absPenPct: number | null
    attributes: Record<string, unknown>
    /** Aligned with skuColumns. */
    values: (number | null)[]
  }[]
}

function toNumber(value: unknown): number | null {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return null
  }
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * The SKU column set of a sku_math table — used both for rendering and for
 * detecting a stale result (columns no longer matching the saved selection).
 */
export function skuMathSkuColumns(
  table: RoiTable | null | undefined
): string[] {
  if (!table) return []
  const absPenIndex = table.columns.indexOf("abs_pen%")
  return absPenIndex >= 0 ? table.columns.slice(absPenIndex + 1) : []
}

export function buildSkuMathView(table: RoiTable): SkuMathView {
  const skuIndex = table.columns.indexOf("skuname_ean")
  const avgRoiIndex = table.columns.indexOf("avg_roi")
  const absPenIndex = table.columns.indexOf("abs_pen%")
  const attributeColumns = skuIndex > 0 ? table.columns.slice(0, skuIndex) : []
  const skuColumns = skuMathSkuColumns(table)
  const skuColumnStart = absPenIndex + 1

  return {
    attributeColumns,
    skuColumns,
    rows: table.rows.map((row) => ({
      sku: String(row[skuIndex] ?? ""),
      avgRoi: avgRoiIndex >= 0 ? toNumber(row[avgRoiIndex]) : null,
      absPenPct: absPenIndex >= 0 ? toNumber(row[absPenIndex]) : null,
      attributes: Object.fromEntries(
        attributeColumns.map((column, i) => [column, row[i]])
      ),
      values: skuColumns.map((_, i) => toNumber(row[skuColumnStart + i])),
    })),
  }
}
