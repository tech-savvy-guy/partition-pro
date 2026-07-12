import { InteractionRequiredAuthError } from "@azure/msal-browser"

import { AuthApi, type AuthResponse, type CurrentUser } from "@/core/api"
import { createTokenRequest, loginRequest } from "@/core/config"
import { msalInstance } from "@/core/auth/msalInstance"
import { queryClient } from "@/core/auth/queryClient"
import { tokenStorage } from "@/core/auth/tokenStorage"

type Listener = () => void

const REFRESH_SKEW_SECONDS = 60

class AuthService {
  private user: CurrentUser | null = null
  private refreshPromise: Promise<AuthResponse> | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<Listener>()
  private bootstrapPromise: Promise<void> | null = null

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getUser(): CurrentUser | null {
    return this.user
  }

  isAuthenticated(): boolean {
    return this.user !== null && tokenStorage.get() !== null
  }

  isRefreshInProgress(): boolean {
    return this.refreshPromise !== null
  }

  async waitForRefresh(): Promise<void> {
    if (this.refreshPromise) {
      try {
        await this.refreshPromise
      } catch {
        // Caller will see the failure when it retries the original request.
      }
    }
  }

  async bootstrap(): Promise<void> {
    if (this.isAuthenticated()) return
    if (this.bootstrapPromise) return this.bootstrapPromise

    this.bootstrapPromise = this.runBootstrap().finally(() => {
      this.bootstrapPromise = null
    })

    return this.bootstrapPromise
  }

  private async runBootstrap(): Promise<void> {
    try {
      const response = await this.refreshToken()
      this.storeAuthResponse(response)
      return
    } catch {
      // Cookie refresh failed — fall through to MSAL exchange path.
    }

    const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0]
    if (!account) {
      return
    }

    if (!msalInstance.getActiveAccount()) {
      msalInstance.setActiveAccount(account)
    }

    try {
      const entra = await msalInstance.acquireTokenSilent(createTokenRequest(account))
      const response = await AuthApi.exchange(entra.accessToken)
      this.storeAuthResponse(response)
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        return
      }
      throw error
    }
  }

  loginWithMsal(): void {
    void msalInstance.loginRedirect(loginRequest)
  }

  refreshToken(): Promise<AuthResponse> {
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = AuthApi.refresh()
      .then((response) => {
        this.storeAuthResponse(response)
        return response
      })
      .finally(() => {
        this.refreshPromise = null
      })

    return this.refreshPromise
  }

  async logout(): Promise<void> {
    const homeUrl = `${window.location.origin}/home`

    try {
      await AuthApi.logout()
    } catch {
      // Continue local cleanup even if the server call fails.
    }

    this.clearLocal()

    const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0]
    if (account) {
      try {
        await msalInstance.logoutRedirect({
          account,
          postLogoutRedirectUri: homeUrl,
        })
      } catch {
        // Ignore — we already cleared local state.
      }
      return
    }

    window.location.assign(homeUrl)
  }

  private storeAuthResponse(response: AuthResponse): void {
    tokenStorage.set(response.access_token, response.expires_in)
    this.user = response.user
    this.scheduleRefresh(response.expires_in)
    this.emit()
  }

  private clearLocal(): void {
    tokenStorage.clear()
    this.user = null
    this.cancelScheduledRefresh()
    queryClient.clear()
    this.emit()
  }

  private scheduleRefresh(expiresInSeconds: number): void {
    this.cancelScheduledRefresh()
    const delayMs = Math.max((expiresInSeconds - REFRESH_SKEW_SECONDS) * 1000, 5_000)
    this.refreshTimer = setTimeout(() => {
      void this.refreshToken().catch(() => {
        this.clearLocal()
      })
    }, delayMs)
  }

  private cancelScheduledRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export const authService = new AuthService()
