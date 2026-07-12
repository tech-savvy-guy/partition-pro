import React, { useState, useEffect } from "react";
import { Warning, View, Close, Download } from "@carbon/icons-react";
import LoaderIcon from "@/components/icons/LoaderIcon";
import { useParams } from "react-router-dom";
import { Button } from "@bain/design-system";
import { PartitionApi } from "@/core/api/partition/partition.api";
import type {
  PartitionDatasetDataType,
  PartitionDatasetUploadErrorResponse,
} from "@/core/api/partition/partition.types";
import { useUI } from "@/core/ui/ui.context";
import { Table, Col } from "@/components/table/Table";
import { UploadErrorDisplay } from "@/pages/Case/CaseManagement/CaseManagementHelper/UploadErrorDisplay";

type UploadStatus = "idle" | "uploading" | "success" | "error";
type InitStatus = "checking" | "ready";

type Dataset = {
  id: string;
  data_type: string;
  file_name: string;
  file_size: string;
  blob_name: string;
  is_selected: boolean;
  status: string;
  version: number;
  created_on: string;
  created_by: string;
  description: string;
};

type PartitionDatasetsResponse = {
  success: boolean;
  case_id: string;
  partition_id: string;
  partition_name: string;
  datasets: Dataset[];
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const validateFile = (file: File): { valid: boolean; error?: string } => {
  if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
    return { valid: false, error: "Only CSV files are allowed" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size must be less than 5 MB (your file is ${(file.size / 1024 / 1024).toFixed(2)} MB)` };
  }
  return { valid: true };
};

type Props = {
  onClose?: () => void;
};

export default function AttributeRollUp({ onClose }: Props) {
  const { caseId, partitionId } = useParams<{ caseId: string; partitionId: string }>();
  const { showToast } = useUI();

  // ── Datasets state ─────────────────────────────────────────────────────
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  // ── Init check on mount ────────────────────────────────────────────────
  const [initStatus, setInitStatus] = useState<InitStatus>("checking");
  const [initWarning, setInitWarning] = useState<string | null>(null);
  const [initViewUrl, setInitViewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId || !partitionId) { setInitStatus("ready"); return; }
    const dataType: PartitionDatasetDataType = "GROUPING";
    PartitionApi.getDatasetUploadUrl(caseId, partitionId, dataType, "rollup-sheet.csv")
      .then((res) => {
        setInitWarning(res.warning ?? null);
        setInitViewUrl(res.view_url ?? null);
      })
      .catch(() => { /* fail silently — user can still upload */ })
      .finally(() => setInitStatus("ready"));
  }, [caseId, partitionId]);

  // ── Fetch partition datasets on mount ─────────────────────────────────
  useEffect(() => {
    const fetchPartitionDatasets = async () => {
      if (caseId && partitionId) {
        try {
          const response: PartitionDatasetsResponse = await PartitionApi.getPartitionDatasets(caseId, partitionId);
          if (response.datasets) {
            setDatasets(response.datasets);
          }
        } catch (error) {
          console.error('Failed to fetch partition datasets:', error);
        }
      }
    };
    
    fetchPartitionDatasets();
  }, [caseId, partitionId]);

  // ── Upload state ───────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] =
    useState<PartitionDatasetUploadErrorResponse | null>(null);
  const dragCounter = React.useRef(0);

  const applyFile = (file: File) => {
    const validation = validateFile(file);
    if (validation.valid) {
      setSelectedFile(file);
      setUploadStatus("idle");
      setErrorMessage(null);
      setUploadError(null);
    } else {
      setErrorMessage(validation.error ?? null);
      setUploadError(null);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // reset so the same file can be re-selected after removal
    event.target.value = "";
    if (file) applyFile(file);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !caseId || !partitionId) return;
    setUploadStatus("uploading");
    setErrorMessage(null);
    setUploadError(null);
    const dataType: PartitionDatasetDataType = "GROUPING";
    try {
      // Step 1: Get pre-signed upload URL with the actual filename
      const { upload_url, blob_name, version } = await PartitionApi.getDatasetUploadUrl(
        caseId, partitionId, dataType, selectedFile.name
      );
      // Step 2: Upload directly to Azure Blob Storage
      await PartitionApi.uploadToBlob(upload_url, selectedFile);
      // Step 3: Confirm with backend
      const confirmResponse = await PartitionApi.confirmDatasetUpload(caseId, partitionId, dataType, {
        blob_name,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        version,
      });

      if (!confirmResponse.success) {
        setUploadStatus("error");
        setUploadError({
          error: confirmResponse.error ?? confirmResponse.message ?? "Upload failed.",
          detail: confirmResponse.error ?? confirmResponse.message,
          hint: confirmResponse.hint,
        });
        setErrorMessage("Upload failed - see error details below");
        return;
      }

      setUploadStatus("success");
      showToast({ variant: "success", message: "Grouping data uploaded successfully.", duration: 4000 });
      onClose?.();
    } catch (err: any) {
      setUploadStatus("error");
      const errorData = err?.response?.data as
        | PartitionDatasetUploadErrorResponse
        | undefined;

      if (errorData && (errorData.tags?.error_message || errorData.detail || errorData.error || errorData.hint)) {
        setUploadError(errorData);
        setErrorMessage("Upload failed - see error details below");
      } else {
        setUploadError(null);
        setErrorMessage(err?.message ?? "Upload failed. Please try again.");
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadStatus("idle");
    setErrorMessage(null);
    setUploadError(null);
  };

  const handleDownload = async (datasetId: string, fileName: string) => {
    if (!caseId || !partitionId) return;
    
    try {
      const response = await PartitionApi.downloadDataset(caseId, partitionId, datasetId);
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = response.file_url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast({ variant: "success", message: "File download started.", duration: 3000 });
    } catch (error) {
      console.error('Download failed:', error);
      showToast({ variant: "error", message: "Failed to download file.", duration: 4000 });
    }
  };

  return (
    <div className="bg-gray-50 space-y-4">
      {/* Datasets table */}
      {datasets.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Existing Datasets</h3>
          <Table
            value={datasets}
            size="small"
            className="text-sm"
            stripedRows
          >
            <Col 
              field="file_name" 
              header="File Name"
              body={(rowData) => {
                const truncated = rowData.file_name.length > 30 
                  ? rowData.file_name.substring(0, 30) + "..." 
                  : rowData.file_name;
                return (
                  <span className="font-medium" title={rowData.file_name}>
                    {truncated}
                  </span>
                );
              }}
            />
            <Col 
              field="status" 
              header="Status"
              body={(rowData) => (
                <span className={`px-2 py-1 text-xs rounded ${
                  rowData.status === 'Ready' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {rowData.status}
                </span>
              )}
            />
            <Col 
              field="created_by" 
              header="Created By"
              body={(rowData) => rowData.created_by}
            />
            <Col 
              field="created_on" 
              header="Created"
              body={(rowData) => new Date(rowData.created_on).toLocaleDateString()}
            />
            <Col 
              header="Actions"
              body={(rowData) => (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
                  onClick={() => handleDownload(rowData.id, rowData.file_name)}
                  title="Download file"
                >
                  <Download size={14} />
                </button>
              )}
            />
          </Table>
        </div>
      )}

      {/* Init checking skeleton */}
      {initStatus === "checking" && (
        <div className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl">
            <LoaderIcon />
          <p className="text-[13px] text-gray-600">Checking for existing data…</p>
        </div>
      )}

      {/* Persistent warning banner */}
      {initStatus === "ready" && initWarning && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <div className="flex gap-2 items-start">
            <Warning size={16} className="text-amber-800 shrink-0" />
            <div className="flex-1">
              <p className="text-[13px] text-amber-800 leading-snug">{initWarning}</p>
              {initViewUrl && (
                <a
                  href={initViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-amber-700 bg-white border border-amber-300 rounded-md hover:bg-amber-50 transition-colors"
                >
                  <View size={14} />
                  View existing file
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-[13px] text-gray-600">
        Max file size is 5 MB. Supported file types are .csv
      </p>

      {errorMessage && (
        <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
          {errorMessage}
        </div>
      )}

      <UploadErrorDisplay error={uploadError} />

      {/* Upload Area - hide when file is selected or upload is successful */}
      {!selectedFile && uploadStatus !== "success" && (
        <div
          className={`border border-dashed rounded-md bg-white px-4 py-8 text-center cursor-pointer hover:border-gray-500 ${
            uploadStatus === "uploading" ? "opacity-60 cursor-not-allowed" : ""
          }`}
          onClick={() => {
            if (uploadStatus === "uploading") return;
            document.getElementById("file-upload")?.click();
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileChange}
            accept=".csv"
          />
          
          <p className="text-[14px] text-red-700">
            Drag and drop file here or click to upload
          </p>
        </div>
      )}

      {/* Selected file display */}
      {selectedFile && (
        <div className="rounded-md bg-gray-100 px-3 py-2 text-[14px] flex items-center justify-between">
          <span className="truncate">{selectedFile.name}</span>
          {uploadStatus !== "uploading" && (
            <button
              type="button"
              className="ml-3 text-gray-500 hover:text-gray-700"
              onClick={clearFile}
            >
              <Close size={16} />
            </button>
          )}
        </div>
      )}

      {/* Upload status messages */}
      {uploadStatus === "uploading" && (
        <div className="text-[12px] text-blue-600">
          Uploading file…
        </div>
      )}

      {uploadStatus === "success" && (
        <div className="text-[12px] text-green-600">
          Upload completed successfully
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {/* Empty div for spacing */}
        </div>
        <div className="flex gap-2">
          <Button
            kind="secondary"
            size="sm"
            disabled={uploadStatus === "uploading"}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            kind="primary"
            size="sm"
            disabled={!selectedFile || uploadStatus === "uploading"}
            onClick={handleUpload}
          >
            {uploadStatus === "uploading" ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  );
}

