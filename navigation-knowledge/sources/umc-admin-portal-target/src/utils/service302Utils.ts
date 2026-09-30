import get from "lodash/get";

export const SERVICE_302 = 302;
export const SERVICE302_BOOK_MATERIAL_TYPE_ID = 8;
export const SERVICE302_MAGAZINE_MATERIAL_TYPE_ID = 14;
export const SERVICE302_OTHER_DEFAULT_MATERIAL_TYPE_ID = 22;

export const SERVICE302_ALLOWED_OTHER_MATERIAL_CODES = new Set([
  "CD",
  "DV",
  "CP",
  "VG",
  "CI",
  "MG",
  "BR",
]);

type SelectTableRow = {
  Activity?: unknown;
  ActivityEn?: unknown;
  ActivityAr?: unknown;
  Id?: unknown;
};

type SelectTableValueLike = {
  selectedKey?: unknown;
  tableData?: SelectTableRow[];
};

export type Service302BookRow = {
  isbn: string;
  title: string;
  authorName: string;
  author?: string;
  category?: string;
  language1?: string;
  language2?: string;
  quantity?: number;
};

export type Service302MaterialRow = {
  materialTypeId?: number | string;
  materialTypeCode?: string;
  material_type?: string;
  title?: string;
  language?: string;
  number_of_title?: number | string;
};

export type Service302BookValidationResult = {
  hasEntries: boolean;
  duplicateIsbnSet: Set<string>;
  invalidIsbnSet: Set<string>;
  missingRequiredIndexSet: Set<number>;
};

export type Service302MaterialValidationResult = {
  hasEntries: boolean;
  duplicateKeySet: Set<string>;
  invalidIndexSet: Set<number>;
};

const normalizeString = (value: unknown) => String(value ?? "").trim();

const normalizeLabel = (row: SelectTableRow) =>
  [row?.ActivityEn, row?.Activity, row?.ActivityAr]
    .map((item) => normalizeString(item).toLowerCase())
    .find(Boolean) ?? "";

const normalizeIsbnChars = (value: string) =>
  value.replace(/[^0-9Xx]/g, "").toUpperCase();

export const isValidService302Isbn = (value: unknown) => {
  const normalizedIsbn = normalizeIsbnChars(normalizeString(value));
  return /^\d{10}$/.test(normalizedIsbn) || /^\d{13}$/.test(normalizedIsbn);
};

export const getService302SelectTableValue = (
  formValues: Record<string, unknown> | null | undefined,
): SelectTableValueLike | undefined => {
  if (!formValues || typeof formValues !== "object") {
    return undefined;
  }

  const nested = get(formValues, "SelectTableSingle");
  if (nested && typeof nested === "object") {
    return nested as SelectTableValueLike;
  }

  if ("selectedKey" in formValues || "tableData" in formValues) {
    return formValues as SelectTableValueLike;
  }

  return undefined;
};

export const hasService302BookActivity = (
  selectValue: SelectTableValueLike | undefined,
) => {
  const rows = Array.isArray(selectValue?.tableData) ? selectValue?.tableData : [];
  return rows.some((row) => normalizeLabel(row).includes("commercial use"));
};

export const hasService302OtherActivity = (
  selectValue: SelectTableValueLike | undefined,
) => {
  const rows = Array.isArray(selectValue?.tableData) ? selectValue?.tableData : [];
  return rows.some((row) => {
    const label = normalizeLabel(row);
    return (
      label.includes("excluding books") ||
      label.includes("all other publications")
    );
  });
};

export const resolveService302BookList = (
  formValues: Record<string, unknown> | null | undefined,
): Service302BookRow[] => {
  const rawBookList = get(formValues, "bookListUpload.bookList");
  if (!Array.isArray(rawBookList)) {
    return [];
  }

  return rawBookList.map((item) => ({
    isbn: normalizeString(get(item, "isbn")),
    title: normalizeString(get(item, "title")),
    authorName:
      normalizeString(get(item, "authorName")) ||
      normalizeString(get(item, "author")),
    author: normalizeString(get(item, "author")),
    category: normalizeString(get(item, "category")),
    language1: normalizeString(get(item, "language1")),
    language2: normalizeString(get(item, "language2")),
    quantity: Number(get(item, "quantity") || 0),
  }));
};

export const resolveService302DataList = (
  formValues: Record<string, unknown> | null | undefined,
): Service302MaterialRow[] => {
  const rawDataList = get(formValues, "dataList");
  return Array.isArray(rawDataList) ? (rawDataList as Service302MaterialRow[]) : [];
};

export const resolveService302MaterialCode = (
  item: Record<string, unknown> | null | undefined,
) => {
  const candidates = [
    get(item, "materialTypeCode"),
    get(item, "code"),
    get(item, "material_type"),
  ]
    .map((value) => normalizeString(value).toUpperCase())
    .filter(Boolean);

  const directCode = candidates.find((value) =>
    SERVICE302_ALLOWED_OTHER_MATERIAL_CODES.has(value),
  );
  if (directCode) return directCode;

  const materialLabel = normalizeString(get(item, "material_type")).toLowerCase();
  if (materialLabel === "dvd") return "DV";
  if (materialLabel === "cd") return "CD";
  if (materialLabel === "computer program") return "CP";
  if (materialLabel === "video game") return "VG";
  if (materialLabel === "cinema") return "CI";
  if (materialLabel === "newspapers & magazines") return "MG";
  if (materialLabel === "brochures, posters and catalogs") return "BR";

  return "";
};

export const validateService302BookRows = (
  rows: Service302BookRow[],
): Service302BookValidationResult => {
  const duplicateIsbnSet = new Set<string>();
  const invalidIsbnSet = new Set<string>();
  const missingRequiredIndexSet = new Set<number>();
  const isbnCount = new Map<string, number>();

  rows.forEach((row, index) => {
    const isbn = normalizeString(row.isbn);
    const title = normalizeString(row.title);
    const authorName = normalizeString(row.authorName || row.author);

    if (!isbn || !title || !authorName) {
      missingRequiredIndexSet.add(index);
    }

    if (isbn) {
      const normalizedIsbn = normalizeIsbnChars(isbn);
      isbnCount.set(normalizedIsbn, (isbnCount.get(normalizedIsbn) ?? 0) + 1);
      if (!isValidService302Isbn(isbn)) {
        invalidIsbnSet.add(normalizedIsbn);
      }
    }
  });

  isbnCount.forEach((count, isbn) => {
    if (isbn && count > 1) {
      duplicateIsbnSet.add(isbn);
    }
  });

  return {
    hasEntries: rows.some(
      (row) =>
        normalizeString(row.isbn) ||
        normalizeString(row.title) ||
        normalizeString(row.authorName || row.author),
    ),
    duplicateIsbnSet,
    invalidIsbnSet,
    missingRequiredIndexSet,
  };
};

export const createService302MaterialDuplicateKey = (
  row: Service302MaterialRow,
) => {
  const materialCode = resolveService302MaterialCode(row);
  const title = normalizeString(row.title).toLowerCase();
  const language = normalizeString(row.language).toLowerCase();
  return [materialCode, title, language].join("|");
};

export const validateService302MaterialRows = (
  rows: Service302MaterialRow[],
): Service302MaterialValidationResult => {
  const duplicateKeySet = new Set<string>();
  const invalidIndexSet = new Set<number>();
  const keyCount = new Map<string, number>();

  rows.forEach((row, index) => {
    const materialCode = resolveService302MaterialCode(row);
    const title = normalizeString(row.title);
    const language = normalizeString(row.language);
    const quantity = Number(get(row, "number_of_title") || 0);

    const shouldRequireTitle = materialCode !== "MG";
    const hasPositiveQuantity = Number.isInteger(quantity) && quantity > 0;

    if (
      !materialCode ||
      !language ||
      !hasPositiveQuantity ||
      (shouldRequireTitle && !title)
    ) {
      invalidIndexSet.add(index);
    }

    const duplicateKey = createService302MaterialDuplicateKey(row);
    if (materialCode && language && (title || materialCode === "MG")) {
      keyCount.set(duplicateKey, (keyCount.get(duplicateKey) ?? 0) + 1);
    }
  });

  keyCount.forEach((count, key) => {
    if (count > 1) {
      duplicateKeySet.add(key);
    }
  });

  return {
    hasEntries: rows.some((row) => {
      return (
        resolveService302MaterialCode(row) ||
        normalizeString(row.title) ||
        normalizeString(row.language) ||
        normalizeString(row.number_of_title)
      );
    }),
    duplicateKeySet,
    invalidIndexSet,
  };
};

export const getService302FeeMaterialTypeIds = (
  formValues: Record<string, unknown> | null | undefined,
) => {
  const selectValue = getService302SelectTableValue(formValues);
  const materialRows = resolveService302DataList(formValues);
  const materialTypeIds = materialRows
    .map((row) => Number(row.materialTypeId))
    .filter((value) => Number.isFinite(value) && value > 0);
  const hasNonBookMaterialType = materialTypeIds.some(
    (materialTypeId) => materialTypeId !== SERVICE302_BOOK_MATERIAL_TYPE_ID,
  );

  if (hasService302BookActivity(selectValue)) {
    materialTypeIds.push(SERVICE302_BOOK_MATERIAL_TYPE_ID);
  }

  if (hasService302OtherActivity(selectValue) && !hasNonBookMaterialType) {
    materialTypeIds.push(SERVICE302_OTHER_DEFAULT_MATERIAL_TYPE_ID);
  }

  return Array.from(new Set(materialTypeIds));
};

export const getService302FrontEndValidationMessage = (
  formValues: Record<string, unknown> | null | undefined,
) => {
  const selectValue = getService302SelectTableValue(formValues);
  const selectedKeys = Array.isArray(selectValue?.selectedKey)
    ? selectValue?.selectedKey
    : selectValue?.selectedKey !== undefined && selectValue?.selectedKey !== null
      ? [selectValue?.selectedKey]
      : [];

  if (selectedKeys.length === 0) {
    return "Please select at least one activity.";
  }

  const hasBook = hasService302BookActivity(selectValue);
  const hasOther = hasService302OtherActivity(selectValue);
  const bookValidation = validateService302BookRows(resolveService302BookList(formValues));
  const materialValidation = validateService302MaterialRows(
    resolveService302DataList(formValues),
  );

  if (hasBook && !bookValidation.hasEntries) {
    return "Please upload at least one valid book entry.";
  }

  if (hasBook && bookValidation.missingRequiredIndexSet.size > 0) {
    return "Book list entries must include ISBN, Title, and Author.";
  }

  if (hasBook && bookValidation.duplicateIsbnSet.size > 0) {
    return "Duplicate ISBN entries are not allowed in the book list.";
  }

  if (hasBook && bookValidation.invalidIsbnSet.size > 0) {
    return "ISBN must be exactly 10 digits or 13 digits.";
  }

  if (hasOther && !materialValidation.hasEntries) {
    return "Please add at least one material list entry.";
  }

  if (hasOther && materialValidation.invalidIndexSet.size > 0) {
    return "Please complete all required material list fields.";
  }

  if (hasOther && materialValidation.duplicateKeySet.size > 0) {
    return "Duplicate material list entries are not allowed.";
  }

  const requiredFields = [
    "AwbDecNumber",
    "AwbDecDate",
    "ArrivalPort",
    "CountryOrigin",
    "UploadCustomDeclaration",
    "AirWayBill/BillOfLading",
    "UploadPurchaseInvoices",
  ];

  const hasMissingPublicationField = requiredFields.some((field) => {
    const value = get(formValues, field);
    if (Array.isArray(value)) return value.length === 0;
    return normalizeString(value) === "";
  });

  if (hasMissingPublicationField) {
    return "Please complete all required publication details fields.";
  }

  return "";
};
