import * as React from "react";
import { Button } from "@bain/design-system";
import Warning from "@carbon/icons-react/lib/Warning";
import { Dialog } from "primereact/dialog";
import { Table, Col } from "@/components/table/Table";

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
      className={`flex flex-wrap items-center gap-2 text-[11px] text-gray-600 ${className}`}
    >
      <span className="font-medium text-gray-500">Legend</span>
      <span
        className="inline-flex shrink-0 items-center bg-white"
        style={{ border: "1.5px solid #000000" }}
      >
        <span className="inline-flex h-6 items-center bg-[#f7f8fa] px-2 text-[11px] font-medium text-[#3f4a58]">
          Attribute Value
        </span>
        <span className="inline-flex h-6 items-center bg-[#ef5e67] px-2 text-[11px] font-semibold text-white">
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
      return labelPillWidth + countPillWidth + 3;
    },
    [estimateTextWidth],
  );

  const estimateMoreWidth = React.useCallback(
    (remaining: number) => estimateTextWidth(`+${remaining} more`) + 8,
    [estimateTextWidth],
  );

  const { visibleCount, remainingCount } = React.useMemo(() => {
    if (tokens.length <= 1 || containerWidth <= 0) {
      return { visibleCount: tokens.length, remainingCount: 0 };
    }

    const gap = 4;
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
    <div ref={containerRef} className="w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
        {visibleTokens.map((token, idx) => (
          <span
            key={`${token.label}-${idx}`}
            className="inline-flex shrink-0 items-center bg-white"
            style={{ border: "1.5px solid #000000" }}
          >
            <span className="inline-flex h-6 items-center bg-[#f7f8fa] px-2 text-[11px] font-medium text-[#3f4a58]">
              {token.label}
            </span>
            {token.count != null && token.count !== "" ? (
              <span className="inline-flex h-6 items-center bg-[#ef5e67] px-2 text-[11px] font-semibold text-white">
                #{token.count}
              </span>
            ) : null}
          </span>
        ))}
        {remainingCount > 0 ? (
          <button
            type="button"
            onClick={onOpenAll}
            className="shrink-0 border-0 bg-transparent px-0 text-[11px] font-semibold text-[#d10001] hover:underline pl-2"
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
    <div className="w-full min-w-0 space-y-4">
      <div className="w-full rounded-lg border border-gray-200 bg-gradient-to-r from-white via-gray-50 to-white p-3">
        <div className="grid w-full grid-cols-1 gap-3 xl:grid-cols-[minmax(240px,280px)_auto_1fr_auto] xl:items-center">
          <div className="relative w-full min-w-0">
            <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search attributes..."
              className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-[12px] text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
            />
          </div>

          <div className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-3 text-[12px] font-medium text-gray-600">
            {selectedRows.length} / {filteredTableRows.length} selected
          </div>

          <div className="flex min-w-0 items-center gap-2 rounded-md border border-[#eddc98] bg-[#f6e9b8] px-3 py-2 text-[11px] text-[#5f4f18]">
            <Warning className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">
              Do not select - skuname_ean, Brand, Sub-brand, EAN Code, etc.
            </span>
          </div>

          <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            {!loading && !error && columns.length > 0 && rows.length > 0 ? (
              <ClientSkuLegend className="min-w-0 shrink" />
            ) : null}
            <Button
              kind="primary"
              size="sm"
              className="h-9 w-full shrink-0 !min-w-[96px] px-4 !text-[11px] !font-semibold sm:w-auto"
              onClick={handleSubmit}
              disabled={
                readOnly ||
                submitting ||
                loading ||
                resultsFetching ||
                !submitPayload ||
                !onSubmitSelection
              }
            >
              Submit
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
          Loading attributes...
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : columns.length === 0 || rows.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
          No attribute data available.
        </div>
      ) : (
        <div className="w-full min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-[0_8px_24px_-20px_rgba(15,23,42,0.55)]">
          <Table
            value={filteredTableRows}
            dataKey="__attrKey"
            showGridlines
            scrollable
            scrollHeight="56vh"
            selectionPageOnly
            className="app-table workflow-attribute-table w-full"
            tableStyle={{ minWidth: "100%" }}
            emptyMessage="No results."
            selection={selectedRows as any}
            onSelectionChange={(e: any) => {
              userEditedRef.current = true;
              setSelectedRows((e.value ?? []) as Record<string, any>[]);
            }}
          >
            <Col
              selectionMode="multiple"
              headerClassName="col-checkbox"
              bodyClassName="col-checkbox"
              frozen
            />
            {tableColumns.map((col) => (
              <Col
                key={col}
                field={col}
                header={col}
                frozen={isAttributeColumn(col)}
                style={
                  isValuesColumn(col)
                    ? { width: "100%", minWidth: "22rem" }
                    : isAttributeColumn(col)
                      ? { width: "220px", minWidth: "220px" }
                      : undefined
                }
                body={(rowData: Record<string, any>) => {
                  const value = formatCell(rowData[col]);
                  if (isAttributeColumn(col)) {
                    return (
                      <span className="text-[12px] font-medium text-gray-800">
                        {value}
                      </span>
                    );
                  }

                  if (!isValuesColumn(col)) {
                    return (
                      <span className="text-[12px] text-gray-700">{value}</span>
                    );
                  }

                  const tokensWithCounts = buildTokensWithCounts(rowData, col);
                  if (tokensWithCounts.length === 0) {
                    return <span className="text-[12px] text-gray-500">-</span>;
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
                }}
              />
            ))}
          </Table>
        </div>
      )}

      <Dialog
        visible={valuesDialogOpen}
        modal
        onHide={() => setValuesDialogOpen(false)}
        header={
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-[16px] font-semibold text-gray-900">
              {valuesDialogData.attributeName || "Attribute values"}
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
              {valuesDialogData.tokens.length} values
            </span>
          </div>
        }
        className="[&_.p-dialog-header]:!border-0 [&_.p-dialog-content]:!border-0 [&_.p-dialog-header]:!px-4 [&_.p-dialog-header]:!py-3 w-[92vw] max-w-[520px]"
        contentClassName="!px-4 !pt-1 !pb-4"
      >
        <div className="space-y-2.5">
          <ClientSkuLegend className="rounded-md border border-gray-200 bg-gray-50/60 px-3 py-2" />
          <div className="relative">
            <i className="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-400" />
            <input
              type="text"
              value={valuesDialogSearchTerm}
              onChange={(e) => setValuesDialogSearchTerm(e.target.value)}
              placeholder="Search attribute values..."
              className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-[12px] text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
            />
          </div>
          <div className="max-h-[340px] overflow-y-auto rounded-md border border-gray-200">
            {filteredDialogTokens.length === 0 ? (
              <div className="px-3 py-4 text-[12px] text-gray-500">
                No values found.
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr>
                    <th className="border-b border-gray-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                      Attribute Value
                    </th>
                    <th className="border-b border-gray-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                      Client SKUs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDialogTokens.map((token, idx) => (
                    <tr
                      key={`${token.label}-${idx}`}
                      className="odd:bg-white even:bg-gray-50/40"
                    >
                      <td className="border-b border-gray-100 px-3 py-2 text-[12px] text-gray-800">
                        <span className="block truncate">{token.label}</span>
                      </td>
                      <td className="border-b border-gray-100 px-3 py-2 text-[12px] font-medium text-gray-700">
                        {token.count ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );

}
