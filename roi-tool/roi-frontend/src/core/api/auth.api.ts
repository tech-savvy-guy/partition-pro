import { http } from "./http";
import { Endpoints } from "@/core/config";
import type { BackendAuthResponse } from "@/core/auth/auth.types";

export const AuthApi = {
  loginWithEmail: (email: string) =>
    http.post<BackendAuthResponse>(Endpoints.auth.login, { email }),

  refresh: (refreshToken: string) =>
    http.post<BackendAuthResponse>(Endpoints.auth.refresh, { refresh: refreshToken }),

  logout: (refreshToken: string) =>
    http.post<void>(Endpoints.auth.logout, { refresh: refreshToken }),
};
