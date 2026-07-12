import { createFileRoute } from "@tanstack/react-router"
import { RefreshCwIcon, ShieldCheckIcon } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ProfileCard } from "@/components/features/profile"
import { UserApi } from "@/core/api/user/user.api"

export const Route = createFileRoute("/_authed/profile/")({
  component: ProfilePage,
})

function ProfilePage() {
  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ["current-user"],
    queryFn: UserApi.getCurrentUser,
  })

  if (error) {
    return (
      <Alert variant="destructive">
        <ShieldCheckIcon aria-hidden="true" />
        <AlertTitle>Failed to load profile</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>{error instanceof Error ? error.message : "Unknown error"}</span>
          <Button variant="outline" onClick={() => void refetch()}>
            <RefreshCwIcon data-icon="inline-start" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoading || !user) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account details and workspace role.
        </p>
      </div>
      <div className="max-w-2xl">
        <ProfileCard user={user} />
      </div>
    </div>
  )
}
