// src/features/workflow/BaseTesting/BaseTestingResult.tsx
import * as React from "react";
import "../partition-tree.css";
import { DataGrid } from "../components/data-grid";
import { Merge } from "../icons";

/** ===== Types ===== */

export type BaseTestingItem = {
  attribute: string;
  attribute_id: number | string;
  base_result: boolean | string;
  n_total: number;
  columns: any[];
  rows: any[];
};

export type BaseTestingSummary = {
  columns: string[];
  rows: any[][];
};

export type BaseTestingRow = {
  id: string;
  sNo: number;
  attribute: string;
  testingResult: string;
  wtdAverageRoi: string;
  comments: string;
};

type Props = {
  /**  NEW summary payload from backend */
  summary?: BaseTestingSummary | null;

  /** Existing items (used for right-side detailed view) */
  items: BaseTestingItem[];

  selectedAttributeId: string | null;
  onSelectAttribute: (id: string) => void;
  onOpenMerge: (id: string) => void;
};

/** ===== Component ===== */
function resultBadgeStyle(v: string) {
  const val = String(v).toUpperCase();

  if (val === "TRUE") {
    return "bg-green-100 text-green-800";
  }
  if (val === "FALSE") {
    return "bg-red-100 text-red-800";
  }
  if (val === "ONLY_ONE_COMBINATION") {
    return "bg-gray-200 text-gray-700";
  }
  return "bg-transparent text-gray-900";
}

const testingResultPriority: Record<string, number> = {
  true: 0,
  false: 1,
  only_one_combination: 2,
};

export default function BaseTestingResult({
  summary,
  selectedAttributeId,
  onSelectAttribute,
  onOpenMerge,
}: Props) {
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollHeight, setScrollHeight] = React.useState<string>("400px");

  React.useEffect(() => {
    const updateScrollHeight = () => {
      if (tableContainerRef.current) {
        const height = tableContainerRef.current.clientHeight;
        if (height > 0) {
          setScrollHeight(`${height}px`);
        }
      }
    };

    updateScrollHeight();
    const resizeObserver = new ResizeObserver(updateScrollHeight);
    if (tableContainerRef.current) {
      resizeObserver.observe(tableContainerRef.current);
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(updateScrollHeight);
    });

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, []);

  const rows: BaseTestingRow[] = React.useMemo(() => {
    if (!Array.isArray(summary?.rows)) return [];

    const mapped = summary.rows.map((r, idx) => {
      const roiRaw = r?.[4];
      const roiNum = Number(roiRaw);
      const roiStr =
        roiRaw == null || !Number.isFinite(roiNum) ? "-" : roiNum.toFixed(2);

      return {
        id: String(r?.[0] ?? idx),
        sNo: Number(r?.[1] ?? idx + 1),
        attribute: String(r?.[2] ?? ""),
        testingResult: String(r?.[3] ?? ""),
        wtdAverageRoi: roiStr,
        comments: String(r?.[5] ?? ""),
      };
    });

    return mapped.sort((a, b) => {
      // ===== Primary sort: testingResult =====
      const aKey = a.testingResult.toLowerCase();
      const bKey = b.testingResult.toLowerCase();

      const aRank = testingResultPriority[aKey] ?? 99;
      const bRank = testingResultPriority[bKey] ?? 99;

      if (aRank !== bRank) {
        return aRank - bRank;
      }

      // ===== Secondary sort: wtdAverageRoi =====
      const aRoi = Number(a.wtdAverageRoi);
      const bRoi = Number(b.wtdAverageRoi);

      const aValid = !Number.isNaN(aRoi);
      const bValid = !Number.isNaN(bRoi);

      // Push invalid / "-" ROI to the bottom
      if (aValid && bValid) {
        return bRoi - aRoi; // DESCENDING ROI
      }
      if (aValid) return -1;
      if (bValid) return 1;

      return 0;
    });

  }, [summary?.rows]);

  return (
    <div className="p-4 h-full flex flex-col min-h-0">
      <div ref={tableContainerRef} className="flex-1 min-h-0">
        <DataGrid<BaseTestingRow>
          rows={rows}
          rowKey={(row) => row.id}
          showGridlines={false}
          className="app-table rounded-md cases-header-grey cases-paginator-right"
          emptyMessage="No base testing results."
          scrollable
          scrollHeight={scrollHeight}
          onRowClick={(row) => onSelectAttribute(row.id)}
          rowClassName={(row) =>
            row.id === selectedAttributeId ? "selected-row" : ""
          }
          columns={[
            // Override S. No. to be a 1-based index
            { key: "no", header: "No.", cell: (_row, index) => index + 1 },
            {
              key: "attribute",
              field: "attribute",
              header: "Attribute",
              cell: (row) => (
                <span className="text-[13px] text-[var(--button-primary,#C8102E)] font-medium">
                  {row.attribute}
                </span>
              ),
            },
            {
              key: "testingResult",
              header: "Testing Result",
              cell: (row) => (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${resultBadgeStyle(
                    row.testingResult,
                  )}`}
                >
                  {row.testingResult}
                </span>
              ),
            },
            {
              key: "wtdAverageRoi",
              field: "wtdAverageRoi",
              header: "Wtd Average ROI",
            },
            {
              key: "rollUp",
              header: "Roll Up",
              headerStyle: { width: "108px" },
              cellClassName: "col-center",
              cell: (row) => (
                <button
                  type="button"
                  title="Merge / Roll Up sub-attributes"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenMerge(row.id);
                  }}
                >
                  <Merge size={13} />
                </button>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
