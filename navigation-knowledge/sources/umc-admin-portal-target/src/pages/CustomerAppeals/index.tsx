import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatePicker, Input, Select, Spin, Table, Tabs, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import type {
  SorterResult,
  TablePaginationConfig,
} from "antd/es/table/interface";
import moment from "moment";
import type { Moment } from "moment";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CustomMessage, PaginationTotal, PermissionGuard } from "@/components/common";
import AdaptiveActionGroup from "@/components/common/AdaptiveActionGroup";
import { getAdaptiveActionColumnKeys } from "@/components/common/AdaptiveActionGroup/layout";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import { KEEP_ALIVE_RESTORE_STATE_KEY } from "@/components/KeepAlive/constants";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import useKeepAliveRouteState from "@/components/KeepAlive/useKeepAliveRouteState";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import { buildPaginationOptionText } from "@/utils/antdLocale";
import { pxToRemValue } from "@/utils/rem";
import { inspectionFigmaAssets } from "@/pages/InspectionCommon/assets";
import { INSPECTION_QUERY_KEYS } from "@/pages/InspectionCommon/constants";
import { buildInspectionPath } from "@/pages/InspectionCommon/helpers";
import {
  cancelAllAppealViolationItems,
  changeInspectionAppealStatus,
  exportInspectionAppealList,
  getInspectionAppealDetail,
  getInspectionAppealList,
  getInspectionAppealTimeline,
  getInspectionAppealReasons,
  getInspectionAppealStats,
  type InspectionAppealLookupOption,
  processInspectionAppeal,
  sendBackInspectionAppeal,
} from "@/services/inspectionAppeals";
import AppealDepartmentTransferModal from "./components/AppealDepartmentTransferModal";
import AppealFilterModal from "./components/AppealFilterModal";
import { AppealFilterIcon, AppealSearchIcon } from "./components/AppealIcons";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";
import AppealStatusModal from "./components/AppealStatusModal";
import {
  APPEAL_ROLE_CONFIG,
  DEFAULT_APPEAL_VIEW_ROLE,
} from "./roleConfig";
import type { AppealRowAction } from "./roleConfig";
import {
  useCanOpenCustomerAppealViolationDetail,
  useCustomerAppealsAccess,
} from "./access";
import {
  buildAppealFilterOptions,
  canShowChangeStatusAction,
  isAppealStatusAllowed,
  mapAppealAttachmentToWriteDto,
  mapAppealListResponse,
  mapAppealSummaryItems,
  mapDepartmentCode,
  mapRecommendationToTypeId,
  mergeAppealDetail,
  resolveAllowedFinalStatuses,
} from "./apiAdapter";
import {
  APPEAL_REASON_OPTIONS,
  APPEAL_STATUS_ID_MAP,
  formatAppealDateTime,
  formatAppealSummaryCount,
  getAppealApplyForIcon,
  getAppealDepartmentTranslationKey,
  getAppealReasonTranslationKey,
  getAppealSlaCompletionLabel,
  getAppealSlaLabel,
  getAppealSummaryIconClassName,
  getAppealSummaryIconSrc,
  getAppealSummaryTranslationKey,
  getAppealStatusClassName,
  getAppealStatusTranslationKey,
} from "./utils";
import type {
  AppealApplyFor,
  AppealDepartmentProcessPayload,
  AppealFilterOptions,
  AppealListFilters,
  AppealRecord,
  AppealSendBackPayload,
  AppealStatus,
  AppealStatusChangePayload,
  AppealTabKey,
  AppealViewRole,
} from "./types";
import "./index.less";

const DEFAULT_PAGE_SIZE = 10;
const CUSTOMER_APPEALS_PATH = "/happiness/appeals";
const CUSTOMER_APPEALS_DETAILS_PATH = "/happiness/appeals/appealsDetails";
const CUSTOMER_APPEALS_VIOLATION_ROUTE_FROM = "appeals";
const APPEAL_TABLE_VIEWPORT_WIDTH = 1472;
const APPEAL_COMPLETED_COLUMN_WIDTH = APPEAL_TABLE_VIEWPORT_WIDTH / 7;
type AppealTodoColumnWidths = {
  appealNo: number;
  appealReason: number;
  violationNo: number;
  applyFor: number;
  sla: number;
  currentHandler: number;
  status: number;
  lastUpdated: number;
  actions: number;
};
type AppealCompletedColumnWidths = Pick<
  AppealTodoColumnWidths,
  | "appealNo"
  | "appealReason"
  | "violationNo"
  | "applyFor"
  | "sla"
  | "status"
  | "lastUpdated"
>;

function sumColumnWidths<T extends Record<string, number>>(columns: T) {
  return Object.values(columns).reduce(
    (totalWidth, columnWidth) => totalWidth + columnWidth,
    0,
  );
}

const APPEAL_CUSTOMER_HAPPINESS_TODO_COLUMN_WIDTHS: AppealTodoColumnWidths = {
  appealNo: 160,
  appealReason: 160,
  violationNo: 160,
  applyFor: 160,
  sla: 150,
  currentHandler: 160,
  status: 210,
  lastUpdated: 160,
  actions: 227,
};
const APPEAL_BUSINESS_TODO_COLUMN_WIDTHS: AppealTodoColumnWidths = {
  appealNo: 160,
  appealReason: 160,
  violationNo: 160,
  applyFor: 160,
  sla: 150,
  currentHandler: 160,
  status: 200,
  lastUpdated: 160,
  actions: 208,
};
const APPEAL_COMPLETED_COLUMN_WIDTHS: AppealCompletedColumnWidths = {
  appealNo: APPEAL_COMPLETED_COLUMN_WIDTH,
  appealReason: APPEAL_COMPLETED_COLUMN_WIDTH,
  violationNo: APPEAL_COMPLETED_COLUMN_WIDTH,
  applyFor: APPEAL_COMPLETED_COLUMN_WIDTH,
  sla: APPEAL_COMPLETED_COLUMN_WIDTH,
  status: APPEAL_COMPLETED_COLUMN_WIDTH,
  lastUpdated: APPEAL_COMPLETED_COLUMN_WIDTH,
};
const APPEAL_COMPLETED_TABLE_SCROLL_WIDTH = sumColumnWidths(
  APPEAL_COMPLETED_COLUMN_WIDTHS,
);
type AppealActionColumnKey = AppealRowAction | "more";

const APPEAL_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<AppealActionColumnKey> =
  {
    more: { default: 20, compact: 20 },
  };
const APPEAL_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 128,
  maxWidth: 280,
};
const APPEAL_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 112,
  maxWidth: 260,
};
const APPEAL_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};
const CUSTOMER_APPEALS_VIOLATION_DETAIL_PATH =
  "/happiness/appeals/violationDetails";

function getAppealTodoColumnWidths(
  viewRole: AppealViewRole,
): AppealTodoColumnWidths {
  return viewRole === "customer_happiness"
    ? APPEAL_CUSTOMER_HAPPINESS_TODO_COLUMN_WIDTHS
    : APPEAL_BUSINESS_TODO_COLUMN_WIDTHS;
}

function buildAppealViolationDetailPath(record: AppealRecord) {
  return buildInspectionPath(CUSTOMER_APPEALS_VIOLATION_DETAIL_PATH, "", {
    [INSPECTION_QUERY_KEYS.from]: CUSTOMER_APPEALS_VIOLATION_ROUTE_FROM,
    [INSPECTION_QUERY_KEYS.violationId]: record.violationId,
    [INSPECTION_QUERY_KEYS.violationNo]: record.violationNo,
  });
}

function useOverflowDetector<T extends HTMLElement>(watchValue: string) {
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

function OverflowTooltip({
  text,
  className = "",
  children,
}: {
  text?: string | number | null;
  className?: string;
  children?: React.ReactNode;
}) {
  const textValue = String(text ?? "");
  const { elementRef, tooltipEnabled } = useOverflowDetector<HTMLSpanElement>(textValue);

  return (
    <Tooltip
      title={tooltipEnabled ? textValue : undefined}
      overlayClassName="appeal-cell-tooltip"
      destroyTooltipOnHide
    >
      <span
        ref={elementRef}
        className={`appeal-overflow-text ${className}`.trim()}
      >
        {children ?? textValue}
      </span>
    </Tooltip>
  );
}

function renderTextCell(value?: string | number | null, className = "") {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return "-";

  return <OverflowTooltip text={text} className={className} />;
}

function renderDateTimeCell(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return "-";

  const [datePart, ...timeParts] = text.split(/\s+/);
  const timePart = timeParts.join(" ");

  return (
    <OverflowTooltip text={text} className="appeal-date-time-cell">
      <span className="appeal-date-time-cell__date">{datePart}</span>
      {timePart ? (
        <span className="appeal-date-time-cell__time">{timePart}</span>
      ) : null}
    </OverflowTooltip>
  );
}

function AppealReferenceButton({
  value,
  onOpen,
  className = "",
}: {
  value: string;
  onOpen: () => void;
  className?: string;
}) {
  const { elementRef, tooltipEnabled } = useOverflowDetector<HTMLButtonElement>(value);

  return (
    <Tooltip
      title={tooltipEnabled ? value : undefined}
      overlayClassName="appeal-cell-tooltip"
      destroyTooltipOnHide
    >
      <button
        ref={elementRef}
        type="button"
        className={`appeal-link-button ${className}`.trim()}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        {value}
      </button>
    </Tooltip>
  );
}

const APPEAL_DEPARTMENTS = [
  {
    id: "LicensingDepartment",
    name: "Licensing Department",
    department: "Licensing Department",
    departmentCode: "LicensingDepartment",
  },
  {
    id: "ContentDepartment",
    name: "Content Department",
    department: "Content Department",
    departmentCode: "ContentDepartment",
  },
  {
    id: "InspectionDepartment",
    name: "Inspection Department",
    department: "Inspection Department",
    departmentCode: "InspectionDepartment",
  },
];

type AppealTableSortKey = "sla" | "lastUpdatedAt" | "status";
type AppealApiSortBy = "sla" | "statusid" | "lastupdatedon";
type AppealResolvedRowAction = {
  key: AppealRowAction;
  label: string;
  onClick: () => void;
};

function stopAppealTableActionEvent(event: React.SyntheticEvent | Event) {
  event.preventDefault();
  event.stopPropagation();
}

const APPEAL_TABLE_SORT_FIELD_MAP: Record<string, AppealTableSortKey> = {
  sla: "sla",
  slaHours: "sla",
  lastUpdatedAt: "lastUpdatedAt",
  status: "status",
};

const APPEAL_API_SORT_FIELD_MAP: Record<AppealTableSortKey, AppealApiSortBy> = {
  sla: "sla",
  status: "statusid",
  lastUpdatedAt: "lastupdatedon",
};

function formatAppealDateRangeStart(date?: Moment | null) {
  return date?.format("YYYY-MM-DDT00:00:00[Z]");
}

function formatAppealDateRangeEnd(date?: Moment | null) {
  return date?.format("YYYY-MM-DDT23:59:59[Z]");
}

function parseAppealDateRangeValue(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return null;
  const start = moment(startDate);
  const end = moment(endDate);
  if (!start.isValid() || !end.isValid()) return null;
  return [start, end] as [Moment, Moment];
}

function getAppealLookupDisplayLabel(
  option?: InspectionAppealLookupOption | null,
  isRtl = false,
) {
  return String(
    (isRtl ? option?.nameAr || option?.nameEn : option?.nameEn || option?.nameAr) ||
      option?.code ||
      option?.id ||
      "",
  ).trim();
}

function getAppealLookupFilterValue(option?: InspectionAppealLookupOption | null) {
  return String(option?.nameEn || option?.nameAr || option?.code || option?.id || "").trim();
}

function ToolbarButton({
  children,
  onClick,
  onMouseDown,
  className = "",
  icon,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseDown?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`appeal-toolbar-button ${className}`.trim()}
      onClick={onClick}
      onMouseDown={onMouseDown}
      disabled={disabled}
    >
      <span>{children}</span>
      {icon}
    </button>
  );
}

function renderReferenceButton(value: string, onOpen?: () => void, className = "") {
  if (!value || value === "-") return "-";
  if (!onOpen) return renderTextCell(value);

  return (
    <AppealReferenceButton
      value={value}
      onOpen={onOpen}
      className={className}
    />
  );
}

function AppealApplyForCell({
  iconSrc,
  label,
}: {
  iconSrc?: string;
  label: string;
}) {
  return (
    <div className="appeal-apply-for-cell">
      {iconSrc ? <img src={iconSrc} alt="" /> : null}
      <OverflowTooltip text={label} className="appeal-apply-for-cell__label" />
    </div>
  );
}

function AppealTableActions({
  actions,
  isRtl,
  moreLabel,
}: {
  actions: AppealResolvedRowAction[];
  isRtl: boolean;
  moreLabel: string;
}) {
  const rootClassName = isRtl
    ? "appeal-table-actions appeal-table-actions--rtl"
    : "appeal-table-actions";
  const dropdownClassName = isRtl
    ? "appeal-table-actions-dropdown appeal-table-actions-dropdown--rtl"
    : "appeal-table-actions-dropdown";

  return (
    <AdaptiveActionGroup
      actions={actions.map((action) => ({
        ...action,
        renderAction: ({ onClick }) => (
          <button
            type="button"
            className="appeal-table-actions__button"
            onClick={(event) => {
              stopAppealTableActionEvent(event);
              onClick();
            }}
          >
            {action.label}
          </button>
        ),
      }))}
      maxInlineActions={2}
      moreLabel={moreLabel}
      className={rootClassName}
      emptyContent={null}
      dropdownPlacement={isRtl ? "bottomLeft" : "bottomRight"}
      dropdownOverlayClassName={dropdownClassName}
      moreButtonClassName="appeal-table-actions__more-button"
      moreIcon={(
        <img
          className="appeal-table-actions__more-icon"
          src={inspectionFigmaAssets.moreVerticalIcon}
          alt=""
        />
      )}
    />
  );
}

const CustomerAppeals: React.FC = () => {
  const { i18n, t } = useTranslation();
  const history = useHistory();
  const { activated, effectiveSearch } = useKeepAliveRouteState({
    restorePathname: CUSTOMER_APPEALS_PATH,
    restoreFrom: [CUSTOMER_APPEALS_DETAILS_PATH],
    requireEmptySearch: false,
    restoreStateKey: KEEP_ALIVE_RESTORE_STATE_KEY,
  });
  const customerAppealsAccess = useCustomerAppealsAccess();
  const hasInspectionViolationDetailAccess =
    useCanOpenCustomerAppealViolationDetail();
  const canOpenViolationDetail =
    customerAppealsAccess.hasAccess || hasInspectionViolationDetailAccess;
  const searchParams = useMemo(
    () => new URLSearchParams(effectiveSearch),
    [effectiveSearch],
  );
  const [viewRole, setViewRole] = useState<AppealViewRole>(
    DEFAULT_APPEAL_VIEW_ROLE,
  );
  const [roleReady, setRoleReady] = useState(false);
  const [roleAccessError, setRoleAccessError] = useState(false);
  const tabFromQuery = searchParams.get("tab");
  const [tabKey, setTabKey] = useState<AppealTabKey>(
    tabFromQuery === "completed" ? "completed" : "todo",
  );
  const roleConfig =
    APPEAL_ROLE_CONFIG[viewRole] ??
    APPEAL_ROLE_CONFIG[DEFAULT_APPEAL_VIEW_ROLE];
  const isRtl = i18n.dir() === "rtl";
  const translateStatus = useCallback((status?: string | null) => {
    const key = getAppealStatusTranslationKey(status);
    return key ? t(key, { defaultValue: status || "-" }) : status || "-";
  }, [t]);

  const translateReason = useCallback((reason?: string | null) => {
    const key = getAppealReasonTranslationKey(reason);
    return key ? t(key, { defaultValue: reason || "-" }) : reason || "-";
  }, [t]);

  const translateDepartment = useCallback((department?: string | null) => {
    const key = getAppealDepartmentTranslationKey(department);
    return key ? t(key, { defaultValue: department || "-" }) : department || "-";
  }, [t]);

  const translateApplyFor = useCallback((applyFor: AppealApplyFor) => (
    applyFor.labelKey
      ? t(applyFor.labelKey, {
          defaultValue: applyFor.name,
          ...applyFor.labelOptions,
        })
      : applyFor.name
  ), [t]);

  const [filters, setFilters] = useState<AppealListFilters>({ search: "" });
  const [searchValue, setSearchValue] = useState("");
  const [filterOptions, setFilterOptions] = useState<AppealFilterOptions>(
    buildAppealFilterOptions([], APPEAL_DEPARTMENTS),
  );
  const [appealReasonLookups, setAppealReasonLookups] = useState<
    InspectionAppealLookupOption[]
  >([]);
  const [summaryItems, setSummaryItems] = useState(
    mapAppealSummaryItems(null, roleConfig.list.summaryKeys),
  );
  const [records, setRecords] = useState<AppealRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<AppealTableSortKey>();
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">();
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [statusModalRecord, setStatusModalRecord] =
    useState<AppealRecord | null>(null);
  const [departmentModalRecord, setDepartmentModalRecord] =
    useState<AppealRecord | null>(null);
  const [departmentModalMode, setDepartmentModalMode] =
    useState<"process" | "send_back">("process");
  const activatedRef = useRef(activated);
  const listRequestIdRef = useRef(0);
  const summaryRequestIdRef = useRef(0);
  const departmentModalRequestIdRef = useRef(0);
  const statusModalRequestIdRef = useRef(0);

  useEffect(() => {
    activatedRef.current = activated;
  }, [activated]);

  const collectHandlers = useCallback((items: AppealRecord[]) => {
    const handlerMap = new Map<string, AppealRecord["currentHandler"]>();
    items.forEach((item) => {
      if (!item.currentHandler.id || item.currentHandler.id === "-") return;
      handlerMap.set(item.currentHandler.id, item.currentHandler);
    });
    setFilterOptions(buildAppealFilterOptions([...handlerMap.values()], APPEAL_DEPARTMENTS));
  }, []);

  useEffect(() => {
    const clearRoleState = () => {
      setRecords([]);
      setTotal(0);
      setSummaryItems([]);
      setFilterOptions(buildAppealFilterOptions([], APPEAL_DEPARTMENTS));
      setRoleAccessError(true);
      setRoleReady(true);
    };

    if (customerAppealsAccess.loading) {
      setRoleReady(false);
      setRoleAccessError(false);
      return;
    }

    const nextRole = customerAppealsAccess.role;

    if (!nextRole) {
      clearRoleState();
      return;
    }

    setViewRole(nextRole);
    setSummaryItems(
      mapAppealSummaryItems(
        null,
        APPEAL_ROLE_CONFIG[nextRole].list.summaryKeys,
      ),
    );
    setRoleAccessError(false);
    setRoleReady(true);
  }, [customerAppealsAccess.loading, customerAppealsAccess.role]);

  useEffect(() => {
    if (!roleReady || roleAccessError) return undefined;

    let cancelled = false;

    getInspectionAppealReasons().catch(() => []).then((loadedReasonLookups) => {
      if (cancelled) return;

      setAppealReasonLookups(loadedReasonLookups);
    });

    return () => {
      cancelled = true;
    };
  }, [roleAccessError, roleReady]);

  const loadSummary = useCallback(async () => {
    const requestId = summaryRequestIdRef.current + 1;
    summaryRequestIdRef.current = requestId;
    try {
      const stats = await getInspectionAppealStats(viewRole);
      if (requestId !== summaryRequestIdRef.current) return;
      setSummaryItems(mapAppealSummaryItems(stats, roleConfig.list.summaryKeys));
    } catch {
      if (requestId !== summaryRequestIdRef.current) return;
      setSummaryItems(mapAppealSummaryItems(null, roleConfig.list.summaryKeys));
    }
  }, [roleConfig.list.summaryKeys, viewRole]);

  const buildAppealListRequestParams = useCallback(() => ({
    search: filters.search || undefined,
    appealReason: filters.appealReason || undefined,
    statusId:
      typeof filters.statusId === "number"
        ? filters.statusId
        : undefined,
    lastUpdatedFrom: filters.startDate,
    lastUpdatedTo: filters.endDate,
    currentHandlerUserId:
      roleConfig.list.filterModalMode[tabKey] === "handler_and_date"
        ? filters.handlerId
        : undefined,
    pageIndex,
    pageSize,
    sortBy: sortBy ? APPEAL_API_SORT_FIELD_MAP[sortBy] : undefined,
    sortDirection,
  }), [
    filters.appealReason,
    filters.endDate,
    filters.handlerId,
    filters.search,
    filters.startDate,
    filters.statusId,
    pageIndex,
    pageSize,
    sortBy,
    sortDirection,
    roleConfig.list.filterModalMode,
    tabKey,
  ]);

  const loadList = useCallback(async () => {
    const requestId = listRequestIdRef.current + 1;
    listRequestIdRef.current = requestId;
    setLoading(true);
    try {
      const response = await getInspectionAppealList(
        viewRole,
        tabKey,
        buildAppealListRequestParams(),
      );
      if (requestId !== listRequestIdRef.current) return;
      const result = mapAppealListResponse(response);
      setRecords(result.items);
      setTotal(result.total);
      collectHandlers(result.items);
    } catch {
      if (requestId !== listRequestIdRef.current) return;
      setRecords([]);
      setTotal(0);
      collectHandlers([]);
    } finally {
      if (requestId === listRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    buildAppealListRequestParams,
    collectHandlers,
    tabKey,
    viewRole,
  ]);

  useEffect(() => {
    if (!activated || !roleReady || roleAccessError) return;
    loadSummary();
  }, [activated, loadSummary, roleAccessError, roleReady]);

  useEffect(() => {
    if (!activated || !roleReady || roleAccessError) return;
    loadList();
  }, [activated, loadList, roleAccessError, roleReady]);

  useEffect(() => {
    if (!activated || !roleReady || roleAccessError) return;

    const params = new URLSearchParams(effectiveSearch);
    let changed = false;

    if (params.get("tab") !== tabKey) {
      params.set("tab", tabKey);
      changed = true;
    }
    if (params.get("viewRole") !== viewRole) {
      params.set("viewRole", viewRole);
      changed = true;
    }
    if (params.get("pageTitleKey") !== roleConfig.ui.listPageTitleKey) {
      params.set("pageTitleKey", roleConfig.ui.listPageTitleKey);
      changed = true;
    }
    if (params.get("breadcrumbRootKey") !== roleConfig.ui.breadcrumbRootKey) {
      params.set("breadcrumbRootKey", roleConfig.ui.breadcrumbRootKey);
      changed = true;
    }

    if (changed) {
      history.replace(`${CUSTOMER_APPEALS_PATH}?${params.toString()}`);
    }
  }, [
    history,
    effectiveSearch,
    activated,
    roleAccessError,
    roleConfig.ui.breadcrumbRootKey,
    roleConfig.ui.listPageTitleKey,
    roleReady,
    tabKey,
    viewRole,
  ]);

  const updateRouteQuery = (nextTab: AppealTabKey, nextRole = viewRole) => {
    const params = new URLSearchParams(effectiveSearch);
    params.set("tab", nextTab);
    params.set("viewRole", nextRole);
    history.replace(`${CUSTOMER_APPEALS_PATH}?${params.toString()}`);
  };

  useKeepAliveActivated({
    onDeactivated: () => {
      listRequestIdRef.current += 1;
      summaryRequestIdRef.current += 1;
      departmentModalRequestIdRef.current += 1;
      statusModalRequestIdRef.current += 1;
      setLoading(false);
      setFilterModalVisible(false);
      setStatusModalRecord(null);
      setDepartmentModalRecord(null);
    },
  });

  const resetFilters = () => {
    setSearchValue("");
    setFilters({ search: "" });
    setFilterModalVisible(false);
    setPageIndex(1);
  };

  const handleTabChange = (key: string) => {
    const nextTab = key === "completed" ? "completed" : "todo";
    setTabKey(nextTab);
    resetFilters();
    updateRouteQuery(nextTab);
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
    setFilters((current) => ({ ...current, search: value }));
    setPageIndex(1);
  };

  const stopToolbarButtonEvent: React.MouseEventHandler<HTMLButtonElement> = (
    event,
  ) => {
    event.preventDefault();
    event.stopPropagation();
  };

  /**
   * The modal receives the whole filters object and hands back the next one, so
   * everything but the inline search counts. The date pair is one range.
   */
  const appliedFilterCount = useMemo(() => {
    const { search: _search, startDate, endDate, ...rest } = filters ?? {};
    return (
      countAppliedFilters(Object.values(rest)) +
      (isAppliedFilterValue(startDate) || isAppliedFilterValue(endDate) ? 1 : 0)
    );
  }, [filters]);

  const handleOpenFilterModal: React.MouseEventHandler<HTMLButtonElement> = (
    event,
  ) => {
    stopToolbarButtonEvent(event);
    setFilterModalVisible(true);
  };

  const handleReset: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    stopToolbarButtonEvent(event);
    setFilterModalVisible(false);
    resetFilters();
  };

  const openAppealDetail = (record: AppealRecord) => {
    const params = new URLSearchParams();
    params.set("appealId", String(record.appealId ?? record.appealNo));
    params.set("viewRole", viewRole);
    params.set("tab", tabKey);
    params.set("pageTitleKey", roleConfig.ui.detailsPageTitleKey);
    params.set("breadcrumbRootKey", roleConfig.ui.breadcrumbRootKey);
    history.push(`${CUSTOMER_APPEALS_DETAILS_PATH}?${params.toString()}`);
  };

  const handleOpenViolation = (record: AppealRecord) => {
    if (!record.violationNo || record.violationNo === "-") return;

    if (!canOpenViolationDetail) {
      CustomMessage.warning(t("response.error.403"));
      return;
    }

    history.push(buildAppealViolationDetailPath(record));
  };

  const openDepartmentModal = async (
    record: AppealRecord,
    modalMode: "process" | "send_back",
  ) => {
    const requestId = departmentModalRequestIdRef.current + 1;
    departmentModalRequestIdRef.current = requestId;
    setDepartmentModalMode(modalMode);

    if (modalMode !== "process" || !record.appealId) {
      if (activatedRef.current) {
        setDepartmentModalRecord(record);
      }
      return;
    }

    try {
      const detail = await getInspectionAppealDetail(record.appealId);
      if (
        !activatedRef.current ||
        requestId !== departmentModalRequestIdRef.current
      ) {
        return;
      }
      setDepartmentModalRecord(mergeAppealDetail(null, detail));
    } catch {
      if (
        !activatedRef.current ||
        requestId !== departmentModalRequestIdRef.current
      ) {
        return;
      }
      setDepartmentModalRecord(record);
    }
  };

  const openStatusModal = async (record: AppealRecord) => {
    if (!record.appealId) return;
    const requestId = statusModalRequestIdRef.current + 1;
    statusModalRequestIdRef.current = requestId;

    try {
      const [detail, timeline] = await Promise.all([
        getInspectionAppealDetail(record.appealId),
        getInspectionAppealTimeline(record.appealId, {
          skipErrorMessage: true,
        }).catch(() => []),
      ]);
      if (
        !activatedRef.current ||
        requestId !== statusModalRequestIdRef.current
      ) {
        return;
      }
      const nextRecord = mergeAppealDetail(null, detail, undefined, timeline);

      if (!resolveAllowedFinalStatuses(nextRecord).length) {
        CustomMessage.warning(
          t("Customer.customerAppeals.messages.statusChangeUnavailable"),
        );
        return;
      }

      setStatusModalRecord(nextRecord);
    } catch {
      if (
        !activatedRef.current ||
        requestId !== statusModalRequestIdRef.current
      ) {
        return;
      }
      if (!resolveAllowedFinalStatuses(record).length) {
        CustomMessage.warning(
          t("Customer.customerAppeals.messages.statusChangeUnavailable"),
        );
        return;
      }

      setStatusModalRecord(record);
    }
  };

  const handleChangeStatus = async (payload: AppealStatusChangePayload) => {
    if (!statusModalRecord?.appealId) return;
    await changeInspectionAppealStatus(statusModalRecord.appealId, {
      targetStatusId: APPEAL_STATUS_ID_MAP[payload.nextStatus],
      assignedDepartmentCode: mapDepartmentCode(payload.assignedDepartmentCode),
      roleId: payload.roleId,
      responseDeadline: payload.responseDeadline,
      notes: payload.notes,
      attachments: payload.attachments?.map(mapAppealAttachmentToWriteDto),
    });
    CustomMessage.success(t("Customer.customerAppeals.messages.operationSuccessful"));
    setStatusModalRecord(null);
    loadSummary();
    loadList();
  };

  const handleDepartmentAction = async (
    payload: AppealDepartmentProcessPayload | AppealSendBackPayload,
  ) => {
    if (!departmentModalRecord?.appealId) return;
    if (departmentModalMode === "process" && "decision" in payload) {
      if (payload.processMode === "cancel") {
        await cancelAllAppealViolationItems(departmentModalRecord.appealId, {
          recommendationTypeId: mapRecommendationToTypeId(
            payload.decision,
            payload.recommendationTypeId,
          ),
          notes: payload.notes,
          attachments: (payload.attachments ?? []).map(mapAppealAttachmentToWriteDto),
        });
      } else {
        await processInspectionAppeal(departmentModalRecord.appealId, {
          recommendationTypeId: mapRecommendationToTypeId(
            payload.decision,
            payload.recommendationTypeId,
          ),
          notes: payload.notes,
          adjustmentItems: payload.adjustmentItems ?? [],
          attachments: (payload.attachments ?? []).map(mapAppealAttachmentToWriteDto),
        });
      }
    } else {
      await sendBackInspectionAppeal(departmentModalRecord.appealId, {
        notes: payload.notes,
        attachments: payload.attachments?.map(mapAppealAttachmentToWriteDto),
      });
    }
    CustomMessage.success(t("Customer.customerAppeals.messages.operationSuccessful"));
    setDepartmentModalRecord(null);
    loadSummary();
    loadList();
  };

  const actionMap = roleConfig.list.rowActions[tabKey];
  const resolveRowActions = (record: AppealRecord): AppealResolvedRowAction[] => {
    const actions: AppealResolvedRowAction[] = [];

    if (actionMap.includes("message")) {
      actions.push({
        key: "message",
        label: t("Customer.customerAppeals.actions.message"),
        onClick: () => openAppealDetail(record),
      });
    }

    if (
      actionMap.includes("change_status") &&
      canShowChangeStatusAction(
        record,
        roleConfig.details.allowChangeStatusStatuses,
      )
    ) {
      actions.push({
        key: "change_status",
        label: t("Customer.customerAppeals.actions.changeStatus"),
        onClick: () => {
          openStatusModal(record);
        },
      });
    }

    if (
      actionMap.includes("process") &&
      isAppealStatusAllowed(
        record,
        roleConfig.details.allowDepartmentActionStatuses,
      )
    ) {
      actions.push({
        key: "process",
        label: t("Customer.customerAppeals.actions.process"),
        onClick: () => openDepartmentModal(record, "process"),
      });
    }

    if (
      actionMap.includes("send_back") &&
      isAppealStatusAllowed(
        record,
        roleConfig.details.allowDepartmentActionStatuses,
      )
    ) {
      actions.push({
        key: "send_back",
        label: t("Customer.customerAppeals.actions.sendBack"),
        onClick: () => openDepartmentModal(record, "send_back"),
      });
    }

    return actions;
  };
  const slaLabels = useMemo(() => ({
    overdue: t("Customer.customerAppeals.sla.overdue"),
    remaining: t("Customer.customerAppeals.sla.remaining"),
    exceeded: t("Customer.customerAppeals.sla.exceeded"),
    onTime: t("Customer.customerAppeals.sla.onTime"),
  }), [t]);
  const isCompletedView = tabKey === "completed";
  const todoColumnWidths = getAppealTodoColumnWidths(viewRole);
  const appealActionColumnWidth = useResponsiveActionColumnWidth<
    AppealRecord,
    AppealActionColumnKey
  >({
    rows: isCompletedView ? [] : records,
    buttonWidthMap: APPEAL_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: (record) =>
      getAdaptiveActionColumnKeys(resolveRowActions(record), "more", {
        maxInlineActions: 2,
      }),
    getActionLabel: (actionKey) => {
      switch (actionKey) {
        case "message":
          return t("Customer.customerAppeals.actions.message");
        case "change_status":
          return t("Customer.customerAppeals.actions.changeStatus");
        case "process":
          return t("Customer.customerAppeals.actions.process");
        case "send_back":
          return t("Customer.customerAppeals.actions.sendBack");
        default:
          return undefined;
      }
    },
    desktopConfig: APPEAL_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: APPEAL_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: APPEAL_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });
  const activeTodoColumnWidths = {
    ...todoColumnWidths,
    actions: appealActionColumnWidth,
  };
  const activeColumnWidths = isCompletedView
    ? APPEAL_COMPLETED_COLUMN_WIDTHS
    : activeTodoColumnWidths;
  const tableScrollX = isCompletedView
    ? pxToRemValue(APPEAL_COMPLETED_TABLE_SCROLL_WIDTH)
    : pxToRemValue(sumColumnWidths(activeTodoColumnWidths));
  const listPagination = useMemo(() => ({
    current: pageIndex,
    pageSize,
    total,
    showSizeChanger: true,
    position: ["bottomCenter"],
    pageSizeOptions: ["10", "20", "50", "100"],
    showTotal: (totalValue: number) => (
      <PaginationTotal
        label={t("common.total")}
        total={totalValue}
        current={pageIndex}
        pageSize={pageSize}
      />
    ),
    buildOptionText: (value: string | number) =>
      buildPaginationOptionText(value, i18n.language),
  }) as TablePaginationConfig & {
    buildOptionText?: (value: string | number) => React.ReactNode;
  }, [pageIndex, pageSize, total, i18n.language, t]);

  const resolveAppealSortOrder = useCallback((nextSortBy: AppealTableSortKey) => {
    if (sortBy !== nextSortBy || !sortDirection) return null;
    return sortDirection === "asc" ? "ascend" : "descend";
  }, [sortBy, sortDirection]);

  const leadingColumns: ColumnsType<AppealRecord> = [
    {
      title: t("Customer.customerAppeals.table.appealNo"),
      dataIndex: "appealNo",
      fixed: "left",
      width: pxToRemValue(activeColumnWidths.appealNo),
      render: (value: string, record) =>
        renderReferenceButton(
          value,
          () => openAppealDetail(record),
          "appeal-link-button--primary appeal-link-button--two-line",
        ),
    },
    {
      title: t("Customer.customerAppeals.table.appealReason"),
      dataIndex: "appealReason",
      width: pxToRemValue(activeColumnWidths.appealReason),
      render: (value: string) => renderTextCell(
        translateReason(value),
        "appeal-overflow-text--two-line",
      ),
    },
    {
      title: t("Customer.customerAppeals.table.violationNo"),
      dataIndex: "violationNo",
      width: pxToRemValue(activeColumnWidths.violationNo),
      render: (value: string, record) =>
        renderReferenceButton(
          value,
          () => handleOpenViolation(record),
          "appeal-link-button--two-line",
        ),
    },
    {
      title: t("Customer.customerAppeals.table.applyFor"),
      dataIndex: "applyFor",
      width: pxToRemValue(activeColumnWidths.applyFor),
      render: (_, record) => (
        <AppealApplyForCell
          iconSrc={getAppealApplyForIcon(record.applyFor)}
          label={translateApplyFor(record.applyFor)}
        />
      ),
    },
  ];

  const slaColumns: ColumnsType<AppealRecord> = [
    {
      title: t("Customer.customerAppeals.table.sla"),
      dataIndex: "slaHours",
      key: "sla",
      width: pxToRemValue(activeColumnWidths.sla),
      sorter: true,
      sortOrder: resolveAppealSortOrder("sla"),
      render: (_, record) => {
        const text =
          tabKey === "completed"
            ? getAppealSlaCompletionLabel(record.slaHours, record.rawSla, {
                exceeded: slaLabels.exceeded,
                onTime: slaLabels.onTime,
              })
            : getAppealSlaLabel(record.slaHours, record.rawSla, {
                overdue: slaLabels.overdue,
                remaining: slaLabels.remaining,
              });

        return renderTextCell(text);
      },
    },
  ];

  const statusColumns: ColumnsType<AppealRecord> = [
    {
      title: t("Customer.customerAppeals.table.status"),
      dataIndex: "status",
      key: "status",
      width: pxToRemValue(activeColumnWidths.status),
      sorter: true,
      sortOrder: resolveAppealSortOrder("status"),
      render: (status: AppealStatus, record) => {
        const text = translateStatus(record.statusCode || status);
        return (
          <OverflowTooltip
            text={text}
            className={`appeal-status-pill ${getAppealStatusClassName(status)}`}
          />
        );
      },
    },
  ];

  const currentHandlerColumns: ColumnsType<AppealRecord> = [
    {
      title: t("Customer.customerAppeals.table.currentHandler"),
      dataIndex: "currentHandler",
      width: pxToRemValue(activeTodoColumnWidths.currentHandler),
      render: (_, record) => (
        <div className="appeal-handler-cell">
          <OverflowTooltip
            text={record.currentHandler.name}
            className="appeal-handler-cell__name"
          />
          {record.currentHandler.department ? (
            <OverflowTooltip
              text={translateDepartment(record.currentHandler.department)}
              className="appeal-handler-cell__department"
            />
          ) : null}
        </div>
      ),
    },
  ];

  const baseColumns: ColumnsType<AppealRecord> = isCompletedView
    ? [...leadingColumns, ...slaColumns, ...statusColumns]
    : [
        ...leadingColumns,
        ...slaColumns,
        ...currentHandlerColumns,
        ...statusColumns,
      ];

  const trailingColumns: ColumnsType<AppealRecord> = [
    {
      title: t("Customer.customerAppeals.table.lastUpdated"),
      dataIndex: "lastUpdatedAt",
      key: "lastUpdatedAt",
      width: pxToRemValue(activeColumnWidths.lastUpdated),
      sorter: true,
      sortOrder: resolveAppealSortOrder("lastUpdatedAt"),
      render: (value: string) => renderDateTimeCell(formatAppealDateTime(value)),
    },
  ];

  const actionColumns: ColumnsType<AppealRecord> = [
    {
      title: t("Customer.customerAppeals.table.actions"),
      key: "actions",
      fixed: "right",
      align: isRtl ? "right" : "left",
      className: isRtl
        ? "appeal-actions-cell appeal-actions-cell--rtl"
        : "appeal-actions-cell",
      width: pxToRemValue(appealActionColumnWidth),
      onCell: () => ({
        onClick: stopAppealTableActionEvent,
      }),
      onHeaderCell: () => ({
        className: isRtl
          ? "appeal-actions-cell appeal-actions-cell--rtl"
          : "appeal-actions-cell",
      }),
      render: (_, record) => (
        <AppealTableActions
          actions={resolveRowActions(record)}
          isRtl={isRtl}
          moreLabel={t("Customer.customerAppeals.actions.more")}
        />
      ),
    },
  ];

  const columns: ColumnsType<AppealRecord> = isCompletedView
    ? [...baseColumns, ...trailingColumns]
    : [...baseColumns, ...trailingColumns, ...actionColumns];

  const handleTableChange = (
    pagination: { current?: number; pageSize?: number },
    _filters: unknown,
    sorter: SorterResult<AppealRecord> | SorterResult<AppealRecord>[],
  ) => {
    setPageIndex(pagination.current ?? 1);
    setPageSize(pagination.pageSize ?? DEFAULT_PAGE_SIZE);

    const activeSorter = Array.isArray(sorter)
      ? sorter.find((item) => item.order)
      : sorter;
    const nextSortBy = activeSorter
      ? APPEAL_TABLE_SORT_FIELD_MAP[
        String(activeSorter.columnKey ?? activeSorter.field ?? "")
      ]
      : undefined;

    if (!activeSorter?.order || !nextSortBy) {
      setSortBy(undefined);
      setSortDirection(undefined);
      return;
    }

    setSortBy(nextSortBy);
    setSortDirection(activeSorter.order === "ascend" ? "asc" : "desc");
  };

  const reasonOptions = useMemo(() => {
    if (appealReasonLookups.length) {
      return appealReasonLookups
        .map((option) => {
          const value = getAppealLookupFilterValue(option);
          const label = translateReason(
            getAppealLookupDisplayLabel(option, isRtl) || value,
          );
          return value ? { value, label } : null;
        })
        .filter(
          (option): option is { value: string; label: string } =>
            Boolean(option),
        );
    }

    return APPEAL_REASON_OPTIONS.map((reason) => ({
      value: reason,
      label: translateReason(reason),
    }));
  }, [appealReasonLookups, isRtl, translateReason]);

  const statusOptions = useMemo<Array<{ value: number; label: string }>>(
    () =>
      roleConfig.list.tabStatuses[tabKey]
        .map((status) => {
          const value = APPEAL_STATUS_ID_MAP[status];

          if (value === undefined) return null;

          const label = translateStatus(status);

          return { value, label };
        })
        .filter(
          (option): option is { value: number; label: string } =>
            Boolean(option),
        ),
    [roleConfig.list.tabStatuses, tabKey, translateStatus],
  );
  const toolbarDateRangeValue = useMemo(
    () => parseAppealDateRangeValue(filters.startDate, filters.endDate),
    [filters.endDate, filters.startDate],
  );

  if (!roleReady) {
    return (
      <div className="appeals-page appeals-page--loading">
        <Spin />
      </div>
    );
  }

  if (roleAccessError) {
    return (
      <div className="appeals-page">
        <div className="appeal-role-access-empty">
          {t("Customer.customerAppeals.messages.noAccessibleWorkbench")}
        </div>
      </div>
    );
  }

  return (
    <div className={`appeals-page appeals-page--${viewRole}`}>
      <div className="appeal-summary-grid">
        {summaryItems.map((item) => (
          <div key={item.key} className="appeal-summary-card">
            <div className={getAppealSummaryIconClassName(item.iconKey, viewRole)}>
              <img src={getAppealSummaryIconSrc(item.iconKey, viewRole)} alt="" />
            </div>
            <div className="appeal-summary-card__content">
              <div className="appeal-summary-card__value">
                {formatAppealSummaryCount(item.count)}
              </div>
              <div className="appeal-summary-card__label">
                {(() => {
                  const labelKey = getAppealSummaryTranslationKey(item.key);
                  return labelKey
                    ? t(labelKey, { defaultValue: item.label })
                    : item.label;
                })()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="appeal-table-panel">
        <Tabs activeKey={tabKey} onChange={handleTabChange}>
          <Tabs.TabPane tab={t("Customer.customerAppeals.tabs.todo")} key="todo" />
          <Tabs.TabPane
            tab={t("Customer.customerAppeals.tabs.completed")}
            key="completed"
          />
        </Tabs>

        <div className="appeal-toolbar">
          <div className="appeal-toolbar__left">
            <Input
              value={searchValue}
              onChange={(event) => handleSearch(event.target.value)}
              prefix={<AppealSearchIcon />}
              placeholder={t("Customer.customerAppeals.toolbar.search")}
              className="appeal-toolbar__search responsive-filter-toolbar__field--single-visible-search"
              allowClear
            />
            {roleConfig.list.toolbar[tabKey].showReasonSelect ? (
              <Select<string>
                allowClear
                placeholder={t("Customer.customerAppeals.toolbar.allReasons")}
                value={filters.appealReason}
                className="appeal-toolbar__select appeal-toolbar__secondary-filter"
                onChange={(value) => {
                  setFilters((current) => ({
                    ...current,
                    appealReason: value,
                  }));
                  setPageIndex(1);
                }}
                options={reasonOptions}
              />
            ) : null}
            {roleConfig.list.toolbar[tabKey].showStatusSelect ? (
              <Select<number>
                allowClear
                placeholder={t("Customer.customerAppeals.toolbar.allStatuses")}
                value={filters.statusId}
                className="appeal-toolbar__select appeal-toolbar__secondary-filter"
                onChange={(value) => {
                  setFilters((current) => ({
                    ...current,
                    statusId: value,
                  }));
                  setPageIndex(1);
                }}
                options={statusOptions}
              />
            ) : null}
            {roleConfig.list.toolbar[tabKey].showDateRange ? (
              <DatePicker.RangePicker
                format="DD/MM/YYYY"
                className="appeal-toolbar__date appeal-toolbar__secondary-filter"
                placeholder={[t("common.startTime"), t("common.endTime")]}
                value={toolbarDateRangeValue}
                onChange={(dates) => {
                  setFilters((current) => ({
                    ...current,
                    startDate: formatAppealDateRangeStart(dates?.[0]),
                    endDate: formatAppealDateRangeEnd(dates?.[1]),
                  }));
                  setPageIndex(1);
                }}
              />
            ) : null}
            {roleConfig.list.toolbar[tabKey].showFilterButton ? (
              <ToolbarButton
                className="appeal-toolbar-button--filter filter-trigger-with-count"
                icon={
                  <>
                    <AppealFilterIcon />
                    <FilterCountBadge count={appliedFilterCount} />
                  </>
                }
                onClick={handleOpenFilterModal}
              >
                {t("Customer.customerAppeals.toolbar.filter")}
              </ToolbarButton>
            ) : null}
            {roleConfig.list.toolbar[tabKey].showResetButton ? (
              <ToolbarButton
                className="appeal-toolbar-button--reset"
                onMouseDown={stopToolbarButtonEvent}
                onClick={handleReset}
              >
                {t("Customer.customerAppeals.toolbar.reset")}
              </ToolbarButton>
            ) : null}
          </div>
          <div className="appeal-toolbar__right">
            <PermissionGuard
              permissionCode={PERMISSION_CODES.inspection.appeal.export}
              routePath="/happiness/appeals"
            >
              <ToolbarButton
                className="appeal-toolbar-button--export"
                onClick={() =>
                  exportInspectionAppealList(
                    viewRole,
                    tabKey,
                    buildAppealListRequestParams(),
                  )
                }
              >
                {t("Customer.customerAppeals.toolbar.export")}
              </ToolbarButton>
            </PermissionGuard>
          </div>
        </div>

        <Table
          rowKey={(record) => String(record.appealId ?? record.appealNo)}
          columns={columns}
          dataSource={records}
          loading={loading}
          scroll={{ x: tableScrollX }}
          pagination={listPagination}
          onChange={handleTableChange}
          onRow={(record) => ({
            onClick: () => openAppealDetail(record),
          })}
          rowClassName="appeal-table-row-clickable"
          className="appeal-table"
        />
      </div>

      <AppealFilterModal
        visible={filterModalVisible}
        mode={roleConfig.list.filterModalMode[tabKey]}
        filters={filters}
        options={filterOptions}
        reasonOptions={reasonOptions}
        statusOptions={statusOptions}
        showReasonSelect={
          roleConfig.list.toolbar[tabKey].showReasonSelect
        }
        showStatusSelect={
          roleConfig.list.toolbar[tabKey].showStatusSelect
        }
        onCancel={() => setFilterModalVisible(false)}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
          setPageIndex(1);
          setFilterModalVisible(false);
        }}
      />
      <AppealStatusModal
        visible={Boolean(statusModalRecord)}
        record={statusModalRecord}
        onCancel={() => setStatusModalRecord(null)}
        onConfirm={handleChangeStatus}
      />
      <AppealDepartmentTransferModal
        visible={Boolean(departmentModalRecord)}
        mode={departmentModalMode}
        record={departmentModalRecord}
        onCancel={() => setDepartmentModalRecord(null)}
        onConfirm={handleDepartmentAction}
      />
    </div>
  );
};

export default CustomerAppeals;
