import type { SVGProps } from "react";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleIcon,
  DownloadIcon,
  EditIcon,
  EyeIcon,
  Grid2X2Icon,
  InfoIcon,
  Maximize2Icon,
  MessageCircleIcon,
  Minimize2Icon,
  MoveIcon,
  MousePointer2Icon,
  PaletteIcon,
  PlayIcon,
  PlusIcon,
  RepeatIcon,
  RotateCwIcon,
  ShapesIcon,
  SquareIcon,
  TextIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";

export const Warning = AlertTriangleIcon;
export const View = EyeIcon;
export const Close = XIcon;
export const Download = DownloadIcon;
export const Chat = MessageCircleIcon;
export const CircleOutline = CircleIcon;
export const SquareOutline = SquareIcon;
export const DiamondOutline = DiamondIcon;
export const TextFont = TypeIcon;
export const PlayFilledAlt = PlayIcon;
export const TrashCan = Trash2Icon;
export const WatsonHealthRotate_360 = RotateCwIcon;
export const Repeat = RepeatIcon;
export const Move = MoveIcon;
export const SelectWindow = MousePointer2Icon;
export const Shapes = ShapesIcon;
export const Maximize = Maximize2Icon;
export const Minimize = Minimize2Icon;
export const Add = PlusIcon;
export const ArrowLeft = ArrowLeftIcon;
export const ChevronDown = ChevronDownIcon;
export const ChevronUp = ChevronUpIcon;
export const Merge = GitMergeIcon;
export const Edit = EditIcon;
export const Checkmark = CheckIcon;
export const Information = InfoIcon;
export const Undo = Undo2Icon;
export const ColorPalette = PaletteIcon;
export const TextAlignLeft = TextIcon;
export const Grid = Grid2X2Icon;

/** Local SVG icons accept a numeric `size` (mapped to width/height) for parity with lucide. */
type LocalSvgProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number;
};

function sizeToDimensions({ size, ...props }: LocalSvgProps): SVGProps<SVGSVGElement> {
  return size == null ? props : { width: size, height: size, ...props };
}

type ShapeIconProps = LocalSvgProps & {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  isSelected?: boolean;
  selectionOutlineColor?: string;
};

export function NoColorsIcon({ size, ...props }: LocalSvgProps) {
  return (
    <PaletteIcon
      className="size-4 text-gray-400"
      {...(size == null ? {} : { width: size, height: size })}
      {...props}
    />
  );
}

export function CircleShapeIcon({
  fill = "transparent",
  stroke = "currentColor",
  strokeWidth = 1,
  strokeDasharray,
  ...props
}: ShapeIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      {...sizeToDimensions(props)}
    >
      <circle
        cx="50"
        cy="50"
        r="48"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function DiamondShapeIcon({
  fill = "transparent",
  stroke = "currentColor",
  strokeWidth = 1,
  strokeDasharray,
  isSelected,
  selectionOutlineColor = "#2563eb",
  ...props
}: ShapeIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      {...sizeToDimensions(props)}
    >
      <polygon
        points="50,2 98,50 50,98 2,50"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        vectorEffect="non-scaling-stroke"
      />
      {isSelected ? (
        <polygon
          points="50,2 98,50 50,98 2,50"
          fill="none"
          stroke={selectionOutlineColor}
          strokeDasharray="4 3"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}

function DiamondIcon(props: LocalSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...sizeToDimensions(props)}
    >
      <path d="M12 2 22 12 12 22 2 12 12 2Z" />
    </svg>
  );
}

function GitMergeIcon(props: LocalSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...sizeToDimensions(props)}
    >
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M6 21V9" />
      <path d="M9 6h3a6 6 0 0 1 6 6v3" />
    </svg>
  );
}
