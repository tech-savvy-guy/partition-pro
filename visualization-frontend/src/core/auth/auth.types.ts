import type { CurrentUser } from "@/core/api/user/user.types"

export type AuthUser = CurrentUser

export type AuthTokens = {
  accessToken: string
  expiresAt: number
}

export type AuthState = {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export type AuthContextValue = AuthState & {
  login: () => void
  logout: () => Promise<void>
  refresh: () => Promise<void>
}
