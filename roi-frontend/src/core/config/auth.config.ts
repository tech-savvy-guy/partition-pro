import { env } from "@/core/config/env";

export const AuthConfig = {
  auth: {
    clientId: env.authClientId,
    authority: `https://login.microsoftonline.com/${env.authTenantId}`,
    redirectUri: env.authRedirectUri,
    postLogoutRedirectUri: env.authLogoutRedirectUri,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};
