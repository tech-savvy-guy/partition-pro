import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Warning } from "./icons";
import { DataGrid, type DataGridColumn } from "./components/data-grid";
import {
  CircleAlertIcon,
  DatabaseIcon,
  LoaderCircleIcon,
  SearchIcon,
} from "lucide-react";

type Props = {
  data?: any;
  loading?: boolean;
  error?: string | null;
  readOnly?: boolean;
  nodeObj?: any;
  onSubmitSelection?: (payload: any) => Promise<void> | void;
  resultsFetching?: boolean;
};

type ValueToken = { label: string; count: string | null };

function ClientSkuLegend({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground ${className}`}
    >
      <span className="font-medium">Legend</span>
      <span
        className="inline-flex shrink-0 items-center border border-foreground bg-background"
      >
        <span className="inline-flex h-6 items-center bg-muted px-2 text-[11px] font-medium text-foreground">
          Attribute Value
        </span>
        <span className="inline-flex h-6 items-center bg-primary px-2 text-[11px] font-semibold text-primary-foreground">
          # Client SKUs
        </span>
      </span>
    </div>
  );
}

type ValuesViewportCellProps = {
  tokens: ValueToken[];
  onOpenAll: () => void;
};

function ValuesViewportCell({ tokens, onOpenAll }: ValuesViewportCellProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => setContainerWidth(el.clientWidth || 0);
    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  const estimateTextWidth = React.useCallback((text: string) => {
    if (!text) return 0;
    return Math.ceil(text.length * 6.6);
  }, []);

  const estimateTokenWidth = React.useCallback(
    (token: ValueToken) => {
      const labelWidth = estimateTextWidth(token.label);
      const hasCount = token.count != null && token.count !== "";
      const countWidth = hasCount ? estimateTextWidth(`#${token.count}`) : 0;
      const labelPillWidth = labelWidth + 16;
      const countPillWidth = hasCount ? countWidth + 16 : 0;
      return labelPillWidth + countPillWidth + 2;
    },
    [estimateTextWidth],
  );

  const estimateMoreWidth = React.useCallback(
    (remaining: number) => estimateTextWidth(`+${remaining} more`) + 8,
    [estimateTextWidth],
  );

  const { visibleCount, remainingCount } = React.useMemo(() => {
    if (containerWidth <= 0) {
      return { visibleCount: 0, remainingCount: 0 };
    }
    if (tokens.length <= 1) {
      return { visibleCount: tokens.length, remainingCount: 0 };
    }

    const gap = 5;
    let used = 0;
    let visible = 0;

    for (let i = 0; i < tokens.length; i += 1) {
      const tokenWidth = estimateTokenWidth(tokens[i]);
      const nextUsed = used + (visible > 0 ? gap : 0) + tokenWidth;
      const remainingAfter = tokens.length - (i + 1);

      if (remainingAfter > 0) {
        const moreWidth = estimateMoreWidth(remainingAfter);
        const moreGap = nextUsed > 0 ? gap : 0;
        if (nextUsed + moreGap + moreWidth > containerWidth) {
          break;
        }
      } else if (nextUsed > containerWidth && visible > 0) {
        break;
      }

      used = nextUsed;
      visible += 1;
    }

    if (visible === 0) visible = 1;

    const remaining = Math.max(0, tokens.length - visible);
    return { visibleCount: visible, remainingCount: remaining };
  }, [containerWidth, estimateMoreWidth, estimateTokenWidth, tokens]);

  const visibleTokens = tokens.slice(0, visibleCount);

  return (
    <div
      ref={containerRef}
      className="h-7 w-full min-w-0 max-w-full overflow-hidden"
    >
      <div className="flex h-full w-full items-center gap-1 overflow-hidden">
        {visibleTokens.map((token, idx) => (
          <span
            key={`${token.label}-${idx}`}
            className="inline-flex h-7 shrink-0 items-center overflow-hidden border border-border bg-background"
          >
            <span className="inline-flex h-full items-center bg-background px-2 text-[11px] font-medium leading-none text-foreground">
              {token.label}
            </span>
            {token.count != null && token.count !== "" ? (
              <span className="inline-flex h-full items-center border-l border-primary/20 bg-primary px-2 text-[11px] font-semibold leading-none text-primary-foreground">
                #{token.count}
              </span>
            ) : null}
          </span>
        ))}
        {remainingCount > 0 ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenAll();
            }}
            className="shrink-0 border-0 bg-transparent px-1 text-[11px] font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            +{remainingCount} more
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function AttributeSelection({
  data,
  loading,
  error,
  readOnly = false,
  nodeObj,
  onSubmitSelection,
  resultsFetching = false,
}: Props) {
  const SYNTHETIC_VALUES_COLUMN = "VALUES";
  const payload = data?.attrs_list ?? data?.attributes_for_test ?? null;
  const columns: string[] = Array.isArray(payload?.columns)
    ? payload.columns.map(String)
    : [];
  const rows: Array<any[]> = Array.isArray(payload?.rows) ? payload.rows : [];
  const normalizeCol = React.useCallback((col: string) => {
    return col
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }, []);

  const attributeNameCol = React.useMemo(() => {
    const idx = columns.findIndex((c) => normalizeCol(c) === "attribute_name");
    return idx >= 0 ? idx : null;
  }, [columns, normalizeCol]);

  const dataVersion = React.useMemo(
    () => `${columns.join("|")}::${rows.length}`,
    [columns, rows.length],
  );
  const lastVersionRef = React.useRef<string | null>(null);
  const lastNodeObjRef = React.useRef<any>(null);
  const userEditedRef = React.useRef(false);

  const isSelectedColumn = React.useCallback(
    (col: string) => {
      return normalizeCol(col) === "is_selected";
    },
    [normalizeCol],
  );

  const selectedColIndex = React.useMemo(() => {
    const idx = columns.findIndex((c) => isSelectedColumn(c));
    return idx >= 0 ? idx : null;
  }, [columns, isSelectedColumn]);

  const displayColumns = React.useMemo(() => {
    return columns.filter((c) => !isSelectedColumn(c));
  }, [columns, isSelectedColumn]);

  const attributeValuesByAttribute = React.useMemo(() => {
    const source = data?.attribute_values;
    if (!source || typeof source !== "object") return {} as Record<string, any>;
    return source as Record<string, any>;
  }, [data]);

  const attributeValuesByNormalizedAttribute = React.useMemo(() => {
    const out: Record<
      string,
      {
        byNormalizedLabel: Record<string, { label: string; count: number }>;
        tokens: Array<{ label: string; count: number }>;
      }
    > = {};
    for (const [attrName, rawValueMap] of Object.entries(
      attributeValuesByAttribute,
    )) {
      if (!rawValueMap || typeof rawValueMap !== "object") continue;
      const normalizedAttr = normalizeCol(String(attrName));
      const byNormalizedLabel: Record<string, { label: string; count: number }> =
        {};
      const tokens: Array<{ label: string; count: number }> = [];
      for (const [valueLabel, rawCount] of Object.entries(rawValueMap)) {
        const normalizedValue = normalizeCol(String(valueLabel));
        const count = Number(rawCount);
        const safeCount = Number.isFinite(count) ? count : 0;
        const token = { label: String(valueLabel), count: safeCount };
        byNormalizedLabel[normalizedValue] = token;
        tokens.push(token);
      }
      out[normalizedAttr] = { byNormalizedLabel, tokens };
    }
    return out;
  }, [attributeValuesByAttribute, normalizeCol]);

  const tableRows = React.useMemo(() => {
    const mapped = rows.map((row, idx) => {
      const out: Record<string, any> = { __rowKey: String(idx) };
      columns.forEach((col, idx) => {
        out[col] = row?.[idx];
      });
      const attrName =
        attributeNameCol != null ? row?.[attributeNameCol] : undefined;
      out.__attrKey =
        attrName != null && String(attrName).trim()
          ? String(attrName)
          : String(idx);
      return out;
    });

    if (attributeNameCol == null) return mapped;

    return mapped.slice().sort((a, b) => {
      const aName = String(a[columns[attributeNameCol]] ?? "").toLowerCase();
      const bName = String(b[columns[attributeNameCol]] ?? "").toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [rows, columns, attributeNameCol]);

  const [selectedRows, setSelectedRows] = React.useState<Record<string, any>[]>(
    [],
  );

  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [valuesDialogOpen, setValuesDialogOpen] = React.useState(false);
  const [valuesDialogSearchTerm, setValuesDialogSearchTerm] = React.useState("");
  const [valuesDialogData, setValuesDialogData] = React.useState<{
    attributeName: string;
    tokens: ValueToken[];
  }>({
    attributeName: "",
    tokens: [],
  });

  React.useEffect(() => {
    // Check if the node object has changed (new data from API)
    const nodeObjKey = nodeObj?.id ?? nodeObj?.node_name ?? null;
    const lastNodeObjKey =
      lastNodeObjRef.current?.id ?? lastNodeObjRef.current?.node_name ?? null;
    const nodeChanged = nodeObjKey !== lastNodeObjKey;

    // Only reset selections if:
    // 1. The node has changed, OR
    // 2. This is the first load (lastVersionRef.current is null) OR
    // 3. The data structure has fundamentally changed AND user hasn't manually edited
    const shouldReset =
      nodeChanged ||
      lastVersionRef.current === null ||
      (lastVersionRef.current !== dataVersion && !userEditedRef.current);

    if (!shouldReset) return;

    const next =
      selectedColIndex == null
        ? []
        : tableRows.filter((r) => Boolean(r[columns[selectedColIndex]]));
    lastVersionRef.current = dataVersion;
    lastNodeObjRef.current = nodeObj;
    userEditedRef.current = false;
    setSelectedRows(next);
  }, [tableRows, columns, selectedColIndex, dataVersion, nodeObj]);

  const formatCell = React.useCallback((value: any) => {
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (value == null) return "";
    return String(value);
  }, []);

  const isValuesColumn = React.useCallback(
    (col: string) => {
      const normalized = normalizeCol(col);
      return normalized === "values" || normalized === "value";
    },
    [normalizeCol],
  );

  const tableColumns = React.useMemo(() => {
    const hasValuesColumn = displayColumns.some((c) => isValuesColumn(c));
    return hasValuesColumn
      ? displayColumns
      : [...displayColumns, SYNTHETIC_VALUES_COLUMN];
  }, [displayColumns, isValuesColumn]);

  const parseValueTokens = React.useCallback((value: any) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (item == null) return null;
          if (typeof item === "object") {
            const label =
              item.label ?? item.value ?? item.name ?? item.attribute ?? null;
            const count = item.count ?? item.value_count ?? item.total ?? null;
            if (label == null) return null;
            return {
              label: String(label),
              count: count == null ? null : String(count),
            };
          }
          return { label: String(item), count: null };
        })
        .filter(Boolean) as Array<{ label: string; count: string | null }>;
    }

    if (value != null && typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length > 0) {
        return entries.map(([label, count]) => ({
          label: String(label),
          count: count == null ? null : String(count),
        }));
      }
    }

    const text = formatCell(value);
    if (!text) return [];
    const parts = text.split(/\s*\|\s*|\s*,\s*/).filter(Boolean);
    return parts.map((part) => {
      const match = String(part).match(/^(.*?)(?:\s*#\s*(-?[\d.]+))?$/);
      const label = (match?.[1] ?? String(part)).trim();
      const count = match?.[2] ? String(match[2]).trim() : null;
      return { label, count };
    });
  }, [formatCell]);

  const getAttributeName = React.useCallback(
    (rowData: Record<string, any>) => {
      if (attributeNameCol == null) return "";
      const attrColName = columns[attributeNameCol];
      return String(rowData[attrColName] ?? "").trim();
    },
    [attributeNameCol, columns],
  );

  const getAttributeValueData = React.useCallback(
    (rowData: Record<string, any>) => {
      if (attributeNameCol == null) return null;
      const attrColName = columns[attributeNameCol];
      const rawAttributeName = String(rowData[attrColName] ?? "").trim();
      if (!rawAttributeName) return null;
      const normalizedAttributeName = normalizeCol(rawAttributeName);
      return (
        attributeValuesByNormalizedAttribute[normalizedAttributeName] ?? null
      );
    },
    [
      attributeNameCol,
      columns,
      normalizeCol,
      attributeValuesByNormalizedAttribute,
    ],
  );

  const buildTokensWithCounts = React.useCallback(
    (rowData: Record<string, any>, col: string): ValueToken[] => {
      const tokens = parseValueTokens(rowData[col]);
      const valueData = getAttributeValueData(rowData);

      return tokens.length > 0
        ? tokens.map((token) => {
            if (token.count != null) return token;
            if (!valueData) return token;
            const normalizedTokenLabel = normalizeCol(token.label);
            const matchedCount =
              valueData.byNormalizedLabel[normalizedTokenLabel]?.count;
            return {
              ...token,
              count: matchedCount == null ? null : String(matchedCount),
            };
          })
        : valueData
          ? valueData.tokens.map((t) => ({
              label: t.label,
              count: String(t.count),
            }))
          : [];
    },
    [getAttributeValueData, normalizeCol, parseValueTokens],
  );

  const filteredDialogTokens = React.useMemo(() => {
    if (!valuesDialogSearchTerm.trim()) return valuesDialogData.tokens;
    const q = valuesDialogSearchTerm.trim().toLowerCase();
    return valuesDialogData.tokens.filter((token) =>
      token.label.toLowerCase().includes(q),
    );
  }, [valuesDialogData.tokens, valuesDialogSearchTerm]);

  const filteredTableRows = React.useMemo(() => {
    if (!searchTerm.trim()) return tableRows;
    const lowerSearch = searchTerm.toLowerCase();
    return tableRows.filter((row) =>
      tableColumns.some((col) => {
        const value = String(row[col] ?? "").toLowerCase();
        return value.includes(lowerSearch);
      }),
    );
  }, [tableRows, searchTerm, tableColumns]);

  const isAttributeColumn = React.useCallback(
    (col: string) => {
      return normalizeCol(col).includes("attribute");
    },
    [normalizeCol],
  );

  const [submitting, setSubmitting] = React.useState(false);

  // Clear submitting flag only after results fetching is complete
  React.useEffect(() => {
    if (submitting && !resultsFetching) {
      setSubmitting(false);
    }
  }, [resultsFetching, submitting]);

  const selectedKeys = React.useMemo(() => {
    return new Set(
      selectedRows.map((r) => String(r.__attrKey ?? r.__rowKey ?? "")),
    );
  }, [selectedRows]);

  const allAttributesSelected = React.useMemo(
    () =>
      tableRows.length > 0 &&
      tableRows.every((row) =>
        selectedKeys.has(String(row.__attrKey ?? row.__rowKey ?? "")),
      ),
    [selectedKeys, tableRows],
  );

  const handleToggleSelectAll = React.useCallback(() => {
    if (readOnly) return;
    userEditedRef.current = true;
    setSelectedRows(allAttributesSelected ? [] : tableRows);
  }, [allAttributesSelected, readOnly, tableRows]);

  const submitPayload = React.useMemo(() => {
    if (!columns.length || !rows.length) return null;
    if (selectedColIndex == null) return null;

    const rowsUpdated = rows.map((row, idx) => {
      const key =
        attributeNameCol != null
          ? String(row?.[attributeNameCol] ?? idx)
          : String(idx);
      const selected = selectedKeys.has(String(key));
      const next = Array.isArray(row)
        ? row.slice()
        : columns.map((_, i) => (row as any)?.[i]);
      next[selectedColIndex] = selected;
      return next;
    });

    return {
      attrs_list: {
        columns: columns.slice(),
        rows: rowsUpdated,
      },
    };
  }, [columns, rows, selectedColIndex, selectedKeys, attributeNameCol]);

  const handleSubmit = React.useCallback(async () => {
    if (readOnly) return;
    if (!submitPayload) return;
    if (!onSubmitSelection) return;

    setSubmitting(true);

    try {
      const payload = {
        ...submitPayload,
        node_obj: nodeObj,
      };

      await onSubmitSelection(payload);
      // Don't clear submitting here - let parent's resultsFetching prop control button state
    } catch (error) {
      console.error("Failed to submit attribute selection:", error);
      setSubmitting(false); // Clear on error
    }
  }, [submitPayload, readOnly, nodeObj, onSubmitSelection]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-background px-6 py-3">
        <div className="relative min-w-[240px] flex-1 basis-[320px]">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search attributes or values"
            aria-label="Search attributes or values"
            className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-[12px] text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
          />
        </div>

        <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[12px] tabular-nums text-muted-foreground shadow-xs">
          <span className="font-semibold text-foreground">
            {selectedRows.length} / {tableRows.length}
          </span>
          <span>selected</span>
          {readOnly ? (
            <span className="ml-1 border-l border-border pl-2 font-medium text-foreground">
              View only
            </span>
          ) : null}
        </div>

        <div className="flex h-10 min-w-[260px] flex-[1.2] basis-[360px] items-center gap-2 rounded-md border border-amber-300/70 bg-amber-50 px-3 text-[11px] text-amber-950">
          <Warning className="size-3.5 shrink-0 text-amber-700" />
          <span className="min-w-0 truncate">
            Exclude identifiers such as skuname_ean, Brand, Sub-brand, and EAN
            Code.
          </span>
        </div>

        <Button
          size="sm"
          className="h-10 shrink-0 px-5 text-[12px] font-semibold shadow-sm"
          onClick={handleSubmit}
          disabled={
            readOnly ||
            submitting ||
            loading ||
            resultsFetching ||
            selectedRows.length === 0 ||
            !submitPayload ||
            !onSubmitSelection
          }
        >
          {submitting || resultsFetching ? (
            <>
              <LoaderCircleIcon
                data-icon="inline-start"
                className="animate-spin"
              />
              Processing
            </>
          ) : (
            "Submit"
          )}
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <LoaderCircleIcon className="size-5 animate-spin" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                Loading attributes
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Preparing the available attributes and values.
              </p>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <div className="flex max-w-md items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <CircleAlertIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                Attributes could not be loaded
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {error}
              </p>
            </div>
          </div>
        </div>
      ) : columns.length === 0 || rows.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <DatabaseIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                No attributes available
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Attribute data will appear here when it is available for this
                partition.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 w-full min-w-0 flex-1 overflow-hidden bg-background p-3 sm:p-4">
          <ScrollArea className="h-full w-full border border-border bg-card shadow-xs [&_[data-slot=scroll-area-scrollbar]]:w-1.5 [&_[data-slot=scroll-area-scrollbar]]:bg-background [&_[data-slot=scroll-area-thumb]]:bg-border">
            <DataGrid<Record<string, any>>
              rows={filteredTableRows}
              rowKey={(row) => String(row.__attrKey ?? row.__rowKey ?? "")}
              nativeTable
              wrapperClassName="w-full"
              className="workflow-attribute-table [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10"
              tableStyle={{ width: "100%", tableLayout: "fixed" }}
              emptyMessage="No attributes match your search."
              selectionMode="multiple"
              selectionColumnWidth={52}
              selectionHeader={
                <Checkbox
                  checked={allAttributesSelected}
                  onCheckedChange={handleToggleSelectAll}
                  disabled={readOnly || tableRows.length === 0}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={
                    allAttributesSelected
                      ? "Clear all attribute selections"
                      : "Select all attributes"
                  }
                  className="rounded-none"
                />
              }
              selectionHeaderClassName="col-checkbox"
              selectionCellClassName="col-checkbox"
              selectedKeys={selectedKeys}
              onSelectionChange={(_keys, rows) => {
                userEditedRef.current = true;
                setSelectedRows(rows);
              }}
              columns={tableColumns.map<DataGridColumn<Record<string, any>>>(
              (col) => {
                const attributeColumn = isAttributeColumn(col);
                const valuesColumn = isValuesColumn(col);
                return {
                  key: col,
                  field: col,
                  header: col,
                  width: attributeColumn ? 280 : undefined,
                  headerClassName: valuesColumn
                    ? "col-values"
                    : attributeColumn
                      ? "col-attribute"
                      : undefined,
                  cellClassName: valuesColumn
                    ? "col-values !whitespace-nowrap"
                    : attributeColumn
                      ? "col-attribute"
                      : undefined,
                  cell: (rowData: Record<string, any>) => {
                    const value = formatCell(rowData[col]);
                    if (attributeColumn) {
                      return (
                        <span className="block truncate text-[12px] font-medium text-foreground">
                          {value}
                        </span>
                      );
                    }

                    if (!valuesColumn) {
                      return (
                        <span className="text-[12px] text-muted-foreground">
                          {value}
                        </span>
                      );
                    }

                    const tokensWithCounts = buildTokensWithCounts(
                      rowData,
                      col,
                    );
                    if (tokensWithCounts.length === 0) {
                      return (
                        <span className="text-[12px] text-muted-foreground">
                          -
                        </span>
                      );
                    }

                    const attributeName = getAttributeName(rowData);
                    return (
                      <ValuesViewportCell
                        tokens={tokensWithCounts}
                        onOpenAll={() => {
                          setValuesDialogData({
                            attributeName,
                            tokens: tokensWithCounts,
                          });
                          setValuesDialogSearchTerm("");
                          setValuesDialogOpen(true);
                        }}
                      />
                    );
                  },
                };
              },
            )}
            />
          </ScrollArea>
        </div>
      )}

      <Dialog
        open={valuesDialogOpen}
        onOpenChange={(open) => {
          if (!open) setValuesDialogOpen(false);
        }}
      >
        <DialogContent className="w-[92vw] max-w-[520px] px-4 pt-1 pb-4 sm:max-w-[520px]">
          <DialogHeader className="px-4 py-3">
            <DialogTitle render={<div />}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-[16px] font-semibold text-foreground">
                  {valuesDialogData.attributeName || "Attribute values"}
                </span>
                <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {valuesDialogData.tokens.length} values
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            <ClientSkuLegend className="rounded-md border border-border bg-muted/40 px-3 py-2" />
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={valuesDialogSearchTerm}
                onChange={(e) => setValuesDialogSearchTerm(e.target.value)}
                placeholder="Search attribute values..."
                aria-label="Search attribute values"
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
              />
            </div>
            <div className="max-h-[340px] overflow-y-auto rounded-md border border-border">
              {filteredDialogTokens.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                  No values match your search.
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-muted">
                    <tr>
                      <th className="border-b border-border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Attribute Value
                      </th>
                      <th className="border-b border-border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Client SKUs
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDialogTokens.map((token, idx) => (
                      <tr
                        key={`${token.label}-${idx}`}
                        className="odd:bg-background even:bg-muted/30"
                      >
                        <td className="border-b border-border/70 px-3 py-2 text-[12px] text-foreground">
                          <span className="block truncate">{token.label}</span>
                        </td>
                        <td className="border-b border-border/70 px-3 py-2 text-[12px] font-medium text-muted-foreground">
                          {token.count ?? "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
