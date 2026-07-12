export function DatasetChip({
  dataset,
}: {
  dataset: { name: string; version: string }
}) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 border border-border/70 bg-background/70 px-2 text-[11px] font-medium text-foreground/85 backdrop-blur-sm">
      <span className="max-w-28 truncate tracking-normal uppercase">
        {dataset.name}
      </span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {dataset.version}
      </span>
    </span>
  )
}
