import { Table, Col as Column } from "@/components/table/Table";

export type LevelTestingRow = {
  id: string; // attribute name
  rank: number;
  attribute: string;
  winTimes: number | string;
  lossTimes: number | string;
  tieTimes: number | string;
  valid: string;
  comments: string;
};

type Props = {
  rows: LevelTestingRow[];
  selectedAttributeId: string | null;
  onSelectAttribute: (id: string | null) => void;
  readOnly?: boolean;
};

export default function LevelTestingResults({
  rows,
  selectedAttributeId,
  onSelectAttribute,
  readOnly = false, // keep prop if you want, but don't use it to block selection
}: Props) {
  const selectedRow =
    rows.find((r) => String(r.id) === String(selectedAttributeId)) ?? null;

  return (
    <div className="p-4">
      <Table<LevelTestingRow[]>
        value={rows}
        dataKey="id"
        showGridlines
        paginator
        rows={15}
        rowsPerPageOptions={[15, 25, 50, 100]}
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
        currentPageReportTemplate="{first} - {last} of {totalRecords} items"
        responsiveLayout="scroll"
        className="app-table rounded-md cases-header-grey cases-paginator-right level-testing-table"
        emptyMessage="No level testing results."
        selection={selectedRow as any}
        onSelectionChange={(e: any) => {
          const val = (e.value ?? null) as LevelTestingRow | null;
          onSelectAttribute(val ? String(val.id) : null);
        }}
      >
        {/* Radio selection column */}
        <Column
          selectionMode="single"
          headerClassName="col-checkbox"
          bodyClassName="col-checkbox"
        />

        <Column field="rank" header="Rank" />

        <Column
          field="attribute"
          header="Attribute"
          body={(row: LevelTestingRow) => (
            <span className="text-[13px] text-[var(--button-primary,#C8102E)] font-medium">
              {row.attribute}
            </span>
          )}
        />

        <Column field="winTimes" header="Win Times" />
        <Column field="lossTimes" header="Loss Times" />
        <Column field="tieTimes" header="Tie Times" />
        <Column field="valid" header="Valid" />
        <Column field="comments" header="Comments" />
      </Table>
    </div>
  );
}
