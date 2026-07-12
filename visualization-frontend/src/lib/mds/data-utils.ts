import {
  MDS_HISTOGRAM_BY_DISTANCE,
  MDS_SKU_ROWS,
  MDS_TOTAL_SKUS,
} from "./data"
import type {
  MdsDistanceFunction,
  MdsHistogramBin,
  MdsMetric,
  MdsMetricKind,
  MdsSkuRow,
} from "./types"

export function clampMdsThreshold(value: number): number {
  if (Number.isNaN(value)) {
    return 0
  }

  return Math.min(1, Math.max(0, value))
}

export function formatMdsPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatMdsThreshold(value: number): string {
  return clampMdsThreshold(value).toFixed(2)
}

export function getMdsMetricValue(
  metric: MdsMetric,
  kind: MdsMetricKind
): number {
  return kind === "stress" ? metric.stress : metric.rSquared
}

export function getMdsMetricColor(kind: MdsMetricKind, value: number): string {
  if (kind === "stress") {
    return value > 0.2 ? "#dc2626" : "#e85d04"
  }

  if (value >= 0.8) {
    return "#38a348"
  }

  if (value >= 0.7) {
    return "#e85d04"
  }

  return "#dc2626"
}

export function getMdsHistogram(
  distanceFunction: MdsDistanceFunction
): MdsHistogramBin[] {
  return MDS_HISTOGRAM_BY_DISTANCE[distanceFunction]
}

export function getMdsCumulativeCounts(bins: MdsHistogramBin[]): number[] {
  let count = 0

  return bins.map((bin) => {
    count += bin.count
    return count
  })
}

export function getMdsExcludedCount(
  distanceFunction: MdsDistanceFunction,
  threshold: number
): number {
  return getMdsExcludedSkuRows(distanceFunction, threshold).length
}

export function getMdsExcludedSkuRows(
  distanceFunction: MdsDistanceFunction,
  threshold: number
): MdsSkuRow[] {
  const safeThreshold = clampMdsThreshold(threshold)

  return MDS_SKU_ROWS.filter(
    (row) => row.rSquaredByDistance[distanceFunction] <= safeThreshold
  )
}

export function getMdsVisibleSkuRows({
  distanceFunction,
  threshold,
  query,
}: {
  distanceFunction: MdsDistanceFunction
  threshold: number
  query: string
}): MdsSkuRow[] {
  const normalizedQuery = query.trim().toLowerCase()
  const excludedRows = getMdsExcludedSkuRows(distanceFunction, threshold)

  if (!normalizedQuery) {
    return excludedRows
  }

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

export function getMdsTotalSkus(): number {
  return MDS_TOTAL_SKUS
}
