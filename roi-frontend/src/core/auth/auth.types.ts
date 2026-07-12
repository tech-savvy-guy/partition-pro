import { Permission } from "../rbac";

export type CaseRole = "Viewer" | "Editor" | "Publisher";

export type CasePermissionContext = {
  caseId:string;
  role: CaseRole;
  permissions: Permission[];
}

// Tokens (frontend canonical model)
export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

// User (frontend canonical model)
export type AuthUser = {
  id?: string;
  email: string;
  username: string;
  name: string;
  password?: string;
  roleId: string;
  tenantId: string;
  company?: string;
  designation?: string;
  createdBy?: string;
  permissions?: Permission[];
  role?: string;
  status?: string;
  activeCase?: CasePermissionContext;
};

// Backend response (raw contract)
export type BackendAuthResponse = {
  success: boolean;
  access: string;
  refresh: string;
  user: BackendUser;
};

export type BackendUser = {
  id: string;
  email: string;
  username: string;
  name: string;
  role_id: string;
  tenant_id: string;
  company?: string;
};

// Auth state (React context)
export type AuthState = {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionExpired: boolean;
};

// Context API
export type LoginOptions = {
  redirectTo?: string;
};

export type AuthContextValue = AuthState & {
  login: (options?: LoginOptions) => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  reloadFromStorage: () => Promise<void>;
};

export type UserForm = {
  name: string;
  email: string;
  role: string;
  designation?: string;
  status: "Active" | "Inactive";
};

export type BackendPermissions = {
  can_manage_admins: boolean;
  can_see_all_requests: boolean;
  can_edit_all_requests: boolean;
};

export type BackendRole = {
  id: string;
  role_name: string;
  permissions: {
    can_manage_admins: boolean;
    can_see_all_requests: boolean;
    can_edit_all_requests: boolean;
    can_create_requests: boolean;
  };
  is_super_user: boolean;
  is_super_admin: boolean;
};

export type BackendRolesResponse = {
  roles: BackendRole[];
};
