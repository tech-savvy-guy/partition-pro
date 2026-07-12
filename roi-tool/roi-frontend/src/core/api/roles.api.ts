import { http } from "@/core/api/http";
import { BackendRolesResponse } from "@/core/auth/auth.types";
import { Endpoints } from "../config";

export const RolesApi = {
  getAll: () => http.get<BackendRolesResponse>(Endpoints.roles.root),
};
