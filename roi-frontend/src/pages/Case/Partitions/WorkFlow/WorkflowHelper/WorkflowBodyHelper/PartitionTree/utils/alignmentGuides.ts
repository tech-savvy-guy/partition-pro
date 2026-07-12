import type { Node } from "@xyflow/react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlignmentAxis = "left" | "right" | "centerX" | "top" | "bottom" | "centerY";

export type AlignmentGuide = {
  /** "vertical" = a vertical line at a constant x position (spans full canvas height).
   *  "horizontal" = a horizontal line at a constant y position (spans full canvas width). */
  type: "vertical" | "horizontal";
  /** Position in flow-graph coordinates (not screen pixels). */
  position: number;
  alignmentType: AlignmentAxis;
};

export type NodeBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Snap / guide-appearance threshold in screen pixels (zoom-independent). */
export const SNAP_THRESHOLD_PX = 8;

import {
  NODE_HEIGHT,
  NODE_WIDTH,
  TREE_DEFAULTS,
  getPartitionNodeDimensions,
  type TreeLayoutDefaults,
} from "../treeDefaults";

/** Default dimensions for partition tree nodes (from treeDefaults.ts). */
export const DEFAULT_PARTITION_NODE_WIDTH = NODE_WIDTH;
export const DEFAULT_PARTITION_NODE_HEIGHT = NODE_HEIGHT;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the six alignment anchors (left, right, centerX, top, bottom, centerY)
 * for a given React-Flow node.
 *
 * For external nodes, uses node.style dimensions (the actual content size) rather
 * than node.measured (which includes resize handles and controls).
 *
 * For rotated nodes (node.data.rotation in degrees) the returned bounds are the
 * axis-aligned bounding box (AABB) of the rotated rectangle, so guides always
 * track the actual visual extents of the node.
 */
export function getNodeBounds(
  node: Node,
  layout: TreeLayoutDefaults = TREE_DEFAULTS.layout,
): NodeBounds {
  const isExternalNode = node.type === "external";
  const nodeType = (node.data as { nodeType?: "root" | "attribute" | "value" })?.nodeType;
  const typeDefaults = getPartitionNodeDimensions(nodeType ?? "value", layout);
  const defaultPartitionWidth = layout.partitionNodeWidth;
  const defaultPartitionHeight = layout.partitionNodeHeight;

  // For external nodes, prefer style.width/height (excludes handles/controls).
  // For partition nodes, prefer measured.width/height (includes auto-calculated size).
  const w = isExternalNode
    ? typeof node.style?.width === "number"
      ? node.style.width
      : typeof node.measured?.width === "number"
        ? node.measured.width
        : defaultPartitionWidth
    : typeof node.measured?.width === "number"
      ? node.measured.width
      : typeof node.style?.width === "number"
        ? node.style.width
        : typeDefaults.width;

  const h = isExternalNode
    ? typeof node.style?.height === "number"
      ? node.style.height
      : typeof node.measured?.height === "number"
        ? node.measured.height
        : defaultPartitionHeight
    : typeof node.measured?.height === "number"
      ? node.measured.height
      : typeof node.style?.height === "number"
        ? node.style.height
        : typeDefaults.height;

  // React Flow stores position as the top-left of the unrotated node.
  // The visual rotation (CSS transform) happens around the node center.
  const cx = node.position.x + w / 2;
  const cy = node.position.y + h / 2;

  const rotationDeg =
    typeof (node.data as Record<string, unknown>)?.rotation === "number"
      ? ((node.data as Record<string, unknown>).rotation as number)
      : 0;

  if (rotationDeg === 0) {
    // Fast path – no rotation
    return {
      left: node.position.x,
      top: node.position.y,
      right: node.position.x + w,
      bottom: node.position.y + h,
      centerX: cx,
      centerY: cy,
      width: w,
      height: h,
    };
  }

  // Compute the AABB of the rotated rectangle.
  // For a rectangle rotated by θ around its centre the half-extents are:
  //   halfW_aabb = (w/2)|cos θ| + (h/2)|sin θ|
  //   halfH_aabb = (w/2)|sin θ| + (h/2)|cos θ|
  const theta = (rotationDeg * Math.PI) / 180;
  const cosT = Math.abs(Math.cos(theta));
  const sinT = Math.abs(Math.sin(theta));
  const halfW = (w / 2) * cosT + (h / 2) * sinT;
  const halfH = (w / 2) * sinT + (h / 2) * cosT;

  return {
    left: cx - halfW,
    top: cy - halfH,
    right: cx + halfW,
    bottom: cy + halfH,
    centerX: cx,
    centerY: cy,
    width: halfW * 2,
    height: halfH * 2,
  };
}

// ─── Core algorithm ───────────────────────────────────────────────────────────

/**
 * Given a node being dragged and the full node list, compute:
 *  - which alignment guide lines should be shown, and
 *  - the snapped (x, y) position for the dragged node.
 *
 * @param draggedNode  The node currently being dragged (with its live position).
 * @param allNodes     All nodes in the canvas (including the dragged one – filtered internally).
 * @param zoom         Current viewport zoom level (used to convert px threshold → flow units).
 */
export function findAlignmentGuides(
  draggedNode: Node,
  allNodes: Node[],
  zoom: number,
  layout: TreeLayoutDefaults = TREE_DEFAULTS.layout,
): { guides: AlignmentGuide[]; snappedPosition: { x: number; y: number } } {
  // Convert the screen-pixel threshold to flow-coordinate units
  const threshold = SNAP_THRESHOLD_PX / Math.max(zoom, 0.1);

  const dragged = getNodeBounds(draggedNode, layout);

  // Accumulate all candidate guides and track the single best snap per axis
  const guideList: AlignmentGuide[] = [];
  let snapX = draggedNode.position.x;
  let snapY = draggedNode.position.y;
  let bestXDiff = Infinity;
  let bestYDiff = Infinity;

  for (const other of allNodes) {
    if (other.id === draggedNode.id) continue;
    if (other.hidden) continue;

    const ob = getNodeBounds(other, layout);

    // ── Vertical guides (align x-axis anchors) ──────────────────────────────
    //
    // We check all 9 combinations of the dragged-node's {left, centerX, right}
    // against the other-node's {left, centerX, right}.  The guide line is drawn
    // at the OTHER node's anchor position.  The snap shifts the dragged node so
    // that the matched dragged-anchor lands exactly on the other-anchor.
    //
    const xCombos: Array<{
      draggedAnchor: number;
      otherAnchor: number;
      guidePos: number;
      type: AlignmentAxis;
    }> = [
      // same-type alignments (most important – shown first so they win ties)
      { draggedAnchor: dragged.left,    otherAnchor: ob.left,    guidePos: ob.left,    type: "left" },
      { draggedAnchor: dragged.right,   otherAnchor: ob.right,   guidePos: ob.right,   type: "right" },
      { draggedAnchor: dragged.centerX, otherAnchor: ob.centerX, guidePos: ob.centerX, type: "centerX" },
      // cross-type alignments (e.g. dragged left near other right)
      { draggedAnchor: dragged.left,    otherAnchor: ob.right,   guidePos: ob.right,   type: "right" },
      { draggedAnchor: dragged.right,   otherAnchor: ob.left,    guidePos: ob.left,    type: "left" },
      { draggedAnchor: dragged.left,    otherAnchor: ob.centerX, guidePos: ob.centerX, type: "centerX" },
      { draggedAnchor: dragged.right,   otherAnchor: ob.centerX, guidePos: ob.centerX, type: "centerX" },
      { draggedAnchor: dragged.centerX, otherAnchor: ob.left,    guidePos: ob.left,    type: "left" },
      { draggedAnchor: dragged.centerX, otherAnchor: ob.right,   guidePos: ob.right,   type: "right" },
    ];

    for (const { draggedAnchor, otherAnchor, guidePos, type } of xCombos) {
      const diff = Math.abs(draggedAnchor - otherAnchor);
      if (diff > threshold) continue;

      // Compute what x the dragged node's origin needs to be to achieve alignment
      const candidateX = draggedNode.position.x + (otherAnchor - draggedAnchor);

      if (diff < bestXDiff) {
        bestXDiff = diff;
        snapX = candidateX;
      }
      guideList.push({ type: "vertical", position: guidePos, alignmentType: type });
      break; // take only the best match from this other-node for x
    }

    // ── Horizontal guides (align y-axis anchors) ─────────────────────────────
    const yCombos: Array<{
      draggedAnchor: number;
      otherAnchor: number;
      guidePos: number;
      type: AlignmentAxis;
    }> = [
      { draggedAnchor: dragged.top,     otherAnchor: ob.top,     guidePos: ob.top,     type: "top" },
      { draggedAnchor: dragged.bottom,  otherAnchor: ob.bottom,  guidePos: ob.bottom,  type: "bottom" },
      { draggedAnchor: dragged.centerY, otherAnchor: ob.centerY, guidePos: ob.centerY, type: "centerY" },
      { draggedAnchor: dragged.top,     otherAnchor: ob.bottom,  guidePos: ob.bottom,  type: "bottom" },
      { draggedAnchor: dragged.bottom,  otherAnchor: ob.top,     guidePos: ob.top,     type: "top" },
      { draggedAnchor: dragged.top,     otherAnchor: ob.centerY, guidePos: ob.centerY, type: "centerY" },
      { draggedAnchor: dragged.bottom,  otherAnchor: ob.centerY, guidePos: ob.centerY, type: "centerY" },
      { draggedAnchor: dragged.centerY, otherAnchor: ob.top,     guidePos: ob.top,     type: "top" },
      { draggedAnchor: dragged.centerY, otherAnchor: ob.bottom,  guidePos: ob.bottom,  type: "bottom" },
    ];

    for (const { draggedAnchor, otherAnchor, guidePos, type } of yCombos) {
      const diff = Math.abs(draggedAnchor - otherAnchor);
      if (diff > threshold) continue;

      const candidateY = draggedNode.position.y + (otherAnchor - draggedAnchor);

      if (diff < bestYDiff) {
        bestYDiff = diff;
        snapY = candidateY;
      }
      guideList.push({ type: "horizontal", position: guidePos, alignmentType: type });
      break;
    }
  }

  // ── Deduplicate guide lines by (type + position) ──────────────────────────
  const seen = new Set<string>();
  const guides = guideList.filter((g) => {
    const key = `${g.type}:${g.position.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    guides,
    snappedPosition: { x: snapX, y: snapY },
  };
}
