import type {
  ApplicationPageByProfileItem,
  ApplicationPageByProfileResponse,
  IApplicationStatus,
  IServiceType,
} from "@/services/application";
import type { OverviewRowItem } from "../../types";

export type ApplicationFilterOption = {
  label: string;
  value: string;
};

type ApplicationTypeDictionaryItem = Partial<IServiceType> | null | undefined;

const unwrapDataPayload = (response: unknown): unknown => {
  let payload = response;

  for (let depth = 0; depth < 2; depth += 1) {
    if (!payload || typeof payload !== "object" || !("data" in payload)) {
      break;
    }
    payload = (payload as { data?: unknown }).data;
  }

  return payload;
};

export const unwrapApplicationDictionaryItems = <T>(response: unknown): T[] => {
  const payload = unwrapDataPayload(response);
  return Array.isArray(payload)
    ? payload.filter((item): item is T => item !== null && item !== undefined)
    : [];
};

export const unwrapApplicationPageResponse = (
  response: unknown,
): ApplicationPageByProfileResponse | null => {
  const payload = unwrapDataPayload(response);
  return payload && typeof payload === "object"
    ? (payload as ApplicationPageByProfileResponse)
    : null;
};

const APPLICATION_TYPE_DEFINITIONS = [
  { key: "new", label: "New", fallbackValue: "new" },
  { key: "renew", label: "Renew", fallbackValue: "renew" },
  { key: "modify", label: "Modify", fallbackValue: "modify" },
  { key: "cancel", label: "Cancel", fallbackValue: "cancel" },
  { key: "transfer", label: "Transfer", fallbackValue: "transfer" },
  {
    key: "partnermanagement",
    label: "Partner Management",
    fallbackValue: "partnermanagement",
  },
] as const;

const normalizeOptionKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");

export const buildApplicationTypeOptions = (
  items: ApplicationTypeDictionaryItem[] | null | undefined,
  isArabic: boolean,
  allTypesLabel: string,
): ApplicationFilterOption[] => {
  const visibleItems = Array.isArray(items)
    ? items.filter((item) => item?.isShown !== false)
    : [];

  return [
    { label: allTypesLabel, value: "" },
    ...APPLICATION_TYPE_DEFINITIONS.map((definition) => {
      const match = visibleItems.find((item) =>
        [item?.code, item?.nameEn].some(
          (value) => normalizeOptionKey(value) === definition.key,
        ),
      );
      const value = String(match?.code ?? "").trim();
      const label = String(
        (isArabic
          ? match?.nameAr || match?.nameEn
          : match?.nameEn || match?.nameAr) || definition.label,
      ).trim();

      return {
        label: label || definition.label,
        value: value || definition.fallbackValue,
      };
    }),
  ];
};

export const buildApplicationStatusOptions = (
  items: IApplicationStatus[] | null | undefined,
  isArabic: boolean,
  allStatusesLabel: string,
): ApplicationFilterOption[] => {
  const seenValues = new Set<string>();
  const options = (Array.isArray(items) ? items : [])
    .filter((item) => item?.isShown !== false && item.code != "100")
    .map((item) => {
      const value = String(item?.code ?? "").trim();
      const label = String(
        (isArabic
          ? item?.nameAr || item?.nameEn
          : item?.nameEn || item?.nameAr) ||
          item?.code ||
          "",
      ).trim();

      return { label, value };
    })
    .filter((option) => {
      if (!option.label || !option.value || seenValues.has(option.value)) {
        return false;
      }
      seenValues.add(option.value);
      return true;
    });

  return [{ label: allStatusesLabel, value: "" }, ...options];
};

export const mapApplicationPageItemToOverviewRow = (
  item: ApplicationPageByProfileItem | null | undefined,
  index: number,
): OverviewRowItem => {
  const record = (item || {}) as Partial<ApplicationPageByProfileItem> & {
    profileType?: string | null;
  };
  const departmentName = normalizeOptionKey(record.serviceDepartment);
  const isContentApplication =
    Number(record.serviceDepartmentId) === 2 || departmentName === "content";

  return {
    ...record,
    id: String(record.applicationId ?? index),
    applicationId: record.applicationId ?? undefined,
    applicationNumber: record.applicationNumber || undefined,
    applicationNo: record.applicationNumber || "-",
    serviceName: record.serviceName || "-",
    serviceCategory: record.serviceCategoryName || "-",
    type: isContentApplication ? "-" : record.typeName || record.type || "-",
    status: record.status || record.statusDisplay || "-",
    statusId: record.statusId ?? undefined,
    statusCode: record.statusCode || undefined,
    applyFor:
      record.applyFor ||
      record.applyForEn ||
      record.profileName ||
      record.applyForAr ||
      "-",
    applyForType:
      record.applyForType || record.profileType || record.userTypeCode || "-",
    sla: record.slaDescription || "-",
    submissionTime: record.submissionTime || undefined,
    lastUpdatedTime:
      record.lastUpdatedTime ||
      record.lastUpdatedOn ||
      record.submissionTime ||
      "-",
    serviceDepartment: record.serviceDepartment || undefined,
    serviceDepartmentId: record.serviceDepartmentId ?? undefined,
    serviceCode: record.serviceCode ?? undefined,
    taskId: record.taskId ?? undefined,
  };
};
