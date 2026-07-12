import { useEffect, useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { RefreshCwIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  CasesEmpty,
  CasesFilteredEmpty,
  CasesSkeleton,
  CasesTable,
  CasesToolbar,
} from "@/components/features/cases"
import { CaseApi, type Case } from "@/core/api"
import { Permission, RequirePermission } from "@/core/rbac"
import { useUI } from "@/core/ui"
import { cn } from "@/lib/utils"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

export const Route = createFileRoute("/_authed/cases/")({
  component: CasesPage,
})

function CasesPage() {
  return (
    <RequirePermission
      anyOf={[Permission.ViewCases, Permission.CreateCases]}
    >
      <CasesWorkspace />
    </RequirePermission>
  )
}

function CasesWorkspace() {
  const { showToast } = useUI()
  const [search, setSearch] = useState("")

  const [page, setPage] = useState(1)
  const pageSize = 10

  // Reset to first page when search changes
  useEffect(() => {
    setPage(1)
  }, [search])

  const {
    data: cases,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["cases"],
    queryFn: CaseApi.listCases,
  })
  const archiveMutation = useMutation({
    mutationFn: (caseItem: Case) =>
      CaseApi.updateCase(caseItem.id, { status: "archived" }),
    onSuccess: () => {
      showToast("Case archived", "success", {
        description: "The case has been successfully archived.",
      })
      void refetch()
    },
    onError: (mutationError) => {
      showToast("Archive failed", "error", {
        description:
          mutationError instanceof Error
            ? mutationError.message
            : "Case could not be archived.",
      })
    },
  })

  const filteredCases = useMemo(
    () => filterCases(cases ?? [], search),
    [cases, search]
  )

  const pageCount = Math.max(1, Math.ceil(filteredCases.length / pageSize))
  const startIndex = (page - 1) * pageSize
  const pageRows = useMemo(
    () => filteredCases.slice(startIndex, startIndex + pageSize),
    [filteredCases, startIndex, pageSize]
  )

  const visibleStart = filteredCases.length ? startIndex + 1 : 0
  const visibleEnd = Math.min(startIndex + pageSize, filteredCases.length)

  function clearSearch() {
    setSearch("")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 border-b border-border/70 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
        <p className="text-sm text-muted-foreground">
          Review active work, drafts, and archived cases in one place.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <RefreshCwIcon aria-hidden="true" />
            <AlertTitle>Cases could not be loaded</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>
                {error instanceof Error ? error.message : "Unknown error"}
              </span>
              <Button variant="outline" onClick={() => void refetch()}>
                <RefreshCwIcon data-icon="inline-start" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? <CasesSkeleton /> : null}

        {!isLoading && !error && cases?.length === 0 ? <CasesEmpty /> : null}

        {!isLoading && !error && cases && cases.length > 0 ? (
          <section className="flex flex-col gap-3">
            <CasesToolbar
              search={search}
              onSearchChange={setSearch}
            />

            {filteredCases.length === 0 ? (
              <CasesFilteredEmpty onClearFilters={clearSearch} />
            ) : (
              <>
                <CasesTable
                  cases={pageRows}
                  archivingCaseId={archiveMutation.variables?.id}
                  onArchiveCase={(caseItem) => archiveMutation.mutate(caseItem)}
                />

                <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Showing {visibleStart}-{visibleEnd} of {filteredCases.length} cases
                  </p>
                  {pageCount > 1 && (
                    <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                      <PaginationContent className="gap-1">
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            text="Prev"
                            aria-disabled={page === 1}
                            className={cn(
                              "size-7 rounded-none border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground [&>span]:hidden",
                              page === 1 && "pointer-events-none opacity-35"
                            )}
                            onClick={(event) => {
                              event.preventDefault()
                              if (page > 1) setPage(page - 1)
                            }}
                          />
                        </PaginationItem>

                        {buildPageItems(page, pageCount).map((item, index) =>
                          item === "ellipsis" ? (
                            <PaginationItem key={`ellipsis-${index}`}>
                              <PaginationEllipsis className="size-7 text-muted-foreground/60 [&_svg:not([class*='size-'])]:size-3.5" />
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={item}>
                              <PaginationLink
                                href="#"
                                isActive={item === page}
                                className="h-7 min-w-7 rounded-none border-0 bg-transparent px-1.5 text-xs font-normal text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[active=true]:bg-transparent data-[active=true]:font-medium data-[active=true]:text-foreground data-[active=true]:underline data-[active=true]:underline-offset-4"
                                onClick={(event) => {
                                  event.preventDefault()
                                  setPage(item)
                                }}
                              >
                                {item}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        )}

                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            aria-disabled={page === pageCount}
                            className={cn(
                              "size-7 rounded-none border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground [&>span]:hidden",
                              page === pageCount && "pointer-events-none opacity-35"
                            )}
                            onClick={(event) => {
                              event.preventDefault()
                              if (page < pageCount) setPage(page + 1)
                            }}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              </>
            )}
          </section>
        ) : null}
      </div>
    </div>
  )
}

type PageItem = number | "ellipsis"

function buildPageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: PageItem[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)

  if (start > 2) {
    items.push("ellipsis")
  }

  for (let item = start; item <= end; item += 1) {
    items.push(item)
  }

  if (end < pageCount - 1) {
    items.push("ellipsis")
  }

  items.push(pageCount)
  return items
}

function filterCases(cases: Case[], search: string) {
  const normalizedSearch = search.trim().toLowerCase()

  const statusLabels: Record<Case["status"], string> = {
    draft: "Draft",
    active: "Active",
    archived: "Archived",
    completed: "Completed",
  }

  return cases.filter((caseItem) => {
    return (
      normalizedSearch.length === 0 ||
      [
        caseItem.name,
        caseItem.code,
        caseItem.description,
        caseItem.category,
        caseItem.methodology,
        statusLabels[caseItem.status],
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    )
  })
}
