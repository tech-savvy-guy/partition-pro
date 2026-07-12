import { useMemo, useState } from "react"
import type { ErrorInfo } from "react"
import {
  CheckIcon,
  CopyIcon,
  HomeIcon,
  RefreshCwIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { buildErrorReport, copyTextToClipboard } from "./error-report"

type CopyState = "idle" | "copied" | "failed"

const detailPanelClassName =
  "h-[min(36svh,14rem)] overflow-auto rounded-md bg-muted/50 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground"

export function GlobalErrorFallback({
  error,
  errorInfo,
  capturedAt,
  onReload,
  onGoHome,
}: {
  error: Error
  errorInfo: ErrorInfo | null
  capturedAt: string
  onReload: () => void
  onGoHome: () => void
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle")

  const report = useMemo(
    () => buildErrorReport({ error, errorInfo, capturedAt }),
    [error, errorInfo, capturedAt]
  )

  const stackPreview =
    error.stack?.trim() ||
    errorInfo?.componentStack?.trim() ||
    "No stack trace available."

  async function handleCopyReport() {
    const copied = await copyTextToClipboard(report)
    setCopyState(copied ? "copied" : "failed")
    window.setTimeout(() => setCopyState("idle"), 2500)
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-6">
      <Card className="flex w-full max-w-lg flex-col gap-0 overflow-hidden py-0 shadow-sm">
        <CardHeader className="shrink-0 space-y-3 px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium sm:text-base">
            <span className="leading-snug">
              Well, that wasn&apos;t supposed to happen!
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 32 32"
              aria-hidden="true"
              className="size-5 shrink-0 sm:size-6"
            >
              <g fill="none">
                <path
                  fill="#FFB02E"
                  d="M15.999 29.998c9.334 0 13.999-6.268 13.999-14c0-7.73-4.665-13.998-14-13.998C6.665 2 2 8.268 2 15.999c0 7.731 4.664 13.999 13.999 13.999Z"
                />
                <path
                  fill="#fff"
                  d="M10.42 19.224a4.206 4.206 0 1 0 0-8.411a4.206 4.206 0 0 0 0 8.411Zm11.148.077a4.244 4.244 0 1 0 0-8.489a4.244 4.244 0 0 0 0 8.49Z"
                />
                <path
                  fill="#402A32"
                  d="M10.017 6.37c-.19.703-.525 1.355-1.065 1.83c-.533.467-1.307.8-2.452.8a.5.5 0 0 0 0 1c1.355 0 2.373-.4 3.112-1.049c.73-.642 1.146-1.49 1.37-2.32a.5.5 0 1 0-.965-.262Zm11.966 0c.19.703.525 1.355 1.065 1.83c.533.467 1.307.8 2.452.8a.5.5 0 0 1 0 1c-1.355 0-2.373-.4-3.112-1.049c-.73-.642-1.146-1.49-1.37-2.32a.5.5 0 1 1 .965-.262ZM16 23c-1.286 0-2.014.428-2.293.707a1 1 0 0 1-1.414-1.414C13.013 21.573 14.286 21 16 21c1.64 0 2.981.567 3.707 1.293a1 1 0 0 1-1.414 1.414C18.019 23.433 17.228 23 16 23Zm-2-8a3 3 0 1 1-6 0a3 3 0 0 1 6 0Zm10 0a3 3 0 1 1-6 0a3 3 0 0 1 6 0Z"
                />
                <path
                  fill="#3F5FFF"
                  d="M1 19.5a2.5 2.5 0 0 1 5 0v4a2.5 2.5 0 0 1-5 0v-4Z"
                />
              </g>
            </svg>
          </CardTitle>

          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5"
          >
            <p className="text-[11px] font-semibold tracking-wide text-destructive uppercase">
              {error.name}
            </p>
            <p className="mt-1 text-sm leading-snug font-medium text-foreground">
              {error.message}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {new Date(capturedAt).toLocaleString()}
            </p>
          </div>
        </CardHeader>

        <CardContent className="min-h-0 shrink px-5 pb-4">
          <Tabs defaultValue="details" className="gap-3">
            <TabsList
              variant="line"
              className="h-8 w-full justify-start gap-4 p-0"
            >
              <TabsTrigger value="details" className="flex-none px-0">
                Technical details
              </TabsTrigger>
              <TabsTrigger value="report" className="flex-none px-0">
                Full report
              </TabsTrigger>
            </TabsList>

            <div className="relative h-[min(36svh,14rem)]">
              <TabsContent
                value="details"
                className="absolute inset-0 mt-0 data-hidden:hidden"
              >
                <pre className={cn(detailPanelClassName, "h-full")}>
                  {stackPreview}
                </pre>
              </TabsContent>

              <TabsContent
                value="report"
                className="absolute inset-0 mt-0 data-hidden:hidden"
              >
                <textarea
                  readOnly
                  aria-label="Full error report"
                  value={report}
                  className={cn(
                    detailPanelClassName,
                    "block h-full w-full resize-none text-foreground outline-none"
                  )}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>

        <CardFooter className="shrink-0 gap-4 border-t px-5 py-3 text-sm">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-muted-foreground hover:underline"
            onClick={handleCopyReport}
          >
            {copyState === "copied" ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy report"}
          </Button>
          <div className="ml-auto flex items-center gap-3">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 text-muted-foreground hover:underline"
              onClick={onGoHome}
            >
              <HomeIcon data-icon="inline-start" />
              Go to home page
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 hover:underline"
              onClick={onReload}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Reload
            </Button>
          </div>
        </CardFooter>
      </Card>
    </main>
  )
}
