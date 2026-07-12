/** Shared, JSX-free helpers for the DataTable. */

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "object") return JSON.stringify(value)
  const text = String(value)
  return text.trim() ? text : "-"
}

/** True when a value can be coerced to a finite number (used for type detection). */
export function isFiniteNumberLike(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value === "string") {
    const s = value.trim()
    if (!s) return false
    return Number.isFinite(Number(s))
  }
  return false
}

/**
 * Auto-detect which fields are numeric by sampling rows.
 * A field is numeric when >= 80% of its sampled non-empty values are number-like.
 */
export function detectNumericFields<TData extends Record<string, unknown>>(
  rows: TData[],
  fields: string[],
  sampleSize = 100,
): Set<string> {
  const numeric = new Set<string>()
  const sample = rows.slice(0, sampleSize)

  for (const field of fields) {
    let seen = 0
    let hits = 0
    for (const row of sample) {
      const v = row[field]
      if (v == null || String(v).trim() === "") continue
      seen += 1
      if (isFiniteNumberLike(v)) hits += 1
      if (seen >= 10) break
    }
    if (seen > 0 && hits / seen >= 0.8) numeric.add(field)
  }

  return numeric
}

export type PageItem = number | "ellipsis"

/** Numbered pagination items with leading/trailing ellipses (max 7 slots). */
export function buildPageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: PageItem[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)

  if (start > 2) items.push("ellipsis")
  for (let item = start; item <= end; item += 1) items.push(item)
  if (end < pageCount - 1) items.push("ellipsis")

  items.push(pageCount)
  return items
}

export const PAGINATION_LINK_CLASS =
  "h-7 min-w-7 rounded-none border-0 bg-transparent px-1.5 text-xs font-normal text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[active=true]:bg-transparent data-[active=true]:font-medium data-[active=true]:text-foreground data-[active=true]:underline data-[active=true]:underline-offset-4"

export const PAGINATION_ARROW_CLASS =
  "size-7 rounded-none border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground [&>span]:hidden"
