import * as React from "react";
import {
  DataGrid,
  type DataGridColumn,
  type DataGridHeaderCell,
} from "../../../components/data-grid";
import "../../../partition-tree.css";
import type { LevelTestingPair } from "../../index";

type Props = {
  pair: LevelTestingPair;
};

type ResultRow = {
  id: string;
  skuCount: string;
  l1Value: string;
  l2Value: string;
  l1Roi: string;
  l2Roi: string;
  winner: string;
};

function fmtRoi(v: any) {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

export default function LevelTestingResult({ pair }: Props) {
  const L1 = String(pair?.L1 ?? "L1");
  const L2 = String(pair?.L2 ?? "L2");

  const cols: string[] = Array.isArray(pair?.results?.columns)
    ? pair.results!.columns!.map((c) => String(c))
    : [];

  const rowsRaw: any[] = Array.isArray(pair?.results?.rows)
    ? (pair.results!.rows as any[])
    : [];

  const idx = (name: string, fallback: number) => {
    const i = cols.indexOf(name);
    return i >= 0 ? i : fallback;
  };

  const iL1 = idx("L1_value", 0);
  const iL2 = idx("L2_value", 1);
  const iSku = idx("sku_count", 2);
  const iL1Roi = idx("L1_wtd_avg_roi", 3);
  const iL2Roi = idx("L2_wtd_avg_roi", 4);
  const iWinner = idx("winner", 5);

  const parsedRows: ResultRow[] = React.useMemo(() => {
    return rowsRaw.map((r, k) => ({
      id: String(k),
      skuCount: String(r?.[iSku] ?? ""),
      l1Value: String(r?.[iL1] ?? ""),
      l2Value: String(r?.[iL2] ?? ""),
      l1Roi: fmtRoi(r?.[iL1Roi]),
      l2Roi: fmtRoi(r?.[iL2Roi]),
      winner: String(r?.[iWinner] ?? ""),
    }));
  }, [rowsRaw, iSku, iL1, iL2, iL1Roi, iL2Roi, iWinner]);

  const headerGroups: DataGridHeaderCell[][] = [
    [
      { content: "ATTRIBUTE", colSpan: 3 },
      { content: "WEIGHTED AVERAGE ROI", colSpan: 3 },
    ],
    [
      { content: "#SKUS" },
      { content: L1 },
      { content: L2 },
      { content: L1 },
      { content: L2 },
      { content: "Winner" },
    ],
  ];

  const columns: DataGridColumn<ResultRow>[] = [
    { key: "skuCount", field: "skuCount" },
    { key: "l1Value", field: "l1Value" },
    { key: "l2Value", field: "l2Value" },
    { key: "l1Roi", field: "l1Roi" },
    { key: "l2Roi", field: "l2Roi" },
    { key: "winner", field: "winner" },
  ];

  return (
    <div className="mt-3 px-4">
      <DataGrid<ResultRow>
        rows={parsedRows}
        columns={columns}
        rowKey={(row) => row.id}
        showGridlines
        headerGroups={headerGroups}
        className="app-table rounded-md cases-header-grey level-testing-result-table"
      />
    </div>
  );
}
