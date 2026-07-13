import type { RoiCoverageAttribute } from "@/core/api"
import { cn } from "@/lib/utils"

const FLAG_CLASSES: Record<RoiCoverageAttribute["color_flag"], string> = {
  GREEN: "bg-emerald-500",
  YELLOW: "bg-amber-500",
  RED: "bg-red-600",
}

/** Per-attribute coverage verdict dot, driven by the backend's `color_flag`. */
export function CoverageStatusDot({
  flag,
}: {
  flag: RoiCoverageAttribute["color_flag"] | undefined
}) {
  return (
    <span className="inline-flex items-center">
      <span
        className={cn(
          "size-2 rounded-full",
          flag ? FLAG_CLASSES[flag] : "bg-muted-foreground/30"
        )}
        aria-hidden="true"
      />
      <span className="sr-only">
        {flag
          ? `Coverage status: ${flag.toLowerCase()}`
          : "Coverage status unknown"}
      </span>
    </span>
  )
}
