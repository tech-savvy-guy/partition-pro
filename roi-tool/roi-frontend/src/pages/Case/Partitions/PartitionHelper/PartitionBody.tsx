import { useEffect, useMemo, useState } from "react";
import { DataTableFilterMeta } from "primereact/datatable";
import { ColumnFilterElementTemplateOptions } from "primereact/column";
import { FilterMatchMode, FilterOperator } from "primereact/api";
import { Dropdown } from "primereact/dropdown";
import { Tag as DsTag, PrimaryButton } from "@bain/design-system";
import ActionsMenu from "@/components/ActionsMenu";
import { PartitionApi } from "@/core/api";
import SearchInput from "@/components/SearchInput";
import CreateNewPartition, {
  CreatePartitionForm,
} from "../PartitionManagement/CreateNewPartition";
import { Table, Col as Column } from "@/components/table/Table";
import "@/components/table/Table.css";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { canGlobal, Permission } from "@/core/rbac";
import { useAuth } from "@/core/auth/authContext";
import { useUI } from "@/core/ui";
import { useCasePermissions } from "@/core/case/CasePermissionContext";

export type PartitionStatus = "Active" | "Closed" | "Paused";
export type PartitionRow = {
  id: string;
  name: string;
  basePartition?: string | null;
  createdBy: string;
  start: string;
  end: string;
  description: string;
  status: PartitionStatus;
  isShared: boolean;
};

const toCaseTitle = (name: string) =>
  name.replace(/_v\d+$/i, "").replace(/-/g, " - ");

type TagType = "green" | "red" | "gray";
const statusToTagType = (s: PartitionStatus): TagType =>
  s === "Active" ? "green" : s === "Closed" ? "red" : "gray";

const STATUS_OPTIONS: PartitionStatus[] = ["Active", "Closed", "Paused"];

export default function PartitionBody() {
  const formatDDMMYY = (iso?: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  };

  const toUiStatus = (backendStatus: unknown): PartitionStatus => {
    const s = String(backendStatus ?? "").toUpperCase();
    if (s === "CLOSED") return "Closed";
    if (s === "PAUSED") return "Paused";
    return "Active";
  };
  // NOTE: make rows mutable so we can push newly-created items
  const [rows, setRows] = useState<PartitionRow[]>([]);
  const [loadingPartitions, setLoadingPartitions] = useState(false);
  const value = useMemo(() => rows, [rows]);

  // ---- modal open/close
  const [openCreate, setOpenCreate] = useState(false);
  const { caseId } = useParams<{ caseId: string }>();

  // Optional: suggest next name like “…_v6”

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<DataTableFilterMeta>({});

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isDeleting = (id: string) => deletingId === id;
  const { showToast, showConfirm } = useUI();

  const [searchParams] = useSearchParams();
  const finalAnswerId = searchParams.get("finalAnswerId");

  const { permissions } = useCasePermissions();
  const canCreatePartitions = permissions.includes(Permission.CreatePartitions);
  const canEditPartitions = permissions.includes(Permission.EditPartitions);

  const handleToggleShare = async (r: PartitionRow) => {
    if (!caseId) return;

    try {
      showConfirm({
        message: `Are you sure you want to ${
          r.isShared ? "unshare" : "share"
        } partition "${r.name}"?`,
        onConfirm: async () => {
          await PartitionApi.setShared(caseId, r.id, !r.isShared);
          showToast({
            variant: "success",
            message: `Partition "${r.name}" is now ${
              !r.isShared ? "shared" : "unshared"
            }.`,
            duration: 5000,
          });
          // update UI immediately
          setRows((prev) =>
            prev.map((x) =>
              x.id === r.id ? { ...x, isShared: !r.isShared } : x,
            ),
          );
        },
      });
    } catch (e) {
      console.error("Toggle share failed:", e);
      alert("Failed to update share status.");
    }
  };

  const handleDeletePartition = async (r: PartitionRow) => {
    if (!caseId) return;

    try {
      setDeletingId(r.id);

      showConfirm({
        message: `Are you sure you want to delete partition "${r.name}"? This action cannot be undone.`,
        onConfirm: async () => {
          await PartitionApi.delete(caseId, r.id);
          setRows((prev) => prev.filter((x) => x.id !== r.id));
          showToast({
            variant: "success",
            message: `Partition "${r.name}" deleted successfully.`,
            duration: 5000,
          });
        },
      });
    } catch (e) {
      console.error("Delete partition failed:", e);
      alert("Failed to delete partition. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    setFilters({
      global: { value: null, matchMode: FilterMatchMode.CONTAINS },
      name: {
        operator: FilterOperator.AND,
        constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }],
      },
      basePartition: {
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

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      global: { ...(prev as any).global, value: search },
    }));
  }, [search]);

  useEffect(() => {
    if (!caseId) return;

    let mounted = true;

    (async () => {
      try {
        setLoadingPartitions(true);

        const res = await PartitionApi.getPartitionByCaseId(caseId);
        if (!mounted) return;

        const mapped: PartitionRow[] = (res.partitions ?? []).map((p) => ({
          id: p.id,
          name: p.partition_name,
          basePartition: p.base_partition?.partition_name ?? null,
          createdBy: p.created_by ?? "-",
          start: formatDDMMYY(p.created_on ?? null),
          end: formatDDMMYY(p.end_date ?? null),
          description: p.description ?? "-",
          status: toUiStatus(p.status),
          isShared: !!p.is_shared,
        }));

        setRows(mapped);
      } catch (e) {
        if (!mounted) return;
        console.error("Failed to load partitions:", e);
        setRows([]);
      } finally {
        if (mounted) setLoadingPartitions(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [caseId]);

  const nameBody = (r: PartitionRow) => {
    if (isDeleting(r.id)) {
      return <span className="text-gray-400 italic">Deleting…</span>;
    }

    const isFinalAnswer = r.id === finalAnswerId;

    return (
      <div className="flex items-center gap-2">
        <Link
          to={`/cases/${caseId}/partitions/${encodeURIComponent(
            r.id,
          )}/workflow`}
          state={{ partitionName: r.name, caseName: toCaseTitle(r.name) }}
          className="text-red-700 hover:underline"
        >
          {r.name}
        </Link>

        {isFinalAnswer && (
          <DsTag type="green" size="sm" className="whitespace-nowrap">
            Final Answer
          </DsTag>
        )}
      </div>
    );
  };

  const baseBody = (r: PartitionRow) => (
    <span>{r.basePartition ?? "None"}</span>
  );

  const statusBody = (r: PartitionRow) => (
    <DsTag type={statusToTagType(r.status)} className="whitespace-nowrap">
      {r.status}
    </DsTag>
  );

  const { user } = useAuth();

  const detailsBody = (r: PartitionRow) => {
    const disabled = isDeleting(r.id);

    return (
      <ActionsMenu
        entity="partition"
        align="right"
        extraItems={
          disabled
            ? []
            : [
                {
                  key: "toggle-share",
                  label: r.isShared ? "Unshare Partition" : "Share Partition",
                  onClick: () => handleToggleShare(r),
                },
              ]
        }
        permissions={{
          extra: {
            duplicate: Permission.EditPartitions,
          },
        }}
        onDelete={disabled ? undefined : () => handleDeletePartition(r)}
        labels={{
          delete: "Delete",
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
      itemTemplate={(s: PartitionStatus) => (
        <DsTag type={statusToTagType(s)}>{s}</DsTag>
      )}
    />
  );

  // ===== create handler =====
  const handleCreate = async (form: CreatePartitionForm) => {
    if (!caseId) return;

    try {
      // POST create
      await PartitionApi.create(caseId, {
        partitionName: form.name,
        description: form.description,
        basePartitionId: form.duplicateFrom,
        status: "ACTIVE",
        stepStatus: "DRAFT",
      });

      showToast({
        variant: "success",
        message: `Partition "${form.name}" created successfully.`,
        duration: 5000,
      });

      // Reload list so UI stays correct + includes base_partition object
      const res = await PartitionApi.getPartitionByCaseId(caseId);

      const mapped: PartitionRow[] = (res.partitions ?? []).map((p: any) => ({
        id: p.id,
        name: p.partition_name,
        basePartition: p.base_partition?.partition_name ?? null,
        createdBy: p.created_by ?? "-",
        start: formatDDMMYY(p.created_on ?? null),
        end: formatDDMMYY(p.end_date ?? null),
        description: p.description ?? "-",
        status: toUiStatus(p.status),
        isShared: !!p.is_shared,
      }));

      setRows(mapped);
      setOpenCreate(false);
    } catch (e) {
      console.error("Create partition failed:", e);
      alert("Failed to create partition. Please try again.");
    }
  };

  // ===== table header: Search + Create button (same line) =====
  const header = (
    <div className="flex items-center justify-between px-0 py-2">
      <SearchInput
        value={search}
        onChange={setSearch}
        width={380}
        placeholder="Search input text"
      />
      {canGlobal(user, Permission.CreatePartitions) && canCreatePartitions && (
        <PrimaryButton
          variant="primary"
          radius="sm"
          className="flex items-center gap-1"
          onClick={() => setOpenCreate(true)}
        >
          <span>Create new partition</span>
          <span aria-hidden className="text-xl leading-none">
            +
          </span>
        </PrimaryButton>
      )}
    </div>
  );

  return (
    <div className="card mt-5 bg-[#f5e6e3]">
      <Table
        value={value}
        dataKey="id"
        showGridlines
        paginator
        rows={10}
        header={header}
        filters={filters}
        rowClassName={(row: PartitionRow) =>
          isDeleting(row.id) ? "opacity-50 pointer-events-none" : ""
        }
        onFilter={(e) => setFilters(e.filters)}
        globalFilterFields={[
          "name",
          "basePartition",
          "createdBy",
          "start",
          "end",
          "description",
          "status",
        ]}
        emptyMessage={
          loadingPartitions
            ? "Please wait, partitions are loading..."
            : "No partitions found."
        }
        responsiveLayout="scroll"
        className="app-table rounded-md cases-header-grey cases-paginator-right"
      >
        <Column
          field="name"
          header="Partition"
          body={nameBody}
          sortable
          filter
          filterPlaceholder="Search partition"
        />
        <Column
          field="basePartition"
          header="Base Partition"
          body={baseBody}
          sortable
          filter
          filterPlaceholder="Search base"
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
          field="status"
          header="Status"
          body={statusBody}
          filter
          filterElement={statusFilter}
        />
        {canGlobal(user, Permission.EditPartitions) && canEditPartitions && (
          <Column
            header="Details"
            body={detailsBody}
            headerClassName="col-details"
            bodyClassName="col-details"
          />
        )}
      </Table>
      
      <CreateNewPartition
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onSubmit={handleCreate}
        partitions={rows.map(({ id, name }) => ({ id, name }))}
      />
    </div>
  );
}
