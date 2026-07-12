import { createFileRoute } from "@tanstack/react-router"
import { useUI } from "@/core/ui"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/test/")({
  component: RouteComponent,
})

function RouteComponent() {
  const { showToast } = useUI()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Variants</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              showToast("Notification", "default", {
                description: "A plain notification.",
              })
            }
          >
            Default
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              showToast("Success", "success", {
                description: "Changes saved successfully.",
              })
            }
          >
            Success
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              showToast("Error", "error", {
                description: "Something went wrong.",
              })
            }
          >
            Error
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              showToast("Info", "info", {
                description: "Heads up — read this.",
              })
            }
          >
            Info
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          With description
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              showToast("Dataset uploaded", "success", {
                description: "POS V2 is now available across all partitions.",
              })
            }
          >
            Success + description
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              showToast("Upload failed", "error", {
                description: "The file exceeded the 50 MB limit. Try again.",
              })
            }
          >
            Error + description
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">
          With action button
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              showToast("Partition deleted", "success", {
                description: "This can be undone.",
                action: {
                  label: "Undo",
                  onClick: () => showToast("Partition restored", "info"),
                },
              })
            }
          >
            Action (Undo)
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              showToast("New version available", "info", {
                description: "Reload to get the latest build.",
                action: {
                  label: "Reload",
                  onClick: () => window.location.reload(),
                },
              })
            }
          >
            Action (Reload)
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Duration</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              showToast("Heads up", "info", {
                description: "Quick heads up.",
                duration: 1500,
              })
            }
          >
            Short (1.5s)
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              showToast("Attention", "error", {
                duration: 0,
                description: "This stays until dismissed.",
              })
            }
          >
            Sticky (no auto-dismiss)
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Stacking</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              showToast("First toast", "success")
              showToast("Second toast", "info", {
                description: "Hover the stack to expand it.",
              })
              showToast("Third toast", "error")
            }}
          >
            Fire 3 at once
          </Button>
        </div>
      </section>
    </div>
  )
}
