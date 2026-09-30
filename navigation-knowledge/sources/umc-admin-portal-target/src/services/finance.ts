import request from "@/utils/request"
import saveFileWithAxios from "@/utils/saveFileWithAxios";
import moment from "moment";

export type FinanceSortDirection = 'asc' | 'desc';

export interface ITransactionsRequest{
    KeyWord: string;
    TransactionTypeId: number;
    StatusId: number;
    StartDate: string;
    EndDate: string;
    PageSize: number;
    PageIndex: number;
    SortBy: string;
    SortDirection: FinanceSortDirection;
    PaymentMethodId: number | null;
}
interface TransactionTypeObj {
  id: number;
  name?: string;
  nameEn: string;
  nameAr: string;
  scope: string;
  code?: string | null;
}

interface WalletVauleObj {
  id: number;
  name?: string;
  nameEn: string;
  nameAr: string;
  scope: string;
  code?: string | null;
}

interface StatusObj {
  id: number;
  name?: string;
  nameEn: string;
  nameAr: string;
  scope: string;
  code?: string | null;
}

interface ApplyForObj {
  profileId: number;
  userTypeId: number;
  name?: string;
  nameEn: string;
  nameAr: string;
  accountName: string;
  accountEmail: string;
}

interface TransactionItem {
  id: number;
  transactionNo: string;
  transactionTypeId: number;
  transactionTypeObj: TransactionTypeObj;
  paymentMethodId: number;
  walletVauleObj: WalletVauleObj;
  paymentMethodObj?: WalletVauleObj;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  statusId: number;
  statusObj: StatusObj;
  description: string;
  transactionType?: string;
  paymentMethod?: string;
  status?: string;
  createOn: string;
  createdOn?: string;
  completedAt?: string;
  updateOn: string;
  referenceNumber: string;
  profileName: string;
  applyForObj: ApplyForObj;
}

export interface ITransactionsResponse {
  pageIndex: number;
  pageSize: number;
  total?: number;
  totalCount?: number;
  items: TransactionItem[];
}

export const getTransactions = (data: Partial<ITransactionsRequest>) => {
    return request.get<ITransactionsResponse>(`/api/admin/finance/transactions`, data)
}

export interface ITransactionTypeResponse {
  id: number,
  name?: string,
  nameEn?: string,
  nameAr?: string,
  scope?: string
}
export const getTransactionType = () => {
    return request.get<ITransactionTypeResponse[]>(`/api/admin/finance/lookups/transaction-types`)
}
export interface ITransactionStatusResponse {
  id: number,
  name?: string,
  nameEn?: string,
  nameAr?: string,
  scope?: string
}
export const getTransactionStatus = () => {
    return request.get<ITransactionStatusResponse[]>(`/api/admin/finance/lookups/transaction-statuses`)
}

export const getPaymentsExport = (params: Partial<ITransactionsRequest>) => {
    const fileName = `Transactions_Payments_${moment().format('DDMMYYYYHHmmss')}.csv`
    return saveFileWithAxios(`/api/admin/finance/transactions/export`, fileName, params)
}
interface RechargesItem {
  id: number;
  transactionNo: string;
  transactionTypeId: number;
  transactionTypeObj: TransactionTypeObj;
  paymentMethodId: number;
  walletVauleObj: WalletVauleObj;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  statusId: number;
  statusObj: StatusObj;
  description: string;
  createdTime: string;
  accountName: string;
  accountEmail: string;
}
export interface IRechargesResponse {
  pageIndex: number;
  pageSize: number;
  total?: number;
  totalCount?: number;
  items: RechargesItem[];
}
interface IRechargesRequest{
    KeyWord?: string;
    TransactionTypeId?: number;
    StatusId?: number; 
    StartDate?: string;
    EndDate?: string;
    PageSize?: number;
    PageIndex?: number;
    SortBy?: string; 
    SortDirection?: FinanceSortDirection;
}
export const getRecharges = (params: Partial<IRechargesRequest>) => {
    return request.get<IRechargesResponse>(`/api/admin/finance/recharges`, params)
}

export const getRechargesExport = (params: Partial<ITransactionsRequest>) => {
    const fileName = `Transactions_Recharge_${moment().format('DDMMYYYYHHmmss')}.csv`
    return saveFileWithAxios(`/api/admin/finance/recharges/export`, fileName, params)
}

interface PaymentsDataStatistics {
  last7DaysTotal?: number | null;
  growthCount?: number | null;
}

interface RevenuesDataStatistics {
  last7DaysTotal?: number | null;
  revenueAmount?: number | null;
}

export interface IStatisticsResponse{
  totalPayments: number;
  totalRevenue: number;
  serviceApplicationPayments: number;
  fines: number;
  refunds: number;
  paymentsDataStatistics?: PaymentsDataStatistics | null;
  revenuesDataStatistics?: RevenuesDataStatistics | null;
}
export const getStatistics = () => {
  return request.get<IStatisticsResponse>(`/api/admin/finance/transactions/statistics`)
}
export interface IPaymentMethodAndFailResponse{
  walletTotal: number;
  cardTotal: number;
  failedTotal: number;
  failedRefundTotal: number;
}
export const getPaymentMethodAndFail = () => {
  return request.get<IPaymentMethodAndFailResponse>(`/api/admin/finance/transactions/payment-method-statistics`)
}
export interface IRechargeStatisticsResponse{
  totalRecharges: number;
  totalRechargeAmount: number;
  last7DaysRechangeAmount: number;
  completedRecharges: number;
  failRecharges: number;
}
export const getRechargeStatistics = () => {
  return request.get<IRechargeStatisticsResponse>(`/api/admin/finance/recharges/statistics`)
}
interface StatusObj {
  id: number;
  nameEn: string;
  nameAr: string;
  scope: string;
}

interface NameScopeObj {
  id: number;
  nameEn: string;
  nameAr: string;
  scope: string;
}
interface ProfileInfo {
  profileId: number;
  userTypeId: number;
  name?: string;
  nameEn: string;
  nameAr: string;
  accountName: string;
  accountEmail: string;
}
interface PaymentTransactionInfo {
  id: number;
  transactionNo: string;
  transactionTypeId: number;
  transactionTypeObj: NameScopeObj;
  paymentMethodId: number;
  walletVauleObj: NameScopeObj;
  paymentMethodObj?: NameScopeObj;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  statusId: number;
  statusObj: StatusObj;
  description: string;
  createOn: string;
  createdOn?: string;
  completedAt?: string;
  updateOn: string;
  referenceNumber: string;
  userProfileInfo: ProfileInfo;
  applyForObj?: ProfileInfo;
  maskedCardNumber?: string | null;
  cardBrand?: string | null;
}

interface ApplicationData {
  applicationNumber: string;
  serviceName: string;
  serviceNameNameEn: string;
  serviceNameNameAr: string;
  applicationStatusId: number;
  applicationStatusObj: StatusObj;
  applyFor: string;
  createdOn: string;
}

interface RefundReasonObj {
  id: number;
  nameEn: string;
  nameAr: string;
  scope: string;
}

interface RefundInfos {
  id: number;
  statusId: number;
  statusObj: StatusObj;
  reasonId: number;
  reasonObj: RefundReasonObj;
  amount: number;
  refundMothdId: number;
  paymentMethodId?: number;
  paymentMethodObj?: NameScopeObj;
  applyForObj?: ProfileInfo;
  createdOn: string;
  applicationNo: string;
  applicaitonNo?: string;
  type?: string;
  updateOn: string;
}

interface WalletInfo {
  id: number;
  walletOwnerUserId: string;
  balance: number;
  currency: string;
  statusId: number;
  statusObj: StatusObj;
  updateOn: string;
}

interface RelatedViolationTypeObj {
  id: number;
  name: string;
  code?: string | null;
}

export interface RelatedViolation {
  violationId: number;
  violationNo: string;
  violationTypeId: number;
  violationTypeObj: RelatedViolationTypeObj;
  violationTime: string;
  fineAmount: number;
  beforeAppealAdjustedFineAmount: number;
  afterAppealAdjustedFineAmount: number;
  inspectorUserId: string;
  inspectorName: string;
  entityName: string;
}

export interface ITransactionDetailResponse{
  paymentTransactionInfo?: PaymentTransactionInfo;
  transaction?: PaymentTransactionInfo;
  applicationDatas?: ApplicationData[];
  applicationItems?: ApplicationData[];
  refundInfos?: RefundInfos;
  refund?: RefundInfos;
  walletPaymentInfo?: WalletInfo | null;
  accountInfo?: WalletInfo | null;
  relatedViolation?: RelatedViolation | null;
}
export const getTransactionDetail = (serviceApplicationTransactionNo: string) => {
  return request.get<ITransactionDetailResponse>(
    `/api/admin/finance/transactions/${encodeURIComponent(serviceApplicationTransactionNo)}`
  )
}

export interface ITransactionReceiptResponse{
  url?: string;
  receiptUrl?: string;
  fileUrl?: string;
  downloadUrl?: string;
  receiptWithHeaderUrl?: string;
  paymentReceiptWithHeaderUrl?: string;
}

export const getTransactionReceipt = (transactionNo: string) => {
  return request.get<ITransactionReceiptResponse | string | null>(
    `/api/admin/finance/transactions/receipt`,
    { transactionNo }
  )
}

export interface IPaymentMethodResponse{
  id: number;
  name?: string;
  nameEn?: string;
  nameAr?: string;
  scope?: string;
}
export const getPaymentMethod = () => {
  return request.get<IPaymentMethodResponse[]>(`/api/admin/finance/lookups/payment-methods`)
}
interface TransactionsRefundsParams {
  /** Search keyword (query parameter) */
  KeyWord?: string;
  /** Start date, format: $date-time (query parameter), recommended ISO 8601 format e.g. "2026-01-23T12:00:00Z" */
  StartDate?: string;
  /** End date, format: $date-time (query parameter), recommended ISO 8601 format e.g. "2026-01-23T18:00:00Z" */
  EndDate?: string;
  /** Number of items per page (query parameter), 32-bit integer */
  PageSize?: number;
  /** Page index (query parameter), 32-bit integer, usually starts from 1 */
  PageIndex?: number;
  /** Sort field name (query parameter), e.g. "createTime", "id" */
  SortBy?: string;
  /** Sort direction (query parameter), 32-bit integer, usually 1=ascending, -1=descending */
  SortDirection?: number;
}
export type {
  TransactionsRefundsParams,
  TransactionsRefundsStatistics
};
// Reusable base interfaces
interface ApplyForObj {
  profileId: number;
  userTypeId: number;
  nameEn: string;
  nameAr: string;
  accountName: string;
  accountEmail: string;
}

interface PaymentMethodObj {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
}

interface RefundStatusObj {
  id: number;
  nameEn: string;
  nameAr: string;
  scope: string;
}

// Single refund item interface
interface RefundListItem {
  id: number;
  applicaitonNo: string;
  transactionNo: string;
  applyForObj: ApplyForObj;
  type: string;
  paymentMethodObj: PaymentMethodObj;
  amount: number;
  refundStatusObj: RefundStatusObj;
  updateOn: string;
}

// Pagination base interface
interface PaginationResponse<T> {
  pageIndex: number;
  pageSize: number;
  total: number;
  items: T[];
}
type TransactionsRefunds = PaginationResponse<RefundListItem>;

export const getTransactionsRefunds = (data: TransactionsRefundsParams) => {
  return request.get<TransactionsRefunds>(`/api/Payments/Management/Transactions/Refunds`,data)
}

interface ApplyForObj {
  profileId: number;
  userTypeId: number;
  nameEn: string;
  nameAr: string;
  accountName: string;
  accountEmail: string;
}

interface PaymentMethodObj {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
}

interface StatusObj {
  id: number;
  nameEn: string;
  nameAr: string;
  scope: string;
}

// Core interfaces for Transactions/Refunds/Detail
interface RefundStatusObj {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
}

interface RefundApplication {
  paymentMethodObj: PaymentMethodObj;
  applyForObj: ApplyForObj;
  email: string;
  refundAmount: number;
}

interface TranscationStatusObj {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
}

interface TranscationTypeObj {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
}

interface RefundTranscation {
  transactionNo: string;
  transcationStatusObj: TranscationStatusObj;
  transcationTypeObj: TranscationTypeObj;
  paymentMethodObj: PaymentMethodObj;
  email: string;
  amountCharge: number;
  applyForObj: ApplyForObj;
  description: string;
}

interface WalletPaymentInfo {
  id: number;
  walletOwnerUserId: string;
  balance: number;
  currency: string;
  statusId: number;
  statusObj: StatusObj;
  updateOn: string;
}

/** Main interface for Transactions/Refunds/Detail response */
interface TransactionsRefundsDetail {
  id: number;
  applicaitonNo: string; // Note: Typo in original field (applicaitonNo -> applicationNo)
  refundStatusObj: RefundStatusObj;
  type: string;
  updateOn: string;
  refundApplication: RefundApplication;
  refundTranscation: RefundTranscation;
  walletPaymentInfo: WalletPaymentInfo;
}
export const getTransactionsRefundsDetail = (data: number) => {
  return request.get<TransactionsRefundsDetail>(`/api/Payments/Management/Transactions/Refunds/${data}/Detail`)
}
interface TransactionsRefundsStatistics {
  walletTotalAmount: number;
  cardRefundTotalAmount: number;
  walletTotal: number;
  cardRefundTotal: number;
  totalCount: number;
  totalAmount: number;
}
export const getTransactionsRefundsStatistics = () => {
  return request.get<TransactionsRefundsStatistics>(`/api/Payments/Management/Transactions/Refunds/Statistics`)
}
