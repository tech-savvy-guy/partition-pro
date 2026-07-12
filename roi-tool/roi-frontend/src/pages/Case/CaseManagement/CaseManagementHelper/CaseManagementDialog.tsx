// src/pages/.../CaseManagementHelper/CaseManagementDialog.tsx
import * as React from "react";
import { Dialog } from "primereact/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  maxWidthClassName?: string;
};

export default function CaseManagementDialog({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = "max-w-[520px]",
}: Props) {
  return (
    <Dialog
      header={<div className="pl-4 pr-2 py-1">{title}</div>}
      visible={open}
      modal
      onHide={onClose}
      className={`
        w-[92vw] ${maxWidthClassName} rounded-xl
        [&_.p-dialog-header]:!bg-gray-50 [&_.p-dialog-header]:!border-0
        [&_.p-dialog-content]:!bg-gray-50 [&_.p-dialog-content]:!border-0
      `}
      contentClassName="!pt-4 !pb-5 !px-5"
    >
      {children}
    </Dialog>
  );
}
