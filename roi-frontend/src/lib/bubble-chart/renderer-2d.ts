import { DataMapper } from './data-mapper'
import type {
  BubbleDataPoint,
  DataBounds,
  PointConfig,
  View2DConfig,
  AxisLabels,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// BubbleChart — 2D Renderer (Canvas 2D API)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_POINT_CONFIG: PointConfig = {
  colorScale: 'viridis',
  defaultSize: 0.12,
  minSize: 6,
  maxSize: 32,
  sphereSegments: 16,
  defaultColor: 0x4ecdc4,
  enableColorMapping: true,
  enableSizeMapping: true,
  opacity: 0.82,
  markerShape: 'circle',
  showValueLabels: false,
}

const DEFAULT_VIEW_CONFIG: View2DConfig = {
  showXAxis: true,
  showYAxis: true,
  showGrid: true,
  gridColor: 'rgba(161,161,170,0.25)',
  axisColor: '#a1a1aa',
  tickCount: 6,
  padding: 56,
  animationDuration: 380,
}

// ─────────────────────────────────────────────────────────────────────────────

interface RenderedBubble {
  point: BubbleDataPoint
  index: number
  /** CSS pixel coordinates (NOT device pixels) */
  cx: number
  cy: number
  /** Radius in CSS pixels */
  r: number
  fillStyle: string
}

export interface Renderer2DCallbacks {
  onReady?: () => void
  onPointHover?: (point: BubbleDataPoint | null, index: number) => void
  onPointClick?: (point: BubbleDataPoint, index: number) => void
  onHoverPosition?: (x: number, y: number) => void
}

export class Renderer2D {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  private dataPoints: BubbleDataPoint[] = []
  private dataBounds!: DataBounds
  private renderedBubbles: RenderedBubble[] = []

  private pointConfig: PointConfig
  private viewConfig: View2DConfig

  private hoveredIndex = -1
  private axisLabels: AxisLabels = { x: 'X', y: 'Y', z: 'Z' }

  /** Logical (CSS-pixel) dimensions of the canvas */
  private cssWidth = 0
  private cssHeight = 0

  private animationId = 0
  private animStartTime = 0
  private animDuration = 380
  private prevBubbles: RenderedBubble[] = []
  private nextBubbles: RenderedBubble[] = []
  private isAnimating = false

  private callbacks: Renderer2DCallbacks

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: Renderer2DCallbacks,
    pointConfig?: Partial<PointConfig>,
    viewConfig?: Partial<View2DConfig>,
  ) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.callbacks = callbacks
    this.pointConfig = { ...DEFAULT_POINT_CONFIG, ...pointConfig }
    this.viewConfig = { ...DEFAULT_VIEW_CONFIG, ...viewConfig }
    this.dataBounds = DataMapper.calculateBoundsFromData([])
    // Derive CSS dimensions from the canvas element's current style size
    this.cssWidth = canvas.offsetWidth || canvas.width
    this.cssHeight = canvas.offsetHeight || canvas.height
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  setData(points: BubbleDataPoint[], axisLabels: AxisLabels): void {
    // Cancel any in-flight animation so stale nextBubbles are never used
    cancelAnimationFrame(this.animationId)
    this.isAnimating = false

    this.dataPoints = points
    this.axisLabels = axisLabels
    this.dataBounds = DataMapper.calculateBoundsFromData(points)

    // Sync CSS dimensions from the live canvas rect.
    // Fall back to canvas.width / dpr when the container is hidden (rect = 0).
    const rect = this.canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    if (rect.width > 0 && rect.height > 0) {
      this.cssWidth  = rect.width
      this.cssHeight = rect.height
    } else if (this.canvas.width > 0 && this.canvas.height > 0) {
      this.cssWidth  = this.canvas.width  / dpr
      this.cssHeight = this.canvas.height / dpr
    }

    const next = this.computeBubbles(points)

    const duration = this.viewConfig.animationDuration
    if (this.renderedBubbles.length > 0 && duration > 0) {
      // Snapshot the current rendered state as animation start
      this.prevBubbles = this.renderedBubbles.map(b => ({ ...b }))
      this.nextBubbles = next
      this.animStartTime = performance.now()
      this.animDuration  = duration
      this.isAnimating   = true
      this.runAnimation()
    } else {
      this.renderedBubbles = next
      this.drawFrame()
      this.callbacks.onReady?.()
    }
  }

  updatePointConfig(config: Partial<PointConfig>): void {
    this.pointConfig = { ...this.pointConfig, ...config }
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      this.cssWidth  = rect.width
      this.cssHeight = rect.height
    }
    this.renderedBubbles = this.computeBubbles(this.dataPoints)
    this.drawFrame()
    this.callbacks.onReady?.()
  }

  updateViewConfig(config: Partial<View2DConfig>): void {
    this.viewConfig = { ...this.viewConfig, ...config }
    this.drawFrame()
    this.callbacks.onReady?.()
  }

  // ── Compute bubble layout (all coords in CSS pixels) ──────────────────────

  private computeBubbles(points: BubbleDataPoint[]): RenderedBubble[] {
    const { padding } = this.viewConfig
    const w = this.cssWidth
    const h = this.cssHeight
    const pc = this.pointConfig
    const db = this.dataBounds

    const usableW = w - padding * 2
    const usableH = h - padding * 2

    return points.map((point, index) => {
      const rangeX = db.maxX - db.minX || 1
      const rangeY = db.maxY - db.minY || 1

      // CSS-pixel position
      const cx = padding + ((point.x - db.minX) / rangeX) * usableW
      const cy = padding + usableH - ((point.y - db.minY) / rangeY) * usableH

      // Radius in CSS pixels
      let r: number
      if (pc.enableSizeMapping && point.size !== undefined) {
        const { minSize: dMin, maxSize: dMax } = db
        const norm = dMax !== dMin ? (point.size - dMin) / (dMax - dMin) : 0.5
        r = pc.minSize + Math.sqrt(Math.max(0, norm)) * (pc.maxSize - pc.minSize)
      } else {
        r = (pc.minSize + pc.maxSize) / 2
      }

      // Fill colour
      let fillStyle: string
      if (pc.enableColorMapping && point.value !== undefined) {
        const { minValue, maxValue } = db
        const norm = maxValue !== minValue ? (point.value - minValue) / (maxValue - minValue) : 0.5
        const { r: cr, g: cg, b: cb } = DataMapper.mapToColor(norm, pc.colorScale)
        fillStyle = DataMapper.colorToCSS(cr, cg, cb, pc.opacity)
      } else {
        const hex = pc.defaultColor
        fillStyle = `rgba(${(hex >> 16) & 0xff},${(hex >> 8) & 0xff},${hex & 0xff},${pc.opacity})`
      }

      return { point, index, cx, cy, r, fillStyle }
    })
  }

  // ── Draw ───────────────────────────────────────────────────────────────────

  drawFrame(lerp = 1): void {
    const ctx = this.ctx
    const dpr = window.devicePixelRatio || 1

    // Clear in device-pixel space
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.restore()

    // All coordinates below are CSS pixels; the DPR transform is on the context
    const w = this.cssWidth
    const h = this.cssHeight
    const { padding, showXAxis, showYAxis, showGrid, gridColor, axisColor, tickCount } = this.viewConfig
    const db = this.dataBounds

    // Grid lines
    if (showGrid) {
      ctx.strokeStyle = gridColor
      ctx.lineWidth = 1 / dpr
      const xTicks = DataMapper.calculateTicks(db.minX, db.maxX, tickCount)
      const yTicks = DataMapper.calculateTicks(db.minY, db.maxY, tickCount)
      const rangeX = db.maxX - db.minX || 1
      const rangeY = db.maxY - db.minY || 1
      const usableW = w - padding * 2
      const usableH = h - padding * 2

      xTicks.forEach(t => {
        const cx = padding + ((t - db.minX) / rangeX) * usableW
        ctx.beginPath(); ctx.moveTo(cx, padding); ctx.lineTo(cx, h - padding); ctx.stroke()
      })
      yTicks.forEach(t => {
        const cy = padding + usableH - ((t - db.minY) / rangeY) * usableH
        ctx.beginPath(); ctx.moveTo(padding, cy); ctx.lineTo(w - padding, cy); ctx.stroke()
      })
    }

    // Axes
    ctx.strokeStyle = axisColor
    ctx.lineWidth = 1.5 / dpr
    if (showXAxis) {
      ctx.beginPath()
      ctx.moveTo(padding, h - padding)
      ctx.lineTo(w - padding, h - padding)
      ctx.stroke()
    }
    if (showYAxis) {
      ctx.beginPath()
      ctx.moveTo(padding, padding)
      ctx.lineTo(padding, h - padding)
      ctx.stroke()
    }

    // Tick labels
    const rangeX = db.maxX - db.minX || 1
    const rangeY = db.maxY - db.minY || 1
    const usableW = w - padding * 2
    const usableH = h - padding * 2

    ctx.fillStyle = '#71717a'
    ctx.font = `${10 / dpr}px "Geist Mono", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    DataMapper.calculateTicks(db.minX, db.maxX, tickCount).forEach(t => {
      const cx = padding + ((t - db.minX) / rangeX) * usableW
      ctx.fillText(DataMapper.formatNumber(t), cx, h - padding + 6)
    })

    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    DataMapper.calculateTicks(db.minY, db.maxY, tickCount).forEach(t => {
      const cy = padding + usableH - ((t - db.minY) / rangeY) * usableH
      ctx.fillText(DataMapper.formatNumber(t), padding - 8, cy)
    })

    // Axis titles
    ctx.fillStyle = '#3f3f46'
    ctx.font = `500 ${11 / dpr}px "Geist", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(this.axisLabels.x.toUpperCase(), w / 2, h - 4)

    ctx.save()
    ctx.translate(14, h / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textBaseline = 'top'
    ctx.fillText(this.axisLabels.y.toUpperCase(), 0, 0)
    ctx.restore()

    // Interpolated bubbles for animation
    const bubbles: RenderedBubble[] = lerp < 1
      ? this.nextBubbles.map((nb, i) => {
          const ob = this.prevBubbles[i] ?? nb
          const t = easeOutCubic(lerp)
          return { ...nb, cx: ob.cx + (nb.cx - ob.cx) * t, cy: ob.cy + (nb.cy - ob.cy) * t, r: ob.r + (nb.r - ob.r) * t }
        })
      : this.renderedBubbles

    // Draw non-hovered first, then hovered on top
    const hovered = bubbles.find(b => b.index === this.hoveredIndex)
    const rest = bubbles.filter(b => b.index !== this.hoveredIndex)
    ;[...rest, ...(hovered ? [hovered] : [])].forEach(bubble => {
      const isHov = bubble.index === this.hoveredIndex
      this.drawMarker(ctx, bubble.cx, bubble.cy, isHov ? bubble.r * 1.22 : bubble.r, bubble.fillStyle, isHov)

      if (this.pointConfig.showValueLabels && bubble.point.value !== undefined) {
        ctx.fillStyle = '#3f3f46'
        ctx.font = `${9 / dpr}px "Geist Mono", monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(DataMapper.formatNumber(bubble.point.value), bubble.cx, bubble.cy)
      }
    })
  }

  private drawMarker(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, r: number,
    fillStyle: string, isHovered: boolean,
  ): void {
    const dpr = window.devicePixelRatio || 1
    ctx.beginPath()
    switch (this.pointConfig.markerShape) {
      case 'square':
        ctx.rect(cx - r, cy - r, r * 2, r * 2)
        break
      case 'diamond':
        ctx.moveTo(cx, cy - r)
        ctx.lineTo(cx + r, cy)
        ctx.lineTo(cx, cy + r)
        ctx.lineTo(cx - r, cy)
        ctx.closePath()
        break
      case 'triangle':
        ctx.moveTo(cx, cy - r)
        ctx.lineTo(cx + r * 0.87, cy + r * 0.5)
        ctx.lineTo(cx - r * 0.87, cy + r * 0.5)
        ctx.closePath()
        break
      default:
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
    }
    ctx.fillStyle = fillStyle
    ctx.fill()
    if (isHovered) {
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'
      ctx.lineWidth = 2 / dpr
      ctx.stroke()
    }
  }

  // ── Animation ──────────────────────────────────────────────────────────────

  private runAnimation(): void {
    cancelAnimationFrame(this.animationId)
    const step = (now: number) => {
      const elapsed = now - this.animStartTime
      const t = Math.min(elapsed / this.animDuration, 1)
      this.drawFrame(t)
      if (t < 1) {
        this.animationId = requestAnimationFrame(step)
      } else {
        this.renderedBubbles = this.nextBubbles
        this.isAnimating = false
        this.callbacks.onReady?.()
      }
    }
    this.animationId = requestAnimationFrame(step)
  }

  // ── Interaction (all coords in CSS pixels) ─────────────────────────────────

  handleMouseMove(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect()
    // CSS-pixel position relative to canvas
    const mx = clientX - rect.left
    const my = clientY - rect.top

    let found: RenderedBubble | null = null
    for (let i = this.renderedBubbles.length - 1; i >= 0; i--) {
      const b = this.renderedBubbles[i]
      if (Math.hypot(b.cx - mx, b.cy - my) <= b.r * 1.1) {
        found = b
        break
      }
    }

    const newIdx = found?.index ?? -1
    if (newIdx !== this.hoveredIndex) {
      this.hoveredIndex = newIdx
      this.callbacks.onPointHover?.(found?.point ?? null, newIdx)
      if (found) this.callbacks.onHoverPosition?.(mx, my)
      this.drawFrame()
    } else if (found) {
      // Update tooltip position even when same point
      this.callbacks.onHoverPosition?.(mx, my)
    }
  }

  handleClick(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect()
    const mx = clientX - rect.left
    const my = clientY - rect.top
    for (let i = this.renderedBubbles.length - 1; i >= 0; i--) {
      const b = this.renderedBubbles[i]
      if (Math.hypot(b.cx - mx, b.cy - my) <= b.r * 1.1) {
        this.callbacks.onPointClick?.(b.point, b.index)
        return
      }
    }
  }

  handleMouseLeave(): void {
    if (this.hoveredIndex !== -1) {
      this.hoveredIndex = -1
      this.callbacks.onPointHover?.(null, -1)
      this.drawFrame()
    }
  }

  handleResize(cssWidth: number, cssHeight: number): void {
    const dpr = window.devicePixelRatio || 1
    this.cssWidth = cssWidth
    this.cssHeight = cssHeight
    this.canvas.width = cssWidth * dpr
    this.canvas.height = cssHeight * dpr
    this.canvas.style.width = `${cssWidth}px`
    this.canvas.style.height = `${cssHeight}px`
    // Re-apply DPR scale after resize
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.renderedBubbles = this.computeBubbles(this.dataPoints)
    this.drawFrame()
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}
