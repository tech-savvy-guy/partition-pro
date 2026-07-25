import * as React from "react";
import { ArrowLeft, ChevronDown, ChevronUp } from "./icons";
import { DataGrid } from "./components/data-grid";
import BaseTestingResultWithAttribute from "./base-testing/base-testing-result-with-attribute";
import type {
  BaseTestingItem,
  BaseTestingSummary,
} from "./base-testing/base-testing-result";
import DetailedResultsWithPartitionTree from "./level-testing/detailed-results-with-partition-tree/detailed-results-with-partition-tree";
import type { LevelTestingPair, LevelTestingPayload } from "./level-testing";

type Props = {
  baseTesting?: {
    items?: BaseTestingItem[];
    summary?: BaseTestingSummary | null;
  } | null;
  levelTesting?: LevelTestingPayload | null;
};

type PartnerStatus = "holds" | "does_not_hold" | "only_one_combination";

type AttributeStats = {
  wins: number;
  losses: number;
  ties: number;
};

type PartnerCard = {
  id: string;
  rank: number;
  attribute: string;
  attributeKey: string;
  status: PartnerStatus;
  wins: number;
  losses: number;
  ties: number;
  baseItem: BaseTestingItem | null;
};

type SummaryTableRow = {
  id: string;
  attributeValue: string;
  skuCount: string;
  clientSkus: string;
  valueShare: string;
  volumeShare: string;
};

const STATUS_ORDER: PartnerStatus[] = [
  "holds",
  "does_not_hold",
  "only_one_combination",
];

const STATUS_UI: Record<
  PartnerStatus,
  {
    label: string;
    description: string;
    lineClassName: string;
    pillClassName: string;
    cardTopClassName: string;
    infoClassName: string;
  }
> = {
  holds: {
    label: "HOLDS",
    description:
      "These attributes have been validated through base testing and consistently drive measurable shopper behaviour. They should be prioritised in any partition strategy.",
    lineClassName: "bg-green-200",
    pillClassName:
      "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
    cardTopClassName: "bg-green-500",
    infoClassName: "border-green-200 bg-green-50 text-green-700",
  },
  does_not_hold: {
    label: "DOES NOT HOLD",
    description:
      "These attributes did not hold significance in base testing. They may still carry contextual value but should not be used as primary partition drivers without further validation.",
    lineClassName: "bg-red-200",
    pillClassName:
      "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    cardTopClassName: "bg-red-500",
    infoClassName: "border-red-200 bg-red-50 text-red-700",
  },
  only_one_combination: {
    label: "ONLY ONE COMBINATION",
    description:
      "Single attribute value present at this node level. They cannot be further tested under this node.",
    lineClassName: "bg-slate-300",
    pillClassName:
      "border border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200",
    cardTopClassName: "bg-slate-400",
    infoClassName: "border-slate-300 bg-slate-100 text-slate-600",
  },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeAttributeKey(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toCount(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  return Math.round(n);
}

function asNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatShare(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "-";
  if (Math.abs(v - Math.round(v)) < 0.05) return String(Math.round(v));
  return v.toFixed(1);
}

function formatStatCount(v: number): string {
  return Number.isFinite(v) ? v.toLocaleString() : "0";
}

function normalizeStatus(v: unknown): PartnerStatus | null {
  if (typeof v === "boolean") return v ? "holds" : "does_not_hold";

  const raw = String(v ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (
    raw === "TRUE" ||
    raw === "HOLDS" ||
    raw === "VALID"
  ) {
    return "holds";
  }
  if (
    raw === "FALSE" ||
    raw === "DOES_NOT_HOLD" ||
    raw === "DOES NOT HOLD" ||
    raw === "NOT_HOLD"
  ) {
    return "does_not_hold";
  }
  if (raw === "ONLY_ONE_COMBINATION" || raw === "ONLY ONE COMBINATION") {
    return "only_one_combination";
  }
  if (raw.includes("ONLY_ONE_COMBINATION") || raw.includes("ONLY ONE")) {
    return "only_one_combination";
  }
  if (raw.includes("FALSE") || raw.includes("NOT_HOLD")) {
    return "does_not_hold";
  }
  if (raw.includes("TRUE") || raw.includes("HOLD")) {
    return "holds";
  }
  return null;
}

function winnerForPair(pair: LevelTestingPair): string {
  const L1 = String(pair?.L1 ?? "").trim();
  const L2 = String(pair?.L2 ?? "").trim();
  const roundWinner = String((pair as any)?.summary?.round_winner ?? "").trim();

  if (!roundWinner || roundWinner.toLowerCase() === "none") return "None";
  if (roundWinner === "L1") return L1 || "L1";
  if (roundWinner === "L2") return L2 || "L2";
  return roundWinner;
}

function transformBackendResults(rawRes: any): {
  columns?: string[];
  rows?: any[][];
} {
  const rowsRaw: any[] = Array.isArray(rawRes?.rows) ? rawRes.rows : [];
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

function normalizePairs(levelTesting: any): Record<string, LevelTestingPair> {
  if (isRecord(levelTesting?.pairs)) {
    return levelTesting.pairs as Record<string, LevelTestingPair>;
  }

  const out: Record<string, LevelTestingPair> = {};
  const rhs = levelTesting?.rhs;
  if (!Array.isArray(rhs)) return out;

  rhs.forEach((group: any) => {
    const detailed = Array.isArray(group?.detailed_result)
      ? group.detailed_result
      : [];
    detailed.forEach((pairItem: any) => {
      const pairKey = String(
        pairItem?.pair_key ?? pairItem?.pairKey ?? "",
      ).trim();
      if (!pairKey || out[pairKey]) return;

      out[pairKey] = {
        L1: String(pairItem?.attribute_1 ?? pairItem?.attribute1 ?? "").trim(),
        L2: String(pairItem?.attribute_2 ?? pairItem?.attribute2 ?? "").trim(),
        math: pairItem?.math ?? null,
        results: transformBackendResults(pairItem?.results),
        summary: {
          round_winner: String(pairItem?.final_winner ?? "None"),
          comments: String(pairItem?.comment ?? pairItem?.comments ?? ""),
        },
      };
    });
  });

  return out;
}

function normalizeLevelTestingPayload(levelTesting: any): LevelTestingPayload {
  const pairs = normalizePairs(levelTesting);
  const attributeSummary = isRecord(levelTesting?.attribute_summary)
    ? (levelTesting.attribute_summary as Record<
        string,
        { wins?: number; losses?: number; ties?: number }
      >)
    : isRecord(levelTesting?.attributeSummary)
      ? (levelTesting.attributeSummary as Record<
          string,
          { wins?: number; losses?: number; ties?: number }
        >)
      : {};

  return {
    pairs,
    attribute_summary: attributeSummary,
  };
}

function extractAttributeSummaryMap(levelTesting: any): Map<string, AttributeStats> {
  const out = new Map<string, AttributeStats>();

  const summaryObj =
    levelTesting?.attribute_summary ?? levelTesting?.attributeSummary ?? null;
  if (isRecord(summaryObj)) {
    Object.entries(summaryObj).forEach(([attribute, stats]) => {
      if (!attribute.trim()) return;
      out.set(normalizeAttributeKey(attribute), {
        wins: toCount((stats as any)?.wins),
        losses: toCount((stats as any)?.losses),
        ties: toCount((stats as any)?.ties),
      });
    });
    return out;
  }

  const lhs = levelTesting?.lhs;
  const cols: string[] = Array.isArray(lhs?.columns)
    ? lhs.columns.map((c: unknown) => String(c))
    : [];
  const rows: any[] = Array.isArray(lhs?.rows) ? lhs.rows : [];
  if (!cols.length || !rows.length) return out;

  const idx = (name: string, fallback: number) => {
    const i = cols.indexOf(name);
    return i >= 0 ? i : fallback;
  };

  const iAttr = idx("attribute", 2);
  const iWin = idx("win_times", 3);
  const iLoss = idx("loss_times", 4);
  const iTie = idx("tie_times", 5);

  rows.forEach((row) => {
    const attribute = String(row?.[iAttr] ?? "").trim();
    if (!attribute) return;
    out.set(normalizeAttributeKey(attribute), {
      wins: toCount(row?.[iWin]),
      losses: toCount(row?.[iLoss]),
      ties: toCount(row?.[iTie]),
    });
  });

  return out;
}

function extractLevelTestingRankMap(levelTesting: any): Map<string, number> {
  const out = new Map<string, number>();

  const lhs = levelTesting?.lhs;
  const cols: string[] = Array.isArray(lhs?.columns)
    ? lhs.columns.map((c: unknown) => String(c))
    : [];
  const rows: any[] = Array.isArray(lhs?.rows) ? lhs.rows : [];

  if (cols.length && rows.length) {
    const idx = (name: string, fallback: number) => {
      const i = cols.indexOf(name);
      return i >= 0 ? i : fallback;
    };

    const iAttr = idx("attribute", 2);
    const iRank = idx("rank", 1);

    rows.forEach((row, index) => {
      const attribute = String(row?.[iAttr] ?? "").trim();
      if (!attribute) return;
      const key = normalizeAttributeKey(attribute);
      if (out.has(key)) return;
      out.set(key, asNum(row?.[iRank], index + 1));
    });
    return out;
  }

  const summaryObj =
    levelTesting?.attribute_summary ?? levelTesting?.attributeSummary ?? null;
  if (!isRecord(summaryObj)) return out;

  const entries = Object.entries(summaryObj).map(([attr, v]) => ({
    attr,
    wins: toCount((v as any)?.wins),
    losses: toCount((v as any)?.losses),
    ties: toCount((v as any)?.ties),
  }));

  entries.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.ties !== a.ties) return b.ties - a.ties;
    if (a.losses !== b.losses) return a.losses - b.losses;
    return a.attr.localeCompare(b.attr);
  });

  entries.forEach((entry, idx) => {
    const key = normalizeAttributeKey(entry.attr);
    if (!key || out.has(key)) return;
    out.set(key, idx + 1);
  });

  return out;
}

function deriveStatsFromPairs(
  pairsByKey: Record<string, LevelTestingPair>,
  attribute: string,
): AttributeStats {
  const selectedKey = normalizeAttributeKey(attribute);
  let wins = 0;
  let losses = 0;
  let ties = 0;

  Object.values(pairsByKey).forEach((pair) => {
    const L1 = normalizeAttributeKey(pair?.L1);
    const L2 = normalizeAttributeKey(pair?.L2);
    if (L1 !== selectedKey && L2 !== selectedKey) return;

    const winner = winnerForPair(pair);
    if (winner === "None") {
      ties += 1;
      return;
    }
    if (normalizeAttributeKey(winner) === selectedKey) {
      wins += 1;
      return;
    }
    losses += 1;
  });

  return { wins, losses, ties };
}

function parseItemSummaryRows(item: BaseTestingItem | null): {
  totalSkus: number | null;
  rows: SummaryTableRow[];
} {
  if (!item) return { totalSkus: null, rows: [] };

  const rowsRaw: any[] = Array.isArray((item as any)?.rows) ? (item as any).rows : [];
  const columnsRaw: any[] = Array.isArray((item as any)?.columns)
    ? (item as any).columns
    : [];

  const totalSkus =
    toNumberOrNull((item as any)?.n_total) ?? toNumberOrNull(columnsRaw?.[1]);

  const rows: SummaryTableRow[] = [];

  rowsRaw.forEach((row: any, idx: number) => {
    let attributeValue = "";
    let skuCountRaw: unknown = null;
    let clientSkusRaw: unknown = null;
    let valueShareRaw: unknown = null;
    let volumeShareRaw: unknown = null;

    if (Array.isArray(row)) {
      attributeValue = String(row?.[2] ?? "").trim();
      skuCountRaw = row?.[1];

      const extras = Array.isArray(row?.[3]) ? row.slice(4) : row.slice(3);
      clientSkusRaw = extras?.[0] ?? null;
      valueShareRaw = extras?.[1] ?? null;
      volumeShareRaw = extras?.[2] ?? null;
    } else if (isRecord(row)) {
      attributeValue = String(
        row?.row_label ?? row?.label ?? row?.value ?? "",
      ).trim();
      skuCountRaw = row?.n_row ?? row?.sku_count ?? row?.skuCount ?? null;
      clientSkusRaw =
        row?.client_skus ?? row?.client_sku ?? row?.clientSkuCount ?? null;
      valueShareRaw = row?.value_share ?? row?.value_percent ?? row?.valueShare;
      volumeShareRaw =
        row?.volume_share ?? row?.volume_percent ?? row?.volumeShare;
    }

    if (!attributeValue) return;

    const skuCount = toNumberOrNull(skuCountRaw);
    const valueShare =
      toNumberOrNull(valueShareRaw) ??
      (skuCount != null && totalSkus && totalSkus > 0
        ? (skuCount / totalSkus) * 100
        : null);
    const volumeShare =
      toNumberOrNull(volumeShareRaw) ??
      (skuCount != null && totalSkus && totalSkus > 0
        ? (skuCount / totalSkus) * 100
        : null);

    rows.push({
      id: `${attributeValue}-${idx}`,
      attributeValue,
      skuCount:
        skuCountRaw !== null && skuCountRaw !== undefined && skuCountRaw !== ""
          ? String(skuCountRaw)
          : "-",
      clientSkus:
        clientSkusRaw !== null &&
        clientSkusRaw !== undefined &&
        clientSkusRaw !== ""
          ? String(clientSkusRaw)
          : "-",
      valueShare: formatShare(valueShare),
      volumeShare: formatShare(volumeShare),
    });
  });

  return { totalSkus, rows };
}

function isNonHoldingValueStatus(v: unknown): boolean {
  if (v === false) return true;
  const raw = String(v ?? "").trim().toUpperCase();
  return (
    raw === "FALSE" ||
    raw === "DOES_NOT_HOLD" ||
    raw === "DOES NOT HOLD" ||
    raw === "NOT_HOLD"
  );
}

function getBaseTestingValueStats(item: BaseTestingItem | null): {
  total: number;
  falseVals: number;
} {
  const rowsRaw: any[] = Array.isArray((item as any)?.rows) ? (item as any).rows : [];
  if (!rowsRaw.length) return { total: 0, falseVals: 0 };

  const seen = new Set<string>();
  let total = 0;
  let falseVals = 0;

  rowsRaw.forEach((row: any, idx: number) => {
    const label = Array.isArray(row)
      ? String(row?.[2] ?? "").trim()
      : String(row?.label ?? row?.row_label ?? "").trim();

    const rowKey = label || `__row_${idx}`;
    if (seen.has(rowKey)) return;
    seen.add(rowKey);
    total += 1;

    const rowStatus = Array.isArray(row)
      ? row?.[0]
      : row?.row_status ?? row?.status ?? row?.testing_result ?? row?.base_result;
    if (isNonHoldingValueStatus(rowStatus)) falseVals += 1;
  });

  return { total, falseVals };
}

function getOnlyCombinationValue(item: BaseTestingItem | null): string {
  const rowsRaw: any[] = Array.isArray((item as any)?.rows) ? (item as any).rows : [];
  if (!rowsRaw.length) return "-";

  const values: string[] = [];
  const seen = new Set<string>();

  rowsRaw.forEach((row: any) => {
    const label = Array.isArray(row)
      ? String(row?.[2] ?? "").trim()
      : String(row?.label ?? row?.row_label ?? "").trim();
    if (!label || seen.has(label)) return;
    seen.add(label);
    values.push(label);
  });

  return values.length > 0 ? values[0] : "-";
}

function buildPartnerCards(
  baseTesting: Props["baseTesting"],
  attributeSummaryMap: Map<string, AttributeStats>,
  rankMap: Map<string, number>,
  pairsByKey: Record<string, LevelTestingPair>,
): PartnerCard[] {
  const items = Array.isArray(baseTesting?.items) ? baseTesting.items : [];
  const summaryRows = Array.isArray(baseTesting?.summary?.rows)
    ? baseTesting?.summary?.rows
    : [];

  const itemByAttributeKey = new Map<string, BaseTestingItem>();
  items.forEach((item) => {
    const attrKey = normalizeAttributeKey((item as any)?.attribute);
    if (!attrKey || itemByAttributeKey.has(attrKey)) return;
    itemByAttributeKey.set(attrKey, item);
  });

  const byAttribute = new Map<string, PartnerCard>();

  const upsertCard = (next: PartnerCard) => {
    const prev = byAttribute.get(next.attributeKey);
    if (!prev) {
      byAttribute.set(next.attributeKey, next);
      return;
    }
    if (next.rank < prev.rank) {
      byAttribute.set(next.attributeKey, next);
    }
  };

  if (summaryRows.length) {
    summaryRows.forEach((row: any, index: number) => {
      const attribute = String(row?.[2] ?? "").trim();
      if (!attribute) return;

      const attributeKey = normalizeAttributeKey(attribute);
      const fallbackItem = itemByAttributeKey.get(attributeKey) ?? null;
      const status =
        normalizeStatus(row?.[3]) ??
        normalizeStatus((fallbackItem as any)?.base_result) ??
        "does_not_hold";
      const rank =
        rankMap.get(attributeKey) ??
        toNumberOrNull(row?.[1]) ??
        index + 1;
      const id =
        String(row?.[0] ?? "").trim() ||
        String((fallbackItem as any)?.id ?? (fallbackItem as any)?.attribute_id ?? "") ||
        attributeKey;

      const summaryStats = attributeSummaryMap.get(attributeKey);
      const stats =
        summaryStats ?? deriveStatsFromPairs(pairsByKey, attribute);

      upsertCard({
        id,
        rank,
        attribute,
        attributeKey,
        status,
        wins: stats.wins,
        losses: stats.losses,
        ties: stats.ties,
        baseItem: fallbackItem,
      });
    });
  }

  if (byAttribute.size === 0) {
    items.forEach((item, index) => {
      const attribute = String((item as any)?.attribute ?? "").trim();
      if (!attribute) return;
      const attributeKey = normalizeAttributeKey(attribute);
      const status = normalizeStatus((item as any)?.base_result) ?? "does_not_hold";
      const id =
        String((item as any)?.id ?? (item as any)?.attribute_id ?? "").trim() ||
        attributeKey;

      const summaryStats = attributeSummaryMap.get(attributeKey);
      const stats =
        summaryStats ?? deriveStatsFromPairs(pairsByKey, attribute);

      upsertCard({
        id,
        rank: rankMap.get(attributeKey) ?? index + 1,
        attribute,
        attributeKey,
        status,
        wins: stats.wins,
        losses: stats.losses,
        ties: stats.ties,
        baseItem: item,
      });
    });
  }

  return Array.from(byAttribute.values()).sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.attribute.localeCompare(b.attribute);
  });
}

function pluralize(v: number, word: string) {
  return `${word}${v === 1 ? "" : "s"}`;
}

export default function PartnerView({ baseTesting, levelTesting }: Props) {
  const normalizedLevelTesting = React.useMemo(
    () => normalizeLevelTestingPayload(levelTesting),
    [levelTesting],
  );

  const pairsByKey = React.useMemo(
    () => normalizedLevelTesting.pairs ?? {},
    [normalizedLevelTesting],
  );
  const attributeSummaryMap = React.useMemo(
    () => extractAttributeSummaryMap(levelTesting),
    [levelTesting],
  );
  const levelTestingRankMap = React.useMemo(
    () => extractLevelTestingRankMap(levelTesting),
    [levelTesting],
  );

  const cards = React.useMemo(
    () =>
      buildPartnerCards(
        baseTesting,
        attributeSummaryMap,
        levelTestingRankMap,
        pairsByKey,
      ),
    [baseTesting, attributeSummaryMap, levelTestingRankMap, pairsByKey],
  );

  const cardsByStatus = React.useMemo(() => {
    const grouped: Record<PartnerStatus, PartnerCard[]> = {
      holds: [],
      does_not_hold: [],
      only_one_combination: [],
    };
    cards.forEach((card) => grouped[card.status].push(card));
    return grouped;
  }, [cards]);

  const [expandedSections, setExpandedSections] = React.useState<
    Set<PartnerStatus>
  >(() => new Set());
  const [selectedAttributeKey, setSelectedAttributeKey] = React.useState<string | null>(
    null,
  );
  const [expandedDetailPanel, setExpandedDetailPanel] = React.useState<
    "base-map" | "level-testing-map" | null
  >(null);
  const [summaryExpanded, setSummaryExpanded] = React.useState(true);
  const [baseMathSectionExpanded, setBaseMathSectionExpanded] =
    React.useState(true);

  const hasInitializedSections = React.useRef(false);

  const toggleSection = React.useCallback((status: PartnerStatus) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!cards.length) {
      setSelectedAttributeKey(null);
      return;
    }
    if (!selectedAttributeKey) return;
    const exists = cards.some((card) => card.attributeKey === selectedAttributeKey);
    if (!exists) setSelectedAttributeKey(null);
  }, [cards, selectedAttributeKey]);

  React.useEffect(() => {
    setExpandedDetailPanel(null);
    setSummaryExpanded(true);
    setBaseMathSectionExpanded(true);
  }, [selectedAttributeKey]);

  React.useEffect(() => {
    if (!cards.length) {
      hasInitializedSections.current = false;
      setExpandedSections(new Set());
      return;
    }
    if (hasInitializedSections.current) return;
    const firstWithCards = STATUS_ORDER.find(
      (status) => cardsByStatus[status].length > 0,
    );
    if (firstWithCards) {
      setExpandedSections(new Set([firstWithCards]));
    }
    hasInitializedSections.current = true;
  }, [cards.length, cardsByStatus]);

  const selectedCard = React.useMemo(
    () =>
      selectedAttributeKey
        ? cards.find((card) => card.attributeKey === selectedAttributeKey) ?? null
        : null,
    [cards, selectedAttributeKey],
  );

  const selectedSummary = React.useMemo(
    () => parseItemSummaryRows(selectedCard?.baseItem ?? null),
    [selectedCard],
  );
  const selectedComparisonAttribute = React.useMemo(() => {
    if (!selectedCard) return null;
    const selectedKey = selectedCard.attributeKey;
    for (const pair of Object.values(pairsByKey)) {
      const l1 = String(pair?.L1 ?? "").trim();
      const l2 = String(pair?.L2 ?? "").trim();
      if (normalizeAttributeKey(l1) === selectedKey) return l1;
      if (normalizeAttributeKey(l2) === selectedKey) return l2;
    }
    return selectedCard.attribute;
  }, [pairsByKey, selectedCard]);

  const totalAttributes = cards.length;
  const holdsCount = cardsByStatus.holds.length;
  const holdsPct =
    totalAttributes > 0 ? Math.round((holdsCount / totalAttributes) * 100) : 0;

  if (!cards.length) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-8">
        <div className="max-w-sm rounded-lg border border-dashed border-border bg-muted/20 px-8 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Partner view is not available yet
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Results will appear here after base and level testing data is
            available.
          </p>
        </div>
      </div>
    );
  }

  if (selectedCard) {
    const baseMapExpanded = expandedDetailPanel === "base-map";
    const levelTestingExpanded = expandedDetailPanel === "level-testing-map";
    const showBasePane = !levelTestingExpanded;
    const showLevelTestingPane = !baseMapExpanded;

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-5 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Attribute analysis
            </p>
            <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {selectedCard.attribute}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setSelectedAttributeKey(null)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft size={14} />
            Back to overview
          </button>
        </div>

        <div
          className={`min-h-0 flex-1 ${
            expandedDetailPanel ? "flex flex-row" : "flex flex-col xl:flex-row"
          }`}
        >
          {showBasePane ? (
            <div
              className={`${
                baseMapExpanded ? "w-full" : "w-full xl:w-1/2"
              } min-h-0 ${
                showLevelTestingPane
                  ? expandedDetailPanel
                    ? "border-r border-border"
                    : "border-b border-border xl:border-b-0 xl:border-r"
                  : ""
              } bg-muted/20`}
            >
            <div className="h-full overflow-auto p-4">
              <section className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                <button
                  type="button"
                  onClick={() => setSummaryExpanded((prev) => !prev)}
                  className="flex w-full items-center justify-between border-b border-border bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  aria-expanded={summaryExpanded}
                >
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground">
                    Summary
                  </h4>
                  {summaryExpanded ? (
                    <ChevronUp size={14} className="text-muted-foreground" />
                  ) : (
                    <ChevronDown size={14} className="text-muted-foreground" />
                  )}
                </button>
                {summaryExpanded ? (
                <div className="p-4">
                  {selectedSummary.rows.length ? (
                    <DataGrid<SummaryTableRow>
                      rows={selectedSummary.rows}
                      rowKey={(row) => String(row.id)}
                      showGridlines
                      className="overflow-hidden rounded-md cases-header-grey"
                      emptyMessage="No summary data available."
                      columns={[
                        {
                          key: "attributeValue",
                          field: "attributeValue",
                          header: "Attribute Value",
                        },
                        {
                          key: "skuCount",
                          field: "skuCount",
                          header: "# SKUs",
                          align: "center",
                        },
                        {
                          key: "clientSkus",
                          field: "clientSkus",
                          header: "Client's SKUs",
                          align: "center",
                        },
                        {
                          key: "valueShare",
                          field: "valueShare",
                          header: "Value % Share",
                          align: "center",
                        },
                        {
                          key: "volumeShare",
                          field: "volumeShare",
                          header: "Volume % Share",
                          align: "center",
                        },
                      ]}
                    />
                  ) : (
                    <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground">
                      No summary values available for this attribute.
                    </div>
                  )}
                </div>
                ) : null}
              </section>

              <section className="mt-4 overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setBaseMathSectionExpanded((prev) => !prev)}
                    className="inline-flex items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-expanded={baseMathSectionExpanded}
                  >
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground">
                      Base Math
                    </h4>
                    {baseMathSectionExpanded ? (
                      <ChevronUp size={14} className="text-muted-foreground" />
                    ) : (
                      <ChevronDown size={14} className="text-muted-foreground" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDetailPanel((prev) =>
                        prev === "base-map" ? null : "base-map",
                      )
                    }
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {baseMapExpanded ? "Collapse" : "Expand"}
                  </button>
                </div>
                {baseMathSectionExpanded ? (
                  selectedCard.baseItem ? (
                    <BaseTestingResultWithAttribute
                      item={selectedCard.baseItem}
                      scrollable={false}
                      showAttributeHeader={false}
                      showCsvDownload={false}
                    />
                  ) : (
                    <div className="m-4 rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground">
                      Base math details are not available for this attribute.
                    </div>
                  )
                ) : null}
              </section>
            </div>
          </div>
          ) : null}

          {showLevelTestingPane ? (
            <div
              className={`${
                levelTestingExpanded ? "w-full" : "w-full xl:w-1/2"
              } min-h-0 bg-background`}
            >
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex min-h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
                    Detailed Results
                  </span>
                  <span className="max-w-[220px] truncate rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground shadow-sm">
                    {selectedComparisonAttribute ?? selectedCard.attribute}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedDetailPanel((prev) =>
                      prev === "level-testing-map" ? null : "level-testing-map",
                    )
                  }
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {levelTestingExpanded
                    ? "Collapse"
                    : "Expand"}
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                <DetailedResultsWithPartitionTree
                  levelTesting={normalizedLevelTesting}
                  selectedAttribute={
                    selectedComparisonAttribute ?? selectedCard.attribute
                  }
                />
              </div>
            </div>
          </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-background">
      <div className="flex-shrink-0 border-b border-border bg-muted/20 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="flex overflow-hidden rounded-lg border border-border bg-background text-[12px] text-foreground shadow-sm">
            <div
              className="min-w-[180px] border-r border-border px-5 py-3"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Total Attributes
              </div>
              <div className="mt-1.5 text-xl font-semibold leading-none tracking-tight text-foreground">
                {formatStatCount(totalAttributes)}
              </div>
            </div>
            <div className="min-w-[220px] px-5 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Holding in Base Math
              </div>
              <div className="mt-1.5 text-xl font-semibold leading-none tracking-tight text-foreground">
                {formatStatCount(holdsCount)}
                <span className="ml-2 text-sm font-medium text-muted-foreground">
                  ({holdsPct}%)
                </span>
              </div>
            </div>
          </div>

          <div
            className="max-w-2xl self-stretch rounded-lg border border-border bg-background px-5 py-3 text-[12px] text-muted-foreground shadow-sm lg:max-w-[55%]"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground">
              How ranking works
            </div>
            <div className="mt-1.5 leading-relaxed">
              <span>
                Ranking is determined by win – loss difference (descending). Ties are broken by wins, then ties, then attribute name (all descending except name, which is alphabetical).
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6">
        {STATUS_ORDER.map((status) => {
          const ui = STATUS_UI[status];
          const isOpen = expandedSections.has(status);
          const count = cardsByStatus[status].length;

          return (
            <section key={status} className="mb-7 last:mb-0">
              <div className="flex items-center gap-3">
                <div className={`h-px flex-1 ${ui.lineClassName}`} />
                <button
                  type="button"
                  onClick={() => toggleSection(status)}
                  aria-expanded={isOpen}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-semibold tracking-[0.08em] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${ui.pillClassName}`}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  <span>{ui.label}</span>
                  <span className="font-medium">{count}</span>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <div className={`h-px flex-1 ${ui.lineClassName}`} />
              </div>

              {isOpen ? (
                <div className="mt-3">
                  <div
                    className={`rounded-lg border px-4 py-3 text-xs leading-relaxed ${ui.infoClassName}`}
                  >
                    {ui.description}
                  </div>

                  {count === 0 ? (
                    <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground">
                      No attributes in this section.
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {cardsByStatus[status].map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => setSelectedAttributeKey(card.attributeKey)}
                          className="group overflow-hidden rounded-lg border border-border bg-background text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <div className={`h-1 w-full ${ui.cardTopClassName}`} />
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-3">
                              <h4 className="text-[14px] font-semibold text-foreground">
                                {card.attribute}
                              </h4>
                              {status === "holds" ? (
                                <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                                  Rank {card.rank}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                              {status === "does_not_hold" ? (
                                (() => {
                                  const stats = getBaseTestingValueStats(card.baseItem);
                                  return (
                                    <>
                                      This attribute has{" "}
                                      <span className="font-semibold text-foreground">
                                        {stats.total}
                                      </span>{" "}
                                      values out of which{" "}
                                      <span className="font-semibold text-red-500">
                                        {stats.falseVals}
                                      </span>{" "}
                                      are not mathematically holding
                                    </>
                                  );
                                })()
                              ) : status === "only_one_combination" ? (
                                (() => {
                                  const value = getOnlyCombinationValue(card.baseItem);
                                  return (
                                    <>
                                      All SKUs under this node are{" "}
                                      <span className="font-semibold text-foreground">
                                        {value}
                                      </span>
                                    </>
                                  );
                                })()
                              ) : (
                                <>
                                  <span className="font-semibold text-green-600">Wins</span>{" "}
                                  against{" "}
                                  <span className="font-semibold text-green-600">
                                    {card.wins}
                                  </span>{" "}
                                  {pluralize(card.wins, "attribute")},{" "}
                                  <span className="font-semibold text-red-500">loses</span>{" "}
                                  against{" "}
                                  <span className="font-semibold text-red-500">
                                    {card.losses}
                                  </span>{" "}
                                  {pluralize(card.losses, "attribute")} and ties against{" "}
                                  <span className="font-semibold text-muted-foreground">
                                    {card.ties}
                                  </span>{" "}
                                  {pluralize(card.ties, "attribute")}
                                </>
                              )}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
