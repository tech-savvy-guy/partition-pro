import DetailedResult from "./detailed-result/detailed-result";
import type { LevelTestingPayload } from "../index";

type Props = {
  levelTesting?: LevelTestingPayload | null;
  selectedAttribute: string | null;
};

export default function DetailedResultsWithPartitionTree({
  levelTesting,
  selectedAttribute,
}: Props) {
  return <DetailedResult levelTesting={levelTesting} selectedAttribute={selectedAttribute} />;
}
