import Sousuo from "@/assets/icons/Sousuo";
import {
  useState,
  type FC,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { FilterTable, useFilter } from "@/components/common/FilterTable";
import PaginationTotal from "@/components/common/PaginationTotal";
import { useButtonPermission } from "@/routes/access";
import {
  Card,
  DatePicker,
  Input,
  Select,
  Tabs,
} from "antd";
import moment from "moment";
import type { ColumnType, TableProps } from "antd/lib/table";
import { CustomMessage } from "@/components/common";
import AdaptiveActionGroup, {
  type AdaptiveActionItem,
} from "@/components/common/AdaptiveActionGroup";
import { MoreOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import "./index.less";
import {
  ACTIVE_TAB,
  AI_RECOMANDATION,
  type IRequestConfig,
  type TKeyOfActiveTab,
  type TKeyOfAIRecomandation,
  type TStatusSelection,
} from "./type";
import {
  transformDate,
  transformNoValueString,
  transformSpaceString,
} from "@/utils/transform";
import type { SorterResult } from "antd/lib/table/interface";
import { SorterKeys } from "@/pages/ContentApplications/type";
import { debounce } from "lodash";
import { ExportBtn } from "@/components/common/ExportBtn";
import {
  DEFAULT_STATUS,
  TasksPanel,
} from "@/components/BusinessCmps/TasksPanel";
import OverflowTooltip from "@/components/common/OverflowTooltip";
import type { ITaskStatus } from "@/components/BusinessCmps/TasksPanel/type";
import { DEFAULT_PAGE_INFO, usePagination } from "@/hooks/usePagination";
import { useHistory } from "react-router-dom";
import { disableBtnDisplay } from "@/pages/Applications/constants";
import enterprise from "@/assets/images/enterprise.svg";
import userIcon from "@/assets/images/userIcon.svg";
import { RejectModal } from "../RejectModal";
import type { IRejectModalRef } from "../RejectModal/type";
import { ApproveModal } from "../ApproveModal";
import type { IApproveModalRef } from "../ApproveModal/type";
import { safeParseWorkflowActions } from "@/constants/workflowActions";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import {
  exportMyCompletedReview,
  exportMyTodoReview,
  getMyCompletedPageTasks,
  getMyTodoPageTasks,
  getReviewTaskDetail,
  type ContentServiceOption,
  type IRequestParams,
  type ITaskDetails,
} from "@/services/content";
import {
  resolveTaskWorkflowAction,
  type WorkflowActionIntent,
  type WorkflowActionRoute,
} from "../../utils/workflowActionRouting";
import { RequestModificationModal } from "../RequestModificationModal";
import type { IRequestModalRef } from "../RequestModificationModal/type";
import { DispositionDecisionModal } from "../DispositionDecisionModal";
import type { IDispositionDecisionModalRef } from "../DispositionDecisionModal/type";
import { DispositionApproveConfirmModal } from "../DispositionApproveConfirmModal";
import type { IDispositionApproveConfirmModalRef } from "../DispositionApproveConfirmModal/type";
import { MediaMaterialReportModal } from "../MediaMaterialReportModal";
import type { IMediaMaterialReportModalRef } from "../MediaMaterialReportModal/type";
import { SendBackModal } from "../SendBackModal";
import type { ISendBackModalRef } from "../SendBackModal/type";
import { ExternalApprovalModal } from "../ExternalApprovalModal";
import { ContentApplicationStatus } from "../ContentApplicationStatus";
import type { IExternalApprovalRef } from "../ExternalApprovalModal/type";
import applicationNoProfileStar from "@/assets/images/application-no-star.png";
import { useServicesStore } from "@/store/services";
import { useResponsiveActionColumnWidth } from "@/hooks/useResponsiveActionColumnWidth";
import { isIndividualUserTypeCode } from "@/utils/userTypeCode";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import { getDefaultApprovalResults } from "./localization";
import {
  hasIncompleteService302MaterialStatuses,
  isService302ReviewFormDataShapeValid,
} from "@/utils/service302MaterialStatus";

type ContentApplicationActionColumnKey =
  | "approve"
  | "extraApprove"
  | "reject"
  | "extraReject"
  | "more";

const CONTENT_APPLICATION_ACTION_COLUMN_BASE_WIDTH = 160;
const CONTENT_APPLICATION_TABLE_SCROLL_X = 1000;
const CONTENT_APPLICATION_ACTION_COMPACT_BREAKPOINT = 1440;

const CONTENT_APPLICATION_ACTION_BUTTON_WIDTH_MAP = {
  more: {
    default: 32,
    compact: 32,
  },
} as const;

const CONTENT_APPLICATION_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 140,
  maxWidth: 312,
};

const CONTENT_APPLICATION_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 128,
  maxWidth: 300,
};

const CONTENT_APPLICATION_ACTION_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};

const DEFAULT_CONTENT_APPLICATION_SORT = {
  sortBy: "submissionTime",
  sortDirection: 1 as 0 | 1,
};


const CONTENT_APPLICATION_WORKFLOW_CONFIRM_PERMISSION_BY_ROUTE: Record<
  WorkflowActionRoute,
  string
> = {
  directConfirm: "Content.Applications.Confirm",
  approveApplicationModal: "Content.Applications.Confirm",
  rejectApplicationModal: "Content.Applications.ConfirmRejectModal",
  externalApproveApplicationModal: "Content.Applications.Confirm",
  externalRejectApplicationModal: "Content.Applications.ConfirmRejectModal",
  mediaMaterialReportModal:
    "Content.Applications.ConfirmMediaMaterialReportModal",
  dispositionApproveModal:
    "Content.Applications.ConfirmDispositionDecisionModal",
  dispositionApproveConfirmModal:
    "Content.Applications.ConfirmDispositionDecisionModal",
  dispositionRejectModal:
    "Content.Applications.ConfirmDispositionDecisionModal",
  requestModificationModal:
    "Content.Applications.ConfirmRequestModificationModal",
};

const getContentApplicationWorkflowConfirmPermission = (
  record: ITaskDetails,
  intent: WorkflowActionIntent,
) =>
  CONTENT_APPLICATION_WORKFLOW_CONFIRM_PERMISSION_BY_ROUTE[
    resolveTaskWorkflowAction(record, intent).route
  ];

const isPendingModificationStatus = (status?: string | null) =>
  String(status ?? "").replace(/\s+/g, "").toLowerCase() ===
  "pendingmodification";

const mapContentApplicationSortField = (
  field?: SorterResult<ITaskDetails>["field"],
): string => {
  if (field === "slaDescription") {
    return "sla";
  }

  return typeof field === "string"
    ? field
    : DEFAULT_CONTENT_APPLICATION_SORT.sortBy;
};

export const MyTasks: FC = () => {
  const updateServicesCode = useServicesStore(
    (state) => state.updateServicesCode,
  );
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.toLowerCase().startsWith("ar");
  const [filterStore] = useFilter();
  const { canRenderButton } = useButtonPermission(
    "/content/ContentApplications",
  );
  const [activeTab, setActiveTab] = useState<TKeyOfActiveTab>(ACTIVE_TAB.todo);
  // CARE in case of not getting the true tab key when request
  const tabRef = useRef<TKeyOfActiveTab>(activeTab);
  const [dataSource, setDataSource] = useState<ITaskDetails[]>([]);
  const [pageInfo, setPage] = usePagination();
  const [statuses, setStatuses] = useState<TStatusSelection[]>([]);
  const [taskStatus, setTaskStatus] = useState<ITaskStatus>(DEFAULT_STATUS);
  const [serviceOptions, setServiceOptions] = useState<ContentServiceOption[]>(
    [],
  );
  const serviceSelectOptions = useMemo(
    () => [
      {
        label: t("Content.contentApplications.filters.allServices"),
        value: "",
      },
      ...serviceOptions.map((service) => ({
        label: service.serviceNameEn,
        value: service.serviceCode,
      })),
    ],
    [serviceOptions, t],
  );
  const rejectModalRef = useRef<IRejectModalRef>(null);
  const requestModalRef = useRef<IRequestModalRef>(null);
  const approveModalRef = useRef<IApproveModalRef>(null);
  const dispositionDecisionModalRef =
    useRef<IDispositionDecisionModalRef>(null);
  const dispositionApproveConfirmModalRef =
    useRef<IDispositionApproveConfirmModalRef>(null);
  const mediaMaterialReportModalRef =
    useRef<IMediaMaterialReportModalRef>(null);
  const sendBackModalRef = useRef<ISendBackModalRef>(null);
  const externalApprovalModalRef = useRef<IExternalApprovalRef>(null);
  const [currentTask, setCurrentTask] = useState<ITaskDetails>(
    {} as ITaskDetails,
  );
  const [loading, setLoading] = useState(false);
  const latestRequestIdRef = useRef(0);
  const workflowPrecheckTaskIdsRef = useRef(new Set<string>());
  const skipNextActiveTabRequestRef = useRef(false);
  const keepAliveActivatedRef = useRef(false);
  const sortStateByTabRef = useRef<
    Record<TKeyOfActiveTab, Pick<IRequestConfig, "sortBy" | "sortDirection">>
  >({
    [ACTIVE_TAB.todo]: { ...DEFAULT_CONTENT_APPLICATION_SORT },
    [ACTIVE_TAB.completed]: { ...DEFAULT_CONTENT_APPLICATION_SORT },
  });
  const history = useHistory();
  const [results, setResults] = useState<TStatusSelection[]>([]);
  const approvalResults = useMemo(
    () => (results.length ? results : getDefaultApprovalResults(t)),
    [results, t],
  );

  const updateSortState = useCallback(
    (
      tab: TKeyOfActiveTab,
      sortState: Pick<IRequestConfig, "sortBy" | "sortDirection">,
    ) => {
      sortStateByTabRef.current = {
        ...sortStateByTabRef.current,
        [tab]: sortState,
      };
    },
    [],
  );


  const exportTodoReview = async (): Promise<Blob> => {
    const { lastUpdatedTime, keyword, status, serviceCodes } =
      filterStore.getFieldsValue();
    try {
      const blob = await exportMyTodoReview({
        startTime: transformDate(lastUpdatedTime)[0],
        endTime: transformDate(lastUpdatedTime)[1],
        keyword: keyword || undefined,
        serviceCodes: serviceCodes || undefined,
        processInstanceStatus: status || undefined,
      });
      return blob as unknown as Blob;
    } catch (error) {
      CustomMessage.error(
        t("Content.contentApplications.messages.failedToExportTodoReview"),
      );
      throw error;
    }
  };

  const exportCompletedReview = async (): Promise<Blob> => {
    const {
      keyword,
      serviceCodes,
      status,
      approvalResults,
      completedLastUpdatedTime,
    } = filterStore.getFieldsValue();
    const [startTime, endTime] = transformDate(completedLastUpdatedTime);
    try {
      const blob = await exportMyCompletedReview({
        startTime,
        endTime,
        keyword: keyword || undefined,
        serviceCodes: serviceCodes || undefined,
        processInstanceStatus: status || undefined,
        approvalStatus:
          Array.isArray(approvalResults) && approvalResults.length
            ? approvalResults
            : null,
      });
      return blob as unknown as Blob;
    } catch (error) {
      CustomMessage.error(
        t("Content.contentApplications.messages.failedToExportCompletedReview"),
      );
      throw error;
    }
  };

  const request = useCallback(async (
    type: TKeyOfActiveTab = ACTIVE_TAB.todo,
    config: IRequestConfig = {},
  ) => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    const tabSortState =
      sortStateByTabRef.current[type] ?? DEFAULT_CONTENT_APPLICATION_SORT;
    const requestConfig: IRequestConfig = {
      sortBy: tabSortState.sortBy ?? DEFAULT_CONTENT_APPLICATION_SORT.sortBy,
      sortDirection:
        tabSortState.sortDirection ??
        DEFAULT_CONTENT_APPLICATION_SORT.sortDirection,
      pageIndex: 1,
      pageSize: 10,
      approvalStatus: null,
      startTime: null,
      endTime: null,
      ...config,
    };
    const filters = filterStore.getFieldsValue();
    const [todoStartTime, todoEndTime] = transformDate(filters.lastUpdatedTime);
    const [completedStartTime, completedEndTime] = transformDate(
      filters.completedLastUpdatedTime,
    );
    const RequestConfig = {
      [ACTIVE_TAB.todo]: {
        getParams: () => {
          const reqParams: IRequestParams = {
            ...requestConfig,
            startTime: todoStartTime || requestConfig.startTime || null,
            endTime: todoEndTime || requestConfig.endTime || null,
            keyword: filters.keyword || undefined,
            serviceCodes: filters.serviceCodes || undefined,
            processInstanceStatus: filters.status || undefined,
          };
          return reqParams;
        },
        sendRequest: getMyTodoPageTasks,
      },
      [ACTIVE_TAB.completed]: {
        getParams: () => {
          const reqParams: IRequestParams = {
            ...requestConfig,
            startTime: completedStartTime || requestConfig.startTime || null,
            endTime: completedEndTime || requestConfig.endTime || null,
            keyword: filters.keyword || undefined,
            serviceCodes: filters.serviceCodes || undefined,
            processInstanceStatus: filters.status || undefined,
            approvalStatus:
              Array.isArray(filters.approvalResults) &&
              filters.approvalResults.length
                ? filters.approvalResults
                : null,
          };
          return reqParams;
        },
        sendRequest: getMyCompletedPageTasks,
      },
    };
    setLoading(true);

    try {
      const res = await RequestConfig[type].sendRequest(
        RequestConfig[type].getParams(),
      );
      if (requestId !== latestRequestIdRef.current) return;
      const responseData = res?.data;
      const pageIndex =
        responseData?.page?.pageIndex ?? DEFAULT_PAGE_INFO.pageIndex;
      const pageSize =
        responseData?.page?.pageSize ?? DEFAULT_PAGE_INFO.pageSize;
      const total = responseData?.page?.total ?? DEFAULT_PAGE_INFO.total;
      // Completed My Decision options are data-driven: they come exclusively
      // from myDecisionOptions, the decision values the backend reports for the
      // current list, so a decision with no matching rows never shows up.
      // A null/empty entry represents "no decision" and maps to "-".
      // approvalStatus is intentionally NOT used as a fallback here.
      const rawDecisionOptions = Array.isArray(responseData?.myDecisionOptions)
        ? responseData.myDecisionOptions
        : [];
      const allowedDecisions = new Set(
        rawDecisionOptions.map((item) =>
          typeof item === "string" && item.trim().length > 0 ? item : "-",
        ),
      );
      const defaultResults = getDefaultApprovalResults(t);
      const resultList = defaultResults.filter((option) =>
        allowedDecisions.has(option.value),
      );

      setResults(resultList);
      const processInstanceStatus = Array.isArray(
        responseData?.processInstanceStatus,
      )
        ? responseData.processInstanceStatus
        : [];
      setStatuses(
        processInstanceStatus.map((item: string) => ({
          label: item,
          value: item,
        })),
      );
      setServiceOptions(
        Array.isArray(responseData?.serviceOptions)
          ? responseData.serviceOptions
          : [],
      );
      setDataSource(
        Array.isArray(responseData?.page?.items) ? responseData.page.items : [],
      );
      setTaskStatus(responseData?.statusCount || DEFAULT_STATUS);
      setPage({
        pageIndex,
        pageSize,
        total,
      });
    } catch {
      if (requestId !== latestRequestIdRef.current) return;
      setServiceOptions([]);
      setResults([]);
      setStatuses([]);
      CustomMessage.error(
        t("Content.contentApplications.messages.failedToGetApplicationStatuses"),
      );
      setDataSource([]);
      setTaskStatus(DEFAULT_STATUS);
      setPage(DEFAULT_PAGE_INFO);
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [filterStore, setPage, t]);

  const requestRef = useRef(request);
  requestRef.current = request;
  const debouncedRequest = useMemo(
    () => debounce((type: TKeyOfActiveTab) => requestRef.current(type), 500),
    [],
  );

  const keepAliveActivated = useKeepAliveActivated({
    onActivated: () => {
      keepAliveActivatedRef.current = true;
      void request(activeTab, {
        pageIndex: pageInfo.pageIndex,
        pageSize: pageInfo.pageSize,
      });
    },
    onDeactivated: () => {
      keepAliveActivatedRef.current = false;
      latestRequestIdRef.current += 1;
      debouncedRequest.cancel();
      setLoading(false);
    },
  });
  keepAliveActivatedRef.current = keepAliveActivated;

  const handleTableChange = useCallback(
    (
      tab: TKeyOfActiveTab,
      pagination: { current?: number; pageSize?: number },
      sorter: SorterResult<ITaskDetails> | SorterResult<ITaskDetails>[],
      action?: string,
    ) => {
      const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const previousSortState =
        sortStateByTabRef.current[tab] ?? DEFAULT_CONTENT_APPLICATION_SORT;
      const nextSortState =
        action === "sort"
          ? activeSorter?.order === undefined
            ? { ...DEFAULT_CONTENT_APPLICATION_SORT }
            : activeSorter.order === SorterKeys.ascend
            ? {
                sortBy: mapContentApplicationSortField(activeSorter?.field),
                sortDirection: 0 as 0 | 1,
              }
            : {
                sortBy: mapContentApplicationSortField(activeSorter.field),
                sortDirection: 1 as 0 | 1,
              }
          : previousSortState;

      if (action === "sort") {
        updateSortState(tab, nextSortState);
      }

      request(tab, {
        pageSize: pagination.pageSize,
        pageIndex: pagination.current,
        ...nextSortState,
      });
    },
    [request, updateSortState],
  );

  const showTaskModal = useCallback(
    (record: ITaskDetails, open: () => void) => {
      setCurrentTask(record);
      window.setTimeout(open, 0);
    },
    [],
  );

  const handleWorkflowAction = useCallback(
    async (record: ITaskDetails, intent: WorkflowActionIntent) => {
      const normalizedTaskId = String(record?.taskId ?? "").trim();
      if (Number(record?.serviceCode) === 302) {
        if (
          !normalizedTaskId ||
          workflowPrecheckTaskIdsRef.current.has(normalizedTaskId)
        ) {
          return;
        }

        workflowPrecheckTaskIdsRef.current.add(normalizedTaskId);
        try {
          const detailResponse = await getReviewTaskDetail(normalizedTaskId);
          const reviewFormData = detailResponse?.data?.formData;
          if (!isService302ReviewFormDataShapeValid(reviewFormData)) {
            throw new Error("Invalid Service 302 review form data");
          }
          if (
            hasIncompleteService302MaterialStatuses(reviewFormData)
          ) {
            CustomMessage.error(
              t("DataList.validation.assignNewspapersMagazinesStatus"),
            );
            return;
          }
        } catch (error) {
          console.error(
            "Failed to validate application material statuses:",
            error,
          );
          CustomMessage.error(t("common.operationFailed"));
          return;
        } finally {
          workflowPrecheckTaskIdsRef.current.delete(normalizedTaskId);
        }
      }

      const resolved = resolveTaskWorkflowAction(record, intent);

      showTaskModal(record, () => {
        switch (resolved.route) {
          case "mediaMaterialReportModal":
            mediaMaterialReportModalRef.current?.show(intent);
            break;
          case "dispositionApproveModal":
            dispositionDecisionModalRef.current?.show("approve");
            break;
          case "dispositionApproveConfirmModal":
            dispositionApproveConfirmModalRef.current?.show();
            break;
          case "dispositionRejectModal":
            dispositionDecisionModalRef.current?.show("reject");
            break;
          case "externalApproveApplicationModal":
            approveModalRef.current?.show();
            break;
          case "externalRejectApplicationModal":
            rejectModalRef.current?.show();
            break;
          case "approveApplicationModal":
            approveModalRef.current?.show();
            break;
          case "requestModificationModal":
            requestModalRef.current?.show();
            break;
          case "rejectApplicationModal":
          default:
            rejectModalRef.current?.show();
            break;
        }
      });
    },
    [showTaskModal, t],
  );

  const getContentApplicationActionState = useCallback(
    (record: ITaskDetails) => {
      const isDisable =
        disableBtnDisplay.includes(record?.statusId ?? 0) ||
        isPendingModificationStatus(record?.status) ||
        isPendingModificationStatus(record?.taskStatus);
      const btnStatus = safeParseWorkflowActions(record?.buttonJson);
      const canApprove = Boolean(
        btnStatus?.approve &&
          canRenderButton(
            getContentApplicationWorkflowConfirmPermission(record, "approve"),
          ),
      );
      const canReject = Boolean(
        btnStatus?.reject &&
          canRenderButton(
            getContentApplicationWorkflowConfirmPermission(record, "reject"),
          ),
      );
      const canRequestModification = Boolean(
        btnStatus?.requestModification &&
          canRenderButton(
            "Content.Applications.ConfirmRequestModificationModal",
          ),
      );
      const canExternalApproval = Boolean(
        btnStatus?.externalApproval &&
          record?.statusId != 11 &&
          canRenderButton(
            PERMISSION_CODES.content.applications.externalApproval,
          ),
      );
      const canSendBack = Boolean(
        btnStatus?.sendBack &&
          canRenderButton(PERMISSION_CODES.content.applications.sendBack),
      );

      return {
        isDisable,
        canApprove,
        canReject,
        canRequestModification,
        canExternalApproval,
        canSendBack,
      };
    },
    [canRenderButton],
  );

  const getContentApplicationVisibleActions = useCallback(
    (record: ITaskDetails): ContentApplicationActionColumnKey[] => {
      const actionState = getContentApplicationActionState(record);

      if (actionState.isDisable) {
        return [];
      }

      const actions: ContentApplicationActionColumnKey[] = [];
      const isExtraApprove = record?.statusId === 11;

      if (actionState.canApprove) {
        actions.push(isExtraApprove ? "extraApprove" : "approve");
      }

      if (actionState.canReject) {
        actions.push(isExtraApprove ? "extraReject" : "reject");
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
    [getContentApplicationActionState],
  );

  const getContentApplicationActionLabel = useCallback(
    (actionKey: ContentApplicationActionColumnKey) => {
      const actionLabelMap: Partial<
        Record<ContentApplicationActionColumnKey, string>
      > = {
        approve: t("Content.contentApplications.actions.approve"),
        extraApprove: t("Content.contentApplications.actions.extraapprove"),
        reject: t("Content.contentApplications.actions.reject"),
        extraReject: t("Content.contentApplications.actions.extrareject"),
      };

      return actionLabelMap[actionKey];
    },
    [t],
  );

  const actionColumnWidth = useResponsiveActionColumnWidth<
    ITaskDetails,
    ContentApplicationActionColumnKey
  >(
    {
      rows: dataSource,
      buttonWidthMap: CONTENT_APPLICATION_ACTION_BUTTON_WIDTH_MAP,
      getVisibleActions: getContentApplicationVisibleActions,
      getActionLabel: getContentApplicationActionLabel,
      desktopConfig: CONTENT_APPLICATION_ACTION_COLUMN_DESKTOP_CONFIG,
      compactConfig: CONTENT_APPLICATION_ACTION_COLUMN_COMPACT_CONFIG,
      textMeasureConfig: CONTENT_APPLICATION_ACTION_TEXT_MEASURE_CONFIG,
      compactBreakpoint: CONTENT_APPLICATION_ACTION_COMPACT_BREAKPOINT,
    },
  );

  // The VIP star is a To Do triage cue only; the Completed list never shows it.
  const hasApplicationNoProfileStar = useMemo(
    () =>
      activeTab === ACTIVE_TAB.todo &&
      dataSource.some((record) => record.profileIsVIP),
    [activeTab, dataSource],
  );

  const columns: ColumnType<ITaskDetails>[] = [
    {
      title: t("Content.contentApplications.table.applicationNo"),
      dataIndex: "applicationNumber",
      key: "applicationNumber",
      width: 200,
      fixed: "left",
      render: (text: string, record: ITaskDetails) => {
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
    },
    {
      title: t("Content.contentApplications.table.serviceName"),
      dataIndex: isArabic ? "serviceNameAr" : "serviceNameEn",
      key: "serviceName",
      width: "clamp(240px, 18vw, 360px)",
      render: (text: string) => {
        const displayText = transformNoValueString(text);
        return (
          <OverflowTooltip
            title={text || undefined}
            color={"#fff"}
            overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
            placement="topLeft"
            className="content-applications-my-tasks__service-name"
          >
            {displayText}
          </OverflowTooltip>
        );
      },
    },
    {
      title: t("Content.contentApplications.table.serviceCategory"),
      dataIndex: isArabic ? "serviceCategoryNameAr" : "serviceCategoryNameEn",
      key: "serviceCategoryName",
      width: 240,
      render: (text) => {
        return text;
      },
    },
    {
      title: t("Content.contentApplications.table.status"),
      dataIndex: "status",
      key: "status",
      width: 200,
      render: (text: string | null | undefined, record) => (
        <ContentApplicationStatus
          status={text}
          statusId={record.statusId}
        />
      ),
    },
    {
      title: t("Content.contentApplications.table.sla"),
      width: 150,
      dataIndex: "slaDescription",
      key: "slaDescription",
      sorter: true,
      render: (text: string, record: ITaskDetails) => {
        const isOverdue = record.sla > 0;
        return (
          <span className={isOverdue ? "sla-overdue" : ""}>
            {transformNoValueString(text)}
          </span>
        );
      },
    },
    {
      title: t("Content.contentApplications.table.aiRecommendation"),
      dataIndex: "aiStatus",
      key: "aiStatus",
      width: 180,
      render: (text?: number | null) => {
        const aiRecommendation =
          AI_RECOMANDATION?.[text as TKeyOfAIRecomandation];

        if (!aiRecommendation) {
          return "-";
        }

        return (
          <div className={`ai-recommandation ${aiRecommendation}`}>
            {t(
              `Content.contentApplications.aiRecommendations.${aiRecommendation}`,
            )}
          </div>
        );
      },
    },
    {
      title: t("Content.contentApplications.table.applyFor"),
      dataIndex: isArabic ? "applyForAr" : "applyForEn",
      key: "applyFor",
      width: 240,
      render: (text: string | null | undefined, record) => {
        const applyForText = typeof text === "string" ? text : "";
        const hasApplyForText = Boolean(applyForText.trim());
        const displayApplyForText = hasApplyForText ? applyForText : "-";

        return (
          <div className="user-name">
            <img
              className="user-icon"
              src={
                isIndividualUserTypeCode(record?.userTypeCode)
                  ? userIcon
                  : enterprise
              }
              alt=""
            />
            <OverflowTooltip
              title={hasApplyForText ? applyForText : undefined}
              color={"#fff"}
              overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
              placement="topLeft"
              className="user-name-text"
            >
              {displayApplyForText}
            </OverflowTooltip>
          </div>
        );
      },
    },
    {
      title: t("Content.contentApplications.table.submissionTime"),
      dataIndex: "submissionTime",
      key: "submissionTime",
      width: 200,
      sorter: true,
      render: (text?: string | null) => {
        if (!text) return "-";
        const date = moment(text);
        return date.isValid() ? date.format("DD/MM/YYYY HH:mm:ss") : "-";
      },
    },
    {
      title: t("Content.contentApplications.table.actions"),
      fixed: "right",
      width: actionColumnWidth,
      render: (_, record: ITaskDetails) => {
        const {
          isDisable,
          canApprove,
          canReject,
          canRequestModification,
          canExternalApproval,
          canSendBack,
        } = getContentApplicationActionState(record);

        if (isDisable) {
          return "-";
        }

        const isExtraApprove = record?.statusId == 11;
        const actions: AdaptiveActionItem[] = [
          {
            key: "approve",
            label: isExtraApprove
              ? t("Content.contentApplications.actions.extraapprove")
              : t("Content.contentApplications.actions.approve"),
            visible: canApprove,
            onClick: () => void handleWorkflowAction(record, "approve"),
            renderAction: ({ onClick }) => (
              <div className="table-btn" onClick={onClick}>
                {isExtraApprove
                  ? t("Content.contentApplications.actions.extraapprove")
                  : t("Content.contentApplications.actions.approve")}
              </div>
            ),
          },
          {
            key: "reject",
            label: isExtraApprove
              ? t("Content.contentApplications.actions.extrareject")
              : t("Content.contentApplications.actions.reject"),
            visible: canReject,
            onClick: () => void handleWorkflowAction(record, "reject"),
            renderAction: ({ onClick }) => (
              <div className="table-btn" onClick={onClick}>
                {isExtraApprove
                  ? t("Content.contentApplications.actions.extrareject")
                  : t("Content.contentApplications.actions.reject")}
              </div>
            ),
          },
          {
            key: "requestModification",
            label: t(
              "Content.contentApplications.actions.requestModification",
            ),
            visible: canRequestModification,
            placement: "overflow",
            onClick: () => {
              setCurrentTask(record);
              requestModalRef.current?.show();
            },
          },
          {
            key: "sendBack",
            label: t("Content.contentApplications.actions.sendBack"),
            visible: canSendBack,
            placement: "overflow",
            onClick: () => {
              setCurrentTask(record);
              sendBackModalRef.current?.show();
            },
          },
          {
            key: "externalApproval",
            label: t("Content.contentApplications.actions.externalApproval"),
            visible: canExternalApproval,
            placement: "overflow",
            onClick: () => {
              setCurrentTask(record);
              externalApprovalModalRef.current?.show();
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
  ];

  const tableConfigs = useMemo<TableProps<ITaskDetails>>(() => {
    switch (activeTab) {
      case ACTIVE_TAB.todo: {
        return {
          columns: columns,
          dataSource,
          scroll: {
            x: Math.max(
              CONTENT_APPLICATION_TABLE_SCROLL_X,
              CONTENT_APPLICATION_TABLE_SCROLL_X +
                actionColumnWidth -
                CONTENT_APPLICATION_ACTION_COLUMN_BASE_WIDTH,
            ),
          },
          onRow: (record: ITaskDetails) => ({
            onClick: (e) => {
              if (record.serviceCode) {
                const serviceCodeNum =
                  typeof record.serviceCode === "number"
                    ? record.serviceCode
                    : Number(record.serviceCode);
                updateServicesCode(
                  isNaN(serviceCodeNum) ? null : serviceCodeNum,
                );
              }
              e.stopPropagation();
              history.push(
                `/content/ContentApplications/ContentApplicationsDetails?taskId=${record.taskId}`,
                { details: record },
              );
            },
          }),
          className: "ContentApplications-table-container",
          rowKey: (record: ITaskDetails) => record.taskId,
          onChange: (pagination, _f, sorter, extra) => {
            handleTableChange(
              activeTab,
              pagination,
              sorter as SorterResult<ITaskDetails>,
              extra?.action,
            );
          },
        };
      }
      case ACTIVE_TAB.completed: {
        const pickColumnsFromApplicationInfo = <T extends ITaskDetails>(
          target: ColumnType<T>[],
        ) => {
          const findColumnByKey = (key: string) =>
            target.find((item) => item.key === key);
          const myDecisionColumn: ColumnType<T> = {
            title: t("Content.contentApplications.table.myDecision"),
            dataIndex: "myDecision",
            key: "myDecision",
            width: 180,
            render: (text: string) => {
              // A missing decision renders as a plain "-": no tag colors, no
              // background, because there is no decision to color-code. The
              // backend reports it either as an empty value or as a literal "-".
              const decision = (text || "").trim();
              if (!decision || decision === "-") {
                return "-";
              }
              const normalizedDecision = decision.toLocaleLowerCase();
              const decisionOption = getDefaultApprovalResults(t).find(
                (option) =>
                  [option.value, option.label].some(
                    (value) =>
                      value.trim().toLocaleLowerCase() === normalizedDecision,
                  ),
              );
              const canonicalDecision = decisionOption?.value ?? decision;
              const decisionLabel = decisionOption?.label ?? decision;
              const decisionColorClass =
                canonicalDecision.toLocaleLowerCase() === "approved"
                  ? "content-applications-my-tasks__approval-result--approved"
                  : canonicalDecision.toLocaleLowerCase() === "rejected"
                    ? "content-applications-my-tasks__approval-result--rejected"
                    : "";
              return (
                <span
                  className={`approval-result content-applications-my-tasks__approval-result ${decisionColorClass} ${transformSpaceString(
                    canonicalDecision,
                  )}`}
                >
                  {decisionLabel}
                </span>
              );
            },
          };
          const slaColumn = findColumnByKey("slaDescription");
          // A finished task reports its SLA outcome, not a live countdown,
          // so the duration gives way to Exceeded / On Time.
          const slaOutcomeColumn: ColumnType<T> | undefined = slaColumn
            ? ({
                ...slaColumn,
                render: (text: string, record: T) => {
                  if (!text) return "-";
                  const isOverdue = record.sla > 0;
                  return (
                    <span className={isOverdue ? "sla-overdue" : ""}>
                      {isOverdue
                        ? t("Content.contentApplications.table.slaExceeded")
                        : t("Content.contentApplications.table.slaOnTime")}
                    </span>
                  );
                },
              } as ColumnType<T>)
            : undefined;
          return [
            findColumnByKey("applicationNumber"),
            findColumnByKey("serviceName"),
            findColumnByKey("serviceCategoryName"),
            myDecisionColumn,
            slaOutcomeColumn,
            findColumnByKey("applyFor"),
            findColumnByKey("status"),
            findColumnByKey("submissionTime"),
          ].filter((item): item is ColumnType<T> => Boolean(item));
        };

        return {
          scroll: { x: CONTENT_APPLICATION_TABLE_SCROLL_X },
          rowKey: (record: ITaskDetails) => record.taskId,
          columns: pickColumnsFromApplicationInfo(columns),
          dataSource,
          onRow: (record: ITaskDetails) => ({
            onClick: (e) => {
              e.stopPropagation();
              history.push(
                `/content/ContentApplications/ContentApplicationsDetails?taskId=${record.taskId}&readOnly=1`,
                { details: record },
              );
            },
          }),
          onChange: (pagination, _f, sorter, extra) => {
            handleTableChange(
              activeTab,
              pagination,
              sorter as SorterResult<ITaskDetails>,
              extra?.action,
            );
          },
        };
      }
    }
  }, [
    activeTab,
    actionColumnWidth,
    columns,
    dataSource,
    handleTableChange,
    history,
    request,
    t,
    updateServicesCode,
  ]);

  const tableFilterConfigs = useMemo(() => {
    switch (activeTab) {
      case ACTIVE_TAB.todo:
        return [
          {
            label: t("common.search"),
            element: (
              <Input
                placeholder={t("common.search")}
                prefix={<Sousuo className="search-icon" />}
                key="input-keyword"
                className="search-input"
                allowClear
              />
            ),
          },
          {
            label: t("Content.contentApplications.table.serviceName"),
            element: (
              <Select
              key="select-serviceCodes"
              placeholder={t(
              "Content.contentApplications.filters.allServices",
              )}
              className="select-style"
              listHeight={224}
              options={serviceSelectOptions}
              allowClear
              />
              ),
              },
              {
              label: t("Content.contentApplications.table.status"),
              element: (
              <Select
              key="select-status"
              placeholder={t("CMS.common.placeholders.allStatuses")}
              className="select-style"
              options={statuses}
              allowClear
              />
              ),
              },
              {
              label: t("Content.contentApplications.table.lastUpdatedTime"),
              element: (
              <DatePicker.RangePicker
              key="range-lastUpdatedTime"
                format={["DD/MM/YYYY"]}
                placeholder={[
                  t("CMS.common.placeholders.startTime"),
                  t("CMS.common.placeholders.endTime"),
                ]}
                className="range-picker"
              />
            ),
          },
        ];
      case ACTIVE_TAB.completed:
        return [
          {
            label: t("common.search"),
            element: (
              <Input
                placeholder={t("common.search")}
                prefix={<Sousuo className="search-icon" />}
                key="input-keyword"
                className="search-input"
                allowClear
              />
            ),
          },
          {
            label: t("Content.contentApplications.table.serviceName"),
            element: (
              <Select
              key="select-serviceCodes"
              placeholder={t(
              "Content.contentApplications.filters.allServices",
              )}
              className="select-style"
              listHeight={224}
              options={serviceSelectOptions}
              allowClear
              />
              ),
              },
              {
              label: t("Content.contentApplications.table.status"),
              element: (
              <Select
              key="select-status"
              placeholder={t("CMS.common.placeholders.allStatuses")}
              className="select-style"
              options={statuses}
              allowClear
              />
              ),
              },
              {
              label: t("Content.contentApplications.filters.approvalResults"),
            element: (
              <Select
                key="select-approvalResults"
                mode="multiple"
                placeholder={t(
                  "Content.contentApplications.filters.allResults",
                )}
                className="filters-select"
                options={approvalResults}
                allowClear
              />
            ),
          },
          {
            label: t("Content.contentApplications.table.lastUpdatedTime"),
            element: (
              <DatePicker.RangePicker
                key="range-completedLastUpdatedTime"
                format={["DD/MM/YYYY"]}
                placeholder={[
                  t("Content.contentApplications.filters.startTime"),
                  t("Content.contentApplications.filters.endTime"),
                ]}
                className="range-picker"
                allowClear
              />
            ),
          },
        ];
    }
  }, [activeTab, approvalResults, serviceSelectOptions, statuses, t]);

  const generateExportFileName = () => {
    const now = moment();
    const dateStr = now.format("DDMMYYYY");
    const timeStr = now.format("HHmmss");
    return `Application_${dateStr}_${timeStr}.csv`;
  };

  const getExtraBtn = useCallback(() => {
    switch (activeTab) {
      case ACTIVE_TAB.todo:
        return (
          <div className="filter-area">
            <i />
            <ExportBtn
              exportCb={exportTodoReview}
              exportName={generateExportFileName()}
            />
          </div>
        );
      case ACTIVE_TAB.completed:
        return (
          <div className="filter-area">
            <i />
            <ExportBtn
              exportCb={exportCompletedReview}
              exportName={generateExportFileName()}
            />
          </div>
        );
    }
  }, [activeTab, exportTodoReview, exportCompletedReview]);

  useEffect(() => {
    return () => debouncedRequest.cancel();
  }, [debouncedRequest]);


  useEffect(() => {
    if (!keepAliveActivatedRef.current) return;
    if (skipNextActiveTabRequestRef.current) {
      skipNextActiveTabRequestRef.current = false;
      return;
    }
    request(activeTab);
  }, [activeTab, request]);

  return (
    <>
      <div className="content-applications__task-summary">
        <TasksPanel status={taskStatus} variant="applicationStatistics" />
      </div>
      <Card className="my-tasks-content">
        <Tabs
          defaultActiveKey={activeTab}
          onChange={(key: string) => {
            const nextTab = key as TKeyOfActiveTab;
            debouncedRequest.cancel();
            setStatuses([]);
            setServiceOptions([]);
            // Clear stale rows and show loading immediately so the new tab's
            // columns never render over the previous tab's data during the
            // debounced request window (avoids the flicker on tab switch).
            setDataSource([]);
            setLoading(true);
            tabRef.current = nextTab;
            skipNextActiveTabRequestRef.current = true;
            filterStore.setFieldValue("status", undefined);
            setActiveTab(nextTab);
          }}
        >
          <Tabs.TabPane
            tab={t("Content.contentApplications.tabs.todo")}
            key="1"
          />
          <Tabs.TabPane
            tab={t("Content.contentApplications.tabs.completed")}
            key="2"
          />
        </Tabs>

        <FilterTable
          containerCls="custom-table content-applications-my-tasks-filter-table"
          {...tableConfigs}
          loading={loading}
          filterStore={filterStore}
          tableFilters={tableFilterConfigs}
          extraBtn={getExtraBtn()}
          request={() => debouncedRequest(tabRef.current)}
          pagination={{
            size: "default",
            total: pageInfo.total,
            pageSize: pageInfo.pageSize,
            current: pageInfo.pageIndex,
            showSizeChanger: true,
            showTotal: (total: number) => (
              <PaginationTotal label={t("common.total")} total={total} current={pageInfo.pageIndex} pageSize={pageInfo.pageSize} />
            ),
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
        />
        {keepAliveActivated && (
          <>
            <ApproveModal
              current={currentTask}
              ref={approveModalRef}
              onOkCb={() => request(activeTab)}
            />
            <MediaMaterialReportModal
              current={currentTask}
              ref={mediaMaterialReportModalRef}
              onOkCb={() => request(activeTab)}
            />
            <RejectModal
              current={currentTask}
              ref={rejectModalRef}
              onOkCb={() => request(activeTab)}
            />
            <RequestModificationModal
              current={currentTask}
              ref={requestModalRef}
              onOkCb={() => request(activeTab)}
            />
            <SendBackModal
              current={currentTask}
              ref={sendBackModalRef}
              onOkCb={() => request(activeTab)}
              confirmPermissionCode={PERMISSION_CODES.content.applications.sendBack}
              permissionRoutePath="/content/ContentApplications"
            />
            <ExternalApprovalModal
              current={currentTask}
              type={2}
              ref={externalApprovalModalRef}
              onOkCb={() => request(activeTab)}
              confirmPermissionCode={
                PERMISSION_CODES.content.applications.externalApproval
              }
              permissionRoutePath="/content/ContentApplications"
            />
            <DispositionDecisionModal
              current={currentTask}
              ref={dispositionDecisionModalRef}
              onOkCb={() => request(activeTab)}
            />
            <DispositionApproveConfirmModal
              current={currentTask}
              ref={dispositionApproveConfirmModalRef}
              onOkCb={() => request(activeTab)}
            />
          </>
        )}
      </Card>
    </>
  );
};
