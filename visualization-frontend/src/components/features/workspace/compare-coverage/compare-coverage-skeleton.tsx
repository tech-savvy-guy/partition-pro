import { Skeleton } from "@/components/ui/skeleton"

/** Loading shape for the Compare Coverage workspace. */
export function CompareCoverageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 bg-background p-6">
      <div className="flex flex-col gap-4 border border-border bg-card p-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
