import { toApi } from "@/utils/gstTime";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DatePicker, Input, Select, Table, Tabs, Tooltip } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import type { SorterResult } from "antd/es/table/interface";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createPermissionPathSet, normalizeRoutePath } from "@/routes/access";
import { useUserStore } from "@/store/user";
import { debounce } from "lodash";
import moment from "moment";
import { CustomMessage } from "@/components/common";
import AdaptiveActionGroup from "@/components/common/AdaptiveActionGroup";
import { getAdaptiveActionColumnKeys } from "@/components/common/AdaptiveActionGroup/layout";
import PaginationTotal from "@/components/common/PaginationTotal";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";
import { KEEP_ALIVE_RESTORE_STATE_KEY } from "@/components/KeepAlive/constants";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import useKeepAliveRouteState from "@/components/KeepAlive/useKeepAliveRouteState";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import CurrencyLabel from "@/components/common/CurrencyLabel";
import { inspectionFigmaAssets } from "@/pages/InspectionCommon/assets";
import type {
  AdminRefundDetailDto,
  AdminRefundStatisticsData,
  AdminRefundStatisticsResponseDto,
  AdminRefundTicketListItemDto,
  AdminRefundTicketsParams,
  AdminRefundTimelineItemDto,
  RefundStatusItemDto,
} from "@/services/refunds";
import {
  exportAdminRefundTickets,
  exportAdminCustomerServiceRefundTickets,
  getAdminCustomerServiceRefundTickets,
  getAdminRefundCategories,
  getAdminRefundDepartments,
  getAdminRefundDepartmentStatusTypes,
  getAdminRefundDepartmentUsers,
  getAdminRefundTicketDetail,
  getAdminRefundTicketTimeline,
  getAdminRefundSourceTypes,
  getAdminRefundStatusTypes,
  getAdminRefundTickets,
  getAdminRefundTicketsStatistics,
  sendBackAdminRefundTicket,
  transferAdminRefundTicketStatus,
  updateAdminRefundTicketStatus,
} from "@/services/refunds";
import { getTaskType } from "@/services/tickets";
import formatMoney from "@/utils/formatMoney";
import { pxToRemValue } from "@/utils/rem";
import RefundFilterModal from "./components/RefundFilterModal";
import RefundStatusModal from "./components/RefundStatusModal";
import RefundDepartmentProcessModal from "./components/RefundDepartmentProcessModal";
import { FilterIcon, SearchIcon } from "./components/RefundIcons";
import {
  DEFAULT_REFUND_VIEW_ROLE,
  getRefundViewRoleFromSearchParams,
  REFUND_ROLE_CONFIG,
} from "./roleConfig";
import {
  mapAdminDepartmentsToHandlers,
  mapAdminDepartmentUsersToHandlers,
  mapAdminRefundListItemToRecord,
  mergeAdminRefundDetail,
  mapRefundSummaryItems,
  mapStatusNameToId,
  mapProcessDecisionToId,
  resolveAllowedRefundFinalStatuses,
  resolveRefundViewRole,
  canShowRefundChangeStatusAction,
} from "./apiAdapter";
import { mapRefundFilterSelectOptions } from "./filterOptions";
import {
  SUMMARY_ICON_MAP,
  formatDateTime,
  formatSummaryCount,
  getApplyForIcon,
  getSlaCompletionLabel,
  getStatusClassName,
} from "./utils";
import type {
  RefundDepartmentActionMode,
  RefundDepartmentActionPayload,
  RefundFilterOptions,
  RefundHandler,
  RefundListFilters,
  RefundRecord,
  RefundStatus,
  RefundStatusChangePayload,
  RefundTabKey,
  RefundViewRole,
} from "./types";
import "./index.less";

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT_DIRECTION: 0 | 1 = 1;
const APPLICATION_DETAIL_ROUTE_MAP: Record<number, string> = {
  1: "/licensing/applications/applicationsDetails",
  2: "/content/ContentApplications/ContentApplicationsDetails",
};
const CUSTOMER_REFUNDS_PATH = "/happiness/refunds";
const CUSTOMER_REFUNDS_DETAILS_PATH = "/happiness/refunds/refundsDetails";
const CUSTOMER_FILTER_HANDLER_ID = "__refund_customer_handler__";
function sumColumnWidths<T extends Record<string, number>>(columns: T) {
  return Object.values(columns).reduce(
    (totalWidth, columnWidth) => totalWidth + columnWidth,
    0,
  );
}

type RefundTodoColumnWidths = {
  applicationNo: number;
  refundCategory: number;
  referenceNo: number;
  applyFor: number;
  amount: number;
  sla: number;
  currentHandler: number;
  status: number;
  lastUpdated: number;
  actions: number;
};

const REFUND_CUSTOMER_HAPPINESS_TODO_COLUMN_WIDTHS: RefundTodoColumnWidths = {
  applicationNo: 150,
  refundCategory: 153,
  referenceNo: 150,
  applyFor: 150,
  amount: 150,
  sla: 150,
  currentHandler: 150,
  status: 210,
  lastUpdated: 150,
  actions: 227,
};
const REFUND_BUSINESS_TODO_COLUMN_WIDTHS: RefundTodoColumnWidths = {
  applicationNo: 150,
  refundCategory: 153,
  referenceNo: 150,
  applyFor: 150,
  amount: 121,
  sla: 150,
  currentHandler: 150,
  status: 210,
  lastUpdated: 150,
  actions: 208,
};
const REFUND_CUSTOMER_COMPLETED_COLUMN_WIDTHS = {
  applicationNo: 220,
  refundCategory: 170,
  referenceNo: 220,
  applyFor: 140,
  amount: 160,
  refundSource: 160,
  sla: 120,
  status: 160,
  lastUpdated: 220,
};
const REFUND_BUSINESS_COMPLETED_COLUMN_WIDTHS = {
  applicationNo: 220,
  refundCategory: 160,
  referenceNo: 220,
  applyFor: 196.25,
  amount: 170,
  sla: 160,
  status: 207,
  lastUpdated: 220,
};
const REFUND_CUSTOMER_COMPLETED_TABLE_SCROLL_WIDTH = sumColumnWidths(
  REFUND_CUSTOMER_COMPLETED_COLUMN_WIDTHS,
);
const REFUND_BUSINESS_COMPLETED_TABLE_SCROLL_WIDTH = sumColumnWidths(
  REFUND_BUSINESS_COMPLETED_COLUMN_WIDTHS,
);

function getRefundTodoColumnWidths(
  viewRole: RefundViewRole,
): RefundTodoColumnWidths {
  return viewRole === "business_department"
    ? REFUND_BUSINESS_TODO_COLUMN_WIDTHS
    : REFUND_CUSTOMER_HAPPINESS_TODO_COLUMN_WIDTHS;
}

function normalizeHandlerMatchText(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function hasDepartmentId(handler?: RefundHandler | null) {
  return Boolean(String(handler?.departmentId ?? "").trim());
}

function isSameHandlerDepartment(
  recordHandler: RefundHandler,
  optionHandler: RefundHandler,
) {
  const sameName =
    normalizeHandlerMatchText(optionHandler.name) ===
    normalizeHandlerMatchText(recordHandler.name);

  if (!sameName) return false;

  if (hasDepartmentId(recordHandler) || hasDepartmentId(optionHandler)) {
    return recordHandler.departmentId === optionHandler.departmentId;
  }

  return false;
}

function isSameHandlerId(
  recordHandler: RefundHandler,
  optionHandler: RefundHandler,
) {
  if (recordHandler.id !== optionHandler.id) return false;

  if (hasDepartmentId(recordHandler) || hasDepartmentId(optionHandler)) {
    return recordHandler.departmentId === optionHandler.departmentId;
  }

  return true;
}

type RefundTableSortKey = "sla" | "lastUpdatedAt";
type RefundApiSortBy = "sla" | "status" | "updateOn";
type RefundResolvedRowAction = {
  key: "message" | "change_status" | "process" | "send_back";
  label: string;
  onClick: () => void;
};
type RefundActionColumnKey = RefundResolvedRowAction["key"] | "more";

const REFUND_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<RefundActionColumnKey> =
  {
    more: { default: 20, compact: 20 },
  };
const REFUND_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 128,
  maxWidth: 280,
};
const REFUND_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 112,
  maxWidth: 260,
};
const REFUND_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};
type LoadRefundListOptions = {
  force?: boolean;
  requestViewRole?: RefundViewRole;
};

const DEFAULT_REFUND_SORT_BY_MAP: Record<
  RefundViewRole,
  Record<RefundTabKey, RefundApiSortBy>
> = {
  business_department: {
    todo: "sla",
    completed: "updateOn",
  },
  customer_happiness: {
    todo: "status",
    completed: "updateOn",
  },
};

function resolveRefundSortBy(
  viewRole: RefundViewRole,
  tabKey: RefundTabKey,
  sortBy?: RefundTableSortKey,
): RefundApiSortBy {
  if (sortBy === "sla") return "sla";
  if (sortBy === "lastUpdatedAt") return "updateOn";

  return DEFAULT_REFUND_SORT_BY_MAP[viewRole][tabKey];
}

function resolveRefundSortDirection(
  sortBy: RefundTableSortKey | undefined,
  sortDirection: "asc" | "desc",
): 0 | 1 {
  if (!sortBy) return DEFAULT_SORT_DIRECTION;

  return sortDirection === "asc" ? 0 : 1;
}

function ToolbarButton({
  children,
  onClick,
  className = "",
  icon,
  badge,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  icon?: React.ReactNode;
  /** Trailing slot, after the icon — used for the applied-filter count. */
  badge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`refund-toolbar-button ${className}`.trim()}
      onClick={onClick}
    >
      <span>{children}</span>
      {icon}
      {badge}
    </button>
  );
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
      overlayClassName="refund-cell-tooltip"
      destroyTooltipOnHide
    >
      <span
        ref={elementRef}
        className={`refund-overflow-text ${className}`.trim()}
      >
        {children ?? textValue}
      </span>
    </Tooltip>
  );
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
    <OverflowTooltip text={text} className="refund-date-time-cell">
      <span className="refund-date-time-cell__date">{datePart}</span>
      {timePart ? (
        <span className="refund-date-time-cell__time">{timePart}</span>
      ) : null}
    </OverflowTooltip>
  );
}

function renderStatusPill(value: RefundStatus, displayValue?: string) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return "-";
  const displayText = String(displayValue || text).trim();

  return (
    <OverflowTooltip
      text={displayText}
      className={`refund-status-pill ${getStatusClassName(text)}`}
    />
  );
}

function RefundReferenceButton({
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
      overlayClassName="refund-cell-tooltip"
      destroyTooltipOnHide
    >
      <button
        ref={elementRef}
        type="button"
        className={`refund-link-button ${className}`.trim()}
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

function renderReferenceButton(
  value: string,
  onOpen?: () => void,
  className = "",
) {
  if (!value || value === "-") return "-";
  if (!onOpen) return renderTextCell(value, className);

  return (
    <RefundReferenceButton
      value={value}
      onOpen={onOpen}
      className={className}
    />
  );
}

function isFineReference(referenceNo?: string) {
  return /^F-/i.test(String(referenceNo ?? "").trim());
}

function renderApplyForCell(record: RefundRecord) {
  const applyForName = String(record.applyFor.name ?? "").trim();
  if (!applyForName || applyForName === "-") {
    return "-";
  }

  const applyForIcon = getApplyForIcon(record.applyFor);

  return (
    <div className="refund-apply-for">
      {applyForIcon ? <img src={applyForIcon} alt="" /> : null}
      <OverflowTooltip text={applyForName} className="refund-apply-for__name" />
    </div>
  );
}

function stopRefundTableActionEvent(
  event:
    | React.MouseEvent<HTMLElement>
    | React.KeyboardEvent<HTMLElement>
    | MouseEvent
    | KeyboardEvent,
) {
  event.stopPropagation();
}

function RefundTableActions({
  actions,
  isRtl,
  moreLabel,
}: {
  actions: RefundResolvedRowAction[];
  isRtl: boolean;
  moreLabel: string;
}) {
  const rootClassName = isRtl
    ? "refund-table-actions refund-table-actions--rtl"
    : "refund-table-actions";
  const dropdownClassName = isRtl
    ? "refund-table-actions-dropdown refund-table-actions-dropdown--rtl"
    : "refund-table-actions-dropdown";

  return (
    <AdaptiveActionGroup
      actions={actions.map((action) => ({
        ...action,
        renderAction: ({ onClick }) => (
          <button
            type="button"
            className="refund-table-actions__button"
            onClick={(event) => {
              stopRefundTableActionEvent(event);
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
      moreButtonClassName="refund-table-actions__more-button"
      moreIcon={(
        <img
          className="refund-table-actions__more-icon"
          src={inspectionFigmaAssets.moreVerticalIcon}
          alt=""
        />
      )}
    />
  );
}

const CustomerRefunds: React.FC = () => {
  const { i18n, t } = useTranslation();
  const history = useHistory();
  const { activated, effectivePathname, effectiveSearch } =
    useKeepAliveRouteState({
      restorePathname: CUSTOMER_REFUNDS_PATH,
      restoreFrom: [CUSTOMER_REFUNDS_DETAILS_PATH],
      restoreStateKey: KEEP_ALIVE_RESTORE_STATE_KEY,
    });
  const searchParams = useMemo(
    () => new URLSearchParams(effectiveSearch),
    [effectiveSearch],
  );
  const queryViewRole = useMemo(
    () => getRefundViewRoleFromSearchParams(searchParams),
    [searchParams],
  );
  const fallbackViewRole = queryViewRole ?? DEFAULT_REFUND_VIEW_ROLE;
  const hasExplicitRoleFromQuery = queryViewRole !== undefined;

  const [viewRole, setViewRole] = useState<RefundViewRole>(fallbackViewRole);
  const [roleReady, setRoleReady] = useState(hasExplicitRoleFromQuery);
  const roleConfig =
    REFUND_ROLE_CONFIG[viewRole] ??
    REFUND_ROLE_CONFIG[DEFAULT_REFUND_VIEW_ROLE];
  const tabFromQuery = searchParams.get("tab");
  const initialTab = (
    tabFromQuery === "todo" || tabFromQuery === "completed"
      ? tabFromQuery
      : "todo"
  ) as RefundTabKey;

  const [tabKey, setTabKey] = useState<RefundTabKey>(initialTab);
  const [filters, setFilters] = useState<RefundListFilters>({ search: "" });
  /**
   * The modal filters category, status, source, handler and a date range; the
   * search box stays inline, so it is not counted.
   */
  const appliedFilterCount =
    countAppliedFilters([
      filters.category,
      filters.status,
      filters.source,
      filters.handlerId,
    ]) +
    (isAppliedFilterValue(filters.startDate) ||
    isAppliedFilterValue(filters.endDate)
      ? 1
      : 0);
  const [searchValue, setSearchValue] = useState("");
  const [filterOptions, setFilterOptions] = useState<RefundFilterOptions>({
    handlers: [],
    categories: [],
    todoStatuses: [],
    completedStatuses: [],
    completedSources: [],
  });
  const [departmentHandlers, setDepartmentHandlers] = useState<RefundHandler[]>(
    [],
  );
  const [summaryPayload, setSummaryPayload] = useState<
    AdminRefundStatisticsResponseDto | AdminRefundStatisticsData | null
  >(null);
  const [statusOptions, setStatusOptions] = useState<RefundStatusItemDto[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<RefundStatusItemDto[]>(
    [],
  );
  const [sourceTypeOptions, setSourceTypeOptions] = useState<
    RefundStatusItemDto[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [allowedFinalStatuses, setAllowedFinalStatuses] = useState<
    RefundStatusChangePayload["nextStatus"][]
  >([]);
  const [departmentActionOpen, setDepartmentActionOpen] = useState(false);
  const [departmentActionMode, setDepartmentActionMode] =
    useState<RefundDepartmentActionMode>("process");
  const [selectedRecord, setSelectedRecord] = useState<RefundRecord | null>(
    null,
  );
  const [rawTableItems, setRawTableItems] = useState<AdminRefundTicketListItemDto[]>(
    [],
  );
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [rawTotal, setRawTotal] = useState(0);
  const [sortBy, setSortBy] = useState<RefundTableSortKey | undefined>(
    undefined,
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const summaryInitializedRef = useRef(false);
  const lastLoadedListKeyRef = useRef("");
  const inFlightListKeyRef = useRef("");

  const toolbarConfig = roleConfig.list.toolbar[tabKey];
  const rowActions = roleConfig.list.rowActions[tabKey];
  const isBusinessRole = viewRole === "business_department";
  const isRtl = i18n.dir() === "rtl";
  const currentLanguage = i18n.resolvedLanguage || i18n.language;
  const permissions = useUserStore(
    (state) => state.userInfo?.listSysPermission || [],
  );
  const permissionPathSet = useMemo(
    () => createPermissionPathSet(permissions),
    [permissions],
  );

  const goToDetails = useCallback(
    (refundId?: number, refundNo?: string) => {
      const params = new URLSearchParams();
      params.set("viewRole", viewRole);
      if (refundId !== undefined && refundId !== null) {
        params.set("refundId", String(refundId));
      }
      if (refundNo) {
        params.set("refundNo", refundNo);
      }
      params.set("pageTitleKey", roleConfig.ui.detailsPageTitleKey);
      params.set("breadcrumbRootKey", roleConfig.ui.breadcrumbRootKey);
      history.push(`/happiness/refunds/refundsDetails?${params.toString()}`);
    },
    [
      history,
      roleConfig.ui.breadcrumbRootKey,
      roleConfig.ui.detailsPageTitleKey,
      viewRole,
    ],
  );

  const openReferenceDetails = useCallback(
    async (referenceNo?: string) => {
      const normalizedReferenceNo = String(referenceNo ?? "").trim();
      if (!normalizedReferenceNo || isFineReference(normalizedReferenceNo)) {
        return;
      }

      try {
        const response = await getTaskType({ applicationNo: normalizedReferenceNo });
        const payload = (
          (response as { data?: { taskId?: string; departmentId?: number } })
            ?.data ?? response
        ) as
          | {
              taskId?: string;
              departmentId?: number;
            }
          | undefined;

        const targetRoute =
          payload?.departmentId !== undefined
            ? APPLICATION_DETAIL_ROUTE_MAP[payload.departmentId]
            : undefined;
        if (targetRoute && payload?.taskId) {
          if (!permissionPathSet.has(normalizeRoutePath(targetRoute))) {
            CustomMessage.warning(t("response.error.403"));
            return;
          }
          history.push(`${targetRoute}?taskId=${payload.taskId}`);
          return;
        }

        CustomMessage.warning(
          t("Customer.customerRefunds.messages.relatedApplicationNotFound"),
        );
      } catch {
        CustomMessage.warning(
          t("Customer.customerRefunds.messages.relatedApplicationNotFound"),
        );
      }
    },
    [history, permissionPathSet, t],
  );

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setFilters((prev) => ({ ...prev, search: value }));
        setPageIndex(1);
      }, 250),
    [],
  );

  useEffect(() => {
    const nextTab = searchParams.get("tab") as RefundTabKey;
    if (
      nextTab &&
      nextTab !== tabKey &&
      (nextTab === "todo" || nextTab === "completed")
    ) {
      setTabKey(nextTab);
    }
  }, [searchParams, tabKey]);

  useEffect(() => {
    debouncedSearch(searchValue);
  }, [debouncedSearch, searchValue]);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    if (!hasExplicitRoleFromQuery) return;
    setViewRole((prev) => (prev === fallbackViewRole ? prev : fallbackViewRole));
    setRoleReady(true);
  }, [fallbackViewRole, hasExplicitRoleFromQuery]);

  useEffect(() => {
    if (!hasExplicitRoleFromQuery && !roleReady) return;
    if (!activated) return;

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
      history.replace({
        pathname: effectivePathname,
        search: params.toString(),
      });
    }
  }, [
    activated,
    effectivePathname,
    effectiveSearch,
    history,
    hasExplicitRoleFromQuery,
    roleReady,
    roleConfig.ui.breadcrumbRootKey,
    roleConfig.ui.listPageTitleKey,
    tabKey,
    viewRole,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadPageContext = async () => {
      try {
        const statusRequest =
          viewRole === "customer_happiness"
            ? getAdminRefundStatusTypes()
            : getAdminRefundDepartmentStatusTypes();
        const [
          categoriesRes,
          sourceTypesRes,
          handlersRes,
          departmentsRes,
          statusRes,
        ] = await Promise.all([
          getAdminRefundCategories(),
          getAdminRefundSourceTypes(),
          getAdminRefundDepartmentUsers(),
          getAdminRefundDepartments(),
          statusRequest,
        ]);

        if (cancelled) return;

        const categoriesPayload =
          (categoriesRes as { data?: RefundStatusItemDto[] })?.data ??
          categoriesRes;
        const sourceTypesPayload =
          (sourceTypesRes as { data?: RefundStatusItemDto[] })?.data ??
          sourceTypesRes;
        const handlersPayload =
          (handlersRes as { data?: unknown })?.data ?? handlersRes;
        const departmentsPayload =
          (departmentsRes as { data?: unknown })?.data ?? departmentsRes;
        const statusPayload = (statusRes as { data?: unknown })?.data ?? statusRes;
        const categoryList = Array.isArray(categoriesPayload) ? categoriesPayload : [];
        const sourceTypeList = Array.isArray(sourceTypesPayload)
          ? sourceTypesPayload
          : [];
        const statusList = Array.isArray(statusPayload) ? statusPayload : [];
        const handlerList = mapAdminDepartmentUsersToHandlers(
          Array.isArray(handlersPayload) ? handlersPayload : [],
        );
        const departmentList = mapAdminDepartmentsToHandlers(
          Array.isArray(departmentsPayload) ? departmentsPayload : [],
        );
        setCategoryOptions(categoryList);
        setSourceTypeOptions(sourceTypeList);
        setStatusOptions(statusList);
        setDepartmentHandlers(departmentList);
        setFilterOptions({
          handlers:
            viewRole === "customer_happiness"
              ? [
                  {
                    id: CUSTOMER_FILTER_HANDLER_ID,
                    name: t("Customer.customerRefunds.common.customer"),
                    department: "",
                  },
                  ...handlerList,
                ]
              : handlerList,
          categories: mapRefundFilterSelectOptions(
            categoryList,
            currentLanguage,
          ),
          todoStatuses: mapRefundFilterSelectOptions(
            statusList,
            currentLanguage,
            roleConfig.list.tabStatuses.todo,
          ),
          completedStatuses: mapRefundFilterSelectOptions(
            statusList,
            currentLanguage,
            roleConfig.list.tabStatuses.completed,
          ),
          completedSources: mapRefundFilterSelectOptions(
            sourceTypeList,
            currentLanguage,
          ),
        });
      } catch (error) {
        if (cancelled) return;
        console.error(error);
      }
    };

    loadPageContext();
    return () => {
      cancelled = true;
    };
  }, [
    roleConfig.list.tabStatuses.completed,
    roleConfig.list.tabStatuses.todo,
    currentLanguage,
    t,
    viewRole,
  ]);

  const loadSummary = useCallback(async (): Promise<RefundViewRole> => {
    try {
      const response = (await getAdminRefundTicketsStatistics()) as
        | AdminRefundStatisticsResponseDto
        | AdminRefundStatisticsData;
      const nextRole = hasExplicitRoleFromQuery
        ? fallbackViewRole
        : resolveRefundViewRole(response);

      setSummaryPayload(response);
      if (!hasExplicitRoleFromQuery) {
        setViewRole((prev) => (prev === nextRole ? prev : nextRole));
      }
      return nextRole;
    } catch (error) {
      console.error(error);
      setSummaryPayload(null);
      return hasExplicitRoleFromQuery ? fallbackViewRole : viewRole;
    } finally {
      setRoleReady(true);
    }
  }, [fallbackViewRole, hasExplicitRoleFromQuery, viewRole]);

  const resolveCurrentHandler = useCallback(
    (record: RefundRecord): RefundRecord["currentHandler"] => {
      if (record.status === "Pending Customer") {
        return {
          id: CUSTOMER_FILTER_HANDLER_ID,
          name: t("Customer.customerRefunds.common.customer"),
          department: "",
        };
      }

      const hasNamedHandler =
        Boolean(record.currentHandler.name) &&
        record.currentHandler.name !== "-";
      const matchedHandler = filterOptions.handlers.find(
        (item) =>
          item.id !== CUSTOMER_FILTER_HANDLER_ID &&
          isSameHandlerDepartment(record.currentHandler, item),
      );

      if (record.status === "Department Processed") {
        return {
          ...record.currentHandler,
          id: matchedHandler?.id ?? record.currentHandler.id,
          name: matchedHandler?.name ?? record.currentHandler.name,
          department:
            matchedHandler?.department ??
            (hasNamedHandler ? record.currentHandler.department : ""),
        };
      }

      if (record.status !== "Department Processing") {
        return record.currentHandler;
      }

      return {
        ...record.currentHandler,
        id: matchedHandler?.id ?? record.currentHandler.id,
        name: matchedHandler?.name ?? record.currentHandler.name,
        department:
          matchedHandler?.department ??
          (hasNamedHandler ? record.currentHandler.department : ""),
      };
    },
    [filterOptions.handlers, t],
  );

  const buildTicketRequestParams = useCallback((
    requestViewRole: RefundViewRole = viewRole,
  ): AdminRefundTicketsParams => {
    const statusId = filters.status
      ? mapStatusNameToId(filters.status, statusOptions)
      : undefined;
    const categoryId = categoryOptions.find(
      (item) => item.nameEn === filters.category,
    )?.id;
    const sourceTypeId = sourceTypeOptions.find(
      (item) => item.nameEn === filters.source,
    )?.id;

    return {
      SeachKey: filters.search || undefined,
      CategoryId: categoryId,
      StatusId: statusId,
      SourceTypeId: sourceTypeId,
      StartDate: filters.startDate || undefined,
      EndDate: filters.endDate || undefined,
      IsCompleted: tabKey === "completed",
      PageSize: pageSize,
      PageIndex: pageIndex,
      SortBy: resolveRefundSortBy(requestViewRole, tabKey, sortBy),
      SortDirection: resolveRefundSortDirection(sortBy, sortDirection),
    };
  }, [
    categoryOptions,
    filters,
    pageIndex,
    pageSize,
    sortBy,
    sortDirection,
    sourceTypeOptions,
    statusOptions,
    tabKey,
    viewRole,
  ]);

  const loadList = useCallback(async ({
    force = false,
    requestViewRole = viewRole,
  }: LoadRefundListOptions = {}) => {
    const requestParams = buildTicketRequestParams(requestViewRole);
    const requestKey = JSON.stringify({
      ...requestParams,
      viewRole: requestViewRole,
    });

    if (!force) {
      if (inFlightListKeyRef.current === requestKey) return;
      if (lastLoadedListKeyRef.current === requestKey) return;
    }

    inFlightListKeyRef.current = requestKey;
    setLoading(true);
    try {
      const requestFn =
        requestViewRole === "customer_happiness"
          ? getAdminCustomerServiceRefundTickets
          : getAdminRefundTickets;
      const response = (await requestFn(requestParams)) as {
        data?: { items?: AdminRefundTicketListItemDto[]; total?: number };
        items?: AdminRefundTicketListItemDto[];
        total?: number;
      };
      const payload = response?.data ?? response;
      const items = Array.isArray(payload?.items)
        ? payload.items
        : [];
      setRawTableItems(items);
      setRawTotal(Number(payload?.total || 0));
      lastLoadedListKeyRef.current = requestKey;
    } finally {
      if (inFlightListKeyRef.current === requestKey) {
        inFlightListKeyRef.current = "";
      }
      setLoading(false);
    }
  }, [
    buildTicketRequestParams,
    viewRole,
  ]);

  useEffect(() => {
    if (summaryInitializedRef.current) return;
    summaryInitializedRef.current = true;
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!roleReady) return;
    void loadList();
  }, [loadList, roleReady]);

  useKeepAliveActivated({
    onActivated: () => {
      void refreshRefundsView();
    },
    onDeactivated: () => {
      setFilterOpen(false);
      setStatusOpen(false);
      setAllowedFinalStatuses([]);
      setDepartmentActionOpen(false);
      setSelectedRecord(null);
    },
  });

  const handleReset = () => {
    setSearchValue("");
    setFilters({ search: "" });
    setPageIndex(1);
    setSortBy(undefined);
    setSortDirection("desc");
  };

  const getAttachmentPayload = useCallback(
    (attachments?: RefundRecord["attachments"]) => {
      const urls = (attachments ?? [])
        .map((item) => item.filePath || item.url)
        .filter(Boolean);
      return {
        attachmentsURL01: urls[0],
        attachmentsURL02: urls[1],
        attachmentsURL03: urls[2],
      };
    },
    [],
  );

  const openDepartmentActionModal = (
    record: RefundRecord,
    mode: RefundDepartmentActionMode,
  ) => {
    setSelectedRecord(record);
    setDepartmentActionMode(mode);
    setDepartmentActionOpen(true);
  };

  const openStatusModal = async (record: RefundRecord) => {
    if (!record.refundId) return;

    try {
      const [detailResponse, timelineResponse] = await Promise.all([
        getAdminRefundTicketDetail(record.refundId),
        getAdminRefundTicketTimeline(record.refundId),
      ]);
      const detailPayload =
        ((detailResponse as { data?: AdminRefundDetailDto })?.data ??
          detailResponse) as AdminRefundDetailDto;
      const timelinePayload =
        ((timelineResponse as { data?: AdminRefundTimelineItemDto[] })?.data ??
          timelineResponse) as AdminRefundTimelineItemDto[];
      const timelineItems = Array.isArray(timelinePayload)
        ? timelinePayload
        : [];
      const nextRecord = mergeAdminRefundDetail(
        record,
        detailPayload,
        timelineItems,
      );
      const nextAllowedStatuses =
        resolveAllowedRefundFinalStatuses(nextRecord);

      if (!nextAllowedStatuses.length) {
        CustomMessage.warning(
          t("Customer.customerRefunds.messages.statusChangeUnavailable"),
        );
        return;
      }

      setSelectedRecord(nextRecord);
      setAllowedFinalStatuses(nextAllowedStatuses);
      setStatusOpen(true);
    } catch {
      CustomMessage.warning(
        t("Customer.customerRefunds.messages.statusChangeUnavailable"),
      );
    }
  };

  const handleStatusSubmit = async (payload: RefundStatusChangePayload) => {
    if (!selectedRecord?.refundId) return;
    const statusId = mapStatusNameToId(payload.nextStatus, statusOptions);
    if (!statusId) {
      CustomMessage.error(
        t("Customer.customerRefunds.messages.statusMappingUnavailable"),
      );
      return;
    }

    await updateAdminRefundTicketStatus(selectedRecord.refundId, {
      statusId,
      ...getAttachmentPayload(payload.attachments),
      notes: payload.notes,
      assignDeptId: payload.departmentId ? Number(payload.departmentId) : undefined,
      deadLine: payload.responseDeadline,
      isInternal: payload.nextStatus === "Department Processing",
      roleId:
        payload.nextStatus === "Department Processing" ? payload.roleId : undefined,
    });
    CustomMessage.success(t("Customer.customerRefunds.messages.operationSuccessful"));
    setStatusOpen(false);
    setAllowedFinalStatuses([]);
    setSelectedRecord(null);
    await refreshRefundsView();
  };

  const handleDepartmentActionSubmit = async (
    payload: RefundDepartmentActionPayload,
  ) => {
    if (!selectedRecord?.refundId) return;

    if (departmentActionMode === "process") {
      if (!("decision" in payload)) return;
      const statusId = mapStatusNameToId("Department Processed", statusOptions);
      const decisionTypeId = mapProcessDecisionToId(payload.decision);

      if (!statusId || !decisionTypeId) {
        CustomMessage.error(
          t("Customer.customerRefunds.messages.statusMappingUnavailable"),
        );
        return;
      }

      await transferAdminRefundTicketStatus(selectedRecord.refundId, {
        statusId,
        ...getAttachmentPayload(payload.attachments),
        notes: payload.notes,
        decisionTypeId,
        isInternal: true,
      });
    } else {
      await sendBackAdminRefundTicket(selectedRecord.refundId, {
        ...getAttachmentPayload(payload.attachments),
        notes: payload.notes,
      });
    }

    CustomMessage.success(t("Customer.customerRefunds.messages.operationSuccessful"));
    setDepartmentActionOpen(false);
    setSelectedRecord(null);
    await refreshRefundsView();
  };

  const tableData = useMemo(() => {
    const allowedStatuses = roleConfig.list.tabStatuses[tabKey];
    const mappedItems = rawTableItems
      .map((item) => mapAdminRefundListItemToRecord(item, currentLanguage))
      .map((item) => ({
        ...item,
        currentHandler: resolveCurrentHandler(item),
      }))
      .filter((item) => allowedStatuses.includes(item.status));

    if (!filters.handlerId) return mappedItems;

    const selectedHandler = filterOptions.handlers.find(
      (item) => item.id === filters.handlerId,
    );
    if (!selectedHandler) return mappedItems;

    return mappedItems.filter((item) => {
      if (selectedHandler.id === CUSTOMER_FILTER_HANDLER_ID) {
        return item.currentHandler.id === CUSTOMER_FILTER_HANDLER_ID;
      }

      return (
        isSameHandlerId(item.currentHandler, selectedHandler) ||
        isSameHandlerDepartment(item.currentHandler, selectedHandler)
      );
    });
  }, [
    filterOptions.handlers,
    filters.handlerId,
    currentLanguage,
    rawTableItems,
    resolveCurrentHandler,
    roleConfig.list.tabStatuses,
    tabKey,
  ]);

  const resolveRowActions = (record: RefundRecord): RefundResolvedRowAction[] => {
    const actions: RefundResolvedRowAction[] = [];

    if (rowActions.includes("message")) {
      actions.push({
        key: "message",
        label: t("Customer.customerRefunds.actions.message"),
        onClick: () => goToDetails(record.refundId, record.refundNo),
      });
    }

    if (
      rowActions.includes("change_status") &&
      canShowRefundChangeStatusAction(
        record,
        roleConfig.details.allowChangeStatusStatuses,
      )
    ) {
      actions.push({
        key: "change_status",
        label: t("Customer.customerRefunds.actions.changeStatus"),
        onClick: () => {
          void openStatusModal(record);
        },
      });
    }

    if (
      rowActions.includes("process") &&
      roleConfig.details.allowDepartmentActionStatuses.includes(record.status)
    ) {
      actions.push({
        key: "process",
        label: t("Customer.customerRefunds.actions.process"),
        onClick: () => openDepartmentActionModal(record, "process"),
      });
    }

    if (
      rowActions.includes("send_back") &&
      roleConfig.details.allowDepartmentActionStatuses.includes(record.status)
    ) {
      actions.push({
        key: "send_back",
        label: t("Customer.customerRefunds.actions.sendBack"),
        onClick: () => openDepartmentActionModal(record, "send_back"),
      });
    }

    return actions;
  };

  const todoColumnWidths = getRefundTodoColumnWidths(viewRole);
  const refundActionColumnWidth = useResponsiveActionColumnWidth<
    RefundRecord,
    RefundActionColumnKey
  >({
    rows: tabKey === "todo" ? tableData : [],
    buttonWidthMap: REFUND_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: (record) =>
      getAdaptiveActionColumnKeys(resolveRowActions(record), "more", {
        maxInlineActions: 2,
      }),
    getActionLabel: (actionKey) => {
      switch (actionKey) {
        case "message":
          return t("Customer.customerRefunds.actions.message");
        case "change_status":
          return t("Customer.customerRefunds.actions.changeStatus");
        case "process":
          return t("Customer.customerRefunds.actions.process");
        case "send_back":
          return t("Customer.customerRefunds.actions.sendBack");
        default:
          return undefined;
      }
    },
    desktopConfig: REFUND_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: REFUND_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: REFUND_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });
  const activeTodoColumnWidths = {
    ...todoColumnWidths,
    actions: refundActionColumnWidth,
  };
  const todoColumns: ColumnsType<RefundRecord> = [
    {
      title: t("Customer.customerRefunds.table.applicationNo"),
      dataIndex: "refundNo",
      key: "refundNo",
      fixed: "left",
      width: activeTodoColumnWidths.applicationNo,
      render: (value: string) => renderTextCell(
        value,
        "refund-table-number refund-overflow-text--two-line",
      ),
    },
    {
      title: t("Customer.customerRefunds.table.refundCategory"),
      dataIndex: "category",
      key: "category",
      width: activeTodoColumnWidths.refundCategory,
      render: (_: string, record) => renderTextCell(
        record.categoryDisplay || record.category,
        "refund-overflow-text--two-line",
      ),
    },
    {
      title: t("Customer.customerRefunds.table.referenceNo"),
      dataIndex: "referenceNo",
      key: "referenceNo",
      width: activeTodoColumnWidths.referenceNo,
      render: (value: string) =>
        renderReferenceButton(
          value,
          isFineReference(value)
            ? undefined
            : () => void openReferenceDetails(value),
          "refund-link-button--two-line",
        ),
    },
    {
      title: t("Customer.customerRefunds.table.applyFor"),
      dataIndex: "applyFor",
      key: "applyFor",
      width: activeTodoColumnWidths.applyFor,
      render: (_, record) => renderApplyForCell(record),
    },
    {
      title: <CurrencyLabel label={t("Customer.customerRefunds.table.amount")} />,
      dataIndex: "amount",
      key: "amount",
      width: activeTodoColumnWidths.amount,
      render: (_, record) => renderTextCell(
        `-${formatMoney(Math.abs(record.amount))}`,
        "refund-amount-negative",
      ),
    },
    {
      title: t("Customer.customerRefunds.table.sla"),
      dataIndex: "slaHours",
      key: "sla",
      width: activeTodoColumnWidths.sla,
      sorter: true,
      render: (_, record) => {
        return renderTextCell(
          record.rawSla || "-",
          typeof record.slaHours === "number" && record.slaHours < 0
            ? "refund-sla-overdue"
            : "",
        );
      },
    },
    {
      title: t("Customer.customerRefunds.table.currentHandler"),
      dataIndex: "currentHandler",
      key: "currentHandler",
      width: activeTodoColumnWidths.currentHandler,
      render: (_, record) => {
        if (record.currentHandler.name === "-") {
          return "-";
        }
        return (
          <div className="refund-handler-cell">
            <OverflowTooltip
              text={record.currentHandler.name}
              className="refund-handler-name"
            />
            {record.currentHandler.department ? (
              <OverflowTooltip
                text={record.currentHandler.department}
                className="refund-handler-department"
              />
            ) : null}
          </div>
        );
      },
    },
    {
      title: t("Customer.customerRefunds.table.status"),
      dataIndex: "status",
      key: "status",
      width: activeTodoColumnWidths.status,
      render: (value: RefundStatus, record) =>
        renderStatusPill(value, record.statusDisplay),
    },
    {
      title: t("Customer.customerRefunds.table.lastUpdated"),
      dataIndex: "lastUpdatedAt",
      key: "lastUpdatedAt",
      width: activeTodoColumnWidths.lastUpdated,
      sorter: true,
      render: (value: string) => renderDateTimeCell(formatDateTime(value)),
    },
    {
      title: t("Customer.customerRefunds.table.actions"),
      key: "actions",
      width: refundActionColumnWidth,
      fixed: "right",
      align: isRtl ? "right" : "left",
      className: isRtl
        ? "refund-actions-cell refund-actions-cell--rtl"
        : "refund-actions-cell",
      onCell: () => ({
        onClick: stopRefundTableActionEvent,
      }),
      onHeaderCell: () => ({
        className: isRtl
          ? "refund-actions-cell refund-actions-cell--rtl"
          : "refund-actions-cell",
      }),
      render: (_, record) => (
        <RefundTableActions
          actions={resolveRowActions(record)}
          isRtl={isRtl}
          moreLabel={t("Customer.customerRefunds.actions.more")}
        />
      ),
    },
  ];

  const customerCompletedColumns: ColumnsType<RefundRecord> = [
    {
      title: t("Customer.customerRefunds.table.applicationNo"),
      dataIndex: "refundNo",
      key: "refundNo",
      fixed: "left",
      width: pxToRemValue(REFUND_CUSTOMER_COMPLETED_COLUMN_WIDTHS.applicationNo),
      render: (value: string) => renderTextCell(
        value,
        "refund-table-number refund-overflow-text--two-line",
      ),
    },
    {
      title: t("Customer.customerRefunds.table.refundCategory"),
      dataIndex: "category",
      key: "category",
      width: pxToRemValue(REFUND_CUSTOMER_COMPLETED_COLUMN_WIDTHS.refundCategory),
      render: (_: string, record) => renderTextCell(
        record.categoryDisplay || record.category,
        "refund-overflow-text--two-line",
      ),
    },
    {
      title: t("Customer.customerRefunds.table.referenceNo"),
      dataIndex: "referenceNo",
      key: "referenceNo",
      width: pxToRemValue(REFUND_CUSTOMER_COMPLETED_COLUMN_WIDTHS.referenceNo),
      render: (value: string) =>
        renderReferenceButton(
          value,
          isFineReference(value)
            ? undefined
            : () => void openReferenceDetails(value),
          "refund-link-button--two-line",
        ),
    },
    {
      title: t("Customer.customerRefunds.table.applyFor"),
      dataIndex: "applyFor",
      key: "applyFor",
      width: pxToRemValue(REFUND_CUSTOMER_COMPLETED_COLUMN_WIDTHS.applyFor),
      render: (_, record) => renderApplyForCell(record),
    },
    {
      title: <CurrencyLabel label={t("Customer.customerRefunds.table.amount")} />,
      dataIndex: "amount",
      key: "amount",
      width: pxToRemValue(REFUND_CUSTOMER_COMPLETED_COLUMN_WIDTHS.amount),
      render: (_, record) => renderTextCell(
        `-${formatMoney(Math.abs(record.amount))}`,
        "refund-amount-negative",
      ),
    },
    {
      title: t("Customer.customerRefunds.table.refundSource"),
      dataIndex: "source",
      key: "source",
      width: pxToRemValue(REFUND_CUSTOMER_COMPLETED_COLUMN_WIDTHS.refundSource),
      render: (value: string) => renderTextCell(value),
    },
    {
      title: t("Customer.customerRefunds.table.sla"),
      dataIndex: "slaHours",
      key: "sla",
      width: pxToRemValue(REFUND_CUSTOMER_COMPLETED_COLUMN_WIDTHS.sla),
      render: (_, record) =>
        renderTextCell(getSlaCompletionLabel(record.slaHours, record.rawSla, t)),
    },
    {
      title: t("Customer.customerRefunds.table.status"),
      dataIndex: "status",
      key: "status",
      width: pxToRemValue(REFUND_CUSTOMER_COMPLETED_COLUMN_WIDTHS.status),
      render: (value: RefundStatus, record) =>
        renderStatusPill(value, record.statusDisplay),
    },
    {
      title: t("Customer.customerRefunds.table.lastUpdated"),
      dataIndex: "lastUpdatedAt",
      key: "lastUpdatedAt",
      width: pxToRemValue(REFUND_CUSTOMER_COMPLETED_COLUMN_WIDTHS.lastUpdated),
      sorter: true,
      render: (value: string) => renderDateTimeCell(formatDateTime(value)),
    },
  ];

  const businessCompletedColumns: ColumnsType<RefundRecord> = [
    {
      title: t("Customer.customerRefunds.table.applicationNo"),
      dataIndex: "refundNo",
      key: "refundNo",
      fixed: "left",
      width: pxToRemValue(REFUND_BUSINESS_COMPLETED_COLUMN_WIDTHS.applicationNo),
      render: (value: string) => renderTextCell(
        value,
        "refund-table-number refund-overflow-text--two-line",
      ),
    },
    {
      title: t("Customer.customerRefunds.table.refundCategory"),
      dataIndex: "category",
      key: "category",
      width: pxToRemValue(REFUND_BUSINESS_COMPLETED_COLUMN_WIDTHS.refundCategory),
      render: (_: string, record) => renderTextCell(
        record.categoryDisplay || record.category,
        "refund-overflow-text--two-line",
      ),
    },
    {
      title: t("Customer.customerRefunds.table.referenceNo"),
      dataIndex: "referenceNo",
      key: "referenceNo",
      width: pxToRemValue(REFUND_BUSINESS_COMPLETED_COLUMN_WIDTHS.referenceNo),
      render: (value: string) =>
        renderReferenceButton(
          value,
          isFineReference(value)
            ? undefined
            : () => void openReferenceDetails(value),
          "refund-link-button--two-line",
        ),
    },
    {
      title: t("Customer.customerRefunds.table.applyFor"),
      dataIndex: "applyFor",
      key: "applyFor",
      width: pxToRemValue(REFUND_BUSINESS_COMPLETED_COLUMN_WIDTHS.applyFor),
      render: (_, record) => renderApplyForCell(record),
    },
    {
      title: <CurrencyLabel label={t("Customer.customerRefunds.table.amount")} />,
      dataIndex: "amount",
      key: "amount",
      width: pxToRemValue(REFUND_BUSINESS_COMPLETED_COLUMN_WIDTHS.amount),
      render: (_, record) => renderTextCell(
        `-${formatMoney(Math.abs(record.amount))}`,
        "refund-amount-negative",
      ),
    },
    {
      title: t("Customer.customerRefunds.table.sla"),
      dataIndex: "slaHours",
      key: "sla",
      width: pxToRemValue(REFUND_BUSINESS_COMPLETED_COLUMN_WIDTHS.sla),
      sorter: true,
      render: (_, record) => {
        const text = getSlaCompletionLabel(record.slaHours, record.rawSla, t);
        return renderTextCell(
          text,
          typeof record.slaHours === "number" && record.slaHours < 0
            ? "refund-sla-overdue"
            : "",
        );
      },
    },
    {
      title: t("Customer.customerRefunds.table.status"),
      dataIndex: "status",
      key: "status",
      width: pxToRemValue(REFUND_BUSINESS_COMPLETED_COLUMN_WIDTHS.status),
      render: (value: RefundStatus, record) =>
        renderStatusPill(value, record.statusDisplay),
    },
    {
      title: t("Customer.customerRefunds.table.lastUpdated"),
      dataIndex: "lastUpdatedAt",
      key: "lastUpdatedAt",
      width: pxToRemValue(REFUND_BUSINESS_COMPLETED_COLUMN_WIDTHS.lastUpdated),
      sorter: true,
      render: (value: string) => renderDateTimeCell(formatDateTime(value)),
    },
  ];

  const completedColumns = isBusinessRole
    ? businessCompletedColumns
    : customerCompletedColumns;
  const tableScrollX =
    tabKey === "todo"
      ? sumColumnWidths(activeTodoColumnWidths)
      : isBusinessRole
        ? REFUND_BUSINESS_COMPLETED_TABLE_SCROLL_WIDTH
        : REFUND_CUSTOMER_COMPLETED_TABLE_SCROLL_WIDTH;

  const visibleSummaryItems = useMemo(
    () => mapRefundSummaryItems(roleReady ? viewRole : fallbackViewRole, summaryPayload),
    [fallbackViewRole, roleReady, summaryPayload, viewRole],
  );

  const total = filters.handlerId ? tableData.length : rawTotal;

  const refreshRefundsView = useCallback(async () => {
    const nextRole = await loadSummary();
    await loadList({ force: true, requestViewRole: nextRole });
  }, [loadList, loadSummary]);

  const handleTableChange: TableProps<RefundRecord>["onChange"] = (
    pagination,
    _,
    sorter,
  ) => {
    setPageIndex(pagination.current || 1);
    setPageSize(pagination.pageSize || DEFAULT_PAGE_SIZE);

    const nextSorter = sorter as SorterResult<RefundRecord>;
    if (!nextSorter.order) {
      setSortBy(undefined);
      setSortDirection("desc");
      return;
    }
    setSortBy(nextSorter.columnKey === "sla" ? "sla" : "lastUpdatedAt");
    setSortDirection(nextSorter.order === "ascend" ? "asc" : "desc");
  };

  return (
    <div
      className={`customer-refunds-page ${
        isBusinessRole ? "is-business-role" : "is-customer-role"
      }`}
    >
      <div className="refund-summary-grid">
        {visibleSummaryItems.map((item) => {
          const summaryCount = formatSummaryCount(item.count);
          const summaryLabel = t(
            `Customer.customerRefunds.summary.${item.key}`,
          );

          return (
            <div className="refund-summary-card" key={item.key}>
              <div className="refund-summary-icon">
                <img src={SUMMARY_ICON_MAP[item.iconKey]} alt="" />
              </div>
              <div className="refund-summary-content">
                <div className="refund-summary-count" title={summaryCount}>
                  {summaryCount}
                </div>
                <div className="refund-summary-label" title={summaryLabel}>
                  {summaryLabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="refund-panel">
        <Tabs
          activeKey={tabKey}
          onChange={(nextKey) => {
            const nextTab = nextKey as RefundTabKey;
            setTabKey(nextTab);
            const params = new URLSearchParams(effectiveSearch);
            params.set("tab", nextTab);
            params.set("pageTitleKey", roleConfig.ui.listPageTitleKey);
            params.set("breadcrumbRootKey", roleConfig.ui.breadcrumbRootKey);
            history.replace({ search: params.toString() });
            setFilters({ search: searchValue });
            setPageIndex(1);
            setSortBy(undefined);
            setSortDirection("desc");
          }}
          className="refund-tabs"
        >
          <Tabs.TabPane tab={t("Customer.customerRefunds.tabs.todo")} key="todo" />
          <Tabs.TabPane
            tab={t("Customer.customerRefunds.tabs.completed")}
            key="completed"
          />
        </Tabs>

        <div className="refund-toolbar">
          <div className="refund-toolbar-left">
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={t("Customer.customerRefunds.toolbar.search")}
              prefix={<SearchIcon />}
              allowClear
              className="refund-search-input responsive-filter-toolbar__field--single-visible-search"
            />
            <Select
              allowClear
              value={filters.category}
              placeholder={t("Customer.customerRefunds.toolbar.allCategories")}
              className="refund-toolbar-select refund-toolbar-secondary-filter"
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, category: value }));
                setPageIndex(1);
              }}
            >
              {filterOptions.categories.map((item) => (
                <Select.Option value={item.value} key={item.value}>
                  {item.label}
                </Select.Option>
              ))}
            </Select>

            {toolbarConfig.showDateRange ? (
              <DatePicker.RangePicker
                value={
                  filters.startDate && filters.endDate
                    ? [moment(filters.startDate), moment(filters.endDate)]
                    : undefined
                }
                format="DD/MM/YYYY"
                className="refund-toolbar-date-range refund-toolbar-secondary-filter"
                onChange={(range) => {
                  setFilters((prev) => ({
                    ...prev,
                    startDate: range?.[0] ? toApi(range[0].startOf("day").toDate()) : undefined,
                    endDate: range?.[1] ? toApi(range[1].endOf("day").toDate()) : undefined,
                  }));
                  setPageIndex(1);
                }}
              />
            ) : null}

            {toolbarConfig.showStatusSelect ? (
              <Select
                allowClear
                value={filters.status}
                placeholder={t("Customer.customerRefunds.toolbar.allStatuses")}
                className="refund-toolbar-select refund-toolbar-secondary-filter"
                onChange={(value) => {
                  setFilters((prev) => ({ ...prev, status: value }));
                  setPageIndex(1);
                }}
              >
                {(tabKey === "todo"
                  ? filterOptions.todoStatuses
                  : filterOptions.completedStatuses
                ).map((item) => (
                  <Select.Option value={item.value} key={item.value}>
                    {item.label}
                  </Select.Option>
                ))}
              </Select>
            ) : null}

            {toolbarConfig.showSourceSelect ? (
              <Select
                allowClear
                value={filters.source}
                placeholder={t("Customer.customerRefunds.toolbar.allSources")}
                className="refund-toolbar-select refund-toolbar-secondary-filter"
                onChange={(value) => {
                  setFilters((prev) => ({ ...prev, source: value }));
                  setPageIndex(1);
                }}
              >
                {filterOptions.completedSources.map((item) => (
                  <Select.Option value={item.value} key={item.value}>
                    {item.label}
                  </Select.Option>
                ))}
              </Select>
            ) : null}

            {toolbarConfig.showFilterButton || toolbarConfig.showDateRange || toolbarConfig.showResetButton ? (
              <div className="refund-toolbar-actions-left">
                {toolbarConfig.showFilterButton || toolbarConfig.showDateRange ? (
                  <ToolbarButton
                    onClick={() => setFilterOpen(true)}
                    icon={<FilterIcon />}
                    badge={<FilterCountBadge count={appliedFilterCount} />}
                    className={toolbarConfig.showFilterButton ? "" : "refund-toolbar-filter-button--compact-only"}
                  >
                    {t("Customer.customerRefunds.actions.filter")}
                  </ToolbarButton>
                ) : null}
                {toolbarConfig.showResetButton ? (
                  <ToolbarButton onClick={handleReset}>
                    {t("Customer.customerRefunds.actions.reset")}
                  </ToolbarButton>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="refund-toolbar-actions-right">
            <ToolbarButton
              onClick={async () => {
                const exportRequest =
                  viewRole === "customer_happiness"
                    ? exportAdminCustomerServiceRefundTickets
                    : exportAdminRefundTickets;
                await exportRequest(buildTicketRequestParams());
              }}
            >
              {t("Customer.customerRefunds.actions.export")}
            </ToolbarButton>
          </div>
        </div>

        <Table
          className="refund-table admin-table"
          loading={loading}
          rowKey={(record) => String(record.refundId ?? record.refundNo)}
          columns={tabKey === "todo" ? todoColumns : completedColumns}
          dataSource={tableData}
          onRow={(record) => ({
            className: "refund-table-row-clickable",
            onClick: () => goToDetails(record.refundId, record.refundNo),
          })}
          pagination={{
            size: "default",
            current: pageIndex,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (totalValue) => (
              <PaginationTotal label={t("common.total")} total={totalValue} current={pageIndex} pageSize={pageSize} />
            ),
          }}
          scroll={{ x: tableScrollX }}
          onChange={handleTableChange}
        />
      </div>

      <RefundFilterModal
        open={filterOpen}
        tabKey={tabKey}
        mode={roleConfig.list.filterModalMode[tabKey]}
        responsiveCompactFields={{
          category: true,
          status:
            (viewRole === "customer_happiness" && tabKey === "todo") ||
            (viewRole === "business_department" && tabKey === "completed"),
          source:
            viewRole === "customer_happiness" && tabKey === "completed",
        }}
        value={filters}
        options={filterOptions}
        onCancel={() => setFilterOpen(false)}
        onApply={(nextValue) => {
          setFilters((prev) => ({
            ...prev,
            ...nextValue,
          }));
          setPageIndex(1);
          setFilterOpen(false);
        }}
      />

      <RefundStatusModal
        open={statusOpen}
        record={selectedRecord}
        handlers={departmentHandlers.length ? departmentHandlers : filterOptions.handlers}
        onCancel={() => {
          setStatusOpen(false);
          setAllowedFinalStatuses([]);
          setSelectedRecord(null);
        }}
        allowedStatuses={allowedFinalStatuses}
        onSubmit={handleStatusSubmit}
      />

      <RefundDepartmentProcessModal
        open={departmentActionOpen}
        mode={departmentActionMode}
        onCancel={() => {
          setDepartmentActionOpen(false);
          setSelectedRecord(null);
        }}
        onSubmit={handleDepartmentActionSubmit}
      />
    </div>
  );
};

export default CustomerRefunds;
