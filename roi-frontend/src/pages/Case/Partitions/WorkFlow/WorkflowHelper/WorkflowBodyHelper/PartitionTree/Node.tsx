import React, { useRef, useCallback } from "react";
import type { CSSProperties } from "react";
import type { NodeProps } from "@xyflow/react";
import {
  Handle,
  Position,
  NodeResizer,
  NodeResizeControl,
  ResizeControlVariant,
} from "@xyflow/react";
import { PlayFilledAlt, TrashCan, WatsonHealthRotate_360 } from "@carbon/icons-react";
import colorConfig from "./colors.json";
import CircleShapeIcon from "@/components/icons/CircleShapeIcon";
import DiamondShapeIcon from "@/components/icons/DiamondShapeIcon";
import { useTreeDefaults } from "./TreeDefaultsContext";
import {
  SHAPE_DEFAULTS,
  getExternalMinDimensions,
  getExternalShapeDefaults,
  getPartitionDefaultsForNodeType,
  resolvePartitionBorder,
  type BorderStyleValue,
  type ExternalNodeShape,
} from "./treeDefaults";

export type { ExternalNodeShape, BorderStyleValue };
export { SHAPE_DEFAULTS };

export type TreeNodeKind = "partition-tree" | "external";

export type NodeCustomizations = {
  customLabel?: string;
  customBackground?: string;
  customColor?: string;
  width?: number;
  height?: number;
  customBadgeScale?: number;
  customClientBadgeScale?: number;
  customClientBadgeOffsetX?: number;
  customClientBadgeOffsetY?: number;
  customSkuBadgeScale?: number;
  customSkuBadgeOffsetX?: number;
  customSkuBadgeOffsetY?: number;
  customFontSize?: number;
  customFontWeight?: string | number;
  customOpacity?: number;
  customBorderColor?: string;
  customBorderWidth?: number;
  customBorderStyle?: BorderStyleValue;
  customShadowColor?: string;
  customShadowBlur?: number;
  customShadowOffsetX?: number;
  customShadowOffsetY?: number;
  customTextAlign?: "left" | "center" | "right";
  customVerticalAlign?: "top" | "center" | "bottom";
  customPaddingX?: number;
  customPaddingY?: number;
};

export type BadgeColors = {
  clientSkuBg: string;
  clientSkuText: string;
  skuBg: string;
  skuText: string;
};

export type PartitionTreeNodeData = NodeCustomizations & {
  nodeKind?: "partition-tree";
  nodeName: string;
  nodeType: "root" | "attribute" | "value";
  skuCount?: number | null;
  clientSkuCount?: number | null;
  isClickable?: boolean;
  level?: number;
  hasChildren?: boolean;
  childCount?: number;
  parentId?: string | null;
  isCollapsed?: boolean;
  onToggleCollapse?: (nodeId: string) => void;
  editMode?: boolean;
  onRunWorkflow?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  badgeColors?: BadgeColors;
};

export type ExternalNodeCustomizations = {
  customLabel?: string;
  customBackground?: string;
  customColor?: string;
  shape?: ExternalNodeShape;
  textAlign?: "left" | "center" | "right";
  rotation?: number;
  fontSize?: number;
  fontWeight?: number | string;
  opacity?: number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: BorderStyleValue;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  tailOffsetX?: number;
  tailOffsetY?: number;
  paddingX?: number;
  paddingY?: number;
};

export type ExternalNodeData = ExternalNodeCustomizations & {
  nodeKind?: "external";
  label: string;
  shape: ExternalNodeShape;
  rotation?: number;
  onRotationChange?: (rotation: number) => void;
  onTailChange?: (tail: { x: number; y: number }) => void;
  onLabelChange?: (label: string) => void;
};

type ResizeHandlePosition =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

const RESIZE_POSITIONS: ResizeHandlePosition[] = [
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
];

const BASE_ANGLE: Record<ResizeHandlePosition, number> = {
  top: 0,
  "top-right": 45,
  right: 90,
  "bottom-right": 135,
  bottom: 180,
  "bottom-left": 225,
  left: 270,
  "top-left": 315,
};

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function cursorForHandle(position: ResizeHandlePosition, rotation: number): CSSProperties["cursor"] {
  const octantCursors: CSSProperties["cursor"][] = [
    "ns-resize",
    "nesw-resize",
    "ew-resize",
    "nwse-resize",
    "ns-resize",
    "nesw-resize",
    "ew-resize",
    "nwse-resize",
  ];
  const a = normalizeAngle(BASE_ANGLE[position] + rotation);
  const octant = Math.round(a / 45) % 8;
  return octantCursors[octant] ?? "move";
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const RESIZE_HANDLE_COLOR = "#3b82f6";
const SELECTION_OUTLINE = `dashed 1.5px ${RESIZE_HANDLE_COLOR}`;
const CALLOUT_ACCENT = "#4B5563";
const CALLOUT_FILL = "#6A9DD3";
const CALLOUT_DEFAULT_TAIL = { x: -40, y: 82 };
const SHARED_RESIZE_HANDLE_STYLE: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 4,
  background: "#ffffff",
  border: `1.5px solid ${RESIZE_HANDLE_COLOR}`,
};

function PartitionTreeNode(props: NodeProps) {
  const treeDefaults = useTreeDefaults();
  const layoutDefaults = treeDefaults.layout;
  const data = (props.data ?? {}) as PartitionTreeNodeData;
  const {
    nodeName,
    nodeType,
    skuCount,
    clientSkuCount,
    isClickable = true,
    level = 0,
    hasChildren = false,
    childCount = 0,
    isCollapsed = false,
    onToggleCollapse,
    customLabel,
    customBackground,
    customColor,
    customBadgeScale,
    customClientBadgeScale,
    customClientBadgeOffsetX,
    customClientBadgeOffsetY,
    customSkuBadgeScale,
    customSkuBadgeOffsetX,
    customSkuBadgeOffsetY,
    customFontSize,
    customFontWeight,
    customOpacity,
    customBorderColor,
    customBorderWidth,
    customBorderStyle,
    customShadowColor,
    customShadowBlur,
    customShadowOffsetX,
    customShadowOffsetY,
    customTextAlign,
    customVerticalAlign,
    customPaddingX,
    customPaddingY,
    editMode = false,
    onRunWorkflow,
    onDeleteNode,
    badgeColors,
  } = data;

  const partitionDefaults = getPartitionDefaultsForNodeType(nodeType ?? "value");

  const defaultBadgeColors: BadgeColors = {
    clientSkuBg: colorConfig.badges.clientSku.background,
    clientSkuText: colorConfig.badges.clientSku.text,
    skuBg: colorConfig.badges.sku.background,
    skuText: colorConfig.badges.sku.text,
  };

  const colors = badgeColors || defaultBadgeColors;
  const isSelected = props.selected === true;
  const [isHovered, setIsHovered] = React.useState(false);

  const getTextColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  };

  const styleByType = () => {
    if (nodeType === "root") {
      const bg = colorConfig.nodes.root.background;
      return { background: bg, color: getTextColor(bg), fontWeight: "bold" };
    }
    if (nodeType === "attribute") {
      return {
        background: colorConfig.nodes.attribute.background,
        color: colorConfig.nodes.attribute.text,
        fontWeight: "500",
        fontStyle: "italic",
        border: colorConfig.nodes.attribute.border,
      };
    }
    const palette = colorConfig.nodes.value.palette;
    const idx = (level - 1) % palette.length;
    const bg = isClickable ? palette[Math.max(0, idx)] : colorConfig.nodes.value.disabled;
    return {
      background: bg,
      color: getTextColor(bg),
      fontWeight: "bold",
      border: colorConfig.nodes.value.border,
    };
  };

  const baseStyles = styleByType();
  const styles = {
    background: customBackground ?? baseStyles.background,
    color: customColor ?? baseStyles.color,
    fontWeight: customFontWeight ?? baseStyles.fontWeight,
    fontStyle: (baseStyles as any).fontStyle,
    border: (baseStyles as any).border,
  };

  const borderStyle = resolvePartitionBorder(nodeType, {
    customBorderColor,
    customBorderWidth,
    customBorderStyle,
  });

  const boxShadowStyle =
    customShadowBlur != null && customShadowBlur > 0
      ? `${customShadowOffsetX ?? 0}px ${customShadowOffsetY ?? 0}px ${customShadowBlur}px ${customShadowColor ?? "rgba(0,0,0,0.3)"}`
      : undefined;

  const displayName = customLabel ?? nodeName;
  const showBadges = nodeType !== "attribute" && (skuCount != null || clientSkuCount != null);

  const scale = 1;
  const clientBadgeScale = customClientBadgeScale ?? customBadgeScale ?? 1;
  const skuBadgeScale = customSkuBadgeScale ?? customBadgeScale ?? 1;
  const labelFontSize = (customFontSize ?? partitionDefaults.fontSize) * scale;
  const clientBadgeFontSize = 8 * scale * clientBadgeScale;
  const skuBadgeFontSize = 8 * scale * skuBadgeScale;
  const controlFontSize = 8 * scale;
  const runButtonHeight = 20 * scale;
  const collapseButtonHeight = 14 * scale;
  const containerPaddingX = customPaddingX ?? partitionDefaults.paddingX;
  const containerPaddingY = customPaddingY ?? partitionDefaults.paddingY;
  const clientBadgePaddingX = 4 * scale * clientBadgeScale;
  const clientBadgePaddingY = 2 * scale * clientBadgeScale;
  const skuBadgePaddingX = 4 * scale * skuBadgeScale;
  const skuBadgePaddingY = 2 * scale * skuBadgeScale;
  const clientBadgeOffsetX = customClientBadgeOffsetX ?? 0;
  const clientBadgeOffsetY = customClientBadgeOffsetY ?? 0;
  const skuBadgeOffsetX = customSkuBadgeOffsetX ?? 0;
  const skuBadgeOffsetY = customSkuBadgeOffsetY ?? 0;

  const textAlign = customTextAlign ?? "center";
  const verticalAlign = customVerticalAlign ?? "center";
  const flexJustifyContent: CSSProperties["justifyContent"] =
    verticalAlign === "top" ? "flex-start" : verticalAlign === "bottom" ? "flex-end" : "center";
  const flexAlignItems: CSSProperties["alignItems"] =
    textAlign === "left" ? "flex-start" : textAlign === "right" ? "flex-end" : "center";

  return (
    <>
      <Handle type="target" position={Position.Top} className="border-0! !pointer-events-none" />
      <div
        className="relative w-full h-full"
        style={{ opacity: customOpacity != null ? customOpacity / 100 : undefined }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <NodeResizer
          isVisible={isSelected && editMode}
          minWidth={layoutDefaults.partitionMinWidth}
          minHeight={layoutDefaults.partitionMinHeight}
          color={RESIZE_HANDLE_COLOR}
          handleStyle={SHARED_RESIZE_HANDLE_STYLE}
        />
        <div
          className="w-full h-full"
          style={{
            minWidth: layoutDefaults.partitionMinWidth,
            minHeight: layoutDefaults.partitionMinHeight,
            backgroundColor: styles.background,
            color: styles.color,
            fontWeight: styles.fontWeight,
            fontStyle: styles.fontStyle,
            fontSize: `${labelFontSize}px`,
            border: borderStyle,
            boxShadow: boxShadowStyle,
            cursor: isClickable ? "pointer" : "default",
            outline: isSelected && editMode ? SELECTION_OUTLINE : "none",
            outlineOffset: "-1px",
            padding: `${containerPaddingY}px ${containerPaddingX}px`,
            display: "flex",
            flexDirection: "column",
            justifyContent: flexJustifyContent,
            alignItems: flexAlignItems,
          }}
        >
          <div
            className="truncate text-mono w-full min-w-0"
            style={{ fontWeight: styles.fontWeight, textAlign }}
            title={displayName}
          >
            {displayName}
          </div>
        </div>
        {isHovered && isClickable && nodeType !== "attribute" && onRunWorkflow && (
          <button
            type="button"
            data-download-ignore="true"
            className="nodrag nopan absolute left-1/2 -translate-x-1/2 px-1.5 flex items-center justify-center gap-0.5 rounded-sm font-bold leading-none border"
            style={{
              backgroundColor: styles.background,
              color: styles.color,
              borderColor: nodeType === "root" ? "#000000" : styles.color,
              top: `${-0.6 * runButtonHeight}px`,
              height: `${runButtonHeight}px`,
              fontSize: `${controlFontSize}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onRunWorkflow(props.id);
            }}
            title="Run workflow for this node"
          >
            <PlayFilledAlt size={Math.round(8 * scale)} className="mr-0.5" />
            Run
          </button>
        )}
        {isHovered && nodeType === "attribute" && onDeleteNode && (
          <button
            type="button"
            data-download-ignore="true"
            className="nodrag nopan absolute left-1/2 -translate-x-1/2 px-1.5 flex items-center justify-center gap-0.5 rounded-sm font-bold leading-none border"
            style={{
              backgroundColor: styles.background,
              color: styles.color,
              borderColor: styles.color,
              top: `${-0.6 * runButtonHeight}px`,
              height: `${runButtonHeight}px`,
              fontSize: `${controlFontSize}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNode(props.id);
            }}
            title="Delete this attribute branch"
          >
            <TrashCan size={Math.round(8 * scale)} className="mr-0.5" />
            Delete
          </button>
        )}
        {showBadges && clientSkuCount != null && (
          <div
            className="absolute rounded-sm font-semibold shadow-xs z-10 whitespace-nowrap"
            style={{
              backgroundColor: colors.clientSkuBg,
              color: colors.clientSkuText,
              fontSize: `${clientBadgeFontSize}px`,
              padding: `${clientBadgePaddingY}px ${clientBadgePaddingX}px`,
              right: `${-2 + clientBadgeOffsetX}px`,
              top: `${-2 + clientBadgeOffsetY}px`,
            }}
            title="Client SKU Count"
          >
            # {clientSkuCount}
          </div>
        )}
        {showBadges && skuCount != null && (
          <div
            className="absolute rounded-sm font-medium shadow-xs z-10 whitespace-nowrap"
            style={{
              backgroundColor: colors.skuBg,
              color: colors.skuText,
              border: colorConfig.badges.sku.border,
              fontSize: `${skuBadgeFontSize}px`,
              padding: `${skuBadgePaddingY}px ${skuBadgePaddingX}px`,
              right: `${-2 + skuBadgeOffsetX}px`,
              bottom: `${-2 + skuBadgeOffsetY}px`,
            }}
            title="SKU Count"
          >
            N = {skuCount}
          </div>
        )}
        {hasChildren && onToggleCollapse && (
          <button
            type="button"
            data-download-ignore="true"
            className="nodrag nopan absolute left-1/2 -translate-x-1/2 px-1 flex items-center justify-center rounded-full border border-gray-300 bg-white shadow-xs hover:bg-gray-50 font-bold text-gray-700 leading-none z-10"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(props.id);
            }}
            aria-label={isCollapsed ? "Expand" : "Collapse"}
            title={isCollapsed ? "Expand" : "Collapse"}
            style={{
              bottom: `${-0.4 * collapseButtonHeight}px`,
              minWidth: `${22 * scale}px`,
              height: `${collapseButtonHeight}px`,
              fontSize: `${controlFontSize}px`,
            }}
          >
            {isCollapsed ? `+${childCount}` : "-"}
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0 !pointer-events-none" />
    </>
  );
}

function ExternalTreeNode(props: NodeProps) {
  const treeDefaults = useTreeDefaults();
  const externalDefaults = treeDefaults.external;
  const data = (props.data ?? {}) as ExternalNodeData;
  const {
    label,
    shape = "box",
    customLabel,
    customBackground = shape === "callout" ? CALLOUT_FILL : "#C8102E",
    customColor = shape === "label" || shape === "callout" ? "#333333" : "#ffffff",
    textAlign = shape === "callout" ? "center" : "center",
    rotation = 0,
    onRotationChange,
    onTailChange,
    onLabelChange,
    fontSize,
    fontWeight = 500,
    opacity = 100,
    borderColor,
    borderWidth,
    borderStyle: borderLineStyle,
    shadowColor,
    shadowBlur = 0,
    shadowOffsetX = 0,
    shadowOffsetY = 0,
    tailOffsetX = CALLOUT_DEFAULT_TAIL.x,
    tailOffsetY = CALLOUT_DEFAULT_TAIL.y,
    paddingX,
    paddingY,
  } = data;

  const resolvedFontSize = fontSize ?? externalDefaults.fontSize;
  const resolvedBorderWidth = borderWidth ?? externalDefaults.borderWidth;
  const resolvedBorderStyle = borderLineStyle ?? externalDefaults.borderStyle;
  const resolvedPaddingX = paddingX ?? externalDefaults.paddingX;
  const resolvedPaddingY = paddingY ?? externalDefaults.paddingY;
  const shapeDefaults = getExternalShapeDefaults(shape);
  const minDims = getExternalMinDimensions();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSelected = props.selected === true;
  const isCalloutShape = shape === "callout";
  const [bodySize, setBodySize] = React.useState<{ width: number; height: number }>(shapeDefaults);
  const [isEditingCallout, setIsEditingCallout] = React.useState(false);
  const [calloutDraft, setCalloutDraft] = React.useState(customLabel ?? label);

  React.useEffect(() => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const updateSize = () => {
      setBodySize({
        width: el.offsetWidth || shapeDefaults.width,
        height: el.offsetHeight || shapeDefaults.height,
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [shape, shapeDefaults.height, shapeDefaults.width]);

  React.useEffect(() => {
    if (!isEditingCallout) setCalloutDraft(customLabel ?? label);
  }, [customLabel, isEditingCallout, label]);

  React.useEffect(() => {
    if (isEditingCallout) textareaRef.current?.focus();
  }, [isEditingCallout]);

  const handleRotateMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onRotationChange || !wrapperRef.current || isCalloutShape) return;

      const rect = wrapperRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const startRotation = rotation;

      const onMove = (moveE: MouseEvent) => {
        moveE.preventDefault();
        const currentAngle = Math.atan2(moveE.clientY - centerY, moveE.clientX - centerX);
        const deltaDeg = ((currentAngle - startAngle) * 180) / Math.PI;
        let newRotation = startRotation + deltaDeg;
        newRotation = ((newRotation % 360) + 360) % 360;
        onRotationChange(newRotation);
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [isCalloutShape, onRotationChange, rotation]
  );

  const handleTailMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onTailChange || !wrapperRef.current) return;

      const updateTail = (clientX: number, clientY: number) => {
        if (!wrapperRef.current) return;
        const rect = wrapperRef.current.getBoundingClientRect();
        const width = wrapperRef.current.offsetWidth || bodySize.width;
        const height = wrapperRef.current.offsetHeight || bodySize.height;
        const localX = ((clientX - rect.left) / rect.width) * width;
        const localY = ((clientY - rect.top) / rect.height) * height;
        onTailChange({
          x: Math.round(localX - width / 2),
          y: Math.round(localY - height / 2),
        });
      };

      const onMove = (moveE: MouseEvent) => {
        moveE.preventDefault();
        updateTail(moveE.clientX, moveE.clientY);
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [bodySize.height, bodySize.width, onTailChange],
  );

  const commitCalloutLabel = useCallback(() => {
    const next = calloutDraft.trim() || "Comment";
    onLabelChange?.(next);
    setCalloutDraft(next);
    setIsEditingCallout(false);
  }, [calloutDraft, onLabelChange]);

  const displayLabel = customLabel ?? label;
  const { width: minW, height: minH } = minDims;
  const keepAspectRatio = shape === "circle";
  const isLabelShape = shape === "label";
  const scale = 1;
  const scaledFontSize = resolvedFontSize * scale;
  const shapeTextFontSize = scaledFontSize;
  const textPaddingX = resolvedPaddingX;
  const textPaddingY = resolvedPaddingY;

  const hasBorderOverride =
    borderColor != null || borderWidth != null || borderLineStyle != null;
  const customBorderStyle = hasBorderOverride
    ? resolvedBorderStyle === "none"
      ? "none"
      : `${resolvedBorderWidth}px ${resolvedBorderStyle} ${borderColor ?? "#000000"}`
    : resolvedBorderStyle === "none"
      ? "none"
      : undefined;
  const svgBorderDasharray =
    resolvedBorderStyle === "dashed" ? "6 4" : resolvedBorderStyle === "dotted" ? "2 2" : undefined;
  const calloutBorderWidth = resolvedBorderWidth;
  const calloutBorderColor = borderColor ?? CALLOUT_ACCENT;
  const calloutFill = customBackground;
  const calloutHasFill = calloutFill !== "transparent";
  const calloutTail = (() => {
    const width = bodySize.width;
    const height = bodySize.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const endX = centerX + tailOffsetX;
    const endY = centerY + tailOffsetY;
    const absX = Math.abs(tailOffsetX);
    const absY = Math.abs(tailOffsetY);
    const edgeRatio =
      absX === 0 && absY === 0
        ? 1
        : Math.min(
            absX === 0 ? Number.POSITIVE_INFINITY : centerX / absX,
            absY === 0 ? Number.POSITIVE_INFINITY : centerY / absY,
          );
    const ratio = Number.isFinite(edgeRatio) ? Math.min(1, edgeRatio) : 1;
    const startX = centerX + tailOffsetX * ratio;
    const startY = centerY + tailOffsetY * ratio;
    const side =
      Math.abs(startY) < 0.5
        ? "top"
        : Math.abs(startY - height) < 0.5
          ? "bottom"
          : Math.abs(startX) < 0.5
            ? "left"
            : "right";
    const baseHalf = Math.min(28, Math.max(16, Math.min(width, height) * 0.22));
    const baseStart =
      side === "top" || side === "bottom"
        ? {
            x: clamp(startX - baseHalf, 0, width),
            y: side === "top" ? 0 : height,
          }
        : {
            x: side === "left" ? 0 : width,
            y: clamp(startY - baseHalf, 0, height),
          };
    const baseEnd =
      side === "top" || side === "bottom"
        ? {
            x: clamp(startX + baseHalf, 0, width),
            y: side === "top" ? 0 : height,
          }
        : {
            x: side === "left" ? 0 : width,
            y: clamp(startY + baseHalf, 0, height),
          };
    const pad = calloutBorderWidth + 3;
    const left = Math.min(0, endX) - pad;
    const top = Math.min(0, endY) - pad;
    const right = Math.max(width, endX) + pad;
    const bottom = Math.max(height, endY) + pad;
    const point = (x: number, y: number) => `${x - left},${y - top}`;
    const points =
      side === "bottom"
        ? [
            point(0, 0),
            point(width, 0),
            point(width, height),
            point(baseEnd.x, baseEnd.y),
            point(endX, endY),
            point(baseStart.x, baseStart.y),
            point(0, height),
          ]
        : side === "top"
          ? [
              point(0, 0),
              point(baseStart.x, baseStart.y),
              point(endX, endY),
              point(baseEnd.x, baseEnd.y),
              point(width, 0),
              point(width, height),
              point(0, height),
            ]
          : side === "left"
            ? [
                point(0, 0),
                point(width, 0),
                point(width, height),
                point(0, height),
                point(baseEnd.x, baseEnd.y),
                point(endX, endY),
                point(baseStart.x, baseStart.y),
              ]
            : [
                point(0, 0),
                point(width, 0),
                point(baseStart.x, baseStart.y),
                point(endX, endY),
                point(baseEnd.x, baseEnd.y),
                point(width, height),
                point(0, height),
              ];
    return {
      endX,
      endY,
      svgStyle: {
        left,
        top,
        width: right - left,
        height: bottom - top,
      } as CSSProperties,
      points: points.join(" "),
    };
  })();

  const dropShadowFilter =
    shadowBlur > 0
      ? `drop-shadow(${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor ?? "rgba(0,0,0,0.25)"})`
      : undefined;

  const shapeStyles: CSSProperties = {
    backgroundColor: isLabelShape ? "transparent" : customBackground,
    color: customColor,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    outline: isSelected ? SELECTION_OUTLINE : "none",
    outlineOffset: "-1px",
  };

  const renderShape = () => {
    switch (shape) {
      case "circle":
        return (
          <div className="relative flex items-center justify-center w-full h-full min-w-[40px] min-h-[40px] overflow-hidden">
            <CircleShapeIcon
              fill={customBackground}
              stroke={customBorderStyle ? borderColor ?? "#000000" : isSelected ? RESIZE_HANDLE_COLOR : "none"}
              strokeWidth={customBorderStyle ? resolvedBorderWidth : isSelected ? 2 : 0}
              strokeDasharray={
                customBorderStyle
                  ? svgBorderDasharray
                  : isSelected
                    ? "4 3"
                    : undefined
              }
            />
            <span
              className="relative z-10 truncate max-w-full text-center"
              style={{ color: customColor, fontSize: `${shapeTextFontSize}px`, fontWeight: fontWeight ?? 500, paddingInline: `${textPaddingX}px`, paddingBlock: `${textPaddingY}px` }}
            >
              {displayLabel}
            </span>
          </div>
        );
      case "box":
        return (
          <div className="rounded-xs flex items-center justify-center w-full h-full min-w-[40px] min-h-[40px]" style={{ ...shapeStyles, border: customBorderStyle }}>
            <span className="truncate max-w-full text-center" style={{ fontSize: `${shapeTextFontSize}px`, fontWeight: fontWeight ?? 500, paddingInline: `${textPaddingX}px`, paddingBlock: `${textPaddingY}px` }}>
              {displayLabel}
            </span>
          </div>
        );
      case "diamond":
        return (
          <div className="relative flex items-center justify-center w-full h-full min-w-[40px] min-h-[40px]">
            <DiamondShapeIcon
              fill={customBackground}
              stroke={customBorderStyle ? borderColor ?? "#000000" : "rgba(55,65,81,0.3)"}
              strokeWidth={customBorderStyle ? resolvedBorderWidth : 1}
              strokeDasharray={customBorderStyle ? svgBorderDasharray : undefined}
              isSelected={isSelected}
              selectionOutlineColor={RESIZE_HANDLE_COLOR}
            />
            <span
              className="relative z-10 truncate max-w-full text-center"
              style={{ color: customColor, fontSize: `${shapeTextFontSize}px`, fontWeight: fontWeight ?? 500, paddingInline: `${textPaddingX}px`, paddingBlock: `${textPaddingY}px` }}
            >
              {displayLabel}
            </span>
          </div>
        );
      case "label":
        return (
          <div
            className="flex items-center justify-center w-full h-full min-w-[60px] min-h-[24px] px-2"
            style={{
              backgroundColor: "transparent",
              color: customColor,
              border: customBorderStyle ?? (isSelected ? SELECTION_OUTLINE : "none"),
              boxShadow: "none",
            }}
          >
            <span className="truncate max-w-full text-center whitespace-nowrap" style={{ fontSize: `${scaledFontSize}px`, fontWeight: fontWeight ?? 500 }}>
              {displayLabel}
            </span>
          </div>
        );
      case "callout":
        return (
          <>
            <svg
              className="absolute overflow-visible pointer-events-none z-0"
              style={calloutTail.svgStyle}
              aria-hidden="true"
            >
              <polygon
                points={calloutTail.points}
                fill={calloutHasFill ? calloutFill : "transparent"}
                stroke={calloutBorderColor}
                strokeWidth={Math.max(1, calloutBorderWidth)}
                strokeDasharray={svgBorderDasharray}
                strokeLinejoin="miter"
              />
            </svg>
            <div
              className="relative z-10 flex h-full w-full min-h-[24px] min-w-[36px] items-center px-2 py-1"
              style={{
                backgroundColor: "transparent",
                color: customColor,
                border: "none",
                outline: isSelected ? SELECTION_OUTLINE : "none",
                outlineOffset: "-1px",
                justifyContent:
                  textAlign === "left"
                    ? "flex-start"
                    : textAlign === "right"
                      ? "flex-end"
                      : "center",
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingCallout(true);
              }}
              title="Double-click to edit comment"
            >
              {isEditingCallout ? (
                <textarea
                  ref={textareaRef}
                  data-download-ignore="true"
                  className="nodrag nopan h-full w-full resize-none bg-transparent p-0 outline-none"
                  style={{
                    color: customColor,
                    fontSize: `${shapeTextFontSize}px`,
                    fontWeight: fontWeight ?? 500,
                    lineHeight: 1.25,
                    textAlign,
                  }}
                  value={calloutDraft}
                  onChange={(e) => setCalloutDraft(e.target.value)}
                  onBlur={commitCalloutLabel}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setCalloutDraft(displayLabel);
                      setIsEditingCallout(false);
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      commitCalloutLabel();
                    }
                  }}
                />
              ) : (
                <div
                  className="w-full whitespace-pre-wrap break-words"
                  style={{
                    fontSize: `${shapeTextFontSize}px`,
                    fontWeight: fontWeight ?? 500,
                    lineHeight: 1.25,
                    textAlign,
                  }}
                >
                  {displayLabel}
                </div>
              )}
            </div>
            {isSelected && onTailChange && (
              <button
                type="button"
                data-download-ignore="true"
                className="nodrag nopan absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-600 shadow cursor-grab active:cursor-grabbing"
                style={{
                  left: `${calloutTail.endX}px`,
                  top: `${calloutTail.endY}px`,
                }}
                onMouseDown={handleTailMouseDown}
                aria-label="Move callout tail"
                title="Drag to move tail"
              />
            )}
          </>
        );
      default:
        return (
          <div className="rounded-xs flex items-center justify-center w-full h-full min-w-[40px] min-h-[40px]" style={{ ...shapeStyles, border: customBorderStyle }}>
            <span className="truncate max-w-full text-center" style={{ fontSize: `${shapeTextFontSize}px`, fontWeight: fontWeight ?? 500, paddingInline: `${textPaddingX}px`, paddingBlock: `${textPaddingY}px` }}>
              {displayLabel}
            </span>
          </div>
        );
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full overflow-visible"
      style={{ transform: isCalloutShape ? undefined : `rotate(${rotation}deg)`, opacity: opacity / 100, filter: dropShadowFilter }}
    >
      {isSelected &&
        RESIZE_POSITIONS.map((pos) => {
          return (
            <NodeResizeControl
              key={pos}
              position={pos}
              variant={ResizeControlVariant.Handle}
              minWidth={minW}
              minHeight={minH}
              keepAspectRatio={keepAspectRatio}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: "transparent",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                cursor: cursorForHandle(pos, isCalloutShape ? 0 : rotation),
              }}
            >
              <div style={SHARED_RESIZE_HANDLE_STYLE} />
            </NodeResizeControl>
          );
        })}
      <div className="relative w-full h-full flex items-center justify-center">
        {renderShape()}
        {isSelected && onRotationChange && !isCalloutShape && (
          <button
            type="button"
            className="nodrag nopan absolute left-1/2 -top-6 -translate-x-1/2 p-0.5 text-gray-500 hover:text-gray-700 cursor-grab active:cursor-grabbing transition-colors z-10"
            onMouseDown={handleRotateMouseDown}
            aria-label="Rotate"
            title="Drag to rotate"
          >
            <WatsonHealthRotate_360 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function TreeNode(props: NodeProps) {
  if (props.type === "external") return <ExternalTreeNode {...props} />;
  return <PartitionTreeNode {...props} />;
}

