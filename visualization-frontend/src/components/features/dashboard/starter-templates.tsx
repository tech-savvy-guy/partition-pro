import { DownloadIcon } from "lucide-react"

type Template = {
  title: string
  href: string
}

export function StarterTemplates({ templates }: { templates: Template[] }) {
  return (
    <div className="flex flex-col">
      <p className="mb-3 text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
        Starter templates
      </p>
      {templates.map((template, index) => (
        <a
          key={template.title}
          href={template.href}
          download
          className={`group flex items-center justify-between gap-3 py-2.5 transition-colors hover:text-foreground ${
            index < templates.length - 1 ? "border-b border-border" : ""
          }`}
        >
          <p className="text-sm text-foreground/70 transition-colors group-hover:text-foreground">
            {template.title}
          </p>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground transition-colors group-hover:text-foreground"
            aria-hidden="true"
          >
            <DownloadIcon className="size-3.5" />
          </span>
        </a>
      ))}
    </div>
  )
}
