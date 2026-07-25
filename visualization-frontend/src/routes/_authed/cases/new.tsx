import { type FormEvent, useMemo, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftIcon, SaveIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { AssigneePicker, DatasetPlaceholders } from "@/components/features/cases"
import {
  CaseApi,
  CaseAssignmentRole,
  CaseStatus,
  UserApi,
  type CaseAssignmentRole as CaseAssignmentRoleValue,
  type CaseStatus as CaseStatusValue,
  type CreateCasePayload,
} from "@/core/api"
import {
  SELECTABLE_METHODOLOGIES,
} from "@/core/workflow"
import { useUI } from "@/core/ui"
import { Permission, RequirePermission } from "@/core/rbac"
import { XIcon, PlusIcon } from "lucide-react"

export const Route = createFileRoute("/_authed/cases/new")({
  component: NewCasePage,
})

type FormValues = {
  name: string
  code: string
  description: string
  methodology: string
  category: string
  status: CaseStatusValue
  tags: string[]
  assignments: AssignmentValue[]
}

type FormErrors = Partial<Record<keyof FormValues | "form", string>>

type AssignmentValue = {
  userId: string
  role: CaseAssignmentRoleValue
}

const statusOptions: Array<{ label: string; value: CaseStatusValue }> = [
  { label: "Draft", value: CaseStatus.Draft },
  { label: "Active", value: CaseStatus.Active },
  { label: "Archived", value: CaseStatus.Archived },
  { label: "Completed", value: CaseStatus.Completed },
]

const initialValues: FormValues = {
  name: "",
  code: "",
  description: "",
  methodology: "",
  category: "",
  status: CaseStatus.Draft,
  tags: [],
  assignments: [],
}

function NewCasePage() {
  return (
    <RequirePermission permission={Permission.CreateCases}>
      <NewCaseWorkspace />
    </RequirePermission>
  )
}

function NewCaseWorkspace() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useUI()
  const [values, setValues] = useState<FormValues>(initialValues)
  const [tagInput, setTagInput] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})

  const {
    data: users = [],
    isLoading: isLoadingUsers,
    error: usersError,
  } = useQuery({
    queryKey: ["assignable-users"],
    queryFn: UserApi.listUsers,
  })

  const mutation = useMutation({
    mutationFn: CaseApi.createCase,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cases"] })
      showToast("Case created", "success", {
        description: "The new case has been successfully created.",
      })
      await navigate({ to: "/cases" })
    },
    onError: (error) => {
      setErrors({
        form: error instanceof Error ? error.message : "Case could not be created.",
      })
    },
  })

  const selectedStatusLabel = useMemo(
    () =>
      statusOptions.find((option) => option.value === values.status)?.label ??
      "Draft",
    [values.status]
  )

  function updateField<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key]
  ) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validateForm(values)
    setErrors(validation.errors)
    if (!validation.payload) return

    mutation.mutate(validation.payload)
  }

  function addTag() {
    const tag = tagInput.trim()
    if (!tag) return

    setValues((current) => {
      if (current.tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
        return current
      }
      return { ...current, tags: [...current.tags, tag] }
    })
    setTagInput("")
  }

  function removeTag(tag: string) {
    setValues((current) => ({
      ...current,
      tags: current.tags.filter((existing) => existing !== tag),
    }))
  }

  function toggleAssignment(userId: string, checked: boolean) {
    setValues((current) => {
      if (!checked) {
        return {
          ...current,
          assignments: current.assignments.filter(
            (assignment) => assignment.userId !== userId
          ),
        }
      }

      if (
        current.assignments.some((assignment) => assignment.userId === userId)
      ) {
        return current
      }

      return {
        ...current,
        assignments: [
          ...current.assignments,
          { userId, role: CaseAssignmentRole.Viewer },
        ],
      }
    })
  }

  function updateAssignmentRole(
    userId: string,
    role: CaseAssignmentRoleValue
  ) {
    setValues((current) => ({
      ...current,
      assignments: current.assignments.map((assignment) =>
        assignment.userId === userId ? { ...assignment, role } : assignment
      ),
    }))
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Button
            variant="link"
            size="sm"
            className="h-auto w-fit p-0 text-muted-foreground hover:text-foreground"
            render={<Link to="/cases" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Cases
          </Button>
          <h1 className="text-xl font-medium tracking-tight">Create case</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Set up the case shell now. Datasets and partitions can be attached
            once the draft exists.
          </p>
        </div>
      </div>

      {errors.form ? (
        <Alert variant="destructive">
          <AlertTitle>Case could not be created</AlertTitle>
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      ) : null}

      <form
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]"
        onSubmit={handleSubmit}
      >
        <section className="border-l-2 border-l-primary bg-background p-5">
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="case-name">Name</FieldLabel>
              <Input
                id="case-name"
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                aria-invalid={Boolean(errors.name)}
                placeholder="Nordic retail expansion"
              />
              <FieldError>{errors.name}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.code)}>
              <FieldLabel htmlFor="case-code">Code</FieldLabel>
              <Input
                id="case-code"
                value={values.code}
                onChange={(event) =>
                  updateField("code", event.target.value.toUpperCase())
                }
                aria-invalid={Boolean(errors.code)}
                placeholder="R5UX"
              />
              <FieldDescription>
                Use a short unique code your team will recognize.
              </FieldDescription>
              <FieldError>{errors.code}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="case-description">Description</FieldLabel>
              <Textarea
                id="case-description"
                value={values.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="Briefly describe the commercial question, region, or decision context."
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.methodology)}>
                <FieldLabel htmlFor="case-methodology">Methodology</FieldLabel>
                <Select
                  value={values.methodology || undefined}
                  onValueChange={(value) =>
                    updateField("methodology", value ?? "")
                  }
                >
                  <SelectTrigger
                    id="case-methodology"
                    className="w-full"
                    aria-invalid={Boolean(errors.methodology)}
                  >
                    <SelectValue placeholder="Select methodology">
                      {SELECTABLE_METHODOLOGIES.find(
                        (option) => option.value === values.methodology
                      )?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {SELECTABLE_METHODOLOGIES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Determines the partition workflow after datasets are ready.
                </FieldDescription>
                <FieldError>{errors.methodology}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="case-category">Category</FieldLabel>
                <Input
                  id="case-category"
                  value={values.category}
                  onChange={(event) =>
                    updateField("category", event.target.value)
                  }
                  placeholder="Retail"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="case-tags">Tags</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="case-tags"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="Add tag"
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  <PlusIcon data-icon="inline-start" />
                  Add
                </Button>
              </div>
              {values.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {values.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove ${tag}`}
                      >
                        <XIcon aria-hidden="true" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Field>

            <DatasetPlaceholders />
          </FieldGroup>
        </section>

        <aside className="flex flex-col gap-5 border-t-2 border-t-primary bg-background p-5">
          <FieldGroup>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                value={values.status}
                onValueChange={(value) =>
                  updateField("status", value as CaseStatusValue)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{selectedStatusLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                New cases usually begin as drafts.
              </FieldDescription>
            </Field>

            <Separator />

            <AssigneePicker
              users={users}
              assignments={values.assignments}
              isLoading={isLoadingUsers}
              error={usersError}
              onToggle={toggleAssignment}
              onRoleChange={updateAssignmentRole}
            />
          </FieldGroup>

          <div className="mt-auto flex flex-col gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              Create case
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              render={<Link to="/cases" />}
            >
              Cancel
            </Button>
          </div>
        </aside>
      </form>
    </div>
  )
}

function validateForm(values: FormValues): {
  errors: FormErrors
  payload?: CreateCasePayload
} {
  const errors: FormErrors = {}
  const name = values.name.trim()
  const code = values.code.trim()

  if (!name) {
    errors.name = "Name is required."
  }

  if (!code) {
    errors.code = "Code is required."
  }

  const methodology = values.methodology.trim()
  if (
    !methodology ||
    !SELECTABLE_METHODOLOGIES.some((option) => option.value === methodology)
  ) {
    errors.methodology = "Select ROI or Visualization."
  }

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  return {
    errors,
    payload: {
      name,
      code,
      description: values.description.trim(),
      methodology,
      category: values.category.trim(),
      status: values.status,
      tags: values.tags.length > 0 ? { labels: values.tags } : {},
      assignments: values.assignments.map((assignment) => ({
        user_id: assignment.userId,
        role: assignment.role,
      })),
    },
  }
}
