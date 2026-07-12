type DiamondShapeIconProps = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  isSelected?: boolean;
  selectionOutlineColor?: string;
};

export default function DiamondShapeIcon({
  fill,
  stroke = "rgba(55,65,81,0.3)",
  strokeWidth = 1,
  strokeDasharray,
  isSelected = false,
  selectionOutlineColor = "#3b82f6",
}: DiamondShapeIconProps) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0"
      style={{
        outline: isSelected ? `dashed 1.5px ${selectionOutlineColor}` : "none",
        outlineOffset: "-1px",
      }}
    >
      <polygon
        points="50,2 98,50 50,98 2,50"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
      />
    </svg>
  );
}
