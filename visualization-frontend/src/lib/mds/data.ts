import type {
  MdsDistanceFunction,
  MdsHistogramBin,
  MdsMetric,
  MdsSkuRow,
} from "./types"

export const MDS_TOTAL_SKUS = 97
export const MDS_DEFAULT_THRESHOLD = 0.27
export const MDS_DISTANCE_FUNCTIONS: MdsDistanceFunction[] = ["chi", "phi"]

export const MDS_METRICS: MdsMetric[] = [
  { distanceFunction: "chi", dimension: "2d", stress: 0.22, rSquared: 0.73 },
  { distanceFunction: "phi", dimension: "2d", stress: 0.245, rSquared: 0.688 },
  { distanceFunction: "chi", dimension: "3d", stress: 0.153, rSquared: 0.822 },
  { distanceFunction: "phi", dimension: "3d", stress: 0.181, rSquared: 0.776 },
]

export const MDS_HISTOGRAM_BY_DISTANCE: Record<
  MdsDistanceFunction,
  MdsHistogramBin[]
> = {
  chi: [
    { binStart: 0, count: 0 },
    { binStart: 0.05, count: 0 },
    { binStart: 0.1, count: 0 },
    { binStart: 0.15, count: 0 },
    { binStart: 0.2, count: 0 },
    { binStart: 0.25, count: 1 },
    { binStart: 0.3, count: 1 },
    { binStart: 0.35, count: 2 },
    { binStart: 0.4, count: 2 },
    { binStart: 0.45, count: 6 },
    { binStart: 0.5, count: 9 },
    { binStart: 0.55, count: 9 },
    { binStart: 0.6, count: 10 },
    { binStart: 0.65, count: 6 },
    { binStart: 0.7, count: 16 },
    { binStart: 0.75, count: 7 },
    { binStart: 0.8, count: 11 },
    { binStart: 0.85, count: 8 },
    { binStart: 0.9, count: 5 },
    { binStart: 0.95, count: 4 },
  ],
  phi: [
    { binStart: 0, count: 0 },
    { binStart: 0.05, count: 0 },
    { binStart: 0.1, count: 0 },
    { binStart: 0.15, count: 0 },
    { binStart: 0.2, count: 1 },
    { binStart: 0.25, count: 1 },
    { binStart: 0.3, count: 2 },
    { binStart: 0.35, count: 3 },
    { binStart: 0.4, count: 4 },
    { binStart: 0.45, count: 7 },
    { binStart: 0.5, count: 8 },
    { binStart: 0.55, count: 10 },
    { binStart: 0.6, count: 9 },
    { binStart: 0.65, count: 8 },
    { binStart: 0.7, count: 13 },
    { binStart: 0.75, count: 9 },
    { binStart: 0.8, count: 9 },
    { binStart: 0.85, count: 7 },
    { binStart: 0.9, count: 4 },
    { binStart: 0.95, count: 2 },
  ],
}

export const MDS_SKU_ROWS: MdsSkuRow[] = [
  row("1", "JW-BL-750", "Diageo", "Johnnie Walker", "750ml", "Bottle", "1", "National", "40%", "Premium", 0.24, 0.28),
  row("2", "JAM-700", "Pernod Ricard", "Jameson", "700ml", "Bottle", "1", "National", "40%", "Standard", 0.29, 0.23),
  row("3", "MM-1000", "Beam Suntory", "Maker's Mark", "1000ml", "Bottle", "1", "Regional", "45%", "Premium", 0.34, 0.31),
  row("4", "GL-12-700", "Diageo", "Glenfiddich", "700ml", "Bottle", "1", "National", "40%", "Super Premium", 0.37, 0.26),
  row("5", "ABL-6PK", "AB InBev", "Corona", "330ml", "Can", "6", "National", "4.5%", "Standard", 0.41, 0.35),
  row("6", "HNK-VS-700", "LVMH", "Hennessy", "700ml", "Bottle", "1", "National", "40%", "Premium", 0.44, 0.39),
  row("7", "CAP-1L", "Campari Group", "Aperol", "1000ml", "Bottle", "1", "Regional", "11%", "Standard", 0.48, 0.42),
  row("8", "BAC-WH-700", "Bacardi", "Bacardi", "700ml", "Bottle", "1", "National", "37.5%", "Standard", 0.52, 0.46),
  row("9", "JD-1000", "Brown-Forman", "Jack Daniel's", "1000ml", "Bottle", "1", "National", "40%", "Standard", 0.56, 0.49),
  row("10", "GBY-GS-700", "Bacardi", "Grey Goose", "700ml", "Bottle", "1", "National", "40%", "Super Premium", 0.61, 0.55),
  row("11", "SMR-700", "Diageo", "Smirnoff", "700ml", "Bottle", "1", "National", "37.5%", "Standard", 0.67, 0.59),
  row("12", "TLR-750", "Pernod Ricard", "The Glenlivet", "750ml", "Bottle", "1", "National", "40%", "Super Premium", 0.72, 0.63),
]

function row(
  id: string,
  skuName: string,
  manufacturer: string,
  brand: string,
  packSize: string,
  packType: string,
  packCount: string,
  ownership: string,
  abv: string,
  priceSegment: string,
  chi: number,
  phi: number
): MdsSkuRow {
  return {
    id,
    skuName,
    manufacturer,
    brand,
    packSize,
    packType,
    packCount,
    ownership,
    abv,
    priceSegment,
    rSquaredByDistance: { chi, phi },
  }
}
