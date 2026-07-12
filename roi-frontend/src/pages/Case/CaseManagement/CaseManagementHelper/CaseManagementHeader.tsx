// src/pages/.../CaseManagementHelper/CaseManagementHeader.tsx
import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight } from "@carbon/icons-react";
import DocumentIcon from "@/components/icons/DocumentIcon";

type Mode = "create" | "edit";

export default function CaseManagementHeader({
  mode: modeProp,
  title,
  subtitle,
}: {
  mode?: Mode;
  title?: string;
  subtitle?: string;
}) {
  const { id } = useParams<{ id?: string }>();
  const inferredMode: Mode = modeProp ?? (id ? "edit" : "create");
  const isEdit = inferredMode === "edit";

  const computedTitle = title ?? (isEdit ? "Edit Case" : "Create Case");
  const computedSubtitle =
    subtitle ??
    (isEdit
      ? "Update case details, members, and files"
      : "Create a new case and add members and files");

 return (
  <section className="w-full mb-8">
    {/* Breadcrumb row */}
    <div className="mb-2 text-[13px] text-gray-600">
      <Link to="/cases" className="hover:underline">
        Case
      </Link>
      <ChevronRight
        size={12}
        className="mx-1 inline-block text-gray-400 align-[-1px]"
        aria-hidden
      />
      <span className="text-gray-900">
        {isEdit ? "Edit Case" : "New Case"}
      </span>
    </div>

    {/* Full-bleed banner */}
    <div className="-mx-6">
      <div
        className="relative w-full overflow-hidden text-white"
        style={{
          minHeight: 160,
          backgroundImage: "url(/images/banners/banner1.png)",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right center",
        }}
      >
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />

        {/* Banner content */}
        <div className="relative px-6 sm:px-8 py-5 sm:py-6 flex flex-col gap-3">
          {/* Eyebrow */}
          <p className="uppercase tracking-[0.22em] text-white/70 text-xs">
            Case
          </p>

          {/* Icon + title */}
          <div className="flex items-center gap-3">
            <DocumentIcon className="partition-header-icon h-8 w-8" />
            <h1 className="text-[24px] sm:text-[28px] font-semibold leading-tight">
              {computedTitle}
            </h1>
          </div>

          {/* Subtitle */}
          <p className="text-sm sm:text-[15px] text-white/80 max-w-2xl">
            {computedSubtitle}
          </p>
        </div>
      </div>
    </div>
  </section>
);

}
