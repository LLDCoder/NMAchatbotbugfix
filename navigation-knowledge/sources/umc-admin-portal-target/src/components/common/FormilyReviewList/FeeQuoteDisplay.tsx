import { useState } from "react";
import { Spin, Result } from "antd";
import AED from "@/assets/icons/Aed";
import CollapsibleCardHeader from "@/components/common/CollapsibleCardHeader";
import type { FeeQuoteResponse } from "@/services/services";
import { preferLocalizedEnAr } from "@/utils/bilingualDisplay";
import "./FeeQuoteDisplay.less";
import "./ServicesFee.less";
import { useTranslation } from "react-i18next";

const formatAmount = (amount?: number | null) => {
  const normalizedAmount = Number(amount ?? 0);

  return (Number.isFinite(normalizedAmount) ? normalizedAmount : 0).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );
};

export interface FeeQuoteDisplayProps {
  quoteData: FeeQuoteResponse | null;
  quoteLoading: boolean;
  quoteError: string | null;
}

export default function FeeQuoteDisplay({
  quoteData,
  quoteLoading,
  quoteError,
}: FeeQuoteDisplayProps) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const isArabic = i18n.language?.toLowerCase().startsWith("ar") ?? false;
  const currency = String(quoteData?.currency || "AED").trim().toUpperCase() || "AED";
  const breakdown = Array.isArray(quoteData?.breakdown)
    ? quoteData.breakdown
    : [];
  const feeRows = breakdown.map((item, index) => {
    const localizedChargeName = preferLocalizedEnAr(
      isArabic,
      item.chargeName,
      item.chargeNameAr,
    );
    const fallbackChargeName = preferLocalizedEnAr(
      !isArabic,
      item.chargeName,
      item.chargeNameAr,
    );

    return {
      key:
        item.legacyG3Code ||
        item.legacyCode ||
        item.code ||
        `fee-${index + 1}`,
      chargeName: localizedChargeName || fallbackChargeName || "-",
      amount: Number(item.amount ?? 0),
    };
  });

  const renderCurrency = (className: string) =>
    currency === "AED" ? (
      <AED
        withParentheses={false}
        className={className}
        aria-hidden
      />
    ) : (
      <span className={className}>{currency}</span>
    );

  if (!quoteLoading && !quoteError && !quoteData) {
    return null;
  }

  return (
    <div className="ServicesFeesCard fee-quote-display-wrap">
      <CollapsibleCardHeader
        title={t("FormilyReviewList.servicesFees")}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
      />

      <div className="info-block fee-quote-display" hidden={!expanded}>
        {quoteLoading ? (
          <div className="fee-quote-loading">
            <Spin tip={t("FormilyReviewList.loadingFees")} />
          </div>
        ) : quoteError ? (
          <Result
            status="error"
            title={t("FormilyReviewList.feeLoadFailed")}
            subTitle={quoteError}
          />
        ) : (
          quoteData && (
            <div className="fee-quote-table">
              <div className="fee-quote-table__header">
                {/* <div className="col-code">{t("FormilyReviewList.code")}</div> */}
                <div className="fee-quote-table__number">
                  {t("FormilyReviewList.number")}
                </div>
                <div className="fee-quote-table__activity">
                  <span className="fee-quote-table__activity-text">
                    {t("FormilyReviewList.activity")}
                  </span>
                </div>
                <div className="fee-quote-table__amount">
                  {t("FormilyReviewList.feesInAED")} (
                  {renderCurrency("fee-quote-table__currency")}
                  )
                </div>
              </div>

              {feeRows.map((item, index) => (
                <div
                  key={`${item.key}-${index}`}
                  className="fee-quote-table__row"
                >
                  {/* <div className="col-code">{item.code || "—"}</div> */}
                  <div className="fee-quote-table__number">{index + 1}</div>
                  <div className="fee-quote-table__activity">
                    <span className="fee-quote-table__activity-text">
                      {item.chargeName}
                    </span>
                  </div>
                  <div className="fee-quote-table__amount">
                    {formatAmount(item.amount)}
                  </div>
                </div>
              ))}

              <div className="fee-quote-table__footer">
                <div className="fee-quote-table__total-label">
                  {t("FormilyReviewList.totalFee")}
                </div>
                <div className="fee-quote-table__total-amount">
                  {renderCurrency("fee-quote-table__total-currency")}
                  <span className="fee-quote-table__total-value">
                    {formatAmount(quoteData.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
