import { UsersIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type AssignableUser,
  CaseAssignmentRole,
  type CaseAssignmentRole as CaseAssignmentRoleValue,
} from "@/core/api"

type AssignmentValue = {
  userId: string
  role: CaseAssignmentRoleValue
}

const assignmentRoleOptions: Array<{
  label: string
  value: CaseAssignmentRoleValue
}> = [
  { label: "Publisher", value: CaseAssignmentRole.Publisher },
  { label: "Editor", value: CaseAssignmentRole.Editor },
  { label: "Viewer", value: CaseAssignmentRole.Viewer },
]

export function AssigneePicker({
  users,
  assignments,
  isLoading,
  error,
  onToggle,
  onRoleChange,
}: {
  users: AssignableUser[]
  assignments: AssignmentValue[]
  isLoading: boolean
  error: Error | null
  onToggle: (userId: string, checked: boolean) => void
  onRoleChange: (userId: string, role: CaseAssignmentRoleValue) => void
}) {
  return (
    <Field>
      <FieldLabel>Assignees</FieldLabel>
      <FieldDescription>
        Select collaborators and choose their case role.
      </FieldDescription>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Users could not be loaded</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading users...</div>
      ) : null}

      {!isLoading && !error ? (
        <div className="flex max-h-80 flex-col overflow-y-auto border">
          {users.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No active users found.</p>
          ) : null}
          {users.map((user, index) => {
            const assignment = assignments.find(
              (item) => item.userId === user.id
            )
            const isSelected = Boolean(assignment)

            return (
              <div
                key={user.id}
                className={`flex flex-col gap-3 p-3 ${
                  index < users.length - 1 ? "border-b" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      onToggle(user.id, Boolean(checked))
                    }
                    aria-label={`Assign ${user.display_name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {user.display_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <UsersIcon
                    aria-hidden="true"
                    className="shrink-0 text-muted-foreground"
                  />
                </div>
                {isSelected ? (
                  <Select
                    value={assignment?.role ?? CaseAssignmentRole.Viewer}
                    onValueChange={(value) =>
                      onRoleChange(user.id, value as CaseAssignmentRoleValue)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {assignmentRoleOptions.find(
                          (option) => option.value === assignment?.role
                        )?.label ?? "Viewer"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {assignmentRoleOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </Field>
  )
}
