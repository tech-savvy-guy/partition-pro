import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DataMapper } from './data-mapper'
import type {
  BubbleDataPoint,
  DataBounds,
  VisualBounds,
  AxesConfig,
  PointConfig,
  CameraConfig,
  FogConfig,
  AxisLabels,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// BubbleChart — 3D Renderer
// Pure Three.js layer. No React, no DOM outside the provided canvas container.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_AXES_CONFIG: AxesConfig = {
  showGrid: true,
  showTicks: true,
  showLabels: true,
  showArrows: true,
  gridOpacity: 0.26,
  gridDivisions: 14,
  axisColors: { x: 0xe05252, y: 0x3db89c, z: 0x4a90d9 },
  labelColor: '#71717a',
  tickColor: 0xd4d4d8,
}

const DEFAULT_POINT_CONFIG: PointConfig = {
  colorScale: 'viridis',
  defaultSize: 0.12,
  minSize: 0.06,
  maxSize: 0.25,
  sphereSegments: 16,
  defaultColor: 0x4ecdc4,
  enableColorMapping: true,
  enableSizeMapping: true,
  opacity: 0.72,
  markerShape: 'circle',
  showValueLabels: false,
}

const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  fov: 75,
  near: 0.05,
  far: 1000,
  initialPosition: [12, 10, 12],
  enableDamping: true,
  dampingFactor: 0.08,
  minDistance: 0.3,
  maxDistance: 200,
  enablePan: false,
}

const DEFAULT_FOG_CONFIG: FogConfig = {
  enabled: true,
  near: 15,
  far: 40,
}

const VISUAL_BOUNDS: VisualBounds = {
  minX: -5, maxX: 5,
  minY: -5, maxY: 5,
  minZ: -5, maxZ: 5,
}

const BG_COLOR = '#f9f9f8'

export interface Renderer3DCallbacks {
  onReady?: () => void
  onPointHover?: (point: BubbleDataPoint | null, index: number) => void
  onPointClick?: (point: BubbleDataPoint, index: number) => void
  onHoverPosition?: (x: number, y: number) => void
}

// ─────────────────────────────────────────────────────────────────────────────

export class Renderer3D {
  // Three.js core
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer
  private controls!: OrbitControls

  // Scene objects
  private instancedMesh: THREE.InstancedMesh | null = null
  private hoverMesh: THREE.Mesh | null = null
  private axesGroup: THREE.Group | null = null
  private labelElements: HTMLDivElement[] = []

  // State
  private dataPoints: BubbleDataPoint[] = []
  private dataMapper!: DataMapper
  private dataBounds!: DataBounds
  private hoveredIndex = -1
  private isDirty = true
  private pendingReady = false
  private animationId = 0
  private updateLabels: (() => void) | null = null

  // Config (merged with defaults)
  private axesConfig: AxesConfig
  private pointConfig: PointConfig
  private cameraConfig: CameraConfig
  private fogConfig: FogConfig

  // DOM
  private container: HTMLDivElement
  private labelContainer: HTMLDivElement
  private callbacks: Renderer3DCallbacks

  constructor(
    container: HTMLDivElement,
    labelContainer: HTMLDivElement,
    callbacks: Renderer3DCallbacks,
    axesConfig?: Partial<AxesConfig>,
    pointConfig?: Partial<PointConfig>,
    cameraConfig?: Partial<CameraConfig>,
    fogConfig?: Partial<FogConfig>,
  ) {
    this.container = container
    this.labelContainer = labelContainer
    this.callbacks = callbacks
    this.axesConfig = { ...DEFAULT_AXES_CONFIG, ...axesConfig }
    this.pointConfig = { ...DEFAULT_POINT_CONFIG, ...pointConfig }
    this.cameraConfig = { ...DEFAULT_CAMERA_CONFIG, ...cameraConfig }
    this.fogConfig = { ...DEFAULT_FOG_CONFIG, ...fogConfig }
    this.dataBounds = DataMapper.calculateBoundsFromData([])
    this.dataMapper = new DataMapper(this.dataBounds, VISUAL_BOUNDS)

    this.initScene()
    this.initCamera()
    this.initRenderer()
    this.initLighting()
    this.initControls()
    this.initAxes()
    this.startLoop()
  }

  /** CSS pixel size of the chart container — must match `setSize(..., true)` so camera aspect equals the drawn canvas (avoids non-uniform stretch / oblong spheres). */
  private readViewportCssSize(): { w: number; h: number } {
    const w = Math.max(1, Math.floor(this.container.clientWidth))
    const h = Math.max(1, Math.floor(this.container.clientHeight))
    return { w, h }
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  private initScene(): void {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(BG_COLOR)
    if (this.fogConfig.enabled) {
      this.scene.fog = new THREE.Fog(BG_COLOR, this.fogConfig.near, this.fogConfig.far)
    }
  }

  private initCamera(): void {
    const { w, h } = this.readViewportCssSize()
    const cc = this.cameraConfig
    this.camera = new THREE.PerspectiveCamera(cc.fov, w / h, cc.near, cc.far)
    const [px, py, pz] = cc.initialPosition
    this.camera.position.set(px, py, pz)
    this.camera.lookAt(0, 0, 0)
  }

  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    const canvas = this.renderer.domElement
    canvas.style.display = 'block'
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    const { w, h } = this.readViewportCssSize()
    this.renderer.setSize(w, h, true)
    this.container.appendChild(canvas)
  }

  private initLighting(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(10, 15, 10)
    this.scene.add(dir)
    const fill = new THREE.DirectionalLight(0xffffff, 0.3)
    fill.position.set(-10, 5, -10)
    this.scene.add(fill)
  }

  private initControls(): void {
    const cc = this.cameraConfig
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = cc.enableDamping
    this.controls.dampingFactor = cc.dampingFactor
    this.controls.minDistance = cc.minDistance
    this.controls.maxDistance = cc.maxDistance
    this.controls.enablePan = true
    this.controls.screenSpacePanning = true
    this.controls.minPolarAngle = 0
    this.controls.maxPolarAngle = Math.PI
    this.controls.target.set(0, 0, 0)
    this.controls.addEventListener('change', () => { this.isDirty = true })
  }

  private initAxes(): void {
    this.axesGroup = this.buildAxes()
    this.scene.add(this.axesGroup)
  }

  // ── Axes construction ──────────────────────────────────────────────────────

  private buildAxes(): THREE.Group {
    const group = new THREE.Group()
    const { minX, maxX, minY, maxY, minZ, maxZ } = VISUAL_BOUNDS
    const ac = this.axesConfig
    const ext = 0.6

    // Origin dot (world origin — axes pass through here)
    const originMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshBasicMaterial({ color: 0xa1a1aa }))
    originMesh.position.set(0, 0, 0)
    group.add(originMesh)

    // Bidirectional axis lines + arrowheads at both ends
    const placeArrow = (tip: THREE.Vector3, outwardDir: THREE.Vector3, color: number) => {
      if (!ac.showArrows) return
      const d = outwardDir.clone().normalize()
      const coneH = 0.28, coneR = 0.07
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(coneR, coneH, 12),
        new THREE.MeshBasicMaterial({ color })
      )
      cone.position.copy(tip).addScaledVector(d, coneH / 2)
      const q = new THREE.Quaternion()
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)
      cone.setRotationFromQuaternion(q)
      group.add(cone)
    }

    const addBidirectionalAxis = (start: THREE.Vector3, end: THREE.Vector3, color: number) => {
      const geo = new THREE.BufferGeometry().setFromPoints([start, end])
      group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })))
      if (ac.showArrows) {
        const posOut = end.clone().sub(start).normalize()
        placeArrow(end, posOut, color)
        placeArrow(start, start.clone().sub(end).normalize(), color)
      }
    }

    addBidirectionalAxis(
      new THREE.Vector3(minX - ext, 0, 0),
      new THREE.Vector3(maxX + ext, 0, 0),
      ac.axisColors.x,
    )
    addBidirectionalAxis(
      new THREE.Vector3(0, minY - ext, 0),
      new THREE.Vector3(0, maxY + ext, 0),
      ac.axisColors.y,
    )
    addBidirectionalAxis(
      new THREE.Vector3(0, 0, minZ - ext),
      new THREE.Vector3(0, 0, maxZ + ext),
      ac.axisColors.z,
    )

    // Grid: full bounding box + mid-volume cross — finer divisions, softer depth write for depth when orbiting
    if (ac.showGrid) {
      const d = ac.gridDivisions
      const g = ac.gridOpacity
      const boxStrong = g * 1.32
      const boxWall = g * 1.02
      const boxSoft = g * 0.76
      const crossSlice = g * 0.5

      const addGrid = (m1: number, M1: number, m2: number, M2: number, fixed: number, plane: 'xz'|'xy'|'yz', opacity: number) => {
        const verts: number[] = []
        const s1 = (M1 - m1) / d, s2 = (M2 - m2) / d
        for (let i = 0; i <= d; i++) {
          const p1 = m1 + i * s1
          if (plane === 'xz') { verts.push(p1, fixed, m2, p1, fixed, M2) }
          else if (plane === 'xy') { verts.push(p1, m2, fixed, p1, M2, fixed) }
          else { verts.push(fixed, p1, m2, fixed, p1, M2) }
        }
        for (let i = 0; i <= d; i++) {
          const p2 = m2 + i * s2
          if (plane === 'xz') { verts.push(m1, fixed, p2, M1, fixed, p2) }
          else if (plane === 'xy') { verts.push(m1, p2, fixed, M1, p2, fixed) }
          else { verts.push(fixed, m1, p2, fixed, M1, p2) }
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
        const mat = new THREE.LineBasicMaterial({
          color: 0xd4d4d8,
          transparent: true,
          opacity: Math.min(1, opacity),
          depthWrite: false,
        })
        group.add(new THREE.LineSegments(geo, mat))
      }

      // Six faces of the visual bounds (immersive “room”)
      addGrid(minX, maxX, minZ, maxZ, minY, 'xz', boxStrong)
      addGrid(minX, maxX, minZ, maxZ, maxY, 'xz', boxSoft)
      addGrid(minX, maxX, minY, maxY, minZ, 'xy', boxWall)
      addGrid(minX, maxX, minY, maxY, maxZ, 'xy', boxSoft * 0.92)
      addGrid(minY, maxY, minZ, maxZ, minX, 'yz', boxWall)
      addGrid(minY, maxY, minZ, maxZ, maxX, 'yz', boxSoft)

      // Mid-volume cross through origin — strong depth / motion parallax when zoomed in
      addGrid(minY, maxY, minZ, maxZ, 0, 'yz', crossSlice)
      addGrid(minX, maxX, minZ, maxZ, 0, 'xz', crossSlice)
      addGrid(minX, maxX, minY, maxY, 0, 'xy', crossSlice)
    }

    return group
  }

  // ── HTML labels ────────────────────────────────────────────────────────────

  buildLabels(axisLabels: AxisLabels): void {
    // Clear old labels
    this.labelElements.forEach(el => el.remove())
    this.labelElements = []

    if (!this.axesConfig.showLabels) {
      this.updateLabels = null
      return
    }

    const mapper = new DataMapper(this.dataBounds, VISUAL_BOUNDS)
    const { maxX, maxY, maxZ } = VISUAL_BOUNDS
    const lc = this.axesConfig.labelColor

    const mkLabel = (
      text: string,
      wx: number, wy: number, wz: number,
      isTick: boolean
    ): HTMLDivElement => {
      const el = document.createElement('div')
      el.textContent = text
      el.style.cssText = `
        position:absolute;pointer-events:none;white-space:nowrap;
        transform:translate(-50%,-50%);user-select:none;
        color:${lc};
        ${isTick
          ? 'font-size:10px;font-weight:400;font-family:"Geist Mono","Geist Mono Fallback",monospace;letter-spacing:-0.01em;'
          : 'font-size:11px;font-weight:500;font-family:"Geist","Geist Fallback",sans-serif;letter-spacing:-0.02em;text-transform:uppercase;'
        }
      `
      el.dataset.wx = wx.toString()
      el.dataset.wy = wy.toString()
      el.dataset.wz = wz.toString()
      this.labelContainer.appendChild(el)
      this.labelElements.push(el)
      return el
    }

    const xTicks = DataMapper.calculateTicks(this.dataBounds.minX, this.dataBounds.maxX, 5)
    const yTicks = DataMapper.calculateTicks(this.dataBounds.minY, this.dataBounds.maxY, 5)
    const zTicks = DataMapper.calculateTicks(this.dataBounds.minZ, this.dataBounds.maxZ, 5)

    const axisExt = 0.6
    xTicks.forEach(t => {
      const wp = mapper.mapPoint({ x: t, y: this.dataBounds.minY, z: this.dataBounds.minZ })
      mkLabel(DataMapper.formatNumber(t), wp.x, -0.55, 0, true)
    })
    yTicks.forEach(t => {
      const wp = mapper.mapPoint({ x: this.dataBounds.minX, y: t, z: this.dataBounds.minZ })
      mkLabel(DataMapper.formatNumber(t), -0.55, wp.y, 0, true)
    })
    zTicks.forEach(t => {
      const wp = mapper.mapPoint({ x: this.dataBounds.minX, y: this.dataBounds.minY, z: t })
      mkLabel(DataMapper.formatNumber(t), -0.55, 0, wp.z, true)
    })

    mkLabel(axisLabels.x, maxX + axisExt + 0.45, 0, 0, false)
    mkLabel(axisLabels.y, 0, maxY + axisExt + 0.45, 0, false)
    mkLabel(axisLabels.z, 0, 0, maxZ + axisExt + 0.45, false)

    this.updateLabels = () => {
      const rect = this.labelContainer.getBoundingClientRect()
      const tmp = new THREE.Vector3()
      this.labelElements.forEach(el => {
        tmp.set(parseFloat(el.dataset.wx!), parseFloat(el.dataset.wy!), parseFloat(el.dataset.wz!))
        tmp.project(this.camera)
        const x = (tmp.x * 0.5 + 0.5) * rect.width
        const y = (-tmp.y * 0.5 + 0.5) * rect.height
        if (tmp.z > 1) { el.style.display = 'none' }
        else { el.style.display = 'block'; el.style.left = `${x}px`; el.style.top = `${y}px` }
      })
    }
  }

  // ── Points ─────────────────────────────────────────────────────────────────

  private applyPointMaterialSettings(mat: THREE.MeshStandardMaterial): void {
    const pc = this.pointConfig
    const transparent = pc.opacity < 1
    mat.opacity = pc.opacity
    mat.transparent = transparent
    // See-through bubbles: skip depth write so overlapping spheres don’t punch holes in each other
    mat.depthWrite = !transparent
    mat.roughness = 0.35
    mat.metalness = 0.08
  }

  private buildInstancedMesh(count: number): THREE.InstancedMesh {
    const geo = new THREE.SphereGeometry(1, this.pointConfig.sphereSegments, this.pointConfig.sphereSegments)
    const mat = new THREE.MeshStandardMaterial()
    this.applyPointMaterialSettings(mat)
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(count, 1))
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(count, 1) * 3), 3)
    return mesh
  }

  private buildHoverMesh(): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        roughness: 0.2,
        depthWrite: false,
      })
    )
  }

  private applyInstances(points: BubbleDataPoint[]): void {
    if (!this.instancedMesh) return
    const matrix = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()
    const pc = this.pointConfig
    const { minValue, maxValue, minSize, maxSize } = this.dataBounds

    points.forEach((point, i) => {
      const wp = this.dataMapper.mapPoint(point)
      pos.set(wp.x, wp.y, wp.z)

      let sz = pc.defaultSize
      if (pc.enableSizeMapping && point.size !== undefined) {
        sz = DataMapper.mapToSize(point.size, minSize, maxSize, pc.minSize, pc.maxSize)
      }
      scale.set(sz, sz, sz)
      matrix.compose(pos, q, scale)
      this.instancedMesh!.setMatrixAt(i, matrix)

      // Inputs are sRGB-encoded (hex picker / colour scales). Tag them as such so
      // three's colour management converts them correctly — otherwise they're
      // treated as linear and the rendered colour looks lighter / off-hue versus
      // the selected swatch.
      const explicit = point.color ? DataMapper.hexToRgb(point.color) : null
      if (explicit) {
        color.setRGB(explicit.r, explicit.g, explicit.b, THREE.SRGBColorSpace)
      } else if (pc.enableColorMapping && point.value !== undefined) {
        const norm = maxValue !== minValue ? (point.value - minValue) / (maxValue - minValue) : 0.5
        const rgb = DataMapper.mapToColor(norm, pc.colorScale)
        color.setRGB(rgb.r, rgb.g, rgb.b, THREE.SRGBColorSpace)
      } else {
        color.setHex(pc.defaultColor, THREE.SRGBColorSpace)
      }
      this.instancedMesh!.setColorAt(i, color)
    })

    this.instancedMesh.instanceMatrix.needsUpdate = true
    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true
    this.instancedMesh.count = points.length
  }

  // ── Animation loop ─────────────────────────────────────────────────────────

  private startLoop(): void {
    const tick = () => {
      this.animationId = requestAnimationFrame(tick)
      this.controls.update()
      if (this.isDirty) {
        this.renderer.render(this.scene, this.camera)
        this.updateLabels?.()
        this.isDirty = false
        if (this.pendingReady) {
          this.pendingReady = false
          this.callbacks.onReady?.()
        }
      }
    }
    tick()
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setData(points: BubbleDataPoint[], axisLabels: AxisLabels): void {
    this.dataPoints = points
    this.dataBounds = DataMapper.calculateBoundsFromData(points)
    this.dataMapper = new DataMapper(this.dataBounds, VISUAL_BOUNDS)

    // Reuse the existing instanced mesh whenever its allocated capacity is large
    // enough. Colour/position-only updates (e.g. dragging the colour picker) then
    // just rewrite the instance buffers instead of disposing and reallocating the
    // whole mesh, which keeps interaction smooth.
    const capacity = this.instancedMesh?.instanceMatrix.count ?? 0
    if (!this.instancedMesh || capacity < points.length) {
      if (this.instancedMesh) {
        this.scene.remove(this.instancedMesh)
        this.instancedMesh.geometry.dispose()
        ;(this.instancedMesh.material as THREE.Material).dispose()
      }
      this.instancedMesh = this.buildInstancedMesh(Math.max(points.length, 1))
      this.scene.add(this.instancedMesh)
    }

    if (!this.hoverMesh) {
      this.hoverMesh = this.buildHoverMesh()
      this.hoverMesh.visible = false
      this.scene.add(this.hoverMesh)
    }

    this.applyInstances(points)
    this.buildLabels(axisLabels)

    this.isDirty = true
    this.pendingReady = true
  }

  updatePointConfig(config: Partial<PointConfig>): void {
    this.pointConfig = { ...this.pointConfig, ...config }
    if (this.instancedMesh) {
      this.applyPointMaterialSettings(this.instancedMesh.material as THREE.MeshStandardMaterial)
    }
    this.applyInstances(this.dataPoints)
    this.isDirty = true
    this.pendingReady = true
  }

  setAutoRotate(enabled: boolean, speed = 0.5): void {
    this.controls.autoRotate = enabled
    this.controls.autoRotateSpeed = speed
    this.isDirty = true
  }

  setFog(config: Partial<FogConfig>): void {
    this.fogConfig = { ...this.fogConfig, ...config }
    if (this.fogConfig.enabled) {
      this.scene.fog = new THREE.Fog(BG_COLOR, this.fogConfig.near, this.fogConfig.far)
    } else {
      this.scene.fog = null
    }
    this.isDirty = true
  }

  handleMouseMove(clientX: number, clientY: number): void {
    if (!this.instancedMesh || !this.dataPoints.length) return
    const rect = this.container.getBoundingClientRect()
    const { w, h } = this.readViewportCssSize()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / w) * 2 - 1,
      -((clientY - rect.top) / h) * 2 + 1
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, this.camera)
    const hits = raycaster.intersectObject(this.instancedMesh)

    if (hits.length > 0 && hits[0].instanceId !== undefined) {
      const idx = hits[0].instanceId
      if (idx !== this.hoveredIndex) {
        this.hoveredIndex = idx
        this.callbacks.onPointHover?.(this.dataPoints[idx], idx)
        this.callbacks.onHoverPosition?.(clientX - rect.left, clientY - rect.top)

        if (this.hoverMesh) {
          const m = new THREE.Matrix4()
          this.instancedMesh.getMatrixAt(idx, m)
          const p = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion()
          m.decompose(p, q, s)
          this.hoverMesh.position.copy(p)
          this.hoverMesh.scale.copy(s).multiplyScalar(1.6)
          this.hoverMesh.visible = true
        }
      }
    } else {
      if (this.hoveredIndex !== -1) {
        this.hoveredIndex = -1
        this.callbacks.onPointHover?.(null, -1)
        if (this.hoverMesh) this.hoverMesh.visible = false
      }
    }
    this.isDirty = true
  }

  handleClick(clientX: number, clientY: number): void {
    if (!this.instancedMesh || !this.dataPoints.length) return
    const rect = this.container.getBoundingClientRect()
    const { w, h } = this.readViewportCssSize()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / w) * 2 - 1,
      -((clientY - rect.top) / h) * 2 + 1
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, this.camera)
    const hits = raycaster.intersectObject(this.instancedMesh)
    if (hits.length > 0 && hits[0].instanceId !== undefined) {
      const idx = hits[0].instanceId
      this.callbacks.onPointClick?.(this.dataPoints[idx], idx)
    }
  }

  handleMouseLeave(): void {
    this.hoveredIndex = -1
    this.callbacks.onPointHover?.(null, -1)
    if (this.hoverMesh) this.hoverMesh.visible = false
    this.isDirty = true
  }

  handleResize(): void {
    const { w, h } = this.readViewportCssSize()
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, true)
    this.isDirty = true
  }

  dispose(): void {
    cancelAnimationFrame(this.animationId)
    this.controls.dispose()
    this.labelElements.forEach(el => el.remove())
    this.instancedMesh?.geometry.dispose()
    ;(this.instancedMesh?.material as THREE.Material | undefined)?.dispose()
    this.hoverMesh?.geometry.dispose()
    ;(this.hoverMesh?.material as THREE.Material | undefined)?.dispose()
    this.renderer.dispose()
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
