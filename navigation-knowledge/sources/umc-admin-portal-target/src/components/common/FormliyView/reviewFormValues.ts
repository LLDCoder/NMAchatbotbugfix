import {
  getSelectedActivityKeys,
  PRESS_CARD_PERMIT_START_DATE_ACTIVITY_CODES,
} from "@/components/common/formilyActivityRules";

type ReviewRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is ReviewRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const parseJsonValue = (value: unknown): unknown => {
  if (typeof value !== "string" || !value.trim()) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
const getSubmittedStepValues = (formValues: ReviewRecord): ReviewRecord => {
  const submittedSteps = parseJsonValue(formValues.FormDataValues);
  if (!Array.isArray(submittedSteps)) return {};
  return submittedSteps.reduce<ReviewRecord>((result, step) => {
    if (!isRecord(step)) return result;
    const submittedFormData = parseJsonValue(step.formData);
    if (!isRecord(submittedFormData)) return result;
    const submittedValues = parseJsonValue(submittedFormData.formValues);
    return isRecord(submittedValues)
      ? { ...result, ...submittedValues }
      : result;
  }, {});
};
const normalizeKeys = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
};

const getComponentProperties = (schema: unknown) => {
  if (!isRecord(schema) || !isRecord(schema.properties)) return [];
  return Object.entries(schema.properties).filter((entry): entry is [string, ReviewRecord] =>
    isRecord(entry[1]),
  );
};

export const normalizeAdminReviewFormValues = ({
  schema,
  formValues,
  modifyOriginalFormValues,
  serviceCode,
}: {
  schema?: unknown;
  formValues?: unknown;
  modifyOriginalFormValues?: unknown;
  serviceCode?: string | number | null;
}): ReviewRecord => {
  const rawValues = isRecord(formValues) ? formValues : {};
  const values = {
    ...getSubmittedStepValues(rawValues),
    ...rawValues,
  };
  const originalValues = isRecord(modifyOriginalFormValues)
    ? modifyOriginalFormValues
    : {};

  if (Number(serviceCode) === 1801) {
    const hasPermitStartDateActivity = getSelectedActivityKeys(values).some((key) =>
      PRESS_CARD_PERMIT_START_DATE_ACTIVITY_CODES.has(key),
    );

    if (!hasPermitStartDateActivity) {
      delete values.PermitStartDate;
    }
  }

  getComponentProperties(schema).forEach(([propertyName, node]) => {
    const component = node["x-component"];
    if (component === "ProfileForm" && !isRecord(values[propertyName])) {
      const submittedValue = isRecord(values.ProfileForm)
        ? values.ProfileForm
        : isRecord(values["Profile Form"])
          ? values["Profile Form"]
          : undefined;
      if (submittedValue) values[propertyName] = submittedValue;
    }
    if (component === "PartnerList" && !Array.isArray(values[propertyName])) {
      const submittedValue = Array.isArray(values.PartnerList)
        ? values.PartnerList
        : Array.isArray(values["Partner List"])
          ? values["Partner List"]
          : undefined;
      if (submittedValue) values[propertyName] = submittedValue;
    }
    if (Number(serviceCode) !== 903 || component !== "SelectTable") return;
    const current = isRecord(values[propertyName]) ? values[propertyName] : null;
    const original = isRecord(originalValues[propertyName])
      ? originalValues[propertyName]
      : null;
    if (!current || !original) return;

    const currentKeys = normalizeKeys(current.selectedKey);
    const originalKeys = new Set(normalizeKeys(original.selectedKey));
    const visibleIndexes = currentKeys
      .map((key, index) => ({ key, index }))
      .filter(({ key }) => !originalKeys.has(key));
    const tableData = Array.isArray(current.tableData) ? current.tableData : [];

    values[propertyName] = {
      ...current,
      selectedKey: visibleIndexes.map(({ key }) => key),
      tableData: visibleIndexes
        .map(({ index }) => tableData[index])
        .filter((row) => row !== undefined),
    };
  });

  return values;
};
