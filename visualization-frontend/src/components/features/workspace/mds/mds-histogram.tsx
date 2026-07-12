import type { MdsHistogramBin } from "@/lib/mds"
import { formatMdsThreshold, getMdsCumulativeCounts } from "@/lib/mds"

const chartWidth = 1040
const chartHeight = 310
const margin = { top: 24, right: 16, bottom: 50, left: 64 }

export function MdsHistogram({
  bins,
  threshold,
}: {
  bins: MdsHistogramBin[]
  threshold: number
}) {
  const cumulative = getMdsCumulativeCounts(bins)
  const maxCount = Math.max(16, ...bins.map((bin) => bin.count))
  const plotWidth = chartWidth - margin.left - margin.right
  const plotHeight = chartHeight - margin.top - margin.bottom
  const barSlot = plotWidth / bins.length
  const barWidth = Math.max(6, barSlot - 2)
  const thresholdX = margin.left + threshold * plotWidth
  const yTicks = [0, 4, 8, 12, 16]
  const axisBottom = margin.top + plotHeight

  // Percentage-based offsets so the HTML cumulative row aligns with SVG bars
  const leftPct = (margin.left / chartWidth) * 100
  const rightPct = (margin.right / chartWidth) * 100

  return (
    <section className="px-8 pt-8">
      <div className="mb-4">
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Section 2
        </p>
        <h2 className="mt-1.5 text-sm font-semibold text-foreground">
          Distribution of R² values
        </h2>
      </div>

      <div className="border border-border bg-card shadow-sm">
        {/* Chart */}
        <svg
          role="img"
          aria-label={`R-squared distribution with threshold ${formatMdsThreshold(threshold)}`}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full"
        >
          {/* Y-axis label */}
          <text
            x="22"
            y={margin.top + plotHeight / 2}
            transform={`rotate(-90 22 ${margin.top + plotHeight / 2})`}
            fill="#9ca3af"
            fontSize="10"
            textAnchor="middle"
          >
            Number of SKUs
          </text>

          {/* Y-axis grid lines and tick labels */}
          {yTicks.map((tick) => {
            const y = axisBottom - (tick / maxCount) * plotHeight
            return (
              <g key={tick}>
                <line
                  x1={margin.left}
                  x2={chartWidth - margin.right}
                  y1={y}
                  y2={y}
                  stroke="#f0f2f5"
                  strokeWidth="1"
                />
                <text
                  x={margin.left - 6}
                  y={y + 4}
                  textAnchor="end"
                  fill="#9ca3af"
                  fontSize="10"
                >
                  {tick}
                </text>
              </g>
            )
          })}

          {/* Axes */}
          <line
            x1={margin.left}
            x2={chartWidth - margin.right}
            y1={axisBottom}
            y2={axisBottom}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          <line
            x1={margin.left}
            x2={margin.left}
            y1={margin.top}
            y2={axisBottom}
            stroke="#e2e8f0"
            strokeWidth="1"
          />

          {/* Bars and bin labels */}
          {bins.map((bin, index) => {
            const height = (bin.count / maxCount) * plotHeight
            const x = margin.left + index * barSlot + 1
            const y = axisBottom - height
            const centerX = margin.left + (index + 0.5) * barSlot

            return (
              <g key={bin.binStart}>
                <rect x={x} y={y} width={barWidth} height={height} fill="#d1d5db" />
                <text
                  x={centerX}
                  y={axisBottom + 14}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="9"
                >
                  {bin.binStart.toFixed(2)}
                </text>
              </g>
            )
          })}

          {/* Threshold line */}
          <line
            x1={thresholdX}
            x2={thresholdX}
            y1={margin.top}
            y2={axisBottom}
            stroke="#dc2626"
            strokeWidth="1.5"
          />

          {/* X-axis title */}
          <text
            x={margin.left + plotWidth / 2}
            y={chartHeight - 8}
            textAnchor="middle"
            fill="#6b7280"
            fontSize="10"
            fontWeight="500"
          >
            R-squared
          </text>
        </svg>

        {/* Cumulative SKUs row — HTML aligned to SVG plot area */}
        <div className="border-t border-border py-3">
          <div className="flex items-baseline">
            <div
              className="flex-none pr-2 text-right text-[9px] font-semibold uppercase leading-tight tracking-wider text-muted-foreground"
              style={{ width: `${leftPct}%` }}
            >
              Cumulative
              <br />
              SKUs
            </div>
            <div
              className="grid flex-1 text-center text-xs font-semibold text-foreground"
              style={{
                gridTemplateColumns: `repeat(${cumulative.length}, minmax(0, 1fr))`,
                paddingRight: `${rightPct}%`,
              }}
            >
              {cumulative.map((count, index) => (
                <span key={`${bins[index]?.binStart}-${count}`}>
                  {count || ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
