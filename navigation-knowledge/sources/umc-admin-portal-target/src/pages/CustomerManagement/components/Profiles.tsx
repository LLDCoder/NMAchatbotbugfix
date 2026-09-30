import { DatePicker, Form, Input, Modal, Select, Tooltip } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import type { ColumnType, TableProps } from "antd/lib/table";
import type { SorterResult } from "antd/lib/table/interface";
import Sousuo from "@/assets/icons/Sousuo";
import {
  ConfirmModal,
  CustomButton,
  CustomMessage,
  PaginationTotal,
} from "@/components/common";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import SelfMonitorBadge from "@/components/common/SelfMonitorBadge";
import { isSelfMonitorTier } from "@/components/common/SelfMonitorBadge/tier";
import { FilterTable, useFilter } from "@/components/common/FilterTable";
import { usePagination } from "@/hooks/usePagination";
import dayjs, { type Dayjs } from "dayjs";
import debounce from "lodash/debounce";
import AlertBanner from "@/components/common/AlertBanner";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import { useCanRenderButton } from "@/routes/access";

import ApplyForIndividualIcon from "@/assets/images/tablelndividual.png";
import ApplyForBusinessIcon from "@/assets/images/tableCommercial.png";
import ApplyForGovernmentIcon from "@/assets/images/tableGovernment.png";
import { useTranslation } from "react-i18next";
import {
  exportProfileListAsync,
  getProfileList,
  getProfileCount,
  updateProfileActiveAsync,
  getTypeDictionariesProfileTiers,
  type ProfileCountDto,
  type ProfileListItemDto,
  type ProfileTierDictionaryItem,
  type GetProfileListParams,
} from "@/services/userManagement";
import { getAllUserType, getTypeDictionaries } from "@/services/serviceApi";
import {
  USER_TYPE_CODE_COMMERCIAL,
  USER_TYPE_CODE_CONSULATE,
  USER_TYPE_CODE_CULTURAL_CLUBS,
  USER_TYPE_CODE_EMBASSY,
  USER_TYPE_CODE_FREE_ZONE,
  USER_TYPE_CODE_GOVERNMENT,
  USER_TYPE_CODE_INDIVIDUAL,
  USER_TYPE_CODE_TALENT_AGENCY,
  normalizeUserTypeCode,
} from "@/utils/userTypeCode";

const { RangePicker } = DatePicker;

type SelectOption = { label: string; value: string };

const ALL_PROFILE_TYPES_VALUE = "99";

const resolveProfileStatus = (status: unknown) => {
  const normalizedStatus = String(status ?? "").trim();
  return normalizedStatus && normalizedStatus !== "10"
    ? normalizedStatus
    : undefined;
};

const resolveProfileTypeCode = (profileTypeCode: unknown) => {
  const profileTypeValues = String(profileTypeCode ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (profileTypeValues.includes(ALL_PROFILE_TYPES_VALUE)) {
    return undefined;
  }

  const selectedProfileTypeCode = Number(profileTypeValues[0]);
  return Number.isFinite(selectedProfileTypeCode)
    ? selectedProfileTypeCode
    : undefined;
};

type CustomerProfilesActionColumnKey = "activate" | "suspend";

const CUSTOMER_PROFILES_ACTION_COLUMN_BASE_SCROLL_X = 1488;
const CUSTOMER_PROFILES_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<CustomerProfilesActionColumnKey> =
  {
    activate: { default: 100, compact: 100 },
    suspend: { default: 100, compact: 100 },
  };
const CUSTOMER_PROFILES_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 0,
  padding: 32,
  minWidth: 128,
  maxWidth: 180,
};
const CUSTOMER_PROFILES_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 0,
  padding: 24,
  minWidth: 112,
  maxWidth: 160,
};
const CUSTOMER_PROFILES_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 32,
};

interface ProfileRow extends ProfileListItemDto {
  id: string;
}

const mapRow = (item: ProfileListItemDto): ProfileRow => ({
  ...item,
  id: String(item.profileId ?? item.profileNo ?? Math.random()),
});

const buildDonutOption = (
  total: number,
  items: Array<{ name: string; value: number; color: string }>,
  totalLabel: string,
) => ({
  tooltip: {
    trigger: "item",
    confine: true,
    appendToBody: true,
    position: (
      point: [number, number],
      _params: any,
      _dom: HTMLElement,
      _rect: any,
      size: { viewSize: [number, number]; contentSize: [number, number] },
    ) => {
      const x = point[0];
      const y = point[1];
      const viewWidth = size.viewSize[0];
      const viewHeight = size.viewSize[1];
      const contentWidth = size.contentSize[0];
      const contentHeight = size.contentSize[1];

      const margin = 12;
      let left = x + margin;
      if (left + contentWidth > viewWidth) {
        left = x - contentWidth - margin;
      }

      let top = y - contentHeight / 2;
      if (top < margin) top = margin;
      if (top + contentHeight > viewHeight - margin) {
        top = viewHeight - contentHeight - margin;
      }

      return [left, top];
    },
  },
  series: [
    {
      type: "pie",
      radius: ["70%", "90%"],
      minAngle: 3,
      avoidLabelOverlap: false,
      label: { show: false },
      labelLine: { show: false },
      data: items
        .filter((item) => item.value > 0)
        .map((item) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: item.color },
        })),
    },
  ],
  graphic: [
    {
      type: "text",
      left: "center",
      top: "42%",
      style: {
        text: total.toLocaleString(),
        textAlign: "center",
        fill: "#361E12",
        fontSize: 16,
        fontWeight: 600,
        fontFamily: "Inter",
      },
    },
    {
      type: "text",
      left: "center",
      top: "56%",
      style: {
        text: totalLabel,
        textAlign: "center",
        fill: "rgba(54, 30, 18, 0.6)",
        fontSize: 12,
        fontFamily: "Inter",
      },
    },
  ],
});

const ChartCard = ({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; value: number; color: string }>;
}) => {
  const { t } = useTranslation();
  const total = items.reduce((sum, it) => sum + it.value, 0);
  const totalLabel = t("Customer.profiles.chart.total");
  const option = useMemo(
    () => buildDonutOption(total, items, totalLabel),
    [items, total, totalLabel],
  );

  return (
    <div className="profiles-chart-card">
      <div className="profiles-chart-title">{title}</div>
      <div className="profiles-chart-body">
        <div className="profiles-chart">
          <ReactECharts
            option={option}
            style={{ height: "100%", width: "100%" }}
          />
        </div>
        <div className="profiles-chart-legend">
          {items.map((item) => (
            <div key={item.name} className="profiles-legend-row">
              <div className="profiles-legend-left">
                <span
                  className="profiles-legend-dot"
                  style={{ background: item.color }}
                />
                <span className="profiles-legend-name">{item.name}</span>
              </div>
              <div className="profiles-legend-value">
                {item.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const transformDateRange = (
  range: any,
): [string | undefined, string | undefined] => {
  if (!range || !Array.isArray(range) || range.length < 2) {
    return [undefined, undefined];
  }
  const [start, end] = range as [Dayjs | null | undefined, Dayjs | null | undefined];
  return [
    start ? start.format("YYYY-MM-DD") : undefined,
    end ? end.format("YYYY-MM-DD") : undefined,
  ];
};

export default function Profiles() {
  const { t, i18n } = useTranslation();
  const history = useHistory();
  const canConfirmProfile = useCanRenderButton(
    "CustomerModule.Customers.ConfirmCustomerManagement",
    "/happiness/customerManagement",
  );
  const [filterStore] = useFilter();
  const [pageInfo, setPage] = usePagination();
  const isMountedRef = useRef(true);
  const latestRequestIdRef = useRef(0);
  const latestCountRequestIdRef = useRef(0);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [profileCount, setProfileCount] = useState<ProfileCountDto | null>(null);
  const [sortField, setSortField] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<0 | 1 | undefined>(undefined);

  const [selectedProfile, setSelectedProfile] = useState<ProfileRow | null>(null);
  const [modalType, setModalType] = useState<"suspend" | "activate" | null>(null);
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState("");

  const [statusOptions, setStatusOptions] = useState<SelectOption[]>([]);
  const [typeOptions, setTypeOptions] = useState<SelectOption[]>([]);
  const [profileTierOptions, setProfileTierOptions] = useState<
    ProfileTierDictionaryItem[]
  >([]);

  const quickNotes = [
    t("Customer.profiles.modals.quickNote1"),
    t("Customer.profiles.modals.quickNote2"),
    t("Customer.profiles.modals.quickNote3"),
    t("Customer.profiles.modals.quickNote4"),
  ];

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [userTypesRes, statusRes, tierRes] = await Promise.all([
          getAllUserType(),
          getTypeDictionaries("UserProfileStatus"),
          getTypeDictionariesProfileTiers(),
        ]);

        const userTypes = (userTypesRes as any)?.data ?? userTypesRes;
        const statuses = (statusRes as any)?.data ?? statusRes;
        const tiers = (tierRes as any)?.data ?? tierRes;

        const mappedUserTypes: SelectOption[] = Array.isArray(userTypes)
          ? userTypes
              .filter((x: any) => x?.isShown !== false && x?.code !== "99")
              .map((x: any) => {
                const code = String(x?.code ?? "").trim();
                const nameAr = String(x?.nameAr ?? "").trim();
                const nameEn = String(x?.nameEn ?? "").trim();
                return {
                  label: i18n.language?.toLowerCase().startsWith("ar")
                    ? nameAr || nameEn
                    : nameEn || nameAr,
                  value: code,
                };
              })
              .filter((option: SelectOption) => option.value && option.label)
          : [];

        const mappedStatuses: SelectOption[] = Array.isArray(statuses)
          ? statuses
              .filter((x: any) => x?.isShown !== false)
              .map((x: any) => ({
                label: x?.nameEn,
                value: String(x?.code ?? ""),
              }))
          : [];

        if (cancelled) return;
        setTypeOptions(mappedUserTypes);
        setStatusOptions(mappedStatuses);
        setProfileTierOptions(Array.isArray(tiers) ? tiers : []);
      } catch (e) {
        console.error(e);
        if (cancelled) return;
        setTypeOptions([]);
        setStatusOptions([]);
        setProfileTierOptions([]);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res: any = await getProfileCount();
        if (cancelled) return;
        if (!res?.isSuccess) {
          setProfileCount(null);
          return;
        }
        setProfileCount(res.data || null);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setProfileCount(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const pullProfilesCount = useCallback(async () => {
    const requestId = latestCountRequestIdRef.current + 1;
    latestCountRequestIdRef.current = requestId;
    try {
      const res: any = await getProfileCount();
      if (requestId !== latestCountRequestIdRef.current) return;
      if (!res?.isSuccess) {
        setProfileCount(null);
        return;
      }
      setProfileCount(res.data || null);
    } catch (e) {
      if (requestId !== latestCountRequestIdRef.current) return;
      console.error(e);
      setProfileCount(null);
    }
  }, []);

  const request = useCallback(
    async (config: Partial<GetProfileListParams> = {}) => {
      const values = filterStore.getFieldsValue();
      const { keyword, profileTypeCode, profileTiers, status, dateRange } = values;
      const [startDate, endDate] = transformDateRange(dateRange);
      const profileStatus = resolveProfileStatus(status);
      const resolvedProfileTypeCode = resolveProfileTypeCode(profileTypeCode);
      const nextPageIndex = Number(config.PageIndex ?? pageInfo.pageIndex) || 1;
      const nextPageSize = Number(config.PageSize ?? pageInfo.pageSize) || 10;
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;

      setPage({
        pageIndex: nextPageIndex,
        pageSize: nextPageSize,
      });
      setLoading(true);
      try {
        const res: any = await getProfileList({
          PageIndex: nextPageIndex,
          PageSize: nextPageSize,
          KeyWorld: keyword || undefined,
          Status: profileStatus,
          profileTiers: profileTiers || undefined,
          StatrTime: startDate,
          EndTime: endDate,
          SortBy: sortField,
          SortDirection: sortOrder,
          ...config,
          profileTypeCode: resolvedProfileTypeCode,
        });

        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) {
          return;
        }

        const data: any = res?.data ?? res;
        const items = Array.isArray(data?.items) ? data.items : [];
        const totalItems = Number(data?.totalItems || 0);
        const responsePageSize = Number(data?.itemsPerPage);
        const resolvedPageSize =
          Number.isFinite(responsePageSize) && responsePageSize > 0
            ? responsePageSize
            : nextPageSize;
        const totalPages = Math.max(
          1,
          Math.ceil(totalItems / resolvedPageSize),
        );
        setRows(items.map(mapRow));
        setPage({
          total: totalItems,
          pageIndex: totalItems > 0 ? Math.min(nextPageIndex, totalPages) : 1,
          pageSize: resolvedPageSize,
        });
      } catch (e) {
        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) {
          return;
        }
        console.error(e);
        setRows([]);
        setPage({
          total: 0,
          pageIndex: nextPageIndex,
          pageSize: nextPageSize,
        });
      } finally {
        if (isMountedRef.current && requestId === latestRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [filterStore, pageInfo.pageIndex, pageInfo.pageSize, sortField, sortOrder],
  );

  const requestRef = useRef(request);
  requestRef.current = request;

  const debouncedRequest = useMemo(
    () =>
      debounce((config?: Partial<GetProfileListParams>) => {
        void requestRef.current(config);
      }, 300),
    [],
  );

  useEffect(() => {
    return () => {
      debouncedRequest.cancel();
    };
  }, [debouncedRequest]);

  useKeepAliveActivated({
    onActivated: () => {
      void requestRef.current();
      void pullProfilesCount();
    },
    onDeactivated: () => {
      latestRequestIdRef.current += 1;
      latestCountRequestIdRef.current += 1;
      debouncedRequest.cancel();
      setLoading(false);
      setModalType(null);
      setSelectedProfile(null);
      setNotes("");
      setNotesError("");
    },
  });

  useEffect(() => {
    void request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterTableRequest = useCallback(() => {
    setPage({ pageIndex: 1 });
    debouncedRequest({
      PageIndex: 1,
      PageSize: pageInfo.pageSize,
    });
    return Promise.resolve();
  }, [debouncedRequest, pageInfo.pageSize, setPage]);

  const profileTypeChartItems = useMemo(
    () => [
      {
        name: t("Customer.profiles.chart.individual"),
        value: Number(profileCount?.individuals || 0),
        color: "#97D8B3",
      },
      {
        name: t("Customer.profiles.chart.commercial"),
        value: Number(profileCount?.establishmentInfo?.commercial || 0),
        color: "#6AA5FF",
      },
      {
        name: t("Customer.profiles.chart.freeZone"),
        value: Number(profileCount?.establishmentInfo?.freeZone || 0),
        color: "#FFD36A",
      },
      {
        name: t("Customer.profiles.chart.talentAgency"),
        value: Number(profileCount?.establishmentInfo?.talentAgency || 0),
        color: "#FFB3B3",
      },
      {
        name: t("Customer.profiles.chart.government"),
        value: Number(profileCount?.establishmentInfo?.government || 0),
        color: "#A1A6B4",
      },
      {
        name: t("Customer.profiles.chart.embassy"),
        value: Number(profileCount?.establishmentInfo?.embassy || 0),
        color: "#F0C27B",
      },
      {
        name: t("Customer.profiles.chart.consulate"),
        value: Number(profileCount?.establishmentInfo?.consulate || 0),
        color: "#D1A3FF",
      },
      {
        name: t("Customer.profiles.chart.culturalClubs"),
        value: Number(profileCount?.establishmentInfo?.culturalClubs || 0),
        color: "#B3C7FF",
      },
    ],
    [profileCount, t],
  );

  const statusChartItems = useMemo(
    () => [
      {
        name: t("Customer.profiles.chart.approved"),
        value: Number(profileCount?.approved || 0),
        color: "#97D8B3",
      },
      {
        name: t("Customer.profiles.chart.rejected"),
        value: Number(profileCount?.rejected || 0),
        color: "#FF7A7A",
      },
      {
        name: t("Customer.profiles.chart.pendingReview"),
        value: Number(profileCount?.pendingReview || 0),
        color: "#FFD36A",
      },
      {
        name: t("Customer.profiles.chart.expired"),
        value: Number(profileCount?.expired || 0),
        color: "#F5AC7C",
      },
      {
        name: t("Customer.profiles.chart.suspended"),
        value: Number(profileCount?.suspended || 0),
        color: "#A1A6B4",
      },
    ],
    [profileCount, t],
  );

  const tierChartItems = useMemo(() => {
    const total = Number(profileCount?.totalCount || 0);
    // Tier count is authoritative from the backend: selfMonitorProfile is the
    // Trial/Active count (Suspended/Expired/individual/none are Standard).
    // Standard is the remainder — do not recompute from status here.
    const selfMonitor = Number(profileCount?.selfMonitorProfile || 0);
    const standard = Math.max(0, total - selfMonitor);
    return [
      {
        name: t("Customer.profiles.chart.selfMonitor"),
        value: selfMonitor,
        color: "#EB5F24",
      },
      {
        name: t("Customer.profiles.chart.standard"),
        value: standard,
        color: "#A1A6B4",
      },
    ];
  }, [profileCount, t]);

  const profilesActionColumnWidth = useResponsiveActionColumnWidth<
    ProfileRow,
    CustomerProfilesActionColumnKey
  >({
    rows,
    buttonWidthMap: CUSTOMER_PROFILES_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: (record) => {
      if (!canConfirmProfile) {
        return [];
      }

      const statusCode = String(record.status);

      if (!record.isActive && (statusCode === "3" || statusCode === "6")) {
        return ["activate"];
      }

      if (record.isActive && statusCode === "3") {
        return ["suspend"];
      }

      return [];
    },
    getActionLabel: (actionKey) => {
      switch (actionKey) {
        case "activate":
          return t("Customer.profiles.modals.activate");
        case "suspend":
          return t("Customer.profiles.modals.suspend");
        default:
          return undefined;
      }
    },
    desktopConfig: CUSTOMER_PROFILES_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: CUSTOMER_PROFILES_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: CUSTOMER_PROFILES_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });

  const columns = useMemo<ColumnType<ProfileRow>[]>(
    () => [
      {
        title: t("Customer.profiles.table.profileNo"),
        dataIndex: "mediaFileNumber",
        key: "mediaFileNumber",
        fixed: "left",
        width: 200,
        render(text: string) {
          // VIP marker removed (VIP retired). Tier is now shown as the
          // Self-Monitor badge under the Profile Type column instead.
          return (
            <div className="profiles-id-cell">
              <span>{text || "-"}</span>
            </div>
          );
        },
      },
      {
        title: t("Customer.profiles.table.accountId"),
        dataIndex: "cusomerNo",
        key: "cusomerNo",
        width: 240,
        render(text: string) {
          return <span>{text || "-"}</span>;
        },
      },
      {
        title: t("Customer.profiles.table.profileType"),
        dataIndex: "userTypeName",
        key: "userTypeName",
        // The Self-Monitor badge sits under the type name rather than in its own
        // column: only a minority of profiles carry one, so a dedicated column
        // would be mostly empty.
        render: (value: string, record: ProfileRow) => {
          const userTypeCode = normalizeUserTypeCode(record.userTypeCode);
          const profileTypeKeyByCode: Record<string, string> = {
            [USER_TYPE_CODE_INDIVIDUAL]: "individual",
            [USER_TYPE_CODE_COMMERCIAL]: "commercial",
            [USER_TYPE_CODE_GOVERNMENT]: "government",
            [USER_TYPE_CODE_FREE_ZONE]: "freeZone",
            [USER_TYPE_CODE_TALENT_AGENCY]: "talentAgency",
            [USER_TYPE_CODE_EMBASSY]: "embassy",
            [USER_TYPE_CODE_CONSULATE]: "consulate",
            [USER_TYPE_CODE_CULTURAL_CLUBS]: "culturalClubs",
          };
          const profileTypeKey = profileTypeKeyByCode[userTypeCode];
          const localizedValue = profileTypeKey
            ? t(`Customer.profiles.chart.${profileTypeKey}`)
            : value;

          return (
            <div className="profile-type-cell">
              <span>{localizedValue}</span>
              <SelfMonitorBadge
                program={record.selfMonitorProgram}
                className="self-monitor-badge--compact"
              />
            </div>
          );
        },
      },
      {
        title: t("Customer.profiles.table.profileName"),
        dataIndex: "profileName",
        key: "profileName",
        width: 240,
        render: (value: string, record: ProfileRow) => {
          const displayName = value || "-";

          return (
            <div className="profile-name-cell">
              {normalizeUserTypeCode(record.userTypeCode) ===
                USER_TYPE_CODE_INDIVIDUAL && (
                <img className="profile-icon" src={ApplyForIndividualIcon} alt="" />
              )}
              {normalizeUserTypeCode(record.userTypeCode) ===
                USER_TYPE_CODE_COMMERCIAL && (
                <img className="profile-icon" src={ApplyForBusinessIcon} alt="" />
              )}
              {normalizeUserTypeCode(record.userTypeCode) ===
                USER_TYPE_CODE_GOVERNMENT && (
                <img className="profile-icon" src={ApplyForGovernmentIcon} alt="" />
              )}
              <Tooltip
                title={value ? displayName : undefined}
                color="#fff"
                overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
                placement="topLeft"
              >
                <span className="profile-name-text">{displayName}</span>
              </Tooltip>
            </div>
          );
        },
      },
      {
        title: t("Customer.profiles.table.accountHolder"),
        dataIndex: "userName",
        key: "userName",
        width: 240,
      },
      {
        title: t("Customer.profiles.table.status"),
        dataIndex: "statusName",
        key: "statusName",
        render(text: string) {
          return <CustomStatusTag type="profileCard" status={text} />;
        },
      },
      {
        title: t("Customer.profiles.table.submissionUpdated"),
        dataIndex: "registTime",
        key: "registTime",
        width: 200,
        sorter: true,
        render(text: string) {
          return text ? dayjs(text).format("DD/MM/YYYY HH:mm") : "-";
        },
      },
      {
        title: t("Customer.profiles.table.actions"),
        key: "actions",
        fixed: "right",
        width: profilesActionColumnWidth,
        render(_text: string, record: ProfileRow) {
          const statusCode = String(record.status);
          if (
            statusCode === "2" ||
            statusCode === "4" ||
            statusCode === "5"
          ) {
          return <span className="profiles-actions-placeholder">-</span>;
          }
          if (
            !record.isActive &&
            (statusCode === "2" ||
              statusCode === "3" ||
              statusCode === "6")
          ) {
            return (
              <div
                className="profiles-table-actions"
                onClick={(e) => e.stopPropagation()}
              >
                <CustomButton
                  variant="text"
                  permissionCode="CustomerModule.Customers.ConfirmCustomerManagement"
                  permissionRoutePath="/happiness/customerManagement"
                  onClick={() => {
                    setSelectedProfile(record);
                    setModalType("activate");
                  }}
                >
                  {t("Customer.profiles.modals.activate")}
                </CustomButton>
              </div>
            );
          }
          if (record.isActive && statusCode === "3") {
            return (
              <div
                className="profiles-table-actions"
                onClick={(e) => e.stopPropagation()}
              >
                <CustomButton
                  variant="text"
                  permissionCode="CustomerModule.Customers.ConfirmCustomerManagement"
                  permissionRoutePath="/happiness/customerManagement"
                  onClick={() => {
                    setSelectedProfile(record);
                    setModalType("suspend");
                    setNotes("");
                    setNotesError("");
                  }}
                >
                  {t("Customer.profiles.modals.suspend")}
                </CustomButton>
              </div>
            );
          }
          return <span className="profiles-actions-placeholder">-</span>;
          },
          },
    ],
    [profilesActionColumnWidth, t],
  );

  const handleExport = async () => {
    const values = filterStore.getFieldsValue();
    const { keyword, profileTypeCode, profileTiers, status, dateRange } = values;
    const [startDate, endDate] = transformDateRange(dateRange);

    try {
      await exportProfileListAsync(
        {
          PageIndex: pageInfo.pageIndex,
          PageSize: pageInfo.pageSize,
          KeyWorld: keyword || undefined,
          Status: resolveProfileStatus(status),
          profileTypeCode: resolveProfileTypeCode(profileTypeCode),
          profileTiers: profileTiers || undefined,
          StatrTime: startDate,
          EndTime: endDate,
        },
        `Profiles_${dayjs().format("DDMMYYYY_HHmmss")}.csv`,
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirm = async () => {
    if (!selectedProfile || !modalType) return;
    const currentModal = modalType;
    const currentProfile = selectedProfile;

    if (currentModal === "suspend" && !notes.trim()) {
      setNotesError(t("Customer.profiles.modals.fieldRequired"));
      return;
    }

    setNotesError("");
    setModalType(null);
    setSelectedProfile(null);

    try {
      if (currentModal === "suspend" || currentModal === "activate") {
        const isActivate = currentModal === "activate";
        await updateProfileActiveAsync({
          profileId: currentProfile.profileId,
          isActive: isActivate,
          reson: isActivate ? undefined : notes,
        });
      }

      await pullProfilesCount();
      await request();
      setNotes("");
      setNotesError("");
      CustomMessage.success(t("common.operationSuccess"));
    } catch (e) {
      console.error(e);
    }
  };

  const tableFilterConfigs = useMemo(
    () => [
      <Input
        key="input-keyword"
        allowClear
        prefix={<Sousuo className="profiles-search-icon" />}
        placeholder={t("common.search")}
        className="profiles-range-Input"
      />,
      {
        label: t("Customer.profiles.table.profileType"),
        element: (
          <Select
            key="select-profileTypeCode"
            allowClear
            placeholder={t("Customer.profiles.placeholders.allProfileType")}
            className="profiles-range-Input profiles-select"
            options={[
              {
                label: t("Customer.profiles.placeholders.allProfileType"),
                value: ALL_PROFILE_TYPES_VALUE,
              },
              ...typeOptions.filter(
                (option) => String(option.value) !== ALL_PROFILE_TYPES_VALUE,
              ),
            ]}
            showSearch
            optionFilterProp="label"
          />
        ),
      },
      {
        label: t("Customer.profiles.chart.profileTier"),
        element: (
          <Select
            key="select-profileTiers"
            allowClear
            placeholder={t("Customer.profiles.placeholders.allProfileTiers")}
            className="profiles-range-Input profiles-select"
            options={profileTierOptions.map((item) => ({
              label: item.nameEn,
              value: item.code,
            }))}
            showSearch
            optionFilterProp="label"
          />
        ),
      },
      {
        label: t("Customer.profiles.filterModal.status"),
        element: (
          <Select
            key="select-status"
            allowClear
            placeholder={t("Customer.profiles.placeholders.allStatuses")}
            className="profiles-select"
            options={[
              {
                label: t("Customer.profiles.placeholders.allStatuses"),
                value: "10",
              },
              ...statusOptions,
            ]}
            showSearch
            optionFilterProp="label"
          />
        ),
      },
      {
        label: t("Customer.profiles.filterModal.submissionTime"),
        element: (
          <RangePicker
            key="range-dateRange"
            className="date-range-picker"
            placeholder={[t("common.profile.startTime"), t("common.profile.endTime")]}
            format="DD/MM/YYYY"
          />
        ),
      },
    ],
    [profileTierOptions, statusOptions, typeOptions, t],
  );

  const tableConfigs = useMemo<TableProps<ProfileRow>>(
    () => ({
      scroll: {
        x:
          CUSTOMER_PROFILES_ACTION_COLUMN_BASE_SCROLL_X +
          profilesActionColumnWidth,
      },
      rowKey: (record: ProfileRow) => record.id,
      columns,
      dataSource: rows,
      onRow: (record) => ({
        onClick: () => {
          const userTypeCode = normalizeUserTypeCode(record.userTypeCode);
          if (!userTypeCode) {
            CustomMessage.error(t("common.operationFailed"));
            return;
          }
          const viewType =
            userTypeCode === USER_TYPE_CODE_INDIVIDUAL
              ? "individual"
              : "commercial";
          // Tier classification: only Trial/Active count as Self-Monitor —
          // Suspended/Expired/individual/none are Standard (backend spec).
          const tierLabel = isSelfMonitorTier(record.selfMonitorProgram)
            ? "Self-Monitor"
            : "Standard";
          history.push(
            `/happiness/customerManagement/customerProfileDetail?id=${record.id}&type=${viewType}&tier=${encodeURIComponent(
              tierLabel,
            )}&status=${encodeURIComponent(
              record.statusName || record.status,
            )}`,
          );
        },
        style: { cursor: "pointer" },
      }),
      onChange: (_pagination, _f, sorter) => {
        const s = Array.isArray(sorter) ? sorter[0] : sorter;
        const order = (s as SorterResult<ProfileRow>)?.order as
          | "ascend"
          | "descend"
          | undefined;
        const field =
          ((s as SorterResult<ProfileRow>)?.field as string | undefined) ||
          ((s as SorterResult<ProfileRow>)?.columnKey as string | undefined);
        const nextSortField = field === "registTime" ? "registTime" : field;
        const nextSortOrder: 0 | 1 | undefined = order
          ? order === "ascend"
            ? 0
            : 1
          : undefined;
        setSortField(nextSortField);
        setSortOrder(nextSortOrder);
        void request({
          PageIndex: _pagination.current,
          PageSize: _pagination.pageSize,
          SortBy: nextSortField,
          SortDirection: nextSortOrder,
        });
      },
    }),
    [columns, rows, history, request, profilesActionColumnWidth],
  );

  return (
    <div className="profiles-container">
      <div className="profiles-statistics">
        <ChartCard
          title={t("Customer.profiles.chart.profileType")}
          items={profileTypeChartItems}
        />
        <ChartCard
          title={t("Customer.profiles.chart.profileStatus")}
          items={statusChartItems}
        />
        <ChartCard
          title={t("Customer.profiles.chart.profileTier")}
          items={tierChartItems}
        />
      </div>

      <div className="profiles-table-container">
        <FilterTable
          containerCls="custom-table profiles-table customer-management-profiles-filter-table"
          {...tableConfigs}
          loading={loading}
          filterStore={filterStore}
          tableFilters={tableFilterConfigs}
          responsiveToolbar
          extraBtn={
            <CustomButton
              variant="outline"
              text={t("common.export")}
              onClick={handleExport}
              permissionCode="CustomerModule.Customers.ExportCustomerManagement"
              permissionRoutePath="/happiness/customerManagement"
            />
          }
          request={handleFilterTableRequest}
          pagination={{
            size: "default",
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
          }}
        />
      </div>

      <Modal
        centered
        className="profiles-action-modal"
        visible={modalType === "suspend"}
        onCancel={() => {
          setModalType(null);
          setNotes("");
          setNotesError("");
        }}
        footer={null}
        title={t("Customer.profiles.modals.suspendProfile")}
        destroyOnClose
      >
        <AlertBanner
          content={t("Customer.profiles.modals.suspendProfileAlert")}
        />

        <div className="profiles-modal-body">
          <div className="profiles-modal-section">
            <div className="profiles-modal-label">
              {t("Customer.profiles.modals.notes")}
              <span className="required-mark">*</span>
            </div>
            <Form component={false}>
              <Form.Item
                className="profiles-modal-textarea-item"
                validateStatus={notesError ? "error" : undefined}
                help={notesError || undefined}
              >
                <Input.TextArea
                  placeholder={t("Customer.profiles.modals.enterNotes")}
                  value={notes}
                  maxLength={1000}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setNotes(nextValue);
                    if (notesError) {
                      setNotesError(
                        nextValue.trim()
                          ? ""
                          : t("Customer.profiles.modals.fieldRequired"),
                      );
                    }
                  }}
                  autoSize={{ minRows: 4, maxRows: 6 }}
                />
              </Form.Item>
            </Form>
            <div className="profiles-modal-counter">{notes.length} / 1000</div>
          </div>

          <div className="profiles-modal-section">
            <div className="profiles-modal-label">
              {t("Customer.profiles.modals.quickNotes")}
            </div>
            <div className="profiles-quick-notes">
              {quickNotes.map((text) => (
                <button
                  key={text}
                  type="button"
                  className="profiles-quick-note"
                  onClick={() => {
                    setNotes((prev) => {
                      const next = prev ? `${prev}\n${text}` : text;
                      return next.slice(0, 1000);
                    });
                    setNotesError("");
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          <div className="profiles-modal-footer">
            <CustomButton
              variant="danger-outline"
              text={t("common.cancel")}
              onClick={() => {
                setModalType(null);
                setNotes("");
                setNotesError("");
              }}
            />
            <CustomButton
              variant="danger"
              text={t("common.confirm")}
              onClick={handleConfirm}
            />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        loading={false}
        onCancel={() => setModalType(null)}
        onConfirm={handleConfirm}
        visible={modalType === "activate"}
        type="warning"
        title={t("Customer.profiles.modals.activateProfile")}
        content={t("Customer.profiles.modals.activateProfileConfirm")}
      />
    </div>
  );
}
