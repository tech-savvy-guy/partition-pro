import { ArrowRightIcon } from "lucide-react"

type ArticleLink = {
  title: string
  description: string
  href: string
}

export function ArticleLinks({ articles }: { articles: ArticleLink[] }) {
  return (
    <div className="flex flex-col">
      {articles.map((article, index) => (
        <a
          key={article.title}
          href={article.href}
          target="_blank"
          rel="noreferrer"
          className={`group flex items-center justify-between gap-4 bg-background px-5 py-4 transition-colors hover:bg-muted/40 ${
            index === 0 ? "border border-b-0" : "border"
          }`}
        >
          <span className="min-w-0 flex-1">
            <span className="text-sm font-medium">{article.title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {article.description}
            </span>
          </span>
          <span className="flex shrink-0 translate-x-1 items-center gap-1 text-xs font-medium text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
            Read More
            <ArrowRightIcon aria-hidden="true" className="size-3" />
          </span>
        </a>
      ))}
    </div>
  )
}
