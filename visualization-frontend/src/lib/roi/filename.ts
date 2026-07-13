/** `"Case A" + "P1" + "sku_math"` → `"case_a_p1_sku_math.xlsx"` */
export function roiExportFilename(
  parts: (string | undefined)[],
  suffix: string
): string {
  const slug = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  const prefix = parts
    .filter((part): part is string => Boolean(part))
    .map(slug)
    .filter(Boolean)
    .join("_")
  return `${prefix ? `${prefix}_` : ""}${suffix}.xlsx`
}
