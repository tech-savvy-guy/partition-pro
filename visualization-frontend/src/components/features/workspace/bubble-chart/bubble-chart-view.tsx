import { useEffect, useMemo, useRef } from "react"

import { Renderer2D } from "@/lib/bubble-chart/renderer-2d"
import { Renderer3D } from "@/lib/bubble-chart/renderer-3d"
import type {
  AxesConfig,
  AxisLabels,
  BubbleDataPoint,
  CameraConfig,
  ChartMode,
  FogConfig,
  PointConfig,
  View2DConfig,
} from "@/lib/bubble-chart/types"
import { cn } from "@/lib/utils"

type BubbleChartRenderer = Renderer2D | Renderer3D

export function BubbleChartView({
  data,
  mode,
  axisLabels,
  pointConfig,
  view2DConfig,
  axesConfig,
  cameraConfig,
  fogConfig,
  autoRotate = false,
  autoRotateSpeed = 0.5,
  className,
  onPointHover,
  onPointClick,
  onReady,
}: {
  data: BubbleDataPoint[]
  mode: ChartMode
  axisLabels?: Partial<AxisLabels>
  pointConfig?: Partial<PointConfig>
  view2DConfig?: Partial<View2DConfig>
  axesConfig?: Partial<AxesConfig>
  cameraConfig?: Partial<CameraConfig>
  fogConfig?: Partial<FogConfig>
  autoRotate?: boolean
  autoRotateSpeed?: number
  className?: string
  onPointHover?: (point: BubbleDataPoint | null, index: number) => void
  onPointClick?: (point: BubbleDataPoint, index: number) => void
  onReady?: () => void
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const labelLayerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<BubbleChartRenderer | null>(null)

  const resolvedAxisLabels = useMemo<AxisLabels>(
    () => ({
      x: axisLabels?.x ?? "X Axis",
      y: axisLabels?.y ?? "Y Axis",
      z: axisLabels?.z ?? "Z Axis",
    }),
    [axisLabels?.x, axisLabels?.y, axisLabels?.z]
  )

  // Latest data/labels exposed to the creation effect via refs so it does NOT
  // re-run (dispose + rebuild the whole renderer) on every data change. Data
  // updates flow through the lightweight `setData` effect below instead.
  const dataRef = useRef(data)
  const axisLabelsRef = useRef(resolvedAxisLabels)
  dataRef.current = data
  axisLabelsRef.current = resolvedAxisLabels

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    rendererRef.current?.dispose()
    rendererRef.current = null

    if (mode === "2d") {
      const canvas = canvasRef.current
      if (!canvas) return

      rendererRef.current = new Renderer2D(
        canvas,
        {
          onReady,
          onPointHover,
          onPointClick,
        },
        pointConfig,
        view2DConfig
      )
    } else {
      const labelLayer = labelLayerRef.current
      if (!labelLayer) return

      rendererRef.current = new Renderer3D(
        root,
        labelLayer,
        {
          onReady,
          onPointHover,
          onPointClick,
        },
        axesConfig,
        pointConfig,
        cameraConfig,
        fogConfig
      )
    }

    // Size the canvas to its container before the first draw. The shared
    // ResizeObserver below only fires when `root`'s size actually changes, so a
    // renderer created on a mode switch (root size unchanged) would otherwise
    // render at the default 300x150 backing store with no DPR transform.
    if (rendererRef.current instanceof Renderer2D) {
      const rect = root.getBoundingClientRect()
      rendererRef.current.handleResize(
        Math.max(1, Math.floor(rect.width)),
        Math.max(1, Math.floor(rect.height))
      )
    }

    rendererRef.current.setData(dataRef.current, axisLabelsRef.current)

    if (mode === "3d" && rendererRef.current instanceof Renderer3D) {
      rendererRef.current.setAutoRotate(autoRotate, autoRotateSpeed)
    }

    return () => {
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [
    axesConfig,
    autoRotate,
    autoRotateSpeed,
    cameraConfig,
    fogConfig,
    mode,
    onPointClick,
    onPointHover,
    onReady,
    pointConfig,
    view2DConfig,
  ])

  useEffect(() => {
    rendererRef.current?.setData(data, resolvedAxisLabels)
  }, [data, resolvedAxisLabels])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return

    renderer.updatePointConfig(pointConfig ?? {})

    if (mode === "2d" && renderer instanceof Renderer2D) {
      renderer.updateViewConfig(view2DConfig ?? {})
    }

    if (mode === "3d" && renderer instanceof Renderer3D) {
      renderer.setFog(fogConfig ?? {})
      renderer.setAutoRotate(autoRotate, autoRotateSpeed)
    }
  }, [
    autoRotate,
    autoRotateSpeed,
    fogConfig,
    mode,
    pointConfig,
    view2DConfig,
  ])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      const renderer = rendererRef.current
      if (!entry || !renderer) return

      const width = Math.max(1, Math.floor(entry.contentRect.width))
      const height = Math.max(1, Math.floor(entry.contentRect.height))

      if (renderer instanceof Renderer2D) {
        renderer.handleResize(width, height)
      } else {
        renderer.handleResize()
      }
    })

    resizeObserver.observe(root)

    return () => resizeObserver.disconnect()
  }, [])

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const renderer = rendererRef.current
    if (!renderer) return

    if (renderer instanceof Renderer2D) {
      renderer.handleMouseMove(event.clientX, event.clientY)
      return
    }

    renderer.handleMouseMove(event.clientX, event.clientY)
  }

  function handlePointerLeave() {
    rendererRef.current?.handleMouseLeave()
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const renderer = rendererRef.current
    if (!renderer) return

    if (renderer instanceof Renderer2D) {
      renderer.handleClick(event.clientX, event.clientY)
      return
    }

    renderer.handleClick(event.clientX, event.clientY)
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden bg-background",
        className
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    >
      {mode === "2d" && (
        <canvas
          ref={canvasRef}
          className="block size-full"
          aria-label="2D bubble chart"
        />
      )}
      <div
        ref={labelLayerRef}
        className={cn(
          "pointer-events-none absolute inset-0",
          mode === "2d" && "hidden"
        )}
        aria-hidden={mode === "2d"}
      />
    </div>
  )
}
