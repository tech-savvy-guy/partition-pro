import type {
  BubbleDataPoint,
  DataBounds,
  VisualBounds,
  ColorScale,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// BubbleChart — DataMapper
// Maps data-space coordinates → visual/world-space coordinates.
// Also provides colour, size, and tick utilities used by both 2D and 3D modes.
// ─────────────────────────────────────────────────────────────────────────────

export class DataMapper {
  private dataBounds: DataBounds
  private visualBounds: VisualBounds

  constructor(dataBounds: DataBounds, visualBounds: VisualBounds) {
    this.dataBounds = dataBounds
    this.visualBounds = visualBounds
  }

  // ── Linear map ─────────────────────────────────────────────────────────────

  private mapValue(
    value: number,
    dataMin: number,
    dataMax: number,
    worldMin: number,
    worldMax: number
  ): number {
    if (dataMax === dataMin) return (worldMin + worldMax) / 2
    return ((value - dataMin) / (dataMax - dataMin)) * (worldMax - worldMin) + worldMin
  }

  /** Maps a data point to 3D world coordinates */
  mapPoint(point: BubbleDataPoint): { x: number; y: number; z: number } {
    return {
      x: this.mapValue(point.x, this.dataBounds.minX, this.dataBounds.maxX, this.visualBounds.minX, this.visualBounds.maxX),
      y: this.mapValue(point.y, this.dataBounds.minY, this.dataBounds.maxY, this.visualBounds.minY, this.visualBounds.maxY),
      z: this.mapValue(point.z ?? 0, this.dataBounds.minZ, this.dataBounds.maxZ, this.visualBounds.minZ, this.visualBounds.maxZ),
    }
  }

  /** Maps a data point to 2D canvas coordinates (in px) */
  mapPoint2D(
    point: BubbleDataPoint,
    canvasWidth: number,
    canvasHeight: number,
    padding: number
  ): { x: number; y: number } {
    const usableW = canvasWidth - padding * 2
    const usableH = canvasHeight - padding * 2
    return {
      x: padding + this.mapValue(point.x, this.dataBounds.minX, this.dataBounds.maxX, 0, usableW),
      // Y is flipped in canvas space (0 at top)
      y: padding + usableH - this.mapValue(point.y, this.dataBounds.minY, this.dataBounds.maxY, 0, usableH),
    }
  }

  /** Maps a normalised value (0–1) to a bubble radius in px (2D) */
  mapRadius2D(
    sizeValue: number | undefined,
    minPx: number,
    maxPx: number
  ): number {
    if (sizeValue === undefined) return (minPx + maxPx) / 2
    const { minSize, maxSize } = this.dataBounds
    const norm = maxSize !== minSize ? (sizeValue - minSize) / (maxSize - minSize) : 0.5
    return minPx + Math.sqrt(Math.max(0, norm)) * (maxPx - minPx)
  }

  // ── Colour mapping ─────────────────────────────────────────────────────────

  /** Maps a normalised value 0–1 → { r, g, b } in [0, 1] range */
  static mapToColor(value: number, colorScale: ColorScale): { r: number; g: number; b: number } {
    const t = Math.max(0, Math.min(1, value))

    switch (colorScale) {
      case 'coolwarm':
        if (t < 0.5) {
          const s = t * 2
          return { r: 0.23 + s * 0.57, g: 0.29 + s * 0.3, b: 0.75 }
        } else {
          const s = (t - 0.5) * 2
          return { r: 0.80 + s * 0.09, g: 0.24 - s * 0.24, b: 0.1 - s * 0.1 }
        }

      case 'rainbow':
        return DataMapper.hslToRgb(t * 0.85, 1, 0.5)

      case 'plasma': {
        // Plasma: dark purple → magenta → orange → yellow
        const stops = [
          [0.05, 0.03, 0.53],
          [0.49, 0.01, 0.66],
          [0.80, 0.18, 0.47],
          [0.97, 0.46, 0.09],
          [0.94, 0.98, 0.13],
        ]
        return DataMapper.interpolateStops(t, stops)
      }

      case 'magma': {
        // Magma: black → dark purple → orange → light yellow
        const stops = [
          [0.00, 0.00, 0.02],
          [0.22, 0.07, 0.34],
          [0.59, 0.12, 0.34],
          [0.90, 0.37, 0.13],
          [0.99, 0.99, 0.74],
        ]
        return DataMapper.interpolateStops(t, stops)
      }

      case 'viridis':
      default: {
        // Viridis: deep purple → teal → yellow-green
        const stops = [
          [0.267, 0.004, 0.329],
          [0.229, 0.322, 0.545],
          [0.128, 0.567, 0.551],
          [0.369, 0.789, 0.383],
          [0.993, 0.906, 0.144],
        ]
        return DataMapper.interpolateStops(t, stops)
      }
    }
  }

  private static interpolateStops(t: number, stops: number[][]): { r: number; g: number; b: number } {
    const n = stops.length - 1
    const scaled = t * n
    const i = Math.min(Math.floor(scaled), n - 1)
    const f = scaled - i
    const a = stops[i]
    const b = stops[i + 1]
    return {
      r: a[0] + (b[0] - a[0]) * f,
      g: a[1] + (b[1] - a[1]) * f,
      b: a[2] + (b[2] - a[2]) * f,
    }
  }

  /** Converts r,g,b (0–1) to a CSS rgba string for use in 2D canvas */
  static colorToCSS(r: number, g: number, b: number, alpha = 1): string {
    return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`
  }

  private static hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    if (s === 0) return { r: l, g: l, b: l }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    return { r: hue2rgb(p, q, h + 1 / 3), g: hue2rgb(p, q, h), b: hue2rgb(p, q, h - 1 / 3) }
  }

  // ── Size mapping ───────────────────────────────────────────────────────────

  static mapToSize(
    value: number,
    minValue: number,
    maxValue: number,
    minSize: number,
    maxSize: number
  ): number {
    if (maxValue === minValue) return (minSize + maxSize) / 2
    const norm = (value - minValue) / (maxValue - minValue)
    return minSize + Math.sqrt(Math.max(0, norm)) * (maxSize - minSize)
  }

  // ── Bounds ─────────────────────────────────────────────────────────────────

  static calculateBoundsFromData(points: BubbleDataPoint[]): DataBounds {
    if (points.length === 0) {
      return { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1, minValue: 0, maxValue: 1, minSize: 0, maxSize: 1 }
    }

    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    let minValue = Infinity, maxValue = -Infinity
    let minSize = Infinity, maxSize = -Infinity

    for (const p of points) {
      minX = Math.min(minX, p.x);    maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y);    maxY = Math.max(maxY, p.y)
      const z = p.z ?? 0
      minZ = Math.min(minZ, z);      maxZ = Math.max(maxZ, z)
      if (p.value !== undefined) { minValue = Math.min(minValue, p.value); maxValue = Math.max(maxValue, p.value) }
      if (p.size  !== undefined) { minSize  = Math.min(minSize,  p.size);  maxSize  = Math.max(maxSize,  p.size)  }
    }

    const pad = (mn: number, mx: number, pct = 0.05) => {
      const d = (mx - mn) * pct || 0.1
      return [mn - d, mx + d]
    }

    const [pminX, pmaxX] = pad(minX, maxX)
    const [pminY, pmaxY] = pad(minY, maxY)
    const [pminZ, pmaxZ] = pad(minZ, maxZ)

    return {
      minX: pminX, maxX: pmaxX,
      minY: pminY, maxY: pmaxY,
      minZ: pminZ, maxZ: pmaxZ,
      minValue: minValue === Infinity ? 0 : minValue,
      maxValue: maxValue === -Infinity ? 1 : maxValue,
      minSize:  minSize  === Infinity ? 0 : minSize,
      maxSize:  maxSize  === -Infinity ? 1 : maxSize,
    }
  }

  // ── Ticks ──────────────────────────────────────────────────────────────────

  static calculateTicks(min: number, max: number, targetCount = 5): number[] {
    const range = max - min
    const roughStep = range / targetCount
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
    const norm = roughStep / magnitude
    let step: number
    if (norm <= 1.5)      step = 1 * magnitude
    else if (norm <= 3)   step = 2 * magnitude
    else if (norm <= 7)   step = 5 * magnitude
    else                  step = 10 * magnitude

    const ticks: number[] = []
    const start = Math.ceil(min / step) * step
    for (let t = start; t <= max; t += step) {
      ticks.push(Math.round(t * 1e6) / 1e6)
    }
    return ticks
  }

  static formatNumber(num: number): string {
    if (Math.abs(num) >= 10000) return num.toExponential(1)
    if (Number.isInteger(num)) return num.toString()
    return parseFloat(num.toFixed(2)).toString()
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  getDataBounds(): DataBounds { return { ...this.dataBounds } }
  getVisualBounds(): VisualBounds { return { ...this.visualBounds } }

  updateBounds(dataBounds: DataBounds, visualBounds: VisualBounds): void {
    this.dataBounds = dataBounds
    this.visualBounds = visualBounds
  }
}
