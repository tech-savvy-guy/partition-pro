import { useSearchParams } from "react-router-dom";
import PartitionHeader from "./PartitionHelper/PartitionHeader";
import PartitionBody from "./PartitionHelper/PartitionBody";
import { Link } from "react-router-dom";
import { ChevronRight } from "@carbon/icons-react";

export default function Partitions() {
  const [sp] = useSearchParams();
  const caseName = sp.get("name") ?? "Case";
  const eyebrow = (
    <div className="uppercase tracking-[0.22em] text-white/70 text-xs flex items-center gap-1">
      <Link to="/cases" className="hover:underline">
        Cases
      </Link>
      <ChevronRight size={12} className="text-white/60" aria-hidden />
      <span>Partitions</span>
    </div>
  );

  return (
    <div className="w-full">
      <PartitionHeader
        caseName={caseName}
        subtitle="This page enables you to view and create partitions."
        backgroundImage="/images/banners/banner2.png"
        eyebrow={eyebrow}
      />
      <PartitionBody />
    </div>
  );
}
