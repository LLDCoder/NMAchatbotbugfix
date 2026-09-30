import { useTranslation } from "react-i18next";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import type {
  HorizontalBarData,
  ReportsAnalyticsTranslationKey,
} from "../type";

interface HorizontalBarsCardProps {
  titleKey: ReportsAnalyticsTranslationKey;
  titleTag?: string;
  data: HorizontalBarData;
}

export default function HorizontalBarsCard({
  titleKey,
  titleTag,
  data,
}: HorizontalBarsCardProps) {
  const { t: translate } = useTranslation();
  const usesDynamicLabelColumn = [
    "licenseReportsAnalytics.charts.applicationsByLocation",
    "licenseReportsAnalytics.charts.licensesByLocation",
  ].includes(titleKey);
  const visibleItems = data.items;
  const maxValue = visibleItems.reduce(
    (highest, item) => Math.max(highest, item.value),
    0,
  );

  return (
    <div
      className={`reports-card analytics-card-surface reports-bars-card${
        usesDynamicLabelColumn
          ? " reports-bars-card--dynamic-label-column"
          : ""
      }`}
    >
      <div className="reports-card-title">
        {translate(titleKey)}
        {titleTag && (
          <span className="reports-card-title-tag">{titleTag}</span>
        )}
      </div>
      {visibleItems.length === 0 ? (
        <div className="reports-chart-empty">
          <EmptyBox title={translate("common.noData")} />
        </div>
      ) : (
        <div className="reports-bar-list">
          {visibleItems.map((item) => (
            <div key={item.label} className="reports-bar-row">
              <div className="reports-bar-name">
                {item.labelKey ? translate(item.labelKey) : item.label}
              </div>
              <div className="reports-bar-scale">
                <div
                  className="reports-bar-fill-anchor"
                  style={{
                    width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%`,
                    // Keep zero values visible without using the larger CSS min-width.
                    minWidth: item.value === 0 ? 2 : undefined,
                  }}
                >
                  <div
                    className="reports-bar-fill"
                    style={{
                      backgroundColor: data.color,
                    }}
                  />
                  <div className="reports-bar-meta">
                    <span className="reports-bar-value">
                      {item.value.toLocaleString()}
                    </span>
                    <span className="reports-bar-percentage">
                      {item.percentage.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
