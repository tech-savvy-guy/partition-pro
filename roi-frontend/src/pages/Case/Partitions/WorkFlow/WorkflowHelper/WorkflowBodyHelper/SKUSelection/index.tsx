import "../Workflow.css";
import React from "react";

import { TabMenu } from "primereact/tabmenu";
import type { MenuItem } from "primereact/menuitem";
import type { WorkflowMode } from "../../WorkflowHeader";

import Overview from "./Overview";
import CompareCoverage from "./CompareCoverage";
import MultiDimensionalScaling from "../MultiDimensionalScaling";

type Props = {
  skuSubmitted: boolean;
  processing: boolean;
  skuSelectedIdsFromBackend: string[];
  skuRefreshToken: number;
  readOnly?: boolean;
  workflowMode: WorkflowMode;
  availableWorkflowModes?: WorkflowMode[];
  onWorkflowModeChange?: (mode: WorkflowMode) => void;
  workflowData: any;
  onSubmitSkuSelection: (ids: string[]) => Promise<void> | void;

  //NEW: workflow-level draft selection (single source of truth)
  skuDraftSelectedIds: string[];
  onSkuDraftSelectedIdsChange: (ids: string[]) => void;
};

export default function SKUSelection({
  skuSubmitted,
  processing,
  skuSelectedIdsFromBackend,
  skuRefreshToken,
  readOnly,
  workflowMode,
  availableWorkflowModes = [workflowMode],
  onWorkflowModeChange,
  workflowData,
  onSubmitSkuSelection,
  skuDraftSelectedIds,
  onSkuDraftSelectedIdsChange,
}: Props) {
  const [subIndex, setSubIndex] = React.useState(0);

  const skuStep =
    workflowData?.data?.sku_selection ??
    workflowData?.data?.steps?.sku_selection ??
    workflowData?.steps?.sku_selection ??
    workflowData?.workflow_meta?.data?.steps?.sku_selection ??
    null;

  const skuResult = skuStep?.result ?? null;
  const coverage = Array.isArray(skuResult?.coverage) ? skuResult.coverage : [];
  const overallCoverage = skuResult?.overall_coverage ?? null;

  const compareEnabled =
    !!skuSubmitted &&
    ((skuDraftSelectedIds?.length ?? 0) > 0 || (skuSelectedIdsFromBackend?.length ?? 0) > 0);

  const showMds = availableWorkflowModes.includes("visual");
  const items: MenuItem[] = showMds
    ? [
        { label: "Overview" },
        { label: "Multi Dimensional Scaling", disabled: !skuSubmitted },
        { label: "Compare Coverage", disabled: !compareEnabled },
      ]
    : [
        { label: "Overview" },
        { label: "Compare Coverage", disabled: !compareEnabled },
      ];

  const handleSubmitFromOverview = async (ids: string[]) => {
    if (readOnly) return;
    onSkuDraftSelectedIdsChange(ids);
    await onSubmitSkuSelection(ids);
  };

  // Seed draft once for existing partitions
  React.useEffect(() => {
    if (
      (skuDraftSelectedIds?.length ?? 0) === 0 &&
      (skuSelectedIdsFromBackend?.length ?? 0) > 0
    ) {
      onSkuDraftSelectedIdsChange(skuSelectedIdsFromBackend);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuSelectedIdsFromBackend]);

  const onTabChange = (e: any) => {
    const next = e.index ?? 0;
    if (items[next]?.disabled) return;
    setSubIndex(next);
  };

  React.useEffect(() => {
    if (subIndex >= items.length) {
      setSubIndex(0);
    }
  }, [items.length, subIndex]);

  return (
    <div className="workflow-sku-selection workflow-bleed-x">
      <div className="workflow-subtabmenu-bar workflow-subtabmenu-bar--sticky">
        <TabMenu
          model={items}
          activeIndex={subIndex}
          onTabChange={onTabChange}
          className="workflow-step-tabs workflow-subtabmenu"
        />
      </div>

      {subIndex === 0 ? (
        <Overview
          skuRefreshToken={skuRefreshToken}
          skuSelectedIdsFromBackend={skuSelectedIdsFromBackend}
          processing={processing}
          onSubmitSelectedIds={handleSubmitFromOverview}
          selectedIds={skuDraftSelectedIds}
          onSelectedIdsChange={onSkuDraftSelectedIdsChange}
          readOnly={!!readOnly}
        />
      ) : showMds && subIndex === 1 ? (
        <MultiDimensionalScaling workflowData={workflowData} />
      ) : (
        <CompareCoverage coverage={coverage} overallCoverage={overallCoverage} />
      )}
    </div>
  );
}
