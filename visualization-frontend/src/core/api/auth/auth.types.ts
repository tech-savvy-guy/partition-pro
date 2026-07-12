import type { CurrentUser } from "@/core/api/user/user.types"

export type AuthResponse = {
  access_token: string
  token_type: "Bearer"
  expires_in: number
  user: CurrentUser
}
