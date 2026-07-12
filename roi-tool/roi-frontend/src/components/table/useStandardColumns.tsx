import * as React from "react";
import { Col as Column } from "@/components/table/Table";
import { COL_WIDTH } from "./columnTokens";

type ColumnKind = "text" | "date" | "status" | "details" | "checkbox";

export type StandardColumn<T> = {
  field?: keyof T | string;
  header: string;
  kind?: ColumnKind;
  sortable?: boolean;
  filter?: boolean;
  body?: (row: T) => React.ReactNode;
};

export function useStandardColumns<T>() {
  return React.useCallback(
    (cols: StandardColumn<T>[]) =>
      cols.map((c, idx) => {
        const width =
          c.kind === "checkbox"
            ? COL_WIDTH.checkbox
            : c.kind === "details"
              ? COL_WIDTH.details
              : c.kind === "date"
                ? COL_WIDTH.date
                : undefined;

        return (
          <Column
            key={String(c.field ?? c.header ?? idx)}
            field={c.field as string}
            header={c.header}
            sortable={c.sortable}
            filter={c.filter}
            body={c.body}
            headerStyle={width ? { width } : undefined}
            style={width ? { width } : undefined}
            headerClassName={c.kind === "details" ? "col-details" : undefined}
            bodyClassName={c.kind === "details" ? "col-details" : undefined}
          />
        );
      }),
    [],
  );
}
