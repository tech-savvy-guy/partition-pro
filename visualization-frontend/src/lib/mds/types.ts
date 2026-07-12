export type MdsDistanceFunction = "chi" | "phi"

export type MdsDimension = "2d" | "3d"

export type MdsMetricKind = "stress" | "rSquared"

export type MdsMetric = {
  distanceFunction: MdsDistanceFunction
  dimension: MdsDimension
  stress: number
  rSquared: number
}

export type MdsHistogramBin = {
  binStart: number
  count: number
}

export type MdsSkuRow = {
  id: string
  skuName: string
  manufacturer: string
  brand: string
  packSize: string
  packType: string
  packCount: string
  ownership: string
  abv: string
  priceSegment: string
  rSquaredByDistance: Record<MdsDistanceFunction, number>
}
