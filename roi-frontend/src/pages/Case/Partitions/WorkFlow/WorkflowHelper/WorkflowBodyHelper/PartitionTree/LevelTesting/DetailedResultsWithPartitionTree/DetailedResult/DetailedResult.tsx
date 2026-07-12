// src/features/workflow/LevelTesting/DetailedResultsWithPartitionTree/DetailedResult/DetailedResult.tsx
import * as React from "react";
import { Accordion, AccordionItem } from "@bain/design-system";
import LevelTestingMath from "./LevelTestingMath";
import LevelTestingResult from "./LevelTestingResult";
import "../../../../Workflow.css";
import type { LevelTestingPayload, LevelTestingPair } from "../../Index";

type Props = {
  selectedAttribute: string | null;
  levelTesting?: LevelTestingPayload | null;
};

type SubTab = "math" | "results";

type PairLike = {
  L1?: string;
  L2?: string;
};

function titleForPairWithContext(
  pairKey: string,
  pair: PairLike,
  selectedAttribute: string,
) {
  const L1 = String(pair?.L1 ?? "").trim();
  const L2 = String(pair?.L2 ?? "").trim();

  if (L1 === selectedAttribute && L2) return `vs ${L2}`;
  if (L2 === selectedAttribute && L1) return `vs ${L1}`;

  if (L1 && L2) return `${L1} vs ${L2}`;
  return pairKey.replace(/_vs_/g, " vs ");
}

function winnerForPair(pair: LevelTestingPair) {
  const L1 = String(pair?.L1 ?? "L1");
  const L2 = String(pair?.L2 ?? "L2");
  const rw = String((pair as any)?.summary?.round_winner ?? "").trim();

  if (!rw || rw.toLowerCase() === "none") return "None";
  if (rw === "L1") return L1;
  if (rw === "L2") return L2;
  return rw;
}

export default function DetailedResult({
  selectedAttribute,
  levelTesting,
}: Props) {
  const pairsObj = (levelTesting as any)?.pairs ?? {};

  // store which sub-tab is active per accordion section
  const [activeTabBySection, setActiveTabBySection] = React.useState<
    Record<string, SubTab>
  >({});
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>(
    {},
  );
  const hasInitializedSections = React.useRef(false);

  // reset inner-tabs when attribute changes (keeps UX clean)
  React.useEffect(() => {
    setActiveTabBySection({});
    setOpenSections({});
    hasInitializedSections.current = false;
  }, [selectedAttribute]);

  const sections = React.useMemo(() => {
    const entries = Object.entries(
      pairsObj as Record<string, LevelTestingPair>,
    ).map(([pairKey, pair]) => ({
      id: pairKey,
      pairKey,
      pair,
      title: titleForPairWithContext(pairKey, pair, selectedAttribute ?? ""),
    }));

    if (!selectedAttribute) return [];

    // show only comparisons that involve the selected attribute
    const filtered = entries.filter((e) => {
      const L1 = String(e.pair?.L1 ?? "");
      const L2 = String(e.pair?.L2 ?? "");
      return L1 === selectedAttribute || L2 === selectedAttribute;
    });

    // stable sort by title
    filtered.sort((a, b) => a.title.localeCompare(b.title));
    return filtered;
  }, [pairsObj, selectedAttribute]);

  React.useEffect(() => {
    if (!sections.length) {
      hasInitializedSections.current = false;
      setOpenSections({});
      return;
    }
    if (hasInitializedSections.current) return;
    // Keep all sections collapsed by default; user expands as needed.
    setOpenSections({});
    hasInitializedSections.current = true;
  }, [sections]);

  const toggleSectionOpen = React.useCallback((sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  const handleTabChange = (sectionId: string, tab: SubTab) => {
    setActiveTabBySection((prev) => ({ ...prev, [sectionId]: tab }));
  };

  if (!selectedAttribute) {
    return (
      <div className="p-4 text-[13px] text-gray-700">
        Please select attribute to see detailed result
      </div>
    );
  }

  if (!sections.length) {
    return (
      <div className="p-4 text-[13px] text-gray-700">
        No detailed results available for this attribute.
      </div>
    );
  }

  function badgeClassForWinner(winner: string, selectedAttribute: string) {
    if (!winner || winner === "None") {
      return "bg-gray-200 text-gray-900";
    }

    // winner is the selected attribute => green, else red
    return winner === selectedAttribute
      ? "bg-green-200 text-green-900"
      : "bg-red-200 text-red-900";
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <div className="h-full w-full overflow-y-auto bg-gray-50 level-testing-accordion">
        <Accordion className="w-full">
          {sections.map((section) => {
            const activeTab: SubTab =
              activeTabBySection[section.id] ?? "results";

            return (
              <AccordionItem
                key={section.id}
                open={Boolean(openSections[section.id])}
                onHeadingClick={() => toggleSectionOpen(section.id)}
                title={
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] truncate">{section.title}</span>

                    <span className="shrink-0 inline-flex items-center gap-2">
                      <span className="text-[11px] text-gray-500">Winner</span>
                      <span className="rounded-md px-2 py-[2px] text-[11px] font-semibold text-gray-900">
                        {(() => {
                          const winner = winnerForPair(section.pair);

                          return (
                            <span
                              className={[
                                "rounded-md px-2 py-[2px] text-[11px] font-semibold",
                                badgeClassForWinner(winner, selectedAttribute),
                              ].join(" ")}
                            >
                              {winner}
                            </span>
                          );
                        })()}
                      </span>
                    </span>
                  </div>
                }
              >
                <div className="bg-white w-full">
                  {/* inner tabs header */}
                  <div className="flex border-b border-gray-200 bg-gray-50 text-xs">
                    <button
                      type="button"
                      onClick={() => handleTabChange(section.id, "math")}
                      className={`px-4 py-2 ${
                        activeTab === "math"
                          ? "border-b-2 border-red-600 font-semibold text-gray-900"
                          : "border-b-2 border-transparent text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      Level Testing Math
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTabChange(section.id, "results")}
                      className={`px-4 py-2 ${
                        activeTab === "results"
                          ? "border-b-2 border-red-600 font-semibold text-gray-900"
                          : "border-b-2 border-transparent text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      Level Testing Results
                    </button>
                  </div>

                  {/* inner tab content */}
                  <div className="px-0 py-0">
                    {activeTab === "math" ? (
                      <LevelTestingMath pair={section.pair} />
                    ) : (
                      <LevelTestingResult pair={section.pair} />
                    )}
                  </div>
                </div>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}
