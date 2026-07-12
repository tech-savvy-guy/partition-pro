import React from "react";
import { useNavigate } from "react-router-dom";
import DocumentIcon from "@/components/icons/DocumentIcon";

type Props = {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
};

const DEFAULT_BANNER = "/images/banners/banner1.png";

export default function CasesHeader({
  title = "Current Cases",
  subtitle = "This page enables you to view, create and edit cases",
  backgroundImage = DEFAULT_BANNER,
}: Props) {
  const navigate = useNavigate();
  const goToCasesRoot = () => navigate("/cases");

  return (
    <section className="w-full mb-8">
      {/* breadcrumb row */}
      <div className="mb-2 text-[13px] text-gray-600">
        <button
          type="button"
          onClick={goToCasesRoot}
          className="hover:text-[#C41230] transition-colors"
        >
          Cases
        </button>
      </div>

      {/* full-bleed banner */}
      <div className="-mx-6">
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
          <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />

          <div className="relative px-6 sm:px-8 py-5 sm:py-6 flex flex-col gap-3">
            <p className="uppercase tracking-[0.22em] text-white/70 text-xs">
              Cases
            </p>

            <div className="flex items-center gap-3">
              <DocumentIcon className="h-8 w-8 text-white" />
              <h1 className="text-[24px] sm:text-[28px] font-semibold leading-tight">
                {title}
              </h1>
            </div>

            <p className="text-sm sm:text-[15px] text-white/80 max-w-2xl">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
