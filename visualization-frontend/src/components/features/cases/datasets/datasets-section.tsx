import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  Check,
  DownloadIcon,
  Eye,
  LockIcon,
  PlayIcon,
  RefreshCwIcon,
  SaveIcon,
  UploadIcon,
  X,
} from "lucide-react"
import { useQueryClient, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  ApiError,
  CaseApi,
  DatasetApi,
  DatasetStatus,
  DatasetType,
  Permission,
  type Dataset,
  type DatasetStatusValue,
  type DatasetTypeValue,
  type LockedPartitionsConflict,
  type SelectCaseDatasetsPayload,
} from "@/core/api"
import { useRbac } from "@/core/rbac"
import { useUI } from "@/core/ui"
import { formatBytes } from "@/lib/format"
import { fetchCsvPreview } from "@/lib/datasets/preview-csv"
import { DatasetPreviewTable } from "./dataset-preview-table"
import { cn } from "@/lib/utils"

const PAGINATION_LINK_CLASS =
  "h-7 min-w-7 rounded-none border-0 bg-transparent px-1.5 text-xs font-normal text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[active=true]:bg-transparent data-[active=true]:font-medium data-[active=true]:text-foreground data-[active=true]:underline data-[active=true]:underline-offset-4"

const PAGINATION_ARROW_CLASS =
  "size-7 rounded-none border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground [&>span]:hidden"

type PageItem = number | "ellipsis"

function buildPageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const items: PageItem[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)

  if (start > 2) {
    items.push("ellipsis")
  }

  for (let item = start; item <= end; item += 1) {
    items.push(item)
  }

  if (end < pageCount - 1) {
    items.push("ellipsis")
  }

  items.push(pageCount)
  return items
}

const datasetOptions: Array<{ label: string; value: DatasetTypeValue }> = [
  { label: "POS", value: DatasetType.Pos },
  { label: "Attributes", value: DatasetType.Attributes },
  { label: "Cross-purchase", value: DatasetType.CrossPurchase },
]

const selectionPayloadFields: Record<
  DatasetTypeValue,
  keyof SelectCaseDatasetsPayload
> = {
  [DatasetType.Pos]: "pos_dataset_id",
  [DatasetType.Attributes]: "attributes_dataset_id",
  [DatasetType.CrossPurchase]: "cross_purchase_dataset_id",
}

const ACTIVE_PREPROCESSING_STATUSES = new Set(["PENDING", "QUEUED", "RUNNING"])

function extractLockedPartitionsConflict(
  error: unknown
): LockedPartitionsConflict | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  const data = error.data as Partial<LockedPartitionsConflict> | undefined
  if (!Array.isArray(data?.locked_partitions)) return null
  return data as LockedPartitionsConflict
}

const statusLabels: Record<DatasetStatusValue, string> = {
  [DatasetStatus.Processing]: "Processing",
  [DatasetStatus.Ready]: "Ready",
  [DatasetStatus.Failed]: "Failed",
  [DatasetStatus.Archived]: "Archived",
}

type UploadState = {
  status: "uploading" | "error"
  progress: number
  error?: string
}

type DatasetSelectionMap = Record<DatasetTypeValue, string>

type DatasetSectionProps = {
  caseId: string
  datasets: Dataset[]
  isLoading: boolean
  error: Error | null
  partitionCount: number | null
  canManageCaseLocks: boolean
  onRetry: () => void
}

export function DatasetsSection({
  caseId,
  datasets,
  isLoading,
  error,
  partitionCount,
  canManageCaseLocks,
  onRetry,
}: DatasetSectionProps) {
  const queryClient = useQueryClient()
  const rbac = useRbac()
  const { showToast } = useUI()
  const fileInputs = useRef<
    Partial<Record<DatasetTypeValue, HTMLInputElement | null>>
  >({})
  const [uploadStates, setUploadStates] = useState<
    Partial<Record<DatasetTypeValue, UploadState>>
  >({})
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [viewingDataset, setViewingDataset] = useState<Dataset | null>(null)

  const previewQuery = useQuery({
    queryKey: ["dataset-preview", caseId, viewingDataset?.id],
    queryFn: async () => {
      if (!viewingDataset) throw new Error("No dataset selected")
      const { preview_url } = await DatasetApi.getPreview(
        caseId,
        viewingDataset.id
      )
      return fetchCsvPreview(preview_url)
    },
    enabled: Boolean(viewingDataset),
  })
  const preprocessingQuery = useQuery({
    queryKey: ["preprocessing-status", caseId],
    queryFn: async () => {
      try {
        return await CaseApi.getPreprocessingStatus(caseId)
      } catch (statusError) {
        if (statusError instanceof ApiError && statusError.status === 404) {
          return null
        }
        throw statusError
      }
    },
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status &&
      ACTIVE_PREPROCESSING_STATUSES.has(query.state.data.status)
        ? 5000
        : false,
  })
  const [draftSelections, setDraftSelections] = useState<DatasetSelectionMap>(
    createEmptySelectionMap
  )
  const [isConfirmingSelection, setIsConfirmingSelection] = useState(false)
  const [isSavingSelection, setIsSavingSelection] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [isStartingPreprocessing, setIsStartingPreprocessing] = useState(false)
  const [isReleasingLocks, setIsReleasingLocks] = useState(false)
  const [lockConflict, setLockConflict] =
    useState<LockedPartitionsConflict | null>(null)
  const pendingRetryRef = useRef<(() => void | Promise<void>) | null>(null)

  const canUpload = rbac.can(Permission.UploadFiles)
  const canDownload = rbac.can(Permission.DownloadFiles)
  const canEdit = rbac.can(Permission.EditDatasets)

  const datasetsByType = useMemo(() => {
    return datasetOptions.reduce<Record<DatasetTypeValue, Dataset[]>>(
      (groups, option) => {
        groups[option.value] = datasets
          .filter((dataset) => dataset.type === option.value)
          .sort((a, b) => b.version - a.version)
        return groups
      },
      createEmptyDatasetGroups()
    )
  }, [datasets])

  const historyPageSize = 10
  const historyPageCount = Math.max(
    1,
    Math.ceil(datasets.length / historyPageSize)
  )
  const historyStartIndex = (historyPage - 1) * historyPageSize
  const paginatedDatasets = datasets.slice(
    historyStartIndex,
    historyStartIndex + historyPageSize
  )
  const historyVisibleStart = datasets.length ? historyStartIndex + 1 : 0
  const historyVisibleEnd = Math.min(
    historyStartIndex + historyPageSize,
    datasets.length
  )

  const historyPageItems = useMemo(
    () => buildPageItems(historyPage, historyPageCount),
    [historyPage, historyPageCount]
  )

  useEffect(() => {
    setHistoryPage((current) => Math.min(current, historyPageCount))
  }, [historyPageCount])

  useEffect(() => {
    if (isHistoryOpen) {
      setHistoryPage(1)
    }
  }, [isHistoryOpen])

  const savedSelections = useMemo(
    () => getSavedSelections(datasetsByType),
    [datasetsByType]
  )
  const savedSelectionKey = getSelectionKey(savedSelections)
  const changedSelections = useMemo(
    () =>
      getChangedSelections(savedSelections, draftSelections, datasetsByType),
    [draftSelections, datasetsByType, savedSelections]
  )
  const hasSelectionChanges = changedSelections.length > 0
  const allTypesSelected = datasetOptions.every(
    (option) => savedSelections[option.value] !== ""
  )
  const preprocessingActive = Boolean(
    preprocessingQuery.data?.status &&
    ACTIVE_PREPROCESSING_STATUSES.has(preprocessingQuery.data.status)
  )
  const showStartPreprocessing =
    canEdit && allTypesSelected && !hasSelectionChanges

  useEffect(() => {
    setDraftSelections(savedSelections)
  }, [savedSelectionKey, savedSelections])

  async function uploadFile(type: DatasetTypeValue, file: File) {
    if (file.size <= 0) {
      setUploadStates((current) => ({
        ...current,
        [type]: {
          status: "error",
          progress: 0,
          error: "Choose a non-empty file.",
        },
      }))
      return
    }

    setUploadStates((current) => ({
      ...current,
      [type]: { status: "uploading", progress: 1 },
    }))

    try {
      const upload = await DatasetApi.createUpload(caseId, {
        type,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type || "application/octet-stream",
        description: "",
        tags: {},
      })

      setUploadProgress(type, 5)

      await DatasetApi.uploadToAzure(
        upload.upload_url,
        file,
        upload.headers,
        (progress) => setUploadProgress(type, Math.max(5, progress))
      )

      setUploadProgress(type, 100)
      await DatasetApi.completeUpload(caseId, upload.dataset.id)
      await queryClient.invalidateQueries({
        queryKey: ["case-datasets", caseId],
      })
      clearUploadState(type)
      showToast("Dataset uploaded", "success", {
        description:
          "The dataset has been successfully uploaded and processed.",
      })
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Dataset upload failed."

      setUploadStates((current) => ({
        ...current,
        [type]: {
          status: "error",
          progress: current[type]?.progress ?? 0,
          error: message,
        },
      }))
      showToast("Upload failed", "error", {
        description: message,
      })
    }
  }

  async function handleFileSelected(
    type: DatasetTypeValue,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return
    await uploadFile(type, file)
  }

  async function handleFileDropped(type: DatasetTypeValue, file: File) {
    await uploadFile(type, file)
  }

  function setUploadProgress(type: DatasetTypeValue, progress: number) {
    setUploadStates((current) => ({
      ...current,
      [type]: {
        status: "uploading",
        progress,
      },
    }))
  }

  function clearUploadState(type: DatasetTypeValue) {
    setUploadStates((current) => {
      const next = { ...current }
      delete next[type]
      return next
    })
  }

  async function handleDownload(dataset: Dataset) {
    setDownloadingId(dataset.id)

    try {
      const response = await DatasetApi.getDownloadUrl(caseId, dataset.id)
      const link = document.createElement("a")
      link.href = response.download_url
      link.target = "_blank"
      link.rel = "noreferrer"
      link.click()
    } catch (downloadError) {
      showToast("Download failed", "error", {
        description:
          downloadError instanceof Error
            ? downloadError.message
            : "Download link could not be created.",
      })
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleConfirmSelectionSave() {
    setIsSavingSelection(true)

    try {
      // One atomic call for the whole combination — the backend selects each
      // changed dataset and dispatches case preprocessing exactly once.
      const payload = changedSelections.reduce<SelectCaseDatasetsPayload>(
        (body, change) => ({
          ...body,
          [selectionPayloadFields[change.type]]: change.next.id,
        }),
        {}
      )
      const response = await DatasetApi.selectDatasets(caseId, payload)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case-datasets", caseId] }),
        queryClient.invalidateQueries({
          queryKey: ["case-partitions", caseId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["preprocessing-status", caseId],
        }),
      ])
      setIsConfirmingSelection(false)
      if (response.status === "FAILED") {
        showToast("Preprocessing could not start", "error", {
          description:
            response.detail ??
            "Dataset selection was saved but preprocessing failed to start.",
        })
      } else {
        showToast("Dataset set updated", "success", {
          description:
            response.status === "READY"
              ? "Datasets are already prepared for compute."
              : "Preparing datasets for compute…",
        })
      }
    } catch (selectionError) {
      const conflict = extractLockedPartitionsConflict(selectionError)
      if (conflict) {
        pendingRetryRef.current = () => void handleConfirmSelectionSave()
        setLockConflict(conflict)
      } else {
        showToast("Update failed", "error", {
          description:
            selectionError instanceof Error
              ? selectionError.message
              : "Dataset selections could not be saved.",
        })
      }
    } finally {
      setIsSavingSelection(false)
    }
  }

  async function handleStartPreprocessing() {
    setIsStartingPreprocessing(true)

    try {
      const response = await CaseApi.runPreprocessing(caseId)
      await queryClient.invalidateQueries({
        queryKey: ["preprocessing-status", caseId],
      })
      if (response.status === "FAILED") {
        showToast("Preprocessing could not start", "error", {
          description: response.detail ?? "Could not start preprocessing.",
        })
      } else {
        showToast(
          response.status === "READY"
            ? "Datasets already prepared"
            : "Preprocessing started",
          "success",
          {
            description:
              response.status === "READY"
                ? "This dataset combination is already prepared for compute."
                : "Preparing datasets for compute…",
          }
        )
      }
    } catch (startError) {
      const conflict = extractLockedPartitionsConflict(startError)
      if (conflict) {
        pendingRetryRef.current = () => void handleStartPreprocessing()
        setLockConflict(conflict)
      } else {
        showToast("Could not start preprocessing", "error", {
          description:
            startError instanceof Error
              ? startError.message
              : "Preprocessing could not be started.",
        })
      }
    } finally {
      setIsStartingPreprocessing(false)
    }
  }

  async function handleForceReleaseLocks() {
    setIsReleasingLocks(true)

    try {
      const response = await CaseApi.releasePartitionLocks(caseId)
      setLockConflict(null)
      showToast("Partition locks released", "success", {
        description: `Released ${response.released_count} partition lock${
          response.released_count === 1 ? "" : "s"
        }.`,
      })
      const retry = pendingRetryRef.current
      pendingRetryRef.current = null
      await retry?.()
    } catch (releaseError) {
      showToast("Could not release locks", "error", {
        description:
          releaseError instanceof Error
            ? releaseError.message
            : "Partition locks could not be released.",
      })
    } finally {
      setIsReleasingLocks(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-medium tracking-[0.14em] uppercase">
              Active Datasets
            </p>
            <PreprocessingStatusChip status={preprocessingQuery.data?.status} />
          </div>
          <h2 className="text-sm text-muted-foreground">
            Drag and drop files in the respective slots to upload the datasets
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {hasSelectionChanges ? (
            <>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0 text-muted-foreground no-underline hover:text-foreground hover:no-underline"
                disabled={isSavingSelection}
                onClick={() => setDraftSelections(savedSelections)}
              >
                <X data-icon="inline-start" />
                Discard
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0 font-medium text-primary no-underline hover:text-primary/80 hover:no-underline"
                disabled={isSavingSelection}
                onClick={() => setIsConfirmingSelection(true)}
              >
                {isSavingSelection ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Check data-icon="inline-start" />
                )}
                Save
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-1">
              {showStartPreprocessing ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  disabled={isStartingPreprocessing || preprocessingActive}
                  title={
                    preprocessingActive
                      ? "Preprocessing is already in progress"
                      : undefined
                  }
                  onClick={() => void handleStartPreprocessing()}
                >
                  {isStartingPreprocessing || preprocessingActive ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <PlayIcon data-icon="inline-start" />
                  )}
                  Start Preprocessing
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={onRetry}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RefreshCwIcon data-icon="inline-start" />
                )}
                Refresh
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setIsHistoryOpen(true)}
              >
                All uploaded files
                <ArrowRightIcon />
              </Button>
            </div>
          )}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <RefreshCwIcon aria-hidden="true" />
          <AlertTitle>Datasets could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{error.message}</span>
            <Button variant="outline" onClick={onRetry}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2 md:grid-cols-3">
        {datasetOptions.map((option) => {
          const typeDatasets = datasetsByType[option.value]
          const uploadState = uploadStates[option.value]
          const draftDataset =
            typeDatasets.find(
              (dataset) => dataset.id === draftSelections[option.value]
            ) ?? typeDatasets.find((dataset) => dataset.is_selected)
          const savedDataset = typeDatasets.find(
            (dataset) => dataset.is_selected
          )
          const isUploading = uploadState?.status === "uploading"

          return (
            <DatasetSlot
              key={option.value}
              label={option.label}
              type={option.value}
              datasets={typeDatasets}
              selectedDataset={draftDataset}
              savedDataset={savedDataset}
              uploadState={uploadState}
              canUpload={canUpload}
              canEdit={canEdit}
              canDownload={canDownload}
              isUploading={isUploading}
              isDownloading={downloadingId === draftDataset?.id}
              isSavingSelection={isSavingSelection}
              inputRef={(node) => {
                fileInputs.current[option.value] = node
              }}
              onUploadClick={() => fileInputs.current[option.value]?.click()}
              onFileSelected={(event) =>
                void handleFileSelected(option.value, event)
              }
              onFileDropped={(file) =>
                void handleFileDropped(option.value, file)
              }
              onSelectionChange={(datasetId) =>
                setDraftSelections((current) => ({
                  ...current,
                  [option.value]: datasetId,
                }))
              }
              onDownload={
                draftDataset
                  ? () => void handleDownload(draftDataset)
                  : undefined
              }
              onView={
                draftDataset ? () => setViewingDataset(draftDataset) : undefined
              }
            />
          )
        })}
      </div>

      <Dialog
        open={isConfirmingSelection}
        onOpenChange={(open) => {
          if (!open && !isSavingSelection) {
            setIsConfirmingSelection(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save dataset set?</DialogTitle>
            <DialogDescription>
              Changing active datasets can affect existing partitions, SKU
              selections, and generated visualizations for this case.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/15 bg-amber-500/5 p-3 text-xs">
            <AlertTriangleIcon
              className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500"
              aria-hidden="true"
            />
            <div>
              <div className="font-semibold text-foreground">
                Downstream outputs may change
              </div>
              <div className="mt-0.5 text-muted-foreground">
                {partitionCount === null
                  ? "Partitions will refresh against the newly selected dataset versions."
                  : `${partitionCount} partition${
                      partitionCount === 1 ? "" : "s"
                    } may need to be reviewed after this change.`}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 py-1">
            {changedSelections.map((change) => (
              <DatasetChangeLine key={change.type} change={change} />
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSavingSelection}
              onClick={() => setIsConfirmingSelection(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSavingSelection}
              onClick={() => void handleConfirmSelectionSave()}
            >
              {isSavingSelection ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(lockConflict)}
        onOpenChange={(open) => {
          if (!open && !isReleasingLocks) {
            setLockConflict(null)
            pendingRetryRef.current = null
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Partitions are being edited</DialogTitle>
            <DialogDescription>{lockConflict?.detail}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5 py-1">
            {lockConflict?.locked_partitions.map((partition) => (
              <div
                key={partition.id}
                className="flex items-center justify-between gap-4 py-1.5 text-xs"
              >
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <LockIcon
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {partition.name}
                </span>
                <span className="rounded bg-muted/65 px-2 py-0.5 font-mono text-muted-foreground">
                  {partition.locked_by}
                </span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isReleasingLocks}
              onClick={() => {
                setLockConflict(null)
                pendingRetryRef.current = null
              }}
            >
              {canManageCaseLocks ? "Cancel" : "Close"}
            </Button>
            {canManageCaseLocks ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isReleasingLocks}
                onClick={() => void handleForceReleaseLocks()}
              >
                {isReleasingLocks ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <LockIcon data-icon="inline-start" />
                )}
                Force release &amp; retry
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(viewingDataset)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingDataset(null)
          }
        }}
      >
        <SheetContent
          className="flex w-screen max-w-none flex-col gap-6 p-6 data-[side=right]:w-screen data-[side=right]:sm:max-w-none"
          showCloseButton={false}
        >
          {viewingDataset ? (
            <>
              <SheetHeader>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted/65 px-1.5 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                      v{viewingDataset.version}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                        viewingDataset.status === DatasetStatus.Failed
                          ? "bg-destructive/10 text-destructive"
                          : viewingDataset.status === DatasetStatus.Ready
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {statusLabels[viewingDataset.status]}
                    </span>
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-primary"
                    onClick={() => setViewingDataset(null)}
                  >
                    <X className="size-4" />
                    Close
                  </Button>
                </div>
                <SheetTitle className="truncate text-xl font-bold tracking-tight">
                  {viewingDataset.file_name}
                </SheetTitle>
                <SheetDescription className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Uploaded: {formatTimestamp(viewingDataset.created_at)}
                  </span>
                  <span>Size: {formatBytes(viewingDataset.file_size)}</span>
                  <span>
                    By:{" "}
                    {viewingDataset.created_by ? (
                      <Link
                        to="/profile"
                        className="cursor-pointer font-medium transition-colors hover:text-primary hover:underline"
                      >
                        {getUploaderLabel(viewingDataset)}
                      </Link>
                    ) : (
                      getUploaderLabel(viewingDataset)
                    )}
                  </span>
                </SheetDescription>
              </SheetHeader>

              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Dataset preview
                </h4>

                {(() => {
                  if (previewQuery.isLoading) {
                    return (
                      <div className="flex flex-1 items-center justify-center border bg-background">
                        <Spinner className="size-8" />
                      </div>
                    )
                  }

                  if (previewQuery.isError) {
                    return (
                      <div className="border bg-background p-4 text-xs text-destructive">
                        Failed to load dataset preview:{" "}
                        {previewQuery.error instanceof Error
                          ? previewQuery.error.message
                          : "Unknown error"}
                      </div>
                    )
                  }

                  const data = previewQuery.data
                  if (!data || !data.columns || data.columns.length === 0) {
                    return (
                      <p className="border bg-background p-4 text-xs text-muted-foreground">
                        No preview available for this dataset.
                      </p>
                    )
                  }

                  return (
                    <DatasetPreviewTable
                      columns={data.columns}
                      rows={data.rows}
                    />
                  )
                })()}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="flex max-h-[85vh] w-full flex-col gap-6 p-6 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">
              All Uploaded Datasets
            </DialogTitle>
            <DialogDescription>
              A history of all dataset files uploaded and processed for this
              case.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto border bg-background">
            {datasets.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No datasets uploaded yet.
              </p>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-taupe-200">
                  <TableRow className="border-b border-border">
                    <TableHead className="h-9 px-3 text-[10px] font-semibold tracking-wider uppercase">
                      File Name
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold tracking-wider uppercase">
                      Type
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold tracking-wider uppercase">
                      Version
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold tracking-wider uppercase">
                      Status
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold tracking-wider uppercase">
                      Size
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold tracking-wider uppercase">
                      Uploaded By
                    </TableHead>
                    <TableHead className="h-9 px-3 text-[10px] font-semibold tracking-wider uppercase">
                      Date
                    </TableHead>
                    <TableHead className="h-9 px-3 text-right text-[10px] font-semibold tracking-wider uppercase">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDatasets.map((dataset) => (
                    <TableRow
                      key={dataset.id}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/10"
                    >
                      <TableCell
                        className="max-w-[200px] truncate px-3 py-2.5 text-xs font-medium text-foreground"
                        title={dataset.file_name}
                      >
                        {dataset.file_name}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs capitalize">
                        {getTypeName(dataset.type)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 font-mono text-xs">
                        v{dataset.version}
                        {dataset.is_selected && (
                          <Badge
                            variant="outline"
                            className="ml-1 border-primary/45 px-1 py-0 text-[9px] text-primary"
                          >
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                            dataset.status === DatasetStatus.Failed
                              ? "bg-destructive/10 text-destructive"
                              : dataset.status === DatasetStatus.Ready
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {statusLabels[dataset.status]}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">
                        {formatBytes(dataset.file_size)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">
                        {dataset.created_by ? (
                          <Link
                            to="/profile"
                            className="cursor-pointer font-medium transition-colors hover:text-primary hover:underline"
                          >
                            {getUploaderLabel(dataset)}
                          </Link>
                        ) : (
                          getUploaderLabel(dataset)
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">
                        {formatTimestamp(dataset.created_at)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right text-xs">
                        <div className="flex justify-end gap-1">
                          {canDownload && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="size-7 text-muted-foreground hover:text-foreground"
                              title="Download"
                              onClick={() => void handleDownload(dataset)}
                              disabled={downloadingId === dataset.id}
                            >
                              {downloadingId === dataset.id ? (
                                <Spinner aria-hidden="true" />
                              ) : (
                                <DownloadIcon
                                  aria-hidden="true"
                                  className="size-3.5"
                                />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title="Preview"
                            onClick={() => setViewingDataset(dataset)}
                          >
                            <Eye aria-hidden="true" className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {datasets.length > 0 && (
            <div className="flex flex-col gap-2 border-t pt-3.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {historyVisibleStart}-{historyVisibleEnd} of{" "}
                {datasets.length}
              </p>
              <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                <PaginationContent className="gap-1">
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      text="Prev"
                      aria-disabled={historyPage === 1}
                      className={cn(
                        PAGINATION_ARROW_CLASS,
                        historyPage === 1 && "pointer-events-none opacity-35"
                      )}
                      onClick={(event) => {
                        event.preventDefault()
                        setHistoryPage((p) => Math.max(p - 1, 1))
                      }}
                    />
                  </PaginationItem>

                  {historyPageItems.map((item, index) =>
                    item === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${index}`}>
                        <PaginationEllipsis className="size-7 text-muted-foreground/60 [&_svg:not([class*='size-'])]:size-3.5" />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          href="#"
                          isActive={item === historyPage}
                          className={PAGINATION_LINK_CLASS}
                          onClick={(event) => {
                            event.preventDefault()
                            setHistoryPage(item)
                          }}
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={historyPage === historyPageCount}
                      className={cn(
                        PAGINATION_ARROW_CLASS,
                        historyPage === historyPageCount &&
                          "pointer-events-none opacity-35"
                      )}
                      onClick={(event) => {
                        event.preventDefault()
                        setHistoryPage((p) => Math.min(p + 1, historyPageCount))
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function DatasetSlot({
  label,
  type,
  datasets,
  selectedDataset,
  savedDataset,
  uploadState,
  canUpload,
  canEdit,
  canDownload,
  isUploading,
  isDownloading,
  isSavingSelection,
  inputRef,
  onUploadClick,
  onFileSelected,
  onFileDropped,
  onSelectionChange,
  onDownload,
  onView,
}: {
  label: string
  type: DatasetTypeValue
  datasets: Dataset[]
  selectedDataset: Dataset | undefined
  savedDataset: Dataset | undefined
  uploadState: UploadState | undefined
  canUpload: boolean
  canEdit: boolean
  canDownload: boolean
  isUploading: boolean
  isDownloading: boolean
  isSavingSelection: boolean
  inputRef: (node: HTMLInputElement | null) => void
  onUploadClick: () => void
  onFileSelected: (event: ChangeEvent<HTMLInputElement>) => void
  onFileDropped: (file: File) => void
  onSelectionChange: (datasetId: string) => void
  onDownload: (() => void) | undefined
  onView: (() => void) | undefined
}) {
  const readyDatasetCount = datasets.filter(
    (dataset) => dataset.status === DatasetStatus.Ready
  ).length
  const selectedVersionLabel = selectedDataset
    ? formatVersionOption(selectedDataset)
    : "Select version"
  const isDraftChanged = selectedDataset?.id !== savedDataset?.id
  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 border border-dashed border-muted-foreground/80 p-2.5 transition-colors duration-200",
        isDragOver && canUpload && !isUploading
          ? "border-primary bg-primary/5 dark:bg-primary/10"
          : "bg-background/50"
      )}
      onDragEnter={(e) => {
        if (canUpload && !isUploading) {
          e.preventDefault()
          setIsDragOver(true)
        }
      }}
      onDragOver={(e) => {
        if (canUpload && !isUploading) {
          e.preventDefault()
          setIsDragOver(true)
        }
      }}
      onDragLeave={() => {
        setIsDragOver(false)
      }}
      onDrop={(e) => {
        if (canUpload && !isUploading) {
          e.preventDefault()
          setIsDragOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) {
            onFileDropped(file)
          }
        }
      }}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <h3 className="shrink-0 text-sm font-semibold tracking-tight">
            {label}
          </h3>
          {selectedDataset ? (
            <>
              <span className="rounded bg-muted/65 px-1 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                v{selectedDataset.version}
              </span>
              <span
                className={`text-[10px] font-semibold tracking-wider uppercase ${
                  selectedDataset.status === DatasetStatus.Failed
                    ? "text-destructive"
                    : selectedDataset.status === DatasetStatus.Ready
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                }`}
              >
                {statusLabels[selectedDataset.status]}
              </span>
            </>
          ) : null}
          {isDraftChanged ? (
            <span className="rounded px-1 py-0.5 text-[10px] font-semibold tracking-wider text-blue-600 uppercase dark:text-blue-400">
              Changed
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {canDownload && selectedDataset ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Download ${selectedDataset.file_name}`}
              title="Download"
              disabled={isDownloading}
              onClick={onDownload}
            >
              {isDownloading ? (
                <Spinner aria-hidden="true" />
              ) : (
                <DownloadIcon aria-hidden="true" />
              )}
            </Button>
          ) : null}
          {selectedDataset ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              aria-label={`View ${selectedDataset.file_name}`}
              title="View"
              onClick={onView}
            >
              <Eye aria-hidden="true" />
            </Button>
          ) : null}
          <UploadControl
            canUpload={canUpload}
            isUploading={isUploading}
            inputRef={inputRef}
            onUploadClick={onUploadClick}
            onFileSelected={onFileSelected}
            iconOnly
            label={`Upload ${getTypeName(type)}`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Select
          value={selectedDataset?.id ?? ""}
          onValueChange={(v) => onSelectionChange(v ?? "")}
          disabled={!canEdit || readyDatasetCount === 0 || isSavingSelection}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue>{selectedVersionLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectGroup>
              {datasets.map((dataset) => (
                <SelectItem
                  key={dataset.id}
                  value={dataset.id}
                  disabled={dataset.status !== DatasetStatus.Ready}
                >
                  <span className="flex min-w-0 flex-col">
                    <span>{formatVersionOption(dataset)}</span>
                    <span className="text-xs text-muted-foreground">
                      {statusLabels[dataset.status]}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <UploadFeedback uploadState={uploadState} />
      </div>

      {selectedDataset ? (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            {selectedDataset.created_by ? (
              <Link
                to="/profile"
                className="cursor-pointer font-medium transition-colors hover:text-primary hover:underline"
              >
                {getUploaderLabel(selectedDataset)}
              </Link>
            ) : (
              getUploaderLabel(selectedDataset)
            )}
          </span>
          <span aria-hidden="true">/</span>
          <span className="shrink-0">
            {formatTimestamp(selectedDataset.created_at)}
          </span>
          <span aria-hidden="true">/</span>
          <span className="shrink-0">
            {formatBytes(selectedDataset.file_size)}
          </span>
        </div>
      ) : (
        <span className="truncate text-xs text-muted-foreground">
          No active version selected
        </span>
      )}
    </div>
  )
}

function PreprocessingStatusChip({ status }: { status?: string | null }) {
  if (!status || status === "NOT_FOUND") return null

  if (ACTIVE_PREPROCESSING_STATUSES.has(status)) {
    return (
      <Badge variant="outline" className="rounded-none text-muted-foreground">
        <Spinner data-icon="inline-start" aria-hidden="true" />
        Preparing datasets…
      </Badge>
    )
  }
  if (status === "READY") {
    return (
      <Badge
        variant="outline"
        className="rounded-none text-emerald-600 dark:text-emerald-400"
      >
        <Check data-icon="inline-start" aria-hidden="true" />
        Datasets ready
      </Badge>
    )
  }
  if (status === "FAILED") {
    return (
      <Badge variant="outline" className="rounded-none text-destructive">
        <AlertTriangleIcon data-icon="inline-start" aria-hidden="true" />
        Preprocessing failed
      </Badge>
    )
  }
  return null
}

function UploadControl({
  canUpload,
  isUploading,
  inputRef,
  onUploadClick,
  onFileSelected,
  iconOnly = false,
  label = "Upload",
}: {
  canUpload: boolean
  isUploading: boolean
  inputRef: (node: HTMLInputElement | null) => void
  onUploadClick: () => void
  onFileSelected: (event: ChangeEvent<HTMLInputElement>) => void
  iconOnly?: boolean
  label?: string
}) {
  if (!canUpload) return null

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={onFileSelected}
      />
      <Button
        type="button"
        variant={iconOnly ? "ghost" : "outline"}
        size={iconOnly ? "icon-sm" : "sm"}
        className={
          iconOnly ? "text-muted-foreground hover:text-foreground" : undefined
        }
        aria-label={label}
        title={label}
        disabled={isUploading}
        onClick={onUploadClick}
      >
        {isUploading ? (
          <Spinner data-icon={iconOnly ? undefined : "inline-start"} />
        ) : (
          <UploadIcon data-icon={iconOnly ? undefined : "inline-start"} />
        )}
        {iconOnly ? null : label}
      </Button>
    </>
  )
}

function UploadFeedback({
  uploadState,
}: {
  uploadState: UploadState | undefined
}) {
  if (!uploadState) return null

  if (uploadState.status === "error") {
    return null
  }

  return (
    <Progress
      className="h-1"
      value={uploadState.progress}
      aria-label="Upload progress"
    />
  )
}

type DatasetSelectionChange = {
  type: DatasetTypeValue
  label: string
  previous: Dataset | undefined
  next: Dataset
}

function DatasetChangeLine({ change }: { change: DatasetSelectionChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-xs">
      <span className="font-medium text-foreground">{change.label}</span>
      <span className="rounded bg-muted/65 px-2 py-0.5 font-mono text-muted-foreground">
        {change.previous ? `v${change.previous.version}` : "None"} &rarr; v
        {change.next.version}
      </span>
    </div>
  )
}

function createEmptySelectionMap(): DatasetSelectionMap {
  return {
    [DatasetType.Pos]: "",
    [DatasetType.Attributes]: "",
    [DatasetType.CrossPurchase]: "",
  }
}

function createEmptyDatasetGroups(): Record<DatasetTypeValue, Dataset[]> {
  return {
    [DatasetType.Pos]: [],
    [DatasetType.Attributes]: [],
    [DatasetType.CrossPurchase]: [],
  }
}

function getSavedSelections(
  datasetsByType: Record<DatasetTypeValue, Dataset[]>
): DatasetSelectionMap {
  return datasetOptions.reduce<DatasetSelectionMap>((selections, option) => {
    selections[option.value] =
      datasetsByType[option.value].find((dataset) => dataset.is_selected)?.id ??
      ""
    return selections
  }, createEmptySelectionMap())
}

function getSelectionKey(selections: DatasetSelectionMap) {
  return datasetOptions.map((option) => selections[option.value]).join("|")
}

function getChangedSelections(
  savedSelections: DatasetSelectionMap,
  draftSelections: DatasetSelectionMap,
  datasetsByType: Record<DatasetTypeValue, Dataset[]>
): DatasetSelectionChange[] {
  return datasetOptions.flatMap((option) => {
    const savedId = savedSelections[option.value]
    const draftId = draftSelections[option.value]

    if (!draftId || draftId === savedId) return []

    const next = datasetsByType[option.value].find(
      (dataset) => dataset.id === draftId
    )
    if (!next) return []

    return [
      {
        type: option.value,
        label: option.label,
        previous: datasetsByType[option.value].find(
          (dataset) => dataset.id === savedId
        ),
        next,
      },
    ]
  })
}

function formatVersionOption(dataset: Dataset) {
  return `v${dataset.version} - ${dataset.file_name}`
}

function getTypeName(type: DatasetTypeValue) {
  return (
    datasetOptions.find((option) => option.value === type)?.label ?? "dataset"
  )
}

function getUploaderLabel(dataset: Dataset) {
  return dataset.created_by?.display_name || "Unknown"
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}
