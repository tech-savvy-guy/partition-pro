import { BaseEdge, getSmoothStepPath, Position, type EdgeProps } from "@xyflow/react";
import { useTreeDefaults } from "./tree-defaults-context";

/**
 * Orthogonal tree edge whose horizontal "break" (the shared bus line that
 * sibling edges fan out from) sits at a fixed shoulder just below the parent
 * rather than at the geometric midpoint between parent and child.
 *
 * `getSmoothStepPath` always inserts a forced perpendicular stub of length
 * `offset` (default 20) at both the source and target. When `verticalGap` is
 * <= 2 * offset those two stubs overshoot and cross, producing zig-zag
 * artifacts. We therefore clamp `offset` to at most half the vertical span so
 * the stubs never cross, and use `stepPosition: 0` so the single bend lands at
 * that shoulder right below the parent — giving siblings one clean bus line at
 * any gap, and degrading gracefully to the midpoint for small gaps.
 */
export function TreeEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  const { layout } = useTreeDefaults();
  const span = targetY - sourceY;
  const shoulder = span > 0 ? Math.min(layout.edgeShoulder, span / 2) : layout.edgeShoulder;

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: sourcePosition ?? Position.Bottom,
    targetX,
    targetY,
    targetPosition: targetPosition ?? Position.Top,
    borderRadius: layout.edgeBorderRadius,
    offset: shoulder,
    stepPosition: 0,
  });

  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
