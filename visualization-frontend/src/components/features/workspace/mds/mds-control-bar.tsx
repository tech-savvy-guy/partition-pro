import { SlidersHorizontalIcon, SigmaIcon } from "lucide-react"

import type { MdsDistanceFunction } from "@/lib/mds"
import { formatMdsThreshold } from "@/lib/mds"
import { cn } from "@/lib/utils"

export function MdsControlBar({
  totalSkus,
  excludedSkus,
  distanceFunction,
  availableDistanceFunctions = ["chi", "phi"],
  threshold,
  onDistanceFunctionChange,
  onThresholdChange,
}: {
  totalSkus: number
  excludedSkus: number
  distanceFunction: MdsDistanceFunction
  availableDistanceFunctions?: MdsDistanceFunction[]
  threshold: number
  onDistanceFunctionChange: (distanceFunction: MdsDistanceFunction) => void
  onThresholdChange: (threshold: number) => void
}) {
  return (
    <div className="sticky top-[calc(3.25rem+6rem)] z-30 flex h-14 flex-nowrap items-center justify-center gap-4 border-b bg-card px-6 shadow-xs">
      <div className="flex h-9 items-center border border-border bg-card">
        <StatPill label="Total SKUs" value={totalSkus} />
        <StatPill label="Excluded" value={excludedSkus} />
      </div>

      <div className="hidden h-7 w-px bg-border sm:block" />

      <div className="flex h-9 items-center gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          <SigmaIcon size={13} aria-hidden="true" />
          Distance
        </div>
        <div className="flex h-9 border border-border bg-card">
          <DistanceButton
            value="chi"
            activeValue={distanceFunction}
            disabled={!availableDistanceFunctions.includes("chi")}
            onClick={onDistanceFunctionChange}
          >
            Chi
          </DistanceButton>
          <DistanceButton
            value="phi"
            activeValue={distanceFunction}
            disabled={!availableDistanceFunctions.includes("phi")}
            onClick={onDistanceFunctionChange}
          >
            Phi
          </DistanceButton>
        </div>
      </div>

      <div className="hidden h-7 w-px bg-border sm:block" />

      <div className="flex h-9 items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          <SlidersHorizontalIcon size={13} aria-hidden="true" />
          R²
        </div>
        <input
          aria-label="R-squared threshold"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={threshold}
          onChange={(event) => onThresholdChange(event.currentTarget.valueAsNumber)}
          className="h-1 w-40 cursor-pointer appearance-none bg-muted accent-primary [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-card [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-card"
        />
        <input
          aria-label="R-squared threshold value"
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={formatMdsThreshold(threshold)}
          onChange={(event) =>
            onThresholdChange(Number(event.currentTarget.value))
          }
          className="h-9 w-20 border border-border bg-card px-2 font-mono text-sm italic text-foreground shadow-xs outline-none focus:border-primary"
        />
      </div>
    </div>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex h-full items-center gap-3 border-r border-border px-4 last:border-r-0">
      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <span className="min-w-[3ch] tabular-nums text-sm font-semibold text-foreground">{value}</span>
    </div>
  )
}

function DistanceButton({
  value,
  activeValue,
  disabled,
  onClick,
  children,
}: {
  value: MdsDistanceFunction
  activeValue: MdsDistanceFunction
  disabled?: boolean
  onClick: (value: MdsDistanceFunction) => void
  children: React.ReactNode
}) {
  const isActive = value === activeValue

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled) onClick(value)
      }}
      className={cn(
        "min-w-13 border-r border-border px-4 text-sm font-medium last:border-r-0",
        disabled && "cursor-not-allowed opacity-45",
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-card text-foreground hover:bg-muted/70",
        disabled && "hover:bg-card"
      )}
    >
      {children}
    </button>
  )
}
