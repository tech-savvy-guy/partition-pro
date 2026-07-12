import { Navigate, createFileRoute } from "@tanstack/react-router"

import { useAuth } from "@/core/auth/authContext"

export const Route = createFileRoute("/")({
  component: Index,
})

function Index() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  return <Navigate to={isAuthenticated ? "/dashboard" : "/home"} replace />
}
