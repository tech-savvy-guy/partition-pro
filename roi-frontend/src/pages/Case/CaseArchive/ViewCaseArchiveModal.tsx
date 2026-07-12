import * as React from "react";
import { Dialog } from "primereact/dialog";
import { useNavigate } from "react-router-dom";
import { Table, Col as Column } from "@/components/table/Table";
import "@/components/table/Table.css";
import { CaseApi } from "@/core/api";

/** ------------ Types ------------- */
export type ArchivedCaseModalData = {
  id: string; // case id for routing
  caseName: string;
  caseCode?: string;
  createdBy: string;
  start: string;
  lastUpdated: string;
  description: string;

  // optional richer details
  billingCaseCode?: string;
  requestedBy?: string;
  npsContact?: string;
  productType?: string;
  caseMembers?: string[];

  // new
  finalPartitionAnswer?: string;
};

export type FileRow = {
  id: string;
  file: string;
  uploadedBy: string;
  dataType: "Point of Sales" | "Attribute Sheet" | "Cross Purchase" | "";
  version: number | string;
  description: string;
};

/** ------------ Small UI bits ------------- */
const DEFAULT_MEMBERS = ["Sajeev Yadav", "Shivam Shukla", "Shrey Pandey"];

function Field({
  label,
  value,
  colSpan = 1,
}: {
  label: string;
  value: React.ReactNode;
  colSpan?: 1 | 2;
}) {
  return (
    <div className={colSpan === 2 ? "col-span-2" : ""}>
      <div className="text-gray-500 text-[13px] leading-5">{label}</div>
      <div className="text-gray-900 text-[15px] leading-6 mt-[2px]">
        {value}
      </div>
    </div>
  );
}

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-gray-300 px-3 py-1 text-[12px] text-gray-700">
    {children}
  </span>
);

/** ------------ Component ------------- */
type Props = {
  open: boolean;
  onClose: () => void;
  data: ArchivedCaseModalData | null;
};

export default function ArchivedCasesViewModal({ open, onClose, data }: Props) {
  const [files, setFiles] = React.useState<FileRow[]>([]);
  const [loadingFiles, setLoadingFiles] = React.useState(false);

  React.useEffect(() => {
    if (!open || !data?.id) return;

    let active = true;
    setLoadingFiles(true);

    (async () => {
      try {
        const res = await CaseApi.getDatasets(data.id);

        if (!active) return;

        const mapDataType = (dt: string) => {
          if (dt === "POS") return "Point of Sales";
          if (dt === "ATTRIBUTES") return "Attribute Sheet";
          if (dt === "CROSSPURCHASE") return "Cross Purchase";
          return "";
        };

        setFiles(
          (res.datasets ?? []).map((d: any) => ({
            id: d.id,
            file: d.file_name,
            uploadedBy: d.created_by,
            dataType: mapDataType(d.data_type),
            version: d.version,
            description: d.status ?? "-",
          })),
        );
      } catch (e) {
        console.error("Failed to load datasets", e);
        setFiles([]);
      } finally {
        if (active) setLoadingFiles(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, data?.id]);

  const navigate = useNavigate();
  if (!data) return null;

  const members =
    data.caseMembers && data.caseMembers.length > 0
      ? data.caseMembers
      : DEFAULT_MEMBERS;

  const goToViewFile = (r: FileRow) => {
    // route: /cases/:id/files/:fileId/view?name=<readable filename>
    navigate(
      `/cases/${data.id}/files/${encodeURIComponent(
        r.id,
      )}/view?name=${encodeURIComponent(r.file)}`,
    );
  };

  const detailBody = (r: FileRow) => (
    <div className="flex items-center justify-center">
      <button
        type="button"
        className="view-btn inline-flex items-center px-2 py-1 text-[13px] text-red-700 hover:underline focus:underline"
        onClick={() => goToViewFile(r)}
      >
        View
      </button>
    </div>
  );

  return (
    <Dialog
      visible={open}
      modal
      onHide={onClose}
      header={
        <span className="text-[20px] leading-7 font-semibold">
          Case Details
        </span>
      }
      /* styling to match your Case Management dialog */
      className="
        w-[90vw] max-w-[900px] max-h-[90vh] rounded-xl flex flex-col
        [&_.p-dialog-header]:!bg-gray-50 [&_.p-dialog-header]:!px-6 [&_.p-dialog-header]:!py-3 [&_.p-dialog-header]:!border-0
        [&_.p-dialog-content]:!bg-gray-50 [&_.p-dialog-content]:!border-0
      "
      contentClassName="!pt-5 !pb-6 !px-6 flex flex-col overflow-hidden"
      maskClassName="backdrop-blur-[2px] bg-black/20"
    >
      {/* === Top: 2-col details grid === */}
      <div className="mx-auto grid grid-cols-2 gap-x-12 gap-y-6 flex-shrink-0">
        <Field label="Case Name" value={data.caseName} />
        <Field
          label="Requested by"
          value={data.requestedBy ?? data.createdBy ?? "—"}
        />

        <Field label="Billing Case Code" value={data.caseCode ?? "—"} />
        <Field label="NPS Contact" value={data.npsContact ?? "—"} />

        <Field label="Case Manager" value={data.createdBy} />
        <Field label="Product Type" value={data.productType ?? "CP BBA"} />

        <Field
          label="Case Members"
          value={
            members.length ? (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <Chip key={m}>{m}</Chip>
                ))}
              </div>
            ) : (
              <span className="text-gray-500">—</span>
            )
          }
        />

        <Field
          label="Final Partition Answer"
          value={data.finalPartitionAnswer ?? "Blah blah blah"}
        />
      </div>

      {/* Divider */}
      <div className="my-6 h-px bg-gray-200 flex-shrink-0" />

      {/* === Files table (scrollable) === */}
      <div className="mb-2 text-[15px] font-semibold text-gray-900 flex-shrink-0">Files</div>
      <div className="flex-1 overflow-auto min-h-0">
        <Table<FileRow[]>
          value={files}
          dataKey="id"
          showGridlines
          paginator={false}
          rows={files.length}
          responsiveLayout="scroll"
          loading={loadingFiles}
          className="app-table rounded-md cases-header-grey"
        >
          <Column field="file" header="File" />
          <Column field="uploadedBy" header="Uploaded by" />
          <Column field="dataType" header="Data Type" />
          <Column field="version" header="Version" />
          <Column field="description" header="Description" />
          <Column
            header="Detail"
            body={detailBody}
            headerClassName="col-details"
            bodyClassName="col-details"
          />
        </Table>
      </div>
    </Dialog>
  );
}
