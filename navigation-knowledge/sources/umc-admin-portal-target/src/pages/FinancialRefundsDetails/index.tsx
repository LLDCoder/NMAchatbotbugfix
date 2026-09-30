import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { Empty, Spin, Tooltip } from "antd";
import { useHistory, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import moment from "moment";
import warningRedIcon from "@/assets/images/warning-red.svg";
import refundNumberIcon from "@/pages/CustomerRefunds/assets/icons/detail_refund_number.svg";
import refundTypeIcon from "@/pages/CustomerRefunds/assets/icons/detail_refund_category.svg";
import refundStatusIcon from "@/pages/CustomerRefunds/assets/icons/detail_status.svg";
import refundUpdatedIcon from "@/pages/CustomerRefunds/assets/icons/detail_last_updated.svg";
import AEDRED from "@/assets/images/red-aed.svg";
import { CustomMessage } from "@/components/common";
import type { FinancialRefundDetailDto } from "@/services/financialRefunds";
import {
  executeFinancialRefund,
  getFinancialRefundDetail,
} from "@/services/financialRefunds";
import {
  getAdminCustomerServiceRefundTickets,
  getAdminRefundTicketDetail,
  getAdminRefundTickets,
  type AdminRefundDetailDto,
  type AdminRefundTicketListItemDto,
} from "@/services/refunds";
import { useUserStore } from "@/store/user";
import type { IUser } from "@/store/user";
import formatMoney from "@/utils/formatMoney";
import { formatPaymentCardInformation } from "@/utils/payment";
import RefundConfirmModal from "@/pages/FinancialRefunds/components/RefundConfirmModal";
import {
  getFinancialRefundStatusLabel,
  getFinancialRefundStatusTone,
} from "@/pages/FinancialRefunds/status";
import "./index.less";

const getExecutionErrorMessage = (code: string, t: TFunction) => {
  const base = "Finance.financialRefunds.errors";
  const keyMap: Record<string, string> = {
    REFUND_NOT_FOUND: `${base}.refundNotFound`,
    ORIGINAL_TRANSACTION_NOT_FOUND: `${base}.originalTransactionNotFound`,
    UNSUPPORTED_REFUND_PAYMENT_METHOD: `${base}.unsupportedPaymentMethod`,
    INVALID_ORIGINAL_TRANSACTION_STATUS: `${base}.invalidOriginalTransactionStatus`,
    REFUND_AMOUNT_EXCEEDED: `${base}.amountExceeded`,
    REFUND_ALREADY_COMPLETED: `${base}.alreadyCompleted`,
    REFUND_CONCURRENCY_CONFLICT: `${base}.concurrencyConflict`,
    MAGNATI_GATEWAY_TIMEOUT: `${base}.gatewayTimeout`,
    MAGNATI_GATEWAY_FAILED: `${base}.gatewayFailed`,
    REFUND_EXECUTION_FAILED: `${base}.executionFailedContactBackend`,
  };
  return keyMap[code] ? t(keyMap[code]) : "";
};

type DetailState = "loading" | "ready" | "not-found" | "no-permission";

interface RefundErrorPayload {
  statusCode?: number;
  message?: string | null;
  errorCode?: string | null;
  code?: string | null;
  data?: {
    statusCode?: number;
    message?: string | null;
    errorCode?: string | null;
    code?: string | null;
  } | null;
}

const formatDateTime = (value?: string | null) =>
  value ? moment(value).format("DD/MM/YYYY HH:mm:ss") : "-";

function normalizeText(value?: string | null) {
  return String(value ?? "").trim();
}

function getRelatedPaymentStatusLabel(status: string | null | undefined, t: TFunction) {
  const value = normalizeText(status);

  return value.toLowerCase() === "completed"
    ? t("Finance.transactions.statistics.completed")
    : value;
}

const getRefundErrorPayload = (error: unknown): RefundErrorPayload => {
  const axiosError = error as AxiosError<RefundErrorPayload>;
  return axiosError.response?.data ?? {};
};

const getRefundErrorStatus = (error: unknown) => {
  const axiosError = error as AxiosError<RefundErrorPayload>;
  return (
    axiosError.response?.status ??
    axiosError.response?.data?.statusCode ??
    axiosError.response?.data?.data?.statusCode
  );
};

const buildExecutionErrorMessage = (error: unknown, t: TFunction) => {
  const payload = getRefundErrorPayload(error);
  const payloadData = payload.data ?? {};
  const rawErrorCode = payload?.errorCode ?? payloadData?.errorCode ?? payload?.code;
  const errorCode = rawErrorCode ? String(rawErrorCode) : "";

  return {
    errorCode,
    message:
      getExecutionErrorMessage(errorCode, t) ||
      t("Finance.financialRefunds.messages.executionFailed"),
  };
};

function getAdminRefundTicketItems(response?: unknown) {
  const payload = (response as { data?: unknown } | null)?.data ?? response;
  const items = (payload as { items?: AdminRefundTicketListItemDto[] } | null)
    ?.items;

  return Array.isArray(items) ? items : [];
}

async function findAdminRefundTicket(refundNo: string) {
  const trimmedRefundNo = normalizeText(refundNo);
  if (!trimmedRefundNo) return null;

  const requestFns = [getAdminRefundTickets, getAdminCustomerServiceRefundTickets];
  const responses = await Promise.all(
    requestFns.flatMap((requestFn) =>
      [false, true].map((isCompleted) =>
        requestFn({
          SeachKey: trimmedRefundNo,
          IsCompleted: isCompleted,
          PageSize: 20,
          PageIndex: 1,
        }).catch(() => null),
      ),
    ),
  );

  for (const response of responses) {
    const matchedItem = getAdminRefundTicketItems(response).find(
      (item) => normalizeText(item.applicationNo) === trimmedRefundNo,
    );

    if (matchedItem) return matchedItem;
  }

  return null;
}

async function loadAdminRefundDetailByRefundNo(refundNo: string) {
  const matchedTicket = await findAdminRefundTicket(refundNo);
  const refundId = matchedTicket?.refundId;
  if (refundId === undefined || refundId === null) return null;

  const response = await getAdminRefundTicketDetail(refundId);
  const payload = (response as { data?: unknown } | null)?.data ?? response;
  return (payload as AdminRefundDetailDto) ?? null;
}

function maskRefundPaymentDescription(
  description?: string | null,
  cardInfo?: string | null,
) {
  const text = normalizeText(description);
  const rawCardInfo = normalizeText(cardInfo);

  if (!text || !rawCardInfo) return text;

  return text
    .split(rawCardInfo)
    .join(formatPaymentCardInformation(rawCardInfo));
}

function TopInfoItem({
  icon,
  label,
  value,
  status,
}: {
  icon: string;
  label: string;
  value?: string | null;
  status?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="financial-refunds-details__top-item">
      <div className="financial-refunds-details__top-icon">
        <img src={icon} alt="" />
      </div>
      <div className="financial-refunds-details__top-copy">
        <div className="financial-refunds-details__top-label">{label}</div>
        {status ? (
          <div
            className={`financial-refunds-details__status-tag is-${getFinancialRefundStatusTone(
              status,
            )}`}
          >
            {getFinancialRefundStatusLabel(status, t)}
          </div>
        ) : (
          <div className="financial-refunds-details__top-value">{value || "-"}</div>
        )}
      </div>
    </div>
  );
}

function InfoField({
  label,
  value,
  danger = false,
}: {
  label: string;
  value?: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="financial-refunds-details__field">
      <div className="financial-refunds-details__field-label">{label}</div>
      <div
        className={`financial-refunds-details__field-value ${
          danger ? "is-danger" : ""
        }`}
      >
        {value || "-"}
      </div>
    </div>
  );
}

function AmountField({
  label,
  amount,
  currency,
  showNegative = false,
}: {
  label: string;
  amount?: number | null;
  currency?: string | null;
  showNegative?: boolean;
}) {
  const formatted =
    amount === undefined || amount === null
      ? "-"
      : formatMoney(showNegative ? Math.abs(amount) : amount);

  return (
    <div className="financial-refunds-details__field">
      <div className="financial-refunds-details__field-label">{label}</div>
      <div className="financial-refunds-details__field-value is-danger">
        {formatted === "-" ? (
          "-"
        ) : (
          <span className="financial-refunds-details__amount">
            {showNegative ? <span>-</span> : null}
            <img src={AEDRED} alt={currency || "AED"} />
            <span>{formatted}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function FooterActionButton({
  children,
  onClick,
  variant = "primary",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`financial-refunds-details__action-button is-${variant} ${
        disabled ? "is-disabled" : ""
      }`}
      onClick={() => {
        if (disabled) {
          return;
        }
        onClick?.();
      }}
      aria-disabled={disabled}
    >
      <span>{children}</span>
    </button>
  );
}

export default function FinancialRefundsDetails() {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const userInfo = useUserStore((state: { userInfo: IUser }) => state.userInfo);
  const [detailState, setDetailState] = useState<DetailState>("loading");
  const [detail, setDetail] = useState<FinancialRefundDetailDto | null>(null);
  const [adminRefundDetail, setAdminRefundDetail] =
    useState<AdminRefundDetailDto | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const refundNo = searchParams.get("refundNo") || "";

  const operatorName = useMemo(() => {
    const fullName = `${userInfo?.firstName ?? ""} ${userInfo?.lastName ?? ""}`.trim();
    return fullName || userInfo?.email || t("common.admin", "Admin");
  }, [t, userInfo?.email, userInfo?.firstName, userInfo?.lastName]);

  const loadDetail = useCallback(async () => {
    if (!refundNo) {
      setDetailState("not-found");
      return;
    }

    setDetailState("loading");
    try {
      const [nextDetail, nextAdminRefundDetail] = await Promise.all([
        getFinancialRefundDetail(refundNo, {
          skipErrorMessage: true,
        }),
        loadAdminRefundDetailByRefundNo(refundNo).catch(() => null),
      ]);
      if (!nextDetail) {
        setDetail(null);
        setAdminRefundDetail(null);
        setDetailState("not-found");
        return;
      }
      setDetail(nextDetail);
      setAdminRefundDetail(nextAdminRefundDetail);
      setDetailState("ready");
    } catch (error: unknown) {
      const statusCode = getRefundErrorStatus(error);
      setDetail(null);
      setAdminRefundDetail(null);
      if (statusCode === 403) {
        setDetailState("no-permission");
        return;
      }
      setDetailState("not-found");
    }
  }, [refundNo]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let changed = false;

    if (params.get("pageTitleKey") !== "menu.refundsDetails") {
      params.set("pageTitleKey", "menu.refundsDetails");
      changed = true;
    }

    if (params.get("breadcrumbRootKey") !== "menu.financialPayment") {
      params.set("breadcrumbRootKey", "menu.financialPayment");
      changed = true;
    }

    if (!changed) return;

    history.replace({
      pathname: location.pathname,
      search: params.toString(),
    });
  }, [history, location.pathname, location.search]);

  const adminPaymentInfo = adminRefundDetail?.paymentInfo;
  const adminCardInformation = formatPaymentCardInformation(
    adminPaymentInfo?.cardInfo,
  );
  const applicationCardInformation =
    adminCardInformation ||
    formatPaymentCardInformation(detail?.applicationInformation?.cardInformation);
  const relatedCardInformation =
    adminCardInformation ||
    formatPaymentCardInformation(detail?.relatedPaymentInformation?.cardInformation);
  const relatedPaymentDescription =
    maskRefundPaymentDescription(
      adminPaymentInfo?.desciption,
      adminPaymentInfo?.cardInfo,
    ) || detail?.relatedPaymentInformation?.description;

  const executionPreview = useMemo(
    () =>
      detail
        ? {
            refundNo: detail.refundNo,
            originalTransactionNo: detail.relatedPaymentInformation?.transactionNo,
            paymentMethod: detail.applicationInformation?.paymentMethod,
            accountOrCardHolder: detail.applicationInformation?.accountOrCardHolder,
            email: detail.applicationInformation?.email,
            cardInformation: applicationCardInformation,
            amount:
              detail.applicationInformation?.refundAmount ??
              detail.applicationInformation?.amountCharged,
            currency:
              detail.applicationInformation?.currency ??
              detail.relatedPaymentInformation?.currency,
            expectedLastUpdatedOn: detail.lastUpdatedOn || undefined,
          }
        : null,
    [applicationCardInformation, detail],
  );

  const handleExecuteRefund = useCallback(async () => {
    if (!detail?.refundNo || !detail?.lastUpdatedOn) {
      return;
    }

    setConfirmSubmitting(true);
    try {
      const result = await executeFinancialRefund(detail.refundNo, {
        refundNo: detail.refundNo,
        operatorId: String(userInfo?.id ?? ""),
        operatorName,
        expectedLastUpdatedOn: detail.lastUpdatedOn,
      });

      if (!result?.isSuccess) {
        console.error("Refund execution was rejected:", result);
        CustomMessage.warning(
          t("Finance.financialRefunds.messages.executionFailed"),
        );
        setConfirmVisible(false);
        await loadDetail();
        return;
      }

      CustomMessage.success(
        t("Finance.financialRefunds.messages.executionSuccess"),
      );
      history.push(`/financial-payment/refunds?refresh=${Date.now()}`);
    } catch (error) {
      const { errorCode, message } = buildExecutionErrorMessage(error, t);
      CustomMessage.warning(message);
      setConfirmVisible(false);
      await loadDetail();
      if (errorCode === "REFUND_CONCURRENCY_CONFLICT") {
        return;
      }
    } finally {
      setConfirmSubmitting(false);
    }
  }, [detail, history, loadDetail, operatorName, t, userInfo?.id]);

  if (detailState === "loading") {
    return (
      <div className="financial-refunds-details financial-refunds-details--centered">
        <Spin />
      </div>
    );
  }

  if (detailState === "no-permission") {
    return (
      <div className="financial-refunds-details financial-refunds-details--centered">
        <Empty description={t("Finance.financialRefundsDetails.messages.noPermission")} />
      </div>
    );
  }

  if (detailState === "not-found" || !detail) {
    return (
      <div className="financial-refunds-details financial-refunds-details--centered">
        <Empty description={t("Finance.financialRefundsDetails.messages.notFound")} />
      </div>
    );
  }

  return (
    <div className="financial-refunds-details">
      {detail.failureReason?.isVisible && detail.failureReason?.message ? (
        <div className="financial-refunds-details__failure-banner">
          <img src={warningRedIcon} alt="" />
          <div>
            <div className="financial-refunds-details__failure-title">
              {t("Finance.financialRefundsDetails.failureReason")}
            </div>
            <div className="financial-refunds-details__failure-message">
              {detail.failureReason.message}
            </div>
          </div>
        </div>
      ) : null}

      <div className="financial-refunds-details__top-card">
        <TopInfoItem icon={refundNumberIcon} label={t("Finance.financialRefunds.table.applicationNo")} value={detail.refundNo} />
        <TopInfoItem icon={refundTypeIcon} label={t("Finance.financialRefunds.table.type")} value={detail.type || t("Finance.financialRefunds.actions.refund")} />
        <TopInfoItem
          icon={refundStatusIcon}
          label={t("Finance.financialRefunds.table.status")}
          status={detail.status}
        />
        <TopInfoItem
          icon={refundUpdatedIcon}
          label={t("Finance.financialRefunds.table.lastUpdated")}
          value={formatDateTime(detail.lastUpdatedOn)}
        />
      </div>

      <div className="financial-refunds-details__card">
        <div className="financial-refunds-details__card-title">
          {t("Finance.financialRefundsDetails.sections.refundApplicationInformation")}
        </div>
        <div className="financial-refunds-details__grid">
          <InfoField
            label={t("Finance.financialRefunds.table.paymentMethod")}
            value={detail.applicationInformation?.paymentMethod}
          />
          <InfoField
            label={t("Finance.financialRefundsDetails.fields.cardInformation")}
            value={applicationCardInformation}
          />
          <InfoField label={t("Finance.financialRefundsDetails.fields.email")} value={detail.applicationInformation?.email} />
          <InfoField label={t("Finance.financialRefunds.table.applyFor")} value={detail.applicationInformation?.applyFor} />
          <AmountField
            label={t("Finance.financialRefundsDetails.refundAmount")}
            amount={
              detail.applicationInformation?.refundAmount ??
              detail.applicationInformation?.amountCharged
            }
            currency={detail.applicationInformation?.currency}
            showNegative={true}
          />
          <InfoField
            label={t("Finance.financialRefundsDetails.fields.refundScope")}
            value={detail.applicationInformation?.refundScope}
          />
        </div>
        <div className="financial-refunds-details__divider" />
        <div className="financial-refunds-details__single-row">
          <InfoField
            label={t("Finance.financialRefundsDetails.fields.refundReason")}
            value={detail.applicationInformation?.refundReason}
          />
        </div>

        <div className="financial-refunds-details__nested-card">
          <div className="financial-refunds-details__nested-title">
            {t("Finance.financialRefundsDetails.sections.relatedPaymentInformation")}
          </div>
          <div className="financial-refunds-details__grid">
            <InfoField
              label={t("Finance.financialRefundsDetails.fields.transactionNumber")}
              value={detail.relatedPaymentInformation?.transactionNo}
            />
            <InfoField
              label={t("Finance.financialRefunds.table.status")}
              value={
                detail.relatedPaymentInformation?.status ? (
                  <span
                    className={`financial-refunds-details__status-text is-${getFinancialRefundStatusTone(
                      detail.relatedPaymentInformation.status,
                    )}`}
                  >
                    {getRelatedPaymentStatusLabel(
                      detail.relatedPaymentInformation.status,
                      t,
                    )}
                  </span>
                ) : undefined
              }
            />
            <InfoField
              label={t("Finance.financialRefundsDetails.fields.transactionType")}
              value={detail.relatedPaymentInformation?.transactionType}
            />
            <InfoField
              label={t("Finance.financialRefunds.table.lastUpdated")}
              value={formatDateTime(detail.relatedPaymentInformation?.lastUpdatedOn)}
            />
            <InfoField
              label={t("Finance.financialRefunds.table.paymentMethod")}
              value={detail.relatedPaymentInformation?.paymentMethod}
            />
            <InfoField
              label={t("Finance.financialRefundsDetails.fields.cardInformation")}
              value={relatedCardInformation}
            />
            <AmountField
              label={t("Finance.financialRefundsDetails.fields.amountCharged")}
              amount={detail.relatedPaymentInformation?.amountCharged}
              currency={detail.relatedPaymentInformation?.currency}
            />
            <InfoField
              label={t("Finance.financialRefunds.table.applyFor")}
              value={detail.relatedPaymentInformation?.applyFor}
            />
          </div>
          <div className="financial-refunds-details__divider" />
          <div className="financial-refunds-details__single-row">
            <InfoField
              label={t("Finance.financialRefundsDetails.fields.description")}
              value={relatedPaymentDescription}
            />
          </div>
        </div>
      </div>

      <div className="financial-refunds-details__footer detail-action-footer">
        <FooterActionButton
          variant="outline"
          onClick={() => history.push("/financial-payment/refunds")}
        >
          {t("common.back")}
        </FooterActionButton>
        {detail.canExecuteRefund ? (
          <FooterActionButton
            onClick={() => setConfirmVisible(true)}
            disabled={confirmSubmitting}
          >
            {t("Finance.financialRefunds.actions.refund")}
          </FooterActionButton>
        ) : (
          <Tooltip
            trigger={["hover"]}
            placement="top"
            title={detail.unsupportedReason || ""}
            getPopupContainer={() => document.body}
          >
            <span className="financial-refunds-details__action-anchor">
              <FooterActionButton disabled={true}>{t("Finance.financialRefunds.actions.refund")}</FooterActionButton>
            </span>
          </Tooltip>
        )}
      </div>

      <RefundConfirmModal
        visible={confirmVisible}
        preview={executionPreview}
        confirming={confirmSubmitting}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={handleExecuteRefund}
      />
    </div>
  );
}
