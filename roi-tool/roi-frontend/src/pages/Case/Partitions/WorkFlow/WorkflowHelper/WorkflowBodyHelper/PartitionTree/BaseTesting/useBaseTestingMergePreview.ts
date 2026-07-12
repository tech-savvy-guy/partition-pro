import * as React from "react";
import { WorkflowApi } from "@/core/api";
import type {
  AttributeMergeState,
  BaseTestingPreviewResult,
  PreviewRollupRequest,
} from "./merge.types";

const POLL_MS = 2000;

function cloneGroups(groups: string[][]): string[][] {
  return groups.map((g) => [...g]);
}

const DEFAULT_GROUP_LABEL = /^Group \d+$/;

function buildGroupingSpec(
  groups: string[][],
  labels?: string[],
): Record<string, string[]> {
  const usedLabels = new Set<string>();
  const spec = new Map<string, string[]>();

  groups.forEach((group, i) => {
    const values = group
      .map((v) => String(v).trim())
      .filter(Boolean);
    if (values.length === 0) return;

    const fallbackLabel = values.join(" | ");
    const rawLabel = labels?.[i]?.trim() ?? "";
    // Treat empty or default "Group N" labels as unset; fall back to joined values
    const label =
      rawLabel && !DEFAULT_GROUP_LABEL.test(rawLabel) ? rawLabel : fallbackLabel;

    // Guarantee uniqueness by looping until the key is confirmed unused
    let uniqueLabel = label;
    let counter = 0;
    while (usedLabels.has(uniqueLabel)) {
      counter++;
      uniqueLabel = `${label} (${counter})`;
    }
    usedLabels.add(uniqueLabel);
    spec.set(uniqueLabel, values);
  });

  return Object.fromEntries(spec);
}

function toFriendlyError(error: any, fallback: string): string {
  const fromResponse =
    error?.response?.data?.message ??
    error?.response?.data?.detail ??
    error?.message;
  return typeof fromResponse === "string" && fromResponse.trim()
    ? fromResponse
    : fallback;
}

function extractTaskIdFromPollingUrl(url: unknown): string {
  if (typeof url !== "string") return "";
  const clean = url.trim();
  if (!clean) return "";
  const parts = clean.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

function normalizePreviewResult(rawStatus: any): BaseTestingPreviewResult {
  // Handle response format: { status, result: { base_testing_preview, edge_cases } }
  const resultData = rawStatus?.result ?? rawStatus;
  const preview =
    resultData?.base_testing_preview ??
    rawStatus?.base_testing_preview ??
    rawStatus?.data?.base_testing_preview ??
    null;

  const passed =
    preview?.passed ??
    resultData?.passed ??
    rawStatus?.passed ??
    rawStatus?.data?.passed ??
    null;

  const edge_cases =
    resultData?.edge_cases ??
    preview?.edge_cases ??
    rawStatus?.edge_cases ??
    rawStatus?.data?.edge_cases ??
    [];

  let items: any[] = [];
  if (Array.isArray(preview?.items)) {
    items = preview.items;
  } else if (preview?.item != null) {
    items = [preview.item];
  } else if (preview && Array.isArray(preview?.columns) && Array.isArray(preview?.rows)) {
    items = [preview];
  }

  return {
    passed,
    edge_cases,
    items,
    raw: rawStatus,
  };
}

type Params = {
  caseId?: string;
  partitionId?: string;
};

type SubmitArgs = {
  attributeKey: string;
  attributeName: string;
  nodeId: string;
  groups: string[][];
  groupLabels?: string[];
};

export function useBaseTestingMergePreview({ caseId, partitionId }: Params) {
  const [statesByAttribute, setStatesByAttribute] = React.useState<
    Record<string, AttributeMergeState>
  >({});

  const timersRef = React.useRef<Record<string, number | null>>({});
  const tokensRef = React.useRef<Record<string, number>>({});

  const cancelPolling = React.useCallback((attributeKey: string) => {
    const timer = timersRef.current[attributeKey];
    if (timer) {
      window.clearTimeout(timer);
    }
    timersRef.current[attributeKey] = null;
    tokensRef.current[attributeKey] = (tokensRef.current[attributeKey] ?? 0) + 1;
    return tokensRef.current[attributeKey];
  }, []);

  const setInitialState = React.useCallback(
    (attributeKey: string, payload: { attributeName: string; nodeId: string; groups: string[][] }) => {
      setStatesByAttribute((prev) => {
        const current = prev[attributeKey];
        if (current) {
          if (current.nodeId !== payload.nodeId) {
            return {
              ...prev,
              [attributeKey]: {
                attributeName: payload.attributeName,
                nodeId: payload.nodeId,
                groups: cloneGroups(payload.groups),
                status: "idle",
              },
            };
          }
          return {
            ...prev,
            [attributeKey]: {
              ...current,
              attributeName: payload.attributeName,
            },
          };
        }

        return {
          ...prev,
          [attributeKey]: {
            attributeName: payload.attributeName,
            nodeId: payload.nodeId,
            groups: cloneGroups(payload.groups),
            status: "idle",
          },
        };
      });
    },
    [],
  );

  const updateGroups = React.useCallback(
    (attributeKey: string, groups: string[][]) => {
      cancelPolling(attributeKey);
      setStatesByAttribute((prev) => {
        const current = prev[attributeKey];
        if (!current) return prev;
        return {
          ...prev,
          [attributeKey]: {
            ...current,
            groups: cloneGroups(groups),
            status: "idle",
            previewId: undefined,
            result: undefined,
            error: undefined,
          },
        };
      });
    },
    [cancelPolling],
  );

  const resetState = React.useCallback(
    (attributeKey: string, groups: string[][]) => {
      cancelPolling(attributeKey);
      setStatesByAttribute((prev) => {
        const current = prev[attributeKey];
        if (!current) return prev;
        return {
          ...prev,
          [attributeKey]: {
            ...current,
            groups: cloneGroups(groups),
            status: "idle",
            previewId: undefined,
            result: undefined,
            error: undefined,
          },
        };
      });
    },
    [cancelPolling],
  );

  const submitPreview = React.useCallback(
    async ({ attributeKey, attributeName, nodeId, groups, groupLabels }: SubmitArgs) => {
      if (!caseId || !partitionId) {
        setStatesByAttribute((prev) => ({
          ...prev,
          [attributeKey]: {
            ...(prev[attributeKey] ?? {
              attributeName,
              nodeId,
              groups: cloneGroups(groups),
              status: "idle",
            }),
            status: "error",
            error: "Missing case or partition context.",
          },
        }));
        return;
      }

      const req: PreviewRollupRequest = {
        node_id: nodeId,
        attribute_name: attributeName,
        new_grouping_spec: buildGroupingSpec(groups, groupLabels),
      };

      cancelPolling(attributeKey);
      setStatesByAttribute((prev) => ({
        ...prev,
        [attributeKey]: {
          ...(prev[attributeKey] ?? {
            attributeName,
            nodeId,
            groups: cloneGroups(groups),
            status: "idle",
          }),
          attributeName,
          nodeId,
          groups: cloneGroups(groups),
          status: "submitting",
          error: undefined,
        },
      }));

      try {
        const postRes = await WorkflowApi.previewRollup(caseId, partitionId, req);
        const previewId = String(
          postRes?.task_id ??
            postRes?.data?.task_id ??
            postRes?.result?.task_id ??
            extractTaskIdFromPollingUrl(postRes?.polling_url) ??
            extractTaskIdFromPollingUrl(postRes?.data?.polling_url) ??
            extractTaskIdFromPollingUrl(postRes?.result?.polling_url) ??
            postRes?.preview_id ??
            postRes?.data?.preview_id ??
            postRes?.result?.preview_id ??
            "",
        ).trim();

        if (!previewId) {
          throw new Error("Task ID missing in preview-rollup response.");
        }

        const token = cancelPolling(attributeKey);
        setStatesByAttribute((prev) => {
          const current = prev[attributeKey];
          if (!current) return prev;
          return {
            ...prev,
            [attributeKey]: {
              ...current,
              status: "polling",
              previewId,
              error: undefined,
            },
          };
        });

        const poll = async () => {
          if ((tokensRef.current[attributeKey] ?? 0) !== token) return;
          try {
            const statusRes = await WorkflowApi.previewRollupStatus(
              caseId,
              partitionId,
              previewId,
            );
            if ((tokensRef.current[attributeKey] ?? 0) !== token) return;

            const hasPreview =
              statusRes?.base_testing_preview != null ||
              statusRes?.data?.base_testing_preview != null ||
              statusRes?.result?.base_testing_preview != null;

            if (hasPreview) {
              const normalized = normalizePreviewResult(statusRes);
              setStatesByAttribute((prev) => {
                const current = prev[attributeKey];
                if (!current) return prev;
                return {
                  ...prev,
                  [attributeKey]: {
                    ...current,
                    status: "ready",
                    result: normalized,
                    error: undefined,
                  },
                };
              });
              cancelPolling(attributeKey);
              return;
            }

            timersRef.current[attributeKey] = window.setTimeout(poll, POLL_MS);
          } catch (error: any) {
            if ((tokensRef.current[attributeKey] ?? 0) !== token) return;
            setStatesByAttribute((prev) => {
              const current = prev[attributeKey];
              if (!current) return prev;
              return {
                ...prev,
                [attributeKey]: {
                  ...current,
                  status: "error",
                  error: toFriendlyError(
                    error,
                    "Failed while polling preview-rollup status.",
                  ),
                },
              };
            });
            cancelPolling(attributeKey);
          }
        };

        poll();
      } catch (error: any) {
        setStatesByAttribute((prev) => {
          const current = prev[attributeKey];
          if (!current) return prev;
          return {
            ...prev,
            [attributeKey]: {
              ...current,
              status: "error",
              error: toFriendlyError(
                error,
                "Failed to submit preview-rollup request.",
              ),
            },
          };
        });
      }
    },
    [caseId, cancelPolling, partitionId],
  );

  const cancelAll = React.useCallback(() => {
    Object.keys(tokensRef.current).forEach((k) => cancelPolling(k));
  }, [cancelPolling]);

  React.useEffect(() => {
    return () => {
      cancelAll();
    };
  }, [cancelAll]);

  return {
    statesByAttribute,
    setInitialState,
    updateGroups,
    resetState,
    submitPreview,
    cancelPolling,
    cancelAll,
  };
}
