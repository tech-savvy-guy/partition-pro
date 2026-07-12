import * as React from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { ChevronRight } from "@carbon/icons-react";
import { Button, Loading } from "@bain/design-system";
import { Table, Col as Column } from "@/components/table/Table";
import { CaseApi } from "@/core/api";

type Row = Record<string, string>;

export default function ViewFile() {
  const { id: caseId, fileId: datasetId } = useParams<{
    id: string;
    fileId: string;
  }>();
  const [sp] = useSearchParams();
  const fileName = sp.get("name") ?? "file.csv";
  const [fileUrl, setFileUrl] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<Row[]>([]);
  const [columns, setColumns] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const parseCsv = (csv: string) => {
    const lines = csv.split("\n").filter(Boolean);
    const headers = lines[0].split(",").map((h) => h.trim());

    return lines.slice(1).map((line, idx) => {
      const values = line.split(",");
      const row: any = { id: idx };

      headers.forEach((h, i) => {
        row[h] = values[i]?.trim() ?? "";
      });

      return row;
    });
  };

  const downloadFile = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename; // hint to browser
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);

        // 1. Get signed URL
        const res = await CaseApi.viewDataset(caseId!, datasetId!);

        setFileUrl(res.file_url);

        // 2. Fetch CSV from blob
        const csvResponse = await fetch(res.file_url);
        const csvText = await csvResponse.text();

        // 3. Parse CSV
        const parsedRows = parseCsv(csvText);

        if (active) {
          setRows(parsedRows);
        }
      } catch (e) {
        console.error(e);
        if (active) {
          setError("Failed to load dataset.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [caseId, datasetId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loading withOverlay={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <div className="mb-4 pt-10">
        <div className="mb-2 text-[13px] text-gray-600">
          <Link to="/cases" className="hover:underline">
            Cases
          </Link>
          <ChevronRight
            size={12}
            className="mx-1 inline-block text-gray-400 align-[-1px]"
            aria-hidden
          />
          <Link to={`/cases/${caseId}/edit`} className="hover:underline">
            Edit Case
          </Link>
          <ChevronRight
            size={12}
            className="mx-1 inline-block text-gray-400 align-[-1px]"
            aria-hidden
          />
          <span className="text-gray-900">View File</span>
        </div>
        <div className="mt-2 h-px w-full" />
      </div>

      {/* Header */}
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-gray-900">
            Dataset Preview
          </h1>
          <div className="mt-1 text-[13px] text-gray-600">{fileName}</div>
        </div>
        <Button
          kind="primary"
          disabled={!fileUrl}
          onClick={() => {
            if (!fileUrl) return;
            downloadFile(fileUrl, fileName);
          }}
        >
          Download file
        </Button>
      </div>

      {/* Search (client-side) */}
      <div className="mt-3">
        <input
          type="text"
          placeholder="Search values"
          className="w-full rounded border border-gray-300 px-3 py-2 text-[14px] outline-none focus:border-gray-500"
        />
      </div>

      {/* Table */}
      {loading && (
        <div className="flex justify-center py-10">
          <Loading />
        </div>
      )}

      {error && <div className="text-red-600 text-sm py-4">{error}</div>}

      {!loading && !error && (
        <Table<any[]>
          value={rows}
          dataKey="id"
          paginator
          rows={50}
          responsiveLayout="scroll"
          showGridlines
          className="app-table rounded-md cases-header-grey"
        >
          {rows.length > 0 &&
            Object.keys(rows[0])
              .filter((k) => k !== "id")
              .map((col) => (
                <Column key={col} field={col} header={col} sortable />
              ))}
        </Table>
      )}
    </div>
  );
}
