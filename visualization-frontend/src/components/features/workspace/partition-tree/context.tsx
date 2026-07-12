import * as React from "react";

import type { PartitionTreeContextValue } from "@/lib/partition-tree/types";

const PartitionTreeContext =
  React.createContext<PartitionTreeContextValue | null>(null);

export function PartitionTreeProvider({
  value,
  children,
}: {
  value: PartitionTreeContextValue;
  children: React.ReactNode;
}) {
  return (
    <PartitionTreeContext.Provider value={value}>
      {children}
    </PartitionTreeContext.Provider>
  );
}

export function usePartitionTreeContext() {
  const context = React.useContext(PartitionTreeContext);

  if (!context) {
    throw new Error(
      "PartitionTree components must be rendered inside PartitionTreeProvider.",
    );
  }

  return context;
}
