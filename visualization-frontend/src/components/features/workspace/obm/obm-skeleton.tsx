import { Skeleton } from "@/components/ui/skeleton"

/** Loading shape for the OBM workspace (toolbar + heatmap table). */
export function ObmSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 bg-background p-6">
      <div className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-28" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
