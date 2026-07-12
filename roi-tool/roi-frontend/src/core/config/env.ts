export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
  authClientId: import.meta.env.VITE_AUTH_CLIENT_ID ?? "",
  authTenantId: import.meta.env.VITE_AUTH_TENANT_ID ?? "",
  authRedirectUri: import.meta.env.VITE_AUTH_REDIRECT_URI ?? "",
  authLogoutRedirectUri: import.meta.env.VITE_AUTH_LOGOUT_REDIRECT_URI ?? "",
  appEnv: import.meta.env.MODE ?? "development",
  useEasyAuth: import.meta.env.VITE_USE_EASY_AUTH,
};
