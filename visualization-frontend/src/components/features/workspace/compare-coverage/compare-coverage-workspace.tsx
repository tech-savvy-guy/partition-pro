import { LayersIcon } from "lucide-react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import type {
  RoiCoverageAttribute,
  RoiCoverageOverallEntry,
  RoiCoveragePayload,
  RoiCoverageSplitRow,
} from "@/core/api"
import {
  JOINED_SPLIT_COLUMNS,
  PURE_POS_SPLIT_COLUMNS,
  COVERAGE_HEADER_MAP,
  coverageSplitRowCells,
  fmtInt,
  fmtNum2,
  fmtPct,
} from "@/lib/roi"

import { RoiGate } from "../shared/roi-gate"
import type { UseRoiResultReturn } from "../shared/use-roi-result"
import { CompareCoverageSkeleton } from "./compare-coverage-skeleton"
import { CoverageStatusDot } from "./coverage-status-dot"
import { CoverageTable } from "./coverage-table"

const OVERALL_COVERAGE_COLUMNS = [
  "Min N Cutoff Selected",
  "#SKUs",
  "#Client SKUs",
  "PoS Coverage% Value",
  "PoS Coverage% Volume",
  "Client Coverage% in PoS - Value",
  "Client Coverage% in PoS - Volume",
  "% of Zeroes",
]

const TOTAL_POS_COLUMNS = ["#SKUs", "#Client SKUs", "Value", "Volume"]

/**
 * Compare Coverage workspace (re-skin of the ROI CompareCoverage screen):
 * an "Overall" accordion (Current N Selection / All Panel SKUs / Total PoS)
 * followed by per-attribute PoS sales-split sections with a status dot from
 * the backend's per-attribute `color_flag`.
 */
export function CompareCoverageWorkspace({
  roi,
  onGoToSkuSelection,
}: {
  roi: UseRoiResultReturn
  onGoToSkuSelection?: () => void
}) {
  return (
    <RoiGate
      state={roi.state}
      retry={roi.retry}
      skeleton={<CompareCoverageSkeleton />}
      onGoToSkuSelection={onGoToSkuSelection}
    >
      {(result, isRefreshing) => (
        <CompareCoverageContent
          coverage={result.coverage ?? null}
          isRefreshing={isRefreshing}
        />
      )}
    </RoiGate>
  )
}

function overallEntryCells(entry: RoiCoverageOverallEntry | undefined) {
  if (!entry) return undefined
  return [
    [
      fmtInt(entry.min_n_cutoff_selected ?? entry.min_n),
      fmtInt(entry.skus),
      fmtInt(entry.client_skus),
      fmtPct(entry.pos_coverage_value_pct),
      fmtPct(entry.pos_coverage_volume_pct),
      fmtPct(entry.client_coverage_value_pct),
      fmtPct(entry.client_coverage_volume_pct),
      fmtPct(entry.percent_zeroes),
    ],
  ]
}

function splitRows(
  rows: RoiCoverageSplitRow[] | undefined,
  columns: readonly string[]
) {
  return rows?.map((row) => coverageSplitRowCells(row, columns))
}

function CompareCoverageContent({
  coverage,
  isRefreshing,
}: {
  coverage: RoiCoveragePayload
  isRefreshing: boolean
}) {
  const totalPos = coverage?.overall_coverage?.total_pos
  const attributes = coverage?.coverage ?? []
  const joinedHeaders = JOINED_SPLIT_COLUMNS.map(
    (key) => COVERAGE_HEADER_MAP[key] ?? key
  )
  const purePosHeaders = PURE_POS_SPLIT_COLUMNS.map(
    (key) => COVERAGE_HEADER_MAP[key] ?? key
  )

  return (
    <div className="flex flex-1 flex-col gap-4 bg-background p-6">
      {isRefreshing ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner className="size-3" aria-hidden="true" />
          Recomputing with the new SKU selection…
        </div>
      ) : null}

      <div className="border border-border bg-card">
        <Accordion defaultValue={["overall"]}>
          <AccordionItem value="overall">
            <AccordionTrigger className="px-4 text-sm font-semibold">
              Overall
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-6 px-4 pb-4">
              <CoverageTable
                title="Current N Selection - PoS Coverage"
                columns={OVERALL_COVERAGE_COLUMNS}
                rows={overallEntryCells(
                  coverage?.overall_coverage?.current_selection
                )}
              />
              <CoverageTable
                title="All Panel SKUs - PoS Coverage"
                columns={OVERALL_COVERAGE_COLUMNS}
                rows={overallEntryCells(
                  coverage?.overall_coverage?.all_panel_skus
                )}
              />
              <CoverageTable
                title="Total PoS"
                columns={TOTAL_POS_COLUMNS}
                rows={
                  totalPos
                    ? [
                        [
                          fmtInt(totalPos.skus),
                          fmtInt(totalPos.client_skus),
                          fmtNum2(totalPos.value),
                          fmtNum2(totalPos.volume),
                        ],
                      ]
                    : undefined
                }
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {attributes.length ? (
        <div className="border border-border bg-card">
          <Accordion>
            {attributes.map((attribute) => (
              <AttributeCoverageSection
                key={attribute.id}
                attribute={attribute}
                joinedHeaders={joinedHeaders}
                purePosHeaders={purePosHeaders}
              />
            ))}
          </Accordion>
        </div>
      ) : (
        <Empty className="border border-dashed border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LayersIcon />
            </EmptyMedia>
            <EmptyTitle>No attribute coverage yet</EmptyTitle>
            <EmptyDescription>
              Per-attribute PoS sales-split coverage will appear here once the
              workflow has run for this partition.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}

function AttributeCoverageSection({
  attribute,
  joinedHeaders,
  purePosHeaders,
}: {
  attribute: RoiCoverageAttribute
  joinedHeaders: string[]
  purePosHeaders: string[]
}) {
  const details = attribute.details[0] ?? {}
  return (
    <AccordionItem value={String(attribute.id)}>
      <AccordionTrigger className="px-4 text-sm font-semibold">
        <span className="inline-flex items-center gap-2">
          <CoverageStatusDot flag={attribute.color_flag} />
          {attribute.attribute}
        </span>
      </AccordionTrigger>
      <AccordionContent className="flex flex-col gap-6 px-4 pb-4">
        <CoverageTable
          title={`PoS Sales Split for ${attribute.attribute} in Panel based on Custom Selection`}
          columns={joinedHeaders}
          rows={splitRows(details.pos_sales_split_custom, JOINED_SPLIT_COLUMNS)}
        />
        <CoverageTable
          title={`PoS Sales Split for ${attribute.attribute} in Panel`}
          columns={joinedHeaders}
          rows={splitRows(details.pos_sales_split_panel, JOINED_SPLIT_COLUMNS)}
        />
        <CoverageTable
          title={`PoS Sales Split for ${attribute.attribute}`}
          columns={purePosHeaders}
          rows={splitRows(details.pos_sales_split, PURE_POS_SPLIT_COLUMNS)}
        />
      </AccordionContent>
    </AccordionItem>
  )
}
