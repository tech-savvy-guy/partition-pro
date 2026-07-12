import React, { useEffect, useMemo, useState } from "react";
import "@/pages/Case/Partitions/PartitionHelper/Partitions.css";
import {
  Modal,
  Form,
  Stack,
  TextArea,
  Select,
  SelectItem,
  TextInput,
} from "@bain/design-system";

export type CreatePartitionForm = {
  name: string;
  description: string;
  duplicateFrom: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: CreatePartitionForm) => void;
  partitions: { id: string; name: string }[];
  suggestedName?: string;
};

export default function CreateNewPartition({
  open,
  onClose,
  onSubmit,
  partitions,
  suggestedName,
}: Props) {
  const [name, setName] = useState(suggestedName ?? "");
  const [description, setDescription] = useState("");
  const [duplicateFrom, setDuplicateFrom] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setName(suggestedName ?? "");
      setDescription("");
      setDuplicateFrom(null);
      setTouched(false);
    }
  }, [open, suggestedName]);

  // Build Select options (string value; "" means None)
  const options = useMemo(
    () => [{ id: "", name: "None" }, ...partitions],
    [partitions]
  );

  const canSubmit = name.trim().length > 0 && description.trim().length > 0;
  const dupValue = duplicateFrom ?? "";

  const submit = () => {
    setTouched(true);
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      duplicateFrom,
    });
  };

  return (
    <Modal
      className="partition-modal"
      open={open}
      modalHeading="Create new partition"
      primaryButtonText="Submit"
      secondaryButtonText="Cancel"
      onRequestClose={onClose} // Close icon, ESC, overlay, Cancel
      onRequestSubmit={submit} // Submit button
      primaryButtonDisabled={!canSubmit}
    >
      <Form aria-label="create-partition-form">
        <Stack gap={7}>
          {/* Partition Name */}
          <TextInput
            id="create-partition-name"
            labelText="*Partition Name"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
            placeholder="US - Sun - Refresh_v6"
            light
            invalid={touched && name.trim() === ""}
            invalidText="Partition name is required."
            autoFocus
          />

          <TextArea
            id="create-partition-description"
            labelText="*Description"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setDescription(e.target.value)
            }
            placeholder="Short description"
            rows={5}
            light
            invalid={touched && description.trim() === ""}
            invalidText="Description is required."
          />

          {/* Duplicate from */}
          <Select
            id="create-partition-duplicate-from"
            labelText="Partition to duplicate from"
            value={dupValue}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setDuplicateFrom(e.target.value || null)
            }
            light
          >
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id} text={o.name} />
            ))}
          </Select>
        </Stack>
      </Form>
    </Modal>
  );
}
