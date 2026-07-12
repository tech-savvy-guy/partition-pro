import type { PartitionDatasetUploadErrorResponse } from "@/lib/partition-tree/types";

export function UploadErrorDisplay({
  error,
}: {
  error?: PartitionDatasetUploadErrorResponse | null;
}) {
  if (!error) return null;

  const message =
    error.tags?.error_message ??
    error.detail ??
    error.error ??
    error.message ??
    "Upload failed.";

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">
      <div className="font-semibold">{message}</div>
      {error.hint ? <div className="mt-1 text-red-700">{error.hint}</div> : null}
    </div>
  );
}
