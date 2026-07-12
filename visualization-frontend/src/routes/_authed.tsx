import {
  Navigate,
  Outlet,
  createFileRoute,
  useLocation,
} from "@tanstack/react-router"

import { AppShell } from "@/components/layout/app-shell"
import { useAuth } from "@/core/auth/authContext"

export const Route = createFileRoute("/_authed")({
  component: AuthedLayout,
})

function AuthedLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        search={{ redirect: location.pathname }}
        replace
      />
    )
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
