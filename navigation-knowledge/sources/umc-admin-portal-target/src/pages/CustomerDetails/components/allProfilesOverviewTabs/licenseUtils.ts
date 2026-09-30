import type {
  LicenseManagementListResponseDto,
  PageLicenseList,
  StatisticsResponseDto,
} from "@/services/license";
import type { LicenseItem } from "../../types";

type ResponseEnvelope = {
  data?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toSafeText = (value: unknown) => {
  if (typeof value === "string") return value.trim() || "-";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "-";
};

const toSafeCount = (value: unknown) => {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
};

export const unwrapLicenseResponse = <T>(response: unknown): T | null => {
  let current: unknown = response;

  for (let depth = 0; depth < 3; depth += 1) {
    if (!isRecord(current) || !("data" in current)) break;
    const next = (current as ResponseEnvelope).data;
    if (next === undefined || next === null) return null;
    current = next;
  }

  return isRecord(current) ? (current as T) : null;
};

export const mapLicenseItem = (
  item: Partial<LicenseManagementListResponseDto> | null | undefined,
  language: string,
): LicenseItem => {
  const source = item ?? {};
  const isArabic = language.toLowerCase().startsWith("ar");
  const englishName = toSafeText(source.licenseType);
  const arabicName = toSafeText(source.licenseTypeAr);
  const localizedName = isArabic
    ? arabicName !== "-"
      ? arabicName
      : englishName
    : englishName !== "-"
      ? englishName
      : arabicName;

  return {
    id:
      typeof source.id === "number" || typeof source.id === "string"
        ? source.id
        : null,
    applicationNumber: toSafeText(source.applicationNumber),
    // Single localized string from the backend, so no isArabic branch here;
    // toSafeText turns the empty permit value into "-".
    mediaActivity: toSafeText(source.mediaActivity),
    // Display value: the media license number when the license owns a media-license shell,
    // otherwise the certificate number - same as the Licensing > Licenses grid.
    licenseNumber: toSafeText(source.showLicenseNumber || source.licenseNumber),
    licenseType: localizedName,
    licenseTypeAr: arabicName,
    applicant: toSafeText(source.applicant),
    applicantType: toSafeText(source.applicantType),
    issuanceTime: toSafeText(source.issuanceTime),
    expirationTime: toSafeText(source.expirationTime),
    status: toSafeText(source.status),
    daysRemaining:
      typeof source.daysRemaining === "number" &&
      Number.isFinite(source.daysRemaining)
        ? source.daysRemaining
        : 0,
    certificateUrl: toSafeText(source.certificateUrl),
    certificatePassword: toSafeText(source.certificatePassword),
    disabledReason: toSafeText(source.disabledReason),
    remarks: toSafeText(source.remarks),
  };
};

export const mapLicenseListResponse = (
  response: unknown,
  language: string,
) => {
  const data = unwrapLicenseResponse<PageLicenseList>(response);
  const items = Array.isArray(data?.items) ? data.items : [];
  const totalCount = (data as (PageLicenseList & { totalCount?: unknown }) | null)
    ?.totalCount;

  return {
    items: items.map((item) => mapLicenseItem(item, language)),
    total: toSafeCount(data?.total ?? totalCount),
  };
};

export const createEmptyLicenseStatistics = (): StatisticsResponseDto => ({
  total: 0,
  active: 0,
  expired: 0,
  cancelled: 0,
  disabled: 0,
});

export const mapLicenseStatistics = (
  response: unknown,
): StatisticsResponseDto => {
  const data = unwrapLicenseResponse<StatisticsResponseDto>(response);

  return {
    total: toSafeCount(data?.total),
    active: toSafeCount(data?.active),
    expired: toSafeCount(data?.expired),
    cancelled: toSafeCount(data?.cancelled),
    disabled: toSafeCount(data?.disabled),
  };
};
