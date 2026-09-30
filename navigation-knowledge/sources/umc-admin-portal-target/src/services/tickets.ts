import request from "@/utils/request";
import saveFileWithAxios from "@/utils/saveFileWithAxios";
import moment from "moment";
import {
  getRolesGroupedByDepartmentId,
  type RoleByDepartmentGroupDto,
} from "@/services/roles";

export const getEnquiryStatusCount = (isTeamTask: boolean) => {
  return request.get("/api/Enquiry/Management/Status/Count?isTeamTask=" + isTeamTask);
};

export interface IEnquiryListRequest{
  EnquiryStatusId: number | string;
  SearchKey: string;
  EnquiryNumber: string;
  StartTime: string;
  EndTime: string;
  PriorityId: number;
  EnquiryType: number;
  IsEnquiryComplete: boolean;
  PageSize: number;
  PageIndex: number;
  SortBy: string;
  SortDirection: number;
}
interface EnquiryTypeObj {
  id: number;
  nameEn: string;
  nameAr: string;
}

interface ServiceObj {
  id: number;
  nameEn: string;
  nameAr: string;
}

interface EnquiryStatusObj {
  id: number;
  nameEn: string;
  nameAr: string;
}

interface EnquiryConversations {
  messageContent: string;
  attachements: string[];
  userName: string;
  userId: string;
  submissionTime: string;
}

interface EnquiryService {
  enquiryId: number;
  enquiryNumber: string;
  enquiryStatusId: number;
  createdOn: string;
  enquiryStatusObj: EnquiryStatusObj;
  serviceId: number;
  serviceObj: ServiceObj;
}

interface EnquiryHistor {
  number: number;
  reopenReason: string;
  createdOn: string;
}

export interface IEnquiryListItem {
  id: number;
  enquiryNumber: string;
  applicationNo: string;
  enquiryTypeId: number;
  priorityId: number;
  enquirySourceId: number;
  serviceId: number;
  createdOn: string;
  enquiryStatusId: number;
  attachmentUrl: string;
  reopenTimes: number;
  isVip: boolean;
  isOverDue: boolean;
  description: string;
  custormer: string;
  sla: string;
  slaEndTime?: string | null;
  currentHander: string;
  enquirySoruceObj: any;
  departmentEnquiryObj: {
    id: number;
    nameEn: string;
    nameAr: string;
  };
  curstomerUserObj: {
    userTypeId: number;
  }
  enquiryTypeObj: EnquiryTypeObj;
  serviceObj: ServiceObj;
  enquiryStatusObj: EnquiryStatusObj;
  enquiryConversations: EnquiryConversations[];
  enquiryServices: EnquiryService[];
  enquiryHistors: EnquiryHistor[];
  attachmentUrls: string[];
  agnetname: string;
  isCurrentHandler?: boolean | null;
}
export interface IEnquiryListResponse {
    pageSize: number;
    pageIndex: number;
    total: number;
    items: Array<IEnquiryListItem>;
}
export const getEnquiryList = (params: Partial<IEnquiryListRequest>) => {
    return request.get<IEnquiryListResponse>("/api/Enquiry/Management/List", params);
}

export interface AccountTicketsParams {
  UserId?: string;
  UserProfileId?: number;
  SearchKey?: string;
  EnquiryNumber?: string;
  StartTime?: string;
  EndTime?: string;
  EnquiryType?: number;
  IssueCategoryId?: number;
  PriorityId?: number;
  EnquiryStatusId?: string;
  PageSize: number;
  PageIndex: number;
  SortBy?: string;
  SortDirection?: number;
}

export interface AccountTicketDictionaryDto {
  id?: number | null;
  nameEn?: string | null;
  nameAr?: string | null;
}

export interface AccountTicketsItemDto {
  id?: number | null;
  enquiryNumber?: string | null;
  applicationNo?: string | null;
  enquiryTypeId?: number | null;
  enquirySourceId?: number | null;
  serviceId?: number | null;
  createdOn?: string | null;
  enquiryStatusId?: number | null;
  attachmentUrl?: string | null;
  reopenTimes?: number | null;
  description?: string | null;
  custormer?: string | null;
  sla?: string | null;
  slaEndTime?: string | null;
  currentHander?: string | null;
  agnetname?: string | null;
  issueCategoryId?: number | null;
  updatedOn?: string | null;
  priorityId?: number | null;
  userProfileId?: number | null;
  userId?: string | null;
  departmenId?: number | null;
  enquiryTypeObj?: AccountTicketDictionaryDto | null;
  serviceObj?: AccountTicketDictionaryDto | null;
  enquiryStatusObj?: AccountTicketDictionaryDto | null;
  enquirySoruceObj?: AccountTicketDictionaryDto | null;
  issueCategoryObj?: AccountTicketDictionaryDto | null;
  departmentEnquiryObj?: AccountTicketDictionaryDto | null;
  priorityObj?: AccountTicketDictionaryDto | null;
  curstomerUserObj?: {
    enquiryId?: number | null;
    nameEn?: string | null;
    nameAr?: string | null;
    userTypeId?: number | null;
    userTypeCode?: string | null;
    userProfileId?: number | null;
    userId?: string | null;
    isVip?: boolean | null;
  } | null;
}

export interface AccountTicketsResponseDto {
  pageIndex?: number | null;
  pageSize?: number | null;
  total?: number | null;
  totalCount?: number | null;
  items?: AccountTicketsItemDto[] | null;
}

export const getAccountTickets = (params: AccountTicketsParams) => {
  return request.get<AccountTicketsResponseDto>(
    "/api/Enquiry/Management/Account/Tickets",
    params
  );
};

export interface TicketsStatusCountParams {
  _userId?: string;
  _profileId?: number;
}

export interface TicketsStatusCountDto {
  openCount?: number | null;
  pendingCustormer?: number | null;
  departmentProcessingCount?: number | null;
  departmentProcessedCount?: number | null;
  resolvedCount?: number | null;
  completedCount?: number | null;
  cancelledCount?: number | null;
  totalCount?: number | null;
  reopentCount?: number | null;
}

export const getTicketsStatusCount = (params: TicketsStatusCountParams) => {
  return request.get<TicketsStatusCountDto>(
    "/api/Enquiry/Management/Account/Tickets/StatusCount",
    params
  );
};

export interface EnquiryDictionaryItemDto {
  id: number;
  nameEn: string;
  nameAr: string;
}

export const getEnquiryStatusOptions = () => {
  return request.get<any>("/api/Enquiry/EnquiryStatus");
};

export const getEnquiryIssueCategoryOptions = () => {
  return request.get<any>("/api/Enquiry/EnquiryIssueCategory");
};

export const getEnquiryTypeOptions = () => {
  return request.get<any>("/api/Enquiry/EnquiryTypes");
};

export interface IEnquiryStatus{
  id: number;
  nameEn: string;
  nameAr: string;
}
export const getEnquiryStatus = () => {
  return request.get<IEnquiryStatus[]>("/api/Enquiry/Management/EnquiryStatus");
}

export interface IEnquiryType{
  id: number;
  nameEn: string;
  nameAr: string;
}
export const getEnquiryType = () => {
  return request.get<IEnquiryType[]>("/api/Enquiry/EnquiryTypes");
}

let cachedEnquiryTypes: IEnquiryType[] | null = null;
let pendingEnquiryTypesRequest: Promise<IEnquiryType[]> | null = null;

export const getCachedEnquiryTypes = async () => {
  if (cachedEnquiryTypes) {
    return cachedEnquiryTypes;
  }

  if (!pendingEnquiryTypesRequest) {
    pendingEnquiryTypesRequest = getEnquiryType()
      .then((res) => {
        const enquiryTypes = Array.isArray(res?.data) ? res.data : [];
        cachedEnquiryTypes = enquiryTypes;
        return enquiryTypes;
      })
      .catch((error) => {
        cachedEnquiryTypes = null;
        throw error;
      })
      .finally(() => {
        pendingEnquiryTypesRequest = null;
      });
  }

  return pendingEnquiryTypesRequest;
}

interface EnquiryTypeObj {
  id: number;
  nameEn: string;
  nameAr: string;
}

interface ServiceObj {
  id: number;
  nameEn: string;
  nameAr: string;
}

interface EnquirySoruceObj {
  id: number;
  nameEn: string;
  nameAr: string;
}

interface IssueCategoryObj {
  id: number;
  nameEn: string;
  nameAr: string;
}

export interface EnquiryConversation {
  messageContent: string;
  attachements: string[];
  userName: string;
  userId: string;
  submissionTime: string;
  userTypeId: number;
  userProfileId: number;
  isCurrentUserProfile: boolean;
  photoUrl: string;
  surceTypeId: number;
  departmentDeadLine: string;
  departmentInfoObj: {
    id: number;
    nameAr: string;
    nameEn: string;
  };
  transferDepartmentInfoObj: {
    id: number;
    nameAr: string;
    nameEn: string;
  };
}

interface EnquiryService {
  enquiryId: number;
  enquiryNumber: string;
  enquiryStatusId: number;
  createdOn: string;
  enquiryStatusObj: EnquiryStatusObj;
  serviceId: number;
  serviceObj: ServiceObj;
}

interface CurstomerUserObj{
  enquiryId: number | null;
  nameEn: string;
  nameAr: string | null;
  userTypeId: number;
  userTypeCode: string;
  userProfileId: number;
  userId: string;
  isUmc: boolean;
}

export interface IEnquiryCustomerInfo {
  id?: number | string | null;
  fullName?: string | null;
  email?: string | null;
  mobileNumber?: string | null;
  mobileCountryCode?: string | null;
  mobileLocalNumber?: string | null;
  userTypeCode?: string | null;
}

interface platformObj{
  nameEn?:string;
}
export interface IEnquiryInfoResponse {
  enquiryTypeObj: EnquiryTypeObj;
  serviceObj: ServiceObj;
  enquiryStatusObj: EnquiryStatusObj;
  enquirySoruceObj: EnquirySoruceObj;
  issueCategoryObj: IssueCategoryObj;
  priorityObj: any;
  updatedOn: string;
  enquiryConversations: EnquiryConversation[];
  enquiryServices: EnquiryService[];
  attachmentUrls: string[];
  id: number;
  enquiryNumber: string;
  applicationNo: string;
  enquiryTypeId: number;
  enquirySourceId: number;
  serviceId: number;
  createdOn: string;
  enquiryStatusId: number;
  attachmentUrl: string | null;
  reopenTimes: number | null;
  description: string;
  custormer: string | null;
  sla: string | null;
  isOverDue: boolean | null;
  isCanMessage?: boolean | null;
  canAddInternalNote?: boolean | null;
  slaEndTime?: string | null;
  currentHander: string | null;
  isCurrentHandler?: boolean | null;
  issueCategoryId: number;
  userProfileId: number;
  userId: string;
  appUserProfileId?: number | string | null;
  enquiryCustomerInfo?: IEnquiryCustomerInfo | null;
  curstomerUserObj: CurstomerUserObj;
  priorityId?: number;
  platformObj:platformObj;
  platform?:string;
}
export const getEnquiryInfo = (id: string) => {
  return request.get<IEnquiryInfoResponse>(`/api/Enquiry/Management/${id}/EnquiryInfo`);
}

export interface IEnquirySourceResponse {
  id: number;
  nameEn: string;
  nameAr: string;
}

export const getEnquirySource = () => {
  return request.get<IEnquirySourceResponse[]>("/api/Enquiry/EnquirySource");
}
interface EnquiryTypeObj {
  id: number;
  nameEn: string;
  nameAr: string;
}

interface ServiceObj {
  id: number;
  nameEn: string;
  nameAr: string;
}

interface EnquiryStatusObj {
  id: number;
  nameEn: string;
  nameAr: string;
}

interface EnquirySoruceObj {
  id: number;
  nameEn: string;
  nameAr: string;
}

interface EnquiryService {
  enquiryId: number;
  enquiryNumber: string;
  enquiryStatusId: number;
  createdOn: string;
  enquiryStatusObj: EnquiryStatusObj;
  serviceId: number;
  serviceObj: ServiceObj;
}
export interface ITeamTaskListItem{
  id: number;
  enquiryNumber: string;
  applicationNo: string;
  enquiryTypeId: number;
  enquirySourceId: number;
  serviceId: number;
  createdOn: string;
  enquiryStatusId: number;
  attachmentUrl: string;
  reopenTimes: number;
  description: string;
  custormer: string;
  sla: string;
  isOverDue: boolean;
  currentHander: string;
  enquiryTypeObj: EnquiryTypeObj;
  serviceObj: ServiceObj;
  enquiryStatusObj: EnquiryStatusObj;
  enquirySoruceObj: EnquirySoruceObj;
  enquiryConversations: EnquiryConversation[];
  enquiryServices: EnquiryService[];
  attachmentUrls: string[];
  priorityId?: number | null;
  slaEndTime?: string | null;
  messageCount?: number | string | null;
  canChangeStatus?: boolean | null;
  isCanMessage?: boolean | null;
  isCurrentHandler?: boolean | null;
}
interface ITeamTaskListResponse {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: ITeamTaskListItem[];
}

export interface ITeamTaskListRequest{
  SearchKey: string;
  EnquiryNumber: string;
  StartTime: string | null;
  EndTime: string | null;
  EnquiryType: number;
  PriorityId: number;
  EnquirySourceId: number;
  EnquiryStatusId: number | string | null;
  IsEnquiryComplete: boolean;
  PageSize: number;
  PageIndex: number;
  SortBy: string;
  SortDirection: number;
}
export const getTeamTaskList = (params: Partial<ITeamTaskListRequest>) => {
  return request.get<ITeamTaskListResponse>(`/api/Enquiry/Management/TeamTask/List`, params);
}

export const exportTeamTaskList = (params: Partial<ITeamTaskListRequest>) => {
  return saveFileWithAxios(
    "/api/Enquiry/Management/TeamTask/List/Export",
    "Tickets-TeamTasks-" + moment().format("DDMMYYYY-HHmmss") + ".csv",
    params,
  );
}
interface ChangeStatusObj {
  id: number;
  nameEn: string | null;
  nameAr: string | null;
  statusName: string | null;
}

export interface ITimelineResponse {
  enquiryId: number;
  toStatusId: number;
  changeStatusObj: ChangeStatusObj;
  reason: string | null;
  createdUerName: string;
  handlUserName: string;
  enqiryProcessInfo: any;
  departmentName: string;
  changeOnTime: string;
  handleDes: string;
}
export const getTimeline = (id: number) => {
  return request.get<ITimelineResponse[]>(`/api/Enquiry/Management/${id}/Timeline`);
}
export interface IEnquiryStatusRequest {
  enquiryId: number;
  enquiryStatusId: number;
  reason?: string;
}
export const putEnquiryStatus = (data: IEnquiryStatusRequest) => {
  return request.put(`api/Enquiry/Status`, data);
}
export interface IApplicationsResponse{
  applicationDetailId: number;
  applicaitonId: number;
  serviceId: number;
  applicationNumber: string;
}
export interface IGetApplicationsParams {
  applicatinNo?: string;
}
export const getApplications = (params: IGetApplicationsParams = {}) => {
  return request.get<IApplicationsResponse[]>(
    "/api/Enquiry/Management/Applications",
    params,
  );
}
export interface IEnquiryIssueCategoryResponse{
  id: number;
  nameEn: string;
  nameAr: string;
}
export const getEnquiryIssueCategory = () => {
  return request.get<IEnquiryIssueCategoryResponse[]>("/api/Enquiry/EnquiryIssueCategory");
}
interface IEnquiryNewRequest{
  enquiryTypeId: number;
  enquirySourceId: number;
  enquiryIssueCategoryId: number;
  description: string;
  attachmentUrls: string[];
  applicationDetailId: number;
  serviceId: number;
  userTypeCode: string;
  fullName: string;
  fullNameAr: string;
  email: string;
  mobileNumber: string;
  mobileCountryCode: string;
  mobileLocalNumber: string;
}
export const postEnquiryNew = (data: Partial<IEnquiryNewRequest>) => {
  return request.post(`/api/Enquiry/Management/New`, data);
}
export interface IConversationRequest{
  sourceTypeId: 2 | 4;
  messageContent: string;
  attachments: string[];
}
export const postConversation = (enquiryId:number, data: IConversationRequest) => {
  return request.post(`/api/Enquiry/Management/${enquiryId}/Conversation`, data);
}

export interface IDepartmentResponse{
  id: number;
  nameEn: string;
  nameAr: string;
}
export const getDepartments = () => {
  return request.get<IDepartmentResponse[]>('/api/Enquiry/Management/Departments');
}
export type IDepartmentRoleGroupResponse = RoleByDepartmentGroupDto;
export const getDepartmentsAndRoles = () => {
  return getRolesGroupedByDepartmentId([1, 2, 6]);
}

interface ICustomerTransferRequest{
  enquiryStatusId: number;
  departmentId?: number;
  roleId?: string;
  deadLine: string;
  note: string;
}
export const postCustomerTransfer = (enquiryId: number, data: ICustomerTransferRequest) => {
  return request.post(`/api/Enquiry/Management/${enquiryId}/ChangeStatus`, data);
}
export interface IProcessedTransferRequest{
  enquiryStatusId: number;
  note: string;
  attachmentUrls?: string[];
}
export const postProcessedTransfer = (enquiryId: number, data: IProcessedTransferRequest) => {
  return request.post(`/api/Enquiry/Management/${enquiryId}/ProcessedTransfer`, data);
}
export interface IUserInfoResponse{
  userId: string;
  isLeader: boolean;
  isCustomerHappness: boolean;
}
export const getUserInfo = () => {
  return request.get<IUserInfoResponse>('/api/Enquiry/Management/UserInfo');
}
interface IAssignsResponse{
  userId: string;
  nameEn: string;
  nameAr: string;
}
export const getAssigns = () => {
  return request.get<IAssignsResponse[]>('/api/Enquiry/Management/GetAssigns');
}

export const putAssign = (id: number, data: { userId: string }) => {
  return request.put(`/api/Enquiry/Management/${id}/Assign`, data);
}
interface ITaskTypeRequest{
  applicationNo: string;
}
interface ITaskTypeResponse{
  applicationId: number;
  applicationDetailId: number;
  applicationNumber: string;
  taskId: string;
  serviceId: number;
  departmentId: number;
}
export const getTaskType = (
  data: ITaskTypeRequest,
  config: { skipErrorMessage?: boolean } = {},
) => {
  return request.get<ITaskTypeResponse>(
    '/api/Enquiry/Management/Application/Task',
    data,
    config,
  );
}
interface ITeamMenberRequest{
  Keyword: string | null;
  MemberId: string | null;
  StartTime: string | null;
  EndTime: string | null;
}
export interface ITeamMenberResponse{
  userId: string;
  userName: string;
  totalTaskCount: number;
  completedTaskCount: number;
  maxWorkTaskCount: number;
  workload: string;
  avgDuration: number;
  avgDurationDescription: string;
  sla: number;
  overdueCount: number;
  isLeave: boolean | null;
  leaveTypeNameAr: string | null;
  leaveTypeNameEn: string | null;
  briefDescription: string | null;
  expectedReturnDate: string | null;
  leaveCreatedOn: string | null;
}
export function getTeamMenber(data: ITeamMenberRequest){
  return request.get<ITeamMenberResponse[]>('/api/Enquiry/Management/TeamMenber/TeamTask', data)
}

export function postEnquiryListExport(params: Partial<IEnquiryListRequest>){
  return saveFileWithAxios("/api/Enquiry/Management/List/Export", 'Tickets-MyTasks-' + moment().format('DDMMYYYY-HHmmss') + '.csv', params);
}
interface EnquiryStatus {
  id: number;
  nameEn: string;
  nameAr: string;
}

interface Service {
  id: number;
  nameEn: string;
  nameAr: string;
}

export interface IRelateApplicationItem {
  id?: number;
  applicationId?: number;
  applicationDetailId?: number;
  applicationNumber?: string | null;
  applicationNo?: string | null;
  number?: string | null;
  createdOn?: string | null;
  submissionTime?: string | null;
  taskCreatedTime?: string | null;
  description?: string | null;
  applicationStatusId?: number | null;
  statusId?: number | null;
  status?: string | null;
  applicationStatusName?: string | null;
  applicationStatusObj?: EnquiryStatus | null;
  statusObj?: EnquiryStatus | null;
  serviceId?: number | null;
  serviceName?: string | null;
  serviceNameEn?: string | null;
  serviceNameAr?: string | null;
  serviceObj?: Service | null;
  applyFor?: string | null;
  applyForEn?: string | null;
  applyForAr?: string | null;
}

export interface IRelateEnquiryServiceItem {
  enquiryId?: number;
  enquiryNumber?: string | null;
  enquiryStatusId?: number | null;
  createdOn?: string | null;
  enquiryStatusObj?: EnquiryStatus | null;
  serviceId?: number | null;
  serviceObj?: Service | null;
  description?: string | null;
}

export interface IRelateRefundItem {
  id?: number;
  number?: string | null;
  createdOn?: string | null;
  statusObj?: EnquiryStatus | null;
  enquiryStatusObj?: EnquiryStatus | null;
  serviceId?: number | null;
  serviceObj?: Service | null;
  description?: string | null;
}

export interface IRelateAppealItem {
  id?: number;
  number?: string | null;
  createdOn?: string | null;
  statusObj?: EnquiryStatus | null;
  enquiryStatusObj?: EnquiryStatus | null;
  serviceId?: number | null;
  serviceObj?: Service | null;
  description?: string | null;
}

export interface IRelateAppsResponse {
  profileId?: number | null;
  userTypeId?: number | null;
  type?: string | number | null;
  enquiryServiceCount?: number | null;
  refundCount?: number | null;
  appealCount?: number | null;
  applicationCount?: number | null;
  applications?: IRelateApplicationItem[] | null;
  enquiryServices?: IRelateEnquiryServiceItem[] | null;
  refunds?: IRelateRefundItem[] | null;
  appeals?: IRelateAppealItem[] | null;
}
export const getRelateApps = (id: number) => {
  return request.get<IRelateAppsResponse>(`/api/Enquiry/Management/EnquiryInfo/${id}/Relate`)
} 
interface Nationality {
  id: number;
  nameEn: string;
  nameAr: string;
}

export interface IApplicantsResponse {
  enquiryId: number;
  createdBy: string;
  userProfileId: number;
  userTypeId: number;
  userId: string;
  email: string;
  userName: string;
  potoUrl: string;
  personalName: string;
  personalNameAr: string;
  personalEmail: string;
  personalPhoneNumber: string;
  nationalityId: number;
  nationalityObj: Nationality;
  isUmc: boolean;
  phoneNumber: string;
  phoneCountryCode?: string | null;
  phoneLocalNumber?: string | null;
  emiratesId: string;
  documentCount: number;
}
export const getApplicants = (enquiryId: number) => {
  return request.get<IApplicantsResponse>(`/api/Enquiry/Management/EnquiryInfo/${enquiryId}/Applicants`);
}

// /api/Enquiry/PriorityType
export interface IPriorityTypeResponse {
  id: number;
  nameEn: string;
  nameAr: string;
}
export const getPriorityTypes = () => {
  return request.get<IPriorityTypeResponse[]>('/api/Enquiry/PriorityType');
}

//http://192.168.2.24:5003/api/Enquiry/ProblemCauses
export interface IProblemCauseResponse {
  id: number;
  nameEn: string;
  nameAr: string;
}
export const getProblemCauses = () => {
  return request.get<IProblemCauseResponse[]>('/api/Enquiry/ProblemCauses');
}

/**
 * @url /api/Enquiry/Management/{enquiryId}/Process  
 *   process   departmentProcessTypeId = 1
 *   sendback  departmentProcessTypeId = 2
 */
export const postProcess = (enquiryId: number, data: any,) => {
  return request.post(`/api/Enquiry/Management/${enquiryId}/Process`, data);
}


// /api/TypeDictionary/GetTypeDictionaries/Establishmentinformation
export interface IEstablishmentinformationResponse {
  id: number;
  nameEn: string;
  nameAr: string;
  code?: string;
}
export const getEstablishmentinformation = () => {
  return request.get<IEstablishmentinformationResponse[]>('/api/serviceInfo/GetAllUserType');
}
