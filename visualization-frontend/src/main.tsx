import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { MsalProvider } from "@azure/msal-react"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"

import "@/index.css"
import { initializeMsal, msalInstance } from "@/core/auth/msalInstance"
import { AuthProvider, useAuth } from "@/core/auth/authContext"
import { queryClient } from "@/core/auth/queryClient"
import { ThemeProvider, UIProvider } from "@/core/ui"
import { routeTree } from "@/routeTree.gen"

const router = createRouter({
  routeTree,
  context: { auth: undefined! },
  defaultPreload: "intent",
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

function RouterWithAuth() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

initializeMsal().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider>
              <UIProvider>
                <RouterWithAuth />
              </UIProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </MsalProvider>
    </StrictMode>
  )
})
