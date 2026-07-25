import { useEffect, useMemo, useState } from "react"

import type { VisualizationResult } from "@/core/api"
import type { WorkflowNodeObject } from "@/lib/partition-tree/tree.types"

import { TabBtn } from "../shared/tab-btn"
import { SkuListWorkspace } from "../sku-selection/sku-list-workspace"
import { VisualizationWorkspace } from "../visualization/visualization-workspace"
import { WorkflowModalShell } from "./workflow-modal-shell"

type WorkflowTab = "visualization" | "sku-list"

const WORKFLOW_TABS: { value: WorkflowTab; label: string }[] = [
  { value: "visualization", label: "Visualization" },
  { value: "sku-list", label: "SKU List" },
]

function formatCount(value?: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null
  return value.toLocaleString()
}

function buildWorkflowNodeHeader(
  node: WorkflowNodeObject | null | undefined,
  title?: string
) {
  const displayName =
    title?.trim() || node?.node_name?.trim() || "Partition node"

  const stats: Array<{ label: string; value: string }> = []
  if (node?.level != null) stats.push({ label: "Level", value: String(node.level) })
  if (node?.branch) stats.push({ label: "Branch", value: String(node.branch) })

  const skuCount = formatCount(node?.sku_count)
  if (skuCount) stats.push({ label: "Total SKUs", value: skuCount })

  const clientSkuCount = formatCount(node?.client_sku_count)
  if (clientSkuCount) stats.push({ label: "Client SKUs", value: clientSkuCount })

  return {
    displayName,
    stats,
  }
}

export function WorkflowModal({
  open,
  onOpenChange,
  title,
  visualizationResult,
  caseId,
  partitionId,
  node,
  canEdit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  visualizationResult?: VisualizationResult | null
  caseId?: string
  partitionId?: string
  node?: WorkflowNodeObject | null
  canEdit: boolean
}) {
  const [activeTab, setActiveTab] = useState<WorkflowTab>("visualization")

  const header = useMemo(
    () => buildWorkflowNodeHeader(node, title),
    [node, title]
  )

  useEffect(() => {
    setActiveTab("visualization")
  }, [node?.id])

  return (
    <WorkflowModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={header.displayName}
      metadata={header.stats}
      navigation={
        <div className="px-4 sm:px-6">
          <div className="flex h-11 items-center gap-0 overflow-x-auto">
            {WORKFLOW_TABS.map((tab) => (
              <TabBtn
                key={tab.value}
                isActive={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
                size="sm"
              >
                {tab.label}
              </TabBtn>
            ))}
          </div>
        </div>
      }
    >
      {activeTab === "visualization" && (
        <VisualizationWorkspace
          visualizationResult={visualizationResult}
          caseId={caseId}
          partitionId={partitionId}
          node={node}
          canEdit={canEdit}
        />
      )}
      {activeTab === "sku-list" && (
        <SkuListWorkspace
          caseId={caseId}
          partitionId={partitionId}
          node={node}
        />
      )}
    </WorkflowModalShell>
  )
}
