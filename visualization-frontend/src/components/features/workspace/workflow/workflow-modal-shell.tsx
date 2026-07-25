"use client"

import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export type WorkflowModalMetadataItem = {
  label: string
  value: ReactNode
}

export type WorkflowModalStatus = {
  label: string
  state?: "queued" | "processing" | "running" | "completed" | "failed"
  progress?: number | null
}

export type WorkflowModalShellProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  metadata?: WorkflowModalMetadataItem[]
  status?: WorkflowModalStatus | null
  navigation?: ReactNode
  container?: HTMLElement | null
  children: ReactNode
  className?: string
  contentClassName?: string
}

const statusStyles: Record<
  NonNullable<WorkflowModalStatus["state"]>,
  string
> = {
  queued: "border-border bg-muted text-muted-foreground",
  processing: "border-primary/20 bg-primary/10 text-primary",
  running: "border-primary/20 bg-primary/10 text-primary",
  completed:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
  failed: "border-destructive/20 bg-destructive/10 text-destructive",
}

function normalizeProgress(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, value))
}

export function WorkflowModalShell({
  open,
  onOpenChange,
  title,
  metadata = [],
  status,
  navigation,
  container,
  children,
  className,
  contentClassName,
}: WorkflowModalShellProps) {
  const progress = normalizeProgress(status?.progress)
  const statusState = status?.state ?? "queued"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        fullScreen
        showCloseButton={false}
        container={container}
        className={cn("gap-0 overflow-hidden p-0", className)}
        data-slot="workflow-modal"
      >
        <SheetHeader className="shrink-0 border-b bg-background px-4 py-3 text-left sm:px-6">
          <div className="flex min-h-9 items-center gap-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
              <SheetTitle className="min-w-0 truncate text-lg font-semibold tracking-tight">
                {title}
              </SheetTitle>

              {metadata.length > 0 ? (
                <>
                  <Separator
                    orientation="vertical"
                    className="hidden h-4 self-center sm:block"
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {metadata.map((item) => (
                      <Badge
                        key={item.label}
                        variant="outline"
                        className="h-6 gap-1.5 rounded-md border-border/70 bg-muted/25 px-2 font-normal"
                      >
                        <span className="text-muted-foreground">
                          {item.label}
                        </span>
                        <span className="font-medium tabular-nums text-foreground">
                          {item.value}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {status ? (
              <div className="hidden min-w-36 max-w-52 shrink-0 flex-col gap-1.5 md:flex">
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-auto h-6 rounded-md px-2 text-[11px]",
                    statusStyles[statusState]
                  )}
                >
                  {status.label}
                  {progress != null ? (
                    <span className="tabular-nums">{Math.round(progress)}%</span>
                  ) : null}
                </Badge>
                {progress != null ? (
                  <Progress
                    value={progress}
                    aria-label={`${status.label}: ${Math.round(progress)}%`}
                    className="w-full gap-0"
                  />
                ) : null}
              </div>
            ) : null}

            <SheetClose
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                />
              }
            >
              Close
            </SheetClose>
          </div>

          {status ? (
            <div className="flex items-center gap-2 pt-1 md:hidden">
              <Badge
                variant="outline"
                className={cn(
                  "h-6 rounded-md px-2 text-[11px]",
                  statusStyles[statusState]
                )}
              >
                {status.label}
                {progress != null ? (
                  <span className="tabular-nums">{Math.round(progress)}%</span>
                ) : null}
              </Badge>
              {progress != null ? (
                <Progress
                  value={progress}
                  aria-label={`${status.label}: ${Math.round(progress)}%`}
                  className="min-w-24 flex-1 gap-0"
                />
              ) : null}
            </div>
          ) : null}
        </SheetHeader>

        {navigation ? (
          <div
            className="shrink-0 border-b bg-background"
            data-slot="workflow-modal-navigation"
          >
            {navigation}
          </div>
        ) : null}

        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden bg-background",
            contentClassName
          )}
          data-slot="workflow-modal-content"
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
