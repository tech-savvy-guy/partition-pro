import * as React from "react";
import { Table, Col as Column } from "@/components/table/Table";
import {
  ButtonSet,
  Button,
  Form,
  TextInput,
  Select,
  SelectItem,
  Tag,
  Accordion,
  AccordionItem,
} from "@bain/design-system";
import { useNavigate, useParams } from "react-router-dom";
import "@/components/table/Table.css";

type CaseStatus = "Active" | "Closed";

export type FileRow = {
  id: string;
  file: string;
  uploadedBy: string;
  dataType: "Point of Sales" | "Attribute Sheet" | "Cross Purchase" | "Sample";
  version: number | string;
  description: string;
};

export default function CaseManagementBody({
  mode,
  rows,
  caseName,
  onCaseNameChange,
  status,
  onStatusChange,
  onSubmit,
  onCancel,
  onUpdate,
}: {
  mode: "create" | "edit";
  rows: FileRow[];
  caseName: string;
  onCaseNameChange: (v: string) => void;
  status: CaseStatus;
  onStatusChange: (v: CaseStatus) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onUpdate?: () => void;
}) {
  const [selected, setSelected] = React.useState<FileRow[]>([]);
  const navigate = useNavigate();
  const { id: caseId } = useParams<{ id: string }>();
  const isEdit = mode === "edit" && !!caseId;

  // -------- File uploads state (Cross / PoS / Attribute) ----------
  const fileInputRefs = {
    cross: React.useRef<HTMLInputElement>(null),
    pos: React.useRef<HTMLInputElement>(null),
    attr: React.useRef<HTMLInputElement>(null),
  };

  const [files, setFiles] = React.useState({
    cross: [] as string[],
    pos: [] as string[],
    attr: [] as string[],
  });

  const pickFile = (key: keyof typeof files) =>
    fileInputRefs[key].current?.click();

  const onFileChange = (
    key: keyof typeof files,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const names = Array.from(e.target.files ?? []).map((f) => f.name);
    setFiles((prev) => ({ ...prev, [key]: [...prev[key], ...names] }));
    e.target.value = "";
  };

  const removeFile = (key: keyof typeof files, name: string) =>
    setFiles((prev) => ({
      ...prev,
      [key]: prev[key].filter((n) => n !== name),
    }));

  // -------- Members state ----------
  const ALL_MEMBERS = [
    "Sajeev Yadav",
    "Shivam Shukla",
    "Shrey Pandey",
    "Rajat Dhiman",
    "Elli",
    "Lorem",
    "Anita Sharma",
    "Akhil Verma",
    "Neha Kapoor",
    "Rahul Jain",
  ];

  const [memberInput, setMemberInput] = React.useState("");
  const [members, setMembers] = React.useState<string[]>([]);
  const [openSuggest, setOpenSuggest] = React.useState(false);

  const suggestions = React.useMemo(() => {
    const q = memberInput.trim().toLowerCase();
    if (!q) return [];
    return ALL_MEMBERS.filter(
      (n) => n.toLowerCase().startsWith(q) && !members.includes(n),
    ).slice(0, 8);
  }, [memberInput, members]);

  const addMember = (name: string) => {
    const v = name.trim();
    if (!v) return;
    if (!members.includes(v)) setMembers((prev) => [...prev, v]);
    setMemberInput("");
    setOpenSuggest(false);
  };

  const removeMemberChip = (name: string) =>
    setMembers((prev) => prev.filter((n) => n !== name));

  // -------- Table "View" navigation ----------
  const goToViewFile = (r: FileRow) => {
    if (!isEdit) return; // no view route in create mode
    navigate(
      `/cases/${caseId}/files/${encodeURIComponent(
        r.id,
      )}/view?name=${encodeURIComponent(r.file)}`,
    );
  };

  const detailBody = (r: FileRow) =>
    isEdit ? (
      <button
        type="button"
        className="view-btn inline-flex items-center px-2 py-1 text-[13px] text-red-700 hover:underline focus:underline"
        onClick={() => goToViewFile(r)}
      >
        View
      </button>
    ) : null;

  return (
    <div className="mt-4">
      <Accordion>
        {/* ============ 1. CASE DETAILS ACCORDION ============ */}
        <AccordionItem title="Case Details">
          <div className="mt-2 rounded-md bg-white p-6 shadow-sm">
            <Form aria-label="case-form">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                <div className="md:col-span-2 -mt-2">
                  <TextInput
                    id="ec-name"
                    labelText="*Case Name"
                    value={caseName}
                    onChange={(e: any) => onCaseNameChange(e.target.value)}
                    placeholder="US - Sun - Refresh"
                    required
                  />
                </div>

                <div className="space-y-6">
                  <TextInput
                    id="ec-billing"
                    labelText="*Billing Case Code"
                    placeholder="X6VG"
                    required
                  />

                  <TextInput
                    id="ec-manager"
                    labelText="*Case Manager"
                    placeholder="Lorem"
                    required
                  />

                  <Select
                    id="ec-status"
                    labelText="Case Status"
                    value={status}
                    onChange={(e: any) =>
                      onStatusChange(
                        (e?.target?.value ?? e?.value) as CaseStatus,
                      )
                    }
                  >
                    <SelectItem value="Active" text="Active" />
                    <SelectItem value="Closed" text="Closed" />
                  </Select>
                </div>

                <div className="space-y-6">
                  <TextInput
                    id="ec-requested"
                    labelText="*Requested by"
                    placeholder="Lorem"
                    required
                  />

                  <TextInput
                    id="ec-nps"
                    labelText="*NPS Contact"
                    placeholder="Elli"
                    required
                  />

                  <TextInput
                    id="ec-product"
                    labelText="Product Type"
                    placeholder="CP BBA"
                    disabled
                  />
                </div>
              </div>

              {/* Buttons for Create / Update / Cancel */}
              <div className="mt-6 flex justify-end">
                <ButtonSet>
                  <Button kind="secondary" size="sm" onClick={onCancel}>
                    Cancel
                  </Button>
                  {isEdit ? (
                    <Button kind="primary" size="sm" onClick={onUpdate}>
                      Update
                    </Button>
                  ) : (
                    <Button kind="primary" size="sm" onClick={onSubmit}>
                      Create
                    </Button>
                  )}
                </ButtonSet>
              </div>
            </Form>
          </div>
        </AccordionItem>

        {/* ============ 2. CASE FILE DETAILS ACCORDION ============ */}
        <AccordionItem title="Case File Details">
          <div className="mt-2 rounded-md bg-white p-6 shadow-sm space-y-6">
            {/* Upload sections */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {(["cross", "pos", "attr"] as const).map((key) => (
                <section key={key}>
                  <div className="text-[14px] font-medium text-gray-800 capitalize">
                    {key === "cross"
                      ? "Cross - Purchase"
                      : key === "pos"
                        ? "Point Of Sales (PoS)"
                        : "Attribute Sheet"}
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-gray-600">
                    Max file size is {`{X}`}kb.
                    <br />
                    Supported file types are .csv
                  </p>

                  <div className="mt-3">
                    <input
                      ref={fileInputRefs[key]}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => onFileChange(key, e)}
                    />
                    <Button
                      kind="primary"
                      size="md"
                      disabled={!isEdit && key !== "attr"} // keep whatever logic you had
                      onClick={() => pickFile(key)}
                    >
                      Upload
                    </Button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {files[key].map((name) => (
                      <div
                        key={name}
                        className="flex items-center justify-between rounded bg-gray-100 px-3 py-2 text-[14px]"
                      >
                        <span className="truncate">{name}</span>
                        <button
                          type="button"
                          className="ml-3 text-gray-500 hover:text-gray-700"
                          onClick={() => removeFile(key, name)}
                          aria-label={`Remove ${name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Files table */}
            <div className="mt-4">
              <Table<FileRow[]>
                value={rows}
                dataKey="id"
                showGridlines
                paginator
                rows={100}
                rowsPerPageOptions={[10, 25, 50, 100]}
                paginatorTemplate=" FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
                currentPageReportTemplate="{first} - {last} of {totalRecords} items"
                selection={selected as any}
                onSelectionChange={(e: any) => {
                  const val = Array.isArray(e.value)
                    ? (e.value as FileRow[])
                    : [e.value as FileRow];
                  setSelected(val);
                }}
                responsiveLayout="scroll"
                className="app-table rounded-md cases-header-grey edit-paginator"
              >
                <Column
                  selectionMode="multiple"
                  headerClassName="col-checkbox"
                  bodyClassName="col-checkbox"
                />

                <Column field="file" header="File" sortable />
                <Column field="uploadedBy" header="Uploaded by" sortable />
                <Column field="dataType" header="Data Type" sortable />
                <Column field="version" header="Version" sortable />
                <Column field="description" header="Description" sortable />
                {isEdit && (
                  <Column
                    header="Detail"
                    body={detailBody}
                    headerClassName="col-details"
                    bodyClassName="col-details"
                  />
                )}
              </Table>
            </div>
          </div>
        </AccordionItem>

        {/* ============ 3. ADD MEMBERS ACCORDION ============ */}
        <AccordionItem title="Add Members">
          <div className="mt-2 rounded-md bg-white p-6 shadow-sm">
            <div className="mt-2">
              <label
                htmlFor="members-input"
                className="block text-[13px] text-gray-600 mb-1"
              >
                Members
              </label>

              <div className="flex gap-3 flex-wrap items-start">
                <div className="relative flex-1 min-w-[220px]">
                  <TextInput
                    id="members-input"
                    hideLabel
                    labelText="Members"
                    placeholder="Type a member's name"
                    value={memberInput}
                    onChange={(e: any) => setMemberInput(e.target.value)}
                    onFocus={() => setOpenSuggest(true)}
                    onBlur={() => setTimeout(() => setOpenSuggest(false), 150)}
                    onKeyDown={(e: any) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addMember(memberInput);
                      }
                    }}
                  />

                  {openSuggest && suggestions.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-gray-200 bg-white shadow-sm">
                      {suggestions.map((name) => (
                        <li
                          key={name}
                          className="cursor-pointer px-3 py-2 hover:bg-gray-50"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addMember(name)}
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Button
                  kind="primary"
                  size="md"
                  onClick={() => addMember(memberInput)}
                >
                  Add
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {members.map((name) => (
                  <Tag
                    key={name}
                    filter
                    type="gray"
                    title="Remove"
                    onClose={() => removeMemberChip(name)}
                  >
                    {name}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
