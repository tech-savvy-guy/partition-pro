import type { ReactNode } from "react"
import {
  DatabaseIcon,
  ListChecksIcon,
  LockIcon,
  RefreshCwIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import type { RoiResult } from "@/core/api"

import type { RoiResultState } from "./use-roi-result"

/**
 * Phase switch shared by the three ROI tabs: skeleton while loading/running,
 * directive blocked states, the standard failed Alert, and the render-prop
 * for ready content. Keeps the tabs free of run/poll plumbing.
 */
export function RoiGate({
  state,
  retry,
  skeleton,
  onGoToSkuSelection,
  children,
}: {
  state: RoiResultState
  retry: () => void
  skeleton: ReactNode
  onGoToSkuSelection?: () => void
  children: (result: RoiResult, isRefreshing: boolean) => ReactNode
}) {
  switch (state.phase) {
    case "idle":
    case "loading":
      return <>{skeleton}</>

    case "running":
      return (
        <div className="relative flex flex-1 flex-col">
          <div className="flex items-center gap-2 px-8 pt-4 text-xs text-muted-foreground">
            <Spinner className="size-3.5" aria-hidden="true" />
            <span>
              Computing ROI…
              {state.percent != null ? ` ${Math.round(state.percent)}%` : ""}
            </span>
          </div>
          {skeleton}
        </div>
      )

    case "blocked-preprocessing": {
      const status = state.preprocessing?.status
      if (status === "FAILED") {
        return (
          <div className="px-8 pt-4">
            <Alert variant="destructive">
              <DatabaseIcon aria-hidden="true" />
              <AlertTitle>Dataset preprocessing failed</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <span>
                  {state.preprocessing?.error ||
                    "The case's datasets could not be prepared."}
                </span>
                <Button variant="outline" onClick={retry}>
                  <RefreshCwIcon data-icon="inline-start" />
                  Re-check status
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )
      }
      const isPreparing =
        status === "PENDING" || status === "QUEUED" || status === "RUNNING"
      return (
        <Empty className="m-6 flex-1 border border-dashed border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {isPreparing ? <Spinner /> : <DatabaseIcon />}
            </EmptyMedia>
            <EmptyTitle>
              {isPreparing
                ? "Datasets are being prepared"
                : "Datasets not selected yet"}
            </EmptyTitle>
            <EmptyDescription>
              {isPreparing
                ? "This tab unlocks automatically once preprocessing completes."
                : "Select POS, Attributes and Crosspurchase datasets for this case to enable ROI computation."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    }

    case "blocked-no-selection":
      return (
        <Empty className="m-6 flex-1 border border-dashed border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecksIcon />
            </EmptyMedia>
            <EmptyTitle>No SKU selection yet</EmptyTitle>
            <EmptyDescription>{state.message}</EmptyDescription>
          </EmptyHeader>
          {onGoToSkuSelection ? (
            <Button
              variant="outline"
              className="rounded-none"
              onClick={onGoToSkuSelection}
            >
              Go to SKU Selection
            </Button>
          ) : null}
        </Empty>
      )

    case "blocked-forbidden":
      return (
        <Empty className="m-6 flex-1 border border-dashed border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LockIcon />
            </EmptyMedia>
            <EmptyTitle>ROI compute not permitted</EmptyTitle>
            <EmptyDescription>{state.message}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )

    case "failed":
      return (
        <div className="px-8 pt-4">
          <Alert variant="destructive">
            <RefreshCwIcon aria-hidden="true" />
            <AlertTitle>ROI workflow failed</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>
                {state.error || "The workflow could not be completed."}
              </span>
              <Button variant="outline" onClick={retry}>
                <RefreshCwIcon data-icon="inline-start" />
                Retry workflow
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )

    case "ready":
      return <>{children(state.result, state.isRefreshing)}</>
  }
}
