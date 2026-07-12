import { http } from "@/core/api/http"
import { Endpoints } from "@/core/config"
import type { AuthResponse } from "@/core/api/auth/auth.types"

export const AuthApi = {
  exchange: (entraAccessToken: string) =>
    http.post<AuthResponse>(Endpoints.auth.exchange, undefined, {
      headers: {
        Authorization: `Bearer ${entraAccessToken}`,
      },
    }),
  refresh: () => http.post<AuthResponse>(Endpoints.auth.refresh),
  logout: () => http.post<void>(Endpoints.auth.logout),
}
