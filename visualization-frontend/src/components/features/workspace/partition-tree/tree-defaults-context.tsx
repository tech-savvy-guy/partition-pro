import React from "react";
import { TREE_DEFAULTS, type TreeDefaults } from "@/lib/partition-tree/tree-defaults";

const TreeDefaultsContext = React.createContext<TreeDefaults>(TREE_DEFAULTS);

export function TreeDefaultsProvider({
  value = TREE_DEFAULTS,
  children,
}: {
  value?: TreeDefaults;
  children: React.ReactNode;
}) {
  return (
    <TreeDefaultsContext.Provider value={value}>{children}</TreeDefaultsContext.Provider>
  );
}

export function useTreeDefaults(): TreeDefaults {
  return React.useContext(TreeDefaultsContext);
}
