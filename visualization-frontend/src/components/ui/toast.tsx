"use client"

import * as React from "react"
import { Toast } from "@base-ui/react/toast"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import "./toast.css"

/**
 * A standalone manager so toasts can be fired imperatively from anywhere
 * (e.g. `useUI().showToast`) without being inside a React component.
 * It is connected to the tree via `<Toast.Provider toastManager={...} />`.
 */
export const toastManager = Toast.createToastManager()

type ToastVariant = "success" | "error" | "info" | "warning" | "loading"

const VARIANT_ICON: Record<ToastVariant, React.ReactNode> = {
  success: <CircleCheckIcon className="size-4 text-chart-3" />,
  info: <InfoIcon className="size-4 text-primary" />,
  warning: <TriangleAlertIcon className="size-4 text-chart-4" />,
  error: <OctagonXIcon className="size-4 text-destructive-foreground" />,
  loading: <Loader2Icon className="size-4 animate-spin text-primary" />,
}

const VARIANT_BORDER: Record<ToastVariant, string> = {
  success: "border-chart-3/30",
  info: "border-primary/30",
  warning: "border-chart-4/40",
  error: "border-destructive/40",
  loading: "border-primary/30",
}

function ToastList() {
  const { toasts } = Toast.useToastManager()

  return toasts.map((toast) => {
    const variant = toast.type as ToastVariant | undefined
    const icon = variant ? VARIANT_ICON[variant] : null

    return (
      <Toast.Root
        key={toast.id}
        toast={toast}
        className={cn(
          "cn-toast group rounded-md border border-border bg-card font-sans text-card-foreground shadow-lg",
          variant && VARIANT_BORDER[variant]
        )}
      >
        <Toast.Content
          data-slot="toast-content"
          className="cn-toast-content flex items-start gap-2 p-4 pr-8"
        >
          {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-col gap-1">
              <Toast.Title className="text-sm font-semibold text-card-foreground" />
              {toast.description ? (
                <Toast.Description className="text-xs text-muted-foreground" />
              ) : null}
            </div>
            {toast.actionProps ? (
              <Toast.Action className="inline-flex h-8 w-fit shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-xs font-medium transition-colors hover:bg-secondary focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none" />
            ) : null}
          </div>
          <Toast.Close
            aria-label="Dismiss"
            className="absolute end-1.5 top-1.5 flex size-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
          >
            <XIcon className="size-3.5" />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    )
  })
}

/**
 * Mounts the toast provider + viewport. Wrap the app with it so toasts
 * fired through `toastManager` render in the bottom-left viewport.
 */
function Toaster({ children }: { children?: React.ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager}>
      {children}
      <Toast.Portal>
        <Toast.Viewport data-slot="toast-viewport" className="cn-toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

type ToastInput = Parameters<typeof toastManager.add>[0]
type ToastOptions = Omit<ToastInput, "title" | "type">

/** Sonner-shaped helper kept so callers read naturally. */
export const toast = {
  message: (message: React.ReactNode, options?: ToastOptions) =>
    toastManager.add({ title: message, ...options }),
  success: (message: React.ReactNode, options?: ToastOptions) =>
    toastManager.add({ title: message, type: "success", ...options }),
  error: (message: React.ReactNode, options?: ToastOptions) =>
    toastManager.add({ title: message, type: "error", ...options }),
  info: (message: React.ReactNode, options?: ToastOptions) =>
    toastManager.add({ title: message, type: "info", ...options }),
  warning: (message: React.ReactNode, options?: ToastOptions) =>
    toastManager.add({ title: message, type: "warning", ...options }),
}

export { Toaster }
