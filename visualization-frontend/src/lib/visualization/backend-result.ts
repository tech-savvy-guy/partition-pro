import type {
  VisualizationMetricName,
  VisualizationMetricResult,
  VisualizationResult,
  VisualizationTable,
} from "@/core/api"
import type { BubbleDataPoint } from "@/lib/bubble-chart/types"
import type {
  MdsDistanceFunction,
  MdsHistogramBin,
  MdsMetric,
  MdsSkuRow,
} from "@/lib/mds"

const DISTANCE_FUNCTIONS: VisualizationMetricName[] = ["chi", "phi"]
const HISTOGRAM_STEP = 0.05

type TableRow = Record<string, unknown>

export function getVisualizationMetricResult(
  result: VisualizationResult | null | undefined,
  metric: VisualizationMetricName
): VisualizationMetricResult | null {
  if (!result) return null
  if (result.metrics?.[metric]) return result.metrics[metric] ?? null
  const legacyMetric = String(result.metadata?.metric ?? metric).toLowerCase()
  return legacyMetric === metric ? result : null
}

export function getAvailableVisualizationMetrics(
  result: VisualizationResult | null | undefined,
  mode?: "2d" | "3d"
): VisualizationMetricName[] {
  if (!result) return []
  const metrics = DISTANCE_FUNCTIONS.filter((metric) => {
    const metricResult = getVisualizationMetricResult(result, metric)
    if (!metricResult) return false
    if (!mode) return true
    const table = mode === "3d" ? metricResult.mds_3d : metricResult.mds_2d
    return Boolean(table?.rows?.length)
  })
  return metrics.length > 0 ? metrics : ["chi"]
}

export function buildMdsMetrics(result: VisualizationResult | null | undefined): MdsMetric[] {
  if (!result) return []

  return DISTANCE_FUNCTIONS.flatMap((distanceFunction) => {
    const metricResult = getVisualizationMetricResult(result, distanceFunction)
    const diagnostics = tableToObjects(metricResult?.diagnostics)

    return diagnostics.flatMap((row) => {
      const dim = Number(row.dim)
      if (dim !== 2 && dim !== 3) return []
      return {
        distanceFunction,
        dimension: dim === 2 ? "2d" : "3d",
        stress: toNumber(row.stress),
        rSquared: toNumber(row.rsquare ?? row.rSquared ?? row.r_square),
      } satisfies MdsMetric
    })
  })
}

export function buildMdsSkuRows(result: VisualizationResult | null | undefined): MdsSkuRow[] {
  const rowMap = new Map<string, MdsSkuRow>()

  for (const distanceFunction of DISTANCE_FUNCTIONS) {
    const metricResult = getVisualizationMetricResult(result, distanceFunction)
    const rows = tableToObjects(metricResult?.mds_2d)

    for (const row of rows) {
      const id = toText(row.ID ?? row.id)
      if (!id) continue

      const existing = rowMap.get(id)
      const next: MdsSkuRow =
        existing ??
        {
          id,
          skuName: toText(row.sku_name ?? row.ID ?? row.id),
          manufacturer: toText(row.manufacturer ?? row.Manufacturer),
          brand: toText(row.brand ?? row.Brand),
          packSize: toText(row.pack_size ?? row["Pack Size"]),
          packType: toText(row.pack_type ?? row["Pack Type"]),
          packCount: toText(row.pack_count ?? row["Pack Count"]),
          ownership: toText(row.ownership ?? row.Ownership),
          abv: toText(row.abv ?? row.ABV),
          priceSegment: toText(row.price_segment ?? row["Price Segment"]),
          rSquaredByDistance: { chi: 0, phi: 0 },
        }

      next.rSquaredByDistance[distanceFunction] = toNumber(row["RSQ SKU"])
      rowMap.set(id, next)
    }
  }

  return Array.from(rowMap.values())
}

export function buildMdsHistogram(
  rows: MdsSkuRow[],
  distanceFunction: MdsDistanceFunction
): MdsHistogramBin[] {
  const bins = Array.from({ length: 20 }, (_, index) => ({
    binStart: Number((index * HISTOGRAM_STEP).toFixed(2)),
    count: 0,
  }))

  for (const row of rows) {
    const value = row.rSquaredByDistance[distanceFunction]
    const safeValue = Math.min(0.999, Math.max(0, value))
    const index = Math.floor(safeValue / HISTOGRAM_STEP)
    bins[index].count += 1
  }

  return bins
}

export function getExcludedMdsRows(
  rows: MdsSkuRow[],
  distanceFunction: MdsDistanceFunction,
  threshold: number,
  query: string
): MdsSkuRow[] {
  const normalizedQuery = query.trim().toLowerCase()
  const excludedRows = rows.filter(
    (row) => row.rSquaredByDistance[distanceFunction] <= threshold
  )

  if (!normalizedQuery) return excludedRows

  return excludedRows.filter((row) =>
    [
      row.id,
      row.skuName,
      row.manufacturer,
      row.brand,
      row.packSize,
      row.packType,
      row.packCount,
      row.ownership,
      row.abv,
      row.priceSegment,
    ].some((value) => value.toLowerCase().includes(normalizedQuery))
  )
}

export function buildBubbleDataPoints(
  result: VisualizationResult | null | undefined,
  metric: VisualizationMetricName,
  mode: "2d" | "3d"
): BubbleDataPoint[] {
  const metricResult = getVisualizationMetricResult(result, metric)
  const rows = tableToObjects(mode === "3d" ? metricResult?.mds_3d : metricResult?.mds_2d)

  return rows.flatMap((row, index) => {
    const x = toNumber(row.x)
    const y = toNumber(row.y)
    const z = mode === "3d" ? toNumber(row.z) : 0
    if (!Number.isFinite(x) || !Number.isFinite(y)) return []

    const penetration = toNumber(row.penetration)
    return {
      x,
      y,
      z,
      value: toNumber(row["RSQ SKU"]),
      size: Number.isFinite(penetration) ? penetration : undefined,
      label: toText(row.sku_name ?? row.ID ?? `SKU ${index + 1}`),
      metadata: row,
    } satisfies BubbleDataPoint
  })
}

/** Trim-only normalization matching the backend `_normalize_key`. */
function normalizeKey(value: unknown): string {
  return String(value ?? "").trim()
}

/**
 * Keep only the points whose metadata matches every step of a node's attribute
 * `path` (e.g. [{ attribute: "Price Tier", value: "premium" }]). The root node
 * has an empty path, so all points are returned.
 *
 * Returns `{ points, missingAttributes }` — `missingAttributes` lists path
 * attributes absent from the point metadata (e.g. the visualization was run
 * without `include_attributes`), so callers can fall back to showing everything.
 */
export function filterPointsByPath(
  points: BubbleDataPoint[],
  path: Array<{ attribute: string; value: string }> | undefined | null
): { points: BubbleDataPoint[]; missingAttributes: string[] } {
  const steps = (path ?? []).filter((step) => step?.attribute && step?.value)
  if (steps.length === 0) return { points, missingAttributes: [] }

  const missing = new Set<string>()
  const hasColumn = (attribute: string) =>
    points.some((point) => point.metadata != null && attribute in point.metadata)

  const usableSteps = steps.filter((step) => {
    if (hasColumn(step.attribute)) return true
    missing.add(step.attribute)
    return false
  })

  if (usableSteps.length === 0) {
    return { points, missingAttributes: Array.from(missing) }
  }

  const filtered = points.filter((point) =>
    usableSteps.every(
      (step) =>
        normalizeKey((point.metadata as TableRow | undefined)?.[step.attribute]) ===
        normalizeKey(step.value)
    )
  )
  return { points: filtered, missingAttributes: Array.from(missing) }
}

function tableToObjects(table: VisualizationTable | undefined): TableRow[] {
  if (!table?.columns || !Array.isArray(table.rows)) return []

  return table.rows.map((row) => {
    const out: TableRow = {}
    table.columns.forEach((column, index) => {
      out[column] = Array.isArray(row) ? row[index] : undefined
    })
    return out
  })
}

function toNumber(value: unknown): number {
  const numberValue =
    typeof value === "number" ? value : Number(String(value ?? "").replace(",", ""))
  return Number.isFinite(numberValue) ? numberValue : 0
}

function toText(value: unknown): string {
  return String(value ?? "").trim()
}
