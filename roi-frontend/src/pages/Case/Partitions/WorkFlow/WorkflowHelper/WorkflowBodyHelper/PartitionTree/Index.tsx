import { useParams } from "react-router-dom";
import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Panel,
  Position,
  ReactFlow,
  useNodesState,
  useEdgesState,
  SelectionMode,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react";

import { toPng } from "html-to-image";

import "../Workflow.css";
import "@xyflow/react/dist/style.css";

import { Repeat, Download, Maximize, Minimize, Add } from "@carbon/icons-react";

import { TreeLegend } from "./components/legend";
import { TreeLayoutDefaultsPanel } from "./components/layout-defaults-panel";
import { ToolRail } from "./components/ToolRail";
import { NodeEditorPanel } from "./NodeEditorPanel";
import { TreeNode } from "./Node";
import { TreeEdge } from "./TreeEdge";
import {
  getExternalShapeDefaults,
  getPartitionNodeDimensions,
  TREE_DEFAULTS,
  type TreeDefaults,
  type TreeLayoutDefaults,
} from "./treeDefaults";
import { TreeDefaultsProvider } from "./TreeDefaultsContext";
import { ExternalNodePanel } from "./ExternalNodePane";

import colorConfig from "./colors.json";
import { PARTITION_TREE_CANVAS_ASPECT_RATIO } from "./constants";
import { deserializeTreeState, serializeTreeState } from "./tree.types";
import type {
  ExternalNodeData,
  ExternalNodeCustomizations,
  ExternalNodeShape,
  PartitionTreeNodeData,
  NodeCustomizations,
  BadgeColors as TreeLegendColors,
} from "./Node";
import {
  loadTreeState,
  saveTreeState,
  clearTreeState,
} from "@/core/storage/workflowMetadata";

import { AlignmentGuides } from "./components/alignment-guides";
import {
  findAlignmentGuides,
  type AlignmentGuide,
} from "./utils/alignmentGuides";
import {
  treeToFlowData,
  getExternalNodeId,
  syncExternalNodeIdCounter,
} from "./utils/treeLayout";

import { WorkflowApi, CaseApi } from "@/core/api";
import { Dialog } from "primereact/dialog";

import { ObmHoldsBadge } from "@/components/ObmHoldsBadge";
import LoaderIcon from "@/components/icons/LoaderIcon";
import AttributeRollUp from "./AttributeRollUp";

import SKUList from "./SKUList";
import BaseTesting from "./BaseTesting/Index";
import LevelTesting from "./LevelTesting/Index";
import AttributeSelection from "./AttributeSelection";
import PartnerView from "./PartnerView";

// Workflow helper types
type InnerTab =
  | "sku-list"
  | "partner-view"
  | "attribute-selection"
  | "base-testing"
  | "level-testing";
type CanvasMode = "move" | "select";

type NodePollResponse = {
  status?: string;
  percent?: number;
  progress?: number;
  data?: {
    sku_list?: any;
    base_testing?: any;
    level_testing?: any;
    calculated_at?: string;
  };
};

type WorkflowNodeSession = {
  selectedWorkflowNode: PartitionTreeNodeData | null;
  currentNodeObj: any;
  nodeMeta: { branch: string | null; level: number | null } | null;
  pollRes: NodePollResponse | null;
  attributeSelectionData: any;
  attributeSelectionHasData: boolean;
  attributeSelectionError: string | null;
  attributeSelectionSubmitted: boolean;
};

// Pure helper functions (no hooks)
function isCompletedStatus(status: any) {
  const s = String(status ?? "").toUpperCase();
  return s === "COMPLETED" || s === "SUCCESS" || s === "DONE";
}

function extractObmHolds(wd: any): boolean | null {
  const obmStep =
    wd?.data?.partition_obm ??
    wd?.data?.steps?.partition_obm ??
    wd?.steps?.partition_obm ??
    wd?.workflow_meta?.data?.steps?.partition_obm ??
    null;
  const v = obmStep?.result?.obm_holds;
  return typeof v === "boolean" ? v : null;
}

function extractObmStatus(wd: any): string | null {
  const obmStep =
    wd?.data?.partition_obm ??
    wd?.data?.steps?.partition_obm ??
    wd?.steps?.partition_obm ??
    wd?.workflow_meta?.data?.steps?.partition_obm ??
    null;
  const s = obmStep?.status ?? obmStep?.result?.status ?? null;
  return typeof s === "string" ? s : null;
}

function findNodeInTree(tree: any, nodeId: string): any | null {
  if (!tree) return null;
  if (String(tree.id) === nodeId) return tree;
  if (Array.isArray(tree.children)) {
    for (const child of tree.children) {
      const found = findNodeInTree(child, nodeId);
      if (found) return found;
    }
  }
  return null;
}

type Props = {
  workflowData?: any;
  partitionName?: string;
  onPatchWorkflowFromDb?: (payload: any) => void;
  readOnly?: boolean;
};

const nodeTypes = {
  "partition-tree": TreeNode as React.ComponentType<any>,
  external: TreeNode as React.ComponentType<any>,
};

const edgeTypes = {
  tree: TreeEdge as React.ComponentType<any>,
};

export default function PartitionTree({
  workflowData,
  partitionName,
  onPatchWorkflowFromDb,
  readOnly = false,
}: Props) {
  const { caseId, partitionId } = useParams<{
    caseId: string;
    partitionId: string;
  }>();
  const defaultPartitionTitle =
    (partitionName ?? "Partition Title").trim() || "Partition Title";
  const computedPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const restoredRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "saved">(
    "idle",
  );
  const [viewportState, setViewportState] = useState<{
    x: number;
    y: number;
    zoom: number;
  } | null>(null);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("move");
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSavedOnceRef = useRef(false);

  // Workflow dialog state
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [activeInnerTab, setActiveInnerTab] = useState<InnerTab>(
    "attribute-selection",
  );
  const [selectedWorkflowNode, setSelectedWorkflowNode] =
    useState<PartitionTreeNodeData | null>(null);
  const [currentNodeObj, setCurrentNodeObj] = useState<any>(null);
  const [nodeMeta, setNodeMeta] = useState<{
    branch: string | null;
    level: number | null;
  } | null>(null);
  const [pollRes, setPollRes] = useState<NodePollResponse | null>(null);
  const [attributeSelectionData, setAttributeSelectionData] =
    useState<any>(null);
  const [attributeSelectionHasData, setAttributeSelectionHasData] =
    useState(false);
  const [attributeSelectionLoading, setAttributeSelectionLoading] =
    useState(false);
  const [attributeSelectionError, setAttributeSelectionError] = useState<
    string | null
  >(null);
  const [attributeSelectionSubmitted, setAttributeSelectionSubmitted] =
    useState(false);
  const [retainedWorkflowNodeRunId, setRetainedWorkflowNodeRunId] = useState<
    string | null
  >(null);
  const [updatingTree, setUpdatingTree] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [obmHolds, setObmHolds] = useState<boolean | null>(null);
  const [obmProcessing, setObmProcessing] = useState(false);
  const [rollupsDialogOpen, setRollupsDialogOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  // Workflow refs
  const pollTimerRef = useRef<number | null>(null);
  const pollTokenRef = useRef(0);
  const workflowSessionsRef = useRef<Record<string, WorkflowNodeSession>>({});
  const runGuardRef = useRef<{
    key: string | null;
    inFlight: boolean;
    ts: number;
  }>({ key: null, inFlight: false, ts: 0 });
  const obmStatusTimerRef = useRef<number | null>(null);
  const obmStatusTokenRef = useRef(0);
  const RUN_GUARD_MS = 800;
  const retainedWorkflowNodeId = String(retainedWorkflowNodeRunId ?? "");
  const hasRetainedWorkflowSession =
    Boolean(retainedWorkflowNodeId) &&
    (attributeSelectionSubmitted ||
      attributeSelectionLoading ||
      pollRes != null ||
      attributeSelectionData != null ||
      attributeSelectionError != null);

  const partitionTree =
    workflowData?.data?.partition_tree?.result?.tree ??
    workflowData?.data?.steps?.partition_tree?.result?.tree ??
    null;

  const initialFlow = useMemo(
    () => treeToFlowData(partitionTree),
    [partitionTree],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges);
  const [collapsedNodeIds, setCollapsedNodeIds] = React.useState<Set<string>>(
    new Set(),
  );
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedExternalNodeIds, setSelectedExternalNodeIds] = useState<
    string[]
  >([]);
  const [nodeOverrides, setNodeOverrides] = useState<
    Map<string, Partial<NodeCustomizations>>
  >(new Map());
  const [externalNodeOverrides, setExternalNodeOverrides] = useState<
    Map<string, Partial<ExternalNodeCustomizations>>
  >(new Map());
  const [brandColors, setBrandColors] = useState<
    { hex: string; name: string }[]
  >([]);
  const [partitionTitle, setPartitionTitle] = useState<string>(
    defaultPartitionTitle,
  );
  const [partitionTitleDraft, setPartitionTitleDraft] = useState<string>(
    defaultPartitionTitle,
  );
  const [isEditingPartitionTitle, setIsEditingPartitionTitle] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    CaseApi.getCaseDetails(caseId)
      .then((res) => {
        const palette: string[] | undefined = res.tags?.brandColors;
        if (Array.isArray(palette) && palette.length > 0) {
          setBrandColors(
            palette.map((hex, i) => ({ hex, name: `Brand Color ${i + 1}` })),
          );
        }
      })
      .catch(() => {
        /* silently fall back to hardcoded colors */
      });
  }, [caseId]);

  const [badgeColors, setBadgeColors] = useState<TreeLegendColors>(() => ({
    clientSkuBg: colorConfig.badges.clientSku.background,
    clientSkuText: colorConfig.badges.clientSku.text,
    skuBg: colorConfig.badges.sku.background,
    skuText: colorConfig.badges.sku.text,
  }));
  const [treeDefaults, setTreeDefaults] = useState<TreeDefaults>(() => ({
    ...TREE_DEFAULTS,
    layout: { ...TREE_DEFAULTS.layout },
  }));
  const treeDefaultsRef = useRef(treeDefaults);
  treeDefaultsRef.current = treeDefaults;
  const editMode = true;
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  // Ref kept in sync with displayNodes so drag handlers (declared before displayNodes
  // in the component body) can safely read the current visible node list.
  const displayNodesRef = useRef<Node[]>([]);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const pendingViewportRef = useRef<{
    x: number;
    y: number;
    zoom: number;
  } | null>(null);
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullScreenRootRef = useRef<HTMLDivElement>(null);

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const handleBadgeColorsChange = useCallback((newColors: TreeLegendColors) => {
    setBadgeColors(newColors);
  }, []);

  const applyLayoutDefaults = useCallback(
    (nextLayout: TreeLayoutDefaults) => {
      const oldComputed = computedPositionsRef.current;
      const positionOverrides = new Map<string, { x: number; y: number }>();
      for (const n of nodes) {
        if (n.type === "external") continue;
        const base = oldComputed.get(n.id);
        if (!base) continue;
        if (
          Math.abs(n.position.x - base.x) > 0.5 ||
          Math.abs(n.position.y - base.y) > 0.5
        ) {
          positionOverrides.set(n.id, { x: n.position.x, y: n.position.y });
        }
      }

      const { nodes: newPartitionNodes, edges: newEdges } = treeToFlowData(
        partitionTree,
        nextLayout,
      );

      const computed = new Map<string, { x: number; y: number }>();
      for (const n of newPartitionNodes) {
        computed.set(n.id, { x: n.position.x, y: n.position.y });
      }
      computedPositionsRef.current = computed;

      const updatedPartitionNodes = newPartitionNodes.map((n) => {
        const pos = positionOverrides.get(n.id) ?? n.position;
        const ov = nodeOverrides.get(n.id);
        const nodeType =
          (n.data as PartitionTreeNodeData)?.nodeType ?? "value";
        const dims = getPartitionNodeDimensions(nodeType, nextLayout);
        const width = typeof ov?.width === "number" ? ov.width : dims.width;
        const height = typeof ov?.height === "number" ? ov.height : dims.height;
        return {
          ...n,
          position: pos,
          style: { ...n.style, width, height },
        };
      });

      setTreeDefaults((prev) => ({ ...prev, layout: nextLayout }));
      setNodes((prev) => [
        ...updatedPartitionNodes,
        ...prev.filter((n) => n.type === "external"),
      ]);
      setEdges(newEdges);
    },
    [partitionTree, nodes, nodeOverrides, setNodes, setEdges],
  );

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      if (!editMode) return;
      // Shift/Ctrl/Cmd-click extends the selection (and may mix node types),
      // otherwise a plain click selects just the clicked node.
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const toggleId = (prev: string[], id: string) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (node.type === "external") {
        setSelectedExternalNodeIds((prev) =>
          additive ? toggleId(prev, node.id) : [node.id],
        );
        if (!additive) setSelectedNodeIds([]);
      } else {
        setSelectedNodeIds((prev) =>
          additive ? toggleId(prev, node.id) : [node.id],
        );
        if (!additive) setSelectedExternalNodeIds([]);
      }
    },
    [editMode],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedExternalNodeIds([]);
  }, []);

  const handleDownloadPng = useCallback(() => {
    if (!containerRef.current) return;
    const fileName = `${(partitionTitle || "partition").toLowerCase().replace(/\s+/g, "-")}-tree.png`;
    const options = {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      filter: (domNode: Element) =>
        !(
          domNode instanceof HTMLElement &&
          domNode.dataset.downloadIgnore === "true"
        ),
    };
    toPng(containerRef.current, options)
      .then(() => toPng(containerRef.current!, options))
      .then((dataUrl) => {
        const a = document.createElement("a");
        a.setAttribute("download", fileName);
        a.setAttribute("href", dataUrl);
        a.click();
      });
  }, [partitionTitle]);

  const handleSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Node[] }) => {
      if (!editMode) return;
      const externalSelected = selected.filter((n) => n.type === "external");
      const partitionSelected = selected.filter((n) => n.type !== "external");
      // Keep both selection sets in sync with the actual React Flow selection so
      // that a mixed-type selection (partition + external) stays selected and
      // drags as a single group. Editor panels still render per-type.
      setSelectedNodeIds(partitionSelected.map((n) => n.id));
      setSelectedExternalNodeIds(externalSelected.map((n) => n.id));
    },
    [editMode],
  );

  const handleBatchUpdate = useCallback(
    (nodeIds: string[], overrides: Partial<NodeCustomizations>) => {
      setNodeOverrides((prev) => {
        const next = new Map(prev);
        for (const id of nodeIds) {
          const existing = next.get(id) ?? {};
          const merged = { ...existing, ...overrides };
          // remove undefined/empty keys
          for (const key of Object.keys(
            merged,
          ) as (keyof NodeCustomizations)[]) {
            if (merged[key] === undefined) delete merged[key];
            if (merged[key] === "" && key !== "customLabel") delete merged[key];
          }
          if (Object.keys(merged).length === 0) {
            next.delete(id);
          } else {
            next.set(id, merged);
          }
        }
        return next;
      });
    },
    [],
  );

  const handleBatchReset = useCallback(
    (nodeIds: string[]) => {
      setNodeOverrides((prev) => {
        const next = new Map(prev);
        for (const id of nodeIds) next.delete(id);
        return next;
      });
      const idSet = new Set(nodeIds);
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type === "external" || !idSet.has(n.id)) return n;
          return {
            ...n,
            style: {
              ...n.style,
              width: undefined,
              height: undefined,
            },
          };
        }),
      );
    },
    [setNodes],
  );

  const handleExternalBatchUpdate = useCallback(
    (nodeIds: string[], overrides: Partial<ExternalNodeCustomizations>) => {
      setExternalNodeOverrides((prev) => {
        const next = new Map(prev);
        for (const nodeId of nodeIds) {
          const existing = next.get(nodeId) ?? {};
          const merged = { ...existing, ...overrides };
          for (const key of Object.keys(
            merged,
          ) as (keyof ExternalNodeCustomizations)[]) {
            if (merged[key] === undefined) delete merged[key];
            if (merged[key] === "" && key !== "customLabel") delete merged[key];
          }
          if (Object.keys(merged).length === 0) next.delete(nodeId);
          else next.set(nodeId, merged);
        }
        return next;
      });
    },
    [],
  );

  const handleRotationChange = useCallback(
    (nodeId: string, rotation: number) => {
      const ids = selectedExternalNodeIds.includes(nodeId)
        ? selectedExternalNodeIds
        : [nodeId];
      handleExternalBatchUpdate(ids, { rotation });
    },
    [selectedExternalNodeIds, handleExternalBatchUpdate],
  );

  const handleCalloutTailChange = useCallback(
    (nodeId: string, tail: { x: number; y: number }) => {
      handleExternalBatchUpdate([nodeId], {
        tailOffsetX: tail.x,
        tailOffsetY: tail.y,
      });
    },
    [handleExternalBatchUpdate],
  );

  const handleExternalLabelChange = useCallback(
    (nodeId: string, label: string) => {
      handleExternalBatchUpdate([nodeId], { customLabel: label });
    },
    [handleExternalBatchUpdate],
  );

  const handleExternalNodeUpdateDimensions = useCallback(
    (nodeIds: string[], width: number, height: number) => {
      if (nodeIds.length !== 1) return;
      const idSet = new Set(nodeIds);
      setNodes((nds) =>
        nds.map((n) =>
          n.type === "external" && idSet.has(n.id)
            ? {
                ...n,
                style: { ...n.style, width, height },
                measured: { ...n.measured, width, height },
              }
            : n,
        ),
      );
    },
    [setNodes],
  );

  const handlePartitionNodeUpdateDimensions = useCallback(
    (nodeIds: string[], width: number, height: number) => {
      if (nodeIds.length !== 1) return;
      const idSet = new Set(nodeIds);
      setNodes((nds) =>
        nds.map((n) =>
          n.type !== "external" && idSet.has(n.id)
            ? {
                ...n,
                style: { ...n.style, width, height },
                measured: { ...n.measured, width, height },
              }
            : n,
        ),
      );
      setNodeOverrides((prev) => {
        const next = new Map(prev);
        for (const id of nodeIds) {
          const existing = next.get(id) ?? {};
          next.set(id, {
            ...existing,
            width,
            height,
          });
        }
        return next;
      });
    },
    [setNodes],
  );

  const handleExternalBatchReset = useCallback(
    (nodeIds: string[]) => {
      const idSet = new Set(nodeIds);
      setExternalNodeOverrides((prev) => {
        const next = new Map(prev);
        for (const id of nodeIds) next.delete(id);
        return next;
      });
      setNodes((nds) =>
        nds.map((n) => {
          if (n.type !== "external" || !idSet.has(n.id)) return n;
          const shape = (n.data?.shape ?? "box") as ExternalNodeShape;
          const dims = getExternalShapeDefaults(shape);
          return {
            ...n,
            style: { ...n.style, width: dims.width, height: dims.height },
          };
        }),
      );
    },
    [setNodes],
  );

  const handleExternalBatchDelete = useCallback(
    (nodeIds: string[]) => {
      const idSet = new Set(nodeIds);
      setNodes((nds) => nds.filter((n) => !idSet.has(n.id)));
      setSelectedExternalNodeIds((prev) => prev.filter((id) => !idSet.has(id)));
      setExternalNodeOverrides((prev) => {
        const next = new Map(prev);
        for (const id of nodeIds) next.delete(id);
        return next;
      });
    },
    [setNodes],
  );

  const onBeforeDelete = useCallback(
    async ({ nodes: nodesToDelete }: { nodes: Node[]; edges: Edge[] }) => {
      const externalOnly =
        nodesToDelete?.filter((n) => n.type === "external") ?? [];
      const partitionOnly =
        nodesToDelete?.filter((n) => n.type !== "external") ?? [];
      if (partitionOnly.length > 0 && externalOnly.length === 0) return false;
      if (partitionOnly.length > 0) return { nodes: externalOnly, edges: [] };
      return true;
    },
    [],
  );

  // Alignment guide handlers
  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      const zoom = reactFlowInstance.current?.getViewport().zoom ?? 1;
      // Read via ref to avoid TDZ displayNodes is declared later in the component
      const { guides } = findAlignmentGuides(
        draggedNode,
        displayNodesRef.current,
        zoom,
        treeDefaultsRef.current.layout,
      );
      setAlignmentGuides(guides);
    },
    [],
  );

  const handleNodeDragStop = useCallback(() => {
    setAlignmentGuides([]);
  }, []);

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      const dimensionUpdates: Array<{
        id: string;
        width: number;
        height: number;
      }> = [];
      const nodeTypeById = new Map(nodes.map((n) => [n.id, n.type]));
      for (const c of changes) {
        if (c.type === "remove" && "id" in c && typeof c.id === "string") {
          const removedId = c.id;
          setSelectedExternalNodeIds((prev) =>
            prev.filter((id) => id !== removedId),
          );
          setExternalNodeOverrides((prev) => {
            const next = new Map(prev);
            next.delete(removedId);
            return next;
          });
        }
        if (
          c.type === "dimensions" &&
          "id" in c &&
          typeof c.id === "string" &&
          (c as any).resizing === true
        ) {
          const width = c.dimensions?.width;
          const height = c.dimensions?.height;
          if (typeof width === "number" && typeof height === "number") {
            dimensionUpdates.push({ id: c.id, width, height });
          }
        }
      }
      if (dimensionUpdates.length > 0) {
        const dimsById = new Map(
          dimensionUpdates.map((u) => [
            u.id,
            { width: u.width, height: u.height },
          ]),
        );
        setNodes((nds) =>
          nds.map((n) => {
            const dims = dimsById.get(n.id);
            if (!dims) return n;
            return {
              ...n,
              style: { ...n.style, width: dims.width, height: dims.height },
            };
          }),
        );
        setNodeOverrides((prev) => {
          const next = new Map(prev);
          for (const update of dimensionUpdates) {
            if (nodeTypeById.get(update.id) === "external") continue;
            const existing = next.get(update.id) ?? {};
            next.set(update.id, {
              ...existing,
              width: update.width,
              height: update.height,
            });
          }
          return next;
        });
      }
    },
    [onNodesChange, nodes, setNodes],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const shape = e.dataTransfer.getData("application/reactflow") as
        | ExternalNodeShape
        | "";
      if (!shape || !["circle", "box", "diamond", "label", "callout"].includes(shape))
        return;

      const position = reactFlowInstance.current?.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      if (!position) return;

      const label = shape === "callout" ? "Comment" : shape.charAt(0).toUpperCase() + shape.slice(1);
      const dims = getExternalShapeDefaults(shape);
      const newNode: Node<ExternalNodeData> = {
        id: getExternalNodeId(),
        type: "external",
        position,
        data: {
          label,
          shape,
          customBackground: shape === "callout" ? "#6A9DD3" : "#C8102E",
          customColor: shape === "label" || shape === "callout" ? "#333333" : "#ffffff",
          textAlign: shape === "callout" ? "center" : undefined,
          borderColor: shape === "callout" ? "#4B5563" : undefined,
          borderWidth: shape === "callout" ? 1.5 : undefined,
          tailOffsetX: shape === "callout" ? -40 : undefined,
          tailOffsetY: shape === "callout" ? 82 : undefined,
        },
        style: { width: dims.width, height: dims.height },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes],
  );

  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of edges) {
      map.set(e.target, e.source);
    }
    return map;
  }, [edges]);

  const isNodeHidden = useCallback(
    (nodeId: string) => {
      let current: string | undefined = nodeId;
      while (current) {
        const parentId = parentMap.get(current);
        if (!parentId) break;
        if (collapsedNodeIds.has(parentId)) return true;
        current = parentId;
      }
      return false;
    },
    [parentMap, collapsedNodeIds],
  );

  const handleReset = useCallback(() => {
    if (caseId && partitionId) {
      clearTreeState(caseId, partitionId);
    }
    // Reset rebuilds the tree from the defaults configured in the defaults panel
    // (treeDefaults.layout), NOT the hardcoded TREE_DEFAULTS. This discards manual
    // moves / per-node size overrides while preserving the user's configured layout.
    const layout = treeDefaultsRef.current.layout;
    const { nodes: newPartitionNodes, edges: newEdges } = treeToFlowData(
      partitionTree,
      layout,
    );
    const computed = new Map<string, { x: number; y: number }>();
    for (const n of newPartitionNodes) {
      computed.set(n.id, { x: n.position.x, y: n.position.y });
    }
    computedPositionsRef.current = computed;
    const externalNodes = nodes.filter((n) => n.type === "external");
    setNodes([...newPartitionNodes, ...externalNodes]);
    setEdges(newEdges);
    setCollapsedNodeIds(new Set());
    setSelectedNodeIds([]);
    setSelectedExternalNodeIds([]);
    setNodeOverrides((prev) => {
      const next = new Map(prev);
      const partitionIds = new Set(newPartitionNodes.map((n) => n.id));
      for (const id of partitionIds) next.delete(id);
      return next;
    });
    // Intentionally do NOT reset treeDefaults here: the defaults configured in the
    // defaults panel must persist across a tree reset.
    // Reset badge colors to defaults
    setBadgeColors({
      clientSkuBg: colorConfig.badges.clientSku.background,
      clientSkuText: colorConfig.badges.clientSku.text,
      skuBg: colorConfig.badges.sku.background,
      skuText: colorConfig.badges.sku.text,
    });
    requestAnimationFrame(() => {
      reactFlowInstance.current?.fitView({ padding: 0.2 });
    });
  }, [partitionTree, nodes, caseId, partitionId, setNodes, setEdges]);

  // Workflow polling helpers
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const invalidatePolling = useCallback(() => {
    pollTokenRef.current += 1;
    stopPolling();
    return pollTokenRef.current;
  }, [stopPolling]);

  const stopObmStatusPolling = useCallback(() => {
    if (obmStatusTimerRef.current) {
      window.clearTimeout(obmStatusTimerRef.current);
      obmStatusTimerRef.current = null;
    }
    obmStatusTokenRef.current += 1;
    setObmProcessing(false);
  }, []);

  const startObmStatusPolling = useCallback(() => {
    if (!caseId || !partitionId) return;
    stopObmStatusPolling();
    const token = ++obmStatusTokenRef.current;
    setObmProcessing(true);
    const tick = async () => {
      if (obmStatusTokenRef.current !== token) return;
      try {
        const res = await WorkflowApi.getStatus(caseId, partitionId);
        if (obmStatusTokenRef.current !== token) return;
        onPatchWorkflowFromDb?.(res);
        const rawStatus = extractObmStatus(res);
        const statusNorm = rawStatus ? rawStatus.toLowerCase() : null;
        if (statusNorm === "completed") {
          const holds = extractObmHolds(res);
          if (typeof holds === "boolean") setObmHolds(holds);
          setObmProcessing(false);
          stopObmStatusPolling();
          return;
        }
        obmStatusTimerRef.current = window.setTimeout(tick, 1500);
      } catch (err) {
        if (obmStatusTokenRef.current !== token) return;
        console.error("OBM status polling failed:", err);
        stopObmStatusPolling();
      }
    };
    tick();
  }, [caseId, partitionId, onPatchWorkflowFromDb, stopObmStatusPolling]);

  const persistCurrentWorkflowSession = useCallback(
    (nodeId?: string | null) => {
      const key = String(nodeId ?? retainedWorkflowNodeId ?? "");
      if (!key) return;
      workflowSessionsRef.current[key] = {
        selectedWorkflowNode,
        currentNodeObj,
        nodeMeta,
        pollRes,
        attributeSelectionData,
        attributeSelectionHasData,
        attributeSelectionError,
        attributeSelectionSubmitted,
      };
    },
    [
      retainedWorkflowNodeId,
      selectedWorkflowNode,
      currentNodeObj,
      nodeMeta,
      pollRes,
      attributeSelectionData,
      attributeSelectionHasData,
      attributeSelectionError,
      attributeSelectionSubmitted,
    ],
  );

  const restoreWorkflowSession = useCallback(
    (nodeId: string, fallbackNodeData?: PartitionTreeNodeData) => {
      const session = workflowSessionsRef.current[nodeId];
      if (!session) return false;
      setRetainedWorkflowNodeRunId(nodeId);
      setSelectedWorkflowNode(
        fallbackNodeData ?? session.selectedWorkflowNode ?? null,
      );
      setCurrentNodeObj(session.currentNodeObj ?? null);
      setNodeMeta(session.nodeMeta ?? null);
      setPollRes(session.pollRes ?? null);
      setAttributeSelectionData(session.attributeSelectionData ?? null);
      setAttributeSelectionHasData(Boolean(session.attributeSelectionHasData));
      setAttributeSelectionError(session.attributeSelectionError ?? null);
      setAttributeSelectionSubmitted(
        Boolean(session.attributeSelectionSubmitted),
      );
      setAttributeSelectionLoading(false);
      return true;
    },
    [],
  );

  useEffect(() => {
    if (!retainedWorkflowNodeId) return;
    persistCurrentWorkflowSession(retainedWorkflowNodeId);
  }, [retainedWorkflowNodeId, persistCurrentWorkflowSession]);

  const clearWorkflowSessionState = useCallback(() => {
    setRetainedWorkflowNodeRunId(null);
    setSelectedWorkflowNode(null);
    setCurrentNodeObj(null);
    setPollRes(null);
    setNodeMeta(null);
    setAttributeSelectionData(null);
    setAttributeSelectionHasData(false);
    setAttributeSelectionLoading(false);
    setAttributeSelectionError(null);
    setAttributeSelectionSubmitted(false);
  }, []);

  const hideWorkflowDialog = useCallback(() => {
    setWorkflowOpen(false);
  }, []);

  const resetWorkflowSession = useCallback(
    ({
      closeDialog = true,
      invalidate = true,
    }: { closeDialog?: boolean; invalidate?: boolean } = {}) => {
      const activeNodeId = String(retainedWorkflowNodeId ?? "");
      if (activeNodeId) {
        delete workflowSessionsRef.current[activeNodeId];
      }
      if (closeDialog) setWorkflowOpen(false);
      clearWorkflowSessionState();
      if (invalidate) invalidatePolling();
    },
    [retainedWorkflowNodeId, clearWorkflowSessionState, invalidatePolling],
  );

  const loadAttributeSelectionData = useCallback(
    async (nodeObj: any, token?: number) => {
      if (!caseId || !partitionId || !nodeObj) return;
      try {
        const res = await WorkflowApi.attributeSelection(caseId, partitionId, {
          node_obj: nodeObj,
        });
        if (token != null && pollTokenRef.current !== token) return;
        const resHasData =
          res != null && Object.prototype.hasOwnProperty.call(res, "data");
        setAttributeSelectionData(resHasData ? res.data.data : res);
        setAttributeSelectionHasData(resHasData);
        setAttributeSelectionError(null);
      } catch (e) {
        if (token != null && pollTokenRef.current !== token) return;
        console.error("attributeSelection failed:", e);
        setAttributeSelectionError("Failed to load attribute selection data.");
      } finally {
        if (token == null || pollTokenRef.current === token) {
          setAttributeSelectionLoading(false);
        }
      }
    },
    [caseId, partitionId],
  );

  const startPollingForNode = useCallback(
    (nodeId: string) => {
      if (!caseId || !partitionId || !nodeId) return;
      const token = invalidatePolling();
      const pollForResults = async () => {
        if (pollTokenRef.current !== token) return;
        try {
          const pollResponse = await WorkflowApi.pollPartitionTreeNode(
            caseId,
            partitionId,
            nodeId,
          );
          if (pollTokenRef.current !== token) return;
          const complete = isCompletedStatus(pollResponse?.status);
          setPollRes(pollResponse);
          if (complete) {
            stopPolling();
            return;
          }
          pollTimerRef.current = window.setTimeout(pollForResults, 2000);
        } catch (e) {
          if (pollTokenRef.current !== token) return;
          console.error("Polling failed:", e);
          setPollRes({ status: "ERROR", percent: 0, data: undefined });
          stopPolling();
        }
      };
      pollForResults();
    },
    [caseId, partitionId, invalidatePolling, stopPolling],
  );

  const handleNodeRun = useCallback(
    async (nodeId: string) => {
      if (!caseId || !partitionId) return;
      const requestedNodeId = String(nodeId);
      const nodeInFlow = nodes.find((n) => n.id === nodeId);
      const nodeData = nodeInFlow?.data as PartitionTreeNodeData | undefined;

      if (
        retainedWorkflowNodeId &&
        retainedWorkflowNodeId !== requestedNodeId
      ) {
        persistCurrentWorkflowSession(retainedWorkflowNodeId);
      }

      if (
        hasRetainedWorkflowSession &&
        retainedWorkflowNodeId === requestedNodeId
      ) {
        if (nodeData) setSelectedWorkflowNode(nodeData);
        setActiveInnerTab("attribute-selection");
        setWorkflowOpen(true);

        if (
          attributeSelectionSubmitted &&
          !isCompletedStatus(pollRes?.status)
        ) {
          startPollingForNode(requestedNodeId);
        }
        if (!attributeSelectionLoading && attributeSelectionData == null) {
          setAttributeSelectionLoading(true);
          const token = pollTokenRef.current;
          const nodeObj =
            currentNodeObj ??
            workflowSessionsRef.current[requestedNodeId]?.currentNodeObj ??
            null;
          if (nodeObj) {
            if (!currentNodeObj) setCurrentNodeObj(nodeObj);
            void loadAttributeSelectionData(nodeObj, token);
          } else {
            setAttributeSelectionLoading(false);
          }
        }
        return;
      }

      const restored = restoreWorkflowSession(requestedNodeId, nodeData);
      if (restored) {
        const switchToken = invalidatePolling();
        const restoredSession = workflowSessionsRef.current[requestedNodeId];
        const restoredNodeObj = restoredSession?.currentNodeObj ?? null;
        const shouldResumePolling =
          Boolean(restoredSession?.attributeSelectionSubmitted) &&
          !isCompletedStatus(restoredSession?.pollRes?.status);

        setActiveInnerTab("attribute-selection");
        setWorkflowOpen(true);

        if (
          restoredNodeObj &&
          restoredSession?.attributeSelectionData == null
        ) {
          setAttributeSelectionLoading(true);
          void loadAttributeSelectionData(restoredNodeObj, switchToken);
        }
        if (shouldResumePolling) {
          startPollingForNode(requestedNodeId);
        }
        return;
      }

      if (!nodeData?.isClickable) {
        return;
      }

      const runKey = `${caseId}:${partitionId}:${nodeId}`;
      const now = Date.now();
      if (
        runGuardRef.current.key === runKey &&
        (runGuardRef.current.inFlight ||
          now - runGuardRef.current.ts < RUN_GUARD_MS)
      ) {
        return;
      }
      runGuardRef.current = { key: runKey, inFlight: true, ts: now };

      try {
        clearWorkflowSessionState();
        setRetainedWorkflowNodeRunId(requestedNodeId);
        setSelectedWorkflowNode(nodeData ?? null);
        setActiveInnerTab("attribute-selection");
        setWorkflowOpen(true);
        setAttributeSelectionLoading(true);

        const token = invalidatePolling();

        const backendTree: any =
          workflowData?.data?.partition_tree?.result?.tree ??
          workflowData?.data?.steps?.partition_tree?.result?.tree ??
          null;

        const nodeObj = findNodeInTree(backendTree, nodeId) ?? {
          id: nodeId,
          parent_id: nodeData?.parentId ?? null,
          node_name: nodeData?.nodeName ?? nodeId,
          comments: null,
          children: [],
        };

        setCurrentNodeObj(nodeObj);
        setNodeMeta({
          branch: nodeObj?.branch != null ? String(nodeObj.branch) : null,
          level:
            typeof nodeObj?.level === "number"
              ? nodeObj.level
              : nodeObj?.level != null
                ? Number(nodeObj.level)
                : null,
        });
        await loadAttributeSelectionData(nodeObj, token);
      } catch (e) {
        console.error("handleNodeRun failed:", e);
      } finally {
        runGuardRef.current.inFlight = false;
      }
    },
    [
      caseId,
      partitionId,
      hasRetainedWorkflowSession,
      retainedWorkflowNodeId,
      nodes,
      currentNodeObj,
      pollRes,
      attributeSelectionLoading,
      attributeSelectionData,
      workflowData,
      attributeSelectionSubmitted,
      persistCurrentWorkflowSession,
      restoreWorkflowSession,
      clearWorkflowSessionState,
      invalidatePolling,
      loadAttributeSelectionData,
      startPollingForNode,
    ],
  );

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (readOnly || !caseId || !partitionId) return;
      const nodeInFlow = nodes.find((n) => n.id === nodeId);
      const nodeData = nodeInFlow?.data as PartitionTreeNodeData | undefined;
      if (nodeData?.nodeType !== "attribute") return;
      const deleteTargetNodeId = nodeData?.parentId ?? nodeId;

      setUpdatingTree(true);
      setUpdateMsg(null);

      try {
        const res = await WorkflowApi.deletePartitionTreeNode(
          caseId,
          partitionId,
          deleteTargetNodeId,
        );

        const newTree =
          res?.data?.partition_tree?.result?.tree ??
          res?.data?.steps?.partition_tree?.result?.tree ??
          res?.steps?.partition_tree ??
          null;

        if (newTree) {
          const { nodes: newPartitionNodes, edges: newEdges } = treeToFlowData(
            newTree,
            treeDefaultsRef.current.layout,
          );
          const computed = new Map<string, { x: number; y: number }>();
          for (const n of newPartitionNodes) {
            computed.set(n.id, { x: n.position.x, y: n.position.y });
          }
          computedPositionsRef.current = computed;

          const validPartitionNodeIds = new Set(
            newPartitionNodes.map((n) => n.id),
          );
          const nextNodeOverrides = new Map<
            string,
            Partial<NodeCustomizations>
          >();
          for (const [id, val] of nodeOverrides) {
            if (validPartitionNodeIds.has(id)) {
              nextNodeOverrides.set(id, val);
            }
          }

          const nextCollapsedNodeIds = new Set(
            Array.from(collapsedNodeIds).filter((id) =>
              validPartitionNodeIds.has(id),
            ),
          );
          nextCollapsedNodeIds.delete(deleteTargetNodeId);

          const externalNodes = nodes.filter((n) => n.type === "external");
          const nextAllNodes = [...newPartitionNodes, ...externalNodes];

          setNodes((prev) => {
            const ext = prev.filter((n) => n.type === "external");
            return [...newPartitionNodes, ...ext];
          });
          setEdges(newEdges);
          setNodeOverrides(nextNodeOverrides);
          setCollapsedNodeIds(nextCollapsedNodeIds);
          setSelectedNodeIds((prev) =>
            prev.filter((id) => validPartitionNodeIds.has(id)),
          );

          // Persist pruned metadata immediately so localStorage cannot keep stale
          // overrides/collapse state for deleted branch nodes. Clear the viewport
          // so the init effect (triggered by onPatchWorkflowFromDb) does not
          // restore the old pan/zoom and override our fitView.
          saveTreeState(
            caseId,
            partitionId,
            serializeTreeState({
              nodes: nextAllNodes,
              nodeOverrides: nextNodeOverrides,
              externalNodeOverrides,
              collapsedNodeIds: nextCollapsedNodeIds,
              computedPositions: computed,
              badgeColors,
              treeLayoutDefaults: treeDefaultsRef.current.layout,
              viewport: undefined,
              partitionTitle,
            }),
          );

          // Two nested RAFs: first waits for React to commit the updated nodes,
          // second waits for React Flow to finish measuring them before fitView.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              reactFlowInstance.current?.fitView({ padding: 0.2 });
              const vp = reactFlowInstance.current?.getViewport();
              if (vp) setViewportState(vp);
            });
          });
        }

        onPatchWorkflowFromDb?.(res);
        const queued =
          String(res?.status ?? "").toUpperCase() === "QUEUED" ||
          Boolean(res?.task_id);
        if (queued) {
          startObmStatusPolling();
        }
      } catch (e) {
        console.error("deletePartitionTreeNode failed:", e);
        setUpdateMsg("Failed to delete attribute branch. Please try again.");
      } finally {
        setUpdatingTree(false);
      }
    },
    [
      readOnly,
      caseId,
      partitionId,
      nodes,
      nodeOverrides,
      collapsedNodeIds,
      externalNodeOverrides,
      badgeColors,
      viewportState,
      partitionTitle,
      onPatchWorkflowFromDb,
      startObmStatusPolling,
      setNodes,
      setEdges,
    ],
  );

  const handleAttributeSelectionSubmit = useCallback(
    async (payload: any) => {
      if (readOnly || !caseId || !partitionId) return;
      const nodeObjFromPayload = payload?.node_obj ?? null;
      const nodeId = String(
        currentNodeObj?.id ??
          nodeObjFromPayload?.id ??
          retainedWorkflowNodeId ??
          "",
      );
      if (!nodeId) return;
      if (!currentNodeObj && nodeObjFromPayload) {
        setCurrentNodeObj(nodeObjFromPayload);
      }

      setAttributeSelectionLoading(true);
      setAttributeSelectionError(null);
      setPollRes(null);
      setAttributeSelectionSubmitted(true);
      setRetainedWorkflowNodeRunId(nodeId);

      try {
        await WorkflowApi.runProcess(
          caseId,
          partitionId,
          "process_partition_tree",
          payload,
        );
        setAttributeSelectionLoading(false);
        startPollingForNode(nodeId);
      } catch (e) {
        console.error("runProcess submit failed:", e);
        setAttributeSelectionError("Failed to submit attribute selection.");
        setAttributeSelectionSubmitted(false);
        setAttributeSelectionLoading(false);
      }
    },
    [
      readOnly,
      caseId,
      partitionId,
      currentNodeObj,
      retainedWorkflowNodeId,
      startPollingForNode,
    ],
  );

  const handleLevelTestingSubmit = useCallback(
    async (attributeName: string) => {
      if (readOnly || !caseId || !partitionId) return;
      const nodeId = String(currentNodeObj?.id ?? retainedWorkflowNodeId ?? "");
      if (!nodeId || !attributeName) return;
      resetWorkflowSession();
      setUpdatingTree(true);
      setUpdateMsg(null);

      try {
        const res = await WorkflowApi.selectPartitionTreeAttribute(
          caseId,
          partitionId,
          nodeId,
          attributeName,
        );

        // Immediately rebuild the ReactFlow tree from the response so the canvas
        // updates right away, without waiting for the parent's workflowData prop
        // to propagate back (which may keep the same nested object reference).
        const newTree =
          res?.data?.partition_tree?.result?.tree ??
          res?.data?.steps?.partition_tree?.result?.tree ??
          res?.steps?.partition_tree ??
          null;

        if (newTree) {
          const { nodes: newPartitionNodes, edges: newEdges } = treeToFlowData(
            newTree,
            treeDefaultsRef.current.layout,
          );
          // Update computed positions reference so the save effect stores correct baselines
          const computed = new Map<string, { x: number; y: number }>();
          for (const n of newPartitionNodes) {
            computed.set(n.id, { x: n.position.x, y: n.position.y });
          }
          computedPositionsRef.current = computed;

          setNodes((prev) => {
            const ext = prev.filter((n) => n.type === "external");
            return [...newPartitionNodes, ...ext];
          });
          setEdges(newEdges);
          // Clear collapse state for the node that just branched so children are visible
          const nextCollapsedNodeIds = new Set(
            Array.from(collapsedNodeIds).filter((id) => id !== nodeId),
          );
          setCollapsedNodeIds(nextCollapsedNodeIds);

          // Synchronously clear the stored viewport BEFORE notifying the parent.
          // When onPatchWorkflowFromDb triggers a workflowData prop change, the
          // initialization effect re-runs and reads from localStorage. If the old
          // viewport is still there it will overwrite our fitView call. Clearing it
          // here means pendingViewportRef stays null and the old pan/zoom is never
          // restored.
          if (caseId && partitionId) {
            const extNodes = nodes.filter((n) => n.type === "external");
            saveTreeState(
              caseId,
              partitionId,
              serializeTreeState({
                nodes: [...newPartitionNodes, ...extNodes],
                nodeOverrides,
                externalNodeOverrides,
                collapsedNodeIds: nextCollapsedNodeIds,
                computedPositions: computed,
                badgeColors,
                treeLayoutDefaults: treeDefaultsRef.current.layout,
                viewport: undefined, // intentionally cleared so fitView wins
                partitionTitle,
              }),
            );
          }

          // After the new nodes are rendered, fit the full tree in view and
          // persist the resulting viewport so subsequent reloads start fitted.
          // Two nested RAFs are needed: React Flow requires one render cycle to
          // measure newly added nodes, and a second cycle before fitView can
          // include those measured dimensions in its calculation.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              reactFlowInstance.current?.fitView({ padding: 0.2 });
              const vp = reactFlowInstance.current?.getViewport();
              if (vp) {
                setViewportState(vp);
              }
            });
          });
        }

        // Also notify the parent to keep workflowData in sync
        onPatchWorkflowFromDb?.(res);
      } catch (e) {
        console.error("selectPartitionTreeAttribute failed:", e);
        setUpdateMsg("Failed to update Partition Tree. Please try again.");
      } finally {
        setUpdatingTree(false);
      }
    },
    [
      readOnly,
      caseId,
      partitionId,
      currentNodeObj,
      retainedWorkflowNodeId,
      nodes,
      nodeOverrides,
      externalNodeOverrides,
      collapsedNodeIds,
      badgeColors,
      partitionTitle,
      resetWorkflowSession,
      onPatchWorkflowFromDb,
      setNodes,
      setEdges,
    ],
  );

  // displayNodes/displayEdges placed here so handleNodeRun is already in scope
  const displayNodes = useMemo(
    () =>
      nodes
        .filter((n) => n.type === "external" || !isNodeHidden(n.id))
        .map((n) => {
          const isSelected =
            selectedNodeIds.includes(n.id) ||
            selectedExternalNodeIds.includes(n.id);
          const canDragNode = canvasMode === "move" || isSelected;
          if (n.type === "external") {
            const overrides = externalNodeOverrides.get(n.id);
            return {
              ...n,
              selected: isSelected,
              draggable: canDragNode,
              data: {
                ...n.data,
                ...overrides,
                onRotationChange: (rotation: number) =>
                  handleRotationChange(n.id, rotation),
                onTailChange: (tail: { x: number; y: number }) =>
                  handleCalloutTailChange(n.id, tail),
                onLabelChange: (label: string) =>
                  handleExternalLabelChange(n.id, label),
              },
            };
          }
          const overrides = nodeOverrides.get(n.id);
          return {
            ...n,
            selected: isSelected,
            draggable: canDragNode,
            style: {
              ...n.style,
              width: overrides?.width ?? n.style?.width,
              height: overrides?.height ?? n.style?.height,
            },
            data: {
              ...n.data,
              ...overrides,
              isCollapsed: collapsedNodeIds.has(n.id),
              onToggleCollapse: handleToggleCollapse,
              editMode,
              onRunWorkflow: handleNodeRun,
              onDeleteNode: handleDeleteNode,
              badgeColors,
            },
          };
        }),
    [
      nodes,
      collapsedNodeIds,
      nodeOverrides,
      externalNodeOverrides,
      isNodeHidden,
      handleToggleCollapse,
      handleRotationChange,
      handleCalloutTailChange,
      handleExternalLabelChange,
      editMode,
      handleNodeRun,
      handleDeleteNode,
      badgeColors,
      canvasMode,
      selectedNodeIds,
      selectedExternalNodeIds,
    ],
  );
  // Keep ref in sync so handleNodeDrag (declared before this useMemo) can read it
  displayNodesRef.current = displayNodes;

  const displayEdges = useMemo(
    () =>
      edges.filter((e) => !isNodeHidden(e.source) && !isNodeHidden(e.target)),
    [edges, isNodeHidden],
  );

  React.useEffect(() => {
    let mergedLayout =
      treeDefaultsRef.current.layout ?? TREE_DEFAULTS.layout;

    let partitionNodes: Node[] = [];
    let newEdges: Edge[] = [];
    let externalNodes: Node<ExternalNodeData>[] = [];
    let overrides = new Map<string, Partial<NodeCustomizations>>();
    let extOverrides = new Map<string, Partial<ExternalNodeCustomizations>>();
    let collapsed = new Set<string>();
    let restoredPartitionTitle: string | null = null;

    if (caseId && partitionId) {
      const rawObj = loadTreeState(caseId, partitionId);
      const persisted = rawObj
        ? deserializeTreeState(JSON.stringify(rawObj))
        : null;
      if (persisted) {
        if (persisted.treeLayoutDefaults) {
          mergedLayout = persisted.treeLayoutDefaults;
          setTreeDefaults((prev) => ({ ...prev, layout: mergedLayout }));
        }
        if (
          typeof persisted.partitionTitle === "string" &&
          persisted.partitionTitle.trim()
        ) {
          restoredPartitionTitle = persisted.partitionTitle.trim();
        }
        const posOverrides = persisted.nodePositionOverrides ?? {};
        const { nodes: layoutNodes, edges: layoutEdges } = treeToFlowData(
          partitionTree,
          mergedLayout,
        );
        newEdges = layoutEdges;
        partitionNodes = layoutNodes.map((n) => {
          const pos = posOverrides[n.id];
          if (pos) return { ...n, position: pos };
          return n;
        });
        for (const p of persisted.externalNodes ?? []) {
          externalNodes.push({
            id: p.id,
            type: "external",
            position: p.position,
            data: { label: p.label, shape: p.shape },
            style: { width: p.width, height: p.height },
            sourcePosition: Position.Bottom,
            targetPosition: Position.Top,
          });
          const extO: Partial<ExternalNodeCustomizations> = {};
          if (p.customLabel != null) extO.customLabel = p.customLabel;
          if (p.customBackground != null)
            extO.customBackground = p.customBackground;
          if (p.customColor != null) extO.customColor = p.customColor;
          if (p.textAlign != null) extO.textAlign = p.textAlign;
          if (p.rotation != null) extO.rotation = p.rotation;
          if (p.fontSize != null) extO.fontSize = p.fontSize;
          if (p.fontWeight != null) extO.fontWeight = p.fontWeight;
          if (p.paddingX != null) extO.paddingX = p.paddingX;
          if (p.paddingY != null) extO.paddingY = p.paddingY;
          if (p.opacity != null) extO.opacity = p.opacity;
          if (p.borderColor != null) extO.borderColor = p.borderColor;
          if (p.borderWidth != null) extO.borderWidth = p.borderWidth;
          if (p.borderStyle != null) extO.borderStyle = p.borderStyle;
          if (p.shadowColor != null) extO.shadowColor = p.shadowColor;
          if (p.shadowBlur != null) extO.shadowBlur = p.shadowBlur;
          if (p.shadowOffsetX != null) extO.shadowOffsetX = p.shadowOffsetX;
          if (p.shadowOffsetY != null) extO.shadowOffsetY = p.shadowOffsetY;
          if (p.tailOffsetX != null) extO.tailOffsetX = p.tailOffsetX;
          if (p.tailOffsetY != null) extO.tailOffsetY = p.tailOffsetY;
          if (Object.keys(extO).length > 0) extOverrides.set(p.id, extO);
        }
        syncExternalNodeIdCounter(externalNodes.map((n) => n.id));
        for (const [id, val] of Object.entries(persisted.nodeOverrides ?? {})) {
          if (val && Object.keys(val).length > 0) overrides.set(id, val);
        }
        // Apply persisted partition dimensions directly into node style as well,
        // so the base nodes state and rendered nodes stay in sync.
        partitionNodes = partitionNodes.map((n) => {
          const ov = overrides.get(n.id);
          if (!ov) return n;
          const width =
            typeof ov.width === "number" ? ov.width : n.style?.width;
          const height =
            typeof ov.height === "number" ? ov.height : n.style?.height;
          if (width == null && height == null) return n;
          return {
            ...n,
            style: { ...n.style, width, height },
          };
        });
        collapsed = new Set(persisted.collapsedNodeIds ?? []);

        // Restore badge colors from persisted state
        if (persisted.badgeColors) {
          setBadgeColors(persisted.badgeColors);
        }
        pendingViewportRef.current = persisted.viewport ?? null;
      }
    }

    if (partitionNodes.length === 0) {
      const layoutResult = treeToFlowData(partitionTree, mergedLayout);
      partitionNodes = layoutResult.nodes;
      newEdges = layoutResult.edges;
    }

    const computed = new Map<string, { x: number; y: number }>();
    for (const n of partitionNodes) {
      computed.set(n.id, { x: n.position.x, y: n.position.y });
    }
    computedPositionsRef.current = computed;

    setNodes((prev) => {
      const ext =
        externalNodes.length > 0
          ? externalNodes
          : prev.filter((n) => n.type === "external");
      return [...partitionNodes, ...ext];
    });
    setEdges(newEdges);
    setCollapsedNodeIds(collapsed);
    setNodeOverrides(overrides);
    setExternalNodeOverrides(extOverrides);
    const nextTitle = restoredPartitionTitle ?? defaultPartitionTitle;
    setPartitionTitle(nextTitle);
    setPartitionTitleDraft(nextTitle);
    setIsEditingPartitionTitle(false);
    hasSavedOnceRef.current = false;
    restoredRef.current = true;
    requestAnimationFrame(() => {
      const vp = pendingViewportRef.current;
      if (vp && reactFlowInstance.current) {
        reactFlowInstance.current.setViewport(vp, { duration: 0 });
        setViewportState(vp);
      }
    });
  }, [
    partitionTree,
    caseId,
    partitionId,
    setNodes,
    setEdges,
    defaultPartitionTitle,
  ]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!caseId || !partitionId || !restoredRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = null;
    }
    if (hasSavedOnceRef.current) {
      setSaveStatus("pending");
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      try {
        const state = serializeTreeState({
          nodes,
          nodeOverrides,
          externalNodeOverrides,
          collapsedNodeIds,
          computedPositions: computedPositionsRef.current,
          badgeColors,
          treeLayoutDefaults: treeDefaults.layout,
          viewport: viewportState ?? reactFlowInstance.current?.getViewport(),
          partitionTitle,
        });
        saveTreeState(caseId, partitionId, state);
        if (hasSavedOnceRef.current) {
          setSaveStatus("saved");
          savedTimeoutRef.current = setTimeout(() => {
            setSaveStatus("idle");
            savedTimeoutRef.current = null;
          }, 2000);
        }
        hasSavedOnceRef.current = true;
      } catch {
        // localStorage can throw (quota exceeded, private mode)
        setSaveStatus("idle");
      }
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [
    nodes,
    nodeOverrides,
    externalNodeOverrides,
    collapsedNodeIds,
    badgeColors,
    treeDefaults,
    viewportState,
    caseId,
    partitionId,
    partitionTitle,
  ]);

  // Cleanup the "saved" display timeout on unmount
  React.useEffect(
    () => () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    },
    [],
  );

  // OBM state sync from workflowData changes
  useEffect(() => {
    const next = extractObmHolds(workflowData);
    if (typeof next === "boolean" || obmHolds == null) {
      setObmHolds(next);
    }
  }, [workflowData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!workflowData) return;
    const rawStatus = extractObmStatus(workflowData);
    const statusNorm = rawStatus ? rawStatus.toLowerCase() : null;
    if (statusNorm === "processing") {
      startObmStatusPolling();
      return;
    }
    if (statusNorm === "completed") {
      const holds = extractObmHolds(workflowData);
      if (typeof holds === "boolean") setObmHolds(holds);
      stopObmStatusPolling();
    }
  }, [workflowData, startObmStatusPolling, stopObmStatusPolling]);

  // Cleanup all polling on unmount
  useEffect(() => {
    return () => {
      stopObmStatusPolling();
      invalidatePolling();
    };
  }, [invalidatePolling, stopObmStatusPolling]);

  const selectedNodes = useMemo(
    () => displayNodes.filter((n) => selectedNodeIds.includes(n.id)),
    [displayNodes, selectedNodeIds],
  );

  // For single selection, use the first node's data for the panel
  const primaryNodeData =
    selectedNodes.length === 1
      ? (selectedNodes[0].data as unknown as PartitionTreeNodeData)
      : null;

  const selectedExternalNodes = useMemo(
    () =>
      displayNodes.filter(
        (n) => n.type === "external" && selectedExternalNodeIds.includes(n.id),
      ),
    [displayNodes, selectedExternalNodeIds],
  );
  const rawSelectedExternalNodes = useMemo(
    () =>
      nodes.filter(
        (n) => n.type === "external" && selectedExternalNodeIds.includes(n.id),
      ),
    [nodes, selectedExternalNodeIds],
  );
  const rawSelectedPartitionNodes = useMemo(
    () =>
      nodes.filter(
        (n) => n.type !== "external" && selectedNodeIds.includes(n.id),
      ),
    [nodes, selectedNodeIds],
  );
  const canCustomizeBadgesForSelection = useMemo(() => {
    if (rawSelectedPartitionNodes.length === 0) return true;
    return rawSelectedPartitionNodes.some((n) => {
      const data = n.data as PartitionTreeNodeData | undefined;
      return data?.nodeType !== "attribute";
    });
  }, [rawSelectedPartitionNodes]);
  const selectedPartitionOverrides = useMemo(() => {
    if (selectedNodeIds.length === 0) return {};
    const selected = selectedNodeIds
      .map((id) => nodeOverrides.get(id))
      .filter((v): v is Partial<NodeCustomizations> => Boolean(v));
    if (selected.length === 0) return {};
    const keys = new Set<keyof NodeCustomizations>();
    for (const ov of selected) {
      for (const key of Object.keys(ov) as (keyof NodeCustomizations)[]) {
        keys.add(key);
      }
    }
    const shared: Partial<NodeCustomizations> = {};
    for (const key of keys) {
      const first = selected[0][key];
      if (selected.every((ov) => ov[key] === first)) {
        (shared as any)[key] = first;
      }
    }
    return shared;
  }, [selectedNodeIds, nodeOverrides]);
  const selectedExternalOverrides = useMemo(() => {
    if (selectedExternalNodeIds.length === 0) return {};
    const selected = selectedExternalNodeIds
      .map((id) => externalNodeOverrides.get(id))
      .filter((v): v is Partial<ExternalNodeCustomizations> => Boolean(v));
    if (selected.length === 0) return {};
    const keys = new Set<keyof ExternalNodeCustomizations>();
    for (const ov of selected) {
      for (const key of Object.keys(
        ov,
      ) as (keyof ExternalNodeCustomizations)[]) {
        keys.add(key);
      }
    }
    const shared: Partial<ExternalNodeCustomizations> = {};
    for (const key of keys) {
      const first = selected[0][key];
      if (selected.every((ov) => ov[key] === first)) {
        (shared as any)[key] = first;
      }
    }
    return shared;
  }, [selectedExternalNodeIds, externalNodeOverrides]);
  const primaryExternalNodeData =
    selectedExternalNodes.length > 0
      ? (selectedExternalNodes[0].data as ExternalNodeData)
      : null;

  // Workflow derived values
  const completed = isCompletedStatus(pollRes?.status);
  const percent = Number(pollRes?.percent ?? pollRes?.progress ?? 0) || 0;
  const baseTestingPayload =
    pollRes?.data?.base_testing ?? attributeSelectionData?.base_testing ?? null;
  const levelTestingPayload =
    pollRes?.data?.level_testing ??
    attributeSelectionData?.level_testing ??
    null;
  const hasAttributeSelectionData =
    attributeSelectionHasData && attributeSelectionData != null;
  const testingTabsEnabled =
    (attributeSelectionSubmitted && completed) || hasAttributeSelectionData;
  const workflowTabs: Array<{
    id: InnerTab;
    label: string;
    enabled: boolean;
  }> = [
    { id: "attribute-selection", label: "Attribute Selection", enabled: true },
    { id: "partner-view", label: "Overview", enabled: testingTabsEnabled },
    { id: "base-testing", label: "Base Testing", enabled: testingTabsEnabled },
    {
      id: "level-testing",
      label: "Level Testing",
      enabled: testingTabsEnabled,
    },
    { id: "sku-list", label: "SKU List", enabled: true },
  ];
  const workflowTabGroups = [
    workflowTabs.slice(0, 2),
    workflowTabs.slice(2, 4),
    workflowTabs.slice(4),
  ];

  const refitTreeView = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        reactFlowInstance.current?.fitView({ padding: 0.2 });
        const vp = reactFlowInstance.current?.getViewport();
        if (vp) setViewportState(vp);
      });
    });
  }, []);

  const hasNodeSelection =
    selectedNodeIds.length > 0 || selectedExternalNodeIds.length > 0;

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullScreen(document.fullscreenElement === fullScreenRootRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // In native fullscreen, only nodes inside the fullscreen element are shown,
  // so dialogs portaled to document.body are invisible. Render them inline
  // ("self") while fullscreen, and to document.body otherwise.
  const dialogAppendTo: HTMLElement | "self" = isFullScreen
    ? "self"
    : document.body;

  useEffect(() => {
    return () => {
      if (document.fullscreenElement === fullScreenRootRef.current) {
        void document.exitFullscreen();
      }
    };
  }, []);

  const fullScreenMountedRef = useRef(false);
  useEffect(() => {
    if (!fullScreenMountedRef.current) {
      fullScreenMountedRef.current = true;
      return;
    }
    refitTreeView();
  }, [isFullScreen, refitTreeView]);

  const toggleFullScreen = useCallback(async () => {
    const el = fullScreenRootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen request failed:", err);
    }
  }, []);

  const editorPanelVariant = isFullScreen ? "tabs" : "sections";

  const renderEditorPanels = (panelVariant: "sections" | "tabs") => (
    <>
      {selectedNodeIds.length > 0 && (
        <NodeEditorPanel
          variant={panelVariant}
          mode="partition-tree"
          nodeIds={selectedNodeIds}
          nodeData={primaryNodeData}
          overrides={
            selectedNodeIds.length === 1
              ? (nodeOverrides.get(selectedNodeIds[0]) ?? {})
              : selectedPartitionOverrides
          }
          dimensions={
            rawSelectedPartitionNodes.length > 0
              ? (() => {
                  const first = rawSelectedPartitionNodes[0];
                  const w = first.style?.width ?? first.measured?.width;
                  const h = first.style?.height ?? first.measured?.height;
                  return {
                    width: typeof w === "number" ? w : 140,
                    height: typeof h === "number" ? h : 56,
                  };
                })()
              : undefined
          }
          onClose={() => setSelectedNodeIds([])}
          onUpdate={handleBatchUpdate}
          onUpdateDimensions={handlePartitionNodeUpdateDimensions}
          canCustomizeBadges={canCustomizeBadgesForSelection}
          onReset={handleBatchReset}
          brandColors={brandColors}
        />
      )}
      {selectedExternalNodeIds.length > 0 && (
        <NodeEditorPanel
          variant={panelVariant}
          mode="external"
          nodeIds={selectedExternalNodeIds}
          nodeData={primaryExternalNodeData}
          brandColors={brandColors}
          overrides={
            selectedExternalNodeIds.length === 1
              ? (externalNodeOverrides.get(selectedExternalNodeIds[0]) ?? {})
              : selectedExternalOverrides
          }
          dimensions={
            rawSelectedExternalNodes.length > 0
              ? (() => {
                  const first = rawSelectedExternalNodes[0];
                  const shape = primaryExternalNodeData?.shape ?? "box";
                  const defaults = getExternalShapeDefaults(shape);
                  const w = first.style?.width ?? first.measured?.width;
                  const h = first.style?.height ?? first.measured?.height;
                  return {
                    width: typeof w === "number" ? w : defaults.width,
                    height: typeof h === "number" ? h : defaults.height,
                  };
                })()
              : undefined
          }
          onClose={() => setSelectedExternalNodeIds([])}
          onUpdate={handleExternalBatchUpdate}
          onUpdateDimensions={handleExternalNodeUpdateDimensions}
          onReset={handleExternalBatchReset}
          onDelete={handleExternalBatchDelete}
        />
      )}
    </>
  );

  const renderEditorAside = (panelVariant: "sections" | "tabs") => (
    <aside
      className={`flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white ${
        panelVariant === "tabs" ? "w-[252px]" : "w-[300px]"
      }`}
    >
      {panelVariant === "sections" && !hasNodeSelection ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
          <div className="shrink-0">
            <TreeLegend
              colors={badgeColors}
              onColorsChange={handleBadgeColorsChange}
            />
          </div>
          {!readOnly && (
            <TreeLayoutDefaultsPanel
              layout={treeDefaults.layout}
              onChange={applyLayoutDefaults}
              onReset={() => applyLayoutDefaults(TREE_DEFAULTS.layout)}
            />
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {renderEditorPanels(panelVariant)}
        </div>
      )}
    </aside>
  );

  const renderEditorOverlay = () => {
    if (!hasNodeSelection) return null;
    return (
      <div
        className="pointer-events-none absolute inset-y-1 right-2 z-20 flex w-[252px] justify-end"
        aria-hidden={false}
      >
        <div className="pointer-events-auto flex h-full max-h-full w-full flex-col overflow-hidden rounded-lg border border-gray-200/90 bg-white shadow-xl">
          {renderEditorPanels("tabs")}
        </div>
      </div>
    );
  };

  const renderTreeCanvas = (fullscreenCanvas: boolean) => {
    const slideBorder = "1px solid #e5e7eb";
    const slideFrameStyle: React.CSSProperties = fullscreenCanvas
      ? {
          aspectRatio: PARTITION_TREE_CANVAS_ASPECT_RATIO,
          height: "100%",
          maxHeight: "100%",
          width: "auto",
          maxWidth: "100%",
          border: slideBorder,
        }
      : {
          aspectRatio: PARTITION_TREE_CANVAS_ASPECT_RATIO,
          width: "100%",
          border: slideBorder,
        };

    const slideContent = (
        <div className="flex h-full min-h-0 flex-col bg-white">
          <div
            className="flex shrink-0 items-center justify-between px-6 py-4"
            style={{ borderBottom: "2.5px solid #dc2626" }}
          >
            <div className="flex min-w-0 items-center gap-2">
              {isEditingPartitionTitle && !readOnly ? (
                <input
                  type="text"
                  value={partitionTitleDraft}
                  onChange={(e) => setPartitionTitleDraft(e.target.value)}
                  onBlur={() => {
                    const next =
                      partitionTitleDraft.trim() || "Partition Title";
                    setPartitionTitle(next);
                    setPartitionTitleDraft(next);
                    setIsEditingPartitionTitle(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const next =
                        partitionTitleDraft.trim() || "Partition Title";
                      setPartitionTitle(next);
                      setPartitionTitleDraft(next);
                      setIsEditingPartitionTitle(false);
                    }
                    if (e.key === "Escape") {
                      setPartitionTitleDraft(partitionTitle);
                      setIsEditingPartitionTitle(false);
                    }
                  }}
                  className="w-full max-w-[520px] rounded border border-gray-300 px-2 py-1 text-2xl font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  autoFocus
                  aria-label="Partition title"
                />
              ) : (
                <h2
                  className={`truncate text-2xl font-semibold text-gray-900 ${readOnly ? "" : "cursor-text"}`}
                  onDoubleClick={() => {
                    if (readOnly) return;
                    setPartitionTitleDraft(partitionTitle);
                    setIsEditingPartitionTitle(true);
                  }}
                  title={
                    readOnly ? partitionTitle : "Double-click to edit title"
                  }
                >
                  {partitionTitle}
                </h2>
              )}
            </div>
            {!fullscreenCanvas && (
              <div
                className="flex items-center gap-2"
                data-download-ignore="true"
              >
                {!readOnly && !isEditingPartitionTitle && (
                  <button
                    type="button"
                    onClick={() => {
                      setPartitionTitleDraft(partitionTitle);
                      setIsEditingPartitionTitle(true);
                    }}
                    title="Edit title"
                    aria-label="Edit title"
                    className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Edit title
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  title="Download as PNG"
                  aria-label="Download as PNG"
                  className="p-1 text-gray-600 transition-colors hover:text-gray-900"
                >
                  <Download size={18} />
                </button>
              </div>
            )}
            {fullscreenCanvas && !readOnly && !isEditingPartitionTitle && (
              <button
                type="button"
                onClick={() => {
                  setPartitionTitleDraft(partitionTitle);
                  setIsEditingPartitionTitle(true);
                }}
                title="Edit title"
                aria-label="Edit title"
                className="rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                data-download-ignore="true"
              >
                Edit title
              </button>
            )}
          </div>
          <div className="relative min-h-0 flex-1 p-2">
            <div
              className="relative mx-auto h-full max-w-full bg-white"
              ref={reactFlowWrapperRef}
            >
              <ReactFlow
                className="h-full w-full"
                proOptions={{ hideAttribution: true }}
                nodes={displayNodes}
                edges={displayEdges}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onPaneClick={handlePaneClick}
                onSelectionChange={handleSelectionChange}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeDrag={handleNodeDrag}
                onNodeDragStop={handleNodeDragStop}
                selectionOnDrag={canvasMode === "select"}
                selectionMode={SelectionMode.Partial}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{
                  type: "tree",
                  style: { stroke: "#000", strokeWidth: 1.5 },
                }}
                onInit={(instance) => {
                  reactFlowInstance.current =
                    instance as unknown as ReactFlowInstance;
                  const vp = pendingViewportRef.current;
                  if (vp) {
                    reactFlowInstance.current.setViewport(vp, {
                      duration: 0,
                    });
                    setViewportState(vp);
                  }
                }}
                onMoveEnd={(_event, viewport) => {
                  setViewportState({
                    x: viewport.x,
                    y: viewport.y,
                    zoom: viewport.zoom,
                  });
                }}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
                nodesDraggable={true}
                nodesConnectable={false}
                elementsSelectable={true}
                panOnDrag={canvasMode === "move" ? [0, 1, 2] : false}
                panOnScroll={false}
                zoomOnScroll={true}
                zoomOnPinch={true}
                zoomOnDoubleClick={true}
                deleteKeyCode={["Delete", "Backspace"]}
                onBeforeDelete={onBeforeDelete}
              >
                <AlignmentGuides guides={alignmentGuides} />
                {fullscreenCanvas && !hasNodeSelection && (
                  <Panel position="top-right" className="!m-2 select-none">
                    <TreeLegend
                      variant="floating"
                      colors={badgeColors}
                      onColorsChange={handleBadgeColorsChange}
                    />
                  </Panel>
                )}
                {saveStatus !== "idle" && (
                  <Panel position="bottom-left" className="select-none">
                    <span
                      className={`text-[10px] font-medium transition-opacity duration-300 ${
                        saveStatus === "pending"
                          ? "text-gray-400 animate-pulse"
                          : "text-green-600"
                      }`}
                    >
                      {saveStatus === "pending" ? "Saving..." : "\u2713 Saved"}
                    </span>
                  </Panel>
                )}
              </ReactFlow>
            </div>
          </div>
        </div>
    );

    return (
      <div
        ref={containerRef}
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-white"
      >
        {fullscreenCanvas ? (
          <div
            className="flex h-full min-h-0 flex-1 flex-col items-center px-2 py-1"
            style={{ containerType: "size" }}
          >
            <div
              className="flex h-full min-h-0 flex-col"
              style={slideFrameStyle}
            >
              {slideContent}
            </div>
          </div>
        ) : (
          <div className="w-full" style={slideFrameStyle}>
            {slideContent}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={fullScreenRootRef}
      className={`partition-tree-editor flex flex-col w-full min-h-0 bg-white ${
        isFullScreen ? "h-full overflow-hidden" : ""
      }`}
    >
      {/* Top toolbar: roll-up + OBM status (embedded view only) */}
      {!isFullScreen && (
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-red-600 bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 hover:border-red-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500"
            onClick={() => setRollupsDialogOpen(true)}
          >
            <Add />
            Create Rollups
          </button>

          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white shrink-0">
            <div className="inline-flex items-center rounded-md border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setCanvasMode("move")}
                className={`h-8 px-3 text-[11px] font-medium transition-colors ${
                  canvasMode === "move"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
                title="Move mode"
                aria-pressed={canvasMode === "move"}
              >
                Move
              </button>
              <button
                type="button"
                onClick={() => setCanvasMode("select")}
                className={`h-8 px-3 text-[11px] font-medium border-l border-gray-200 transition-colors ${
                  canvasMode === "select"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
                title="Select mode (drag to select multiple nodes)"
                aria-pressed={canvasMode === "select"}
              >
                Select
              </button>
            </div>
            <button
              type="button"
              onClick={handleReset}
              title="Reset to default"
              aria-label="Reset to default"
              className="flex items-center justify-center gap-1.5 h-8 px-3 text-[11px] font-medium rounded-md transition-colors bg-white shadow-xs border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              <Repeat size={14} />
              Reset
            </button>
            <button
              type="button"
              onClick={toggleFullScreen}
              title={isFullScreen ? "Exit full screen" : "Full screen"}
              aria-label={isFullScreen ? "Exit full screen" : "Full screen"}
              aria-pressed={isFullScreen}
              className="flex items-center justify-center gap-1.5 h-8 px-3 text-[11px] font-medium rounded-md transition-colors bg-white shadow-xs border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              {isFullScreen ? <Minimize size={14} /> : <Maximize size={14} />}
              {isFullScreen ? "Exit Full Screen" : "Full Screen"}
            </button>
            <ExternalNodePanel />
          </div>
        </div>
        {(obmHolds != null || obmProcessing) && (
          <div className="flex items-center gap-2">
            <ObmHoldsBadge value={obmHolds} />
            {obmProcessing && <LoaderIcon />}
          </div>
        )}
      </div>
      )}

      {/* Status messages */}
      {updatingTree && (
        <div className="mx-4 mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          Updating Partition Tree...
        </div>
      )}
      {updateMsg && (
        <div className="mx-4 mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {updateMsg}
        </div>
      )}

      <TreeDefaultsProvider value={treeDefaults}>
        {isFullScreen ? (
          <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
            <ToolRail
              canvasMode={canvasMode}
              onCanvasModeChange={setCanvasMode}
              onCreateRollups={() => setRollupsDialogOpen(true)}
              onReset={handleReset}
              onToggleFullScreen={toggleFullScreen}
              onDownload={handleDownloadPng}
              isFullScreen={isFullScreen}
            />
            <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-gray-50 px-2 py-1">
              <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                {renderTreeCanvas(true)}
              </div>
              {renderEditorOverlay()}
            </div>
          </div>
        ) : (
          <div className="mx-4 mb-3 mt-3 flex flex-row items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white">
            {renderTreeCanvas(false)}
            {renderEditorAside(editorPanelVariant)}
          </div>
        )}
      </TreeDefaultsProvider>

      {/* Upload Grouping Data Dialog */}
      <Dialog
        key={isFullScreen ? "rollups-fs" : "rollups-embedded"}
        visible={rollupsDialogOpen}
        modal
        appendTo={dialogAppendTo}
        position="center"
        onHide={() => setRollupsDialogOpen(false)}
        header="Upload Roll Up Groupings"
        className="w-[92vw] max-w-[800px] rounded-xl [&_.p-dialog-header]:!bg-gray-50 [&_.p-dialog-header]:!border-0 [&_.p-dialog-content]:!bg-gray-50 [&_.p-dialog-content]:!border-0"
        headerClassName="!px-6 !py-2"
        contentClassName="!pt-4 !pb-5 !px-5"
        maskClassName="backdrop-blur-[2px] bg-black/30 !flex !items-center !justify-center"
      >
        <AttributeRollUp onClose={() => setRollupsDialogOpen(false)} />
      </Dialog>

      {/* Workflow Dialog */}
      <Dialog
        key={isFullScreen ? "workflow-fs" : "workflow-embedded"}
        visible={workflowOpen}
        modal
        appendTo={dialogAppendTo}
        position="center"
        onHide={hideWorkflowDialog}
        header={
          <div className="flex w-full flex-col gap-1">
            <span className="text-[18px] font-semibold text-gray-900 leading-tight">
              {selectedWorkflowNode?.nodeName ?? "Partition Tree"}
            </span>
            {attributeSelectionSubmitted && !completed ? (
              <span className="mt-1 text-[12px] text-amber-600">
                Processing...{" "}
                <span className="font-semibold">
                  {String(pollRes?.status ?? "QUEUED")}
                </span>
                {pollRes?.percent != null || pollRes?.progress != null ? (
                  <>
                    {" "}
                    Progress:{" "}
                    <span className="font-semibold">{percent.toFixed(1)}%</span>
                  </>
                ) : null}
              </span>
            ) : completed ? (
              <span className="mt-1 text-[12px] text-green-600">
                Status:{" "}
                <span className="font-semibold">
                  {String(pollRes?.status ?? "COMPLETED")}
                </span>{" "}
                Progress: <span className="font-semibold">{percent.toFixed(1)}%</span>
              </span>
            ) : null}
            {completed && nodeMeta ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                <div className="inline-flex items-center gap-2">
                  <span className="rounded bg-gray-200 px-2 py-[2px] font-medium text-gray-700">
                    Current Branch :
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-[2px] font-semibold text-gray-900">
                    {nodeMeta.branch ?? "-"}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2">
                  <span className="rounded bg-gray-200 px-2 py-[2px] font-medium text-gray-700">
                    Current Level :
                  </span>
                  <span className="rounded bg-gray-100 px-2 py-[2px] font-semibold text-gray-900">
                    {nodeMeta.level ?? "-"}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        }
        className="w-[96vw] max-w-[96vw] max-h-[90vh] h-[88vh] rounded-md border border-gray-200 shadow-xl flex flex-col [&_.p-dialog-header]:!px-6 [&_.p-dialog-header]:!pt-3 [&_.p-dialog-header]:!pb-2 [&_.p-dialog-header]:!bg-white [&_.p-dialog-header]:!border-b [&_.p-dialog-header]:!border-gray-200"
        contentClassName="!p-0 !flex !flex-col !flex-1 !min-h-0 !overflow-hidden !bg-white"
        maskClassName="backdrop-blur-[2px] bg-black/30 !flex !items-center !justify-center"
      >
        <div className="flex min-h-0 flex-col h-full overflow-hidden bg-white">
          {/* Tab bar */}
          <div className="border-b border-gray-200 px-6 pt-4 pb-2 flex-shrink-0 bg-white">
            <div className="flex flex-wrap items-center gap-2">
              {workflowTabGroups.map((group, groupIndex) => (
                <Fragment key={group.map((t) => t.id).join("-")}>
                  {groupIndex > 0 && (
                    <div
                      className="h-5 w-px shrink-0 bg-gray-300 mx-1"
                      aria-hidden
                    />
                  )}
                  {group.map((tab) => {
                    const active = activeInnerTab === tab.id;
                    const isTopPair =
                      tab.id === "attribute-selection" ||
                      tab.id === "partner-view";
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveInnerTab(tab.id)}
                        disabled={!tab.enabled}
                        className={`h-8 px-4 text-[12px] font-semibold transition-colors ${
                          active
                            ? "bg-red-600 text-white"
                            : isTopPair
                              ? "bg-[#fbecee] text-[#ba2740] hover:bg-[#f7dde2]"
                              : "bg-transparent text-gray-400 hover:text-gray-600"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          {/* Tab content - AttributeSelection stays always-mounted to preserve checkbox state across tab changes */}
          <div className="flex-1 overflow-hidden relative">
            <div
              className="h-full overflow-auto p-4"
              style={{
                display: activeInnerTab === "attribute-selection" ? "" : "none",
              }}
            >
              <AttributeSelection
                data={attributeSelectionData}
                loading={attributeSelectionLoading}
                error={attributeSelectionError}
                readOnly={readOnly}
                nodeObj={currentNodeObj}
                onSubmitSelection={handleAttributeSelectionSubmit}
                resultsFetching={attributeSelectionSubmitted && !completed}
              />
            </div>
            {activeInnerTab === "partner-view" && (
              <div className="h-full overflow-hidden">
                {!attributeSelectionSubmitted && !hasAttributeSelectionData ? (
                  <div className="flex items-center justify-center h-full p-6">
                    <div className="text-center text-gray-500 text-sm">
                      <p className="font-medium">
                        Submit attribute selection first
                      </p>
                      <p className="mt-1 text-xs">
                        Go to Attribute Selection tab and click Submit to load
                        data
                      </p>
                    </div>
                  </div>
                ) : !hasAttributeSelectionData && !completed ? (
                  <div className="flex items-center justify-center h-full p-6">
                    <div className="text-center text-gray-500 text-sm animate-pulse">
                      <p className="font-medium">Processing...</p>
                      <p className="mt-1 text-xs">
                        {pollRes?.status ?? "Loading"} {percent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <PartnerView
                    baseTesting={baseTestingPayload}
                    levelTesting={levelTestingPayload}
                  />
                )}
              </div>
            )}
            {activeInnerTab === "sku-list" && (
              <div className="h-full overflow-auto">
                <SKUList data={attributeSelectionData} />
              </div>
            )}
            {activeInnerTab === "base-testing" && (
              <div className="h-full overflow-hidden">
                {!testingTabsEnabled ? (
                  <div className="flex items-center justify-center h-full p-6">
                    <div className="text-center text-gray-500 text-sm">
                      <p className="font-medium">
                        Submit attribute selection first
                      </p>
                      <p className="mt-1 text-xs">
                        Go to Attribute Selection tab and click Submit to load
                        data
                      </p>
                    </div>
                  </div>
                ) : !hasAttributeSelectionData && !completed ? (
                  <div className="flex items-center justify-center h-full p-6">
                    <div className="text-center text-gray-500 text-sm animate-pulse">
                      <p className="font-medium">Processing...</p>
                      <p className="mt-1 text-xs">
                        {pollRes?.status ?? "Loading"} {percent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <BaseTesting
                    baseTesting={baseTestingPayload}
                    nodeId={String(currentNodeObj?.id ?? "")}
                  />
                )}
              </div>
            )}
            {activeInnerTab === "level-testing" && (
              <div style={{ flex: 1, minHeight: 0, height: "100%" }}>
                {!testingTabsEnabled ? (
                  <div className="flex items-center justify-center h-full p-6">
                    <div className="text-center text-gray-500 text-sm">
                      <p className="font-medium">
                        Submit attribute selection first
                      </p>
                      <p className="mt-1 text-xs">
                        Go to Attribute Selection tab and click Submit to load
                        data
                      </p>
                    </div>
                  </div>
                ) : !hasAttributeSelectionData && !completed ? (
                  <div className="flex items-center justify-center h-full p-6">
                    <div className="text-center text-gray-500 text-sm animate-pulse">
                      <p className="font-medium">Processing...</p>
                      <p className="mt-1 text-xs">
                        {pollRes?.status ?? "Loading"} {percent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <LevelTesting
                    levelTesting={levelTestingPayload}
                    onSubmitSelectedAttribute={handleLevelTestingSubmit}
                    readOnly={readOnly}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
