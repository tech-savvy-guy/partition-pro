import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Edit, Checkmark, Close } from "../icons";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Background,
  Controls,
  Position,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { BaseTestingItem } from "./base-testing-result";
import BaseTestingResultWithAttribute from "./base-testing-result-with-attribute";
import type { AttributeMergeState } from "./merge.types";

type Props = {
  visible: boolean;
  attributeName: string;
  groups: string[][];
  initialGroups: string[][];
  /** Original base testing result before merge (for "Original" tab) */
  previousResult: BaseTestingItem | null;
  state: AttributeMergeState | undefined;
  onGroupsChange: (groups: string[][]) => void;
  onSubmit: (groupLabels: string[]) => void;
  onReset: () => void;
  onClose: () => void;
  submitDisabled?: boolean;
};

type ValueNodeData = {
  value: string;
  label: string;
  memberCount: number;
  colorIndex?: number;
};

type GroupFrameNodeData = {
  colorIndex: number;
  groupIndex: number;
};

const NODE_WIDTH = 188;
const NODE_HEIGHT = 62;
const NODE_GAP = 12;
const GROUP_GAP_X = 40;
const GROUP_GAP_Y = 30;
const FRAME_PADDING = 16;
const GROUPS_PER_ROW = 5;

const GROUP_FRAME_COLORS = [
  { border: "#C8102E", fill: "rgba(200,16,46,0.08)", glow: "rgba(200,16,46,0.25)" },
  { border: "#6366F1", fill: "rgba(99,102,241,0.08)", glow: "rgba(99,102,241,0.25)" },
  { border: "#059669", fill: "rgba(5,150,105,0.08)", glow: "rgba(5,150,105,0.25)" },
  { border: "#D97706", fill: "rgba(217,119,6,0.08)", glow: "rgba(217,119,6,0.25)" },
  { border: "#7C3AED", fill: "rgba(124,58,237,0.08)", glow: "rgba(124,58,237,0.25)" },
  { border: "#0891B2", fill: "rgba(8,145,178,0.08)", glow: "rgba(8,145,178,0.25)" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  submitting: "Submitting",
  polling: "Computing",
  ready: "Ready",
  error: "Error",
};

function valueId(value: string) {
  return `value:${value}`;
}

function normalizeGroups(groups: string[][], allValues: string[]): string[][] {
  const seen = new Set<string>();

  const cleaned = groups
    .map((group) => group.map((v) => String(v)).filter((v) => allValues.includes(v) && !seen.has(v)))
    .map((group) => {
      group.forEach((value) => seen.add(value));
      return group;
    })
    .filter((group) => group.length > 0);

  for (const value of allValues) {
    if (!seen.has(value)) cleaned.push([value]);
  }

  return cleaned;
}

function areGroupsOrderedEqual(left: string[][], right: string[][]): boolean {
  if (left.length !== right.length) return false;

  return left.every((group, groupIndex) => {
    const other = right[groupIndex] ?? [];
    if (group.length !== other.length) return false;
    return group.every((value, valueIndex) => value === other[valueIndex]);
  });
}

function areGroupsEquivalent(left: string[][], right: string[][]): boolean {
  const canonical = (groups: string[][]) =>
    groups
      .map((group) => [...group].sort().join("::"))
      .sort((a, b) => a.localeCompare(b));

  const a = canonical(left);
  const b = canonical(right);

  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function parseNodeValueId(nodeId: string): string | null {
  return nodeId.startsWith("value:") ? nodeId.slice("value:".length) : null;
}

function parseGroupDroppableId(id: string): number | null {
  if (!id.startsWith("group:")) return null;
  const idx = parseInt(id.slice("group:".length), 10);
  return Number.isNaN(idx) ? null : idx;
}

function DroppableGroup({
  groupIndex,
  children,
  ...divProps
}: {
  groupIndex: number;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { setNodeRef } = useDroppable({
    id: `group:${groupIndex}`,
    data: { type: "group" },
  });

  return (
    <div ref={setNodeRef} {...divProps}>
      {children}
    </div>
  );
}

function layoutGroupedNodes(
  groups: string[][],
  _allValues: string[],
): Node<ValueNodeData | GroupFrameNodeData>[] {
  const membership = new Map<string, number>();
  groups.forEach((group) => {
    group.forEach((value) => membership.set(value, group.length));
  });

  const groupHeights = groups.map(
    (g) => g.length * NODE_HEIGHT + (g.length - 1) * NODE_GAP,
  );
  const rowOffsets: number[] = [0];
  for (let r = 0; r < Math.ceil(groups.length / GROUPS_PER_ROW); r++) {
    const start = r * GROUPS_PER_ROW;
    const end = Math.min(start + GROUPS_PER_ROW, groups.length);
    const rowHeight = Math.max(...groupHeights.slice(start, end));
    rowOffsets.push(rowOffsets[r] + rowHeight + GROUP_GAP_Y);
  }

  const nodes: Node<ValueNodeData | GroupFrameNodeData>[] = [];
  let mergedColorIdx = 0;

  groups.forEach((group, groupIndex) => {
    const row = Math.floor(groupIndex / GROUPS_PER_ROW);
    const col = groupIndex % GROUPS_PER_ROW;
    const baseX = col * (NODE_WIDTH + GROUP_GAP_X);
    const baseY = rowOffsets[row];
    // Only multi-member groups consume a color slot; single nodes use index 0 (never displayed).
    const colorIndex = group.length >= 2 ? (mergedColorIdx++ % GROUP_FRAME_COLORS.length) : 0;

    if (group.length >= 2) {
      const frameWidth = NODE_WIDTH + 2 * FRAME_PADDING;
      const frameHeight =
        group.length * (NODE_HEIGHT + NODE_GAP) - NODE_GAP + 2 * FRAME_PADDING;
      nodes.push({
        id: `frame:${groupIndex}`,
        type: "groupFrame",
        position: { x: baseX - FRAME_PADDING, y: baseY - FRAME_PADDING },
        data: { colorIndex, groupIndex },
        draggable: false,
        selectable: false,
        zIndex: -1,
        style: { width: frameWidth, height: frameHeight },
      });
    }

    group.forEach((value, i) => {
      nodes.push({
        id: valueId(value),
        type: "value",
        position: {
          x: baseX,
          y: baseY + i * (NODE_HEIGHT + NODE_GAP),
        },
        data: {
          value,
          label: value,
          memberCount: group.length,
          colorIndex,
        },
        draggable: false,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: { width: NODE_WIDTH },
      });
    });
  });

  return nodes;
}

function useAnimatedNodes(
  targetNodes: Node<ValueNodeData | GroupFrameNodeData>[],
  duration = 450,
): Node<ValueNodeData | GroupFrameNodeData>[] {
  const [displayNodes, setDisplayNodes] = React.useState(targetNodes);
  const fromPositionsRef = React.useRef<Map<string, { x: number; y: number }>>(new Map());
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - t, 3);

      const next = targetNodes.map((target) => {
        const from = fromPositionsRef.current.get(target.id) ?? target.position;
        const to = target.position;
        return {
          ...target,
          position: {
            x: from.x + (to.x - from.x) * easeOut,
            y: from.y + (to.y - from.y) * easeOut,
          },
        };
      });

      setDisplayNodes(next);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    displayNodes.forEach((n) => {
      fromPositionsRef.current.set(n.id, { x: n.position.x, y: n.position.y });
    });
    targetNodes.forEach((n) => {
      if (!fromPositionsRef.current.has(n.id)) {
        fromPositionsRef.current.set(n.id, { x: n.position.x, y: n.position.y });
      }
    });

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [targetNodes, duration]);

  return displayNodes;
}

function mergeGroupsByDrop(
  groups: string[][],
  sourceValue: string,
  targetValue: string,
  allValues: string[],
): string[][] {
  const next = normalizeGroups(groups, allValues).map((group) => [...group]);

  const sourceIndex = next.findIndex((group) => group.includes(sourceValue));
  const targetIndex = next.findIndex((group) => group.includes(targetValue));

  if (sourceIndex < 0 || targetIndex < 0 || sourceValue === targetValue) {
    return normalizeGroups(next, allValues);
  }

  if (sourceIndex === targetIndex) {
    return normalizeGroups(next, allValues);
  }

  next[sourceIndex] = next[sourceIndex].filter((value) => value !== sourceValue);

  let adjustedTargetIndex = targetIndex;
  if (next[sourceIndex].length === 0) {
    next.splice(sourceIndex, 1);
    if (sourceIndex < targetIndex) {
      adjustedTargetIndex = targetIndex - 1;
    }
  }

  if (!next[adjustedTargetIndex].includes(sourceValue)) {
    next[adjustedTargetIndex].push(sourceValue);
  }

  return normalizeGroups(next, allValues);
}

function GroupFrameNode({ data }: NodeProps) {
  const nodeData = (data ?? {}) as GroupFrameNodeData;
  const colorIndex = nodeData.colorIndex ?? 0;
  const colors = GROUP_FRAME_COLORS[colorIndex % GROUP_FRAME_COLORS.length];

  return (
    <div
      className="rounded-2xl transition-all duration-300"
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: colors.fill,
        border: `2px solid ${colors.border}`,
        boxShadow: `0 0 0 1px ${colors.border}20, 0 4px 20px -4px ${colors.glow}`,
      }}
    />
  );
}

function ValueNode({ data }: NodeProps) {
  const nodeData = (data ?? {}) as ValueNodeData;
  const isGrouped = Number(nodeData.memberCount ?? 1) > 1;
  const colorIndex = nodeData.colorIndex ?? 0;
  const colors = GROUP_FRAME_COLORS[colorIndex % GROUP_FRAME_COLORS.length];

  return (
    <div
      className={[
        "relative rounded-2xl border px-3.5 py-2.5",
        "flex min-h-[60px] flex-col items-center justify-center gap-1.5 text-center",
        "transition-all duration-200",
        "hover:shadow-md",
        isGrouped
          ? "border-white/60 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]"
          : "border-gray-200/80 bg-white shadow-[0_1px_8px_-2px_rgba(0,0,0,0.06)]",
      ].join(" ")}
      style={
        isGrouped
          ? {
              background: `linear-gradient(to bottom right, white, ${colors.fill})`,
              borderColor: `${colors.border}30`,
            }
          : undefined
      }
    >
      {isGrouped && (
        <div
          className="absolute -left-px top-2.5 bottom-2.5 w-[3px] rounded-full"
          style={{ background: `linear-gradient(to bottom, ${colors.border}, ${colors.border}cc)` }}
        />
      )}
      <span
        className={[
          "block max-w-[150px] truncate text-[12px] font-semibold tracking-tight",
          isGrouped ? "text-gray-800" : "text-gray-800",
        ].join(" ")}
      >
        {nodeData.label}
      </span>
      {isGrouped && (
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1"
          style={{
            backgroundColor: `${colors.border}15`,
            color: colors.border,
            borderColor: `${colors.border}30`,
          }}
        >
          {nodeData.memberCount} merged
        </span>
      )}
    </div>
  );
}

const nodeTypes = { value: ValueNode, groupFrame: GroupFrameNode };

type FlowCanvasProps = {
  allValues: string[];
  groups: string[][];
  fitViewTrigger?: number;
  onSelectedValueIdsChange: (ids: string[]) => void;
  onGroupsChange: (groups: string[][]) => void;
};

function MergeFlowCanvas({
  allValues,
  groups,
  fitViewTrigger,
  onSelectedValueIdsChange,
  onGroupsChange,
}: FlowCanvasProps) {
  const targetNodes = React.useMemo(
    () => layoutGroupedNodes(groups, allValues),
    [groups, allValues],
  );

  const animatedNodes = useAnimatedNodes(targetNodes, 450);
  const [nodes, setNodes, onNodesChange] = useNodesState(animatedNodes);

  // Sync animated positions into React Flow state each frame while preserving
  // selection flags AND the `measured` dimensions that ReactFlow sets internally.
  // Without preserving `measured`, nodes lose their height on every RAF tick
  // (ReactFlow renders them collapsed), causing the intermittent disappearance.
  React.useEffect(() => {
    setNodes((current) => {
      const nodeMap = new Map(current.map((n) => [n.id, n]));
      return animatedNodes.map((n) => {
        const existing = nodeMap.get(n.id);
        return {
          ...n,
          selected: existing?.selected ?? false,
          measured: existing?.measured,
        };
      });
    });
  }, [animatedNodes, setNodes]);

  const { fitView } = useReactFlow();

  // Track whether a drag-selection rectangle is currently being drawn. This
  // lets us distinguish drag-select (which should replace selection) from a
  // plain node click (which should toggle-add to the existing selection).
  const isSelectionDragRef = React.useRef(false);

  // Intercept ReactFlow's onNodesChange: pass every change through EXCEPT
  // `select`-type changes that originate from a single-click (those would
  // replace the entire selection). During a drag-select we let them all pass.
  const handleNodesChange = React.useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      if (isSelectionDragRef.current) {
        onNodesChange(changes);
      } else {
        onNodesChange(changes.filter((c) => c.type !== "select"));
      }
    },
    [onNodesChange],
  );

  // Clicking a value node toggles it in/out of the current selection.
  const handleNodeClick = React.useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== "value") return;
      setNodes((curr) =>
        curr.map((n) => (n.id === node.id ? { ...n, selected: !n.selected } : n)),
      );
    },
    [setNodes],
  );

  // Clicking empty canvas clears the selection.
  const handlePaneClick = React.useCallback(() => {
    setNodes((curr) => curr.map((n) => ({ ...n, selected: false })));
  }, [setNodes]);

  // Derive selected value node IDs from the nodes state and report to parent.
  // This covers both drag-select and click-select since both update `nodes`.
  const prevSelectionRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    const current = nodes
      .filter((n) => n.selected && n.type === "value")
      .map((n) => n.id);
    if (!sameStringSet(current, prevSelectionRef.current)) {
      prevSelectionRef.current = current;
      onSelectedValueIdsChange(current);
    }
  }, [nodes, onSelectedValueIdsChange]);

  // When a merge action is committed (groups changes), clear all selection.
  React.useEffect(() => {
    setNodes((curr) => curr.map((n) => ({ ...n, selected: false })));
  }, [groups, setNodes]);

  // Fit view after the layout animation settles whenever groups change.
  React.useEffect(() => {
    const id = window.setTimeout(() => fitView({ padding: 0.3, duration: 350 }), 480);
    return () => window.clearTimeout(id);
  }, [groups, fitView]);

  // Fit view immediately when an external reset is triggered.
  React.useEffect(() => {
    if (fitViewTrigger == null || fitViewTrigger === 0) return;
    const id = window.setTimeout(() => fitView({ padding: 0.3, duration: 350 }), 480);
    return () => window.clearTimeout(id);
  }, [fitViewTrigger, fitView]);

  React.useEffect(() => {
    const normalized = normalizeGroups(groups, allValues);
    if (!areGroupsOrderedEqual(normalized, groups)) {
      onGroupsChange(normalized);
    }
  }, [allValues, groups, onGroupsChange]);

  if (allValues.length === 0) {
    return (
      <div className="flex h-[420px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300/80 bg-gradient-to-b from-gray-50 to-slate-50 text-center">
        <i className="pi pi-inbox text-[24px] text-gray-300" />
        <span className="text-[12px] text-gray-400">No attribute values available for merging.</span>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .merge-flow .react-flow__node {
          cursor: default;
        }
        .merge-flow .react-flow__node-value.selected > div:first-child {
          box-shadow: 0 0 0 2px #6366F1, 0 2px 12px -2px rgba(99, 102, 241, 0.25) !important;
          border-color: #6366F1 !important;
        }
      `}</style>

      <div
        className="merge-flow overflow-hidden rounded-2xl border border-gray-200/70"
        style={{
          height: 420,
          background: "radial-gradient(ellipse at 20% 0%, rgba(248, 240, 252, 0.4) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(219, 234, 254, 0.3) 0%, transparent 50%), linear-gradient(160deg, #FAFBFD 0%, #F1F5F9 50%, #F8FAFC 100%)",
          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 1px 4px -1px rgba(0, 0, 0, 0.05)",
        }}
      >
        <ReactFlow
          nodes={nodes}
          onNodesChange={handleNodesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onSelectionStart={() => { isSelectionDragRef.current = true; }}
          onSelectionEnd={() => { isSelectionDragRef.current = false; }}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.35}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          selectionOnDrag
          panOnDrag={false}
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          selectionMode={SelectionMode.Partial}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} size={0.8} color="#CBD5E1" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </>
  );
}

function statusPillClass(status: string): string {
  switch (status) {
    case "submitting":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "polling":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "ready":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "error":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";
    default:
      return "bg-gray-100 text-gray-600 ring-1 ring-gray-200";
  }
}

function passedPillClass(passed: string): string {
  if (passed === "TRUE") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (passed === "FALSE") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  return "bg-gray-100 text-gray-500 ring-1 ring-gray-200";
}

function DragGhostChip({ value }: { value: string }) {
  return (
    <div
      className="scale-105 rounded-lg border-2 border-[#6366F1]/60 bg-white px-3 py-2 shadow-[0_8px_24px_-4px_rgba(99,102,241,0.25),0_2px_8px_-2px_rgba(0,0,0,0.1)]"
      style={{ boxShadow: "0 0 0 1px rgba(99,102,241,0.15)" }}
    >
      <span className="block max-w-[140px] truncate text-[11px] font-medium text-gray-800">
        {value}
      </span>
    </div>
  );
}

function RightPaneValueChip({
  value,
  embedded,
}: {
  value: string;
  embedded?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: valueId(value),
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={
        embedded
          ? "flex min-w-0 flex-1 items-center px-2.5 py-1.5 text-left text-[11px] font-medium text-gray-700 cursor-grab active:cursor-grabbing transition-opacity"
          : "flex min-w-[4rem] max-w-[11rem] items-center rounded-lg border border-gray-200/60 bg-gradient-to-b from-white to-gray-50 px-2.5 py-1.5 text-[11px] font-medium text-gray-700 shadow-sm hover:border-gray-300 hover:shadow cursor-grab active:cursor-grabbing transition-all duration-150"
      }
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      title={value}
    >
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{value}</span>
    </button>
  );
}

function RightPaneGroupChip({
  value,
  canUngroup,
  onUngroup,
}: {
  value: string;
  groupIndex: number;
  canUngroup: boolean;
  onUngroup: () => void;
}) {
  return (
    <span className="inline-flex min-w-[4rem] max-w-[12rem] items-center overflow-hidden rounded-lg border border-gray-200/60 bg-gradient-to-b from-white to-gray-50 shadow-sm hover:border-gray-300 transition-colors">
      <RightPaneValueChip value={value} embedded />
      {canUngroup && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onUngroup();
          }}
          className="flex h-full shrink-0 items-center justify-center border-l border-gray-200/60 px-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          title="Remove from group"
        >
          <i className="pi pi-times" style={{ fontSize: "10px" }} />
        </button>
      )}
    </span>
  );
}

function orderSelectedValuesByGroups(groups: string[][], selectedValues: Set<string>): string[] {
  const ordered: string[] = [];
  groups.forEach((group) => {
    group.forEach((value) => {
      if (selectedValues.has(value)) ordered.push(value);
    });
  });
  return ordered;
}

function groupSelectedValues(
  groups: string[][],
  selectedValues: string[],
  allValues: string[],
): string[][] {
  const normalized = normalizeGroups(groups, allValues);
  const selectedSet = new Set(
    selectedValues.filter((value) => allValues.includes(value)),
  );

  if (selectedSet.size < 2) {
    return normalized;
  }

  const orderedSelected = orderSelectedValuesByGroups(normalized, selectedSet);
  const sourceGroupIndexes = normalized.reduce<number[]>((acc, group, index) => {
    if (group.some((value) => selectedSet.has(value))) acc.push(index);
    return acc;
  }, []);

  if (orderedSelected.length < 2 || sourceGroupIndexes.length === 0) {
    return normalized;
  }

  const insertAt = Math.min(...sourceGroupIndexes);
  const remainingGroups = normalized
    .map((group) => group.filter((value) => !selectedSet.has(value)))
    .filter((group) => group.length > 0);

  remainingGroups.splice(insertAt, 0, orderedSelected);

  return normalizeGroups(remainingGroups, allValues);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const a = new Set(left);
  if (a.size !== right.length) return false;
  return right.every((item) => a.has(item));
}

function groupKey(group: string[]): string {
  return [...group].sort().join("::");
}

export default function MergeSubAttributesDialog({
  visible,
  attributeName,
  groups,
  initialGroups,
  previousResult,
  state,
  onGroupsChange,
  onSubmit,
  onReset,
  onClose,
  submitDisabled,
}: Props) {
  const allValues = React.useMemo(
    () => Array.from(new Set(initialGroups.flatMap((group) => group))),
    [initialGroups],
  );

  const normalizedGroups = React.useMemo(
    () => normalizeGroups(groups, allValues),
    [allValues, groups],
  );

  const normalizedInitialGroups = React.useMemo(
    () => normalizeGroups(initialGroups, allValues),
    [allValues, initialGroups],
  );

  const status = state?.status ?? "idle";
  const lockEditor = status === "submitting";
  const canSubmit = !submitDisabled && normalizedGroups.some((group) => group.length > 0);

  const previewItem = (state?.result?.items?.[0] ?? null) as BaseTestingItem | null;
  const passed =
    state?.result?.passed == null ? "-" : String(state.result.passed).toUpperCase();

  const hasGroupingChanges = React.useMemo(
    () => !areGroupsEquivalent(normalizedGroups, normalizedInitialGroups),
    [normalizedGroups, normalizedInitialGroups],
  );

  // Color indices for the right panel — only merged groups (length > 1) consume
  // a slot; single-node groups get -1 (no color displayed).
  const groupColorIndices = React.useMemo(() => {
    let idx = 0;
    return normalizedGroups.map((g) =>
      g.length > 1 ? idx++ % GROUP_FRAME_COLORS.length : -1,
    );
  }, [normalizedGroups]);

  // When the Partition Tree editor is in native fullscreen, only nodes inside
  // the fullscreen element are rendered. Portal the dialog into the active
  // fullscreen element if there is one, otherwise fall back to document.body.
  const [appendTarget, setAppendTarget] = React.useState<HTMLElement | undefined>(
    () => (typeof document === "undefined" ? undefined : document.body),
  );
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const resolveTarget = () => {
      const fsEl = document.fullscreenElement as HTMLElement | null;
      setAppendTarget(fsEl ?? document.body);
    };
    resolveTarget();
    document.addEventListener("fullscreenchange", resolveTarget);
    return () => document.removeEventListener("fullscreenchange", resolveTarget);
  }, [visible]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeView, setActiveView] = React.useState<"playground" | "original" | "result">("playground");
  const [fitViewTrigger, setFitViewTrigger] = React.useState(0);
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
  const [overGroupIndex, setOverGroupIndex] = React.useState<number | null>(null);
  const [selectedValueIds, setSelectedValueIds] = React.useState<string[]>([]);
  const overGroupIndexRef = React.useRef<number | null>(null);
  const canGroupSelected = !lockEditor && selectedValueIds.length >= 2;

  // Group name editing state
  const [groupLabels, setGroupLabels] = React.useState<Record<string, string>>({});
  const [editingGroupIndex, setEditingGroupIndex] = React.useState<number | null>(null);
  const [editingLabelValue, setEditingLabelValue] = React.useState<string>("");

  const getGroupLabel = React.useCallback(
    (groupIndex: number, group: string[]) => {
      const key = groupKey(group);
      return groupLabels[key] ?? `Group ${groupIndex + 1}`;
    },
    [groupLabels],
  );

  const startEditingLabel = React.useCallback(
    (groupIndex: number, group: string[]) => {
      setEditingGroupIndex(groupIndex);
      setEditingLabelValue(groupLabels[groupKey(group)] ?? `Group ${groupIndex + 1}`);
    },
    [groupLabels],
  );

  const commitLabel = React.useCallback(() => {
    if (editingGroupIndex == null) return;
    const group = normalizedGroups[editingGroupIndex];
    if (!group) return;
    const key = groupKey(group);
    const defaultLabel = `Group ${editingGroupIndex + 1}`;
    const trimmed = editingLabelValue.trim();
    setGroupLabels((prev) => {
      if (!trimmed || trimmed === defaultLabel) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: trimmed };
    });
    setEditingGroupIndex(null);
    setEditingLabelValue("");
  }, [editingGroupIndex, editingLabelValue, normalizedGroups]);

  const cancelEditingLabel = React.useCallback(() => {
    setEditingGroupIndex(null);
    setEditingLabelValue("");
  }, []);

  const handleGroupSelected = React.useCallback(() => {
    if (!canGroupSelected) return;
    const next = groupSelectedValues(normalizedGroups, selectedValueIds, allValues);
    if (!areGroupsOrderedEqual(next, normalizedGroups)) {
      onGroupsChange(next);
    }
    setSelectedValueIds([]);
  }, [allValues, canGroupSelected, normalizedGroups, onGroupsChange, selectedValueIds]);

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active?.id ?? ""));
    overGroupIndexRef.current = null;
  }, []);

  const handleDragOver = React.useCallback(
    (event: DragOverEvent) => {
      const overId = event.over?.id;
      if (overId == null) {
        overGroupIndexRef.current = null;
        setOverGroupIndex(null);
        return;
      }
      const sid = String(overId);
      let groupIdx = parseGroupDroppableId(sid);
      if (groupIdx === null) {
        const val = parseNodeValueId(sid);
        if (val) {
          groupIdx = normalizedGroups.findIndex((g) => g.includes(val));
          if (groupIdx < 0) groupIdx = null;
        }
      }
      overGroupIndexRef.current = groupIdx;
      setOverGroupIndex(groupIdx ?? null);
    },
    [normalizedGroups],
  );

  const handleRightPaneDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active?.id ?? "");
      const overId = event.over?.id != null ? String(event.over.id) : null;
      const sourceValue = parseNodeValueId(activeId);
      if (!sourceValue) return;

      const sourceGroupIdx = normalizedGroups.findIndex((g) => g.includes(sourceValue));
      const hoveredGroupIdx = overGroupIndexRef.current;

      let targetValue: string | null = null;

      const resolveTargetFromGroupIndex = (groupIdx: number | null): string | null => {
        if (
          groupIdx == null ||
          groupIdx < 0 ||
          groupIdx >= normalizedGroups.length ||
          groupIdx === sourceGroupIdx ||
          normalizedGroups[groupIdx]?.includes(sourceValue)
        ) {
          return null;
        }
        return normalizedGroups[groupIdx][0] ?? null;
      };

      if (hoveredGroupIdx != null && hoveredGroupIdx !== sourceGroupIdx) {
        targetValue = resolveTargetFromGroupIndex(hoveredGroupIdx);
      }

      if (targetValue == null && overId && overId !== activeId) {
        const resolvedGroupIdx = parseGroupDroppableId(overId);
        if (resolvedGroupIdx !== null && normalizedGroups[resolvedGroupIdx]) {
          targetValue = resolveTargetFromGroupIndex(resolvedGroupIdx);
        } else {
          const val = parseNodeValueId(overId);
          if (val) {
            const idx = normalizedGroups.findIndex((g) => g.includes(val));
            if (idx >= 0 && idx !== sourceGroupIdx) {
              targetValue = normalizedGroups[idx][0] ?? null;
            }
          }
        }
      }

      if (!targetValue || targetValue === sourceValue) return;

      const mergedGroups = mergeGroupsByDrop(
        normalizedGroups,
        sourceValue,
        targetValue,
        allValues,
      );
      onGroupsChange(mergedGroups);
    },
    [allValues, normalizedGroups, onGroupsChange],
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      handleRightPaneDragEnd(event);
      setActiveDragId(null);
      setOverGroupIndex(null);
    },
    [handleRightPaneDragEnd],
  );

  React.useEffect(() => {
    if (visible) setActiveView("playground");
  }, [visible]);

  React.useEffect(() => {
    if (!visible) {
      setSelectedValueIds([]);
      return;
    }

    setSelectedValueIds((current) => {
      const filtered = current.filter((value) => allValues.includes(value));
      return sameStringSet(current, filtered) ? current : filtered;
    });
  }, [allValues, visible]);

  React.useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "g") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      if (!canGroupSelected) return;
      handleGroupSelected();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canGroupSelected, handleGroupSelected, visible]);

  // Reset editing state when groups change (indices can shift)
  React.useEffect(() => {
    setEditingGroupIndex(null);
    setEditingLabelValue("");
  }, [normalizedGroups]);

  const handleSubmit = React.useCallback(() => {
    const labels = normalizedGroups.map((group, i) => {
      const key = groupKey(group);
      return groupLabels[key] ?? `Group ${i + 1}`;
    });
    onSubmit(labels);
    setActiveView("result");
  }, [onSubmit, normalizedGroups, groupLabels]);

  const handleReset = React.useCallback(() => {
    onReset();
    setSelectedValueIds([]);
    setGroupLabels({});
    setEditingGroupIndex(null);
    setEditingLabelValue("");
    setActiveView("playground");
    setFitViewTrigger((n) => n + 1);
  }, [onReset]);

  return (
    <Dialog
      key={appendTarget === document.body ? "merge-body" : "merge-fs"}
      open={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        container={appendTarget}
        showCloseButton={false}
        overlayClassName="merge-rollup-mask bg-black/35"
        className="m-0 flex flex-col overflow-hidden rounded-2xl p-0"
        style={{
          width: "90vw",
          height: "90vh",
          maxWidth: "1400px",
          maxHeight: "90vh",
        }}
      >
      <div className="flex min-h-0 flex-1 flex-col bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4">
          <div className="flex">
            <button
              type="button"
              onClick={() => setActiveView("playground")}
              className={`border-b-2 px-4 py-2.5 text-[12px] font-semibold transition-colors ${
                activeView === "playground"
                  ? "border-[#C8102E] text-[#C8102E]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {attributeName || "Canvas"}
            </button>
            <button
              type="button"
              onClick={() => setActiveView("original")}
              className={`border-b-2 px-4 py-2.5 text-[12px] font-semibold transition-colors ${
                activeView === "original"
                  ? "border-[#C8102E] text-[#C8102E]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Original
            </button>
            <button
              type="button"
              onClick={() => setActiveView("result")}
              className={`border-b-2 px-4 py-2.5 text-[12px] font-semibold transition-colors ${
                activeView === "result"
                  ? "border-[#C8102E] text-[#C8102E]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Result
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
            <span className={`rounded-full px-2.5 py-1 ${statusPillClass(status)}`}>
              {STATUS_LABELS[status] ?? status}
            </span>
            <span className={`rounded-full px-2.5 py-1 ${passedPillClass(passed)}`}>
              Passed: {passed}
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 ring-1 ring-gray-200">
              Groups: {normalizedGroups.length}
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-5">
          {activeView === "playground" && (
          <div className="grid h-full items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <section className="flex h-full min-h-0 flex-col rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_12px_-3px_rgba(0,0,0,0.06)]">
              <div className="mb-3 flex min-h-[36px] items-center justify-between gap-3">
                <p className="text-[11px] text-gray-500">
                  Drag on the canvas to select nodes, then group them with Ctrl+G. Use two fingers to pan and zoom.
                </p>
                {canGroupSelected ? (
                  <button
                    type="button"
                    onClick={handleGroupSelected}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#C8102E]/20 bg-[#C8102E] px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#A70D25]"
                  >
                    Group Nodes
                    <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium">
                      Ctrl+G
                    </span>
                  </button>
                ) : (
                  <div className="text-[11px] font-medium text-gray-400">
                    Select at least 2 nodes to group
                  </div>
                )}
              </div>
              <div className="min-h-0 flex-1">
                <ReactFlowProvider>
                  <MergeFlowCanvas
                    allValues={allValues}
                    groups={normalizedGroups}
                    fitViewTrigger={fitViewTrigger}
                    onSelectedValueIdsChange={(ids) =>
                      setSelectedValueIds((current) => {
                        const next = ids
                          .map((id) => parseNodeValueId(id))
                          .filter((value): value is string => Boolean(value));
                        return sameStringSet(current, next) ? current : next;
                      })
                    }
                    onGroupsChange={onGroupsChange}
                  />
                </ReactFlowProvider>
              </div>
            </section>

            <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-gradient-to-b from-gray-50/80 to-slate-50/50 p-2 shadow-[0_1px_12px_-3px_rgba(0,0,0,0.06)]">
              <div
                className={[
                  "mt-3 rounded-lg px-3 py-2 text-[11px]",
                  hasGroupingChanges
                    ? "border border-amber-200 bg-amber-50 text-amber-700"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-700",
                ].join(" ")}
              >
                {hasGroupingChanges
                  ? "Grouping changed from initial values."
                  : "Grouping matches initial values."}
              </div>

              <p className="mt-3 text-[11px] text-gray-500">
                Drag values between or within groups to merge. Canvas updates automatically.
              </p>

              <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
                <DndContext
                  sensors={sensors}
                  collisionDetection={pointerWithin}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
                    {activeDragId ? (
                      <DragGhostChip
                        value={parseNodeValueId(activeDragId) ?? activeDragId}
                      />
                    ) : null}
                  </DragOverlay>
                  <SortableContext
                    items={allValues.map((v) => valueId(v))}
                    strategy={rectSortingStrategy}
                  >
                  {normalizedGroups.map((group, groupIndex) => {
                    const isMerged = group.length > 1;
                    const isOver = overGroupIndex === groupIndex;
                    // Use the pre-computed merged-only color index; -1 means no color (single-node group).
                    const rawColorIndex = groupColorIndices[groupIndex] ?? 0;
                    const colors = GROUP_FRAME_COLORS[Math.max(0, rawColorIndex) % GROUP_FRAME_COLORS.length];
                    return (
                      <DroppableGroup
                        key={`group-${groupIndex}-${group.join("|")}`}
                        groupIndex={groupIndex}
                        className={[
                          "relative rounded-xl border border-l-4 bg-white px-3 py-3 transition-all duration-200",
                          isMerged ? "shadow-sm" : "",
                          isOver && isMerged ? "ring-2" : "",
                          isOver && !isMerged ? "ring-2 ring-dashed ring-indigo-300/60" : "",
                        ].join(" ")}
                        style={{
                          borderLeftColor: isMerged ? colors.border : "rgb(229 231 235)",
                          ...(isMerged
                            ? {
                                borderColor: isOver ? `${colors.border}90` : `${colors.border}40`,
                                backgroundColor: "white",
                                boxShadow: isOver
                                  ? `0 0 0 3px ${colors.border}25`
                                  : undefined,
                              }
                            : {
                                borderColor: isOver ? "rgb(99 102 241 / 0.5)" : "rgb(229 231 235 / 0.8)",
                                boxShadow: isOver
                                  ? "0 0 0 2px rgba(99,102,241,0.15)"
                                  : undefined,
                              }),
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: isMerged ? colors.border : "#9ca3af",
                              }}
                            />
                            {editingGroupIndex === groupIndex ? (
                              <div className="flex items-center gap-1">
                                <input
                                  autoFocus
                                  className="w-[110px] rounded border border-[#6366F1]/50 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-700 outline-none focus:ring-1 focus:ring-[#6366F1]/40"
                                  value={editingLabelValue}
                                  onChange={(e) => setEditingLabelValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") { e.preventDefault(); commitLabel(); }
                                    if (e.key === "Escape") { e.preventDefault(); cancelEditingLabel(); }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={commitLabel}
                                  className="flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition-colors"
                                  title="Confirm"
                                >
                                  <Checkmark size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingLabel}
                                  className="flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                                  title="Cancel"
                                >
                                  <Close size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="group/label flex items-center gap-1">
                                <span className="text-[11px] font-semibold text-gray-700">
                                  {getGroupLabel(groupIndex, group)}
                                </span>
                                {!lockEditor && (
                                  <button
                                    type="button"
                                    onClick={() => startEditingLabel(groupIndex, group)}
                                    className="flex items-center justify-center text-gray-300 opacity-0 transition-all hover:text-gray-500 group-hover/label:opacity-100"
                                    title="Edit group name"
                                  >
                                    <Edit size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              isMerged ? "ring-1" : "bg-gray-100 text-gray-500",
                            ].join(" ")}
                            style={
                              isMerged
                                ? {
                                    backgroundColor: `${colors.border}18`,
                                    color: colors.border,
                                    borderColor: `${colors.border}40`,
                                  }
                                : undefined
                            }
                          >
                            {group.length} item{group.length === 1 ? "" : "s"}
                          </span>
                        </div>

                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {group.map((value) => (
                              <RightPaneGroupChip
                                key={`group-${groupIndex}-${value}`}
                                value={value}
                                groupIndex={groupIndex}
                                canUngroup={isMerged}
                                onUngroup={() => {
                                  const idx = normalizedGroups.findIndex((g) => g.includes(value));
                                  if (idx < 0) return;
                                  const next = normalizedGroups.map((g, i) =>
                                    i === idx ? g.filter((v) => v !== value) : [...g],
                                  );
                                  onGroupsChange(normalizeGroups(next, allValues));
                                }}
                              />
                            ))}
                          </div>
                      </DroppableGroup>
                    );
                  })}
                  </SortableContext>
                </DndContext>
              </div>
            </aside>
          </div>
          )}

          {activeView === "original" && (
          <section className="w-full min-w-0 rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
            {previousResult ? (
              <BaseTestingResultWithAttribute item={previousResult} scrollable={false} />
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-[12px] text-gray-500">
                No original result available.
              </div>
            )}
          </section>
          )}

          {activeView === "result" && (
          <section className="w-full min-w-0 rounded-2xl border border-gray-200 bg-white shadow-sm">

            <div className="p-4">
              {state?.error ? (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  <div className="flex items-start gap-2">
                    <i className="pi pi-times-circle mt-0.5 text-red-500" />
                    <span>{state.error}</span>
                  </div>
                </div>
              ) : null}

              {previewItem ? (
                <BaseTestingResultWithAttribute item={previewItem} scrollable={false} />
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-[12px] text-gray-500">
                  {status === "ready"
                    ? "Preview is ready but no result rows were returned."
                    : "Submit grouping changes to fetch a merged preview."}
                </div>
              )}
              </div>
          </section>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={lockEditor}
            className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || lockEditor}
            className="inline-flex items-center gap-2 rounded-lg bg-[#C8102E] px-5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#A70D25] active:bg-[#920B20] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {lockEditor ? (
              <>
                <i className="pi pi-spin pi-spinner" style={{ fontSize: "12px" }} />
                Submitting...
              </>
            ) : (
              "Submit Grouping"
            )}
          </button>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}
