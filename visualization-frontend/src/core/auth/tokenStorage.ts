import type { AuthTokens } from "@/core/auth/auth.types"

let tokens: AuthTokens | null = null

export const tokenStorage = {
  get(): AuthTokens | null {
    return tokens
  },
  set(accessToken: string, expiresInSeconds: number): void {
    tokens = {
      accessToken,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    }
  },
  clear(): void {
    tokens = null
  },
  isExpired(skewSeconds = 30): boolean {
    if (!tokens) return true
    return Date.now() >= tokens.expiresAt - skewSeconds * 1000
  },
}
