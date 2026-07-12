import { Card } from "@/components/ui/card"

export function StatCard({
  label,
  value,
  imageSrc,
  imageStyle,
}: {
  label: string
  value: string | number
  imageSrc: string
  imageStyle?: React.CSSProperties
}) {
  return (
    <Card className="h-28 overflow-hidden border-l-2 border-primary bg-background shadow-none transition-shadow hover:shadow-md">
      <div className="flex h-full items-stretch">
        <div className="flex flex-1 flex-col gap-1 px-6 py-5">
          <p className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
            {label}
          </p>
          <p className="text-4xl font-light tracking-tight tabular-nums">
            {value}
          </p>
        </div>
        <div
          className="pointer-events-none shrink-0 select-none"
          style={imageStyle}
        >
          <img
            src={imageSrc}
            alt=""
            aria-hidden="true"
            className="h-[200px] w-[200px] object-contain"
          />
        </div>
      </div>
    </Card>
  )
}
