import Papa from "papaparse"

import type { DatasetPreview } from "@/core/api/cases/cases-types"

/**
 * Fetch and parse a CSV dataset directly from Azure Blob Storage using a
 * short-lived read SAS URL, returning every row for client-side pagination.
 *
 * Uses a raw `fetch` (NOT the app's axios client) so the backend Bearer token is
 * never attached — the SAS query string is what authorizes the request.
 */
export async function fetchCsvPreview(
  previewUrl: string
): Promise<DatasetPreview> {
  const response = await fetch(previewUrl)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch dataset preview (status ${response.status}).`
    )
  }

  const text = await response.text()

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  const columns = result.meta.fields ?? []
  const rows = result.data ?? []

  return { columns, rows }
}
