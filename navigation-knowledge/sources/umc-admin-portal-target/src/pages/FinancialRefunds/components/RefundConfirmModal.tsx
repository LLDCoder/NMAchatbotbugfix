import { Modal, Spin } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import warningGoldIcon from "@/assets/images/warning-gold.png";
import AEDRED from "@/assets/images/red-aed.svg";
import { CustomButton } from "@/components/common";
import formatMoney from "@/utils/formatMoney";
import type { RefundExecutionPreview } from "@/services/financialRefunds";
import { useTranslation } from "react-i18next";
import "./RefundConfirmModal.less";

interface RefundConfirmModalProps {
  visible: boolean;
  preview: RefundExecutionPreview | null;
  loading?: boolean;
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const isWalletMethod = (paymentMethod?: string | null) =>
  paymentMethod?.toLowerCase().includes("wallet");

const renderRow = (label: string, value: string | number | null | undefined) => (
  <div className="refund-confirm-modal__row" key={label}>
    <span className="refund-confirm-modal__label">{label}</span>
    <span className="refund-confirm-modal__value">{value || "-"}</span>
  </div>
);

export default function RefundConfirmModal({
  visible,
  preview,
  loading = false,
  confirming = false,
  onCancel,
  onConfirm,
}: RefundConfirmModalProps) {
  const { t } = useTranslation();
  const walletMethod = isWalletMethod(preview?.paymentMethod);
  const amountValue = preview?.amount ? formatMoney(Math.abs(preview.amount)) : null;

  return (
    <Modal
      visible={visible}
      footer={null}
      closable={false}
      centered
      destroyOnClose={true}
      width={640}
      className="refund-confirm-modal"
      onCancel={onCancel}
    >
      <div className="refund-confirm-modal__header">
        <div className="refund-confirm-modal__title">{t("Finance.financialRefunds.actions.refund")}</div>
        <button
          type="button"
          className="refund-confirm-modal__close"
          onClick={onCancel}
          aria-label={t("common.close", "Close")}
        >
          <CloseOutlined />
        </button>
      </div>

      <div className="refund-confirm-modal__alert">
        <img src={warningGoldIcon} alt="" />
        <span>
          {t("Finance.financialRefunds.confirmModal.warning")}
        </span>
      </div>

      <div className="refund-confirm-modal__body">
        {loading ? (
          <div className="refund-confirm-modal__loading">
            <Spin />
          </div>
        ) : (
          <div className="refund-confirm-modal__rows">
            {renderRow(t("Finance.financialRefunds.table.transactionNo"), preview?.originalTransactionNo)}
            <div className="refund-confirm-modal__row">
              <span className="refund-confirm-modal__label">{t("Finance.financialRefunds.details.refundAmount")}</span>
              <span className="refund-confirm-modal__value refund-confirm-modal__value--danger">
                {amountValue ? (
                  <span className="refund-confirm-modal__amount">
                    <span>-</span>
                    <img src={AEDRED} alt={preview?.currency || "AED"} />
                    <span>{amountValue}</span>
                  </span>
                ) : (
                  "-"
                )}
              </span>
            </div>
            {walletMethod
              ? [
                  renderRow(t("Finance.financialRefunds.details.accountHolder"), preview?.accountOrCardHolder),
                  renderRow(t("Finance.financialRefunds.details.account"), preview?.email),
                ]
              : [
                  renderRow(t("Finance.financialRefunds.details.cardInformation"), preview?.cardInformation),
                ]}
          </div>
        )}
      </div>

      <div className="refund-confirm-modal__footer">
        <CustomButton
          text={t("common.cancel")}
          variant="outline"
          onClick={onCancel}
          disabled={confirming}
          customClassName="refund-confirm-modal__button refund-confirm-modal__button--cancel"
        />
        <CustomButton
          text={t("common.confirm")}
          onClick={onConfirm}
          loading={confirming}
          disabled={loading || !preview}
          customClassName="refund-confirm-modal__button"
        />
      </div>
    </Modal>
  );
}
