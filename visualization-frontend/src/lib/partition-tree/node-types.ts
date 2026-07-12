import type { BorderStyleValue, ExternalNodeShape } from "./tree-defaults";

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
