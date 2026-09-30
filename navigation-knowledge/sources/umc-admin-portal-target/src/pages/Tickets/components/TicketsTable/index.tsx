import Sousuo from "@/assets/icons/Sousuo";
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import {
  Form,
  Input,
  Select,
  Table,
  Tabs,
  Dropdown,
  Button,
  Menu,
  Tooltip,
} from "antd";
import { MoreOutlined } from "@ant-design/icons";
import "./index.less";
import { CustomButton, PermissionGuard } from "@/components/common";
import PaginationTotal from "@/components/common/PaginationTotal";
import DatePicker from "@/components/common/LocalizedDatePicker";
import {
  useEffect,
  useState,
  useRef,
  useMemo,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import AddModal from "../AddModal";
import SortIcon from "@/assets/images/sort.png";
import FilterCountBadge, {
  countAppliedFilters,
} from "@/components/common/FilterCountBadge";
import FilterModal from "../FilterModal";
import {
  getEnquiryList,
  getEnquiryStatus,
  getUserInfo,
  postEnquiryListExport,
} from "@/services/tickets";
import type {
  IEnquiryListItem,
  IEnquiryListRequest,
  IEnquiryListResponse,
  IEnquiryStatus,
  IEnquiryType,
  IUserInfoResponse,
} from "@/services/tickets";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import moment from "moment";
import { debounce } from "lodash";
// import TransferModal from "../TransferModal";
import ProcessModal from "../ProcessModal";
import SendBackModal from "../SendBackModal";
import ChangeStatusModal from "../ChangeStatusModal";
import { useHistory } from "react-router-dom";
import { unstable_batchedUpdates } from "react-dom";
import Individual from "@/assets/icons/Individual";
import Establishment from "@/assets/icons/Establishment";
import EventEmiiter from "@/utils/EventEmiiter";
import { navigateToTicketApplicationDetails } from "@/pages/Tickets/utils/applicationDetailsNavigation";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import { useButtonPermission } from "@/routes/access";
import { canShowDepartmentProcessActions } from "@/pages/Tickets/utils/ticketVisibility";

/** All enquiry status ids shown in ticket list "All Statuses" filters (To Do & Completed). */
const TICKET_ENQUIRY_STATUS_FILTER_IDS = [1, 2, 3, 4, 5, 6, 7] as const;
const TICKET_ENQUIRY_STATUS_TO_DO_IDS = [1, 2, 3, 4] as const;

type TicketFilterValues = {
  EnquiryType?: number;
  PriorityId?: number;
  EnquirySourceId?: number;
  status?: number[];
  date?: [moment.Moment, moment.Moment];
};

type TicketToolbarValues = TicketFilterValues & {
  keywords?: string;
};

type TicketAppliedFilters = Partial<IEnquiryListRequest> & {
  EnquirySourceId?: number;
};

const DEFAULT_TICKET_LIST_PARAMS: Partial<IEnquiryListRequest> = {
  PageSize: 10,
  PageIndex: 1,
  SortBy: "id",
  SortDirection: 1,
};

type TicketActionColumnKey =
  | "message"
  | "changeStatus"
  | "process"
  | "more";

const TICKET_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<TicketActionColumnKey> = {
  message: {
    default: 68,
    compact: 60,
  },
  changeStatus: {
    default: 112,
    compact: 98,
  },
  process: {
    default: 64,
    compact: 56,
  },
  more: {
    default: 32,
    compact: 32,
  },
};

const TICKET_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 112,
  maxWidth: 240,
};

const TICKET_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 112,
  maxWidth: 216,
};

const TICKET_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
};

function hasFilterValue(values: Partial<TicketToolbarValues>, key: keyof TicketToolbarValues) {
  return Object.prototype.hasOwnProperty.call(values, key);
}

function getTicketFilterParams(values: Partial<TicketToolbarValues>) {
  const nextFilters: TicketAppliedFilters = {};

  if (hasFilterValue(values, "keywords")) {
    nextFilters.SearchKey = values.keywords;
  }
  if (hasFilterValue(values, "EnquiryType")) {
    nextFilters.EnquiryType = values.EnquiryType;
  }
  if (hasFilterValue(values, "status")) {
    nextFilters.EnquiryStatusId = values.status?.join(",");
  }
  if (hasFilterValue(values, "date")) {
    nextFilters.StartTime = values.date?.[0]?.format("YYYY-MM-DD") ?? "";
    nextFilters.EndTime = values.date?.[1]?.format("YYYY-MM-DD") ?? "";
  }
  if (hasFilterValue(values, "PriorityId")) {
    nextFilters.PriorityId = values.PriorityId;
  }
  if (hasFilterValue(values, "EnquirySourceId")) {
    nextFilters.EnquirySourceId = values.EnquirySourceId;
  }

  return nextFilters;
}

function useTicketToolbarValuesChange(
  setParams: Dispatch<SetStateAction<Partial<IEnquiryListRequest>>>,
  setAppliedFilters: Dispatch<SetStateAction<TicketAppliedFilters>>,
) {
  const handleValuesChange = useMemo(
    () => debounce(
      (_changedValues: Partial<TicketToolbarValues>, values: TicketToolbarValues) => {
        unstable_batchedUpdates(() => {
          setAppliedFilters((current) => ({
            ...current,
            ...getTicketFilterParams(values),
          }));
          setParams((currentParams) => ({
            ...currentParams,
            PageIndex: 1,
          }));
        });
      },
      500,
    ),
    [setAppliedFilters, setParams],
  );

  useEffect(() => {
    return () => handleValuesChange.cancel();
  }, [handleValuesChange]);

  return handleValuesChange;
}

function getCurrentHandlerName(record: IEnquiryListItem) {
  if ([2].includes(record.enquiryStatusId)) {
    return "Customer";
  }
  if ([1, 4].includes(record.enquiryStatusId)) {
    return record.agnetname ?? "";
  }
  // if ([2].includes(record.enquiryStatusId)) {
  //     return record.custormer ?? "";
  // }
  if ([3].includes(record.enquiryStatusId)) {
    return record.currentHander ?? "";
  }
  return "";
}

function renderCurrentHandlerCell(record: IEnquiryListItem, locale: string) {
  const name = getCurrentHandlerName(record);
  const dept =
    // locale === "en"
    //         ? record.departmentEnquiryObj?.nameEn
    //         : record.departmentEnquiryObj?.nameAr;
    record.enquiryStatusId === 2
      ? ""
      : locale === "en"
      ? record.departmentEnquiryObj?.nameEn
      : record.departmentEnquiryObj?.nameAr;
  const tooltipText = [name, dept].filter(Boolean).join("\n");

  return (
    <Tooltip title={tooltipText || undefined} placement="top">
      <div className="tickets-table-cell-ellipsis-2-lines">
        {!name && !dept ? (
          "-"
        ) : (
          <>
            {name}
            {dept ? (
              <>
                {name ? <br /> : null}
                {dept}
              </>
            ) : null}
          </>
        )}
      </div>
    </Tooltip>
  );
}

function renderEllipsisPopoverCell(
  text: string | undefined,
  className: string,
) {
  const content = text || "-";
  const textNode = <span className={className}>{content}</span>;

  if (!text) {
    return textNode;
  }

  return (
    <Tooltip title={text} placement="top">
      <span className="tickets-table-popover-trigger">{textNode}</span>
    </Tooltip>
  );
}

function renderTicketNoCell(
  text: string,
  record: IEnquiryListItem,
  reopenLabel: string,
) {
  return (
    <div
      className={`application-no-cell`}
    >
      {/* {record.isVip ? (
        <span className="application-no-star-slot">
          <img
            src={applicationNoProfileStar}
            alt=""
            className="application-no-profile-star"
          />
        </span>
      ) : null} */}
      <div className="application-no-body">
        <span className="application-no-text">{text}</span>
        {!!record.reopenTimes && (
          <div className="todo-tabpanel-reopen-times">{reopenLabel}</div>
        )}
      </div>
    </div>
  );
}

export default function TicketsTable({
  enquiryTypes,
  isCustomerHappness,
  queryStatistics,
}: {
  enquiryTypes: IEnquiryType[];
  isCustomerHappness: boolean;
  queryStatistics: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="tickets-table-wrapper">
      <Tabs defaultActiveKey="1">
        <Tabs.TabPane tab={<span data-reader-view="todo">{t("Customer.tickets.tabs.todo")}</span>} key="1">
          <TodoTabPane
            enquiryTypes={enquiryTypes}
            isCustomerHappness={isCustomerHappness}
            queryStatistics={queryStatistics}
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span data-reader-view="completed">{t("Customer.tickets.tabs.completed")}</span>} key="2">
          <CompleteTabPane enquiryTypes={enquiryTypes} isCustomerHappness={isCustomerHappness} />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
function TodoTabPane({
  enquiryTypes,
  isCustomerHappness,
  queryStatistics,
}: {
  enquiryTypes: IEnquiryType[];
  isCustomerHappness: boolean;
  queryStatistics: () => void;
}) {
  // const showEnquiryTypeSelect =
  //     !isCustomerHappness && !pathname.startsWith("/happiness/tickets");
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const filterModalRef = useRef<any>(null);
  const [params, setParams] = useState<Partial<IEnquiryListRequest>>(
    DEFAULT_TICKET_LIST_PARAMS,
  );
  const [appliedFilters, setAppliedFilters] = useState<TicketAppliedFilters>(
    {},
  );
  const handleToolbarValuesChange = useTicketToolbarValuesChange(
    setParams,
    setAppliedFilters,
  );
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  // The modal mirrors these three toolbar fields.
  const statusFilterValue = Form.useWatch("status", form);
  const dateFilterValue = Form.useWatch("date", form);
  const enquiryTypeFilterValue = Form.useWatch("EnquiryType", form);
  const appliedFilterCount = countAppliedFilters([
    statusFilterValue,
    dateFilterValue,
    enquiryTypeFilterValue,
  ]);
  const [data, setData] = useState<IEnquiryListResponse>(
    {} as IEnquiryListResponse,
  );
  const [enquiryStatus, setEnquiryStatus] = useState<IEnquiryStatus[]>([]);
  // const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [sendBackModalVisible, setSendBackModalVisible] = useState(false);
  const [openActionRowId, setOpenActionRowId] = useState<number | null>(null);
  const [row, setRow] = useState<IEnquiryListItem>({} as IEnquiryListItem);
  const [changeStatusModalVisible, setChangeStatusModalVisible] =
    useState(false);
  const [loading, setLoading] = useState(false);
  const latestRequestIdRef = useRef(0);
  const [userInfo, setUserInfo] = useState<IUserInfoResponse>(
    {} as IUserInfoResponse,
  );
  const [exportLoading, setExportLoading] = useState(false);
  const [sortedInfo, setSortedInfo] = useState<{
    columnKey?: string;
    order?: "ascend" | "descend";
  } | null>(null);
  const { canRenderButton } = useButtonPermission("/happiness/tickets");
  const keepAliveActivated = useKeepAliveActivated({
    onActivated: () => {
      query();
      queryStatistics();
      queryUserInfo();
      queryEnquiryStatus();
    },
    onDeactivated: () => {
      latestRequestIdRef.current += 1;
      setLoading(false);
      setAddModalVisible(false);
      setFilterModalVisible(false);
      setProcessModalVisible(false);
      setSendBackModalVisible(false);
      setChangeStatusModalVisible(false);
      setOpenActionRowId(null);
    },
  });
  const keepAliveActivatedRef = useRef(keepAliveActivated);
  keepAliveActivatedRef.current = keepAliveActivated;
  const enquiryType = useMemo(
    () => enquiryTypes.filter((item) => ![3, 5].includes(item.id)),
    [enquiryTypes],
  );
  const history = useHistory();
  const getVisibleTicketActions = (
    record: IEnquiryListItem,
  ): TicketActionColumnKey[] => {
    const actions: TicketActionColumnKey[] = [];
    const canShowDepartmentActions = canShowDepartmentProcessActions({
      enquiryStatusId: record.enquiryStatusId,
      isCustomerHappiness: userInfo.isCustomerHappness,
      reopenTimes: record.reopenTimes,
      isCurrentHandler: record.isCurrentHandler,
    });

    if ([1, 2, 3, 4].includes(record.enquiryStatusId)) {
      actions.push("message");
    }

    if (
      [1, 2, 4].includes(record.enquiryStatusId) &&
      userInfo.isCustomerHappness &&
      canRenderButton("CustomerModule.Tickets.Confirm") &&
      canRenderButton("CustomerModule.Tickets.ChangeStatus")
    ) {
      actions.push("changeStatus");
    }

    if (
      canShowDepartmentActions &&
      canRenderButton("CustomerModule.Tickets.ConfirmProcessModal") &&
      canRenderButton("CustomerModule.Tickets.Process")
    ) {
      actions.push("process");
    }

    if (
      canShowDepartmentActions &&
      canRenderButton("CustomerModule.Tickets.ConfirmSendBackModal")
    ) {
      actions.push("more");
    }

    return actions;
  };
  const getTicketActionLabel = (actionKey: TicketActionColumnKey) => {
    const actionLabelMap: Partial<Record<TicketActionColumnKey, string>> = {
      message: t("Customer.tickets.actions.message"),
      changeStatus: t("Customer.tickets.actions.changeStatus"),
      process: t("Customer.tickets.actions.process"),
    };

    return actionLabelMap[actionKey];
  };
  const ticketActionColumnWidth = useResponsiveActionColumnWidth<
    IEnquiryListItem,
    TicketActionColumnKey
  >({
    rows: data.items ?? [],
    buttonWidthMap: TICKET_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: getVisibleTicketActions,
    getActionLabel: getTicketActionLabel,
    desktopConfig: TICKET_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: TICKET_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: TICKET_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  });
  function queryUserInfo() {
    getUserInfo().then((res) => {
      if (res.data) {
        setUserInfo(res.data);
      }
    });
  }

  useEffect(() => {
    if (!keepAliveActivatedRef.current) return;
    queryUserInfo();
  }, []);
  const columns = [
    {
      title: t("Customer.tickets.table.ticketNo"),
      dataIndex: "enquiryNumber",
      key: "enquiryNumber",
      width: 280,
      fixed: "left",
      render(text: string, record: IEnquiryListItem) {
        return renderTicketNoCell(
          text,
          record,
          t("Customer.tickets.labels.reopen"),
        );
      },
    },
    {
      title: t("Customer.tickets.table.source"),
      dataIndex: "enquirySourceId",
      key: "enquirySourceId",
      width: 160,
      render(_text: string, record: IEnquiryListItem) {
        const source = i18n.resolvedLanguage === "en" ? "nameEn" : "nameAr";
        return (
          <div>
            {!!record.enquirySoruceObj ? record.enquirySoruceObj[source] : "-"}
          </div>
        );
      },
    },
    {
      title: t("Customer.tickets.table.type"),
      dataIndex: [
        "enquiryTypeObj",
        i18n.resolvedLanguage === "en" ? "nameEn" : "nameAr",
      ],
      key: "Type",
      width: 120,
    },
    {
      title: t("Customer.tickets.table.applicationNo"),
      dataIndex: "applicationNo",
      key: "applicationNo",
      width: 160,
      render(text: string) {
        return (
          <div
            className="todo-tabpanel-appno"
            onClick={async (e) => {
              e.stopPropagation();
              await navigateToTicketApplicationDetails(history, text);
            }}
          >
            {text || "-"}
          </div>
        );
      },
    },
    isCustomerHappness
      ? {
          title: t("Customer.tickets.table.serviceName"),
          dataIndex: [
            "serviceObj",
            i18n.resolvedLanguage === "en" ? "nameEn" : "nameAr",
          ],
          key: "serviceName",
          width: 200,
          render(text: string) {
            return renderEllipsisPopoverCell(
              text,
              "tickets-table-service-name tickets-table-cell-ellipsis-2-lines",
            );
          },
        }
      : null,
    isCustomerHappness
      ? {
          title: t("Customer.tickets.table.customer"),
          dataIndex: "custormer",
          key: "custormer",
          width: 200,
          className: "tickets-table-customer-cell",
          ellipsis: { showTitle: false },
          render(t: string, record: IEnquiryListItem) {
            return (
              <div className="todo-tabpanel-custormer">
                {!record?.curstomerUserObj?.userTypeId ? (
                  ""
                ) : record.curstomerUserObj.userTypeId === 1 ? (
                  <Individual />
                ) : (
                  <Establishment />
                )}
                {renderEllipsisPopoverCell(
                  t,
                  "tickets-table-customer-name tickets-table-cell-ellipsis-2-lines",
                )}
              </div>
            );
          },
        }
      : null,
    !isCustomerHappness
      ? {
          title: t("Customer.tickets.table.agent"),
          dataIndex: "agnetname",
          key: "agnetname",
          width: 120,
        }
      : null,
    // isCustomerHappness ? {
    //     title: t("Customer.tickets.table.issueCategory"),
    //     dataIndex: ["issueCategoryObj", i18n.resolvedLanguage === "en" ? "nameEn" : "nameAr"],
    //     key: "issueCategoryObj",
    //     width: 144
    // } : null,
    {
      title: t("Customer.tickets.table.Priority"),
      dataIndex: "priorityId",
      key: "priorityId",
      sorter: true,
      sortOrder:
        sortedInfo?.columnKey === "priorityId" ? sortedInfo.order : undefined,
      width: 120,
      render(_text: string, record: any) {
        return (
          <div>
            {i18n.resolvedLanguage === "en"
              ? record.priorityObj?.nameEn
            : record.priorityObj?.nameAr ?? "-"}
          </div>
        );
      },
    },
    {
      title: t("Customer.tickets.table.sla"),
      dataIndex: "sla",
      key: "sla",
      sorter: true,
      sortOrder: sortedInfo?.columnKey === "sla" ? sortedInfo.order : undefined,
      width: 140,
      render(text: string, record: { isOverDue?: boolean }) {
        return (
          <div className={`${record.isOverDue ? "todo-tabpanel-overdue" : ""}`}>
            {text ?? "-"}
          </div>
        );
      },
    },
    {
      title: t("Customer.tickets.table.currentHandler"),
      dataIndex: "currentHander",
      key: "currentHander",
      width: 180,
      render(_t: string, record: IEnquiryListItem) {
        return renderCurrentHandlerCell(record, i18n.language);
      },
    },
    {
      title: t("Customer.tickets.table.status"),
      dataIndex: "enquiryStatusId",
      key: "enquiryStatusId",
      width: 200,
      // sorter: true,
      render: (status: string) => {
        return <CustomStatusTag type="enquiryStatus" status={status} />;
      },
    },
    {
      title: t("Customer.tickets.table.lastUpdated"),
      dataIndex: "updatedOn",
      key: "updatedOn",
      sorter: true,
      sortOrder:
        sortedInfo?.columnKey === "updatedOn" ? sortedInfo.order : undefined,
      width: 160,
      render: (text: string) => {
        return (
          <div>{text ? moment(text).format("DD/MM/YYYY HH:mm:ss") : "-"}</div>
        );
      },
    },
    {
      title: t("Customer.tickets.table.actions"),
      dataIndex: "Actions",
      key: "Actions",
      width: ticketActionColumnWidth,
      fixed: "right",
      render(_: string, record: IEnquiryListItem) {
        const messageCount = Number(
          (
            record as IEnquiryListItem & {
              messageCount?: number | string | null;
            }
          ).messageCount,
        );
        const canShowDepartmentActions = canShowDepartmentProcessActions({
          enquiryStatusId: record.enquiryStatusId,
          isCustomerHappiness: userInfo.isCustomerHappness,
          reopenTimes: record.reopenTimes,
          isCurrentHandler: record.isCurrentHandler,
        });
 
        return (
          <div className="table-actions" onClick={(e) => e.stopPropagation()}>
            {[1, 2, 3, 4].includes(record.enquiryStatusId) && (
              <div className="messageBox">
                {messageCount > 0 && <span className="notification-badge" />}

                <CustomButton
                  variant="text"
                  text={t("Customer.tickets.actions.message")}
                  onClick={() => {
                    history.push({
                      pathname: "/happiness/tickets/tickets-details",
                      search: `?id=${record.id}`,
                    });
                  }}
                />
              </div>
            )}
            {[1, 2, 4].includes(record.enquiryStatusId) &&
              userInfo.isCustomerHappness && (
                <PermissionGuard
                  permissionCode="CustomerModule.Tickets.Confirm"
                  routePath="/happiness/tickets"
                >
                  <CustomButton
                    variant="text"
                    text={t("Customer.tickets.actions.changeStatus")}
                    permissionCode="CustomerModule.Tickets.ChangeStatus"
                    permissionRoutePath="/happiness/tickets"
                    onClick={(e: ReactMouseEvent<HTMLElement>) => {
                      e.stopPropagation();
                      setRow(record);
                      setChangeStatusModalVisible(true);
                    }}
                  />
                </PermissionGuard>
              )}
            {/* && !userInfo.isCustomerHappness  */}
            {canShowDepartmentActions && (
              <PermissionGuard
                permissionCode="CustomerModule.Tickets.ConfirmProcessModal"
                routePath="/happiness/tickets"
              >
                <CustomButton
                  onClick={(e: ReactMouseEvent<HTMLElement>) => {
                    e.stopPropagation();
                    setRow(record);
                    setProcessModalVisible(true);
                  }}
                  variant="text"
                  text={t("Customer.tickets.actions.process")}
                  permissionCode="CustomerModule.Tickets.Process"
                  permissionRoutePath="/happiness/tickets"
                />
              </PermissionGuard>
            )}

            {/* && !userInfo.isCustomerHappness */}
            {canShowDepartmentActions && (
              <PermissionGuard
                permissionCode="CustomerModule.Tickets.ConfirmSendBackModal"
                routePath="/happiness/tickets"
              >
                <Dropdown
                  visible={openActionRowId === record.id}
                  onVisibleChange={(visible) => {
                    setOpenActionRowId(visible ? record.id : null);
                  }}
                  overlay={
                    <Menu>
                      <Menu.Item
                        onClick={(e) => {
                          e.domEvent.stopPropagation();
                          setRow(record);
                          setSendBackModalVisible(true);
                        }}
                      >
                        {t("Customer.tickets.actions.sendBack")}
                      </Menu.Item>
                    </Menu>
                  }
                  trigger={["hover"]}
                  placement="bottomRight"
                >
                  <Button
                    type="text"
                    icon={<MoreOutlined />}
                    style={{ padding: "4px" }}
                  />
                </Dropdown>
              </PermissionGuard>
            )}
          </div>
        );
      },
    },
  ].filter(Boolean);

  function query(data?: IEnquiryListRequest) {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    const requestParams = {
      ...params,
      ...appliedFilters,
      ...data,
      IsEnquiryComplete: false,
    };
    console.log("params", requestParams);

    setLoading(true);
    getEnquiryList(requestParams)
      .then((res) => {
        if (requestId !== latestRequestIdRef.current) return;
        if (res.data) {
          setData(res.data);
        }
      })
      .finally(() => {
        if (requestId === latestRequestIdRef.current) {
          setLoading(false);
        }
      });
  }

  useEffect(() => {
    if (!keepAliveActivatedRef.current) return;
    query();
  }, [appliedFilters, params]);
  function queryEnquiryStatus() {
    getEnquiryStatus().then((res) => {
      if (res.data) {
        setEnquiryStatus(res.data);
      }
    });
  }
  useEffect(() => {
    if (!keepAliveActivatedRef.current) return;
    queryEnquiryStatus();
  }, []);

  function handleSave(values: TicketFilterValues) {
    handleToolbarValuesChange.cancel();
    const currentToolbarValues = form.getFieldsValue() as TicketToolbarValues;
    const nextValues = {
      ...currentToolbarValues,
      ...values,
    };
    const { status, date, EnquiryType } = nextValues;
    const hasEnquiryTypeValue = Object.prototype.hasOwnProperty.call(
      nextValues,
      "EnquiryType",
    );
    const nextEnquiryType = hasEnquiryTypeValue
      ? EnquiryType
      : form.getFieldValue("EnquiryType");
    const nextAppliedValues = {
      ...nextValues,
      EnquiryType: nextEnquiryType,
    };
    setAppliedFilters((currentFilters) => ({
      ...currentFilters,
      ...getTicketFilterParams(nextAppliedValues),
    }));
    setParams((currentParams) => ({
      ...currentParams,
      PageIndex: 1,
    }));
    form.setFieldsValue({ status, date, EnquiryType: nextEnquiryType });
    setFilterModalVisible(false);
  }

  function handleExport() {
    setExportLoading(true);
    postEnquiryListExport({
      ...params,
      ...appliedFilters,
      IsEnquiryComplete: false,
      PageIndex: 1,
      PageSize: 10000,
    }).finally(() => {
      setExportLoading(false);
    });
  }

  function fresh() {
    handleToolbarValuesChange.cancel();
    form.resetFields();
    filterModalRef.current?.resetFields();
    setSortedInfo(null);
    setAppliedFilters({});
    setParams(DEFAULT_TICKET_LIST_PARAMS);
  }

  useEffect(() => {
    console.log(isCustomerHappness);
  }, [isCustomerHappness]);

  return (
    <div className="todo-tabpanel">
      <div className="todo-tabpanel-header">
        <Form
          form={form}
          onValuesChange={handleToolbarValuesChange}
          className="todo-tabpanel-form custorm-form"
        >
          <Form.Item
            className="responsive-filter-toolbar__field--single-visible-search"
            name="keywords"
          >
            <Input
              placeholder={t("common.search")}
              prefix={<Sousuo className="search-icon" />}
              allowClear
            />
          </Form.Item>
          {isCustomerHappness && (
            <Form.Item
              className="tickets-toolbar-secondary-filter"
              name="status"
            >
              <Select
                className="tickets-toolbar-status-select"
                dropdownClassName="tickets-status-select-dropdown"
                mode="multiple"
                maxTagCount={1}
                maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
                placeholder={t("Customer.tickets.placeholders.allStatuses")}
                showArrow
                showSearch={false}
                allowClear
              >
                {enquiryStatus
                  ?.filter((item) =>
                    (
                      TICKET_ENQUIRY_STATUS_TO_DO_IDS as readonly number[]
                    ).includes(item.id),
                  )
                  .map((item) => {
                    return (
                      <Select.Option key={item.id} value={item.id}>
                        {i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn}
                      </Select.Option>
                    );
                  })}
              </Select>
            </Form.Item>
          )}
          {/* <Form.Item name="EnquiryType">
                        <Select placeholder={t("Customer.tickets.placeholders.allTypes")} allowClear>
                            {enquiryType.map(item=><Select.Option key={item.id} value={item.id}>{i18n.resolvedLanguage === 'ar'? item.nameAr : item.nameEn}</Select.Option>)}
                        </Select>
                    </Form.Item>  */}
          {/* isCustomerHappness */}
          {!isCustomerHappness && (
            <Form.Item
              className="tickets-toolbar-secondary-filter"
              name="EnquiryType"
            >
              <Select
                placeholder={t("Customer.tickets.placeholders.allTypes")}
                allowClear
              >
                {enquiryType.map((item) => (
                  <Select.Option key={item.id} value={item.id}>
                    {i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Form.Item
            className="tickets-toolbar-secondary-filter"
            name="date"
          >
            <DatePicker.RangePicker
              className="tickets-toolbar-date-range-picker"
              // className="custorm-picker tickets-table-date-range-picker"
              // format={"YYYY-MM-DD"}
              // format={i18n.resolvedLanguage === "ar" ? "DD-MM-YYYY" : "YYYY-MM-DD"}
              getPopupContainer={(node) => node}
              placeholder={[
                t("Customer.tickets.placeholders.startDate"),
                t("Customer.tickets.placeholders.endDate"),
              ]}
              separator="-"
              allowClear
            />
          </Form.Item>
          <CustomButton
            variant="outline"
            customClassName="filters-filterBtn responsive-filter-toolbar__filter-button filter-trigger-with-count"
            onClick={() => {
              filterModalRef.current?.setFieldsValue({
                status: form.getFieldValue("status"),
                date: form.getFieldValue("date"),
                EnquiryType: form.getFieldValue("EnquiryType"),
              });
              setFilterModalVisible(true);
            }}
          >
            {t("serviceConfiguration.filters.filter")}
            <img className="filter-trigger-funnel" src={SortIcon} alt="" />
            <FilterCountBadge count={appliedFilterCount} />
          </CustomButton>
          <CustomButton
            text={t("serviceConfiguration.filters.reset")}
            variant="outline"
            customClassName="filters-filterBtn responsive-filter-toolbar__reset-button"
            onClick={fresh}
          />
          {/* {
                        isCustomerHappness &&<CustomButton
                            text={t("serviceConfiguration.filters.filter")}
                            variant="outline"
                            icon={SortIcon}
                            customClassName="filters-filterBtn"
                            iconPosition="right"
                            onClick={() => {
                                setFilterModalVisible(true);
                            }}
                        />
                    } */}
        </Form>
        <div className="todo-tabpanel-header-actions">
          <CustomButton
            variant="outline"
            text={t("common.export")}
            loading={exportLoading}
            onClick={handleExport}
            permissionCode="CustomerModule.Tickets.Export"
            permissionRoutePath="/happiness/tickets"
          />
          {isCustomerHappness && (
            <CustomButton
              onClick={() => {
                setAddModalVisible(true);
              }}
              text={t("Customer.tickets.actions.addNew")}
              permissionCode="CustomerModule.Tickets.AddNew"
              permissionRoutePath="/happiness/tickets"
            />
          )}
        </div>
      </div>
      <div className="table-container">
        <Table
          loading={loading}
          className="admin-table"
          scroll={{ x: "max-content" }}
          onChange={(page, _filter, sorter) => {
            // @ts-ignore
            const { field, order } = sorter;
            setSortedInfo(order ? { columnKey: field, order } : null);
            setParams({
              ...params,
              PageIndex: page.current ?? 1,
              PageSize: page.pageSize ?? 10,
              SortBy: order ? field : "id",
              SortDirection: order === "ascend" ? 0 : 1,
            });
          }}
          pagination={{
            size: "default",
            current: data.pageIndex ?? 1,
            pageSize: data.pageSize ?? 10,
            total: data.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total: number) => <PaginationTotal label={t("common.total")} total={total} current={data.pageIndex ?? 1} pageSize={data.pageSize ?? 10} />,
          }}
          // @ts-ignore
          columns={columns}
          dataSource={data.items}
          onRow={(data) => {
            return {
              onClick: () => {
                history.push(
                  `/happiness/tickets/tickets-details?id=${data.id}`,
                );
              },
            };
          }}
        />
      </div>
      <ChangeStatusModal
        enquiryTypes={enquiryTypes}
        onSave={() => {
          if (queryStatistics) {
            queryStatistics();
          }
          fresh();
          setChangeStatusModalVisible(false);
        }}
        row={row}
        visible={changeStatusModalVisible}
        onCancel={() => setChangeStatusModalVisible(false)}
      />
      {/* <TransferModal onSave={fresh} row={row} visible={transferModalVisible} onCancel={()=>setTransferModalVisible(false)} /> */}
      <ProcessModal
        onSave={() => {
          if (queryStatistics) {
            queryStatistics();
          }
          fresh();
          setProcessModalVisible(false);
        }}
        row={row}
        visible={processModalVisible}
        onCancel={() => setProcessModalVisible(false)}
      />
      <SendBackModal
        onSave={() => {
          if (queryStatistics) {
            queryStatistics();
          }
          fresh();
          setSendBackModalVisible(false);
        }}
        row={row}
        visible={sendBackModalVisible}
        onCancel={() => setSendBackModalVisible(false)}
      />
      <AddModal
        enquiryTypes={enquiryTypes}
        onSave={() => {
          if (queryStatistics) {
            queryStatistics();
          }
          fresh();
          setAddModalVisible(false);
        }}
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
      />
      <FilterModal
        enquiryTypes={enquiryTypes}
        enquiryStatus={enquiryStatus}
        statusFilterIds={TICKET_ENQUIRY_STATUS_TO_DO_IDS}
        showResponsiveFilters
        isCustomerHappness={isCustomerHappness}
        ref={filterModalRef}
        onSave={handleSave}
        visible={filterModalVisible}
        onCancel={() => setFilterModalVisible(false)}
      />
    </div>
  );
}

function CompleteTabPane({
  enquiryTypes,
  isCustomerHappness,
}: {
  enquiryTypes: IEnquiryType[];
  isCustomerHappness: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const history = useHistory();
  const [params, setParams] = useState<Partial<IEnquiryListRequest>>(
    DEFAULT_TICKET_LIST_PARAMS,
  );
  const [appliedFilters, setAppliedFilters] = useState<TicketAppliedFilters>(
    {},
  );
  const handleToolbarValuesChange = useTicketToolbarValuesChange(
    setParams,
    setAppliedFilters,
  );
  const filterModalRef = useRef<any>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  // The modal mirrors these three toolbar fields.
  const statusFilterValue = Form.useWatch("status", form);
  const dateFilterValue = Form.useWatch("date", form);
  const enquiryTypeFilterValue = Form.useWatch("EnquiryType", form);
  const appliedFilterCount = countAppliedFilters([
    statusFilterValue,
    dateFilterValue,
    enquiryTypeFilterValue,
  ]);
  const latestRequestIdRef = useRef(0);
  const keepAliveActivated = useKeepAliveActivated({
    onActivated: () => {
      query();
      queryEnquiryStatus();
    },
    onDeactivated: () => {
      latestRequestIdRef.current += 1;
      setAddModalVisible(false);
      setFilterModalVisible(false);
    },
  });
  const keepAliveActivatedRef = useRef(keepAliveActivated);
  keepAliveActivatedRef.current = keepAliveActivated;
  const [data, setData] = useState<IEnquiryListResponse>(
    {} as IEnquiryListResponse,
  );
  const [enquiryStatus, setEnquiryStatus] = useState<IEnquiryStatus[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const columns = [
    {
      title: t("Customer.tickets.table.ticketNo"),
      dataIndex: "enquiryNumber",
      key: "enquiryNumber",
      width: 216,
      render(text: string, record: IEnquiryListItem) {
        return renderTicketNoCell(
          text,
          record,
          t("Customer.tickets.labels.reopen"),
        );
      },
    },
    {
      title: t("Customer.tickets.table.source"),
      dataIndex: "enquirySourceId",
      key: "enquirySourceId",
      width: 160,
      render(_text: string, record: IEnquiryListItem) {
        const source = i18n.resolvedLanguage === "en" ? "nameEn" : "nameAr";
        return (
          <div>
            {!!record.enquirySoruceObj ? record.enquirySoruceObj[source] : "-"}
          </div>
        );
      },
    },
    {
      title: t("Customer.tickets.table.type"),
      dataIndex: [
        "enquiryTypeObj",
        i18n.resolvedLanguage === "en" ? "nameEn" : "nameAr",
      ],
      key: "Type",
      width: 120,
    },
    {
      title: t("Customer.tickets.table.applicationNo"),
      dataIndex: "applicationNo",
      key: "applicationNo",
      width: 140,
      render(text: string) {
        return (
          <div
            className="todo-tabpanel-appno"
            onClick={async (e) => {
              e.stopPropagation();
              await navigateToTicketApplicationDetails(history, text);
            }}
          >
            {text || "-"}
          </div>
        );
      },
    },
    isCustomerHappness
      ? {
          title: t("Customer.tickets.table.serviceName"),
          dataIndex: [
            "serviceObj",
            i18n.resolvedLanguage === "en" ? "nameEn" : "nameAr",
          ],
          key: "serviceName",
          width: 200,
          ellipsis: { showTitle: false },
          render(text: string) {
            return renderEllipsisPopoverCell(
              text,
              "tickets-table-service-name tickets-table-cell-ellipsis-2-lines",
            );
          },
        }
      : null,
    isCustomerHappness
      ? {
          title: t("Customer.tickets.table.customer"),
          dataIndex: "custormer",
          key: "custormer",
          width: 160,
          className: "tickets-table-customer-cell",
          ellipsis: { showTitle: false },
          render(t: string, record: IEnquiryListItem) {
            return (
              <div className="todo-tabpanel-custormer">
                {!record?.curstomerUserObj?.userTypeId ? (
                  ""
                ) : record.curstomerUserObj.userTypeId === 1 ? (
                  <Individual />
                ) : (
                  <Establishment />
                )}
                {renderEllipsisPopoverCell(
                  t,
                  "tickets-table-customer-name tickets-table-cell-ellipsis-2-lines",
                )}
              </div>
            );
          },
        }
      : null,
    !isCustomerHappness
      ? {
          title: t("Customer.tickets.table.agent"),
          dataIndex: "agnetname",
          key: "agnetname",
          width: 148,
        }
      : null,
    {
      title: t("Customer.tickets.table.Priority"),
      dataIndex: "priorityId",
      key: "priorityId",
      sorter: true,
      width: 120,
      render(_text: string, record: any) {
        return (
          <div>
            {i18n.resolvedLanguage === "en"
              ? record.priorityObj?.nameEn
            : record.priorityObj?.nameAr ?? "-"}
          </div>
        );
      },
    },
    {
      title: t("Customer.tickets.table.status"),
      dataIndex: "enquiryStatusId",
      key: "enquiryStatusId",
      width: 200,
      render: (status: string) => {
        return <CustomStatusTag type="enquiryStatus" status={status} />;
      },
    },
    {
      title: t("Customer.tickets.table.sla"),
      dataIndex: "sla",
      key: "sla",
      sorter: true,
      width: 120,
      render(text: string, record: { isOverDue?: boolean }) {
        return (
          <div className={`${record.isOverDue ? "todo-tabpanel-overdue" : ""}`}>
            {text ?? "-"}
          </div>
        );
      },
    },
    {
      title: t("Customer.tickets.table.lastUpdated"),
      dataIndex: "updatedOn",
      key: "updatedOn",
      sorter: true,
      width: 192,
      render: (text: string) => {
        return (
          <div>{text ? moment(text).format("DD/MM/YYYY HH:mm:ss") : "-"}</div>
        );
      },
    },
  ].filter(Boolean);

  function fresh() {
    handleToolbarValuesChange.cancel();
    form.resetFields();
    filterModalRef.current?.resetFields();
    setAppliedFilters({});
    setParams(DEFAULT_TICKET_LIST_PARAMS);
  }

  function query(data?: IEnquiryListRequest) {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    getEnquiryList({
      ...params,
      ...appliedFilters,
      ...data,
      IsEnquiryComplete: true,
    }).then((res) => {
      if (requestId !== latestRequestIdRef.current) return;
      if (res.data) {
        setData(res.data);
      }
    });
  }

  useEffect(() => {
    if (!keepAliveActivatedRef.current) return;
    query();
  }, [appliedFilters, params]);
  function queryEnquiryStatus() {
    getEnquiryStatus().then((res) => {
      if (res.data) {
        setEnquiryStatus(res.data);
      }
    });
  }
  useEffect(() => {
    if (!keepAliveActivatedRef.current) return;
    queryEnquiryStatus();
  }, []);

  function handleSave(values: TicketFilterValues) {
    handleToolbarValuesChange.cancel();
    const currentToolbarValues = form.getFieldsValue() as TicketToolbarValues;
    const nextValues = {
      ...currentToolbarValues,
      ...values,
    };
    const { status, date, EnquiryType } = nextValues;
    const hasEnquiryTypeValue = Object.prototype.hasOwnProperty.call(
      nextValues,
      "EnquiryType",
    );
    const nextEnquiryType = hasEnquiryTypeValue
      ? EnquiryType
      : form.getFieldValue("EnquiryType");
    const nextAppliedValues = {
      ...nextValues,
      EnquiryType: nextEnquiryType,
    };
    setAppliedFilters((currentFilters) => ({
      ...currentFilters,
      ...getTicketFilterParams(nextAppliedValues),
    }));
    setParams((currentParams) => ({
      ...currentParams,
      PageIndex: 1,
    }));
    form.setFieldsValue({ status, date, EnquiryType: nextEnquiryType });
    setFilterModalVisible(false);
  }

  function handleAddSave() {
    setParams({
      ...params,
      PageIndex: 1,
    });
    EventEmiiter.emit("update:freshStatistics");
  }

  function handleExport() {
    setExportLoading(true);
    postEnquiryListExport({
      ...params,
      ...appliedFilters,
      IsEnquiryComplete: true,
      PageIndex: 1,
      PageSize: 10000,
    }).finally(() => {
      setExportLoading(false);
    });
  }

  return (
    <div className="todo-tabpanel">
      <div className="todo-tabpanel-header">
        <Form
          form={form}
          onValuesChange={handleToolbarValuesChange}
          className="todo-tabpanel-form custorm-form"
        >
          <Form.Item
            className="responsive-filter-toolbar__field--single-visible-search"
            name="keywords"
          >
            <Input
              placeholder={t("common.search")}
              prefix={<Sousuo className="search-icon" />}
              allowClear
            />
          </Form.Item>

          {isCustomerHappness && (
            <Form.Item
              className="tickets-toolbar-secondary-filter"
              name="status"
            >
              <Select
                className="tickets-toolbar-status-select"
                dropdownClassName="tickets-status-select-dropdown"
                mode="multiple"
                maxTagCount={1}
                maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
                placeholder={t("Customer.tickets.placeholders.allStatuses")}
                showArrow
                showSearch={false}
                allowClear
              >
                {enquiryStatus
                  ?.filter((item) =>
                    (
                      TICKET_ENQUIRY_STATUS_FILTER_IDS as readonly number[]
                    ).includes(item.id),
                  )
                  ?.map((item) => {
                    return (
                      <Select.Option key={item.id} value={item.id}>
                        {i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn}
                      </Select.Option>
                    );
                  })}
              </Select>
            </Form.Item>
          )}
          {!isCustomerHappness && (
            <Form.Item
              className="tickets-toolbar-secondary-filter"
              name="EnquiryType"
            >
              <Select
                placeholder={t("Customer.tickets.placeholders.allTypes")}
                allowClear
              >
                {enquiryTypes.map((item) => (
                  <Select.Option key={item.id} value={item.id}>
                    {i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Form.Item
            className="tickets-toolbar-secondary-filter"
            name="date"
          >
            <DatePicker.RangePicker
              className="tickets-toolbar-date-range-picker"
              // className="custorm-picker tickets-table-date-range-picker"
              format={["YYYY-MM-DD"]}
              // format={i18n.resolvedLanguage === "ar" ? "DD-MM-YYYY" : "YYYY-MM-DD"}
              getPopupContainer={(node) => node}
              placeholder={[
                t("Customer.tickets.placeholders.startDate"),
                t("Customer.tickets.placeholders.endDate"),
              ]}
              separator="-"
              allowClear
            />
          </Form.Item>
          <CustomButton
            variant="outline"
            customClassName="filters-filterBtn responsive-filter-toolbar__filter-button filter-trigger-with-count"
            onClick={() => {
              filterModalRef.current?.setFieldsValue({
                status: form.getFieldValue("status"),
                date: form.getFieldValue("date"),
                EnquiryType: form.getFieldValue("EnquiryType"),
              });
              setFilterModalVisible(true);
            }}
          >
            {t("serviceConfiguration.filters.filter")}
            <img className="filter-trigger-funnel" src={SortIcon} alt="" />
            <FilterCountBadge count={appliedFilterCount} />
          </CustomButton>
          <CustomButton
            text={t("serviceConfiguration.filters.reset")}
            variant="outline"
            customClassName="filters-filterBtn responsive-filter-toolbar__reset-button"
            onClick={fresh}
          />
        </Form>
        <div className="todo-tabpanel-header-actions">
          <CustomButton
            variant="outline"
            text={t("common.export")}
            loading={exportLoading}
            onClick={handleExport}
            permissionCode="CustomerModule.Tickets.ExportTicketsTable"
            permissionRoutePath="/happiness/tickets"
          />
          {isCustomerHappness && (
            <CustomButton
              onClick={() => {
                setAddModalVisible(true);
              }}
              text={t("Customer.tickets.actions.addNew")}
              permissionCode="CustomerModule.Tickets.AddNewTicketsTable"
              permissionRoutePath="/happiness/tickets"
            />
          )}
        </div>
      </div>
      <div className="table-container">
        <Table
          className="admin-table"
          scroll={{ x: "max-content" }}
          onChange={(page, _filter, sorter) => {
            // @ts-ignore
            const { field, order } = sorter;
            setParams({
              ...params,
              PageIndex: page.current ?? 1,
              PageSize: page.pageSize ?? 10,
              SortBy: order ? field : "id",
              SortDirection: order === "ascend" ? 0 : 1,
            });
          }}
          pagination={{
            size: "default",
            current: data.pageIndex ?? 1,
            pageSize: data.pageSize ?? 10,
            total: data.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total: number) => <PaginationTotal label={t("common.total")} total={total} current={data.pageIndex ?? 1} pageSize={data.pageSize ?? 10} />,
          }}
          // @ts-ignore
          columns={columns}
          dataSource={data.items}
          onRow={(data) => {
            return {
              onClick: () => {
                history.push(
                  `/happiness/tickets/tickets-details?id=${data.id}`,
                );
              },
            };
          }}
        />
      </div>
      <AddModal
        enquiryTypes={enquiryTypes}
        onSave={handleAddSave}
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
      />
      <FilterModal
        enquiryTypes={enquiryTypes}
        enquiryStatus={enquiryStatus}
        statusFilterIds={TICKET_ENQUIRY_STATUS_FILTER_IDS}
        showResponsiveFilters
        ref={filterModalRef}
        isCustomerHappness={isCustomerHappness}
        onSave={handleSave}
        visible={filterModalVisible}
        onCancel={() => setFilterModalVisible(false)}
      />
    </div>
  );
}
