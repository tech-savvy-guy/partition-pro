import React from "react";
import { Table, Col as Column } from "@/components/table/Table";
import {
  calculateExcludedSkus,
  calculateTotalSkus,
  generateRSquaredHistogram,
} from "@/lib/histogram/data-utils";
import type { HistogramBin } from "@/lib/histogram/types";
import { InputText } from "primereact/inputtext";
import "./Workflow.css";

type DistanceFunction = "chi" | "phi";

type Props = {
  workflowData: any;
};

const STRESS_VALUES = {
  "2D": { chi: 22.0, phi: 24.5 },
  "3D": { chi: 15.3, phi: 18.1 },
};

const R2_VALUES = {
  "2D": { chi: 73.0, phi: 68.8 },
  "3D": { chi: 82.2, phi: 77.6 },
};

const EXCLUDED_ROWS = [
  ["1", "JW-BL-750", "Diageo", "Johnnie Walker", "750ml", "Bottle", "1", "National", "40%", "Premium"],
  ["2", "JAM-700", "Pernod Ricard", "Jameson", "700ml", "Bottle", "1", "National", "40%", "Standard"],
  ["3", "MM-1000", "Beam Suntory", "Maker's Mark", "1000ml", "Bottle", "1", "Regional", "45%", "Premium"],
  ["4", "GL-12-700", "Diageo", "Glenfiddich", "700ml", "Bottle", "1", "National", "40%", "Super Premium"],
  ["5", "ABL-6PK", "AB InBev", "Corona", "330ml", "Can", "6", "National", "4.5%", "Standard"],
  ["6", "HNK-VS-700", "LVMH", "Hennessy", "700ml", "Bottle", "1", "National", "40%", "Premium"],
  ["7", "CAP-1L", "Campari Group", "Aperol", "1000ml", "Bottle", "1", "Regional", "11%", "Standard"],
  ["8", "BAC-WH-700", "Bacardi", "Bacardi", "700ml", "Bottle", "1", "National", "37.5%", "Standard"],
  ["9", "JD-1000", "Brown-Forman", "Jack Daniel's", "1000ml", "Bottle", "1", "National", "40%", "Standard"],
  ["10", "GRY-GS-700", "Bacardi", "Grey Goose", "700ml", "Bottle", "1", "National", "40%", "Super Premium"],
];

const EXCLUDED_FIELD_MAP = [
  { header: "ID", field: "id" },
  { header: "SKU Name", field: "skuName" },
  { header: "Manufacturer", field: "manufacturer" },
  { header: "Brand", field: "brand" },
  { header: "Pack Size", field: "packSize" },
  { header: "Pack Type", field: "packType" },
  { header: "Pack Count", field: "packCount" },
  { header: "Ownership", field: "ownership" },
  { header: "ABV", field: "abv" },
  { header: "Price Segment", field: "priceSegment" },
] as const;

const EXCLUDED_TABLE_ROWS = EXCLUDED_ROWS.map((row) => ({
  id: row[0],
  skuName: row[1],
  manufacturer: row[2],
  brand: row[3],
  packSize: row[4],
  packType: row[5],
  packCount: row[6],
  ownership: row[7],
  abv: row[8],
  priceSegment: row[9],
}));

function MdsToolbar({
  total,
  excluded,
  distance,
  threshold,
  onDistanceChange,
  onThresholdChange,
}: {
  total: number;
  excluded: number;
  distance: DistanceFunction;
  threshold: number;
  onDistanceChange: (distance: DistanceFunction) => void;
  onThresholdChange: (threshold: number) => void;
}) {
  return (
    <div className="mds-toolbar">
      <div className="mds-toolbar__inner">
      <div className="mds-toolbar__group">
        <div className="mds-stat-group">
          <div className="mds-stat">
            <span>Total SKUs</span>
            <strong>{total}</strong>
          </div>
          <div className="mds-stat">
            <span>Excluded</span>
            <strong>{excluded}</strong>
          </div>
        </div>

        <div className="mds-control-divider" />

        <div className="mds-distance">
          <span className="mds-distance__label">Distance</span>
          <button
            type="button"
            className={distance === "chi" ? "is-active" : ""}
            onClick={() => onDistanceChange("chi")}
          >
            Chi
          </button>
          <button
            type="button"
            className={distance === "phi" ? "is-active" : ""}
            onClick={() => onDistanceChange("phi")}
          >
            Phi
          </button>
        </div>

        <div className="mds-control-divider" />

        <label className="mds-r2-control">
          <span>R²</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={threshold}
            onChange={(event) => onThresholdChange(Number(event.target.value))}
          />
          <output>{threshold.toFixed(2)}</output>
        </label>
      </div>

      <div className="mds-optimal-inline">
        <span>Optimal stress<strong>&gt; 20%</strong></span>
        <span>Optimal R²<strong>&lt; 80%</strong></span>
      </div>
      </div>
    </div>
  );
}

function SectionTitle({
  id,
  children,
}: {
  id?: string;
  number?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mds-section-title">
      <h2 id={id}>{children}</h2>
    </div>
  );
}

function SummaryBarChart({
  metric,
  dimension,
}: {
  metric: "stress" | "r2";
  dimension: "2D" | "3D";
}) {
  const values = metric === "stress" ? STRESS_VALUES[dimension] : R2_VALUES[dimension];
  const max = metric === "stress" ? (dimension === "2D" ? 30 : 20) : 100;
  const ticks = metric === "stress" ? [0, max / 2, max] : [0, 50, 100];
  const colors = metric === "stress"
    ? { chi: dimension === "2D" ? "#dc1f1f" : "#e95800", phi: dimension === "2D" ? "#dc1f1f" : "#e95800" }
    : { chi: dimension === "2D" ? "#e95800" : "#37a34a", phi: dimension === "2D" ? "#dc1f1f" : "#e95800" };

  return (
    <div className="mds-summary-card">
      <svg viewBox="0 0 620 168" role="img" aria-label={`${dimension} ${metric} chart`}>
        <g className="mds-grid">
          {ticks.map((tick) => {
            const y = 126 - (tick / max) * 92;
            return (
              <g key={tick}>
                <line x1="84" x2="584" y1={y} y2={y} />
                <text x="76" y={y + 4} textAnchor="end">
                  {metric === "stress" ? `${tick}%` : `${tick}%`}
                </text>
              </g>
            );
          })}
          <line x1="84" x2="584" y1="126" y2="126" />
          <line x1="84" x2="84" y1="34" y2="126" />
        </g>
        {(["chi", "phi"] as DistanceFunction[]).map((name, index) => {
          const value = values[name];
          const height = (value / max) * 92;
          const x = index === 0 ? 110 : 360;
          return (
            <g key={name}>
              <rect x={x} y={126 - height} width="200" height={height} fill={colors[name]} />
              <text className="mds-value-label" x={x + 100} y={121 - height} textAnchor="middle">
                {value.toFixed(1)}%
              </text>
              <text x={x + 100} y="146" textAnchor="middle">
                {name === "chi" ? "Chi" : "Phi"}
              </text>
            </g>
          );
        })}
        <text className="mds-axis-label" x="334" y="166" textAnchor="middle">
          Distance function
        </text>
        <text className="mds-axis-label" transform="translate(28 86) rotate(-90)" textAnchor="middle">
          {metric === "stress" ? "Stress" : "R2"}
        </text>
      </svg>
      <span className="mds-card-dimension">{dimension}</span>
    </div>
  );
}

function Histogram({
  bins,
  threshold,
}: {
  bins: HistogramBin[];
  threshold: number;
}) {
  const maxCount = Math.max(16, ...bins.map((bin) => bin.count));
  let cumulative = 0;
  const cumulativeValues = bins.map((bin) => {
    cumulative += bin.count;
    return cumulative;
  });

  return (
    <div className="mds-histogram-card">
      <svg viewBox="0 0 1160 320" role="img" aria-label="R squared distribution">
        <g className="mds-grid">
          {[0, 4, 8, 12, 16].map((tick) => {
            const y = 248 - (tick / maxCount) * 210;
            return (
              <g key={tick}>
                <line x1="78" x2="1132" y1={y} y2={y} />
                <text x="66" y={y + 4} textAnchor="end">
                  {tick}
                </text>
              </g>
            );
          })}
          <line x1="78" x2="1132" y1="248" y2="248" />
          <line x1="78" x2="78" y1="38" y2="248" />
        </g>
        {bins.map((bin, index) => {
          const width = 52;
          const gap = 3;
          const x = 86 + index * (width + gap);
          const height = (bin.count / maxCount) * 210;
          const thresholdX = 86 + (threshold / 0.05) * (width + gap);
          return (
            <React.Fragment key={bin.bin}>
              <rect x={x} y={248 - height} width={width} height={height} fill="#c5cad4" />
              <text x={x + width / 2} y="278" textAnchor="middle">
                {bin.bin}
              </text>
              {index === 0 ? (
                <line className="mds-threshold-line" x1={thresholdX} x2={thresholdX} y1="38" y2="248" />
              ) : null}
            </React.Fragment>
          );
        })}
        <text className="mds-axis-label" x="604" y="312" textAnchor="middle">
          R-squared
        </text>
        <text className="mds-axis-label" transform="translate(22 142) rotate(-90)" textAnchor="middle">
          Number of SKUs
        </text>
      </svg>
      <div className="mds-cumulative-row">
        <span>Cumulative<br />SKUs</span>
        {cumulativeValues.map((value, index) => (
          <strong key={`${index}-${value}`}>{value}</strong>
        ))}
      </div>
    </div>
  );
}

const MDS_TABLE_COLUMN_CLASS: Partial<
  Record<(typeof EXCLUDED_FIELD_MAP)[number]["field"], { header?: string; body?: string }>
> = {
  id: { header: "col-mds-id", body: "col-mds-id" },
  skuName: { header: "col-mds-sku", body: "col-mds-sku" },
  packCount: { header: "col-mds-num", body: "col-mds-num" },
  abv: { header: "col-mds-num", body: "col-mds-num" },
};

function ExcludedTable() {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const totalRows = EXCLUDED_TABLE_ROWS.length;

  const tableHeader = (
    <div className="mds-excluded-table__toolbar">
      <p className="mds-excluded-table__meta">
        <strong>{totalRows}</strong> excluded SKU{totalRows === 1 ? "" : "s"} in preview
      </p>
      <label className="mds-excluded-table__search">
        <span>Search</span>
        <InputText
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Filter by name, brand, segment…"
          className="mds-excluded-table__search-input"
          aria-label="Search excluded SKUs"
        />
      </label>
    </div>
  );

  return (
    <div className="workflow-sku-selection-table-wrap mds-excluded-table">
      <Table
        value={EXCLUDED_TABLE_ROWS}
        dataKey="id"
        paginator
        rows={10}
        rowsPerPageOptions={[10, 25, 50]}
        alwaysShowPaginator={false}
        paginatorTemplate="CurrentPageReport RowsPerPageDropdown PrevPageLink PageLinks NextPageLink"
        currentPageReportTemplate="{first}–{last} of {totalRecords}"
        globalFilter={globalFilter}
        globalFilterFields={EXCLUDED_FIELD_MAP.map((c) => c.field)}
        header={tableHeader}
        emptyMessage="No excluded SKUs match your search."
        responsiveLayout="scroll"
        scrollable
        scrollHeight="400px"
        className="mds-excluded-table-datatable"
      >
        {EXCLUDED_FIELD_MAP.map(({ header, field }) => {
          const colClass = MDS_TABLE_COLUMN_CLASS[field];
          return (
            <Column
              key={field}
              field={field}
              header={header}
              headerClassName={colClass?.header}
              bodyClassName={colClass?.body}
              body={(row: (typeof EXCLUDED_TABLE_ROWS)[number]) => {
                const value = row[field];
                const text = value == null ? "" : String(value);
                return (
                  <span className="mds-excluded-cell" title={text}>
                    {text}
                  </span>
                );
              }}
            />
          );
        })}
      </Table>
    </div>
  );
}

export default function MultiDimensionalScaling({ workflowData }: Props) {
  const [distance, setDistance] = React.useState<DistanceFunction>("chi");
  const [threshold, setThreshold] = React.useState(0.27);

  const bins = React.useMemo(() => {
    const raw =
      workflowData?.data?.mds?.r_squared_distribution ??
      workflowData?.data?.steps?.mds?.result?.r_squared_distribution ??
      null;

    if (Array.isArray(raw)) return raw as HistogramBin[];
    return generateRSquaredHistogram(distance, "2D");
  }, [distance, workflowData]);

  const total = calculateTotalSkus(bins);
  const excluded = calculateExcludedSkus(bins, threshold);

  return (
    <div className="workflow-mds">
      <MdsToolbar
        total={total}
        excluded={excluded}
        distance={distance}
        threshold={threshold}
        onDistanceChange={setDistance}
        onThresholdChange={setThreshold}
      />

      <div className="mds-content">
        <div className="mds-content__inner">
          <section className="mds-section" aria-labelledby="mds-section-stress">
            <SectionTitle id="mds-section-stress">Overall stress &amp; R² values</SectionTitle>
            <div className="mds-summary-grid">
              <SummaryBarChart metric="stress" dimension="2D" />
              <SummaryBarChart metric="r2" dimension="2D" />
              <SummaryBarChart metric="stress" dimension="3D" />
              <SummaryBarChart metric="r2" dimension="3D" />
            </div>
          </section>

          <section className="mds-section" aria-labelledby="mds-section-distribution">
            <SectionTitle id="mds-section-distribution">Distribution of R² values</SectionTitle>
            <Histogram bins={bins} threshold={threshold} />
          </section>

          <section className="mds-section" aria-labelledby="mds-section-excluded">
            <SectionTitle id="mds-section-excluded">
              Excluded SKUs for selected distance function and dimension
            </SectionTitle>
            <ExcludedTable />
          </section>
        </div>
      </div>
    </div>
  );
}
