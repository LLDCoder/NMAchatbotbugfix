import type { SelfMonitorProgramInfo } from "@/components/common/SelfMonitorBadge"
import type { IRelateAppsResponse } from "@/services/tickets"
import request from "@/utils/request"
import { resolveServiceCode } from "@/utils/serviceCode"

// Individual Profile Interfaces
export interface AddUserProfileIndividualParams {
  userId: string
  userTypeId: number
  dataOfBirth: string
  passportNumber: string
  email: string
  mobileNumber: string
  emiratesId: string
  fullNameAr: string
  fullNameEn: string
  nationalityId: number
  genderId: number
  occupation: string
  personalPhotoUrl: string
  eidDocumentOrPassPortSacnUrl: string
  emirateId: string
  regionId: string
  areaId: string
  street: string
  licenseExpiryDate: string
}

export interface UpdateUserProfileIndividualParams {
  profielId: number
  userId: string
  userTypeId: number
  dataOfBirth: string
  passportNumber: string
  email: string
  mobileNumber: string
  emiratesId: string
  fullNameAr: string
  fullNameEn: string
  nationalityId: number
  genderId: number
  occupation: string
  personalPhotoUrl: string
  eidDocumentOrPassPortSacnUrl: string
  emirateId: number
  regionId: number
  areaId: number
  street: string
}

// Establishment Profile Interfaces
export interface EstablishmentPartnerPayload {
  id?: number | string | null
  establishmentId?: number | string | null
  partnerTypeCode?: number | string | null
  partnerType?: string | null
  representativeNameEn: string | null
  representativeNameAr: string | null
  representativeEmiratesId: string | null
  [key: string]: unknown
}

export interface AddUserProfileEstablishmentParams {
  userId: string
  userTypeId: number
  establishmentTypeId: number
  workEmail: string
  commerceLicenseNumber: string
  licenseExpiryDate: string
  establishmentNameAr: string
  establishmentNameEn: string
  parentId: number
  authorityId: number
  phoneNumber: string
  tenancyContractEndDate: string
  uploadCommerceLicenseURL: string
  uploadTenancyContractURL: string
  uploadMemorandumOfAssociationURL: string
  uploadPowerOfAttorneyURL: string
  emirateId: number
  regionId: number
  areaId: number
  street: string
  name: string
  contactNumber: string
  parters?: EstablishmentPartnerPayload[]
}

export interface UpdateUserProfileEstablishmentParams {
  proFileId: number
  userId: string
  userTypeId: number
  establishmentTypeId: number
  workEmail: string
  commerceLicenseNumber: string
  licenseExpiryDate: string
  establishmentNameAr: string
  establishmentNameEn: string
  parentId: number
  authorityId: number
  phoneNumber: string
  tenancyContractEndDate: string
  uploadCommerceLicenseURL: string
  uploadTenancyContractURL: string
  uploadMemorandumOfAssociationURL: string
  uploadPowerOfAttorneyURL: string
  emirateId: number
  regionId: number
  areaId: number
  street: string
  parters?: EstablishmentPartnerPayload[]
}

const normalizePartnerRepresentativeFields = <T extends {
  partnerTypeCode?: number | string | null
  representativeNameEn?: string | null
  representativeNameAr?: string | null
  representativeEmiratesId?: string | null
}>(partner: T): T => {
  const isCompany = String(partner.partnerTypeCode ?? "").trim() === "1"
  const representativeNameEn = partner.representativeNameEn?.trim() || null
  const representativeNameAr = partner.representativeNameAr?.trim() || null
  const representativeEmiratesId = partner.representativeEmiratesId?.trim() || null
  return {
    ...partner,
    representativeNameEn: isCompany ? representativeNameEn : null,
    representativeNameAr: isCompany ? representativeNameAr : null,
    representativeEmiratesId: isCompany ? representativeEmiratesId : null,
  }
}

const normalizeEstablishmentParams = <T extends {
  parters?: EstablishmentPartnerPayload[]
}>(params: T): T => ({
  ...params,
  parters: params.parters?.map(normalizePartnerRepresentativeFields),
})

// Address dropdown list interfaces
export interface EmirateItem {
  id: number
  nameEn: string
  nameAr: string
  code?: string
}

export interface RegionItem {
  id: number
  nameEn: string
  nameAr: string
  emirateId: number
  code?: string
}

export interface AreaItem {
  id: number
  nameEn: string
  nameAr: string
  regionId: number
  code?: string
}

// Get User Profile Interfaces
export interface UserIndividualProfile {
  userProfile: {
    id: number
    userId: string
    userTypeId: number
    personId: number
    addressId: number
    isCompleted: boolean
    isApproved: boolean
    status: string
  }
  userPerson: {
    id: number
    name: string
    nationalityId: number
    emiratesId: string
    passportNumber: string
    emiratesIdCopyUrl: string
    passportCopyUrl: string
    genderId: number
    dateOfBirth: string
    photoUrl: string
    nameAr: string
    tradeLicenseNo: string
    tradeLicenseEndDate: string
    emiratesIdexpiryDate: string
    passportExpiryDate: string
    personalEmail: string
    personalMobile: string
    occupation: string
  }
}

export interface UserEstablishmentProfile {
  profielId: number
  userId: string
  userTypeId: number
  establishmentTypeId: number
  workEmail: string
  commerceLicenseNumber: string
  licenseExpiryDate: string
  establishmentNameAr: string
  establishmentNameEn: string
  parentId: number
  authorityId: number
  phoneNumber: string
  tenancyContractEndDate: string
  uploadCommerceLicenseURL: string
  uploadTenancyContractURL: string
  uploadMemorandumOfAssociationURL: string
  uploadPowerOfAttorneyURL: string
  emirateId: number
  regionId: number
  areaId: number
  street: string
}

// Type Dictionary and Partner related interfaces
export interface TypeDictionary {
  id: number
  code: string
  scope: string
  nameEn: string
  nameAr: string
  isShown: boolean
  descAr: string | null
  descEn: string | null
}

type PrintedTypeLookupItem = Partial<TypeDictionary> & {
  Id?: number
  NameEn?: string
  NameAr?: string
  Code?: string
}
const normalizeTypeDictionaryItem = (
  item: PrintedTypeLookupItem
): TypeDictionary => ({
  id: item.id ?? item.Id ?? 0,
  code: item.code ?? item.Code ?? "",
  scope: item.scope ?? "",
  nameEn: item.nameEn ?? item.NameEn ?? "",
  nameAr: item.nameAr ?? item.NameAr ?? "",
  isShown: item.isShown ?? true,
  descAr: item.descAr ?? null,
  descEn: item.descEn ?? null,
})

export interface CodeInfo {
  id: number
  code: string
  nameAr: string
  nameEn: string
}

export interface NationalityInfo {
  id: number
  fullNameAr: string
  fullNameEn: string
  nameAr: string
  nameEn: string
  isocode2: string
  isocode3: string
  flagUrl: string
  bigFlagUrl: string
  phoneCode: string
  numericCode: number
  regionId: number
}

export interface PartnerListItem {
  id: number
  partnerTypeCode: string
  partnerTypeCodeInfo: CodeInfo
  dateBirth: string
  emiratesId: string
  fullNameAr: string
  fullNameEn: string
  representativeNameEn: string | null
  representativeNameAr: string | null
  representativeEmiratesId: string | null
  nationalityId: number
  nationalityIdInfo: CodeInfo
  genderId: number
  genderIdInfo: CodeInfo
  expiryDate: string
  occupation: string
  personalPhotoUrl: string
  passportUrl: string
  visaUrl: string
  emiratesIdurl: string
  verificationMethodCode: string
  uaeNumber: string
  passportExpiryDate: string
  visaExpiryDate: string
  passportNumber: string
  passportScanUrl: string
}

export interface PartnerDetail {
  id: number
  establishmentId: number
  partnerTypeCode: string
  dateBirth: string
  emiratesId: string
  fullNameAr: string
  fullNameEn: string
  representativeNameEn: string | null
  representativeNameAr: string | null
  representativeEmiratesId: string | null
  nationalityId: number
  genderId: number
  expiryDate: string
  occupation: string
  personalPhotoUrl: string
  passportUrl: string
  visaUrl: string
  emiratesIdurl: string
  verificationMethodCode: string
  uaeNumber: string
  passportExpiryDate: string
  visaExpiryDate: string
  passportNumber: string
  passportScanUrl: string
  updateOn: string
  createdOn: string
}

export interface PartnerParams {
  establishmentId: number
  partnerTypeCode: string
  dateBirth: string | null
  emiratesId: string
  fullNameAr: string
  fullNameEn: string
  representativeNameEn: string | null
  representativeNameAr: string | null
  representativeEmiratesId: string | null
  nationalityId: number
  genderId: number
  expiryDate: string | null
  occupation: string
  personalPhotoUrl: string
  passportUrl: string
  visaUrl: string
  emiratesIdurl: string
  verificationMethodCode: string
  uaeNumber: string
  passportExpiryDate: string | null
  visaExpiryDate: string | null
  passportNumber: string | null
  passportScanUrl: string
}


export interface IAddress {
  id: number
  countryId: number
  communityId: number
  street: string
  phoneNumber: string
  longitude: number
  latitude: number
  municipalityId: string
  locationUrl: string
  region: string
  area: string
}

export interface IInfo {
  id: number
  code: string
  name: string
}

export interface ILangInfo {
  id: number
  code: string
  nameEn: string
  nameAr: string
}

export interface ILegalPerson {
  id: number
  name: string
  personalMobile: string
  idType: string
  idTypeInfo: IInfo
  emiratesId: string
  emiratesInfo: IInfo
  dateBirth: string
  personalEmail: string
  emirate: string
  region: string
  regionInfo: IInfo
  area: string
  areaInfo: IInfo
  street: string
  passportNumber: string
  uid: string
}

export interface IPartner {
  id: number
  name: string
  partnerPhotoUrl: string
  partnerType: string
  number: string
  representativeNameEn: string | null
  representativeNameAr: string | null
  representativeEmiratesId: string | null
  address: string
}

export interface IPartnerInfo {
  type: number
  id: number
  establishmentId: number
  partnerTypeCode: string
  partnerTypeName: string
  dateBirth: string
  emiratesId: string
  fullNameAr: string
  fullNameEn: string
  representativeNameEn: string | null
  representativeNameAr: string | null
  representativeEmiratesId: string | null
  nationalityId: number
  nationalityName: string
  genderId: number
  genderName: string
  expiryDate: string
  occupation: string
  personalPhotoUrl: string
  passportUrl: string
  visaUrl: string
  emiratesIdurl: string
  verificationMethodCode: string
  uaeNumber: string
  passportExpiryDate: string
  visaExpiryDate: string
  passportNumber: string
  passportScanUrl: string
  updateOn: string
  createdOn: string
  memorandumOfAssociationUrl: string
  powerOfAttorneyUrl: string
  statementUrl: string
}

export interface IEstablishmentPartner {
  id?: number | string | null
  establishmentId?: number | string | null
  isOwner?: boolean | null
  partnerTypeCode?: number | string | null
  partnerType?: string | null
  partnerTypeName?: string | null
  verificationMethodCode?: number | string | null
  type?: string | null
  dateOfBirth?: string | null
  dateBirth?: string | null
  emiratesId?: string | null
  uaeNumber?: string | null
  uid?: string | null
  passportNumber?: string | null
  fullNameArabic?: string | null
  fullNameEnglish?: string | null
  fullNameAr?: string | null
  fullNameEn?: string | null
  representativeNameEn?: string | null
  representativeNameAr?: string | null
  representativeEmiratesId?: string | null
  nationality?: number | string | null
  nationalityId?: number | string | null
  gender?: string | number | null
  genderId?: string | number | null
  occupation?: string | null
  emiratesIdExpiryDate?: string | null
  emiratesIdexpiryDate?: string | null
  expiryDate?: string | null
  passportExpiryDate?: string | null
  visaExpiryDate?: string | null
  personalPhoto?: string | null
  personalPhotoUrl?: string | null
  photoUrl?: string | null
  emiratesIdFile?: string | null
  emiratesIdUrl?: string | null
  emiratesIdurl?: string | null
  passportScan?: string | null
  passportScanUrl?: string | null
  passport?: string | null
  passportUrl?: string | null
  visaUrl?: string | null
  establishmentNameArabic?: string | null
  establishmentNameEnglish?: string | null
  memorandumOfAssociation?: string | null
  memorandumOfAssociationUrl?: string | null
  powerOfAttorney?: string | null
  powerOfAttorneyUrl?: string | null
  statement?: string | null
  statementUrl?: string | null
  updateOn?: string | null
  createdOn?: string | null
}

export interface IEstablishmentOverview {
  /**
   * Self-Monitor Program state, null when the establishment has no record.
   * Requested from the backend; see the field spec under docs/reports&analytics.
   * Optional so the UI degrades quietly until the field ships.
   */
  selfMonitorProgram?: SelfMonitorProgramInfo | null
  id: number
  profileCode: string
  userProfileId?: number
  nameAr: string
  nameEn: string
  authorityId: number
  authorityIdCode: string
  authorityIdName: string
  licenseNumber: string
  parentId: number
  licenseCopyUrl: string
  tenancyContractEndDate: string
  tenancyContractCopyUrl: string
  addressId: number
  addressName: string
  deletedOn: string
  circulationAudienceFigure: number
  establishmentTypeId: number
  establishmentTypeName: string
  hasValidLicense: boolean
  foreignAddressId: number
  nationalityId: number
  nationalityName: string
  memorandumOfAssociationCopyUrl: string
  powerOfAttorneyCopyUrl: string
  statementCopyUrl: string
  createdBy: string
  trnumber: string
  frequencyUrl: string
  licenseExpiryDate: string
  emails: string
  establishmentMobile: string
  establishmentEmirateId: number
  establishmentEmirateName: string
  officialLetterUrl: string
  documentsCount: number
  partnersCount: number
  establishmentName?: string
  establishmentNameAr?: string | null
  emirateObj?: {
    id: number | null
    nameEn: string | null
    nameAr: string | null
  } | null
  documentCount?: number
  partnerCount?: number
  status: IInfo
  address: IAddress
  legalPerson: ILegalPerson
  partners: IPartner[]
  partnersInfo: IPartnerInfo[]
  partnerList?: IEstablishmentPartner[] | null
  establishment?: {
    authorityId?: number | null
    authorityIdCode?: string | null
    authorityIdNameEn?: string | null
    authorityIdNameAr?: string | null
    workEmail?: string | null
    establishmentTypeId?: number | null
    establishmentTypeObj?: {
      id?: number | null
      nameEn?: string | null
      nameAr?: string | null
    } | null
    workMobileNumber?: string | null
    workMobileNumibe?: string | null
    licenseNumber?: string | null
    licenseExpiryDate?: string | null
    nameEn?: string | null
    nameAr?: string | null
    emirateObj?: {
      id?: number | null
      nameEn?: string | null
      nameAr?: string | null
    } | null
    personalMobile?: string | null
    tenancyContractEndDate?: string | null
    phoneCountryCode?: string | null
    phoneLocalNumber?: string | null
  } | null
  documentInfo?: {
    licenseCopyUrl?: string | null
    tenancyContractCopyUrl?: string | null
    memorandumOfAssociationCopyUrl?: string | null
    powerOfAttorneyCopyUrl?: string | null
    statementCopyUrl?: string | null
    frequencyUrl?: string | null
    officialLetterUrl?: string | null
  } | null
  addressInfo?: {
    emirateObj?: {
      id?: number | null
      nameEn?: string | null
      nameAr?: string | null
    } | null
  } | null
}

export interface IUserIndividualProfile {
  type: number;
  profileCode: string;
  userId: string;
  proFileId: number;
  rejectReason: string | null;
  dateOfBirth: string;
  passportNumber: string;
  uid: string;
  email: string;
  mobileNumber: string;
  emiratesId: string;
  fullNameAr: string;
  fullNameEn: string;
  nationalityId: number;
  nationalityInfo: ILangInfo
  genderId: number
  genderInfo: ILangInfo
  passportExpiryDate: string;
  emiratesIdexpiryDate: string | null;
  occupation: string;
  personalPhotoUrl: string;
  passportCopyUrl: string;
  emiratesIdCopyUrl: string | null;
  visaCopyUrl: string;
  visaExpiryDate: string;
  emirateId: number;
  emirateInfo: ILangInfo
  regionId: number
  regionInfo: ILangInfo
  areaId: number
  areaInfo: ILangInfo
  street: string
  proFileStatus: ILangInfo
  documents: number
}

export interface IProfileAndApplicantResponse {
  userProfileId?: number
  userId?: string | number
  userTypeId?: number | string
  userTypeObj?: {
    id?: number
    code?: string | number
    nameEn?: string
    nameAr?: string
  }
  documentCount?: number
  establishmentDocumentCount?: number
  partnerCount?: number
  violationCount?: number
  unpaidFinesCount?: number
  emiratesId?: string
  passportNumber?: string
  uid?: string
  personalName?: string
  personalNameAr?: string
  personalEmail?: string
  personalPhoneNumber?: string
  phoneNumber?: string
  phoneCountryCode?: string | null
  phoneLocalNumber?: string | null
  potoUrl?: string
  userName?: string
  userEmail?: string
  isVip?: boolean
  /** Self-Monitor marker, null for individuals / no record. */
  selfMonitorProgram?: SelfMonitorProgramInfo | null
  nationalityObj?: {
    id?: number
    nameEn?: string
    nameAr?: string
  }
  profileStatusObj?: {
    id?: number
    nameEn?: string
    nameAr?: string
  }
  [key: string]: unknown
}

// Individual Profile API calls
export const addUserProfileIndividual = (
  params: AddUserProfileIndividualParams
) => {
  return request.post("/api/User/AddUserProFileIndividual", params)
}

export const updateUserProfileIndividual = (
  params: UpdateUserProfileIndividualParams
) => {
  return request.post("/api/User/UpdateUserProFileIndividual", params)
}

export const userChangeIdentity = (params: {
  userTypeID: string
  userProFileID: string
}) => {
  return request.post("/api/User/ChangeIdentity", params)
}

// Establishment Profile API calls
export const addUserProfileEstablishment = (
  params: AddUserProfileEstablishmentParams
) => {
  return request.post(
    "/api/User/AddUserProFileEstablishments",
    normalizeEstablishmentParams(params)
  )
}

export const updateUserProfileEstablishment = (
  params: UpdateUserProfileEstablishmentParams
) => {
  return request.post(
    "/api/User/UpdateUserProFileEstablishments",
    normalizeEstablishmentParams(params)
  )
}

// Address dropdown list API calls
export const getEmirateList = (serviceCode?: string | number | null) => {
  return request.get<EmirateItem[]>("/api/User/GetEmirateList", {
    serviceCode: resolveServiceCode(serviceCode),
  })
}

export const getRegionList = (emirateId?: number) => {
  const url = emirateId
    ? `/api/User/GetRegionList?emirateId=${emirateId}`
    : "/api/User/GetRegionList"
  return request.get<RegionItem[]>(url)
}

export const getAreaList = (regionId?: number) => {
  const url = regionId
    ? `/api/User/GetAreaList?regionId=${regionId}`
    : "/api/User/GetAreaList"
  return request.get<AreaItem[]>(url)
}

// Get User Profile API calls
type UserProfileReadRequestConfig = {
  skipErrorMessage?: boolean;
}

export const getUserIndividual = (
  userId: string,
  config: UserProfileReadRequestConfig = {}
) => {
  return request.get<IUserIndividualProfile>(
    `/api/User/GetUserIndividual?userId=${userId}`,
    {},
    config
  )
}

export const getUserEstablishments = (userId: string) => {
  return request.get<UserEstablishmentProfile>(
    `/api/User/GetUserEstablishmentsList/${userId}`
  )
}

export const getPassportInfo = (
  passportNumber: string,
  dateOfBirth: string,
  config: Record<string, unknown> = {},
) => {
  return request.get(
    "/api/icp/personbypassport",
    { passportNumber, passportNo: passportNumber, dateOfBirth },
    config,
  );
};

export const getEmiratesIdInfo = (
  emiratesId: string,
  dateOfBirth: string,
  config: Record<string, unknown> = {},
) => {
  return request.get(
    "/api/icp/person",
    { emiratesId, dateOfBirth },
    config,
  );
};

export interface GetUserEstablishmentsPageParams {
  userId: string
  pageIndex: number
  pageSize: number
  keyword?: string
}

export interface UserEstablishmentPageResponse {
  items: any[]
  total: number
  pageIndex: number
  pageSize: number
}

export const getUserEstablishmentsPage = (
  params: GetUserEstablishmentsPageParams
) => {
  let url = `/api/User/GetUserEstablishmentsList/${params.userId}?pageIndex=${params.pageIndex}&pageSize=${params.pageSize}`
  if (params.keyword) {
    url += `&keyword=${params.keyword}`
  }
  return request.get<UserEstablishmentPageResponse>(url)
}

export const getUserEstablishmentByID = (eId: string) => {
  return request.get<IEstablishmentOverview>(
    `/api/User/GetUserEstablishmentByID/${eId}`
  )
}

// Type Dictionary and Partner API calls
export const getTypeDictionaryList = (scope: string) => {
  return request.post<TypeDictionary[]>(
    "/api/ServiceInfo/GetTypeDictionaryList",
    {},
    { params: { scope } },
  );
};

export const getPublicationTypeByProfileId = () => {
  return request
    .get<PrintedTypeLookupItem[]>("/api/Lookup/GetLookupData", {
      tableName: "PrintedType",
    })
    .then((res) => {
      const items = Array.isArray(res)
        ? res
        : Array.isArray((res as { data?: unknown })?.data)
          ? (((res as { data?: unknown }).data as PrintedTypeLookupItem[]) ?? [])
          : []

      return items.map(normalizeTypeDictionaryItem)
    })
}

export const getNationalityList = () => {
  return request.get<NationalityInfo[]>("/api/User/GetNationalityList")
}

export const getPartnersNewList = (establishmentId: number) => {
  return request.get<PartnerListItem[]>(
    `/api/User/GetPartnersNewList/${establishmentId}`,
  )
}

export const getPartnerById = (id: string) => {
  return request.get<PartnerDetail>(`/api/User/GetPartnerById/${id}`)
}

export const addPartner = (params: PartnerParams) => {
  return request.post(
    "/api/User/AddPatner",
    normalizePartnerRepresentativeFields(params)
  )
}

export const deletePartner = (id: string) => {
  return request.delete(`/api/User/DeletePatner/${id}`)
}

export const updatePartner = (params: PartnerParams) => {
  return request.post(
    "/api/User/UpdatePatner",
    normalizePartnerRepresentativeFields(params)
  )
}

export const getEstablishment = (
  profileId: number,
  config: UserProfileReadRequestConfig = {}
) => {
  // Migrated from the CustomerPortal endpoint (GetUserEstablishmentByProfileId)
  // to the AdminPortal one. The APS response carries selfMonitorProgram on the
  // top level; the admin portal no longer reaches into CPS for this.
  return request.get<IEstablishmentOverview>(
    `/api/UserManagement/GetEstablishmentByProfileId/${profileId}`,
    {},
    config
  )
}

export const profileAndApplicant = (
  userProfileId: number,
  config: UserProfileReadRequestConfig = {}
) => {
  return request.get<IProfileAndApplicantResponse>(
    `/api/UserManagement/${userProfileId}/ProfileAndApplicant`,
    {},
    config
  )
}

export const getUserProfileRelateApps = (
  userProfileId: number,
  applicationId?: number,
  config: UserProfileReadRequestConfig = {}
) => {
  return request.get<IRelateAppsResponse>(
    `/api/UserManagement/${userProfileId}/Relate`,
    { applicationId },
    config
  )
}
