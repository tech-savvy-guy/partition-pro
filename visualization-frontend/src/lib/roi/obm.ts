import type { RoiObmPayload } from "@/core/api"

/** OBM's fixed leading columns before the per-leaf heatmap block. */
const OBM_LEADING_COLUMNS = 3

export type ObmView = {
  /** Leaf labels — the heatmap columns (obm.columns minus Holds/SKU Count/Partition). */
  valueColumns: string[]
  rows: {
    holds: boolean
    skuCount: number
    label: string
    /** Aligned with valueColumns; null = no ROI pairs for that leaf pair. */
    cells: (number | null)[]
  }[]
  obmHolds: boolean
  /** rows × valueColumns, for computeBaseTestingHeatmapMetaFromMatrix. */
  cellMatrix: (number | null)[][]
}

export function buildObmView(obm: RoiObmPayload): ObmView {
  const rows = obm.rows.map(([holds, skuCount, label, cells]) => ({
    holds,
    skuCount,
    label,
    cells,
  }))
  return {
    valueColumns: obm.columns.slice(OBM_LEADING_COLUMNS),
    rows,
    obmHolds: obm.obm_holds,
    cellMatrix: rows.map((row) => row.cells),
  }
}
