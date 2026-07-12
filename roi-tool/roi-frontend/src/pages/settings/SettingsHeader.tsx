import React from "react";
import { SettingsIcon } from "@/components/icons";

type Props = {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
};

const DEFAULT_BANNER = "/images/banners/banner1.png";

export default function SettingsHeader({
  title = "Settings",
  subtitle = "Manage users and access permissions for your workspace.",
  backgroundImage = DEFAULT_BANNER,
}: Props) {
  return (
    <section className="w-full mb-8">
      <div className="mb-2 text-[13px] text-gray-600">Settings</div>

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
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />

          <div className="relative px-6 sm:px-8 py-5 sm:py-6 flex flex-col gap-3">
            <p className="uppercase tracking-[0.22em] text-white/70 text-xs">
              Workspace
            </p>

            <div className="flex items-center gap-3">
              <SettingsIcon className="col-span-1 row-span-2 h-8 w-8 text-gray-900" />
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
