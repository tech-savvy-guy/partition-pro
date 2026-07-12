export default function LoaderIcon({ width = "14", height = "14" }: { width?: string; height?: string }) {
  return (
    <svg className="animate-spin" width={width} height={height} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.15)" strokeWidth="4" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
