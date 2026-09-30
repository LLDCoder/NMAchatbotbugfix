import type { AxiosRequestConfig } from "axios";
import request from "@/utils/request";
import type { ApiResponse } from "@/services/userManagement";

type FinancialRefundRequestConfig = AxiosRequestConfig & {
  skipErrorMessage?: boolean;
};

export interface FinancialRefundListParams {
  search?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  pageIndex?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}

export interface FinancialRefundApplyForDto {
  name?: string | null;
  iconKey?: string | null;
  userTypeId?: number | string | null;
}

export interface FinancialRefundListItemDto {
  refundNo: string;
  originalTransactionNo?: string | null;
  type?: string | null;
  refundScope?: string | null;
  applyFor?: FinancialRefundApplyForDto | null;
  accountOrCardHolder?: string | null;
  paymentMethod?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  lastUpdatedOn?: string | null;
  canExecuteRefund?: boolean | null;
  unsupportedReason?: string | null;
}

export interface FinancialRefundListResponseDto {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: FinancialRefundListItemDto[];
}

interface FinancialRefundListApiResponseDto {
  pageIndex?: number | null;
  pageSize?: number | null;
  total?: number | null;
  totalCount?: number | null;
  items?: FinancialRefundListItemDto[] | null;
}

export interface FinancialRefundStatisticsAmountDto {
  walletRefundAmount?: number | null;
  cardRefundAmount?: number | null;
  totalRefundAmount?: number | null;
  hint?: string | null;
}

export interface FinancialRefundStatisticsCountDto {
  walletRefundCount?: number | null;
  cardRefundCount?: number | null;
  totalRefundCount?: number | null;
  hint?: string | null;
}

export interface FinancialRefundStatisticsDto {
  totalRefundAmount?: FinancialRefundStatisticsAmountDto | null;
  totalRefundCount?: FinancialRefundStatisticsCountDto | null;
  pendingRefundCount?: number | null;
  pendingRefundAmount?: number | null;
  currency?: string | null;
}

export interface FinancialRefundFailureReasonDto {
  isVisible?: boolean | null;
  message?: string | null;
  lastExecutionStatus?: string | null;
  lastUpdatedOn?: string | null;
}

export interface FinancialRefundApplicationInformationDto {
  paymentMethod?: string | null;
  accountOrCardHolder?: string | null;
  cardInformation?: string | null;
  email?: string | null;
  applyFor?: string | null;
  amountCharged?: number | null;
  refundAmount?: number | null;
  currency?: string | null;
  refundScope?: string | null;
  refundReason?: string | null;
}

export interface FinancialRefundRelatedPaymentInformationDto {
  transactionNo?: string | null;
  status?: string | null;
  transactionType?: string | null;
  lastUpdatedOn?: string | null;
  paymentMethod?: string | null;
  cardInformation?: string | null;
  amountCharged?: number | null;
  currency?: string | null;
  applyFor?: string | null;
  description?: string | null;
}

export interface FinancialRefundDetailDto {
  refundNo: string;
  status?: string | null;
  type?: string | null;
  lastUpdatedOn?: string | null;
  canExecuteRefund?: boolean | null;
  unsupportedReason?: string | null;
  failureReason?: FinancialRefundFailureReasonDto | null;
  applicationInformation?: FinancialRefundApplicationInformationDto | null;
  relatedPaymentInformation?: FinancialRefundRelatedPaymentInformationDto | null;
}

export interface ExecuteFinancialRefundPayload {
  refundNo?: string;
  operatorId: string;
  operatorName: string;
  expectedLastUpdatedOn: string;
}

export interface ExecuteFinancialRefundResultDto {
  isSuccess: boolean;
  businessStatus?: string | null;
  transactionStatus?: string | null;
  message?: string | null;
  failureReason?: string | null;
  refundNo?: string | null;
  originalTransactionNo?: string | null;
  refundTransactionNo?: string | null;
  lastUpdatedOn?: string | null;
  canRetry?: boolean | null;
  errorCode?: string | null;
}

export interface RefundExecutionPreview {
  refundNo: string;
  originalTransactionNo?: string | null;
  paymentMethod?: string | null;
  accountOrCardHolder?: string | null;
  email?: string | null;
  cardInformation?: string | null;
  amount?: number | null;
  currency?: string | null;
  expectedLastUpdatedOn?: string | null;
}

const unwrapFinancialRefundResponse = <T,>(response: ApiResponse<T>) => response.data;

const normalizeFinancialRefundListResponse = (
  data?: FinancialRefundListApiResponseDto | null,
): FinancialRefundListResponseDto => ({
  pageIndex: Number(data?.pageIndex ?? 1),
  pageSize: Number(data?.pageSize ?? 10),
  total: Number(data?.total ?? data?.totalCount ?? 0),
  items: Array.isArray(data?.items) ? data.items : [],
});

export const getFinancialRefundList = (
  params: FinancialRefundListParams,
  config?: FinancialRefundRequestConfig,
) =>
  request
    .get<
    ApiResponse<FinancialRefundListApiResponseDto>,
    ApiResponse<FinancialRefundListApiResponseDto>
  >("/api/admin/payments/refunds", params, config)
    .then(unwrapFinancialRefundResponse)
    .then(normalizeFinancialRefundListResponse);

export const getFinancialRefundStatistics = (config?: FinancialRefundRequestConfig) =>
  request
    .get<
    ApiResponse<FinancialRefundStatisticsDto>,
    ApiResponse<FinancialRefundStatisticsDto>
  >("/api/admin/payments/refunds/statistics", {}, config)
    .then(unwrapFinancialRefundResponse);

export const getFinancialRefundDetail = (
  refundNo: string,
  config?: FinancialRefundRequestConfig,
) =>
  request
    .get<
    ApiResponse<FinancialRefundDetailDto>,
    ApiResponse<FinancialRefundDetailDto>
  >(`/api/admin/payments/refunds/${refundNo}`, {}, config)
    .then(unwrapFinancialRefundResponse);

export const executeFinancialRefund = (
  refundNo: string,
  payload: ExecuteFinancialRefundPayload,
) =>
  request
    .post<
    ApiResponse<ExecuteFinancialRefundResultDto>,
    ApiResponse<ExecuteFinancialRefundResultDto>
  >(`/api/admin/payments/refunds/${refundNo}/execute`, payload, {
    skipErrorMessage: true,
  })
    .then(unwrapFinancialRefundResponse);
