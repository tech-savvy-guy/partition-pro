import { useMemo, useState, useEffect, useRef } from "react";
import { DataTableFilterMeta } from "primereact/datatable";
import { ColumnFilterElementTemplateOptions } from "primereact/column";
import { FilterMatchMode, FilterOperator } from "primereact/api";
import { Dropdown } from "primereact/dropdown";
import ViewCaseModal from "./ViewCaseModal";
import type { ViewCaseModalData } from "./ViewCaseModal";
import { Link, useNavigate } from "react-router-dom";
import { Tag as DsTag, PrimaryButton } from "@bain/design-system";
import SearchInput from "@/components/SearchInput";
import ActionsMenu from "@/components/ActionsMenu";
import { Table, Col as Column } from "@/components/table/Table";
import { CaseApi, CaseRow, CaseStatus } from "@/core/api";
import { useAuth } from "@/core/auth/authContext";
import { statusToTagType, toUiStatus } from "./CaseHelper";
import { canGlobal, Permission } from "@/core/rbac";
import { useUI } from "@/core/ui";

const formatDDMMYY = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
};

const STATUS_OPTIONS: CaseStatus[] = ["Active", "Closed", "Paused"];

// ---- Component ----
export default function CasesBody() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [loadingCases, setLoadingCases] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isDeleting = (id: string) => deletingId === id;

  const [rows, setRows] = useState<CaseRow[]>([]);
  const value = useMemo(() => rows, [rows]);

  // global search
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<ViewCaseModalData | null>(null);
  const viewReqRef = useRef(0);

  // filters state required for PrimeReact to show filter UI
  const [filters, setFilters] = useState<DataTableFilterMeta>({});

  // shared ui context
  const { showConfirm, showToast } = useUI();
  const handleView = async (r: CaseRow) => {
    const reqId = ++viewReqRef.current;

    // open modal immediately with row data
    setViewing({
      id: r.id,
      caseName: r.caseName,
      createdBy: r.createdBy,
      start: r.start,
      end: r.end,
      description: r.description,
      status: r.status,
      billingCaseCode: r.caseCode,
      loading: true,
      error: null,
      caseMembers: [],
    });

    try {
      const [details, assignments] = await Promise.all([
        CaseApi.getCaseDetails(r.id),
        CaseApi.getAssignments(r.id),
      ]);

      if (reqId !== viewReqRef.current) return;

      const memberNames = (assignments.assignments ?? [])
        .map((a: any) => a.name || a.email)
        .filter(Boolean);

      setViewing((prev) => {
        if (!prev || prev.id !== r.id) return prev;

        return {
          ...prev,
          caseName: details.caseName ?? prev.caseName,
          billingCaseCode: details.caseCode ?? prev.billingCaseCode,
          requestedBy: details.requestedBy ?? "—",
          npsContact: details.npsContact ?? "—",
          caseManager: details.caseManager ?? "—",
          productType: (details as any).productType ?? "—",
          status: toUiStatus(details.status),
          caseMembers: memberNames,
          loading: false,
          error: null,
        };
      });
    } catch (e) {
      console.error("View case failed:", e);
      if (reqId !== viewReqRef.current) return;

      setViewing((prev) =>
        prev
          ? { ...prev, loading: false, error: "Failed to load case details." }
          : prev,
      );
    }
  };

  useEffect(() => {
    // initialize filters similar to the Prime demo
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
      end: {
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }],
      },
      description: {
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.CONTAINS }],
      },
      status: {
        operator: FilterOperator.OR,
        constraints: [{ value: null, matchMode: FilterMatchMode.EQUALS }],
      },
    });
  }, []);

  // keep global filter text in sync
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
        setLoadingCases(true);

        const cases = await CaseApi.getAll({ is_archived: false });
        if (!mounted) return;

        const mapped: CaseRow[] = cases.map((c) => ({
          id: c.id,
          caseName: c.name,
          caseCode: c.code,
          createdBy: c.createdBy,
          start: formatDDMMYY(c.createdOn),
          end: formatDDMMYY(c.endDate ?? null),
          description: c.description ?? "-",
          status: toUiStatus(c.status),
          isPreprocessed: c.isPreprocessed,
          finalAnswerId: c.finalAnswerId,
          userCaseRole: c.userCaseRole ?? "",
        }));
        setRows(mapped);
      } catch (e) {
        if (mounted) {
          console.error("Failed to load cases:", e);
          setRows([]);
        }
      } finally {
        if (mounted) setLoadingCases(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authLoading, isAuthenticated]);

  const caseBody = (r: CaseRow) => {
    if (isDeleting(r.id)) {
      return <span className="text-gray-400 italic">Deleting…</span>;
    }

    if (!r.isPreprocessed) {
      return (
        <span aria-label="No files uploaded" className="text-gray-400 italic">
          {r.caseName}
        </span>
      );
    }

    // build query params safely
    const params = new URLSearchParams({
      name: r.caseName,
    });

    if (r.finalAnswerId) {
      params.set("finalAnswerId", r.finalAnswerId);
    }

    return (
      <Link
        to={`/cases/${r.id}/partitions?${params.toString()}`}
        className="text-red-700 hover:underline"
      >
        {r.caseName}
      </Link>
    );
  };

  const statusBody = (r: CaseRow) => (
    <DsTag type={statusToTagType(r.status)} className="whitespace-nowrap">
      {r.status}
    </DsTag>
  );
  const handleDelete = async (r: CaseRow) => {
    if (r.userCaseRole && r.userCaseRole !== "PUBLISHER") {
      showToast({
        variant: "error",
        message: `You do not have permission to archive case “${r.caseName}”.`,
        duration: 5000,
      });
      return;
    }

    showConfirm({
      title: "Archive case",
      message: `Are you sure you want to archive case “${r.caseName}”?`,
      destructive: true,
      confirmLabel: "Archive",
      onConfirm: async () => {
        try {
          setDeletingId(r.id);
          // call backend delete (archives the case)
          await CaseApi.delete(r.id);

          // remove from table immediately
          setRows((prev) => prev.filter((x) => x.id !== r.id));

          showToast({
            variant: "success",
            message: `Case “${r.caseName}” has been archived.`,
            duration: 5000,
          });
        } catch (e) {
          console.error("Delete case failed:", e);
          showToast({
            variant: "error",
            message: `Failed to archive case “${r.caseName}”. Please try again.`,
            duration: 7000,
          });
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const detailsBody = (r: CaseRow) => {
    const disabled = isDeleting(r.id);

    return (
      <ActionsMenu
        entity="case"
        onView={disabled ? undefined : () => handleView(r)}
        onEdit={
          disabled
            ? undefined
            : () =>
                navigate(
                  `/cases/${r.id}/edit?name=${encodeURIComponent(r.caseName)}`,
                )
        }
        onDelete={disabled ? undefined : () => handleDelete(r)}
        align="right"
        permissions={{
          view: Permission.ViewCases,
          edit: Permission.EditCases,
          delete: Permission.ArchiveCases,
        }}
      />
    );
  };
  const statusFilter = (opts: ColumnFilterElementTemplateOptions) => (
    <Dropdown
      value={opts.value}
      options={STATUS_OPTIONS}
      onChange={(e) => opts.filterCallback(e.value, opts.index)}
      placeholder="Any"
      className="p-column-filter"
      showClear
      itemTemplate={(s: CaseStatus) => (
        <DsTag type={statusToTagType(s)}>{s}</DsTag>
      )}
    />
  );

  // header with global search + right-aligned create button
  const header = (
    <>
      <div className="mb-3 flex items-start gap-2 rounded-md bg-gray-50 border border-gray-200 px-4 py-3">
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-600 text-xs font-semibold"
          aria-hidden
        >
          i
        </span>
        <p className="text-sm text-gray-600">
          <span className="font-medium">Note:</span> Disabled cases are
          read-only and do not contain any files.
        </p>
      </div>

      <div className="flex items-center justify-between px-0 py-2">
        <SearchInput value={search} onChange={setSearch} width={420} />
        {canGlobal(user, Permission.CreateCases) && (
          <PrimaryButton
            variant="primary"
            radius="sm"
            className="flex items-center gap-2"
            onClick={() => {
              navigate("/cases/new");
            }}
          >
            <span>Create new case</span>
            <span aria-hidden className="text-xl leading-none">
              +
            </span>
          </PrimaryButton>
        )}
      </div>
    </>
  );
  return (
    <div className="card bg-white">
      <Table
        value={value}
        dataKey="id"
        showGridlines
        paginator
        rows={10}
        header={header}
        filters={filters}
        rowClassName={(row: CaseRow) =>
          isDeleting(row.id) ? "opacity-50 pointer-events-none" : ""
        }
        onFilter={(e) => setFilters(e.filters)}
        globalFilterFields={[
          "caseName",
          "caseCode",
          "createdBy",
          "start",
          "end",
          "description",
          "status",
        ]}
        emptyMessage={
          loadingCases ? "Please wait, cases are loading..." : "No cases found."
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
          filterPlaceholder="Search id"
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
          field="end"
          header="End"
          sortable
          filter
          filterPlaceholder="Search end"
        />
        <Column
          field="description"
          header="Description"
          filter
          filterPlaceholder="Search description"
        />
        <Column
          header="Status"
          field="status"
          body={statusBody}
          filter
          filterElement={statusFilter}
        />
        <Column
          header="Details"
          body={detailsBody}
          headerClassName="col-details"
          bodyClassName="col-details"
        />
      </Table>
      <ViewCaseModal
        open={!!viewing}
        onClose={() => setViewing(null)}
        data={viewing}
      />
    </div>
  );
}
