import { tokenStorage } from "./tokenStorage";
import { getGlobalPermissions, mapBackendPermissions } from "@/core/rbac";
import type { AuthTokens, AuthUser, BackendAuthResponse } from "./auth.types";
import { AuthApi } from "@/core/api";
import { jwtDecode } from "jwt-decode";
import { queryClient } from "@/core/auth/queryClient";
import { RolesApi } from "../api/roles.api";

type JwtPayload = {
  exp: number;
};

class AuthService {
  private tokens: AuthTokens | null = null;
  private user: AuthUser | null = null;
  private isLoggingOut = false;

  //Bootstrap
  bootstrapFromStorage() {
    const { tokens, user } = tokenStorage.load();
    this.tokens = tokens;
    this.user = user;
  }

  private hasRefreshToken(): boolean {
    return !!this.tokens?.refreshToken;
  }

  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  async bootstrap(): Promise<void> {
    this.bootstrapFromStorage();

    // No tokens at all → resolve identity
    if (!this.tokens) {
      const email = await this.getExternalAuthenticatedEmail();
      if (!email) return;
      await this.loginWithEmail(email);
      return;
    }

    // Token exists → refresh proactively if expiring soon
    if (this.shouldRefreshSoon()) {
      try {
        await this.refreshToken();
        return;
      } catch {
        // fall through to re-login
      }
    }

    // Valid access token → reuse session
    if (this.isAuthenticated()) {
      if (this.user && !this.user.permissions) {
        this.user = {
          ...this.user,
          permissions: getGlobalPermissions(this.user),
        };
        tokenStorage.save(this.tokens, this.user!);
      }
      return;
    }

    // Access expired but refresh exists → try refresh
    if (this.hasRefreshToken()) {
      try {
        await this.refreshToken();
        return;
      } catch {
        // fall through
      }
    }

    // Final fallback → resolve identity
    const email = await this.getExternalAuthenticatedEmail();
    if (!email) return;

    await this.loginWithEmail(email);
  }

  getTokens() {
    return this.tokens;
  }

  getUser() {
    return this.user;
  }

  isAuthenticated() {
    return !!this.tokens && this.tokens.expiresAt > Date.now();
  }

  isRefreshInProgress() {
    return this.isRefreshing;
  }

  shouldRefreshSoon(): boolean {
    if (!this.tokens) return false;
    const now = Date.now();
    const buffer = 60_000; // 1 minute
    return this.tokens.expiresAt - now < buffer;
  }

  // Easy Auth (Okta)
  private async getExternalAuthenticatedEmail(): Promise<string | null> {
    if (import.meta.env.VITE_USE_EASY_AUTH !== "true") {
      return import.meta.env.VITE_DEV_USER_EMAIL ?? null;
    }

    const res = await fetch("/.auth/me", { credentials: "include" });
    if (!res.ok) return null;

    const data = await res.json();
    const entry = data?.[0];
    if (!entry?.access_token) return null;

    try {
      const decoded = jwtDecode<{ sub?: string }>(entry.access_token);
      localStorage.setItem("easy_auth_id_token", entry.id_token);
      // Okta puts email in `sub` in your setup
      return decoded.sub ?? null;
    } catch (err) {
      console.error("Failed to decode access token", err);
      return null;
    }
  }

  //Login / Refresh normalization
  private async completeLoginFromBackend(response: BackendAuthResponse) {
    const { access, refresh, user } = response;

    // Decode token expiry
    const decoded = jwtDecode<{ exp: number }>(access);

    const tokens: AuthTokens = {
      accessToken: access,
      refreshToken: refresh,
      expiresAt: decoded.exp * 1000,
    };

    this.tokens = tokens;

    // Fetch roles once
    const rolesResponse = await RolesApi.getAll();

    // Find user role
    const backendRole = rolesResponse.roles.find((r) => r.id === user.role_id);

    if (!backendRole) {
      throw new Error("User role not found");
    }

    // Map backend → frontend permissions
    const permissions = mapBackendPermissions(backendRole.permissions);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,

      roleId: backendRole.id,
      role: backendRole.role_name,

      permissions,

      tenantId: user.tenant_id,
    };
    this.user = authUser;
    tokenStorage.save(tokens, authUser);
  }

  private completeRefresh(response: { access: string; refresh: string }) {
    const { access, refresh } = response;
    const decoded = jwtDecode<{ exp: number }>(access);

    if (!this.user) {
      // If refresh doesn't return user, we must already have one in memory/storage
      throw new Error(
        "Refresh returned tokens but user is missing in AuthService"
      );
    }

    const tokens: AuthTokens = {
      accessToken: access,
      refreshToken: refresh,
      expiresAt: decoded.exp * 1000,
    };

    this.tokens = tokens;
    tokenStorage.save(tokens, this.user);
  }

  async loginWithEmail(email: string): Promise<void> {
    try {
      const response = await AuthApi.loginWithEmail(email);
      await this.completeLoginFromBackend(response);
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.response?.data?.error;

      // User authenticated with Okta but NOT provisioned in app
      if (status === 401 && status === 403) {
        this.tokens = null;
        this.user = null;
        tokenStorage.clear();

        // Redirect to no-access page
        window.location.replace("/no-access");
        return;
      }

      throw err;
    }
  }

  async refreshToken(): Promise<void> {
    if (!this.tokens?.refreshToken) throw new Error("No refresh token");

    if (this.isRefreshing && this.refreshPromise) return this.refreshPromise;
    this.isRefreshing = true;

    this.refreshPromise = (async () => {
      try {
        const response = await AuthApi.refresh(this.tokens!.refreshToken);

        // IMPORTANT: do NOT assume refresh returns user
        if ("user" in response) {
          this.completeLoginFromBackend(response as any);
        } else {
          this.completeRefresh(response as any);
        }

        queryClient.invalidateQueries();
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // Logout
  async logout(): Promise<void> {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;

    try {
      const refreshToken = this.tokens?.refreshToken;

      if (refreshToken) {
        await AuthApi.logout(refreshToken);
      }
    } catch (err) {
      // Ignore backend failures completely
    } finally {
      // Always clear frontend state
      this.tokens = null;
      this.user = null;
      tokenStorage.clear();

      // Redirect to Easy Auth logout if enabled
      if (import.meta.env.VITE_USE_EASY_AUTH === "true") {
        let idToken = localStorage.getItem("easy_auth_id_token") ?? "";

        try {
          // Get the id_token fresh from /.auth/me instead of localStorage
          const response = await fetch("/.auth/me");

          if (response.ok) {
            const authMe = await response.json();
            const oktaProvider = authMe.find(
              (p: { provider_name: string }) => p.provider_name === "okta"
            );

            idToken = oktaProvider?.id_token ?? idToken;
          }
        } catch (err) {
          // Fall back to the cached token so logout redirect remains reliable
        }
        // Use org-level logout URL (no custom auth server ID)
        // This matches iss: https://bainco.okta.com in the token
        window.location.href =
          "https://bainco.okta.com/oauth2/v1/logout" +
          `?id_token_hint=${encodeURIComponent(idToken)}` +
          `&post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`;
      }
    }
  }
}

export const authService = new AuthService();
