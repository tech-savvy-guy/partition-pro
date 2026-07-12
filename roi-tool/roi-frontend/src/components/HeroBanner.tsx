import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@bain/design-system";
import { ChevronDown } from "@carbon/icons-react";

/** Slide types */
type SlideBase = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
};

type ImageSlide = SlideBase & {
  kind: "image";
  image: string;
};

type VideoSlide = SlideBase & {
  kind: "video";
  video: string;
  poster?: string;
};

type Slide = ImageSlide | VideoSlide;

const SLIDES: Slide[] = [
  {
    id: "hero-video-1",
    kind: "video",
    video: "/videos/hero-office.mp4",
    poster: "/images/hero-video-poster.jpg",
    eyebrow: "PARTITIONPRO · PARTITION ANALYTICS",
    title: "PartitionPro in motion.",
    subtitle: "Drive deep insights into key shopper behavior drivers",
  },
  {
    id: "hero-1",
    kind: "image",
    image: "/images/NB000295.jpg",
    eyebrow: "PARTITIONPRO · PARTITION ANALYTICS",
    title: "Smarter SKU-level insights.",
    subtitle: "Build and compare shopper partitions across markets.",
  },
  {
    id: "hero-2",
    kind: "image",
    image: "/images/NB000172.jpg",
    eyebrow: "PARTITIONPRO · PARTITION ANALYTICS",
    title: "Identify levers for repeatable growth model",
    subtitle:
      "Identify repeatable growth driver levers through detailed SKU level shopper insights.",
  },
  {
    id: "hero-3",
    kind: "image",
    image: "/images/NB000194.jpg",
    eyebrow: "PARTITIONPRO · PARTITION ANALYTICS",
    title: "One stop solution for shopper partitions",
    subtitle: "Case repository to client-ready outputs - all in one place.",
  },
];

const AUTO_INTERVAL_MS = 17000;

type HeroBannerProps = {
  activeCases: number;
  lastOpenedCase?: string;
  totalCases: number;
};
export default function HeroBanner({
  activeCases,
  lastOpenedCase,
  totalCases,
}: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const timeoutRef = React.useRef<number | null>(null);
  const [videoReady, setVideoReady] = React.useState<Record<string, boolean>>(
    {}
  );

  // keep refs to video elements so we can play/pause correctly
  const videoRefs = React.useRef<Record<string, HTMLVideoElement | null>>({});

  // auto-advance carousel
  React.useEffect(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(
      () => setActiveIndex((prev) => (prev + 1) % SLIDES.length),
      AUTO_INTERVAL_MS
    );

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [activeIndex]);

  // play/pause video when slide changes
  React.useEffect(() => {
    SLIDES.forEach((slide, idx) => {
      if (slide.kind !== "video") return;

      const videoEl = videoRefs.current[slide.id];
      if (!videoEl) return;

      if (idx === activeIndex) {
        const p = videoEl.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            // autoplay might be blocked; it's fine, we keep it muted
          });
        }
      } else {
        videoEl.pause();
        videoEl.currentTime = 0;
      }
    });
  }, [activeIndex]);

  const goTo = (idx: number) => setActiveIndex(idx);
  const scrollToWorkspace = () => {
    const el = document.getElementById("partitionpro-workspace");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative w-full min-h-screen">
      {/* Full-bleed immersive hero */}
      <div className="relative w-full h-screen min-h-[500px] overflow-hidden bg-black text-white">
        {/* Slides */}
        <div className="absolute inset-0">
          {SLIDES.map((slide, idx) => (
            <div
              key={slide.id}
              className={`
                absolute inset-0
                transition-opacity duration-700 ease-in-out
                ${
                  idx === activeIndex
                    ? "opacity-100 z-20"
                    : "opacity-0 z-10 pointer-events-none"
                }
              `}
            >
              {slide.kind === "video" ? (
                <div className="relative w-full h-full">
                  {/* Poster layer: shows instantly, hides after video is ready */}
                  <img
                    src={slide.poster ?? "/images/hero-video-poster.jpg"}
                    alt={slide.title}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                      videoReady[slide.id] ? "opacity-0" : "opacity-100"
                    }`}
                  />

                  <video
                    ref={(el) => {
                      videoRefs.current[slide.id] = el;
                    }}
                    className="w-full h-full object-cover"
                    src={slide.video}
                    poster={slide.poster}
                    muted
                    loop
                    playsInline
                    preload="auto"
                    onLoadedData={() =>
                      setVideoReady((p) => ({ ...p, [slide.id]: true }))
                    }
                    onCanPlay={() =>
                      setVideoReady((p) => ({ ...p, [slide.id]: true }))
                    }
                  />
                </div>
              ) : (
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="w-full h-full object-cover"
                />
              )}
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/5" />

              {/* Text content */}
              <div className="absolute inset-0 flex items-center">
                <div className="pl-8 sm:pl-16 lg:pl-24 max-w-xl">
                  <p className="text-xs tracking-[0.3em] uppercase text-gray-200/80">
                    {slide.eyebrow}
                  </p>

                  <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight whitespace-pre-line">
                    {slide.title}
                  </h1>

                  <p className="mt-4 text-sm sm:text-base lg:text-lg text-gray-200 opacity-90">
                    {slide.subtitle}
                  </p>

                  {/* CTAs */}
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    {/* <Button size="lg" onClick={() => navigate("/cases")}>
                      Start a new case
                    </Button> */}

                    <Button
                      kind="ghost"
                      size="lg"
                      onClick={scrollToWorkspace}
                      className="hero-view-cases-btn"
                    >
                      Explore
                      <ChevronDown size={16} className="ml-1 text-white" />
                    </Button>
                  </div>

                  {/* Stats Row */}
                  <div className="mt-8 flex gap-10 text-xs text-gray-300">
                    <HeroStat
                      label="Active cases"
                      value={String(activeCases)}
                    />
                    <HeroStat label="Total Cases" value={String(totalCases)} />
                    <HeroStat
                      label="Recent Case"
                      value={lastOpenedCase ?? "-"}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex mb-4 gap-2 z-40">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={`
                h-2.5 w-2.5 rounded-full transition-all
                ${
                  idx === activeIndex
                    ? "bg-white scale-110"
                    : "bg-white/40 hover:bg-white/70"
                }
              `}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mr-6 mb-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-gray-300/80">
        {label}
      </p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}
