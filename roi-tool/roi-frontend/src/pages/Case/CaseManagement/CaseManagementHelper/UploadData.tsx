import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { XCircleIcon, ArrowDownTrayIcon } from "@heroicons/react/24/solid";

type DatasetType =
  | "Raw Buyers Data"
  | "Weighted Buyers Data"
  | "POS DATA"
  | "Attribute Data";

interface UploadedFile {
  name: string;
  columns: string[];
  mappingKey: string;
}

type PartitionOut = {
  id: string;
  name: string;
  status?: string;
  assigned_users?: string[];
};

export default function UploadData() {
  // ---- fetch partitions to bind uploads to a partition ----
  const { data: partitions = [], isLoading: loadingPartitions } = useQuery<PartitionOut[]>({
    queryKey: ["partitions"],
    // queryFn: () => api.get("api/v1/partitions").json(),
  });

  const [partitionId, setPartitionId] = useState<string>("");

  const [files, setFiles] = useState<Record<DatasetType, UploadedFile | null>>({
    "Raw Buyers Data": null,
    "Weighted Buyers Data": null,
    "POS DATA": null,
    "Attribute Data": null,
  });

  // URLs to your static templates under public/templates/
  const TEMPLATE_URLS: Record<DatasetType, string> = {
    "Raw Buyers Data": "/templates/raw_buyers_template.xlsx",
    "Weighted Buyers Data": "/templates/weighted_buyers_template.xlsx",
    "POS DATA": "/templates/pos_data_template.xlsx",
    "Attribute Data": "/templates/attribute_data_template.xlsx",
  };

  // Use your actual canonical join key(s) here
  const columnOptions = ["GTIN_SPGR_EAN"];

  const ACCEPT = [
    ".xlsx",
    ".xls",
    ".xlsm",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
  ].join(",");

  const handleFileSelect = (
    dataset: DatasetType,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const newFile: UploadedFile = {
        name: file.name,
        columns: columnOptions,
        mappingKey: "",
      };
      setFiles((prev) => ({ ...prev, [dataset]: newFile }));
    }
    // allow re-selecting same file again
    event.currentTarget.value = "";
  };

  const handleMappingChange = (dataset: DatasetType, key: string) => {
    setFiles((prev) =>
      prev[dataset]
        ? { ...prev, [dataset]: { ...prev[dataset]!, mappingKey: key } }
        : prev
    );
  };

  const handleClearFile = (dataset: DatasetType) => {
    setFiles((prev) => ({ ...prev, [dataset]: null }));
  };

  const handleDownloadTemplate = (dataset: DatasetType) => {
    const url = TEMPLATE_URLS[dataset];
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dataset.toLowerCase().replace(/\s+/g, "_")}_template.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ----- derived validation state -----
  const anyUploaded = useMemo(
    () => Object.values(files).some((f) => f !== null),
    [files]
  );

  const allUploadedHaveKey = useMemo(
    () =>
      Object.values(files).every(
        (f) => !f || (f && f.mappingKey && f.mappingKey.length > 0)
      ),
    [files]
  );

  const canContinue = Boolean(partitionId) && anyUploaded && allUploadedHaveKey;

  const renderDropZone = (dataset: DatasetType) => {
    const file = files[dataset];
    const needsKey = !!file && !file.mappingKey;
    return (
      <div
        className={[
          "relative flex w-full flex-col gap-3 rounded-xl border-2 border-dashed bg-gray-50 p-6 text-center transition",
          needsKey
            ? "border-amber-400 hover:border-amber-500"
            : "border-gray-300 hover:border-red-500",
        ].join(" ")}
      >
        {/* Clear icon */}
        {file && (
          <button
            onClick={() => handleClearFile(dataset)}
            className="absolute right-3 top-3 text-gray-400 hover:text-red-600"
            title="Remove file"
            type="button"
          >
            <XCircleIcon className="h-5 w-5" />
          </button>
        )}

        <div className="mb-1 text-sm font-semibold text-gray-700">
          {dataset}
        </div>

        {/* Download template */}
        <button
          type="button"
          onClick={() => handleDownloadTemplate(dataset)}
          className="mx-auto inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
          title="Download Excel template"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Download template
        </button>

        <label htmlFor={dataset} className="block cursor-pointer">
          <input
            id={dataset}
            type="file"
            accept={ACCEPT}
            onChange={(e) => handleFileSelect(dataset, e)}
            className="hidden"
          />
          {!file ? (
            <div className="mt-3 flex flex-col items-center justify-center text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mb-2 h-10 w-10 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span>Drag and drop or click to upload</span>
            </div>
          ) : (
            <div className="mt-2 text-left text-gray-700">
              <p className="mb-2 truncate text-sm font-medium">{file.name}</p>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Select Mapping Key:
              </label>
              <select
                value={file.mappingKey}
                onChange={(e) => handleMappingChange(dataset, e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="">Select Key</option>
                {file.columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              {needsKey && (
                <div className="mt-1 text-xs text-amber-600">
                  Mapping key is required for this file.
                </div>
              )}
            </div>
          )}
        </label>
      </div>
    );
  };

  const handleContinue = () => {
    // This is where you'll start the upload orchestration
    // (e.g., POST /partitions/:id/uploads, then PUT file parts / presigned URLs)
    alert("Partition and file selections captured. (See console)");
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 py-8 text-gray-800">
      <h1 className="mb-6 text-2xl font-bold text-red-700">Upload Datasets</h1>

      {/* Partition selector */}
      <div className="mb-6 w-full max-w-6xl rounded-xl border bg-white p-4 shadow-sm">
        <label className="mr-3 text-sm font-medium">Select Partition</label>
        <select
          value={partitionId}
          onChange={(e) => setPartitionId(e.target.value)}
          className="min-w-[260px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-500"
          disabled={loadingPartitions}
        >
          <option value="">
            {loadingPartitions ? "Loading partitions..." : "Choose a partition"}
          </option>
          {partitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {!partitionId && (
          <div className="mt-2 text-xs text-amber-600">
            Please select a partition to associate these uploads.
          </div>
        )}
      </div>

      {/* Grid of 4 datasets */}
      <div className="grid w-full max-w-6xl gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {renderDropZone("Raw Buyers Data")}
        {renderDropZone("Weighted Buyers Data")}
        {renderDropZone("POS DATA")}
        {renderDropZone("Attribute Data")}
      </div>

      {/* 5th box - Coming Soon */}
      <div className="mt-8 w-full max-w-6xl">
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-100 p-6 text-center text-gray-400">
          <div className="text-lg font-semibold">2D–3D Coordinates</div>
          <div className="text-sm italic">Coming Soon...</div>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-10 flex gap-4">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className={`rounded-md px-5 py-2 text-sm font-medium text-white ${
            canContinue ? "bg-red-600 hover:bg-red-700" : "bg-gray-300"
          }`}
        >
          Continue
        </button>
        <button
          onClick={() => {
            setPartitionId("");
            setFiles({
              "Raw Buyers Data": null,
              "Weighted Buyers Data": null,
              "POS DATA": null,
              "Attribute Data": null,
            });
          }}
          className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>

      {/* Helper legend */}
      <div className="mt-4 text-xs text-gray-500">
        <span className="font-medium text-amber-600">Note:</span> the Continue
        button enables when a partition is selected, at least one file is uploaded,
        and all uploaded files have a mapping key.
      </div>
    </div>
  );
}
