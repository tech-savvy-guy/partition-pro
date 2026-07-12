import type { Table } from "@tanstack/react-table"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

import {
  PAGINATION_ARROW_CLASS,
  PAGINATION_LINK_CLASS,
  buildPageItems,
} from "./utils"

export function DataTablePaginationFooter<TData>({
  table,
  totalRows,
}: {
  table: Table<TData>
  totalRows: number
}) {
  const { pageIndex, pageSize } = table.getState().pagination
  const pageCount = Math.max(1, table.getPageCount())
  const page = pageIndex + 1
  const visibleStart = totalRows ? pageIndex * pageSize + 1 : 0
  const visibleEnd = Math.min((pageIndex + 1) * pageSize, totalRows)
  const pageItems = buildPageItems(page, pageCount)

  return (
    <div className="flex flex-col gap-2 border-t bg-background px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing {visibleStart}-{visibleEnd} of {totalRows}
      </p>
      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent className="gap-1">
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text="Prev"
              aria-disabled={!table.getCanPreviousPage()}
              className={cn(
                PAGINATION_ARROW_CLASS,
                !table.getCanPreviousPage() && "pointer-events-none opacity-35",
              )}
              onClick={(event) => {
                event.preventDefault()
                table.previousPage()
              }}
            />
          </PaginationItem>

          {pageItems.map((item, index) =>
            item === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis className="size-7 text-muted-foreground/60 [&_svg:not([class*='size-'])]:size-3.5" />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  href="#"
                  isActive={item === page}
                  className={PAGINATION_LINK_CLASS}
                  onClick={(event) => {
                    event.preventDefault()
                    table.setPageIndex(item - 1)
                  }}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={!table.getCanNextPage()}
              className={cn(
                PAGINATION_ARROW_CLASS,
                !table.getCanNextPage() && "pointer-events-none opacity-35",
              )}
              onClick={(event) => {
                event.preventDefault()
                table.nextPage()
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
