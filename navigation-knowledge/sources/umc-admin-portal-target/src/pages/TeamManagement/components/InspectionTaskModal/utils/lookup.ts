import type {
  InspectionEconomicActivityOption,
  InspectionGeoLookupOption,
  InspectionPriorityLookupOption,
  InspectionReasonLookupOption,
} from "@/services/inspection";
import type {
  CampaignActivitySelectOption,
  CampaignGeoSelectOption,
} from "../type";

export const campaignInspectionReasonCode = "Campaign";
const campaignInspectionReasonNameKey = "inspectioncampaign";
export const criticalContentViolationReasonKey = "criticalcontentviolation";

export const normalizeLookupText = (value: unknown) =>
  String(value || "").trim().toLowerCase();

export const normalizeLookupKey = (value: unknown) =>
  normalizeLookupText(value).replace(/[^a-z0-9]+/g, "");

export const getLookupLabel = (option?: InspectionGeoLookupOption | null) =>
  String(option?.nameEn || option?.name || option?.code || option?.id || "").trim();

export const getReasonLabel = (option?: InspectionReasonLookupOption | null) =>
  String(option?.nameEn || option?.name || option?.code || option?.id || "").trim();

export const getPriorityLabel = (option?: InspectionPriorityLookupOption | null) =>
  String(option?.nameEn || option?.name || option?.code || option?.id || "").trim();

export const getPriorityValue = (option?: InspectionPriorityLookupOption | null) =>
  String(option?.code || "").trim();

export const getReasonSearchText = (option: InspectionReasonLookupOption) =>
  [option.nameEn, option.nameAr, option.name, option.code, option.id]
    .map((item) => normalizeLookupText(item))
    .filter(Boolean)
    .join(" ");

export const findReasonOption = (
  options: InspectionReasonLookupOption[],
  value?: unknown,
) => {
  const normalized = normalizeLookupKey(value);
  if (!normalized) return undefined;
  return options.find((item) =>
    [item.id, item.code, item.nameEn, item.nameAr, item.name].some(
      (candidate) => normalizeLookupKey(candidate) === normalized,
    ),
  );
};

export const findPriorityOption = (
  options: InspectionPriorityLookupOption[],
  value?: unknown,
) => {
  const normalized = normalizeLookupKey(value);
  if (!normalized) return undefined;
  return options.find((item) =>
    [item.code, item.id, item.nameEn, item.nameAr, item.name].some(
      (candidate) => normalizeLookupKey(candidate) === normalized,
    ),
  );
};

export const isCampaignReasonOption = (
  option?: InspectionReasonLookupOption | null,
) => {
  if (!option) return false;
  const semanticCodeMatch =
    normalizeLookupKey(option.code) === normalizeLookupKey(campaignInspectionReasonCode);
  const nameMatch = [option.nameEn, option.nameAr, option.name].some(
    (candidate) => normalizeLookupKey(candidate) === campaignInspectionReasonNameKey,
  );
  return semanticCodeMatch || nameMatch;
};

export const isCampaignReasonValue = (
  options: InspectionReasonLookupOption[],
  value?: unknown,
) =>
  isCampaignReasonOption(findReasonOption(options, value)) ||
  normalizeLookupKey(value) === normalizeLookupKey(campaignInspectionReasonCode);

export const toNumberOrUndefined = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
};

const getEconomicActivityLabel = (activity: InspectionEconomicActivityOption) =>
  String(activity.nameEn || activity.nameAr || activity.code || activity.id || "").trim();

export const flattenEconomicActivityOptions = (
  activities: InspectionEconomicActivityOption[],
) => {
  const optionMap = new Map<number, CampaignActivitySelectOption>();

  const appendActivity = (
    activity: InspectionEconomicActivityOption,
    parentLabel?: string,
  ) => {
    const value = toNumberOrUndefined(activity.id);
    const label = getEconomicActivityLabel(activity);
    const displayLabel =
      parentLabel && parentLabel !== label ? `${parentLabel} / ${label}` : label;
    if (value !== undefined && displayLabel) {
      optionMap.set(value, { value, label: displayLabel });
    }
    const children = Array.isArray(activity.childData) ? activity.childData : [];
    children.forEach((child) => appendActivity(child, label || parentLabel));
  };

  activities.forEach((activity) => appendActivity(activity));
  return Array.from(optionMap.values());
};

export const findLookupOptionByLabel = (
  options: InspectionGeoLookupOption[],
  label?: unknown,
) => {
  const normalized = normalizeLookupKey(label);
  if (!normalized) return undefined;
  return options.find((item) =>
    [item.id, item.nameEn, item.nameAr, item.name, item.code].some(
      (candidate) => normalizeLookupKey(candidate) === normalized,
    ),
  );
};

export const findLookupOptionById = (
  options: InspectionGeoLookupOption[],
  id?: unknown,
) => {
  const value = toNumberOrUndefined(id);
  if (value === undefined) return undefined;
  return options.find((item) => toNumberOrUndefined(item.id) === value);
};

export const mapLookupOptionsToNumberOptions = (
  options: InspectionGeoLookupOption[],
) =>
  options
    .map((item) => {
      const value = toNumberOrUndefined(item.id);
      const label = getLookupLabel(item);
      return value !== undefined && label ? { value, label } : null;
    })
    .filter((item): item is CampaignGeoSelectOption => Boolean(item));
