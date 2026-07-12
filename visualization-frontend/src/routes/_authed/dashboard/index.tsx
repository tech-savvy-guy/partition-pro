import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { RefreshCwIcon, ShieldCheckIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowRightIcon, PlusIcon } from "lucide-react"
import {
  ArticleLinks,
  ChangelogPanel,
  RecentCaseCard,
  StarterTemplates,
  StatCard,
} from "@/components/features/dashboard"
import type { CurrentUser } from "@/core/api"
import { UserApi } from "@/core/api/user/user.api"
import { Permission, RequirePermission } from "@/core/rbac"

export const Route = createFileRoute("/_authed/dashboard/")({
  component: DashboardPage,
})

const recentCase = {
  name: "Nordic Retail Expansion - Phase II",
  caseCode: "R5UX",
  method: "ROI",
  status: "In Progress",
  lastEdited: "2h ago",
  description:
    "ROI model flagged for partner review. Awaiting sign-off on segment assumptions before final delivery.",
  lastPartition: "Segment 3 - Urban Grocery Chains",
  members: [
    { name: "Alex Rowe", initials: "AR" },
    { name: "Priya Kapoor", initials: "PK" },
    { name: "Tom Bauer", initials: "TB" },
  ],
}

const templates = [
  { title: "Point of Sales Data", href: "#" },
  { title: "CrossPurchase Sheet", href: "#" },
  { title: "Attributes Sheet", href: "#" },
]

const articleLinks = [
  {
    title: "Market segmentation",
    description:
      "A quick refresher on grouping customers, needs, and purchase behavior.",
    href: "https://en.wikipedia.org/wiki/Market_segmentation",
  },
  {
    title: "Market analysis",
    description:
      "Useful framing for sizing markets, risks, trends, and opportunity spaces.",
    href: "https://en.wikipedia.org/wiki/Market_analysis",
  },
]

const changelogEntries = [
  {
    version: "v0.4.2",
    date: "Jun 12",
    type: "feature" as const,
    title: "Partition export to Excel",
    description:
      "Export any partition set to .xlsx directly from the case view.",
  },
  {
    version: "v0.4.1",
    date: "Jun 8",
    type: "fix" as const,
    title: "ROI recalculation fix",
    description:
      "Segment-level ROI totals were incorrect when switching between partition methods.",
  },
  {
    version: "v0.4.0",
    date: "Jun 3",
    type: "improvement" as const,
    title: "Faster partition mapping",
    description:
      "Mapping now runs client-side for sets under 500 rows — no server round-trip needed.",
  },
]

function DashboardPage() {
  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["current-user"],
    queryFn: UserApi.getCurrentUser,
  })

  if (error) {
    return (
      <Alert variant="destructive">
        <ShieldCheckIcon aria-hidden="true" />
        <AlertTitle>Authenticated API check failed</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>
            {error instanceof Error ? error.message : "Unknown error"}
          </span>
          <Button variant="outline" onClick={() => void refetch()}>
            <RefreshCwIcon data-icon="inline-start" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoading || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading profile</CardTitle>
          <CardDescription>
            Checking the authenticated API session.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <RequirePermission permission={Permission.ViewDashboards}>
      <DashboardWorkspace user={user} />
    </RequirePermission>
  )
}

function DashboardWorkspace({ user }: { user: CurrentUser }) {
  const displayName = user.first_name || user.display_name || "there"

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-medium tracking-tight">
          Good to see you, {displayName}! 👋🏻
          <br />
          <span className="text-base font-normal text-muted-foreground">
            Here's what's happening with your cases today
          </span>
        </h1>
        <div className="flex shrink-0 items-center gap-4">
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-muted-foreground hover:text-foreground"
            render={<a href="/cases" />}
          >
            View cases
            <ArrowRightIcon className="size-3.5" />
          </Button>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-primary"
            render={<a href="/cases/new" />}
          >
            Create case
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Recent case + Templates */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <RecentCaseCard recentCase={recentCase} />
        <StarterTemplates templates={templates} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.6fr)]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Total Cases"
              value={18}
              imageSrc="/assets/image-1.png"
              imageStyle={{ position: "relative", right: "-20px", bottom: "55px" }}
            />
            <StatCard
              label="Total Partitions"
              value={124}
              imageSrc="/assets/image-3.png"
              imageStyle={{ position: "relative", right: "-20px", bottom: "50px" }}
            />
          </div>
          <ArticleLinks articles={articleLinks} />
        </div>
        <ChangelogPanel entries={changelogEntries} />
      </section>
    </div>
  )
}
