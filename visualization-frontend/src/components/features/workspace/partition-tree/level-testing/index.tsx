import * as React from "react";

import LevelTestingResults from "./level-testing-results";
import type { LevelTestingRow } from "./level-testing-results";
import DetailedResultsWithPartitionTree from "./detailed-results-with-partition-tree/detailed-results-with-partition-tree";

import { Button } from "@/components/ui/button";
import { usePartitionTreeContext } from "../context";

export type LevelTestingPair = {
  L1?: string;
  L2?: string;

  math?: {
    columns?: string[];
    rows?: any[][];
  };

  results?: {
    columns?: string[];
    rows?: any[][];
  };

  summary?: {
    wins_L1?: number;
    wins_L2?: number;
    wins_Tie?: number;
    wins_NA?: number;
    round_winner?: string; // "L1" | "L2" | "Tie" | "None" etc
    comments?: string;
  };
};

export type LevelTestingPayload = {
  pairs?: Record<string, LevelTestingPair>;
  attribute_summary?: Record<
    string,
    { wins?: number; losses?: number; ties?: number }
  >;
};

type Props = {
  levelTesting?: LevelTestingPayload | any | null;
  onSubmitSelectedAttribute?: (attributeName: string) => Promise<void> | void;
  readOnly?: boolean;
};

function asNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Build LEFT table rows directly from backend lhs
 * (Preserves backend rank/valid/comments exactly)
 */
function buildRowsFromLhs(lhs: any): LevelTestingRow[] {
  const cols: string[] = Array.isArray(lhs?.columns)
    ? lhs.columns.map((c: any) => String(c))
    : [];
  const rowsRaw: any[] = Array.isArray(lhs?.rows) ? lhs.rows : [];

  const idx = (name: string, fallback: number) => {
    const i = cols.indexOf(name);
    return i >= 0 ? i : fallback;
  };

  const iId = idx("id", 0);
  const iRank = idx("rank", 1);
  const iAttr = idx("attribute", 2);
  const iWin = idx("win_times", 3);
  const iLoss = idx("loss_times", 4);
  const iTie = idx("tie_times", 5);
  const iValid = idx("is_valid_option", 6);
  const iComment = idx("comment", 7);

  const parsed: LevelTestingRow[] = rowsRaw.map((r: any, k: number) => {
    const attributeName = String(r?.[iAttr] ?? "").trim();

    return {
      /**
       * IMPORTANT:
       * id MUST be the attribute name so that submit continues to POST attributeName as it does now.
       */
      id: attributeName || String(r?.[iId] ?? k),

      rank: asNum(r?.[iRank], k + 1),
      attribute: attributeName,

      winTimes: r?.[iWin] ?? "",
      lossTimes: r?.[iLoss] ?? "",
      tieTimes: r?.[iTie] ?? "",

      valid: r?.[iValid] ? "Yes" : "No",
      comments: String(r?.[iComment] ?? ""),
    };
  });

  // Keep backend order by rank
  parsed.sort((a, b) => asNum(a.rank, 0) - asNum(b.rank, 0));
  return parsed;
}

/**
 * Transform backend "results" into the exact columns/row-order your LevelTestingResult.tsx expects
 */
function transformBackendResults(rawRes: any): {
  columns?: string[];
  rows?: any[][];
} {
  const rowsRaw: any[] = Array.isArray(rawRes?.rows) ? rawRes.rows : [];

  // Backend row order (as per your JSON):
  // [ sku_count, L1_value, L2_value, L1_roi, L2_roi, winner ]
  //
  // Your UI expects columns containing these names:
  // L1_value, L2_value, sku_count, L1_wtd_avg_roi, L2_wtd_avg_roi, winner
  // and the row should match that order.
  const rows = rowsRaw.map((r: any) => [
    r?.[1] ?? "", // L1_value
    r?.[2] ?? "", // L2_value
    r?.[0] ?? "", // sku_count
    r?.[3] ?? null, // L1_wtd_avg_roi
    r?.[4] ?? null, // L2_wtd_avg_roi
    r?.[5] ?? "", // winner
  ]);

  return {
    columns: [
      "L1_value",
      "L2_value",
      "sku_count",
      "L1_wtd_avg_roi",
      "L2_wtd_avg_roi",
      "winner",
    ],
    rows,
  };
}

/**
 * Convert backend {lhs,rhs} into the {pairs, attribute_summary} structure your UI expects.
 */
function normalizeFromLhsRhs(raw: any): LevelTestingPayload {
  const lhs = raw?.lhs;
  const rhs = raw?.rhs;

  // Build attribute_summary (used by older code paths; safe & helpful)
  const attribute_summary: Record<
    string,
    { wins?: number; losses?: number; ties?: number }
  > = {};

  if (lhs?.columns && lhs?.rows) {
    const cols: string[] = Array.isArray(lhs.columns)
      ? lhs.columns.map((c: any) => String(c))
      : [];
    const rowsRaw: any[] = Array.isArray(lhs.rows) ? lhs.rows : [];

    const idx = (name: string, fallback: number) => {
      const i = cols.indexOf(name);
      return i >= 0 ? i : fallback;
    };

    const iAttr = idx("attribute", 2);
    const iWin = idx("win_times", 3);
    const iLoss = idx("loss_times", 4);
    const iTie = idx("tie_times", 5);

    for (const r of rowsRaw) {
      const attr = String(r?.[iAttr] ?? "").trim();
      if (!attr) continue;

      attribute_summary[attr] = {
        wins: asNum(r?.[iWin], 0),
        losses: asNum(r?.[iLoss], 0),
        ties: asNum(r?.[iTie], 0),
      };
    }
  }

  // Build pairs from rhs (dedupe by pair_key)
  const pairs: Record<string, LevelTestingPair> = {};

  if (Array.isArray(rhs)) {
    for (const group of rhs) {
      const detailed: any[] = Array.isArray(group?.detailed_result)
        ? group.detailed_result
        : [];
      for (const item of detailed) {
        const pairKey = String(item?.pair_key ?? item?.pairKey ?? "").trim();
        if (!pairKey) continue;
        if (pairs[pairKey]) continue;

        const L1 = String(item?.attribute_1 ?? item?.attribute1 ?? "").trim();
        const L2 = String(item?.attribute_2 ?? item?.attribute2 ?? "").trim();

        pairs[pairKey] = {
          L1,
          L2,

          //  KEEP backend math matrix intact (columns[0/1] + rows with ROI arrays)
          math: (item?.math ?? null) as any,

          // keep results transformation (it’s already working)
          results: transformBackendResults(item?.results),

          summary: {
            round_winner: String(item?.final_winner ?? "None"),
            comments: String(item?.comment ?? item?.comments ?? ""),
          },
        };
      }
    }
  }

  return { pairs, attribute_summary };
}

/**
 * Normalizer supports BOTH shapes:
 * - frontend shape: {pairs, attribute_summary}
 * - backend shape: {lhs, rhs}
 */
function normalizeLevelTesting(raw: any): LevelTestingPayload {
  if (!raw || typeof raw !== "object") return {};

  if (raw?.pairs || raw?.attribute_summary || raw?.attributeSummary) {
    return {
      pairs: raw?.pairs ?? {},
      attribute_summary: raw?.attribute_summary ?? raw?.attributeSummary ?? {},
    };
  }

  if (raw?.lhs || raw?.rhs) {
    return normalizeFromLhsRhs(raw);
  }

  return {};
}

function buildRowsFromAttributeSummary(
  summary: Record<string, { wins?: number; losses?: number; ties?: number }>,
): LevelTestingRow[] {
  const entries = Object.entries(summary ?? {}).map(([attr, v]) => ({
    attr,
    wins: asNum(v?.wins, 0),
    losses: asNum(v?.losses, 0),
    ties: asNum(v?.ties, 0),
  }));

  // rank: wins desc, ties desc, losses asc, name asc
  entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.ties !== a.ties) return b.ties - a.ties;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return a.attr.localeCompare(b.attr);
  });

  return entries.map((e, idx) => {
    const total = e.wins + e.losses + e.ties;
    return {
      id: e.attr,
      rank: idx + 1,
      attribute: e.attr,
      winTimes: e.wins,
      lossTimes: e.losses,
      tieTimes: e.ties,
      valid: total > 0 ? "Yes" : "No",
      comments: "",
    };
  });
}

export default function LevelTesting({
  levelTesting,
  onSubmitSelectedAttribute,
  readOnly = false,
}: Props) {
  const norm = React.useMemo(
    () => normalizeLevelTesting(levelTesting),
    [levelTesting],
  );

  const rows = React.useMemo(() => {
    const lhs = (levelTesting as any)?.lhs;
    if (lhs?.columns && lhs?.rows) return buildRowsFromLhs(lhs);
    return buildRowsFromAttributeSummary(norm.attribute_summary ?? {});
  }, [levelTesting, norm.attribute_summary]);

  const [selectedAttributeId, setSelectedAttributeId] = React.useState<
    string | null
  >(null);
  const [rightExpanded, setRightExpanded] = React.useState(false);

  const { permissions } = usePartitionTreeContext();
  const canEditWorkflow = permissions.canEdit && permissions.canRunNode;

  React.useEffect(() => {
    if (!selectedAttributeId) return;
    const exists = rows.some((r) => r.id === selectedAttributeId);
    if (!exists) setSelectedAttributeId(null);
  }, [rows, selectedAttributeId]);

  const handleSubmit = async () => {
    if (readOnly) return;
    if (!selectedAttributeId) return;
    await onSubmitSelectedAttribute?.(selectedAttributeId);
  };

  React.useEffect(() => {
    // if nothing selected, right has no data -> don't stay expanded
    if (!selectedAttributeId && rightExpanded) setRightExpanded(false);
  }, [selectedAttributeId, rightExpanded]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* GLOBAL ACTION BAR */}
      <div className="flex min-h-12 flex-shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-6 py-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Level Testing</p>
          <p className="text-[11px] text-muted-foreground">
            Compare performance and choose the strongest partition attribute.
          </p>
        </div>
        {canEditWorkflow && (
          <Button
            size="sm"
            className="h-8 px-4 text-[11px] font-semibold shadow-sm"
            onClick={handleSubmit}
            disabled={
              readOnly || !selectedAttributeId || !onSubmitSelectedAttribute
            }
          >
            Submit
          </Button>
        )}
      </div>

      {/* headers */}
      <div className="flex flex-shrink-0 border-b border-border bg-muted/30 text-xs text-foreground">
        {/* Left header only when NOT expanded */}
        {!rightExpanded && (
          <div className="flex w-1/2 items-center gap-4 border-r border-border bg-muted/60 px-6 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
              Level Testing Results
            </span>
          </div>
        )}

        {/* Right header grows to full width when expanded */}
        <div
          className={`flex ${
            rightExpanded ? "w-full" : "w-1/2"
          } items-center px-6 py-3`}
        >
          <div className="flex w-full items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
              <span>Detailed Results</span>
              <span className="normal-case tracking-normal">
                {(() => {
                  return (
                    <span
                      className={[
                        "inline-flex max-w-[220px] truncate rounded-md border border-border",
                        "bg-background px-2 py-1 text-[11px] font-medium text-foreground shadow-sm",
                      ].join(" ")}
                    >
                      {selectedAttributeId ?? "No attribute selected"}
                    </span>
                  );
                })()}
              </span>
            </span>

            <div className="flex items-center gap-2">
              {/* Expand / Collapse */}
              {selectedAttributeId ? (
                <button
                  type="button"
                  onClick={() => setRightExpanded((v) => !v)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {rightExpanded ? "Collapse Result" : "Expand Result"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT (hidden when expanded) */}
        {!rightExpanded && (
          <div className="w-1/2 overflow-auto border-r border-border bg-muted/20">
            <LevelTestingResults
              rows={rows}
              selectedAttributeId={selectedAttributeId}
              onSelectAttribute={setSelectedAttributeId}
              readOnly={readOnly}
            />
          </div>
        )}

        {/* RIGHT (full width when expanded) */}
        <div
          className={`${
            rightExpanded ? "w-full" : "w-1/2"
          } h-full min-h-0 overflow-y-auto bg-background`}
        >
          {!selectedAttributeId ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="max-w-xs rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  Select an attribute
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Choose an attribute from the results to compare its detailed
                  level-testing performance.
                </p>
              </div>
            </div>
          ) : (
            <DetailedResultsWithPartitionTree
              levelTesting={norm}
              selectedAttribute={selectedAttributeId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
