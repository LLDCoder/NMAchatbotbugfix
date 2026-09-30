import request from "@/utils/request";
import saveFileWithAxios from "@/utils/saveFileWithAxios";

export interface ICustomerUser {
  userId: string;
  customerNo: string;
  userName: string;
  userNameAr: string | null;
  email: string;
  phone: string;
  profileCount: number;
  status: boolean;
  statusName: string;
  registeredTime: string;
}

export interface ICustomerListResponse {
  totalPage: number;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  totalAmount: number;
  items: ICustomerUser[];
}

export interface ICustomerCountResponse {
  totalCount: number;
  activeCount: number;
  suspended: number;
  multiProfileAccounts: number;
  newInLast7Days: number;
}

export interface ILoginMethodDictionary {
  id: number;
  code: string;
  scope: string;
  nameEn: string;
  nameAr: string;
  isShown: boolean;
  descAr: string | null;
  descEn: string | null;
}

export interface IGetCustomerUsersParams {
  PageIndex?: number;
  PageSize?: number;
  KeyWorld?: string;
  StatrTime?: string;
  EndTime?: string;
  Status?: boolean;
  sort?: number;
  LoginMethod?: string;
}

export interface IUpdateCustomerStatusParams {
  userId: string;
  isActive: boolean;
  reson?: string;
}

export interface ISendCustomerEmailParams {
  userId: string;
  subject: string;
  body: string;
}

export interface SendCustomerSmsRequest {
  userId: string;
  message: string;
}

export interface SendExternalSmsRequest {
  countryCode: string;
  mobileNumber: string;
  message: string;
}

export interface IImpersonateCustomerParams {
  userId: string;
}

export interface IImpersonateCustomerResponse {
  code: string;
  expiresInSeconds: number;
}

export interface ICustomerActionResponse<T> {
  isSuccess?: boolean;
  statusCode?: number;
  message?: string | null;
  data: T;
}

export interface CustomerProfileViolationListParams {
  userId?: string;
  profileId?: number;
  keyword?: string;
  startTime?: string;
  endTime?: string;
  violationTypeId?: number;
  statusId?: number;
  taskId?: number;
  approvalTimeFrom?: string;
  approvalTimeTo?: string;
  paidTimeFrom?: string;
  paidTimeTo?: string;
}

export interface CustomerProfileViolationItem {
  violationId?: number | string | null;
  violationNo?: string | null;
  violatorName?: string | null;
  violationTypeId?: number | string | null;
  violationTypeName?: string | null;
  fineAmount?: number | string | null;
  beforeAppealAdjustedFineAmount?: number | string | null;
  statusId?: number | string | null;
  statusName?: string | null;
  sourceTaskId?: number | string | null;
  sourceTaskNo?: string | null;
  reportedByUserId?: string | null;
  reportedByName?: string | null;
  createdOn?: string | null;
  paidTime?: string | null;
  paidOn?: string | null;
  paymentTime?: string | null;
}

export interface CustomerProfileViolationStatusStat {
  statusId?: number | string | null;
  statusName?: string | null;
  count?: number | string | null;
}

export interface CustomerProfileViolationListResponse {
  total?: number | string | null;
  items?: CustomerProfileViolationItem[] | null;
  statuses?: CustomerProfileViolationStatusStat[] | null;
}

export const exportCustomerUsersAsync = (params: IGetCustomerUsersParams, fileName: string) => {
  return saveFileWithAxios("/api/UserManagement/ExportCustomerUsersAsync", fileName, params);
};

export const getCustomerUsers = (params: IGetCustomerUsersParams) => {
  return request.get("/api/UserManagement/GetCustomerUsersAsync", {
    ...params,
  });
};

export const getCustomerInfoCount = () => {
  return request.get("/api/UserManagement/GetCustomerInfoCountDto");
};

export const updateCustomerUserActive = (
  params: IUpdateCustomerStatusParams
) => {
  return request.get("/api/UserManagement/UpdateCustomerUserActiveAsync", {
    ...params,
  });
};

export const sendCustomerEmail = (params: ISendCustomerEmailParams) => {
  return request.post<
    ICustomerActionResponse<boolean>,
    ICustomerActionResponse<boolean>
  >("/api/UserManagement/CustomerUser/SendEmail", params);
};

export const SendSMS = (params: SendCustomerSmsRequest) => {
  return request.post<
    ICustomerActionResponse<boolean>,
    ICustomerActionResponse<boolean>
  >("/api/UserManagement/CustomerUser/SendSMS", params);
};

export const SendExternalSMS = (params: SendExternalSmsRequest) => {
  return request.post<
    ICustomerActionResponse<boolean>,
    ICustomerActionResponse<boolean>
  >("/api/UserManagement/CustomerUser/SendExternalSMS", params);
};

export const impersonateCustomer = (params: IImpersonateCustomerParams) => {
  return request.post<
    ICustomerActionResponse<IImpersonateCustomerResponse>,
    ICustomerActionResponse<IImpersonateCustomerResponse>
  >("/api/UserManagement/CustomerUser/Impersonate", params);
};

export const getCustomerProfileViolations = (
  params: CustomerProfileViolationListParams,
) => {
  return request.get<CustomerProfileViolationListResponse>(
    "/api/admin/inspection/profile/violation/by-user-profile",
    {
      ...params,
    },
  );
};

export const getTypeDictionariesLoginMethod = () => {
  return request.get<ILoginMethodDictionary[]>(
    "/api/TypeDictionary/GetTypeDictionaries/LoginMethod",
  );
};
