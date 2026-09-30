import type {
  FinanceAccountPaymentsResponse,
  FinancePaymentsSummary,
  FinancePaymentTransactionItem,
  WalletCodeObj,
} from "@/services/wallet";
import type { PaymentCountStats, PaymentItem } from "../../types";

type ResponseEnvelope<T> = {
  data?: T | { data?: T | null } | null;
};

export const unwrapFinanceResponse = <T,>(payload: unknown): T | null => {
  if (!payload || typeof payload !== "object") return payload as T | null;
  const data = (payload as ResponseEnvelope<T>).data;
  if (data && typeof data === "object" && "data" in data) {
    return (data as { data?: T | null }).data ?? null;
  }
  return (data ?? payload) as T;
};

const getLocalizedName = (
  value: WalletCodeObj | null | undefined,
  fallback: string | null | undefined,
  language: string,
) => {
  const localizedValue = language === "ar" ? value?.nameAr : value?.nameEn;
  const secondaryValue = language === "ar" ? value?.nameEn : value?.nameAr;
  return localizedValue || value?.name || secondaryValue || fallback || "-";
};

const getLocalizedApplicantName = (
  item: FinancePaymentTransactionItem,
  language: string,
) => {
  const applyFor = item.applyForObj;
  const localizedValue = language === "ar" ? applyFor?.nameAr : applyFor?.nameEn;
  const secondaryValue = language === "ar" ? applyFor?.nameEn : applyFor?.nameAr;
  return (
    localizedValue ||
    applyFor?.name ||
    secondaryValue ||
    item.applyForEn ||
    item.applyFor ||
    item.profileName ||
    item.profileNameEn ||
    item.profileNameAr ||
    item.userName ||
    "-"
  );
};

const getApplyForType = (
  item: FinancePaymentTransactionItem,
  fallbackProfileType?: string,
) => {
  if (item.applyForType || item.profileType || fallbackProfileType) {
    return item.applyForType || item.profileType || fallbackProfileType || "-";
  }
  if (item.applyForObj?.userTypeId === 1) return "individual";
  if (item.applyForObj?.userTypeId) return "establishment";
  return "-";
};

export const mapFinancePaymentItem = (
  item: FinancePaymentTransactionItem,
  index: number,
  language: string,
  fallbackProfileType?: string,
): PaymentItem => {
  const statusId = item.statusId ?? item.statusObj?.id;
  const transactionTypeId =
    item.transactionTypeId ?? item.transactionTypeObj?.id;
  const paymentMethodId = item.paymentMethodId ?? item.paymentMethodObj?.id;
  const statusLabel = getLocalizedName(
    item.statusObj,
    item.status || (statusId === null || statusId === undefined ? "-" : String(statusId)),
    language,
  );
  const statusSubLabel = item.subStatusObj || item.subStatus
    ? getLocalizedName(item.subStatusObj, item.subStatus, language)
    : undefined;
  const transactionTime =
    item.completedAt || item.updateOn || item.createdOn || item.createOn || "-";

  return {
    id: String(item.id ?? index),
    paymentId: String(item.id ?? index),
    amount: item.amount ?? "-",
    paymentMethod: getLocalizedName(
      item.paymentMethodObj || item.walletVauleObj,
      item.paymentMethod,
      language,
    ),
    paymentMethodId: paymentMethodId ?? undefined,
    paymentDate: transactionTime,
    status: statusLabel,
    statusId: statusId ?? undefined,
    statusLabel,
    statusSubLabel,
    transactionNo: item.transactionNo || "-",
    transactionType: getLocalizedName(
      item.transactionTypeObj,
      item.transactionType,
      language,
    ),
    transactionTypeId: transactionTypeId ?? undefined,
    amountCharged: item.amount === null || item.amount === undefined
      ? "-"
      : String(item.amount),
    refundCategory: item.description || "-",
    applyFor: getLocalizedApplicantName(item, language),
    applyForType: getApplyForType(item, fallbackProfileType),
    transactionTime,
  };
};

export const getFinancePaymentsTotal = (
  response: FinanceAccountPaymentsResponse | null | undefined,
) => {
  const total = Number(response?.totalCount ?? response?.total ?? 0);
  return Number.isFinite(total) && total >= 0 ? total : 0;
};

const toSafeNumber = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export const mapFinancePaymentsSummary = (
  summary: FinancePaymentsSummary | null | undefined,
): PaymentCountStats => ({
  total: 0,
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  pendingCompleted: 0,
  refundinProgress: 0,
  totalSpending: toSafeNumber(summary?.totalSpending),
  serviceApplicationFees: toSafeNumber(summary?.serviceApplicationFees),
  totalFinesPaid: toSafeNumber(summary?.totalFinesPaid),
  totalRefunds: toSafeNumber(summary?.totalRefunds),
  totalRecharge: toSafeNumber(summary?.totalRecharge),
});
