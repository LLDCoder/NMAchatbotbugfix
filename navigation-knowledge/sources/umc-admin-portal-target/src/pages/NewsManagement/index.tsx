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
import { useEffect, useMemo, useRef, useState } from "react";
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
import scheduled from "@/assets/images/scheduled.svg";
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
  getNewsCount,
  getNewsList,
  getNewsTypeDictionaries,
  ApproveNew,
  type INewsItem,
  type INewsCount,
  type IQueryNews,
  DeleteAsync,
  UnPublishNew,
} from "@/services/cms";
import type { IItem } from "./components/CountPanel/type";
import type { IPinnedModalRef } from "./components/PinnedModal/type";
import type { IRejectModalRef } from "./components/RejectPublishModal/type";
import { PinnedModal } from "./components/PinnedModal";
import { RejectPublishModal } from "./components/RejectPublishModal";
const COUNT_ITEMS = [
  {
    key: KEY_OF_COUNT.totalNews,
    icon: total,
  },
  {
    key: KEY_OF_COUNT.published,
    icon: published,
  },
  {
    key: KEY_OF_COUNT.scheduled,
    icon: scheduled,
  },
  {
    key: KEY_OF_COUNT.pendingReview,
    icon: review,
  },
  {
    key: KEY_OF_COUNT.draft,
    icon: draft,
  },
  {
    key: KEY_OF_COUNT.rejected,
    icon: rejected,
  },
  {
    key: KEY_OF_COUNT.unpublished,
    icon: unpublished,
  },
];

const DEFAULT_COUNT = {
  totalNews: 0,
  published: 0,
  pendingReview: 0,
  draft: 0,
  rejected: 0,
  unpublished: 0,
};

const NEWS_STATUS_CODE = {
  pendingReview: "1",
  unpublished: "2",
  published: "3",
  rejected: "4",
  draft: "5",
  scheduled: "6",
} as const;

const NEWS_STATUS_CODE_CLASS: Record<string, string> = {
  "1": "PendingReview",
  "2": "Unpublished",
  "3": "Published",
  "4": "Rejected",
  "5": "Draft",
  "6": "Scheduled",
};

const NEWS_STATUS_VALUE_CODE: Record<string, string> = {
  "Pending Review": NEWS_STATUS_CODE.pendingReview,
  PendingReview: NEWS_STATUS_CODE.pendingReview,
  Unpublished: NEWS_STATUS_CODE.unpublished,
  Published: NEWS_STATUS_CODE.published,
  Rejected: NEWS_STATUS_CODE.rejected,
  Draft: NEWS_STATUS_CODE.draft,
  Scheduled: NEWS_STATUS_CODE.scheduled,
};

const PUBLISH_TIME_VISIBLE_STATUS_CODES: string[] = [
  NEWS_STATUS_CODE.published,
  NEWS_STATUS_CODE.unpublished,
  NEWS_STATUS_CODE.scheduled,
];

const EDITABLE_STATUS_CODES: string[] = [
  NEWS_STATUS_CODE.draft,
  NEWS_STATUS_CODE.rejected,
  NEWS_STATUS_CODE.unpublished,
];

type NewsActionColumnKey =
  | "approve"
  | "reject"
  | "edit"
  | "delete"
  | "unpublish"
  | "duplicate"
  | "more";

const NEWS_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<NewsActionColumnKey> = {
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

const NEWS_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 112,
  maxWidth: 220,
};

const NEWS_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 112,
  maxWidth: 196,
};

const NEWS_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};

const normalizeStatusValue = (value?: string | number | null) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const getNewsStatusCode = (record: INewsItem) => {
  const statusInfo = record.statusInfo;
  const statusCode = normalizeStatusValue(statusInfo?.code);
  if (statusCode && NEWS_STATUS_CODE_CLASS[statusCode]) {
    return statusCode;
  }

  const nameEn = normalizeStatusValue(statusInfo?.nameEn);
  if (nameEn && NEWS_STATUS_VALUE_CODE[nameEn]) {
    return NEWS_STATUS_VALUE_CODE[nameEn];
  }

  const name = normalizeStatusValue(statusInfo?.name);
  if (name && NEWS_STATUS_VALUE_CODE[name]) {
    return NEWS_STATUS_VALUE_CODE[name];
  }

  return "";
};

const getNewsStatusClass = (record: INewsItem) => {
  return NEWS_STATUS_CODE_CLASS[getNewsStatusCode(record)] || "";
};

const resolveNewsSortField = (field?: keyof INewsItem | string) => {
  if (field === "updateAt") return "lastUpdatedTime";
  return field;
};

type StatusOption = {
  label: string;
  value: string;
};

type NewsListRequestConfig = Pick<
  IQueryNews,
  "pageIndex" | "pageSize" | "sortBy" | "sortDirection"
>;

export default function NewsManagement() {
  const { t } = useTranslation();
  const [filterStore] = useFilter();
  const [pageInfo, setPage] = usePagination();
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<INewsItem[]>([]);
  const [newsCount, setNewsCount] = useState<IItem[]>([]);
  const pinnedModalRef = useRef<IPinnedModalRef>(null);
  const RejectPublishModalRef = useRef<IRejectModalRef>(null);
  const { canRenderButton } = useButtonPermission("/cms/NewsManagement");
  const history = useHistory();
  const [delVisible, setdelVisible] = useState(false);
  const [delId, setdelId] = useState<number>(0);
  const latestRequestIdRef = useRef(0);
  const lastRequestConfigRef = useRef<NewsListRequestConfig>({
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
    DeleteAsync({ id: delId })
      .then(() => {
        request();
      })
      .finally(() => {
        setdelVisible(false);
      });
  };
  const getExtraBtn = () => {
    return (
      <div className="news-extra-btns">
        <CustomButton
          text={t("CMS.newsManagement.actions.managePinned")}
          variant="outline"
          iconPosition="right"
          onClick={() => pinnedModalRef?.current?.show()}
          permissionCode="CMS.News.ManagePinned"
          permissionRoutePath="/cms/NewsManagement"
        />
        <CustomButton
          customClassName="add-news-btn"
          type="primary"
          onClick={() => {
            history.push("/cms/NewsManagement/AddNewsManagement");
          }}
        >
          {t("CMS.newsManagement.actions.addNew")}
        </CustomButton>
      </div>
    );
  };

  const getVisibleNewsActionKeys = (record: INewsItem): NewsActionColumnKey[] => {
    const statusCode = getNewsStatusCode(record);
    const actionConfigs: {
      key: Exclude<NewsActionColumnKey, "more">;
      show: boolean;
      permissionCode?: string;
    }[] = [
      {
        key: "approve",
        show: statusCode === NEWS_STATUS_CODE.pendingReview,
        permissionCode: "CMS.News.Approve",
      },
      {
        key: "reject",
        show: statusCode === NEWS_STATUS_CODE.pendingReview,
        permissionCode: "CMS.News.Reject",
      },
      {
        key: "edit",
        show: EDITABLE_STATUS_CODES.includes(statusCode),
      },
      {
        key: "delete",
        show: EDITABLE_STATUS_CODES.includes(statusCode),
        permissionCode: "CMS.News.Delete",
      },
      {
        key: "unpublish",
        show:
          statusCode === NEWS_STATUS_CODE.published ||
          statusCode === NEWS_STATUS_CODE.scheduled,
        permissionCode: "CMS.News.Unpublish",
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

  const getNewsActionLabel = (actionKey: NewsActionColumnKey) => {
    const actionLabelMap: Partial<Record<NewsActionColumnKey, string>> = {
      approve: t("CMS.newsManagement.actions.approve"),
      reject: t("CMS.newsManagement.actions.reject"),
      edit: t("CMS.common.edit"),
      delete: t("CMS.newsManagement.actions.delete"),
      unpublish: t("CMS.newsManagement.actions.unpublish"),
      duplicate: t("CMS.newsManagement.actions.duplicate"),
    };

    return actionLabelMap[actionKey];
  };

  const newsActionColumnWidth = useResponsiveActionColumnWidth<
    INewsItem,
    NewsActionColumnKey
  >({
    rows: dataSource,
    buttonWidthMap: NEWS_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: getVisibleNewsActionKeys,
    getActionLabel: getNewsActionLabel,
    desktopConfig: NEWS_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: NEWS_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: NEWS_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });

  const columns: ColumnType<INewsItem>[] = [
    {
      title: t("CMS.newsManagement.table.pinned"),
      dataIndex: "pinned",
      key: "pinned",
      className: "text-ellipsis-pinned",
      render: (_: string, record: INewsItem) => {
        return (
          record?.pinned == "1" && (
            <span className="pinned">
              {t("CMS.newsManagement.labels.pinnedWithOrder", {
                order: (record.sort ?? 0) + 1,
              })}
            </span>
          )
        );
      },
    },
    {
      title: t("CMS.newsManagement.table.newsNo"),
      dataIndex: "newsNo",
      key: "newsNo",
      className: "text-ellipsis-newsNo",
    },
    {
      title: t("CMS.newsManagement.table.title"),
      dataIndex: "titleEn",
      className: "text-ellipsis-titleEn",
      key: "titleEn",
      render: (text: string) => {
        return (
          <Tooltip
            title={text}
            color={"#fff"}
            overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
            placement="topLeft"
            className="text-ellipsis-2"
          >
            {transformNoValueString(text)}
          </Tooltip>
        );
      },
    },
    {
      title: t("CMS.newsManagement.table.status"),
      dataIndex: "status",
      key: "status",
      className: "text-ellipsis-status",
      render: (_: string, record: INewsItem) => {
        const statusName = record.statusInfo?.name || "";
        const statusClass = getNewsStatusClass(record);
        return (
          <div className={`status-tag ${statusClass}`}>
            {statusName}
          </div>
        );
      },
    },
    {
      title: t("CMS.newsManagement.table.updatedBy"),
      dataIndex: "UpdatedBy",
      className: "text-ellipsis-UpdatedBy",
      key: "UpdatedBy",
      render: (_: string, record: INewsItem) => {
        return (
          <span className="update-by">{record.updateOnInfo?.name || ""}</span>
        );
      },
    },
    {
      title: t("CMS.newsManagement.table.publishTime"),
      dataIndex: "publishTime",
      key: "publishTime",
      className: "text-ellipsis-publishTime",
      sorter: true,
      render: (text: string, record: INewsItem) => {
        const statusCode = getNewsStatusCode(record);
        if (!PUBLISH_TIME_VISIBLE_STATUS_CODES.includes(statusCode)) {
          return "-";
        }
        return text ? moment(text).format("DD/MM/YYYY HH:mm") : "-";
      },
    },
    {
      title: t("CMS.newsManagement.table.lastUpdated"),
      dataIndex: "updateAt",
      key: "updateAt",
      className: "text-ellipsis-updateAt",
      sorter: true,
      render: (text: string) => {
        return text ? moment(text).format("DD/MM/YYYY HH:mm:ss") : "-";
      },
    },
    {
      title: t("CMS.newsManagement.table.actions"),
      className: "text-ellipsis-right",
      fixed: "right",
      width: newsActionColumnWidth,
      render: (_, record: INewsItem) => {
        const statusCode = getNewsStatusCode(record);

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
            label: t("CMS.newsManagement.actions.approve"),
            show: statusCode === NEWS_STATUS_CODE.pendingReview,
            permissionCode: "CMS.News.Approve",
            onClick: () => {
              ApproveNew(record.id)
                .then(() => {
                  CustomMessage.success(t("CMS.common.operationSuccessful"));
                  request();
                })
                .catch(() => {
                  CustomMessage.error(t("CMS.newsManagement.messages.operationFailed"));
                });
              // setCurrentTask(record)
              // approveModalRef.current?.show()
            },
          },
          {
            key: "reject",
            label: t("CMS.newsManagement.actions.reject"),
            show: statusCode === NEWS_STATUS_CODE.pendingReview,
            permissionCode: "CMS.News.Reject",
            onClick: () => {
              RejectPublishModalRef.current?.show();
              RejectPublishModalRef.current?.setId(record.id);
            },
          },
          {
            key: "edit",
            label: t("CMS.common.edit"),
            show: EDITABLE_STATUS_CODES.includes(statusCode),
            onClick: () => {
              // TODO:
              history.push(
                `/cms/NewsManagement/AddNewsManagement?id=${record.id}&type=edit`,
              );
            },
          },
          {
            key: "delete",
            label: t("CMS.newsManagement.actions.delete"),
            show: EDITABLE_STATUS_CODES.includes(statusCode),
            permissionCode: "CMS.News.Delete",
            onClick: () => {
              // TODO:
              setdelId(record.id);
              setdelVisible(true);
            },
          },
          {
            key: "unpublish",
            label: t("CMS.newsManagement.actions.unpublish"),
            show:
              statusCode === NEWS_STATUS_CODE.published ||
              statusCode === NEWS_STATUS_CODE.scheduled,
            permissionCode: "CMS.News.Unpublish",
            onClick: () => {
              // TODO:
              UnPublishNew(record.id).finally(() => {
                request();
              });
            },
          },
          {
            key: "duplicate",
            label: t("CMS.newsManagement.actions.duplicate"),
            show: true, //
            onClick: () => {
              history.push(
                `/cms/NewsManagement/AddNewsManagement?id=${record.id}&type=duplicate`,
              );
            },
          },
        ];

        //
        const visibleButtons = buttonConfigs.filter(
          (btn) =>  btn.show && (!btn.permissionCode || canRenderButton(btn.permissionCode)),
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
  ];

  const tableConfigs = useMemo<TableProps<INewsItem>>(() => {
    return {
      scroll: { x: 1000 },
      rowKey: (record: INewsItem) => record.id,
      columns,
      dataSource,
      onRow: (record: INewsItem) => ({
        onClick: (e) => {
          e.stopPropagation();
          history.push(
            `/cms/NewsManagement/NewsManagementDetail?id=${record.id}`,
            { details: record },
          );
        },
      }),
      onChange: (pagination, _f, sorter) => {
        const { order = SorterKeys.descend, field } =
          sorter as SorterResult<INewsItem>;
        const sortField = resolveNewsSortField(field as keyof INewsItem);
        request({
          pageSize: pagination.pageSize ?? 10,
          pageIndex: pagination.current ?? 1,
          ...transformSorterKeys<INewsItem>(
            sortField as keyof INewsItem,
            // default to ascend
            order as typeof SorterKeys.ascend,
          ),
        });
      },
    };
  }, [columns, dataSource]);
  const [Statuses, setStatuses] = useState<StatusOption[]>([]);
  const tableFilterConfigs = useMemo(() => {
    return [
      {
        label: t("CMS.common.search"),
        element: (
          <Input
            placeholder={t("CMS.common.search")}
            prefix={<Sousuo className="search-icon" />}
            key="input-keyword"
            className="news-range-Input"
            allowClear
          />
        ),
      },
      {
        label: t("CMS.newsManagement.table.status"),
        element: (
          <Select
            key="select-status"
            placeholder={t("CMS.common.placeholders.allStatuses")}
            options={Statuses}
            className="news-range-Input"
            allowClear
          />
        ),
      },
      {
        label: t("CMS.newsManagement.table.lastUpdated"),
        element: (
          <DatePicker.RangePicker
            key="range-updateTime"
            format={["DD/MM/YYYY"]}
            placeholder={[
              t("CMS.common.placeholders.UpdatedForm"),
              t("CMS.common.placeholders.UpdatedTo"),
            ]}
            className="news-range-picker"
          />
        ),
      },
      {
        label: t("CMS.newsManagement.table.publishTime"),
        element: (
          <DatePicker.RangePicker
            key="range-publishtime"
            format={["DD/MM/YYYY"]}
            placeholder={[
              t("CMS.common.placeholders.StartDate"),
              t("CMS.common.placeholders.EndDate"),
            ]}
            className="range-picker"
          />
        ),
      },
    ];
  }, [Statuses, t]);

  const getCountList = async (requestId?: number) => {
    const res = await getNewsCount();
    if (
      requestId !== undefined &&
      requestId !== latestRequestIdRef.current
    ) {
      return;
    }
    const countObj: Partial<INewsCount> = res?.data || DEFAULT_COUNT;
    const list = COUNT_ITEMS.map((item) => ({
      ...item,
      name: t(`CMS.newsManagement.counts.${item.key}`),
      value: countObj[item.key as keyof INewsCount] || 0,
    }));
    setNewsCount(list);
  };

  const request = async (
    config: NewsListRequestConfig = {
      pageIndex: 1,
      pageSize: 10,
    },
  ) => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    lastRequestConfigRef.current = config;
    const { keyword, status, publishtime, updateTime } =
      filterStore.getFieldsValue();

    const [publishtime1, publishtime2] = transformDateOnly(publishtime);
    const [updateTime1, updateTime2] = transformDateOnly(updateTime);
    const reqParams: IQueryNews = {
      publishtime1,
      publishtime2,
      updateTime1,
      updateTime2,
      keyWords: keyword || undefined,
      ...(status && status !== "" ? { status } : {}),
      ...config,
    };
    setLoading(true);
    try {
      const res = await getNewsList(reqParams);
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
      const statusOptions =
        res.data?.map((item) => {
          return {
            label: item.nameEn,
            value: item.code,
          };
        }) || [];

      if (statusOptions.length > 0) {
        setStatuses([
          {
            label: "All Statuses",
            value: "",
          },
          ...statusOptions,
        ]);
        // Set default value to "All Statuses" if status is not set
        // if (!filterStore.getFieldValue("status")) {
        //   filterStore.setFieldValue("status", "");
        // }
      }
    });
  };
  useEffect(() => {
    request();
    getStatuses();
  }, []);

  return (
    <div className="news-management-container">
      <CountPanel countList={newsCount} />
      <FilterTable
        containerCls="custom-table news-table cms-filter-table"
        {...tableConfigs}
        loading={loading}
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
          showTotal: (total: number) => <PaginationTotal label={t("common.total")} total={total} current={pageInfo.pageIndex} pageSize={pageInfo.pageSize} />,
          pageSizeOptions: ["10", "20", "50", "100"],
        }}
      />
      {keepAliveActivated && (
        <>
          <PinnedModal ref={pinnedModalRef} onCloseCb={request} />
          <RejectPublishModal ref={RejectPublishModalRef} onCloseCb={request} />
          <ConfirmModal
            visible={delVisible}
            type="danger"
            title={t("CMS.newsManagement.modals.deleteNews.title")}
            content={t("CMS.newsManagement.modals.deleteNews.content")}
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
