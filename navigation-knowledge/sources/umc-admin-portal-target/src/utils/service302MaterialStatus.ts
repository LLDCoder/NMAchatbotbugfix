export const SERVICE302_NEWSPAPERS_MAGAZINES_MATERIAL_TYPE_ID = 14;
export const SERVICE302_NEWSPAPERS_MAGAZINES_MATERIAL_TYPE_CODE = "MG";

export type Service302MaterialStatus = 0 | 1;

export type Service302MaterialStatusRow = Record<string, unknown> & {
  materialId?: string;
  status?: Service302MaterialStatus | null;
};

export interface Service302MaterialStatusSummary {
  locatorKeys: string[];
  assignedLocatorKeys: string[];
  total: number;
  assigned: number;
  complete: boolean;
}

export interface Service302MaterialStatusStateChange {
  locatorKey: string;
  materialId: string;
  assigned: boolean;
  saving: boolean;
}

type ReviewTaskState = {
  status?: unknown;
  taskStatus?: unknown;
};

const TERMINAL_REVIEW_TASK_STATUSES = new Set([
  "completed",
  "closed",
  "cancelled",
  "canceled",
]);

const normalizeText = (value: unknown) => String(value ?? "").trim();

const normalizeMaterialLabel = (value: unknown) =>
  normalizeText(value).replace(/\s+/g, " ").toLowerCase();

const normalizeReviewTaskStatus = (value: unknown) =>
  normalizeText(value).replace(/[\s_-]+/g, "").toLowerCase();

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const getFormValues = (step: unknown) => {
  const stepRecord = asRecord(step);
  const parsedFormData = parseJson(stepRecord?.formData ?? step);
  const formDataRecord = asRecord(parsedFormData);
  return asRecord(formDataRecord?.formValues) ?? formDataRecord;
};

export const createMaterialId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  );

  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
};

export const ensureService302MaterialIds = <
  T extends Record<string, unknown>,
>(rows: T[], generatedIds = new Map<number, string>()) =>
  rows.map((row, index) => {
    const existingMaterialId = normalizeText(row.materialId);
    if (existingMaterialId) {
      generatedIds.set(index, existingMaterialId);
      return row as T & { materialId: string };
    }

    const materialId = generatedIds.get(index) || createMaterialId();
    generatedIds.set(index, materialId);
    return { ...row, materialId };
  });

export const normalizeService302MaterialStatus = (
  value: unknown,
): Service302MaterialStatus | undefined => {
  if (value === 0 || value === "0") return 0;
  if (value === 1 || value === "1") return 1;
  return undefined;
};

export const isService302NewspapersMagazinesMaterial = (
  row: Record<string, unknown> | null | undefined,
) => {
  if (!row) return false;

  const materialTypeId = Number(row.materialTypeId ?? row.customMaterialId);
  if (materialTypeId === SERVICE302_NEWSPAPERS_MAGAZINES_MATERIAL_TYPE_ID) {
    return true;
  }

  const materialTypeCode = normalizeText(
    row.materialTypeCode ?? row.code,
  ).toUpperCase();
  if (materialTypeCode === SERVICE302_NEWSPAPERS_MAGAZINES_MATERIAL_TYPE_CODE) {
    return true;
  }

  const materialLabels = [
    row.material_type,
    row.materialType,
    row.materialTypeName,
    row.materialTypeNameEn,
  ].map(normalizeMaterialLabel);

  return materialLabels.some(
    (label) =>
      label === "newspapers & magazines" ||
      label === "newspapers and magazines",
  );
};

export const getService302MaterialLocatorKey = (
  stepIndex: number,
  materialIndex: number,
) => `step:${stepIndex}:material:${materialIndex}`;

export const getService302MaterialStatusSummary = (
  reviewFormData: unknown,
): Service302MaterialStatusSummary => {
  const parsedReviewData = parseJson(reviewFormData);
  const steps = Array.isArray(parsedReviewData) ? parsedReviewData : [];
  const locatorKeys: string[] = [];
  const assignedLocatorKeys: string[] = [];

  steps.forEach((step, stepIndex) => {
    const dataList = getFormValues(step)?.dataList;
    if (!Array.isArray(dataList)) return;

    dataList.forEach((item, materialIndex) => {
      const row = asRecord(item);
      if (!row || !isService302NewspapersMagazinesMaterial(row)) return;

      const locatorKey = getService302MaterialLocatorKey(
        stepIndex,
        materialIndex,
      );
      locatorKeys.push(locatorKey);
      if (normalizeService302MaterialStatus(row.status) !== undefined) {
        assignedLocatorKeys.push(locatorKey);
      }
    });
  });

  return {
    locatorKeys,
    assignedLocatorKeys,
    total: locatorKeys.length,
    assigned: assignedLocatorKeys.length,
    complete: locatorKeys.length === assignedLocatorKeys.length,
  };
};

export const isService302ReviewFormDataShapeValid = (reviewFormData: unknown) =>
  Array.isArray(parseJson(reviewFormData));

export const isService302MaterialStatusTaskReadOnly = (
  task: ReviewTaskState | null | undefined,
) =>
  [task?.status, task?.taskStatus].some((value) =>
    TERMINAL_REVIEW_TASK_STATUSES.has(normalizeReviewTaskStatus(value)),
  );

export const hasIncompleteService302MaterialStatuses = (
  reviewFormData: unknown,
) => !getService302MaterialStatusSummary(reviewFormData).complete;

export const isMaterialStatusRequiredError = (error: unknown) => {
  const errorRecord = asRecord(error);
  const responseRecord = asRecord(errorRecord?.response);
  const payload = asRecord(responseRecord?.data);
  const nestedData = asRecord(payload?.data);
  const code = normalizeText(
    payload?.code ??
      payload?.errorCode ??
      nestedData?.code ??
      nestedData?.errorCode,
  ).toUpperCase();

  return code === "MATERIAL_STATUS_REQUIRED";
};
