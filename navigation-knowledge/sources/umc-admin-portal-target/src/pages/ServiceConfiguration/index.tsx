import { fmt, DISPLAY_DATE } from "@/utils/gstTime";
import React, { useState, useEffect, useRef, useCallback } from "react";
import moment from "moment";
import Sousuo from "@/assets/icons/Sousuo";
import {
  Card,
  Table,
  Input,
  Select,
  Button,
  Dropdown,
  Menu,
  Tag,
  Modal,
} from "antd";
import { useHistory } from "react-router-dom";
import { MoreOutlined, RightOutlined, DownOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { KEEP_ALIVE_RESTORE_STATE_KEY } from "@/components/KeepAlive/constants";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import useKeepAliveRouteState from "@/components/KeepAlive/useKeepAliveRouteState";
import menuIcon from "./assets/service-stat-total.svg";
import SendIcon from "./assets/service-stat-published.svg";
import ClockEIcon from "./assets/service-stat-suspended.svg";
import SettingIcon from "./assets/service-stat-pre-published.svg";
import CalendarIcon from "./assets/service-stat-draft.svg";
import "./index.less";
import {
  CustomButton,
  ConfirmModal,
  CustomMessage,
  PaginationTotal,
  PermissionGuard,
} from "@/components/common";
import SortIcon from "@/assets/images/sort.png";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";
import StarIcon from "@/assets/images/star.png";
import ManagePriorityModal from "./ManagePriorityModal";
import FilterModal, { type FilterValues } from "./FilterModal";
import { buildServiceListParams } from "./filterParams";
import icon from "@/assets/images/warning-circle.png";
import {
  getAllServices,
  deleteService,
  getTypeDictionaries,
  type ServiceChildItem,
  type TypeDictionary,
  type TypeDictionaryInfo,
  getAllServiceCategories,
  getServiceIndexCount,
  getServiceById,
  updateServiceStatus,
} from "@/services/serviceApi";
import WarnCircle from "@/assets/icons/WarnCircle";
import { getDepartments, type DepartmentItem } from "@/services/department";
import clamp2 from "@/utils/clamp2";
import History from "./History";
import { useResponsiveViewportBand } from "@/hooks/useResponsiveViewportBand";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
const { Option } = Select;
const SERVICE_CONFIGURATION_PATH = "/service-management/service-configuration";
const ADD_NEW_SERVICE_PATH = `${SERVICE_CONFIGURATION_PATH}/addnewservice`;
const SERVICE_STATUS_DRAFT = "2";
const SERVICE_STATUS_SUSPENDED = "3";
const SERVICE_STATUS_PRE_PUBLISHED = "4";
const SERVICE_STATUS_PUBLISHED = "5";
type ServiceConfigurationActionKey = "view" | "configure" | "more";

const SERVICE_CONFIGURATION_ACTION_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<ServiceConfigurationActionKey> = {
  more: {
    default: 32,
    compact: 32,
  },
};

const SERVICE_CONFIGURATION_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 112,
  maxWidth: 180,
};

const SERVICE_CONFIGURATION_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 104,
  maxWidth: 160,
};

const SERVICE_CONFIGURATION_ACTION_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};

interface ServiceData {
  key: string;
  id: number;
  serviceCode: string;
  serviceName: string;
  serviceCategory: string;
  status: string;
  statusInfo?: TypeDictionaryInfo;
  type: string;
  department: string;
  lastUpdated: string;
  isFavorite?: boolean;
  children?: ServiceData[];
  orderNum?: number;
  iscollect: boolean;
  departmentInfo?: {
    name?: string;
    nameEn?: string;
    nameAr?: string;
  };
  updateAt?: string | null;
  createAt?: string | null;
}

export default function ServiceConfiguration() {
  const { t, i18n } = useTranslation();
  const history = useHistory();
  const { isCompact, isNarrow } = useResponsiveViewportBand();
  const { activated } = useKeepAliveRouteState({
    restorePathname: SERVICE_CONFIGURATION_PATH,
    restoreFrom: [ADD_NEW_SERVICE_PATH],
    restoreStateKey: KEEP_ALIVE_RESTORE_STATE_KEY,
  });
  const [searchText, setSearchText] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [departmentFilter] = useState("ML");

  const [statusOptions, setStatusOptions] = useState<TypeDictionary[]>([]);
  const [typeOptions, setTypeOptions] = useState<TypeDictionary[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentItem[]>(
    []
  );
  const [categoryOptions, setCategoryOptions] = useState<any[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<TypeDictionary[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [priorityModalVisible, setPriorityModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterModalIncludesInlineFilters, setFilterModalIncludesInlineFilters] =
    useState(false);
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [indexCount, setIndexCount] = useState<any>({});

  // Duplicate modal state
  const [duplicateModal, setDuplicateModal] = useState<{
    visible: boolean;
    service: ServiceData | null;
  }>({
    visible: false,
    service: null,
  });

  const [historyModal, setHistoryModal] = useState<{
    visible: boolean;
    serviceCode: string;
    status: string;
  }>({
    visible: false,
    serviceCode: "",
    status: "",
  });

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    visible: boolean;
    service: ServiceData | null;
    loading: boolean;
  }>({
    visible: false,
    service: null,
    loading: false,
  });

  const typeMap = typeOptions.reduce((acc: any, item) => {
    acc[item.code] = item;
    return acc;
  }, {});
  const statusMap = statusOptions.reduce<Record<string, TypeDictionary>>(
    (acc, item) => {
      acc[item.code] = item;
      return acc;
    },
    {}
  );
  const statusLookupValues = statusOptions.reduce<Record<string, TypeDictionary>>(
    (acc, item) => {
      [item.code, item.nameEn, item.nameAr].forEach((value) => {
        const normalizedValue = String(value ?? "").trim();
        if (normalizedValue) {
          acc[normalizedValue] = item;
        }
      });
      return acc;
    },
    {}
  );
  const stats = [
    {
      label: t("serviceConfiguration.stats.totalServices"),
      value: indexCount["totalServices"] ?? 0,
      icon: menuIcon,
    },
    {
      label: t("serviceConfiguration.stats.published"),
      value: indexCount["published"] ?? 0,
      icon: SendIcon,
    },
    {
      label: t("serviceConfiguration.stats.prepublished"),
      value: indexCount["prepublished"] ?? 0,
      icon: SettingIcon,
    },
    {
      label: t("serviceConfiguration.stats.suspended"),
      value: indexCount["suspended"] ?? 0,
      icon: ClockEIcon,
    },
    {
      label: t("serviceConfiguration.stats.draft"),
      value: indexCount["draft"] ?? 0,
      icon: CalendarIcon,
    },
  ];

  const [dataSource, setDataSource] = useState<ServiceData[]>([]);
  const getNormalizedStatus = (status?: string | null) =>
    String(status ?? "").trim();
  const getVisibleServiceConfigurationActions = useCallback(
    (record: ServiceData): ServiceConfigurationActionKey[] => [
      getNormalizedStatus(record?.status) === SERVICE_STATUS_PUBLISHED
        ? "view"
        : "configure",
      "more",
    ],
    []
  );
  const getServiceConfigurationActionLabel = useCallback(
    (actionKey: ServiceConfigurationActionKey) => {
      if (actionKey === "view") {
        return t("serviceConfiguration.actions.view");
      }

      if (actionKey === "configure") {
        return t("serviceConfiguration.actions.configure");
      }

      return undefined;
    },
    [t]
  );
  const serviceConfigurationActionColumnWidth = useResponsiveActionColumnWidth<
    ServiceData,
    ServiceConfigurationActionKey
  >({
    rows: dataSource,
    buttonWidthMap: SERVICE_CONFIGURATION_ACTION_WIDTH_MAP,
    getVisibleActions: getVisibleServiceConfigurationActions,
    getActionLabel: getServiceConfigurationActionLabel,
    desktopConfig: SERVICE_CONFIGURATION_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: SERVICE_CONFIGURATION_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: SERVICE_CONFIGURATION_ACTION_TEXT_MEASURE_CONFIG,
  });

  function fetchServiceIndexCount() {
    getServiceIndexCount().then((res) => {
      setIndexCount(res.data);
    });
  }
  useEffect(() => {
    localStorage.removeItem("serviceCode");
    fetchServiceIndexCount();
  }, []);

  const fetchDropdownData = async () => {
    try {
      const [statusRes, typeRes, departmentRes, categoryRes, priorityRes] =
        await Promise.all([
          getTypeDictionaries("ServiceConfigStatus"),
          getTypeDictionaries("ServiceConfigServiceType"),
          // getTypeDictionaries("ServiceConfigResponsibleDepartment"),
          getDepartments(),
          getAllServiceCategories(),
          getTypeDictionaries("ServiceConfigPriority"),
        ]);

      const statusData = statusRes.data || statusRes || [];
      const typeData = typeRes.data || typeRes || [];
      const departmentData = Array.isArray(departmentRes?.data?.items)
        ? departmentRes.data.items
        : Array.isArray(departmentRes)
        ? departmentRes
        : [];
      const categoryData = categoryRes.data || categoryRes || [];
      const priorityData = priorityRes.data || priorityRes || [];

      setStatusOptions(statusData);
      setTypeOptions(typeData);
      setDepartmentOptions(departmentData);
      setCategoryOptions(categoryData);
      setPriorityOptions(priorityData);
    } catch (error) {
      console.error("Failed to fetch dropdown data:", error);
      setStatusOptions([]);
      setTypeOptions([]);
      setDepartmentOptions([]);
      setCategoryOptions([]);
      setPriorityOptions([]);
    }
  };

  const fetchServices = async () => {
    if (!activated) return;

    try {
      setLoading(true);

      const params = buildServiceListParams({
        currentPage,
        pageSize,
        searchText,
        statusFilter,
        typeFilter,
        departmentFilter,
        filterValues,
      });

      const response = await getAllServices(params);
      const responseData: any = response?.data?.data || response?.data || {};
      const serviceItems = Array.isArray(responseData.items)
        ? responseData.items
        : [];

      if (serviceItems.length > 0) {
        const formattedData = serviceItems.map((item: any) => {
          const serviceName =
            i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn;

          const children =
            item.serviceChildrens?.map((child: any) => {
              const childServiceName =
                i18n.resolvedLanguage === "ar" ? child.nameAr : child.nameEn;

              return {
                ...child,
                key: `${item.id}-${child.id}`,
                id: child.id,
                serviceCode: child.code,
                serviceName: childServiceName,
                serviceCategory:
                  (i18n.resolvedLanguage === "ar"
                    ? child.serviceCategories?.nameAr
                    : child.serviceCategories?.nameEn) ||
                  child.serviceCategoryId,
                status: child.status,
                statusInfo: child.statusInfo,
                type: child.type,
                department: child.department,
                lastUpdated: child.updateAt
                  ? fmt(child.updateAt, DISPLAY_DATE)
                  : "",
                isFavorite: false,
                orderNum: child.orderNum || 0,
                iscollect: child.iscollect || false,
              };
            }) || [];

          return {
            ...item,
            key: item.id.toString(),
            id: item.id,
            serviceCode: item.code,
            serviceName: serviceName,
            serviceCategory:
              (i18n.resolvedLanguage === "ar"
                ? item.serviceCategories?.nameAr
                : item.serviceCategories?.nameEn) || item.serviceCategoryId,
            lastUpdated: item.updateAt
              ? fmt(item.updateAt, DISPLAY_DATE)
              : item.createAt
              ? fmt(item.createAt, DISPLAY_DATE)
              : "",
            isFavorite: false,
            children: children.length > 0 ? children : undefined,
            orderNum: item.orderNum || 0,
            iscollect: item.iscollect || false,
          };
        });
        setDataSource(formattedData);
        setTotal(
          typeof responseData.totalItems === "number"
            ? responseData.totalItems
            : 0,
        );
      } else {
        setDataSource([]);
        setTotal(
          typeof responseData.totalItems === "number"
            ? responseData.totalItems
            : 0,
        );
      }
    } catch (error) {
      console.error("Failed to fetch services:", error);
      setDataSource([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchText(searchValue);
      setCurrentPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchValue, statusFilter, typeFilter]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  useEffect(() => {
    fetchServices();
  }, [
    currentPage,
    pageSize,
    filterValues,
    searchText,
    statusFilter,
    typeFilter,
    departmentFilter,
    i18n.language,
  ]);

  useKeepAliveActivated({
    onActivated: () => {
      fetchServiceIndexCount();
      fetchServices();
    },
    onDeactivated: () => {
      setPriorityModalVisible(false);
      setFilterModalVisible(false);
      setDuplicateModal({ visible: false, service: null });
      setHistoryModal({ visible: false, serviceCode: "", status: "" });
      setDeleteModal({ visible: false, service: null, loading: false });
    },
  });

  const handleFilterSearch = (values: FilterValues) => {
    const { status, type, ...advancedFilterValues } = values;
    setFilterValues(advancedFilterValues);
    if (filterModalIncludesInlineFilters) {
      setStatusFilter(status ?? null);
      setTypeFilter(type ?? null);
    }
    setFilterModalVisible(false);
    setCurrentPage(1);
  };
  /**
   * One per attribute the modal filters on; the start/end pair is a single
   * date range to the user, so it counts once.
   */
  const appliedFilterCount =
    countAppliedFilters([
      filterValues.serviceCategory,
      filterValues.priority,
      filterValues.department,
      filterValues.status,
      filterValues.type,
    ]) +
    (isAppliedFilterValue(filterValues.startTime) ||
    isAppliedFilterValue(filterValues.endTime)
      ? 1
      : 0);

  const handleOpenFilterModal = () => {
    setFilterModalIncludesInlineFilters(isNarrow);
    setFilterModalVisible(true);
  };
  const handleResetFilters = useCallback(() => {
    setSearchValue("");
    setSearchText("");
    setStatusFilter(null);
    setTypeFilter(null);
    setFilterValues({});
    setCurrentPage(1);
  }, []);

  const toggleFavorite = (key: string) => {
    setDataSource((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, isFavorite: !item.isFavorite } : item
      )
    );
  };

  // Handle duplicate service
  const handleDuplicate = async () => {
    if (!duplicateModal.service) return;

    try {
      if (!duplicateModal.service.id) return;

      const sourceId = duplicateModal.service.id;
      setDuplicateModal({ visible: false, service: null });
      history.push(
        `${ADD_NEW_SERVICE_PATH}?pageTitleKey=pageTitle.editService&type=duplicate&id=${sourceId}`,
      );
    } catch (error) {
      CustomMessage.error(t("common.operationFailed"));
    }
  };

  // Handle delete service
  const handleDelete = async () => {
    if (!deleteModal.service || !deleteModal.service.id) return;

    setDeleteModal((prev) => ({ ...prev, loading: true }));

    try {
      await deleteService(deleteModal.service.id);
      CustomMessage.success(t("common.operationSuccess"));

      // Close modal
      setDeleteModal({ visible: false, service: null, loading: false });

      // Refresh list
      fetchServices();

      fetchServiceIndexCount();
    } catch (error) {
      console.error("Failed to delete service:", error);
      CustomMessage.error(t("common.operationFailed"));
      setDeleteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Handle menu click
  const handleMenuClick = async (key: string, record: ServiceData) => {
    switch (key) {
      case "duplicate":
        setDuplicateModal({ visible: true, service: record });
        break;
      case "delete":
        setDeleteModal({ visible: true, service: record, loading: false });
        break;
      case "history":
        setHistoryModal({ visible: true, serviceCode: record.serviceCode, status: record.status });
        break;
      case "suspend": {
        let relatedServices: ServiceChildItem[] = [];

        try {
          const response = await getServiceById(record.id);
          const serviceDetail = response.data || response;
          relatedServices = Array.isArray(serviceDetail?.serviceChildrens)
            ? serviceDetail.serviceChildrens
            : [];
        } catch (error) {
          console.error("Failed to load related services:", error);
          CustomMessage.error(t("common.operationFailed"));
          break;
        }

        if (relatedServices.length > 0) {
          const modal = Modal.confirm({
            className: "suspend-prompt",
            centered: true,
            title: t("suspendPrompt.title"),
            content: (
              <div>
                {t("suspendPrompt.message2")}
                <div className="suspend-sub-service">
                  <div className="suspend-sub-service-title">
                    {t("suspendPrompt.following")}:
                  </div>
                  <div className="suspend-sub-service-following">
                    {relatedServices.map((child) => (
                      <div
                        key={child.id}
                        className="suspend-sub-service-following-name"
                      >
                        {i18n.resolvedLanguage === "ar"
                          ? child.nameAr
                          : child.nameEn}
                        (
                        {i18n.resolvedLanguage === "ar"
                          ? typeMap[child.type]?.nameAr
                          : typeMap[child.type]?.nameEn}
                        )
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ),
            icon: <WarnCircle className="warn-circle-icon" />,
            okText: t("common.confirm"),
            cancelText: t("common.cancel"),
            okButtonProps: {
              loading: false,
            },
            onOk: async () => {
              try {
                modal.update({ okButtonProps: { loading: true } });
                await updateServiceStatus({ id: record.id!, status: "3" });
                fetchServiceIndexCount();
                fetchServices();
              } finally {
                modal.update({ okButtonProps: { loading: false } });
              }
            },
            onCancel: () => {
              modal.destroy();
            },
          });
        } else {
          const modal = Modal.confirm({
            className: "suspend-prompt",
            centered: true,
            title: t("suspendPrompt.title"),
            content: t("suspendPrompt.message"),
            icon: <WarnCircle className="warn-circle-icon" />,
            okText: t("common.confirm"),
            cancelText: t("common.cancel"),
            okButtonProps: {
              loading: false,
            },
            onOk: async () => {
              try {
                modal.update({ okButtonProps: { loading: true } });
                await updateServiceStatus({ id: record.id!, status: "3" });
                fetchServiceIndexCount();
                fetchServices();
              } finally {
                modal.update({ okButtonProps: { loading: false } });
              }
            },
            onCancel: () => {
              modal.destroy();
            },
          });
        }

        break;
      }
      default:
        break;
    }
  };

  const getStatusDictionary = (
    status?: string | null,
    statusInfo?: TypeDictionaryInfo
  ) => {
    const statusInfoCode = String(statusInfo?.code ?? "").trim();
    if (statusInfoCode && statusMap[statusInfoCode]) {
      return statusMap[statusInfoCode];
    }

    const normalizedStatus = getNormalizedStatus(status);
    if (normalizedStatus && statusLookupValues[normalizedStatus]) {
      return statusLookupValues[normalizedStatus];
    }

    return statusInfo;
  };

  const getResolvedStatusCode = (
    status?: string | null,
    statusInfo?: TypeDictionaryInfo
  ) =>
    String(
      getStatusDictionary(status, statusInfo)?.code ?? getNormalizedStatus(status)
    ).trim();

  const getLocalizedStatusLabel = (
    status?: string | null,
    statusInfo?: TypeDictionaryInfo
  ) => {
    const statusDictionary = getStatusDictionary(status, statusInfo);
    const localizedLabel =
      i18n.resolvedLanguage === "ar"
        ? statusDictionary?.nameAr || statusDictionary?.nameEn
        : statusDictionary?.nameEn || statusDictionary?.nameAr;

    return localizedLabel || getNormalizedStatus(status) || "--";
  };

  const getStatusColor = (statusCode: string) => {
    const colors: { [key: string]: string } = {
      [SERVICE_STATUS_SUSPENDED]: "#FEF2F2",
      [SERVICE_STATUS_DRAFT]: "#E1E3E580",
      [SERVICE_STATUS_PUBLISHED]: "#F3FAF4",
      [SERVICE_STATUS_PRE_PUBLISHED]: "#FFFBEB",
    };
    return colors[statusCode] || "#F8F7F4";
  };

  const getStatusTextColor = (statusCode: string) => {
    const colors: { [key: string]: string } = {
      [SERVICE_STATUS_SUSPENDED]: "#EA4F49",
      [SERVICE_STATUS_DRAFT]: "#5F646D",
      [SERVICE_STATUS_PUBLISHED]: "#4A9D5C",
      [SERVICE_STATUS_PRE_PUBLISHED]: "#F29F0E",
    };
    return colors[statusCode] || "#999";
  };

  const getActionMenu = (record: ServiceData) => {
    const normalizedStatus = getNormalizedStatus(record?.status);
    const canViewHistory =
      normalizedStatus === SERVICE_STATUS_DRAFT ||
      normalizedStatus === SERVICE_STATUS_SUSPENDED;
    const disableDelete =
      normalizedStatus === SERVICE_STATUS_PRE_PUBLISHED ||
      normalizedStatus === SERVICE_STATUS_PUBLISHED;

    return (
      <Menu onClick={({ key }) => handleMenuClick(key, record)}>
        <Menu.Item
          disabled={normalizedStatus !== SERVICE_STATUS_PUBLISHED}
          key="suspend"
        >
          {t("serviceConfiguration.actions.suspend")}
        </Menu.Item>
        <Menu.Item key="duplicate">
          {t("serviceConfiguration.actions.duplicate")}
        </Menu.Item>
        <Menu.Item disabled={!canViewHistory} key="history">
          {t("serviceConfiguration.actions.history")}
        </Menu.Item>
        <Menu.Item disabled={disableDelete} key="delete">
          {t("serviceConfiguration.actions.delete")}
        </Menu.Item>
      </Menu>
    );
  };

  const spanTarget = useRef<HTMLSpanElement[]>([]);

  const hasChildServices = (record?: ServiceData | null) =>
    (record?.children?.length ?? 0) > 0;

  useEffect(() => { 
    if(spanTarget.current.length > 0){
      spanTarget.current.forEach(span => { 
        clamp2(span);
      });
    }
  }, [dataSource]);

  const columns = [
    {
      title: t("serviceConfiguration.table.serviceCode"),
      dataIndex: "serviceCode",
      key: "serviceCode",
      width: 150,
      onCell: () => ({
        className: "service-config-first-cell",
      }),
      render: (text: ServiceData["serviceCode"]) => {
        const serviceCodeText =
          typeof text === "string" || typeof text === "number"
            ? String(text).trim()
            : "";
        const displayServiceCode = serviceCodeText || "--";

        return (
          <div title={displayServiceCode} className="service-config-code">
            <span className="service-config-code-text">
              {displayServiceCode}
            </span>
          </div>
        );
      },
    },
    {
      title: t("serviceConfiguration.table.serviceName"),
      dataIndex: "serviceName",
      key: "serviceName",
      width: 200,
      render: (text: string, record: ServiceData) => {
        const serviceNameText =
          typeof text === "string" || typeof text === "number"
            ? String(text).trim()
            : "";
        const displayServiceName = serviceNameText || "--";

        return (
          <div title={displayServiceName} className="service-config-name">
            <span className="service-config-service-name" ref={(e)=>{
              if(e){
                spanTarget.current[record.id] = e;
              }
            }}>{displayServiceName}</span>
          </div>
        );
      },
    },
    {
      title: t("serviceConfiguration.table.serviceCategory"),
      dataIndex: "serviceCategory",
      key: "serviceCategory",
      width: 200,
    },
    {
      title: t("serviceConfiguration.table.type"),
      dataIndex: "type",
      key: "type",
      width: 150,
      render: (type: string) => (
        <span>
          {i18n.resolvedLanguage === "ar"
            ? typeMap[type]?.nameAr
            : typeMap[type]?.nameEn}
        </span>
      ),
    },
    {
      title: t("serviceConfiguration.table.status"),
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string, record: ServiceData) => {
        const statusCode = getResolvedStatusCode(status, record.statusInfo);
        return (
          <Tag
            style={{
              backgroundColor: getStatusColor(statusCode),
              color: getStatusTextColor(statusCode),
              border: "none",
              borderRadius: "4px",
              padding: "2px 8px",
              fontSize: "14px",
            }}
          >
            {getLocalizedStatusLabel(status, record.statusInfo)}
          </Tag>
        );
      },
    },
    {
      title: t("serviceConfiguration.table.department"),
      dataIndex: "departmentInfo",
      key: "departmentInfo",
      width: 120,
      render: (dept: any) => {
        return i18n.resolvedLanguage === "ar"
          ? dept?.nameAr || dept?.name
          : dept?.nameEn || dept?.name;
      },
    },
    {
      title: t("serviceConfiguration.table.lastUpdated"),
      dataIndex: "lastUpdated",
      key: "lastUpdated",
      width: 130,
      render: (_: unknown, record: any) => (
        <div>
          {!!record.updateAt &&
            moment(record.updateAt).format("DD-MM-YYYY")}
        </div>
      ),
    },
    {
      title: t("serviceConfiguration.table.actions"),
      key: "actions",
      width: serviceConfigurationActionColumnWidth,
      render: (_: unknown, record: ServiceData) => (
        <div className="service-configuration-table-actions">
          <Button
            type="link"
            style={{ color: "#92722A", padding: 0 }}
            onClick={() => {
              if (
                getNormalizedStatus(record?.status) ===
                SERVICE_STATUS_PUBLISHED
              ) {
                history.push(
                  `${ADD_NEW_SERVICE_PATH}?pageTitleKey=pageTitle.viewService&serviceCode=${record.serviceCode}&id=${record.id}&view=1`
                );
              } else {
                //  AddNewService ， serviceCode
                
                history.push(
                  `${ADD_NEW_SERVICE_PATH}?pageTitleKey=pageTitle.configureService&serviceCode=${record.serviceCode}&id=${record.id}`
                );
              }
            }}
          >
            {getNormalizedStatus(record?.status) === SERVICE_STATUS_PUBLISHED
              ? t("serviceConfiguration.actions.view")
              : t("serviceConfiguration.actions.configure")}
          </Button>
          <Dropdown
            overlay={getActionMenu(record)}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              style={{ padding: "4px" }}
            />
          </Dropdown>
        </div>
      ),
    },
  ];

  const handleSavePriority = () => {
    fetchServices();
  };

  
  return (
    <div
      className={`service-configuration-container${
        isCompact ? " service-configuration-container--compact" : ""
      }${isNarrow ? " service-configuration-container--narrow" : ""}`}
    >
      <div className="stats-cards">
        {stats.map((stat, index) => (
          <Card key={index} className="stat-card">
            <div className="stat-icon">
              <img className="stat-icon__image" src={stat.icon} alt="" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="table-card">
        <div className="table-toolbar responsive-filter-toolbar service-configuration-toolbar">
          <div className="filters responsive-filter-toolbar__controls service-configuration-toolbar__controls">
            <Input
              placeholder={t("serviceConfiguration.filters.search")}
              prefix={<Sousuo className="search-icon" />}
              value={searchValue}
              onChange={(e) => {
                const value = e.target.value;
                if(value.length <= 100){
                  setSearchValue(value);
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text');
                const newVal = (searchValue + pasted).slice(0, 100);
                setSearchValue(newVal);
              }}
              className="search-input responsive-filter-toolbar__field responsive-filter-toolbar__field--search responsive-filter-toolbar__field--single-visible-search service-configuration-toolbar__search"
              allowClear
            />
            <Select
              allowClear
              placeholder={t("form.placeholder.allStatus")}
              getPopupContainer={(triggerNode) => triggerNode.parentNode}
              value={statusFilter}
              onChange={setStatusFilter}
              className="filters-select responsive-filter-toolbar__field service-configuration-toolbar__secondary-filter"
            >
              {statusOptions.map((option) => {
                const label =
                  i18n.resolvedLanguage === "ar" ? option.nameAr : option.nameEn;
                return (
                  <Option key={option.id} value={option.code}>
                    {label}
                  </Option>
                );
              })}
            </Select>
            <Select
              allowClear
              placeholder={t("form.placeholder.allTypes")}
              getPopupContainer={(triggerNode) => triggerNode.parentNode}
              value={typeFilter}
              onChange={setTypeFilter}
              className="filters-select responsive-filter-toolbar__field service-configuration-toolbar__secondary-filter"
            >
              {typeOptions.map((option) => {
                const label =
                  i18n.resolvedLanguage === "ar" ? option.nameAr : option.nameEn;
                return (
                  <Option key={option.id} value={option.code}>
                    {label}
                  </Option>
                );
              })}
            </Select>
            {/* <Select
              getPopupContainer={(triggerNode) => triggerNode.parentNode}
              value={departmentFilter}
              onChange={setDepartmentFilter}
              className="filters-select"
            >
              {departmentOptions.map((option) => {
                const currentLang = localStorage.getItem("language") || "en";
                const label =
                  currentLang === "ar" ? option.nameAr : option.nameEn;
                return (
                  <Option key={option.id} value={option.code}>
                    {label}
                  </Option>
                );
              })}
            </Select> */}
            <CustomButton
              variant="outline"
              customClassName="filters-filterBtn responsive-filter-toolbar__button responsive-filter-toolbar__filter-button service-configuration-toolbar__filter-button filter-trigger-with-count"
              onClick={handleOpenFilterModal}
            >
              {t("serviceConfiguration.filters.filter")}
              <img className="filter-trigger-funnel" src={SortIcon} alt="" />
              <FilterCountBadge count={appliedFilterCount} />
            </CustomButton>
            <CustomButton
              text={t("common.reset")}
              variant="outline"
              customClassName="filters-resetBtn responsive-filter-toolbar__button responsive-filter-toolbar__reset-button service-configuration-toolbar__reset-button"
              onClick={handleResetFilters}
            />
          </div>

          <div className="table-toolbar-right responsive-filter-toolbar__action service-configuration-toolbar__actions">
            <PermissionGuard
              permissionCode="Service.ServiceConfiguration.Save"
              routePath="/service-management/service-configuration"
            >
              <CustomButton
                text={t("serviceConfiguration.filters.managePriority")}
                variant="outline"
                iconPosition="right"
                onClick={() => setPriorityModalVisible(true)}
                permissionCode="Service.ServiceConfiguration.ManagePriority"
                permissionRoutePath="/service-management/service-configuration"
              />
            </PermissionGuard>

            <CustomButton
              text={t("addNewService.addNew")}
              variant="primary"
              iconPosition="right"
              onClick={() => history.push(`${ADD_NEW_SERVICE_PATH}?from=add`)}
            />
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={dataSource}
          loading={loading}
          pagination={{
            size: "default",
            total: total,
            pageSize: pageSize,
            current: currentPage,
            showSizeChanger: true,
            showTotal: (total) => (
              <PaginationTotal
                label={t("common.total")}
                total={total}
                current={currentPage}
                pageSize={pageSize}
              />
            ),
            pageSizeOptions: ["10", "20", "50", "100"],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
          expandable={{
            expandedRowKeys,
            onExpandedRowsChange: (keys) =>
              setExpandedRowKeys(keys as React.Key[]),
            indentSize: 30,
            expandIcon: ({ expanded, onExpand, record }) => {
              const expandable = hasChildServices(record);
              const canToggleFavorite = Boolean(record?.iscollect && record?.key);
              const renderFavoriteInExpandSlot =
                canToggleFavorite && !expandable;

              return (
                <span className="service-config-prefix">
                  <span className="service-config-collect-slot">
                    {canToggleFavorite && expandable ? (
                      <img
                        src={StarIcon}
                        alt=""
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleFavorite(record.key);
                        }}
                        className="service-config-collect-icon"
                      />
                    ) : (
                      <span className="service-config-collect-placeholder" />
                    )}
                  </span>
                  <span
                    className={`service-config-expand-slot${
                      renderFavoriteInExpandSlot
                        ? " service-config-expand-slot--collect"
                        : ""
                    }`}
                  >
                    {expandable ? (
                      expanded ? (
                        <DownOutlined
                          onClick={(e) => onExpand(record, e)}
                          className="admin-table-downOut service-config-expand-icon"
                        />
                      ) : (
                        <RightOutlined
                          className="admin-table-rightOut service-config-expand-icon"
                          onClick={(e) => onExpand(record, e)}
                        />
                      )
                    ) : renderFavoriteInExpandSlot ? (
                      <img
                        src={StarIcon}
                        alt=""
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleFavorite(record.key);
                        }}
                        className="service-config-collect-icon"
                      />
                    ) : (
                      <span className="service-config-expand-placeholder" />
                    )}
                  </span>
                </span>
              );
            },
          }}
          className="service-table admin-table"
        />
      </Card>

      <ManagePriorityModal
        visible={priorityModalVisible}
        onClose={() => setPriorityModalVisible(false)}
        onSave={() => {
          handleSavePriority();
        }}
      />

      {/* Filter Modal */}
      <FilterModal
        visible={filterModalVisible}
        onCancel={() => setFilterModalVisible(false)}
        onSearch={handleFilterSearch}
        initialValues={
          filterModalIncludesInlineFilters
            ? {
                ...filterValues,
                status: statusFilter ?? undefined,
                type: typeFilter ?? undefined,
              }
            : filterValues
        }
        categoryOptions={categoryOptions}
        departmentOptions={departmentOptions}
        priorityOptions={priorityOptions}
        statusOptions={statusOptions}
        typeOptions={typeOptions}
        includeInlineFilters={filterModalIncludesInlineFilters}
      />

      {/* Duplicate Confirmation Modal */}
      <ConfirmModal
        visible={duplicateModal.visible}
        type="warning"
        title={t("serviceConfiguration.modals.duplicate.title")}
        content={t("serviceConfiguration.modals.duplicate.content")}
        cancelText={t("common.cancel")}
        confirmText={t("common.confirm")}
        onCancel={() => setDuplicateModal({ visible: false, service: null })}
        onConfirm={handleDuplicate}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={deleteModal.visible}
        type="danger"
        title={t("serviceConfiguration.modals.delete.title")}
        content={t("serviceConfiguration.modals.delete.content")}
        cancelText={t("common.cancel")}
        confirmText={t("common.delete")}
        onCancel={() =>
          setDeleteModal({ visible: false, service: null, loading: false })
        }
        onConfirm={handleDelete}
        loading={deleteModal.loading}
        icon={icon}
      />
      <History status={historyModal.status} visible={historyModal.visible} serviceCode={historyModal.serviceCode} onClose={() => setHistoryModal({ visible: false, serviceCode: '', status: '' })} />
    </div>
  );
}
