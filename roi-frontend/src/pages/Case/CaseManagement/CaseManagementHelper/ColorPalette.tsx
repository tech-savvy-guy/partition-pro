import * as React from "react";
import { useUI } from "@/core/ui";
import { Button } from "@bain/design-system";

const MAX_COLORS = 10;

function isValidHex(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

type ColorEntry = { id: string; hex: string };

type Props = {
  disabled?: boolean;
  /** Pre-populate from saved backend data (edit mode) */
  initialColors?: string[];
  /** Called with the validated hex array; expected to call the backend */
  onSave: (colors: string[]) => Promise<void>;
};

export default function ColorPalette({ disabled = false, initialColors, onSave }: Props) {
  const toEntries = (hexList: string[]): ColorEntry[] =>
    hexList.map((hex) => ({ id: crypto.randomUUID(), hex }));

  const [colors, setColors] = React.useState<ColorEntry[]>(() =>
    initialColors && initialColors.length > 0
      ? toEntries(initialColors)
      : [{ id: crypto.randomUUID(), hex: "#C41230" }],
  );

  // Sync if initialColors arrives after first render (async load in edit mode)
  React.useEffect(() => {
    if (initialColors && initialColors.length > 0) {
      setColors(toEntries(initialColors));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialColors)]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const { showToast } = useUI();

  const addColor = () => {
    if (colors.length >= MAX_COLORS) return;
    setColors((prev) => [...prev, { id: crypto.randomUUID(), hex: "#000000" }]);
  };

  const removeColor = (id: string) => {
    setColors((prev) => prev.filter((c) => c.id !== id));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateColorFromPicker = (id: string, hex: string) => {
    setColors((prev) => prev.map((c) => (c.id === id ? { ...c, hex } : c)));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateColorFromText = (id: string, value: string) => {
    const normalized = value.startsWith("#") ? value : `#${value}`;
    setColors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, hex: normalized } : c)),
    );
    if (!isValidHex(normalized)) {
      setErrors((prev) => ({ ...prev, [id]: "Invalid hex colour" }));
    } else {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleSave = async () => {
    const hexValues = colors.map((c) => c.hex);
    const hasInvalid = hexValues.some((h) => !isValidHex(h));
    if (hasInvalid) {
      const newErrors: Record<string, string> = {};
      colors.forEach((c) => {
        if (!isValidHex(c.hex)) newErrors[c.id] = "Invalid hex colour";
      });
      setErrors(newErrors);
      return;
    }
    try {
      setIsSaving(true);
      await onSave(hexValues);
      showToast({ variant: "success", message: "Colour palette saved.", duration: 3000 });
    } catch (e) {
      console.error("[ColorPalette] Failed to save palette:", e);
      showToast({ variant: "error", message: "Failed to save colour palette.", duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-md bg-white p-6 shadow-sm">
      <p className="text-[13px] text-gray-500 mb-4">
        Add up to {MAX_COLORS} brand colours for this case. Click the swatch to
        open the colour picker or type a hex value directly.
      </p>

      <div className="flex flex-wrap gap-4">
        {colors.map((entry, index) => (
          <div key={entry.id} className="flex flex-col items-center gap-1">
            {/* Swatch / native picker */}
            <label
              className="relative cursor-pointer"
              title="Pick a colour"
              style={{ display: "block" }}
            >
              <div
                className="w-12 h-12 rounded-md border border-gray-300 shadow-sm"
                style={{ backgroundColor: isValidHex(entry.hex) ? entry.hex : "#ffffff" }}
              />
              <input
                type="color"
                value={isValidHex(entry.hex) ? entry.hex : "#000000"}
                onChange={(e) => updateColorFromPicker(entry.id, e.target.value)}
                disabled={disabled}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                aria-label={`Colour ${index + 1} picker`}
              />
            </label>

            {/* Hex input */}
            <input
              type="text"
              value={entry.hex}
              onChange={(e) => updateColorFromText(entry.id, e.target.value)}
              disabled={disabled}
              maxLength={7}
              className={[
                "w-20 text-center text-[12px] font-mono border rounded px-1 py-0.5 focus:outline-none focus:ring-1",
                errors[entry.id]
                  ? "border-red-500 focus:ring-red-400"
                  : "border-gray-300 focus:ring-gray-400",
              ].join(" ")}
              aria-label={`Colour ${index + 1} hex value`}
            />
            {errors[entry.id] && (
              <span className="text-[10px] text-red-600">
                {errors[entry.id]}
              </span>
            )}

            {/* Remove button */}
            {colors.length > 1 && (
              <button
                type="button"
                onClick={() => removeColor(entry.id)}
                disabled={disabled}
                className="text-[11px] text-gray-400 hover:text-red-600 transition-colors"
                aria-label={`Remove colour ${index + 1}`}
              >
                Remove
              </button>
            )}
          </div>
        ))}

        {/* Add-colour tile */}
        {colors.length < MAX_COLORS && !disabled && (
          <button
            type="button"
            onClick={addColor}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-md border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors self-start"
            aria-label="Add colour"
          >
            <span className="text-2xl leading-none">+</span>
          </button>
        )}
      </div>

      {colors.length >= MAX_COLORS && (
        <p className="mt-3 text-[12px] text-amber-600">
          Maximum of {MAX_COLORS} colours reached.
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          kind="primary"
          size="sm"
          onClick={handleSave}
          disabled={disabled || isSaving || Object.keys(errors).length > 0}
        >
          {isSaving ? "Saving…" : "Save Palette"}
        </Button>
      </div>
    </div>
  );
}
