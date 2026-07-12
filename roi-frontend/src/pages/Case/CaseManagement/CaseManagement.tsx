import * as React from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import "./CaseMangement.css";
import CaseDetails from "./CaseManagementHelper/CaseDetails";
import CaseManagementModal from "./CaseManagementHelper/CaseManagementModal";
import CaseManagementHeader from "./CaseManagementHelper/CaseManagementHeader";

import { useUI } from "@/core/ui";
import { CaseApi } from "@/core/api";
import { useAuth } from "@/core/auth/authContext";

import ColorPalette from "./CaseManagementHelper/ColorPalette";
import MembersDetails from "./CaseManagementHelper/MembersDetails";
import CaseFileDetails, { FileRow } from "./CaseManagementHelper/CaseFileDetails";

import { Accordion, AccordionItem } from "@bain/design-system";

export type MemberRole = "Publisher" | "Editor" | "Viewer";

export type Member = {
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
};

type CaseStatus = "Active" | "Closed";

export default function CaseManagement() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const mode: "create" | "edit" = id ? "edit" : "create";
  const [methodology, setMethodology] = React.useState<string>("ROI");
  const [category, setCategory] = React.useState<string>("CP");
  const [members, setMembers] = React.useState<Member[]>([]);
  const [caseName, setCaseName] = React.useState("");
  const [status, setStatus] = React.useState<CaseStatus>("Active");
  const [rows, setRows] = React.useState<FileRow[]>([]);
  const [selectedFiles, setSelectedFiles] = React.useState<FileRow[]>([]);
  const [closeModalOpen, setCloseModalOpen] = React.useState(false);
  const [caseCode, setCaseCode] = React.useState("");
  const [requestedBy, setRequestedBy] = React.useState("");
  const [caseManager, setCaseManager] = React.useState("");
  const [npsContact, setNpsContact] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [loadingEdit, setLoadingEdit] = React.useState(false);
  const [loadingMembers, setLoadingMembers] = React.useState(false);
  const [loadingFiles, setLoadingFiles] = React.useState(false);
  const editLoadPromiseRef = React.useRef<{
    id: string;
    promise: Promise<any>;
  } | null>(null);
  const isPageLoading =
    mode === "edit" && (loadingEdit || loadingMembers || loadingFiles);

  const location = useLocation();
  const uploadDisabled = status !== "Active";
  const usedFromCreateForIdRef = React.useRef<string | null>(null);
  const { showToast } = useUI();
  type FromCreateState = {
    fromCreate?: boolean;
    caseId?: string;
    prefill?: {
      caseName: string;
      methodology: string;
      category: string;
      caseCode: string;
      requestedBy: string;
      caseManager: string;
      npsContact: string;
      description: string;
      status: CaseStatus;
    };
  };

  React.useEffect(() => {
    // CREATE MODE: no calls + reset UI
    if (mode === "create") {
      editLoadPromiseRef.current = null;

      setMethodology("ROI");
      setCategory("CP");
      setCaseName("");
      setStatus("Active");
      setCaseCode("");
      setRequestedBy("");
      setCaseManager("");
      setNpsContact("");
      setDescription("");
      setRows([]);
      setMembers([]);

      return;
    }

    // EDIT MODE
    if (!id) return;

    //  If we just navigated here from CREATE, skip the 3 GET calls
    const navState = (location.state ?? null) as FromCreateState | null;

    if (navState?.fromCreate && navState?.caseId === id) {
      // apply prefill once, but ALWAYS skip fetch (StrictMode runs effects twice)
      if (usedFromCreateForIdRef.current !== id && navState.prefill) {
        usedFromCreateForIdRef.current = id;

        const p = navState.prefill;
        setCaseName(p.caseName);
        setCaseCode(p.caseCode);
        setMethodology(p.methodology);
        setCategory(p.category);
        setRequestedBy(p.requestedBy);
        setCaseManager(p.caseManager);
        setNpsContact(p.npsContact);
        setDescription(p.description);
        setStatus(p.status);

        // newly created case: no files yet, members can be loaded on-demand
        setRows([]);
        // keep members as-is (likely empty), or set to [] explicitly:
        // setMembers([]);
      }

      // ensure loading flags are not stuck
      setLoadingEdit(false);
      setLoadingMembers(false);
      setLoadingFiles(false);

      // don't reuse any old promise
      editLoadPromiseRef.current = null;

      return;
    }

    // ---- Normal edit flow (coming from list / refresh / deep link) ----
    let active = true;

    setLoadingEdit(true);
    setLoadingMembers(true);
    setLoadingFiles(true);

    const promise =
      editLoadPromiseRef.current?.id === id
        ? editLoadPromiseRef.current.promise
        : Promise.all([
            CaseApi.getCaseDetails(id),
            CaseApi.getAssignments(id),
            CaseApi.getDatasets(id),
          ]);

    editLoadPromiseRef.current = { id, promise };

    (async () => {
      try {
        const [caseRes, memberRes, datasetRes] = await promise;
        if (!active) return;

        setCaseName(caseRes.caseName ?? "");
        setCaseCode(caseRes.caseCode ?? "");
        setMethodology(caseRes.methodology ?? "ROI");
        setCategory(caseRes.category ?? "CP");
        setRequestedBy(caseRes.requestedBy ?? "");
        setCaseManager(caseRes.caseManager ?? "");
        setNpsContact(caseRes.npsContact ?? "");
        setDescription(caseRes.description ?? "");

        const s = String(caseRes.status || "").toUpperCase();
        setStatus(s === "CLOSED" ? "Closed" : "Active");

        const palette = caseRes.tags?.brandColors;
        if (Array.isArray(palette) && palette.length > 0) {
          setSavedColors(palette);
        }

        const backendToUiRole = (role: string): MemberRole => {
          const r = String(role || "").toUpperCase();
          if (r === "PUBLISHER") return "Publisher";
          if (r === "EDITOR") return "Editor";
          return "Viewer";
        };

        setMembers(
          (memberRes.assignments ?? []).map((a: any) => ({
            userId: a.user_id,
            name: a.name,
            email: a.email,
            role: backendToUiRole(a.role),
          }))
        );
        const mappedRows = mapDatasetsToRows(datasetRes);
        const all = datasetRes.datasets ?? [];

        setRows(mappedRows);
        setSelectedFiles(mappedRows.filter((r) => r.isSelected));
      } catch (e) {
        if (!active) return;
        console.error("Failed to load edit data:", e);
        setRows([]);
        setMembers([]);
      } finally {
        if (!active) return;

        setLoadingEdit(false);
        setLoadingMembers(false);
        setLoadingFiles(false);

        if (editLoadPromiseRef.current?.id === id) {
          editLoadPromiseRef.current = null;
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [mode, id, location.state]);

  const [createdCaseId, setCreatedCaseId] = React.useState<string | null>(null);
  const [savedColors, setSavedColors] = React.useState<string[]>([]);

  const handleSubmit = async () => {
    // only create mode should POST
    if (mode !== "create") return;

    // minimal validation
    if (!tenantId) {
      alert("Tenant not found. Please login again.");
      return;
    }

    if (
      !caseName.trim() ||
      !methodology.trim() ||
      !category.trim() ||
      !caseCode.trim() ||
      !requestedBy.trim() ||
      !caseManager.trim() ||
      !npsContact.trim() ||
      !description.trim()
    ) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await CaseApi.createCaseDetails(tenantId, {
        caseName,
        methodology,
        category,
        caseCode,
        requestedBy,
        caseManager,
        npsContact,
        description,

        // keep status optional (backend defaults DRAFT)
        // status: status === "Closed" ? "CLOSED" : "OPEN",
      });
      setIsCreated(true);
      setCreatedCaseId(res.id); // enable accordions immediately (even before navigate)
      showToast({
        variant: "success",
        message: "Case created successfully.",
        duration: 4000,
      });
    } catch (e) {
      console.error("Create case failed:", e);
      showToast({
        variant: "error",
        message: "Failed to create case. Please try again.",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleUpdate = async () => {
    if (mode !== "edit" || !id) return;

    try {
      setIsSubmitting(true);

      await CaseApi.updateCaseDetails(id, {
        caseName,
        methodology,
        category,
        caseCode,
        requestedBy,
        caseManager,
        npsContact,
        description,
        status: status === "Closed" ? "CLOSED" : "IN_PROGRESS",
      });

      showToast({
        variant: "success",
        message: "Case updated successfully.",
        duration: 4000,
      });
    } catch (e) {
      console.error("Update failed:", e);
      showToast({
        variant: "error",
        message: "Failed to update case. Please try again.",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const mapDatasetsToRows = React.useCallback((datasetRes: any): FileRow[] => {
    const mapDataType = (dt: string) => {
      if (dt === "POS") return "Point of Sales";
      if (dt === "ATTRIBUTES") return "Attribute Sheet";
      if (dt === "CROSSPURCHASE") return "Cross Purchase";
      return "Sample";
    };

    const all = datasetRes?.datasets ?? [];

    return all.map((d: any) => ({
      id: d.id,
      file: d.file_name,
      uploadedBy: d.created_by,
      dataType: mapDataType(d.data_type) as any,
      version: d.version,
      description: d.status ?? "-", // backend doesn't send description currently
      isSelected: d.is_selected ?? false,
      tags: d.tags,
    }));
  }, []);


  const effectiveCaseId = mode === "edit" ? id! : createdCaseId;
  const extrasEnabled = !!effectiveCaseId;

  const refreshDatasets = React.useCallback(async () => {
    if (!effectiveCaseId) return;

    const datasetRes = await CaseApi.getDatasets(effectiveCaseId);
    const mappedRows = mapDatasetsToRows(datasetRes);

    setRows(mappedRows);
  }, [effectiveCaseId, mapDatasetsToRows, showToast]);

  const handleCancel = () => navigate("/cases");

  const handleStatusChange = (next: CaseStatus) => {
    // If user selects Closed, open modal instead of immediately updating status
    if (next === "Closed") {
      setCloseModalOpen(true);
      return;
    }

    // Otherwise normal behavior
    setStatus(next);
  };

  const [isCreated, setIsCreated] = React.useState(false);
  if (isPageLoading) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-[#C41230]" />
          <p className="text-sm text-gray-600">Loading case details…</p>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full">
      <CaseManagementHeader
        mode={mode}
        title={mode === "edit" ? "Edit Case" : "Create Case"}
        subtitle={
          mode === "edit"
            ? "Update case details, members, and files"
            : "Create a new case and add members and files"
        }
      />

      {/* ===== Accordions under header ===== */}
      <div className="case-management-accordion mt-4 w-full">
        <Accordion>
          {/* 1. Case Details */}
          <AccordionItem title="Case Details" open={true}>
            <div className="!pr-16px w-full">
              <CaseDetails
                mode={mode}
                caseName={caseName}
                status={status}
                methodology={methodology}
                category={category}
                caseCode={caseCode}
                requestedBy={requestedBy}
                caseManager={caseManager}
                npsContact={npsContact}
                description={description}
                onCaseNameChange={setCaseName}
                onStatusChange={handleStatusChange}
                onMethodologyChange={setMethodology}
                onCategoryChange={setCategory}
                onCaseCodeChange={setCaseCode}
                onRequestedByChange={setRequestedBy}
                onCaseManagerChange={setCaseManager}
                onNpsContactChange={setNpsContact}
                onDescriptionChange={setDescription}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                onUpdate={handleUpdate}
                isSubmitting={isSubmitting}
                isCreated={isCreated}
              />
            </div>
          </AccordionItem>

          {/* 2. Case File Details */}
          <AccordionItem title="Case File Details">
            {extrasEnabled ? (
              <CaseFileDetails
                mode={mode}
                rows={rows}
                caseId={effectiveCaseId}
                selection={selectedFiles}
                onSelectionChange={setSelectedFiles}
                onRefreshDatasets={refreshDatasets}
                uploadDisabled={uploadDisabled}
              />
            ) : (
              <div className="p-4 text-sm text-gray-500">
                "Create the case first to upload files."
              </div>
            )}
          </AccordionItem>

          {/* 3. Add Members */}
          <AccordionItem title="Add Members">
            <div className="!pr-0 w-full">
              {extrasEnabled ? (
                <MembersDetails
                  mode={mode}
                  members={members}
                  onMembersChange={setMembers}
                  caseId={effectiveCaseId}
                />
              ) : (
                <div className="p-4 text-sm text-gray-500">
                  Create the case first to add members.
                </div>
              )}
            </div>
          </AccordionItem>

          {/* 4. Colour Palette */}
          <AccordionItem title="Brand Color Palette">
            {extrasEnabled ? (
              <ColorPalette
                initialColors={savedColors}
                onSave={async (hexColors) => {
                  const caseId = effectiveCaseId!;
                  await CaseApi.updateCaseDetails(caseId, {
                    caseName,
                    methodology,
                    category,
                    caseCode,
                    requestedBy,
                    caseManager,
                    npsContact,
                    description,
                    status: status === "Closed" ? "CLOSED" : "IN_PROGRESS",
                    tags: { brandColors: hexColors },
                  });
                }}
              />
            ) : (
              <div className="p-4 text-sm text-gray-500">
                Create the case first to set a color palette.
              </div>
            )}
          </AccordionItem>
        </Accordion>
      </div>

      {mode === "edit" && (
        <CaseManagementModal
          open={closeModalOpen}
          onClose={() => setCloseModalOpen(false)}
          caseName={caseName}
          onCaseNameChange={setCaseName}
          rows={rows}
          selection={selectedFiles}
          onSelectionChange={setSelectedFiles}
          onSubmit={async ({ finalAnswer, selectedIds }) => {
            try {
              if (!id) return;

              // 1. Call CLOSE CASE API (preferred)
              await CaseApi.updateCaseDetails(id, {
                caseName,
                methodology,
                category,
                caseCode,
                requestedBy,
                caseManager,
                npsContact,
                description,
                status: "CLOSED",
                finalAnswer: finalAnswer,
              });

              // 2. Call dataset api to update the selected datasets
              await CaseApi.selectDatasets(id, selectedIds);

              // 3. Update local UI state
              setStatus("Closed");
              setCloseModalOpen(false);

              showToast({
                variant: "success",
                message: "Case closed successfully.",
                duration: 4000,
              });
            } catch (e) {
              showToast({
                variant: "error",
                message: "Failed to close case.",
                duration: 5000,
              });
            }
          }}
        />
      )}
    </div>
  );
}
