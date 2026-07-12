import * as React from "react";
import { usePartitionTreeContext } from "../context";
import BaseTestingResult from "./base-testing-result";
import BaseTestingResultWithAttribute from "./base-testing-result-with-attribute";
import MergeSubAttributesDialog from "./merge-sub-attributes-dialog";

import type { BaseTestingItem } from "./base-testing-result";
import { useBaseTestingMergePreview } from "./use-base-testing-merge-preview";

type Props = {
  baseTesting?: {
    items?: BaseTestingItem[];
    calculated_at?: string;
  } | null;
  nodeId: string;
};

function isOldShapeRows(rows: any[]): boolean {
  return rows.length > 0 && typeof rows[0] === "object" && !Array.isArray(rows[0]);
}

function uniqueAttributeValues(item: BaseTestingItem | null): string[] {
  if (!item) return [];
  const rowsRaw = Array.isArray((item as any)?.rows) ? (item as any).rows : [];
  const out: string[] = [];
  const seen = new Set<string>();

  if (isOldShapeRows(rowsRaw)) {
    rowsRaw.forEach((r: any) => {
      const label = String(r?.label ?? "").trim();
      if (label && !seen.has(label)) {
        seen.add(label);
        out.push(label);
      }
    });
    return out;
  }

  rowsRaw.forEach((r: any) => {
    const label = Array.isArray(r) ? String(r?.[2] ?? "").trim() : String(r?.label ?? "").trim();
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  });
  return out;
}

function singletonGroups(values: string[]): string[][] {
  return values.map((v) => [v]);
}

export default function BaseTesting({ baseTesting, nodeId }: Props) {
  const { caseId, partitionId } = usePartitionTreeContext();
  const items = Array.isArray(baseTesting?.items) ? baseTesting!.items! : [];

  const [selectedAttributeId, setSelectedAttributeId] =
    React.useState<string | null>(null);
  const [rightExpanded, setRightExpanded] = React.useState(false);
  const [mergeAttributeId, setMergeAttributeId] = React.useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = React.useState(false);

  const {
    statesByAttribute,
    setInitialState,
    updateGroups,
    resetState,
    submitPreview,
    cancelAll,
  } = useBaseTestingMergePreview({ caseId, partitionId });

  const getItemId = React.useCallback((it: BaseTestingItem) => {
    return String((it as any)?.id ?? (it as any)?.attribute_id ?? "");
  }, []);

  const selectedItem = React.useMemo(() => {
    if (!selectedAttributeId) return null;
    return items.find((it) => getItemId(it) === String(selectedAttributeId)) ?? null;
  }, [items, selectedAttributeId, getItemId]);

  const mergeItem = React.useMemo(() => {
    if (!mergeAttributeId) return null;
    return items.find((it) => getItemId(it) === String(mergeAttributeId)) ?? null;
  }, [items, mergeAttributeId, getItemId]);

  const mergeAttributeKey = React.useMemo(() => {
    if (!mergeItem) return null;
    return getItemId(mergeItem);
  }, [getItemId, mergeItem]);

  const initialGroups = React.useMemo(() => {
    const values = uniqueAttributeValues(mergeItem);
    return singletonGroups(values);
  }, [mergeItem]);

  const mergeState = mergeAttributeKey ? statesByAttribute[mergeAttributeKey] : undefined;
  const displayedGroups = mergeState?.groups ?? initialGroups;

  React.useEffect(() => {
    if (!mergeItem || !mergeAttributeKey) return;
    setInitialState(mergeAttributeKey, {
      attributeName: String((mergeItem as any)?.attribute ?? ""),
      nodeId,
      groups: initialGroups,
    });
  }, [initialGroups, mergeAttributeKey, mergeItem, nodeId, setInitialState]);

  React.useEffect(() => {
    if (!selectedAttributeId) return;
    const exists = items.some((it) => getItemId(it) === String(selectedAttributeId));
    if (!exists) setSelectedAttributeId(null);
  }, [items, selectedAttributeId, getItemId]);

  React.useEffect(() => {
  // If user de-selects / data changes, ensure we don't stay expanded with no right content
  if (!selectedItem && rightExpanded) setRightExpanded(false);
}, [selectedItem, rightExpanded]);

  React.useEffect(() => {
    return () => cancelAll();
  }, [cancelAll]);

  React.useEffect(() => {
    if (!nodeId) return;
    cancelAll();
  }, [cancelAll, nodeId]);

  const openMerge = React.useCallback(
    (id: string) => {
      setMergeAttributeId(id);
      setMergeOpen(true);
      setSelectedAttributeId(id);
    },
    [],
  );

  const closeMerge = React.useCallback(() => {
    setMergeOpen(false);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Section headers */}
      <div className="flex border-b border-gray-200 bg-gray-50 text-xs text-gray-800 flex-shrink-0">
        {/* Left header only when NOT expanded */}
        {!rightExpanded && (
          <div className="flex w-1/2 items-center gap-4 border-r border-gray-200 px-6 py-2 bg-gray-200">
            <span className="font-semibold">BASE TESTING RESULTS</span>
          </div>
        )}

        {/* Right header grows to full width when expanded */}
        <div className={`flex ${rightExpanded ? "w-full" : "w-1/2"} items-center px-6 py-2`}>
          <div className="flex w-full items-center justify-between gap-3">
            <span className="font-semibold">
              DETAILED BASE TESTING RESULTS WITH ATTRIBUTE VALUES
            </span>

            {/* Show button only when right side has data */}
            {selectedItem ? (
              <button
                type="button"
                onClick={() => setRightExpanded((v) => !v)}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-100"
              >
                {rightExpanded ? "Collapse Result" : "Expand Result"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane only when NOT expanded */}
        {!rightExpanded && (
          <div className="w-1/2 border-r border-gray-200 bg-gray-100 overflow-hidden h-full flex flex-col">
            <BaseTestingResult
              summary={(baseTesting as any)?.summary ?? null}
              items={items}
              selectedAttributeId={selectedAttributeId}
              onSelectAttribute={setSelectedAttributeId}
              onOpenMerge={openMerge}
            />
          </div>
        )}

        {/* Right pane becomes full width when expanded */}
        <div className={`${rightExpanded ? "w-full" : "w-1/2"} bg-white overflow-hidden h-full flex flex-col`}>
          {selectedItem ? (
            <BaseTestingResultWithAttribute item={selectedItem} />
          ) : (
            <div className="flex h-full items-start justify-center px-6 pt-4 text-[11px] text-gray-500">
              Select an attribute first to see detailed results
            </div>
          )}
        </div>
      </div>

      {mergeItem && mergeAttributeKey ? (
        <MergeSubAttributesDialog
          visible={mergeOpen}
          attributeName={String((mergeItem as any)?.attribute ?? "")}
          groups={displayedGroups}
          initialGroups={initialGroups}
          previousResult={mergeItem}
          state={mergeState}
          submitDisabled={!nodeId}
          onGroupsChange={(next) => updateGroups(mergeAttributeKey, next)}
          onReset={() => resetState(mergeAttributeKey, initialGroups)}
          onSubmit={(groupLabels) =>
            submitPreview({
              attributeKey: mergeAttributeKey,
              attributeName: String((mergeItem as any)?.attribute ?? ""),
              nodeId,
              groups: displayedGroups,
              groupLabels,
            })
          }
          onClose={closeMerge}
        />
      ) : null}
    </div>
  );
}
