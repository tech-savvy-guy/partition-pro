import * as React from "react";
import { authService } from "@/core/auth/authService";
import type { AuthContextValue, AuthState, LoginOptions } from "./auth.types";

const AuthContext = React.createContext<AuthContextValue | undefined>(
  undefined
);

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  sessionExpired: false,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = React.useState<AuthState>(initialState);
  const refreshTimerRef = React.useRef<number | null>(null);

  // Refresh token helpers

  const clearRefreshTimer = React.useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleRefresh = React.useCallback(
    (expiresAt?: number | null) => {
      clearRefreshTimer();
      if (!expiresAt) return;

      const now = Date.now();
      const msUntilExpiry = expiresAt - now;
      if (msUntilExpiry <= 0) return;

      // Refresh 1 minute before expiry (minimum 5s)
      const msUntilRefresh = Math.max(msUntilExpiry - 60_000, 5_000);

      refreshTimerRef.current = window.setTimeout(async () => {
        try {
          await authService.refreshToken();

          const tokens = authService.getTokens();
          const user = authService.getUser();

          setState((prev) => ({
            ...prev,
            user,
            tokens,
            isAuthenticated: !!tokens && authService.isAuthenticated(),
            sessionExpired: false,
          }));

          if (tokens?.expiresAt) {
            scheduleRefresh(tokens.expiresAt);
          }
        } catch (err) {
          console.warn(
            "Scheduled refresh failed, will retry on next request",
            err
          );
        }
      }, msUntilRefresh) as unknown as number;
    },
    [clearRefreshTimer]
  );

  // Bootstrap auth (single entry point)
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await authService.bootstrap();

        if (!mounted) return;

        const tokens = authService.getTokens();
        let user = authService.getUser();
        if (tokens && !user) {
          await Promise.resolve();
          user = authService.getUser();
        }

        setState({
          user,
          tokens,
          isAuthenticated: !!tokens && authService.isAuthenticated(),
          isLoading: false,
          sessionExpired: false,
        });

        if (tokens?.expiresAt) {
          scheduleRefresh(tokens.expiresAt);
        }
      } catch {
        if (!mounted) return;

        setState({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          sessionExpired: false,
        });
      }
    })();

    return () => {
      mounted = false;
      clearRefreshTimer();
    };
  }, [scheduleRefresh, clearRefreshTimer]);

  // Public API

  const reloadFromStorage = React.useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      await authService.bootstrap();

      const tokens = authService.getTokens();
      const user = authService.getUser();

      setState({
        user,
        tokens,
        isAuthenticated: !!tokens && authService.isAuthenticated(),
        isLoading: false,
        sessionExpired: false,
      });

      if (tokens?.expiresAt) {
        scheduleRefresh(tokens.expiresAt);
      }
    } catch {
      setState({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
        sessionExpired: true,
      });
    }
  }, [scheduleRefresh]);

  const login = React.useCallback((_options?: LoginOptions) => {
    // Easy Auth (Okta) handles redirect
    if (import.meta.env.VITE_USE_EASY_AUTH === "true") {
      window.location.href = "/.auth/login/okta";
    }
  }, []);

  const logout = React.useCallback(async () => {
    clearRefreshTimer();
    await authService.logout();
    setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      sessionExpired: false,
    });
  }, [clearRefreshTimer]);

  const refreshToken = React.useCallback(async () => {
    await authService.refreshToken();

    const tokens = authService.getTokens();
    const user = authService.getUser();

    setState((prev) => ({
      ...prev,
      user,
      tokens,
      isAuthenticated: !!tokens && authService.isAuthenticated(),
      sessionExpired: false,
    }));

    if (tokens?.expiresAt) {
      scheduleRefresh(tokens.expiresAt);
    }
  }, [scheduleRefresh]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshToken,
    reloadFromStorage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
