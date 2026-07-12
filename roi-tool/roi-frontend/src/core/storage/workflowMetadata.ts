/**
 * Unified localStorage utility for workflow-related UI state.
 *
 * Storage key: "workflow_metadata"
 * Structure:
 * {
 *   cases: {
 *     [caseId]: {
 *       partitions: {
 *         [partitionId]: {
 *           "partition-tree": TreePersistedState (as-is object),
 *           "heatmap": {
 *             [componentType]: { start: number | null, step: number | null, decimalPlaces?: number | null }
 *           }
 *         }
 *       }
 *     }
 *   }
 * }
 */

const STORAGE_KEY = "workflow_metadata";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HeatmapOverride = {
  start: number | null;
  step: number | null;
  decimalPlaces?: number | null;
};

/** Heatmap slot: componentType → override  (e.g. "obm", "basemath", "basetesting:attrX") */
type HeatmapData = Record<string, HeatmapOverride>;

type PartitionSlots = {
  "partition-tree"?: unknown;
  "heatmap"?: HeatmapData;
};

type WorkflowMetadata = {
  cases: Record<
    string, // caseId
    {
      partitions: Record<
        string, // partitionId
        PartitionSlots
      >;
    }
  >;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function read(): WorkflowMetadata {
  try {
    if (typeof window === "undefined") return { cases: {} };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { cases: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.cases) return { cases: {} };
    return parsed as WorkflowMetadata;
  } catch {
    return { cases: {} };
  }
}

function write(data: WorkflowMetadata): void {
  try {
    if (typeof window === "undefined") return;
    if (Object.keys(data.cases).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.error("Failed to write workflow_metadata to localStorage", error);
  }
}

function ensurePartition(
  data: WorkflowMetadata,
  caseId: string,
  partitionId: string
): PartitionSlots {
  if (!data.cases[caseId]) data.cases[caseId] = { partitions: {} };
  if (!data.cases[caseId].partitions[partitionId])
    data.cases[caseId].partitions[partitionId] = {};
  return data.cases[caseId].partitions[partitionId];
}

function pruneEmpty(data: WorkflowMetadata, caseId: string, partitionId: string): void {
  const slots = data.cases[caseId]?.partitions[partitionId];
  if (!slots) return;

  if (Object.keys(slots).length === 0) {
    delete data.cases[caseId].partitions[partitionId];
  }
  if (Object.keys(data.cases[caseId]?.partitions ?? {}).length === 0) {
    delete data.cases[caseId];
  }
}

// ── Generic slot API ──────────────────────────────────────────────────────────

/**
 * Read a top-level partition slot.
 * Returns null if not found or if parsing fails.
 */
export function getSlot<T>(
  caseId: string,
  partitionId: string,
  slot: keyof PartitionSlots
): T | null {
  const data = read();
  const value = data.cases[caseId]?.partitions[partitionId]?.[slot];
  return value !== undefined ? (value as T) : null;
}

/**
 * Write a top-level partition slot.
 */
export function setSlot<T>(
  caseId: string,
  partitionId: string,
  slot: keyof PartitionSlots,
  value: T
): void {
  const data = read();
  const entry = ensurePartition(data, caseId, partitionId);
  (entry as Record<string, unknown>)[slot] = value;
  write(data);
}

/**
 * Delete a top-level partition slot and prune empty parents.
 */
export function clearSlot(
  caseId: string,
  partitionId: string,
  slot: keyof PartitionSlots
): void {
  const data = read();
  const entry = data.cases[caseId]?.partitions[partitionId];
  if (!entry) return;
  delete entry[slot];
  pruneEmpty(data, caseId, partitionId);
  write(data);
}

// ── Heatmap convenience API ───────────────────────────────────────────────────

/**
 * Load a heatmap override for a specific component type within a partition.
 */
export function loadHeatmapOverride(
  caseId: string,
  partitionId: string,
  componentType: string
): HeatmapOverride | null {
  const heatmap = getSlot<HeatmapData>(caseId, partitionId, "heatmap");
  return heatmap?.[componentType] ?? null;
}

/**
 * Save a heatmap override for a specific component type within a partition.
 */
export function saveHeatmapOverride(
  caseId: string,
  partitionId: string,
  componentType: string,
  override: HeatmapOverride
): void {
  const data = read();
  const entry = ensurePartition(data, caseId, partitionId);
  if (!entry["heatmap"]) entry["heatmap"] = {};
  entry["heatmap"]![componentType] = override;
  write(data);
}

/**
 * Clear a heatmap override for a specific component type within a partition.
 * Prunes the heatmap slot if empty, and parent structures if fully empty.
 */
export function clearHeatmapOverride(
  caseId: string,
  partitionId: string,
  componentType: string
): void {
  const data = read();
  const entry = data.cases[caseId]?.partitions[partitionId];
  if (!entry?.["heatmap"]) return;

  delete entry["heatmap"]![componentType];

  if (Object.keys(entry["heatmap"]!).length === 0) {
    delete entry["heatmap"];
  }

  pruneEmpty(data, caseId, partitionId);
  write(data);
}

/**
 * Merge partial heatmap settings into an existing override entry.
 */
export function patchHeatmapOverride(
  caseId: string,
  partitionId: string,
  componentType: string,
  patch: Partial<HeatmapOverride>,
): HeatmapOverride {
  const existing = loadHeatmapOverride(caseId, partitionId, componentType);
  const next: HeatmapOverride = {
    start: existing?.start ?? null,
    step: existing?.step ?? null,
    decimalPlaces: existing?.decimalPlaces ?? null,
    ...patch,
  };

  const hasStartStep =
    next.start != null &&
    next.step != null &&
    Number.isFinite(next.start) &&
    Number.isFinite(next.step);
  const hasDecimalPlaces =
    next.decimalPlaces != null && Number.isFinite(next.decimalPlaces);

  if (!hasStartStep && !hasDecimalPlaces) {
    clearHeatmapOverride(caseId, partitionId, componentType);
    return next;
  }

  saveHeatmapOverride(caseId, partitionId, componentType, next);
  return next;
}

// ── Partition-tree convenience API ───────────────────────────────────────────

/**
 * Load the raw tree state object for a partition.
 * Callers should validate with `deserializeTreeState` from tree.types.ts.
 */
export function loadTreeState(caseId: string, partitionId: string): unknown | null {
  return getSlot<unknown>(caseId, partitionId, "partition-tree");
}

/**
 * Save the tree state object for a partition.
 * Pass the object produced by `serializeTreeState` from tree.types.ts.
 */
export function saveTreeState(
  caseId: string,
  partitionId: string,
  state: unknown
): void {
  setSlot(caseId, partitionId, "partition-tree", state);
}

/**
 * Clear the tree state for a partition.
 */
export function clearTreeState(caseId: string, partitionId: string): void {
  clearSlot(caseId, partitionId, "partition-tree");
}

