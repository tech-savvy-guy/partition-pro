import { AuthUser } from "@/core/auth/auth.types";
import { GetUsersResponse } from "./user.types";
import { Endpoints } from "@/core/config";
import { http } from "@/core/api/http";
import { RolesApi } from "@/core/api/roles.api";

export const UserApi = {
  getAll: async (): Promise<AuthUser[]> => {
    // Fetch users and roles in parallel, then map role_id -> role_name
    const [usersRes, rolesRes] = await Promise.all([
      http.get<GetUsersResponse>(Endpoints.users.list),
      RolesApi.getAll(),
    ]);

    const roleMap = new Map<string, string>();
    (rolesRes.roles || []).forEach((r) => roleMap.set(r.id, r.role_name));

    return usersRes.results.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      name: u.name,
      roleId: u.role_id,
      tenantId: u.tenant_id,
      company: u.company,
      designation: u.designation,
      createdBy: u.created_by,
      // Map backend role_id to friendly role name when available
      role: roleMap.get(u.role_id) || u.role || u.role_id,
      // Derive status from backend flags if present
      status: u.is_deleted || u.is_active === false ? "Inactive" : "Active",
    }));
  },

  getById: (id: string) => http.get<AuthUser>(Endpoints.users.byId(id)),

  create: (payload: Partial<AuthUser>) =>
    http.post<AuthUser>(Endpoints.users.create, payload),

  update: (id: string, payload: Partial<AuthUser>) =>
    http.put<AuthUser>(Endpoints.users.update(id), payload),

  delete: (id: string) => http.delete<void>(Endpoints.users.delete(id)),
};
