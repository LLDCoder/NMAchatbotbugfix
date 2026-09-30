import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { Spin } from "antd";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import {
  CustomMessage,
  PageHeadingPortal,
  PAGE_TITLE_EXTRA_PORTAL_ID,
} from "@/components/common";
import {
  getDashboardAttentionTab,
  getDashboardData,
  getDashboardTaskCards,
  getLicenseDashboardContext,
} from "@/services/dashboard";
import { useUserStore } from "@/store/user";
import {
  requestPageContentScrollTo,
  requestPageContentScrollToTop,
} from "@/layout/pageContentScroll";
import {
  CoachingCard,
  DashboardEmptyState,
  DonutSummaryCard,
  LeaveCard,
  MetricGrid,
  RiskGridCard,
  TableSection,
  TaskListSection,
  TrendChartCard,
} from "./components/DashboardWidgets";
import { ContentDashboardLayout } from "./components/ContentDashboardWidgets";
import { LicenseDashboardLayout } from "./components/LicenseDashboardWidgets";
import {
  DashboardTimeFilter,
  DepartmentSelector,
  RoleSelector,
} from "./components/DashboardControls";
import {
  DASHBOARD_HEADER_CONTROL_MODE,
  resolveDashboardHeaderVisibility,
} from "./constants";
import type {
  DashboardContentWorkloadData,
  DashboardData,
  DashboardLicenseWorkloadData,
  DashboardDepartment,
  DashboardDepartmentOption,
  DashboardRangeValue,
  DashboardRoleOptionsByDepartment,
  DashboardRoleVariant,
  DashboardTableSortDirection,
  DashboardTimeFilter as DashboardTimeFilterValue,
  DashboardTimePreset,
  DashboardWorkloadData,
} from "./type";
import {
  normalizeDashboardAttentionPageIndex,
  readDashboardReturnState,
  type DashboardAttentionReturnState,
  type DashboardReturnContext,
} from "./dashboardReturnState";
import "./index.less";

const DASHBOARD_TIME_PRESET_DAYS: Record<
  Exclude<DashboardTimePreset, "custom">,
  number
> = {
  last7: 7,
  last30: 30,
  last6Months: 180,
  lastYear: 365,
};

const DEFAULT_DEPARTMENT: DashboardDepartment = "license";
const DEFAULT_ROLE_VARIANT: DashboardRoleVariant = "staff";
const DEFAULT_TIME_FILTER: DashboardTimeFilterValue = {
  preset: "last7",
  days: DASHBOARD_TIME_PRESET_DAYS.last7,
};
const MAX_LEAVE_ROWS = 3;
const INSPECTOR_TASK_TAB_ROUTES: Record<string, string> = {
  inspection: "/inspection/tasks",
  inspections: "/inspection/tasks",
  violation: "/inspection/violations",
  violations: "/inspection/violations",
  violationsfines: "/inspection/violations",
  violationsandfines: "/inspection/violations",
  enquiry: "/happiness/tickets",
  enquiries: "/happiness/tickets",
  enquiriescomplaints: "/happiness/tickets",
  enquiriesandcomplaints: "/happiness/tickets",
  appeal: "/happiness/appeals",
  appeals: "/happiness/appeals",
  refund: "/happiness/refunds",
  refunds: "/happiness/refunds",
};

const createDraftRangeFromFilter = (
  filter: DashboardTimeFilterValue
): DashboardRangeValue =>
  filter.startDate && filter.endDate
    ? [
        moment(filter.startDate, "YYYY-MM-DD"),
        moment(filter.endDate, "YYYY-MM-DD"),
      ]
    : null;

const formatTimeFilterLabel = (
  preset: DashboardTimePreset,
  filter: DashboardTimeFilterValue,
  translate: (key: string) => string
) => {
  if (preset === "custom" && filter.startDate && filter.endDate) {
    return `${moment(filter.startDate, "YYYY-MM-DD").format(
      "DD/MM/YYYY"
    )} - ${moment(filter.endDate, "YYYY-MM-DD").format("DD/MM/YYYY")}`;
  }

  return translate(`adminDashboard.timeFilter.${preset}`);
};

const isAbortError = (error: unknown) => {
  const abortError = error as { code?: string; name?: string };

  return (
    abortError?.code === "ERR_CANCELED" ||
    abortError?.name === "CanceledError" ||
    abortError?.name === "AbortError"
  );
};

const limitDashboardLeaveRows = (dashboardData: DashboardData): DashboardData =>
  "leaveRows" in dashboardData
    ? {
        ...dashboardData,
        leaveRows: dashboardData.leaveRows?.slice(0, MAX_LEAVE_ROWS),
      }
    : dashboardData;

const buildRequestSignature = ({
  department,
  roleVariant,
  tabKey,
  pageIndex,
  pageSize,
  sortBy,
  sortDirection,
  timeFilter,
}: {
  department: DashboardDepartment;
  roleVariant: DashboardRoleVariant;
  tabKey?: string;
  pageIndex?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: DashboardTableSortDirection;
  timeFilter: DashboardTimeFilterValue;
}) =>
  [
    department,
    roleVariant,
    tabKey || "",
    pageIndex || "",
    pageSize || "",
    sortBy || "",
    sortDirection || "",
    timeFilter.preset,
    timeFilter.days || "",
    timeFilter.startDate || "",
    timeFilter.endDate || "",
  ].join("|");

const buildDashboardViewSignature = (
  department: DashboardDepartment,
  timeFilter: DashboardTimeFilterValue
) =>
  [
    department,
    timeFilter.preset,
    timeFilter.days || "",
    timeFilter.startDate || "",
    timeFilter.endDate || "",
  ].join("|");

interface WorkloadDashboardProps {
  data: DashboardWorkloadData;
  resetKey: string;
  attentionActiveTabKey?: string;
  dashboardReturnContext: DashboardReturnContext;
  taskTabLoadingByKey?: Record<string, boolean>;
  attentionTableLoadingByKey?: Record<string, boolean>;
  onTaskTabChange?: (tabKey: string) => void;
  onAttentionTabChange?: (tabKey: string) => void;
  onAttentionPageChange?: (
    tabKey: string,
    page: number,
    pageSize: number,
    sortBy?: string,
    sortDirection?: DashboardTableSortDirection
  ) => void;
}

function WorkloadDashboard({
  data,
  resetKey,
  attentionActiveTabKey,
  dashboardReturnContext,
  taskTabLoadingByKey,
  attentionTableLoadingByKey,
  onTaskTabChange,
  onAttentionTabChange,
  onAttentionPageChange,
}: WorkloadDashboardProps) {
  const hasCoachingCard = Array.isArray(data.coachingRows);
  const hasLeaveCard =
    Array.isArray(data.leaveRows) || typeof data.leaveTotalCount === "number";
  const hasSupportCards = Boolean(hasCoachingCard || hasLeaveCard);
  const supportActionPath = data.supportAction?.targetPath;
  const supportActionPermissionPath = data.supportAction?.permissionPath;
  const supportActionAllowedInspectionRoles =
    data.supportAction?.allowedInspectionRoles;
  const summaryCardCount = data.donutCards.length + (data.riskGridCard ? 1 : 0);

  const performanceContent =
    data.roleVariant === "manager" ? (
      <MetricGrid
        titleKey={data.performanceTitleKey}
        metrics={data.performanceMetrics}
        variant="manager"
      />
    ) : (
      <div className="dashboard__performance-grid dashboard__performance-grid--staff">
        <MetricGrid
          titleKey={data.performanceTitleKey}
          metrics={data.performanceMetrics}
          variant="staff"
        />
        {data.trendChart ? <TrendChartCard chart={data.trendChart} /> : null}
      </div>
    );

  return (
    <>
      <TaskListSection
        key={`${resetKey}-${data.department}-${data.roleVariant}-tasks`}
        tabs={data.taskTabs}
        loadingByTab={taskTabLoadingByKey}
        onTabChange={onTaskTabChange}
      />

      {/*
        Below 1440 the wrapper merges its two inner grids into one continuous
        2-column grid, mirroring the license module (Figma node 44434:274239):
        staff pairs the summary cards with My Performance and the Trend spans a
        full row; manager pairs the third summary card with Emergency Leave and
        Coaching spans a full row. From 1440 up the wrapper is transparent.
      */}
      {data.roleVariant === "manager" ? (
        <>
          {performanceContent}
          <div className="dashboard__workload-groups dashboard__workload-groups--manager">
            <div
              className={`dashboard__summary-grid dashboard__summary-grid--${Math.min(
                summaryCardCount,
                3
              )}`}
            >
              {data.donutCards.map((card) => (
                <DonutSummaryCard
                  key={`${data.department}-${card.key}`}
                  card={card}
                />
              ))}
              {data.riskGridCard ? (
                <RiskGridCard
                  key={`${data.department}-${data.riskGridCard.key}`}
                  card={data.riskGridCard}
                />
              ) : null}
            </div>

            {hasSupportCards ? (
              <div className="dashboard__support-grid">
                {hasCoachingCard ? (
                  <CoachingCard
                    rows={data.coachingRows || []}
                    actionPath={supportActionPath}
                    actionPermissionPath={supportActionPermissionPath}
                    allowedInspectionRoles={supportActionAllowedInspectionRoles}
                    infoTooltipKey={data.coachingInfoTooltipKey}
                    infoTooltipText={data.coachingInfoTooltipText}
                  />
                ) : null}
                {hasLeaveCard ? (
                  <LeaveCard
                    rows={data.leaveRows || []}
                    actionPath={supportActionPath}
                    actionPermissionPath={supportActionPermissionPath}
                    allowedInspectionRoles={supportActionAllowedInspectionRoles}
                    totalCount={data.leaveTotalCount}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="dashboard__workload-groups dashboard__workload-groups--staff">
            <div
              className={`dashboard__summary-grid dashboard__summary-grid--${Math.min(
                summaryCardCount,
                3
              )}`}
            >
              {data.donutCards.map((card) => (
                <DonutSummaryCard
                  key={`${data.department}-${card.key}`}
                  card={card}
                />
              ))}
              {data.riskGridCard ? (
                <RiskGridCard
                  key={`${data.department}-${data.riskGridCard.key}`}
                  card={data.riskGridCard}
                />
              ) : null}
            </div>

            {performanceContent}
          </div>

          {hasSupportCards ? (
            <div className="dashboard__support-grid">
              {hasCoachingCard ? (
                <CoachingCard
                  rows={data.coachingRows || []}
                  actionPath={supportActionPath}
                  actionPermissionPath={supportActionPermissionPath}
                  allowedInspectionRoles={supportActionAllowedInspectionRoles}
                  infoTooltipKey={data.coachingInfoTooltipKey}
                  infoTooltipText={data.coachingInfoTooltipText}
                />
              ) : null}
              {hasLeaveCard ? (
                <LeaveCard
                  rows={data.leaveRows || []}
                  actionPath={supportActionPath}
                  actionPermissionPath={supportActionPermissionPath}
                  allowedInspectionRoles={supportActionAllowedInspectionRoles}
                  totalCount={data.leaveTotalCount}
                />
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <TableSection
        key={`${resetKey}-${data.department}-${data.roleVariant}-${data.attentionTable.key}`}
        section={data.attentionTable}
        department={data.department}
        activeTabKey={attentionActiveTabKey}
        dashboardReturnContext={dashboardReturnContext}
        loadingByTab={attentionTableLoadingByKey}
        onTabChange={onAttentionTabChange}
        onPageChange={data.department === "license" ? undefined : onAttentionPageChange}
      />
    </>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const location = useLocation<unknown>();
  const dashboardReturnStateRef = useRef(
    readDashboardReturnState(location.state),
  );
  const initialReturnState = dashboardReturnStateRef.current;
  const userId = useUserStore((state) => state.userInfo?.id || "");
  const userInfo = useUserStore((state) => state.userInfo);
  const isLicensingOfficerOnly = useMemo(() => {
    const roleIds = new Set([
      ...(userInfo?.listRoles || []).map((role) => role.id),
      ...(userInfo?.rolesInfo || [])
        .map((role) => role.roleID)
        .filter((roleId): roleId is string => Boolean(roleId)),
    ]);
    return roleIds.size === 1 && roleIds.has("LICENSING_OFFICER");
  }, [userInfo?.listRoles, userInfo?.rolesInfo]);
  const isInspectorOnly = useMemo(() => {
    const roleIds = new Set([
      ...(userInfo?.listRoles || []).map((role) => role.id),
      ...(userInfo?.rolesInfo || [])
        .map((role) => role.roleID)
        .filter((roleId): roleId is string => Boolean(roleId)),
    ]);
    return roleIds.size === 1 && roleIds.has("INSPECTOR");
  }, [userInfo?.listRoles, userInfo?.rolesInfo]);
  const [department, setDepartment] =
    useState<DashboardDepartment>(
      initialReturnState?.department || DEFAULT_DEPARTMENT,
    );
  const [departments, setDepartments] = useState<DashboardDepartmentOption[]>(
    []
  );
  const [data, setData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextReady, setContextReady] = useState(false);
  const [departmentSelectorVisible, setDepartmentSelectorVisible] =
    useState(false);
  const [roleVariant, setRoleVariant] =
    useState<DashboardRoleVariant>(
      initialReturnState?.roleVariant || DEFAULT_ROLE_VARIANT,
    );
  const [roleVariantsByDepartment, setRoleVariantsByDepartment] = useState<
    Partial<Record<DashboardDepartment, DashboardRoleVariant>>
  >({});
  const [roleOptionsByDepartment, setRoleOptionsByDepartment] =
    useState<DashboardRoleOptionsByDepartment>({});
  const [roleSelectorVisible, setRoleSelectorVisible] = useState(false);
  const [taskTabLoadingByKey, setTaskTabLoadingByKey] = useState<
    Record<string, boolean>
  >({});
  const [attentionTableLoadingByKey, setAttentionTableLoadingByKey] = useState<
    Record<string, boolean>
  >({});
  const [attentionActiveTabKey, setAttentionActiveTabKey] = useState(
    initialReturnState?.attention.tabKey || "",
  );
  const [timeFilterVisible, setTimeFilterVisible] = useState(false);
  const [timeFilter, setTimeFilter] =
    useState<DashboardTimeFilterValue>(
      initialReturnState?.timeFilter || DEFAULT_TIME_FILTER,
    );
  const [timePreset, setTimePreset] = useState<DashboardTimePreset>(
    initialReturnState?.timeFilter.preset || DEFAULT_TIME_FILTER.preset,
  );
  const [draftRange, setDraftRange] = useState<DashboardRangeValue>(
    createDraftRangeFromFilter(
      initialReturnState?.timeFilter || DEFAULT_TIME_FILTER,
    ),
  );
  const pendingAttentionRestoreRef = useRef<DashboardAttentionReturnState | null>(
    initialReturnState?.attention || null,
  );
  const pendingScrollRestoreRef = useRef<number | null>(
    initialReturnState?.scrollTop ?? null,
  );
  const taskTabRequestSignatureRef = useRef<Record<string, string>>({});
  const attentionRequestSignatureRef = useRef<Record<string, string>>({});
  const taskTabPendingSignatureRef = useRef<Record<string, string>>({});
  const attentionPendingSignatureRef = useRef<Record<string, string>>({});
  const dataAbortControllerRef = useRef<AbortController | null>(null);
  const taskTabAbortControllerRef = useRef<AbortController | null>(null);
  const attentionAbortControllerRef = useRef<AbortController | null>(null);
  const dashboardViewSignature = useMemo(
    () => buildDashboardViewSignature(department, timeFilter),
    [department, timeFilter]
  );
  const dashboardReturnContext = useMemo<DashboardReturnContext>(
    () => ({ department, roleVariant, timeFilter }),
    [department, roleVariant, timeFilter],
  );
  const headerVisibility = useMemo(
    () =>
      resolveDashboardHeaderVisibility({
        departmentCount: departments.length,
        mode: DASHBOARD_HEADER_CONTROL_MODE,
      }),
    [departments.length]
  );
  const roleOptions = useMemo(() => {
    const options = roleOptionsByDepartment[department] || [];

    if (!options.length) {
      return [roleVariant];
    }

    return options.includes(roleVariant) ? options : [roleVariant, ...options];
  }, [department, roleOptionsByDepartment, roleVariant]);
  const showRoleSelector =
    headerVisibility.showRoleTag && roleOptions.length > 1;
  const hasTitleActions =
    headerVisibility.showDepartmentSelector || showRoleSelector;
  const pageLoading = contextLoading || dataLoading;
  const restorePageScrollAfterRender = useCallback(() => {
    const scrollTop = pendingScrollRestoreRef.current;

    if (scrollTop === null) {
      return;
    }

    pendingScrollRestoreRef.current = null;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        requestPageContentScrollTo(scrollTop);
      });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    setContextLoading(true);
    setContextReady(false);

    getLicenseDashboardContext(userId, userInfo)
      .then((context) => {
        if (cancelled) {
          return;
        }

        if (!context.defaultDepartment) {
          setDepartments(context.departments);
          setRoleVariantsByDepartment(context.roleVariantsByDepartment || {});
          setRoleOptionsByDepartment(context.roleOptionsByDepartment || {});
          setData(null);
          setContextReady(false);
          return;
        }

        const restoredDepartment = dashboardReturnStateRef.current?.department;
        const nextDepartment =
          restoredDepartment &&
          context.departments.some((item) => item.key === restoredDepartment)
            ? restoredDepartment
            : context.defaultDepartment;
        const restoredRoleVariant =
          dashboardReturnStateRef.current?.roleVariant;
        const availableRoles =
          context.roleOptionsByDepartment?.[nextDepartment] || [];
        const nextRoleVariant =
          restoredRoleVariant && availableRoles.includes(restoredRoleVariant)
            ? restoredRoleVariant
            : context.roleVariantsByDepartment?.[nextDepartment] ||
              context.roleVariant;

        setDepartments(context.departments);
        setDepartment(nextDepartment);
        setRoleVariantsByDepartment(context.roleVariantsByDepartment || {});
        setRoleOptionsByDepartment(context.roleOptionsByDepartment || {});
        setRoleVariant(nextRoleVariant);
        setContextReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          CustomMessage.error(t("adminDashboard.feedback.operationFailed"));
          setDepartments([]);
          setRoleVariantsByDepartment({});
          setRoleOptionsByDepartment({});
          setData(null);
          setContextReady(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setContextLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t, userId, userInfo]);

  useEffect(() => {
    if (!contextReady) {
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();

    dataAbortControllerRef.current?.abort();
    taskTabAbortControllerRef.current?.abort();
    attentionAbortControllerRef.current?.abort();
    dataAbortControllerRef.current = controller;
    taskTabAbortControllerRef.current = null;
    attentionAbortControllerRef.current = null;
    setDataLoading(true);
    taskTabRequestSignatureRef.current = {};
    attentionRequestSignatureRef.current = {};
    taskTabPendingSignatureRef.current = {};
    attentionPendingSignatureRef.current = {};
    setTaskTabLoadingByKey({});
    setAttentionTableLoadingByKey({});

    getDashboardData({
      department,
      roleVariant,
      timeFilter,
      signal: controller.signal,
    })
      .then((nextData) => {
        if (!cancelled) {
          const normalizedData = limitDashboardLeaveRows(nextData);
          const firstTaskTabKey = nextData.taskTabs[0]?.key;
          const attentionRestore = pendingAttentionRestoreRef.current;
          const restoredAttentionTab = attentionRestore
            ? normalizedData.attentionTable.tabs.find(
                (tab) => tab.key === attentionRestore.tabKey,
              )
            : undefined;
          const nextAttentionTabKey =
            restoredAttentionTab?.key ||
            normalizedData.attentionTable.tabs[0]?.key ||
            "";

          if (firstTaskTabKey) {
            taskTabRequestSignatureRef.current = {
              ...taskTabRequestSignatureRef.current,
              [firstTaskTabKey]: buildRequestSignature({
                department: nextData.department,
                roleVariant: nextData.roleVariant,
                tabKey: firstTaskTabKey,
                timeFilter,
              }),
            };
          }

          setData(normalizedData);
          setAttentionActiveTabKey(nextAttentionTabKey);
          setRoleVariant(normalizedData.roleVariant);
          setRoleVariantsByDepartment((previous) => ({
            ...previous,
            [normalizedData.department]: normalizedData.roleVariant,
          }));

          if (attentionRestore && !restoredAttentionTab) {
            pendingAttentionRestoreRef.current = null;
            restorePageScrollAfterRender();
          }
        }
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return;
        }

        if (!cancelled) {
          CustomMessage.error(t("adminDashboard.feedback.operationFailed"));
          setData(null);
        }
      })
      .finally(() => {
        if (dataAbortControllerRef.current === controller) {
          dataAbortControllerRef.current = null;
        }

        if (!cancelled) {
          setDataLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
      taskTabAbortControllerRef.current?.abort();
      attentionAbortControllerRef.current?.abort();
      taskTabRequestSignatureRef.current = {};
      attentionRequestSignatureRef.current = {};
      taskTabPendingSignatureRef.current = {};
      attentionPendingSignatureRef.current = {};
    };
  }, [
    contextReady,
    department,
    restorePageScrollAfterRender,
    roleVariant,
    t,
    timeFilter,
  ]);

  useEffect(() => {
    // Dashboard view changes should reset the shared Layout SimpleBar without querying its DOM.
    requestPageContentScrollToTop();
  }, [dashboardViewSignature]);

  const handleTaskTabChange = useCallback(
    (tabKey: string) => {
      if (!data) {
        return;
      }

      const requestSignature = buildRequestSignature({
        department: data.department,
        roleVariant: data.roleVariant,
        tabKey,
        timeFilter,
      });

      if (taskTabPendingSignatureRef.current[tabKey] === requestSignature) {
        return;
      }

      taskTabRequestSignatureRef.current = {
        ...taskTabRequestSignatureRef.current,
        [tabKey]: requestSignature,
      };
      taskTabPendingSignatureRef.current = {
        ...taskTabPendingSignatureRef.current,
        [tabKey]: requestSignature,
      };
      setTaskTabLoadingByKey((previous) => ({
        ...previous,
        [tabKey]: true,
      }));
      taskTabAbortControllerRef.current?.abort();
      const controller = new AbortController();

      taskTabAbortControllerRef.current = controller;
      getDashboardTaskCards({
        department: data.department,
        roleVariant: data.roleVariant,
        tabKey,
        timeFilter,
        signal: controller.signal,
      })
        .then((result) => {
          if (
            controller.signal.aborted ||
            taskTabRequestSignatureRef.current[tabKey] !== requestSignature ||
            result.tabKey !== tabKey
          ) {
            return;
          }

          setData((previous) => {
            if (
              !previous ||
              previous.department !== data.department ||
              previous.roleVariant !== data.roleVariant
            ) {
              return previous;
            }

            return {
              ...previous,
              taskTabs: previous.taskTabs.map((tab) =>
                tab.key === tabKey
                  ? {
                      ...tab,
                      count: result.count,
                      cards: result.cards,
                    }
                  : tab
              ),
            };
          });
        })
        .catch((error) => {
          if (isAbortError(error)) {
            return;
          }

          CustomMessage.error(t("adminDashboard.feedback.operationFailed"));
        })
        .finally(() => {
          if (taskTabAbortControllerRef.current === controller) {
            taskTabAbortControllerRef.current = null;
          }

          if (controller.signal.aborted) {
            return;
          }

          if (taskTabPendingSignatureRef.current[tabKey] === requestSignature) {
            const nextPending = { ...taskTabPendingSignatureRef.current };

            delete nextPending[tabKey];
            taskTabPendingSignatureRef.current = nextPending;
          }

          if (taskTabRequestSignatureRef.current[tabKey] === requestSignature) {
            setTaskTabLoadingByKey((previous) => ({
              ...previous,
              [tabKey]: false,
            }));
          }
        });
    },
    [data, t, timeFilter]
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    const firstTabKey = data.taskTabs[0]?.key;

    if (!firstTabKey) {
      return;
    }

    const requestSignature = buildRequestSignature({
      department: data.department,
      roleVariant: data.roleVariant,
      tabKey: firstTabKey,
      timeFilter,
    });

    if (taskTabRequestSignatureRef.current[firstTabKey] === requestSignature) {
      return;
    }

    handleTaskTabChange(firstTabKey);
  }, [data, handleTaskTabChange, timeFilter]);

  const loadAttentionTab = useCallback(
    (
      tabKey: string,
      pageIndex = 1,
      pageSize = 10,
      sortBy?: string,
      sortDirection?: DashboardTableSortDirection
    ) => {
      if (!data) {
        return;
      }

      const requestSignature = buildRequestSignature({
        department: data.department,
        roleVariant: data.roleVariant,
        tabKey,
        pageIndex,
        pageSize,
        sortBy,
        sortDirection,
        timeFilter,
      });

      if (attentionPendingSignatureRef.current[tabKey] === requestSignature) {
        return;
      }

      attentionRequestSignatureRef.current = {
        ...attentionRequestSignatureRef.current,
        [tabKey]: requestSignature,
      };
      attentionPendingSignatureRef.current = {
        ...attentionPendingSignatureRef.current,
        [tabKey]: requestSignature,
      };
      setAttentionTableLoadingByKey((previous) => ({
        ...previous,
        [tabKey]: true,
      }));
      attentionAbortControllerRef.current?.abort();
      const controller = new AbortController();

      attentionAbortControllerRef.current = controller;
      getDashboardAttentionTab({
        department: data.department,
        roleVariant: data.roleVariant,
        tabKey,
        pageIndex,
        pageSize,
        sortBy,
        sortDirection,
        timeFilter,
        signal: controller.signal,
      })
        .then((result) => {
          if (
            controller.signal.aborted ||
            attentionRequestSignatureRef.current[tabKey] !== requestSignature ||
            result.tab.key !== tabKey
          ) {
            return;
          }

          setData((previous) => {
            if (
              !previous ||
              previous.department !== data.department ||
              previous.roleVariant !== data.roleVariant
            ) {
              return previous;
            }

            return {
              ...previous,
              attentionTable: {
                ...previous.attentionTable,
                tabs: previous.attentionTable.tabs.map((tab) =>
                  tab.key === tabKey
                    ? {
                        ...tab,
                        ...result.tab,
                        labelText: result.tab.labelText || tab.labelText,
                      }
                    : tab
                ),
              },
            };
          });

          if (
            dashboardReturnStateRef.current?.attention.tabKey === tabKey &&
            pendingScrollRestoreRef.current !== null
          ) {
            restorePageScrollAfterRender();
          }
        })
        .catch((error) => {
          if (
            dashboardReturnStateRef.current?.attention.tabKey === tabKey &&
            pendingScrollRestoreRef.current !== null
          ) {
            pendingScrollRestoreRef.current = null;
          }

          if (isAbortError(error)) {
            return;
          }

          CustomMessage.error(t("adminDashboard.feedback.operationFailed"));
        })
        .finally(() => {
          if (attentionAbortControllerRef.current === controller) {
            attentionAbortControllerRef.current = null;
          }

          if (controller.signal.aborted) {
            return;
          }

          if (attentionPendingSignatureRef.current[tabKey] === requestSignature) {
            const nextPending = { ...attentionPendingSignatureRef.current };

            delete nextPending[tabKey];
            attentionPendingSignatureRef.current = nextPending;
          }

          if (attentionRequestSignatureRef.current[tabKey] === requestSignature) {
            setAttentionTableLoadingByKey((previous) => ({
              ...previous,
              [tabKey]: false,
            }));
          }
        });
    },
    [data, restorePageScrollAfterRender, t, timeFilter]
  );

  useEffect(() => {
    const attentionRestore = pendingAttentionRestoreRef.current;

    if (
      !data ||
      !attentionRestore ||
      !data.attentionTable.tabs.some(
        (tab) => tab.key === attentionRestore.tabKey,
      )
    ) {
      return;
    }

    pendingAttentionRestoreRef.current = null;
    setAttentionActiveTabKey(attentionRestore.tabKey);
    const attentionTab = data.attentionTable.tabs.find(
      (tab) => tab.key === attentionRestore.tabKey,
    );
    const restoredPageIndex = normalizeDashboardAttentionPageIndex(
      attentionRestore.pageIndex,
      attentionRestore.pageSize,
      attentionTab?.totalCount ?? attentionTab?.count ?? 0,
    );
    loadAttentionTab(
      attentionRestore.tabKey,
      restoredPageIndex,
      attentionRestore.pageSize,
      attentionRestore.sortBy,
      attentionRestore.sortDirection,
    );
  }, [data, loadAttentionTab]);

  const handleAttentionTabChange = useCallback(
    (tabKey: string) => {
      setAttentionActiveTabKey(tabKey);
      const pageSize =
        data?.attentionTable.tabs.find((tab) => tab.key === tabKey)?.pageSize ||
        10;

      loadAttentionTab(tabKey, 1, pageSize);
    },
    [data, loadAttentionTab]
  );

  const valueLabel = useMemo(
    () => formatTimeFilterLabel(timePreset, timeFilter, t),
    [t, timeFilter, timePreset]
  );

  const handlePresetSelect = useCallback(
    (preset: Exclude<DashboardTimePreset, "custom">) => {
      const nextFilter = {
        preset,
        days: DASHBOARD_TIME_PRESET_DAYS[preset],
      };

      setTimePreset(preset);
      setTimeFilter(nextFilter);
      setDraftRange(null);
      setTimeFilterVisible(false);
    },
    []
  );

  const handleApplyCustomRange = useCallback(() => {
    if (!draftRange?.[0] || !draftRange?.[1]) {
      return;
    }

    setTimePreset("custom");
    setTimeFilter({
      preset: "custom",
      startDate: draftRange[0].format("YYYY-MM-DD"),
      endDate: draftRange[1].format("YYYY-MM-DD"),
    });
    setTimeFilterVisible(false);
  }, [draftRange]);

  const handleCancelCustomRange = useCallback(() => {
    setDraftRange(createDraftRangeFromFilter(timeFilter));
    setTimeFilterVisible(false);
  }, [timeFilter]);

  const handleTimeFilterVisibleChange = useCallback(
    (visible: boolean) => {
      if (!visible) {
        setDraftRange(createDraftRangeFromFilter(timeFilter));
      }
      setTimeFilterVisible(visible);
    },
    [timeFilter]
  );

  return (
    <>
      {hasTitleActions ? (
        <PageHeadingPortal targetId={PAGE_TITLE_EXTRA_PORTAL_ID}>
          <div className="dashboard__title-actions">
            {headerVisibility.showDepartmentSelector ? (
              <DepartmentSelector
                visible={departmentSelectorVisible}
                departments={departments}
                value={department}
                onVisibleChange={setDepartmentSelectorVisible}
                onChange={(nextDepartment) => {
                  const nextRoleOptions =
                    roleOptionsByDepartment[nextDepartment] || [];

                  setDepartment(nextDepartment);
                  setRoleVariant(
                    roleVariantsByDepartment[nextDepartment] ||
                      nextRoleOptions[0] ||
                      DEFAULT_ROLE_VARIANT
                  );
                  setRoleSelectorVisible(false);
                }}
              />
            ) : null}
            {showRoleSelector ? (
              <RoleSelector
                visible={roleSelectorVisible}
                roles={roleOptions}
                value={roleVariant}
                onVisibleChange={setRoleSelectorVisible}
                onChange={(nextRoleVariant) => {
                  setRoleVariant(nextRoleVariant);
                  setRoleVariantsByDepartment((previous) => ({
                    ...previous,
                    [department]: nextRoleVariant,
                  }));
                }}
              />
            ) : null}
          </div>
        </PageHeadingPortal>
      ) : null}

      <PageHeadingPortal>
        <div className="dashboard__heading-actions"
          data-reader-filter-name="timeFilter"
          data-reader-filter-value={JSON.stringify(timeFilter)}>
          <DashboardTimeFilter
            visible={timeFilterVisible}
            preset={timePreset}
            valueLabel={valueLabel}
            draftRange={draftRange}
            onVisibleChange={handleTimeFilterVisibleChange}
            onPresetSelect={handlePresetSelect}
            onDraftRangeChange={setDraftRange}
            onApplyCustomRange={handleApplyCustomRange}
            onCancelCustomRange={handleCancelCustomRange}
          />
        </div>
      </PageHeadingPortal>

      <div className={`dashboard__page dashboard__page--${department}`}
        data-reader-filter-name="department"
        data-reader-filter-value={department}>
        <Spin spinning={pageLoading}>
          <div className="dashboard__content"
            data-reader-filter-name="roleVariant"
            data-reader-filter-value={roleVariant}>
            {data ? (
              data.layout === "license" ? (
                <LicenseDashboardLayout
                  data={{
                    ...(data as DashboardLicenseWorkloadData),
                    summaryCards: (
                      data as DashboardLicenseWorkloadData
                    ).summaryCards.map((card) =>
                      isLicensingOfficerOnly &&
                      card.key === "license-distribution"
                        ? {
                            ...card,
                            targetPath: "/licensing/licenses",
                            permissionPath: "/licensing/licenses",
                          }
                        : card,
                    ),
                  }}
                  resetKey={dashboardViewSignature}
                  attentionActiveTabKey={attentionActiveTabKey}
                  dashboardReturnContext={dashboardReturnContext}
                  taskTabLoadingByKey={taskTabLoadingByKey}
                  attentionTableLoadingByKey={attentionTableLoadingByKey}
                  onTaskTabChange={handleTaskTabChange}
                  onAttentionTabChange={handleAttentionTabChange}
                  onAttentionPageChange={loadAttentionTab}
                />
              ) : data.layout === "content" ? (
                <ContentDashboardLayout
                  data={data as DashboardContentWorkloadData}
                  resetKey={dashboardViewSignature}
                  attentionActiveTabKey={attentionActiveTabKey}
                  dashboardReturnContext={dashboardReturnContext}
                  taskTabLoadingByKey={taskTabLoadingByKey}
                  attentionTableLoadingByKey={attentionTableLoadingByKey}
                  onTaskTabChange={handleTaskTabChange}
                  onAttentionTabChange={handleAttentionTabChange}
                  onAttentionPageChange={loadAttentionTab}
                />
              ) : (
                <WorkloadDashboard
                  data={{
                    ...(data as DashboardWorkloadData),
                    taskTabs: (data as DashboardWorkloadData).taskTabs.map(
                      (tab) => {
                        const inspectorTargetPath =
                          INSPECTOR_TASK_TAB_ROUTES[
                            tab.key.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
                          ];
                        return isInspectorOnly && inspectorTargetPath
                          ? {
                              ...tab,
                              actionPath: inspectorTargetPath,
                              actionPermissionPath: inspectorTargetPath,
                            }
                          : tab;
                      },
                    ),
                  }}
                  resetKey={dashboardViewSignature}
                  attentionActiveTabKey={attentionActiveTabKey}
                  dashboardReturnContext={dashboardReturnContext}
                  taskTabLoadingByKey={taskTabLoadingByKey}
                  attentionTableLoadingByKey={attentionTableLoadingByKey}
                  onTaskTabChange={handleTaskTabChange}
                  onAttentionTabChange={handleAttentionTabChange}
                  onAttentionPageChange={loadAttentionTab}
                />
              )
            ) : pageLoading ? (
              <div className="dashboard__page-empty" aria-hidden="true" />
            ) : (
              <DashboardEmptyState className="dashboard__page-empty" />
            )}
          </div>
        </Spin>
      </div>
    </>
  );
}
