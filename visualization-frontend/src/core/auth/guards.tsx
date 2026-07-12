import { Navigate } from "@tanstack/react-router"

import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/core/auth/authContext"

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 p-6">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  return <>{children}</>
}
