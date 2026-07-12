import * as React from "react"
import { Link, Navigate, createFileRoute, redirect } from "@tanstack/react-router"
import { BarChart3Icon, ShieldCheckIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAuth } from "@/core/auth/authContext"

export const Route = createFileRoute("/home/")({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: HomePage,
})

function HomePage() {
  const { isAuthenticated, isLoading } = useAuth()

  React.useEffect(() => {
    if (isLoading) return

    const url = new URL(window.location.href)
    const msalParams = ["state", "session_state"]
    const hasMsalParams = msalParams.some((param) => url.searchParams.has(param))

    if (!hasMsalParams) return

    for (const param of msalParams) {
      url.searchParams.delete(param)
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(window.history.state, "", nextUrl || "/home")
  }, [isLoading])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center border bg-background">
            <BarChart3Icon aria-hidden="true" />
          </div>
          <CardTitle>Visualization</CardTitle>
          <CardDescription>
            A secure workspace for partition analytics. Sign in with your organization
            account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>Single sign-on with Microsoft Entra ID</p>
          <p>Authenticated API access for protected data</p>
          <p>Session persistence across reloads</p>
        </CardContent>
        <CardFooter>
          <Link to="/login" className={buttonVariants({ className: "w-full" })}>
            <ShieldCheckIcon data-icon="inline-start" />
            Sign in to get started
          </Link>
        </CardFooter>
      </Card>
    </main>
  )
}
