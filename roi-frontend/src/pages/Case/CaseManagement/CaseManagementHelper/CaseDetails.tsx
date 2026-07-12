import * as React from "react";
import {
  Form,
  TextInput,
  Select,
  SelectItem,
  Button,
  ButtonSet,
} from "@bain/design-system";
import { useOptionalCasePermissions } from "@/core/case/useOptionalCasePermissions";
import { useAuth } from "@/core/auth/authContext";
import { Permission } from "@/core/rbac";

type CaseStatus = "Active" | "Closed";
type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  caseName: string;
  status: CaseStatus;
  methodology: string;
  category: string;
  caseCode: string;
  requestedBy: string;
  caseManager: string;
  npsContact: string;
  description: string;

  onCaseNameChange: (v: string) => void;
  onStatusChange: (v: CaseStatus) => void;
  onMethodologyChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onCaseCodeChange: (v: string) => void;
  onRequestedByChange: (v: string) => void;
  onCaseManagerChange: (v: string) => void;
  onNpsContactChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;

  onSubmit: () => void;
  onUpdate?: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  isCreated?: boolean;
};

export default function CaseDetails(props: Props) {
  const {
    mode,
    caseName,
    status,
    methodology,
    category,
    caseCode,
    requestedBy,
    caseManager,
    npsContact,
    description,
    onSubmit,
    onUpdate,
    onCancel,
    isSubmitting,
    isCreated,
  } = props;

  const isEdit = mode === "edit";
  const isCloseEdit = isEdit && status === "Closed";
  const casePerms = useOptionalCasePermissions();
  const { user } = useAuth();

  const canEditCase =
    user?.role === "TECH_ADMIN" ||
    (mode === "create"
      ? user?.permissions?.includes(Permission.CreateCases)
      : casePerms?.permissions.includes(Permission.EditCaseDetails));

  const isFieldDisabled = isCloseEdit || !canEditCase;

  /**
   * Snapshot initial values (for edit dirty check)
   */
  const initialRef = React.useRef({
    caseName,
    status,
    methodology,
    category,
    caseCode,
    requestedBy,
    caseManager,
    npsContact,
    description,
  });

  /**
   * Check if all required fields are filled
   */
  const isValid = React.useMemo(() => {
    return [
      caseName,
      methodology,
      category,
      caseCode,
      requestedBy,
      caseManager,
      npsContact,
      description,
    ].every((v) => v.trim().length > 0);
  }, [
    caseName,
    methodology,
    category,
    caseCode,
    requestedBy,
    caseManager,
    npsContact,
    description,
  ]);

  /**
   * Dirty check (edit mode only)
   */
  const isDirty = React.useMemo(() => {
    if (!isEdit) return true;

    const initial = initialRef.current;
    return (
      initial.caseName !== caseName ||
      initial.status !== status ||
      initial.methodology !== methodology ||
      initial.category !== category ||
      initial.caseCode !== caseCode ||
      initial.requestedBy !== requestedBy ||
      initial.caseManager !== caseManager ||
      initial.npsContact !== npsContact ||
      initial.description !== description
    );
  }, [
    isEdit,
    caseName,
    status,
    methodology,
    category,
    caseCode,
    requestedBy,
    caseManager,
    npsContact,
    description,
  ]);

  /**
   * Disable logic
   */
  const disablePrimary =
    isSubmitting ||
    isCreated ||
    !isValid ||
    !canEditCase ||
    (isEdit && !isDirty) ||
    (isEdit && status === "Closed");

  return (
    <div className="mt-2 w-full mr-4 rounded-md bg-white p-6 shadow-sm">
      <Form aria-label="case-form">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
          {/* Case Name */}
          <div className="md:col-span-2 -mt-2">
            <TextInput
              id="ec-name"
              labelText="*Case Name"
              value={caseName}
              placeholder="US_Sun_Refresh"
              onChange={(e: any) => props.onCaseNameChange(e.target.value)}
              disabled={isFieldDisabled}
              required
            />
          </div>

          {/* Methodology */}
          <div>
            <Select
              id="ec-methodology"
              labelText="*Methodology"
              value={methodology}
              onChange={(e: any) =>
                props.onMethodologyChange(e?.target?.value ?? e?.value)
              }
              disabled={isFieldDisabled}
              required
            >
              <SelectItem value="ROI" text="ROI" />
              <SelectItem value="Visual approach" text="Visual approach" />
              <SelectItem value="Both" text="Both" />
            </Select>
          </div>

          {/* Category → TextInput */}
          <div>
            <TextInput
              id="ec-category"
              labelText="*Category"
              value={category}
              onChange={(e: any) => props.onCategoryChange(e.target.value)}
              disabled={isFieldDisabled}
              required
            />
          </div>

          {/* Left column */}
          <div className="space-y-6">
            <TextInput
              id="ec-billing"
              labelText="*Billing Case Code"
              value={caseCode}
              onChange={(e: any) => props.onCaseCodeChange(e.target.value)}
              disabled={isFieldDisabled}
              required
            />

            <TextInput
              id="ec-manager"
              labelText="*Case Manager"
              value={caseManager}
              onChange={(e: any) => props.onCaseManagerChange(e.target.value)}
              disabled={isFieldDisabled}
              required
            />

            <Select
              id="ec-status"
              labelText="Case Status"
              value={status}
              disabled={!canEditCase}
              onChange={(e: any) =>
                props.onStatusChange(
                  (e?.target?.value ?? e?.value) as CaseStatus
                )
              }
            >
              <SelectItem value="Active" text="Active" />
              <SelectItem value="Closed" text="Closed" />
            </Select>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <TextInput
              id="ec-requested"
              labelText="*Requested by"
              value={requestedBy}
              disabled={isFieldDisabled}
              onChange={(e: any) => props.onRequestedByChange(e.target.value)}
              required
            />

            <TextInput
              id="ec-nps"
              labelText="*NPS Contact"
              value={npsContact}
              disabled={isFieldDisabled}
              onChange={(e: any) => props.onNpsContactChange(e.target.value)}
              required
            />

            <TextInput
              id="ec-description"
              labelText="*Description"
              disabled={isFieldDisabled}
              value={description}
              onChange={(e: any) => props.onDescriptionChange(e.target.value)}
              required
            />

            <TextInput
              id="ec-product"
              labelText="Product Type"
              placeholder="CP BBA"
              disabled
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex justify-center">
          <ButtonSet>
            <Button kind="secondary" size="sm" onClick={onCancel}>
              Cancel
            </Button>

            {isEdit ? (
              <Button
                kind="primary"
                size="sm"
                onClick={onUpdate}
                disabled={disablePrimary}
              >
                Update
              </Button>
            ) : (
              <Button
                kind="primary"
                size="sm"
                onClick={onSubmit}
                disabled={disablePrimary}
              >
                {isCreated
                  ? "Created"
                  : isSubmitting
                  ? "Creating..."
                  : "Create"}
              </Button>
            )}
          </ButtonSet>
        </div>
      </Form>
    </div>
  );
}
