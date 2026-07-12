import { useEffect, useMemo, useState } from "react"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const PAGINATION_LINK_CLASS =
  "h-7 min-w-7 rounded-none border-0 bg-transparent px-1.5 text-xs font-normal text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[active=true]:bg-transparent data-[active=true]:font-medium data-[active=true]:text-foreground data-[active=true]:underline data-[active=true]:underline-offset-4"

const PAGINATION_ARROW_CLASS =
  "size-7 rounded-none border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground [&>span]:hidden"

type PreviewRow = Record<string, string | number | null>

/**
 * Paginated, full-width preview of a CSV dataset. Renders every column from the
 * source file (no hidden columns, no row selection) and paginates all rows
 * client-side, mirroring the SKU Selection table styling.
 */
export function DatasetPreviewTable({
  columns,
  rows,
  pageSize = 50,
}: {
  columns: string[]
  rows: PreviewRow[]
  pageSize?: number
}) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const startIndex = (page - 1) * pageSize
  const pageRows = rows.slice(startIndex, startIndex + pageSize)
  const visibleStart = rows.length ? startIndex + 1 : 0
  const visibleEnd = Math.min(startIndex + pageSize, rows.length)

  const pageItems = useMemo(
    () => buildPageItems(page, pageCount),
    [page, pageCount]
  )

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount))
  }, [pageCount])

  function goToPage(nextPage: number) {
    setPage(Math.min(Math.max(nextPage, 1), pageCount))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border">
      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-taupe-200">
            <TableRow className="border-b border-border hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column}
                  className="h-9 px-3 text-xs font-mono tracking-wider whitespace-nowrap text-foreground/80"
                >
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, idx) => (
              <TableRow
                key={startIndex + idx}
                className="border-b border-border/30 transition-colors last:border-0 hover:bg-muted/10"
              >
                {columns.map((column) => (
                  <TableCell
                    key={column}
                    className="max-w-72 px-3 py-2 font-mono text-xs text-muted-foreground"
                  >
                    <span
                      className="block truncate"
                      title={formatCellValue(row[column])}
                    >
                      {formatCellValue(row[column])}
                    </span>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-2 border-t bg-background px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {visibleStart}-{visibleEnd} of {rows.length}
          </p>
          <Pagination className="mx-0 w-auto justify-start sm:justify-end">
            <PaginationContent className="gap-1">
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text="Prev"
                  aria-disabled={page === 1}
                  className={cn(
                    PAGINATION_ARROW_CLASS,
                    page === 1 && "pointer-events-none opacity-35"
                  )}
                  onClick={(event) => {
                    event.preventDefault()
                    goToPage(page - 1)
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
                        goToPage(item)
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
                    PAGINATION_ARROW_CLASS,
                    page === pageCount && "pointer-events-none opacity-35"
                  )}
                  onClick={(event) => {
                    event.preventDefault()
                    goToPage(page + 1)
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
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

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  const text = String(value)
  return text.trim() ? text : "—"
}
