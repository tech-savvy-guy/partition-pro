import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTableFilterMeta } from "primereact/datatable";
import { FilterMatchMode, FilterOperator } from "primereact/api";
import SearchInput from "@/components/SearchInput";
import ArchivedCasesViewModal, {
  ArchivedCaseModalData,
} from "./ViewCaseArchiveModal";
import { Table, Col as Column } from "@/components/table/Table";
import { ArchiveIcon } from "@/components/icons/ArchiveIconWhite";
import { CaseApi } from "@/core/api";
import { useAuth } from "@/core/auth/authContext";

// ---- Types ----
export type Row = {
  id: string;
  caseName: string;
  caseCode: string;
  createdBy: string;
  start: string; // "19-11-24"
  lastUpdated: string; // "20-11-24"
  description: string;
};

export default function ArchivedCases() {
  const [rows, setRows] = useState<Row[]>([]);
  const value = useMemo(() => rows, [rows]);

  // global search
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<Row | null>(null);
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [loadingArchived, setLoadingArchived] = useState(false);
  const formatDDMMYY = (iso?: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  };

  // filters for PrimeReact UI
  const [filters, setFilters] = useState<DataTableFilterMeta>({});

  useEffect(() => {
    setFilters({
      global: { value: null, matchMode: FilterMatchMode.CONTAINS },
      caseName: {
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }],
      },
      caseCode: {
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }],
      },
      createdBy: {
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }],
      },
      start: {
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }],
      },
      lastUpdated: {
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }],
      },
      description: {
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }],
      },
    });
  }, []);

  // keep global filter in sync
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      global: { ...(prev as any).global, value: search },
    }));
  }, [search]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    let mounted = true;

    (async () => {
      try {
        setLoadingArchived(true);

        //  archived=true
        const cases = await CaseApi.getAll({ is_archived: true });
        if (!mounted) return;

        const mapped: Row[] = cases.map((c) => ({
          id: c.id,
          caseName: c.name,
          caseCode: c.code,
          createdBy: c.createdBy,
          start: formatDDMMYY(c.createdOn),
          lastUpdated: formatDDMMYY(c.updatedOn ?? c.createdOn), // use updatedOn
          description: c.description ?? "-",
        }));

        setRows(mapped);
      } catch (e) {
        if (mounted) {
          console.error("Failed to load archived cases:", e);
          setRows([]);
        }
      } finally {
        if (mounted) setLoadingArchived(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authLoading, isAuthenticated]);

  const caseBody = (r: Row) => (
    <Link
      to={`/cases/${r.id}/partitions?name=${encodeURIComponent(r.caseName)}`}
      className="text-red-700 hover:underline"
    >
      {r.caseName}
    </Link>
  );

  // center + reuse "view-btn" styling you already use elsewhere
  const detailsBody = (r: Row) => (
    <div className="flex items-center justify-center">
      <button
        type="button"
        className="view-btn inline-flex items-center px-2 py-1 text-[13px] text-red-700 hover:underline focus:underline"
        onClick={() => setViewing(r)}
      >
        View
      </button>
    </div>
  );

  const header = (
    <div className="flex items-center justify-start px-0 py-2">
      <SearchInput value={search} onChange={setSearch} width={420} />
    </div>
  );

  return (
    <div className="w-full">
      {/* Archived Cases Banner Header */}
      <div className="mb-8">
        {/* breadcrumb */}
        <div className="mb-2 text-[13px] text-gray-600">Archive</div>

        {/* full-bleed banner */}
        <div className="-mx-6">
          <div
            className="relative w-full overflow-hidden text-white"
            style={{
              minHeight: 160,
              backgroundImage: "url(/images/banners/banner1.png)",
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right center",
            }}
          >
            {/* gradient overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />

            {/* content */}
            <div className="relative px-6 sm:px-8 py-5 sm:py-6 flex flex-col gap-3">
              <p className="uppercase tracking-[0.22em] text-white/70 text-xs">
                Archive
              </p>

              <div className="flex items-center gap-3">
                <ArchiveIcon className="archive-header-icon h-8 w-8" />
                <h1 className="text-[24px] sm:text-[28px] font-semibold leading-tight">
                  Archived Cases
                </h1>
              </div>

              <p className="text-sm sm:text-[15px] text-white/80 max-w-2xl">
                This page enables you to view closed and archived cases
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* table */}
      <div className="card mt-20 bg-white">
        <Table
          value={value}
          dataKey="id"
          showGridlines
          paginator
          rows={10}
          header={header}
          filters={filters}
          onFilter={(e) => setFilters(e.filters)}
          globalFilterFields={[
            "caseName",
            "caseCode",
            "createdBy",
            "start",
            "lastUpdated",
            "description",
          ]}
          emptyMessage={
            loadingArchived
              ? "Please wait, archived cases are loading..."
              : "No archived cases found."
          }
          responsiveLayout="scroll"
          className="app-table rounded-md cases-header-grey cases-paginator-right"
        >
          <Column
            field="caseName"
            header="Case"
            body={caseBody}
            sortable
            filter
            filterPlaceholder="Search case"
          />
          <Column
            field="caseCode"
            header="Case Code"
            sortable
            filter
            filterPlaceholder="Search code"
          />
          <Column
            field="createdBy"
            header="Created by"
            sortable
            filter
            filterPlaceholder="Search creator"
          />
          <Column
            field="start"
            header="Start"
            sortable
            filter
            filterPlaceholder="Search start"
          />
          <Column
            field="lastUpdated"
            header="Last Updated"
            sortable
            filter
            filterPlaceholder="Search updated"
          />
          <Column
            field="description"
            header="Description"
            filter
            filterPlaceholder="Search description"
          />
          <Column
            header="Details"
            body={detailsBody}
            headerStyle={{ width: "6rem" }}
            headerClassName="col-details text-center"
            bodyClassName="col-details"
            bodyStyle={{
              width: "6rem",
              textAlign: "center",
              verticalAlign: "middle",
              paddingRight: 0,
              whiteSpace: "nowrap",
            }}
          />
        </Table>
      </div>

      {/* CUSTOM MODAL (replaces the basic Dialog) */}
      <ArchivedCasesViewModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        data={
          viewing
            ? ({
                id: viewing.id,
                caseName: viewing.caseName,
                caseCode: viewing.caseCode,
                createdBy: viewing.createdBy,
                start: viewing.start,
                lastUpdated: viewing.lastUpdated,
                description: viewing.description,
                // optional enrichments:
                requestedBy: viewing.createdBy,
                billingCaseCode: "—",
                npsContact: "—",
                productType: "CP BBA",
                caseMembers: ["Sajeev Yadav", "Shivam Shukla", "Shrey Pandey"],
                finalPartitionAnswer: "Blah blah blah",
              } as ArchivedCaseModalData)
            : null
        }
      />
    </div>
  );
}
