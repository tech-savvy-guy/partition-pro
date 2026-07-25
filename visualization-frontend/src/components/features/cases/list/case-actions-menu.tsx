import { Link } from "@tanstack/react-router"
import {
  ArchiveIcon,
  ArrowRightIcon,
  MoreVerticalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Case } from "@/core/api"
import { Permission, useRbac } from "@/core/rbac"

export function CaseActionsMenu({
  caseItem,
  isArchiving,
  isDeleting,
  onArchiveCase,
  onDeleteCase,
}: {
  caseItem: Case
  isArchiving: boolean
  isDeleting?: boolean
  onArchiveCase: (caseItem: Case) => void
  onDeleteCase?: (caseItem: Case) => void
}) {
  const rbac = useRbac()
  const canDelete = rbac.can(Permission.DeleteCases)
  const isArchived = caseItem.status === "archived"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${caseItem.name}`}
            className="opacity-70 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
          />
        }
      >
        <MoreVerticalIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          render={
            <Link
              to="/cases/$caseId"
              params={{ caseId: caseItem.id }}
              className="flex items-center gap-2"
            />
          }
        >
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          View case
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <Link
              to="/cases/$caseId/edit"
              params={{ caseId: caseItem.id }}
              className="flex items-center gap-2"
            />
          }
        >
          <PencilIcon className="size-3.5" aria-hidden="true" />
          Edit case
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isArchived || isArchiving || isDeleting}
          onClick={() => onArchiveCase(caseItem)}
          variant="destructive"
        >
          <ArchiveIcon className="size-3.5" aria-hidden="true" />
          {isArchiving ? "Archiving case..." : "Archive case"}
        </DropdownMenuItem>
        {canDelete && onDeleteCase ? (
          <DropdownMenuItem
            disabled={isDeleting || isArchiving}
            onClick={() => onDeleteCase(caseItem)}
            variant="destructive"
          >
            <Trash2Icon className="size-3.5" aria-hidden="true" />
            {isDeleting ? "Deleting case..." : "Delete case"}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
