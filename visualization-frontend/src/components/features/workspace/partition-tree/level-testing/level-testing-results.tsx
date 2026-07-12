import { DataGrid, type DataGridColumn } from "../components/data-grid";

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

const columns: DataGridColumn<LevelTestingRow>[] = [
  { key: "rank", field: "rank", header: "Rank" },
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
  { key: "winTimes", field: "winTimes", header: "Win Times" },
  { key: "lossTimes", field: "lossTimes", header: "Loss Times" },
  { key: "tieTimes", field: "tieTimes", header: "Tie Times" },
  { key: "valid", field: "valid", header: "Valid" },
  { key: "comments", field: "comments", header: "Comments" },
];

export default function LevelTestingResults({
  rows,
  selectedAttributeId,
  onSelectAttribute,
}: Props) {
  const selectedKeys =
    selectedAttributeId != null
      ? new Set([String(selectedAttributeId)])
      : new Set<string>();

  return (
    <div className="p-4">
      <DataGrid<LevelTestingRow>
        rows={rows}
        columns={columns}
        rowKey={(row) => String(row.id)}
        showGridlines
        paginate
        pageSize={15}
        pageSizeOptions={[15, 25, 50, 100]}
        className="app-table rounded-md cases-header-grey cases-paginator-right level-testing-table"
        emptyMessage="No level testing results."
        selectionMode="single"
        selectedKeys={selectedKeys}
        selectionHeaderClassName="col-checkbox"
        selectionCellClassName="col-checkbox"
        onSelectionChange={(_keys, selectedRows) => {
          const val = selectedRows[0] ?? null;
          onSelectAttribute(val ? String(val.id) : null);
        }}
      />
    </div>
  );
}
