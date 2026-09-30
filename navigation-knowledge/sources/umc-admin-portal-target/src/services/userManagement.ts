import type { SelfMonitorProgramInfo } from "@/components/common/SelfMonitorBadge";
import request from "@/utils/request";
import saveFileWithAxios from "@/utils/saveFileWithAxios";
import type { AxiosRequestConfig } from "axios";

export interface ApiResponse<T> {
  isSuccess: boolean;
  statusCode: number;
  message: string | null;
  data: T | null;
}

export interface CustomerDetailsProfileDto {
  profileId: number;
  selfMonitorProgram?: SelfMonitorProgramInfo | null;
  isVip?: boolean | null;
  isVipInfo?: string | null;
  isActive?: boolean | null;
  isActiveInfo?: string | null;
  photoUrl?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  emiratesId?: string | null;
  apps?: number | null;
  tickets?: number | null;
  refund?: number | null;
  appeal?: number | null;
  violations?: number | null;
  fines?: number | null;
  userTypeName?: string | null;
  userTypeCode?: string | number | null;
  status?: string | null;
}

export interface CustomerAllProfileCountDto {
  userId: string;
  individual?: number | null;
  establishment?: number | null;
}

export interface CustomerAccountOrProfileOverviewDto {
  userId: string;
  isActive?: boolean | null;
  reson?: string | null;
  photoUrl?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
  mobileCountryCode?: string | null;
  mobileLocalNumber?: string | null;
  emiratesId?: string | null;
  nationalityEn?: string | null;
  nationalityAr?: string | null;
  documents?: number | null;
  walletBalance?: number | null;
  totalSpending?: number | null;
  totalRefunds?: number | null;
  totalRecharge?: number | null;
  allProfileCount?: CustomerAllProfileCountDto | null;
  profileList?: CustomerDetailsProfileDto[] | null;
  walletStatus?: string | null;
  loginMethod?: string;
  mobileUsage: number;
  webUsage: number;
  tabletUsage: number;
  isActiveInfo: string;
}

export interface GetAccountOrIndividualOrEstablishmentParams {
  userId?: string;
  profileId?: number;
  keyWorld?: string;
}

export const getAccountOrIndividualOrEstablishment = (
  params: GetAccountOrIndividualOrEstablishmentParams,
  config?: AxiosRequestConfig,
) =>
  request.get<
    ApiResponse<CustomerAccountOrProfileOverviewDto>,
    ApiResponse<CustomerAccountOrProfileOverviewDto>
  >(
    "/api/UserManagement/GetAccountOrIndividualOrEstablishment",
    {
      ...params,
    },
    config,
  );

export interface UserManagementValueObject {
  id: number;
  nameEn?: string | null;
  nameAr?: string | null;
  code?: string | null;
}

export interface UserProfileManagementDto {
  id: number;
  userTypeId: number;
  userTypeObj?: UserManagementValueObject | null;
  statusId: number;
  statusObj?: UserManagementValueObject | null;
  applyNameEn?: string | null;
  applyNameAr?: string | null;
  applicant?: string | null;
  createdOn?: string | null;
  updateOn?: string | null;
  sla?: UserProfileSlaDto | null;
  profileCode?: string;
}

export interface UserProfileManagementDtoPageResponse {
  pageIndex: number;
  pageSize: number;
  total: number;
  items?: UserProfileManagementDto[] | null;
}

export interface UserProfilesQueryParams {
  ApplicationNo?: string;
  Id?: number;
  StartDate?: string;
  EndDate?: string;
  StatusId?: number;
  UserTypeId?: string[];
  PageSize?: number;
  PageIndex?: number;
  SortBy?: string;
  SortDirection?: number;
}

export interface GetProfileListParams {
  PageIndex: number;
  PageSize: number;
  KeyWorld?: string;
  Status?: string;
  StatrTime?: string;
  EndTime?: string;
  profileTypeCode?: number;
  profileTiers?: string;
  SortBy?: string;
  SortDirection?: 0 | 1;
}

export interface ProfileListItemDto {
  profileId: number;
  profileNo: string;
  mediaFileNumber?: string | null;
  cusomerNo: string;
  userTypeCode: string;
  userTypeName: string;
  profileName: string;
  userName: string;
  status: string;
  statusName: string;
  registTime: string;
  isVip: boolean;
  isActive: boolean;
  /**
   * Self-Monitor Program state, null for profiles with no record — which is
   * most rows. The list endpoint has to carry this itself: the Profile Type
   * column renders it per row, so fetching it per row is not an option.
   * Optional so the column degrades quietly until the field ships.
   */
  selfMonitorProgram?: SelfMonitorProgramInfo | null;
}

export interface ProfileListResponseDto {
  totalPage: number;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  totalAmount: number;
  items: ProfileListItemDto[];
}

export interface UpdateProfileActiveParams {
  profileId: number;
  isActive: boolean;
  reson?: string;
}

export interface UpdateProfileIsVipParams {
  profileId: number;
  isVIP: boolean;
}

export const getProfileList = (
  params: GetProfileListParams,
  config?: AxiosRequestConfig,
) =>
  request.get<ProfileListResponseDto>(
    "/api/UserManagement/GetProfileList",
    params,
    config,
  );

export const exportProfileListAsync = (
  params: GetProfileListParams,
  fileName: string,
) => {
  return saveFileWithAxios(
    "/api/UserManagement/ExportProfileListAsync",
    fileName,
    params,
  );
};

export const updateProfileActiveAsync = (params: UpdateProfileActiveParams) => {
  return request.get("/api/UserManagement/UpdateProfileActiveAsync", {
    ...params,
  });
};

export const updateProfileIsVIPAsync = (params: UpdateProfileIsVipParams) => {
  return request.get("/api/UserManagement/UpdateProfileIsVIPAsync", {
    ...params,
  });
};

export interface EstablishmentInfoCountDto {
  commercial: number;
  freeZone: number;
  talentAgency: number;
  government: number;
  embassy: number;
  consulate: number;
  culturalClubs: number;
}

export interface ProfileCountDto {
  totalCount: number;
  individuals: number;
  establishment: number;
  establishmentInfo: EstablishmentInfoCountDto;
  approved: number;
  rejected: number;
  pendingReview: number;
  expired: number;
  suspended: number;
  /**
   * Self-Monitor tier count — only Trial/Active profiles (spec: Suspended /
   * Expired / individual / none are Standard). Standard = totalCount - this.
   */
  selfMonitorProfile?: number;
  /** Deprecated for the tier donut; kept for back-compat. */
  vipProfile: number;
}

export const getProfileCount = (config?: AxiosRequestConfig) =>
  request.get<ApiResponse<ProfileCountDto>, ApiResponse<ProfileCountDto>>(
    "/api/UserManagement/GetProfileCount",
    {},
    config,
  );

export interface UserProfileDocInfoDto {
  emiratesIdCopyUrl?: string | null;
  passportCopyUrl?: string | null;
  photoUrl?: string | null;
  acquitanceFormUrl?: string | null;
  iqamaUrl?: string | null;
  academicQualificationUrl?: string | null;
  tradeLicenseCopyUrl?: string | null;
  goodConductUrl?: string | null;
  ageProofUrl?: string | null;
  agreementContractUrl?: string | null;
}

export interface UserProfileAddressInfoDto {
  emirateObj?: UserManagementValueObject | null;
  regionObj?: UserManagementValueObject | null;
  areaObj?: UserManagementValueObject | null;
  streetObj?: UserManagementValueObject | null;
}

export interface PersonalInfo {
  birthDate?: string | null;
  emiratesId?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  nationalityObj?: UserManagementValueObject | null;
  genderObj?: UserManagementValueObject | null;
  occupation?: string | null;
  passportExpiryDate?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  idType?: UserManagementValueObject | null;
  idTypeObj: {
    id: number;
    nameAr: string;
    nameEn: string;
  };
  phoneNumber: string; // Legal Person's Contact Number
  mobileCountryCode?: string | null;
  mobileLocalNumber?: string | null;
  personMobile: string | null;
  personalEmail: string | null;
}

export interface UserProfileInfoDto {
  id: number;
  processingTime?: string;
  applicant?: string | null;
  sla?: UserProfileSlaDto | null;
  userTypeId: number;
  userTypeObj?: UserManagementValueObject | null;
  statusId?: number | null;
  statusObj?: UserManagementValueObject | null;
  personal?: PersonalInfo | null;
  addressInfo?: UserProfileAddressInfoDto | null;
  personDocmentInfo?: UserProfileDocInfoDto | null;
}

export interface EstablishmentInfo {
  workEmail?: string | null;
  establishmentTypeId?: number | null;
  establishmentTypeObj?: UserManagementValueObject | null;
  workMobileNumibe?: string | null; // Note: typo in API response
  licenseNumber?: string | null;
  licenseExpiryDate?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  emirateObj?: UserManagementValueObject | null;
  authorityIdNameEn?: string | null;
  authorityIdNameAr?: string | null;
  licensingAutharityId?: number | null; // Note: typo in API response
  licensingAutharityObj?: UserManagementValueObject | null; // Note: typo in API response
  phoneNumber?: string | null;
  phoneCountryCode?: string | null;
  phoneLocalNumber?: string | null;
  tenancyContractEndDate?: string;
  personalMobile?: string; //phoneNumber
}

export interface EstablishmentDocumentInfo {
  licenseCopyUrl?: string | null;
  tenancyContractCopyUrl?: string | null;
  memorandumOfAssociationCopyUrl?: string | null;
  powerOfAttorneyCopyUrl?: string | null;
  officialLetterUrl?: string | null;
  statementCopyUrl?: string | null;
  frequencyUrl?: string | null;
}

export interface PartnerInfo {
  id: number;
  emiratesId?: string | null;
  uaeNumber?: string | null;
  passportNumber?: string | null;
  fullNameEn?: string | null;
  fullNameAr?: string | null;
  representativeNameEn?: string | null;
  representativeNameAr?: string | null;
  representativeEmiratesId?: string | null;
  photoUrl?: string | null;
  isOwner?: boolean | null;
  partnerTypeCode?: string | null;
  partnerTypeName?: string | null;
  nationalityName?: string | null;
  nationalityIdInfo?: UserManagementValueObject | null;
  partnerTypeCodeInfo?: UserManagementValueObject | null;
  emirateObj?: UserManagementValueObject | null;
}

export interface EstablishmentInfoDto {
  id: number;
  /** Present when API returns it; matches list `ApprovesResponseDto.userTypeId` (5 = commercial). */
  userTypeId?: number;
  processingTime?: string;
  applicant?: string | null;
  sla?: UserProfileSlaDto | null;
  statusId?: number | null;
  statusObj?: UserManagementValueObject | null;
  addressInfo?: UserProfileAddressInfoDto | null;
  legalPersonal?: PersonalInfo | null;
  establishment?: EstablishmentInfo | null;
  documentInfo?: EstablishmentDocumentInfo | null;
  partnerList?: PartnerInfo[] | null;
  /** Self-Monitor marker at the establishment top level (null for none). */
  selfMonitorProgram?: SelfMonitorProgramInfo | null;
}

export interface UserProfileApproveDto {
  statusId: number;
  remark?: string | null;
}

interface userTypeObj {
  id: number;
  nameEn: string;
  nameAr: string;
}

export interface UserProfileSlaDto {
  displayText?: string | null;
  isOverdue?: boolean | null;
}

// Approves
export interface ApprovesResponseDto {
  id: number;
  userTypeId: number;
  userTypeObj: userTypeObj;
  statusId: number;
  statusObj: userTypeObj;
  applyNameEn: string;
  applyNameAr: string;
  createdOn?: string | null;
  updateOn?: string | null;
  applicant: string;
  sla?: UserProfileSlaDto | null;
  profileCode?: string;
}

export interface ApprovesPage {
  pageIndex: number;
  pageSize: number;
  total: number;
  item: ApprovesResponseDto;
}

export const getUserProfiles = (
  params: UserProfilesQueryParams,
  config?: AxiosRequestConfig,
) =>
  request.get<ApprovesPage>(
    "/api/UserManagement/UserProfile/Approves",
    params,
    config,
  );

export const getUserProfilePersonal = (id: number) =>
  request.get<ApiResponse<UserProfileInfoDto>>(
    `/api/UserManagement/UserProfile/${id}/Personal`,
  );

export const getUserProfileEstablishment = (id: number) =>
  request.get<ApiResponse<EstablishmentInfoDto>>(
    `/api/UserManagement/UserProfile/${id}/Establishment`,
  );

export const getUserProfilePartners = (profileId: number, keyWord: string) =>
  request.get<ApiResponse<PartnerInfo[]>>(
    `/api/UserManagement/UserProfile/${profileId}/Partners`,
    { keyWord },
  );

export const getUserProfileUserTypes = () =>
  request.get<ApiResponse<UserManagementValueObject[]>>(
    "/api/UserManagement/UserProfile/UserTypes",
  );

export const getUserProfileStatuses = () =>
  request.get<ApiResponse<UserManagementValueObject[]>>(
    "/api/UserManagement/UserProfile/Status",
  );

export const processUserProfile = (
  id: number,
  payload: UserProfileApproveDto,
) =>
  request.post<ApiResponse<boolean>>(
    `/api/UserManagement/UserProfile/${id}/Process`,
    payload,
  );

export interface UserProfileTypeCountDto {
  total?: number | null;
  individualCount?: number | null;
  commercialCount?: number | null;
  freeZoneCount?: number | null;
  talentAgencyCount?: number | null;
  governmentCount?: number | null;
  embassyCount?: number | null;
  consulateCount?: number | null;
  culturalClubsCount?: number | null;
}

export const getUserProfileTypeCount = () =>
  request.get<ApiResponse<UserProfileTypeCountDto>>(
    "/api/UserManagement/UserProfile/Type/Count",
  );

// -------------------- Admin User Management --------------------

interface AdminMobileFields {
  mobileNumber: string;
  mobileCountryCode: string;
  mobileLocalNumber: string;
}

export interface AddAdminUserPayload extends AdminMobileFields {
  personalPhotoUrl: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: number;
  emiratesId: string;
  occupation: string;
  departmentIds: number[];
  assignRolesIds: string[];
  emirateId: number;
  areaId: number;
  street: string;
  status: boolean;
  password: string;
}

export interface UpdateAdminUserPayload extends AddAdminUserPayload {
  userId: string;
}

export const addAdminUser = (data: AddAdminUserPayload) =>
  request.post("/api/UserManagement/AddAdminUserAsync", data);

export const updateAdminUser = (data: UpdateAdminUserPayload) =>
  request.post("/api/UserManagement/UpdateAdminUserAsync", data);

export interface AdminUserListResponse {
  totalPage?: number;
  currentPage?: number;
  totalItems?: number;
  itemsPerPage?: number;
  totalAmount?: number;
  items: AdminUserRecord[];
}

export const getAdminUserList = (params?: any) =>
  request.get<ApiResponse<AdminUserListResponse>, ApiResponse<AdminUserListResponse>>(
    `/api/UserManagement/GetAdminUserListAsync`,
    {
      ...params,
    },
  );

export const resendAdminDefaultPassword = (userId: string) =>
  request.post(`/api/UserManagement/ResendAdminDefaultPassword/${userId}`);

export const deleteAdminUser = (userId: string) =>
  request.post("/api/UserManagement/DeleteAdminUserAsync", {
    userId,
  });

interface PartnerTypeCodeInfo {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
}

interface NationalityIdInfo {
  id: number;
  code: null | string;
  nameAr: string;
  nameEn: string;
}

interface GenderIdInfo {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
}

export interface IPartnerInfo {
  id: number;
  partnerTypeCode: string;
  partnerTypeCodeInfo: PartnerTypeCodeInfo;
  dateBirth: string;
  emiratesId: string;
  fullNameAr: string;
  fullNameEn: string;
  representativeNameEn: string | null;
  representativeNameAr: string | null;
  representativeEmiratesId: string | null;
  nationalityId: number;
  nationalityIdInfo: NationalityIdInfo;
  genderId: number;
  genderIdInfo: GenderIdInfo;
  expiryDate: string;
  occupation: string;
  personalPhotoUrl: string;
  passportUrl: string;
  visaUrl: string;
  emiratesIdurl: string;
  verificationMethodCode: string;
  uaeNumber: string;
  passportExpiryDate: string;
  visaExpiryDate: string;
  passportNumber: string;
  passportScanUrl: string;
  memorandumOfAssociationUrl: null | string;
  powerOfAttorneyUrl: null | string;
  statementUrl: null | string;
}

export const getPartnerById = (id: number) =>
  request.get<IPartnerInfo>(`/api/User/GetPartnerById/${id}`);

export interface EmirateInfoResponse {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
}
export const getEmirateList = () => {
  return request.get<EmirateInfoResponse[]>(
    "/api/UserManagement/GetEmirateList",
  );
};
export interface RegionInfoResponse {
  id: number;
  nameAr: string;
  nameEn: string;
  code: string;
  emirateId: number;
  emirate: null;
}

function normalizeUserManagementLocationId(id: unknown): number | null {
  if (id === null || id === undefined) return null;
  if (typeof id === "number") return Number.isFinite(id) ? id : null;
  if (typeof id === "string") {
    const t = id.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export const getRegionList = (id?: number | null) => {
  const parentId = normalizeUserManagementLocationId(id);
  if (parentId === null) {
    return Promise.resolve({ data: [] as RegionInfoResponse[] });
  }
  return request.get<RegionInfoResponse[]>(
    `/api/UserManagement/GetRegionList/${parentId}`,
  );
};
export interface AreaInfoResponse {
  id: number;
  nameAr: string;
  nameEn: string;
  regionId: number;
  code: string;
  isShown: boolean;
}
export const getAreaList = (id?: number | null) => {
  const parentId = normalizeUserManagementLocationId(id);
  if (parentId === null) {
    return Promise.resolve({ data: [] as AreaInfoResponse[] });
  }
  return request.get<AreaInfoResponse[]>(
    `/api/UserManagement/GetAreaList/${parentId}`,
  );
};
interface GenderInfo {
  code: string | null;
  name: string | null;
}

export interface AdminUserDepartmentInfo {
  id: number;
  name: string;
  isLeader?: boolean;
}

export interface AdminUserAssignRolesInfo {
  id: string;
  name: string;
}

interface EmirateInfo {
  code: string;
  name: string;
}

interface RegionInfo {
  code: string;
  name: string;
}

interface AreaInfo {
  code: string;
  name: string;
}

interface StatusInfo {
  code: string;
  name: string;
}

interface AdminUserLinkedInfo {
  code: string;
  name: string;
}

export interface AdminUserRecord {
  userId: string;
  personalPhotoUrl: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: number | null;
  genderInfo: GenderInfo | null;
  dateOfBirth: string | null;
  emiratesId: string | null;
  mobileNumber: string;
  mobileCountryCode?: string | null;
  mobileLocalNumber?: string | null;
  occupation: string;
  isLeader?: boolean;
  departmentIds: number[];
  departmentsInfo: AdminUserDepartmentInfo[];
  assignRolesIds: string[];
  assignRolesIdsInfo: AdminUserAssignRolesInfo[];
  emirateId: number;
  emirateInfo: EmirateInfo;
  regionId: number;
  regionInfo: RegionInfo;
  areaId: number;
  areaInfo: AreaInfo;
  street: string;
  status: string;
  statusInfo: StatusInfo;
  adminUserLinked: string;
  adminUserLinkedInfo: AdminUserLinkedInfo[];
  password: string | null;
  isChangePwd?: boolean;
  createOn: string | null;
  lastLoginTime: string | null;
}
export interface IGetAdminUserAsyncResposne extends AdminUserRecord {}
type GetAdminUserAsyncResponse = ApiResponse<IGetAdminUserAsyncResposne>;

export const getAdminUserAsync = (id: string) => {
  const userId = id.trim();
  return request.get<GetAdminUserAsyncResponse, GetAdminUserAsyncResponse>(
    `/api/UserManagement/GetAdminUserAsync?userId=${encodeURIComponent(
      userId,
    )}`,
  );
};
interface IUpdateAdminUserRequest {
  userId: string;
  emirateId: number | null;
  regionId: number | null;
  areaId: number | null;
  street: string;
  personalPhotoUrl: string;
  mobileNumber: string;
  mobileCountryCode: string;
  mobileLocalNumber: string;
}
export const postUpdateAdminUserCenterAsync = (
  data: IUpdateAdminUserRequest,
) => {
  return request.post("/api/UserManagement/UpdateAdminUserCenterAsync", data);
};

export const updateAdminPassWordAsync = (pwd: string) =>
  request.post<ApiResponse<unknown>, ApiResponse<unknown>>(
    `/api/UserManagement/UpdateAdminPassWord`,
    { pwd },
  );

export interface SetAdminUserLeaderPayload {
  UserId: string;
  DepartmentId: number;
}
export const SetAdminUserLeaderAsync = (data: SetAdminUserLeaderPayload) =>
  request.post<ApiResponse<unknown>, ApiResponse<unknown>>(
    `/api/UserManagement/SetAdminUserLeaderAsync`,
    data,
  );

export interface ProfileTierDictionaryItem {
  id: number;
  code: string;
  scope: string;
  nameEn: string;
  nameAr: string;
  isShown: boolean;
  descAr: string | null;
  descEn: string | null;
}

export const getTypeDictionariesProfileTiers = () => {
  return request.get<ProfileTierDictionaryItem[]>(
    "/api/TypeDictionary/GetTypeDictionaries/ProfileTiers",
  );
};
  
