import { AppNavbar } from "@/components/layout/app-navbar"
import { useAuth } from "@/core/auth/authContext"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth()

  return (
    <div className="flex min-h-svh flex-col bg-muted">
      <AppNavbar user={user} onLogout={() => void logout()} />
      <main className="flex-1 overflow-x-clip [scrollbar-color:oklch(0_0_0/0.2)_var(--background)] scrollbar-thin">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </div>
      </main>
      <footer className="border-t bg-primary-foreground">
        <div className="flex w-full items-center justify-between px-4 py-2 sm:px-6">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Bain & Company. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Made with ❤️ by Consumer Products at BCN
          </p>
        </div>
      </footer>
    </div>
  )
}
