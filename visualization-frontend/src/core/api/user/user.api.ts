import { http } from "@/core/api/http"
import { Endpoints } from "@/core/config"
import type { AssignableUser, CurrentUser } from "@/core/api/user/user.types"

export const UserApi = {
  getCurrentUser: () => http.get<CurrentUser>(Endpoints.users.me),
  listUsers: () => http.get<AssignableUser[]>(Endpoints.users.list),
}
