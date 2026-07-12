import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { TabBtn } from "../shared/tab-btn"

export function SkuSelectionHeader({
  tabs,
  activeTab,
  onTabChange,
  disabledTabs = [],
}: {
  tabs: { value: string; label: string }[]
  activeTab: string
  onTabChange: (tab: string) => void
  disabledTabs?: string[]
}) {
  return (
    <TooltipProvider>
      <div className="sticky top-[calc(3.25rem+3rem)] z-30 flex h-12 items-center justify-between border-b bg-background px-8">
        <div className="flex items-center gap-0 overflow-x-auto">
          {tabs.map((tab) => {
            const isDisabled = disabledTabs.includes(tab.value)
            const tabBtn = (
              <TabBtn
                isActive={activeTab === tab.value}
                onClick={() => onTabChange(tab.value)}
                size="sm"
                disabled={isDisabled}
                activeBorderClassName="bg-foreground"
              >
                {tab.label}
              </TabBtn>
            )

            if (isDisabled) {
              return (
                <Tooltip key={tab.value}>
                  <TooltipTrigger
                    render={
                      <span className="inline-block cursor-not-allowed">
                        {tabBtn}
                      </span>
                    }
                  />
                  <TooltipContent>
                    Run the workflow in SKU Selection to unlock this tab
                  </TooltipContent>
                </Tooltip>
              )
            }

            return (
              <TabBtn
                key={tab.value}
                isActive={activeTab === tab.value}
                onClick={() => onTabChange(tab.value)}
                size="sm"
                disabled={false}
                activeBorderClassName="bg-foreground"
              >
                {tab.label}
              </TabBtn>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}

