import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "@carbon/icons-react";
import PartitionHeaderIcon from "@/components/icons/PartitionHeader";

type Crumb = { label: string; to?: string };

type Props = {
  caseName: string;
  caseId?: string; // kept for compatibility if you ever need it
  breadcrumbs?: Crumb[];
  right?: React.ReactNode;
  bottomSlot?: React.ReactNode;
  icon?: React.ReactNode;
  /** banner image (e.g. banner2, banner3) */
  backgroundImage?: string;
  /** eyebrow text inside banner, e.g. "Cases · Partitions" */
  eyebrow?: React.ReactNode;
  /** subheading sentence under the title */
  subtitle?: React.ReactNode;
  /** Inline content beside the title (e.g. dataset chips on workflow page) */
  titleTrailing?: React.ReactNode;
  /** Workflow page: dark compact hero, breadcrumbs inside banner */
  minimal?: boolean;
};

const DEFAULT_BANNER = "/images/banners/banner2.png";

export default function PartitionHeader({
  caseName,
  caseId,
  breadcrumbs,
  right,
  bottomSlot,
  icon,
  backgroundImage = DEFAULT_BANNER,
  eyebrow = "Cases > Partitions",
  subtitle = "This page enables you to view and create partitions.",
  titleTrailing,
  minimal = false,
}: Props) {
  const crumbs: Crumb[] =
    breadcrumbs && breadcrumbs.length
      ? breadcrumbs
      : [
          { label: "Cases", to: "/cases" },
          { label: "Partitions" },
        ];

  const breadcrumbRow = (
    <div className="relative z-20 mb-2 text-[13px] text-gray-600">
      {crumbs.map((b, i) => {
        const isLast = i === crumbs.length - 1;
        const content = b.to ? (
          <Link
            to={b.to}
            className={`hover:underline ${
              isLast ? "text-gray-900 font-medium" : ""
            }`}
          >
            {b.label}
          </Link>
        ) : (
          <span className={isLast ? "text-gray-900 font-medium" : undefined}>
            {b.label}
          </span>
        );

        return (
          <span key={`${b.label}-${i}`}>
            {content}
            {!isLast && (
              <ChevronRight
                size={12}
                className="mx-1 inline-block text-gray-400 align-[-1px]"
                aria-hidden
              />
            )}
          </span>
        );
      })}
    </div>
  );

  if (minimal) {
    return (
      <section className="workflow-light-header -mx-6">
        <div className="workflow-light-header__top">
          <div className="workflow-light-header__main">
            <div className="workflow-light-header__breadcrumbs">
              {crumbs.map((b, i) => {
                const isLast = i === crumbs.length - 1;
                const content = b.to ? (
                  <Link
                    to={b.to}
                    className={`hover:underline ${
                      isLast ? "font-medium text-white/90" : "text-white/70"
                    }`}
                  >
                    {b.label}
                  </Link>
                ) : (
                  <span
                    className={
                      isLast ? "font-medium text-white/90" : "text-white/70"
                    }
                  >
                    {b.label}
                  </span>
                );

                return (
                  <span key={`${b.label}-${i}`}>
                    {content}
                    {!isLast && (
                      <ChevronRight
                        size={12}
                        className="mx-1 inline-block text-white/45 align-[-1px]"
                        aria-hidden
                      />
                    )}
                  </span>
                );
              })}
            </div>

            <div className="workflow-light-header__title-row">
                <span className="workflow-light-header__icon">
                  {icon ?? (
                    <PartitionHeaderIcon className="partition-header-icon h-6 w-6" />
                  )}
                </span>
                <h1 className="workflow-light-header__title">{caseName}</h1>
                {titleTrailing ? (
                  <div className="workflow-light-header__title-trailing">
                    {titleTrailing}
                  </div>
                ) : null}
              </div>
              {subtitle ? (
                <div className="workflow-light-header__chips-row">{subtitle}</div>
              ) : null}
            </div>

            {right ? (
              <div className="workflow-light-header__right">{right}</div>
            ) : null}
          </div>

          {bottomSlot ? (
            <div className="workflow-light-header__tabs">{bottomSlot}</div>
          ) : null}
        </section>
    );
  }

  return (
    <section className="w-full mb-8">
      {breadcrumbRow}

      {/* Full-bleed banner */}
      <div className="-mx-6 relative z-10">
        <div
          className="relative w-full overflow-hidden text-white"
          style={{
            minHeight: 160,
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right center",
          }}
        >
          {/* darken left side for text, keep artwork visible on right */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />

          {/* Content on top of banner */}
          <div className="relative px-6 sm:px-8 py-5 sm:py-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <div className="flex flex-col gap-3 min-w-0">
              {/* Eyebrow */}
              {eyebrow ?? (
                <p className="uppercase tracking-[0.22em] text-white/70 text-xs">
                  Cases · Partitions
                </p>
              )}

              {/* Title + icon */}
              <div className="flex items-center gap-3">
                {icon ?? (
                  <PartitionHeaderIcon className="partition-header-icon h-8 w-8" />
                )}
                <h1 className="text-[24px] sm:text-[28px] font-semibold leading-tight truncate">
                  {caseName}
                </h1>
              </div>

              {/* Subheading / dataset chips */}
              {subtitle && (
                <div className="text-sm sm:text-[15px] text-white/80 max-w-2xl">
                  {subtitle}
                </div>
              )}
            </div>

            {/* RIGHT: banner meta */}
            {right ? (
              <div className="hidden md:flex items-start justify-end">
                {right}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Optional bottom row (tabs + right actions) */}
      {bottomSlot && (
        <div className="mt-4 flex items-center justify-between border-b border-gray-200">
          <div className="flex-1 min-w-0">{bottomSlot}</div>
        </div>
      )}
    </section>
  );
}
