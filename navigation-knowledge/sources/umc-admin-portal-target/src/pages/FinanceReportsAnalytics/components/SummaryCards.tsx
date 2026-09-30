import financeReportsAedPrefixIcon from "@/assets/images/financeReportsAedPrefix.svg";
import financeReportsTotalPaymentsIcon from "@/assets/images/financeReportsTotalPayments.svg";
import financeReportsTotalRechargesIcon from "@/assets/images/financeReportsTotalRecharges.svg";
import financeReportsTotalRefundsIcon from "@/assets/images/financeReportsTotalRefunds.svg";
import financeReportsTotalRevenueIcon from "@/assets/images/financeReportsTotalRevenue.svg";
import OverflowTooltip from "@/components/common/OverflowTooltip";
import { useTranslation } from "react-i18next";
import type { SummaryCardData } from "../type";

const iconMap = {
  totalRevenue: financeReportsTotalRevenueIcon,
  totalPayments: financeReportsTotalPaymentsIcon,
  totalRecharges: financeReportsTotalRechargesIcon,
  totalRefunds: financeReportsTotalRefundsIcon,
};

const toneClassMap = {
  totalRevenue: "finance-reports__summary-icon--revenue",
  totalPayments: "finance-reports__summary-icon--payments",
  totalRecharges: "finance-reports__summary-icon--recharges",
  totalRefunds: "finance-reports__summary-icon--refunds",
};

interface SummaryCardsProps {
  items: SummaryCardData[];
}

export default function SummaryCards({ items }: SummaryCardsProps) {
  const { t: translate } = useTranslation();

  return (
    <div className="finance-reports__summary-grid">
      {items.map((item) => (
        <div
          key={item.key}
          className="finance-reports__summary-card finance-reports__card-surface"
        >
          <div
            className={`finance-reports__summary-icon ${toneClassMap[item.iconKey]}`}
          >
            <img
              src={iconMap[item.iconKey]}
              alt=""
              className="finance-reports__summary-icon-image"
            />
          </div>
          <div className="finance-reports__summary-copy">
            <div className="finance-reports__summary-value">
              {item.key === "totalRevenue" ? (
                <img
                  src={financeReportsAedPrefixIcon}
                  alt="AED"
                  className="finance-reports__summary-value-prefix"
                />
              ) : null}
              <span>{item.displayValue}</span>
            </div>
            <OverflowTooltip
              className="finance-reports__summary-label"
              title={translate(item.titleKey)}
            >
              {translate(item.titleKey)}
            </OverflowTooltip>
          </div>
        </div>
      ))}
    </div>
  );
}
