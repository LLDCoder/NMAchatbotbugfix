import { useTranslation } from "react-i18next";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import type {
  HorizontalBarData,
  ReportsAnalyticsTranslationKey,
} from "../type";

interface HorizontalBarsCardProps {
  titleKey: ReportsAnalyticsTranslationKey;
  data: HorizontalBarData;
  layoutVariant?: "default" | "permit";
}

export default function HorizontalBarsCard({
  titleKey,
  data,
  layoutVariant = "default",
}: HorizontalBarsCardProps) {
  const { t: translate, i18n } = useTranslation();
  const visibleItems = data.items;
  const maxValue = visibleItems.reduce(
    (highest, item) => Math.max(highest, item.value),
    0,
  );
  const isPermitLayout = layoutVariant === "permit";
  const isArabic = i18n.language?.toLowerCase().startsWith("ar") ?? false;
  const getDisplayLabel = (item: HorizontalBarData["items"][number]) => {
    const arabicLabel = item.labelAr?.trim();

    if (item.labelKey) {
      return translate(item.labelKey);
    }

    if (isArabic && arabicLabel) {
      return arabicLabel;
    }

    return item.label;
  };

  return (
    <div
      className={`content-reports__card content-reports__card-surface content-reports__bars-card ${
        isPermitLayout ? "content-reports__bars-card--permit" : ""
      }`}
    >
      <div className="content-reports__card-title">{translate(titleKey)}</div>
      {visibleItems.length === 0 ? (
        <div className="content-reports__chart-empty">
          <EmptyBox title={translate("common.noData")} />
        </div>
      ) : (
        <div className="content-reports__bar-list">
          {visibleItems.map((item) => (
            <div key={item.label} className="content-reports__bar-row">
              <div className="content-reports__bar-name">
                {getDisplayLabel(item)}
              </div>
              <div className="content-reports__bar-scale">
                <div
                  className="content-reports__bar-fill-anchor"
                  style={{
                    width: `${
                      maxValue > 0 ? Math.max((item.value / maxValue) * 100, 10) : 0
                    }%`,
                  }}
                >
                  <div
                    className="content-reports__bar-fill"
                    style={{
                      backgroundColor: data.color,
                    }}
                  />
                  <div className="content-reports__bar-meta">
                    <span className="content-reports__bar-value">
                      {item.value.toLocaleString()}
                    </span>
                    <span className="content-reports__bar-percentage">
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
