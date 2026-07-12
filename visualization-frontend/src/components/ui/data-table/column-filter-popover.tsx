import { useEffect, useState } from "react"
import type { Column } from "@tanstack/react-table"
import { FilterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import {
  isFilterActive,
  isValuelessOperator,
  makeEmptyFilter,
  operatorsForType,
} from "./filter-fn"
import type {
  AdvancedFilterValue,
  ColumnType,
  FilterCondition,
  FilterOperator,
  JoinOp,
} from "./types"

export function ColumnFilterPopover<TData>({
  column,
}: {
  column: Column<TData, unknown>
}) {
  const type: ColumnType = column.columnDef.meta?.type ?? "text"
  const current = column.getFilterValue() as AdvancedFilterValue | undefined
  const active = isFilterActive(current)

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<AdvancedFilterValue>(
    () => current ?? makeEmptyFilter(type),
  )

  // Re-sync the draft to the committed filter each time the popover opens.
  useEffect(() => {
    if (open) {
      setDraft(
        (column.getFilterValue() as AdvancedFilterValue | undefined) ??
          makeEmptyFilter(type),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const options = operatorsForType(type)
  const secondActive =
    isValuelessOperator(draft.conditions[1]?.op) ||
    (draft.conditions[1]?.value?.trim() ?? "") !== ""

  function updateCondition(index: number, patch: Partial<FilterCondition>) {
    setDraft((prev) => {
      const conditions = prev.conditions.map((c, i) =>
        i === index ? { ...c, ...patch } : c,
      )
      return { ...prev, conditions }
    })
  }

  function apply() {
    const normalized = normalizeFilter(draft)
    column.setFilterValue(normalized)
    setOpen(false)
  }

  function clear() {
    setDraft(makeEmptyFilter(type))
    column.setFilterValue(undefined)
    setOpen(false)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault()
      apply()
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Filter column"
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground/50 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          active && "text-primary hover:text-primary",
        )}
      >
        <FilterIcon className={cn("size-3", active && "fill-primary/20")} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 gap-3"
        onKeyDown={onKeyDown}
      >
        <ConditionRow
          options={options}
          condition={draft.conditions[0]}
          onChange={(patch) => updateCondition(0, patch)}
        />

        <div className="flex items-center gap-3">
          <RadioGroup
            value={draft.join}
            onValueChange={(value) =>
              setDraft((prev) => ({ ...prev, join: value as JoinOp }))
            }
            className="flex flex-row items-center gap-3"
          >
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <RadioGroupItem value="AND" />
              Match all
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <RadioGroupItem value="OR" />
              Match any
            </label>
          </RadioGroup>
        </div>

        <ConditionRow
          options={options}
          condition={draft.conditions[1]}
          onChange={(patch) => updateCondition(1, patch)}
          dimmed={!secondActive}
        />

        <div className="flex items-center justify-between pt-0.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={clear}
          >
            Clear
          </Button>
          <Button type="button" size="xs" onClick={apply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ConditionRow({
  options,
  condition,
  onChange,
  dimmed = false,
}: {
  options: { label: string; value: FilterOperator }[]
  condition: FilterCondition
  onChange: (patch: Partial<FilterCondition>) => void
  dimmed?: boolean
}) {
  const valueless = isValuelessOperator(condition.op)

  return (
    <div className={cn("flex flex-col gap-1.5", dimmed && "opacity-70")}>
      <Select
        value={condition.op}
        onValueChange={(value) =>
          onChange({ op: value as FilterOperator })
        }
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!valueless && (
        <Input
          value={condition.value}
          placeholder="Value"
          className="h-7 text-xs"
          onChange={(event) => onChange({ value: event.target.value })}
        />
      )}
    </div>
  )
}

/** Drop the inert second condition / return undefined when nothing is active. */
function normalizeFilter(
  value: AdvancedFilterValue,
): AdvancedFilterValue | undefined {
  const conditions = value.conditions.filter(
    (c) => isValuelessOperator(c.op) || (c.value?.trim() ?? "") !== "",
  )
  if (conditions.length === 0) return undefined
  return { join: value.join, conditions }
}
