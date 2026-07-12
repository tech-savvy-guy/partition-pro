import type { AuthTokens, AuthUser } from "./auth.types";

const ACCESS_KEY = "auth_access";
const REFRESH_KEY = "auth_refresh";

export const tokenStorage = {
  save(tokens: AuthTokens, user: AuthUser) {
    sessionStorage.setItem(
      ACCESS_KEY,
      JSON.stringify({
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        user,
      })
    );

    localStorage.setItem(
      REFRESH_KEY,
      JSON.stringify({
        refreshToken: tokens.refreshToken,
      })
    );
  },

  load(): { tokens: AuthTokens | null; user: AuthUser | null } {
    try {
      const accessRaw = sessionStorage.getItem(ACCESS_KEY);
      const refreshRaw = localStorage.getItem(REFRESH_KEY);

      if (!accessRaw || !refreshRaw) {
        return { tokens: null, user: null };
      }

      const access = JSON.parse(accessRaw);
      const refresh = JSON.parse(refreshRaw);

      return {
        tokens: {
          accessToken: access.accessToken,
          expiresAt: access.expiresAt,
          refreshToken: refresh.refreshToken,
        },
        user: access.user,
      };
    } catch {
      this.clear();
      return { tokens: null, user: null };
    }
  },

  clear() {
    sessionStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
