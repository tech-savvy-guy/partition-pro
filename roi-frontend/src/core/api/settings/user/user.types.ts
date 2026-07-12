export type BackendUser = {
  id: string;
  email: string;
  username: string;
  name: string;
  password: string;
  role_id: string;
  tenant_id: string;
  designation: string;
  company: string;
  created_by: string;
  role: string;
  is_active?: boolean;
  is_deleted?: boolean;
};

export type GetUsersResponse = {
  results: BackendUser[];
};
