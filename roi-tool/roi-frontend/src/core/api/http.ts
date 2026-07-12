import { apiClient } from "@/core/auth/axiosClient";

export const http = {
  get: async <T>(url: string, params?: any): Promise<T> => {
    const response = await apiClient.get(url, { params });
    return response.data as T;
  },

  post: async <T>(url: string, body?: any): Promise<T> => {
    const response = await apiClient.post(url, body);
    return response.data as T;
  },

  put: async <T>(url: string, body?: any): Promise<T> => {
    const response = await apiClient.put(url, body);
    return response.data as T;
  },

  patch: async <T>(url: string, body?: any): Promise<T> => {
    const response = await apiClient.patch(url, body);
    return response.data as T;
  },

  delete: async <T>(url: string, body?: any): Promise<T> => {
    const response = await apiClient.delete(
      url,
      body ? { data: body } : undefined
    );
    return response.data as T;
  },

  getRaw: async (url: string): Promise<string> => {
    const response = await apiClient.get(url, {
      responseType: "text",
    });
    return response.data;
  },
};
