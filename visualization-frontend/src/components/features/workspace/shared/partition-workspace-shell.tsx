import { Link } from "@tanstack/react-router"
import { LockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Case, Partition } from "@/core/api"
import { DatasetChip } from "../shared/dataset-chip"
import { TabBtn } from "../shared/tab-btn"
import { useWorkspace } from "../workspace-provider"

const datasetBadges = [
  { name: "POS", version: "V1" },
  { name: "Attributes", version: "V1" },
  { name: "Crosspurchase", version: "V1" },
]

export function PartitionWorkspaceShell({
  caseData,
  partitionData,
  children,
}: {
  caseData: Case
  partitionData: Partition
  children: React.ReactNode
}) {
  const {
    state: { primaryTab },
    actions: { selectPrimaryTab },
    meta: { postSelectionUnlocked, partitionLock, onRetryPartitionLock },
    workflow,
  } = useWorkspace()

  const lockMessage = (() => {
    switch (partitionLock.status) {
      case "acquiring":
        return "Confirming the partition lock. Editing is temporarily disabled."
      case "blocked": {
        const expiry = partitionLock.expiresAt
          ? new Date(partitionLock.expiresAt).toLocaleString()
          : "an unknown time"
        return `Read-only, locked by ${partitionLock.ownerDisplayName} until ${expiry}.`
      }
      case "view-only":
        return partitionLock.message || "You have view-only access to this partition."
      case "uncertain":
        return "The partition lock could not be confirmed. Editing is disabled."
      case "owned":
        return null
    }
  })()

  const canRetryLock =
    partitionLock.status === "blocked" || partitionLock.status === "uncertain"

  return (
    <div className="-my-6 ml-[calc(50%-50vw)] flex min-h-[calc(100svh-3.5rem)] w-screen flex-col bg-background lg:-my-8">
      {lockMessage ? (
        <div className="flex min-h-8 shrink-0 items-center justify-center gap-2 border-b bg-primary px-4 py-1 text-xs text-primary-foreground/80">
          <LockIcon size={11} aria-hidden="true" />
          <span>{lockMessage}</span>
          {canRetryLock ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-primary-foreground underline underline-offset-2"
              onClick={onRetryPartitionLock}
            >
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      <header className="relative flex shrink-0 overflow-hidden border-b border-border bg-background text-foreground select-none">
        <div
          className="absolute inset-0 bg-cover bg-position-[500px_750px] opacity-20"
          style={{ backgroundImage: "url('/header-bg.jpg')" }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center justify-between gap-6 px-8 py-5">
          <div className="flex min-w-0 flex-col gap-2">
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link className="hover:text-foreground" to="/cases">
                Cases
              </Link>
              <span className="opacity-40">/</span>
              <Link
                className="hover:text-foreground"
                to="/cases/$caseId"
                params={{ caseId: caseData.id }}
              >
                {caseData.name ?? "Partitions"}
              </Link>
              <span className="opacity-40">/</span>
              <span className="text-foreground/85">Workflow</span>
            </nav>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="text-base font-semibold tracking-tight">
                {partitionData.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {datasetBadges.map((dataset) => (
                  <DatasetChip key={dataset.name} dataset={dataset} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <TooltipProvider>
        <div className="sticky top-13 z-31 border-b bg-background">
          <div className="flex h-12 items-center gap-0 overflow-x-auto px-8">
            {workflow.primaryTabs.map((tab) => {
              const isLocked =
                tab.value === "partition-tree" && !postSelectionUnlocked

              const tabBtn = (
                <TabBtn
                  key={tab.value}
                  isActive={primaryTab === tab.value}
                  onClick={() => selectPrimaryTab(tab.value)}
                  size="md"
                  disabled={isLocked}
                >
                  {tab.label}
                </TabBtn>
              )

              if (isLocked) {
                return (
                  <Tooltip key={tab.value}>
                    <TooltipTrigger
                      render={
                        <span className="inline-block cursor-not-allowed">
                          {tabBtn}
                        </span>
                      }
                    />
                    <TooltipContent>
                      Run the workflow in SKU Selection to unlock this tab
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return tabBtn
            })}
          </div>
        </div>
      </TooltipProvider>

      <div className="flex flex-1 flex-col bg-background">
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
