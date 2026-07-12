import { useState, useMemo } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage, AvatarGroup } from "@/components/ui/avatar"
import {
  CaseDetailSkeleton,
  PartitionsEmpty,
  PartitionsSkeleton,
  PartitionsTable,
} from "@/components/features/partitions"
import { DatasetsSection } from "@/components/features/cases"
import { CaseApi, DatasetApi, PartitionApi } from "@/core/api"
import { formatDate } from "@/lib/format"
import { Permission, RequirePermission } from "@/core/rbac"

export const Route = createFileRoute("/_authed/cases/$caseId/")({
  component: CaseDetailPage,
})

function getInitials(displayName: string, email: string): string {
  const name = displayName || email || "U"
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function CaseDetailPage() {
  return (
    <RequirePermission
      anyOf={[
        Permission.ViewCases,
        Permission.ViewDatasets,
        Permission.ViewFiles,
        Permission.ViewPartitions,
        Permission.CreatePartitions,
      ]}
    >
      <CaseDetailWorkspace />
    </RequirePermission>
  )
}

function CaseDetailWorkspace() {
  const params = Route.useParams()
  const caseId = params.caseId

  const caseQuery = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => CaseApi.getCase(caseId),
  })
  const partitionsQuery = useQuery({
    queryKey: ["case-partitions", caseId],
    queryFn: () => PartitionApi.listPartitions(caseId),
  })
  const datasetsQuery = useQuery({
    queryKey: ["case-datasets", caseId],
    queryFn: () => DatasetApi.listDatasets(caseId),
  })

  const [searchQuery, setSearchQuery] = useState("")

  const filteredPartitions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return partitionsQuery.data ?? []
    return (partitionsQuery.data ?? []).filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
    )
  }, [partitionsQuery.data, searchQuery])

  if (caseQuery.error) {
    return (
      <Alert variant="destructive">
        <RefreshCwIcon aria-hidden="true" />
        <AlertTitle>Case could not be loaded</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>
            {caseQuery.error instanceof Error
              ? caseQuery.error.message
              : "Unknown error"}
          </span>
          <Button variant="outline" onClick={() => void caseQuery.refetch()}>
            <RefreshCwIcon data-icon="inline-start" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (caseQuery.isLoading || !caseQuery.data) {
    return <CaseDetailSkeleton />
  }

  const caseItem = caseQuery.data

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-4 border-b pb-6">
        <Button
          variant="link"
          size="sm"
          className="h-auto w-fit p-0 text-xs text-muted-foreground hover:text-foreground"
          render={<Link to="/cases" />}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Cases
        </Button>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate text-lg font-semibold tracking-tight">
                {caseItem.name}
              </h1>
              {caseItem.assignments && caseItem.assignments.length > 0 ? (
                <div className="shrink-0">
                  <AvatarGroup>
                    {caseItem.assignments.map((assignment) => (
                      <Avatar key={assignment.user.id} size="sm" title={`${assignment.user.display_name} (${assignment.role})`}>
                        {assignment.user.image ? (
                          <AvatarImage src={assignment.user.image} alt={assignment.user.display_name} />
                        ) : null}
                        <AvatarFallback>
                          {getInitials(assignment.user.display_name, assignment.user.email)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </AvatarGroup>
                </div>
              ) : null}
            </div>

            {caseItem.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed max-w-2xl">
                {caseItem.description}
              </p>
            ) : null}
          </div>

          <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-3 lg:w-auto lg:grid-cols-4 lg:gap-x-10 lg:shrink-0">
            <CaseMeta label="Code" value={caseItem.code || "—"} />
            <CaseMeta label="Methodology" value={caseItem.methodology || "—"} />
            <CaseMeta label="Category" value={caseItem.category || "—"} />
            <CaseMeta label="Updated" value={formatDate(caseItem.updated_at)} />
          </dl>
        </div>
      </div>

      {partitionsQuery.error ? (
        <Alert variant="destructive">
          <RefreshCwIcon aria-hidden="true" />
          <AlertTitle>Partitions could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              {partitionsQuery.error instanceof Error
                ? partitionsQuery.error.message
                : "Unknown error"}
            </span>
            <Button
              variant="outline"
              onClick={() => void partitionsQuery.refetch()}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <DatasetsSection
        caseId={caseId}
        datasets={datasetsQuery.data ?? []}
        isLoading={datasetsQuery.isLoading}
        error={
          datasetsQuery.error instanceof Error ? datasetsQuery.error : null
        }
        partitionCount={partitionsQuery.data?.length ?? null}
        onRetry={() => void datasetsQuery.refetch()}
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">Partitions</p>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                placeholder="Search partitions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 rounded-none border-0 border-b border-border bg-transparent pl-9 text-sm placeholder:text-muted-foreground/60 transition-colors focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0 w-full sm:w-64"
                aria-label="Search partitions"
              />
            </div>
            {caseItem.can_create_partitions ? (
              <Button
                size="sm"
                className="shrink-0"
                render={
                  <Link to="/cases/$caseId/partitions/new" params={{ caseId }} />
                }
              >
                <PlusIcon data-icon="inline-start" />
                New partition
              </Button>
            ) : null}
          </div>
        </div>

        {partitionsQuery.isLoading ? <PartitionsSkeleton /> : null}

        {!partitionsQuery.isLoading &&
        !partitionsQuery.error &&
        partitionsQuery.data?.length === 0 ? (
          <PartitionsEmpty
            caseId={caseId}
            canCreate={caseItem.can_create_partitions}
          />
        ) : null}

        {!partitionsQuery.isLoading &&
        !partitionsQuery.error &&
        partitionsQuery.data &&
        partitionsQuery.data.length > 0 &&
        filteredPartitions.length > 0 ? (
          <PartitionsTable partitions={filteredPartitions} />
        ) : null}

        {!partitionsQuery.isLoading &&
        !partitionsQuery.error &&
        partitionsQuery.data &&
        partitionsQuery.data.length > 0 &&
        filteredPartitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded text-center text-muted-foreground text-sm">
            No partitions match "{searchQuery}"
          </div>
        ) : null}
      </section>
    </div>
  )
}

function CaseMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 lg:items-end">
      <dt className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="truncate text-sm text-foreground">{value}</dd>
    </div>
  )
}
