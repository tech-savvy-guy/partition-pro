import { Skeleton } from "@/components/ui/skeleton"

import { PartitionsSkeleton } from "./partitions-skeleton"

export function CaseDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 border-b pb-5">
        <Skeleton className="h-4 w-16" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-5 w-14 rounded" />
          </div>
          <div className="flex items-center gap-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-36" />
          </div>
        </div>
        <PartitionsSkeleton />
      </div>
    </div>
  )
}
