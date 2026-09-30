import { Tooltip } from "antd";
import moment from "moment";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Sousuo from "@/assets/icons/Sousuo";
import { overviewFigmaAssets } from "@/components/common/ApplicationOverviewCards/assets/overviewFigmaAssets";
import type { InspectionOverviewStats } from "../../types";
import {
  getViolationStatusClassName,
  getViolationStatusLabel,
} from "@/pages/InspectionCommon/helpers";

type OverviewRangeValue = [moment.Moment | null, moment.Moment | null] | null;

const OVERVIEW_DATE_FORMATS = [
  moment.ISO_8601,
  "YYYY-MM-DD HH:mm:ss",
  "YYYY-MM-DD HH:mm",
  "YYYY-MM-DD",
  "DD/MM/YYYY HH:mm:ss",
  "DD/MM/YYYY HH:mm",
  "DD/MM/YYYY",
];

export const normalizeOverviewText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");

export const parseOverviewMoment = (value?: string) => {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return null;
  const parsed = moment(text, OVERVIEW_DATE_FORMATS, true);
  return parsed.isValid() ? parsed : null;
};

export const formatOverviewDateTime = (value?: string) => {
  if (!value || value === "-") return "-";
  const parsed = parseOverviewMoment(value);
  return parsed ? parsed.format("DD/MM/YYYY HH:mm:ss") : value;
};

export const formatOverviewDate = (value?: string) => {
  if (!value || value === "-") return "-";
  const parsed = parseOverviewMoment(value);
  return parsed ? parsed.format("DD/MM/YYYY") : value;
};

export const formatOverviewRequestDateTime = (
  value?: moment.Moment | null,
) => {
  if (!value?.isValid()) return undefined;
  return value.format("YYYY-MM-DDTHH:mm:ss");
};

export const isOverviewDateInRange = (
  dateValue: string | undefined,
  range: OverviewRangeValue,
) => {
  if (!range || (!range[0] && !range[1])) return true;
  const parsed = parseOverviewMoment(dateValue);
  if (!parsed) return false;
  const [start, end] = range;
  if (start && parsed.isBefore(start.clone().startOf("day"), "millisecond")) {
    return false;
  }
  if (end && parsed.isAfter(end.clone().endOf("day"), "millisecond")) {
    return false;
  }
  return true;
};

export const compareOverviewDates = (
  left?: string,
  right?: string,
) => {
  const leftParsed = parseOverviewMoment(left);
  const rightParsed = parseOverviewMoment(right);
  if (!leftParsed && !rightParsed) return 0;
  if (!leftParsed) return 1;
  if (!rightParsed) return -1;
  return leftParsed.valueOf() - rightParsed.valueOf();
};

export const getOverviewStatusClassName = (status?: string) => {
  const normalized = normalizeOverviewText(status);
  const success = new Set([
    "approved",
    "appealapproved",
    "paid",
    "completed",
    "refunded",
  ]);
  const danger = new Set([
    "rejected",
    "appealrejected",
    "accessfailed",
    "failed",
  ]);
  const active = new Set([
    "inprogress",
    "underappeal",
  ]);
  const orange = new Set([
    "pendingvisit",
    "departmentprocessed",
    "warningissued",
  ]);
  const yellow = new Set([
    "pendingpayment",
    "pendingrouting",
    "pendingcontentreport",
    "pendingcommitteedecision",
    "pendingapproval",
    "pendingcustomer",
    "pendingrefund",
    "pendingreview",
    "reportsubmitted",
    "underreview",
    "reviewinprogress",
    "departmentprocessing",
    "queued",
    "assigned",
  ]);

  if (success.has(normalized)) return "overview-status-pill overview-status-pill--success";
  if (danger.has(normalized)) return "overview-status-pill overview-status-pill--danger";
  if (active.has(normalized)) return "overview-status-pill overview-status-pill--active";
  if (orange.has(normalized)) return "overview-status-pill overview-status-pill--warning";
  if (yellow.has(normalized)) return "overview-status-pill overview-status-pill--pending";
  return "overview-status-pill overview-status-pill--neutral";
};

export const getOverviewPriorityClassName = (priority?: string) => {
  const normalized = normalizeOverviewText(priority);
  if (normalized.includes("high") || normalized.includes("critical")) {
    return "overview-priority-pill overview-priority-pill--high";
  }
  if (normalized.includes("medium")) {
    return "overview-priority-pill overview-priority-pill--medium";
  }
  return "overview-priority-pill overview-priority-pill--low";
};

function useOverviewOverflowDetector<T extends HTMLElement>(watchValue: string) {
  const elementRef = useRef<T>(null);
  const [tooltipEnabled, setTooltipEnabled] = useState(false);

  const updateTooltipState = useCallback(() => {
    const element = elementRef.current;

    if (!element) {
      setTooltipEnabled(false);
      return;
    }

    const isOverflowing =
      element.scrollWidth > element.clientWidth + 1 ||
      element.scrollHeight > element.clientHeight + 1;

    setTooltipEnabled((current) => (
      current === isOverflowing ? current : isOverflowing
    ));
  }, []);

  useEffect(() => {
    updateTooltipState();

    const element = elementRef.current;
    if (!element) return undefined;

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(updateTooltipState)
      : null;

    resizeObserver?.observe(element);
    window.addEventListener("resize", updateTooltipState);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateTooltipState);
    };
  }, [watchValue, updateTooltipState]);

  return {
    elementRef,
    tooltipEnabled,
  };
}

function OverviewStatusTooltip({
  text,
  className,
  children,
}: {
  text: string;
  className: string;
  children?: ReactNode;
}) {
  const { elementRef, tooltipEnabled } =
    useOverviewOverflowDetector<HTMLSpanElement>(text);

  return (
    <Tooltip
      title={tooltipEnabled ? text : undefined}
      overlayClassName="overview-status-tooltip"
      destroyTooltipOnHide
    >
      <span ref={elementRef} className={className}>
        {children ?? text}
      </span>
    </Tooltip>
  );
}

export const renderOverviewStatusPill = (status?: string) => (
  <OverviewStatusTooltip
    text={status || "-"}
    className={getOverviewStatusClassName(status)}
  />
);

const INSPECTION_STATUS_VARIANTS: Partial<
  Record<keyof InspectionOverviewStats, "success" | "warning" | "pending" | "neutral">
> = {
  pendingVisit: "warning",
  inProgress: "pending",
  accessFailed: "warning",
  completed: "success",
  cancelled: "neutral",
};

export const renderInspectionOverviewStatusPill = (
  status?: string,
  statusKey?: keyof InspectionOverviewStats,
) => {
  const variant = statusKey ? INSPECTION_STATUS_VARIANTS[statusKey] : undefined;

  return (
    <OverviewStatusTooltip
      text={status || "-"}
      className={
        variant
          ? `overview-status-pill overview-status-pill--${variant}`
          : getOverviewStatusClassName(status)
      }
    />
  );
};

export const renderOverviewViolationStatusPill = (status?: string) => {
  const label = status ? getViolationStatusLabel(status) : "-";

  return (
    <OverviewStatusTooltip
      text={label}
      className={`overview-status-pill overview-status-pill--${getViolationStatusClassName(status)}`}
    />
  );
};

export const renderOverviewPriorityPill = (priority?: string) => (
  <span className={getOverviewPriorityClassName(priority)}>{priority || "-"}</span>
);

export const renderOverviewSearchPrefix = () => (
  <Sousuo className="overview-search-icon" aria-hidden="true" />
);

export const renderFilterButtonIcon = () => (
  <img className="overview-filter-button__icon" src={overviewFigmaAssets.filter.funnel} alt="" />
);

export const renderOverviewEntityCell = (value?: string, className = "") => (
  <span className={`overview-entity-cell ${className}`.trim()}>
    <img
      className="overview-entity-cell__icon"
      src={overviewFigmaAssets.inspectionTargets.company}
      alt=""
    />
    <span className="overview-entity-cell__text">{value || "-"}</span>
  </span>
);

export const includesOverviewKeyword = (
  values: unknown[],
  keyword: string,
) => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;
  return values.some((value) =>
    String(value || "").toLowerCase().includes(normalizedKeyword),
  );
};
