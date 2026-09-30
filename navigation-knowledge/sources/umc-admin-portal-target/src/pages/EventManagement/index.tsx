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
  transformSorterKeys,
} from "@/utils/transform";
import total from "@/assets/images/total.svg";
import published from "@/assets/images/published.svg";
import review from "@/assets/images/reviewnew.svg";
import draft from "@/assets/images/draftnew.svg";
import rejected from "@/assets/images/fileRejectednew.svg";
import unpublished from "@/assets/images/fileDashednew.svg";
import scheduled from "@/assets/images/scheduled.svg";
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
  getEventCount,
  getEventList,
  getNewsTypeDictionaries,
  ApproveEvent,
  type INewsItem,
  type INewsCount,
  type IQueryEvent,
  DeleteEventAsync,
  UnPublishEvent,
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
  scheduled: 0,
};

const EVENT_STATUS_CODE = {
  pendingReview: "1",
  unpublished: "2",
  published: "3",
  rejected: "4",
  draft: "5",
  scheduled: "6",
} as const;

const EVENT_STATUS_CODE_CLASS: Record<string, string> = {
  "1": "PendingReview",
  "2": "Unpublished",
  "3": "Published",
  "4": "Rejected",
  "5": "Draft",
  "6": "Scheduled",
};

const EVENT_STATUS_VALUE_CODE: Record<string, string> = {
  "Pending Review": EVENT_STATUS_CODE.pendingReview,
  PendingReview: EVENT_STATUS_CODE.pendingReview,
  Unpublished: EVENT_STATUS_CODE.unpublished,
  Published: EVENT_STATUS_CODE.published,
  Rejected: EVENT_STATUS_CODE.rejected,
  Draft: EVENT_STATUS_CODE.draft,
  Scheduled: EVENT_STATUS_CODE.scheduled,
};

const PUBLISH_TIME_VISIBLE_STATUS_CODES: string[] = [
  EVENT_STATUS_CODE.published,
  EVENT_STATUS_CODE.unpublished,
  EVENT_STATUS_CODE.scheduled,
];

const EDITABLE_STATUS_CODES: string[] = [
  EVENT_STATUS_CODE.draft,
  EVENT_STATUS_CODE.rejected,
  EVENT_STATUS_CODE.unpublished,
];

type EventActionColumnKey =
  | "approve"
  | "reject"
  | "edit"
  | "delete"
  | "unpublish"
  | "duplicate"
  | "more";

const EVENT_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<EventActionColumnKey> = {
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

const EVENT_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 112,
  maxWidth: 220,
};

const EVENT_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 112,
  maxWidth: 196,
};

const EVENT_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};

const normalizeStatusValue = (value?: string | number | null) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const getEventStatusCode = (record: INewsItem) => {
  const statusInfo = record.statusInfo;
  const statusCode = normalizeStatusValue(statusInfo?.code);
  if (statusCode && EVENT_STATUS_CODE_CLASS[statusCode]) {
    return statusCode;
  }

  const nameEn = normalizeStatusValue(statusInfo?.nameEn);
  if (nameEn && EVENT_STATUS_VALUE_CODE[nameEn]) {
    return EVENT_STATUS_VALUE_CODE[nameEn];
  }

  const name = normalizeStatusValue(statusInfo?.name);
  if (name && EVENT_STATUS_VALUE_CODE[name]) {
    return EVENT_STATUS_VALUE_CODE[name];
  }

  return "";
};

const getEventStatusClass = (record: INewsItem) => {
  return EVENT_STATUS_CODE_CLASS[getEventStatusCode(record)] || "";
};

type SelectOption = {
  label: string;
  value: string;
};

type EventListRequestConfig = Pick<IQueryEvent, "pageIndex" | "pageSize"> & {
  sortBy?: string;
  sortDirection?: 0 | 1;
};

function displayCell(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number" && Number.isNaN(value)) return "-";
  const str = typeof value === "string" ? value : String(value);
  return str.trim() === "" ? "-" : str;
}

export default function EventManagement() {
  const { t } = useTranslation();
  const [filterStore] = useFilter();
  const [pageInfo, setPage] = usePagination();
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<INewsItem[]>([]);
  const [newsCount, setNewsCount] = useState<IItem[]>([]);
  const RejectPublishModalRef = useRef<IRejectModalRef>(null);
  const { canRenderButton } = useButtonPermission("/cms/EventManagement");
  const history = useHistory();
  const [delVisible, setdelVisible] = useState(false);
  const [delId, setdelId] = useState<number>(0);
  const latestRequestIdRef = useRef(0);
  const lastRequestConfigRef = useRef<EventListRequestConfig>({
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
    DeleteEventAsync({ id: delId })
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
            history.push("/cms/EventManagement/addEventManagement");
          }}
          text={t("CMS.eventManagement.actions.addNew")}
        />
      </div>
    );
  };

  const getVisibleEventActionKeys = (record: INewsItem): EventActionColumnKey[] => {
    const statusCode = getEventStatusCode(record);
    const actionConfigs: {
      key: Exclude<EventActionColumnKey, "more">;
      show: boolean;
      permissionCode?: string;
    }[] = [
      {
        key: "approve",
        show: statusCode === EVENT_STATUS_CODE.pendingReview,
        permissionCode: "CMS.Event.Approve",
      },
      {
        key: "reject",
        show: statusCode === EVENT_STATUS_CODE.pendingReview,
        permissionCode: "CMS.Event.Reject",
      },
      {
        key: "edit",
        show: EDITABLE_STATUS_CODES.includes(statusCode),
      },
      {
        key: "delete",
        show: EDITABLE_STATUS_CODES.includes(statusCode),
        permissionCode: "CMS.Event.Delete",
      },
      {
        key: "unpublish",
        show:
          statusCode === EVENT_STATUS_CODE.published ||
          statusCode === EVENT_STATUS_CODE.scheduled,
        permissionCode: "CMS.Event.Unpublish",
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

  const getEventActionLabel = (actionKey: EventActionColumnKey) => {
    const actionLabelMap: Partial<Record<EventActionColumnKey, string>> = {
      approve: t("CMS.eventManagement.actions.approve"),
      reject: t("CMS.eventManagement.actions.reject"),
      edit: t("CMS.common.edit"),
      delete: t("CMS.eventManagement.actions.delete"),
      unpublish: t("CMS.eventManagement.actions.unpublish"),
      duplicate: t("CMS.eventManagement.actions.duplicate"),
    };

    return actionLabelMap[actionKey];
  };

  const eventActionColumnWidth = useResponsiveActionColumnWidth<
    INewsItem,
    EventActionColumnKey
  >({
    rows: dataSource,
    buttonWidthMap: EVENT_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: getVisibleEventActionKeys,
    getActionLabel: getEventActionLabel,
    desktopConfig: EVENT_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: EVENT_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: EVENT_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });

  const columns: ColumnType<INewsItem>[] = [
    {
      title: t("CMS.eventManagement.table.eventNo"),
      dataIndex: "eventNo",
      key: "eventNo",
      width: 130,
      render: (text: string) => {
        const shown = displayCell(text);
        if (shown === "-") return shown;
        return <span className="event-no-cell">{shown}</span>;
      },
    },
    {
      title: t("CMS.eventManagement.table.title"),
      dataIndex: "titleEn",
      key: "titleEn",
      width: 150,
      render: (text: string) => {
        const shown = displayCell(text);
        return (
          <Tooltip
            title={shown === "-" ? undefined : text}
            color={"#fff"}
            overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
            placement="topLeft"
            className="text-ellipsis-2"
          >
            {shown}
          </Tooltip>
        );
      },
    },
    {
      title: t("CMS.eventManagement.table.eventPeriod"),
      dataIndex: "eventNo",
      key: "eventNo",
      width: 150,
      render: (_text: string, record: INewsItem) => {
        const hasStart = Boolean(record.startTime);
        const hasEnd = Boolean(record.endTime);
        if (!hasStart && !hasEnd) return "-";
        const startTime = hasStart
          ? moment(record.startTime as string).format("DD/MM/YYYY")
          : "-";
        const endTime = hasEnd
          ? moment(record.endTime as string).format("DD/MM/YYYY")
          : "-";
        return `${startTime} ~ ${endTime}`;
      },
    },
    {
      title: t("CMS.eventManagement.table.registrationTypes"),
      dataIndex: "eventNo",
      key: "eventNo",
      width: 180,
      render: (_text: string, record: INewsItem) => {
        if (record.online && record.onsite) {
          return t("CMS.eventManagement.registrationTypes.both");
        }
        if (record.online) {
          return t("CMS.eventManagement.registrationTypes.online");
        }
        if (record.onsite) {
          return t("CMS.eventManagement.registrationTypes.onSite");
        }
        return "-";
      },
    },
        {
      title: t("CMS.eventManagement.table.status"),
      dataIndex: "status",
      key: "status",
      width: 150,
      render: (_text: string, record: INewsItem) => {
        const name = record.statusInfo?.name;
        const shown = displayCell(name);
        if (shown === "-") return shown;
        return (
          <div className={`status-tag ${getEventStatusClass(record)}`}>
            {shown}
          </div>
        );
      },
    },
    {
      title: t("CMS.eventManagement.table.updatedBy"),
      dataIndex: "UpdatedBy",
      key: "UpdatedBy",
      width: 180,
      render: (_text: string, record: INewsItem) => {
        return (
          <span className="update-by">
            {displayCell(record.updateOnInfo?.name)}
          </span>
        );
      },
    },
    {
      title: t("CMS.eventManagement.table.publishTime"),
      dataIndex: "publishTime",
      key: "publishTime",
      width: 150,
      sorter: true,
      render: (text: string, record: INewsItem) => {
        const statusCode = getEventStatusCode(record);
        if (!PUBLISH_TIME_VISIBLE_STATUS_CODES.includes(statusCode)) {
          return "-";
        }
        if (text == null || String(text).trim() === "") return "-";
        return moment(text).format("DD/MM/YYYY HH:mm");
      },
    },
    {
      title: t("CMS.eventManagement.table.lastUpdated"),
      dataIndex: "updateAt",
      key: "updateAt",
      width: 180,
      sorter: true,
      render: (text: string) => {
        if (text == null || String(text).trim() === "") return "-";
        return moment(text).format("DD/MM/YYYY HH:mm:ss");
      },
    },
    {
      title: t("CMS.eventManagement.table.actions"),
      fixed: "right",
      width: eventActionColumnWidth,
      render: (_, record: INewsItem) => {
        const statusCode = getEventStatusCode(record);

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
            label: t("CMS.eventManagement.actions.approve"),
            show: statusCode === EVENT_STATUS_CODE.pendingReview,
            permissionCode: "CMS.Event.Approve",
            onClick: () => {
              ApproveEvent(record.id)
                .then(() => {
                  CustomMessage.success(t("CMS.common.operationSuccessful"));
                  request();
                })
                .catch(() => {
                  CustomMessage.error(t("CMS.eventManagement.messages.operationFailed"));
                });
              // setCurrentTask(record)
              // approveModalRef.current?.show()
            },
          },
          {
            key: "reject",
            label: t("CMS.eventManagement.actions.reject"),
            show: statusCode === EVENT_STATUS_CODE.pendingReview,
            permissionCode: "CMS.Event.Reject",
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
                `/cms/EventManagement/addEventManagement?id=${record.id}&type=edit`,
              );
            },
          },
          {
            key: "delete",
            label: t("CMS.eventManagement.actions.delete"),
            show: EDITABLE_STATUS_CODES.includes(statusCode),
            permissionCode: "CMS.Event.Delete",
            onClick: () => {
              // TODO:
              setdelId(record.id);
              setdelVisible(true);
            },
          },
          {
            key: "unpublish",
            label: t("CMS.eventManagement.actions.unpublish"),
            show:
              statusCode === EVENT_STATUS_CODE.published ||
              statusCode === EVENT_STATUS_CODE.scheduled,
            permissionCode: "CMS.Event.Unpublish",

            onClick: () => {
              // TODO:
              UnPublishEvent(record.id).finally(() => {
                request();
              });
            },
          },
          {
            key: "duplicate",
            label: t("CMS.eventManagement.actions.duplicate"),
            show: true, //
            onClick: () => {
              history.push(
                `/cms/EventManagement/addEventManagement?id=${record.id}&type=duplicate`,
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
            `/cms/EventManagement/EventManagementDetail?id=${record.id}`,
            { details: record },
          );
        },
      }),
      onChange: (pagination, _f, sorter) => {
        const { order = SorterKeys.descend, field } =
          sorter as SorterResult<INewsItem>;
        request({
          pageSize: pagination.pageSize ?? 1,
          pageIndex: pagination.current ?? 10,
          ...transformSorterKeys<INewsItem>(
            field as keyof INewsItem,
            // default to ascend
            order as typeof SorterKeys.ascend,
          ),
        });
      },
    };
  }, [columns, dataSource]);
  const [Statuses, setStatuses] = useState<SelectOption[]>([]);
  const [RegistrationType, setRegistrationType] = useState<SelectOption[]>([]);
  const tableFilterConfigs = useMemo(() => {
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
        label: t("CMS.eventManagement.table.status"),
        element: (
          <Select
            key="select-status"
            placeholder={t("CMS.eventManagement.placeholders.allStatuses")}
            className="select-style"
            options={Statuses}
            allowClear
          />
        ),
      },
      {
        label: t("CMS.eventManagement.filters.eventPeriod"),
        element: (
          <DatePicker.RangePicker
            key="range-time"
            format={["DD/MM/YYYY"]}
            placeholder={[
              t("CMS.eventManagement.placeholders.eventstartTime"),
              t("CMS.eventManagement.placeholders.eventendTime"),
            ]}
            className="range-picker"
          />
        ),
      },
      {
        label: t("CMS.eventManagement.filters.registrationType"),
        element: (
          <Select
            key="select-EventType"
            placeholder={t("CMS.eventManagement.placeholders.registrationType")}
            className="select-style"
            options={RegistrationType}
            allowClear
            // defaultValue=""
          />
        ),
      },
      {
        label: t("CMS.eventManagement.filters.publishTime"),
        element: (
          <DatePicker.RangePicker
            key="range-publishtime"
            format={["DD/MM/YYYY"]}
            placeholder={[
              t("CMS.eventManagement.placeholders.startTime"),
              t("CMS.eventManagement.placeholders.endTime"),
            ]}
            className="range-picker"
          />
        ),
      },
      {
        label: t("CMS.eventManagement.table.lastUpdated"),
        element: (
          <DatePicker.RangePicker
            key="range-updateTime"
            format={["DD/MM/YYYY"]}
            placeholder={[
              t("CMS.eventManagement.placeholders.startTime"),
              t("CMS.eventManagement.placeholders.endTime"),
            ]}
            className="range-picker"
          />
        ),
      },
    ];
  }, [RegistrationType, Statuses, t]);

  const getCountList = async (requestId?: number) => {
    const res = await getEventCount();
    if (
      requestId !== undefined &&
      requestId !== latestRequestIdRef.current
    ) {
      return;
    }
    const countObj: Partial<INewsCount> = res?.data || DEFAULT_COUNT;
    const list = COUNT_ITEMS.map((item) => ({
      ...item,
      name: t(`CMS.eventManagement.counts.${item.key}`),
      value: countObj[item.key as keyof INewsCount] || 0,
    }));
    setNewsCount(list);
  };

  const request = async (
    config: EventListRequestConfig = {
      pageIndex: 1,
      pageSize: 10,
    },
  ) => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    lastRequestConfigRef.current = config;
    const { time, keyword, status, updateTime, publishtime, EventType } =
      filterStore.getFieldsValue();
    const [stime, etime] = transformDateOnly(time);
    const [publishtime1, publishtime2] = transformDateOnly(publishtime);
    const [updateTime1, updateTime2] = transformDateOnly(updateTime);
    const reqParams: IQueryEvent = {
      stime,
      etime,
      keyWords: keyword || undefined,
      status: status || undefined,
      publishtime1,
      publishtime2,
      EventType,
      ...config,
    };
    setLoading(true);
    try {
      const res = await getEventList({
        ...reqParams,
        updateTime1,
        updateTime2,
      });
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
          label: "All Statuses",
          value: "",
        },
        ...res.data.map((item) => {
          return {
            label: item.nameEn,
            value: item.code,
          };
        }),
      ]);
    });
    setRegistrationType([
      {
        label: "All Registration Type",
        value: "",
      },
      {
        label: "On-Site & Online",
        value: "1,2",
      },
      {
        label: "On-site",
        value: "1",
      },
      {
        label: "Online",
        value: "2",
      },
      {
        label: "No Registration",
        value: "-1",
      },
    ]);
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
            title={t("CMS.eventManagement.modals.deleteEvent.title")}
            content={t("CMS.eventManagement.modals.deleteEvent.content")}
            cancelText={t("common.cancel")}
            confirmText={t("common.confirm")}
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
