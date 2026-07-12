import { DataTable } from "primereact/datatable";
import type { DataTableProps } from "primereact/datatable";
import { Column } from "primereact/column";
import "@/components/table/Table.css";

export function Table<TValue extends any[] = any[]>(
  props: DataTableProps<TValue>,
) {
  const { className, ...rest } = props;
  const mergedClassName = ["app-table", className].filter(Boolean).join(" ");

  return <DataTable {...rest} className={mergedClassName} />;
}

export { Column as Col };
