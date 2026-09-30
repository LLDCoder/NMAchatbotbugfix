import request from "@/utils/request";
import { resolveServiceCode } from "@/utils/serviceCode";
import type { AxiosResponse } from "axios";

export interface EmirateItem {
  id: number;
  nameEn: string;
  nameAr: string;
  code?: string;
}

export interface RegionItem {
  id: number;
  nameEn: string;
  nameAr: string;
  emirateId: number;
  code?: string;
}

export interface AreaItem {
  id: number;
  nameEn: string;
  nameAr: string;
  regionId: number;
  code?: string;
}

export const getEmirateList = (serviceCode?: string | number | null) => {
  return request.get<EmirateItem[]>("/api/User/GetEmirateList", {
    serviceCode: resolveServiceCode(serviceCode),
  });
};

export interface LogQueryRequest {
  pageIndex?: number;
  pageSize?: number;
  startTime?: string;
  endTime?: string;
  userId?: string;
  keyword?: string;
  status?: string;
  eventType?: string;
  isSuccess?: boolean;
  correlationId?: string;
  source?: string;
  environment?: string;
}

export interface LogPageResponse<T> {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  items: T[];
}

interface AdminPortalLogPageResponse<T> {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: T[];
}

export interface AdminLogRecord {
  id: string | number;
  logNumber?: string | null;
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  department?: string | null;
  tenantId?: number | null;
  businessEvent?: string | null;
  controllerName?: string | null;
  actionName?: string | null;
  requestUrl?: string | null;
  httpMethod?: string | null;
  requestParam?: string | null;
  returnResult?: string | null;
  remoteIp?: string | null;
  browser?: string | null;
  os?: string | null;
  userAgent?: string | null;
  location?: string | null;
  longitude?: number | null;
  latitude?: number | null;
  elapsed?: number | null;
  status?: string | null;
  logLevel?: string | null;
  exception?: string | null;
  traceId?: string | null;
  correlationId?: string | null;
  eventId?: number | null;
  threadId?: number | null;
  message?: string | null;
  createTime?: string | null;
  createdTime?: string | null;
  updatedTime?: string | null;
  eventType?: string | null;
  eventDescription?: string | null;
  ipAddress?: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  requestParameters?: string | null;
  responseStatusCode?: number | null;
  isSuccess?: boolean;
  isSuspicious?: boolean;
  failureReason?: string | null;
  device?: string | null;
  eventTimestamp?: string | null;
  createdAt?: string | null;
  source?: string | null;
  environment?: string | null;
}

export type AdminLogKind =
  | "userActivity"
  | "systemOperations"
  | "securityLogs"
  | "securityAudit";

export interface LogFilterOptions {
  sources: string[];
  environments: string[];
  statuses: string[];
  eventTypes: string[];
}

type RawLogPageResponse<T> = LogPageResponse<T> | AdminPortalLogPageResponse<T>;
type LogPageApiResponse<T> = RawLogPageResponse<T> | { data?: RawLogPageResponse<T> };
type ApiResponse<T> = T | { data?: T };

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const unwrapApiResponse = <T>(response: ApiResponse<T>): T | undefined =>
  isObject(response) && "data" in response
    ? (response.data as T | undefined)
    : (response as T);

const isWrappedLogPageResponse = <T>(
  response: LogPageApiResponse<T>,
): response is { data?: RawLogPageResponse<T> } =>
  isObject(response) && "data" in response;

const emptyLogPage = <T>(): LogPageResponse<T> => ({
  currentPage: 1,
  itemsPerPage: 10,
  totalItems: 0,
  items: [],
});

const normalizeLogPageResponse = <T>(response: LogPageApiResponse<T>) => {
  const page = isWrappedLogPageResponse(response) ? response.data : response;
  if (!page) {
    return { data: emptyLogPage<T>() };
  }

  if ("pageIndex" in page) {
    return {
      data: {
        currentPage: page.pageIndex,
        itemsPerPage: page.pageSize,
        totalItems: page.total,
        items: page.items || [],
      },
    };
  }

  return {
    data: {
      currentPage: page.currentPage,
      itemsPerPage: page.itemsPerPage,
      totalItems: page.totalItems,
      items: page.items || [],
    },
  };
};

export const getUserActivityLogPage = async (data: LogQueryRequest) =>
  normalizeLogPageResponse(
    await request.post<LogPageApiResponse<AdminLogRecord>, LogPageApiResponse<AdminLogRecord>>(
      "/api/Log/UserActivityLogPage",
      data,
      { skipErrorMessage: true },
    ),
  );

export const getSecurityLogPage = async (data: LogQueryRequest) =>
  normalizeLogPageResponse(
    await request.post<LogPageApiResponse<AdminLogRecord>, LogPageApiResponse<AdminLogRecord>>(
      "/api/Log/SecurityLogPage",
      data,
      { skipErrorMessage: true },
    ),
  );

export const getSecurityAuditLogPage = async (data: LogQueryRequest) =>
  normalizeLogPageResponse(
    await request.post<LogPageApiResponse<AdminLogRecord>, LogPageApiResponse<AdminLogRecord>>(
      "/api/Log/SecurityAuditLogPage",
      data,
      { skipErrorMessage: true },
    ),
  );

export const getSystemOperationLogPage = async (data: LogQueryRequest) =>
  normalizeLogPageResponse(
    await request.post<LogPageApiResponse<AdminLogRecord>, LogPageApiResponse<AdminLogRecord>>(
      "/api/Log/SystemOperationLogPage",
      data,
      { skipErrorMessage: true },
    ),
  );

const getLogDetail = async (url: string) => {
  const response = await request.get<ApiResponse<AdminLogRecord>, ApiResponse<AdminLogRecord>>(url);
  const detail = unwrapApiResponse(response);
  if (!detail) {
    throw new Error("Log detail response did not contain data.");
  }
  return detail;
};

export const getUserActivityLog = (id: string | number) =>
  getLogDetail(`/api/Log/UserActivityLog/${id}`);

export const getSystemOperationLog = (id: string | number) =>
  getLogDetail(`/api/Log/SystemOperationLog/${id}`);

export const getSecurityLog = (id: string | number) =>
  getLogDetail(`/api/Log/SecurityLog/${id}`);

export const getSecurityAuditLog = (id: string | number) =>
  getLogDetail(`/api/Log/SecurityAuditLog/${id}`);

const FILTER_OPTIONS_ENDPOINTS: Record<AdminLogKind, string> = {
  userActivity: "/api/Log/UserActivityLogFilterOptions",
  systemOperations: "/api/Log/SystemOperationLogFilterOptions",
  securityLogs: "/api/Log/SecurityLogFilterOptions",
  securityAudit: "/api/Log/SecurityAuditLogFilterOptions",
};

export const getLogFilterOptions = async (kind: AdminLogKind) => {
  const response = await request.get<ApiResponse<LogFilterOptions>, ApiResponse<LogFilterOptions>>(
    FILTER_OPTIONS_ENDPOINTS[kind],
    {},
    { skipErrorMessage: true },
  );
  const options = unwrapApiResponse(response);
  return {
    sources: Array.isArray(options?.sources) ? options.sources : [],
    environments: Array.isArray(options?.environments) ? options.environments : [],
    statuses: Array.isArray(options?.statuses) ? options.statuses : [],
    eventTypes: Array.isArray(options?.eventTypes) ? options.eventTypes : [],
  };
};

export type LogExportResponse = AxiosResponse<Blob>;

const exportLog = (url: string, data: LogQueryRequest) =>
  request.post<Blob, LogExportResponse>(url, data, {
    responseType: "blob",
    rawResponse: true,
    skipErrorMessage: true,
  });

export const exportUserActivityLogs = (data: LogQueryRequest) =>
  exportLog("/api/Log/UserActivityLogExport", data);

export const exportSecurityLogs = (data: LogQueryRequest) =>
  exportLog("/api/Log/SecurityLogExport", data);

export const exportSecurityAuditLogs = (data: LogQueryRequest) =>
  exportLog("/api/Log/SecurityAuditLogExport", data);

export const exportSystemOperationLogs = (data: LogQueryRequest) =>
  exportLog("/api/Log/SystemOperationLogExport", data);
