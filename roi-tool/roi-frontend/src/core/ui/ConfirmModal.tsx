import * as React from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "@bain/design-system";
import type { ConfirmOptions } from "./ui.types";

type Props = {
  open: boolean;
  options: ConfirmOptions | null;
  onClose: () => void;
};

export default function ConfirmModal({ open, options, onClose }: Props) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (!options) return null;

  const {
    title = "Confirm action",
    message,
    confirmLabel = "Yes",
    cancelLabel = "Cancel",
    destructive,
    onConfirm,
  } = options;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Confirm action failed:", err);
      // keep modal open on error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      visible={open}
      modal
      onHide={() => {
        if (!isSubmitting) onClose();
      }}
      header={
        <span className="text-[18px] font-semibold text-gray-900">{title}</span>
      }
      className="
        w-[92vw] max-w-[420px] rounded-xl
        [&_.p-dialog-header]:!bg-white [&_.p-dialog-header]:!border-0
        [&_.p-dialog-content]:!bg-white [&_.p-dialog-content]:!border-0
      "
      contentClassName="!px-6 !pt-4 !pb-6"
      maskClassName="backdrop-blur-[1px] bg-black/30"
      closable={!isSubmitting}
    >
      {/* Message */}
      <p className="text-sm text-gray-700">{message}</p>

      {/* Loader */}
      {isSubmitting && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
          <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
          Processing…
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-2">
        <Button
          kind="secondary"
          disabled={isSubmitting}
          onClick={onClose}
        >
          {cancelLabel}
        </Button>

        <Button
          kind="primary"
          disabled={isSubmitting}
          onClick={handleConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
