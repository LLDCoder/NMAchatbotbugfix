import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Input, Select, DatePicker, Space } from "antd";
import { useHistory } from "react-router-dom";
import Sousuo from "@/assets/icons/Sousuo";
import {
  CustomButton,
  ResponsiveFilterModal,
  SelectAllDropdown,
  TablePanel,
} from "@/components/common";
import type { ColumnsType } from "antd/es/table";
import type { SelectOption } from "@/components/common";
import PaginationTotal from "@/components/common/PaginationTotal";
import BellRingingIcon from "@/assets/images/BellRinging.svg";
import EnvelopeSimpleIcon from "@/assets/images/EnvelopeSimple.svg";
import ChatDotsIcon from "@/assets/images/ChatDots.svg";
import SortIcon from "@/assets/images/sort.png";
import FilterCountBadge, {
  countAppliedFilters,
} from "@/components/common/FilterCountBadge";
import {
  getMessageTemplateList,
  type GetTemplateListParams,
  getTypeDictionaries,
  type TypeDictionary,
} from "@/services/messageTemplate";
import "./index.less";
import moment from "moment";
import { debounce } from "lodash";
import { useTranslation } from "react-i18next";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";

interface IProtalTypeInfo {
  code: string;
  name: string;
}
interface IChannelInfo {
  code: string;
  name: string;
}
interface MessageTemplate {
  id: number;
  key: string;
  templateNo: string;
  templateName: string;
  modifiedBy: string;
  portal: string;
  role?: string;
  channels: string[];
  channelsInfo: IChannelInfo[];
  submissionTime: string;
  protalTypeInfo: IProtalTypeInfo[];
}

type MessageTemplateActionKey = "edit";
type MessageTemplateChannelCode = "1" | "2" | "3";

const MESSAGE_TEMPLATE_ACTION_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<MessageTemplateActionKey> = {};

const MESSAGE_TEMPLATE_CHANNEL_CODES: MessageTemplateChannelCode[] = ["1", "2", "3"];

const MESSAGE_TEMPLATE_CHANNEL_CODE_BY_VALUE: Record<string, MessageTemplateChannelCode> = {
  "1": "1",
  email: "1",
  "2": "2",
  sms: "2",
  "3": "3",
  inapp: "3",
  inportal: "3",
  popup: "3",
  portalmessage: "3",
  push: "3",
};

const MESSAGE_TEMPLATE_CHANNEL_ICONS: Record<MessageTemplateChannelCode, string> = {
  "1": EnvelopeSimpleIcon,
  "2": ChatDotsIcon,
  "3": BellRingingIcon,
};

const MESSAGE_TEMPLATE_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 0,
  padding: 32,
  minWidth: 80,
  maxWidth: 120,
};

const MESSAGE_TEMPLATE_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 0,
  padding: 24,
  minWidth: 72,
  maxWidth: 104,
};

const MESSAGE_TEMPLATE_ACTION_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};

const parseChannels = (value: string): string[] => {
  if (!value) return [];

  let tokens: string[] = [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      tokens = parsed.map((v) => String(v).toLowerCase());
    }
  } catch {
    tokens = value
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }

  const result: string[] = [];
  tokens.forEach((token) => {
    if (token === "1" || token === "email") {
      if (!result.includes("email")) result.push("email");
    } else if (token === "2" || token === "sms") {
      if (!result.includes("sms")) result.push("sms");
    } else if (token === "3" || token === "push" || token === "inapp") {
      if (!result.includes("push")) result.push("push");
    }
  });

  return result;
};

const getMessageTemplateChannelCode = (
  value?: string,
): MessageTemplateChannelCode | undefined => {
  const normalizedValue = value?.trim().toLowerCase().replace(/[\s_-]/g, "");
  return normalizedValue
    ? MESSAGE_TEMPLATE_CHANNEL_CODE_BY_VALUE[normalizedValue]
    : undefined;
};

const getMessageTemplateChannelCodes = (
  channels: string[],
  channelsInfo?: IChannelInfo[],
): MessageTemplateChannelCode[] => {
  const selectedCodes = new Set<MessageTemplateChannelCode>();
  const addChannelCode = (value?: string) => {
    const code = getMessageTemplateChannelCode(value);
    if (code) selectedCodes.add(code);
  };

  channels.forEach(addChannelCode);
  channelsInfo?.forEach((channel) => {
    addChannelCode(channel.code);
    addChannelCode(channel.name);
  });

  return MESSAGE_TEMPLATE_CHANNEL_CODES.filter((code) =>
    selectedCodes.has(code),
  );
};

const MessageTemplates: React.FC = () => {
  const { t } = useTranslation();
  const mt = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      opts != null
        ? String(t(`Settings.messageTemplates.${key}` as any, opts))
        : String(t(`Settings.messageTemplates.${key}` as any)),
    [t],
  );
  const history = useHistory();
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [portalFilter, setPortalFilter] = useState<string | undefined>(
    undefined,
  );
  const [channelFilter, setChannelFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftDateRange, setDraftDateRange] = useState<typeof dateRange>(null);
  const [draftPortalFilter, setDraftPortalFilter] = useState<
    string | undefined
  >(undefined);
  const [draftChannelFilter, setDraftChannelFilter] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [portalTypes, setPortalTypes] = useState<TypeDictionary[]>([]);
  const [channelTypes, setChannelTypes] = useState<TypeDictionary[]>([]);
  const [activationRevision, setActivationRevision] = useState(0);
  const latestRequestIdRef = useRef(0);
  const getVisibleMessageTemplateActions = useCallback(
    () => ["edit"] as const,
    [],
  );
  const getMessageTemplateActionLabel = useCallback(
    () => mt("actions.edit"),
    [mt],
  );
  const messageTemplateActionColumnWidth = useResponsiveActionColumnWidth<
    MessageTemplate,
    MessageTemplateActionKey
  >({
    rows: dataSource,
    buttonWidthMap: MESSAGE_TEMPLATE_ACTION_WIDTH_MAP,
    getVisibleActions: getVisibleMessageTemplateActions,
    getActionLabel: getMessageTemplateActionLabel,
    desktopConfig: MESSAGE_TEMPLATE_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: MESSAGE_TEMPLATE_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: MESSAGE_TEMPLATE_ACTION_TEXT_MEASURE_CONFIG,
  });

  // The filter modal edits the date range, portal and channel.
  const appliedFilterCount = countAppliedFilters([
    dateRange,
    portalFilter,
    channelFilter,
  ]);

  const handleOpenFilterModal = () => {
    setDraftDateRange(dateRange);
    setDraftPortalFilter(portalFilter);
    setDraftChannelFilter(channelFilter);
    setFilterModalVisible(true);
  };

  const handleApplyFilterModal = () => {
    setPageIndex(1);
    setDateRange(draftDateRange);
    setPortalFilter(draftPortalFilter);
    setChannelFilter(draftChannelFilter);
    setFilterModalVisible(false);
  };

  const handleResetFilters = () => {
    debouncedSearch.cancel();
    setKeyword("");
    setSearchKeyword("");
    setDateRange(null);
    setPortalFilter(undefined);
    setChannelFilter([]);
    setDraftDateRange(null);
    setDraftPortalFilter(undefined);
    setDraftChannelFilter([]);
    setPageIndex(1);
  };

  useKeepAliveActivated({
    onActivated: () => {
      setActivationRevision((revision) => revision + 1);
    },
    onDeactivated: () => {
      latestRequestIdRef.current += 1;
      setLoading(false);
    },
  });

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchKeyword(value);
      setPageIndex(1);
    }, 500),
    [],
  );

  useEffect(() => {
    const fetchDictionaries = async () => {
      try {
        const [portalRes, channelRes] = await Promise.all([
          getTypeDictionaries("TemplateProtalType"),
          getTypeDictionaries("TemplateChannels"),
        ]);

        const portalArray = Array.isArray(portalRes)
          ? portalRes
          : (portalRes as any)?.data || [];
        const channelArray = Array.isArray(channelRes)
          ? channelRes
          : (channelRes as any)?.data || [];

        setPortalTypes(portalArray);
        setChannelTypes([...channelArray]);
      } catch (error) {
        console.error("Failed to fetch template dictionaries", error);
        setPortalTypes([]);
        setChannelTypes([]);
      }
    };

    fetchDictionaries();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      setLoading(true);
      try {
        const channelsParam: string[] = [];
        if (channelFilter?.includes("email")) {
          channelsParam.push("1");
        }
        if (channelFilter?.includes("sms")) {
          channelsParam.push("2");
        }
        if (channelFilter?.includes("push")) {
          channelsParam.push("3");
        }

        const params: GetTemplateListParams = {
          type: "1",
          pageIndex,
          pageSize,
          keyWorld: searchKeyword || null,
          status: null,
          channels:
            channelsParam.length > 0 ? channelsParam.toString() : undefined,
          protalType: portalFilter || null,
          startDate:
            dateRange && dateRange[0]
              ? dateRange[0].format("YYYY-MM-DD")
              : undefined,
          endDate:
            dateRange && dateRange[1]
              ? dateRange[1].format("YYYY-MM-DD")
              : undefined,
        };
        const res = await getMessageTemplateList(params);
        if (requestId !== latestRequestIdRef.current) return;
        const list = res.data?.items || [];
        setTotal(res.data?.totalItems || 0);
        const mapped: MessageTemplate[] = list.map((item) => {
          const channels = parseChannels(item.channels);
          return {
            ...item,
            id: item.id,
            key: String(item.id),
            templateNo: item.templateCode,
            templateName: item.templateName,
            modifiedBy: item.updateOnInfo?.name || "",
            portal: item.protalType,
            role: item.role,
            channels,
            submissionTime: moment(item.pushTime).format(
              "DD-MM-YYYY HH:mm:ss",
            ),
            protalTypeInfo: item.protalTypeInfo,
            channelsInfo: item.channelsInfo || [],
          };
        });
        setDataSource(mapped);
      } catch (error) {
        if (requestId !== latestRequestIdRef.current) return;
        console.error(error);
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [
    activationRevision,
    searchKeyword,
    channelFilter,
    portalFilter,
    dateRange,
    pageIndex,
    pageSize,
  ]);

  const channelSelectOptions = useMemo((): SelectOption[] => {
    const items: SelectOption[] = [];
    channelTypes.forEach((item) => {
      if (item.code === "1") {
        items.push({ label: item.nameEn, value: "email" });
      } else if (item.code === "2") {
        items.push({ label: item.nameEn, value: "sms" });
      } else if (item.code === "3") {
        items.push({ label: item.nameEn, value: "push" });
      }
    });

    if (!items.length) {
      items.push(
        { label: mt("channels.email"), value: "email" },
        { label: mt("channels.sms"), value: "sms" },
        { label: mt("channels.push"), value: "push" },
      );
    }

    return items;
  }, [channelTypes, mt]);

  const renderChannels = useCallback(
    (channels: string[], record: MessageTemplate) => {
      const channelCodes = getMessageTemplateChannelCodes(
        channels,
        record.channelsInfo,
      );

      return (
        <Space size={12}>
          {channelCodes.length > 0
            ? channelCodes.map((code) => (
                <span key={code}>
                  <img src={MESSAGE_TEMPLATE_CHANNEL_ICONS[code]} alt="" />
                </span>
              ))
            : "-"}
        </Space>
      );
    },
    [],
  );

  const columns: ColumnsType<MessageTemplate> = useMemo(
    () => [
      {
        title: mt("table.templateNo"),
        dataIndex: "templateCode",
        key: "templateCode",
      },
      {
        title: mt("table.templateName"),
        dataIndex: "templateName",
        key: "templateName",
      },
      {
        title: mt("table.modifiedBy"),
        dataIndex: "modifiedBy",
        key: "modifiedBy",
      },
      {
        title: mt("table.portal"),
        dataIndex: "portal",
        key: "portal",
        render: (_, record) => {
          return record.protalTypeInfo?.map((item) => item.name)?.join(",");
        },
      },
      {
        title: mt("table.channels"),
        dataIndex: "channels",
        key: "channels",
        render: renderChannels,
      },
      {
        title: mt("table.lastUpdateTime"),
        dataIndex: "updateAt",
        key: "updateAt",
        render: (value) => {
          return value ? moment(value).format("DD/MM/YYYY HH:mm:ss") : "-";
        },
      },
      {
        title: mt("table.action"),
        key: "action",
        width: messageTemplateActionColumnWidth,
        render: (_, record) => (
          <a
            className="action-link"
            onClick={(e) => {
              e.stopPropagation();
              history.push(`/communications/message-templates/EditTemplate?id=${record.id}`);
            }}
          >
            {mt("actions.edit")}
          </a>
        ),
      },
    ],
    [mt, history, messageTemplateActionColumnWidth, renderChannels],
  );

  return (
    <div className="messageTemplates">
      <div className="header responsive-filter-toolbar">
        <div className="filters responsive-filter-toolbar__controls">
          <Input
            placeholder={mt("filters.search")}
            prefix={<Sousuo className="search-icon" />}
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              debouncedSearch(e.target.value);
            }}
            className="search-input responsive-filter-toolbar__field responsive-filter-toolbar__field--search"
            allowClear
          />

          <DatePicker.RangePicker
            placeholder={[mt("filters.startTime"), mt("filters.endTime")]}
            value={dateRange}
            format={"DD-MM-YYYY"}
            onChange={(e) => {
              setPageIndex(1);
              setDateRange(e);
            }}
            className="date-range responsive-filter-toolbar__field message-templates-filter-toolbar__field--secondary"
          />
          <Select
            placeholder={mt("filters.allPortals")}
            value={portalFilter}
            onChange={(e) => {
              setPageIndex(1);
              setPortalFilter(e);
            }}
            className="filter-select responsive-filter-toolbar__field message-templates-filter-toolbar__field--secondary"
            options={[
              { label: mt("filters.allPortals"), value: "" },
              ...portalTypes.map((item) => ({
                label: item.nameEn,
                value: item.code,
              })),
            ]}
            allowClear
          />
          <SelectAllDropdown
            placeholder={mt("filters.allChannels")}
            value={channelFilter || []}
            onChange={(val) => {
              setPageIndex(1);
              setChannelFilter(val.map(String));
            }}
            className="filter-select2 responsive-filter-toolbar__field message-templates-filter-toolbar__field--overflow"
            options={channelSelectOptions}
            showSearch
            maxTagCount={2}
          />
          <CustomButton
            variant="outline"
            customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__filter-button message-templates-filter-toolbar__filter-button filter-trigger-with-count"
            onClick={handleOpenFilterModal}
          >
            {String(t("common.filter"))}
            <img className="filter-trigger-funnel" src={SortIcon} alt="" />
            <FilterCountBadge count={appliedFilterCount} />
          </CustomButton>
          <CustomButton
            text={String(t("common.reset"))}
            variant="outline"
            customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__reset-button message-templates-filter-toolbar__reset-button"
            onClick={handleResetFilters}
          />
        </div>
      </div>

      <ResponsiveFilterModal
        visible={filterModalVisible}
        onCancel={() => setFilterModalVisible(false)}
        onApply={handleApplyFilterModal}
        fields={[
          {
            key: "dateRange",
            label: mt("table.lastUpdateTime"),
            compactOnly: true,
            element: (
              <DatePicker.RangePicker
                placeholder={[mt("filters.startTime"), mt("filters.endTime")]}
                value={draftDateRange}
                format="DD-MM-YYYY"
                onChange={setDraftDateRange}
                className="date-range"
              />
            ),
          },
          {
            key: "portal",
            label: mt("table.portal"),
            compactOnly: true,
            element: (
              <Select
                placeholder={mt("filters.allPortals")}
                value={draftPortalFilter}
                onChange={setDraftPortalFilter}
                options={portalTypes.map((item) => ({
                  label: item.nameEn,
                  value: item.code,
                }))}
                allowClear
              />
            ),
          },
          {
            key: "channels",
            label: mt("table.channels"),
            element: (
              <SelectAllDropdown
                placeholder={mt("filters.allChannels")}
                value={draftChannelFilter}
                onChange={(values) => setDraftChannelFilter(values.map(String))}
                options={channelSelectOptions}
                showSearch
                maxTagCount={2}
              />
            ),
          },
        ]}
      />

      <TablePanel
        className="message-table"
        tableProps={{
          rowKey: "key",
          columns,
          dataSource: dataSource,
          loading,
          pagination: {
            total,
            pageSize,
            current: pageIndex,
            showSizeChanger: true,
            showTotal: (value) => <PaginationTotal label={t("common.total")} total={value} current={pageIndex} pageSize={pageSize} />,
            pageSizeOptions: ["10", "20", "50", "100"],
            onChange: (page, size) => {
              setPageIndex(page);
              setPageSize(size);
            },
          },
        }}
      />
    </div>
  );
};

export default MessageTemplates;
