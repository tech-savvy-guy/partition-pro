import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  BoxIcon,
  CircleIcon,
  Grid3x3Icon,
  MinimizeIcon,
  ExpandIcon,
  RotateCwIcon,
  ScissorsIcon,
  SearchIcon,
  SigmaIcon,
  TagIcon,
  XIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SlidersIcon,
  ListFilterIcon,
  PaletteIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { WorkflowApi } from "@/core/api"
import type { VisualizationMetricName, VisualizationResult } from "@/core/api"
import { useUI } from "@/core/ui"
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { ColorField } from "@/components/features/workspace/partition-tree"
import treeColors from "@/lib/partition-tree/colors.json"
import type { PartitionTreeAttributeSelectionResponse } from "@/core/api"
import type { WorkflowNodeObject } from "@/lib/partition-tree/tree.types"
import type { BubbleDataPoint, ChartMode } from "@/lib/bubble-chart/types"
import { cn } from "@/lib/utils"
import {
  buildBubbleDataPoints,
  filterPointsByPath,
  getAvailableVisualizationMetrics,
} from "@/lib/visualization"

import { BubbleChartView } from "../bubble-chart/bubble-chart-view"

const VALUE_PALETTE = (treeColors as { nodes: { value: { palette: string[] } } })
  .nodes.value.palette

const PREVIEW_SWATCH_LIMIT = 6

function getAttributeValues(
  attributeData: PartitionTreeAttributeSelectionResponse | undefined,
  attributeName: string
): string[] {
  const values =
    attributeData?.attribute_value_counts?.[attributeName] ??
    attributeData?.attribute_values?.[attributeName] ??
    {}
  return Object.keys(values).sort((a, b) => a.localeCompare(b))
}

function buildValueColors(
  attributeName: string,
  values: string[],
  attributeData: PartitionTreeAttributeSelectionResponse | undefined,
  colorOverrides: Record<string, Record<string, string>>
): Record<string, string> {
  const saved = attributeData?.attribute_colors?.[attributeName] ?? {}
  const overrides = colorOverrides[attributeName] ?? {}
  const next: Record<string, string> = {}
  values.forEach((value, index) => {
    next[value] =
      overrides[value] ??
      saved[value] ??
      VALUE_PALETTE[index % VALUE_PALETTE.length]
  })
  return next
}

/** Trim-only normalization matching the backend `_normalize_key`. */
function normalizeValue(value: unknown): string {
  return String(value ?? "").trim()
}

export function VisualizationWorkspace({
  visualizationResult,
  caseId,
  partitionId,
  node,
  canEdit,
}: {
  visualizationResult?: VisualizationResult | null
  caseId?: string
  partitionId?: string
  node?: WorkflowNodeObject | null
  canEdit: boolean
}) {
  const queryClient = useQueryClient()
  const { showToast } = useUI()

  const [mode, setMode] = useState<ChartMode>("3d")
  const [metric, setMetric] = useState<VisualizationMetricName>("chi")
  const [showGrid, setShowGrid] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [autoRotate, setAutoRotate] = useState(false)
  const [hoveredPoint, setHoveredPoint] = useState<BubbleDataPoint | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<BubbleDataPoint | null>(null)
  const [search, setSearch] = useState("")
  const [selectedAttribute, setSelectedAttribute] = useState<string | null>(null)
  // User colour edits, keyed by attribute then value. The effective colour map
  // (`valueColors`) is derived synchronously below so switching attributes never
  // renders a frame with default (un-overridden) point colours.
  const [colorOverrides, setColorOverrides] = useState<
    Record<string, Record<string, string>>
  >({})
  const [configExpanded, setConfigExpanded] = useState(true)
  const [attributesExpanded, setAttributesExpanded] = useState(true)
  const [colorsPanelOpen, setColorsPanelOpen] = useState(true)

  const canSelectAttributes = Boolean(caseId && partitionId && node?.id)

  // Attributes (and per-value counts / saved colours) available to expand this node.
  const attributeQuery = useQuery({
    queryKey: ["attribute-selection", caseId, partitionId, node?.id] as const,
    enabled: canSelectAttributes,
    queryFn: () =>
      WorkflowApi.attributeSelection(caseId!, partitionId!, { node_obj: node }),
    retry: false,
  })

  const attributeData = attributeQuery.data

  const attributeNames = useMemo(() => {
    const rows = attributeData?.attributes_for_test?.rows
    if (Array.isArray(rows) && rows.length > 0) {
      return rows
        .map((row) => (Array.isArray(row) ? String(row[1] ?? "") : ""))
        .filter(Boolean)
    }
    return Object.keys(attributeData?.attribute_values ?? {})
  }, [attributeData])

  const filteredAttributeNames = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return attributeNames
    return attributeNames.filter((name) => name.toLowerCase().includes(q))
  }, [attributeNames, search])

  const attributeValues = useMemo(() => {
    if (!selectedAttribute) return []
    return getAttributeValues(attributeData, selectedAttribute)
  }, [attributeData, selectedAttribute])

  const valueColors = useMemo(() => {
    if (!selectedAttribute) return {}
    return buildValueColors(
      selectedAttribute,
      attributeValues,
      attributeData,
      colorOverrides
    )
  }, [selectedAttribute, attributeValues, attributeData, colorOverrides])

  const setValueColor = useCallback(
    (value: string, hex: string) => {
      if (!selectedAttribute) return
      setColorOverrides((prev) => ({
        ...prev,
        [selectedAttribute]: { ...prev[selectedAttribute], [value]: hex },
      }))
    },
    [selectedAttribute]
  )

  // Reset attribute selection and user colour edits when switching nodes.
  useEffect(() => {
    setSelectedAttribute(null)
    setSearch("")
    setColorOverrides({})
    setColorsPanelOpen(true)
  }, [node?.id])

  useEffect(() => {
    setColorsPanelOpen(true)
  }, [selectedAttribute])

  const availableMetrics = useMemo(
    () => getAvailableVisualizationMetrics(visualizationResult, mode),
    [visualizationResult, mode]
  )

  const filterResult = useMemo(() => {
    const base = buildBubbleDataPoints(visualizationResult, metric, mode)
    return filterPointsByPath(base, node?.path)
  }, [visualizationResult, metric, mode, node?.path])

  const chartData = useMemo(() => {
    const points = filterResult.points
    if (!selectedAttribute) return points
    return points.map((point) => {
      const value = normalizeValue(point.metadata?.[selectedAttribute])
      const color = valueColors[value]
      return color ? { ...point, color } : point
    })
  }, [filterResult, selectedAttribute, valueColors])

  const pointConfig = useMemo(() => ({}), [])
  const axesConfig = useMemo(
    () => ({ showGrid, showLabels }),
    [showGrid, showLabels]
  )
  const view2DConfig = useMemo(
    () => ({ showGrid, showXAxis: showLabels, showYAxis: showLabels }),
    [showGrid, showLabels]
  )

  const activePoint = selectedPoint ?? hoveredPoint

  const handlePointClick = useCallback((point: BubbleDataPoint) => {
    setSelectedPoint(point)
  }, [])

  const saveColorsMutation = useMutation({
    mutationFn: () => {
      if (!canEdit) {
        throw new Error("Acquire the partition lock before saving colors.")
      }
      return WorkflowApi.savePartitionTreeColors(
        caseId!,
        partitionId!,
        node!.id,
        selectedAttribute!,
        valueColors
      )
    },
    onSuccess: () => {
      showToast("Colors saved", "success")
      void queryClient.invalidateQueries({
        queryKey: ["attribute-selection", caseId, partitionId, node?.id],
      })
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : "Failed to save colors",
        "error"
      )
    },
  })

  const breakMutation = useMutation({
    mutationFn: () => {
      if (!canEdit) {
        throw new Error("Acquire the partition lock before changing the tree.")
      }
      return WorkflowApi.selectPartitionTreeAttribute(
        caseId!,
        partitionId!,
        node!.id,
        selectedAttribute!
      )
    },
    onSuccess: () => {
      showToast(`Tree broken at "${selectedAttribute}"`, "success")
      void queryClient.invalidateQueries({
        queryKey: ["partition-tree-workflow", caseId, partitionId],
      })
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : "Failed to break the tree",
        "error"
      )
    },
  })

  const [isFullscreen, setIsFullscreen] = useState(false)

  function handleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      const target = document.querySelector("[data-visualization-surface]")
      if (target instanceof HTMLElement) {
        void target.requestFullscreen?.()
      }
    }
  }

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  useEffect(() => {
    if (!availableMetrics.includes(metric)) {
      setMetric(availableMetrics[0] ?? "chi")
    }
  }, [availableMetrics, metric])

  if (!visualizationResult) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background px-8 py-12 text-sm text-muted-foreground">
        Visualization results are not available yet.
      </div>
    )
  }

  return (
    <SidebarProvider
      defaultOpen
      className="flex h-full min-h-0 w-full flex-1"
      style={{ "--sidebar-width": "17.5rem" } as React.CSSProperties}
    >
      <Sidebar
        collapsible="none"
        className="relative border-r border-border/80 bg-sidebar/90 text-sidebar-foreground backdrop-blur-md shadow-lg transition-all duration-300 overflow-hidden"
        data-visualization-sidebar
      >
        {/* Decorative Background Orbs using theme colors */}
        <div className="absolute -top-24 -left-24 size-48 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 size-48 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <SidebarContent className="gap-0 relative z-10">
          <div className="border-b border-border/60 p-4">
            <button
              type="button"
              onClick={() => setConfigExpanded(!configExpanded)}
              className="flex w-full items-center justify-between text-left text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-sidebar-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <SlidersIcon className="size-3.5 text-primary" />
                Settings
              </span>
              {configExpanded ? (
                <ChevronUpIcon className="size-3.5 text-muted-foreground" />
              ) : (
                <ChevronDownIcon className="size-3.5 text-muted-foreground" />
              )}
            </button>

            {configExpanded && (
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <SectionLabel className="text-muted-foreground">Mode</SectionLabel>
                  <Segmented>
                    <SegmentButton
                      active={mode === "2d"}
                      onClick={() => setMode("2d")}
                      icon={<CircleIcon />}
                    >
                      2D
                    </SegmentButton>
                    <SegmentButton
                      active={mode === "3d"}
                      onClick={() => setMode("3d")}
                      icon={<BoxIcon />}
                    >
                      3D
                    </SegmentButton>
                  </Segmented>
                </div>

                <div className="flex flex-col gap-2">
                  <SectionLabel className="text-muted-foreground">Distance</SectionLabel>
                  <Segmented>
                    <SegmentButton
                      active={metric === "chi"}
                      disabled={!availableMetrics.includes("chi")}
                      onClick={() => setMetric("chi")}
                      icon={<SigmaIcon />}
                    >
                      Chi
                    </SegmentButton>
                    <SegmentButton
                      active={metric === "phi"}
                      disabled={!availableMetrics.includes("phi")}
                      onClick={() => setMetric("phi")}
                      icon={<SigmaIcon />}
                    >
                      Phi
                    </SegmentButton>
                  </Segmented>
                </div>
              </div>
            )}
          </div>

          {/* Attributes Card */}
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <button
              type="button"
              onClick={() => setAttributesExpanded(!attributesExpanded)}
              className="flex w-full items-center justify-between text-left text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-sidebar-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <ListFilterIcon className="size-3.5 text-primary" />
                Attributes
              </span>
              <div className="flex items-center gap-2">
                {canSelectAttributes && attributeNames.length > 0 && (
                  <span className="rounded-full bg-primary/20 border border-primary/30 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {attributeNames.length}
                  </span>
                )}
                {attributesExpanded ? (
                  <ChevronUpIcon className="size-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                )}
              </div>
            </button>

            {attributesExpanded && (
              <div className="mt-3 flex min-h-0 flex-1 flex-col">
                {!canSelectAttributes ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Run a partition-tree node to break it down by attribute.
                  </p>
                ) : (
                  <>
                    <div className="relative mb-2 shrink-0">
                      <SearchIcon className="pointer-events-none absolute top-1/2 left-0 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search attributes…"
                        className="h-8 rounded-none border-0 border-b border-border/50 bg-transparent pl-6 pr-7 text-[12px] shadow-none placeholder:text-muted-foreground/60 focus-visible:border-primary/50 focus-visible:ring-0"
                      />
                      {search && (
                        <button
                          type="button"
                          onClick={() => setSearch("")}
                          className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                          aria-label="Clear search"
                        >
                          <XIcon className="size-3" />
                        </button>
                      )}
                    </div>

                    <ScrollArea className="min-h-0 flex-1">
                      <div className="flex flex-col pr-2 pb-1">
                      {attributeQuery.isLoading && (
                        <div className="flex items-center gap-2 py-3 text-[12px] text-muted-foreground">
                          <Spinner className="size-3.5 text-primary" />
                          Loading attributes…
                        </div>
                      )}
                      {attributeQuery.error && (
                        <p className="py-3 text-[11px] text-destructive">
                          Could not load attributes.
                        </p>
                      )}
                      {!attributeQuery.isLoading &&
                        !attributeQuery.error &&
                        filteredAttributeNames.length === 0 && (
                          <p className="py-3 text-[11px] text-muted-foreground">
                            No attributes found.
                          </p>
                        )}

                      <div className="flex flex-col">
                        {filteredAttributeNames.map((name) => {
                          const active = selectedAttribute === name
                          const values = getAttributeValues(attributeData, name)
                          const colors = buildValueColors(
                            name,
                            values,
                            attributeData,
                            colorOverrides
                          )
                          const countsObj =
                            attributeData?.attribute_value_counts?.[name]
                          const valuesCount = values.length
                          const totalSkus = countsObj
                            ? Object.values(countsObj).reduce(
                                (sum, curr) => sum + (curr?.sku_count ?? 0),
                                0
                              )
                            : 0
                          const previewValues = values.slice(0, PREVIEW_SWATCH_LIMIT)
                          const overflowCount = Math.max(
                            0,
                            values.length - PREVIEW_SWATCH_LIMIT
                          )

                          return (
                            <div
                              key={name}
                              className={cn(
                                "border-b border-border/40 last:border-b-0",
                                active && "bg-muted/20"
                              )}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedAttribute((prev) =>
                                    prev === name ? null : name
                                  )
                                }
                                className="flex w-full items-start gap-2 px-0.5 py-2.5 text-left transition-colors hover:bg-muted/30"
                                aria-pressed={active}
                              >
                                <span
                                  className={cn(
                                    "mt-1.5 size-1 shrink-0 rounded-full transition-colors",
                                    active ? "bg-primary" : "bg-border"
                                  )}
                                  aria-hidden="true"
                                />
                                <span className="min-w-0 flex-1">
                                  <span
                                    className={cn(
                                      "block truncate text-[12px] leading-tight",
                                      active
                                        ? "font-semibold text-foreground"
                                        : "font-medium text-foreground/85"
                                    )}
                                  >
                                    {name}
                                  </span>
                                  {valuesCount > 0 && (
                                    <span className="mt-0.5 block text-[10px] tabular-nums text-muted-foreground">
                                      {valuesCount}{" "}
                                      {valuesCount === 1 ? "value" : "values"}
                                      {totalSkus > 0 &&
                                        ` · ${totalSkus.toLocaleString()} SKUs`}
                                    </span>
                                  )}
                                </span>
                                {previewValues.length > 0 && (
                                  <span className="flex shrink-0 items-center gap-0.5 pt-0.5">
                                    {previewValues.map((value) => (
                                      <span
                                        key={value}
                                        className="size-2 rounded-full ring-1 ring-black/10 dark:ring-white/15"
                                        style={{ backgroundColor: colors[value] }}
                                        title={value}
                                        aria-hidden="true"
                                      />
                                    ))}
                                    {overflowCount > 0 && (
                                      <span className="pl-0.5 text-[9px] text-muted-foreground">
                                        +{overflowCount}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      </div>
                    </ScrollArea>
                  </>
                )}
              </div>
            )}
          </div>
        </SidebarContent>
      </Sidebar>

      <SidebarInset
        className="min-h-0 overflow-hidden bg-background"
        data-visualization-surface
      >
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          {selectedAttribute && !colorsPanelOpen && (
            <DisplayToggle
              label="Show colors panel"
              active={false}
              onClick={() => setColorsPanelOpen(true)}
              icon={<PanelRightOpenIcon />}
            />
          )}
          <DisplayToggle
            label="Grid"
            active={showGrid}
            onClick={() => setShowGrid((v) => !v)}
            icon={<Grid3x3Icon />}
          />
          <DisplayToggle
            label="Axis labels"
            active={showLabels}
            onClick={() => setShowLabels((v) => !v)}
            icon={<TagIcon />}
          />
          <DisplayToggle
            label={mode === "2d" ? "Auto rotate (3D only)" : "Auto rotate"}
            active={autoRotate}
            disabled={mode === "2d"}
            onClick={() => setAutoRotate((v) => !v)}
            icon={<RotateCwIcon />}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={handleFullscreen}
          >
            {isFullscreen ? <MinimizeIcon /> : <ExpandIcon />}
          </Button>
        </div>

        <div className="relative flex min-h-0 flex-1">
          <BubbleChartView
            data={chartData}
            mode={mode}
            axisLabels={{ x: "X Axis", y: "Y Axis", z: "Z Axis" }}
            pointConfig={pointConfig}
            axesConfig={axesConfig}
            view2DConfig={view2DConfig}
            autoRotate={mode === "3d" && autoRotate}
            className="h-full"
            onPointHover={setHoveredPoint}
            onPointClick={handlePointClick}
          />

          {filterResult.missingAttributes.length > 0 && (
            <div className="pointer-events-none absolute top-3 left-3 z-10 max-w-xs border border-amber-500/40 bg-amber-50/95 px-3 py-2 text-[11px] text-amber-900 shadow-xs dark:bg-amber-950/80 dark:text-amber-200">
              Showing all SKUs — attribute data for{" "}
              {filterResult.missingAttributes.join(", ")} is missing from the
              visualization.
            </div>
          )}

          {selectedAttribute ? (
            <AttributeLegend
              attribute={selectedAttribute}
              values={attributeValues}
              colors={valueColors}
            />
          ) : (
            <AxisLegend mode={mode} />
          )}

          <div className="pointer-events-none absolute right-4 bottom-4 left-4 flex items-end justify-end gap-4">
            {activePoint && (
              <div className="min-w-52 border border-border bg-card/95 p-3 text-xs shadow-xs backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">
                    {activePoint.label ?? "Point"}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {selectedPoint ? "selected" : "hover"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-muted-foreground">
                  <PointMetric label="X" value={activePoint.x} />
                  <PointMetric label="Y" value={activePoint.y} />
                  <PointMetric label="Z" value={activePoint.z ?? 0} />
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>

      {selectedAttribute && colorsPanelOpen && (
        <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-sidebar text-sidebar-foreground">
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Colors
              </p>
              <p
                className="mt-0.5 truncate text-sm font-semibold text-foreground"
                title={selectedAttribute}
              >
                {selectedAttribute}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Hide colors panel"
                title="Hide colors panel"
                onClick={() => setColorsPanelOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <PanelRightCloseIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Deselect attribute"
                title="Deselect attribute"
                onClick={() => setSelectedAttribute(null)}
                className="-mr-1 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="flex flex-col gap-4 px-4 py-4">
              {attributeValues.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  No values found for this attribute.
                </p>
              )}

              {attributeValues.map((value, index) => {
                const counts =
                  attributeData?.attribute_value_counts?.[selectedAttribute]?.[
                    value
                  ]
                const fallback = VALUE_PALETTE[index % VALUE_PALETTE.length]

                return (
                  <div key={value} className="flex flex-col gap-1.5">
                    <ColorField
                      label={value}
                      value={valueColors[value]}
                      fallback={fallback}
                      disabled={!canEdit}
                      onChange={(hex) => setValueColor(value, hex)}
                      onClear={() => setValueColor(value, fallback)}
                    />
                    {counts && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {counts.sku_count.toLocaleString()} SKUs ·{" "}
                        {counts.client_count.toLocaleString()}{" "}
                        {counts.client_count === 1 ? "client" : "clients"}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                !canEdit ||
                saveColorsMutation.isPending ||
                attributeValues.length === 0
              }
              onClick={() => saveColorsMutation.mutate()}
              className="w-full justify-center"
            >
              {saveColorsMutation.isPending ? (
                <Spinner className="size-3.5" />
              ) : (
                <PaletteIcon className="size-3.5" />
              )}
              Save colors
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                !canEdit ||
                breakMutation.isPending ||
                attributeValues.length <= 1
              }
              onClick={() => breakMutation.mutate()}
              title={
                attributeValues.length <= 1
                  ? "This attribute has only one value — there is nothing to break it into."
                  : undefined
              }
              className="w-full justify-center"
            >
              {breakMutation.isPending ? (
                <Spinner className="size-3.5" />
              ) : (
                <ScissorsIcon className="size-3.5" />
              )}
              {attributeValues.length <= 1
                ? "Only one value — can't break"
                : "Break at this attribute"}
            </Button>
          </div>
        </aside>
      )}
    </SidebarProvider>
  )
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55",
        className
      )}
    >
      {children}
    </p>
  )
}

function Segmented({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
      {children}
    </div>
  )
}

function SegmentButton({
  active,
  disabled,
  onClick,
  icon,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "relative flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        disabled && "cursor-not-allowed opacity-40",
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
          : "font-medium text-muted-foreground hover:bg-background/70 hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function DisplayToggle({
  label,
  active,
  disabled,
  onClick,
  icon,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active && !disabled ? "default" : "outline"}
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </Button>
  )
}

function AttributeLegend({
  attribute,
  values,
  colors,
}: {
  attribute: string
  values: string[]
  colors: Record<string, string>
}) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 max-h-[40%] max-w-56 overflow-hidden border border-border bg-card/95 px-3 py-2 text-xs shadow-xs backdrop-blur">
      <p className="mb-1.5 truncate font-medium text-foreground" title={attribute}>
        {attribute}
      </p>
      <div className="flex flex-col gap-1">
        {values.map((value) => (
          <span key={value} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colors[value] }}
              aria-hidden="true"
            />
            <span className="truncate" title={value}>
              {value}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function AxisLegend({ mode }: { mode: ChartMode }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-3 border border-border bg-card/95 px-3 py-2 font-mono text-xs text-muted-foreground shadow-xs backdrop-blur">
      <LegendItem color="bg-[#f28482]" label="X Axis" />
      <LegendItem color="bg-[#6ed3bd]" label="Y Axis" />
      {mode === "3d" && <LegendItem color="bg-[#72a8ff]" label="Z Axis" />}
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", color)} aria-hidden="true" />
      {label}
    </span>
  )
}

function PointMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground/70">{label}</span>
      <span>{value.toFixed(2)}</span>
    </div>
  )
}
