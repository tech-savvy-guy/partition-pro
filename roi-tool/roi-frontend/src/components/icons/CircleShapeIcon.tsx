type CircleShapeIconProps = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
};

export default function CircleShapeIcon({
  fill,
  stroke = "none",
  strokeWidth = 0,
  strokeDasharray,
}: CircleShapeIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <circle
        cx="50"
        cy="50"
        r="48"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
      />
    </svg>
  );
}
