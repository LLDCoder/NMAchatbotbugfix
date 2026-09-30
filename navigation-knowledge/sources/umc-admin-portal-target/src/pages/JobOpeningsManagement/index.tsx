import { FilterTable, useFilter } from "@/components/common/FilterTable";
import PaginationTotal from "@/components/common/PaginationTotal";
import { usePagination } from "@/hooks/usePagination";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import AdaptiveActionGroup from "@/components/common/AdaptiveActionGroup";
import { DatePicker, Input, Select, Tooltip } from "antd";
import type { ColumnType, TableProps } from "antd/lib/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EllipsisOutlined } from "@ant-design/icons";
import Sousuo from "@/assets/icons/Sousuo";

import {
  SorterKeys,
  transformDateOnly,
  transformNoValueString,
  transformSorterKeys,
} from "@/utils/transform";
import total from "@/assets/images/total.svg";
import published from "@/assets/images/published.svg";
import review from "@/assets/images/reviewnew.svg";
import draft from "@/assets/images/draftnew.svg";
import rejected from "@/assets/images/fileRejectednew.svg";
import unpublished from "@/assets/images/fileDashednew.svg";
import { debounce } from "lodash";
import { KEY_OF_COUNT } from "./type";
import type { SorterResult } from "antd/lib/table/interface";
import moment from "moment";
import { useHistory } from "react-router-dom";
import { CountPanel } from "./components/CountPanel";
import "./index.less";
import "./reset.less";
import { ConfirmModal, CustomMessage, CustomButton } from "@/components/common";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import { useButtonPermission } from "@/routes/access";

import {
  GetCmsEventCountAsync,
  GetJobListAsync,
  getNewsTypeDictionaries,
  ApproveJob,
  type INewsItem,
  type INewsCount,
  type IQueryJob,
  DeleteJob,
  UnpublishJob,
} from "@/services/cms";
import type { IItem } from "./components/CountPanel/type";
import type { IRejectModalRef } from "./components/RejectPublishModal/type";
import { RejectPublishModal } from "./components/RejectPublishModal";
const COUNT_ITEMS = [
  {
    key: KEY_OF_COUNT.totalNews,
    icon: total,
  },
  {
    key: KEY_OF_COUNT.draft,
    icon: draft,
  },
  {
    key: KEY_OF_COUNT.published,
    icon: published,
  },
  {
    key: KEY_OF_COUNT.unpublished,
    icon: unpublished,
  },
  {
    key: KEY_OF_COUNT.pendingReview,
    icon: review,
  },

  {
    key: KEY_OF_COUNT.rejected,
    icon: rejected,
  },
];

const DEFAULT_COUNT = {
  totalNews: 0,
  published: 0,
  pendingReview: 0,
  draft: 0,
  rejected: 0,
  unpublished: 0,
  scheduled: 0,
};

type SelectOption = {
  label: string;
  value: string;
};

const JOB_STATUS_LABEL_KEYS: Record<string, string> = {
  Published: "published",
  "Pending Review": "pendingReview",
  Draft: "draft",
  Rejected: "rejected",
  Unpublished: "unpublished",
};

// News-status dictionary codes (Scope=NewsStatus). Used for action visibility + status-tag
// styling, since the backend returns the status name localized (Arabic) and can't be matched.
const STATUS_CODE = {
  pendingReview: "1",
  unpublished: "2",
  published: "3",
  rejected: "4",
  draft: "5",
  scheduled: "6",
} as const;
const STATUS_CODE_CLASS: Record<string, string> = {
  "1": "PendingReview",
  "2": "Unpublished",
  "3": "Published",
  "4": "Rejected",
  "5": "Draft",
  "6": "Scheduled",
};

type JobOpeningsActionColumnKey =
  | "approve"
  | "reject"
  | "edit"
  | "delete"
  | "unpublish"
  | "duplicate"
  | "more";

const JOB_OPENINGS_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<JobOpeningsActionColumnKey> = {
  approve: {
    default: 65,
    compact: 57,
  },
  reject: {
    default: 48,
    compact: 42,
  },
  edit: {
    default: 34,
    compact: 30,
  },
  delete: {
    default: 49,
    compact: 43,
  },
  unpublish: {
    default: 79,
    compact: 69,
  },
  duplicate: {
    default: 75,
    compact: 66,
  },
  more: {
    default: 32,
    compact: 32,
  },
};

const JOB_OPENINGS_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 112,
  maxWidth: 220,
};

const JOB_OPENINGS_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 112,
  maxWidth: 196,
};

const JOB_OPENINGS_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};

type LocalizedInfo = {
  name?: string;
  nameEn?: string;
  nameAr?: string;
};

type JobOpeningItem = INewsItem & {
  jobNo?: string;
  jobTitleEn?: string;
  jobTitleAr?: string;
  jobTypes?: string;
  emirateInfo?: LocalizedInfo;
  jobTypesInfo?: LocalizedInfo;
};


export default function JobOpeningsManagement() {
  const { t, i18n } = useTranslation();
  const [filterStore] = useFilter();
  const [pageInfo, setPage] = usePagination();
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<JobOpeningItem[]>([]);
  const [newsCount, setNewsCount] = useState<IItem[]>([]);
  const RejectPublishModalRef = useRef<IRejectModalRef>(null);
  const { canRenderButton } = useButtonPermission("/cms/JobOpeningsManagement");
  const history = useHistory();
  const [delVisible, setdelVisible] = useState(false);
  const [delId, setdelId] = useState<number>(0);
  const latestRequestIdRef = useRef(0);
  const lastRequestConfigRef = useRef<
    Pick<IQueryJob, "pageIndex" | "pageSize"> & {
      sortBy?: string;
      sortDirection?: 0 | 1;
    }
  >({
    pageIndex: 1,
    pageSize: 10,
  });
  const keepAliveActivated = useKeepAliveActivated({
    onActivated: () => {
      void request(lastRequestConfigRef.current);
    },
    onDeactivated: () => {
      latestRequestIdRef.current += 1;
      setLoading(false);
      setdelVisible(false);
    },
  });
  const handleDeleteNews = () => {
    DeleteJob(delId)
      .then(() => {
        request();
      })
      .finally(() => {
        setdelVisible(false);
      });
  };
  const getExtraBtn = () => {
    return (
      <div>
        <CustomButton
          customClassName="add-news-btn"
          type="primary"
          onClick={() => {
            history.push("/cms/JobOpeningsManagement/addJobOpeningsManagement");
          }}
        >
          {t("CMS.jobOpeningsManagement.actions.addNew")}
        </CustomButton>
      </div>
    );
  };
  const isArabic = i18n.resolvedLanguage === "ar";
  const getLocalizedName = useCallback((info?: LocalizedInfo) => {
    if (!info) return "";
    return isArabic
      ? info.nameAr || info.nameEn || info.name || ""
      : info.nameEn || info.name || info.nameAr || "";
  }, [isArabic]);
  const getStatusLabel = useCallback((statusName?: string) => {
    if (!statusName) return "";
    const key = JOB_STATUS_LABEL_KEYS[statusName];
    return key
      ? t(`CMS.jobOpeningsManagement.statuses.${key}`)
      : statusName;
  }, [t]);

  const getVisibleJobOpeningsActionKeys = (
    record: JobOpeningItem,
  ): JobOpeningsActionColumnKey[] => {
    const statusCode = record.statusInfo?.code || "";
    const editableStatusCodes = [
      STATUS_CODE.draft,
      STATUS_CODE.rejected,
      STATUS_CODE.unpublished,
    ];
    const actionConfigs: {
      key: Exclude<JobOpeningsActionColumnKey, "more">;
      show: boolean;
      permissionCode?: string;
    }[] = [
      {
        key: "approve",
        show: statusCode === STATUS_CODE.pendingReview,
        permissionCode: "CMS.JobOpenings.Approve",
      },
      {
        key: "reject",
        show: statusCode === STATUS_CODE.pendingReview,
        permissionCode: "CMS.JobOpenings.Reject",
      },
      {
        key: "edit",
        show: editableStatusCodes.includes(statusCode),
      },
      {
        key: "delete",
        show: editableStatusCodes.includes(statusCode),
        permissionCode: "CMS.JobOpenings.Delete",
      },
      {
        key: "unpublish",
        show: statusCode === STATUS_CODE.published,
        permissionCode: "CMS.JobOpenings.Unpublish",
      },
      {
        key: "duplicate",
        show: true,
      },
    ];
    const visibleActions = actionConfigs
      .filter(
        (actionConfig) =>
          actionConfig.show &&
          (!actionConfig.permissionCode ||
            canRenderButton(actionConfig.permissionCode)),
      )
      .map((actionConfig) => actionConfig.key);

    return visibleActions.length > 2
      ? [...visibleActions.slice(0, 2), "more"]
      : visibleActions;
  };

  const getJobOpeningsActionLabel = (
    actionKey: JobOpeningsActionColumnKey,
  ) => {
    const actionLabelMap: Partial<Record<JobOpeningsActionColumnKey, string>> =
      {
        approve: t("CMS.jobOpeningsManagement.actions.approve"),
        reject: t("CMS.jobOpeningsManagement.actions.reject"),
        edit: t("CMS.common.edit"),
        delete: t("CMS.jobOpeningsManagement.actions.delete"),
        unpublish: t("CMS.jobOpeningsManagement.actions.unpublish"),
        duplicate: t("CMS.jobOpeningsManagement.actions.duplicate"),
      };

    return actionLabelMap[actionKey];
  };

  const jobOpeningsActionColumnWidth = useResponsiveActionColumnWidth<
    JobOpeningItem,
    JobOpeningsActionColumnKey
  >({
    rows: dataSource,
    buttonWidthMap: JOB_OPENINGS_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: getVisibleJobOpeningsActionKeys,
    getActionLabel: getJobOpeningsActionLabel,
    desktopConfig: JOB_OPENINGS_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: JOB_OPENINGS_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: JOB_OPENINGS_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });

  const columns: ColumnType<JobOpeningItem>[] = useMemo(() => [
    {
      title: t("CMS.jobOpeningsManagement.table.jobNo"),
      dataIndex: "jobNo",
      key: "jobNo",
      width: 160,
    },
    {
      title: t("CMS.jobOpeningsManagement.table.jobTitle"),
      dataIndex: "jobTitleEn",
      key: "jobTitleEn",
      width: 230,
      render: (_text: string, record: JobOpeningItem) => {
        const title = isArabic
          ? record.jobTitleAr || record.jobTitleEn
          : record.jobTitleEn || record.jobTitleAr;
        return (
          <Tooltip
            title={title}
            color={"#fff"}
            overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
            placement="topLeft"
            className="text-ellipsis-2"
          >
            {transformNoValueString(title)}
          </Tooltip>
        );
      },
    },
    {
      title: t("CMS.jobOpeningsManagement.table.jobLocation"),
      dataIndex: "titleEn",
      key: "titleEn",
      width: 160,
      render: (_text: string, record: JobOpeningItem) => {
        const locationName = getLocalizedName(record.emirateInfo);
        return (
          <Tooltip
            title={locationName}
            color={"#fff"}
            overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
            placement="topLeft"
            className="text-ellipsis-2"
          >
            {transformNoValueString(locationName)}
          </Tooltip>
        );
      },
    },
    {
      title: t("CMS.jobOpeningsManagement.table.jobTypes"),
      dataIndex: "jobTypes",
      key: "jobTypes",
      width: 160,
      render: (text: string) => {
        return (
          <span className="update-by">
            {text === "1"
              ? t("CMS.jobOpeningsManagement.jobTypes.fullTime")
              : t("CMS.jobOpeningsManagement.jobTypes.internship")}
          </span>
        );
      },
    },
    {
      title: t("CMS.jobOpeningsManagement.table.status"),
      dataIndex: "status",
      key: "status",
      width: 200,
      render: (_text: string, record: JobOpeningItem) => {
        const statusName = record.statusInfo?.name || "";
        const statusLabel = getStatusLabel(statusName);
        const statusClass = STATUS_CODE_CLASS[record.statusInfo?.code || ""] || "";
        return (
          <div className={`status-tag ${statusClass}`}>
            {statusLabel}
          </div>
        );
      },
    },
    {
      title: t("CMS.jobOpeningsManagement.table.updatedBy"),
      dataIndex: "updateOn",
      key: "updateOn",
      width: 180,
      render: (_text: string, record: JobOpeningItem) => {
        return (
          <span className="update-by">{record.updateOnInfo?.name || ""}</span>
        );
      },
    },
    {
      title: t("CMS.jobOpeningsManagement.table.lastUpdated"),
      dataIndex: "updateAt",
      key: "updateAt",
      width: 180,
      sorter: true,
      render: (text: string) => {
        return text ? moment(text).format("DD/MM/YYYY HH:mm:ss") : "-";
      },
    },
    {
      title: t("CMS.jobOpeningsManagement.table.actions"),
      fixed: "right",
      width: jobOpeningsActionColumnWidth,
      render: (_, record: JobOpeningItem) => {
        const statusCode = record.statusInfo?.code || "";

        //
        const buttonConfigs: {
          key: string;
          label: string;
          show: boolean;
          permissionCode?: string;
          onClick: () => void;
        }[] = [
          {
            key: "approve",
            label: t("CMS.jobOpeningsManagement.actions.approve"),
            show: statusCode === STATUS_CODE.pendingReview,
            permissionCode: "CMS.JobOpenings.Approve",
            onClick: () => {
              ApproveJob(record.id)
                .then(() => {
                  CustomMessage.success(t("CMS.common.operationSuccessful"));
                  request();
                })
                .catch(() => {
                  CustomMessage.error(
                    t("CMS.jobOpeningsManagement.messages.operationFailed"),
                  );
                });
              // setCurrentTask(record)
              // approveModalRef.current?.show()
            },
          },
          {
            key: "reject",
            label: t("CMS.jobOpeningsManagement.actions.reject"),
            show: statusCode === STATUS_CODE.pendingReview,
            permissionCode: "CMS.JobOpenings.Reject",
            onClick: () => {
              RejectPublishModalRef.current?.show();
              RejectPublishModalRef.current?.setId(record.id);
            },
          },
          {
            key: "edit",
            label: t("CMS.common.edit"),
            show: [STATUS_CODE.draft, STATUS_CODE.rejected, STATUS_CODE.unpublished].includes(statusCode),
            onClick: () => {
              // TODO:
              history.push(
                `/cms/JobOpeningsManagement/addJobOpeningsManagement?id=${record.id}&type=edit`,
              );
            },
          },
          {
            key: "delete",
            label: t("CMS.jobOpeningsManagement.actions.delete"),
            show: [STATUS_CODE.draft, STATUS_CODE.rejected, STATUS_CODE.unpublished].includes(statusCode),
            permissionCode: "CMS.JobOpenings.Delete",
            onClick: () => {
              // TODO:
              setdelId(record.id);
              setdelVisible(true);
            },
          },
          {
            key: "unpublish",
            label: t("CMS.jobOpeningsManagement.actions.unpublish"),
            show: statusCode === STATUS_CODE.published,
            permissionCode: "CMS.JobOpenings.Unpublish",
            onClick: () => {
              // TODO:
              UnpublishJob(record.id).finally(() => {
                request();
              });
            },
          },
          {
            key: "duplicate",
            label: t("CMS.jobOpeningsManagement.actions.duplicate"),
            show: true, //
            onClick: () => {
              history.push(
                `/cms/JobOpeningsManagement/addJobOpeningsManagement?id=${record.id}&type=duplicate`,
              );
            },
          },
        ];

        //
        const visibleButtons = buttonConfigs.filter(
          (btn) => btn.show && (!btn.permissionCode || canRenderButton(btn.permissionCode)),
        );

        return (
          <AdaptiveActionGroup
            actions={visibleButtons.map((button) => ({
              key: button.key,
              label: button.label,
              className: "Menu-table-btn",
              onClick: button.onClick,
              renderAction: ({ onClick }) => (
                <div className="table-btn" onClick={onClick}>
                  {button.label}
                </div>
              ),
            }))}
            maxInlineActions={2}
            moreLabel={t("common.moreActions")}
            moreIcon={<EllipsisOutlined />}
            className="table-actions"
            dropdownPlacement="bottomRight"
            moreButtonClassName="table-btn dropdown-trigger"
            emptyContent={null}
          />
        );
      },
    },
  ], [
    t,
    isArabic,
    canRenderButton,
    getLocalizedName,
    getStatusLabel,
    jobOpeningsActionColumnWidth,
  ]);

  const tableConfigs = useMemo<TableProps<JobOpeningItem>>(() => {
    return {
      scroll: { x: 1200 },
      
      rowKey: (record: JobOpeningItem) => record.id,
      columns,
      dataSource,
      onRow: (record: JobOpeningItem) => ({
        onClick: (e) => {
          e.stopPropagation();
          history.push(
            `/cms/JobOpeningsManagement/JobOpeningsManagementDetail?id=${record.id}`,
            { details: record },
          );
        },
      }),
      onChange: (pagination, _f, sorter) => {
        const { order = SorterKeys.descend, field } =
            sorter as SorterResult<JobOpeningItem>;
        request({
          pageSize: pagination.pageSize ?? 1,
          pageIndex: pagination.current ?? 10,
          ...transformSorterKeys<JobOpeningItem>(
            field as keyof JobOpeningItem,
            // default to ascend
            order as typeof SorterKeys.ascend,
          ),
        });
      },
    };
  }, [dataSource, columns]);
  const [Statuses, setStatuses] = useState<SelectOption[]>([]);
  const tableFilterConfigs = useMemo(() => {
    return [
      {
        label: t("CMS.common.search"),
        element: (
          <Input
            placeholder={t("CMS.jobOpeningsManagement.filters.searchPlaceholder")}
            prefix={<Sousuo className="search-icon" />}
            key="input-keyword"
            className="search-input"
            allowClear
          />
        ),
      },
      {
        label: t("CMS.jobOpeningsManagement.table.status"),
        element: (
          <Select
            key="select-status"
            placeholder={t("CMS.jobOpeningsManagement.filters.allStatuses")}
            className="select-style"
            dropdownClassName="job-openings-status-select-dropdown"
            options={Statuses}
            allowClear
          />
        ),
      },
      {
        label: t("CMS.jobOpeningsManagement.table.lastUpdated"),
        element: (
          <DatePicker.RangePicker
            key="range-time"
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
  }, [Statuses, t]);

  const getCountList = async (requestId?: number) => {
    const res = await GetCmsEventCountAsync();
    if (
      requestId !== undefined &&
      requestId !== latestRequestIdRef.current
    ) {
      return;
    }
    const countObj: Partial<INewsCount> = res?.data || DEFAULT_COUNT;
    const list = COUNT_ITEMS.map((item) => ({
      ...item,
      name: t(`CMS.jobOpeningsManagement.counts.${item.key}`),
      value: countObj[item.key as keyof INewsCount] || 0,
    }));
    setNewsCount(list);
  };

  const request = async (
    config: Pick<IQueryJob, "pageIndex" | "pageSize"> & {
      sortBy?: string;
      sortDirection?: 0 | 1;
    } = {
      pageIndex: 1,
      pageSize: 10,
    },
  ) => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    lastRequestConfigRef.current = config;
    const { time, keyword, status } = filterStore.getFieldsValue();
    const [StartTime, EndTime] = transformDateOnly(time);
    const reqParams: IQueryJob = {
      keyWords: keyword || undefined,
      status: status || undefined,
      ...config,
      StartTime,
      EndTime,
    };
    setLoading(true);
    try {
      const res = await GetJobListAsync(reqParams);
      if (requestId !== latestRequestIdRef.current) return;
      const { currentPage, itemsPerPage, totalItems, items } = res?.data || {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 0,
        items: [],
      };
      setPage({
        pageIndex: currentPage,
        pageSize: itemsPerPage,
        total: totalItems,
      });
      setDataSource(items);
      await getCountList(requestId);
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const debouncedRequest = debounce(request, 500);
  const getStatuses = () => {
    getNewsTypeDictionaries("NewsStatus").then((res) => {
      setStatuses([
        {
          label: t("CMS.jobOpeningsManagement.filters.allStatuses"),
          value: "",
        },
        ...res.data
          .filter((item) => item.code != "6")
          .map((item) => {
            return {
              label: isArabic ? item.nameAr || item.nameEn : item.nameEn,
              value: item.code,
            };
          }),
      ]);
    });
  };
  useEffect(() => {
    request();
    getStatuses();
  }, [i18n.language]);

  return (
    <div className="job-management-container">
      <CountPanel countList={newsCount} />
      <FilterTable
        containerCls="custom-table news-table cms-filter-table"
        {...tableConfigs}
        loading={loading}
        style={{ width: '100%', tableLayout: 'fixed' }}
        filterStore={filterStore}
        tableFilters={tableFilterConfigs}
        responsiveToolbar
        extraBtn={getExtraBtn()}
        request={() => debouncedRequest()}
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
          <RejectPublishModal ref={RejectPublishModalRef} onCloseCb={request} />
          <ConfirmModal
            visible={delVisible}
            type="danger"
            title={t("CMS.jobOpeningsManagement.modals.deleteJob.title")}
            content={t("CMS.jobOpeningsManagement.modals.deleteJob.content")}
            cancelText={t("CMS.common.cancel")}
            confirmText={t("CMS.common.confirm")}
            onCancel={() => setdelVisible(false)}
            onConfirm={() => {
              handleDeleteNews();
            }}
          />
        </>
      )}
    </div>
  );
}
