export type LookupItem = {
  Id?: string | number;
  id?: string | number;
  value?: string | number;
  NameEn?: string;
  NameAr?: string;
  nameEn?: string;
  nameAr?: string;
  name?: string;
  label?: string;
  labelEn?: string;
};

export type LookupOption = {
  label: string;
  value: string | number;
};

function hasText(value: unknown): value is string | number {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function extractLookupItems(input: unknown): LookupItem[] {
  if (Array.isArray(input)) {
    return input as LookupItem[];
  }

  if (input && typeof input === "object" && "data" in input) {
    const data = (input as { data?: unknown }).data;
    return Array.isArray(data) ? (data as LookupItem[]) : [];
  }

  return [];
}

export function normalizeLookupOptions(
  input: unknown,
  isAr: boolean,
): LookupOption[] {
  return extractLookupItems(input)
    .map((item) => {
      const value = item.Id ?? item.value ?? item.id;
      if (value === undefined || value === null) {
        return null;
      }

      const labelCandidates = isAr
        ? [
            item.NameAr,
            item.nameAr,
            item.NameEn,
            item.nameEn,
            item.name,
            item.label,
            item.labelEn,
          ]
        : [
            item.NameEn,
            item.nameEn,
            item.NameAr,
            item.nameAr,
            item.name,
            item.label,
            item.labelEn,
          ];

      const label =
        labelCandidates.find((candidate) => hasText(candidate)) ?? String(value);

      return {
        label: String(label).trim() || String(value),
        value,
      };
    })
    .filter((item): item is LookupOption => item !== null);
}
