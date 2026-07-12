import * as React from "react"

import { Toaster, toast } from "@/components/ui/toast"

type ToastVariant = "default" | "success" | "error" | "info"

type ToastAction = {
  label: React.ReactNode
  onClick: () => void
}

type ShowToastOptions = {
  /** Secondary line rendered under the message. */
  description?: React.ReactNode
  /** Renders an action button inside the toast. */
  action?: ToastAction
  /** Auto-dismiss delay in ms. `0` keeps the toast until dismissed. */
  duration?: number
}

type UIContextValue = {
  showToast: (
    message: React.ReactNode,
    variant?: ToastVariant,
    options?: ShowToastOptions
  ) => void
}

const UIContext = React.createContext<UIContextValue | undefined>(undefined)

export function UIProvider({ children }: { children: React.ReactNode }) {
  const showToast = React.useCallback(
    (
      message: React.ReactNode,
      variant: ToastVariant = "default",
      options: ShowToastOptions = {}
    ) => {
      const { description, action, duration } = options
      const toastOptions = {
        description,
        timeout: duration,
        actionProps: action
          ? { children: action.label, onClick: action.onClick }
          : undefined,
      }

      switch (variant) {
        case "success":
          toast.success(message, toastOptions)
          return
        case "error":
          toast.error(message, toastOptions)
          return
        case "info":
          toast.info(message, toastOptions)
          return
        default:
          toast.message(message, toastOptions)
      }
    },
    []
  )

  const value = React.useMemo(() => ({ showToast }), [showToast])

  return (
    <UIContext.Provider value={value}>
      <Toaster >{children}</Toaster>
    </UIContext.Provider>
  )
}

export function useUI(): UIContextValue {
  const ctx = React.useContext(UIContext)
  if (!ctx) {
    throw new Error("useUI must be used within a UIProvider")
  }
  return ctx
}
