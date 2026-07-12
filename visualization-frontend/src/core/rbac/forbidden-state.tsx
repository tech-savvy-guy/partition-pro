import { ShieldXIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type ForbiddenStateProps = {
  title?: string
  description?: string
}

export function ForbiddenState({
  title = "Access denied",
  description = "You do not have permission to view this area.",
}: ForbiddenStateProps) {
  return (
    <Alert variant="destructive">
      <ShieldXIcon aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  )
}
