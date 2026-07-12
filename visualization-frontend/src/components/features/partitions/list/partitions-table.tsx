import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowRightIcon,
  LockIcon,
  MoreHorizontalIcon,
  Share2Icon,
} from "lucide-react"
import type { KeyboardEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Partition } from "@/core/api"
import { formatDate } from "@/lib/format"

const statusConfig: Record<
  Partition["status"],
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "text-muted-foreground" },
  active: {
    label: "Active",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  archived: {
    label: "Archived",
    className: "text-muted-foreground",
  },
}

export function PartitionsTable({ partitions }: { partitions: Partition[] }) {
  const navigate = useNavigate()

  function openPartition(caseId: string, partitionId: string) {
    void navigate({
      to: "/cases/$caseId/partitions/$partitionId",
      params: { caseId, partitionId },
    })
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    caseId: string,
    partitionId: string
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    event.preventDefault()
    openPartition(caseId, partitionId)
  }

  return (
    <div className="overflow-hidden border bg-background">
      <Table>
        <TableHeader className="bg-taupe-200">
          <TableRow className="border-b border-border">
            <TableHead className="h-11 px-4 text-[11px] font-medium uppercase">
              Partition Name
            </TableHead>
            <TableHead className="h-11 text-[11px] font-medium uppercase">
              Status
            </TableHead>
            <TableHead className="h-11 text-[11px] font-medium uppercase">
              Visibility
            </TableHead>
            <TableHead className="h-11 text-[11px] font-medium uppercase">
              Lock
            </TableHead>
            <TableHead className="h-11 text-[11px] font-medium uppercase">
              Updated
            </TableHead>
            <TableHead className="h-11 w-12 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {partitions.map((partition) => {
            const status = statusConfig[partition.status]
            const isActive = partition.status === "active"
            return (
              <TableRow
                key={partition.id}
                role="link"
                tabIndex={0}
                aria-label={`Open ${partition.name}`}
                onClick={() => openPartition(partition.case_id, partition.id)}
                onKeyDown={(event) =>
                  handleRowKeyDown(event, partition.case_id, partition.id)
                }
                className="group cursor-pointer border-b border-border/30 bg-transparent hover:bg-muted/20 focus-visible:bg-muted/30 focus-visible:outline-none"
              >
                <TableCell className="px-4 py-3.5">
                  <span
                    className={`text-sm font-medium decoration-primary underline-offset-4 transition-colors group-hover:text-primary group-hover:underline ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {partition.name}
                  </span>
                </TableCell>
                <TableCell className="py-3.5">
                  <span
                    className={`inline-flex items-center rounded text-xs font-medium ${status.className}`}
                  >
                    {status.label}
                  </span>
                </TableCell>
                <TableCell className="py-3.5">
                  {partition.is_shared ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                      <Share2Icon className="size-3" aria-hidden="true" />
                      Shared
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Private
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3.5">
                  {partition.locked_by ? (
                    <span className="inline-flex max-w-40 items-center gap-1.5 truncate text-xs text-foreground">
                      <LockIcon
                        className="size-3 shrink-0"
                        aria-hidden="true"
                      />
                      {partition.locked_by_display_name || "Locked"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Unlocked
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3.5">
                  <span className="text-sm text-muted-foreground">
                    {formatDate(partition.updated_at)}
                  </span>
                </TableCell>
                <TableCell
                  className="py-3.5 pr-3 text-right"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <div className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${partition.name}`}
                            className="data-[state=open]:opacity-100"
                          />
                        }
                      >
                        <MoreHorizontalIcon aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          render={
                            <Link
                              to="/cases/$caseId/partitions/$partitionId"
                              params={{
                                caseId: partition.case_id,
                                partitionId: partition.id,
                              }}
                              className="flex items-center gap-2"
                            />
                          }
                        >
                          <ArrowRightIcon
                            className="size-3.5"
                            aria-hidden="true"
                          />
                          Open
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
