import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import Sousuo from "@/assets/icons/Sousuo";
import {
  Input,
  DatePicker,
  TreeSelect,
  Select,
  Modal,
  Spin,
  Tooltip,
} from "antd";
import { DownOutlined, MoreOutlined, UpOutlined } from "@ant-design/icons";
import { useHistory } from "react-router-dom";
import {
  TablePanel,
  CustomButton,
  ConfirmModal,
  CustomMessage,
} from "@/components/common";
import AdaptiveActionGroup, {
  type AdaptiveActionItem,
} from "@/components/common/AdaptiveActionGroup";
import type { ColumnsType } from "antd/es/table";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import PaginationTotal from "@/components/common/PaginationTotal";
import {
  getMessageTemplateList,
  type GetTemplateListResponse,
  type GetTemplateListParams,
  getTypeDictionaries,
  type TypeDictionary,
  getUserTypes,
  unpublishBroadcastTemplate,
} from "@/services/messageTemplate";
import { getDepartments, type DepartmentItem } from "@/services/department";
import moment, { type Moment } from "moment";
import "./index.less";
import { debounce } from "lodash";
import { useTranslation } from "react-i18next";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import { fromApi } from "@/utils/gstTime";
import SortIcon from "@/assets/images/sort.png";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";
import emptyIcon from "@/assets/images/empty.svg";
import EnvelopeSimpleIcon from "@/assets/images/EnvelopeSimple.svg";
import ChatDotsIcon from "@/assets/images/ChatDots.svg";
import BellRingingIcon from "@/assets/images/BellRinging.svg";
import { BROADCAST_LIST_FORCE_REFRESH_EVENT } from "./refreshEvent";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import { canRenderButton, type PermissionNode } from "@/routes/access";
import { useUserStore } from "@/store/user";
import { isSuccessfulBroadcastResponse } from "@/pages/BroadcastEdit/saveResponse";

interface BroadcastItem {
  id: string;
  key: string;
  broadcastNo: string;
  title: string;
  portal: string;
  recipients: string;
  status: number | string | null;
  publishedBy: string;
  publishTime: string;
  pushTime?: string;
  expireTime?: string;
  channels?: string;
  channelsInfo?: Array<{ code?: string; name?: string }>;
  createOnInfo?: { code?: string; name?: string };
  updateOnInfo?: { code?: string; name?: string };
  userTypeCodeInfo?: Array<{ code: string; name: string }>;
  departmentsInfo?: Array<{ id: number; nameEn: string; name?: string }>;
}
type StatusOption = TypeDictionary & { label: string; value: string };

interface RecipientTreeNode {
  title: string;
  value: string;
  selectable?: boolean;
  children?: RecipientTreeNode[];
}

interface PortalInfo {
  code?: string;
  name?: string;
}

type BroadcastChannelCode = "1" | "2" | "3";
type BroadcastActionKey = "duplicate" | "unpublish" | "more";

const BROADCAST_CHANNEL_CODES: BroadcastChannelCode[] = ["1", "2", "3"];
const BROADCAST_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<BroadcastActionKey> = {
  more: {
    default: 32,
    compact: 32,
  },
};
const BROADCAST_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 112,
  maxWidth: 240,
};
const BROADCAST_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 104,
  maxWidth: 216,
};
const BROADCAST_ACTION_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};
const BROADCAST_CHANNEL_CODE_BY_VALUE: Record<string, BroadcastChannelCode> = {
  "1": "1",
  email: "1",
  "2": "2",
  sms: "2",
  "3": "3",
  inapp: "3",
  inportal: "3",
  popup: "3",
  push: "3",
};
const BROADCAST_CHANNEL_ICONS: Record<
  BroadcastChannelCode,
  { src: string; labelKey: string }
> = {
  "1": { src: EnvelopeSimpleIcon, labelKey: "channels.email" },
  "2": { src: ChatDotsIcon, labelKey: "channels.sms" },
  "3": { src: BellRingingIcon, labelKey: "channels.inPortal" },
};

const USER_TYPE_PREFIX = "userType:";
const DEPARTMENT_PREFIX = "department:";
const MAX_TIMEOUT_MS = 2_147_483_647;

const getBroadcastChannelCode = (value?: string): BroadcastChannelCode | undefined => {
  const normalizedValue = value?.trim().toLowerCase().replace(/[\s_-]/g, "");
  return normalizedValue ? BROADCAST_CHANNEL_CODE_BY_VALUE[normalizedValue] : undefined;
};

const getBroadcastChannelCodes = (record: BroadcastItem): BroadcastChannelCode[] => {
  const selectedCodes = new Set<BroadcastChannelCode>();
  const addChannelCode = (value?: string) => {
    const code = getBroadcastChannelCode(value);
    if (code) selectedCodes.add(code);
  };

  record.channels?.split(",").forEach(addChannelCode);
  record.channelsInfo?.forEach((channel) => {
    addChannelCode(channel.code);
    addChannelCode(channel.name);
  });

  return BROADCAST_CHANNEL_CODES.filter((code) => selectedCodes.has(code));
};

const formatPortalName = (portals?: PortalInfo[]) => {
  const portalNames = portals
    ?.map((portal) => {
      const name = portal.name?.trim();
      if (!name) return "";

      const normalizedName = name.toLowerCase();
      if (
        portal.code === "1" ||
        normalizedName === "admin" ||
        normalizedName === "admin portal"
      ) {
        return "Admin Portal";
      }

      if (
        normalizedName === "customer" ||
        normalizedName === "customer portal"
      ) {
        return "Customer Portal";
      }

      return name;
    })
    .filter(Boolean);

  return portalNames?.join(", ") || "-";
};

const isGuidLike = (value?: string) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));

const displayPublishedByName = (record: BroadcastItem) => {
  const name = record.updateOnInfo?.name || record.createOnInfo?.name;
  return isGuidLike(name) ? "-" : name || "-";
};

const extractCollection = <T,>(response: unknown): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (!response || typeof response !== "object") return [];
  const envelope = response as { data?: unknown; items?: unknown };
  if (Array.isArray(envelope.items)) return envelope.items as T[];
  if (Array.isArray(envelope.data)) return envelope.data as T[];
  if (envelope.data && typeof envelope.data === "object") {
    const data = envelope.data as { items?: unknown };
    if (Array.isArray(data.items)) return data.items as T[];
  }
  return [];
};

const Broadcast: React.FC = () => {
  const { t } = useTranslation();
  const bl = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      opts != null
        ? String(t(`Settings.broadcast.list.${key}` as any, opts))
        : String(t(`Settings.broadcast.list.${key}` as any)),
    [t]
  );
  const history = useHistory();
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [recipientFilter, setRecipientFilter] = useState<string[]>([]);
  const [recipientDropdownOpen, setRecipientDropdownOpen] = useState(false);
  const [userTypeFilter, setUserTypeFilter] = useState<string[]>([]);
  const [departmentIdsFilter, setDepartmentIdsFilter] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<
    [Moment | null, Moment | null] | null
  >(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftRecipientFilter, setDraftRecipientFilter] = useState<string[]>(
    []
  );
  const [draftStatusFilter, setDraftStatusFilter] = useState<string | null>(
    null
  );
  const [draftDateRange, setDraftDateRange] = useState<
    [Moment | null, Moment | null] | null
  >(null);
  const [isCompactToolbar, setIsCompactToolbar] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1439.98px)").matches
  );
  const [dataSource, setDataSource] = useState<BroadcastItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [statusTypes, setStatusTypes] = useState<StatusOption[]>([]);
  const [recipientTreeData, setRecipientTreeData] = useState<
    RecipientTreeNode[]
  >([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [recipientsLoadFailed, setRecipientsLoadFailed] = useState(false);
  const [publishVisible, setPublishVisible] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<any | null>(null);
  const permissions = useUserStore(
    (state) => state.userInfo?.listSysPermission || [],
  ) as PermissionNode[];
  const canPublishBroadcast = useMemo(
    () =>
      canRenderButton(
        permissions,
        PERMISSION_CODES.communications.broadcast.publish,
      ),
    [permissions],
  );
  const getVisibleBroadcastActions = useCallback(
    (record: BroadcastItem): BroadcastActionKey[] => {
      const status = Number(record.status);

      if (status === 1) {
        return canPublishBroadcast ? ["duplicate", "unpublish"] : ["duplicate"];
      }

      if (status === 2) {
        return canPublishBroadcast
          ? ["duplicate", "unpublish", "more"]
          : ["duplicate", "more"];
      }

      return ["duplicate"];
    },
    [canPublishBroadcast]
  );
  const getBroadcastActionLabel = useCallback(
    (actionKey: BroadcastActionKey) => {
      if (actionKey === "duplicate") {
        return bl("actions.duplicate");
      }

      if (actionKey === "unpublish") {
        return bl("actions.unpublish");
      }

      return undefined;
    },
    [bl]
  );
  const broadcastActionColumnWidth = useResponsiveActionColumnWidth<
    BroadcastItem,
    BroadcastActionKey
  >({
    rows: dataSource,
    buttonWidthMap: BROADCAST_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: getVisibleBroadcastActions,
    getActionLabel: getBroadcastActionLabel,
    desktopConfig: BROADCAST_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: BROADCAST_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: BROADCAST_ACTION_TEXT_MEASURE_CONFIG,
  });
  const latestRequestIdRef = useRef(0);
  const requestInFlightCountRef = useRef(0);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible"
  );
  const recipientNotFoundContent = recipientsLoading ? (
    <span className="broadcast-recipient-dropdown__state">
      <Spin size="small" />
      {bl("recipientsTree.loading")}
    </span>
  ) : (
    <span className="broadcast-recipient-dropdown__state">
      {bl(
        recipientsLoadFailed
          ? "recipientsTree.loadFailed"
          : "recipientsTree.noData"
      )}
    </span>
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1439.98px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompactToolbar(event.matches);
      if (!event.matches) {
        setFilterModalVisible(false);
      }
    };

    setIsCompactToolbar(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const activated = useKeepAliveActivated({
    onDeactivated: () => {
      latestRequestIdRef.current += 1;
      setLoading(false);
      setPublishVisible(false);
      setSelectedBroadcast(null);
    },
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchKeyword(value);
      setPageIndex(1);
    }, 500),
    []
  );

  useEffect(
    () => () => {
      debouncedSearch.cancel();
    },
    [debouncedSearch]
  );

  const applyRecipientFilter = (value: string[]) => {
    const users: string[] = [];
    const departments: number[] = [];

    value.forEach((item) => {
      if (item.startsWith(USER_TYPE_PREFIX))
        users.push(item.slice(USER_TYPE_PREFIX.length));
      if (item.startsWith(DEPARTMENT_PREFIX)) {
        const id = Number(item.slice(DEPARTMENT_PREFIX.length));
        if (Number.isFinite(id)) departments.push(id);
      }
    });

    setRecipientFilter(value);
    setDepartmentIdsFilter(departments);
    setUserTypeFilter(users);
  };

  /**
   * The modal filters recipients, status and a date range; the range reads as
   * one filter.
   */
  const appliedFilterCount =
    countAppliedFilters([recipientFilter, statusFilter]) +
    (isAppliedFilterValue(dateRange?.[0]) || isAppliedFilterValue(dateRange?.[1])
      ? 1
      : 0);

  const handleOpenFilterModal = () => {
    setDraftRecipientFilter(recipientFilter);
    setDraftStatusFilter(statusFilter);
    setDraftDateRange(dateRange);
    setFilterModalVisible(true);
  };

  const handleApplyFilters = () => {
    setPageIndex(1);
    applyRecipientFilter(draftRecipientFilter);
    setStatusFilter(draftStatusFilter);
    setDateRange(draftDateRange);
    setFilterModalVisible(false);
  };

  const handleResetFilters = () => {
    debouncedSearch.cancel();
    setKeyword("");
    setSearchKeyword("");
    setPageIndex(1);
    applyRecipientFilter([]);
    setStatusFilter(null);
    setDateRange(null);
    setDraftRecipientFilter([]);
    setDraftStatusFilter(null);
    setDraftDateRange(null);
  };

  useEffect(() => {
    const fetchStatusTypes = async () => {
      try {
        const res = await getTypeDictionaries("BroadcastStatus");
        const array = extractCollection<TypeDictionary>(res);
        setStatusTypes(
          array.map((item) => ({
            ...item,
            label: item.nameEn,
            value: item.code,
          }))
        );
      } catch (error) {
        console.error("Failed to fetch broadcast status types", error);
        setStatusTypes([]);
      }
    };

    fetchStatusTypes();
  }, []);

  useEffect(() => {
    const fetchRecipients = async () => {
      setRecipientsLoading(true);
      setRecipientsLoadFailed(false);
      try {
        // Settled separately so one branch failing cannot blank out the whole recipients tree.
        const [userTypesResult, departmentsResult] = await Promise.allSettled([
          getUserTypes(),
          getDepartments({ PageIndex: 1, PageSize: 1000 }),
        ]);

        if (userTypesResult.status === "rejected") {
          console.error("Failed to fetch user types", userTypesResult.reason);
        }
        if (departmentsResult.status === "rejected") {
          console.error(
            "Failed to fetch departments",
            departmentsResult.reason
          );
        }

        const userTypesArray = extractCollection<TypeDictionary>(
          userTypesResult.status === "fulfilled" ? userTypesResult.value : null
        );
        const departmentsArray = extractCollection<DepartmentItem>(
          departmentsResult.status === "fulfilled"
            ? departmentsResult.value
            : null
        );
        const customerNodes = userTypesArray
          .filter((item) => Boolean(item.code) && Boolean(item.nameEn))
          .map((item) => ({
            title: item.nameEn.trim(),
            value: `${USER_TYPE_PREFIX}${item.code}`,
          }));
        const adminNodes = departmentsArray
          .filter((item) => item.id != null && Boolean(item.nameEn))
          .map((item) => ({
            title: item.nameEn.trim(),
            value: `${DEPARTMENT_PREFIX}${item.id}`,
          }));
        const tree: RecipientTreeNode[] = [];

        if (customerNodes.length) {
          tree.push({
            title: bl("recipientsTree.customerPortal"),
            value: "customer-portal",
            selectable: false,
            children: customerNodes,
          });
        }

        if (adminNodes.length) {
          tree.push({
            title: bl("recipientsTree.adminPortal"),
            value: "admin-portal",
            selectable: false,
            children: adminNodes,
          });
        }

        setRecipientTreeData(tree);
        setRecipientsLoadFailed(
          userTypesResult.status === "rejected" &&
            departmentsResult.status === "rejected"
        );
      } catch (error) {
        console.error("Failed to fetch recipients options", error);
        setRecipientTreeData([]);
        setRecipientsLoadFailed(true);
      } finally {
        setRecipientsLoading(false);
      }
    };

    fetchRecipients();
  }, [bl]);

  const requestCacheRef = useRef<{
    key: string;
    fetchedAt: number;
  } | null>(null);
  const requestCacheKey = useMemo(
    () =>
      JSON.stringify({
        pageIndex,
        pageSize,
        searchKeyword,
        statusFilter,
        userTypeFilter,
        departmentIdsFilter,
        startDate: dateRange?.[0]?.format("YYYY-MM-DD"),
        endDate: dateRange?.[1]?.format("YYYY-MM-DD"),
      }),
    [
      dateRange,
      departmentIdsFilter,
      pageIndex,
      pageSize,
      searchKeyword,
      statusFilter,
      userTypeFilter,
    ]
  );
  const fetchData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (silent && requestInFlightCountRef.current > 0) return;
      requestInFlightCountRef.current += 1;

      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      if (!silent) {
        setLoading(true);
      }
      try {
        const params: GetTemplateListParams & { protalType?: string } = {
          type: "2",
          pageIndex,
          pageSize,
          keyWorld: searchKeyword || null,
          status: statusFilter || null,
          channels: null,
          // protalType:
          //   recipientFilter && recipientFilter.length
          //     ? recipientFilter.join(",")
          //     : undefined,
          userTypeCodes:
            userTypeFilter?.length > 0 ? userTypeFilter : undefined,
          departmentIds:
            departmentIdsFilter?.length > 0
              ? departmentIdsFilter
              : undefined,
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
        const result = res as unknown as GetTemplateListResponse;
        const list = result.data?.items || [];
        requestCacheRef.current = {
          key: requestCacheKey,
          fetchedAt: Date.now(),
        };
        setTotal(result.data?.totalItems || 0);

        setDataSource(list as unknown as BroadcastItem[]);
      } catch (error) {
        if (requestId !== latestRequestIdRef.current) return;
        console.error("Load broadcast list failed", error);
        if (!silent) {
          setDataSource([]);
          setTotal(0);
        }
      } finally {
        if (!silent && requestId === latestRequestIdRef.current) {
          setLoading(false);
        }
        requestInFlightCountRef.current = Math.max(
          requestInFlightCountRef.current - 1,
          0
        );
      }
    },
    [
      dateRange,
      departmentIdsFilter,
      pageIndex,
      pageSize,
      requestCacheKey,
      searchKeyword,
      statusFilter,
      userTypeFilter,
    ]
  );
  useEffect(() => {
    const handleForceRefresh = () => {
      requestCacheRef.current = null;
    };
    window.addEventListener(
      BROADCAST_LIST_FORCE_REFRESH_EVENT,
      handleForceRefresh
    );
    return () =>
      window.removeEventListener(
        BROADCAST_LIST_FORCE_REFRESH_EVENT,
        handleForceRefresh
      );
  }, []);

  const nextStatusChangeTime = useMemo(() => {
    return dataSource.reduce<number | null>((nearestTime, item) => {
      const status = Number(item.status);
      const boundaryValue =
        status === 2 ? item.pushTime : status === 1 ? item.expireTime : undefined;
      if (!boundaryValue) return nearestTime;

      const boundary = fromApi(boundaryValue);
      if (!boundary) return nearestTime;

      const boundaryTime = boundary.valueOf();
      return nearestTime == null || boundaryTime < nearestTime
        ? boundaryTime
        : nearestTime;
    }, null);
  }, [dataSource]);

  useEffect(() => {
    if (!activated || !isDocumentVisible) return;
    const cachedRequest = requestCacheRef.current;
    const isSameRequest = cachedRequest?.key === requestCacheKey;
    const isFreshCache =
      isSameRequest &&
      Date.now() - cachedRequest.fetchedAt < 30 * 1000;
    if (isFreshCache) return;
    fetchData({ silent: isSameRequest });
  }, [activated, fetchData, isDocumentVisible, requestCacheKey]);

  useEffect(() => {
    if (
      !activated ||
      !isDocumentVisible ||
      nextStatusChangeTime == null
    ) {
      return;
    }

    let timer: number;
    const scheduleRefresh = () => {
      const delay = Math.max(nextStatusChangeTime - Date.now() + 1000, 0);
      if (delay > MAX_TIMEOUT_MS) {
        timer = window.setTimeout(scheduleRefresh, MAX_TIMEOUT_MS);
        return;
      }
      timer = window.setTimeout(() => {
        fetchData({ silent: true });
      }, delay);
    };
    scheduleRefresh();

    return () => window.clearTimeout(timer);
  }, [
    activated,
    fetchData,
    isDocumentVisible,
    nextStatusChangeTime,
  ]);

  const handleUnPublish = async () => {
    if (!selectedBroadcast) {
      setPublishVisible(false);
      return;
    }
    if (unpublishing) return;
    setUnpublishing(true);
    try {
      const response = await unpublishBroadcastTemplate(selectedBroadcast.id);
      if (!isSuccessfulBroadcastResponse(response)) {
        throw new Error("Unpublish broadcast was not successful");
      }
      setPublishVisible(false);
      setSelectedBroadcast(null);
      CustomMessage.success(bl("messages.operationSuccess"));
      await fetchData();
    } catch (error) {
      console.error("Unpublish broadcast failed", error);
      CustomMessage.error(bl("messages.unpublishFailed"));
    } finally {
      setUnpublishing(false);
    }
  };

  const columns: ColumnsType<BroadcastItem> = useMemo(
    () => [
      {
        title: bl("table.broadcastNo"),
        dataIndex: "templateCode",
        key: "templateCode",
        width: 168,
        className: "broadcast-table__broadcast-no",
        render: (value: string) => (
          <span className="broadcast-table__broadcast-no-text">{value}</span>
        ),
      },
      {
        title: bl("table.broadcastTitle"),
        dataIndex: "templateName",
        key: "templateName",
        ellipsis: {
          showTitle: false,
        },
        render: (text: any) => (
          <Tooltip
            color={"#fff"}
            overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
            placement="topLeft"
            title={text}
          >
            <span>{text}</span>
          </Tooltip>
        ),
      },
      {
        title: bl("table.portal"),
        dataIndex: "protalTypeInfo",
        key: "protalTypeInfo",
        width: 160,
        className: "broadcast-table__portal",
        render: (value: PortalInfo[] | undefined) => (
          <span className="broadcast-table__portal-text">
            {formatPortalName(value)}
          </span>
        ),
      },
      {
        title: bl("table.recipients"),
        dataIndex: "userTypeCodeInfo",
        key: "userTypeCodeInfo",
        width: 200,
        render: (_value, record) => {
          const names = record.userTypeCodeInfo?.length
            ? record.userTypeCodeInfo.map((item) => item.name)
            : record.departmentsInfo?.map((item) => item.name || item.nameEn);
          const fallback = record.recipients === "1"
            ? bl("table.allDepartments")
            : bl("table.allUserTypes");
          const text = names?.filter(Boolean).join(", ") || fallback;
          return <span>{text}</span>;
        },
      },
      {
        title: bl("table.status"),
        dataIndex: "status",
        key: "status",
        render: (value: number) =>
          value != null ? (
            <CustomStatusTag type="broadcast" status={Number(value)} />
          ) : (
            <span>-</span>
          ),
      },
      {
        title: bl("table.publishedBy"),
        dataIndex: "updateOnInfo",
        key: "updateOnInfo",
        render: (_, record) => {
          return (
            <span>
              {displayPublishedByName(record)}
            </span>
          );
        },
      },
      {
        title: bl("table.publishTime"),
        dataIndex: "pushTime",
        key: "pushTime",
        render: (value) => {
          return <span>{moment(value).format("DD/MM/YYYY HH:mm")}</span>;
        },
      },
      {
        title: bl("table.channel"),
        dataIndex: "channels",
        key: "channels",
        width: 108,
        render: (_value, record) => {
          const channelCodes = getBroadcastChannelCodes(record);
          if (!channelCodes.length) return <span>-</span>;

          return (
            <div className="broadcast-channel-icons">
              {channelCodes.map((channelCode) => {
                const channel = BROADCAST_CHANNEL_ICONS[channelCode];
                const label = bl(channel.labelKey);
                return (
                  <Tooltip key={channelCode} title={label}>
                    <span
                      aria-label={label}
                      className="broadcast-channel-icons__item"
                      role="img"
                    >
                      <img
                        className="broadcast-channel-icons__image"
                        src={channel.src}
                        alt=""
                      />
                    </span>
                  </Tooltip>
                );
              })}
            </div>
          );
        },
      },
      {
        title: bl("table.actions"),
        key: "actions",
        width: broadcastActionColumnWidth,
        fixed: "right",
        render: (_, record) => {
          const status = Number(record.status);
          const duplicateAction: AdaptiveActionItem = {
            key: "duplicate",
            label: bl("actions.duplicate"),
            onClick: () => {
              history.push(
                `/communications/broadcastEdit?duplicateId=${record.id}`
              );
            },
            renderAction: ({ onClick }) => (
              <span className="action-link" onClick={onClick}>
                {bl("actions.duplicate")}
              </span>
            ),
          };
          const actions: AdaptiveActionItem[] = [duplicateAction];

          if ((status === 1 || status === 2) && canPublishBroadcast) {
            actions.push({
              key: "unpublish",
              label: bl("actions.unpublish"),
              onClick: () => {
                setSelectedBroadcast(record);
                setPublishVisible(true);
              },
              renderAction: ({ onClick }) => (
                <span className="action-link" onClick={onClick}>
                  {bl("actions.unpublish")}
                </span>
              ),
            });
          }

          if (status === 2) {
            actions.push({
              key: "edit",
              label: bl("actions.edit"),
              placement: "overflow",
              onClick: () => {
                history.push(`/communications/broadcastEdit?id=${record.id}`);
              },
            });
          }

          return (
            <AdaptiveActionGroup
              actions={actions}
              maxInlineActions={2}
              moreLabel={t("common.moreActions")}
              moreIcon={<MoreOutlined />}
              className="broadcast-actions"
              dropdownTrigger={["click"]}
              dropdownPlacement="bottomRight"
            />
          );
        },
      },
    ],
    [bl, broadcastActionColumnWidth, canPublishBroadcast, history, t]
  );

  const onRow = (record: any) => {
    return {
      onClick: () => {
        history.push(`/communications/broadcastView?id=${record.id}`);
      },
    };
  };
  return (
    <div className="broadcast-page">
      <div className="broadcast-header responsive-filter-toolbar">
        <div className="filters responsive-filter-toolbar__controls">
          <Input
            placeholder={bl("filters.search")}
            prefix={<Sousuo className="search-icon" />}
            value={keyword}
            allowClear
            onChange={(e) => {
              setKeyword(e.target.value);
              debouncedSearch(e.target.value);
            }}
            className="search-input responsive-filter-toolbar__field responsive-filter-toolbar__field--search"
          />

          {!isCompactToolbar && (
            <>
              <TreeSelect
                placeholder={bl("filters.allRecipients")}
                className="broadcast-recipient-select broadcast-recipient-select--all-recipients filter-select umc-select-arrow-manual responsive-filter-toolbar__field"
                dropdownClassName="broadcast-recipient-dropdown"
                dropdownMatchSelectWidth
                virtual={false}
                listHeight={374}
                treeData={recipientTreeData}
                treeCheckable
                treeDefaultExpandAll
                showCheckedStrategy={TreeSelect.SHOW_CHILD}
                switcherIcon={<DownOutlined />}
                showArrow
                suffixIcon={
                  recipientDropdownOpen ? <UpOutlined /> : <DownOutlined />
                }
                onDropdownVisibleChange={setRecipientDropdownOpen}
                allowClear
                loading={recipientsLoading}
                notFoundContent={recipientNotFoundContent}
                maxTagCount={2}
                value={recipientFilter}
                onChange={(value) => {
                  setPageIndex(1);
                  applyRecipientFilter((value as string[] | undefined) ?? []);
                }}
              />
              <Select
                placeholder={bl("filters.allStatus")}
                className="filter-select responsive-filter-toolbar__field"
                value={statusFilter}
                onChange={(val) => {
                  setPageIndex(1);
                  setStatusFilter(val || null);
                }}
                allowClear
                options={[
                  {
                    label: bl("filters.allStatus"),
                    value: "",
                  },
                  ...statusTypes,
                ]}
              />
            </>
          )}
          <CustomButton
            variant="outline"
            customClassName="broadcast-filter-button responsive-filter-toolbar__button responsive-filter-toolbar__filter-button filter-trigger-with-count"
            onClick={handleOpenFilterModal}
          >
            {String(t("common.filter"))}
            <img className="filter-trigger-funnel" src={SortIcon} alt="" />
            <FilterCountBadge count={appliedFilterCount} />
          </CustomButton>
          <CustomButton
            text={String(t("common.reset"))}
            variant="outline"
            customClassName="broadcast-reset-button responsive-filter-toolbar__button responsive-filter-toolbar__reset-button"
            onClick={handleResetFilters}
          />
        </div>
        <CustomButton
          text={bl("actions.addNew")}
          variant="primary"
          customClassName="broadcast-add-button responsive-filter-toolbar__action"
          onClick={() => history.push("/communications/broadcastEdit")}
        />
      </div>

      <TablePanel
        className="broadcast-table"
        tableProps={{
          rowKey: "id",
          columns,
          dataSource,
          loading,
          onRow,
          scroll: { x: 1456 },
          locale: {
            emptyText: (
              <div className="broadcast-empty-state">
                <img src={emptyIcon} alt="" />
                <span>{bl("empty")}</span>
              </div>
            ),
          },
          pagination: {
            total,
            pageSize,
            current: pageIndex,
            showSizeChanger: true,
            showTotal: (value) => (
              <PaginationTotal label={t("common.total")} total={value} current={pageIndex} pageSize={pageSize} />
            ),
            pageSizeOptions: ["10", "20", "50", "100"],
            onChange: (page, size) => {
              setPageIndex(page);
              setPageSize(size);
            },
          },
        }}
      />

      <ConfirmModal
        visible={publishVisible}
        type="danger"
        title={bl("confirm.unpublish.title")}
        content={bl("confirm.unpublish.content")}
        cancelText={bl("buttons.cancel")}
        confirmText={bl("buttons.confirm")}
        onCancel={() => setPublishVisible(false)}
        onConfirm={handleUnPublish}
        loading={unpublishing}
      />

      <Modal
        title={String(t("common.filter"))}
        visible={filterModalVisible}
        onCancel={() => setFilterModalVisible(false)}
        width={960}
        centered
        destroyOnClose
        className="broadcast-filter-modal"
        footer={[
          <CustomButton
            key="cancel"
            text={String(t("common.cancel"))}
            variant="outline"
            customClassName="broadcast-filter-modal__cancel"
            onClick={() => setFilterModalVisible(false)}
          />,
          <CustomButton
            key="apply"
            text={String(t("common.apply"))}
            variant="primary"
            customClassName="broadcast-filter-modal__apply"
            onClick={handleApplyFilters}
          />,
        ]}
      >
        <div className="broadcast-filter-modal__content">
          {isCompactToolbar ? (
            <>
              <div className="broadcast-filter-modal__item">
                <div className="broadcast-filter-modal__label">
                  {bl("table.recipients")}
                </div>
                <TreeSelect
                  placeholder={bl("filters.allRecipients")}
                  className="broadcast-recipient-select"
                  dropdownClassName="broadcast-recipient-dropdown"
                  dropdownMatchSelectWidth
                  virtual={false}
                  listHeight={374}
                  treeData={recipientTreeData}
                  treeCheckable
                  treeDefaultExpandAll
                  showCheckedStrategy={TreeSelect.SHOW_CHILD}
                  switcherIcon={<DownOutlined />}
                  allowClear
                  loading={recipientsLoading}
                  notFoundContent={recipientNotFoundContent}
                  maxTagCount={2}
                  value={draftRecipientFilter}
                  onChange={(value) => {
                    setDraftRecipientFilter(
                      (value as string[] | undefined) ?? [],
                    );
                  }}
                />
              </div>
              <div className="broadcast-filter-modal__item">
                <div className="broadcast-filter-modal__label">
                  {bl("table.status")}
                </div>
                <Select
                  placeholder={bl("filters.allStatus")}
                  value={draftStatusFilter}
                  onChange={(value) => setDraftStatusFilter(value || null)}
                  allowClear
                  options={[
                    {
                      label: bl("filters.allStatus"),
                      value: "",
                    },
                    ...statusTypes,
                  ]}
                />
              </div>
            </>
          ) : null}
          <div className="broadcast-filter-modal__item broadcast-filter-modal__item--wide">
            <div className="broadcast-filter-modal__label">
              {bl("table.publishTime")}
            </div>
            <DatePicker.RangePicker
              placeholder={[bl("filters.startTime"), bl("filters.endTime")]}
              value={draftDateRange}
              onChange={setDraftDateRange}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Broadcast;
