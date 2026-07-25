import type { Case, Partition } from "@/core/api"
import { CaseMethodology, useWorkflow } from "@/core/workflow"
import type { PartitionLockLifecycle } from "../shared/use-partition-lock"
import { WorkspaceProvider } from "../workspace-provider"
import { RoiPartitionWorkspace } from "./roi/roi-partition-workspace"
import { VisualizationPartitionWorkspace } from "./visualization/visualization-partition-workspace"
import { VisualizationWorkspaceProvider } from "./visualization/visualization-workspace-provider"

export function MethodologyPartitionWorkspace({
  caseData,
  partitionData,
  partitionLock,
  onRetryPartitionLock,
}: {
  caseData: Case
  partitionData: Partition
  partitionLock: PartitionLockLifecycle
  onRetryPartitionLock: () => void
}) {
  const workflow = useWorkflow()
  const canEditPartition =
    partitionLock.status === "owned" && caseData.can_create_partitions

  return (
    <WorkspaceProvider
      workflow={workflow}
      canEditPartition={canEditPartition}
      partitionLock={partitionLock}
      onRetryPartitionLock={onRetryPartitionLock}
    >
      {workflow.methodology === CaseMethodology.Visualization ? (
        <VisualizationWorkspaceProvider>
          <VisualizationPartitionWorkspace
            caseData={caseData}
            partitionData={partitionData}
          />
        </VisualizationWorkspaceProvider>
      ) : (
        <RoiPartitionWorkspace
          caseData={caseData}
          partitionData={partitionData}
        />
      )}
    </WorkspaceProvider>
  )
}
