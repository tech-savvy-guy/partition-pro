import * as React from "react";
import { Tag, PrimaryButton } from "@bain/design-system";
import { Table } from "@/components/table/Table";
import "@/components/table/Table.css";
import ActionsMenu from "@/components/ActionsMenu";
import UserModal from "./UserModal";
import { AuthUser, UserForm } from "@/core/auth/auth.types";
import { UserApi } from "@/core/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/authContext";
import { useUI } from "@/core/ui/ui.context";
import SearchInput from "@/components/SearchInput";
import ViewUserModal from "@/components/ViewUserModal";
import { authService } from "@/core/auth/authService";
import { useStandardColumns } from "@/components/table/useStandardColumns";
import SettingsHeader from "./SettingsHeader";

type CreateUserPayload = {
  name: string;
  email: string;
  username: string;
  role_id: string;
  tenant_id: string;
  password: string;
  designation?: string;
};

type TagType = "green" | "red" | "gray";
export type UserStatus = "Active" | "Inactive";

const statusToTagType = (s: UserStatus): TagType =>
  s === "Active" ? "green" : "gray";

const toUserForm = (user: AuthUser): UserForm => ({
  name: user.name,
  email: user.email,
  role: user.roleId ?? user.role ?? "",
  designation: user.designation,
  status: user.status === "Inactive" ? "Inactive" : "Active",
});

export default function Settings() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { showConfirm, showToast } = useUI();
  const queryClient = useQueryClient();

  const isCurrentUser = React.useCallback(
    (row: AuthUser) => {
      if (!user) return false;
      if (user.id && row.id) return user.id === row.id;
      return user.email.toLowerCase() === row.email.toLowerCase();
    },
    [user],
  );

  const {
    data: users = [],
    isLoading: isUsersLoading,
  } = useQuery({
    queryKey: ["users"],
    queryFn: UserApi.getAll,
    enabled:
      !isLoading && isAuthenticated && !authService.isRefreshInProgress(),
  });

  const [search, setSearch] = React.useState("");

  const filteredUsers = React.useMemo(() => {
    if (!search) return users;

    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.role ?? "").toLowerCase().includes(q) ||
        (u.designation ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(
    null,
  );
  const [selectedUserForm, setSelectedUserForm] = React.useState<
    UserForm | undefined
  >(undefined);

  const [viewingUser, setViewingUser] = React.useState<AuthUser | null>(null);

  const handleCreate = () => {
    setMode("create");
    setSelectedUserId(null);
    setSelectedUserForm(undefined);
    setOpen(true);
  };

  const handleEdit = (row: AuthUser) => {
    if (isCurrentUser(row)) {
      showToast({
        variant: "warning",
        message: "You cannot edit your own account from this page.",
        duration: 4000,
      });
      return;
    }

    setMode("edit");
    setSelectedUserId(row.id!);
    setSelectedUserForm(toUserForm(row));
    setOpen(true);
  };

  const createUserMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => UserApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      showToast({
        variant: "success",
        message: "User created successfully",
        duration: 4000,
      });
    },
    onError: (err: any) => {
      showToast({
        variant: "error",
        message:
          err?.response?.data?.detail ??
          "Failed to create user. Please try again.",
        duration: 5000,
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateUserPayload }) =>
      UserApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      showToast({
        variant: "success",
        message: "User updated successfully",
        duration: 4000,
      });
    },
    onError: () => {
      showToast({
        variant: "error",
        message: "Failed to update user",
        duration: 5000,
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => UserApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      showToast({
        variant: "success",
        message: "User deleted successfully",
        duration: 4000,
      });
    },
    onError: () => {
      showToast({
        variant: "error",
        message: "Failed to delete user",
        duration: 5000,
      });
    },
  });

  const handleSubmit = (form: UserForm) => {
    if (!user?.tenantId) return;

    const payload: CreateUserPayload = {
      name: form.name,
      email: form.email,
      username: form.email,
      role_id: form.role,
      tenant_id: user.tenantId,
      password: "Temp@123",
      designation: form.designation,
    };

    if (mode === "create") {
      createUserMutation.mutate(payload);
    } else if (selectedUserId) {
      updateUserMutation.mutate({
        id: selectedUserId,
        payload,
      });
    }
  };

  const isSubmittingUser =
    createUserMutation.isPending || updateUserMutation.isPending;

  const handleDeleteUser = (row: AuthUser) => {
    if (isCurrentUser(row)) {
      showToast({
        variant: "warning",
        message: "You cannot delete your own account.",
        duration: 4000,
      });
      return;
    }

    showConfirm({
      title: "Delete user",
      message: `Are you sure you want to delete user "${row.name}"? This action cannot be undone.`,
      destructive: true,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        deleteUserMutation.mutate(row.id!);
      },
    });
  };

  const statusBody = (u: AuthUser) => (
    <Tag
      type={statusToTagType(u.status === "Inactive" ? "Inactive" : "Active")}
      className="whitespace-nowrap inline-block"
    >
      {u.status ?? "Active"}
    </Tag>
  );

  const actionBodyTemplate = (row: AuthUser) => (
    <ActionsMenu
      entity="user"
      onView={() => setViewingUser(row)}
      onEdit={isCurrentUser(row) ? undefined : () => handleEdit(row)}
      onDelete={isCurrentUser(row) ? undefined : () => handleDeleteUser(row)}
    />
  );

  const renderColumns = useStandardColumns<AuthUser>();

  const columns = React.useMemo(
    () =>
      renderColumns([
        { field: "name", header: "Name", sortable: true },
        { field: "email", header: "Email", sortable: true },
        { field: "role", header: "Role", sortable: true },
        { field: "designation", header: "Designation", sortable: true },
        {
          field: "status",
          header: "Status",
          kind: "status",
          body: statusBody,
          sortable: true,
        },
        {
          header: "Actions",
          kind: "details",
          body: actionBodyTemplate,
        },
      ]),
    [renderColumns, statusBody, actionBodyTemplate],
  );

  const tableHeader = (
    <div className="flex items-center justify-between px-0 py-2">
      <SearchInput
        value={search}
        onChange={setSearch}
        width={460}
        placeholder="Search users"
      />

      <PrimaryButton
        variant="primary"
        radius="sm"
        className="flex items-center gap-2"
        onClick={handleCreate}
      >
        <span>Create new user</span>
        <span aria-hidden className="text-xl leading-none">
          +
        </span>
      </PrimaryButton>
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <SettingsHeader />

      <div className="px-6 sm:px-8 pb-16">
        <div className="w-full">
          {/* Content header with accent */}
          <div className="mb-6 flex items-baseline gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
            <span className="text-sm text-gray-500 font-medium">
              {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Main table card with improved styling */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
            {/* Table header area */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-b from-gray-50/50 to-white">
              {tableHeader}
            </div>

            <Table<AuthUser[]>
              value={filteredUsers}
              dataKey="id"
              showGridlines={false}
              paginator
              rows={10}
              paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
              currentPageReportTemplate="Showing {first} to {last} of {totalRecords} users"
              responsiveLayout="scroll"
              emptyMessage={
                isUsersLoading
                  ? "Please wait, users are loading..."
                  : "No users found."
              }
              className="app-table rounded-md cases-header-grey cases-paginator-right"
            >
              {columns}
            </Table>

            {/* Empty state message when not loading and no users */}
            {!isUsersLoading && filteredUsers.length === 0 && !search && (
              <div className="px-6 py-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-3">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 7a4 4 0 11-8 0 4 4 0 018 0zM6 17c-1.657 0-3 .895-3 2v2h4v-2c0-.338.134-.646.354-.914M18 14h-6"
                    />
                  </svg>
                </div>
                <p className="text-gray-600 text-sm font-medium">No users yet</p>
                <p className="text-gray-500 text-xs mt-1">
                  Create your first user to get started
                </p>
              </div>
            )}

            {/* No results from search */}
            {!isUsersLoading && filteredUsers.length === 0 && search && (
              <div className="px-6 py-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-3">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <p className="text-gray-600 text-sm font-medium">No matches</p>
                <p className="text-gray-500 text-xs mt-1">
                  Try adjusting your search
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <UserModal
        mode={mode}
        open={open}
        onClose={() => setOpen(false)}
        user={selectedUserForm}
        onSubmit={handleSubmit}
        isSubmitting={isSubmittingUser}
      />

      <ViewUserModal
        open={!!viewingUser}
        onClose={() => setViewingUser(null)}
        data={viewingUser}
      />
    </div>
  );
}

