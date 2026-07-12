import { useNavigate } from "react-router-dom";
import React from "react";
import { Button, Tag, Tile } from "@bain/design-system";
import { Play, ArrowRight } from "@carbon/icons-react";
import { Dialog } from "primereact/dialog";

import HeroBanner from "@/components/HeroBanner";
import { Table, Col as Column } from "@/components/table/Table";
import "./DashBoard.css";
import { useAuth } from "@/core/auth/authContext";
import { useQuery } from "@tanstack/react-query";
import { CaseApi, CaseRow } from "@/core/api";
import WhatsNewCarousel from "@/components/WhatsNewCarousel";
import { statusToTagType, toUiStatus } from "../Case/CaseHelper/CaseHelper";

let welcomeCards = [
  {
    id: "card1",
    tag: "Start fresh",
    title: "Create new case",
    subtitle:
      "Build a new shopper partition tailored to the category and market",
    image: "/images/CR21647_hres.jpg",
    primaryLabel: "Start new case",
    primaryRoute: "/cases/new", // or "/cases/new"
    secondaryLabel: "View templates",
    secondaryRoute: "/roi-methodology",
  },
  {
    id: "card2",
    tag: "Continue",
    title: "US & Sun Refresh",
    // subtitle: "Pick up your most recent work exactly where you left off.",
    image: "/images/CR21735_hres.jpg",
    primaryLabel: "Open recent case",
    primaryRoute: "/cases", // maybe `/cases/C001`
    secondaryLabel: "See all cases",
    secondaryRoute: "/cases",
  },
  {
    id: "card3",
    tag: "Explore",
    title: "Methodologies",
    subtitle: "Dive into ROI, 2D-3D and SKU selection frameworks.",
    image: "/images/CR21756_hres.jpg",
    primaryLabel: "Explore methods",
    primaryRoute: "/roi-methodology",
    secondaryLabel: "View guides",
    secondaryRoute: "/roi-methodology",
  },
  {
    id: "card4",
    tag: "About",
    title: "About Partition",
    subtitle:
      "Understand the Partition philosophy, principles, and how Bain teams use it in practice.",
    image: "/images/CR21788_hres.jpg",
    primaryLabel: "Go to About Partition",
    primaryRoute: "/about",
    secondaryLabel: "Learn more",
    secondaryRoute: "/about",
  },
];

const TEMPLATE_FILES = [
  {
    key: "pos",
    label: "Point of Sales",
    description: "POS template for sales-level data",
    url: "/templates/point_of_sales_template.csv",
    filename: "point_of_sales_template.csv",
  },
  {
    key: "attr",
    label: "Attribute Sheet",
    description: "Attribute-level input template",
    url: "/templates/attribute_sheet_template.csv",
    filename: "attribute_sheet_template.csv",
  },
  {
    key: "cross",
    label: "Cross Purchase",
    description: "Cross-purchase relationship template",
    url: "/templates/cross_purchase_template.csv",
    filename: "cross_purchase_template.csv",
  },
];

export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();

  const { data: cases = [] } = useQuery({
    queryKey: ["cases", user?.id],
    queryFn: () => CaseApi.getAll({ is_archived: false }),
    enabled: !isLoading && isAuthenticated,
  });

  const sortedCases = React.useMemo(() => {
    return [...cases].sort(
      (a, b) =>
        new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime(),
    );
  }, [cases]);

  const activeCasesCount = React.useMemo(() => {
    return cases.filter((c) => "Active" === toUiStatus(c.status)).length;
  }, [cases]);

  const lastOpenedCase = sortedCases[0]?.name;

  const recentCases = React.useMemo(
    () =>
      sortedCases.slice(0, 5).map((c) => ({
        id: c.id,
        status: toUiStatus(c.status),
        name: c.name,
        description: c.description,
      })),
    [sortedCases],
  );

  const navigate = useNavigate();
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const getScrollDistance = () => {
    const viewport = viewportRef.current;
    if (!viewport) return 0;

    // first card inside the rail
    const firstCard = viewport.querySelector<HTMLElement>(
      "[data-carousel-card]",
    );
    if (!firstCard) {
      // fallback to old logic if something goes wrong
      return viewport.clientWidth * 0.8;
    }
    // card width + ~gap (you set gap to 1.5rem = 24px on the flex container)
    return firstCard.clientWidth + 24;
  };

  const scrollByCard = (direction: "left" | "right") => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const distance = getScrollDistance();

    setCurrentIndex((prev) => {
      const maxIndex = welcomeCards.length - 1;
      const next =
        direction === "left"
          ? Math.max(prev - 1, 0)
          : Math.min(prev + 1, maxIndex);

      if (next !== prev) {
        viewport.scrollBy({
          left: direction === "left" ? -distance : distance,
          behavior: "smooth",
        });
      }

      return next;
    });
  };
  const scrollToIndex = (index: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const distance = getScrollDistance();
    viewport.scrollTo({
      left: distance * index,
      behavior: "smooth",
    });
    setCurrentIndex(index);
  };
  const AUTO_SCROLL_MS = 3000;
  const autoTimerRef = React.useRef<number | null>(null);

  const startAutoScroll = React.useCallback(() => {
    if (autoTimerRef.current) {
      window.clearInterval(autoTimerRef.current);
    }

    autoTimerRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % welcomeCards.length;
        scrollToIndex(next);
        return next;
      });
    }, AUTO_SCROLL_MS);
  }, [scrollToIndex]);

  const stopAutoScroll = React.useCallback(() => {
    if (autoTimerRef.current) {
      window.clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    startAutoScroll();
    return stopAutoScroll;
  }, [startAutoScroll, stopAutoScroll]);

  const handleManualScroll = (dir: "left" | "right") => {
    stopAutoScroll();
    scrollByCard(dir);
    startAutoScroll();
  };

  const statusBody = (r: CaseRow) => (
    <Tag type={statusToTagType(r.status)} className="whitespace-nowrap">
      {r.status}
    </Tag>
  );

  const handleTemplateDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const LOOP_FACTOR = 3;
  const loopedCards = Array.from(
    { length: LOOP_FACTOR },
    () => welcomeCards,
  ).flat();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
          <p className="text-white text-sm tracking-wide">Signing you in!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black">
      {/* Immersive hero (Tesla-style) */}
      <HeroBanner
        activeCases={activeCasesCount}
        lastOpenedCase={lastOpenedCase}
        totalCases={cases.length}
      />
      <div
        id="partitionpro-workspace"
        className="
        relative z-10
        mt-0
        rounded-t-3xl
        bg-gray-50
        pb-20
        shadow-[0_-20px_40px_rgba(0,0,0,0.35)]
        "
      >
        <div className="max-w-11xl mx-auto px-6 pt-10 space-y-14">
          {/* QUICK ACTION STRIP */}
          {/* TESLA-STYLE WELCOME BACK CAROUSEL */}
          <section className="fade-in-up">
            <p className="text-xs tracking-[0.28em] uppercase text-gray-400">
              PartitionPro - Workspace
            </p>
            <h2 className="mt-1 text-[28px] font-semibold text-gray-900">
              Welcome back, {user?.name}
            </h2>

            <div
              className="relative mt-4"
              onMouseEnter={stopAutoScroll}
              onMouseLeave={startAutoScroll}
            >
              <div
                ref={viewportRef}
                className="welcome-rail px-[15vw] overflow-hidden"
              >
                <div className="welcome-rail-inner flex gap-6">
                  {loopedCards.map((card, idx) => {
                    const relative = idx - currentIndex;
                    const isActive = relative === 0;
                    const isNeighbor = Math.abs(relative) === 1;

                    return (
                      <article
                        key={`${card.id}-${idx}`}
                        data-carousel-card
                        className={`
                          relative flex-shrink-0
                          min-w-[70%] lg:min-w-[60%]
                          aspect-[16/9]
                          rounded-3xl overflow-hidden
                          transition-all duration-700 ease-out
                          ${isActive && "carousel-card--active"}
                          ${isNeighbor && "carousel-card--neighbor"}
                          ${!isActive && !isNeighbor && "carousel-card--far"}
                        `}
                      >
                        <img
                          src={card.image}
                          alt={card.title}
                          className="absolute inset-0 w-full h-full object-cover scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />

                        <div className="relative z-10 h-full flex flex-col justify-between px-8 py-7">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-gray-200/80">
                              {card.tag}
                            </p>
                            <h3 className="mt-2 text-3xl font-semibold text-white">
                              {card.primaryLabel === "Open recent case"
                                ? recentCases[0]?.name
                                : card.title}
                            </h3>
                            <p className="mt-2 text-gray-200/85 max-w-md">
                              {card.subtitle}
                            </p>
                          </div>

                          <div className="flex gap-3">
                            <Button
                              size="md"
                              onClick={() =>
                                card.primaryLabel === "Open recent case" &&
                                recentCases[0]
                                  ? navigate(
                                      `/cases/${recentCases[0].id}/partitions?name=${recentCases[0].name}`,
                                    )
                                  : navigate(card.primaryRoute)
                              }
                              className="!bg-white !text-gray-900"
                            >
                              {card.primaryLabel}
                            </Button>
                            <Button
                              kind="ghost"
                              size="md"
                              onClick={() => {
                                if (card.secondaryLabel === "View templates") {
                                  setTemplatesOpen(true);
                                } else {
                                  navigate(card.secondaryRoute);
                                }
                              }}
                              className="!text-white hover:!bg-white/10"
                            >
                              {card.secondaryLabel}
                              <ArrowRight size={16} className="ml-1" />
                            </Button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
              {/* Dots */}
              <div className="mt-4 flex justify-center gap-2">
                {welcomeCards.map((card, idx) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => scrollToIndex(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`
                    h-2.5 w-2.5 rounded-full transition-all
                    ${
                      idx === currentIndex
                        ? "bg-gray-900 scale-110"
                        : "bg-gray-400/70 hover:bg-gray-500"
                    }
                  `}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ROW 1 - HOW TO + GUIDES (more cinematic) */}
          {/* IMMERSIVE PARTITION METHODOLOGY BANNER + FRAMEWORK CARDS */}
          <section className="fade-in-up space-y-6">
            {/* FULL-WIDTH IMMERSIVE BANNER */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <h2 className="text-[18px] font-semibold text-gray-900">
                    Learn the Partition methodology
                  </h2>
                  <p className="text-sm text-gray-500">
                    Watch a short walkthrough and explore Bain's recommended
                    approach.
                  </p>
                </div>
              </div>

              <div
                className="
        relative
        w-full
        rounded-3xl
        overflow-hidden
        shadow-md hover:shadow-2xl
        bg-black
        group
        transition-transform duration-500
        hover:-translate-y-[2px]
      "
              >
                {/* Background image */}
                <img
                  src="/images/banner2.png"
                  alt="Partition methodology"
                  className="
          w-full h-[260px] sm:h-[300px] lg:h-[340px]
          object-cover
          learn-card-image
        "
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/10" />

                {/* Content overlay */}
                <div className="absolute inset-0 flex flex-col justify-between">
                  <div className="px-6 pt-5 sm:px-10 sm:pt-7 max-w-xl">
                    <p className="text-[11px] tracking-[0.24em] uppercase text-gray-200/70">
                      Walkthrough - Partition methodology
                    </p>
                    <h3 className="mt-2 text-xl sm:text-2xl lg:text-[26px] font-semibold text-white">
                      Partition Methodology at Bain
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-gray-200/90">
                      5-minute slide loop with visuals, examples, and guidance
                      drawn from real Bain work.
                    </p>

                    {/* Chips */}
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-200/90">
                      <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur">
                        Slide loop
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur">
                        Visual examples
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur">
                        Best practices
                      </span>
                    </div>
                  </div>

                  {/* Bottom row: Play + Recommended + CTA */}
                  <div className="flex items-center justify-between px-6 sm:px-10 pb-5 sm:pb-7">
                    {/* Play button */}
                    <button
                      onClick={() =>
                        window.open(
                          "https://youtu.be/SevhjgrLyJQ?si=UVQX7Vhu0tZK_9bm",
                          "_blank",
                          "noopener,noreferrer",
                        )
                      }
                      className="
                      flex items-center justify-center
                      h-14 w-14 sm:h-16 sm:w-16
                      rounded-full
                      bg-white/90 text-black
                      shadow-lg
                      group-hover:scale-105
                      transition-transform duration-300
                    "
                    >
                      <Play size={26} />
                    </button>
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="hidden sm:block text-right">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-gray-200/75">
                          Recommended
                        </p>
                        <p className="text-[13px] text-gray-50">
                          Start here before building cases.
                        </p>
                      </div>
                      <Button
                        size="md"
                        onClick={() => navigate("/roi-methodology")}
                        className="!bg-[#C41230] hover:!bg-[#a50f27]"
                      >
                        Open guide
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {/* ROW 2 - RECENT CASES + WHAT'S NEW (immersive) */}
          <section className="grid grid-cols-12 gap-6 fade-in-up delay-1 items-start">
            {/* LEFT - Recent Cases */}
            <div className="col-span-12 lg:col-span-8 space-y-3 h-full">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[18px] font-semibold text-gray-900">
                    Recent cases
                  </h2>
                  <p className="text-sm text-gray-500">
                    Quickly reopen cases you or your team recently touched.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => navigate("/cases")}
                  className="!bg-[#C41230] hover:!bg-[#a50f27]"
                >
                  View all
                </Button>
              </div>

              <Tile
                className="
                 p-0
                rounded-3xl
                shadow-md hover:shadow-xl
                transition-all hover:-translate-y-[2px]
                overflow-hidden
                h-[320px]             
                flex flex-col
              "
              >
                {/* subtle header strip */}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-1.5 h-6 rounded-full bg-[#C41230]" />
                    <div>
                      <p className="text-[13px] font-medium text-gray-900">
                        Your work
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Last 5 cases you interacted with
                      </p>
                    </div>
                  </div>
                </div>
                <Table<any[]>
                  value={recentCases}
                  dataKey="id"
                  paginator={false}
                  showGridlines={false}
                  onRowClick={(e) => {
                    navigate(
                      `/cases/${e.data.id}/partitions?name=${e.data.name}`,
                    );
                  }}
                  className="app-table rounded-md cases-header-grey cases-paginator-right"
                >
                  <Column field="name" header="Case" />
                  <Column field="description" header="Description" />
                  <Column field="status" header="Status" body={statusBody} />
                </Table>
              </Tile>
            </div>

            {/* RIGHT - What's New timeline */}
            <div className="col-span-12 lg:col-span-4 space-y-3 h-full">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[18px] font-semibold text-gray-900">
                    What's new
                  </h2>
                  <p className="text-sm text-gray-500">
                    Latest updates to PartitionPro and Partition methodologies.
                  </p>
                </div>
              </div>
              <WhatsNewCarousel />
            </div>
          </section>
        </div>
      </div>

      <Dialog
        visible={templatesOpen}
        onHide={() => setTemplatesOpen(false)}
        modal
        header={<span className="text-[20px] font-semibold">Template Files</span>}
        className="
          w-[92vw] max-w-[760px] rounded-xl
          [&_.p-dialog-header]:!bg-gray-50 [&_.p-dialog-header]:!border-0 [&_.p-dialog-header]:!px-6 [&_.p-dialog-header]:!pt-5 [&_.p-dialog-header]:!pb-3
          [&_.p-dialog-content]:!bg-gray-50 [&_.p-dialog-content]:!border-0 [&_.p-dialog-content]:!px-6 [&_.p-dialog-content]:!pb-6
        "
        contentClassName="!pt-3 !pb-6 !px-6"
        maskClassName="backdrop-blur-[2px] bg-black/20"
      >
        <p className="mb-4 text-sm text-gray-600">
          Download starter input files for Point of Sales, Attribute Sheet, and
          Cross Purchase.
        </p>

        <Tile className="overflow-hidden rounded-xl p-0 shadow-sm">
          {TEMPLATE_FILES.map((template, index) => (
            <div
              key={template.key}
              className={`flex items-center justify-between px-5 py-4 ${
                index < TEMPLATE_FILES.length - 1
                  ? "border-b border-gray-200"
                  : ""
              }`}
            >
              <div>
                <p className="text-[14px] font-medium text-gray-900">
                  {template.label}
                </p>
                <p className="text-[12px] text-gray-500">
                  {template.description}
                </p>
              </div>
              <Button
                size="sm"
                kind="primary"
                onClick={() =>
                  handleTemplateDownload(template.url, template.filename)
                }
              >
                Download
              </Button>
            </div>
          ))}
        </Tile>
      </Dialog>
    </div>
  );
}


