export type BookCollectTypeKind =
  | "PrintingPermit"
  | "RegulateEntryPermit"
  | "BookFair"
  | "LocalDistributor"
  | "SampleForTest"
  | "NMCAdvanceList"
  | "Unknown";

const BOOK_COLLECT_TYPE_KIND_BY_ID: Record<string, BookCollectTypeKind> = {
  "1": "PrintingPermit",
  "2": "RegulateEntryPermit",
  "3": "BookFair",
  "4": "LocalDistributor",
  "5": "SampleForTest",
  "6": "NMCAdvanceList",
};

const resolveBookCollectTypeId = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const item = value as {
      Id?: unknown;
      id?: unknown;
      value?: unknown;
    };

    return item.Id ?? item.id ?? item.value;
  }

  return value;
};

export const resolveBookCollectTypeKindById = (
  value: unknown,
): BookCollectTypeKind => {
  const id = resolveBookCollectTypeId(value);
  if (id === undefined || id === null || id === "") return "Unknown";

  return BOOK_COLLECT_TYPE_KIND_BY_ID[String(id)] ?? "Unknown";
};
