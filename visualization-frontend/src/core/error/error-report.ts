import type { ErrorInfo } from "react"

export type ErrorReportContext = {
  error: Error
  errorInfo: ErrorInfo | null
  capturedAt: string
}

function readEnvironmentSnapshot() {
  if (typeof window === "undefined") {
    return {
      url: "",
      pathname: "",
      referrer: "",
      userAgent: "",
      viewport: "",
      language: "",
      platform: "",
      mode: import.meta.env.MODE,
    }
  }

  return {
    url: window.location.href,
    pathname: window.location.pathname,
    referrer: document.referrer || "(none)",
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
    platform: navigator.platform,
    mode: import.meta.env.MODE,
  }
}

function formatErrorChain(error: Error): string[] {
  const lines: string[] = []
  let current: unknown = error
  let depth = 0

  while (current instanceof Error && depth < 8) {
    lines.push(`[${depth}] ${current.name}: ${current.message}`)
    if (current.stack?.trim()) {
      lines.push(current.stack.trim())
    } else {
      lines.push("(no stack trace available)")
    }
    if (depth < 7 && current.cause != null) {
      lines.push("")
      lines.push(`Caused by:`)
    }
    current = current.cause
    depth += 1
  }

  return lines
}

export function buildErrorReport({
  error,
  errorInfo,
  capturedAt,
}: ErrorReportContext): string {
  const env = readEnvironmentSnapshot()
  const sections = [
    "=".repeat(80),
    "APPLICATION ERROR REPORT",
    "=".repeat(80),
    "",
    "SUMMARY",
    "-".repeat(80),
    `Captured (UTC): ${capturedAt}`,
    `Error: ${error.name}: ${error.message}`,
    "",
    "LOCATION",
    "-".repeat(80),
    `URL: ${env.url || "(unavailable)"}`,
    `Path: ${env.pathname || "(unavailable)"}`,
    `Referrer: ${env.referrer}`,
    "",
    "ENVIRONMENT",
    "-".repeat(80),
    `User Agent: ${env.userAgent || "(unavailable)"}`,
    `Viewport: ${env.viewport || "(unavailable)"}`,
    `Language: ${env.language || "(unavailable)"}`,
    `Platform: ${env.platform || "(unavailable)"}`,
    `Build Mode: ${env.mode}`,
    "",
    "ERROR TRAIL",
    "-".repeat(80),
    ...formatErrorChain(error),
  ]

  const componentStack = errorInfo?.componentStack?.trim()
  if (componentStack) {
    sections.push(
      "",
      "REACT COMPONENT STACK",
      "-".repeat(80),
      componentStack
    )
  }

  sections.push("", "=".repeat(80), "END OF REPORT", "=".repeat(80))
  return sections.join("\n")
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to execCommand fallback.
  }

  try {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "true")
    textarea.style.position = "fixed"
    textarea.style.top = "0"
    textarea.style.left = "-9999px"
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const copied = document.execCommand("copy")
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}
