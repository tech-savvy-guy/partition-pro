import { Skeleton } from "@/components/ui/skeleton"

export function CasesSkeleton() {
  return (
    <div className="overflow-hidden border bg-background">
      <div className="bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-6">
          {["Case", "Case Code", "Created by", "Start", "End", "Description", "Status"].map(
            (col) => (
              <Skeleton key={col} className="h-3.5 w-16" />
            )
          )}
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-6 border-b px-4 py-3.5 last:border-b-0"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-14 rounded" />
        </div>
      ))}
    </div>
  )
}
