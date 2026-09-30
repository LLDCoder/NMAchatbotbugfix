import request from "@/utils/request";

export interface WalletCodeObj {
  id: number;
  name?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  code?: string | null;
  scope?: string | null;
}

export interface WalletAccountPaymentItem {
  id: number;
  transactionNo?: string | null;
  transactionTypeId?: number | null;
  transactionTypeObj?: WalletCodeObj | null;
  paymentMethodId?: number | null;
  paymentMethodObj?: WalletCodeObj | null;
  walletVauleObj?: WalletCodeObj | null;
  amount?: number | null;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  statusId?: number | null;
  statusObj?: WalletCodeObj | null;
  description?: string | null;
  createOn?: string | null;
  referenceNumber?: string | null;
}

export interface WalletAccountPaymentsResponse {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: WalletAccountPaymentItem[];
}

export interface FinancePaymentTransactionItem extends WalletAccountPaymentItem {
  transactionType?: string | null;
  paymentMethod?: string | null;
  status?: string | null;
  currency?: string | null;
  applyFor?: string | null;
  applyForEn?: string | null;
  profileName?: string | null;
  profileNameEn?: string | null;
  profileNameAr?: string | null;
  userName?: string | null;
  createdOn?: string | null;
  updateOn?: string | null;
  completedAt?: string | null;
  applyForType?: string | null;
  profileType?: string | null;
  subStatus?: string | null;
  subStatusObj?: WalletCodeObj | null;
  applyForObj?: {
    profileId?: number | null;
    userTypeId?: number | null;
    name?: string | null;
    nameEn?: string | null;
    nameAr?: string | null;
    accountName?: string | null;
    accountEmail?: string | null;
  } | null;
  profileId?: number | null;
}

export interface FinanceAccountPaymentsResponse {
  pageIndex?: number;
  pageSize?: number;
  total?: number;
  totalCount?: number;
  items?: FinancePaymentTransactionItem[];
}

export interface FinancePaymentsSummary {
  totalSpending?: number | null;
  serviceApplicationFees?: number | null;
  totalFinesPaid?: number | null;
  totalRefunds?: number | null;
  totalRecharge?: number | null;
}

export type FinanceProfileTransactionSortDirection = "asc" | "desc";

export interface WalletAccountPaymentsCount {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  pendingCompleted: number;
  refundinProgress: number;
}

export interface ApiResponse<T> {
  isSuccess: boolean;
  statusCode: number;
  message: string | null;
  data: T | null;
}

export const getAccountPayments = (params: {
  userId: string;
  profileId?: number;
  pageIndex?: number;
  pageSize?: number;
  keyword?: string;
  transactionTypeId?: string | number;
  statusId?: string | number;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortDirection?: 0 | 1;
}) => {
  return request.get<WalletAccountPaymentsResponse>(
    "/api/Wallet/GetAccountPayments",
    {
      ProfileId: params.profileId,
      PageIndex: params.pageIndex,
      PageSize: params.pageSize,
      Keyword: params.keyword,
      TransactionTypeId: params.transactionTypeId,
      StatusId: params.statusId,
      StartDate: params.startDate,
      EndDate: params.endDate,
      SortBy: params.sortBy,
      SortDirection: params.sortDirection,
    }
  );
};

export const getAccountPaymentsCount = (params: {
  userId: string;
  profileId?: number;
  keyword?: string;
  transactionTypeId?: string | number;
  statusId?: string | number;
  startDate?: string;
  endDate?: string;
}) => {
  return request.get<ApiResponse<WalletAccountPaymentsCount>>(
    "/api/Wallet/GetAccountPaymentsCount",
    {
      userId: params.userId,
      ProfileId: params.profileId,
      Keyword: params.keyword,
      TransactionTypeId: params.transactionTypeId,
      StatusId: params.statusId,
      StartDate: params.startDate,
      EndDate: params.endDate,
    }
  );
};

export const getFinancePaymentsCount = (params: {
  userId?: string;
  profileId?: number;
  keyword?: string;
  transactionTypeId?: string | number;
  paymentMethodId?: string | number;
  statusId?: string | number;
  startDate?: string;
  endDate?: string;
  pageIndex?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: FinanceProfileTransactionSortDirection;
}) => {
  return request.get<ApiResponse<FinanceAccountPaymentsResponse>>(
    "/api/admin/finance/transactions/by-user-profile",
    {
      userId: params.userId,
      profileId: params.profileId,
      keyword: params.keyword,
      transactionTypeId: params.transactionTypeId,
      paymentMethodId: params.paymentMethodId,
      statusId: params.statusId,
      startDate: params.startDate,
      endDate: params.endDate,
      pageIndex: params.pageIndex,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortDirection: params.sortDirection,
    }
  );
};


export const getFinancePaymentsCountSummary = (params: {
  userId?: string;
  profileId?: number;
}) => {
  return request.get<ApiResponse<FinancePaymentsSummary>>(
    "/api/admin/finance/transactions/summary-by-user-profile",
    {
      userId: params.userId,
      profileId: params.profileId,
    }
  );
};
