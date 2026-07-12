import * as React from "react";
import { Dialog } from "primereact/dialog";
import { Table, Col as Column } from "@/components/table/Table";
import "@/components/table/Table.css";
import {
  Form,
  TextInput,
  Select,
  SelectItem,
  Button,
} from "@bain/design-system";
import { FileRow } from "./CaseFileDetails";
import { BackendPartition, Case, PartitionApi } from "@/core/api";
import { useParams } from "react-router-dom";

export type ECMModalRow = {
  id: string;
  file: string;
  dataType: string;
  version: number | string;
  description: string;
  uploadedBy?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;

  caseName: string;
  onCaseNameChange: (v: string) => void;

  selection: FileRow[];
  onSelectionChange: (rows: FileRow[]) => void;

  rows: ECMModalRow[];
  onSubmit: (payload: {
    caseName: string;
    finalAnswer: string;
    selectedIds: string[];
  }) => void;
};

export default function CaseManagementModal({
  open,
  onClose,
  caseName,
  onCaseNameChange,
  rows,
  onSubmit,
  selection,
  onSelectionChange,
}: Props) {
  const [finalPartitionId, setFinalPartitionId] = React.useState<string | null>(
    null,
  );
  const [partitions, setPartitions] = React.useState<BackendPartition[]>([]);
  const { id } = useParams<{ id: string }>();

  React.useEffect(() => {
    if (!id) return;

    PartitionApi.getPartitionByCaseId(id).then((res) => {
      setPartitions(res.partitions ?? []);
    });
  }, [id]);

  const selectedPartition = React.useMemo(
    () => partitions.find((p) => p.id === finalPartitionId),
    [partitions, finalPartitionId],
  );

  const isPartitionOpen = selectedPartition?.status === "ACTIVE";

  return (
    <Dialog
      header="Close Case"
      visible={open}
      modal
      onHide={onClose}
      className="
        close-case-dialog
        w-[92vw] max-w-[920px] rounded-xl
        [&_.p-dialog-header]:!bg-gray-50 [&_.p-dialog-header]:!border-0
        [&_.p-dialog-content]:!bg-gray-50 [&_.p-dialog-content]:!border-0
      "
      contentClassName="!pt-5 !pb-6 !px-6"
      maskClassName="backdrop-blur-[2px] bg-black/30"
    >
      <Form aria-label="close-case" className="space-y-4">
        {/* Top fields */}
        <div className="grid grid-cols-1 gap-4">
          <TextInput
            id="close-name"
            labelText="*Case Name"
            disabled
            value={caseName}
            onChange={(e: any) => onCaseNameChange(e.target.value)}
            placeholder="US - Sun"
            required
          />
          <Select
            id="close-final-answer"
            labelText="Final Partition Answer"
            value={finalPartitionId ?? ""}
            onChange={(e: any) =>
              setFinalPartitionId(e?.target?.value ?? e?.value ?? null)
            }
            required
            invalid={Boolean(isPartitionOpen)}
            invalidText="Close this partition first to close this case."
          >
            <SelectItem value="" text="Select a partition" />
            {partitions.map((p) => (
              <SelectItem key={p.id} value={p.id} text={p.partition_name} />
            ))}
          </Select>
        </div>

        {/* Files table inside modal */}
        <div className="mt-2">
          <Table<ECMModalRow[]>
            value={rows}
            dataKey="id"
            showGridlines
            selection={selection as any}
            onSelectionChange={(e: any) => {
              const val = Array.isArray(e.value)
                ? (e.value as FileRow[])
                : [e.value as FileRow];
              onSelectionChange(val);
            }}
            className="app-table rounded-md cases-header-grey"
          >
            <Column
              selectionMode="multiple"
              headerClassName="col-checkbox"
              bodyClassName="col-checkbox"
            />
            <Column field="file" header="File" sortable />
            <Column field="dataType" header="Data Type" sortable />
            <Column field="version" header="Version" sortable />
            <Column field="description" header="Description" sortable />
          </Table>
        </div>

        {/* Modal submit button (centered) */}
        <div className="flex justify-center pt-2">
          <Button
            kind="primary"
            disabled={!finalPartitionId || isPartitionOpen}
            onClick={() => {
              if (!finalPartitionId || isPartitionOpen) return;
              onSubmit({
                caseName,
                finalAnswer: finalPartitionId!,
                selectedIds: selection.map((r) => r.id),
              });
            }}
          >
            Submit
          </Button>
        </div>
      </Form>
    </Dialog>
  );
}
