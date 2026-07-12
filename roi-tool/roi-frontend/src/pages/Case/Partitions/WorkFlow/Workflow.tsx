import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import WorkflowHeader, {
  WorkflowTabKey,
  WorkflowMode,
} from "./WorkflowHelper/WorkflowHeader";
import WorkflowBody from "./WorkflowHelper/WorkflowBody";
import { CaseApi, WorkflowApi } from "@/core/api";
import { PartitionApi } from "@/core/api";

type NormalizedWorkflow = {
  status: string;
  currentStep: string;
  percent: number;
  steps: Record<string, any>;
};

// ---- Helpers ----
function normalizeWorkflowStatus(raw: any): NormalizedWorkflow {
  const status = String(raw?.status ?? raw?.workflow_status ?? "UNKNOWN");

  const percentRaw =
    raw?.percent ??
    raw?.perc ??
    raw?.percentage ??
    raw?.progress ??
    raw?.meta?.percent ??
    0;

  const percent = Number(percentRaw) || 0;

  const currentStep = String(
    raw?.current_step ?? raw?.step_name ?? raw?.step ?? raw?.currentStep ?? "",
  );

  const steps =
    raw?.data?.steps ??
    raw?.workflow_meta?.data?.steps ??
    raw?.steps ??
    raw?.data ??
    {};

  return { status, currentStep, percent, steps: steps || {} };
}

function isCompleted(step: any) {
  const s = String(step?.status ?? "").toUpperCase();
  return s === "COMPLETED" || s === "SUCCESS" || s === "DONE";
}

function getStepObj(raw: any, stepKey: string) {
  return (
    raw?.data?.[stepKey] ??
    raw?.data?.steps?.[stepKey] ??
    raw?.steps?.[stepKey] ??
    raw?.workflow_meta?.data?.steps?.[stepKey] ??
    null
  );
}

function extractSelectedIds(skuStep: any): string[] {
  const ids =
    skuStep?.selected_ids ??
    skuStep?.selectedSkuIds ??
    skuStep?.result?.selected_ids ??
    skuStep?.result?.selected_sku_ids ??
    [];
  return Array.isArray(ids) ? ids : [];
}

function normalizeIds(ids: any[] | undefined | null): string[] {
  return (ids ?? [])
    .map((x) => String(x ?? "").trim())
    .filter((s) => s && s !== "null" && s !== "undefined");
}

function setsEqual(a: string[], b: string[]) {
  const A = new Set(normalizeIds(a));
  const B = new Set(normalizeIds(b));
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
}

/**
 * Remove step objects from all known workflow payload shapes
 * so UI doesn't keep showing stale results while recompute happens.
 */
function invalidateStepsEverywhere(prev: any, stepKeys: string[]) {
  if (!prev || typeof prev !== "object") return prev;

  const clone = { ...prev };

  // data.steps
  if (clone?.data?.steps && typeof clone.data.steps === "object") {
    const nextSteps = { ...clone.data.steps };
    stepKeys.forEach((k) => delete nextSteps[k]);
    clone.data = { ...clone.data, steps: nextSteps };
  }

  // data.<stepKey>
  if (clone?.data && typeof clone.data === "object") {
    const nextData = { ...clone.data };
    stepKeys.forEach((k) => delete nextData[k]);
    clone.data = nextData;
  }

  // steps.<stepKey>
  if (clone?.steps && typeof clone.steps === "object") {
    const next = { ...clone.steps };
    stepKeys.forEach((k) => delete next[k]);
    clone.steps = next;
  }

  // workflow_meta.data.steps
  if (
    clone?.workflow_meta?.data?.steps &&
    typeof clone.workflow_meta.data.steps === "object"
  ) {
    const next = { ...clone.workflow_meta.data.steps };
    stepKeys.forEach((k) => delete next[k]);
    clone.workflow_meta = {
      ...clone.workflow_meta,
      data: { ...(clone.workflow_meta.data || {}), steps: next },
    };
  }

  return clone;
}

export default function Workflow() {
  const [activeTab, setActiveTab] =
    React.useState<WorkflowTabKey>("sku-selection");

  // master workflow state
  const [partitionData, setPartitionData] = React.useState<any>(null);

  const [skuSubmitted, setSkuSubmitted] = React.useState(false);
  const [skuSelectedIdsFromBackend, setSkuSelectedIdsFromBackend] =
    React.useState<string[]>([]);
  const [skuRefreshToken, setSkuRefreshToken] = React.useState(0);

  // NEW: draft selection (source of truth for “unsaved changes”)
  const [skuDraftSelectedIds, setSkuDraftSelectedIds] = React.useState<
    string[]
  >([]);

  // NEW: if user clicked a tab but chose “Submit”, we’ll go there after skuSubmitted=true
  const [pendingTabAfterSkuSubmit, setPendingTabAfterSkuSubmit] =
    React.useState<WorkflowTabKey | null>(null);

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [stepName, setStepName] = React.useState("");
  const [perc, setPerc] = React.useState(0);

  const pollTimerRef = React.useRef<number | null>(null);
  const pollingStepRef = React.useRef<string | null>(null);
  const pollTokenRef = React.useRef(0);
  const [lockLoading, setLockLoading] = React.useState(true);
  const [lockAcquired, setLockAcquired] = React.useState(false);
  const [lockedByName, setLockedByName] = React.useState<string | null>(null);
  const [partitionMeta, setPartitionMeta] = React.useState<any>(null);
  const [partitionMetaLoading, setPartitionMetaLoading] = React.useState(true);
  const [workflowMode, setWorkflowMode] = React.useState<WorkflowMode>("roi");
  const [methodology, setMethodology] = React.useState<"roi" | "visual" | "both">("roi");

  const lockRefreshRef = React.useRef<number | null>(null);
  const lockStateRef = React.useRef<{
    acquired: boolean;
    caseId?: string;
    partitionId?: string;
  }>({
    acquired: false,
  });
  // Track last submitted ids so we don't "revert" if backend doesn't echo selected_ids reliably
  const lastSubmittedSkuIdsRef = React.useRef<string[]>([]);

  const navigate = useNavigate();
  const { caseId, partitionId } = useParams<{
    caseId: string;
    partitionId: string;
  }>();

  React.useEffect(() => {
    if (!caseId || !partitionId) return;
    let alive = true;

    setPartitionMetaLoading(true);
    PartitionApi.getPartition(caseId, partitionId)
      .then((res) => {
        if (!alive) return;
        const partition = res.partitions?.[0] || res;
        setPartitionMeta(partition);
      })
      .catch((e) => {
        console.warn("Failed to fetch partition details:", e);
        if (!alive) return;
        setPartitionMeta(null);
      })
      .finally(() => {
        if (!alive) return;
        setPartitionMetaLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [caseId, partitionId]);

  React.useEffect(() => {
    if (!caseId) return;
    let alive = true;

    CaseApi.getCaseDetails(caseId)
      .then((caseDetails) => {
        if (!alive) return;
        const raw = caseDetails.methodology || "ROI";
        const normalized = String(raw).toLowerCase();
        if (normalized.includes("both")) {
          setMethodology("both");
        } else if (normalized.includes("visual") || normalized.includes("2d") || normalized.includes("3d")) {
          setMethodology("visual");
          setWorkflowMode("visual");
        } else {
          setMethodology("roi");
          setWorkflowMode("roi");
        }
      })
      .catch((e) => {
        console.warn("Failed to fetch case methodology:", e);
        if (!alive) return;
        setMethodology("roi");
        setWorkflowMode("roi");
      });

    return () => {
      alive = false;
    };
  }, [caseId]);

  const stopPolling = React.useCallback(() => {
    // invalidate any in-flight tick
    pollTokenRef.current += 1;

    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollingStepRef.current = null;
  }, []);

  // ---- Initial status fetch on entry ----
  const fetchStatusOnce = React.useCallback(async () => {
    if (!caseId || !partitionId) return;

    try {
      const raw = await WorkflowApi.getStatus(caseId, partitionId);
      const norm = normalizeWorkflowStatus(raw);

      setPartitionData(raw);

      setStepName(norm.currentStep || "");
      const skuStep =
        getStepObj(raw, "sku_selection") ?? norm.steps?.sku_selection;
      const p = Number(skuStep?.progress ?? norm.percent ?? 0) || 0;
      setPerc(p);

      const backendSelected = extractSelectedIds(skuStep);
      setSkuSelectedIdsFromBackend(backendSelected);

      const done = isCompleted(skuStep);
      setSkuSubmitted(done);

      // Seed draft from backend once (important for refresh / existing partitions)
      setSkuDraftSelectedIds((prev) => {
        if ((prev?.length ?? 0) > 0) return prev;
        return normalizeIds(backendSelected);
      });

      if (done) setSkuRefreshToken((x) => x + 1);
    } catch (e) {
      console.warn("Workflow status fetch failed:", e);
      setPartitionData(null);
      setSkuSubmitted(false);
      setSkuSelectedIdsFromBackend([]);
      setSkuDraftSelectedIds([]);
    }
  }, [caseId, partitionId]);
  const [closingPartition, setClosingPartition] = React.useState(false);

  const handleClosePartition = React.useCallback(async () => {
    if (!caseId || !partitionId) return;

    // optional safety confirm (recommended since this is destructive)
    const ok = window.confirm("Are you sure you want to close this partition?");
    if (!ok) return;

    setClosingPartition(true);

    try {
      await PartitionApi.closePartition(caseId, partitionId);

      // After closing, go back to partitions list.
      // That page will perform the GET call (same as normal navigation)
      navigate(`/cases/${caseId}/partitions`, {
        replace: true,
        state: { refresh: Date.now(), closedPartitionId: partitionId },
      });
    } catch (e: any) {
      console.error("Close partition failed:", e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Failed to close partition.";
      alert(msg);
    } finally {
      setClosingPartition(false);
    }
  }, [caseId, partitionId, navigate]);

  const patchWorkflowFromDbPayload = React.useCallback((payload: any) => {
    const stepsPatch =
      payload?.data?.steps ?? payload?.steps ?? payload?.data ?? null;

    if (!stepsPatch || typeof stepsPatch !== "object") return;

    setPartitionData((prev: any) => {
      const prevNorm = normalizeWorkflowStatus(prev || {});
      const mergedSteps = { ...(prevNorm.steps || {}), ...stepsPatch };

      // Keep a consistent shape: prefer data.steps if it exists
      let next = { ...(prev || {}) };
      if (next?.data?.steps) {
        next = { ...next, data: { ...next.data, steps: mergedSteps } };
      } else if (next?.workflow_meta?.data?.steps) {
        next = {
          ...next,
          workflow_meta: {
            ...next.workflow_meta,
            data: { ...(next.workflow_meta.data || {}), steps: mergedSteps },
          },
        };
      } else {
        // fallback
        next = { ...next, data: { ...(next.data || {}), steps: mergedSteps } };
      }

      const skuStep =
        mergedSteps?.sku_selection ?? getStepObj(next, "sku_selection");
      if (skuStep) {
        const backendSelected = extractSelectedIds(skuStep);
        setSkuSelectedIdsFromBackend(backendSelected);
        setSkuSubmitted(isCompleted(skuStep));
      }

      return next;
    });
  }, []);

  React.useEffect(() => {
    if (lockLoading) return;
    fetchStatusOnce();
    return () => stopPolling();
  }, [lockLoading, fetchStatusOnce, stopPolling]);
  React.useEffect(() => {
    lockStateRef.current = { acquired: lockAcquired, caseId, partitionId };
  }, [lockAcquired, caseId, partitionId]);
  const readOnly = !lockAcquired;

  // If backend selection changes (poll completion), keep draft in sync ONLY if user has no unsaved changes
  React.useEffect(() => {
    const backend = normalizeIds(skuSelectedIdsFromBackend);
    setSkuDraftSelectedIds((prev) => {
      const prevN = normalizeIds(prev);
      if (setsEqual(prevN, backend)) return backend;
      return prevN;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuSelectedIdsFromBackend.join("|")]);

  // Auto-navigate after submit completes
  React.useEffect(() => {
    if (
      skuSubmitted &&
      pendingTabAfterSkuSubmit &&
      pendingTabAfterSkuSubmit !== "sku-selection"
    ) {
      setActiveTab(pendingTabAfterSkuSubmit);
      setPendingTabAfterSkuSubmit(null);
    }
  }, [skuSubmitted, pendingTabAfterSkuSubmit]);

  React.useEffect(() => {
    if (!caseId || !partitionId) return;

    let alive = true;
    setLockLoading(true);

    (async () => {
      try {
        const res = await PartitionApi.acquireLock(caseId, partitionId);
        if (!alive) return;

        setLockAcquired(!!res?.acquired);
        setLockedByName(res?.locked_by_name ?? null);

        // If not acquired, force SKU tab
        if (!res?.acquired) {
          setActiveTab("sku-selection");
          setPendingTabAfterSkuSubmit(null);
        }
      } catch (e) {
        console.error("Acquire lock failed:", e);
        if (!alive) return;
        setLockAcquired(false);
        setLockedByName(null);
        setActiveTab("sku-selection");
      } finally {
        if (alive) setLockLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [caseId, partitionId]);

  React.useEffect(() => {
    if (!caseId || !partitionId) return;
    if (lockLoading) return;
    if (!lockAcquired) return;

    // Clear any previous
    if (lockRefreshRef.current) {
      window.clearInterval(lockRefreshRef.current);
      lockRefreshRef.current = null;
    }

    lockRefreshRef.current = window.setInterval(async () => {
      try {
        const res = await PartitionApi.refreshLock(caseId, partitionId);

        // If backend says we no longer own it, flip to readOnly
        if (res?.acquired === false) {
          setLockAcquired(false);
          setLockedByName(res?.locked_by_name ?? lockedByName ?? null);
          setActiveTab("sku-selection");
        }
      } catch (e) {
        console.error("Refresh lock failed:", e);
        // best-effort: keep going
      }
    }, 120_000);

    return () => {
      if (lockRefreshRef.current) {
        window.clearInterval(lockRefreshRef.current);
        lockRefreshRef.current = null;
      }
    };
  }, [caseId, partitionId, lockLoading, lockAcquired]);

  React.useEffect(() => {
    return () => {
      const cur = lockStateRef.current;
      if (cur.acquired && cur.caseId && cur.partitionId) {
        PartitionApi.unlock(cur.caseId, cur.partitionId).catch(() => {});
      }
    };
  }, []);

  const startPollingForStep = React.useCallback(
    (stepKey: string) => {
      if (!caseId || !partitionId) return;

      stopPolling();
      pollingStepRef.current = stepKey;
      const token = pollTokenRef.current;

      setIsProcessing(true);
      setStepName(stepKey);
      setPerc(0);

      const tick = async () => {
        if (pollTokenRef.current !== token) return;

        try {
          const raw = await WorkflowApi.getStatus(caseId, partitionId);
          if (pollTokenRef.current !== token) return;

          setPartitionData(raw);

          const stepObj = getStepObj(raw, stepKey);
          const p = Number(stepObj?.progress ?? 0) || 0;
          setPerc(p);

          if (isCompleted(stepObj)) {
            setIsProcessing(false);
            stopPolling();
            return;
          }

          pollTimerRef.current = window.setTimeout(tick, 1500);
        } catch (e) {
          console.error(`Polling ${stepKey} failed:`, e);
          setIsProcessing(false);
          stopPolling();
        }
      };

      tick();
    },
    [caseId, partitionId, stopPolling],
  );

  // Auto-start OBM polling when landing directly on OBM tab
  React.useEffect(() => {
    if (activeTab !== "obm") return;
    if (!partitionData) return;

    const obmStep = getStepObj(partitionData, "partition_obm");
    if (obmStep && !isCompleted(obmStep)) {
      startPollingForStep("partition_obm");
    }
  }, [activeTab, partitionData, startPollingForStep]);

  const startPollingForSkuSelection = React.useCallback(() => {
    if (!caseId || !partitionId) return;

    stopPolling();
    pollingStepRef.current = "sku_selection";
    const token = pollTokenRef.current;

    setIsProcessing(true);
    setStepName("sku_selection");
    setPerc(0);

    const tick = async () => {
      if (pollTokenRef.current !== token) return;

      try {
        const raw = await WorkflowApi.getStatus(caseId, partitionId);
        if (pollTokenRef.current !== token) return;

        setPartitionData(raw);

        const skuStep = getStepObj(raw, "sku_selection");

        //  IMPORTANT:
        // don't overwrite backendSelected while processing (backend may still return old persisted ids)
        if (isCompleted(skuStep)) {
          const backendSelectedRaw = extractSelectedIds(skuStep);
          const backendSelected = normalizeIds(backendSelectedRaw);

          // If backend didn't echo anything meaningful, keep the last submitted selection
          const fallback = normalizeIds(lastSubmittedSkuIdsRef.current);
          const finalIds = backendSelected.length ? backendSelected : fallback;

          setSkuSelectedIdsFromBackend(finalIds);
          setSkuDraftSelectedIds(finalIds);

          setIsProcessing(false);
          setSkuSubmitted(true);
          setSkuRefreshToken((x) => x + 1);

          stopPolling();
          return;
        }

        // keep polling
        pollTimerRef.current = window.setTimeout(tick, 1500);
      } catch (e) {
        console.error("Polling sku_selection failed:", e);
        setIsProcessing(false);
        stopPolling();
      }
    };

    tick();
  }, [caseId, partitionId, stopPolling]);

  const handleSubmitSkuSelection = React.useCallback(
    async (selectedIds: string[]) => {
      if (!caseId || !partitionId) return;
      const ids = normalizeIds(selectedIds);
      if (!ids.length) return;
      if (!lockAcquired) {
        alert(
          "You don't currently hold the lock for this partition. Please refresh and try again.",
        );
        return;
      }
      // remember last submitted ids for safe fallback
      lastSubmittedSkuIdsRef.current = ids;

      // lock forward tabs until backend confirms COMPLETED
      setSkuSubmitted(false);

      //  optimistic lock: prevent UI "reverting"
      setSkuSelectedIdsFromBackend(ids);
      setSkuDraftSelectedIds(ids);

      //  remove stale results so user doesn't see old BaseMath/PartitionTree during recompute
      setPartitionData((prev: any) =>
        invalidateStepsEverywhere(prev, ["base_math", "partition_tree", "obm"]),
      );

      try {
        setIsProcessing(true);
        setStepName("sku_selection");
        setPerc(0);

        await WorkflowApi.runProcess(caseId, partitionId, "process_workflow", {
          // selected_ids: ids,
          selected_sku_ids: ids,
        });

        startPollingForSkuSelection();
      } catch (e) {
        console.error("Submit SKU selection failed:", e);
        setIsProcessing(false);
        alert("Failed to submit SKU selection. Please try again.");
      }
    },
    [caseId, partitionId, lockAcquired, startPollingForSkuSelection],
  );

  // Header Submit button inside dialog uses draft ids
  const submitDraftFromHeader = React.useCallback(async () => {
    await handleSubmitSkuSelection(skuDraftSelectedIds);
  }, [handleSubmitSkuSelection, skuDraftSelectedIds]);

  // Revert draft back to backend persisted ids
  const revertDraftToBackend = React.useCallback(() => {
    setSkuDraftSelectedIds(normalizeIds(skuSelectedIdsFromBackend));
  }, [skuSelectedIdsFromBackend]);

  const skuHasUnsavedChanges = React.useMemo(() => {
    // User already clicked Submit → do not block navigation
    if (isProcessing && pollingStepRef.current === "sku_selection") {
      return false;
    }
    return !setsEqual(skuDraftSelectedIds, skuSelectedIdsFromBackend);
  }, [skuDraftSelectedIds, skuSelectedIdsFromBackend, isProcessing]);

  const handleTabChange = React.useCallback(
    (tab: WorkflowTabKey) => {
      setActiveTab(tab);

      if (tab === "base-math") {
        const baseStep = getStepObj(partitionData, "base_math");
        if (!isCompleted(baseStep)) startPollingForStep("base_math");
      }

      // Partition Tree uses partition tree data, so poll for it if not completed
      if (tab === "partition-tree") {
        const ptStep = getStepObj(partitionData, "partition_tree");
        if (!isCompleted(ptStep)) startPollingForStep("partition_tree");
      }

      //  OBM RULE:
      // only poll if OBM step exists in payload. If it doesn't exist, do nothing.
      if (tab === "obm") {
        const obmStep = getStepObj(partitionData, "obm");
        if (obmStep && !isCompleted(obmStep)) startPollingForStep("obm");
      }
    },
    [partitionData, startPollingForStep],
  );

  const availableWorkflowModes = React.useMemo<WorkflowMode[]>(() => {
    if (methodology === "both") return ["roi", "visual"];
    if (methodology === "visual") return ["visual"];
    return ["roi"];
  }, [methodology]);

  const handleWorkflowModeChange = React.useCallback((mode: WorkflowMode) => {
    setWorkflowMode(mode);
    setActiveTab("sku-selection");
    setPendingTabAfterSkuSubmit(null);
  }, []);

  return (
    <div className="w-full">
      <WorkflowHeader
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onExit={() => navigate(-1)}
        onSave={handleClosePartition}
        saveDisabled={closingPartition}
        skuSubmitted={skuSubmitted}
        skuHasUnsavedChanges={skuHasUnsavedChanges}
        onRevertSkuChanges={revertDraftToBackend}
        onSubmitSkuChanges={submitDraftFromHeader}
        onSetPendingTab={setPendingTabAfterSkuSubmit}
        lockLoading={lockLoading}
        lockAcquired={lockAcquired}
        lockedByName={lockedByName}
        readOnly={readOnly}
        partitionMeta={partitionMeta}
        partitionMetaLoading={partitionMetaLoading}
        workflowMode={workflowMode}
        availableWorkflowModes={availableWorkflowModes}
        onWorkflowModeChange={handleWorkflowModeChange}
      />

      {isProcessing && (
        <div className="mx-6 mt-2 border border-amber-200 bg-amber-50 text-amber-800 text-sm px-3 py-2 rounded">
          Preparing your workflow: <b>{stepName || "..."}</b>. Progress:{" "}
          <b>{Number.isFinite(perc) ? perc.toFixed(1) : "0.0"}%</b>
        </div>
      )}

      {lockLoading ? (
        <div className="mx-6 mt-6 text-sm text-gray-600">Acquiring lock…</div>
      ) : (
        <WorkflowBody
          activeTab={activeTab}
          skuSubmitted={skuSubmitted}
          onForceGoSku={() => setActiveTab("sku-selection")}
          onSubmitSkuSelection={handleSubmitSkuSelection}
          skuSelectedIdsFromBackend={skuSelectedIdsFromBackend}
          skuRefreshToken={skuRefreshToken}
          processing={isProcessing}
          workflowData={partitionData}
          workflowMode={workflowMode}
          availableWorkflowModes={availableWorkflowModes}
          onWorkflowModeChange={handleWorkflowModeChange}
          onPatchWorkflowFromDb={patchWorkflowFromDbPayload}
          skuDraftSelectedIds={skuDraftSelectedIds}
          onSkuDraftSelectedIdsChange={setSkuDraftSelectedIds}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
