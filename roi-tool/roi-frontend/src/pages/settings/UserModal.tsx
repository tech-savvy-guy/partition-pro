import * as React from "react";
import { Dialog } from "primereact/dialog";
import {
  Form,
  TextInput,
  Select,
  SelectItem,
  Button,
  ButtonSet,
} from "@bain/design-system";
import { Renew } from "@carbon/icons-react";
import { UserForm } from "@/core/auth/auth.types";
import { RolesApi } from "@/core/api/roles.api";
import { useQuery } from "@tanstack/react-query";

type UserModalProps = {
  mode: "create" | "edit";
  open: boolean;
  onClose: () => void;
  user?: UserForm;
  onSubmit: (user: UserForm) => void;
  isSubmitting?: boolean;
};

const EMPTY_FORM: UserForm = {
  name: "",
  email: "",
  role: "",
  designation: "",
  status: "Active",
};

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const resolveRoleId = (
  roleValue: string | undefined,
  roles: Array<{ id: string; role_name: string }>,
) => {
  const value = (roleValue ?? "").trim();
  if (!value) return "";

  const byId = roles.find((r) => r.id === value);
  if (byId) return byId.id;

  const byName = roles.find(
    (r) => r.role_name.toLowerCase() === value.toLowerCase(),
  );
  if (byName) return byName.id;

  // Keep original value when roles are not loaded yet.
  return value;
};

export default function UserModal({
  mode,
  open,
  onClose,
  user,
  onSubmit,
  isSubmitting = false,
}: UserModalProps) {
  const [form, setForm] = React.useState<UserForm>(user ?? EMPTY_FORM);
  const [roleTouched, setRoleTouched] = React.useState(false);
  const wasOpenRef = React.useRef(false);

  /**
   * Snapshot initial values for edit-mode dirty check
   */
  const initialRef = React.useRef<UserForm | null>(null);

  const { data = { roles: [] } } = useQuery({
    queryKey: ["roles"],
    queryFn: RolesApi.getAll,
  });

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      const nextRole =
        mode === "create"
          ? data.roles[0]?.id ?? ""
          : resolveRoleId(user?.role, data.roles);

      const next: UserForm = {
        ...(user ?? EMPTY_FORM),
        role: nextRole,
      };

      setForm(next);
      initialRef.current = next;
      setRoleTouched(false);
    }

    wasOpenRef.current = open;
    if (!open) {
      wasOpenRef.current = false;
    }
  }, [open, mode, user, data.roles]);

  React.useEffect(() => {
    if (!open || roleTouched || !data.roles.length) return;

    setForm((prev) => {
      const nextRole =
        mode === "create"
          ? resolveRoleId(prev.role, data.roles) || data.roles[0].id
          : resolveRoleId(prev.role || user?.role, data.roles);

      if (!nextRole || nextRole === prev.role) return prev;

      const next = { ...prev, role: nextRole };
      if (initialRef.current) {
        initialRef.current = { ...initialRef.current, role: nextRole };
      }
      return next;
    });
  }, [open, mode, user?.role, roleTouched, data.roles]);

  const isEdit = mode === "edit";

  const heading =
    mode === "create" ? "Create User" : `Edit User – ${user?.name ?? ""}`;

  /**
   * Required field validation
   */
  const isValid = React.useMemo(() => {
    return (
      form.name.trim().length > 0 &&
      form.email.trim().length > 0 &&
      isValidEmail(form.email) &&
      form.role.trim().length > 0 &&
      form.status.trim().length > 0
    );
  }, [form]);

  /**
   * Dirty check (edit mode only)
   */
  const isDirty = React.useMemo(() => {
    if (!isEdit || !initialRef.current) return true;

    const i = initialRef.current;
    return (
      i.name !== form.name ||
      i.email !== form.email ||
      i.role !== form.role ||
      i.designation !== form.designation ||
      i.status !== form.status ||
      roleTouched
    );
  }, [form, isEdit, roleTouched]);

  /**
   * Disable primary button logic
   */
  const disablePrimary = !isValid || (isEdit && !isDirty) || isSubmitting;

  const handleChange = <K extends keyof UserForm>(
    field: K,
    value: UserForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (disablePrimary) return;

    onSubmit(form);
  };

  return (
    <Dialog
      header={heading}
      visible={open}
      modal
      onHide={onClose}
      className="
        w-[92vw] max-w-[600px] rounded-xl
        [&_.p-dialog-header]:!bg-gray-50 [&_.p-dialog-header]:!border-0 [&_.p-dialog-header]:!px-7 [&_.p-dialog-header]:!pt-5 [&_.p-dialog-header]:!pb-3
        [&_.p-dialog-content]:!bg-gray-50 [&_.p-dialog-content]:!border-0 [&_.p-dialog-content]:!px-7 [&_.p-dialog-content]:!pb-7
        [&_.p-dialog-header-icons]:!mr-1 [&_.p-dialog-header-icon]:!w-9 [&_.p-dialog-header-icon]:!h-9
      "
      contentClassName="!pt-3 !pb-7 !px-7"
      maskClassName="backdrop-blur-[2px] bg-black/30"
    >
      <Form className="space-y-4">
        <TextInput
          id="name"
          labelText="*Full Name"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="Enter full name"
          required
        />

        <TextInput
          id="email"
          labelText="*Email"
          type="email"
          value={form.email.toLowerCase()}
          onChange={(e) => handleChange("email", e.target.value)}
          placeholder="e.g. jane.doe@bain.com"
          required
          invalid={form.email.length > 0 && !isValidEmail(form.email)}
          invalidText="Please enter a valid email address"
        />

        <Select
          id="role"
          labelText="*Role"
          value={form.role}
          onChange={(e: any) => {
            const nextRole = e?.target?.value ?? "";
            setRoleTouched(true);
            setForm((prev) => ({
              ...prev,
              role: nextRole,
            }));
          }}
          required
        >
          {data.roles.map((role) => (
            <SelectItem
              key={role.id}
              value={role.id}
              text={role.role_name}
            />
          ))}
        </Select>

        <TextInput
          id="designation"
          labelText="Designation"
          value={form.designation ?? ""}
          onChange={(e) => handleChange("designation", e.target.value)}
          placeholder="e.g. Senior Associate"
        />

        <Select
          id="status"
          labelText="*Status"
          value={form.status}
          onChange={(e: any) =>
            handleChange("status", e?.target?.value ?? e?.value ?? "Active")
          }
          required
        >
          <SelectItem value="Active" text="Active" />
          <SelectItem value="Inactive" text="Inactive" />
        </Select>

        <div className="flex justify-center pt-2">
          <ButtonSet>
            <Button kind="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={disablePrimary} onClick={handleSubmit}>
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Renew size={16} className="animate-spin" aria-hidden />
                  {isEdit ? "Updating..." : "Creating..."}
                </span>
              ) : isEdit ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </ButtonSet>
        </div>
      </Form>
    </Dialog>
  );
}
