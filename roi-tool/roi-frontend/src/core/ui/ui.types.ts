export type ToastVariant = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
};

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
};

export type UIState = {
  isLoading: boolean;
  toasts: Toast[];
  confirm: ConfirmOptions | null;
};

export type UIContextValue = UIState & {
  showToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;

  showConfirm: (options: ConfirmOptions) => void;
  clearConfirm: () => void;

  setLoading: (isLoading: boolean) => void;
  clearToasts: () => void;
};
