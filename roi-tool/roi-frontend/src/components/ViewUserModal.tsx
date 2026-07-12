import * as React from "react";
import { Dialog } from "primereact/dialog";
import { Tag } from "@bain/design-system";
import { AuthUser } from "@/core/auth/auth.types";

type Props = {
  open: boolean;
  onClose: () => void;
  data: AuthUser | null;
};

function Field({
  label,
  value,
  colSpan = 1,
}: {
  label: string;
  value: React.ReactNode;
  colSpan?: 1 | 2;
}) {
  return (
    <div className={colSpan === 2 ? "col-span-2" : ""}>
      <div className="text-gray-500 text-[13px] leading-5">{label}</div>
      <div className="text-gray-900 text-[15px] leading-6 mt-[2px]">
        {value || "—"}
      </div>
    </div>
  );
}

const statusToTagType = (status?: string) =>
  status === "Inactive" ? "red" : "green";

export default function ViewUserModal({ open, onClose, data }: Props) {
  if (!data) return null;

  return (
    <Dialog
      visible={open}
      modal
      onHide={onClose}
      header={
        <span className="text-[20px] leading-7 font-semibold">
          User Details
        </span>
      }
      className="
        w-[90vw] max-w-[720px] rounded-xl
        [&_.p-dialog-header]:!bg-gray-50 [&_.p-dialog-header]:!px-6 [&_.p-dialog-header]:!py-3 [&_.p-dialog-header]:!border-0
        [&_.p-dialog-content]:!bg-gray-50 [&_.p-dialog-content]:!border-0
      "
      contentClassName="!pt-5 !pb-6 !px-6"
      maskClassName="backdrop-blur-[2px] bg-black/20"
    >
      <div className="mx-auto grid grid-cols-2 gap-x-12 gap-y-6">
        <Field label="Full Name" value={data.name} />
        <Field label="Email" value={data.email} />

        <Field label="Username" value={data.username} />
        <Field label="Role" value={data.role ?? "—"} />

        <Field label="Designation" value={data.designation ?? "—"} />
        <Field label="Company" value={data.company ?? "—"} />

        <Field label="Tenant ID" value={data.tenantId} />

        <Field
          label="Status"
          value={
            <Tag type={statusToTagType(data.status)}>
              {data.status ?? "Active"}
            </Tag>
          }
        />

        <Field
          label="Permissions"
          colSpan={2}
          value={
            data.permissions && data.permissions.length ? (
              <div className="flex flex-wrap gap-2">
                {data.permissions.map((p) => (
                  <Tag key={p} type="gray">
                    {p}
                  </Tag>
                ))}
              </div>
            ) : (
              <span className="text-gray-500">—</span>
            )
          }
        />
      </div>
    </Dialog>
  );
}
