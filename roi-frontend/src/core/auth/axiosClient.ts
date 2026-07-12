import axios from "axios";
import { authService } from "@/core/auth/authService";
import { env } from "@/core/config";

const API_BASE_URL = env.apiBaseUrl || "/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// REQUEST INTERCEPTOR
apiClient.interceptors.request.use(async (config: any) => {
  const url = config.url ?? "";

  const isAuthEndpoint =
    url.includes("/login") || url.includes("/token/refresh");

  // WAIT if refresh is running
  if (!isAuthEndpoint && authService.isRefreshInProgress()) {
    await authService.refreshToken();
  }

  if (!isAuthEndpoint) {
    const tokens = authService.getTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
  }

  return config;
});

// RESPONSE INTERCEPTOR
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const hadAuthHeader =
      originalRequest.headers?.Authorization ||
      originalRequest.headers?.authorization;

    const isAuthEndpoint =
      originalRequest.url?.includes("/login") ||
      originalRequest.url?.includes("/token/refresh");

    // Only attempt refresh when:
    // 1. 401 response
    // 2. Request had Authorization header
    // 3. Not an auth endpoint
    // 4. Request has not already been retried
    if (
      error.response?.status === 401 &&
      hadAuthHeader &&
      !isAuthEndpoint &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        await authService.refreshToken();

        const newToken = authService.getTokens()?.accessToken;
        if (!newToken) {
          throw new Error("Refresh succeeded but token missing");
        }

        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${newToken}`,
        };

        return apiClient.request(originalRequest);
      } catch (err) {
        await authService.logout();
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);
