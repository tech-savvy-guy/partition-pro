function readRequiredEnv(name: string) {
  const value = import.meta.env[name]

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value.trim()
}

function readOptionalEnv(name: string) {
  const value = import.meta.env[name]

  if (typeof value !== "string" || value.trim() === "") {
    return undefined
  }

  return value.trim()
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "")
}

export const env = {
  tenantId: readRequiredEnv("VITE_ENTRA_TENANT_ID"),
  clientId: readRequiredEnv("VITE_ENTRA_CLIENT_ID"),
  apiScope: readRequiredEnv("VITE_ENTRA_API_SCOPE"),
  apiBaseUrl: normalizeBaseUrl(readRequiredEnv("VITE_API_BASE_URL")),
  redirectUri: readOptionalEnv("VITE_ENTRA_REDIRECT_URI") ?? window.location.origin,
} as const
