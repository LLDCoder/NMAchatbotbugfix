/**
 * Build plain-text summary for native `title` / tooltips from multi-select value + options.
 * Supports designable enum shape ({ value, label }) and language API shape ({ id, nameEn }).
 */
const selectedTexts = (
  selectedValues: any,
  mergedOptions: any[],
  label: string = "label",
  value: string = "value",
) => {
  const vals = Array.isArray(selectedValues)
    ? selectedValues
    : selectedValues != null && selectedValues !== ""
    ? [selectedValues]
    : [];

  if (!vals.length || !mergedOptions?.length) return "";

  return mergedOptions
    .filter((opt) => {
      const key = opt[value] ?? opt.value ?? opt.id ?? opt.code;
      return vals.some((v) => v === key || String(v) === String(key));
    })
    .map((opt) => {
      const raw = opt[label] ?? opt.label ?? opt.nameEn;
      if (raw == null) return "";
      return typeof raw === "string" || typeof raw === "number"
        ? String(raw)
        : "";
    })
    .filter(Boolean)
    .join(", ");
};

export default selectedTexts;
