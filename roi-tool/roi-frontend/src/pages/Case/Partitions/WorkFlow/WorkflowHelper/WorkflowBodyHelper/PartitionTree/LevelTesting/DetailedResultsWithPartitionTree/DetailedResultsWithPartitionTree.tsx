import * as React from "react";
import DetailedResult from "./DetailedResult/DetailedResult";
import type { LevelTestingPayload } from "../Index";

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
