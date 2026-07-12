import React from "react";
import { Table, Col as Column } from "@/components/table/Table";
import "@/components/table/Table.css";

type Status = "none" | "error" | "warning" | "ok";

type PosSplitRow = Record<string, any>;

type CoverageDetail = {
  pos_sales_split?: PosSplitRow[];
  pos_sales_split_panel?: PosSplitRow[];
  pos_sales_split_custom?: PosSplitRow[];
};

type CoverageItem = {
  id: number | string;
  attribute: string;
  details: CoverageDetail[];
};

/**
 * Backward-compatible props:
 * - If you still render <CompareCoverage selectedIds={...} />, it won't crash.
 * - Preferred: <CompareCoverage coverage={...} />
 */
type Props = {
  coverage?: CoverageItem[];
  overallCoverage?: any; // overall_coverage blob from backend
};

function StatusDot({
  status,
  className = "",
}: {
  status: Status;
  className?: string;
}) {
  const cls =
    status === "error"
      ? "bg-red-600"
      : status === "warning"
        ? "bg-amber-500"
        : status === "ok"
          ? "bg-green-500"
          : "bg-gray-300";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${cls} ${className}`}
      aria-hidden="true"
    />
  );
}

function Chevron({
  open,
  className = "",
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""} ${className}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
    </svg>
  );
}

// Optional: simple status based on worst coverage % in the "all" split.
// Adjust thresholds if your lead wants different cutoffs.
function computeStatus(item: CoverageItem): Status {
  const d = item?.details?.[0] ?? {};
  const rows = (d.pos_sales_split ?? []) as any[];
  const vals: number[] = [];

  for (const r of rows) {
    const v1 = Number(r?.value_coverage);
    const v2 = Number(r?.volume_coverage);
    if (Number.isFinite(v1)) vals.push(v1);
    if (Number.isFinite(v2)) vals.push(v2);
  }

  if (!vals.length) return "none";
  const min = Math.min(...vals);

  if (min < 80) return "error";
  if (min < 95) return "warning";
  return "ok";
}

const HEADER_MAP: Record<string, string> = {
  sub_attribute: "Attribute Value",
  skus_number: "#SKUs",

  value_share: "Value% Share",
  volume_share: "Volume% Share",

  pos_value: "PoS Value",
  pos_volume: "PoS Volume",

  pos_value_covered: "PoS Value Covered%",
  pos_volume_covered: "PoS Volume Covered%",

  value_coverage: "Value% Share",
  volume_coverage: "Volume% Share",
};

const PREFERRED_ORDER = [
  "sub_attribute",
  "skus_number",
  "pos_value",
  "pos_volume",
  "value_coverage",
  "volume_coverage",
];

function orderCols(keys: string[]) {
  const s = new Set(keys);
  const out: string[] = [];
  PREFERRED_ORDER.forEach((k) => s.has(k) && out.push(k));
  keys.forEach((k) => !out.includes(k) && out.push(k));
  return out;
}

function formatCell(key: string, v: any) {
  if (v == null) return "";

  const num = typeof v === "number" ? v : Number(v);

  // % columns → rounded integer + %
  if (
    key === "value_coverage" ||
    key === "volume_coverage" ||
    key === "value_share" ||
    key === "volume_share"
  ) {
    return Number.isFinite(num) ? `${Math.round(num)}` : "";
  }

  // PoS Value / Volume / Covered → rounded integer with commas
  if (
    key === "pos_value" ||
    key === "pos_volume" ||
    key === "pos_value_covered" ||
    key === "pos_volume_covered"
  ) {
    return Number.isFinite(num) ? Math.round(num).toLocaleString() : "";
  }

  // #SKUs
  if (key === "skus_number") {
    return Number.isFinite(num) ? Math.round(num).toLocaleString() : "";
  }

  // Attribute label
  if (key === "sub_attribute" && (v === null || v === "")) {
    return "Overall";
  }

  return String(v);
}

function CoverageTableBlock({
  title,
  rows,
  preferredOrder,
}: {
  title: string;
  rows: any[];
  preferredOrder?: string[];
}) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const cols = React.useMemo(() => {
    const keys = new Set<string>();
    safeRows.forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(k)));

    const all = Array.from(keys);

    if (preferredOrder?.length) {
      const set = new Set(all);
      return [
        ...preferredOrder.filter((k) => set.has(k)),
        ...all.filter((k) => !preferredOrder.includes(k)),
      ];
    }

    return orderCols(all);
  }, [safeRows, preferredOrder]);

  const tableRows = safeRows.map((r, i) => ({
    __rowKey: String(i),
    ...(r || {}),
  }));

  return (
    <div className="border border-gray-200 rounded-md mb-4">
      <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 text-[13px] font-semibold text-gray-700">
        {title}
      </div>

      <div className="p-3">
        {safeRows.length === 0 ? (
          <div className="text-sm text-gray-600">No data available.</div>
        ) : (
          <Table<any>
            value={tableRows}
            dataKey="__rowKey"
            showGridlines
            rows={tableRows.length}
            className="app-table rounded-md cases-header-grey"
          >
            {cols.map((k) => (
              <Column
                key={k}
                header={HEADER_MAP[k] ?? k}
                body={(row: any) => formatCell(k, row?.[k])}
              />
            ))}
          </Table>
        )}
      </div>
    </div>
  );
}
function OverallCoverageBlock({ overall }: { overall: any }) {
  const [open, setOpen] = React.useState(true);

  // open it automatically once data arrives
  React.useEffect(() => {
    if (overall) setOpen(true);
  }, [overall]);

  if (!overall) return null;

  const total = overall.total_pos ?? {};
  const allPanel = overall.all_panel_skus ?? {};
  const current = overall.current_selection ?? {};

  const fmtPct = (v: any) =>
    typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(2)}%` : "-";

  const fmtInt = (v: any) =>
    typeof v === "number" && Number.isFinite(v)
      ? v.toLocaleString()
      : String(v ?? "-");

  const fmtNum2 = (v: any) =>
    typeof v === "number" && Number.isFinite(v)
      ? v.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : String(v ?? "-");

  // ---------- 1) Current selection ----------
  const currentRow = {
    __rowKey: "0",
    min_n: current.min_n_cutoff_selected ?? "-",
    skus: current.skus ?? "-",
    client_skus: current.client_skus ?? "-",
    pos_value: current.pos_coverage_value_pct,
    pos_volume: current.pos_coverage_volume_pct,
    client_value: current.client_coverage_value_pct,
    client_volume: current.client_coverage_volume_pct,
    zeroes: current.percent_zeroes ?? "-",
  };

  // ---------- 2) All panel ----------
  const panelRow = {
    __rowKey: "0",
    min_n: allPanel.min_n ?? "-",
    skus: allPanel.skus ?? "-",
    client_skus: allPanel.client_skus ?? "-",
    pos_value: allPanel.pos_coverage_value_pct,
    pos_volume: allPanel.pos_coverage_volume_pct,
    client_value: allPanel.client_coverage_value_pct,
    client_volume: allPanel.client_coverage_volume_pct,
    zeroes: allPanel.percent_zeroes ?? "-",
  };

  // ---------- 3) Total PoS ----------
  const totalRow = {
    __rowKey: "0",
    skus: total.skus ?? "-",
    client_skus: total.client_skus ?? "-",
    value: total.value,
    volume: total.volume,
  };

  function Block({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="mb-4">
        <div className="bg-white border border-gray-200 px-3 py-2 text-[13px] font-semibold text-gray-700">
          {title}
        </div>
        <div className="border border-gray-200 border-t-0 bg-white px-3 py-3">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-1 rounded-md border border-gray-500 bg-gray-50 overflow-hidden">
      {/* Accordion header */}
      <button
        type="button"
        className="group w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-100 hover:bg-[#cfbfc2] hover:text-white"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-medium text-gray-700 group-hover:text-white">
          Overall
        </span>
        <Chevron open={open} className="group-hover:text-white" />
      </button>

      {/* Accordion body */}
      {open && (
        <div className="px-3 pb-4 pt-3 bg-white">
          <Block title="Current N Selection - PoS Coverage">
            <Table<any>
              value={[currentRow]}
              dataKey="__rowKey"
              showGridlines
              rows={1}
              className="app-table rounded-md cases-header-grey"
            >
              <Column
                field="min_n"
                header="Min N Cutoff Selected"
                body={(r: any) => fmtInt(r.min_n)}
              />
              <Column
                field="skus"
                header="#SKUs"
                body={(r: any) => fmtInt(r.skus)}
              />
              <Column
                field="client_skus"
                header="#Client SKUs"
                body={(r: any) => fmtInt(r.client_skus)}
              />
              <Column
                header="PoS Coverage% Value"
                body={(r: any) => fmtPct(r.pos_value)}
              />
              <Column
                header="PoS Coverage% Volume"
                body={(r: any) => fmtPct(r.pos_volume)}
              />
              <Column
                header="Client Coverage% in PoS - Value"
                body={(r: any) => fmtPct(r.client_value)}
              />
              <Column
                header="Client Coverage% in PoS - Volume"
                body={(r: any) => fmtPct(r.client_volume)}
              />
              <Column
                field="zeroes"
                header="% of Zeroes"
                body={(r: any) => String(fmtPct(r.zeroes ?? "-"))}
              />
            </Table>
          </Block>

          <Block title="All Panel SKUs - PoS Coverage">
            <Table<any>
              value={[panelRow]}
              dataKey="__rowKey"
              showGridlines
              rows={1}
              className="app-table rounded-md cases-header-grey"
            >
              <Column
                field="min_n"
                header="Min N"
                body={(r: any) => fmtInt(r.min_n)}
              />
              <Column
                field="skus"
                header="#SKUs"
                body={(r: any) => fmtInt(r.skus)}
              />
              <Column
                field="client_skus"
                header="#Client SKUs"
                body={(r: any) => fmtInt(r.client_skus)}
              />
              <Column
                header="PoS Coverage% Value"
                body={(r: any) => fmtPct(r.pos_value)}
              />
              <Column
                header="PoS Coverage% Volume"
                body={(r: any) => fmtPct(r.pos_volume)}
              />
              <Column
                header="Client Coverage% in PoS - Value"
                body={(r: any) => fmtPct(r.client_value)}
              />
              <Column
                header="Client Coverage% in PoS - Volume"
                body={(r: any) => fmtPct(r.client_volume)}
              />
              <Column
                field="zeroes"
                header="% of Zeroes"
                body={(r: any) => String(fmtPct(r.zeroes ?? "-"))}
              />
            </Table>
          </Block>

          <Block title="Total PoS">
            <Table<any>
              value={[totalRow]}
              dataKey="__rowKey"
              showGridlines
              rows={1}
              className="app-table rounded-md cases-header-grey"
            >
              <Column
                field="skus"
                header="#SKUs"
                body={(r: any) => fmtInt(r.skus)}
              />
              <Column
                field="client_skus"
                header="#Client SKUs"
                body={(r: any) => fmtInt(r.client_skus)}
              />
              <Column header="Value" body={(r: any) => fmtNum2(r.value)} />
              <Column header="Volume" body={(r: any) => fmtNum2(r.volume)} />
            </Table>
          </Block>
        </div>
      )}
    </div>
  );
}

export default function CompareCoverage({
  coverage = [],
  overallCoverage,
}: Props) {
  const sections = React.useMemo(() => {
    const arr = Array.isArray(coverage) ? coverage : [];

    // keep Overall on top if backend sends it
    const overall = arr.find(
      (x) => String(x.attribute).toLowerCase() === "overall",
    );
    const rest = arr.filter((x) => x !== overall);
    const ordered = overall ? [overall, ...rest] : arr;

    return ordered.map((x) => ({
      id: String(x.id ?? x.attribute),
      label: String(x.attribute ?? "Unknown"),
      item: x,
      status: computeStatus(x),
    }));
  }, [coverage]);

  const [openById, setOpenById] = React.useState<Record<string, boolean>>({});

  return (
    <div className="mt-3">
      <div className="border border-gray-200 rounded-md bg-white">
        {/* Overall FIRST (accordion style like figma) */}
        <OverallCoverageBlock overall={overallCoverage} />

        {/* Attributes list next */}
        {sections.length === 0 ? (
          !overallCoverage ? (
            <div className="p-4 text-sm text-gray-600">
              No compare coverage data yet.
            </div>
          ) : null
        ) : sections.length === 0 ? (
          !overallCoverage ? (
            <div className="p-4 text-sm text-gray-600">
              No compare coverage data yet.
            </div>
          ) : null
        ) : (
          sections.map((sec) => {
            const open = !!openById[sec.id];

            const detail = sec.item?.details?.[0] ?? {};
            const customRows = (detail.pos_sales_split_custom ?? []) as any[];
            const panelRows = (detail.pos_sales_split_panel ?? []) as any[];
            const allRows = (detail.pos_sales_split ?? []) as any[];

            return (
              <div
                key={sec.id}
                className="mb-1 rounded-md border border-gray-500 bg-gray-50 overflow-hidden"
              >
                <button
                  type="button"
                  className="group w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-100 hover:bg-[#cfbfc2] hover:text-white"
                  onClick={() =>
                    setOpenById((prev) => ({
                      ...prev,
                      [sec.id]: !prev[sec.id],
                    }))
                  }
                  aria-expanded={open}
                  aria-controls={`panel-${sec.id}`}
                >
                  <span className="font-medium text-gray-700 group-hover:text-white">
                    {sec.label}
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusDot
                      status={sec.status}
                      className="group-hover:ring-2 group-hover:ring-white/70"
                    />
                    <Chevron open={open} className="group-hover:text-white" />
                  </span>
                </button>

                {open && (
                  <div id={`panel-${sec.id}`} className="px-3 pb-4 pt-3">
                    <CoverageTableBlock
                      title={`PoS Sales Split for ${sec.label} in Panel based on Custom Selection`}
                      rows={customRows}
                    />
                    <CoverageTableBlock
                      title={`PoS Sales Split for ${sec.label} in Panel`}
                      rows={panelRows}
                    />
                    <CoverageTableBlock
                      title={`PoS Sales Split for ${sec.label}`}
                      rows={allRows}
                      preferredOrder={[
                        "sub_attribute",
                        "skus_number",
                        "value_share",
                        "volume_share",
                        "pos_value",
                        "pos_volume",
                      ]}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
