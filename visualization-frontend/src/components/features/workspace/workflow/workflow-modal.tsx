import { useEffect, useMemo, useState } from "react"

import type { VisualizationResult } from "@/core/api"
import type { WorkflowNodeObject } from "@/lib/partition-tree/tree.types"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

import { TabBtn } from "../shared/tab-btn"
import { SkuListWorkspace } from "../sku-selection/sku-list-workspace"
import { VisualizationWorkspace } from "../visualization/visualization-workspace"

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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  visualizationResult?: VisualizationResult | null
  caseId?: string
  partitionId?: string
  node?: WorkflowNodeObject | null
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        fullScreen
        showCloseButton={false}
        className="gap-0 p-0"
        data-slot="workflow-modal"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-3 text-left">
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
              <SheetTitle className="shrink-0 text-lg font-semibold tracking-tight">
                {header.displayName}
              </SheetTitle>

              {header.stats.length > 0 && (
                <>
                  <span
                    className="hidden h-4 w-px shrink-0 bg-border sm:block"
                    aria-hidden="true"
                  />
                  <dl className="flex flex-wrap items-center gap-2">
                    {header.stats.map((stat) => (
                      <div
                        key={stat.label}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px]"
                      >
                        <dt className="text-muted-foreground">{stat.label}</dt>
                        <dd className="font-medium tabular-nums text-foreground">
                          {stat.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </div>

            <SheetClose
              render={
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto shrink-0 px-0 text-sm font-medium"
                />
              }
            >
              Close
            </SheetClose>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="shrink-0 border-b bg-background px-6">
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

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {activeTab === "visualization" && (
            <VisualizationWorkspace
              visualizationResult={visualizationResult}
              caseId={caseId}
              partitionId={partitionId}
              node={node}
            />
          )}
          {activeTab === "sku-list" && (
            <SkuListWorkspace
              caseId={caseId}
              partitionId={partitionId}
              node={node}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
