import type React from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import {
  Button,
  Form,
  Modal,
  Select,
  Spin,
  Table,
  Tooltip,
} from "antd";
import type { ColumnsType, TableProps } from "antd/lib/table";
import type { CallbackDataParams } from "echarts/types/dist/shared";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import ClassNameECharts from "@/components/common/ClassNameECharts";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import { isArabicLanguage } from "@/localization/language";
import { CustomMessage, PaginationTotal } from "@/components/common";
import AdaptiveActionGroup, {
  type AdaptiveActionItem,
} from "@/components/common/AdaptiveActionGroup";
import SimpleBar from "@/components/SimpleBar";
import {
  getDashboardAssignableMembers,
  reassignDashboardTasks,
} from "@/services/dashboard";
import {
  cancelInspectionTask,
  duplicateInspectionTask,
} from "@/services/inspection";
import {
  createPermissionPathSet,
  findRouteByPath,
  isAuthenticatedAllowedProtectedPath,
  normalizeRoutePath,
} from "@/routes/access";
import routes from "@/routes";
import { pxToRemValue } from "@/utils/rem";
import { transformSpaceString } from "@/utils/transform";
import { useCustomerAppealsAccess } from "@/pages/CustomerAppeals/access";
import {
  INSPECTION_TASK_ROLES,
  isInspectionPath,
  useInspectionAccess,
} from "@/pages/InspectionCommon/access";
import { inspectionFigmaAssets } from "@/pages/InspectionCommon/assets";
import { INSPECTION_PATHS } from "@/pages/InspectionCommon/constants";
import CreateTaskModal from "@/pages/InspectionTaskManagement/components/CreateTaskModal";
import CancelTaskModal from "@/pages/InspectionTaskManagement/components/CancelTaskModal";
import { useUserStore } from "@/store/user";
import { getPageContentScrollTop } from "@/layout/pageContentScroll";
import enterpriseIcon from "@/assets/images/enterprise.svg";
import userIcon from "@/assets/images/userIcon.svg";
import arrowCircleRight from "../assets/arrow-circle-right.svg";
import metricOverdueIcon from "../assets/metric-overdue.svg";
import metricInfoIcon from "../assets/metric-info.svg";
import metricProcessingIcon from "../assets/metric-processing.svg";
import metricRingIcon from "../assets/metric-ring.svg";
import metricRingZeroIcon from "../assets/metric-ring-zero.svg";
import riskAdultContentIcon from "../assets/risk-adult-content.svg";
import riskChildProtectionIcon from "../assets/risk-child-protection.svg";
import riskInfoCircleIcon from "../assets/risk-info-circle.svg";
import riskInfoMarkIcon from "../assets/risk-info-mark.svg";
import riskLgbtContentIcon from "../assets/risk-lgbt-content.svg";
import riskPoliticalSensitivityIcon from "../assets/risk-political-sensitivity.svg";
import riskProhibitedWordsIcon from "../assets/risk-prohibited-words.svg";
import riskReligiousContentIcon from "../assets/risk-religious-content.svg";
import riskRoyalFamilyIcon from "../assets/risk-royal-family.svg";
import riskViolenceHateSpeechIcon from "../assets/risk-violence-hate-speech.svg";
import statusCertificateIcon from "../assets/status-certificate.svg";
import statusFileXIcon from "../assets/status-file-x.svg";
import statusProhibitIcon from "../assets/status-prohibit.svg";
import statusWarningIcon from "../assets/status-warning.svg";
import dashboardEmptyIcon from "@/assets/images/empty.svg";
import type {
  DashboardCoachingRow,
  DashboardDepartment,
  DashboardDonutCard,
  DashboardLeaveRow,
  DashboardMetricCard,
  DashboardNavigationTarget,
  DashboardReassignTask,
  DashboardRiskGridCard,
  DashboardRiskIcon,
  DashboardTableAction,
  DashboardTableCell,
  DashboardTableIconType,
  DashboardTableRow,
  DashboardTableSection,
  DashboardTableSortDirection,
  DashboardTaskTab,
  DashboardTone,
  DashboardTrendChart,
} from "../type";
import { formatDashboardDonutDisplayNumber } from "../formatters";
import { DashboardSlaComplianceGauge } from "./DashboardSlaComplianceGauge";
import {
  formatDashboardTrendDuration,
  formatDashboardTaskAlert,
  translateDashboardStaticText,
  type DashboardTranslate,
} from "./dashboardText";
import OverflowTooltipText from "./OverflowTooltipText";
import useAutoResizeEChart from "./useAutoResizeEChart";
import {
  type DashboardReturnContext,
  type DashboardReturnState,
  withDashboardReturnState,
} from "../dashboardReturnState";
import "@/pages/InspectionTaskManagement/index.less";

const DEFAULT_TABLE_PAGE_SIZE = 10;
const TABLE_PAGE_SIZE_OPTIONS = ["10", "20", "50"];
const DASHBOARD_TABLE_EMPTY_TEXT = "-";

const toneClass = (tone?: DashboardTone) =>
  tone && tone !== "default" ? ` dashboard-tone--${tone}` : "";

const textKeyModifier = (textKey?: string) =>
  textKey
    ? ` dashboard__table-cell--${textKey
        .split(".")
        .pop()
        ?.replace(/[^a-zA-Z0-9-]/g, "")}`
    : "";

const renderDashboardLabel = (
  labelKey: string | undefined,
  labelText: string | undefined,
  translate: DashboardTranslate
) =>
  labelText
    ? translateDashboardStaticText(labelText, translate)
    : labelKey
    ? translate(labelKey)
    : "";

const renderDashboardTableText = (value: unknown) => {
  if (typeof value === "number" && !Number.isFinite(value)) {
    return DASHBOARD_TABLE_EMPTY_TEXT;
  }

  const text = String(value ?? "").trim();

  return text || DASHBOARD_TABLE_EMPTY_TEXT;
};

const metricIconByVariant: Record<
  Exclude<DashboardMetricCard["variant"], "gauge">,
  string
> = {
  alert: metricOverdueIcon,
  ring: metricRingIcon,
  timer: metricProcessingIcon,
};

const statusIconByType: Record<
  NonNullable<DashboardDonutCard["summaryTiles"][number]["icon"]>,
  string
> = {
  certificate: statusCertificateIcon,
  clock: metricProcessingIcon,
  fileX: statusFileXIcon,
  prohibit: statusProhibitIcon,
  warning: statusWarningIcon,
};

const riskIconByType: Record<DashboardRiskIcon, string> = {
  adultContent: riskAdultContentIcon,
  childProtection: riskChildProtectionIcon,
  lgbtContent: riskLgbtContentIcon,
  politicalSensitivity: riskPoliticalSensitivityIcon,
  prohibitedWords: riskProhibitedWordsIcon,
  religiousContent: riskReligiousContentIcon,
  royalFamily: riskRoyalFamilyIcon,
  violenceHateSpeech: riskViolenceHateSpeechIcon,
};

const tableIconByType: Record<DashboardTableIconType, string> = {
  enterprise: enterpriseIcon,
  inspectionTargetCompany: inspectionFigmaAssets.taskTargetIcons.company,
  inspectionTargetGovernment: inspectionFigmaAssets.taskTargetIcons.government,
  inspectionTargetUser: inspectionFigmaAssets.taskTargetIcons.user,
  personal: userIcon,
};

const riskClassByType: Record<DashboardRiskIcon, string> = {
  adultContent: "dashboard__ai-risk-item--adult-content",
  childProtection: "dashboard__ai-risk-item--child-protection",
  lgbtContent: "dashboard__ai-risk-item--lgbt-content",
  politicalSensitivity: "dashboard__ai-risk-item--political-sensitivity",
  prohibitedWords: "dashboard__ai-risk-item--prohibited-words",
  religiousContent: "dashboard__ai-risk-item--religious-content",
  royalFamily: "dashboard__ai-risk-item--royal-family",
  violenceHateSpeech: "dashboard__ai-risk-item--violence-hate-speech",
};

const DASHBOARD_INFO_TOOLTIP_OVERLAY_STYLE: CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: 8,
  boxShadow: "0 12px 32px rgba(54, 30, 18, 0.16)",
  color: "#361E12",
  fontSize: 12,
  fontWeight: 400,
  lineHeight: "18px",
  maxWidth: 800,
  padding: "8px 10px",
};

export function DashboardEmptyState({
  className = "",
  labelKey = "adminDashboard.empty.noData",
}: {
  className?: string;
  labelKey?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={`dashboard__empty-state ${className}`.trim()}>
      <img
        src={dashboardEmptyIcon}
        alt=""
        className="dashboard__empty-state-illustration"
      />
      <span className="dashboard__empty-state-label">{t(labelKey)}</span>
    </div>
  );
}

interface LegendSelectChangedEvent {
  selected: Record<string, boolean>;
}

interface TooltipContentSize {
  contentSize?: [number, number];
  viewSize?: [number, number];
}

interface DashboardTrendTooltipParam extends CallbackDataParams {
  axisValue?: string;
  axisValueLabel?: string;
}

interface DashboardReassignFormValues {
  assignedUserId?: string;
}

type DashboardInspectionTaskRecord = Record<string, unknown> & {
  taskId: number;
  taskNo?: string;
};

const useDashboardNavigation = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const inspectionAccess = useInspectionAccess();
  const customerAppealsAccess = useCustomerAppealsAccess();
  const permissions = useUserStore(
    (state) => state.userInfo?.listSysPermission || []
  );
  const permissionPaths = useMemo(
    () => createPermissionPathSet(permissions),
    [permissions]
  );

  const canOpenTarget = useCallback(
    ({
      targetPath,
      permissionPath,
      allowedInspectionRoles,
    }: DashboardNavigationTarget) => {
      if (!targetPath) {
        return false;
      }

      const normalizedPermissionPath = normalizeRoutePath(
        permissionPath || targetPath
      );
      const matchedTargetRoute = findRouteByPath(routes, targetPath);
      const matchedRoute = findRouteByPath(
        routes,
        permissionPath || targetPath
      );

      if (!matchedTargetRoute) {
        return false;
      }

      if (
        normalizedPermissionPath &&
        !permissionPaths.has(normalizedPermissionPath) &&
        !isAuthenticatedAllowedProtectedPath(normalizedPermissionPath)
      ) {
        return false;
      }

      if (
        isInspectionPath(permissionPath || targetPath) &&
        !inspectionAccess.isRouteAllowed({
          path: permissionPath || targetPath,
          allowedInspectionRoles:
            allowedInspectionRoles || matchedRoute?.allowedInspectionRoles,
        })
      ) {
        return false;
      }

      if (
        matchedRoute?.requiresCustomerAppealsAccess &&
        (customerAppealsAccess.loading || !customerAppealsAccess.hasAccess)
      ) {
        return false;
      }

      return true;
    },
    [
      customerAppealsAccess.hasAccess,
      customerAppealsAccess.loading,
      inspectionAccess,
      permissionPaths,
    ]
  );

  return useCallback(
    (
      target: DashboardNavigationTarget,
      returnState?: DashboardReturnState,
    ) => {
      if (!target.targetPath) {
        return;
      }

      // The primary target may belong to a module the current role cannot open,
      // while an equivalent page in another module is permitted.
      const resolvedTarget = [target, ...(target.fallbackTargets || [])].find(
        (candidate) => canOpenTarget(candidate)
      );

      if (!resolvedTarget?.targetPath) {
        CustomMessage.warning(t("adminDashboard.feedback.noPermissionToOpen"));
        return;
      }

      const { targetPath } = resolvedTarget;

      if (!returnState) {
        history.push(targetPath);
        return;
      }

      const dashboardLocationState = withDashboardReturnState(
        history.location.state,
        returnState,
      );

      history.replace({
        pathname: history.location.pathname,
        search: history.location.search,
        hash: history.location.hash,
        state: dashboardLocationState,
      });
      history.push(
        targetPath,
        withDashboardReturnState(undefined, returnState),
      );
    },
    [canOpenTarget, history, t]
  );
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatTooltipValue = (
  value: unknown,
  suffix?: string,
  translate?: DashboardTranslate
) => {
  const numericValue = Number(value ?? 0);
  const formattedValue = Number.isFinite(numericValue)
    ? numericValue.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })
    : String(value ?? "");

  const displayValue = suffix ? `${formattedValue}${suffix}` : formattedValue;

  return translate
    ? translateDashboardStaticText(displayValue, translate)
    : displayValue;
};

const getAxisTickLabel = (value: number, tickLabels?: string[]) => {
  if (!tickLabels?.length) {
    return undefined;
  }

  const index = Math.round(value);

  return tickLabels[index];
};

const getTooltipPosition = (
  point: [number, number],
  _params: CallbackDataParams | CallbackDataParams[],
  _dom: HTMLElement,
  _rect: unknown,
  size: TooltipContentSize
): [number, number] => {
  const [pointX, pointY] = point;
  const [contentWidth = 0, contentHeight = 0] = size.contentSize ?? [];
  const [viewWidth = window.innerWidth, viewHeight = window.innerHeight] =
    size.viewSize ?? [];
  const spacing = 16;
  const topSpacing = 8;
  const maxLeft = Math.max(spacing, viewWidth - contentWidth - spacing);
  const maxTop = Math.max(topSpacing, viewHeight - contentHeight - spacing);
  const clampPosition = (left: number, top: number): [number, number] => [
    Math.min(Math.max(spacing, left), maxLeft),
    Math.min(Math.max(topSpacing, top), maxTop),
  ];
  const overlapsPoint = ([left, top]: [number, number]) =>
    pointX >= left &&
    pointX <= left + contentWidth &&
    pointY >= top &&
    pointY <= top + contentHeight;
  const candidates: [number, number][] = [
    clampPosition(pointX + spacing, pointY + spacing),
    clampPosition(pointX + spacing, pointY - contentHeight - spacing),
    clampPosition(pointX - contentWidth - spacing, pointY + spacing),
    clampPosition(
      pointX - contentWidth - spacing,
      pointY - contentHeight - spacing
    ),
  ];

  return (
    candidates.find((candidate) => !overlapsPoint(candidate)) || candidates[0]
  );
};

const createDonutSelectedMap = (card: DashboardDonutCard) =>
  [...card.legends, ...(card.legendPlaceholders || [])].reduce<
    Record<string, boolean>
  >((result, item) => {
    result[item.key] = true;
    return result;
  }, {});

const createTrendSelectedMap = (chart: DashboardTrendChart) =>
  chart.series.reduce<Record<string, boolean>>((result, item) => {
    result[item.key] = true;
    return result;
  }, {});

const formatDonutTooltip = (params: CallbackDataParams) => {
  const label = escapeHtml(String(params.name ?? ""));
  const value = formatDashboardDonutDisplayNumber(Number(params.value ?? 0));
  const percentage = Number(params.percent ?? 0).toFixed(2);
  const color = typeof params.color === "string" ? params.color : "#A0D5AB";

  return `
    <div class="dashboard__donut-tooltip-content">
      <span class="dashboard__donut-tooltip-marker" style="background-color: ${color};"></span>
      <span class="dashboard__donut-tooltip-text">${label}: ${value} (${percentage}%)</span>
    </div>
  `;
};

interface DashboardCardProps {
  titleKey?: string;
  titleText?: string;
  className?: string;
  children: React.ReactNode;
  actionVisible?: boolean;
  actionPath?: string;
  actionPermissionPath?: string;
  allowedInspectionRoles?: DashboardNavigationTarget["allowedInspectionRoles"];
  actionLabelKey?: string;
  actionIconSrc?: string;
  titleAccessory?: React.ReactNode;
  titleCount?: number;
}

export function DashboardCard({
  titleKey,
  titleText,
  className = "",
  children,
  actionVisible = true,
  actionPath,
  actionPermissionPath,
  allowedInspectionRoles,
  actionLabelKey,
  actionIconSrc,
  titleAccessory,
  titleCount,
}: DashboardCardProps) {
  const { t } = useTranslation();
  const navigate = useDashboardNavigation();
  const showAction = actionVisible && Boolean(actionPath || actionLabelKey);
  const title = titleText
    ? translateDashboardStaticText(titleText, t)
    : titleKey
    ? t(titleKey)
    : "";

  return (
    <section className={`dashboard__card ${className}`.trim()}>
      {title ? (
        <div className="dashboard__card-header">
          <div className="dashboard__card-title-group">
            <h2 className="dashboard__card-title">
              {title}
              {typeof titleCount === "number" ? ` (${titleCount})` : ""}
            </h2>
            {titleAccessory}
          </div>
          {showAction ? (
            <button
              type="button"
              className={
                actionLabelKey
                  ? "dashboard__card-action-link"
                  : "dashboard__icon-button"
              }
              onClick={() => {
                if (actionPath) {
                  navigate({
                    targetPath: actionPath,
                    permissionPath: actionPermissionPath,
                    allowedInspectionRoles,
                  });
                }
              }}
            >
              {actionLabelKey ? (
                t(actionLabelKey)
              ) : (
                <img src={actionIconSrc || arrowCircleRight} alt="" />
              )}
            </button>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function DashboardInfoTooltip({
  children,
  title,
}: {
  children: React.ReactElement;
  title?: string;
}) {
  if (!title) {
    return children;
  }

  return (
    <Tooltip
      title={title}
      color="#FFFFFF"
      placement="top"
      destroyTooltipOnHide
      overlayInnerStyle={DASHBOARD_INFO_TOOLTIP_OVERLAY_STYLE}
    >
      {children}
    </Tooltip>
  );
}

function RiskInfoIcon({ tooltipText }: { tooltipText?: string }) {
  const icon = (
    <span className="dashboard__risk-info-icon-trigger">
      <span className="dashboard__risk-info-icon" aria-hidden="true">
        <img
          src={riskInfoCircleIcon}
          alt=""
          className="dashboard__risk-info-icon-circle"
        />
        <img
          src={riskInfoMarkIcon}
          alt=""
          className="dashboard__risk-info-icon-mark"
        />
      </span>
    </span>
  );

  return (
    <DashboardInfoTooltip title={tooltipText}>{icon}</DashboardInfoTooltip>
  );
}

function MetricInfoIcon({ tooltipText }: { tooltipText?: string }) {
  const icon = (
    <span className="dashboard__metric-info-icon-trigger">
      <img
        src={metricInfoIcon}
        alt=""
        aria-hidden="true"
        className="dashboard__metric-info-icon"
      />
    </span>
  );

  return (
    <DashboardInfoTooltip title={tooltipText}>{icon}</DashboardInfoTooltip>
  );
}

function renderCellValue(
  value: unknown,
  translate: DashboardTranslate,
  columnKey?: string
) {
  if (
    value &&
    typeof value === "object" &&
    ("text" in value || "textKey" in value)
  ) {
    const cell = value as DashboardTableCell;
    const content = cell.textKey
      ? translate(cell.textKey, cell.params)
      : translateDashboardStaticText(cell.text, translate);
    const displayContent = renderDashboardTableText(content);
    const textContent =
      columnKey === "serviceName" ? (
        <OverflowTooltipText
          className="dashboard__table-cell-service-name-text"
          text={displayContent}
        />
      ) : (
        <span>{displayContent}</span>
      );
    const iconSrc = cell.icon ? tableIconByType[cell.icon] : undefined;

    return (
      <span
        className={`dashboard__table-cell${toneClass(cell.tone)}${
          cell.urgent ? " dashboard__table-cell--urgent" : ""
        }${
          columnKey ? ` dashboard__table-cell--column-${columnKey}` : ""
        }${
          columnKey === "status" ? " dashboard__table-cell--status" : ""
        }${textKeyModifier(cell.textKey)}`}
      >
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            aria-hidden="true"
            className="dashboard__table-cell-icon"
          />
        ) : null}
        {textContent}
        {cell.urgent ? (
          <span className="dashboard__urgent-tag">
            {translate("adminDashboard.tabs.urgent")}
          </span>
        ) : null}
      </span>
    );
  }

  return renderDashboardTableText(value);
}

const DashboardTableActions: React.FC<{
  actions: DashboardTableAction[];
  record: DashboardTableRow;
  translate: DashboardTranslate;
  navigate: (target: DashboardNavigationTarget) => void;
  openReassignModal: (tasks: DashboardReassignTask[]) => void;
  handleInspectionAction?: (
    action: DashboardTableAction,
    record: DashboardTableRow
  ) => boolean;
}> = ({
  actions,
  record,
  translate,
  navigate,
  openReassignModal,
  handleInspectionAction,
}) => {
  const shouldCollapseMenuActions = actions.length > 2;

  const runAction = useCallback(
    (action: DashboardTableAction) => {
      if (handleInspectionAction?.(action, record)) {
        return;
      }

      if (action.targetPath) {
        navigate({
          targetPath: action.targetPath,
          permissionPath: action.permissionPath,
          allowedInspectionRoles: action.allowedInspectionRoles,
          fallbackTargets: action.fallbackTargets,
        });
        return;
      }

      if (action.key === "reassign" && record.reassignTask) {
        openReassignModal([record.reassignTask]);
        return;
      }

      CustomMessage.warning(
        translate("adminDashboard.feedback.noPermissionToOpen")
      );
    },
    [handleInspectionAction, navigate, openReassignModal, record, translate]
  );

  const adaptiveActions: AdaptiveActionItem[] = actions.map((action) => ({
    key: action.key,
    label: renderDashboardLabel(
      action.labelKey,
      action.labelText,
      translate
    ),
    placement:
      shouldCollapseMenuActions && action.mode === "menu"
        ? "overflow"
        : "auto",
    onClick: () => runAction(action),
  }));

  return (
    <AdaptiveActionGroup
      actions={adaptiveActions}
      maxInlineActions={2}
      moreLabel={translate("common.moreActions")}
      className="inspection-task-management__actions dashboard__inspection-table-actions"
      menuClassName="inspection-task-management__row-menu"
      emptyClassName="inspection-task-management__actions-empty"
      moreButtonClassName="inspection-task-management__more-button"
      moreIcon={
        <img
          className="inspection-task-management__more-icon"
          src={inspectionFigmaAssets.moreVerticalIcon}
          alt=""
        />
      }
    />
  );
};

const getDashboardActionTaskIdFromUrl = (value?: unknown) => {
  let target = renderDashboardTableText(value);

  if (target === DASHBOARD_TABLE_EMPTY_TEXT) {
    return undefined;
  }

  if (/^https?:\/\//i.test(target)) {
    try {
      const targetUrl = new URL(target);

      target = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
    } catch {
      return undefined;
    }
  }

  const normalizedTarget = target.startsWith("/") ? target : `/${target}`;
  const pathTaskId = normalizedTarget.match(
    /^\/inspection\/tasks\/([^/?#]+)/i
  )?.[1];
  const query = normalizedTarget.split("?")[1]?.split("#")[0] || "";
  const queryTaskId = new URLSearchParams(query).get("taskId");

  return pathTaskId || queryTaskId || undefined;
};

const getDashboardCellPlainText = (value: unknown) => {
  if (value && typeof value === "object" && "text" in value) {
    return renderDashboardTableText((value as DashboardTableCell).text);
  }

  return renderDashboardTableText(value);
};

const getDashboardInspectionTaskId = (
  record: DashboardTableRow,
  action: DashboardTableAction
) => {
  const rawTaskId =
    action.taskId ||
    record.sourceId ||
    getDashboardActionTaskIdFromUrl(action.sourceActionUrl);
  const taskId = Number(rawTaskId);

  return Number.isInteger(taskId) && taskId > 0 ? taskId : undefined;
};

const createDashboardInspectionTaskRecord = (
  record: DashboardTableRow,
  taskId: number
): DashboardInspectionTaskRecord => {
  const taskNo = getDashboardCellPlainText(record.taskNo);

  return {
    ...record,
    taskId,
    taskNo: taskNo === DASHBOARD_TABLE_EMPTY_TEXT ? undefined : taskNo,
  };
};

const getDashboardInspectionAuthorityName = (record?: unknown) => {
  const source = record as
    | {
        inspectionTarget?: {
          address?: {
            authorityNameEn?: unknown;
          };
        };
      }
    | undefined;
  const authorityName = source?.inspectionTarget?.address?.authorityNameEn;
  const text = String(authorityName ?? "").trim();

  return text || DASHBOARD_TABLE_EMPTY_TEXT;
};

const DASHBOARD_TABLE_ROW_CLICK_IGNORE_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  '[role="button"]',
  ".ant-checkbox",
  ".ant-checkbox-wrapper",
  ".ant-select",
  ".dashboard__table-actions",
  ".dashboard__inspection-table-actions",
  ".dashboard__table-actions-column",
].join(",");

const shouldIgnoreDashboardTableRowClick = (
  event: React.MouseEvent<HTMLElement>
) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest(DASHBOARD_TABLE_ROW_CLICK_IGNORE_SELECTOR)) {
    return true;
  }

  const cell = target.closest("td");

  return Boolean(
    cell?.classList.contains("ant-table-selection-column") ||
      cell?.classList.contains("ant-table-cell-fix-left") ||
      cell?.classList.contains("ant-table-cell-fix-right") ||
      cell?.classList.contains("dashboard__table-actions-column")
  );
};

const labelIncludesCount = (label: string, count: number | "-") => {
  const normalizedLabel = label.replace(/\s+/g, " ").trim();
  const escapedCount = String(count).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`(?:^|[\\s([{])${escapedCount}[\\])]?$`).test(
    normalizedLabel
  );
};

export function TaskListSection({
  tabs,
  loadingByTab,
  onTabChange,
}: {
  tabs: DashboardTaskTab[];
  loadingByTab?: Record<string, boolean>;
  onTabChange?: (tabKey: string) => void;
}) {
  const { t } = useTranslation();
  const navigate = useDashboardNavigation();
  const [activeTab, setActiveTab] = useState(tabs[0]?.key || "");
  const [taskScrollElement, setTaskScrollElement] =
    useState<HTMLElement | null>(null);
  const active = tabs.find((tab) => tab.key === activeTab) || tabs[0];

  useEffect(() => {
    if (!taskScrollElement) {
      return undefined;
    }

    const handleTaskGridWheel = (event: WheelEvent) => {
      const scrollElement = taskScrollElement;
      const maxScrollLeft =
        scrollElement.scrollWidth - scrollElement.clientWidth;

      if (
        maxScrollLeft <= 0 ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX)
      ) {
        return;
      }

      const nextScrollLeft = Math.min(
        maxScrollLeft,
        Math.max(0, scrollElement.scrollLeft + event.deltaY)
      );

      if (nextScrollLeft === scrollElement.scrollLeft) {
        return;
      }

      event.preventDefault();
      scrollElement.scrollLeft = nextScrollLeft;
    };

    taskScrollElement.addEventListener("wheel", handleTaskGridWheel, {
      passive: false,
    });

    return () => {
      taskScrollElement.removeEventListener("wheel", handleTaskGridWheel);
    };
  }, [taskScrollElement]);

  useEffect(() => {
    setActiveTab((previous) =>
      tabs.some((tab) => tab.key === previous) ? previous : tabs[0]?.key || ""
    );
  }, [tabs]);

  if (!active) {
    return null;
  }

  const activeLoading = Boolean(loadingByTab?.[active.key]);

  return (
    <DashboardCard
      titleKey="adminDashboard.sections.myTasks"
      className="dashboard__task-section"
      actionVisible={false}
    >
      <div className="dashboard__task-tabs-row">
        <div className="dashboard__tabs dashboard__tabs--task" role="tablist">
          {tabs.map((tab) => {
            const isActive = tab.key === active.key;
            const label = renderDashboardLabel(tab.labelKey, tab.labelText, t);
            const countVisible = !labelIncludesCount(label, tab.count);

            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                className={`dashboard__tab${
                  isActive ? " dashboard__tab--active" : ""
                }`}
                onClick={() => {
                  if (isActive && activeLoading) {
                    return;
                  }

                  setActiveTab(tab.key);
                  onTabChange?.(tab.key);
                }}
              >
                <span className="dashboard__tab-label">{label}</span>
                {countVisible ? (
                  <span className="dashboard__tab-count">{tab.count}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        {active.actionPath ? (
          <button
            type="button"
            className="dashboard__icon-button dashboard__task-tabs-action"
            onClick={() =>
              navigate({
                targetPath: active.actionPath,
                permissionPath: active.actionPermissionPath,
                allowedInspectionRoles: active.allowedInspectionRoles,
              })
            }
          >
            <img src={arrowCircleRight} alt="" />
          </button>
        ) : null}
      </div>

      <Spin spinning={activeLoading}>
        {activeLoading ? (
          <div key={`${active.key}-loading`} className="dashboard__task-empty" />
        ) : active.cards.length ? (
          <SimpleBar
            key={`${active.key}-cards`}
            className="dashboard__task-scroll"
            scrollableNodeProps={{ ref: setTaskScrollElement }}
          >
            <div className="dashboard__task-grid">
              {active.cards.map((card) => {
                const taskTitle = card.titleKey ? t(card.titleKey) : card.title;
                const taskSubtitle = card.subtitleKey
                  ? t(card.subtitleKey)
                  : card.subtitle;
                const taskStatus = renderDashboardLabel(
                  card.statusKey,
                  card.statusText,
                  t
                );
                const taskAlert = card.alertKey
                  ? t(card.alertKey, card.alertParams)
                  : card.sourceType === "application"
                    ? formatDashboardTaskAlert(card.alertText, t)
                    : translateDashboardStaticText(card.alertText, t);
                const subtitleIconSrc = card.subtitleIcon
                  ? tableIconByType[card.subtitleIcon]
                  : undefined;
                const taskStatusClassName =
                  card.sourceType === "application"
                    ? `dashboard__application-status status-tag ${transformSpaceString(
                        card.statusText || taskStatus
                      )}`
                    : `dashboard__status-pill${toneClass(card.statusTone)}`;

                return (
                  <article
                    key={card.key}
                    className={`dashboard__task-card${
                      card.targetPath ? " dashboard__task-card--clickable" : ""
                    }`}
                    role={card.targetPath ? "button" : undefined}
                    tabIndex={card.targetPath ? 0 : undefined}
                    onClick={() =>
                      navigate({
                        targetPath: card.targetPath,
                        permissionPath: card.permissionPath,
                        allowedInspectionRoles: card.allowedInspectionRoles,
                        fallbackTargets: card.fallbackTargets,
                      })
                    }
                    onKeyDown={(event) => {
                      if (!card.targetPath) {
                        return;
                      }

                      if (event.key !== "Enter" && event.key !== " ") {
                        return;
                      }

                      event.preventDefault();
                      navigate({
                        targetPath: card.targetPath,
                        permissionPath: card.permissionPath,
                        allowedInspectionRoles: card.allowedInspectionRoles,
                        fallbackTargets: card.fallbackTargets,
                      });
                    }}
                  >
                    <div className="dashboard__task-card-top">
                      {taskStatus ? (
                        <OverflowTooltipText
                          className={taskStatusClassName}
                          text={taskStatus}
                        />
                      ) : null}
                      {taskAlert ? (
                        <OverflowTooltipText
                          className="dashboard__task-alert"
                          text={taskAlert}
                        />
                      ) : null}
                    </div>
                    <OverflowTooltipText
                      as="h3"
                      className="dashboard__task-title"
                      text={taskTitle}
                    />
                    <div className="dashboard__task-subtitle">
                      {subtitleIconSrc && taskSubtitle ? (
                        <img
                          src={subtitleIconSrc}
                          alt=""
                          aria-hidden="true"
                          className="dashboard__task-subtitle-icon"
                        />
                      ) : null}
                      <OverflowTooltipText
                        text={taskSubtitle}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </SimpleBar>
        ) : (
          <div key={`${active.key}-empty`} className="dashboard__task-empty">
            <DashboardEmptyState />
          </div>
        )}
      </Spin>
    </DashboardCard>
  );
}

export function MetricGrid({
  titleKey,
  metrics,
  variant = "staff",
}: {
  titleKey: string;
  metrics: DashboardMetricCard[];
  variant?: "staff" | "manager";
}) {
  const { t } = useTranslation();

  return (
    <DashboardCard
      titleKey={titleKey}
      className={`dashboard__performance-card dashboard__performance-card--${variant}`}
      actionVisible={false}
    >
      {metrics.length ? (
        <div className="dashboard__metric-grid">
          {metrics.map((metric) => {
            const tooltipText = renderDashboardLabel(
              metric.infoTooltipKey,
              metric.infoTooltipText,
              t
            );
            const metricIconSrc =
              metric.variant === "ring" &&
              metric.tone === "neutral" &&
              metric.value !== "-"
                ? metricRingZeroIcon
                : metric.variant === "gauge"
                  ? undefined
                  : metricIconByVariant[metric.variant];

            return (
              <article key={metric.key} className="dashboard__metric-card">
                {metric.variant === "gauge" ? (
                  <DashboardSlaComplianceGauge
                    value={metric.value}
                    tone={metric.tone}
                  />
                ) : (
                  <img
                    src={metricIconSrc}
                    alt=""
                    className={`dashboard__metric-icon dashboard__metric-icon--${
                      metric.variant
                    }${toneClass(metric.tone)}`}
                  />
                )}
                <div className="dashboard__metric-content">
                  <strong className="dashboard__metric-value">
                    {translateDashboardStaticText(metric.value, t)}
                  </strong>
                  <span className="dashboard__metric-label">
                    <span className="dashboard__metric-label-text">
                      {renderDashboardLabel(
                        metric.labelKey,
                        metric.labelText,
                        t
                      )}
                    </span>
                    {tooltipText ? (
                      <MetricInfoIcon tooltipText={tooltipText} />
                    ) : null}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <DashboardEmptyState className="dashboard__metric-empty" />
      )}
    </DashboardCard>
  );
}

export function DonutSummaryCard({ card }: { card: DashboardDonutCard }) {
  const { t } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart();
  const hasChart = card.legends.length > 0;
  const hasLegendPlaceholders = Boolean(card.legendPlaceholders?.length);
  const hasLegendLayout = hasChart || hasLegendPlaceholders;
  const hasSummaryContent = hasLegendLayout || card.summaryTiles.length > 0;
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() =>
    createDonutSelectedMap(card)
  );

  const legendSignature = useMemo(
    () =>
      [
        ...card.legends.map(
          (item) =>
            `${item.key}:${item.labelText || item.labelKey}:${item.value}`
        ),
        ...(card.legendPlaceholders || []).map(
          (item) =>
            `${item.key}:${item.labelText || item.labelKey}:${item.displayValue}`
        ),
      ]
        .join("|"),
    [card.legends, card.legendPlaceholders]
  );

  useEffect(() => {
    setSelectedMap(createDonutSelectedMap(card));
  }, [card, legendSignature]);

  const legendItems = useMemo(
    () =>
      card.legends.map((item) => {
        const displayLabel = renderDashboardLabel(item.labelKey, item.labelText, t);

        return {
          ...item,
          displayLabel,
          selected: selectedMap[item.key] !== false,
        };
      }),
    [card.legends, selectedMap, t]
  );
  const displayLegendItems = useMemo(() => {
    const legendByKey = new Map(legendItems.map((item) => [item.key, item]));

    if (card.legendPlaceholders?.length) {
      return card.legendPlaceholders.map((item) => {
        const legendItem = legendByKey.get(item.key);

        return {
          key: item.key,
          color: item.color,
          displayLabel: renderDashboardLabel(item.labelKey, item.labelText, t),
          chartLabel: legendItem?.displayLabel,
          displayValue: formatDashboardDonutDisplayNumber(item.displayValue),
          selected: selectedMap[item.key] !== false,
          canToggleChart: Boolean(legendItem),
          value: legendItem?.value,
        };
      });
    }

    return legendItems.map((item) => ({
      key: item.key,
      color: item.color,
      displayLabel: item.displayLabel,
      chartLabel: item.displayLabel,
      displayValue: formatDashboardDonutDisplayNumber(
        item.displayValue ?? item.value
      ),
      selected: item.selected,
      canToggleChart: true,
      value: item.value,
    }));
  }, [card.legendPlaceholders, legendItems, selectedMap, t]);

  const total = useMemo(
    () => legendItems.reduce((sum, item) => sum + item.value, 0),
    [legendItems]
  );
  const centerValue = useMemo(
    () => formatDashboardDonutDisplayNumber(card.centerValue),
    [card.centerValue]
  );
  const handleLegendSelectChanged = useCallback(
    (event: LegendSelectChangedEvent) => {
      setSelectedMap((previous) => {
        const nextSelected: Record<string, boolean> = {};

        legendItems.forEach((item) => {
          nextSelected[item.key] =
            event.selected[item.displayLabel] ??
            previous[item.key] ??
            true;
        });

        return nextSelected;
      });
    },
    [legendItems]
  );

  const toggleLegendSelection = useCallback(
    (
      itemKey: string,
      chartLabel: string | undefined,
      canToggleChart: boolean
    ) => {
      if (!canToggleChart || !chartLabel) {
        return;
      }

      const chartInstance = chartRef.current?.getEchartsInstance();

      if (chartInstance) {
        chartInstance.dispatchAction({
          type: "legendToggleSelect",
          name: chartLabel,
        });

        return;
      }

      setSelectedMap((previous) => ({
        ...previous,
        [itemKey]: previous[itemKey] === false,
      }));
    },
    [chartRef]
  );

  const handleLegendKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLDivElement>,
      itemKey: string,
      chartLabel: string | undefined,
      canToggleChart: boolean
    ) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      toggleLegendSelection(itemKey, chartLabel, canToggleChart);
    },
    [toggleLegendSelection]
  );

  const onEvents = useMemo(
    () => ({
      legendselectchanged: handleLegendSelectChanged,
    }),
    [handleLegendSelectChanged]
  );

  const option = useMemo(
    () => ({
      animation: true,
      animationDuration: 220,
      animationDurationUpdate: 220,
      legend: {
        show: false,
        selectedMode: true,
        data: legendItems.map((item) => item.displayLabel),
        selected: legendItems.reduce<Record<string, boolean>>(
          (result, item) => {
            result[item.displayLabel] = item.selected;
            return result;
          },
          {}
        ),
      },
      tooltip: {
        trigger: "item",
        renderMode: "html",
        appendTo: "body",
        confine: false,
        className: "dashboard__donut-tooltip",
        formatter: formatDonutTooltip,
      },
      series: [
        {
          type: "pie",
          cursor: "default",
          radius: ["62%", "82%"],
          center: ["50%", "50%"],
          minAngle: 3,
          avoidLabelOverlap: true,
          label: {
            show: false,
          },
          labelLine: {
            show: false,
          },
          emphasis: {
            scale: false,
          },
          data: legendItems
            .filter((item) => item.value > 0)
            .map((item) => ({
              name: item.displayLabel,
              value: item.value,
              itemStyle: {
                color: item.color,
              },
            })),
        },
      ],
    }),
    [legendItems]
  );

  return (
    <DashboardCard
      titleKey={card.titleKey}
      titleText={card.titleText}
      className={`dashboard__summary-card${
        hasSummaryContent ? "" : " dashboard__summary-card--empty"
      }`}
      actionPath={card.actionPath}
      actionPermissionPath={card.actionPermissionPath}
    >
      {hasSummaryContent ? (
        <>
          <div
            className={`dashboard__summary-body${
              hasLegendLayout ? "" : " dashboard__summary-body--tiles-only"
            }`}
          >
            {hasLegendLayout ? (
              <div
                className={`dashboard__donut-wrap${
                  hasChart ? "" : " dashboard__donut-wrap--empty-data"
                }`}
              >
                {hasChart ? (
                  <div
                    ref={containerRef}
                    className="dashboard__chart-shell dashboard__donut-chart"
                  >
                    <ClassNameECharts
                      ref={chartRef as unknown as Ref<ClassNameECharts>}
                      option={option}
                      className="dashboard__donut-chart-instance"
                      notMerge
                      lazyUpdate
                      onEvents={onEvents}
                    />
                  </div>
                ) : null}
                <div className="dashboard__donut-center">
                  <strong>{centerValue}</strong>
                  <span>
                    {renderDashboardLabel(
                      card.centerLabelKey,
                      card.centerLabelText,
                      t
                    )}
                  </span>
                </div>
              </div>
            ) : null}

            {displayLegendItems.length ? (
              <div className="dashboard__legend-list">
                {displayLegendItems.map((item) => (
                  <div
                    key={item.key}
                    className={`dashboard__legend-item${
                      item.selected ? "" : " dashboard__legend-item--inactive"
                    }${
                      item.canToggleChart
                        ? ""
                        : " dashboard__legend-item--static"
                    }`}
                    role={item.canToggleChart ? "button" : undefined}
                    tabIndex={item.canToggleChart ? 0 : undefined}
                    onClick={
                      item.canToggleChart
                        ? () =>
                            toggleLegendSelection(
                              item.key,
                              item.chartLabel,
                              item.canToggleChart
                            )
                        : undefined
                    }
                    onKeyDown={
                      item.canToggleChart
                        ? (event) =>
                            handleLegendKeyDown(
                              event,
                              item.key,
                              item.chartLabel,
                              item.canToggleChart
                            )
                        : undefined
                    }
                  >
                    <span
                      className="dashboard__legend-dot"
                      style={{ backgroundColor: item.color }}
                    />
                    <OverflowTooltipText
                      className="dashboard__legend-label"
                      text={item.displayLabel}
                    />
                    <span className="dashboard__legend-value">
                      <strong>{item.displayValue}</strong>
                      {item.value !== undefined &&
                      card.showLegendPercentage !== false &&
                      total > 0 ? (
                        <span className="dashboard__legend-percentage">
                          {((item.value / total) * 100).toFixed(2)}%
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {card.summaryTiles.length ? (
            <div
              className={`dashboard__summary-tiles${
                hasLegendLayout ? "" : " dashboard__summary-tiles--status"
              }`}
            >
              {card.summaryTiles.map((tile) => {
                const tooltipText = renderDashboardLabel(
                  tile.infoTooltipKey,
                  tile.infoTooltipText,
                  t
                );

                return (
                  <article
                    key={tile.key}
                    className={`dashboard__summary-tile${toneClass(
                      tile.tone
                    )}${
                      tile.icon ? ` dashboard__summary-tile--${tile.icon}` : ""
                    }`}
                  >
                    <div className="dashboard__summary-tile-copy">
                      <strong>
                        {formatDashboardDonutDisplayNumber(tile.value)}
                      </strong>
                      <span className="dashboard__summary-tile-label">
                        <span className="dashboard__summary-tile-label-text">
                          {renderDashboardLabel(
                            tile.labelKey,
                            tile.labelText,
                            t
                          )}
                        </span>
                        {tooltipText ? (
                          <MetricInfoIcon tooltipText={tooltipText} />
                        ) : null}
                      </span>
                    </div>
                    {tile.icon ? (
                      <img
                        src={statusIconByType[tile.icon]}
                        alt=""
                        className="dashboard__summary-tile-icon"
                      />
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
        <DashboardEmptyState className="dashboard__summary-empty" />
      )}
    </DashboardCard>
  );
}

export function RiskGridCard({ card }: { card: DashboardRiskGridCard }) {
  const { t } = useTranslation();

  return (
    <DashboardCard
      titleKey={card.titleKey}
      titleText={card.titleText}
      className="dashboard__summary-card dashboard__ai-risk-card"
      actionVisible={false}
      titleAccessory={<RiskInfoIcon />}
    >
      {card.items.length ? (
        <div className="dashboard__ai-risk-grid">
          {card.items.map((item) => {
            const isEmpty = item.value <= 0;
            const riskClassName = item.icon ? riskClassByType[item.icon] : "";
            const riskIcon = item.icon ? riskIconByType[item.icon] : "";

            return (
              <article
                key={item.key}
                className={`dashboard__ai-risk-item ${riskClassName}${
                  isEmpty ? " dashboard__ai-risk-item--empty" : ""
                }`}
              >
                {riskIcon ? (
                  <img src={riskIcon} alt="" className="dashboard__ai-risk-icon" />
                ) : null}
                <OverflowTooltipText
                  className="dashboard__ai-risk-title"
                  text={renderDashboardLabel(item.labelKey, item.labelText, t)}
                />
                <strong
                  className={`dashboard__ai-risk-value${
                    isEmpty ? " dashboard__ai-risk-value--empty" : ""
                  }`}
                >
                  {item.value.toLocaleString()}
                </strong>
              </article>
            );
          })}
        </div>
      ) : (
        <DashboardEmptyState className="dashboard__ai-risk-empty" />
      )}
    </DashboardCard>
  );
}

export function TrendChartCard({ chart }: { chart: DashboardTrendChart }) {
  const { t, i18n } = useTranslation();
  const { chartRef, containerRef } = useAutoResizeEChart();
  const hasTrendData = chart.categories.length > 0 && chart.series.length > 0;
  const usesCompactTooltip = chart.tooltipVariant === "compact";
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>(() =>
    createTrendSelectedMap(chart)
  );

  const seriesSignature = useMemo(
    () =>
      chart.series
        .map(
          (item) =>
            `${item.key}:${item.labelText || item.labelKey}:${item.values.join(",")}`
        )
        .join("|"),
    [chart.series]
  );

  useEffect(() => {
    setSelectedMap(createTrendSelectedMap(chart));
  }, [chart, seriesSignature]);

  const displayedSeries = useMemo(
    () =>
      chart.series.map((series) => ({
        ...series,
        displayLabel: renderDashboardLabel(series.labelKey, series.labelText, t),
        selected: selectedMap[series.key] !== false,
      })),
    [chart.series, selectedMap, t]
  );
  const chartInfoTooltipText = renderDashboardLabel(
    chart.infoTooltipKey,
    chart.infoTooltipText,
    t
  );

  const handleLegendSelectChanged = useCallback(
    (event: LegendSelectChangedEvent) => {
      setSelectedMap((previous) => {
        const nextSelected: Record<string, boolean> = {};

        displayedSeries.forEach((series) => {
          nextSelected[series.key] =
            event.selected[series.displayLabel] ??
            previous[series.key] ??
            true;
        });

        return nextSelected;
      });
    },
    [displayedSeries]
  );

  const toggleLegendSelection = useCallback(
    (itemKey: string, displayLabel: string) => {
      const chartInstance = chartRef.current?.getEchartsInstance();

      if (chartInstance) {
        chartInstance.dispatchAction({
          type: "legendToggleSelect",
          name: displayLabel,
        });

        return;
      }

      setSelectedMap((previous) => ({
        ...previous,
        [itemKey]: previous[itemKey] === false,
      }));
    },
    [chartRef]
  );

  const handleLegendKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLDivElement>,
      itemKey: string,
      displayLabel: string
    ) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      toggleLegendSelection(itemKey, displayLabel);
    },
    [toggleLegendSelection]
  );

  const onEvents = useMemo(
    () => ({
      legendselectchanged: handleLegendSelectChanged,
    }),
    [handleLegendSelectChanged]
  );

  const tooltipFormatter = useCallback(
    (params: CallbackDataParams | CallbackDataParams[]) => {
      const seriesParams = Array.isArray(params) ? params : [params];

      if (!seriesParams.length) {
        return "";
      }

      const title = escapeHtml(
        String(
          (seriesParams[0] as DashboardTrendTooltipParam).axisValueLabel ??
            (seriesParams[0] as DashboardTrendTooltipParam).axisValue ??
            seriesParams[0].name ??
            ""
        )
      );
      const rows = seriesParams
        .map((item) => {
          const color = typeof item.color === "string" ? item.color : "#A0D5AB";
          const label = escapeHtml(String(item.seriesName ?? item.name ?? ""));
          const matchedSeries = displayedSeries.find(
            (series) => series.displayLabel === item.seriesName
          );
          const dataIndex = Number(
            (item as DashboardTrendTooltipParam).dataIndex
          );
          const displayValue =
            Number.isFinite(dataIndex) && dataIndex >= 0
              ? matchedSeries?.displayValues?.[dataIndex]
              : undefined;
          const value = escapeHtml(
            matchedSeries?.unit === "time"
              ? formatDashboardTrendDuration(
                  item.value,
                  t,
                  isArabicLanguage(i18n.resolvedLanguage)
                )
              : displayValue
                ? translateDashboardStaticText(displayValue, t)
                : formatTooltipValue(item.value, matchedSeries?.unit, t)
          );

          if (usesCompactTooltip) {
            return `
              <div class="dashboard__trend-tooltip-row dashboard__trend-tooltip-row--compact">
                <span class="dashboard__trend-tooltip-series">
                  <span class="dashboard__trend-tooltip-marker dashboard__trend-tooltip-marker--outlined" style="border-color: ${color};"></span>
                  <span class="dashboard__trend-tooltip-copy">
                    <span class="dashboard__trend-tooltip-label">${label}：</span><span class="dashboard__trend-tooltip-value">${value}</span>
                  </span>
                </span>
              </div>
            `;
          }

          return `
            <div class="dashboard__trend-tooltip-row">
              <span class="dashboard__trend-tooltip-series">
                <span class="dashboard__trend-tooltip-marker" style="background-color: ${color};"></span>
                <span class="dashboard__trend-tooltip-label">${label}</span>
              </span>
              <span class="dashboard__trend-tooltip-value">${value}</span>
            </div>
          `;
        })
        .join("");

      return `
        <div class="dashboard__trend-tooltip-content">
          <div class="dashboard__trend-tooltip-title">${title}</div>
          ${rows}
        </div>
      `;
    },
    [displayedSeries, i18n.resolvedLanguage, t, usesCompactTooltip]
  );

  const option = useMemo(
    () => ({
      animation: false,
      color: displayedSeries.map((item) => item.color),
      tooltip: {
        trigger: "axis",
        renderMode: "html",
        appendTo: "body",
        confine: false,
        position: getTooltipPosition,
        className: `dashboard__trend-tooltip${
          usesCompactTooltip ? " dashboard__trend-tooltip--compact" : ""
        }`,
        backgroundColor: "transparent",
        borderWidth: 0,
        padding: 0,
        formatter: tooltipFormatter,
      },
      legend: {
        show: false,
        selectedMode: true,
        data: displayedSeries.map((series) => series.displayLabel),
        selected: displayedSeries.reduce<Record<string, boolean>>(
          (result, series) => {
            result[series.displayLabel] = series.selected;
            return result;
          },
          {}
        ),
      },
      grid: {
        top: 8,
        left: 72,
        right: 72,
        bottom: 28,
        containLabel: false,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: chart.categories,
        axisLine: { lineStyle: { color: "#D8DADC" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#5f646d",
          fontSize: 12,
          margin: 12,
          alignMinLabel: "left",
          alignMaxLabel: "right",
          showMinLabel: true,
          showMaxLabel: true,
          hideOverlap: true,
        },
      },
      yAxis: [
        {
          type: "value",
          position: "left",
          offset: 48,
          min: chart.leftAxis?.minValue ?? 0,
          max: chart.leftAxis?.maxValue,
          splitNumber:
            chart.leftAxis?.tickLabels && chart.leftAxis.tickLabels.length > 1
              ? chart.leftAxis.tickLabels.length - 1
              : 5,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            align: "left",
            color: "#9EA2A9",
            fontSize: 12,
            formatter: (value: number, index: number) =>
              translateDashboardStaticText(
                getAxisTickLabel(index, chart.leftAxis?.tickLabels) ??
                  String(value),
                t
              ),
          },
          splitLine: { lineStyle: { color: "#E1E3E5", type: "dashed" } },
        },
        {
          type: "value",
          position: "right",
          offset: 48,
          min: chart.rightAxis?.minValue ?? 0,
          max: chart.rightAxis?.maxValue,
          splitNumber:
            chart.rightAxis?.tickLabels &&
            chart.rightAxis.tickLabels.length > 1
              ? chart.rightAxis.tickLabels.length - 1
              : 5,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            align: "right",
            color: "#9EA2A9",
            fontSize: 12,
            formatter: (value: number, index: number) =>
              translateDashboardStaticText(
                getAxisTickLabel(index, chart.rightAxis?.tickLabels) ??
                  String(value),
                t
              ),
          },
          splitLine: { show: false },
        },
      ],
      series: displayedSeries.map((item) => ({
        name: item.displayLabel,
        type: "line",
        cursor: "default",
        yAxisIndex: item.axis === "right" ? 1 : 0,
        smooth: chart.smooth ?? true,
        symbol: "circle",
        symbolSize: 0,
        showSymbol: false,
        itemStyle: {
          color: item.color,
        },
        lineStyle: {
          width: 2,
          color: item.color,
        },
        data: item.values,
      })),
    }),
    [
      chart.categories,
      chart.leftAxis,
      chart.rightAxis,
      chart.smooth,
      displayedSeries,
      t,
      tooltipFormatter,
      usesCompactTooltip,
    ]
  );

  return (
    <DashboardCard
      titleKey={chart.titleKey}
      titleText={chart.titleText}
      className={`dashboard__trend-card${
        hasTrendData ? "" : " dashboard__trend-card--empty"
      }`}
      actionVisible={false}
      titleAccessory={
        chartInfoTooltipText ? (
          <RiskInfoIcon tooltipText={chartInfoTooltipText} />
        ) : undefined
      }
    >
      {hasTrendData ? (
        <div className="dashboard__trend-content">
          <div className="dashboard__trend-legend">
            {displayedSeries.map((series) => (
              <div
                key={series.key}
                className={`dashboard__trend-legend-item${
                  series.selected
                    ? ""
                    : " dashboard__trend-legend-item--inactive"
                }`}
                role="button"
                tabIndex={0}
                onClick={() =>
                  toggleLegendSelection(series.key, series.displayLabel)
                }
                onKeyDown={(event) =>
                  handleLegendKeyDown(
                    event,
                    series.key,
                    series.displayLabel
                  )
                }
              >
                <span
                  className="dashboard__trend-legend-icon"
                  style={{ "--legend-color": series.color } as CSSProperties}
                >
                  <span className="dashboard__trend-legend-line" />
                  <span className="dashboard__trend-legend-dot" />
                </span>
                <span className="dashboard__trend-legend-label">
                  {series.displayLabel}
                </span>
              </div>
            ))}
          </div>

          <div className="dashboard__trend-chart">
            <div
              ref={containerRef}
              className="dashboard__chart-shell dashboard__trend-chart-shell"
            >
              <ClassNameECharts
                ref={chartRef as unknown as Ref<ClassNameECharts>}
                option={option}
                className="dashboard__trend-chart-instance"
                notMerge
                lazyUpdate
                onEvents={onEvents}
              />
            </div>
          </div>
        </div>
      ) : (
        <DashboardEmptyState className="dashboard__trend-empty" />
      )}
    </DashboardCard>
  );
}

function DashboardReassignModal({
  visible,
  department,
  tasks,
  onCancel,
  onSuccess,
}: {
  visible: boolean;
  department: DashboardDepartment;
  tasks: DashboardReassignTask[];
  onCancel: () => void;
  onSuccess: (assignedLabel: string) => void;
}) {
  const { t } = useTranslation();
  const [form] = Form.useForm<DashboardReassignFormValues>();
  const [members, setMembers] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAssignedUserId, setSelectedAssignedUserId] = useState<
    string | undefined
  >();
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [memberSearchKeyword, setMemberSearchKeyword] = useState("");
  const memberSearchInputRef = useRef<HTMLInputElement>(null);
  const trimmedMemberSearchKeyword = memberSearchKeyword.trim().toLowerCase();
  const filteredMembers = useMemo(() => {
    if (!trimmedMemberSearchKeyword) {
      return members;
    }

    return members.filter((member) =>
      `${member.label} ${member.value}`
        .toLowerCase()
        .includes(trimmedMemberSearchKeyword)
    );
  }, [members, trimmedMemberSearchKeyword]);
  const hasMemberSearchKeyword = memberSearchKeyword.trim().length > 0;

  useEffect(() => {
    if (!visible) {
      form.resetFields();
      setMembers([]);
      setSelectedAssignedUserId(undefined);
      setMemberDropdownOpen(false);
      setMemberSearchKeyword("");
      return;
    }

    let cancelled = false;
    setMembersLoading(true);

    getDashboardAssignableMembers(department)
      .then((nextMembers) => {
        if (!cancelled) {
          setMembers(nextMembers);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMembers([]);
          CustomMessage.error(t("adminDashboard.feedback.operationFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMembersLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [department, form, t, visible]);

  useEffect(() => {
    if (!memberDropdownOpen) {
      return undefined;
    }

    const focusTimer = window.setTimeout(() => {
      memberSearchInputRef.current?.focus();
    });

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [memberDropdownOpen]);

  const handleMemberDropdownVisibleChange = useCallback((open: boolean) => {
    setMemberDropdownOpen(open);

    if (!open) {
      setMemberSearchKeyword("");
    }
  }, []);

  const handleMemberSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setMemberDropdownOpen(true);
      setMemberSearchKeyword(event.target.value);
    },
    []
  );

  const handleMemberSearchClear = useCallback(() => {
    setMemberSearchKeyword("");
    memberSearchInputRef.current?.focus();
  }, []);

  const handleMemberSelect = useCallback(() => {
    setMemberSearchKeyword("");
  }, []);

  const renderMemberDropdown = useCallback(
    (menu: React.ReactElement) => {
      const searchRowClassName = hasMemberSearchKeyword
        ? "dashboard-reassign-modal__dropdown-search dashboard-reassign-modal__dropdown-search--active"
        : "dashboard-reassign-modal__dropdown-search";
      const dropdownPanelClassName = filteredMembers.length
        ? "dashboard-reassign-modal__dropdown-panel"
        : "dashboard-reassign-modal__dropdown-panel dashboard-reassign-modal__dropdown-panel--empty";

      return (
        <div className={dropdownPanelClassName}>
          <div
            className={searchRowClassName}
            onClick={() => memberSearchInputRef.current?.focus()}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <img
              src={inspectionFigmaAssets.createTask.searchIcon}
              alt=""
              className="dashboard-reassign-modal__dropdown-search-icon"
            />
            <input
              ref={memberSearchInputRef}
              className="dashboard-reassign-modal__dropdown-search-input"
              value={memberSearchKeyword}
              placeholder={t("inspection.common.search")}
              onChange={handleMemberSearchChange}
              onKeyDown={(event) => event.stopPropagation()}
            />
            {hasMemberSearchKeyword ? (
              <button
                type="button"
                className="dashboard-reassign-modal__dropdown-clear"
                onClick={handleMemberSearchClear}
                onMouseDown={(event) => event.preventDefault()}
                aria-label={t("inspection.common.reset")}
              >
                <img src={inspectionFigmaAssets.createTask.clearIcon} alt="" />
              </button>
            ) : null}
          </div>
          <div className="dashboard-reassign-modal__dropdown-menu">{menu}</div>
        </div>
      );
    },
    [
      filteredMembers.length,
      handleMemberSearchChange,
      handleMemberSearchClear,
      hasMemberSearchKeyword,
      memberSearchKeyword,
      t,
    ]
  );

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();

      setSubmitting(true);
      await reassignDashboardTasks({
        department,
        assignedUserId: values.assignedUserId || "",
        tasks,
      });
      const assignedLabel =
        members.find((member) => member.value === values.assignedUserId)
          ?.label || "";
      CustomMessage.success(t("adminDashboard.feedback.operationSuccessful"));
      form.resetFields();
      setSelectedAssignedUserId(undefined);
      setMemberDropdownOpen(false);
      setMemberSearchKeyword("");
      onSuccess(assignedLabel);
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        return;
      }
      CustomMessage.error(t("adminDashboard.feedback.operationFailed"));
    } finally {
      setSubmitting(false);
    }
  };
  const modalTitle =
    tasks.length > 1
      ? `${t("adminDashboard.reassign.title")} ${t(
          "adminDashboard.reassign.selectedCount",
          {
            count: tasks.length,
          }
        )}`
      : t("adminDashboard.reassign.title");

  const handleCancel = () => {
    if (submitting) {
      return;
    }

    form.resetFields();
    setSelectedAssignedUserId(undefined);
    setMemberDropdownOpen(false);
    setMemberSearchKeyword("");
    onCancel();
  };

  return (
    <Modal
      className="dashboard-reassign-modal"
      wrapClassName="dashboard-reassign-modal-wrap"
      title={modalTitle}
      visible={visible}
      centered
      closable={!submitting}
      destroyOnClose
      footer={[
        <Button
          key="cancel"
          className="dashboard-reassign-modal__action dashboard-reassign-modal__action--secondary"
          disabled={submitting}
          onClick={handleCancel}
        >
          {t("adminDashboard.reassign.cancel")}
        </Button>,
        <Button
          key="confirm"
          className="dashboard-reassign-modal__action dashboard-reassign-modal__action--primary"
          disabled={!selectedAssignedUserId}
          loading={submitting}
          onClick={() => void handleConfirm()}
        >
          {t("adminDashboard.reassign.confirm")}
        </Button>,
      ]}
      forceRender
      keyboard={!submitting}
      maskClosable={false}
      onCancel={handleCancel}
    >
      <Form
        className="dashboard-reassign-modal__form"
        form={form}
        layout="vertical"
        preserve={false}
        onValuesChange={(_, values: DashboardReassignFormValues) => {
          setSelectedAssignedUserId(values.assignedUserId);
        }}
      >
        <Form.Item
          name="assignedUserId"
          label={t("adminDashboard.reassign.assignedPerson")}
          rules={[
            {
              required: true,
              message: t("adminDashboard.reassign.required"),
            },
          ]}
        >
          <Select
            className="dashboard-reassign-modal__select"
            dropdownClassName="dashboard-reassign-modal__dropdown"
            dropdownAlign={{ overflow: { adjustY: false } }}
            dropdownRender={renderMemberDropdown}
            filterOption={false}
            getPopupContainer={(triggerNode) =>
              triggerNode.closest<HTMLElement>(
                ".dashboard-reassign-modal-wrap"
              ) || triggerNode.ownerDocument.body
            }
            listHeight={272}
            loading={membersLoading}
            menuItemSelectedIcon={null}
            notFoundContent={
              <div className="dashboard-reassign-modal__dropdown-empty">
                {t("adminDashboard.empty.noData")}
              </div>
            }
            open={memberDropdownOpen}
            placeholder={t("adminDashboard.reassign.selectTeamMember")}
            optionFilterProp="children"
            showSearch={false}
            onDropdownVisibleChange={handleMemberDropdownVisibleChange}
            onSelect={handleMemberSelect}
          >
            {filteredMembers.map((member) => (
              <Select.Option key={member.value} value={member.value}>
                <span className="dashboard-reassign-modal__dropdown-option-text">
                  {member.label}
                </span>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export function TableSection({
  section,
  department,
  activeTabKey,
  dashboardReturnContext,
  loadingByTab,
  onTabChange,
  onPageChange,
}: {
  section: DashboardTableSection;
  department: DashboardDepartment;
  activeTabKey?: string;
  dashboardReturnContext?: DashboardReturnContext;
  loadingByTab?: Record<string, boolean>;
  onTabChange?: (tabKey: string) => void;
  onPageChange?: (
    tabKey: string,
    page: number,
    pageSize: number,
    sortBy?: string,
    sortDirection?: DashboardTableSortDirection
  ) => void;
}) {
  const { t } = useTranslation();
  const navigate = useDashboardNavigation();
  const inspectionAccess = useInspectionAccess();
  const [activeTab, setActiveTab] = useState(
    activeTabKey || section.tabs[0]?.key || "",
  );
  const [paginationByTab, setPaginationByTab] = useState<
    Record<string, { current: number; pageSize: number }>
  >({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [reassignTasks, setReassignTasks] = useState<DashboardReassignTask[]>(
    []
  );
  const [reassignVisible, setReassignVisible] = useState(false);
  const [assignedOverrides, setAssignedOverrides] = useState<
    Record<string, string>
  >({});
  const [inspectionTaskModalVisible, setInspectionTaskModalVisible] =
    useState(false);
  const [editingInspectionTask, setEditingInspectionTask] =
    useState<DashboardInspectionTaskRecord | null>(null);
  const [cancelInspectionTaskVisible, setCancelInspectionTaskVisible] =
    useState(false);
  const [cancellingInspectionTask, setCancellingInspectionTask] =
    useState<DashboardInspectionTaskRecord | null>(null);
  const [cancelInspectionTaskLoading, setCancelInspectionTaskLoading] =
    useState(false);
  const active =
    section.tabs.find((tab) => tab.key === activeTab) || section.tabs[0];
  const activeReassignAllowed =
    !active?.allowedInspectionRoles?.length ||
    inspectionAccess.hasAnyRole(active.allowedInspectionRoles);
  const localPagination = paginationByTab[active?.key || ""] || {
    current: 1,
    pageSize: DEFAULT_TABLE_PAGE_SIZE,
  };
  const activePagination = {
    current: active?.pageIndex || localPagination.current,
    pageSize: active?.pageSize || localPagination.pageSize,
  };
  const activePageCurrent = activePagination.current;
  const activePageSize = activePagination.pageSize;

  useEffect(() => {
    setActiveTab((previous) =>
      activeTabKey && section.tabs.some((tab) => tab.key === activeTabKey)
        ? activeTabKey
        : section.tabs.some((tab) => tab.key === previous)
        ? previous
        : section.tabs[0]?.key || ""
    );
  }, [activeTabKey, section.tabs]);
  const displayRows = useMemo(
    () =>
      (active?.rows || []).map((row) => {
        const reassignTask = row.reassignTask;
        const sourceId = reassignTask?.sourceId;
        const assignedTo = sourceId ? assignedOverrides[sourceId] : undefined;

        if (!reassignTask || !sourceId || !assignedTo) {
          return row;
        }

        return {
          ...row,
          assignedTo: {
            text: assignedTo,
          },
          reassignTask: {
            ...reassignTask,
            assignedTo,
          },
        };
      }),
    [active?.rows, assignedOverrides]
  );
  const selectedTasks = useMemo(
    () =>
      displayRows
        .filter((row) => selectedRowKeys.includes(row.key))
        .map((row) => row.reassignTask)
        .filter((task): task is DashboardReassignTask => Boolean(task)),
    [displayRows, selectedRowKeys]
  );
  const totalRows = active?.totalCount ?? displayRows.length;
  const totalPages = Math.ceil(totalRows / activePageSize);
  const currentPage =
    totalPages > 0 ? Math.min(activePageCurrent, totalPages) : 1;
  const navigateFromTable = useCallback(
    (target: DashboardNavigationTarget) => {
      const returnState =
        active && dashboardReturnContext
          ? {
              version: 1 as const,
              ...dashboardReturnContext,
              attention: {
                tabKey: active.key,
                pageIndex: currentPage,
                pageSize: activePageSize,
                sortBy: active.sortBy,
                sortDirection: active.sortDirection,
              },
              scrollTop: getPageContentScrollTop(),
            }
          : undefined;

      navigate(target, returnState);
    },
    [
      active,
      activePageSize,
      currentPage,
      dashboardReturnContext,
      navigate,
    ],
  );
  const reloadActiveTable = useCallback(() => {
    if (!active || !onPageChange) {
      return;
    }

    onPageChange(
      active.key,
      currentPage,
      activePageSize,
      active.sortBy,
      active.sortDirection
    );
  }, [active, activePageSize, currentPage, onPageChange]);
  const hasInspectionTaskActionAccess = useCallback(
    (action?: DashboardTableAction) =>
      inspectionAccess.isRouteAllowed({
        path: action?.permissionPath || INSPECTION_PATHS.tasks,
        allowedInspectionRoles:
          action?.allowedInspectionRoles || INSPECTION_TASK_ROLES,
      }),
    [inspectionAccess]
  );
  const handlePaginationChange = useCallback(
    (page: number, pageSize?: number) => {
      if (!active) {
        return;
      }

      const nextPageSize = pageSize || activePageSize;
      const shouldResetPage = nextPageSize !== activePageSize;
      const nextPage = shouldResetPage ? 1 : page;

      if (
        nextPage === activePageCurrent &&
        nextPageSize === activePageSize
      ) {
        return;
      }

      if (onPageChange) {
        onPageChange(
          active.key,
          nextPage,
          nextPageSize,
          active.sortBy,
          active.sortDirection
        );
        setSelectedRowKeys([]);
        return;
      }

      setPaginationByTab((previous) => ({
        ...previous,
        [active.key]: {
          current: nextPage,
          pageSize: nextPageSize,
        },
      }));
      setSelectedRowKeys([]);
    },
    [active, activePageCurrent, activePageSize, onPageChange]
  );

  const handleInspectionTaskModalVisibleChange = useCallback(
    (visible: boolean) => {
      setInspectionTaskModalVisible(visible);

      if (!visible) {
        setEditingInspectionTask(null);
      }
    },
    []
  );

  const closeCancelInspectionTaskModal = useCallback(() => {
    if (cancelInspectionTaskLoading) {
      return;
    }

    setCancelInspectionTaskVisible(false);
    setCancellingInspectionTask(null);
  }, [cancelInspectionTaskLoading]);

  const confirmCancelInspectionTask = useCallback(async () => {
    if (!cancellingInspectionTask || cancelInspectionTaskLoading) {
      return;
    }

    if (!hasInspectionTaskActionAccess()) {
      CustomMessage.warning(t("adminDashboard.feedback.noPermissionToOpen"));
      return;
    }

    setCancelInspectionTaskLoading(true);
    try {
      await cancelInspectionTask({
        taskId: cancellingInspectionTask.taskId,
        reason: "Cancelled from dashboard.",
      });
      CustomMessage.success(t("inspection.tasks.messages.cancelled"));
      setCancelInspectionTaskVisible(false);
      setCancellingInspectionTask(null);
      reloadActiveTable();
    } catch {
      // The request layer shows the API error; keep the modal open.
    } finally {
      setCancelInspectionTaskLoading(false);
    }
  }, [
    cancelInspectionTaskLoading,
    cancellingInspectionTask,
    hasInspectionTaskActionAccess,
    reloadActiveTable,
    t,
  ]);

  const openReassignModal = useCallback(
    (tasks: DashboardReassignTask[]) => {
      if (!tasks.length) {
        CustomMessage.error(t("adminDashboard.feedback.operationFailed"));
        return;
      }

      if (!activeReassignAllowed) {
        CustomMessage.warning(t("adminDashboard.feedback.noPermissionToOpen"));
        return;
      }

      setReassignTasks(tasks);
      setReassignVisible(true);
    },
    [activeReassignAllowed, t]
  );

  const duplicateDashboardInspectionTask = useCallback(
    async (task: DashboardInspectionTaskRecord) => {
      if (!hasInspectionTaskActionAccess()) {
        CustomMessage.warning(t("adminDashboard.feedback.noPermissionToOpen"));
        return;
      }

      try {
        await duplicateInspectionTask({ taskId: task.taskId });
        CustomMessage.success(t("inspection.tasks.messages.duplicated"));
        reloadActiveTable();
      } catch {
        // The request layer shows the API error.
      }
    },
    [hasInspectionTaskActionAccess, reloadActiveTable, t]
  );

  const handleInspectionAction = useCallback(
    (action: DashboardTableAction, record: DashboardTableRow) => {
      const actionCode = String(action.actionCode || "").toLowerCase();

      if (
        record.sourceType !== "inspection" ||
        !["duplicate", "edit", "cancel"].includes(actionCode)
      ) {
        return false;
      }

      if (!hasInspectionTaskActionAccess(action)) {
        CustomMessage.warning(t("adminDashboard.feedback.noPermissionToOpen"));
        return true;
      }

      const taskId = getDashboardInspectionTaskId(record, action);

      if (!taskId) {
        CustomMessage.error(t("adminDashboard.feedback.operationFailed"));
        return true;
      }

      const taskRecord = createDashboardInspectionTaskRecord(record, taskId);

      if (actionCode === "edit") {
        setEditingInspectionTask(taskRecord);
        setInspectionTaskModalVisible(true);
        return true;
      }

      if (actionCode === "duplicate") {
        void duplicateDashboardInspectionTask(taskRecord);
        return true;
      }

      setCancellingInspectionTask(taskRecord);
      setCancelInspectionTaskLoading(false);
      setCancelInspectionTaskVisible(true);
      return true;
    },
    [duplicateDashboardInspectionTask, hasInspectionTaskActionAccess, t]
  );

  const handleTableChange: TableProps<DashboardTableRow>["onChange"] =
    useCallback(
      (_pagination, _filters, sorter, extra) => {
        if (!active || !onPageChange || extra?.action !== "sort") {
          return;
        }

        const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
        const order = activeSorter?.order;
        const nextSortBy =
          typeof activeSorter?.columnKey === "string"
            ? activeSorter.columnKey
            : undefined;
        const nextSortDirection: DashboardTableSortDirection | undefined =
          order === "ascend"
            ? "asc"
            : order === "descend"
            ? "desc"
            : undefined;

        onPageChange(
          active.key,
          1,
          activePageSize,
          nextSortDirection ? nextSortBy : undefined,
          nextSortDirection
        );
        setSelectedRowKeys([]);
      },
      [active, activePageSize, onPageChange]
    );

  const columns = useMemo<ColumnsType<DashboardTableRow>>(
    () =>
      (active?.columns || []).map((column) => {
        const isActionColumn = column.key === "action";
        const sortOrder =
          column.sortKey && active?.sortBy === column.sortKey
            ? active.sortDirection === "asc"
              ? "ascend"
              : "descend"
            : null;

        return {
          key: column.sortKey || column.key,
          dataIndex: column.dataIndex,
          title: renderDashboardLabel(column.titleKey, column.titleText, t),
          width:
            column.width === undefined ? undefined : pxToRemValue(column.width),
          sorter: column.sortKey ? true : undefined,
          sortOrder: column.sortKey ? sortOrder : undefined,
          fixed: isActionColumn ? ("right" as const) : undefined,
          className: isActionColumn
            ? "dashboard__table-actions-column"
            : undefined,
          render: (value: unknown, record) => {
            const content = renderCellValue(
              value,
              (key, options) => t(key, options),
              column.key
            );

            if (!isActionColumn) {
              return content;
            }
            if (record.actions?.length) {
              return (
                <DashboardTableActions
                  actions={record.actions}
                  record={record}
                  translate={(key, options) => t(key, options)}
                  navigate={navigateFromTable}
                  openReassignModal={openReassignModal}
                  handleInspectionAction={handleInspectionAction}
                />
              );
            }

            if (record.reassignTask) {
              const reassignTask = record.reassignTask;

              return (
                <button
                  type="button"
                  className="dashboard__table-action"
                  onClick={(event) => {
                    event.stopPropagation();
                    openReassignModal([reassignTask]);
                  }}
                >
                  {content}
                </button>
              );
            }

            return content;
          },
        };
      }),
    [active, handleInspectionAction, navigateFromTable, openReassignModal, t]
  );

  if (!active) {
    return null;
  }

  const activeLoading = Boolean(loadingByTab?.[active.key]);
  const tableClassName = [
    "dashboard__table",
    `dashboard__table--${section.key}`,
    `dashboard__table--${active.key}`,
    active.selectable ? "dashboard__table--selectable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <DashboardCard
      titleKey={section.titleKey}
      className="dashboard__table-card"
      actionVisible={Boolean(section.actionPath || section.actionLabelKey)}
      actionPath={section.actionPath}
      actionPermissionPath={section.actionPermissionPath}
      actionLabelKey={section.actionLabelKey}
    >
      {section.tabs.length > 1 ? (
        <div className="dashboard__tabs dashboard__tabs--table" role="tablist">
          {section.tabs.map((tab) => {
            const isActive = tab.key === active.key;
            const label = renderDashboardLabel(tab.labelKey, tab.labelText, t);
            const countVisible = !labelIncludesCount(label, tab.count);

            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                className={`dashboard__tab${
                  isActive ? " dashboard__tab--active" : ""
                }`}
                onClick={() => {
                  if (isActive && activeLoading) {
                    return;
                  }

                  setActiveTab(tab.key);
                  setSelectedRowKeys([]);
                  onTabChange?.(tab.key);
                }}
              >
                <span>{label}</span>
                {countVisible ? <span>{tab.count}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {active.selectable && activeReassignAllowed && selectedTasks.length ? (
        <div className="dashboard__selection-bar">
          <span>
            {t("adminDashboard.table.selectedCount", {
              count: selectedTasks.length,
            })}
          </span>
          <button
            type="button"
            className="dashboard__selection-action"
            onClick={() => {
              openReassignModal(selectedTasks);
            }}
          >
            {t("adminDashboard.actions.reassign")}
          </button>
        </div>
      ) : null}

      <Table<DashboardTableRow>
        rowKey="key"
        className={tableClassName}
        columns={columns}
        dataSource={displayRows}
        loading={activeLoading}
        onChange={handleTableChange}
        locale={{
          emptyText: (
            <DashboardEmptyState
              className={
                activeLoading
                  ? "dashboard__empty-state--loading-placeholder"
                  : ""
              }
            />
          ),
        }}
        pagination={
          totalRows > 0
            ? {
              size: "default",
                current: currentPage,
                pageSize: activePageSize,
                total: totalRows,
                showSizeChanger: true,
                pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
                showTotal: (total) => (
                  <PaginationTotal
                    label={t("common.total")}
                    total={total}
                    current={currentPage}
                    pageSize={activePageSize}
                  />
                ),
                onChange: handlePaginationChange,
              }
            : false
        }
        rowClassName={(record) =>
          [
            selectedRowKeys.includes(record.key)
              ? "dashboard__table-row--selected"
              : "",
            record.targetPath ? "dashboard__table-row--clickable" : "",
          ]
            .filter(Boolean)
            .join(" ")
        }
        onRow={(record) => ({
          onClick: (event) => {
            if (shouldIgnoreDashboardTableRowClick(event)) {
              return;
            }
            const canAppendTodoFrom = (record.availableActions || []).some(
              (action) =>
                String(action?.actionCode || "")
                  .trim()
                  .toLowerCase() === "reassign"
            );
            navigateFromTable({
              targetPath: record.targetPath?.includes(
                "/happiness/tickets/tickets-details?"
              )
                ? canAppendTodoFrom
                  ? `${record.targetPath}&from=TeamTasks-todo`
                  : record.targetPath
                : record.targetPath,
              permissionPath: record.permissionPath,
              allowedInspectionRoles: record.allowedInspectionRoles,
              fallbackTargets: record.fallbackTargets as
                | DashboardNavigationTarget[]
                | undefined,
            });
          },
        })}
        rowSelection={
          active.selectable && activeReassignAllowed
            ? {
                columnWidth: pxToRemValue(48),
                selectedRowKeys,
                onChange: setSelectedRowKeys,
                getCheckboxProps: (record) => ({
                  disabled: !record.reassignTask,
                }),
              }
            : undefined
        }
        scroll={{ x: "max-content" }}
      />
      <DashboardReassignModal
        visible={reassignVisible}
        department={department}
        tasks={reassignTasks}
        onCancel={() => {
          setReassignVisible(false);
        }}
        onSuccess={(assignedLabel) => {
          const nextOverrides = reassignTasks.reduce<Record<string, string>>(
            (result, task) => {
              result[task.sourceId] = assignedLabel;
              return result;
            },
            {}
          );

          setAssignedOverrides((previous) => ({
            ...previous,
            ...nextOverrides,
          }));
          reloadActiveTable();
          setReassignVisible(false);
          setSelectedRowKeys([]);
        }}
      />
      <CreateTaskModal
        visible={inspectionTaskModalVisible}
        mode="edit"
        editingTask={editingInspectionTask}
        isInspectorSelfCreate={false}
        currentInspectorId={inspectionAccess.inspectorId}
        getAuthorityName={getDashboardInspectionAuthorityName}
        onVisibleChange={handleInspectionTaskModalVisibleChange}
        onSubmitted={reloadActiveTable}
      />
      <CancelTaskModal
        visible={cancelInspectionTaskVisible && Boolean(cancellingInspectionTask)}
        title={t("inspection.tasks.actions.cancelTask")}
        content={t("inspection.tasks.messages.cancelConfirm")}
        cancelText={t("inspection.common.no")}
        confirmText={t("inspection.common.yes")}
        loading={cancelInspectionTaskLoading}
        onCancel={closeCancelInspectionTaskModal}
        onConfirm={confirmCancelInspectionTask}
      />
    </DashboardCard>
  );
}

export function CoachingCard({
  rows,
  actionPath,
  actionPermissionPath,
  allowedInspectionRoles,
  infoTooltipKey,
  infoTooltipText,
}: {
  rows: DashboardCoachingRow[];
  actionPath?: string;
  actionPermissionPath?: string;
  allowedInspectionRoles?: DashboardNavigationTarget["allowedInspectionRoles"];
  infoTooltipKey?: string;
  infoTooltipText?: string;
}) {
  const { t } = useTranslation();
  const hasReopenRate = rows.some((row) => row.reopenRate !== undefined);
  const coachingInfoTooltipText = renderDashboardLabel(
    infoTooltipKey,
    infoTooltipText,
    t
  );

  return (
    <DashboardCard
      titleKey="adminDashboard.sections.membersNeedingCoaching"
      className="dashboard__coaching-card"
      actionPath={actionPath}
      actionPermissionPath={actionPermissionPath}
      allowedInspectionRoles={allowedInspectionRoles}
      titleAccessory={
        coachingInfoTooltipText ? (
          <RiskInfoIcon tooltipText={coachingInfoTooltipText} />
        ) : undefined
      }
    >
      {rows.length ? (
        <div className="dashboard__coaching-card-body">
          <div
            className={`dashboard__coaching-table${
              hasReopenRate ? " dashboard__coaching-table--reopen" : ""
            }`}
          >
            <div
              className={`dashboard__coaching-row dashboard__coaching-row--header${
                hasReopenRate ? " dashboard__coaching-row--reopen" : ""
              }`}
            >
              <span>{t("adminDashboard.table.member")}</span>
              <span>{t("adminDashboard.table.overdue")}</span>
              <span>{t("adminDashboard.metrics.slaCompliance")}</span>
              <span>{t("adminDashboard.metrics.avgProcessingTime")}</span>
              {hasReopenRate ? (
                <span>{t("adminDashboard.metrics.reopenRate")}</span>
              ) : null}
            </div>
            {rows.map((row) => (
              <div
                key={row.key}
                className={`dashboard__coaching-row${
                  hasReopenRate ? " dashboard__coaching-row--reopen" : ""
                }`}
              >
                <strong>{renderDashboardTableText(row.member)}</strong>
                <span className="dashboard-tone--red">
                  {renderDashboardTableText(row.overdue)}
                </span>
                <span>{renderDashboardTableText(row.slaCompliance)}</span>
                <span>
                  {renderDashboardTableText(
                    translateDashboardStaticText(row.avgProcessingTime, t)
                  )}
                </span>
                {hasReopenRate ? (
                  <span>{renderDashboardTableText(row.reopenRate)}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <DashboardEmptyState className="dashboard__coaching-empty" />
      )}
    </DashboardCard>
  );
}

export function LeaveCard({
  rows = [],
  actionPath,
  actionPermissionPath,
  allowedInspectionRoles,
  totalCount,
}: {
  rows?: DashboardLeaveRow[];
  actionPath?: string;
  actionPermissionPath?: string;
  allowedInspectionRoles?: DashboardNavigationTarget["allowedInspectionRoles"];
  totalCount?: number;
}) {
  const { t } = useTranslation();

  return (
    <DashboardCard
      titleKey="adminDashboard.sections.membersOnEmergencyLeave"
      className="dashboard__leave-card"
      actionPath={actionPath}
      actionPermissionPath={actionPermissionPath}
      allowedInspectionRoles={allowedInspectionRoles}
      titleCount={totalCount}
    >
      {rows.length ? (
        <div className="dashboard__leave-list">
          {rows.map((row) => (
            <article key={row.key} className="dashboard__leave-item">
              <span className="dashboard__leave-avatar">
                {row.avatar ? (
                  <AuthenticatedDocumentImage src={row.avatar} alt="" />
                ) : (
                  (row.name || "")
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                )}
              </span>
              <div className="dashboard__leave-body">
                <OverflowTooltipText
                  as="strong"
                  text={renderDashboardTableText(row.name)}
                />
                <OverflowTooltipText text={renderDashboardTableText(row.reason)} />
                {row.returnAt ? (
                  <OverflowTooltipText
                    as="small"
                    text={t("adminDashboard.leave.returnAt", {
                      value: row.returnAt,
                    })}
                  />
                ) : null}
              </div>
              <div className="dashboard__leave-count">
                <strong>{renderDashboardTableText(row.todoCount)}</strong>
                <span>{t("adminDashboard.labels.toDoCompact")}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <DashboardEmptyState
          className="dashboard__leave-empty"
          labelKey="adminDashboard.empty.noDataAvailable"
        />
      )}
    </DashboardCard>
  );
}
