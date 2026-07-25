import { type FormEvent, useMemo, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftIcon, PlusIcon, SaveIcon, XIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
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
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  CaseApi,
  PartitionApi,
  PartitionStatus,
  type CreatePartitionPayload,
  type Partition,
  type PartitionStatus as PartitionStatusValue,
} from "@/core/api"
import { useUI } from "@/core/ui"
import { Permission, RequirePermission } from "@/core/rbac"

export const Route = createFileRoute("/_authed/cases/$caseId/partitions/new")({
  component: NewPartitionPage,
})

type FormValues = {
  name: string
  description: string
  status: PartitionStatusValue
  isShared: boolean
  tags: string[]
  basePartition: string
}

type FormErrors = Partial<Record<keyof FormValues | "form", string>>

const noneValue = "__none__"

const statusOptions: Array<{ label: string; value: PartitionStatusValue }> = [
  { label: "Draft", value: PartitionStatus.Draft },
  { label: "Active", value: PartitionStatus.Active },
  { label: "Archived", value: PartitionStatus.Archived },
]

const initialValues: FormValues = {
  name: "",
  description: "",
  status: PartitionStatus.Draft,
  isShared: false,
  tags: [],
  basePartition: noneValue,
}

function NewPartitionPage() {
  return (
    <RequirePermission
      anyOf={[Permission.CreatePartitions, Permission.ViewCases]}
    >
      <NewPartitionWorkspace />
    </RequirePermission>
  )
}

function NewPartitionWorkspace() {
  const params = Route.useParams()
  const caseId = params.caseId
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useUI()
  const [values, setValues] = useState<FormValues>(initialValues)
  const [tagInput, setTagInput] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})

  const caseQuery = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => CaseApi.getCase(caseId),
  })
  const partitionsQuery = useQuery({
    queryKey: ["case-partitions", caseId],
    queryFn: () => PartitionApi.listPartitions(caseId),
  })

  const mutation = useMutation({
    mutationFn: (payload: CreatePartitionPayload) =>
      PartitionApi.createPartition(caseId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["case-partitions", caseId],
      })
      showToast("Partition created", "success", {
        description: "The new partition has been successfully created.",
      })
      await navigate({ to: "/cases/$caseId", params: { caseId } })
    },
    onError: (error) => {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "Partition could not be created.",
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

  function addTag() {
    const tag = tagInput.trim()
    if (!tag) return

    setValues((current) => {
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
    setValues((current) => ({
      ...current,
      tags: current.tags.filter((existing) => existing !== tag),
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validateForm(values)
    setErrors(validation.errors)
    if (!validation.payload) return

    mutation.mutate(validation.payload)
  }

  const pageError = caseQuery.error || partitionsQuery.error

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button
          variant="link"
          size="sm"
          className="h-auto w-fit p-0 text-muted-foreground hover:text-foreground"
          render={
            <Link to="/cases/$caseId" params={{ caseId }} />
          }
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {caseQuery.data?.name ?? "Case"}
        </Button>
        <h1 className="text-xl font-medium tracking-tight">
          Create partition
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Add a partition to this case, including sharing and lineage metadata.
        </p>
      </div>

      {pageError ? (
        <Alert variant="destructive">
          <AlertTitle>Reference data could not be loaded</AlertTitle>
          <AlertDescription>
            {pageError instanceof Error ? pageError.message : "Unknown error"}
          </AlertDescription>
        </Alert>
      ) : null}

      {errors.form ? (
        <Alert variant="destructive">
          <AlertTitle>Partition could not be created</AlertTitle>
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
              <FieldLabel htmlFor="partition-name">Name</FieldLabel>
              <Input
                id="partition-name"
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                aria-invalid={Boolean(errors.name)}
                placeholder="Segment 1 - Urban grocery chains"
              />
              <FieldError>{errors.name}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="partition-description">
                Description
              </FieldLabel>
              <Textarea
                id="partition-description"
                value={values.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="Describe the partition logic, segment, or working hypothesis."
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="partition-tags">Tags</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="partition-tags"
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
          <FieldGroup>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                value={values.status}
                onValueChange={(value) =>
                  updateField("status", value as PartitionStatusValue)
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

            <Field orientation="horizontal">
              <FieldLabel htmlFor="partition-shared">Shared</FieldLabel>
              <Switch
                id="partition-shared"
                checked={values.isShared}
                onCheckedChange={(checked) =>
                  updateField("isShared", Boolean(checked))
                }
              />
            </Field>

            <Separator />

            <PartitionSelect
              label="Base partition"
              value={values.basePartition}
              partitions={partitionsQuery.data ?? []}
              onValueChange={(value) => updateField("basePartition", value)}
            />
          </FieldGroup>

          <div className="mt-auto flex flex-col gap-2">
            <Button
              type="submit"
              disabled={mutation.isPending || Boolean(pageError)}
            >
              {mutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <SaveIcon data-icon="inline-start" />
              )}
              Create partition
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              render={
                <Link to="/cases/$caseId" params={{ caseId }} />
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

function PartitionSelect({
  label,
  value,
  partitions,
  onValueChange,
}: {
  label: string
  value: string
  partitions: Partition[]
  onValueChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={(v) => onValueChange(v ?? "")}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {value === noneValue
              ? "None"
              : partitions.find((partition) => partition.id === value)?.name}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={noneValue}>None</SelectItem>
            {partitions.map((partition) => (
              <SelectItem key={partition.id} value={partition.id}>
                {partition.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function validateForm(values: FormValues): {
  errors: FormErrors
  payload?: CreatePartitionPayload
} {
  const errors: FormErrors = {}
  const name = values.name.trim()

  if (!name) {
    errors.name = "Name is required."
  }

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  return {
    errors,
    payload: {
      name,
      description: values.description.trim(),
      status: values.status,
      is_shared: values.isShared,
      tags: values.tags.length > 0 ? { labels: values.tags } : {},
      base_partition:
        values.basePartition === noneValue ? null : values.basePartition,
    },
  }
}
