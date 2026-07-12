export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

export function formatBytes(value: string | number | null): string {
  if (value === null) return "-"

  const bytes = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return "-"

  const units = ["B", "KB", "MB", "GB", "TB"]
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const size = bytes / 1024 ** exponent
  const digits = size >= 10 || exponent === 0 ? 0 : 1

  return `${size.toFixed(digits)} ${units[exponent]}`
}
