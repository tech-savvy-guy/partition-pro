import React from "react";
import { useLocation } from "react-router-dom";
import type { WorkflowMode, WorkflowTabKey } from "../WorkflowHelper/WorkflowHeader";

import OBM from "./WorkflowBodyHelper/OBM";
import BaseMath from "./WorkflowBodyHelper/BaseMath";
import SKUSelection from "./WorkflowBodyHelper/SKUSelection/index";
import PartitionTree from "./WorkflowBodyHelper/PartitionTree/Index";
import MultiDimensionalScaling from "./WorkflowBodyHelper/MultiDimensionalScaling";
import MultidimensionalVisualization from "./WorkflowBodyHelper/MultidimensionalVisualization";

type Props = {
  activeTab: WorkflowTabKey;
  workflowMode: WorkflowMode;
  availableWorkflowModes?: WorkflowMode[];
  onWorkflowModeChange?: (mode: WorkflowMode) => void;
  skuSubmitted: boolean;
  onForceGoSku: () => void;

  onSubmitSkuSelection: (ids: string[]) => Promise<void> | void;
  skuSelectedIdsFromBackend: string[];
  skuRefreshToken: number;
  processing: boolean;
  workflowData: any;
  readOnly?: boolean;

  onPatchWorkflowFromDb?: (payload: any) => void;

  //NEW: workflow-level draft selection
  skuDraftSelectedIds: string[];
  onSkuDraftSelectedIdsChange: (ids: string[]) => void;

  partitionMeta?: any;
};

export default function WorkflowBody({
  activeTab,
  workflowMode,
  availableWorkflowModes = ["roi"],
  onWorkflowModeChange,
  skuSubmitted,
  onForceGoSku,
  onSubmitSkuSelection,
  skuSelectedIdsFromBackend,
  skuRefreshToken,
  processing,
  readOnly = false,
  workflowData,
  onPatchWorkflowFromDb,
  skuDraftSelectedIds,
  onSkuDraftSelectedIdsChange,
  partitionMeta,
}: Props) {
  const location = useLocation();
  const state = (location.state as { partitionName?: string }) || {};
 React.useEffect(() => {
  if (readOnly) return;
  if (!skuSubmitted && activeTab !== "sku-selection") {
    onForceGoSku();
  }
}, [readOnly, skuSubmitted, activeTab, onForceGoSku]);

  switch (activeTab) {
    case "sku-selection":
      return (
        <SKUSelection
          skuSubmitted={skuSubmitted}
          onSubmitSkuSelection={onSubmitSkuSelection}
          skuSelectedIdsFromBackend={skuSelectedIdsFromBackend}
          skuRefreshToken={skuRefreshToken}
          processing={processing}
          workflowData={workflowData}
          skuDraftSelectedIds={skuDraftSelectedIds}
          onSkuDraftSelectedIdsChange={onSkuDraftSelectedIdsChange}
          workflowMode={workflowMode}
          availableWorkflowModes={availableWorkflowModes}
          onWorkflowModeChange={onWorkflowModeChange}
          readOnly={readOnly}
        />
      );

    case "base-math":
      return <BaseMath workflowData={workflowData} />;

    case "obm":
      return <OBM workflowData={workflowData} />;

    case "partition-tree":
      return (
        <PartitionTree 
          workflowData={workflowData} 
          partitionName={state.partitionName || partitionMeta?.partition_name || "Partition Title"}
          onPatchWorkflowFromDb={onPatchWorkflowFromDb}
          readOnly={readOnly}
        />
      );

    case "mds":
      return <MultiDimensionalScaling workflowData={workflowData} />;

    case "visualization":
      return <MultidimensionalVisualization workflowData={workflowData} />;

    default:
     if (readOnly) {
  return (
    <SKUSelection
      skuSubmitted={skuSubmitted}
      onSubmitSkuSelection={onSubmitSkuSelection}
      skuSelectedIdsFromBackend={skuSelectedIdsFromBackend}
      skuRefreshToken={skuRefreshToken}
      processing={processing}
      workflowData={workflowData}
      skuDraftSelectedIds={skuDraftSelectedIds}
      onSkuDraftSelectedIdsChange={onSkuDraftSelectedIdsChange}
      workflowMode={workflowMode}
      readOnly={readOnly}
    />
  );
}
  }
}
