export function WorkflowPlaceholder({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-8 py-16">
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
