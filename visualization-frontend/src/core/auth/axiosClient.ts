import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios"

import { env, isAuthEndpoint } from "@/core/config"
import { tokenStorage } from "@/core/auth/tokenStorage"
import { authService } from "@/core/auth/authService"

export class ApiError extends Error {
  status: number

  constructor(status: number, detail: string) {
    super(`API request failed with ${status}: ${detail}`)
    this.name = "ApiError"
    this.status = status
  }
}

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length)
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

export const axiosClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    Accept: "application/json",
  },
})

axiosClient.interceptors.request.use(async (config) => {
  const url = config.url ?? ""
  const headers = config.headers

  if (isAuthEndpoint(url)) {
    config.withCredentials = true
    const csrf = readCookie("csrf_token")
    if (csrf) {
      headers.set("X-CSRF-Token", decodeURIComponent(csrf))
    }
    return config
  }

  if (!headers.has("Authorization")) {
    if (authService.isRefreshInProgress()) {
      await authService.waitForRefresh()
    }
    const tokens = tokenStorage.get()
    if (tokens?.accessToken) {
      headers.set("Authorization", `Bearer ${tokens.accessToken}`)
    }
  }

  return config
})

axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined
    const status = error.response?.status

    if (!original || status !== 401 || original._retry || isAuthEndpoint(original.url ?? "")) {
      throw normalizeError(error)
    }

    original._retry = true

    try {
      await authService.refreshToken()
    } catch {
      await authService.logout()
      throw normalizeError(error)
    }

    const tokens = tokenStorage.get()
    if (tokens?.accessToken && original.headers) {
      original.headers.set("Authorization", `Bearer ${tokens.accessToken}`)
    }

    return axiosClient.request(original as AxiosRequestConfig)
  }
)

function normalizeError(error: AxiosError): ApiError | AxiosError {
  const status = error.response?.status
  if (!status) return error

  const data = error.response?.data as
    | { detail?: unknown; [key: string]: unknown }
    | undefined
  const detail =
    typeof data?.detail === "string" && data.detail.trim() !== ""
      ? data.detail
      : formatFieldErrors(data) || error.response?.statusText || error.message

  return new ApiError(status, detail)
}

function formatFieldErrors(
  data: { detail?: unknown; [key: string]: unknown } | undefined
): string | undefined {
  if (!data || Array.isArray(data)) return undefined

  const messages = Object.entries(data)
    .filter(([key]) => key !== "detail")
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.join(" ")}`
      }
      if (typeof value === "string") {
        return `${key}: ${value}`
      }
      return null
    })
    .filter((message): message is string => Boolean(message))

  return messages.length > 0 ? messages.join(" ") : undefined
}
