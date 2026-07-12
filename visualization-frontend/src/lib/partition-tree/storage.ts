const STORAGE_PREFIX = "partition-tree-state:v1";

export type HeatmapOverride = {
  start: number | null;
  step: number | null;
  decimalPlaces?: number | null;
};

type PartitionTreeStorage = {
  tree?: unknown;
  heatmap?: Record<string, HeatmapOverride>;
};

function storageKey(caseId: string, partitionId: string) {
  return `${STORAGE_PREFIX}:${caseId}:${partitionId}`;
}

function read(caseId: string, partitionId: string): PartitionTreeStorage {
  try {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(storageKey(caseId, partitionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as PartitionTreeStorage)
      : {};
  } catch {
    return {};
  }
}

function write(caseId: string, partitionId: string, data: PartitionTreeStorage) {
  try {
    if (typeof window === "undefined") return;

    const hasTree = data.tree !== undefined;
    const hasHeatmap =
      data.heatmap != null && Object.keys(data.heatmap).length > 0;

    if (!hasTree && !hasHeatmap) {
      window.localStorage.removeItem(storageKey(caseId, partitionId));
      return;
    }

    window.localStorage.setItem(
      storageKey(caseId, partitionId),
      JSON.stringify(data),
    );
  } catch (error) {
    console.error("Failed to persist partition tree state", error);
  }
}

export function loadTreeState(caseId: string, partitionId: string) {
  return read(caseId, partitionId).tree ?? null;
}

export function saveTreeState(
  caseId: string,
  partitionId: string,
  state: unknown,
) {
  const current = read(caseId, partitionId);
  write(caseId, partitionId, { ...current, tree: state });
}

export function clearTreeState(caseId: string, partitionId: string) {
  const current = read(caseId, partitionId);
  delete current.tree;
  write(caseId, partitionId, current);
}

export function loadHeatmapOverride(
  caseId: string,
  partitionId: string,
  componentType: string,
): HeatmapOverride | null {
  return read(caseId, partitionId).heatmap?.[componentType] ?? null;
}

export function saveHeatmapOverride(
  caseId: string,
  partitionId: string,
  componentType: string,
  override: HeatmapOverride,
) {
  const current = read(caseId, partitionId);
  write(caseId, partitionId, {
    ...current,
    heatmap: {
      ...(current.heatmap ?? {}),
      [componentType]: override,
    },
  });
}

export function clearHeatmapOverride(
  caseId: string,
  partitionId: string,
  componentType: string,
) {
  const current = read(caseId, partitionId);
  const heatmap = { ...(current.heatmap ?? {}) };
  delete heatmap[componentType];
  write(caseId, partitionId, {
    ...current,
    heatmap,
  });
}

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
