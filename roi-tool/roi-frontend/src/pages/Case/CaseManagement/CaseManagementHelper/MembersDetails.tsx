import * as React from "react";
import {
  TextInput,
  Button,
  Tag,
  Select,
  SelectItem,
} from "@bain/design-system";
import CaseManagementDialog from "./CaseManagementDialog";
import type { Member, MemberRole } from "../CaseManagement";
import { useParams } from "react-router-dom";
import { CaseApi, UserApi } from "@/core/api";
import { useUI } from "@/core/ui";
import { useCasePermissions } from "@/core/case/CasePermissionContext";
import { Permission } from "@/core/rbac";

type Props = {
  mode: "create" | "edit";
  members: Member[];
  onMembersChange: (next: Member[]) => void;
};

type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  is_active?: boolean;
};

export default function MembersDetails({
  mode,
  members,
  onMembersChange,
  caseId,
}: Props & { caseId?: string | null }) {
  const params = useParams<{ id: string }>();
  const resolvedCaseId = caseId ?? params.id;

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [openSuggest, setOpenSuggest] = React.useState(false);

  const [directoryUsers, setDirectoryUsers] = React.useState<DirectoryUser[]>(
    []
  );
  const [loadingDialog, setLoadingDialog] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [roleError, setRoleError] = React.useState<string | null>(null);

  const [initialMembers, setInitialMembers] = React.useState<Member[]>([]);
  const [pending, setPending] = React.useState<Member[]>([]);

  const { showToast } = useUI();
  const { permissions, hasCaseContext } = useCasePermissions();
  const canEditMembers =
    !hasCaseContext || permissions.includes(Permission.AddCaseMembers);

  const uiToBackendRole = (
    role: MemberRole
  ): "PUBLISHER" | "EDITOR" | "VIEWER" => {
    if (role === "Publisher") return "PUBLISHER";
    if (role === "Editor") return "EDITOR";
    return "VIEWER";
  };

  const backendToUiRole = (role: string): MemberRole => {
    const r = String(role || "").toUpperCase();
    if (r === "PUBLISHER") return "Publisher";
    if (r === "EDITOR") return "Editor";
    return "Viewer";
  };

  React.useEffect(() => {
    if (!resolvedCaseId) return;

    const loadMembers = async () => {
      try {
        const res = await CaseApi.getAssignments(resolvedCaseId);

        const currentMembers: Member[] = (res.assignments ?? []).map(
          (a: any) => ({
            userId: a.user_id,
            name: a.name,
            email: a.email,
            role: backendToUiRole(a.role),
          })
        );

        onMembersChange(currentMembers);
        setInitialMembers(currentMembers);
        setPending(currentMembers);
      } catch (e) {
        console.error("Failed to load members", e);
      }
    };

    loadMembers();
  }, [resolvedCaseId]);

  const suggestions = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    return directoryUsers
      .filter((u) => {
        const alreadyAdded = pending.some((m) => m.userId === u.id);
        if (alreadyAdded) return false;

        return (
          u.name.toLowerCase().startsWith(q) ||
          u.email.toLowerCase().startsWith(q)
        );
      })
      .slice(0, 8);
  }, [search, directoryUsers, pending]);

  const addPending = (u: DirectoryUser) => {
    if (pending.some((m) => m.userId === u.id)) return;

    setPending((prev) => [
      ...prev,
      { userId: u.id, name: u.name, email: u.email, role: "Viewer" },
    ]);

    setSearch("");
    setOpenSuggest(false);
  };

  const changePendingRole = (userId: string, role: MemberRole) => {
    setPending((prev) => {
      if (role === "Publisher") {
        const existingPublisher = prev.find(
          (m) => m.role === "Publisher" && m.userId !== userId
        );
        if (existingPublisher) {
          setRoleError("Only one publisher can publish a case.");
          return prev;
        }
      }

      setRoleError(null);
      return prev.map((m) => (m.userId === userId ? { ...m, role } : m));
    });
  };

  const removePending = (userId: string) => {
    setPending((prev) => prev.filter((m) => m.userId !== userId));
  };

  // Optional: immediate backend removal from chip close (recommended)
  const removeMemberChip = async (userId: string) => {
    const prev = members;
    const next = members.filter((m) => m.userId !== userId);

    onMembersChange(next);

    if (!caseId) return;

    try {
      await CaseApi.removeUser(caseId, userId);
      showToast({
        variant: "success",
        message: "Member removed successfully.",
        duration: 4000,
      });
    } catch (e) {
      console.error(e);
      onMembersChange(prev);
      showToast({
        variant: "error",
        message: "Failed to remove member. Please try again.",
        duration: 5000,
      });
    }
  };

  const openDialog = async () => {
    if (!resolvedCaseId) return;

    setDialogOpen(true);
    setApiError(null);
    setRoleError(null);
    setSearch("");
    setOpenSuggest(false);
    setLoadingDialog(true);

    try {
      const [res, users] = await Promise.all([
        CaseApi.getAssignments(resolvedCaseId),
        UserApi.getAll(),
      ]);

      const currentMembers: Member[] = (res.assignments ?? []).map(
        (a: any) => ({
          userId: a.user_id,
          name: a.name,
          email: a.email,
          role: backendToUiRole(a.role),
        })
      );

      // Convert AuthUser[] -> DirectoryUser[]
      const activeDirectoryUsers: DirectoryUser[] = (users ?? [])
        .filter((u: any) => {
          // If your AuthUser has "status", keep it.
          // If later you add isActive/is_active, this still works.
          if (u?.isActive === false) return false;
          if (u?.is_active === false) return false;
          if (String(u?.status || "").toLowerCase() === "inactive")
            return false;
          return true;
        })
        .map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.name || u.username || u.email,
          is_active: true,
        }));

      onMembersChange(currentMembers);
      setInitialMembers(currentMembers);
      setPending(currentMembers);
      setDirectoryUsers(activeDirectoryUsers);
    } catch (e) {
      console.error(e);
      setApiError("Failed to load members/users.");
      setDirectoryUsers([]);
      setInitialMembers(members);
      setPending(members);
    } finally {
      setLoadingDialog(false);
    }
  };

  const confirmAddMembers = async () => {
    if (!caseId) return;
    if (roleError) return;

    setSaving(true);
    setApiError(null);

    try {
      const initialById = new Map(initialMembers.map((m) => [m.userId, m]));
      const pendingById = new Map(pending.map((m) => [m.userId, m]));

      const toRemove = initialMembers.filter((m) => !pendingById.has(m.userId));
      const toUpsert = pending.filter((m) => {
        const orig = initialById.get(m.userId);
        return !orig || orig.role !== m.role;
      });

      await Promise.all([
        ...toUpsert.map((m) =>
          CaseApi.assignUser(caseId, {
            user_id: m.userId,
            role: uiToBackendRole(m.role),
          })
        ),
        ...toRemove.map((m) => CaseApi.removeUser(caseId, m.userId)),
      ]);
      showToast({
        variant: "success",
        message: "Members updated successfully.",
        duration: 4000,
      });
      onMembersChange(pending);
      setInitialMembers(pending);
      setDialogOpen(false);
      setPending([]);
    } catch (e) {
      console.error(e);
      setApiError("Failed to update members. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addedMembers = React.useMemo(
    () =>
      pending.filter((p) => !initialMembers.some((m) => m.userId === p.userId)),
    [pending, initialMembers]
  );

  const removedMembers = React.useMemo(
    () =>
      initialMembers.filter((m) => !pending.some((p) => p.userId === m.userId)),
    [pending, initialMembers]
  );

  const roleChangedMembers = React.useMemo(
    () =>
      pending.filter((p) => {
        const orig = initialMembers.find((m) => m.userId === p.userId);
        return orig && orig.role !== p.role;
      }),
    [pending, initialMembers]
  );

  const primaryLabel = React.useMemo(() => {
    if (saving) return "Saving...";

    const hasAddsOrRemovals =
      addedMembers.length > 0 || removedMembers.length > 0;
    const hasRoleChanges = roleChangedMembers.length > 0;

    if (hasRoleChanges && !hasAddsOrRemovals) return "Update member";
    if (hasRoleChanges && hasAddsOrRemovals) return "Update and Add member";
    return "Add members";
  }, [addedMembers, removedMembers, roleChangedMembers, saving]);

  return (
    <div className="mt-2 rounded-md bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <Tag
              key={m.userId}
              filter={canEditMembers}
              type="gray"
              title="Remove"
              onClose={() => removeMemberChip(m.userId)}
            >
              {m.name}: {m.role}
            </Tag>
          ))}
          {members.length === 0 && (
            <span className="text-[13px] text-gray-500">
              No members added yet.
            </span>
          )}
        </div>

        {canEditMembers && (
          <Button
            kind="primary"
            size="sm"
            onClick={openDialog}
            disabled={!resolvedCaseId}
          >
            Add members
          </Button>
        )}
      </div>

      <CaseManagementDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setPending([]);
          setRoleError(null);
          setApiError(null);
        }}
        title="Add members"
        maxWidthClassName="max-w-[480px]"
      >
        <div className="space-y-4">
          {loadingDialog ? (
            <div className="text-sm text-gray-500">Loading members…</div>
          ) : (
            <>
              <div className="relative">
                <TextInput
                  id="members-search"
                  hideLabel
                  labelText="Search members"
                  placeholder="Type a member's name"
                  value={search}
                  onChange={(e: any) => setSearch(e.target.value)}
                  onFocus={() => setOpenSuggest(true)}
                  onBlur={() => setTimeout(() => setOpenSuggest(false), 150)}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" && suggestions[0]) {
                      e.preventDefault();
                      addPending(suggestions[0]);
                    }
                  }}
                />

                {openSuggest && suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-gray-200 bg-white shadow-sm">
                    {suggestions.map((u) => (
                      <li
                        key={u.id}
                        className="cursor-pointer px-3 py-2 hover:bg-gray-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addPending(u)}
                      >
                        <div className="text-[14px] text-gray-800">
                          {u.name}
                        </div>
                        <div className="text-[12px] text-gray-500">
                          {u.email}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {pending.length > 0 && (
                <div className="space-y-3">
                  {pending.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center gap-3 justify-between"
                    >
                      <span className="text-[14px] text-gray-800 flex-1">
                        {m.name}
                      </span>

                      <div className="w-[140px]">
                        <Select
                          id={`role-${m.userId}`}
                          labelText=""
                          hideLabel
                          value={m.role}
                          onChange={(e: any) =>
                            changePendingRole(
                              m.userId,
                              (e?.target?.value ?? e?.value) as MemberRole
                            )
                          }
                        >
                          <SelectItem value="Publisher" text="Publisher" />
                          <SelectItem value="Editor" text="Editor" />
                          <SelectItem value="Viewer" text="Viewer" />
                        </Select>
                      </div>

                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600"
                        onClick={() => removePending(m.userId)}
                        aria-label={`Remove ${m.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {roleError && (
                <p className="text-[12px] text-red-600">{roleError}</p>
              )}
              {apiError && (
                <p className="text-[12px] text-red-600">{apiError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  kind="secondary"
                  size="sm"
                  onClick={() => {
                    setDialogOpen(false);
                    setPending([]);
                    setRoleError(null);
                    setApiError(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>

                <Button
                  kind="primary"
                  size="sm"
                  disabled={saving || !!roleError || pending.length === 0}
                  onClick={confirmAddMembers}
                >
                  {primaryLabel}
                </Button>
              </div>
            </>
          )}
        </div>
      </CaseManagementDialog>
    </div>
  );
}
