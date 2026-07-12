import * as React from "react"
import { useMsal } from "@azure/msal-react"

import { authService } from "@/core/auth/authService"
import type { AuthContextValue, AuthState } from "@/core/auth/auth.types"

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

function readState(isLoading: boolean): AuthState {
  return {
    user: authService.getUser(),
    isAuthenticated: authService.isAuthenticated(),
    isLoading,
    error: null,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { accounts } = useMsal()
  const [isLoading, setIsLoading] = React.useState(true)
  const [authVersion, bumpAuthVersion] = React.useReducer((n: number) => n + 1, 0)

  React.useEffect(() => {
    const unsubscribe = authService.subscribe(bumpAuthVersion)
    return unsubscribe
  }, [])

  React.useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    authService
      .bootstrap()
      .catch(() => {
        // bootstrap swallows expected auth failures; only true exceptions land here.
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [accounts.length])

  const login = React.useCallback(() => {
    authService.loginWithMsal()
  }, [])

  const logout = React.useCallback(async () => {
    await authService.logout()
  }, [])

  const refresh = React.useCallback(async () => {
    await authService.refreshToken()
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => {
      void authVersion

      return {
        ...readState(isLoading),
        login,
        logout,
        refresh,
      }
    },
    [authVersion, isLoading, login, logout, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}
