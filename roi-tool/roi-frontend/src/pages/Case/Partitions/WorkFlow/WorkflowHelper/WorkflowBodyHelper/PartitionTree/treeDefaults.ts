import colorConfig from "./colors.json";

export type ExternalNodeShape = "circle" | "box" | "diamond" | "label" | "callout";
export type BorderStyleValue = "solid" | "dashed" | "dotted" | "none";

export const TREE_DEFAULTS = {
  layout: {
    verticalGap: 20,
    horizontalGap: 60,
    edgeShoulder: 10,
    edgeBorderRadius: 8,
    partitionNodeWidth: 140,
    partitionNodeHeight: 56,
    attributeNodeWidth: 108,
    attributeNodeHeight: 42,
    partitionMinWidth: 1,
    partitionMinHeight: 1,
  },
  partition: {
    paddingX: 16,
    paddingY: 14,
    fontSize: 12,
    borderWidth: 1.5,
    borderStyle: "solid" as BorderStyleValue,
  },
  attribute: {
    paddingX: 10,
    paddingY: 8,
    fontSize: 10,
    borderWidth: 1.5,
    borderStyle: "solid" as BorderStyleValue,
  },
  external: {
    paddingX: 8,
    paddingY: 8,
    fontSize: 12,
    borderWidth: 1,
    borderStyle: "solid" as BorderStyleValue,
    shapes: {
      circle: { width: 80, height: 80 },
      box: { width: 120, height: 80 },
      diamond: { width: 80, height: 80 },
      label: { width: 120, height: 32 },
      callout: { width: 180, height: 90 },
    },
    shapeMinWidth: 1,
    shapeMinHeight: 1,
  },
} as const;

export type TreeLayoutDefaults = {
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

export type TreeDefaults = {
  layout: TreeLayoutDefaults;
  partition: (typeof TREE_DEFAULTS)["partition"];
  attribute: (typeof TREE_DEFAULTS)["attribute"];
  external: (typeof TREE_DEFAULTS)["external"];
};

export const NODE_WIDTH = TREE_DEFAULTS.layout.partitionNodeWidth;
export const NODE_HEIGHT = TREE_DEFAULTS.layout.partitionNodeHeight;

export type PartitionNodeType = "root" | "attribute" | "value";

export function getPartitionDefaultsForNodeType(nodeType: PartitionNodeType) {
  return nodeType === "attribute" ? TREE_DEFAULTS.attribute : TREE_DEFAULTS.partition;
}

export function getPartitionNodeDimensions(
  nodeType: PartitionNodeType,
  layout: TreeLayoutDefaults = TREE_DEFAULTS.layout,
) {
  if (nodeType === "attribute") {
    return {
      width: layout.attributeNodeWidth,
      height: layout.attributeNodeHeight,
    };
  }
  return {
    width: layout.partitionNodeWidth,
    height: layout.partitionNodeHeight,
  };
}

export function getPartitionDefaults() {
  return TREE_DEFAULTS.partition;
}

export function getExternalShapeDefaults(shape: ExternalNodeShape) {
  return TREE_DEFAULTS.external.shapes[shape] ?? TREE_DEFAULTS.external.shapes.box;
}

export function getExternalMinDimensions() {
  return {
    width: TREE_DEFAULTS.external.shapeMinWidth,
    height: TREE_DEFAULTS.external.shapeMinHeight,
  };
}

type PartitionBorderOverrides = {
  customBorderColor?: string;
  customBorderWidth?: number;
  customBorderStyle?: BorderStyleValue;
};

function parseBorderString(border: string | undefined): {
  width: number;
  style: BorderStyleValue;
  color: string;
} | null {
  if (!border) return null;
  const match = border.match(/^([\d.]+)px\s+(\w+)\s+(.+)$/);
  if (!match) return null;
  return {
    width: parseFloat(match[1]),
    style: match[2] as BorderStyleValue,
    color: match[3],
  };
}

export function resolvePartitionBorder(
  nodeType: PartitionNodeType,
  overrides: PartitionBorderOverrides,
): string {
  const defaults = getPartitionDefaultsForNodeType(nodeType);
  const hasOverride =
    overrides.customBorderColor != null ||
    overrides.customBorderWidth != null ||
    overrides.customBorderStyle != null;

  if (hasOverride) {
    const width = overrides.customBorderWidth ?? defaults.borderWidth;
    const style = overrides.customBorderStyle ?? defaults.borderStyle;
    const color = overrides.customBorderColor ?? "#000000";
    if (style === "none") return "none";
    return `${width}px ${style} ${color}`;
  }

  if (nodeType === "root") {
    const width = defaults.borderWidth;
    const style = defaults.borderStyle;
    if (style === "none") return "none";
    return `${width}px ${style} #000000`;
  }

  const colorsJsonBorder =
    nodeType === "attribute"
      ? colorConfig.nodes.attribute.border
      : colorConfig.nodes.value.border;

  const parsed = parseBorderString(colorsJsonBorder);
  if (parsed) {
    const width = defaults.borderWidth ?? parsed.width;
    const style = defaults.borderStyle ?? parsed.style;
    if (style === "none") return "none";
    return `${width}px ${style} ${parsed.color}`;
  }

  if (defaults.borderStyle === "none") return "none";
  return `${defaults.borderWidth}px ${defaults.borderStyle} #000000`;
}

export const SHAPE_DEFAULTS: Record<ExternalNodeShape, { width: number; height: number }> =
  TREE_DEFAULTS.external.shapes;
