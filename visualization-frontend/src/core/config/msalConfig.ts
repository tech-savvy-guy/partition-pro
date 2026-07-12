import {
  BrowserCacheLocation,
  type AccountInfo,
  type Configuration,
  type RedirectRequest,
  type SilentRequest,
} from "@azure/msal-browser"

import { env } from "@/core/config/env"

export const msalConfig: Configuration = {
  auth: {
    clientId: env.clientId,
    authority: `https://login.microsoftonline.com/${env.tenantId}`,
    redirectUri: env.redirectUri,
    postLogoutRedirectUri: env.redirectUri,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.SessionStorage,
  },
}

export const loginRequest: RedirectRequest = {
  scopes: [env.apiScope],
}

export function createTokenRequest(account: AccountInfo): SilentRequest {
  return {
    account,
    scopes: [env.apiScope],
  }
}
