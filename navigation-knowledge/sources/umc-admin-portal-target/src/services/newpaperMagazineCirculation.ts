import request from "@/utils/request";
import { compact, isString, map, toNumber, trim } from "lodash";

export interface NewpaperMagazineLicenseLookupParams {
  mediaLicenseNumber: string;
}

export interface NewpaperMagazineLicenseLookupResponse {
  matched: boolean;
  publicationTitle?: string;
  language?: string;
  subjectCategoryIds?: number[];
  sourceId?: number;
}

interface ApiEnvelope<T> {
  isSuccess?: boolean;
  statusCode?: number;
  message?: string | null;
  data?: T;
}

type LookupApiPayload = {
  sourceCountryId?: number | null;
  country?: {
    id?: number | null;
  } | null;
  newspaperLanguages?: Array<{
    name?: string | null;
    language?: {
      nameEn?: string | null;
      nameAr?: string | null;
    } | null;
  }> | null;
  newspaperSubjectCategories?: Array<{
    newspaperCategoryId?: number | null;
    newspaperCategory?: {
      id?: number | null;
    } | null;
  }> | null;
};

const normalizeObjectPayload = (
  value: unknown
): Omit<NewpaperMagazineLicenseLookupResponse, "matched"> | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown> & LookupApiPayload;

  const subjectRaw =
    record.newspaperSubjectCategories ??
    record.subjectCategoryIds ??
    record.subjectIds ??
    record.mediaActivityIds;
  const subjectCategoryIds = Array.isArray(record.newspaperSubjectCategories)
    ? (compact(
        map(record.newspaperSubjectCategories, (item) => {
          const categoryId = item?.newspaperCategoryId ?? item?.newspaperCategory?.id;
          const parsed = toNumber(categoryId);
          return Number.isNaN(parsed) ? undefined : parsed;
        })
      ) as number[])
    : Array.isArray(subjectRaw)
      ? (compact(
          map(subjectRaw as unknown[], (item) => {
            const parsed = toNumber(item);
            return Number.isNaN(parsed) ? undefined : parsed;
          })
        ) as number[])
    : [];

  const publicationTitleValue =
    record.publicationTitle ?? record.publicationName ?? record.title;
  const firstLanguage = Array.isArray(record.newspaperLanguages)
    ? record.newspaperLanguages[0]
    : undefined;
  const languageValue =
    record.language ??
    record.languageName ??
    firstLanguage?.name ??
    firstLanguage?.language?.nameEn ??
    firstLanguage?.language?.nameAr;
  const sourceIdValue = toNumber(
    record.sourceId ?? record.sourceCountryId ?? record.country?.id
  );
  const publicationTitle =
    isString(publicationTitleValue) && trim(publicationTitleValue)
      ? trim(publicationTitleValue)
      : undefined;
  const language =
    isString(languageValue) && trim(languageValue)
      ? trim(languageValue)
      : undefined;

  return {
    publicationTitle,
    language,
    sourceId: Number.isNaN(sourceIdValue) ? undefined : sourceIdValue,
    subjectCategoryIds:
      subjectCategoryIds.length > 0 ? subjectCategoryIds : undefined,
  };
};

export const lookupNewpaperMagazineLicense = async (
  params: NewpaperMagazineLicenseLookupParams
): Promise<NewpaperMagazineLicenseLookupResponse> => {
  const response = await request.get<ApiEnvelope<unknown> | unknown>(
    `/api/Newspaper/GetByMediaLicenseNumber`,
    {
      mediaLicenseNumber: params.mediaLicenseNumber,
    },
    { skipErrorMessage: true }
  );

  const payload =
    response && typeof response === "object" && "data" in response
      ? (response as ApiEnvelope<unknown>).data
      : response;
  if (!payload) {
    return { matched: false };
  }

  if (Array.isArray(payload)) {
    const normalizedList = payload
      .map((item) => normalizeObjectPayload(item))
      .filter(Boolean);
    const firstMatched = normalizedList[0];
    if (!firstMatched) {
      return { matched: false };
    }
    return {
      matched: true,
      ...firstMatched,
    };
  }

  const normalized = normalizeObjectPayload(payload);
  if (!normalized) {
    return { matched: false };
  }

  const explicitMatched =
    typeof (payload as Record<string, unknown>).matched === "boolean"
      ? ((payload as Record<string, unknown>).matched as boolean)
      : undefined;

  const inferredMatched =
    !!normalized.publicationTitle ||
    !!normalized.language ||
    !!normalized.sourceId ||
    !!normalized.subjectCategoryIds?.length;

  return {
    matched: explicitMatched ?? inferredMatched,
    ...normalized,
  };
};
