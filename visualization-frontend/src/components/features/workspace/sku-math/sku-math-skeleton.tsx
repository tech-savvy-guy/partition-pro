import { Skeleton } from "@/components/ui/skeleton"

/** Loading shape for the SKU Math workspace (toolbar + filter card + matrix). */
export function SkuMathSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 bg-background p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-28" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>

      {/* Filter card */}
      <div className="flex flex-col gap-3 border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-12 w-full" />
      </div>

      {/* Matrix */}
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
