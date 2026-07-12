import { Skeleton } from "@/components/ui/skeleton"

export function PartitionWorkspaceSkeleton() {
  return (
    <div className="-my-6 ml-[calc(50%-50vw)] flex min-h-[calc(100svh-3.5rem)] w-screen flex-col bg-background lg:-my-8">
      <div className="h-8 bg-primary" />
      <div className="flex items-center justify-between border-b px-8 py-3.5">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="flex gap-4 border-b px-8 py-1">
        {[80, 70, 90, 50].map((w, i) => (
          <Skeleton key={i} className="h-9" style={{ width: w }} />
        ))}
      </div>
      <div className="flex flex-col gap-4 p-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-36" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  )
}
