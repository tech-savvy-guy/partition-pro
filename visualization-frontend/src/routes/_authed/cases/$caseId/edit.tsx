import { type FormEvent, useEffect, useMemo, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  PlusIcon,
  SaveIcon,
  XIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  CaseApi,
  CaseStatus,
  type Case,
  type CaseStatus as CaseStatusValue,
  type UpdateCasePayload,
} from "@/core/api"
import { SELECTABLE_METHODOLOGIES } from "@/core/workflow"
import { Permission, RequirePermission } from "@/core/rbac"
import { useUI } from "@/core/ui"

export const Route = createFileRoute("/_authed/cases/$caseId/edit")({
  component: EditCasePage,
})

type FormValues = {
  name: string
  code: string
  description: string
  methodology: string
  category: string
  status: CaseStatusValue
  tags: string[]
}

type FormErrors = Partial<Record<keyof FormValues | "form", string>>

const statusOptions: Array<{ label: string; value: CaseStatusValue }> = [
  { label: "Draft", value: CaseStatus.Draft },
  { label: "Active", value: CaseStatus.Active },
  { label: "Archived", value: CaseStatus.Archived },
  { label: "Completed", value: CaseStatus.Completed },
]

function EditCasePage() {
  return (
    <RequirePermission permission={Permission.ViewCases}>
      <EditCaseWorkspace />
    </RequirePermission>
  )
}

function EditCaseWorkspace() {
  const { caseId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useUI()
  const [values, setValues] = useState<FormValues | null>(null)
  const [tagInput, setTagInput] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})

  const caseQuery = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => CaseApi.getCase(caseId),
  })

  useEffect(() => {
    if (!caseQuery.data) return

    setValues(toFormValues(caseQuery.data))
    setErrors({})
    setTagInput("")
  }, [caseQuery.data])

  const mutation = useMutation({
    mutationFn: (payload: UpdateCasePayload) =>
      CaseApi.updateCase(caseId, payload),
    onSuccess: async (updatedCase) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cases"] }),
        queryClient.invalidateQueries({ queryKey: ["case", caseId] }),
      ])
      showToast("Case updated", "success", {
        description: "The case details have been successfully updated.",
      })
      await navigate({
        to: "/cases/$caseId",
        params: { caseId: updatedCase.id },
      })
    },
    onError: (error) => {
      setErrors({
        form: error instanceof Error ? error.message : "Case could not be updated.",
      })
    },
  })

  const selectedStatusLabel = useMemo(
    () =>
      statusOptions.find((option) => option.value === values?.status)?.label ??
      "Draft",
    [values?.status]
  )

  const selectedMethodologyLabel = useMemo(
    () =>
      SELECTABLE_METHODOLOGIES.find(
        (option) => option.value === values?.methodology
      )?.label,
    [values?.methodology]
  )

  function updateField<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key]
  ) {
    setValues((current) => (current ? { ...current, [key]: value } : current))
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!values) return

    const validation = validateForm(values)
    setErrors(validation.errors)
    if (!validation.payload) return

    mutation.mutate(validation.payload)
  }

  function addTag() {
    const tag = tagInput.trim()
    if (!tag || !values) return

    setValues((current) => {
      if (!current) return current
      if (
        current.tags.some(
          (existing) => existing.toLowerCase() === tag.toLowerCase()
        )
      ) {
        return current
      }
      return { ...current, tags: [...current.tags, tag] }
    })
    setTagInput("")
  }

  function removeTag(tag: string) {
    setValues((current) =>
      current
        ? {
            ...current,
            tags: current.tags.filter((existing) => existing !== tag),
          }
        : current
    )
  }

  if (caseQuery.isLoading) {
    return <EditCaseSkeleton />
  }

  if (caseQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Case could not be loaded</AlertTitle>
        <AlertDescription>{caseQuery.error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!values) return null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button
          variant="link"
          size="sm"
          className="h-auto w-fit p-0 text-muted-foreground hover:text-foreground"
          render={
            <Link
              to="/cases/$caseId"
              params={{ caseId }}
            />
          }
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Case details
        </Button>
        <h1 className="text-xl font-medium tracking-tight">Edit case</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Update the case shell. Dataset and partition changes stay in their
          own workspaces.
        </p>
      </div>

      {errors.form ? (
        <Alert variant="destructive">
          <AlertTitle>Case could not be updated</AlertTitle>
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      ) : null}

      <form
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.35fr)]"
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
              />
              <FieldDescription>
                Keep this short and recognizable for the team.
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
                      {selectedMethodologyLabel}
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
          </FieldGroup>
        </section>

        <aside className="flex flex-col gap-5 border-t-2 border-t-primary bg-background p-5">
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
          </Field>

          <div className="mt-auto flex flex-col gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              Save changes
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              render={
                <Link
                  to="/cases/$caseId"
                  params={{ caseId }}
                />
              }
            >
              Cancel
            </Button>
          </div>
        </aside>
      </form>
    </div>
  )
}

function toFormValues(caseItem: Case): FormValues {
  const normalizedMethodology = caseItem.methodology.trim().toLowerCase()
  const methodology = SELECTABLE_METHODOLOGIES.some(
    (option) => option.value === normalizedMethodology
  )
    ? normalizedMethodology
    : ""

  return {
    name: caseItem.name,
    code: caseItem.code,
    description: caseItem.description,
    methodology,
    category: caseItem.category,
    status: caseItem.status,
    tags: getTagLabels(caseItem.tags),
  }
}

function validateForm(values: FormValues): {
  errors: FormErrors
  payload?: UpdateCasePayload
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
    },
  }
}

function getTagLabels(tags: Record<string, unknown>) {
  const labels = tags.labels

  if (Array.isArray(labels)) {
    return labels.filter((label): label is string => typeof label === "string")
  }

  return Object.values(tags).filter(
    (value): value is string => typeof value === "string"
  )
}

function EditCaseSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.35fr)]">
        <div className="flex flex-col gap-5 border-l-2 border-l-primary bg-background p-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <div className="flex flex-col gap-5 border-t-2 border-t-primary bg-background p-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="mt-auto h-8 w-full" />
        </div>
      </div>
    </div>
  )
}
