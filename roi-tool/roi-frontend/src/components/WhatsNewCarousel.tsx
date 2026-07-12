import * as React from "react";
import { Tile } from "@bain/design-system";
import { useQuery } from "@tanstack/react-query";
import { ChangelogApi } from "@/core/api/dashboard.api";

const AUTO_SCROLL_MS = 2000;

export default function WhatsNewCarousel() {
  const { data = [] } = useQuery({
    queryKey: ["changelogs"],
    queryFn: ChangelogApi.getAll,
  });

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  // Auto-scroll
  React.useEffect(() => {
    if (paused || !data.length) return;

    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % data.length);
    }, AUTO_SCROLL_MS);

    return () => window.clearInterval(id);
  }, [paused, data.length]);

  // Scroll to active
  React.useEffect(() => {
    const container = containerRef.current;
    const el = itemRefs.current[activeIndex];
    if (!container || !el) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const offset =
      elRect.top -
      containerRect.top -
      containerRect.height / 2 +
      elRect.height / 2;

    container.scrollTo({
      top: container.scrollTop + offset,
      behavior: "smooth",
    });
  }, [activeIndex]);

  return (
    <Tile
      className="
        p-0
        rounded-3xl
        shadow-md
        overflow-hidden
        h-[320px]
        flex flex-col
      "
    >
      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto px-5 pt-4 pb-3"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="flex flex-col gap-4">
          {data.map((item, idx) => {
            const isActive = idx === activeIndex;

            return (
              <div
                key={item.id}
                ref={(el) => (itemRefs.current[idx] = el)}
                className={`
                  relative pl-6 transition-all duration-500 ease-out
                  ${isActive ? "scale-[1.07]" : "scale-100"}
                `}
                style={{
                  opacity: isActive ? 1 : 0.55,
                }}
              >
                {/* Dot */}
                <div
                  className={`
                    absolute left-[-9px] top-1.5
                    w-3 h-3 rounded-full
                    transition-all
                    ${isActive ? "bg-[#C41230]" : "bg-gray-300"}
                  `}
                />

                {/* Date */}
                <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400">
                  {new Date(item.created_on).toLocaleDateString(undefined, {
                    month: "short",
                    year: "numeric",
                  })}
                </p>

                {/* Content */}
                <p className="mt-1 text-[13px] font-semibold text-gray-900">
                  {item.heading}
                </p>
                <p className="text-[12px] text-gray-500">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-[#f8f3ff] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white text-[#5e3ab9] text-xs font-semibold">
            i
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#3f2b88]">
              See full changelog
            </p>
            <p className="text-[11px] text-[#6d5aa6]">
              Contact the PartitionPro team for the latest release notes.
            </p>
          </div>
        </div>
      </div>
    </Tile>
  );
}
