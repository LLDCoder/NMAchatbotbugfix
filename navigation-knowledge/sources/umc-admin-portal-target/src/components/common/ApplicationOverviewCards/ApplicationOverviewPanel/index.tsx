import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
import CollapsibleCardHeader from "@/components/common/CollapsibleCardHeader";
import CustomMessage from "@/components/common/CustomMessage";
import HistoricalTickets from "@/assets/icons/HistoricalTickets";
import HistoricalApplications from "@/assets/icons/HistoricalApplications";
import Appeal from "@/assets/icons/Appeal";
import Refund from "@/assets/icons/Refund";
import {
  getTaskType,
  type IRelateAppsResponse,
} from "@/services/tickets";
import { useApplicationOverviewData } from "../ApplicationOverviewDataContext";
import RelatedSectionCard, {
  type RelatedSectionCardProps,
} from "../RelatedSectionCard";
import {
  buildLatestRelatedSectionsByStatisticKey,
  type RelatedSectionStatisticKey,
} from "../utils/relatedSection";
import "./index.less";

type OverviewStatisticKey = RelatedSectionStatisticKey;

interface OverviewStatisticItem {
  key: OverviewStatisticKey;
  label: string;
  count: number;
  icon: JSX.Element;
}

interface ApplicationOverviewPanelProps {
  isExpanded?: boolean;
  onExpand?: () => void;
  onShrink?: () => void;
  onStatisticClick?: (key: OverviewStatisticKey) => void;
  onRelatedApplicationReferenceClick?: (applicationNo: string) => void;
  relatedSectionData?: IRelateAppsResponse;
  currentApplicationNumber?: string;
  currentEnquiryNumber?: string;
  currentServiceId?: string | number | null;
}

const TICKETS_DETAILS_ROUTE_MATCHER = /\/happiness\/tickets\/tickets-details$/i;

const ROUTE_EXPANSION_PRIORITY: Array<{
  matcher: RegExp;
  keys: OverviewStatisticKey[];
}> = [
  {
    matcher: /\/licensing\/applications\/applicationsDetails$/i,
    keys: ["historicalApplications"],
  },
  {
    matcher: /\/content\/ContentApplications\/ContentApplicationsDetails$/i,
    keys: ["historicalApplications"],
  },
  {
    matcher: TICKETS_DETAILS_ROUTE_MATCHER,
    keys: ["historicalTicketsEnquiry"],
  },
  {
    matcher: /\/happiness\/refunds\/refundsDetails$/i,
    keys: ["appeal", "historicalApplications", "refund"],
  },
];

const HISTORICAL_APPLICATION_FILTER_ROUTES = [
  /\/licensing\/applications\/applicationsDetails$/i,
  /\/content\/ContentApplications\/ContentApplicationsDetails$/i,
];

const HIDE_RELATED_SECTION_ROUTES = [
  /\/licensing\/license\/LicenseDatails$/i,
];

const RELATED_ENQUIRY_SOURCE = "ApplicationOverviewRelatedEnquiries";

const buildRouteWithQuery = (
  pathname: string,
  query: Record<string, string>,
) => {
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  return `${pathname}?${searchParams.toString()}`;
};

const resolveRelatedApplicationDetailPath = (
  taskId?: string | null,
  departmentId?: number | null,
) => {
  const normalizedTaskId = String(taskId ?? "").trim();

  if (!normalizedTaskId) {
    return null;
  }

  if (departmentId === 1) {
    return buildRouteWithQuery(
      "/licensing/applications/applicationsDetails",
      {
        taskId: normalizedTaskId,
      },
    );
  }

  if (departmentId === 2) {
    return buildRouteWithQuery(
      "/content/ContentApplications/ContentApplicationsDetails",
      {
        taskId: normalizedTaskId,
      },
    );
  }

  return null;
};

export default function ApplicationOverviewPanel({
  isExpanded = false,
  onExpand,
  onShrink,
  onStatisticClick,
  onRelatedApplicationReferenceClick,
  relatedSectionData,
  currentApplicationNumber,
  currentEnquiryNumber,
  currentServiceId,
}: ApplicationOverviewPanelProps) {
  const { t, i18n } = useTranslation();
  const history = useHistory();
  const isArabic = i18n.language?.toLowerCase().startsWith("ar");
  const { pathname } = useLocation();
  const isTicketsDetailsRoute = TICKETS_DETAILS_ROUTE_MATCHER.test(pathname);
  const { applicationOverviewRelatedSectionData } = useApplicationOverviewData();
  const [isOpen, setIsOpen] = useState(false);
  const resolvedRelatedSectionData =
    relatedSectionData ?? applicationOverviewRelatedSectionData ?? undefined;

  const data: IRelateAppsResponse =
    resolvedRelatedSectionData ?? ({} as IRelateAppsResponse);

  const statistics: OverviewStatisticItem[] = [
    {
      key: "historicalApplications",
      label: t("Customer.ticketsDetails.applicationOverview.historicalApplications"),
      count: data.applicationCount ?? 0,
      icon: <HistoricalApplications />,
    },
    {
      key: "historicalTicketsEnquiry",
      label: t(
        "Customer.ticketsDetails.applicationOverview.historicalTicketsEnquiry",
      ),
      count: data.enquiryServiceCount ?? 0,
      icon: <HistoricalTickets />,
    },
    {
      key: "refund",
      label: t("Customer.ticketsDetails.applicationOverview.refund"),
      count: data.refundCount ?? 0,
      icon: <Refund />,
    },
    {
      key: "appeal",
      label: t("Customer.ticketsDetails.applicationOverview.appeal"),
      count: data.appealCount ?? 0,
      icon: <Appeal />,
    },
  ];

  const shouldFilterHistoricalApplications =
    HISTORICAL_APPLICATION_FILTER_ROUTES.some((matcher) => matcher.test(pathname));
  const shouldHideRelatedSections = HIDE_RELATED_SECTION_ROUTES.some((matcher) =>
    matcher.test(pathname),
  );

  const latestSectionsByKey = buildLatestRelatedSectionsByStatisticKey({
    data: resolvedRelatedSectionData,
    language: i18n.language,
    t,
    shouldFilterHistoricalApplications,
    currentApplicationNumber,
    currentEnquiryNumber,
    currentServiceId,
  });

  const getSectionByStatisticKey = (key: OverviewStatisticKey) =>
    latestSectionsByKey[key] ?? null;

  const routePreferenceKeys =
    ROUTE_EXPANSION_PRIORITY.find(({ matcher }) => matcher.test(pathname))?.keys ??
    [];

  const routeExpandedStatisticKey =
    routePreferenceKeys.find((key) => Boolean(getSectionByStatisticKey(key))) ??
    null;

  const handleStatisticItemKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    key: OverviewStatisticKey,
  ) => {
    if (!onStatisticClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onStatisticClick(key);
    }
  };

  const getRelatedSectionReferenceClickHandler = (
    section: RelatedSectionCardProps | null,
  ) => {
    if (!section) {
      return undefined;
    }

    const referenceNo = String(section.referenceNo ?? "").trim();

    if (!referenceNo || referenceNo === "-") {
      return undefined;
    }

    if (section.variant === "relatedEnquiry") {
      const enquiryId = String(section.enquiryId ?? "").trim();

      if (!enquiryId || enquiryId === "-") {
        return undefined;
      }

      return () => {
        const relatedEnquiryQuery: Record<string, string> = {
          id: enquiryId,
        };

        if (isTicketsDetailsRoute) {
          relatedEnquiryQuery.from = RELATED_ENQUIRY_SOURCE;
        }

        history.push(
          buildRouteWithQuery(
            "/happiness/tickets/tickets-details",
            relatedEnquiryQuery,
          ),
        );
      };
    }

    if (section.variant === "relatedAppeal") {
      const appealId = String(section.appealId ?? "").trim();

      if (!appealId || appealId === "-") {
        return undefined;
      }

      return () => {
        history.push(
          buildRouteWithQuery("/happiness/appeals/appealsDetails", {
            appealId,
          }),
        );
      };
    }

    if (section.variant === "relatedApplication") {
      const applicationNo = String(section.applicationNo ?? "").trim();

      if (!applicationNo || applicationNo === "-") {
        return undefined;
      }

      return async () => {
        if (onRelatedApplicationReferenceClick) {
          onRelatedApplicationReferenceClick(applicationNo);
          return;
        }

        try {
          const response = await getTaskType(
            { applicationNo },
            { skipErrorMessage: true },
          );
          const payload = (
            response as {
              data?: {
                taskId?: string;
                departmentId?: number;
              };
            }
          )?.data;
          const resolvedPath = resolveRelatedApplicationDetailPath(
            payload?.taskId,
            payload?.departmentId,
          );

          if (resolvedPath) {
            history.push(resolvedPath);
            return;
          }
        } catch {
          // Use the shared warning below for failed lookups.
        }

        CustomMessage.warning(
          t("Customer.customerRefunds.messages.relatedApplicationNotFound"),
        );
      };
    }

    return undefined;
  };
  
  return (
    <section
      className={`application-overview${
        isArabic ? " application-overview--rtl" : ""
      }`}
    >
      <CollapsibleCardHeader
        title={t("Customer.ticketsDetails.applicationOverview.title")}
        expanded={isOpen}
        onToggle={() => setIsOpen((current) => !current)}
        action={
          isExpanded
            ? onShrink
              ? {
                  kind: "shrink",
                  ariaLabel: t("common.closeExpandedView", {
                    title: t("Customer.ticketsDetails.applicationOverview.title"),
                  }),
                  onClick: onShrink,
                }
              : undefined
            : onExpand
            ? {
                kind: "expand",
                ariaLabel: t("common.openExpandedView", {
                  title: t("Customer.ticketsDetails.applicationOverview.title"),
                }),
                onClick: onExpand,
              }
            : undefined
        }
      />

      <div className="application-overview-box" hidden={!isOpen}>
        <div className="application-overview-statistic-list">
          {statistics.map((item) => {
            const latestSection = getSectionByStatisticKey(item.key);
            const visibleSections =
              !shouldHideRelatedSections &&
              latestSection &&
              (!routePreferenceKeys.length ||
                routeExpandedStatisticKey === item.key)
                ? [latestSection]
                : [];
            const sectionTitle = latestSection?.title || "";

            return (
            <div key={item.key} className="application-overview-statistic-entry">
              <div
                className={`application-overview-statistic-item ${
                  onStatisticClick ? "is-clickable" : ""
                }`}
                onClick={() => onStatisticClick?.(item.key)}
                role={onStatisticClick ? "button" : undefined}
                tabIndex={onStatisticClick ? 0 : undefined}
                onKeyDown={(event) => handleStatisticItemKeyDown(event, item.key)}
              >
                <div className="application-overview-si-title-wrapper">
                  <span className="application-overview-si-icon">{item.icon}</span>
                  <span className="application-overview-si-title">{item.label}</span>
                </div>
                <div className="application-overview-si-num">{item.count}</div>
              </div>

              {visibleSections.length ? (
                <div className="application-overview-related-group">
                  {sectionTitle ? (
                    <div className="application-overview-related-title">
                      {sectionTitle}
                    </div>
                  ) : null}

                  {visibleSections.map((section, index) => (
                    <RelatedSectionCard
                      key={`${section.variant}-${section.referenceNo}-${index}`}
                      {...section}
                      hideTitle
                      onReferenceClick={getRelatedSectionReferenceClickHandler(
                        section,
                      )}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
