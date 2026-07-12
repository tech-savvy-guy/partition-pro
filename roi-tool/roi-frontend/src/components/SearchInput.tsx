import * as React from "react";
import { IconField } from "primereact/iconfield";
import { InputText } from "primereact/inputtext";

type Radius = number | "sm" | "md" | "lg" | "pill";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  width?: number | string;
  /** Match AppButton’s API; defaults to "lg" so it looks like your create button */
  radius?: Radius;
};

const radiusToPx = (r: Radius | undefined) =>
  typeof r === "number" ? r : r === "sm" ? 2 : r === "md" ? 8 : r === "lg" ? 12 : 9999;

/**
 * Clean, centered search bar with red hover/focus effects
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = "Search input text",
  className,
  width = 420,
  radius = "sm",
}: Props) {
  const wrapperStyle: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    borderRadius: radiusToPx(radius),
  };
  const inputStyle: React.CSSProperties = {
    borderRadius: radiusToPx(radius),
  };

  return (
    <IconField
      className={[
        "relative flex items-center border border-gray-300 bg-white transition-colors",
        "hover:border-red-500 focus-within:border-red-600 focus-within:ring-2 focus-within:ring-red-500",
        // no rounded-* class; we control radius via inline style so px values match DS exactly
        className || "",
      ].join(" ")}
      style={wrapperStyle}
    >
      <span className="absolute left-3 flex items-center justify-center text-gray-500">
        <i className="pi pi-search text-base" />
      </span>

      <InputText
        id="search-input"
        name="search"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          "w-full",
          "h-12",
          "pl-10 pr-4",
          "text-[16px] text-gray-700",
          // remove rounded-* so the inline style above is the single source of truth
          "bg-transparent focus:outline-none",
        ].join(" ")}
        style={inputStyle}
      />
    </IconField>
  );
}
