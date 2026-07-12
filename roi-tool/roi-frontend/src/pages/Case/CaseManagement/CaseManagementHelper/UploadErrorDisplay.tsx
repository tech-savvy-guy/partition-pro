import React from 'react';
import { CloseFilled } from '@carbon/icons-react';
import type { DatasetUploadErrorResponse } from '@/core/api/case/case.types';
import type { PartitionDatasetUploadErrorResponse } from '@/core/api/partition/partition.types';

export type UploadErrorResponse =
  | (DatasetUploadErrorResponse & { hint?: string })
  | (PartitionDatasetUploadErrorResponse & { hint?: string });

interface UploadErrorDisplayProps {
  error: UploadErrorResponse | null;
  className?: string;
}

export const UploadErrorDisplay: React.FC<UploadErrorDisplayProps> = ({
  error,
  className = '',
}) => {
  if (!error) return null;

  const errorMessage =
    error.tags?.error_message || error.detail || error.error || 'Upload failed';
  const hint =
    error.tags?.error_hint ||
    error.hint ||
    'Please check the file format and try again.';

  return (
    <div
      className={`rounded-xl border border-red-100 bg-amber-50 px-5 py-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <CloseFilled className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />

        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-red-800 break-words whitespace-pre-wrap leading-relaxed">
            {errorMessage}
          </p>
          <p className="text-xs text-red-500 leading-relaxed">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
};
