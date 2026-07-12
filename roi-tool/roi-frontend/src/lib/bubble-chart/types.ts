// ─────────────────────────────────────────────────────────────────────────────
// BubbleChart — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export type ChartMode = '2d' | '3d'

export type ColorScale = 'viridis' | 'coolwarm' | 'rainbow' | 'plasma' | 'magma'

// ── Data ─────────────────────────────────────────────────────────────────────

export interface BubbleDataPoint {
  x: number
  y: number
  z?: number          // optional in 2D mode
  value?: number      // drives color mapping
  size?: number       // drives size mapping (0–1 normalised)
  label?: string
  category?: string
  metadata?: Record<string, unknown>  // arbitrary extra data
}

export interface DataBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
  minValue: number
  maxValue: number
  minSize: number
  maxSize: number
}

export interface VisualBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

// ── Axis config ───────────────────────────────────────────────────────────────

export interface AxisLabels {
  x: string
  y: string
  z: string
}

export interface AxesConfig {
  showGrid: boolean
  showTicks: boolean
  showLabels: boolean
  showArrows: boolean
  gridOpacity: number
  gridDivisions: number
  /** Hex colors for axes — Three.js consumes these directly */
  axisColors: { x: number; y: number; z: number }
  labelColor: string   // CSS color for HTML labels
  tickColor: number    // Hex color for tick marks
}

// ── Point rendering ───────────────────────────────────────────────────────────

export interface PointConfig {
  colorScale: ColorScale
  defaultSize: number   // world-space radius
  minSize: number
  maxSize: number
  sphereSegments: number  // 3D only — polygon count per sphere
  defaultColor: number    // hex, fallback when no value mapping
  enableColorMapping: boolean
  enableSizeMapping: boolean
  opacity: number
  /** 2D only — shape of the bubble marker */
  markerShape: 'circle' | 'square' | 'diamond' | 'triangle'
  /** Whether to show value labels next to each bubble in 2D */
  showValueLabels: boolean
}

// ── Camera / view ─────────────────────────────────────────────────────────────

export interface CameraConfig {
  fov: number
  near: number
  far: number
  initialPosition: [number, number, number]
  enableDamping: boolean
  dampingFactor: number
  minDistance: number
  maxDistance: number
  /** Allow pan with right-click drag */
  enablePan: boolean
}

// ── 2D view ───────────────────────────────────────────────────────────────────

export interface View2DConfig {
  showXAxis: boolean
  showYAxis: boolean
  showGrid: boolean
  gridColor: string        // CSS color
  axisColor: string        // CSS color
  tickCount: number
  padding: number          // canvas padding in px
  animationDuration: number  // ms for transitions
}

// ── Fog ───────────────────────────────────────────────────────────────────────

export interface FogConfig {
  enabled: boolean
  near: number
  far: number
}

// ── Interaction ───────────────────────────────────────────────────────────────

export interface InteractionConfig {
  enableHover: boolean
  enableClick: boolean
  enableZoom: boolean
  enableRotate: boolean
  hoverScale: number       // multiplier applied to hovered bubble
  selectedScale: number    // multiplier applied to selected bubble
}

// ── Full BubbleChart props ────────────────────────────────────────────────────

export interface BubbleChartProps {
  // Required
  data: BubbleDataPoint[]

  // Mode
  mode?: ChartMode

  // Layout
  width?: number | string
  height?: number | string
  className?: string

  // Labels
  axisLabels?: Partial<AxisLabels>

  // Sub-configs (all optional, deeply merged with defaults)
  axesConfig?: Partial<AxesConfig>
  pointConfig?: Partial<PointConfig>
  cameraConfig?: Partial<CameraConfig>
  view2DConfig?: Partial<View2DConfig>
  fogConfig?: Partial<FogConfig>
  interactionConfig?: Partial<InteractionConfig>

  // 3D-specific toggles (convenience shortcuts over cameraConfig)
  autoRotate?: boolean
  autoRotateSpeed?: number

  // Callbacks
  onPointHover?: (point: BubbleDataPoint | null, index: number) => void
  onPointClick?: (point: BubbleDataPoint, index: number) => void
  onReady?: () => void
}

// ── Sidebar types ─────────────────────────────────────────────────────────────

export interface SidebarDatasetOption {
  id: string
  label: string
  description: string
}

export interface SidebarColorScaleOption {
  id: ColorScale
  label: string
  stops: string[]
}
