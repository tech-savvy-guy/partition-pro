import {
  formatMdsPercent,
  getMdsMetricColor,
  getMdsMetricValue,
  type MdsMetric,
  type MdsMetricKind,
} from "@/lib/mds"

const panelWidth = 400
const panelHeight = 116
const margin = { top: 22, right: 28, bottom: 32, left: 46 }
const plotWidth = panelWidth - margin.left - margin.right
const plotHeight = panelHeight - margin.top - margin.bottom
const axisBottom = margin.top + plotHeight

const BAR_WIDTH = plotWidth * 0.28
const BAR_CENTERS = [plotWidth * 0.28, plotWidth * 0.72]

export function MdsSummaryGrid({ metrics }: { metrics: MdsMetric[] }) {
  return (
    <section className="px-8 pt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Section 1
          </p>
          <h2 className="mt-1.5 text-sm font-semibold text-foreground">
            Overall stress & R² values
          </h2>
        </div>

        <div className="flex h-8 items-center border border-border bg-card px-4 text-xs">
          <span className="font-semibold tracking-wider text-muted-foreground uppercase">
            Optimal stress
          </span>
          <span className="mx-2.5 font-semibold text-foreground">&gt; 20%</span>
          <span className="h-4 w-px bg-border" />
          <span className="ml-2.5 font-semibold tracking-wider text-muted-foreground uppercase">
            Optimal R²
          </span>
          <span className="ml-2.5 font-semibold text-foreground">&lt; 80%</span>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <MetricPanel
          title="Stress"
          dimensionLabel="2D"
          kind="stress"
          maxValue={0.3}
          metrics={metrics.filter((m) => m.dimension === "2d")}
        />
        <MetricPanel
          title="R²"
          dimensionLabel="2D"
          kind="rSquared"
          maxValue={1}
          metrics={metrics.filter((m) => m.dimension === "2d")}
        />
        <MetricPanel
          title="Stress"
          dimensionLabel="3D"
          kind="stress"
          maxValue={0.2}
          metrics={metrics.filter((m) => m.dimension === "3d")}
        />
        <MetricPanel
          title="R²"
          dimensionLabel="3D"
          kind="rSquared"
          maxValue={1}
          metrics={metrics.filter((m) => m.dimension === "3d")}
        />
      </div>
    </section>
  )
}

function MetricPanel({
  title,
  dimensionLabel,
  kind,
  maxValue,
  metrics,
}: {
  title: string
  dimensionLabel: string
  kind: MdsMetricKind
  maxValue: number
  metrics: MdsMetric[]
}) {
  const ticks = kind === "stress" ? [maxValue, maxValue / 2, 0] : [1, 0.5, 0]

  return (
    <div className="border border-border bg-card shadow-sm">
      <svg
        viewBox={`0 0 ${panelWidth} ${panelHeight}`}
        className="w-full"
        aria-label={`${title} ${dimensionLabel} metric panel`}
      >
        {/* Y-axis title */}
        <text
          x="12"
          y={axisBottom - plotHeight / 2}
          transform={`rotate(-90 12 ${axisBottom - plotHeight / 2})`}
          fill="#9ca3af"
          fontSize="8"
          textAnchor="middle"
        >
          {title}
        </text>

        {/* Y-axis ticks, labels and gridlines */}
        {ticks.map((tick) => {
          const y = axisBottom - (tick / maxValue) * plotHeight
          return (
            <g key={tick}>
              {tick > 0 && (
                <line
                  x1={margin.left}
                  x2={panelWidth - margin.right}
                  y1={y}
                  y2={y}
                  stroke="#f0f2f5"
                  strokeWidth="1"
                />
              )}
              <text
                x={margin.left - 5}
                y={y + 4}
                textAnchor="end"
                fill="#9ca3af"
                fontSize="8"
              >
                {`${Math.round(tick * 100)}%`}
              </text>
            </g>
          )
        })}

        {/* Axes */}
        <line
          x1={margin.left}
          x2={panelWidth - margin.right}
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

        {/* Bars */}
        {metrics.map((metric, i) => {
          const value = getMdsMetricValue(metric, kind)
          const barHeight = Math.max(3, (value / maxValue) * plotHeight)
          const cx = margin.left + BAR_CENTERS[i]
          const x = cx - BAR_WIDTH / 2
          const y = axisBottom - barHeight
          const label = metric.distanceFunction === "chi" ? "Chi" : "Phi"

          return (
            <g key={`${metric.dimension}-${metric.distanceFunction}`}>
              {/* Value above bar */}
              <text
                x={cx}
                y={y - 5}
                textAnchor="middle"
                fill="#374151"
                fontSize="9"
                fontWeight="500"
              >
                {formatMdsPercent(value)}
              </text>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={barHeight}
                fill={getMdsMetricColor(kind, value)}
              />
              {/* Distance function label below x-axis */}
              <text
                x={cx}
                y={axisBottom + 12}
                textAnchor="middle"
                fill="#6b7280"
                fontSize="8"
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* X-axis title */}
        <text
          x={margin.left + plotWidth / 2}
          y={panelHeight - 5}
          textAnchor="middle"
          fill="#9ca3af"
          fontSize="8"
        >
          Distance function
        </text>

        {/* Dimension label (right side) */}
        <text
          x={panelWidth - 12}
          y={axisBottom - plotHeight / 2}
          transform={`rotate(90 ${panelWidth - 12} ${axisBottom - plotHeight / 2})`}
          fill="#9ca3af"
          fontSize="8"
          textAnchor="middle"
        >
          {dimensionLabel}
        </text>
      </svg>
    </div>
  )
}
