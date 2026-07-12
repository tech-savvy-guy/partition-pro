import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Loading } from "@bain/design-system";
import { Table, Col as Column } from "@/components/table/Table";
import CaseManagementDialog from "./CaseManagementDialog";
import { CaseApi } from "@/core/api";
import { DatasetUploadErrorResponse } from "@/core/api/case/case.types";
import { useCasePermissions } from "@/core/case/CasePermissionContext";
import { Permission } from "@/core/rbac";
import { useUI } from "@/core/ui";
import { Download, Renew, View, Warning } from "@carbon/icons-react";
import { Tag as DsTag } from "@bain/design-system";
import { UploadErrorDisplay } from "./UploadErrorDisplay";

export type FileRow = {
  id: string;
  file: string;
  uploadedBy: string;
  dataType: "Point of Sales" | "Attribute Sheet" | "Cross Purchase" | "Sample";
  version: number | string;
  description: string;
  isSelected?: boolean;
  isRefreshing?: boolean;
  tags?: {
    columns_order?: Record<string, string[]>;
    error_message?: string;
  };
};

type Props = {
  mode: "create" | "edit";
  rows: FileRow[];
  caseId?: string | null;

  selection: FileRow[];
  onSelectionChange: (rows: FileRow[]) => void;

  onRefreshDatasets?: () => Promise<void>;

  uploadDisabled: boolean;
};

const targetToDataType = {
  cross: "CROSSPURCHASE",
  pos: "POS",
  attr: "ATTRIBUTES",
} as const;

const mapDataType = (dt: string) => {
  if (dt === "POS") return "Point of Sales";
  if (dt === "ATTRIBUTES") return "Attribute Sheet";
  if (dt === "CROSSPURCHASE") return "Cross Purchase";
  return "Sample";
};

type UploadTarget = keyof typeof targetToDataType;

export default function CaseFileDetails({
  mode,
  rows,
  caseId,
  onRefreshDatasets,
  selection,
  onSelectionChange,
  uploadDisabled,
}: Props) {
  type TagType = "green" | "red" | "gray";

  const navigate = useNavigate();
  const { id: paramCaseId } = useParams<{ id: string }>();

  const resolvedCaseId = caseId ?? paramCaseId ?? null;
  const isEdit = mode === "edit" && !!resolvedCaseId;
  const hasUserInteractedRef = React.useRef(false);

  const [uploadTarget, setUploadTarget] = React.useState<UploadTarget | null>(
    null,
  );
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const [uploadError, setUploadError] = React.useState<DatasetUploadErrorResponse | null>(null);
  const [simpleErrorMessage, setSimpleErrorMessage] = React.useState<string | null>(null);
  const modalFileInputRef = React.useRef<HTMLInputElement>(null);

  const debounceRef = React.useRef<number | null>(null);

  const { permissions, hasCaseContext } = useCasePermissions();
  const canEditCase =
    !hasCaseContext || permissions.includes(Permission.EditCases);
  const canShowDetails = !!resolvedCaseId;

  const statusToTagType = (s: string): TagType =>
    s === "Ready" ? "green" : s === "Processing" ? "gray" : "red";

  const { showToast } = useUI();

  const syncSelectionToBackend = React.useCallback(
    (selected: FileRow[]) => {
      if (uploadDisabled) return;
      if (!resolvedCaseId || selected.length === 0) return;

      const datasetIds = selected.map((r) => r.id);

      CaseApi.selectDatasets(resolvedCaseId, datasetIds).catch((err) => {
        console.error("Failed to sync dataset selection:", err);
      });
    },
    [resolvedCaseId],
  );

  React.useEffect(() => {
    if (!isEdit || !resolvedCaseId) return;

    if (!hasUserInteractedRef.current) return;

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      syncSelectionToBackend(selection);
    }, 500);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [selection, syncSelectionToBackend, isEdit, resolvedCaseId]);

  // chip list (optional UI)
  const [files, setFiles] = React.useState({
    cross: [] as string[],
    pos: [] as string[],
    attr: [] as string[],
  });

  const removeFile = (key: UploadTarget, name: string) =>
    setFiles((prev) => ({
      ...prev,
      [key]: prev[key].filter((n) => n !== name),
    }));

  const goToViewFile = (r: FileRow) => {
    if (!resolvedCaseId) return;
    navigate(
      `/cases/${resolvedCaseId}/files/${encodeURIComponent(
        r.id,
      )}/view?name=${encodeURIComponent(r.file)}`,
    );
  };

  const hasRowError = (r: FileRow) => {
    const normalizedStatus = (r.description ?? "").toLowerCase();
    return (
      !!r.tags?.error_message ||
      normalizedStatus.includes("fail") ||
      normalizedStatus.includes("error")
    );
  };

  const triggerBrowserDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadFile = async (r: FileRow) => {
    if (!resolvedCaseId) return;

    try {
      const response = await CaseApi.viewDataset(resolvedCaseId, r.id);
      const fileResponse = await fetch(response.file_url);

      if (!fileResponse.ok) {
        throw new Error(`Download request failed (${fileResponse.status})`);
      }

      const blob = await fileResponse.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      try {
        triggerBrowserDownload(objectUrl, r.file);
      } finally {
        window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch (error) {
      console.error("Download failed:", error);
      showToast({
        variant: "error",
        message: `Failed to download ${r.file}.`,
        duration: 5000,
      });
    }
  };

  const openUploadModal = (key: UploadTarget) => {
    if (uploadDisabled) {
      setSimpleErrorMessage("Activate the case to upload files.");
      return;
    }

    if (!resolvedCaseId) {
      setSimpleErrorMessage("Create the case first before uploading.");
      return;
    }

    setUploadTarget(key);
    setPendingFile(null);
    setUploadError(null);
    setSimpleErrorMessage(null);
    setIsUploading(false);
    setUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    if (isUploading) return;
    setUploadModalOpen(false);
    setUploadTarget(null);
    setPendingFile(null);
    setUploadError(null);
    setSimpleErrorMessage(null);
  };

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) {
      setPendingFile(file);
      setUploadError(null);
      setSimpleErrorMessage(null);
    }
  };

  const handleDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
  };

  const handleConfirmUpload = async () => {
    if (!resolvedCaseId) {
      setSimpleErrorMessage("Create the case first before uploading.");
      return;
    }

    if (!uploadTarget || !pendingFile) return;

    const dataType = targetToDataType[uploadTarget];

    // mark this upload as started
    setUploadStatus((prev) => ({
      ...prev,
      [uploadTarget]: "uploading",
    }));

    setUploadMessage((prev) => ({
      ...prev,
      [uploadTarget]: "Uploading file…",
    }));

    try {
      setIsUploading(true);
      setUploadError(null);
      setSimpleErrorMessage(null);

      // 1) request upload URL
      const urlRes = await CaseApi.getDatasetUploadUrl(
        resolvedCaseId,
        dataType,
        pendingFile.name,
      );

      // 2) upload to blob storage
      await CaseApi.uploadToBlob(urlRes.upload_url, pendingFile);

      // 3) confirm upload with backend
      await CaseApi.confirmDatasetUpload(resolvedCaseId, dataType, {
        file_name: pendingFile.name,
        blob_name: urlRes.blob_name,
        version: urlRes.version,
        description: "",
        file_size: pendingFile.size,
      });

      // 4) refresh datasets table
      if (onRefreshDatasets) {
        await onRefreshDatasets();
      }

      // update UI chips (optional)
      setFiles((prev) => ({
        ...prev,
        [uploadTarget]: [...prev[uploadTarget], pendingFile.name],
      }));

      // success state
      setUploadStatus((prev) => ({
        ...prev,
        [uploadTarget]: "success",
      }));

      setUploadMessage((prev) => ({
        ...prev,
        [uploadTarget]: "Upload completed successfully",
      }));

      showToast({
        variant: "success",
        message: `${mapDataType(dataType)} data added successfully.`,
        duration: 4000,
      });
      // close modal
      closeUploadModal();

      // reset success state after short delay
      window.setTimeout(() => {
        setUploadStatus((prev) => ({
          ...prev,
          [uploadTarget]: "idle",
        }));
        setUploadMessage((prev) => ({
          ...prev,
          [uploadTarget]: null,
        }));
      }, 3000);
    } catch (err: any) {
      console.error("Upload failed:", err);

      setUploadStatus((prev) => ({
        ...prev,
        [uploadTarget]: "error",
      }));

      // Try to parse structured error response first
      const errorData = err?.response?.data as DatasetUploadErrorResponse | undefined;
      
      if (errorData && (errorData.tags?.error_message || errorData.detail)) {
        // This is a structured error response from the backend
        setUploadError(errorData);
        setUploadMessage((prev) => ({
          ...prev,
          [uploadTarget]: "Upload failed - see error details below",
        }));
      } else {
        // Fallback to simple error message
        const message = err?.message ?? "Upload failed. Please try again.";
        setSimpleErrorMessage(message);
        setUploadMessage((prev) => ({
          ...prev,
          [uploadTarget]: message,
        }));
      }
    } finally {
      setIsUploading(false);
    }
  };

  type UploadStatus = "idle" | "uploading" | "success" | "error";

  const [uploadStatus, setUploadStatus] = React.useState<
    Record<UploadTarget, UploadStatus>
  >({
    cross: "idle",
    pos: "idle",
    attr: "idle",
  });

  const [errorDetailsOpen, setErrorDetailsOpen] = React.useState(false);
  const [selectedErrorRow, setSelectedErrorRow] = React.useState<FileRow | null>(null);

  const openErrorDetails = (row: FileRow) => {
    setSelectedErrorRow(row);
    setErrorDetailsOpen(true);
  };

  const closeErrorDetails = () => {
    setErrorDetailsOpen(false);
    setSelectedErrorRow(null);
  };

  const [uploadMessage, setUploadMessage] = React.useState<
    Record<UploadTarget, string | null>
  >({
    cross: null,
    pos: null,
    attr: null,
  });

  const actionBody = (r: FileRow) =>
    canShowDetails ? (
      <div className="flex gap-3 whitespace-nowrap">
        {!hasRowError(r) && (
          <button
            type="button"
            title="View file"
            aria-label="View file"
            className="view-btn inline-flex rounded p-1 text-red-700 hover:bg-red-50"
            onClick={() => goToViewFile(r)}
          >
            <View size={14} />
          </button>
        )}
        <button
          type="button"
          title="Download file"
          aria-label="Download file"
          className="inline-flex rounded p-1 text-red-700 hover:bg-red-50"
          onClick={() => void downloadFile(r)}
        >
          <Download size={14} />
        </button>
        {hasRowError(r) && (
          <button
            type="button"
            title={
              r.tags?.error_message
                ? "View error details"
                : "This file has an error"
            }
            aria-label={
              r.tags?.error_message
                ? "View error details"
                : "This file has an error"
            }
            onClick={() => {
              if (!r.tags?.error_message) return;
              openErrorDetails(r);
            }}
            className={`inline-flex items-center rounded p-1 text-red-600 ${
              r.tags?.error_message
                ? "hover:bg-red-50"
                : "cursor-default opacity-70"
            }`}
          >
            <Warning size={14} />
          </button>
        )}
      </div>
    ) : null;

  const handleModalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPendingFile(file);
    setUploadError(null);
    setSimpleErrorMessage(null);
    e.target.value = "";
  };

  const descriptionBody = (r: FileRow) => (
    <div className="flex items-center gap-2">
      {r.isRefreshing && (
        <span className="h-3 w-3 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin" />
      )}

      <DsTag
        type={statusToTagType(r.description)}
        className="whitespace-nowrap"
      >
        {r.description}
      </DsTag>

      {r.description !== "Ready" && (
        <button
          type="button"
          title="Refresh dataset"
          onClick={refreshSingleDataset}
          className="ml-1 text-gray-500 hover:text-gray-800"
        >
          <Renew size={14} />
        </button>
      )}
    </div>
  );

  const refreshSingleDataset = async () => {
    if (!onRefreshDatasets) return;
    await onRefreshDatasets();
  };

  return (
    <div className="mt-2 rounded-md bg-white p-6 shadow-sm space-y-6">
      {/* Upload blocks */}
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
              Max file size is {"{X}"}kb.
              <br />
              Supported file types are .csv
            </p>

            <div className="mt-3">
              <Button
                kind="primary"
                size="md"
                disabled={
                  !resolvedCaseId ||
                  uploadDisabled ||
                  uploadStatus[key] === "uploading" ||
                  !canEditCase
                }
                onClick={() => {
                  if (uploadDisabled || uploadStatus[key] === "uploading")
                    return;
                  openUploadModal(key);
                }}
              >
                {uploadStatus[key] === "uploading" ? (
                  <span className="flex items-center gap-2">
                    <Loading withOverlay={false} small />
                    Uploading…
                  </span>
                ) : (
                  "Upload"
                )}
              </Button>
            </div>
            {uploadStatus[key] === "uploading" && (
              <div className="mt-2 text-[12px] text-blue-600">
                Uploading file…
              </div>
            )}

            {uploadStatus[key] === "success" && (
              <div className="mt-2 text-[12px] text-green-600">
                Upload completed successfully
              </div>
            )}

            {uploadStatus[key] === "error" && uploadMessage[key] && (
              <div className="mt-2 text-[12px] text-red-600">
                {uploadMessage[key]}
              </div>
            )}

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
          selection={selection as any}
          onSelectionChange={(e: any) => {
            if (uploadDisabled || !canEditCase) return;

            hasUserInteractedRef.current = true;

            const incoming = Array.isArray(e.value)
              ? (e.value as FileRow[])
              : [e.value as FileRow];

            const byType = new Map<string, FileRow>();
            for (const row of incoming) {
              byType.set(row.dataType, row);
            }

            onSelectionChange(Array.from(byType.values()));
          }}
          responsiveLayout="scroll"
          isDataSelectable={() => canEditCase}
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
          <Column
            field="description"
            header="Description"
            body={descriptionBody}
            sortable
          />

          {canShowDetails && (
            <Column
              header="Action"
              body={actionBody}
              headerClassName="col-details"
              bodyClassName="col-details"
              headerStyle={{ width: "8rem" }}
              bodyStyle={{ width: "8rem", whiteSpace: "nowrap" }}
            />
          )}
          {Object.values(uploadStatus).includes("uploading") && (
            <div className="mb-3 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-[13px] text-blue-700">
              File upload in progress. Please wait until it completes.
            </div>
          )}
        </Table>
      </div>

      {/* Upload modal */}
      <CaseManagementDialog
        open={uploadModalOpen}
        onClose={closeUploadModal}
        title={
          uploadTarget
            ? `Upload ${
                uploadTarget === "cross"
                  ? "Cross - Purchase"
                  : uploadTarget === "pos"
                    ? "Point Of Sales (PoS)"
                    : "Attribute Sheet"
              } file`
            : "Upload file"
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] text-gray-600">
            Max file size is {"{X}"}kb. Supported file types are .csv.
          </p>

          {simpleErrorMessage && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {simpleErrorMessage}
            </div>
          )}

          <UploadErrorDisplay error={uploadError} />

          <div
            className={`border border-dashed rounded-md bg-white px-4 py-8 text-center ${
              uploadDisabled
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:border-gray-500"
            }`}
            onClick={() => {
              if (uploadDisabled) return;
              modalFileInputRef.current?.click();
            }}
            onDrop={(e) => {
              if (uploadDisabled) return;
              handleDrop(e);
            }}
            onDragOver={(e) => {
              if (uploadDisabled) return;
              handleDragOver(e);
            }}
          >
            <p className="text-[14px] text-red-700">
              Drag and drop file here or click to upload
            </p>
            <input
              ref={modalFileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleModalFileChange}
            />
          </div>

          {pendingFile && (
            <div className="rounded bg-gray-100 px-3 py-2 text-[14px] flex items-center justify-between">
              <span className="truncate">{pendingFile.name}</span>
              {!isUploading && (
                <button
                  type="button"
                  className="ml-3 text-gray-500 hover:text-gray-700"
                  onClick={() => setPendingFile(null)}
                >
                  ×
                </button>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="h-[24px] flex items-center">
              {isUploading && (
                <div className="scale-50 origin-center">
                  <Loading withOverlay={false} />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                kind="secondary"
                size="sm"
                disabled={isUploading}
                onClick={closeUploadModal}
              >
                Cancel
              </Button>
              <Button
                kind="primary"
                size="sm"
                disabled={!pendingFile || isUploading || uploadDisabled}
                onClick={handleConfirmUpload}
              >
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </div>
      </CaseManagementDialog>

      {/* Error Details Modal */}
      <CaseManagementDialog
        open={errorDetailsOpen}
        onClose={closeErrorDetails}
        title={`Error Details - ${selectedErrorRow?.file || "Dataset"}`}
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <UploadErrorDisplay 
            error={selectedErrorRow?.tags ? {
              tags: selectedErrorRow.tags,
              detail: selectedErrorRow.tags.error_message
            } : null}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            kind="secondary"
            size="sm"
            onClick={closeErrorDetails}
          >
            Close
          </Button>
        </div>
      </CaseManagementDialog>
    </div>
  );
}
