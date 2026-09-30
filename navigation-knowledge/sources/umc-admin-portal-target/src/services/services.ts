import request from "@/utils/request"
import { resolveServiceCode } from "@/utils/serviceCode";

export const getSubjectList = () => {
  return request.get(`/api/Lookup/GetSubjectList`);
};
export const getLookupTables = () => {
  return request.get(`/api/Lookup/GetLookupTables`);
};
export const getLookupData = (
  source: string,
  serviceCode?: string | number | null,
) => {
  const hasServiceCode =
    serviceCode !== undefined &&
    serviceCode !== null &&
    String(serviceCode).trim() !== "";
  const resolvedServiceCode =
    hasServiceCode
      ? resolveServiceCode(serviceCode)
      : undefined;

  return request.get(`/api/Lookup/GetLookupData`, {
    tableName: source,
    ServiceCode: resolvedServiceCode || undefined,
  });
};

export interface MediaLicenseByNumberResponse {
  mediaLicenseId: number;
  mediaLicenseNumber: string;
  establishmentId?: number | null;
  establishmentNameEn?: string | null;
  establishmentNameAr?: string | null;
  establishmentLicenseNumber?: string | null;
  certificateExpiryDate?: string | null;
  certificateValid: boolean;
  numberOfBooksRegulateEntriesApplications: 0 | 1;
  numberOfComputerProgramsRegulateEntriesApplications: 0 | 1;
  numberOfVideoGamesRegulateEntriesApplications: 0 | 1;
  numberOfCinemaRegulateEntriesApplications: 0 | 1;
}

export const getMediaLicenseByNumber = (mediaLicenseNumber: string) => {
  return request.get<MediaLicenseByNumberResponse, MediaLicenseByNumberResponse>(
    `/api/FormOptions/MediaLicenseByNumber`,
    { mediaLicenseNumber },
    { skipErrorMessage: true },
  );
};

const ARTIST_WORK_TYPE_MEDIA_MATERIAL_TYPE_BY_SERVICE_CODE: Record<string, number> = {
  "21": 1,
  "1001": 1,
  "1002": 1,
  "1003": 2,
  "1004": 3,
  "1008": 1,
  "1009": 4,
  "1010": 4,
  "2201": 1,
  "2202": 4,
};

type PosterTrailerPermitByProfileIdApiItem = {
  id?: number | string | null;
  value?: number | string | null;
  applicationDetailId?: number | string | null;
  posterTrailerPermitId?: number | string | null;
  applicationNumber?: string | null;
  label?: string | null;
  labelEn?: string | null;
  labelAr?: string | null;
  title?: string | null;
  titleEn?: string | null;
  titleAr?: string | null;
  requestType?: string | null;
  posterType?: string | null;
  posterTypeEn?: string | null;
  posterTypeAr?: string | null;
  posterTypeId?: number | string | null;
  category?: string | number | null;
  categoryEn?: string | null;
  categoryAr?: string | null;
  artistWorkType?: string | number | null;
  artistWorkTypeEn?: string | null;
  artistWorkTypeAr?: string | null;
  artistWorkTypeId?: number | string | null;
  language?: Array<string | number> | string | number | null;
  languageEn?: string | null;
  languageAr?: string | null;
  languages?: Array<string | number> | string | number | null;
  languagesEn?: string | null;
  languagesAr?: string | null;
  languageId?: number | string | null;
  originCountry?: string | number | null;
  originCountryEn?: string | null;
  originCountryAr?: string | null;
  source?: string | number | null;
  sourceEn?: string | null;
  sourceAr?: string | null;
  sourceCountry?: string | number | null;
  sourceCountryEn?: string | null;
  sourceCountryAr?: string | null;
  sourceCountryId?: number | string | null;
  copyrightsType?: string | number | null;
  copyrightsTypeEn?: string | null;
  copyrightsTypeAr?: string | null;
  copyrightsTypeId?: number | string | null;
  durationInMinutes?: string | number | null;
  permitStartDate?: string | null;
  permitEndDate?: string | null;
  permitValidityPeriod?: [string, string] | string[] | null;
  applyingPermitForLocalCinematicFilms?: "Yes" | "No" | boolean | null;
  isLocalFilm?: boolean | null;
  filmDirector?: string | null;
  filmWriter?: string | null;
  ministryOfEconomyRegistrationCertificate?: string | null;
  attachmentUrl?: string | null;
  writerEmiratesId?: string | null;
  writerNationalityId?: number | string | null;
  writerEmiratesIdCopy?: string | null;
};

export interface TODOPermitOption {
  value: number | string;
  matchValues?: Array<number | string>;
  label: string;
  labelEn?: string;
  labelAr?: string;
  title: string;
  titleEn?: string;
  titleAr?: string;
  category: string;
  categoryEn?: string;
  categoryAr?: string;
  languages: Array<string | number>;
  languagesEn?: string;
  languagesAr?: string;
  originCountry: string;
  originCountryEn?: string;
  originCountryAr?: string;
  copyrightsType: string;
  copyrightsTypeEn?: string;
  copyrightsTypeAr?: string;
  requestType: string;
  applyingPermitForLocalCinematicFilms: "Yes" | "No";
  filmDirector: string;
  filmWriter: string;
  durationInMinutes: string;
  permitValidityPeriod?: [string, string];
  ministryOfEconomyRegistrationCertificate?: string;
  writerEmiratesId?: string;
  writerNationalityId?: number;
  writerEmiratesIdCopy?: string;
}


type AgeRatingPermitByProfileIdApiItem = {
  id?: number | string | null;
  value?: number | string | null;
  applicationDetailId?: number | string | null;
  posterTrailerPermitId?: number | string | null;
  applicationNumber?: string | null;
  label?: string | null;
  labelEn?: string | null;
  labelAr?: string | null;
  title?: string | null;
  titleEn?: string | null;
  titleAr?: string | null;
  type?: string | number | null;
  typeEn?: string | null;
  typeAr?: string | null;
  typeId?: number | string | null;
  artistWorkTypeId?: number | string | null;
  language?: Array<string | number> | string | number | null;
  languageEn?: string | null;
  languageAr?: string | null;
  languageId?: number | string | null;
  source?: string | number | null;
  sourceEn?: string | null;
  sourceAr?: string | null;
  sourceCountryId?: number | string | null;
  copyrightsType?: string | number | null;
  copyrightsTypeEn?: string | null;
  copyrightsTypeAr?: string | null;
  copyrightsTypeId?: number | string | null;
  applyingPermitForLocalCinematicFilms?: "Yes" | "No" | boolean | null;
  isLocalFilm?: boolean | null;
  filmDirector?: string | null;
  filmWriter?: string | null;
  writerEmiratesId?: string | null;
  writerNationalityId?: number | string | null;
  writerEmiratesIdCopy?: string | null;
  writerEmiratesIdCopyUrl?: string | null;
  durationInMinutes?: string | number | null;
  permitStartDate?: string | null;
  permitEndDate?: string | null;
  permitValidityPeriod?: [string, string] | null;
  attachmentUrl?: string | null;
  economyCertificate?: string | null;
  ministryOfEconomyRegistrationCertificate?: string | null;
  contentLink?: string | null;
};


export interface AgeRatingPermitOption {
  value: number | string;
  label: string;
  labelEn?: string;
  labelAr?: string;
  title: string;
  titleEn?: string;
  titleAr?: string;
  type: string;
  typeEn?: string;
  typeAr?: string;
  language: string;
  languages: Array<string | number>;
  languageEn?: string;
  languageAr?: string;
  source: string;
  sourceEn?: string;
  sourceAr?: string;
  copyrightsType: string;
  copyrightsTypeEn?: string;
  copyrightsTypeAr?: string;
  applyingPermitForLocalCinematicFilms: "Yes" | "No";
  filmDirector: string;
  filmWriter: string;
  writerEmiratesId?: string;
  nationalityId?: number;
  durationInMinutes: string;
  copyrightsValidityPeriod: [string, string];
  economyCertificate?: string;
  writerEmiratesIdCopy?: string;
}



const stringifyPermitValue = (value: unknown) => {
  if (value === undefined || value === null) return "";
  return String(value);
};

const normalizePermitLanguageIds = (value: unknown): Array<string | number> => {
  const values = Array.isArray(value) ? value : [value];

  return values.reduce<Array<string | number>>((result, item) => {
    const candidates = typeof item === "string" ? item.split(",") : [item];

    candidates.forEach((candidate) => {
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        result.push(candidate);
        return;
      }

      if (typeof candidate !== "string") {
        return;
      }

      const normalized = candidate.trim();
      if (!normalized) {
        return;
      }

      result.push(
        /^-?\d+(\.\d+)?$/.test(normalized)
          ? Number(normalized)
          : normalized,
      );
    });

    return result;
  }, []);
};

const mapPosterTrailerPermitByProfileIdOption = (
  item: PosterTrailerPermitByProfileIdApiItem,
): TODOPermitOption => {
  const value =
    item.id ??
    item.value ??
    item.posterTrailerPermitId ??
    item.applicationDetailId ??
    item.applicationNumber ??
    "";
  const title =
    item.title ?? item.titleEn ?? item.titleAr ?? stringifyPermitValue(value);
  const category = item.category ?? item.artistWorkType ?? item.artistWorkTypeId;
  const categoryEn = item.categoryEn ?? item.artistWorkTypeEn ?? undefined;
  const categoryAr = item.categoryAr ?? item.artistWorkTypeAr ?? undefined;
  const languageValue = item.languages ?? item.language ?? item.languageId;
  const languages = normalizePermitLanguageIds(languageValue);
  const languagesEn = item.languagesEn ?? item.languageEn ?? undefined;
  const languagesAr = item.languagesAr ?? item.languageAr ?? undefined;
  const originCountry =
    item.originCountry ?? item.sourceCountry ?? item.source ?? item.sourceCountryId;
  const originCountryEn = item.originCountryEn ?? item.sourceCountryEn ?? item.sourceEn ?? undefined;
  const originCountryAr = item.originCountryAr ?? item.sourceCountryAr ?? item.sourceAr ?? undefined;
  const copyrightsType = item.copyrightsType ?? item.copyrightsTypeId;
  const labelParts = [
    item.applicationNumber,
    title,
    typeof languageValue === "string" ? languageValue : undefined,
  ].filter((part): part is string => Boolean(String(part ?? "").trim()));
  const label =
    (item.label ?? item.labelEn ?? labelParts.join(" | ")) || stringifyPermitValue(title);
  const permitStartDate =
    item.permitStartDate ??
    item.permitValidityPeriod?.[0] ??
    "";
  const permitEndDate =
    item.permitEndDate ??
    item.permitValidityPeriod?.[1] ??
    "";
  const applyingPermitForLocalCinematicFilms =
    item.applyingPermitForLocalCinematicFilms === "Yes" || item.isLocalFilm === true
      ? "Yes"
      : "No";

  return {
    value,
    matchValues: [
      item.id,
      item.value,
      item.posterTrailerPermitId,
      item.applicationDetailId,
      item.applicationNumber,
    ].filter(
      (candidate): candidate is number | string =>
        candidate !== undefined &&
        candidate !== null &&
        String(candidate).trim() !== "",
    ),
    label,
    labelEn: item.labelEn ?? label,
    labelAr: item.labelAr ?? undefined,
    title: stringifyPermitValue(title),
    titleEn: item.titleEn ?? item.title ?? undefined,
    titleAr: item.titleAr ?? undefined,
    category: stringifyPermitValue(category),
    categoryEn,
    categoryAr,
    languages,
    languagesEn,
    languagesAr,
    originCountry: stringifyPermitValue(originCountry),
    originCountryEn,
    originCountryAr,
    copyrightsType: stringifyPermitValue(copyrightsType),
    copyrightsTypeEn: item.copyrightsTypeEn ?? undefined,
    copyrightsTypeAr: item.copyrightsTypeAr ?? undefined,
    requestType: stringifyPermitValue(item.posterTypeId),
    applyingPermitForLocalCinematicFilms,
    filmDirector: item.filmDirector ?? "",
    filmWriter: item.filmWriter ?? "",
    durationInMinutes: stringifyPermitValue(item.durationInMinutes),
    permitValidityPeriod:
      permitStartDate || permitEndDate
        ? [stringifyPermitValue(permitStartDate), stringifyPermitValue(permitEndDate)]
        : undefined,
    ministryOfEconomyRegistrationCertificate:
      item.ministryOfEconomyRegistrationCertificate ?? item.attachmentUrl ?? undefined,
    writerEmiratesId: item.writerEmiratesId ?? undefined,
    writerNationalityId:
      item.writerNationalityId === undefined || item.writerNationalityId === null
        ? undefined
        : Number(item.writerNationalityId),
    writerEmiratesIdCopy: item.writerEmiratesIdCopy ?? undefined,
  };
};

/** Customer portal host for film / artist work type lookup (public API). */
export type ArtistWorkTypeDto = {
  id: number;
  nameAr?: string;
  nameEn?: string;
  code?: string;
  mediaMaterialTypeId?: number;
};

export const getArtistWorkTypes = (mediaMaterialTypeId = 1) => {
  // P8 Plan A: route through the gateway (relative /api); no per-service base URL override.
  // This lookup is owned by the customer portal service; the gateway maps the path to it, so the
  // admin frontend no longer needs to know which back-end serves it.
  return request.get(
    `/api/Lookup/GetArtistWorkTypes`,
    { mediaMaterialTypeId },
    {
      skipErrorMessage: true,
    },
  );
};

export interface MediaMaterialCategoryChildDto {
  id: number;
  nameEn?: string;
  nameAr?: string;
  code?: string;
  mediaMaterialCategoryId?: number;
  mediaMaterialTypeId?: number;
}

export interface MediaMaterialCategoryDto {
  id: number;
  nameEn?: string;
  nameAr?: string;
  code?: string;
  children?: MediaMaterialCategoryChildDto[];
}

export interface AgeClassificationDto {
  id: number;
  nameEn?: string;
  nameAr?: string;
  mediaMaterialTypeId?: number;
  logoUrl?: string;
  descEn?: string;
  descAr?: string;
  isSelfMonitored?: boolean;
}

interface LookupResponse<T> {
  isSuccess?: boolean;
  statusCode?: number;
  message?: string;
  data?: T;
}

export const getMediaMaterialCategoryTree = (mediaMatrialTypeId: number) => {
  return request.get<
    LookupResponse<MediaMaterialCategoryDto[]>,
    LookupResponse<MediaMaterialCategoryDto[]>
  >(
    "/api/Lookup/GetMediaMaterialCategoryTree",
    { mediaMatrialTypeId },
    { skipErrorMessage: true },
  );
};

export const getAgeClassifications = (mediaMaterialTypeId: number) => {
  return request.get<
    LookupResponse<AgeClassificationDto[]>,
    LookupResponse<AgeClassificationDto[]>
  >(
    "/api/Lookup/GetAgeClassifications",
    { mediaMaterialTypeId },
    { skipErrorMessage: true },
  );
};
export const getSocialMediaSubCategory = (id: string | number) => {
  return request.get(`/api/Lookup/GetSocialMediaSubCategory/${id}`);
};
export const getSubjectSubList = () => {
  return request.get(`/api/Lookup/GetSubjectSubList`);
};
export const getServiceSelectTable = (serviceId: number) => {
  return request.get(`/api/ServiceInfo/Config/${serviceId}/Fees`);
};
export function getEconomicActivitys(feeLinkedServiceCode: string) {
  return request.get(
    `/api/ServiceInfo/GetEconomicActivitys?ServiceCode=${feeLinkedServiceCode}`
  )
}
export const getLanguages = () => {
  return request.get(`/api/ContentLibrary/Languages`);
};
export const getAuthoritiesByEmirateId = (emirateId: number) => {
  return request.get(`/api/Lookup/GetAuthoritiesByEmirateId?emirateId=${emirateId}`);
};

export interface FieldDictionaryItem {
  fieldKey: string;
  fieldValue: string;
}

export const getFieldDictionaryList = (serviceCode?: string | number | null) => {
  const normalizedServiceCode =
    typeof serviceCode === "string" ? serviceCode.trim() : serviceCode;

  return request.get<FieldDictionaryItem[]>(`/api/Lookup/GetFieldDictionaryList`, {
    ServiceCode:
      normalizedServiceCode === "" ? undefined : normalizedServiceCode,
  });
};
export const getPortsList = () => {
  return request.get(`/api/Lookup/GetPortsList`);
};
export const getPhotographyServiceVerify = (PurposeOfPhotographys:Array<string>) => {
  return request.post(`/api/MyRequest/PhotographyServiceVerify`,PurposeOfPhotographys);
};
export interface BookApprovedStatusItem {
  isbn: string;
  BookApprovedStatus: number;
}

export interface BookApprovedStatusResponse {
  isSuccess: boolean;
  statusCode: number;
  message: string;
  data: BookApprovedStatusItem[];
}

export const getISBNstatus = (data: string[]) => {
  return request.post<BookApprovedStatusResponse, BookApprovedStatusResponse>(
    "/api/ContentLibrary/GetBookApprovedStatusByIsbns",
    data,
  );
};
export interface ServiceCategories {
  id: number;
  nameEn: string;
  nameAr: string;
}
export interface ServicePage {
  pageSize?: number;
  pageIndex?: number;
  sortBy?: string;
  sortDirection?: number;
  nameEn?: string;
  nameAr?: string;
  serviceCategoryId?: number;
  userTypeCodes?: string[];
  featured?: boolean;
  favorite?: boolean;
}
export interface addServices {
  serviceId: number;
  serviceCode?: string;
  formData: string;
  type: number;
  applicationId: number | null;
  ServiceCode: string | number | null;
  breEnginePayload: Record<string, never>;
  feeEnginePayload: Record<string, never>;
  enginePayload?: RuleStrategyValidatePayload;
}

export type RuleStrategySubmissionMode = "save" | "submit";

export interface RuleStrategyIssue {
  code?: string;
  field?: string;
  message?: string;
  detail?: string;
  [key: string]: unknown;
}

export interface RuleStrategyEnvelope<T> {
  isSuccess: boolean;
  statusCode: number;
  message: string;
  data: T;
}

export interface RuleStrategyValidateData {
  serviceId: number;
  ruleVersion?: string;
  isValid?: boolean;
  hasErrors?: boolean;
  failures?: RuleStrategyIssue[];
  warnings?: RuleStrategyIssue[];
  validatedAt?: string;
  [key: string]: unknown;
}

export interface RuleStrategyPayloadBase<TRequest> {
  actionType: number;
  request: TRequest;
}

export interface CustomerEngineEnvelope<TPayload> {
  serviceId: number;
  applicationId?: number;
  applicationNo?: string;
  enginePaylod: TPayload;
  penaltyScenarioCode?: string;
}

export interface Service901AccountBinding {
  activityId: number;
  accounts: Array<{
    categoryId: number;
    subCategoryIds: number[];
    platformId: number;
    displayName: string;
    url: string;
  }>;
}

export interface Service9RuleStrategyRequest {
  serviceId: number;
  applicantUserId: string;
  establishmentId: string;
  submissionMode: RuleStrategySubmissionMode | string;
  requestTime: string;
  activityIds: number[];
  activityAccountBindings: Service901AccountBinding[];
  termsAgreed: boolean;
}

export interface Service901RuleStrategyRequest {
  serviceId: number;
  applicantUserId: string;
  establishmentId: string;
  submissionMode: RuleStrategySubmissionMode | string;
  requestTime: string;
  activityIds: number[];
  activityAccountBindings: Service901AccountBinding[];
  termsAgreed: boolean;
}

export interface Service4RuleStrategyApplicant {
  userId: string;
  userTypeCode: string;
  establishmentId: string;
}

export interface Service1RuleStrategyApplicant {
  userId: string;
  userTypeCode: string;
  establishmentId: string;
}

export interface Service1RuleStrategyResponsiblePerson {
  personId?: number;
  name?: string;
  countryId?: number;
  photoUrl?: string;
  emiratesId?: string;
  passportNumber?: string;
  identityType?: string;
  acquaintancePersonId?: number;
}

export interface Service1RuleStrategyRequest {
  serviceId: number;
  applicant: Service1RuleStrategyApplicant;
  form: {
    foreignOffice: {
      nameAr?: string;
      nameEn?: string;
      licenseNumber?: string;
      foreignAddress?: {
        countryId?: number;
        phoneNumber?: string;
      };
    };
    termsAccepted: boolean;
    responsiblePersons: Service1RuleStrategyResponsiblePerson[];
  };
  submissionMode: RuleStrategySubmissionMode | string;
  requestTime: string;
}

export interface Service4RuleStrategyPerson {
  isValidResidence?: boolean;
  visaType: number;
  dateOfBirth: string;
  emiratesId?: string;
  passportNumber?: string;
  name: string;
  nameAr: string;
  genderId?: number;
  countryId?: number;
  photoUrl: string;
  emiratesIdCopyUrl?: string;
  passportCopyUrl?: string;
  visaCopyUrl?: string;
  inquiryResult?: {
    nationalityId?: number;
    genderId?: number;
    occupation?: string;
    emiratesIdExpiryDate?: string;
    visaExpiryDate?: string;
  };
  occupation?: string;
  emiratesIdExpiryDate?: string;
  passportExpiryDate?: string;
  visaExpiryDate?: string;
}

export interface Service4RuleStrategyRequest {
  serviceId: number;
  applicant: Service4RuleStrategyApplicant;
  form: {
    termsAccepted: boolean;
    officialLetterUrl: string;
    person: Service4RuleStrategyPerson;
  };
  submissionMode: RuleStrategySubmissionMode | string;
  requestTime: string;
}

export interface Service13RuleStrategyApplicant {
  userId: string;
  userTypeCode: string;
  establishmentId: string;
}

export interface Service13RuleStrategyEquipment {
  photoEquipmentId?: number;
  photoEquipmentNameEn?: string;
  otherText?: string;
  number?: number;
}

export interface Service13RuleStrategyMemberPerson {
  emiratesId?: string;
  passportNumber?: string;
  name: string;
  title?: string;
  countryId?: number;
  photoUrl?: string;
}

export interface Service13RuleStrategyMember {
  person: Service13RuleStrategyMemberPerson;
}

export interface Service13RuleStrategyRequest {
  serviceId: number;
  applicant: Service13RuleStrategyApplicant;
  form: {
    purpose: string;
    arrivalDate?: string;
    emirateId?: number;
    portId?: number;
    requestUrl?: string;
    purposeUrl?: string;
    termsAccepted: boolean;
    equipments: Service13RuleStrategyEquipment[];
    members: Service13RuleStrategyMember[];
  };
  submissionMode: RuleStrategySubmissionMode | string;
  requestTime: string;
}

export interface Service1201RuleStrategyLanguageItem {
  languageId: number;
  name: string;
}

export interface Service1201RuleStrategyChiefEditor {
  fullName: string;
  phoneNumber: string;
  email: string;
  qualificationId?: number;
  qualificationCopyUrl?: string;
  yearsOfExperience?: number;
  photoUrl?: string;
}

export interface Service1201RuleStrategyRequest {
  serviceId: number;
  applicantUserId: string;
  establishmentId: string;
  submissionMode: RuleStrategySubmissionMode | string;
  requestTime: string;
  isElectronic: boolean;
  isMagazine: boolean;
  releaseTypeId: number;
  periodicalTypeId?: number;
  subjectCategoryIds: number[];
  languageItems: Service1201RuleStrategyLanguageItem[];
  chiefEditor?: Service1201RuleStrategyChiefEditor;
  termsAccepted: boolean;
}

export type Service9RuleStrategyValidatePayload =
  RuleStrategyPayloadBase<Service9RuleStrategyRequest>;

export type Service901RuleStrategyValidatePayload =
  RuleStrategyPayloadBase<Service901RuleStrategyRequest>;

export type Service4RuleStrategyValidatePayload =
  RuleStrategyPayloadBase<Service4RuleStrategyRequest>;

export type Service1RuleStrategyValidatePayload =
  RuleStrategyPayloadBase<Service1RuleStrategyRequest>;

export type Service13RuleStrategyValidatePayload =
  RuleStrategyPayloadBase<Service13RuleStrategyRequest>;

export type Service1201RuleStrategyValidatePayload =
  RuleStrategyPayloadBase<Service1201RuleStrategyRequest>;

export type RuleStrategyValidatePayload =
  | Service9RuleStrategyValidatePayload
  | Service901RuleStrategyValidatePayload
  | Service1RuleStrategyValidatePayload
  | Service4RuleStrategyValidatePayload
  | Service13RuleStrategyValidatePayload
  | Service1201RuleStrategyValidatePayload;

export type RuleStrategyValidateEnvelope =
  CustomerEngineEnvelope<RuleStrategyValidatePayload>;

export interface AddFavorite {
  serviceId: number;
}

// Individual Profile API calls
export const getServicePage = (params: ServicePage) => {
  return request.post("/api/Service/ServicePage", params);
};

export const getServiceCategories = () => {
  return request.get("/api/Service/ServiceCategories");
};

export const getUserEstablishments = (serviceId: number) => {
  return request.get(`/api/Service/${serviceId}`);
};
export const getApplicationDetail = (applicationId: number) => {
  return request.get(`/api/MyRequest/ApplicationDetail/${applicationId}`);
};
export const AddNewApplication = (params: addServices) => {
  return request.post(
    // "http://172.16.8.135:5206/api/MyRequest/AddNewApplication",
   `/api/MyRequest/AddNewApplication`,
    params,
  );
};
export const GetUserEstablishmentByUserProfileID = () => {
  return request.get("/api/User/GetUserEstablishmentByUserProfileID");
};
export const CheckProfile = (val: number) => {
  return request.get(`/api/Service/CheckProfile/${val}`);
};
export const DocumentDowload = (fileName?: string) => {
  return request.get(`/api/Document/Dowload?fileName=${fileName || ""}`);
};
export const DocumentPreview = (fileName?: string) => {
  return request.get(`/api/pdf/preview?fileName=${fileName || ""}`);
};

export const CheckService = (serviceId: number) => {
  return request.get(`/api/Service/${serviceId}/Check`);
};

export interface ServiceLearnData {
  serviceId: number;
  serviceDescriptionEn: string;
  serviceDescriptionAr: string;
  userType: Array<{
    id: number;
    nameEn: string;
    nameAr: string;
  }>;
  scopAppcations: Array<{
    id: number;
    nameEn: string;
    nameAr: string;
  }>;
  relateServices: unknown[];
  estimatedCompletionTime: number;
  lastUpdatedTime: string;
  validityPeriod: number;
  estimatedCompletionTimeUnit: string;
  departmentId: number;
  serviceName: string;
}

export const getServiceLearn = (serviceId: number) => {
  return request.get<ServiceLearnData>(`/api/Service/${serviceId}/Learn`);
};
export const getServiceFeeByServiceId = (serviceId: number) => {
  return request.get(`/api/ServiceInfo/GetEconomicActivitys?ServiceCode=${serviceId}`);
};
export const validateRuleStrategy = (data: RuleStrategyValidateEnvelope) => {
  return request.post<
    RuleStrategyEnvelope<RuleStrategyValidateData>,
    RuleStrategyEnvelope<RuleStrategyValidateData>
  >("/api/customer-engines/rule/validate", data);
};

export const getEconomicActivityByMoe = (
  establishmentId?: string | number,
) => {
  return request.get(
    `/api/Service/GetEconomicActivityByMoe`,
    { EstablishmentId: establishmentId },
    { skipErrorToast: true },
  );
};


export interface FeeItem {
  id: number;
  label: string;
  value: string;
  fee: number | null;
  children?: FeeItem[];
}

export const getServiceFees = (serviceId: number) => {
  return request.get<FeeItem[]>(`/api/Service/Config/${serviceId}/Fees`, {}, { skipErrorToast: true });
};
export const GetAllUserType = () => {
  return request.get(`/api/ServiceInfo/GetAllUserType`);
};

export const AddFavorite = (serviceId: number) => {
  return request.post(`/api/Service/AddFavorite?serviceId=${serviceId}`);
};

export interface FeeQuoteEnginePayload {
  actionType: number;
  expectedFeeVersion?: string;
  request: {
    serviceId: number;
    correlationId?: string;
    applicant: {
      userId: string;
      userTypeCode: string;
      establishmentId: string;
    };
    payload?: Record<string, unknown>;
    requestTime: string;
  };
}

export type FeeQuoteRequest = FeeQuoteEnginePayload;
export type FeeQuoteEnvelope = CustomerEngineEnvelope<FeeQuoteEnginePayload>;

export interface FeeBreakdownItem {
  legacyG3Code?: string;
  legacyCode?: string;
  code?: string;
  chargeName: string;
  chargeNameAr?: string | null;
  description: string;
  amount: number;
  basis: string;
  currency?: string;
}

export interface FeeQuoteResponse {
  totalAmount: number;
  currency: string;
  breakdown: FeeBreakdownItem[];
  warnings?: Array<string | RuleStrategyIssue>;
  quotedAt: string;
}

export const getFeeStrategyQuote = (data: FeeQuoteEnvelope) => {
  return request.post<
    RuleStrategyEnvelope<FeeQuoteResponse>,
    RuleStrategyEnvelope<FeeQuoteResponse>
  >(
    "/api/customer-engines/fee/quote",
    data,
  );
};

/** Payment-center response for a service application (admin payment record). */
export interface ServiceApplicationPaymentDto {
  id: number;
  applicationId: number;
  serviceId: number;
  amount: number;
  currencyCode: string;
  feeVersion: string;
  feeBreakdownJson: string;
  feeWarningsJson: string;
  freeDecisionJson: string | null;
  feeQuoteRawResponseJson: string | null;
  receiptWithHeaderUrl: string | null;
  paymentReceiptWithHeaderUrl: string | null;
  channelId: number;
  expiresAt: string;
  status: number;
  createdOn: string;
  updatedOn: string | null;
}

export interface ServiceApplicationPaymentApiResponse {
  isSuccess: boolean;
  statusCode: number;
  message: string | null;
  data: ServiceApplicationPaymentDto | null;
}

/** Raw row inside fee quote JSON (payment / fee engine). */
export interface ServiceFeeBreakdownRow {
  legacyG3Code?: string;
  legacyCode?: string;
  code?: string;
  chargeName: string;
  chargeNameAr?: string | null;
  description?: string;
  unitPrice?: number;
  quantity?: number;
  amount: number;
  basis?: string;
  currency?: string;
}

const mapBreakdownToFeeItems = (rows: ServiceFeeBreakdownRow[]): FeeBreakdownItem[] =>
  (Array.isArray(rows) ? rows : [])
    .filter((row): row is ServiceFeeBreakdownRow => Boolean(row && typeof row === "object"))
    .map((row) => {
      const amount = Number(row.amount ?? 0);

      return {
        legacyG3Code: row.legacyG3Code,
        legacyCode: row.legacyCode,
        code: row.code,
        chargeName: row.chargeName,
        chargeNameAr: row.chargeNameAr,
        description: row.description ?? "",
        amount: Number.isFinite(amount) ? amount : 0,
        basis: row.basis ?? "",
        currency: row.currency,
      };
    });

/**
 * Maps payment-center DTO to {@link FeeQuoteResponse} for shared UI
 * (prefers {@link ServiceApplicationPaymentDto#feeQuoteRawResponseJson}).
 */
export const mapServiceApplicationPaymentToFeeQuote = (
  payment: ServiceApplicationPaymentDto,
): FeeQuoteResponse | null => {
  if (payment.feeQuoteRawResponseJson) {
    try {
      const envelope = JSON.parse(payment.feeQuoteRawResponseJson) as {
        data?: {
          totalAmount?: number;
          currency?: string;
          breakdown?: ServiceFeeBreakdownRow[];
          warnings?: FeeQuoteResponse["warnings"];
          quotedAt?: string;
        };
      };
      const d = envelope?.data;
      if (d && (d.breakdown?.length || d.totalAmount != null)) {
        return {
          totalAmount: d.totalAmount ?? payment.amount,
          currency: d.currency ?? payment.currencyCode,
          breakdown: mapBreakdownToFeeItems(d.breakdown || []),
          warnings: d.warnings,
          quotedAt: d.quotedAt ?? "",
        };
      }
    } catch {
      // fall through
    }
  }
  try {
    const rows = JSON.parse(payment.feeBreakdownJson) as ServiceFeeBreakdownRow[];
    if (Array.isArray(rows) && rows.length > 0) {
      return {
        totalAmount: payment.amount,
        currency: payment.currencyCode,
        breakdown: mapBreakdownToFeeItems(rows),
        quotedAt: "",
      };
    }
  } catch {
    return null;
  }
  if (payment.amount > 0) {
    return {
      totalAmount: payment.amount,
      currency: payment.currencyCode,
      breakdown: [],
      quotedAt: "",
    };
  }
  return null;
};

export const getServiceApplicationPayment = (applicationId: number) => {
  return request.get<ServiceApplicationPaymentApiResponse>(
    `/api/admin/application/${applicationId}`,
    {},
    { skipErrorMessage: true },
  );
};
export const getPressCardByProfileId = (profileId: string) => {
  return request.get(`/api/FormOptions/PressCardByProfileId`, {
    profileId,
  });
};

export interface MaterialTypeLookupItem {
  id: number;
  nameAr?: string;
  nameEn?: string;
  code?: string;
  userTypeId?: number;
}

export const getMaterialTypes = (userTypeId: string | number) => {
  return request.get<MaterialTypeLookupItem[]>(
    `/api/Lookup/MaterialTypes?userTypeId=${userTypeId}`,
  );
};

export const getPrintingPermitByProfileId = (
  profileId: string,
  publicationTypeId: number,
  photographyPurpose?: string | string[] | null,
) => {
  const normalizedPhotographyPurpose = Array.isArray(photographyPurpose)
    ? photographyPurpose
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .join(",")
    : String(photographyPurpose ?? "").trim();

  return request.get(`/api/FormOptions/PrintingPermitByProfileId`, {
    profileId,
    publicationTypeId,
    PhotographyPurpose: normalizedPhotographyPurpose,
  });
};

export const getRegulateEntryByProfileId = (profileId: string) => {
  return request.get(`/api/FormOptions/RegulateEntryByProfileId`, {
    profileId,
  });
};

export const resolveArtistWorkTypeMediaMaterialTypeId = (
  serviceCode?: string | number | null,
) => {
  const normalizedServiceCode = String(serviceCode ?? "").trim();

  return (
    ARTIST_WORK_TYPE_MEDIA_MATERIAL_TYPE_BY_SERVICE_CODE[
      normalizedServiceCode
    ] ?? 1
  );
};


const mapAgeRatingPermitByProfileIdOption = (
  item: AgeRatingPermitByProfileIdApiItem,
): AgeRatingPermitOption => {
  const value =
    item.id ??
    item.value ??
    item.posterTrailerPermitId ??
    item.applicationDetailId ??
    item.applicationNumber ??
    "";
  const title =
    item.title ?? item.titleEn ?? item.titleAr ?? stringifyPermitValue(value);
  const type = item.type ?? item.typeId ?? item.artistWorkTypeId;
  const language = item.language ?? item.languageId;
  const languages = normalizePermitLanguageIds(language);
  const source = item.source ?? item.sourceCountryId;
  const copyrightsType = item.copyrightsType ?? item.copyrightsTypeId;
  const labelParts = [
    item.applicationNumber,
    title,
  ].filter((part): part is string => Boolean(String(part ?? "").trim()));
  const label =
    (item.label ?? item.labelEn ?? labelParts.join(" | ")) || title;
  const permitStartDate =
    item.permitStartDate ??
    item.permitValidityPeriod?.[0] ??
    "";
  const permitEndDate =
    item.permitEndDate ??
    item.permitValidityPeriod?.[1] ??
    "";
  const applyingPermitForLocalCinematicFilms =
    item.applyingPermitForLocalCinematicFilms === "Yes" || item.isLocalFilm === true
      ? "Yes"
      : "No";

  return {
    value,
    label,
    labelEn: item.labelEn ?? label,
    labelAr: item.labelAr ?? undefined,
    title: stringifyPermitValue(title),
    titleEn: item.titleEn ?? item.title ?? undefined,
    titleAr: item.titleAr ?? undefined,
    type: stringifyPermitValue(type),
    typeEn: item.typeEn ?? undefined,
    typeAr: item.typeAr ?? undefined,
    language: stringifyPermitValue(languages[0]),
    languages,
    languageEn: item.languageEn ?? undefined,
    languageAr: item.languageAr ?? undefined,
    source: stringifyPermitValue(source),
    sourceEn: item.sourceEn ?? undefined,
    sourceAr: item.sourceAr ?? undefined,
    copyrightsType: stringifyPermitValue(copyrightsType),
    copyrightsTypeEn: item.copyrightsTypeEn ?? undefined,
    copyrightsTypeAr: item.copyrightsTypeAr ?? undefined,
    applyingPermitForLocalCinematicFilms,
    filmDirector: item.filmDirector ?? "",
    filmWriter: item.filmWriter ?? "",
    writerEmiratesId: item.writerEmiratesId ?? undefined,
    nationalityId:
      item.writerNationalityId === undefined || item.writerNationalityId === null
        ? undefined
        : Number(item.writerNationalityId),
    durationInMinutes: stringifyPermitValue(item.durationInMinutes),
    copyrightsValidityPeriod: [
      stringifyPermitValue(permitStartDate),
      stringifyPermitValue(permitEndDate),
    ],
    economyCertificate:
      item.ministryOfEconomyRegistrationCertificate ??
      item.attachmentUrl ??
      item.economyCertificate ??
      undefined,
    writerEmiratesIdCopy:
      item.writerEmiratesIdCopy ?? item.writerEmiratesIdCopyUrl ?? undefined,
  };
};

export const getAgeRatingPermitByProfileId = async (
  profileId: string,
  serviceCode?: string | number | null,
): Promise<AgeRatingPermitOption[]> => {
  if (!String(profileId || "").trim()) {
    return [];
  }

  const response = await request.get<
    AgeRatingPermitByProfileIdApiItem[] | { data?: AgeRatingPermitByProfileIdApiItem[] | null }
  >(`/api/FormOptions/AgeRatingPermitByProfileId`, {
    profileId,
    serviceCode: resolveServiceCode(serviceCode),
  });

  const payload =
    response && typeof response === "object" && "data" in response && Array.isArray(response.data)
      ? response.data
      : Array.isArray(response)
        ? response
        : [];

  return payload.map(mapAgeRatingPermitByProfileIdOption);
};

export const getAgeRatingPermitByIds = async (
  ids: Array<string | number> | string | number | null | undefined,
): Promise<AgeRatingPermitOption[]> => {
  const normalizedIds = (Array.isArray(ids) ? ids : [ids])
    .map((id) => String(id ?? "").trim())
    .filter(Boolean)
    .join(",");

  if (!normalizedIds) {
    return [];
  }

  const response = await request.get<
    AgeRatingPermitByProfileIdApiItem[] | { data?: AgeRatingPermitByProfileIdApiItem[] | null }
  >(`/api/Form/AgeRatingPermit`, {
    ids: normalizedIds,
  });

  const payload =
    response && typeof response === "object" && "data" in response && Array.isArray(response.data)
      ? response.data
      : Array.isArray(response)
        ? response
        : [];

  return payload.map((item) => {
    const option = mapAgeRatingPermitByProfileIdOption(item);
    const applicationNumber = String(item.applicationNumber ?? "").trim();

    return applicationNumber
      ? {
          ...option,
          label: applicationNumber,
          labelEn: applicationNumber,
        }
      : option;
  });
};

export const getArtistWorkTypesByServiceCode = (
  serviceCode?: string | number | null,
) => {
  return getArtistWorkTypes(
    resolveArtistWorkTypeMediaMaterialTypeId(serviceCode),
  );
};

export const getPosterTrailerPermitByProfileId = async (
  profileId: string,
): Promise<TODOPermitOption[]> => {
  if (!String(profileId || "").trim()) {
    return [];
  }

  const response = await request.get<
    PosterTrailerPermitByProfileIdApiItem[] | { data?: PosterTrailerPermitByProfileIdApiItem[] | null }
  >(`/api/FormOptions/PosterTrailerPermitByProfileId`, {
    profileId,
  });

  const payload =
    response && typeof response === "object" && "data" in response && Array.isArray(response.data)
      ? response.data
      : Array.isArray(response)
        ? response
        : [];

  return payload.map(mapPosterTrailerPermitByProfileIdOption);
};

export const getPosterTrailerPermitByIds = async (
  ids?: Array<string | number> | string | number | null,
): Promise<TODOPermitOption[]> => {
  const normalizedIds = (Array.isArray(ids) ? ids : [ids])
    .map((id) => String(id ?? "").trim())
    .filter(Boolean)
    .join(",");

  const response = await request.get<
    PosterTrailerPermitByProfileIdApiItem[] | { data?: PosterTrailerPermitByProfileIdApiItem[] | null }
  >(`/api/Form/PosterTrailerPermit`, {
    ids: normalizedIds,
  });

  const payload =
    response && typeof response === "object" && "data" in response && Array.isArray(response.data)
      ? response.data
      : Array.isArray(response)
        ? response
        : [];

  return payload.map(mapPosterTrailerPermitByProfileIdOption);
};

export const TODOpermitApi = async (profileId?: string) => {
  return {
    data: await getPosterTrailerPermitByProfileId(String(profileId || "")),
  };
};
