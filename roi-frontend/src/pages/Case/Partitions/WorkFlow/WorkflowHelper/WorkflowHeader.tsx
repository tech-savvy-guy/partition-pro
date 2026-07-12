// src/pages/Case Flow/Partitions Flow/WorkFlow/WorkflowHeader.tsx
import React from "react";
import { useLocation, useParams } from "react-router-dom";
import PartitionHeader from "@/pages/Case/Partitions/PartitionHelper/PartitionHeader";
import WorkflowIcon from "@/components/icons/WorkflowIcon";

import { TabMenu } from "primereact/tabmenu";
import type { MenuItem } from "primereact/menuitem";
import { Dialog } from "primereact/dialog";
import "./WorkflowBodyHelper/Workflow.css";
import { Button } from "@bain/design-system";
import { useCasePermissions } from "@/core/case/CasePermissionContext";
import { Permission } from "@/core/rbac";
import { PartitionApi } from "@/core/api/partition/partition.api";
import WorkflowModeSwitch from "./WorkflowModeSwitch";

export type WorkflowTabKey =
  | "sku-selection"
  | "base-math"
  | "obm"
  | "partition-tree"
  | "mds"
  | "visualization";

export type WorkflowMode = "roi" | "visual";

type LocState = {
  partitionName?: string;
  caseName?: string;
};

type PartitionDatasetChip = {
  data_type: string;
  version: number;
  is_selected?: boolean;
  status?: string;
};

function toUiStatus(raw: any): "Active" | "Closed" | "Paused" {
  const s = String(raw ?? "").toUpperCase();
  if (s === "CLOSED") return "Closed";
  if (s === "PAUSED") return "Paused";
  return "Active";
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const diffMs = Date.now() - d.getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  const min = Math.floor(sec / 60);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

type Props = {
  activeTab?: WorkflowTabKey;
  onTabChange?: (tab: WorkflowTabKey) => void;
  onExit?: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
  skuSubmitted?: boolean;
  lockLoading?: boolean;
  lockAcquired?: boolean;
  lockedByName?: string | null;
  readOnly?: boolean;
  partitionMeta?: any;
  partitionMetaLoading?: boolean;
  skuHasUnsavedChanges?: boolean;
  onRevertSkuChanges?: () => void;
  onSubmitSkuChanges?: () => Promise<void> | void;
  onSetPendingTab?: (tab: WorkflowTabKey | null) => void;
  workflowMode?: WorkflowMode;
  availableWorkflowModes?: WorkflowMode[];
  onWorkflowModeChange?: (mode: WorkflowMode) => void;
};

const ROI_TAB_DEFS: {
  key: WorkflowTabKey;
  label: string;
  requiresSku?: boolean;
}[] = [
  { key: "sku-selection", label: "SKU Selection", requiresSku: false },
  { key: "base-math", label: "SKU Math", requiresSku: true },
  { key: "partition-tree", label: "Partition Tree", requiresSku: true },
  { key: "obm", label: "OBM", requiresSku: true },
];

const VISUAL_TAB_DEFS: {
  key: WorkflowTabKey;
  label: string;
  requiresSku?: boolean;
}[] = [
  { key: "sku-selection", label: "SKU Selection", requiresSku: false },
  { key: "visualization", label: "Visualization", requiresSku: true },
];

export default function WorkflowHeader({
  activeTab = "sku-selection",
  onTabChange,
  onExit,
  onSave,
  saveDisabled,
  skuSubmitted = false,
  lockLoading = false,
  lockedByName = null,
  readOnly = false,
  skuHasUnsavedChanges = false,
  onRevertSkuChanges,
  onSubmitSkuChanges,
  onSetPendingTab,
  partitionMeta,
  partitionMetaLoading = false,
  workflowMode = "roi",
  availableWorkflowModes = ["roi"],
  onWorkflowModeChange,
}: Props) {
  const { caseId, partitionId } = useParams<{
    caseId: string;
    partitionId: string;
  }>();

  const [showUnsavedDialog, setShowUnsavedDialog] = React.useState(false);
  const [pendingTab, setPendingTab] = React.useState<WorkflowTabKey | null>(
    null
  );
  const { permissions } = useCasePermissions();
  const canEditWorkflow = permissions.includes(Permission.EditPartitions);

  const location = useLocation();
  const state = (location.state as LocState) || {};
  const uiStatus = toUiStatus(partitionMeta?.status);

  const createdText = partitionMetaLoading
    ? "—"
    : timeAgo(partitionMeta?.created_on);

  const updatedText = partitionMetaLoading
    ? "—"
    : timeAgo(partitionMeta?.updated_on);

  const createdByText = partitionMetaLoading
    ? "—"
    : (partitionMeta?.created_by ?? "—");

  const updatedByText = partitionMetaLoading
    ? "—"
    : (partitionMeta?.updated_by ?? "—");

  const rawPartition =
    state.partitionName ??
    partitionMeta?.partition_name ??
    decodeURIComponent(partitionId ?? "");
  const partitionDisplay = rawPartition.replace(/-/g, " - ");

  const [datasetChips, setDatasetChips] = React.useState<PartitionDatasetChip[]>(
    []
  );
  const [datasetsLoading, setDatasetsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!caseId || !partitionId) return;

    let cancelled = false;
    setDatasetsLoading(true);

    PartitionApi.getPartitionRawDatasets(caseId, partitionId)
      .then((res: any) => {
        if (cancelled) return;
        const raw = Array.isArray(res?.datasets) ? res.datasets : [];
        const mapped: PartitionDatasetChip[] = raw.map((d: any) => ({
          data_type: d.data_type,
          version: d.version,
          is_selected: d.is_selected,
          status: d.status,
        }));
        setDatasetChips(mapped);
      })
      .catch(() => {
        if (!cancelled) setDatasetChips([]);
      })
      .finally(() => {
        if (!cancelled) setDatasetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caseId, partitionId]);

  const titleTrailingContent =
    datasetsLoading ? (
      <span className="workflow-dataset-chip workflow-dataset-chip--muted">
        Loading datasets…
      </span>
    ) : datasetChips.length > 0 ? (
      <span className="workflow-dataset-chips">
        {datasetChips.map((d) => (
          <span
            key={`${d.data_type}-${d.version}`}
            className={[
              "workflow-dataset-chip",
              d.is_selected ? "workflow-dataset-chip--selected" : "",
            ].join(" ")}
          >
            {d.data_type} v{d.version}
          </span>
        ))}
      </span>
    ) : null;

  const subtitleContent =
    availableWorkflowModes.length > 1 ? (
      <WorkflowModeSwitch
        workflowMode={workflowMode}
        availableWorkflowModes={availableWorkflowModes}
        onWorkflowModeChange={onWorkflowModeChange}
      />
    ) : null;

  const breadcrumbs = [
    { label: "Cases", to: "/cases" },
    { label: "Partitions", to: `/cases/${caseId}/partitions` },
    { label: "Workflows" },
  ];

  const tabDefs = workflowMode === "visual" ? VISUAL_TAB_DEFS : ROI_TAB_DEFS;

  const openUnsavedDialogForTab = (tab: WorkflowTabKey) => {
    setPendingTab(tab);
    onSetPendingTab?.(tab);
    setShowUnsavedDialog(true);
  };

  const items: MenuItem[] = tabDefs.map((t) => ({
    label: t.label,
    disabled: t.requiresSku ? !skuSubmitted : false,
    command: (ev: any) => {
      ev?.originalEvent?.preventDefault?.();
      ev?.originalEvent?.stopPropagation?.();

      if (t.requiresSku && !skuSubmitted) return;

      if (
        activeTab === "sku-selection" &&
        t.key !== "sku-selection" &&
        skuHasUnsavedChanges
      ) {
        openUnsavedDialogForTab(t.key);
        return;
      }

      onTabChange?.(t.key);
    },
  }));

  const activeIndex = Math.max(
    0,
    tabDefs.findIndex((t) => t.key === activeTab)
  );

  const workflowMeta = (
    <div className="workflow-banner-meta">
      <div className="workflow-banner-stats">
        <div className="workflow-banner-stat">
          <div className="workflow-banner-stat-label">Created</div>
          <div className="workflow-banner-stat-value">{createdText}</div>
          <div className="text-xs text-white/55">{createdByText}</div>
        </div>

        <div className="workflow-banner-stat">
          <div className="workflow-banner-stat-label">Opened</div>
          <div className="workflow-banner-stat-value">{updatedText}</div>
          <div className="text-xs text-white/55">{updatedByText}</div>
        </div>

        <div className="workflow-banner-stat">
          <div className="workflow-banner-stat-label">Status</div>
          <div
            className={[
              "workflow-banner-stat-value",
              "workflow-status-pill",
              uiStatus === "Active"
                ? "workflow-status-active"
                : uiStatus === "Closed"
                  ? "workflow-status-closed"
                  : "workflow-status-paused",
            ].join(" ")}
          >
            {uiStatus}
          </div>
        </div>
      </div>
      <div className="workflow-banner-note">
        {lockLoading ? (
          <span className="workflow-banner-note-strong">Checking lock…</span>
        ) : readOnly ? (
          <>
            <span className="workflow-banner-note-strong">
              This Partition is currently in use by
            </span>{" "}
            <span className="workflow-banner-note-name">
              {lockedByName ?? "another user"}
            </span>
            .
          </>
        ) : (
          <>
            <span className="workflow-banner-note-strong">
              You have locked this Partition
            </span>
            {lockedByName ? (
              <>
                {" "}
                <span className="workflow-banner-note-name">
                  ({lockedByName})
                </span>
              </>
            ) : null}
            .
          </>
        )}
      </div>
    </div>
  );

  const headerRight = workflowMeta;

  const dialogFooter = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end workflow-guard-dialog__footer-actions">
      <Button
        kind="secondary"
        size="sm"
        onClick={() => {
          onRevertSkuChanges?.();
          setShowUnsavedDialog(false);
          const next = pendingTab;
          setPendingTab(null);
          onSetPendingTab?.(null);
          if (next) onTabChange?.(next);
        }}
      >
        Revert
      </Button>

      <Button
        kind="primary"
        size="sm"
        onClick={async () => {
          if (typeof onSubmitSkuChanges === "function") {
            await onSubmitSkuChanges();
          }
          setShowUnsavedDialog(false);
        }}
      >
        Submit
      </Button>
    </div>
  );

  const guardDialogHeader = (
    <div className="workflow-guard-dialog__header">
      <div className="workflow-guard-dialog__icon">
        <i className="pi pi-exclamation-triangle" />
      </div>
      <div>
        <div className="workflow-guard-dialog__eyebrow">Heads up</div>
        <div className="workflow-guard-dialog__title">Unsaved changes</div>
        <p className="workflow-guard-dialog__subtitle">
          Before moving to another tab, decide whether to keep or discard your
          current SKU selection updates.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <PartitionHeader
        caseName={partitionDisplay}
        breadcrumbs={breadcrumbs}
        icon={<WorkflowIcon className="workflow-header-icon h-6 w-6" />}
        right={headerRight}
        titleTrailing={titleTrailingContent}
        subtitle={subtitleContent}
        minimal
      />

      <div className="workflow-tabs-bar workflow-bleed-x workflow-tabs-sticky">
        <div className="workflow-tabs-inner">
          <div className="workflow-tabs-center">
            <TabMenu
              model={items}
              activeIndex={activeIndex}
              onTabChange={(e: any) => {
                e?.originalEvent?.preventDefault?.();
                e?.originalEvent?.stopPropagation?.();
              }}
              className="workflow-step-tabs"
            />
          </div>
          <div className="workflow-tabs-actions">
            <Button
              kind="secondary"
              size="sm"
              className="workflow-partition-action-btn"
              onClick={onExit}
            >
              Exit Partition
            </Button>

            {canEditWorkflow && (
              <Button
                kind="primary"
                size="sm"
                className="workflow-partition-action-btn"
                onClick={() => onSave?.()}
                disabled={saveDisabled || readOnly || lockLoading}
              >
                Close Partition
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog
        header={guardDialogHeader}
        visible={showUnsavedDialog}
        style={{ width: "36rem" }}
        onHide={() => {
          setShowUnsavedDialog(false);
          setPendingTab(null);
          onSetPendingTab?.(null);
        }}
        footer={dialogFooter}
        closable={false}
        dismissableMask={false}
        className="workflow-guard-dialog"
        contentClassName="workflow-guard-dialog__content"
      />
    </>
  );
}
