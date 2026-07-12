import { Position } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import type { PartitionTreeNodeData } from "../node-types";
import {
  getPartitionNodeDimensions,
  TREE_DEFAULTS,
  type TreeLayoutDefaults,
} from "../tree-defaults";

export type TreeNode = {
  id: string;
  path?: Array<{ value: string; attribute: string }>;
  type: "root" | "attribute" | "value";
  level: number;
  value?: string | null;
  branch?: string | null;
  node_name?: string | null;
  attribute?: string | null;
  parent_id?: string | null;
  /** Ids of this node's direct children (empty for leaves). */
  children?: string[];
  sku_count?: number | null;
  client_sku_count?: number | null;
  is_clickable?: boolean;
};

/**
 * Flat partition-tree as stored by the backend in `result.partition_tree`.
 * Hierarchy lives on the nodes themselves: each node carries `parent_id`
 * (`null` for the root) and `children` (child ids, empty for leaves).
 */
export type PartitionGraph = {
  nodes: TreeNode[];
};

export { NODE_WIDTH, NODE_HEIGHT } from "../tree-defaults";

export function graphToFlowData(
  graph: PartitionGraph | null,
  layout: TreeLayoutDefaults = TREE_DEFAULTS.layout,
): { nodes: Node[]; edges: Edge[] } {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const horizontalGap = layout.horizontalGap;
  const verticalGap = layout.verticalGap;

  // Build a parent → children adjacency from each node's `children` ids, and
  // find the root (the node with no parent).
  const byId = new Map<string, TreeNode>();
  for (const node of graph.nodes) byId.set(String(node.id), node);

  const childrenById = new Map<string, TreeNode[]>();
  for (const node of graph.nodes) {
    const childIds = node.children ?? [];
    if (childIds.length === 0) continue;
    const children: TreeNode[] = [];
    for (const childId of childIds) {
      const child = byId.get(String(childId));
      if (child) children.push(child);
    }
    childrenById.set(String(node.id), children);
  }

  const root =
    graph.nodes.find((n) => n.parent_id == null) ?? graph.nodes[0];

  const nodes: Node<PartitionTreeNodeData>[] = [];
  const edges: Edge[] = [];

  const layoutTree = (
    node: TreeNode,
    parentId: string | null,
    startX: number,
    y: number
  ): { width: number } => {
    const id = String(node.id);
    const displayName =
      node.node_name ?? node.value ?? node.attribute ?? id;
    const nodeType = (node.type ?? "value") as "root" | "attribute" | "value";
    const dims = getPartitionNodeDimensions(nodeType, layout);

    const children = childrenById.get(id) ?? [];

    if (children.length === 0) {
      const nodeData: Node<PartitionTreeNodeData> = {
        id,
        type: "partition-tree",
        position: { x: startX, y },
        data: {
          nodeName: displayName,
          nodeType,
          skuCount: node.sku_count,
          clientSkuCount: node.client_sku_count,
          isClickable: node.is_clickable ?? true,
          level: node.level ?? 0,
          hasChildren: false,
          parentId: parentId ?? null,
        },
        style: { width: dims.width, height: dims.height },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      };
      nodes.push(nodeData);
      if (parentId) {
        edges.push({ id: `${parentId}-${id}`, source: parentId, target: id, type: "tree" });
      }
      return { width: dims.width };
    }

    let childX = startX;
    const childY = y + dims.height + verticalGap;
    const childWidths: number[] = [];

    for (const child of children) {
      const result = layoutTree(child, id, childX, childY);
      childWidths.push(result.width);
      childX += result.width + horizontalGap;
    }

    const totalWidth = childWidths.reduce((a, w) => a + w, 0) + horizontalGap * (children.length - 1);
    const parentX = startX + (totalWidth - dims.width) / 2;

    const nodeData: Node<PartitionTreeNodeData> = {
      id,
      type: "partition-tree",
      position: { x: parentX, y },
      data: {
        nodeName: displayName,
        nodeType,
        skuCount: node.sku_count,
        clientSkuCount: node.client_sku_count,
        isClickable: node.is_clickable ?? true,
        level: node.level ?? 0,
        hasChildren: true,
        childCount: children.length,
        parentId: parentId ?? null,
      },
      style: { width: dims.width, height: dims.height },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
    nodes.push(nodeData);
    if (parentId) {
      edges.push({ id: `${parentId}-${id}`, source: parentId, target: id, type: "tree" });
    }

    return { width: Math.max(totalWidth, dims.width) };
  };

  layoutTree(root, null, 0, 0);

  return { nodes, edges };
}

let externalNodeIdCounter = 0;

export const getExternalNodeId = (): string => `external_${++externalNodeIdCounter}`;

export function syncExternalNodeIdCounter(ids: string[]): void {
  let max = 0;
  for (const id of ids) {
    const m = id.match(/^external_(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  if (max > externalNodeIdCounter) externalNodeIdCounter = max;
}


