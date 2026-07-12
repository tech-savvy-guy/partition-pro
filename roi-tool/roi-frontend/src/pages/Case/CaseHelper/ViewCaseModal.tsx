import * as React from "react";
import { Dialog } from "primereact/dialog";
import { Tag } from "@bain/design-system";

type CaseStatus = "Active" | "Closed" | "Paused";

export type ViewCaseModalData = {
  id: string;
  caseName: string;
  createdBy: string; // keep if you want, but don't use it for Case Manager
  start: string;
  end: string;
  description: string;
  status: CaseStatus;

  billingCaseCode?: string;
  requestedBy?: string;
  npsContact?: string;
  productType?: string;
  caseManager?: string;
  caseMembers?: string[];

  loading?: boolean;
  error?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  data: ViewCaseModalData | null;
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
        {value}
      </div>
    </div>
  );
}

export default function ViewCaseModal({ open, onClose, data }: Props) {
  if (!data) return null;

  const members = data.caseMembers ?? [];

  return (
    <Dialog
      visible={open}
      modal
      onHide={onClose}
      header={
        <span className="text-[20px] leading-7 font-semibold">Case Details</span>
      }
      className="
        w-[90vw] max-w-[840px] rounded-xl
        [&_.p-dialog-header]:!bg-gray-50 [&_.p-dialog-header]:!px-6 [&_.p-dialog-header]:!py-3 [&_.p-dialog-header]:!border-0
        [&_.p-dialog-content]:!bg-gray-50 [&_.p-dialog-content]:!border-0
      "
      contentClassName="!pt-5 !pb-6 !px-6"
      maskClassName="backdrop-blur-[2px] bg-black/20"
    >
      {/* Loading / error strip */}
      {data.loading && (
        <div className="text-[13px] text-gray-500 mb-3">Loading details…</div>
      )}
      {data.error && (
        <div className="text-[13px] text-red-600 mb-3">{data.error}</div>
      )}

      <div className="mx-auto grid grid-cols-2 gap-x-12 gap-y-6">
        <Field label="Case Name" value={data.caseName} />
        <Field label="Requested by" value={data.requestedBy ?? "—"} />

        <Field label="Billing Case Code" value={data.billingCaseCode ?? "—"} />
        <Field label="NPS Contact" value={data.npsContact ?? "—"} />

        <Field label="Case Manager" value={data.caseManager ?? "—"} />
        <Field label="Product Type" value={data.productType ?? "—"} />

        <Field label="Case Status" value={data.status} />

        <Field
          label="Case Members"
          colSpan={2}
          value={
            members.length ? (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <Tag key={m} type="gray">
                    {m}
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
