import * as React from "react";
import { Table, Col as Column } from "@/components/table/Table";
import "@/components/table/Table.css";
import { ColumnGroup } from "primereact/columngroup";
import { Row } from "primereact/row";
import type { LevelTestingPair } from "../../Index";

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

  const headerGroup = (
    <ColumnGroup>
      <Row>
        <Column header="ATTRIBUTE" colSpan={3} />
        <Column header="WEIGHTED AVERAGE ROI" colSpan={3} />
      </Row>
      <Row>
        <Column header="#SKUS" />
        <Column header={L1} />
        <Column header={L2} />
        <Column header={L1} />
        <Column header={L2} />
        <Column header="Winner" />
      </Row>
    </ColumnGroup>
  );

  return (
    <div className="mt-3 px-4">
      <Table<ResultRow[]>
        value={parsedRows}
        dataKey="id"
        showGridlines
        headerColumnGroup={headerGroup}
        responsiveLayout="scroll"
        className="app-table rounded-md cases-header-grey level-testing-result-table"
      >
        <Column field="skuCount" />
        <Column field="l1Value" />
        <Column field="l2Value" />
        <Column field="l1Roi" />
        <Column field="l2Roi" />
        <Column field="winner" />
      </Table>
    </div>
  );
}
