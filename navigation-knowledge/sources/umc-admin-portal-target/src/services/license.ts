import request from '@/utils/request';
import saveFileWithAxios from '@/utils/saveFileWithAxios';

export interface LicenseManagementListRequestDto {
  pageIndex: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: number;
  keyword?: string;
  status?: string;
  licenseType?: string;
  issuanceDateStart?: string | null;
  issuanceDateEnd?: string | null;
  expirationDateStart?: string | null;
  expirationDateEnd?: string | null;
  userId?: string;
  profileId?: number;
  department?: number;
}
export interface LicenseManagementListResponseDto {
  /** Media activity names, already localized and ", "-joined by the backend. */
  mediaActivity?: string;
  id: number;
  applicationNumber: string;
  /** Certificate number. Operational key - keep passing this one to the APIs. */
  licenseNumber: string;
  /**
   * Number to render in the License No. column: the media license number when the license owns a
   * media-license shell, otherwise the certificate number. Display only.
   */
  showLicenseNumber?: string;
  /** Media license number, absent for rows without a media-license shell (permits). */
  mediaLicenseNumber?: string | null;
  licenseType: string;
  licenseTypeAr: string;
  title?: string | null;
  authorOrPublishingHouse?: string | null;
  applicant: string;
  applicantType: string;
  issuanceTime: string | null;
  expirationTime: string | null;
  status: string;
  daysRemaining: number | null;
  certificateUrl: string;
  certificatePassword: string;
  disabledReason: string;
  remarks: string;
}

export interface PageLicenseList {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: LicenseManagementListResponseDto[];
}


export interface StatisticsResponseDto {
  total: number;
  active: number;
  expireSoon?: number;
  expired: number;
  cancelled: number;
  disabled: number;
} 

// /api/LicenseManagement/list
export const getLicenseManagementList = (data: LicenseManagementListRequestDto) => {
  return request.post<PageLicenseList>(`/api/LicenseManagement/list`, data);
};


// /api/LicenseManagement/statistics
export const getStatistics = (
  userId?: string,
  profileId?: number,
  departmentId?: number,
) => {
  return request.get<StatisticsResponseDto>(
    "/api/LicenseManagement/statistics",
    { userId, profileId, departmentId },
  );
};


// /api/LicenseManagement/{id}
interface Holder {
  type: string;
  id: number;
  nameEn: string;
  nameAr: string;
  email: string;
  mobile: null | string;
  emiratesId: string;
  commercialLicenseNumber: null | string;
}

interface ApplicationHistory {
  applicationNumber: string;
  serviceName: string;
  serviceNameAr?: string;
  serviceNameEn?: string;
  type: string;
  typeAr?: string;
  typeEn?: string;
  submissionTime: string;
}

export interface LicenseDetail {
  id: number;
  applicationNumber: string;
  /** Certificate number. Operational key. */
  licenseNumber: string;
  /** Number to display - media license number when there is one, otherwise the certificate number. */
  showLicenseNumber?: string;
  /** Media license number, absent when the license has no media-license shell. */
  mediaLicenseNumber?: string | null;
  licenseType: string;
  licenseTypeAr: string;
  issuanceDate: string;
  effectiveDate: string;
  expiryDate: string | null;
  daysRemaining: number | null;
  status: string;
  yearsOfLicense: null | number;
  certificateUrl: string;
  certificateWithHeaderUrl: string;
  holder: Holder;
  establishment: null | any;
  serviceFees: any[];
  economicActivities: any[];
  /** Portal account id for GetUserIndividual / overview tabs (when returned by API). */
  userId?: string;
  /** When distinct from profileId (aligns with application detail payloads). */
  userProfileId?: number;
  profileId: number;
  userTypeId: number;
  userTypeNameEn: string;
  userTypeNameAr: string;
  userTypeCode: string;
  applicationHistory: ApplicationHistory[];
  certificatePassword: string;
}
export const getLicenseManagementDetails = (id:string) => {
  return request.get<LicenseDetail>(`/api/LicenseManagement/${id}`)
}
export interface UpdateCertificateStatusRequest {
  certificateId: number;
  status: string;
  disabledReason?: string;
  remarks?: string;
}
export const postUpdateCertificateStatus = (data: UpdateCertificateStatusRequest) => {
  return request.post(`/api/LicenseManagement/UpdateCertificateStatus`, data)
}

// /api/UserManagement/UserProfile/{id}/Personal

export const getPersonalInfo = (id:string) => {
  return request.get(`/api/UserManagement/UserProfile/${id}/Personal`)
}

// /api/UserManagement/UserProfile/${id}/Establishment

export const getEstablishmentlInfo = (id:string) => {
  return request.get(`/api/UserManagement/UserProfile/${id}/Establishment`)
}

export const getUserProfileExport = (
  params: any,
  fileName: string,
  paramsSerializer?: (params: any) => string,
) => {
  return saveFileWithAxios(
    "/api/UserManagement/UserProfile/Approves/Export",
    fileName,
    params,
    "get",
    paramsSerializer ? { paramsSerializer } : {},
  );
}

export const exportLicensePermits = (data: LicenseManagementListRequestDto) => {
  return request.post("/api/LicenseManagement/ExportLicensePermits", data);
}
