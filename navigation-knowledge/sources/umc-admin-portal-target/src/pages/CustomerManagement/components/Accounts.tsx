import {
  Form,
  Input,
  Table,
  DatePicker,
  Tooltip,
  message,
  Modal,
  Select,
  Dropdown,
  Menu,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { RangePickerProps } from "antd/es/date-picker";
import {
  ConfirmModal,
  CustomButton,
  CustomMessage,
  getApiErrorMessage,
  PaginationTotal,
  ResponsiveFilterModal,
  SelectAllDropdown,
} from "@/components/common";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import { useEffect, useState, useMemo, useRef } from "react";
import { useHistory } from "react-router-dom";
import { useCanRenderButton } from "@/routes/access";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import { MoreOutlined } from "@ant-design/icons";
import SortIcon from "@/assets/images/sort.png";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { NARROW_TOOLBAR_MEDIA_QUERY } from "@/components/common/FilterTable/responsiveLayout";
import Sousuo from "@/assets/icons/Sousuo";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import debounce from "lodash/debounce";
import clamp2 from "@/utils/clamp2";
import dayjs from "dayjs";
import menuIcon from "@/assets/images/godMenu.svg";
import bookIcon from "@/assets/images/redBook.svg";
import userIcon from "@/assets/images/greenUser.svg";
import multiProfileAccountsIcon from "@/assets/images/MultiProfileAccounts.svg";
import newInLastIcon from "@/assets/images/NewinLast.svg";
import {
  getCustomerUsers,
  getCustomerInfoCount,
  updateCustomerUserActive,
  exportCustomerUsersAsync,
  getTypeDictionariesLoginMethod,
  sendCustomerEmail,
  SendSMS,
  SendExternalSMS,
  impersonateCustomer,
  type ICustomerUser,
  type ICustomerListResponse,
  type ICustomerCountResponse,
  type ILoginMethodDictionary,
  type ISendCustomerEmailParams,
} from "@/services/customerManagement";
import { useTranslation } from "react-i18next";
import { pxToRemValue } from "@/utils/rem";
import AlertBanner from "@/components/common/AlertBanner";
import SendEmailModal, { type SendEmailModalRef } from "./SendEmailModal";
import ImpersonateConfirmModal, {
  type ImpersonateAccount,
  type ImpersonateConfirmModalRef,
} from "./ImpersonateConfirmModal";
import SendMessageModal, {
  type SendMessagePayload,
  type SendMessageModalRef,
} from "./SendMessageModal";
import { createCustomerImpersonationUrlBuilder } from "../customerImpersonationUrl";
import "@/components/common/FilterTable/index.less";
const { RangePicker } = DatePicker;

interface IAccountListRequest {
  PageSize: number;
  PageIndex: number;
  KeyWorld?: string;
  StatrTime?: string;
  EndTime?: string;
  Status?: string;
  Sort?: number;
  LoginMethod?: string;
}

const createInitialParams = (): IAccountListRequest => ({
  PageSize: 10,
  PageIndex: 1,
  KeyWorld: "",
  StatrTime: undefined,
  EndTime: undefined,
  Status: undefined,
  Sort: undefined,
  LoginMethod: undefined,
});

const ALL_LOGIN_METHOD_CODE = "3";
const LOGIN_METHOD_SORT_ORDER: Record<string, number> = {
  "2": 0,
  "1": 1,
};
type CustomerAccountsActionColumnKey =
  | "suspend"
  | "activate"
  | "sendEmail"
  | "more";

const CUSTOMER_ACCOUNTS_ACTION_COLUMN_BASE_SCROLL_X = 1340;
const CUSTOMER_ACCOUNTS_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<CustomerAccountsActionColumnKey> =
  {
    suspend: { default: 100, compact: 100 },
    activate: { default: 100, compact: 100 },
    sendEmail: { default: 100, compact: 100 },
    more: { default: 36, compact: 36 },
  };
const CUSTOMER_ACCOUNTS_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 8,
  padding: 32,
  minWidth: 128,
  maxWidth: 340,
};
const CUSTOMER_ACCOUNTS_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 112,
  maxWidth: 320,
};
const CUSTOMER_ACCOUNTS_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 32,
};

const normalizeLoginMethods = (loginMethods: unknown[]): string[] =>
  Array.from(
    new Set(
      loginMethods
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const parseLoginMethods = (loginMethods?: string): string[] =>
  typeof loginMethods === "string"
    ? normalizeLoginMethods(loginMethods.split(","))
    : [];

const serializeLoginMethods = (
  loginMethods: string[],
  availableLoginMethods: string[],
): string | undefined => {
  const availableValues = normalizeLoginMethods(availableLoginMethods).filter(
    (item) => item !== ALL_LOGIN_METHOD_CODE,
  );
  const selectedValues = normalizeLoginMethods(loginMethods).filter(
    (item) =>
      item !== ALL_LOGIN_METHOD_CODE && availableValues.includes(item),
  );

  if (
    availableValues.length > 0 &&
    availableValues.every((item) => selectedValues.includes(item))
  ) {
    return ALL_LOGIN_METHOD_CODE;
  }

  return selectedValues.length > 0 ? selectedValues.join(",") : undefined;
};

export default function Accounts() {
  const { t, i18n } = useTranslation();
  const history = useHistory();
  const emailModalRef = useRef<SendEmailModalRef>(null);
  const impersonateModalRef = useRef<ImpersonateConfirmModalRef>(null);
  const canSendEmail = useCanRenderButton(
    "CustomerModule.Customers.SendEmail",
    "/happiness/customerManagement",
  );
  const canImpersonate = useCanRenderButton(
    "CustomerModule.Customers.Impersonate",
    "/happiness/customerManagement",
  );
  const canSendSms = useCanRenderButton(
    "CustomerModule.Customers.SendSMS",
    "/happiness/customerManagement",
  );
  const canSendExternalSms = useCanRenderButton(
    "CustomerModule.Customers.SendExternalSMS",
    "/happiness/customerManagement",
  );
  const canConfirm = useCanRenderButton(
    "CustomerModule.Customers.Confirm",
    "/happiness/customerManagement",
  );
  const messageModalRef = useRef<SendMessageModalRef>(null);
  const latestListRequestIdRef = useRef(0);
  const latestCountRequestIdRef = useRef(0);
  const [form1] = Form.useForm();
  const [data, setData] = useState<ICustomerListResponse>({
    items: [],
    totalItems: 0,
    itemsPerPage: 10,
    currentPage: 1,
    totalPage: 1,
    totalAmount: 0,
  });
  const [params, setParams] =
    useState<IAccountListRequest>(createInitialParams);
  const [FilterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedLoginMethods, setSelectedLoginMethods] = useState<string[]>(
    [],
  );
  // Drafts for the Status / date-range filters in the filter modal.
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(
    undefined,
  );
  const [selectedDateRange, setSelectedDateRange] =
    useState<RangePickerProps["value"]>(null);
  const handleFilterValuesChange = useMemo(
    () => debounce((_changedValues, values) => {
      setParams((prev) => ({
        ...prev,
        KeyWorld: values.KeyWorld,
        Status: values.Status,
        StatrTime: values.dateRange?.[0]?.format("YYYY-MM-DD"),
        EndTime: values.dateRange?.[1]?.format("YYYY-MM-DD"),
        PageIndex: 1,
      }));
    }, 300),
    [],
  );

  const normalizedStatus = useMemo(() => {
    if (!params.Status || params.Status === "") return undefined;
    if (params.Status === "true") return true;
    if (params.Status === "false") return false;
    return undefined;
  }, [params.Status]);

  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ICustomerUser | null>(
    null,
  );
  const [accountsCount, setAccountsCount] = useState<ICustomerCountResponse>({
    totalCount: 0,
    activeCount: 0,
    suspended: 0,
    multiProfileAccounts: 0,
    newInLast7Days: 0,
  });
  const [confirmModalLoading, setConfirmModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<"suspend" | "activate" | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState("");

  const quickNotes = useMemo(
    () => [
      t("Customer.accounts.modals.quickNote1"),
      t("Customer.accounts.modals.quickNote2"),
      t("Customer.accounts.modals.quickNote3"),
      t("Customer.accounts.modals.quickNote4"),
    ],
    [t],
  );
  const statusOptions = [
    { label: t("Customer.accounts.placeholders.allStatuses"), value: "" },
    { label: t("customStatusTag.active"), value: "true" },
    { label: t("customStatusTag.suspended"), value: "false" },
  ];
  const [LoginMethodOptions, setLoginMethodOptions] = useState<
    ILoginMethodDictionary[]
  >([]);
  const loginMethodOptions = useMemo(() => {
    const optionValues = new Set<string>();

    const options = LoginMethodOptions.reduce<
      Array<{ label: string; value: string }>
    >(
      (options, item) => {
        const value = item?.code?.trim();

        if (
          !value ||
          value === ALL_LOGIN_METHOD_CODE ||
          optionValues.has(value)
        ) {
          return options;
        }

        optionValues.add(value);
        options.push({
          label:
            (i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn) ||
            item.nameEn ||
            item.nameAr ||
            value,
          value,
        });

        return options;
      },
      [],
    );

    return options.sort(
      (left, right) =>
        (LOGIN_METHOD_SORT_ORDER[left.value] ?? Number.MAX_SAFE_INTEGER) -
        (LOGIN_METHOD_SORT_ORDER[right.value] ?? Number.MAX_SAFE_INTEGER),
    );
  }, [LoginMethodOptions, i18n.language]);
  const loginMethodValues = useMemo(
    () => loginMethodOptions.map((item) => item.value),
    [loginMethodOptions],
  );
  const getSelectedLoginMethods = (loginMethods?: string): string[] => {
    const parsedLoginMethods = parseLoginMethods(loginMethods);

    if (parsedLoginMethods.includes(ALL_LOGIN_METHOD_CODE)) {
      return loginMethodValues.length > 0
        ? loginMethodValues
        : [ALL_LOGIN_METHOD_CODE];
    }

    return parsedLoginMethods.filter((item) => loginMethodValues.includes(item));
  };
  const actionsColumnWidth = useResponsiveActionColumnWidth<
    ICustomerUser,
    CustomerAccountsActionColumnKey
  >({
    rows: data.items,
    buttonWidthMap: CUSTOMER_ACCOUNTS_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: (record) => {
      const visibleActions: CustomerAccountsActionColumnKey[] = [];
      const canEmailAccount = canSendEmail && Boolean(record.email?.trim());
      const canSmsAccount = canSendSms && Boolean(record.phone?.trim());
      const canImpersonateAccount = canImpersonate && record.status === true;

      if (canConfirm) {
        visibleActions.push(record.status ? "suspend" : "activate");
      }

      if (canEmailAccount) {
        visibleActions.push("sendEmail");
      }

      if (canSmsAccount || canImpersonateAccount) {
        visibleActions.push("more");
      }

      return visibleActions;
    },
    getActionLabel: (actionKey) => {
      switch (actionKey) {
        case "suspend":
          return t("Customer.accounts.actions.suspend");
        case "activate":
          return t("Customer.accounts.actions.activate");
        case "sendEmail":
          return t("Customer.accounts.actions.sendEmail");
        default:
          return undefined;
      }
    },
    desktopConfig: CUSTOMER_ACCOUNTS_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: CUSTOMER_ACCOUNTS_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: CUSTOMER_ACCOUNTS_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });
  const columns: ColumnsType<ICustomerUser> = [
    {
      title: t("Customer.accounts.table.accountId"),
      dataIndex: "customerNo",
      key: "customerNo",
      fixed: "left",
      width: pxToRemValue(200),
      render(text: string) {
        return text || "-";
      },
    },
    {
      title: t("Customer.accounts.table.fullName"),
      dataIndex: "userName",
      key: "userName",
      width: pxToRemValue(220),
      render(text: string, record: ICustomerUser) {
        const displayName = text || record.userNameAr || "-";
        return (
          <Tooltip title={displayName} placement="top">
            <span className="accounts-table__full-name-tooltip">
              <span
                className="accounts-table__full-name-text"
                ref={(e: HTMLSpanElement | null) => {
                  if (e) clamp2(e);
                }}
              >
                {displayName}
              </span>
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: t("Customer.accounts.table.email"),
      dataIndex: "email",
      key: "email",
      width: pxToRemValue(240),
      render(text: string) {
        return (
          <Tooltip title={text}>
            <div ref={(e: HTMLDivElement) => clamp2(e)}>{text || "-"}</div>
          </Tooltip>
        );
      },
    },
    {
      title: t("Customer.accounts.table.mobileNumber"),
      dataIndex: "phone",
      key: "phone",
      width: pxToRemValue(240),
      render(text: string) {
        return text || "-";
      },
    },
    {
      title: t("Customer.accounts.table.loginMethod"),
      dataIndex: "loginMethod",
      key: "loginMethod",
      width: pxToRemValue(240),
      render(text: string) {
        return text || "-";
      },
    },
    {
      title: t("Customer.accounts.table.profiles"),
      dataIndex: "profileCount",
      key: "profileCount",
      width: pxToRemValue(120),
      render(text: number) {
        return t("Customer.accounts.labels.profilesCount", { count: text });
      },
    },
    {
      title: t("Customer.accounts.table.status"),
      dataIndex: "statusName",
      key: "statusName",
      width: pxToRemValue(140),
      render(text: string) {
        return <CustomStatusTag type="accountStatus" status={text} />;
      },
    },
    {
      title: t("Customer.accounts.table.registerTime"),
      dataIndex: "registeredTime",
      key: "registeredTime",
      sorter: true,
      width: pxToRemValue(180),
      render(text: string) {
        return text ? dayjs(text).format("DD/MM/YYYY HH:mm") : "-";
      },
    },
    {
      title: t("Customer.accounts.table.actions"),
      fixed: "right",
      width: pxToRemValue(actionsColumnWidth),
      key: "actions",
      render(_text: string, record: ICustomerUser) {
        const canEmailAccount = canSendEmail && Boolean(record.email?.trim());
        const canSmsAccount = canSendSms && Boolean(record.phone?.trim());
        const canImpersonateAccount = canImpersonate && record.status === true;

        const moreActions = (
          <Menu className="accounts-more-actions-menu">
            {canSmsAccount ? (
              <Menu.Item
                key="send-sms"
                onClick={({ domEvent }) => {
                  domEvent.stopPropagation();
                  messageModalRef.current?.open({
                    userId: record.userId,
                    countryCode: "+971",
                    mobileNumber: record.phone.trim(),
                    title: t("Customer.accounts.actions.sendSms"),
                    hideMobileNumber: true,
                  });
                }}
              >
                {t("Customer.accounts.actions.sendSms")}
              </Menu.Item>
            ) : null}
            {canImpersonateAccount ? (
              <Menu.Item
                key="login-to-account"
                onClick={({ domEvent }) => {
                  domEvent.stopPropagation();
                  impersonateModalRef.current?.open({
                    userId: record.userId,
                    displayName:
                      record.userName || record.userNameAr || record.customerNo,
                  });
                }}
              >
                {t("Customer.accounts.actions.loginToAccount")}
              </Menu.Item>
            ) : null}
          </Menu>
        );

        return (
          <div className="accounts-table-actions">
            {record.status && (
              <CustomButton
                variant="text"
                permissionCode="CustomerModule.Customers.Confirm"
                permissionRoutePath="/happiness/customerManagement"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSelectedAccount(record);
                  setActionType("suspend");
                  setConfirmModalVisible(true);
                }}
              >
                {t("Customer.accounts.actions.suspend")}
              </CustomButton>
            )}
            {!record.status && (
              <CustomButton
                variant="text"
                permissionCode="CustomerModule.Customers.Confirm"
                permissionRoutePath="/happiness/customerManagement"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setSelectedAccount(record);
                  setActionType("activate");
                  setConfirmModalVisible(true);
                }}
              >
                {t("Customer.accounts.actions.activate")}
              </CustomButton>
            )}
            {canEmailAccount ? (
              <CustomButton
                variant="text"
                onClick={(event: React.MouseEvent) => {
                  event.stopPropagation();
                  emailModalRef.current?.open({
                    userId: record.userId,
                  });
                }}
              >
                {t("Customer.accounts.actions.sendEmail")}
              </CustomButton>
            ) : null}
            {canSmsAccount || canImpersonateAccount ? (
              <Dropdown
                overlay={moreActions}
                trigger={["click"]}
                placement="bottomRight"
              >
                <button
                  type="button"
                  className="accounts-more-actions-button"
                  aria-label={t("Customer.accounts.actions.moreActions")}
                >
                  <MoreOutlined />
                </button>
              </Dropdown>
            ) : null}
          </div>
        );
      },
    },
  ];

  async function pullAccountsList() {
    const requestId = latestListRequestIdRef.current + 1;
    latestListRequestIdRef.current = requestId;
    setLoading(true);
    console.log("params.Status", params);
    try {
      const response = await getCustomerUsers({
        PageIndex: params.PageIndex,
        PageSize: params.PageSize,
        KeyWorld: params.KeyWorld,
        StatrTime: params.StatrTime,
        EndTime: params.EndTime,
        Status: normalizedStatus,
        sort: params.Sort,
        LoginMethod: params.LoginMethod,
      });
      if (requestId === latestListRequestIdRef.current && response.data) {
        setData(response.data as ICustomerListResponse);
      }
    } catch (error) {
      if (requestId !== latestListRequestIdRef.current) {
        return;
      }
      console.error("Failed to fetch customer users:", error);
      message.error(t("Customer.accounts.messages.failedToLoadCustomerData"));
    } finally {
      if (requestId === latestListRequestIdRef.current) {
        setLoading(false);
      }
    }
  }

  async function pullAccountsCount() {
    const requestId = latestCountRequestIdRef.current + 1;
    latestCountRequestIdRef.current = requestId;
    try {
      const response = await getCustomerInfoCount();
      if (requestId === latestCountRequestIdRef.current && response.data) {
        setAccountsCount(response.data as ICustomerCountResponse);
      }
    } catch (error) {
      if (requestId !== latestCountRequestIdRef.current) {
        return;
      }
      console.error("Failed to fetch customer count:", error);
    }
  }
  const GetCustomerUsersAsync = async () => {
    try {
      const response = await getTypeDictionariesLoginMethod();
      setLoginMethodOptions(
        Array.isArray(response?.data) ? response.data : [],
      );
    } catch (error) {
      console.error("Failed to fetch login method options:", error);
      setLoginMethodOptions([]);
    }
  };
  const keepAliveActivated = useKeepAliveActivated({
    onActivated: () => {
      void pullAccountsList();
      void pullAccountsCount();
      void GetCustomerUsersAsync();
    },
    onDeactivated: () => {
      latestListRequestIdRef.current += 1;
      latestCountRequestIdRef.current += 1;
      setLoading(false);
      setFilterModalVisible(false);
      setConfirmModalVisible(false);
      setConfirmModalLoading(false);
      setSelectedAccount(null);
      setActionType(null);
      setNotes("");
      setNotesError("");
      emailModalRef.current?.close();
      impersonateModalRef.current?.close();
      messageModalRef.current?.close();
    },
  });
  const keepAliveActivatedRef = useRef(keepAliveActivated);
  keepAliveActivatedRef.current = keepAliveActivated;

  useEffect(() => {
    if (!keepAliveActivatedRef.current) return;
    pullAccountsList();
  }, [params]);

  useEffect(() => {
    if (!keepAliveActivatedRef.current) return;
    pullAccountsCount();
    void GetCustomerUsersAsync();
  }, []);

  useEffect(() => {
    if (
      !FilterModalVisible ||
      !selectedLoginMethods.includes(ALL_LOGIN_METHOD_CODE) ||
      loginMethodValues.length === 0
    ) {
      return;
    }

    setSelectedLoginMethods(loginMethodValues);
  }, [FilterModalVisible, loginMethodValues, selectedLoginMethods]);

  const handleExport = () => {
    exportCustomerUsersAsync(
      {
        // PageIndex: params.PageIndex,
        // PageSize: params.PageSize,
        KeyWorld: params.KeyWorld,
        StatrTime: params.StatrTime,
        EndTime: params.EndTime,
        Status: normalizedStatus,
      },
      `Accounts-${dayjs().format("DDMMYYYY-HHmmss")}.csv`,
    );
  };

  async function handleSendCustomerEmail(payload: ISendCustomerEmailParams) {
    try {
      const response = await sendCustomerEmail(payload);
      if (response.isSuccess === false || response.data !== true) {
        throw new Error(
          response.message || t("Customer.accounts.messages.emailFailed"),
        );
      }
      CustomMessage.success(t("Customer.accounts.messages.emailSent"));
    } catch (error) {
      const errorMessage =
        getApiErrorMessage(error) ||
        t("Customer.accounts.messages.emailFailed");
      CustomMessage.error(t("Customer.accounts.messages.emailFailed"));

      // This message pattern is part of the current backend error contract.
      if (
        /customer account (not found|has no valid registered email)/i.test(
          errorMessage,
        )
      ) {
        await pullAccountsList();
      }
      throw error;
    }
  }

  async function handleSendSms(payload: SendMessagePayload) {
    try {
      const response = payload.userId
        ? await SendSMS({
            userId: payload.userId,
            message: payload.message,
          })
        : await SendExternalSMS({
            countryCode: payload.countryCode,
            mobileNumber: payload.mobileNumber,
            message: payload.message,
          });
      if (response.isSuccess !== true || response.data !== true) {
        throw new Error(
          response.message || t("Customer.accounts.messages.smsFailed"),
        );
      }
      CustomMessage.success(t("Customer.accounts.messages.smsSubmitted"));
    } catch (error) {
      const errorMessage =
        getApiErrorMessage(error) || t("Customer.accounts.messages.smsFailed");
      CustomMessage.error(t("Customer.accounts.messages.smsFailed"));
      if (
        payload.userId &&
        /customer account (not found|has no valid registered mobile number)/i.test(
          errorMessage,
        )
      ) {
        await pullAccountsList();
      }
      throw error;
    }
  }

  async function handleImpersonateCustomer(account: ImpersonateAccount) {
    const configuredPortalUrl = String(
      import.meta.env.VITE_CUSTOMER_PORTAL_URL || "",
    ).trim();

    let buildTargetUrl: (code: string) => string;
    try {
      buildTargetUrl = createCustomerImpersonationUrlBuilder(configuredPortalUrl);
    } catch {
      const configMessage = t(
        "Customer.accounts.messages.customerPortalNotConfigured",
      );
      CustomMessage.error(configMessage);
      throw new Error(configMessage);
    }

    try {
      const response = await impersonateCustomer({ userId: account.userId });
      const code = response.data?.code;
      if (response.isSuccess === false || !code) {
        throw new Error(
          response.message || t("Customer.accounts.messages.impersonateFailed"),
        );
      }
      window.open(buildTargetUrl(code), "_blank", "noopener,noreferrer");
    } catch (error) {
      const errorMessage =
        getApiErrorMessage(error) ||
        t("Customer.accounts.messages.impersonateFailed");
      CustomMessage.error(t("Customer.accounts.messages.impersonateFailed"));
      // This message pattern is part of the current backend error contract.
      if (/account is not active/i.test(errorMessage)) {
        await pullAccountsList();
      }
      throw error;
    }
  }

  const handleConfirmAction = async () => {
    if (selectedAccount) {
      const isActivate = actionType === "activate";
      if (!isActivate && !notes.trim()) {
        setNotesError(t("Customer.tickets.common.pleaseEnterNotes"));
        return;
      }

      setNotesError("");
      setConfirmModalLoading(true);
      try {
        await updateCustomerUserActive({
          userId: selectedAccount.userId,
          isActive: isActivate,
          reson: isActivate ? undefined : notes,
        });
        CustomMessage.success(t("common.operationSuccess"));
        setConfirmModalVisible(false);
        setNotes("");
        await pullAccountsList();
        await pullAccountsCount();
      } catch (error) {
        console.error("Failed to update customer status:", error);
        CustomMessage.error(t("common.operationFailed"));
      } finally {
        setConfirmModalLoading(false);
      }
    }
  };

  /**
   * The modal always carries the login-method picker; status and the date range
   * only fold into it on narrow layouts, so they are counted only there.
   */
  const isNarrowToolbar = useMediaQuery(NARROW_TOOLBAR_MEDIA_QUERY);
  const appliedFilterCount =
    countAppliedFilters([
      params.LoginMethod,
      ...(isNarrowToolbar ? [params.Status] : []),
    ]) +
    (isNarrowToolbar &&
    (isAppliedFilterValue(params.StatrTime) ||
      isAppliedFilterValue(params.EndTime))
      ? 1
      : 0);

  const handleOpenFilterModal = () => {
    setSelectedLoginMethods(getSelectedLoginMethods(params.LoginMethod));
    setSelectedStatus(form1.getFieldValue("Status"));
    setSelectedDateRange(form1.getFieldValue("dateRange") ?? null);
    setFilterModalVisible(true);
  };

  const handleCancelFilterModal = () => {
    setSelectedLoginMethods(getSelectedLoginMethods(params.LoginMethod));
    setFilterModalVisible(false);
  };

  const handleApplyFilterModal = () => {
    handleFilterValuesChange.flush();
    setFilterModalVisible(false);
    const isCompact = window.matchMedia("(max-width: 1439.98px)").matches;
    if (isCompact) {
      form1.setFieldsValue({
        Status: selectedStatus,
        dateRange: selectedDateRange,
      });
    }
    setParams((prev) => ({
      ...prev,
      PageIndex: 1,
      LoginMethod: serializeLoginMethods(
        selectedLoginMethods,
        loginMethodValues,
      ),
      ...(isCompact
        ? {
            Status: selectedStatus,
            StatrTime: selectedDateRange?.[0]
              ? selectedDateRange[0].format("YYYY-MM-DD")
              : undefined,
            EndTime: selectedDateRange?.[1]
              ? selectedDateRange[1].format("YYYY-MM-DD")
              : undefined,
          }
        : {}),
    }));
  };
  const handleReset = async () => {
    handleFilterValuesChange.cancel();
    await form1.resetFields();
    setSelectedLoginMethods([]);
    setSelectedStatus(undefined);
    setSelectedDateRange(null);
    setFilterModalVisible(false);
    setParams(createInitialParams());
  };

  useEffect(() => {
    return () => handleFilterValuesChange.cancel();
  }, [handleFilterValuesChange]);

  return (
    <div className="accounts-container accounts-container--scoped-toolbar">
      <div className="accounts-statistics">
        <div className="accounts-statistics-item">
          <div className="accounts-statistics-icon">
            <img src={menuIcon} />
          </div>
          <div className="accounts-statistics-text">
            <div className="accounts-statistics-text-number">
              {accountsCount.totalCount?.toLocaleString()}
            </div>
            <div className="accounts-statistics-text-desc">
              {t("Customer.accounts.stats.totalAccounts")}
            </div>
          </div>
        </div>
        <div className="accounts-statistics-item">
          <div className="accounts-statistics-icon">
            <img src={userIcon} />
          </div>
          <div className="accounts-statistics-text">
            <div className="accounts-statistics-text-number">
              {accountsCount.activeCount?.toLocaleString()}
            </div>
            <div className="accounts-statistics-text-desc">
              {t("Customer.accounts.stats.active")}
            </div>
          </div>
        </div>
        <div className="accounts-statistics-item">
          <div className="accounts-statistics-icon">
            <img src={bookIcon} />
          </div>
          <div className="accounts-statistics-text">
            <div className="accounts-statistics-text-number">
              {accountsCount.suspended?.toLocaleString()}
            </div>
            <div className="accounts-statistics-text-desc">
              {t("Customer.accounts.stats.suspended")}
            </div>
          </div>
        </div>

        <div className="accounts-statistics-item">
          <div className="accounts-statistics-icon">
            <img src={multiProfileAccountsIcon} />
          </div>
          <div className="accounts-statistics-text">
            <div className="accounts-statistics-text-number">
              {accountsCount.multiProfileAccounts?.toLocaleString()}
            </div>
            <div className="accounts-statistics-text-desc">
              {t("Customer.accounts.stats.multiProfileAccounts")}
            </div>
          </div>
        </div>

        <div className="accounts-statistics-item">
          <div className="accounts-statistics-icon">
            <img src={newInLastIcon} />
          </div>
          <div className="accounts-statistics-text">
            <div className="accounts-statistics-text-number">
              {accountsCount.newInLast7Days?.toLocaleString()}
            </div>
            <div className="accounts-statistics-text-desc">
              {t("Customer.accounts.stats.newInLast7Days")}
            </div>
          </div>
        </div>
      </div>

      <div className="accounts-table-container">
        <div className="accounts-table-header responsive-filter-toolbar">
          <Form
            form={form1}
            className="custorm-form accounts-form responsive-filter-toolbar__controls"
            onValuesChange={handleFilterValuesChange}
          >
            <Form.Item
              name="KeyWorld"
              className="responsive-filter-toolbar__field responsive-filter-toolbar__field--search"
            >
              <Input
                allowClear
                prefix={<Sousuo className="accounts-search-icon" />}
                placeholder={t("common.search")}
              />
            </Form.Item>

            <Form.Item
              className="accounts-form__field--status accounts-form__field--compact-hidden responsive-filter-toolbar__field"
              name="Status"
            >
              <Select
                className="statuses-select"
                dropdownClassName="accounts-status-select-dropdown"
                allowClear
                placeholder={t("Customer.accounts.placeholders.allStatuses")}
                getPopupContainer={(triggerNode) => triggerNode.parentNode}
              >
                {statusOptions.map((item) => {
                  return (
                    <Select.Option key={item.value} value={item.value}>
                      {item.label}
                    </Select.Option>
                  );
                })}
              </Select>
            </Form.Item>

            <Form.Item
              className="accounts-form__field--date-range accounts-form__field--compact-hidden responsive-filter-toolbar__field"
              name="dateRange"
            >
              <RangePicker
                className="date-range-picker"
                placeholder={[
                  t("Customer.accounts.placeholders.startTime"),
                  t("Customer.accounts.placeholders.endTime"),
                ]}
                format="DD/MM/YYYY"
              />
            </Form.Item>
            <Form.Item className="responsive-filter-toolbar__field accounts-form__action-item">
              <CustomButton
                variant="outline"
                customClassName="filters-filterBtn responsive-filter-toolbar__button responsive-filter-toolbar__filter-button filter-trigger-with-count"
                onClick={handleOpenFilterModal}
              >
                {t("common.filter")}
                <img className="filter-trigger-funnel" src={SortIcon} alt="" />
                <FilterCountBadge count={appliedFilterCount} />
              </CustomButton>
            </Form.Item>
            <Form.Item className="responsive-filter-toolbar__field accounts-form__action-item">
              <CustomButton
                variant="outline"
                text={t("common.reset")}
                customClassName="responsive-filter-toolbar__button responsive-filter-toolbar__reset-button"
                onClick={handleReset}
              />
            </Form.Item>
          </Form>
          <div className="accounts-header-actions responsive-filter-toolbar__action">
            {canSendExternalSms && (
              <CustomButton
                variant="primary"
                text={t("Customer.accounts.actions.externalSms")}
                customClassName="accounts-external-sms-button"
                onClick={() =>
                  messageModalRef.current?.open({
                    title: t(
                      "Customer.accounts.sendMessageModal.externalSmsTitle",
                    ),
                  })
                }
              />
            )}
            <CustomButton
              variant="outline"
              text={t("common.export")}
              permissionCode="CustomerModule.Customers.Export"
              permissionRoutePath="/happiness/customerManagement"
              onClick={handleExport}
            />
          </div>
        </div>
        <div className="accounts-table">
          <Table
            loading={loading}
            className="admin-table"
            columns={columns}
            scroll={{
              x: pxToRemValue(
                CUSTOMER_ACCOUNTS_ACTION_COLUMN_BASE_SCROLL_X +
                  actionsColumnWidth,
              ),
            }}
            dataSource={data.items}
            rowKey="userId"
            onChange={(p, _filters, sorter) => {
              const nextCurrent = Number(p.current || 1);
              const nextSize = Number(p.pageSize || 10);

              const order = Array.isArray(sorter)
                ? sorter[0]?.order
                : sorter?.order;

              const nextSort =
                order === "ascend" ? 1 : order === "descend" ? 0 : undefined;

              setParams((prev) => {
                const sortChanged = prev.Sort !== nextSort;
                return {
                  ...prev,
                  PageIndex: sortChanged ? 1 : nextCurrent,
                  PageSize: nextSize,
                  Sort: nextSort,
                };
              });
            }}
            pagination={{
              size: "default",
              total: data.totalItems,
              pageSize: params.PageSize,
              current: params.PageIndex,
              showTotal: (total) => (
                <PaginationTotal
                  label={t("common.total")}
                  total={total}
                  current={params.PageIndex}
                  pageSize={params.PageSize}
                />
              ),
              pageSizeOptions: ["10", "20", "50"],
            }}
            onRow={(record) => {
              return {
                onClick: (event) => {
                  if (
                    (event.target as HTMLElement).closest(
                      ".accounts-table-actions",
                    )
                  ) {
                    return;
                  }
                  history.push(
                    `/happiness/customerManagement/customer-details?id=${record.userId}`,
                  );
                },
                style: { cursor: "pointer" },
              };
            }}
          />
        </div>
      </div>

      <Modal
        centered
        className="profiles-action-modal"
        visible={confirmModalVisible && actionType === "suspend"}
        onCancel={() => {
          setConfirmModalVisible(false);
          setNotes("");
          setNotesError("");
        }}
        footer={null}
        title={t("Customer.accounts.modals.suspendCustomer")}
        destroyOnClose
      >
        <AlertBanner
          content={t("Customer.accounts.modals.suspendCustomerConfirm")}
        />
        <div className="profiles-modal-body">
          <div className="profiles-modal-section">
            <div className="profiles-modal-label">
              {t("Customer.accounts.modals.notes")}
              <span className="required-mark">*</span>
            </div>
            <Form component={false}>
              <Form.Item
                className="profiles-modal-textarea-item"
                validateStatus={notesError ? "error" : undefined}
                help={notesError || undefined}
              >
                <Input.TextArea
                  placeholder={t("Customer.accounts.modals.enterNotes")}
                  value={notes}
                  maxLength={1000}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setNotes(nextValue);
                    if (notesError) {
                      setNotesError(
                        nextValue.trim()
                          ? ""
                          : t("Customer.tickets.common.pleaseEnterNotes"),
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
              {t("Customer.accounts.modals.quickNotes")}
            </div>
            <div className="profiles-quick-notes">
              {quickNotes.map((text: string) => (
                <button
                  key={text}
                  type="button"
                  className="profiles-quick-note"
                  onClick={() => {
                    setNotes((prev: string) => {
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
                setConfirmModalVisible(false);
                setNotes("");
                setNotesError("");
              }}
            />
            <CustomButton
              variant="danger"
              text={t("common.confirm")}
              loading={confirmModalLoading}
              onClick={handleConfirmAction}
            />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        loading={confirmModalLoading}
        onCancel={() => setConfirmModalVisible(false)}
        onConfirm={handleConfirmAction}
        visible={confirmModalVisible && actionType === "activate"}
        type="warning"
        title={t("Customer.accounts.modals.activateAccount")}
        content={t("Customer.accounts.modals.activateAccountConfirm")}
      />

      <SendEmailModal ref={emailModalRef} onSend={handleSendCustomerEmail} />

      <ImpersonateConfirmModal
        ref={impersonateModalRef}
        onConfirm={handleImpersonateCustomer}
      />

      <SendMessageModal
        ref={messageModalRef}
        mobileNumberLabel={t(
          "Customer.accounts.sendMessageModal.mobileNumberLabel",
        )}
        mobilePlaceholder={t(
          "Customer.accounts.sendMessageModal.mobilePlaceholder",
        )}
        messageRequiredText={t(
          "Customer.accounts.sendMessageModal.messageRequiredText",
        )}
        onSend={handleSendSms}
      />

      <ResponsiveFilterModal
        visible={FilterModalVisible}
        onCancel={handleCancelFilterModal}
        onApply={handleApplyFilterModal}
        fields={[
          {
            key: "status",
            label: t("Customer.accounts.table.status"),
            compactOnly: true,
            element: (
              <Select
                dropdownClassName="accounts-status-select-dropdown"
                allowClear
                value={selectedStatus || undefined}
                placeholder={t("Customer.accounts.placeholders.allStatuses")}
                onChange={(value) => setSelectedStatus(value)}
                onClear={() => setSelectedStatus(undefined)}
                getPopupContainer={(triggerNode) => triggerNode.parentNode}
              >
                {statusOptions
                  .filter((option) => option.value !== "")
                  .map((item) => (
                    <Select.Option key={item.value} value={item.value}>
                      {item.label}
                    </Select.Option>
                  ))}
              </Select>
            ),
          },
          {
            key: "date-range",
            label: t("Customer.accounts.table.registerTime"),
            compactOnly: true,
            element: (
              <RangePicker
                className="date-range-picker"
                value={selectedDateRange}
                placeholder={[
                  t("Customer.accounts.placeholders.startTime"),
                  t("Customer.accounts.placeholders.endTime"),
                ]}
                format="DD/MM/YYYY"
                onChange={(range) => setSelectedDateRange(range ?? null)}
              />
            ),
          },
          {
            key: "login-method",
            label: t("Customer.accounts.labels.loginMethod"),
            element: (
              <SelectAllDropdown
                value={selectedLoginMethods}
                placeholder={t("Customer.accounts.placeholders.allLoginMethods")}
                options={loginMethodOptions}
                onChange={(values) =>
                  setSelectedLoginMethods(normalizeLoginMethods(values))
                }
                showSearch={false}
                selectionDisplay="text"
                getPopupContainer={() => document.body}
                dropdownPanelClassName="accounts-login-method-dropdown"
              />
            ),
          },
        ]}
      />
    </div>
  );
}
