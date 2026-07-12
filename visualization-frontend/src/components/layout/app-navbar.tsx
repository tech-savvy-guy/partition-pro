import { Link, useLocation } from "@tanstack/react-router"
import { LogOutIcon, MenuIcon, Network } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { AuthUser } from "@/core/auth/auth.types"

const navLinks = [
  { title: "Dashboard", href: "/dashboard", type: "route" },
  { title: "Cases", href: "/cases", type: "route" },
  { title: "Knowledge", href: "/knowledge-center", type: "route" },
  { title: "Settings", href: "/settings", type: "route" },
  { title: "Profile", href: "/profile", type: "route" },
]

function getInitials(user: AuthUser | null): string {
  const name = user?.display_name || user?.email || "U"
  if (!name) return "U" // Fallback

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavItem({
  href,
  isActive,
  title,
}: {
  href: string
  isActive: boolean
  title: string
}) {
  const className = cn(
    "relative px-1 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
    "after:absolute after:right-1 after:bottom-0 after:left-1 after:h-px after:origin-left after:scale-x-0 after:bg-primary after:transition-transform",
    isActive && "font-medium text-foreground after:scale-x-100"
  )

  if (href.startsWith("/")) {
    return (
      <Link
        to={href}
        className={className}
        aria-current={isActive ? "page" : undefined}
      >
        {title}
      </Link>
    )
  }

  return (
    <a href={href} className={className}>
      {title}
    </a>
  )
}

export function AppNavbar({
  user,
  onLogout,
}: {
  user: AuthUser | null
  onLogout: () => void
}) {
  const displayName = user?.display_name || user?.email || "Signed-in user"
  const { pathname } = useLocation()
  const isProfileActive = isActivePath(pathname, "/profile")

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-13 w-full items-center gap-5 px-4 sm:px-6">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
              />
            }
          >
            <MenuIcon />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0" showCloseButton>
            <SheetHeader className="p-4">
              <SheetTitle>
                <Link
                  to="/dashboard"
                  className="flex min-w-0 items-center gap-2"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center bg-primary text-background">
                    <Network className="size-4" aria-hidden="true" />
                  </span>
                  <span className="block truncate text-sm font-medium">
                    PartitionPro
                  </span>
                </Link>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-2">
              {navLinks.map((link) => {
                const isActive =
                  link.type === "route" && isActivePath(pathname, link.href)

                return (
                  <NavItem
                    key={link.title}
                    href={link.href}
                    isActive={isActive}
                    title={link.title}
                  />
                )
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center bg-primary text-background">
            <Network className="size-4" aria-hidden="true" />
          </span>
          <span className="block truncate text-sm font-medium">
            PartitionPro
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 lg:flex">
          {navLinks.map((link) => {
            const isActive =
              link.type === "route" && isActivePath(pathname, link.href)

            return (
              <NavItem
                key={link.title}
                href={link.href}
                isActive={isActive}
                title={link.title}
              />
            )
          })}
        </nav>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          <Link to="/profile" aria-label="View profile">
            <Avatar
              className={cn(
                "size-8 border transition-opacity hover:opacity-80",
                isProfileActive && "border-primary"
              )}
            >
              {user?.image ? (
                <AvatarImage src={user.image} alt={displayName} />
              ) : null}
              <AvatarFallback className="text-xs">
                {getInitials(user)}
              </AvatarFallback>
            </Avatar>
          </Link>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOutIcon className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
