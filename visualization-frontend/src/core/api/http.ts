import type { AxiosRequestConfig } from "axios"

import { axiosClient } from "@/core/auth/axiosClient"

export const http = {
  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await axiosClient.get<T>(url, { params })
    return response.data
  },
  async post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await axiosClient.post<T>(url, body, config)
    return response.data
  },
  async put<T>(url: string, body?: unknown): Promise<T> {
    const response = await axiosClient.put<T>(url, body)
    return response.data
  },
  async patch<T>(url: string, body?: unknown): Promise<T> {
    const response = await axiosClient.patch<T>(url, body)
    return response.data
  },
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await axiosClient.delete<T>(url, config)
    return response.data
  },
}
