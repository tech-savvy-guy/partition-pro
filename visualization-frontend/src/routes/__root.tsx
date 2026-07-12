import { Outlet, createRootRouteWithContext } from "@tanstack/react-router"

import type { AuthContextValue } from "@/core/auth/auth.types"
import { GlobalErrorBoundary } from "@/core/error/GlobalErrorBoundary"

export interface RouterContext {
  auth: AuthContextValue
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <GlobalErrorBoundary>
      <Outlet />
    </GlobalErrorBoundary>
  )
}
