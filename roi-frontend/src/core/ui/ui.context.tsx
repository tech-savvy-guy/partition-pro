import * as React from "react";
import { UIContextValue, UIState, Toast, ConfirmOptions } from "./ui.types";
import { ActionableNotification } from "@bain/design-system";
import ConfirmModal from "./ConfirmModal";

const UIContext = React.createContext<UIContextValue | undefined>(undefined);

const initialState: UIState = {
  isLoading: false,
  toasts: [],
  confirm: null,
};

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = React.useState(initialState);

  const showToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    const fullToast: Toast = { id, ...toast };

    setState((prev) => ({
      ...prev,
      toasts: [...prev.toasts, fullToast],
    }));

    if (toast.duration && toast.duration > 0) {
      window.setTimeout(() => {
        setState((prev) => ({
          ...prev,
          toasts: prev.toasts.filter((t) => t.id !== id),
        }));
      }, toast.duration);
    }
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      toasts: prev.toasts.filter((t) => t.id !== id),
    }));
  }, []);

  const clearToasts = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      toasts: [],
    }));
  }, []);

  const setLoading = React.useCallback((isLoading: boolean) => {
    setState((prev) => ({
      ...prev,
      isLoading,
    }));
  }, []);

  const showConfirm = React.useCallback((options: ConfirmOptions) => {
    setState((prev) => ({
      ...prev,
      confirm: options
    }));
  }, []);

  const clearConfirm = React.useCallback(() => {
    setState((prev) => ({ ...prev, confirm: null }));
  }, []);

  const value: UIContextValue = {
    ...state,
    showToast,
    removeToast,
    showConfirm,
    setLoading,
    clearToasts,
    clearConfirm,
  };

  return (
    <UIContext.Provider value={value}>
      {/* Loading overlay */}
      {state.isLoading && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="rounded-lg bg-white px-4 py-3 shadow-md text-gray-800 text-sm">
            Loading...
          </div>
        </div>
      )}

      <ConfirmModal open={!!state.confirm} options={state.confirm} onClose={clearConfirm}/>

      {/* Toast host */}
      <ToastHost toasts={state.toasts} onDismiss={removeToast} />

      {children}
    </UIContext.Provider>
  );
};

export const useUI = (): UIContextValue => {
  const ctx = React.useContext(UIContext);
  if (!ctx) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return ctx;
};

/**
 * Simple toast host in the top-right corner.
 * You can later replace this with Bain DS toasts if available.
 */
const ToastHost: React.FC<{
  toasts: Toast[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[9991] flex flex-col gap-3 w-[360px]">
      {toasts.map((toast) => (
        <ActionableNotification
          key={toast.id}
          kind={toast.variant} // "success" | "error" | "warning" | "info"
          title={toast.message}
          subtitle={undefined}
          statusIconDescription={toast.variant}
          actionButtonLabel={undefined}
          aria-label="closes notification"
          onClose={() => onDismiss(toast.id)}
          onCloseButtonClick={() => onDismiss(toast.id)}
          onActionButtonClick={() => {
            /* You can add custom action later */
          }}
          lowContrast
        />
      ))}
    </div>
  );
};
