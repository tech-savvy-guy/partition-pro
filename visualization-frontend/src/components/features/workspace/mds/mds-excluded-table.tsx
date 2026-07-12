import { ChevronDownIcon, SearchIcon, XIcon, CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

import {
  SkuSelectionTable,
  type SkuRow,
} from "../sku-selection/sku-selection-table"

const entryOptions = [10, 25, 50]

export function MdsExcludedTable({
  columns,
  rows,
  skuIds,
  search,
  entries,
  onExcludeSkus,
  onSearchChange,
  onEntriesChange,
}: {
  columns: string[]
  rows: SkuRow[]
  skuIds: string[]
  search: string
  entries: number
  onExcludeSkus?: (skuIds: string[]) => void
  onSearchChange: (search: string) => void
  onEntriesChange: (entries: number) => void
}) {
  return (
    <section className="pt-8 pb-10">
      {/* Section header + toolbar */}
      <div className="flex flex-col gap-3 px-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Section 3
          </p>
          <h2 className="mt-1.5 text-sm font-semibold text-foreground">
            Excluded SKUs
          </h2>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-none px-3 text-xs font-medium"
            disabled={!onExcludeSkus || skuIds.length === 0}
            onClick={() => onExcludeSkus?.(skuIds)}
          >
            Exclude
          </Button>

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Show
            <span className="relative">
              <select
                value={entries}
                onChange={(event) =>
                  onEntriesChange(Number(event.currentTarget.value))
                }
                className="h-7 appearance-none border-b border-border bg-transparent pl-1 pr-5 text-xs text-foreground outline-none focus:border-primary"
              >
                {entryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDownIcon
                size={11}
                className="pointer-events-none absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
            entries
          </label>

          <div className="relative">
            <SearchIcon
              size={12}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={search}
              placeholder="Filter…"
              onChange={(event) => onSearchChange(event.currentTarget.value)}
              className="h-8 w-44 rounded-none border-b border-border bg-transparent pr-3 pl-7 text-xs transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mx-8 mt-4 mb-8 border border-dashed bg-muted/5 py-12">
          <Empty className="border-0 shadow-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {search ? (
                  <SearchIcon size={16} />
                ) : (
                  <CheckIcon size={16} className="text-emerald-500" />
                )}
              </EmptyMedia>
              <EmptyTitle>
                {search ? "No matching excluded SKUs" : "No excluded SKUs"}
              </EmptyTitle>
              <EmptyDescription>
                {search
                  ? "Adjust or clear your search to find matching excluded SKUs."
                  : "All SKUs are currently included. Adjust the distance threshold to exclude SKUs."}
              </EmptyDescription>
            </EmptyHeader>
            {search && (
              <EmptyContent>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-none text-xs"
                  onClick={() => onSearchChange("")}
                >
                  <XIcon size={14} className="mr-1.5" />
                  Clear search
                </Button>
              </EmptyContent>
            )}
          </Empty>
        </div>
      ) : (
        <SkuSelectionTable
          columns={columns}
          rows={rows}
          pageSize={entries}
          showSelection={false}
        />
      )}
    </section>
  )
}
