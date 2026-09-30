import request from "@/utils/request";

export type CirculationMediaMaterialTitleOption = {
  label: string;
  labelEn?: string;
  labelAr?: string;
  value: string | number;
  title?: string;
  applicationNumber?: string | number;
  permitNumber?: string | number;
  mediaMaterialType?: string | number;
  mediaMaterialTypeId?: string | number;
  mediaMaterialTypeEn?: string;
  mediaMaterialTypeAr?: string;
  type?: string | number;
  artistWorkTypeId?: string | number;
  typeEn?: string;
  typeAr?: string;
  language: Array<string | number>;
  languageId?: string | number;
  languageIds?: Array<string | number>;
  languageEn?: string;
  languageAr?: string;
  durationInMinutes?: string;
  source?: string | number;
  sourceCountryId?: string | number;
  sourceEn?: string;
  sourceAr?: string;
  copyrightsType?: string | number;
  copyrightsTypeId?: string | number;
  copyrightsStartDate?: string;
  copyrightsEndDate?: string;
  ministryOfEconomyRegistrationCertificate?: string | null;
};

type CirculationMediaMaterialTitleApiItem = {
  id?: string | number;
  value?: string | number;
  titleId?: string | number;
  circulationMediaMaterialId?: string | number;
  permitNumber?: string | number;
  mediaLicenseNumber?: string | number;
  label?: string;
  labelEn?: string;
  labelAr?: string;
  applicationNumber?: string | number;
  title?: string;
  name?: string;
  titleEn?: string;
  titleAr?: string;
  nameEn?: string;
  nameAr?: string;
  mediaMaterialTypeId?: string | number;
  mediaMaterialType?: string | number;
  mediaMaterialTypeName?: string;
  mediaMaterialTypeEn?: string;
  mediaMaterialTypeAr?: string;
  mediaMaterialTypeNameEn?: string;
  mediaMaterialTypeNameAr?: string;
  type?: string | number;
  artistWorkType?: string | number;
  artistWorkTypeId?: string | number;
  typeEn?: string;
  typeAr?: string;
  artistWorkTypeEn?: string;
  artistWorkTypeAr?: string;
  language?: string | number | Array<string | number>;
  languageId?: string | number;
  languageIds?: Array<string | number>;
  languageEn?: string;
  languageAr?: string;
  languageNameEn?: string;
  languageNameAr?: string;
  durationInMinutes?: string | number;
  source?: string | number;
  sourceId?: string | number;
  sourceCountryId?: string | number;
  sourceEn?: string;
  sourceAr?: string;
  sourceNameEn?: string;
  sourceNameAr?: string;
  copyrightsTypeId?: string | number;
  copyrightsStartDate?: string;
  copyrightsEndDate?: string;
  ministryOfEconomyRegistrationCertificate?: string | null;
};

const normalizeLanguageIds = (
  value: CirculationMediaMaterialTitleApiItem["language"] | string | number,
): Array<string | number> => {
  const values = Array.isArray(value) ? value : [value];

  return values.reduce<Array<string | number>>((result, item) => {
    if (typeof item === "number" && Number.isFinite(item)) {
      result.push(item);
      return result;
    }

    if (typeof item !== "string") {
      return result;
    }

    const normalized = item.trim();
    if (!normalized) {
      return result;
    }

    result.push(
      /^-?\d+(\.\d+)?$/.test(normalized)
        ? Number(normalized)
        : normalized,
    );
    return result;
  }, []);
};

const toLegacyOption = (
  item: CirculationMediaMaterialTitleApiItem
): CirculationMediaMaterialTitleOption => {
  const value =
    item.id ??
    item.value ??
    item.titleId ??
    item.circulationMediaMaterialId ??
    item.permitNumber ??
    item.title ??
    item.name ??
    "";
  const title =
    item.title ?? item.name ?? item.titleEn ?? item.nameEn ?? String(value);
  const permitNumber = item.permitNumber ?? item.mediaLicenseNumber;
  const language = normalizeLanguageIds(item.language ?? item.languageId);
  const source = item.source ?? item.sourceId ?? item.sourceCountryId;
  const mediaMaterialType = item.mediaMaterialType ?? item.mediaMaterialTypeName;
  const type = item.type ?? item.artistWorkType ?? item.artistWorkTypeId;
  const label =
    item.label ??
    [permitNumber, title, language.join(", ")].filter(Boolean).join(" | ") ??
    title;

  return {
    label,
    labelEn: item.labelEn ?? item.label,
    labelAr: item.labelAr,
    value,
    permitNumber,
    mediaMaterialType,
    mediaMaterialTypeEn: String(
      item.mediaMaterialTypeEn ??
        item.mediaMaterialTypeNameEn ??
        item.mediaMaterialType ??
        item.mediaMaterialTypeName ??
        "",
    ) || undefined,
    mediaMaterialTypeAr:
      item.mediaMaterialTypeAr ?? item.mediaMaterialTypeNameAr,
    type,
    typeEn: item.typeEn ?? item.artistWorkTypeEn,
    typeAr: item.typeAr ?? item.artistWorkTypeAr,
    language,
    languageEn: item.languageEn ?? item.languageNameEn,
    languageAr: item.languageAr ?? item.languageNameAr,
    durationInMinutes:
      item.durationInMinutes === undefined || item.durationInMinutes === null
        ? undefined
        : String(item.durationInMinutes),
    source,
    sourceEn: item.sourceEn ?? item.sourceNameEn,
    sourceAr: item.sourceAr ?? item.sourceNameAr,
  };
};

export const getCirculationMediaMaterialTitles = async (
  userProfileId: string
): Promise<CirculationMediaMaterialTitleOption[]> => {
  if (!String(userProfileId || "").trim()) {
    return [];
  }

  const response = await request.get<CirculationMediaMaterialTitleApiItem[]>(
    "/api/FormOptions/CirculationMediaMaterial/GetTitles",
    { userProfileId }
  );

  const payload = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
      ? response
      : [];

  return payload.map(toLegacyOption);
};

const toService1008Option = (
  item: CirculationMediaMaterialTitleApiItem,
): CirculationMediaMaterialTitleOption => {
  const legacyLanguageId = item.languageId ?? item.language;
  const languageIds = Array.isArray(item.languageIds)
    ? normalizeLanguageIds(item.languageIds)
    : normalizeLanguageIds(legacyLanguageId);

  return {
    label: String(item.title ?? item.name ?? item.id ?? ""),
    value:
      item.id ??
      item.value ??
      item.titleId ??
      item.circulationMediaMaterialId ??
      "",
    title: item.title ?? item.name,
    applicationNumber: item.applicationNumber,
    permitNumber: item.permitNumber ?? item.mediaLicenseNumber,
    mediaMaterialType: item.mediaMaterialTypeId,
    mediaMaterialTypeId: item.mediaMaterialTypeId,
    type: item.artistWorkTypeId,
    artistWorkTypeId: item.artistWorkTypeId,
    language: languageIds,
    languageId:
      typeof legacyLanguageId === "string" || typeof legacyLanguageId === "number"
        ? legacyLanguageId
        : undefined,
    languageIds,
    durationInMinutes:
      item.durationInMinutes === undefined || item.durationInMinutes === null
        ? undefined
        : String(item.durationInMinutes),
    source: item.sourceCountryId,
    sourceCountryId: item.sourceCountryId,
    copyrightsType: item.copyrightsTypeId,
    copyrightsTypeId: item.copyrightsTypeId,
    copyrightsStartDate: item.copyrightsStartDate,
    copyrightsEndDate: item.copyrightsEndDate,
    ministryOfEconomyRegistrationCertificate:
      item.ministryOfEconomyRegistrationCertificate,
  };
};

export const getCirculationMediaMaterialTitlesByPermitNumber = async (
  permitNumber: string | number,
  maxCount = 100,
): Promise<CirculationMediaMaterialTitleOption[]> => {
  const normalizedPermitNumber = String(permitNumber ?? "").trim();
  if (!normalizedPermitNumber) {
    return [];
  }

  const response = await request.get<CirculationMediaMaterialTitleApiItem[]>(
    "/api/Form/CirculationMediaMaterialTitles",
    {
      applicationNumber: normalizedPermitNumber,
      maxCount,
    },
  );

  const payload = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
      ? response
      : [];

  return payload.map(toService1008Option);
};
