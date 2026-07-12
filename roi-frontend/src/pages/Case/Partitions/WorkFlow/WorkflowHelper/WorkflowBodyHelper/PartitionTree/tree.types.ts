import type { Node } from "@xyflow/react";
import type { NodeCustomizations } from "./Node";

import type { ExternalNodeCustomizations } from "./Node";
import { SHAPE_DEFAULTS, TREE_DEFAULTS, getPartitionNodeDimensions } from "./treeDefaults";
import type { BorderStyleValue, ExternalNodeShape, PartitionNodeType } from "./treeDefaults";

export type TreeLayoutDefaultsConfig = {
  verticalGap: number;
  horizontalGap: number;
  edgeShoulder: number;
  edgeBorderRadius: number;
  partitionNodeWidth: number;
  partitionNodeHeight: number;
  attributeNodeWidth: number;
  attributeNodeHeight: number;
  partitionMinWidth: number;
  partitionMinHeight: number;
};

export type TreePersistedExternalNode = {
  id: string;
  position: { x: number; y: number };
  shape: ExternalNodeShape;
  width: number;
  height: number;
  label: string;
  customLabel?: string;
  customBackground?: string;
  customColor?: string;
  textAlign?: "left" | "center" | "right";
  rotation?: number;
  fontSize?: number;
  fontWeight?: number | string;
  paddingX?: number;
  paddingY?: number;
  // Effects
  opacity?: number;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: BorderStyleValue;
  // Shadow
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  tailOffsetX?: number;
  tailOffsetY?: number;
};

export type BadgeColorsConfig = {
  clientSkuBg: string;
  clientSkuText: string;
  skuBg: string;
  skuText: string;
};

export type ViewportConfig = {
  x: number;
  y: number;
  zoom: number;
};

export type TreePersistedState = {
  externalNodes: TreePersistedExternalNode[];
  nodeOverrides: Record<string, Partial<NodeCustomizations>>;
  nodePositionOverrides: Record<string, { x: number; y: number }>;
  collapsedNodeIds: string[];
  badgeColors?: BadgeColorsConfig;
  treeLayoutDefaults?: TreeLayoutDefaultsConfig;
  viewport?: ViewportConfig;
  partitionTitle?: string;
};

const LAYOUT_DEFAULT_KEYS: (keyof TreeLayoutDefaultsConfig)[] = [
  "verticalGap",
  "horizontalGap",
  "edgeShoulder",
  "edgeBorderRadius",
  "partitionNodeWidth",
  "partitionNodeHeight",
  "attributeNodeWidth",
  "attributeNodeHeight",
  "partitionMinWidth",
  "partitionMinHeight",
];

function parseTreeLayoutDefaults(raw: unknown): TreeLayoutDefaultsConfig | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const overrides: Partial<TreeLayoutDefaultsConfig> = {};
  for (const key of LAYOUT_DEFAULT_KEYS) {
    const v = o[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      overrides[key] = v;
    }
  }
  if (Object.keys(overrides).length === 0) return undefined;
  return { ...TREE_DEFAULTS.layout, ...overrides };
}

const VALID_SHAPES: ExternalNodeShape[] = ["circle", "box", "diamond", "label", "callout"];

function isExternalNodeShape(s: unknown): s is ExternalNodeShape {
  return typeof s === "string" && VALID_SHAPES.includes(s as ExternalNodeShape);
}

export function deserializeTreeState(json: string | null): TreePersistedState | null {
  if (json == null || json === "") return null;
  try {
    const raw = JSON.parse(json) as unknown;
    if (raw == null || typeof raw !== "object") return null;

    const externalNodes: TreePersistedExternalNode[] = [];
    const extArr = Array.isArray((raw as { externalNodes?: unknown }).externalNodes)
      ? (raw as { externalNodes: unknown[] }).externalNodes
      : [];
    for (const item of extArr) {
      if (item == null || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      const shape = isExternalNodeShape(o.shape) ? o.shape : "box";
      const pos = o.position && typeof o.position === "object" && "x" in o.position && "y" in o.position
        ? { x: Number((o.position as { x: unknown }).x) || 0, y: Number((o.position as { y: unknown }).y) || 0 }
        : { x: 0, y: 0 };
      const dims = SHAPE_DEFAULTS[shape];
      const width = typeof o.width === "number" ? o.width : dims?.width ?? 80;
      const height = typeof o.height === "number" ? o.height : dims?.height ?? 80;
      const label = typeof o.label === "string" ? o.label : shape.charAt(0).toUpperCase() + shape.slice(1);
      externalNodes.push({
        id,
        position: pos,
        shape,
        width,
        height,
        label,
        customLabel: typeof o.customLabel === "string" ? o.customLabel : undefined,
        customBackground: typeof o.customBackground === "string" ? o.customBackground : undefined,
        customColor: typeof o.customColor === "string" ? o.customColor : undefined,
        textAlign:
          o.textAlign === "left" || o.textAlign === "center" || o.textAlign === "right"
            ? o.textAlign
            : undefined,
        rotation: typeof o.rotation === "number" ? o.rotation : undefined,
        fontSize: typeof o.fontSize === "number" ? o.fontSize : undefined,
        fontWeight: typeof o.fontWeight === "number" || typeof o.fontWeight === "string" ? o.fontWeight : undefined,
        paddingX: typeof o.paddingX === "number" ? o.paddingX : undefined,
        paddingY: typeof o.paddingY === "number" ? o.paddingY : undefined,
        opacity: typeof o.opacity === "number" ? o.opacity : undefined,
        borderColor: typeof o.borderColor === "string" ? o.borderColor : undefined,
        borderWidth: typeof o.borderWidth === "number" ? o.borderWidth : undefined,
        borderStyle:
          o.borderStyle === "solid" ||
          o.borderStyle === "dashed" ||
          o.borderStyle === "dotted" ||
          o.borderStyle === "none"
            ? o.borderStyle
            : undefined,
        shadowColor: typeof o.shadowColor === "string" ? o.shadowColor : undefined,
        shadowBlur: typeof o.shadowBlur === "number" ? o.shadowBlur : undefined,
        shadowOffsetX: typeof o.shadowOffsetX === "number" ? o.shadowOffsetX : undefined,
        shadowOffsetY: typeof o.shadowOffsetY === "number" ? o.shadowOffsetY : undefined,
        tailOffsetX: typeof o.tailOffsetX === "number" ? o.tailOffsetX : undefined,
        tailOffsetY: typeof o.tailOffsetY === "number" ? o.tailOffsetY : undefined,
      });
    }

    const nodeOverridesRaw = (raw as { nodeOverrides?: unknown }).nodeOverrides;
    const nodeOverrides: Record<string, Partial<NodeCustomizations>> =
      nodeOverridesRaw && typeof nodeOverridesRaw === "object" && !Array.isArray(nodeOverridesRaw)
        ? (nodeOverridesRaw as Record<string, Partial<NodeCustomizations>>)
        : {};

    const posOverridesRaw = (raw as { nodePositionOverrides?: unknown }).nodePositionOverrides;
    const nodePositionOverrides: Record<string, { x: number; y: number }> =
      posOverridesRaw && typeof posOverridesRaw === "object" && !Array.isArray(posOverridesRaw)
        ? (posOverridesRaw as Record<string, { x: number; y: number }>)
        : {};

    const collapsedRaw = (raw as { collapsedNodeIds?: unknown }).collapsedNodeIds;
    const collapsedNodeIds: string[] = Array.isArray(collapsedRaw)
      ? collapsedRaw.filter((x): x is string => typeof x === "string")
      : [];

    const badgeColorsRaw = (raw as { badgeColors?: unknown }).badgeColors;
    const badgeColors: BadgeColorsConfig | undefined =
      badgeColorsRaw && typeof badgeColorsRaw === "object" && !Array.isArray(badgeColorsRaw)
        ? (badgeColorsRaw as BadgeColorsConfig)
        : undefined;

    const viewportRaw = (raw as { viewport?: unknown }).viewport;
    const viewport: ViewportConfig | undefined =
      viewportRaw &&
      typeof viewportRaw === "object" &&
      !Array.isArray(viewportRaw) &&
      typeof (viewportRaw as Record<string, unknown>).x === "number" &&
      typeof (viewportRaw as Record<string, unknown>).y === "number" &&
      typeof (viewportRaw as Record<string, unknown>).zoom === "number"
        ? {
            x: (viewportRaw as { x: number }).x,
            y: (viewportRaw as { y: number }).y,
            zoom: (viewportRaw as { zoom: number }).zoom,
          }
        : undefined;

    const partitionTitleRaw = (raw as { partitionTitle?: unknown }).partitionTitle;
    const partitionTitle =
      typeof partitionTitleRaw === "string" && partitionTitleRaw.trim().length > 0
        ? partitionTitleRaw.trim()
        : undefined;

    const treeLayoutDefaults = parseTreeLayoutDefaults(
      (raw as { treeLayoutDefaults?: unknown }).treeLayoutDefaults,
    );

    return {
      externalNodes,
      nodeOverrides,
      nodePositionOverrides,
      collapsedNodeIds,
      badgeColors,
      treeLayoutDefaults,
      viewport,
      partitionTitle,
    };
  } catch {
    return null;
  }
}

type SerializeParams = {
  nodes: Node[];
  nodeOverrides: Map<string, Partial<NodeCustomizations>>;
  externalNodeOverrides: Map<string, Partial<ExternalNodeCustomizations>>;
  collapsedNodeIds: Set<string>;
  computedPositions: Map<string, { x: number; y: number }>;
  badgeColors?: BadgeColorsConfig;
  treeLayoutDefaults?: TreeLayoutDefaultsConfig;
  viewport?: ViewportConfig;
  partitionTitle?: string;
};

function hasLayoutOverrides(layout: TreeLayoutDefaultsConfig): boolean {
  return LAYOUT_DEFAULT_KEYS.some(
    (key) => layout[key] !== TREE_DEFAULTS.layout[key],
  );
}

export function serializeTreeState(params: SerializeParams): TreePersistedState {
  const {
    nodes,
    nodeOverrides,
    externalNodeOverrides,
    collapsedNodeIds,
    computedPositions,
    badgeColors,
    treeLayoutDefaults,
    viewport,
    partitionTitle,
  } = params;

  const externalNodes: TreePersistedExternalNode[] = [];
  for (const n of nodes) {
    if (n.type !== "external" || !n.data) continue;
    const data = n.data as { label?: string; shape?: ExternalNodeShape } & Record<string, unknown>;
    const overrides = externalNodeOverrides.get(n.id) ?? {};
    const shape = (overrides.shape ?? data.shape ?? "box") as ExternalNodeShape;
    const dims = SHAPE_DEFAULTS[shape] ?? SHAPE_DEFAULTS.box;
    // handleNodesChange writes resize results into node.style (the authoritative source).
    // Fall back to node.measured only if style is unset, then to shape defaults.
    const w = typeof n.style?.width === "number" ? n.style.width
            : typeof n.measured?.width === "number" ? n.measured.width
            : dims.width;
    const h = typeof n.style?.height === "number" ? n.style.height
            : typeof n.measured?.height === "number" ? n.measured.height
            : dims.height;
    const baseLabel = (data.label ?? shape.charAt(0).toUpperCase() + shape.slice(1)) as string;
    externalNodes.push({
      id: n.id,
      position: { x: n.position.x, y: n.position.y },
      shape,
      width: w,
      height: h,
      label: baseLabel,
      customLabel: overrides.customLabel,
      customBackground: overrides.customBackground,
      customColor: overrides.customColor,
      textAlign: overrides.textAlign,
      rotation: overrides.rotation,
      fontSize: overrides.fontSize,
      fontWeight: overrides.fontWeight,
      paddingX: overrides.paddingX,
      paddingY: overrides.paddingY,
      opacity: overrides.opacity,
      borderColor: overrides.borderColor,
      borderWidth: overrides.borderWidth,
      borderStyle: overrides.borderStyle,
      shadowColor: overrides.shadowColor,
      shadowBlur: overrides.shadowBlur,
      shadowOffsetX: overrides.shadowOffsetX,
      shadowOffsetY: overrides.shadowOffsetY,
      tailOffsetX: overrides.tailOffsetX,
      tailOffsetY: overrides.tailOffsetY,
    });
  }

  const nodeOverridesRecord: Record<string, Partial<NodeCustomizations>> = {};
  for (const [id, val] of nodeOverrides) {
    if (val && Object.keys(val).some((k) => val[k as keyof NodeCustomizations] != null)) {
      nodeOverridesRecord[id] = val;
    }
  }

  // Persist current partition node dimensions (from style/measured) as custom overrides,
  // but ONLY when they differ from the default size for that node type under the current
  // layout. Persisting the default size for every node would freeze each node against future
  // changes to the layout defaults (e.g. partition width/height), making the defaults panel
  // appear to have no effect after the first save.
  const layoutForDims = treeLayoutDefaults ?? TREE_DEFAULTS.layout;
  for (const n of nodes) {
    if (n.type === "external") continue;
    const width =
      typeof n.style?.width === "number"
        ? n.style.width
        : typeof n.measured?.width === "number"
          ? n.measured.width
          : undefined;
    const height =
      typeof n.style?.height === "number"
        ? n.style.height
        : typeof n.measured?.height === "number"
          ? n.measured.height
          : undefined;
    const existing = nodeOverridesRecord[n.id] ?? {};
    const resolvedWidth = typeof existing.width === "number" ? existing.width : width;
    const resolvedHeight = typeof existing.height === "number" ? existing.height : height;
    if (typeof resolvedWidth !== "number" || typeof resolvedHeight !== "number") continue;
    const nodeType = ((n.data as { nodeType?: PartitionNodeType })?.nodeType ??
      "value") as PartitionNodeType;
    const defaultDims = getPartitionNodeDimensions(nodeType, layoutForDims);
    const isDefaultSize =
      Math.abs(resolvedWidth - defaultDims.width) <= 0.5 &&
      Math.abs(resolvedHeight - defaultDims.height) <= 0.5;
    if (isDefaultSize) continue;
    nodeOverridesRecord[n.id] = {
      ...existing,
      width: resolvedWidth,
      height: resolvedHeight,
    };
  }

  const nodePositionOverrides: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    if (n.type === "external") continue;
    const computed = computedPositions.get(n.id);
    if (!computed) continue;
    const dx = Math.abs((n.position?.x ?? 0) - computed.x);
    const dy = Math.abs((n.position?.y ?? 0) - computed.y);
    if (dx > 0.5 || dy > 0.5) {
      nodePositionOverrides[n.id] = { x: n.position.x, y: n.position.y };
    }
  }

  return {
    externalNodes,
    nodeOverrides: nodeOverridesRecord,
    nodePositionOverrides,
    collapsedNodeIds: Array.from(collapsedNodeIds),
    badgeColors,
    treeLayoutDefaults:
      treeLayoutDefaults && hasLayoutOverrides(treeLayoutDefaults)
        ? treeLayoutDefaults
        : undefined,
    viewport,
    partitionTitle: typeof partitionTitle === "string" ? partitionTitle.trim() || undefined : undefined,
  };
}

