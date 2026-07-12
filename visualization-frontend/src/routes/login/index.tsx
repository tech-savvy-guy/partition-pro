import { InteractionStatus } from "@azure/msal-browser"
import { useMsal } from "@azure/msal-react"
import { Navigate, createFileRoute, redirect } from "@tanstack/react-router"
import { Building2Icon, ShieldCheckIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/core/auth/authContext"

type LoginSearch = {
  redirect?: string
}

function sanitizeRedirect(value: unknown): string {
  if (typeof value !== "string") return "/dashboard"
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard"

  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return "/dashboard"
    if (url.pathname === "/login" || url.pathname === "/home") return "/dashboard"
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/dashboard"
  }
}

export const Route = createFileRoute("/login/")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: sanitizeRedirect(search.redirect),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: search.redirect || "/dashboard" })
    }
  },
  component: LoginScreen,
})

function LoginScreen() {
  const search = Route.useSearch()
  const { inProgress } = useMsal()
  const { isAuthenticated, isLoading, login } = useAuth()
  const isSigningIn = isLoading || inProgress !== InteractionStatus.None

  if (isAuthenticated) {
    return <Navigate to={search.redirect || "/dashboard"} replace />
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center border bg-background">
              <ShieldCheckIcon aria-hidden="true" />
            </div>
            <Badge variant="secondary">Microsoft Entra ID</Badge>
          </div>
          <CardTitle>Sign in to Visualization</CardTitle>
          <CardDescription>
            Use your organization account to access protected visualization data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Building2Icon aria-hidden="true" />
            <AlertTitle>Enterprise access</AlertTitle>
            <AlertDescription>
              Authentication is handled by Microsoft. The API only accepts Entra
              access tokens for this application.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button className="w-full" disabled={isSigningIn} onClick={login}>
            {isSigningIn ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ShieldCheckIcon data-icon="inline-start" />
            )}
            Sign in with Microsoft
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
