import React, {
  useState,
  useEffect,
  useCallback,
  useReducer,
  useMemo,
  useRef,
} from "react";
import Sousuo from "@/assets/icons/Sousuo";
import {
  Card,
  Input,
  Select,
  Tabs,
  DatePicker,
  Modal,
  Tooltip,
} from "antd";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CustomButton, CustomMessage, PaginationTotal } from "@/components/common";
import AdaptiveActionGroup, {
  type AdaptiveActionItem,
} from "@/components/common/AdaptiveActionGroup";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import { FilterTable, useFilter } from "@/components/common/FilterTable";
import { useButtonPermission } from "@/routes/access";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import {
  applicationMyTodoPage,
  applicationMyComplatedPage,
  extraTaskApprovalAction,
  getServiceConfigServiceType,
  applicationUrgentCount,
  exportMyTodoReview,
  exportMyCompletedReview,
  submitRecallApproval,
} from "@/services/application";
import {
  FahrReviewOperationError,
  getFahrExternalApprovalEligibility,
  getFahrExternalReviewReadiness,
  submitFahrExternalReviewDecision,
} from "@/services/fahr";
import {
  getFahrRejectReasonFile,
  getFahrExternalDecisionDisabledReason,
  resolveFahrExternalApprovalRoute,
  resolveFahrExternalDecisionRoute,
  shouldLoadFahrApplicationStatus,
} from "@/services/fahrPolicy";
import type { TodoPageQueryParams } from "@/services/application";
import RecallApprovalModal from "@/pages/ApplicationsDetails/components/RecallApprovalModal";
import {
  createIdempotencyKey,
  getRecallBackendMessage,
} from "@/pages/ApplicationsDetails/hooks/useRecallApproval";
import enterprise from "@/assets/images/enterprise.svg";
import UserIcon from "@/assets/images/userIcon.svg";
import { MoreOutlined } from "@ant-design/icons";
import moment from "moment";
import { useAppStore, type IApplicationInfo } from "@/store/app-store";
import { exportCSVFile } from "@/utils/utils";
import { isIndividualUserTypeCode } from "@/utils/userTypeCode";
import "./index.less";
import {
  reducer,
  INIT_STATE,
  type IApplicationContext,
  type IStatus,
} from "./type";
import { RejectModal } from "./components/RejectModal";
import type {
  IFieldType as RejectFieldValues,
  IRejectModalRef,
} from "./components/RejectModal/type";
import type { IRequestModalRef } from "./components/RequestModal/type";
import { RequestModal } from "./components/RequestModal";
import type { ISendBackModalRef } from "@/pages/ContentApplications/components/SendBackModal/type";
import { SendBackModal } from "@/pages/ContentApplications/components/SendBackModal";
import { ExternalApprovalModal } from "@/pages/ContentApplications/components/ExternalApprovalModal";
import type {
  IExternalApprovalProps,
  IExternalApprovalRef,
} from "@/pages/ContentApplications/components/ExternalApprovalModal/type";
import {
  transformSorterKeys,
  transformSpaceString,
  transformDate,
} from "@/utils/transform";
import { Sorter, SorterKeys } from "../Profile/type";
import type {
  ColumnType,
  SorterResult,
  TablePaginationConfig,
} from "antd/lib/table/interface";
import type { TableProps } from "antd/lib/table";
import { ApproveModal } from "./components/ApproveModal";
import type {
  IApproveModalRef,
  IFieldType as ApproveFieldValues,
} from "./components/ApproveModal/type";
import { DispositionDecisionModal } from "./components/DispositionDecisionModal";
import type { IDispositionDecisionModalRef } from "./components/DispositionDecisionModal/type";
import { MediaMaterialReportModal } from "./components/MediaMaterialReportModal";
import type { IMediaMaterialReportModalRef } from "./components/MediaMaterialReportModal/type";
import {
  resolveApplicationWorkflowAction,
  type WorkflowActionIntent,
  type WorkflowActionRoute,
} from "./utils/workflowActionRouting";
import { DEFAULT_PAGE_INFO, usePagination } from "@/hooks/usePagination";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import { useServicesStore } from "@/store/services";
import { isFahrExternalApprovalService } from "@/pages/ApplicationsDetails/fahrServiceCodes";

import {
  DEFAULT_STATUS,
  TasksPanel,
} from "@/components/BusinessCmps/TasksPanel";
import type { ITaskStatus } from "@/components/BusinessCmps/TasksPanel/type";
import applicationNoProfileStar from "@/assets/images/application-no-star.png";
import {
  disableLicensingApplicationActionStatusIds,
  INITIAL_APPROVAL_STATUS_ID,
} from "./constants";
import WarningGold from "@/assets/icons/WarningGold";

const { RangePicker } = DatePicker;

// eslint-disable-next-line react-refresh/only-export-components
export const ApplicationContext =
  React.createContext<IApplicationContext | null>(null);

const APPLICATION_WORKFLOW_CONFIRM_PERMISSION_BY_ROUTE: Record<
  WorkflowActionRoute,
  string
> = {
  approveApplicationModal: "Licensing.Applications.Confirm",
  rejectApplicationModal: "Licensing.Applications.ConfirmRejectModal",
  mediaMaterialReportModal:
    "Licensing.Applications.ConfirmMediaMaterialReportModal",
  dispositionApproveModal:
    "Licensing.Applications.ConfirmDispositionDecisionModal",
  dispositionRejectModal:
    "Licensing.Applications.ConfirmDispositionDecisionModal",
};

const getApplicationWorkflowConfirmPermission = (
  record: IApplicationInfo,
  intent: WorkflowActionIntent,
) =>
  APPLICATION_WORKFLOW_CONFIRM_PERMISSION_BY_ROUTE[
    resolveApplicationWorkflowAction(record, intent).route
  ];

interface ApplicationWorkflowButtonStatus {
  approve?: unknown;
  reject?: unknown;
  requestModification?: unknown;
  sendBack?: unknown;
  externalApproval?: unknown;
}

type ApplicationActionColumnKey =
  | "approve"
  | "extraApprove"
  | "reject"
  | "extraReject"
  | "more";

const APPLICATION_ACTION_COLUMN_BASE_WIDTH = 160;
const APPLICATION_TABLE_SCROLL_X = 1600;
const TODO_ACTION_COLUMN_KEY = "todoAction";
const COMPLETED_ACTION_COLUMN_KEY = "recallAction";
const APPLICATION_ACTION_COMPACT_BREAKPOINT = 1440;

const APPLICATION_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<ApplicationActionColumnKey> = {
  more: {
    default: 32,
    compact: 32,
  },
};

const APPLICATION_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 140,
  maxWidth: 340,
};

const APPLICATION_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 128,
  maxWidth: 324,
};

const APPLICATION_ACTION_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};

const safeParseApplicationButtonStatus = (
  buttonJson?: string | null,
): ApplicationWorkflowButtonStatus => {
  if (!buttonJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(buttonJson);
    return parsed && typeof parsed === "object"
      ? (parsed as ApplicationWorkflowButtonStatus)
      : {};
  } catch {
    return {};
  }
};

const Applications: React.FC = () => {
  const updateServicesCode = useServicesStore(
    (state) => state.updateServicesCode,
  );
  const { t } = useTranslation();
  const history = useHistory();
  const setApplicationsDetails = useAppStore(
    (state) => state.setApplicationsDetails,
  );
  const [activeTab, setActiveTab] = useState("1");
  const [selectStatus] = useState<string | undefined>("");
  const [selectResults] = useState<string[]>([]);
  const [results, setResults] = useState<IStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [status, setStatus] = useState<IStatus[]>([]);
  const [submissionTime] = useState<Record<string, string | null>>({
    startTime: null,
    endTime: null,
  });
  const [applicationList, setApplicationList] = useState<IApplicationInfo[]>(
    [],
  );
  const [todoPage] = useState<
    Pick<TodoPageQueryParams, "keyword" | "startTime" | "endTime">
  >({
    keyword: "",
    startTime: null,
    endTime: null,
  });
  const [pageInfo, setPage] = usePagination();
  const latestRequestIdRef = useRef(0);
  const getPageListRef = useRef<() => void>(() => undefined);
  const lastSorterRef = useRef<
    Pick<TodoPageQueryParams, "sortBy" | "sortDirection">
  >({
    sortBy: "LastUpdatedTime",
    sortDirection: Sorter["descend" as typeof SorterKeys.ascend],
  });
  const lastPageRef = useRef({ pageIndex: 1, pageSize: 10 });
  const [todoStats, setTodoStats] = useState<ITaskStatus>(DEFAULT_STATUS);
  const [applicationContext, dispatch] = useReducer(reducer, INIT_STATE);
  const rejectModalRef = useRef<IRejectModalRef>(null);
  const requestModalRef = useRef<IRequestModalRef>(null);
  const approveModalRef = useRef<IApproveModalRef>(null);
  const dispositionDecisionModalRef =
    useRef<IDispositionDecisionModalRef>(null);
  const mediaMaterialReportModalRef =
    useRef<IMediaMaterialReportModalRef>(null);
  const sendBackModalRef = useRef<ISendBackModalRef>(null);
  const externalApprovalModalRef = useRef<IExternalApprovalRef>(null);
  const pendingFahrActionKeysRef = useRef(new Set<string>());
  const [pendingFahrActionKeys, setPendingFahrActionKeys] = useState<
    ReadonlySet<string>
  >(new Set());
  const fahrActionRequestVersionRef = useRef(0);
  const [currentTask, setCurrentTask] = useState<IApplicationInfo>(
    {} as IApplicationInfo,
  );

  const [recallTask, setRecallTask] = useState<IApplicationInfo | null>(null);
  const [recallModalVisible, setRecallModalVisible] = useState(false);
  const [recallSubmitting, setRecallSubmitting] = useState(false);

  const [fahrDecisionApplicationId, setFahrDecisionApplicationId] = useState<
    number | undefined
  >();

  const [types, setTypes] = useState<IStatus[]>([]);
  const [filterStore] = useFilter();
  const { canRenderButton } = useButtonPermission("/licensing/applications");
  const { canRenderButton: canRenderDetailButton } = useButtonPermission(
    "/licensing/applications/applicationsDetails",
  );
  const setFahrActionPending = useCallback(
    (actionKey: string, pending: boolean) => {
      setPendingFahrActionKeys((currentKeys) => {
        const nextKeys = new Set(currentKeys);
        if (pending) {
          nextKeys.add(actionKey);
        } else {
          nextKeys.delete(actionKey);
        }
        return nextKeys;
      });
    },
    [],
  );

  const showTaskModal = useCallback(
    (record: IApplicationInfo, open: () => void) => {
      setCurrentTask(record);
      window.setTimeout(open, 0);
    },
    [],
  );

  const handleWorkflowAction = useCallback(
    (record: IApplicationInfo, intent: WorkflowActionIntent) => {
      const resolved = resolveApplicationWorkflowAction(record, intent);
      showTaskModal(record, () => {
        switch (resolved.route) {
          case "mediaMaterialReportModal":
            mediaMaterialReportModalRef.current?.show(intent);
            break;
          case "dispositionApproveModal":
            dispositionDecisionModalRef.current?.show("approve");
            break;
          case "dispositionRejectModal":
            dispositionDecisionModalRef.current?.show("reject");
            break;
          case "approveApplicationModal":
            approveModalRef.current?.show();
            break;
          case "rejectApplicationModal":
          default:
            rejectModalRef.current?.show();
            break;
        }
      });
    },
    [showTaskModal],
  );

  const getApplicationActionState = useCallback(
    (record: IApplicationInfo) => {
      const isExtraApprove = record.statusId === 11;
      const isDisable = disableLicensingApplicationActionStatusIds.includes(
        Number(record.statusId),
      );
      const btnStatus = safeParseApplicationButtonStatus(record?.buttonJson);
      const canApprove =
        Boolean(btnStatus?.approve) &&
        canRenderButton(
          getApplicationWorkflowConfirmPermission(record, "approve"),
        );
      const canReject =
        Boolean(btnStatus?.reject) &&
        canRenderButton(
          getApplicationWorkflowConfirmPermission(record, "reject"),
        );
      const canRequestModification =
        (Boolean(btnStatus?.requestModification) ||
          Number(record.statusId) === INITIAL_APPROVAL_STATUS_ID) &&
        canRenderDetailButton(
          PERMISSION_CODES.licensing.applications.requestModification,
        );
      const canSendBack =
        Boolean(btnStatus?.sendBack) &&
        !isExtraApprove &&
        canRenderDetailButton(
          PERMISSION_CODES.licensing.applications.sendBack,
        );

      const canExternalApproval =
        Boolean(btnStatus?.externalApproval) &&
        record.requiresFahrApproval !== true &&
        !isExtraApprove &&
        canRenderDetailButton(
          PERMISSION_CODES.licensing.applications.externalApproval,
        );
      return {
        isExtraApprove,
        isDisable,
        canApprove,
        canReject,
        canRequestModification,
        canSendBack,
        canExternalApproval,
      };
    },
    [canRenderButton, canRenderDetailButton],
  );

  const openRecallModal = useCallback((record: IApplicationInfo) => {
    if (recallSubmitting) return;
    setRecallTask(record);
    setRecallModalVisible(true);
  }, [recallSubmitting]);

  const closeRecallModal = useCallback(() => {
    if (recallSubmitting) return;
    setRecallModalVisible(false);
    setRecallTask(null);
  }, [recallSubmitting]);

  const handleRecallConfirm = useCallback(
    async (reason: string) => {
      const normalizedReason = reason.trim();
      const applicationId =
        Number.isFinite(Number(recallTask?.id)) && Number(recallTask?.id) > 0
          ? Number(recallTask?.id)
          : undefined;
      if (!applicationId || !normalizedReason || recallSubmitting) {
        return;
      }

      setRecallSubmitting(true);
      try {
        const response = await submitRecallApproval(
          applicationId,
          normalizedReason,
          createIdempotencyKey(),
        );

        if (!response.isSuccess) {
          const backendMessage = response.message?.trim();
          if (backendMessage) {
            CustomMessage.error(backendMessage);
          }
          return;
        }

        setRecallModalVisible(false);
        setRecallTask(null);
        getPageList(lastSorterRef.current, lastPageRef.current);
      } catch (error) {
        console.error("Failed to submit recall approval:", error);
        const backendMessage = getRecallBackendMessage(error);
        if (backendMessage) {
          CustomMessage.error(backendMessage);
        }
      } finally {
        setRecallSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recallTask, recallSubmitting],
  )

  const handleExternalApprovalClick = useCallback(
    async (record: IApplicationInfo) => {
      const actionKey = `${record.id}:${record.taskId}:externalApproval`;
      if (pendingFahrActionKeysRef.current.has(actionKey)) return;
      pendingFahrActionKeysRef.current.add(actionKey);
      const requestVersion = ++fahrActionRequestVersionRef.current;
      try {
        const isFahrService = isFahrExternalApprovalService(record.serviceCode);
        if (!isFahrService) {
          showTaskModal(record, () => externalApprovalModalRef.current?.show());
          return;
        }
        const response = await getFahrExternalApprovalEligibility(record.id);
        if (requestVersion !== fahrActionRequestVersionRef.current) return;
        const eligibility = response.data;
        const route = resolveFahrExternalApprovalRoute(true, eligibility);
        if (route === "legacyDialog" || route === "fahrDialog") {
          showTaskModal(record, () =>
            externalApprovalModalRef.current?.show(),
          );
          return;
        }
        if (route === "direct") {
          await new Promise<void>((resolve) => {
            Modal.confirm({
              title: t("Licensing.fahrReview.confirm.applyTitle"),
              content: t("Licensing.fahrReview.confirm.applyContent"),
              icon: (
                <WarningGold className="fahr-external-approval-confirm__icon" />
              ),
              okText: t("common.confirm"),
              cancelText: t("common.cancel"),
              width: 600,
              centered: true,
              className: "fahr-external-approval-confirm",
              onOk: async () => {
                try {
                  await extraTaskApprovalAction({
                    serviceId: record.serviceId,
                    applicationId: record.id,
                    applicationDetailId: record.applicationDetailId,
                    instanceId: record.processInstanceId,
                    taskId: record.taskId,
                    approvalAction: "ExternalApproval",
                    workflowAction: 300,
                  });
                  getPageListRef.current();
                  CustomMessage.success(
                    t("Licensing.fahrReview.messages.actionSuccess"),
                  );
                  resolve();
                } catch (error) {
                  resolve();
                  console.error(
                    "Failed to submit FAHR external approval:",
                    error,
                  );
                  CustomMessage.error(
                    t("Licensing.fahrReview.messages.externalDecisionFailed"),
                  );
                  throw error;
                }
              },
              onCancel: () => resolve(),
            });
          });
          return;
        }
        CustomMessage.error(
          t("Licensing.fahrReview.messages.externalDecisionFailed"),
        );
      } catch (error) {
        console.error("Failed to load FAHR review readiness:", error);
        CustomMessage.error(
          t("Licensing.fahrReview.messages.externalDecisionFailed"),
        );
      } finally {
        pendingFahrActionKeysRef.current.delete(actionKey);
      }
    },
    [showTaskModal, t],
  );

  const handleApprovalDecisionClick = useCallback(
    async (record: IApplicationInfo, intent: WorkflowActionIntent) => {
      const actionKey = `${record.id}:${record.taskId}:${intent}`;
      if (pendingFahrActionKeysRef.current.has(actionKey)) return;
      pendingFahrActionKeysRef.current.add(actionKey);
      setFahrActionPending(actionKey, true);
      const requestVersion = ++fahrActionRequestVersionRef.current;
      setFahrDecisionApplicationId(undefined);
      try {
        const isFahrDecision =
          record.statusId === 11 &&
          isFahrExternalApprovalService(record.serviceCode);
        if (isFahrDecision) {
          const eligibilityResponse =
            await getFahrExternalApprovalEligibility(record.id);
          if (requestVersion !== fahrActionRequestVersionRef.current) return;
          const eligibility = eligibilityResponse.data;
          if (!shouldLoadFahrApplicationStatus(eligibility)) {
            handleWorkflowAction(record, intent);
            return;
          }
          const response = await getFahrExternalReviewReadiness(record.id);
          if (requestVersion !== fahrActionRequestVersionRef.current) return;
          const route = resolveFahrExternalDecisionRoute(
            eligibility,
            response.data,
            intent,
          );
          if (route !== "external") {
            const disabledReason = getFahrExternalDecisionDisabledReason(
              response.data,
            );
            CustomMessage.error(
              disabledReason ||
                t("Licensing.fahrReview.messages.externalDecisionFailed"),
            );
            return;
          }
          setFahrDecisionApplicationId(record.id);
        }
        handleWorkflowAction(record, intent);
      } catch (error) {
        console.error("Failed to load FAHR review readiness:", error);
        CustomMessage.error(
          t("Licensing.fahrReview.messages.externalDecisionFailed"),
        );
      } finally {
        pendingFahrActionKeysRef.current.delete(actionKey);
        setFahrActionPending(actionKey, false);
      }
    },
    [handleWorkflowAction, setFahrActionPending, t],
  );

  const submitFahrDecision = useCallback(
    async (
      decision: "Approved" | "Rejected",
      payload: Omit<
        Parameters<typeof submitFahrExternalReviewDecision>[1],
        "decision"
      >,
    ) => {
      if (
        !isFahrExternalApprovalService(currentTask.serviceCode) ||
        fahrDecisionApplicationId !== currentTask.id
      ) {
        throw new FahrReviewOperationError();
      }
      const response = await submitFahrExternalReviewDecision(currentTask.id, {
        decision,
        ...payload,
      });
      if (response.data?.success !== true) {
        throw new FahrReviewOperationError();
      }
      CustomMessage.success(
        t("Licensing.fahrReview.messages.externalDecisionSuccess"),
      );
    },
    [currentTask, fahrDecisionApplicationId, t],
  );

  const handleFahrExternalApprove = useCallback(
    (values: ApproveFieldValues) =>
      submitFahrDecision("Approved", { reason: values.notes }),
    [submitFahrDecision],
  );

  const handleFahrExternalReject = useCallback(
    (values: RejectFieldValues) =>
      submitFahrDecision("Rejected", {
        reason: values.approvalComment,
        rejectReasonCode: values.rejectReason,
        rejectReasonFile: getFahrRejectReasonFile(values.rejectReasonFile),
        hideFromCustomer: Boolean(values.hideFromCustomer),
      }),
    [submitFahrDecision],
  );

  const getApplicationVisibleActions = useCallback(
    (record: IApplicationInfo): ApplicationActionColumnKey[] => {
      const actionState = getApplicationActionState(record);

      if (actionState.isDisable) {
        return [];
      }

      const actions: ApplicationActionColumnKey[] = [];

      if (actionState.canApprove) {
        actions.push(
          actionState.isExtraApprove ? "extraApprove" : "approve",
        );
      }

      if (actionState.canReject) {
        actions.push(actionState.isExtraApprove ? "extraReject" : "reject");
      }

      if (
        actionState.canRequestModification ||
        actionState.canSendBack ||
        actionState.canExternalApproval
      ) {
        actions.push("more");
      }

      return actions;
    },
    [getApplicationActionState],
  );

  const getApplicationActionLabel = useCallback(
    (actionKey: ApplicationActionColumnKey) => {
      const actionLabelMap: Partial<Record<ApplicationActionColumnKey, string>> =
        {
          approve: t("applications.buttons.approve"),
          extraApprove: t("applications.buttons.extraapprove"),
          reject: t("applications.buttons.reject"),
          extraReject: t("applications.buttons.extrareject"),
        };

      return actionLabelMap[actionKey];
    },
    [t],
  );

  const actionColumnWidth = useResponsiveActionColumnWidth<
    IApplicationInfo,
    ApplicationActionColumnKey
  >(
    {
      rows: applicationList,
      buttonWidthMap: APPLICATION_ACTION_BUTTON_WIDTH_MAP,
      getVisibleActions: getApplicationVisibleActions,
      getActionLabel: getApplicationActionLabel,
      desktopConfig: APPLICATION_ACTION_COLUMN_DESKTOP_CONFIG,
      compactConfig: APPLICATION_ACTION_COLUMN_COMPACT_CONFIG,
      textMeasureConfig: APPLICATION_ACTION_TEXT_MEASURE_CONFIG,
      compactBreakpoint: APPLICATION_ACTION_COMPACT_BREAKPOINT,
    },
  );

  const getPageList = useCallback(
    (
      sorter: Pick<TodoPageQueryParams, "sortBy" | "sortDirection"> = {
        sortBy: "LastUpdatedTime",
        sortDirection: Sorter["descend" as typeof SorterKeys.ascend],
      },
      page = {
        pageIndex: 1,
        pageSize: 10,
      },
    ) => {
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      lastSorterRef.current = sorter;
      lastPageRef.current = page;
      setLoading(true);
      const filterParams = {
        // query params
        ...todoPage,
        // sorter params
        ...sorter,
        serviceTypeId: "1",
        // page params
        ...page,
      };
      if (activeTab == "1") {
        // todoPage
        let todoFilterParams = { ...filterParams };

        // Use filterStore for To Do tab if FilterTable is being used
        const filterValues = filterStore.getFieldsValue();
        const keyword = filterValues.keyword;
        const type = filterValues.type;
        const filterSubmissionTime = filterValues.submissionTime;
        const [startTime, endTime] = transformDate(filterSubmissionTime);

        todoFilterParams = {
          ...filterParams,
          keyword: keyword || todoPage.keyword,
          serviceTypeId: type ?? "1",
          processInstanceStatus: filterValues.status,
          startTime: startTime || todoPage.startTime,
          endTime: endTime || todoPage.endTime,
        };

        applicationMyTodoPage(todoFilterParams)
          .then((res) => {
            if (requestId !== latestRequestIdRef.current) return;
            const { pageIndex, pageSize, total } =
              res?.data?.page || DEFAULT_PAGE_INFO;
            console.log("Todo data received:", res.data.page.items);
            console.log(
              "Todo request params:",
              JSON.stringify(todoFilterParams, null, 2),
            );
            console.log("Todo response:", res.data);
            setApplicationList(res.data.page.items || []);
            setPage({
              total,
              pageIndex,
              pageSize,
            });
            setTodoStats(res.data.statusCount as ITaskStatus);
            const statusList = (res.data.processInstanceStatus || []).map(
              (item: string) => ({
                label: item,
                value: item,
              }),
            );
            setStatus(statusList);
            setLoading(false);
          })
          .finally(() => {
            if (requestId === latestRequestIdRef.current) {
              setLoading(false);
            }
          });
      } else {
        // completedPage
        let completedFilterParams = { ...filterParams };

        // Use filterStore for Completed tab if FilterTable is being used
        if (activeTab === "2") {
          const filterValues = filterStore.getFieldsValue();
          const keyword = filterValues.keyword;
          const type = filterValues.type;
          const filterStatus = filterValues.status;
          const filterResults = filterValues.results;
          const filterSubmissionTime = filterValues.submissionTime;
          const [startTime, endTime] = transformDate(filterSubmissionTime);

          completedFilterParams = {
            ...filterParams,
            keyword: keyword || todoPage.keyword,
            serviceTypeId: type ?? "1",
            processInstanceStatus: filterStatus ?? selectStatus,
            approvalStatus: filterResults || selectResults,
            startTime: startTime || submissionTime.startTime,
            endTime: endTime || submissionTime.endTime,
          };
        } else {
          completedFilterParams = {
            ...filterParams,
            processInstanceStatus: selectStatus,
          };
        }

        applicationMyComplatedPage(completedFilterParams)
          .then((res) => {
            if (requestId !== latestRequestIdRef.current) return;
            const { pageIndex, pageSize, total } =
              res?.data?.page || DEFAULT_PAGE_INFO;
            console.log("Completed data received:", res.data.page.items);
            console.log(
              "Completed request params:",
              JSON.stringify(completedFilterParams, null, 2),
            );
            console.log("Completed response:", res.data);
            setApplicationList(res.data.page.items || []);
            setPage({
              total,
              pageIndex,
              pageSize,
            });
            // Completed My Decision options are data-driven: they come from
            // myDecisionOptions, the decision values the backend reports for the
            // current list, so a decision with no matching rows never shows up.
            // A null/empty entry represents "no decision" and maps to "-".
            const resultlist = (res.data?.myDecisionOptions || [])
            .map((item) =>
            typeof item === "string" && item.trim().length > 0 ? item : "-",
            )
            .filter(
            (item, index, list) => list.indexOf(item) === index,
            )
            .map((item) => ({
            label: item,
            value: item,
            }));
            // Only update results if the values actually changed to avoid unnecessary re-renders
            setResults((prevResults) => {
              const prevValues = prevResults
                .map((r: IStatus) => r.value)
                .sort()
                .join(",");
              const newValues = resultlist
                .map((r: IStatus) => r.value)
                .sort()
                .join(",");
              return prevValues === newValues ? prevResults : resultlist;
            });
            setTodoStats(res.data.statusCount as ITaskStatus);
            const statusList = (res?.data?.processInstanceStatus || [])?.map(
              (item: string) => ({
                label: item,
                value: item,
              }),
            );
            // Only update status if the values actually changed to avoid unnecessary re-renders
            setStatus((prevStatus) => {
              const prevValues = prevStatus
                .map((s: IStatus) => s.value)
                .sort()
                .join(",");
              const newValues = statusList
                .map((s: IStatus) => s.value)
                .sort()
                .join(",");
              return prevValues === newValues ? prevStatus : statusList;
            });
          })
          .finally(() => {
            if (requestId === latestRequestIdRef.current) {
              setLoading(false);
            }
          });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab, selectStatus, submissionTime, selectResults, todoPage],
  );
  getPageListRef.current = getPageList;

  const keepAliveActivated = useKeepAliveActivated({
    onActivated: () => {
      getPageList(lastSorterRef.current, lastPageRef.current);
    },
    onDeactivated: () => {
      latestRequestIdRef.current += 1;
      setLoading(false);
    },
  });
  const ServiceConfigServiceType = useCallback(() => {
    getServiceConfigServiceType().then((res) => {
      setTypes([
        { label: t("applications.selectors.allTypes"), value: "1" },
        ...res.data.map((item) => {
          return { label: item.nameEn, value: item.code };
        }),
      ]);
    });
  }, [t]);

  const getUrgentCount = useCallback(async () => {
    try {
      const res = await applicationUrgentCount();
      dispatch({
        type: "UPDATE_URGENT_COUNT",
        payload: Number(res?.data) || 0,
      });
    } catch {
      dispatch({
        type: "UPDATE_URGENT_COUNT",
        payload: 0,
      });
      CustomMessage.error(t("applications.messages.urgentCountLoadFailed"));
    }
  }, [t]);

  const refreshUrgentCount = useCallback(() => {
    void getUrgentCount();
  }, [getUrgentCount]);

  // An always-rendered star placeholder indents every Application No. by the
  // slot (18px) plus its gap (10px) while the header stays put, so the gutter
  // only exists when some row on the page actually shows a star.
  const hasApplicationNoProfileStar = useMemo(
    () => applicationList.some((record) => record.profileIsVIP),
    [applicationList],
  );

  const todoColumns: ColumnType<IApplicationInfo>[] = useMemo(
    () => [
      {
        title: t("applications.tableColumns.applicationNo"),
        dataIndex: "applicationNumber",
        key: "applicationNumber",
        width: 200,
        align: "left",
        fixed: "left",
        render: (text: string, record: IApplicationInfo) => {
          return (
            <div
              className={`application-no-cell${
                hasApplicationNoProfileStar
                  ? ""
                  : " application-no-cell--without-star"
              }`}
            >
              <span className="application-no-leading">
                {hasApplicationNoProfileStar ? (
                  <span className="application-no-star-slot">
                    {record.profileIsVIP ? (
                      <img
                        src={applicationNoProfileStar}
                        alt=""
                        className="application-no-profile-star"
                      />
                    ) : (
                      <span
                        className="application-no-star-placeholder"
                        aria-hidden
                      />
                    )}
                  </span>
                ) : null}
                <span className="application-no-text">{text}</span>
              </span>
            </div>
          );
        },
        // render: (text: string) => {
        //     return (
        //         <div style={{ display: "flex", alignItems: "center" }}>
        //             <img
        //                 src={StarIcon}
        //                 className="collectIcon"
        //             />
        //             <span>{text}</span>
        //         </div>
        //     );
        // }
      },
      {
        title: t("applications.tableColumns.serviceName"),
        dataIndex: "serviceNameEn",
        width: 200,
        key: "serviceNameEn",
        ellipsis: false,
        render: (text: string) => {
          const display = text?.trim() ? text : "-";
          return (
            <Tooltip
              title={display !== "-" ? display : undefined}
              color={"#fff"}
              overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
              placement="topLeft"
            >
              <span className="applications-cell-ellipsis-2-lines">
                {display}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: t("applications.tableColumns.serviceCategory"),
        dataIndex: "serviceCategoryNameEn",
        key: "serviceCategoryNameEn",
        width: 200,
        ellipsis: false,
        render: (text: string) => {
          const display = text?.trim() ? text : "-";
          return (
            <Tooltip
              title={display !== "-" ? display : undefined}
              color={"#fff"}
              overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
              placement="topLeft"
            >
              <span className="applications-cell-ellipsis-1-line">
                {display}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: t("applications.tableColumns.type"),
        dataIndex: "serviceTypeNameEn",
        width: 120,
        key: "serviceTypeNameEn",
      },
      {
        title: t("applications.tableColumns.status"),
        dataIndex: "status",
        key: "status",
        width: 240,
        render: (text: string) => {
          return (
            <div className={`status-tag ${transformSpaceString(text)}`}>
              {text}
            </div>
          );
        },
      },
      {
        title: t("applications.tableColumns.sla"),
        dataIndex: "slaDescription",
        width: 200,
        key: "slaDescription",
        sorter: true,
        render: (text: string, record: IApplicationInfo) => {
          if (!text) return "-";
          const isOverdue = Number(record?.sla) >= 0;
          return (
            <span className={`${isOverdue ? "overdue-style" : ""}`}>
              {text}
            </span>
          );
        },
      },
      {
        title: t("applications.tableColumns.applyFor"),
        dataIndex: "applyForEn",
        width: 200,
        key: "applyForEn",
        render: (text: string, record: IApplicationInfo) => {
          const normalizedText = typeof text === "string" ? text.trim() : "";
          const displayText = normalizedText || "-";

          return (
            <div className="applications-apply-for">
              <img
                src={
                  isIndividualUserTypeCode(record.userTypeCode)
                    ? UserIcon
                    : enterprise
                }
                alt=""
                className="applications-apply-for__icon"
              />
              <span
                className="applications-apply-for__text"
                title={normalizedText || undefined}
              >
                {displayText}
              </span>
            </div>
          );
        },
      },
      {
        title: t("applications.tableColumns.submissionTime"),
        dataIndex: "lastUpdatedTime",
        sorter: true,
        width: 200,
        key: "lastUpdatedTime",
        render: (text?: string | null) => {
          if (!text) return "-";
          const date = moment(text);
          return date.isValid() ? date.format("DD/MM/YYYY HH:mm:ss") : "-";
        },
      },
      {
        title: t("applications.tableColumns.action"),
        key: TODO_ACTION_COLUMN_KEY,
        width: actionColumnWidth,
        fixed: "right",
        render: (_, record: IApplicationInfo) => {
          const {
            isExtraApprove,
            isDisable,
            canApprove,
            canReject,
            canRequestModification,
            canSendBack,
            canExternalApproval,
          } = getApplicationActionState(record);
          if (isDisable) {
            return "-";
          }
          const approvePending = pendingFahrActionKeys.has(
            `${record.id}:${record.taskId}:approve`,
          );
          const rejectPending = pendingFahrActionKeys.has(
            `${record.id}:${record.taskId}:reject`,
          );
          const externalApprovalPending = pendingFahrActionKeys.has(
            `${record.id}:${record.taskId}:externalApproval`,
          );

          const actions: AdaptiveActionItem[] = [
            {
              key: "approve",
              label: isExtraApprove
                ? t("applications.buttons.extraapprove")
                : t("applications.buttons.approve"),
              visible: canApprove,
              disabled: approvePending,
              loading: approvePending,
              onClick: () =>
                void handleApprovalDecisionClick(record, "approve"),
              renderAction: ({ onClick }) => (
                <div
                  aria-disabled={approvePending}
                  className={`table-btn${approvePending ? " table-btn--disabled" : ""}`}
                  onClick={onClick}
                >
                  {isExtraApprove
                    ? t("applications.buttons.extraapprove")
                    : t("applications.buttons.approve")}
                </div>
              ),
            },
            {
              key: "reject",
              label: isExtraApprove
                ? t("applications.buttons.extrareject")
                : t("applications.buttons.reject"),
              visible: canReject,
              disabled: rejectPending,
              loading: rejectPending,
              onClick: () =>
                void handleApprovalDecisionClick(record, "reject"),
              renderAction: ({ onClick }) => (
                <div
                  aria-disabled={rejectPending}
                  className={`table-btn${rejectPending ? " table-btn--disabled" : ""}`}
                  onClick={onClick}
                >
                  {isExtraApprove
                    ? t("applications.buttons.extrareject")
                    : t("applications.buttons.reject")}
                </div>
              ),
            },
            {
              key: "requestModification",
              label: t("applications.buttons.requestModification"),
              visible: canRequestModification && !isExtraApprove,
              placement: "overflow",
              onClick: () => {
                setCurrentTask(record);
                requestModalRef.current?.show();
              },
            },
            {
              key: "sendBack",
              label: t("applications.buttons.sendBack"),
              visible: canSendBack,
              placement: "overflow",
              onClick: () => {
                setCurrentTask(record);
                sendBackModalRef.current?.show();
              },
            },
            {
              key: "externalApproval",
              label: t("applications.buttons.externalApproval"),
              visible: canExternalApproval,
              disabled: externalApprovalPending,
              loading: externalApprovalPending,
              placement: "overflow",
              onClick: () => {
                void handleExternalApprovalClick(record);
              },
            },
          ];

          return (
            <AdaptiveActionGroup
              actions={actions}
              maxInlineActions={2}
              moreLabel={t("common.moreActions")}
              moreIcon={<MoreOutlined />}
              className="table-actions"
              dropdownPlacement="bottomRight"
            />
          );
        },
      },
    ],
    [
      actionColumnWidth,
      hasApplicationNoProfileStar,
      getApplicationActionState,
      handleApprovalDecisionClick,
      handleExternalApprovalClick,
      pendingFahrActionKeys,
      t,
    ],
  );
  const completedColumns = useMemo(() => {
    const columns = todoColumns.slice(0, -1).map((col) => {
      // Modify SLA column for Completed tab
      if (col.key === "slaDescription") {
        return {
          ...col,
          render: (text: string, record: IApplicationInfo) => {
            if (!text) return "-";
            const isOverdue = Number(record?.sla) >= 0;
            return isOverdue
              ? t("applications.details.exceeded")
              : t("applications.details.onTime");
          },
        };
      }
      return col;
    });
    const withDecision = columns.reduce((acc, cur) => {
      if (cur.key === "serviceTypeNameEn") {
        acc.push({
          title: t("applications.details.myDecision"),
          dataIndex: "taskStatus",
          key: "taskStatus",
          width: 200,
          ellipsis: {
            showTitle: false,
          },
          render: (text: string) => {
            // A missing decision renders as a plain "-": no tag colors, no
            // background, because there is no decision to color-code. The
            // backend reports it either as an empty value or as a literal "-".
            const decision = (text || "").trim();
            if (!decision || decision === "-") {
              return "-";
            }

            return (
              <Tooltip
                title={text}
                color={"#fff"}
                overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
                placement="topLeft"
              >
                <span
                  className={`approval-result applications-my-tasks__approval-result ${transformSpaceString(
                    text,
                  )}`}
                >
                  {text}
                </span>
              </Tooltip>
            );
          },
        });
      }
      acc.push(cur);
      return acc;
    }, [] as ColumnType<IApplicationInfo>[]);

    withDecision.push({
      title: t("applications.tableColumns.action"),
      key: COMPLETED_ACTION_COLUMN_KEY,
      width: 160,
      fixed: "right",
      render: (_: unknown, record: IApplicationInfo) => {
        if (record.isEligible !== true) {
          return "-";
        }
        return (
          <div
            className="table-btn recall-btn"
            style={{ color: "#92722A" }}
            onClick={(event) => {
              event.stopPropagation();
              openRecallModal(record);
            }}
          >
            {t("applications.buttons.recall")}
          </div>
        );
      },
    });

    return withDecision;
  }, [t, todoColumns, openRecallModal]);

  // The Actions column only earns its width when some row on the current page
  // can actually act; a page rendering nothing but "-" drops the column.
  const hasTodoRowActions = useMemo(
    () =>
      applicationList.some(
        (record) => getApplicationVisibleActions(record).length > 0,
      ),
    [applicationList, getApplicationVisibleActions],
  );
  const hasCompletedRowActions = useMemo(
    () => applicationList.some((record) => record.isEligible === true),
    [applicationList],
  );
  const showActionColumn =
    activeTab === "1" ? hasTodoRowActions : hasCompletedRowActions;

  const tableColumns = useMemo(() => {
    switch (activeTab) {
      case "1":
        return hasTodoRowActions
          ? todoColumns
          : todoColumns.filter((col) => col.key !== TODO_ACTION_COLUMN_KEY);
      case "2":
        return hasCompletedRowActions
          ? completedColumns
          : completedColumns.filter(
              (col) => col.key !== COMPLETED_ACTION_COLUMN_KEY,
            );
      default:
        return [];
    }
  }, [
    activeTab,
    todoColumns,
    completedColumns,
    hasTodoRowActions,
    hasCompletedRowActions,
  ]);

  const tableConfigs = useMemo<TableProps<IApplicationInfo>>(() => {
    return {
      className: "custom-table",
      columns: tableColumns,
      scroll: {
        x: showActionColumn
          ? Math.max(
              APPLICATION_TABLE_SCROLL_X,
              APPLICATION_TABLE_SCROLL_X +
                actionColumnWidth -
                APPLICATION_ACTION_COLUMN_BASE_WIDTH,
            )
          : APPLICATION_TABLE_SCROLL_X - APPLICATION_ACTION_COLUMN_BASE_WIDTH,
      },
      dataSource: applicationList,
      rowKey: (record: IApplicationInfo) =>
        record.taskId || record.id?.toString() || record.applicationNumber,
      onChange: (
        pagination: TablePaginationConfig,
        _f: Record<string, unknown>,
        sorter:
          | SorterResult<IApplicationInfo>
          | SorterResult<IApplicationInfo>[],
      ) => {
        const { order = SorterKeys.descend, field } =
          sorter as SorterResult<IApplicationInfo>;
        // Map display fields to the sort values expected by the API.
        const sortField =
          field === "slaDescription"
            ? "sla"
            : field === "lastUpdatedTime"
            ? "LastUpdatedTime"
            : field;
        getPageList(
          transformSorterKeys<IApplicationInfo>(
            sortField as keyof IApplicationInfo,
            // default to descend
            order as typeof SorterKeys.ascend,
          ),
          {
            pageIndex: pagination.current,
            pageSize: pagination.pageSize,
          },
        );
      },
      onRow: (record: IApplicationInfo) => ({
        onClick: (e: React.MouseEvent) => {
          if (record.serviceCode) {
            const serviceCodeNum =
              typeof record.serviceCode === "number"
                ? record.serviceCode
                : Number(record.serviceCode);
            updateServicesCode(isNaN(serviceCodeNum) ? null : serviceCodeNum);
          }

          e.stopPropagation();
          setApplicationsDetails(record);
          const taskId =
            record.taskId || record.id?.toString() || record.applicationNumber;
          history.push(
            `/licensing/applications/applicationsDetails?taskId=${taskId}&activeTab=${activeTab}`,
            { details: record },
          );
        },
      }),
      pagination: {
        total: pageInfo.total,
        pageSize: pageInfo.pageSize,
        current: pageInfo.pageIndex,
        showSizeChanger: true,
        showTotal: (total: number) => (
          <PaginationTotal
            label={t("common.total")}
            total={total}
            current={pageInfo.pageIndex}
            pageSize={pageInfo.pageSize}
          />
        ),
        pageSizeOptions: ["10", "20", "50", "100"],
      },
    };
  }, [
    applicationList,
    tableColumns,
    actionColumnWidth,
    showActionColumn,
    activeTab,
    pageInfo,
    getPageList,
    history,
    setApplicationsDetails,
    t,
    updateServicesCode,
  ]);

  const exportHanld = () => {
    const pageContent = {
      pageIndex: pageInfo.pageIndex,
      pageSize: pageInfo.pageSize,
    };
    if (activeTab == "1") {
      setExportLoading(true);
      const filterValues = filterStore.getFieldsValue();
      const keyword = filterValues.keyword;
      const type = filterValues.type;
      const filterSubmissionTime = filterValues.submissionTime;
      const [startTime, endTime] = transformDate(filterSubmissionTime);

      const todoFilterParams = {
        ...todoPage,
        ...pageContent,
        keyword: keyword || todoPage.keyword,
        serviceTypeId: type ?? "1",
        approvalStatus: filterValues.status,
        startTime: startTime || todoPage.startTime,
        endTime: endTime || todoPage.endTime,
      };

      exportMyTodoReview(todoFilterParams)
        .then((res) => {
          exportCSVFile(
            res,
            `Applications_MyTasks_ToDo_${moment().format(
              "DDMMYYYY_HHmmss",
            )}.csv`,
          );
          setExportLoading(false);
        })
        .finally(() => {
          setExportLoading(false);
        });
    } else {
      setExportLoading(true);
      const filterValues = filterStore.getFieldsValue();
      const keyword = filterValues.keyword;
      const type = filterValues.type;
      const filterStatus = filterValues.status;
      const filterResults = filterValues.results;
      const filterSubmissionTime = filterValues.submissionTime;
      const [startTime, endTime] = transformDate(filterSubmissionTime);

      const completedFilterParams = {
        ...todoPage,
        ...pageContent,
        keyword: keyword || todoPage.keyword,
        serviceTypeId: type ?? "1",
        processInstanceStatus: filterStatus ?? selectStatus,
        approvalStatus: filterResults || selectResults,
        startTime: startTime || submissionTime.startTime,
        endTime: endTime || submissionTime.endTime,
      };

      exportMyCompletedReview(completedFilterParams)
        .then((res) => {
          exportCSVFile(
            res,
            `Applications_MyTasks_Completed_${moment().format(
              "DDMMYYYY_HHmmss",
            )}.csv`,
          );
          setExportLoading(false);
        })
        .finally(() => {
          setExportLoading(false);
        });
    }
  };

  // To Do tab filter configs
  const todoTableFilterConfigs = useMemo(() => {
    if (activeTab !== "1") return [];
    return [
      <Input
        placeholder={t("common.search")}
        prefix={<Sousuo className="search-icon" />}
        key="input-keyword"
        className="search-input"
        allowClear
      />,
      {
        label: t("applications.tableColumns.type"),
        element: (
          <Select
            key="select-type"
            placeholder={t("serviceConfiguration.filters.allType")}
            className="filters-select"
            options={types}
            allowClear
          />
        ),
      },
      {
        label: t("applications.tableColumns.status"),
        element: (
          <Select
            key="select-status"
            getPopupContainer={(triggerNode) => triggerNode.parentNode}
            placeholder={t("serviceConfiguration.filters.allStatuses")}
            className="filters-select"
            options={status}
            allowClear
          />
        ),
      },
      {
        label: t("applications.filters.submissionTime"),
        element: (
          <RangePicker
            key="range-submissionTime"
            placeholder={[t("common.startTime"), t("common.endTime")]}
            format={["DD/MM/YYYY"]}
            className="search-input"
            allowClear={true}
          />
        ),
      },
    ];
  }, [activeTab, types, status, t]);

  // Completed tab filter configs
  const completedTableFilterConfigs = useMemo(() => {
    if (activeTab !== "2") return [];
    return [
      <Input
        placeholder={t("common.search")}
        prefix={<Sousuo className="search-icon" />}
        key="input-keyword"
        className="search-input"
        allowClear
      />,
      {
        label: t("applications.tableColumns.type"),
        element: (
          <Select
            key="select-type"
            placeholder={t("serviceConfiguration.filters.allType")}
            className="filters-select"
            options={types}
            allowClear
          />
        ),
      },
      {
        label: t("applications.tableColumns.status"),
        element: (
          <Select
            key="select-status"
            getPopupContainer={(triggerNode) => triggerNode.parentNode}
            placeholder={t("serviceConfiguration.filters.allStatuses")}
            className="filters-select"
            options={status}
            allowClear
          />
        ),
      },
      {
        label: t("applications.filters.myDecision"),
        element: (
          <Select
            key="select-results"
            className="filters-select"
            mode="multiple"
            placeholder={t("applications.filters.allResults")}
            options={results}
            allowClear
          />
        ),
      },
      {
        label: t("applications.filters.submissionTime"),
        element: (
          <RangePicker
            key="range-submissionTime"
            placeholder={[t("common.startTime"), t("common.endTime")]}
            format={["DD/MM/YYYY"]}
            className="search-input"
            allowClear={true}
          />
        ),
      },
    ];
  }, [activeTab, types, status, results, t]);

  // My tasks content
  const renderMyTasks = () => {
    return (
      <>
        <Tabs
          defaultActiveKey={activeTab}
          onChange={(key: string) => {
            setActiveTab(key);
            // Reset pagination and clear list when switching tabs
            setPage({ pageIndex: 1, total: 0 });
            setApplicationList([]);
            filterStore.resetFields();
          }}
        >
          <Tabs.TabPane tab={<span data-reader-view="todo">{t("applications.subTabs.todo")}</span>} key="1" />
          <Tabs.TabPane tab={<span data-reader-view="completed">{t("applications.subTabs.completed")}</span>} key="2" />
        </Tabs>
        <FilterTable
          key={`${activeTab}-table`}
          containerCls="custom-table"
          {...tableConfigs}
          loading={loading}
          filterStore={filterStore}
          responsiveToolbar
          tableFilters={
            activeTab === "1"
              ? todoTableFilterConfigs
              : completedTableFilterConfigs
          }
          request={async () => {
            getPageList();
          }}
          extraBtn={
            <CustomButton
              text={t("applications.buttons.export")}
              variant="outline"
              iconPosition="right"
              loading={exportLoading}
              onClick={exportHanld}
              disabled={!applicationList.length || pageInfo.total === 0}
              permissionCode="Licensing.Applications.Export"
              permissionRoutePath="/licensing/applications"
            />
          }
        />
      </>
    );
  };

  const contextValue = useMemo(
    () => ({
      urgentCount: applicationContext.urgentCount,
      dispatch: refreshUrgentCount,
    }),
    [applicationContext.urgentCount, refreshUrgentCount],
  );

  useEffect(() => {
    // Trigger data fetch when tab is changed or component mounts
    // Similar to EventManagement page, call getPageList directly
    getPageList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    ServiceConfigServiceType();
  }, [ServiceConfigServiceType]);

  if (!keepAliveActivated) {
    return null;
  }

  return (
    <ApplicationContext.Provider value={contextValue}>
      <div className="application-container">
        <div className="application-container__content">
          <TasksPanel status={todoStats} variant="applicationStatistics" />
          <Card className="table-card">{renderMyTasks()}</Card>
        </div>
      </div>
      <ApproveModal
        current={currentTask}
        ref={approveModalRef}
        onOkCb={() => getPageList()}
        onExternalApprove={
          fahrDecisionApplicationId === currentTask.id
            ? handleFahrExternalApprove
            : undefined
        }
      />
      <MediaMaterialReportModal
        current={currentTask}
        ref={mediaMaterialReportModalRef}
        onOkCb={() => getPageList()}
      />
      <DispositionDecisionModal
        current={currentTask}
        ref={dispositionDecisionModalRef}
        onOkCb={() => getPageList()}
      />
      <RejectModal
        current={currentTask}
        ref={rejectModalRef}
        onOkCb={() => getPageList()}
        onExternalReject={
          fahrDecisionApplicationId === currentTask.id
            ? handleFahrExternalReject
            : undefined
        }
      />
      <RequestModal
        current={currentTask}
        ref={requestModalRef}
        onOkCb={() => getPageList()}
        confirmPermissionCode={
          PERMISSION_CODES.licensing.applications.requestModification
        }
        permissionRoutePath="/licensing/applications/applicationsDetails"
        />
        <RecallApprovalModal
        visible={recallModalVisible}
        loading={recallSubmitting}
        onCancel={closeRecallModal}
        onConfirm={handleRecallConfirm}
        />
        <SendBackModal
        current={currentTask}
        ref={sendBackModalRef}
        onOkCb={() => {
          getPageList();
        }}
        confirmPermissionCode={PERMISSION_CODES.licensing.applications.sendBack}
        permissionRoutePath="/licensing/applications/applicationsDetails"
      />
      <ExternalApprovalModal
        current={currentTask as unknown as IExternalApprovalProps["current"]}
        ref={externalApprovalModalRef}
        onOkCb={() => getPageList()}
        type={1}
        confirmPermissionCode={
          PERMISSION_CODES.licensing.applications.externalApproval
        }
        permissionRoutePath="/licensing/applications/applicationsDetails"
      />
    </ApplicationContext.Provider>
  );
};

export default Applications;
