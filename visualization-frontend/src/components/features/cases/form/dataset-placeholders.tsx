import { DatabaseIcon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const datasetPlaceholders = [
  "Point of sales data",
  "Attributes sheet",
  "Cross-purchase sheet",
]

export function DatasetPlaceholders() {
  return (
    <div className="flex flex-col gap-3 border-t pt-5">
      <div className="flex items-center gap-2">
        <DatabaseIcon aria-hidden="true" className="text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Datasets</p>
          <p className="text-sm text-muted-foreground">
            Attach source files while the case shell is created.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {datasetPlaceholders.map((label) => (
          <div
            key={label}
            className="flex min-h-28 flex-col justify-between border border-dashed bg-muted/30 p-3"
          >
            <p className="text-sm font-medium">{label}</p>
            <Button type="button" variant="outline" size="sm" disabled>
              <UploadIcon data-icon="inline-start" />
              Upload
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
