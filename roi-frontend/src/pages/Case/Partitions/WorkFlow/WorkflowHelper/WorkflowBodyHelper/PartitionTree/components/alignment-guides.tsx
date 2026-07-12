import React from "react";
import { Panel, useViewport, useStore } from "@xyflow/react";
import type { AlignmentGuide } from "../utils/alignmentGuides";

// Guide line color – magenta/pink
const GUIDE_COLOR = "#E91E63";
const GUIDE_WIDTH = 1.5;
const GUIDE_DASH = "5 4";

type Props = {
  guides: AlignmentGuide[];
};

/**
 * Renders alignment guide lines on top of the React-Flow canvas.
 *
 * Uses React Flow's <Panel> for correct overlay placement (outside the viewport
 * transform layer) and useStore for reliable canvas dimensions.
 *
 * Guides are in flow-graph coordinates and are converted to screen pixels via
 * the current viewport transform (x, y, zoom).
 */
export function AlignmentGuides({ guides }: Props) {
  const { x: vpX, y: vpY, zoom } = useViewport();
  // useStore gives the actual pixel dimensions of the ReactFlow container
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);

  if (guides.length === 0) return null;

  return (
    // Panel renders outside the viewport transform so coordinates are screen-relative
    <Panel
      position="top-left"
      style={{
        margin: 0,
        padding: 0,
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      <svg
        width={width}
        height={height}
        style={{ display: "block", overflow: "visible" }}
        aria-hidden="true"
      >
        {guides.map((guide, i) => {
          if (guide.type === "vertical") {
            // Flow-x → screen-x:  sx = gx * zoom + vpX
            const sx = guide.position * zoom + vpX;
            return (
              <line
                key={`v-${i}`}
                x1={sx}
                y1={0}
                x2={sx}
                y2={height}
                stroke={GUIDE_COLOR}
                strokeWidth={GUIDE_WIDTH}
                strokeDasharray={GUIDE_DASH}
                strokeLinecap="round"
                opacity={0.9}
              />
            );
          } else {
            // Flow-y → screen-y:  sy = gy * zoom + vpY
            const sy = guide.position * zoom + vpY;
            return (
              <line
                key={`h-${i}`}
                x1={0}
                y1={sy}
                x2={width}
                y2={sy}
                stroke={GUIDE_COLOR}
                strokeWidth={GUIDE_WIDTH}
                strokeDasharray={GUIDE_DASH}
                strokeLinecap="round"
                opacity={0.9}
              />
            );
          }
        })}
      </svg>
    </Panel>
  );
}
