import { cn } from "@/lib/utils"

export function TabBtn({
  isActive,
  onClick,
  children,
  size,
  disabled = false,
  activeBorderClassName = "bg-primary",
}: {
  isActive: boolean
  onClick: () => void
  children: React.ReactNode
  size: "md" | "sm"
  disabled?: boolean
  activeBorderClassName?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled) onClick()
      }}
      className={cn(
        "relative px-4 whitespace-nowrap transition-colors",
        size === "md" ? "py-3 text-[13px]" : "py-2.5 text-xs",
        disabled && "cursor-not-allowed opacity-45",
        isActive
          ? "font-medium text-secondary"
          : "text-muted-foreground hover:text-foreground",
        disabled && "hover:text-muted-foreground"
      )}
    >
      {children}
      {isActive && (
        <span
          className={cn(
            "absolute right-0 bottom-0 left-0 h-px",
            activeBorderClassName
          )}
        />
      )}
    </button>
  )
}
