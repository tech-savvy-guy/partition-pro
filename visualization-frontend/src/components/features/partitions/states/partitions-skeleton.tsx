import { Skeleton } from "@/components/ui/skeleton"

export function PartitionsSkeleton() {
  return (
    <div className="overflow-hidden border bg-background">
      <div className="bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-8">
          {["Partition", "Status", "Visibility", "Lock", "Updated"].map((col) => (
            <Skeleton key={col} className="h-3.5 w-14" />
          ))}
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-8 border-b px-4 py-3.5 last:border-b-0"
        >
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-5 w-14 rounded" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}
