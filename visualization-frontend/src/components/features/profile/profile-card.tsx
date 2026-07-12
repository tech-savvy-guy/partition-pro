import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { CurrentUser } from "@/core/api"
import { Can, Permission } from "@/core/rbac"

function getInitials(user: CurrentUser): string {
  const name = user.display_name || user.email
  if (!name) return "U"
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function ProfileFact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0 border p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value || "Not provided"}</p>
    </div>
  )
}

export function ProfileCard({ user }: { user: CurrentUser }) {
  const displayName = user.display_name || user.email || "Signed-in user"
  const email = user.email || "No email returned"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="size-12">
              {user.image ? <AvatarImage src={user.image} alt={displayName} /> : null}
              <AvatarFallback>{getInitials(user)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="truncate">{displayName}</CardTitle>
              <CardDescription className="truncate">{email}</CardDescription>
            </div>
          </div>
          <Badge>{user.role}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <ProfileFact label="First name" value={user.first_name} />
          <ProfileFact label="Last name" value={user.last_name} />
          <ProfileFact label="Department" value={user.department} />
          <ProfileFact label="Job title" value={user.job_title} />
          <ProfileFact label="Role" value={user.role} />
          <Can permission={Permission.ViewAdmin}>
            <ProfileFact label="Permissions" value={`${user.permissions.length}`} />
          </Can>
        </div>
      </CardContent>
    </Card>
  )
}
