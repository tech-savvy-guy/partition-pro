type Props = {
  value: boolean | null;
};

export function ObmHoldsBadge({ value }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-600 text-sm font-medium">OBM Holds:</span>
      <span
        className="inline-flex items-center rounded-md px-3 py-1 text-sm font-semibold"
        style={{
          backgroundColor:
            value === true
              ? "#DCFCE7"
              : value === false
                ? "#FEE2E2"
                : "#E5E7EB",
          color:
            value === true
              ? "#166534"
              : value === false
                ? "#991B1B"
                : "#374151",
          border: "1px solid rgba(0,0,0,0.08)",
          minWidth: 56,
          justifyContent: "center",
        }}
      >
        {value == null ? "-" : value ? "TRUE" : "FALSE"}
      </span>
    </div>
  );
}
