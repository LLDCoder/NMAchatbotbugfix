import Sousuo from "@/assets/icons/Sousuo";
import { MoreOutlined } from "@ant-design/icons"
import {
  useState,
  type FC,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react"
import { FilterTable, useFilter } from "@/components/common/FilterTable"
import type { FilterItem } from "@/components/common/FilterTable/type"
import PaginationTotal from "@/components/common/PaginationTotal"
import { Button, Card, Dropdown, Input, Menu, Select, Tabs, Tooltip } from "antd"
import DatePicker from "@/components/common/LocalizedDatePicker"
import moment from "moment"
import type { ColumnType, TableProps } from "antd/lib/table"
import { CustomButton, PermissionGuard } from "@/components/common"
import {
  type ResponsiveActionColumnButtonWidthMap,
  useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth"

import { useTranslation } from "react-i18next"
import "./index.less"
import {
  ACTIVE_TAB,
  type TKeyOfActiveTab,
  type TStatusSelection,
} from "./type"
import {
  transformDate,
  transformNoValueString,
} from "@/utils/transform"
import { SorterKeys } from "@/pages/Profile/type"
import { DEFAULT_PAGE_INFO, usePagination } from "@/hooks/usePagination"
import {
  exportTeamTaskList,
  getEnquirySource,
  getEnquiryStatus,
  getPriorityTypes,
  getTeamTaskList,
} from "@/services/tickets";
import type {
  IEnquirySourceResponse,
  IEnquiryStatus,
  IEnquiryType,
  IPriorityTypeResponse,
  ITeamTaskListRequest,
  ITeamTaskListItem,
} from "@/services/tickets"
import CustomStatusTag from "@/components/common/CustomStatusTag";
import { useHistory } from "react-router-dom"
import { navigateToTicketApplicationDetails } from "@/pages/Tickets/utils/applicationDetailsNavigation"
import { PERMISSION_CODES } from "@/constants/permissionCodes"
import { useButtonPermission } from "@/routes/access"
import ChangeStatusModal from "../ChangeStatusModal"
import ProcessModal from "../ProcessModal"
import SendBackModal from "../SendBackModal"
import AddModal from "../AddModal"
import { canShowDepartmentProcessActions } from "@/pages/Tickets/utils/ticketVisibility"

const formatDateOnly = (value: string | null): string | null => {
  return value ? moment(value).format("YYYY-MM-DD") : value
}

const ALLOWED_ENQUIRY_SOURCE_IDS = [1, 3, 5, 6, 7, 8, 9, 10] as const

type TeamTaskActionColumnKey =
  | "message"
  | "changeStatus"
  | "process"
  | "more"

const TEAM_TASK_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<TeamTaskActionColumnKey> = {
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
}

const TEAM_TASK_ACTION_COLUMN_DESKTOP_CONFIG = {
  gap: 12,
  padding: 32,
  minWidth: 112,
  maxWidth: 240,
}

const TEAM_TASK_ACTION_COLUMN_COMPACT_CONFIG = {
  gap: 8,
  padding: 24,
  minWidth: 112,
  maxWidth: 216,
}

const TEAM_TASK_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
  font: "500 16px Inter, sans-serif",
  narrowFont: "500 14px Inter, sans-serif",
  textPadding: 0,
}

interface ITeamTasksProps {
  enquiryTypes: IEnquiryType[]
  isCustomerHappness: boolean
  queryStatistics: () => void
}

export const TeamTasks: FC<ITeamTasksProps> = ({
  enquiryTypes,
  isCustomerHappness,
  queryStatistics,
}) => {
  const { i18n, t } = useTranslation()
  const [filterStore] = useFilter()
  const [activeTab, setActiveTab] = useState<TKeyOfActiveTab>(ACTIVE_TAB.todo)
  // CARE in case of not getting the true tab key when request
  const tabRef = useRef<TKeyOfActiveTab>(activeTab)
  const [dataSource, setDataSource] = useState<ITeamTaskListItem[]>([])
  const [pageInfo, setPage] = usePagination()
  const [enquiryStatuses, setEnquiryStatuses] = useState<IEnquiryStatus[]>([])
  const [priorityTypes, setPriorityTypes] = useState<IPriorityTypeResponse[]>([])
  const [enquirySources, setEnquirySources] = useState<IEnquirySourceResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const mountedRef = useRef(true)
  const requestIdRef = useRef(0)
  const history = useHistory();
  const [selectedRow, setSelectedRow] = useState<ITeamTaskListItem | null>(null)
  const [changeStatusModalVisible, setChangeStatusModalVisible] = useState(false)
  const [processModalVisible, setProcessModalVisible] = useState(false)
  const [sendBackModalVisible, setSendBackModalVisible] = useState(false)
  const [openActionRowId, setOpenActionRowId] = useState<number | null>(null)
  const { canRenderButton } = useButtonPermission("/happiness/tickets")

  const buildRequestParams = useCallback((
    type: TKeyOfActiveTab,
    config: Partial<ITeamTaskListRequest> = {},
  ): Partial<ITeamTaskListRequest> => {
    const values = filterStore.getFieldsValue() || {}
    const {
      EnquirySourceId,
      EnquiryType,
      PriorityId,
      keyword,
      status,
      time,
    } = values
    const [startTime, endTime] = transformDate(time)

    return {
      SortBy: "id",
      SortDirection: 1,
      PageIndex: 1,
      PageSize: 10,
      StartTime: formatDateOnly(startTime),
      EndTime: formatDateOnly(endTime),
      SearchKey: keyword || undefined,
      EnquiryStatusId: Array.isArray(status) && status.length
        ? status.join(",")
        : undefined,
      EnquiryType: EnquiryType ?? undefined,
      PriorityId: PriorityId ?? undefined,
      EnquirySourceId: EnquirySourceId ?? undefined,
      IsEnquiryComplete: type === ACTIVE_TAB.completed,
      ...config,
    }
  }, [filterStore])

  const request = useCallback(async (
    type: TKeyOfActiveTab = ACTIVE_TAB.todo,
    config: Partial<ITeamTaskListRequest> = {},
  ) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)

    try {
      const res = await getTeamTaskList(buildRequestParams(type, config))
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return
      }

      const responsePage = res?.data
      setDataSource(Array.isArray(responsePage?.items) ? responsePage.items : [])
      setPage({
        pageIndex: responsePage?.pageIndex ?? DEFAULT_PAGE_INFO.pageIndex,
        pageSize: responsePage?.pageSize ?? DEFAULT_PAGE_INFO.pageSize,
        total: responsePage?.total ?? DEFAULT_PAGE_INFO.total,
      })
    } catch {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return
      }

      setDataSource([])
      setPage(DEFAULT_PAGE_INFO)
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [buildRequestParams, setPage])

  useEffect(() => {
    mountedRef.current = true
    let active = true

    const loadFilterOptions = async () => {
      const [statusResult, priorityResult, sourceResult] = await Promise.allSettled([
        getEnquiryStatus(),
        getPriorityTypes(),
        getEnquirySource(),
      ])

      if (!active) {
        return
      }

      setEnquiryStatuses(
        statusResult.status === "fulfilled" && Array.isArray(statusResult.value?.data)
          ? statusResult.value.data
          : [],
      )
      setPriorityTypes(
        priorityResult.status === "fulfilled" && Array.isArray(priorityResult.value?.data)
          ? priorityResult.value.data
          : [],
      )
      setEnquirySources(
        sourceResult.status === "fulfilled" && Array.isArray(sourceResult.value?.data)
          ? sourceResult.value.data.filter((item) =>
              (ALLOWED_ENQUIRY_SOURCE_IDS as readonly number[]).includes(item.id),
            )
          : [],
      )
    }

    void loadFilterOptions()

    return () => {
      active = false
      mountedRef.current = false
      requestIdRef.current += 1
    }
  }, [])

  const statuses = useMemo<TStatusSelection[]>(() => (
    enquiryStatuses.map((item) => ({
      label: i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn,
      value: String(item.id),
    }))
  ), [enquiryStatuses, i18n.resolvedLanguage])

  const priorityOptions = useMemo(() => (
    priorityTypes.map((item) => ({
      label: i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn,
      value: item.id,
    }))
  ), [i18n.resolvedLanguage, priorityTypes])

  const sourceOptions = useMemo(() => (
    enquirySources.map((item) => ({
      label: i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn,
      value: item.id,
    }))
  ), [enquirySources, i18n.resolvedLanguage])

  const getVisibleTeamTaskActions = (
    record: ITeamTaskListItem,
  ): TeamTaskActionColumnKey[] => {
    const actions: TeamTaskActionColumnKey[] = []
    const canShowDepartmentActions = canShowDepartmentProcessActions({
      enquiryStatusId: record.enquiryStatusId,
      isCustomerHappiness: isCustomerHappness,
      reopenTimes: record.reopenTimes,
      isCurrentHandler: record.isCurrentHandler,
    })

    if ([1, 2, 3, 4].includes(record.enquiryStatusId)) {
      actions.push("message")
    }

    if (
      [1, 2, 4].includes(record.enquiryStatusId) &&
      isCustomerHappness &&
      canRenderButton("CustomerModule.Tickets.Confirm") &&
      canRenderButton("CustomerModule.Tickets.ChangeStatus")
    ) {
      actions.push("changeStatus")
    }

    if (
      canShowDepartmentActions &&
      canRenderButton("CustomerModule.Tickets.ConfirmProcessModal") &&
      canRenderButton("CustomerModule.Tickets.Process")
    ) {
      actions.push("process")
    }

    if (
      canShowDepartmentActions &&
      canRenderButton("CustomerModule.Tickets.ConfirmSendBackModal")
    ) {
      actions.push("more")
    }

    return actions
  }

  const getTeamTaskActionLabel = (actionKey: TeamTaskActionColumnKey) => {
    const actionLabelMap: Partial<Record<TeamTaskActionColumnKey, string>> = {
      message: t("Customer.tickets.actions.message"),
      changeStatus: t("Customer.tickets.actions.changeStatus"),
      process: t("Customer.tickets.actions.process"),
    }

    return actionLabelMap[actionKey]
  }

  const teamTaskActionColumnWidth = useResponsiveActionColumnWidth<
    ITeamTaskListItem,
    TeamTaskActionColumnKey
  >({
    rows: dataSource,
    buttonWidthMap: TEAM_TASK_ACTION_BUTTON_WIDTH_MAP,
    getVisibleActions: getVisibleTeamTaskActions,
    getActionLabel: getTeamTaskActionLabel,
    desktopConfig: TEAM_TASK_ACTION_COLUMN_DESKTOP_CONFIG,
    compactConfig: TEAM_TASK_ACTION_COLUMN_COMPACT_CONFIG,
    textMeasureConfig: TEAM_TASK_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
  })

  const enquiryTypeOptions = useMemo(() => (
    (Array.isArray(enquiryTypes) ? enquiryTypes : []).map((item) => ({
      label: i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn,
      value: item.id,
    }))
  ), [enquiryTypes, i18n.resolvedLanguage])

  const exportTeamTasks = useCallback(async () => {
    setExporting(true)
    try {
      await exportTeamTaskList({
        ...buildRequestParams(activeTab),
        PageIndex: 1,
        PageSize: 10000,
      })
    } catch {
      return
    } finally {
      if (mountedRef.current) {
        setExporting(false)
      }
    }
  }, [activeTab, buildRequestParams])

  const handleAddSave = useCallback(() => {
    filterStore.resetFields()
    setAddModalVisible(false)
    queryStatistics()
    void request(ACTIVE_TAB.todo, {
      PageIndex: 1,
    })
  }, [filterStore, queryStatistics, request])

  const columns: ColumnType<ITeamTaskListItem>[] = [
    {
      title: t("Customer.tickets.table.ticketNo"),
      dataIndex: "enquiryNumber",
      key: "enquiryNumber",
      width: 280,
      fixed: "left",
      className: "team-tasks-table__cell",
      render(text: string, record: ITeamTaskListItem){
        return (
          <div className="team-tasks-table__ticket-number-cell">
            <div className="team-tasks-table__ticket-number-body">
              <span className="team-tasks-table__ticket-number-text">{text}</span>
              {!!record.reopenTimes && <div className="todo-tabpanel-reopen-times">{t("Customer.tickets.labels.reopen")}</div>}
            </div>
          </div>
        )
      }
    },
     {
      title: t("Customer.tickets.table.type"),
      dataIndex: ['enquiryTypeObj', i18n.resolvedLanguage === 'ar' ? 'nameAr' : 'nameEn'],
      key: "enquiryTypeName",
      width: 120,
    },
    {
      title: t("Customer.tickets.table.applicationNo"),
      dataIndex: "applicationNo",
      key: "applicationNo",
      width: 160,
      className: "team-tasks-table__cell",
      render(text: string){
        return <div className="todo-tabpanel-appno" onClick={async (e) => {
          e.stopPropagation();
          await navigateToTicketApplicationDetails(history, text)
      }}>{text || '-'}</div>
      }
    },
    {
      title: t("Customer.tickets.table.serviceName"),
      dataIndex: ['serviceObj', i18n.resolvedLanguage === 'ar' ? 'nameAr' : 'nameEn'],
      key: "serviceName",
      width: 200,
      className: "team-tasks-table__cell",
      // ellipsis: {
      //   showTitle: false,
      // },
      render: (text: string) => {
        return (
          <Tooltip
            title={text}
            placement="topLeft"
          >
            <span className="team-tasks-table__tooltip-trigger">
              <span className="team-tasks-table__service-name team-tasks-table__text--two-lines">
                {text || '-'}
              </span>
            </span>
          </Tooltip>
        )
      },
    },
     {
      title: t("Customer.tickets.table.customer"),
      dataIndex: "custormer",
      key: "custormer",
      width: 200,
      className: "team-tasks-table__cell team-tasks-table__customer-cell",
      render: (text: string) => (
        <Tooltip title={text} placement="topLeft">
          <span className="team-tasks-table__tooltip-trigger">
            <span className="team-tasks-table__customer-name team-tasks-table__text--two-lines">
              {text}
            </span>
          </span>
        </Tooltip>
      ),
    },
    {  
      title: t("Customer.tickets.table.issueCategory"),
      dataIndex: ["issueCategoryObj", i18n.resolvedLanguage === "en" ? "nameEn" : "nameAr"],
      key: "issueCategoryObj",
      width: "140"
    },
    {
      title: t("Customer.tickets.table.status"),
      dataIndex: "enquiryStatusId",
      key: "enquiryStatusId",
      width: 200,
      className: "team-tasks-table__cell",
      sorter: true,
      render: (status: string) => {
        return <CustomStatusTag type="enquiryStatus" status={status} />
      }
    },
    {
      title: t("Customer.tickets.table.sla"),
      dataIndex: "sla",
      key: "sla",
      width: 140,
      className: "team-tasks-table__cell",
      sorter: true,
      render: (text: string, record: ITeamTaskListItem) => {
        const value = transformNoValueString(text);
        return (
          <span
            className={record.isOverDue ? "todo-tabpanel-overdue" : undefined}
            style={record.isOverDue ? { color: "#ea4f49" } : undefined}
          >
            {value}
          </span>
        );
      },
    },
     {
      title: t("Customer.tickets.table.currentHandler"),
      dataIndex: "currentHander",
      key: "currentHander",
      width: 180,
      className: "team-tasks-table__cell",
      render: (text: string) => (
        <Tooltip title={text} placement="topLeft">
          <span className="team-tasks-table__tooltip-trigger">
            <span className="team-tasks-table__text--two-lines">{text}</span>
          </span>
        </Tooltip>
      ),
    },
    {
      title: t("Customer.tickets.table.submissionTime"),
      dataIndex: "createdOn",
      key: "createdOn",
      sorter: true,
      width: "160",
      render: (text: string) => {
        return text ? moment(text).format("DD/MM/YYYY HH:mm:ss") : '-';
      },
    },
    {
      title: t("Customer.tickets.table.actions"),
      dataIndex: "Actions",
      key: "Actions",
      width: teamTaskActionColumnWidth,
      fixed: "right",
      render(_: string, record: ITeamTaskListItem){
        const messageCount = Number(record.messageCount)
        const canShowDepartmentActions = canShowDepartmentProcessActions({
          enquiryStatusId: record.enquiryStatusId,
          isCustomerHappiness: isCustomerHappness,
          reopenTimes: record.reopenTimes,
          isCurrentHandler: record.isCurrentHandler,
        })

        return (
          <div
            className="team-tasks-table__actions"
            onClick={(event) => event.stopPropagation()}
          >
            {[1, 2, 3, 4].includes(record.enquiryStatusId) && (
              <div className="team-tasks-table__message">
                {Number.isFinite(messageCount) && messageCount > 0 && (
                  <span className="team-tasks-table__notification-badge" />
                )}
                <CustomButton
                  variant="text"
                  text={t("Customer.tickets.actions.message")}
                  onClick={() => {
                    history.push({
                      pathname: "/happiness/tickets/tickets-details",
                      search: `?id=${record.id}`,
                    })
                  }}
                />
              </div>
            )}
            {[1, 2, 4].includes(record.enquiryStatusId) &&
              isCustomerHappness && (
                <PermissionGuard
                  permissionCode="CustomerModule.Tickets.Confirm"
                  routePath="/happiness/tickets"
                >
                  <CustomButton
                    variant="text"
                    text={t("Customer.tickets.actions.changeStatus")}
                    permissionCode="CustomerModule.Tickets.ChangeStatus"
                    permissionRoutePath="/happiness/tickets"
                    onClick={(event: ReactMouseEvent<HTMLElement>) => {
                      event.stopPropagation()
                      setSelectedRow(record)
                      setChangeStatusModalVisible(true)
                    }}
                  />
                </PermissionGuard>
              )}
            {canShowDepartmentActions && (
              <PermissionGuard
                permissionCode="CustomerModule.Tickets.ConfirmProcessModal"
                routePath="/happiness/tickets"
              >
                <CustomButton
                  variant="text"
                  text={t("Customer.tickets.actions.process")}
                  permissionCode="CustomerModule.Tickets.Process"
                  permissionRoutePath="/happiness/tickets"
                  onClick={(event: ReactMouseEvent<HTMLElement>) => {
                    event.stopPropagation()
                    setSelectedRow(record)
                    setProcessModalVisible(true)
                  }}
                />
              </PermissionGuard>
            )}
            {canShowDepartmentActions && (
              <PermissionGuard
                permissionCode="CustomerModule.Tickets.ConfirmSendBackModal"
                routePath="/happiness/tickets"
              >
                <Dropdown
                  visible={openActionRowId === record.id}
                  onVisibleChange={(visible) => {
                    setOpenActionRowId(visible ? record.id : null)
                  }}
                  overlay={(
                    <Menu>
                      <Menu.Item
                        key="sendBack"
                        onClick={(event) => {
                          event.domEvent.stopPropagation()
                          setOpenActionRowId(null)
                          setSelectedRow(record)
                          setSendBackModalVisible(true)
                        }}
                      >
                        {t("Customer.tickets.actions.sendBack")}
                      </Menu.Item>
                    </Menu>
                  )}
                  trigger={["hover"]}
                  placement="bottomRight"
                >
                  <Button
                    type="text"
                    className="team-tasks-table__more-button"
                    icon={<MoreOutlined />}
                    aria-label={t("Customer.tickets.actions.sendBack")}
                  />
                </Dropdown>
              </PermissionGuard>
            )}
          </div>
        )
      }
    },
  ]

  const tableConfigs: TableProps<ITeamTaskListItem> = (() => {
    switch (activeTab) {
      case ACTIVE_TAB.todo: {
        return {
          columns: columns,
          dataSource,
          onRow: (data)=>{
              return {
                  onClick: () => {
                      history.push(`/happiness/tickets/tickets-details?id=${data.id}`);
                  }
              }
          },
          rowKey: (record: ITeamTaskListItem) => record.id,
          onChange: (pagination, _f, sorter) => {
            const normalizedSorter = (Array.isArray(sorter) ? sorter[0] : sorter) || {}
            const { order = SorterKeys.descend, field } = normalizedSorter;
            request(activeTab, {
              PageSize: pagination.pageSize,
              PageIndex: pagination.current,
              SortBy: order && field ? String(field) : undefined,
              SortDirection: order === SorterKeys.ascend ? 0 : 1,
            })
          },
        }
      }
      case ACTIVE_TAB.completed: {
        const pickColumnsFromApplicationInfo = <T extends ITeamTaskListItem>(
          target: ColumnType<T>[],
          ignoreKeys: string[] = [
            "Actions",
            "currentHander",
          ]
        ) => {
          return target.filter((item) => !ignoreKeys.includes(String(item.key)))
        }
        return {
          rowKey: (record: ITeamTaskListItem) => record.id,
          columns: pickColumnsFromApplicationInfo(columns),
          onRow: (data)=>{
              return {
                  onClick: () => {
                      history.push(`/happiness/tickets/tickets-details?id=${data.id}`);
                  }
              }
          },
          dataSource,
          onChange: (pagination, _f, sorter) => {
            const normalizedSorter = (Array.isArray(sorter) ? sorter[0] : sorter) || {}
            const { order = SorterKeys.ascend, field } = normalizedSorter
            request(activeTab, {
              PageSize: pagination.pageSize,
              PageIndex: pagination.current,
              SortBy: order && field ? String(field) : undefined,
              SortDirection: order === SorterKeys.ascend ? 0 : 1,
            })
          },
        }
      }
    }
  })()

  const tableFilterConfigs = useMemo<FilterItem[]>(() => {
    const allowedStatusIds = activeTab === ACTIVE_TAB.todo
      ? [1, 2, 3, 4]
      : [5, 6, 7]

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
        requestDebounceMs: 500,
      },
      {
        label: t("Customer.tickets.table.status"),
        element: (
          <Select
            mode="multiple"
            maxTagCount={1}
            maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
            key="select-status"
            placeholder={t("CMS.common.placeholders.allStatuses")}
            className="select-style"
            options={statuses.filter((item) =>
              allowedStatusIds.includes(Number(item.value)),
            )}
            allowClear
          />
        ),
      },
      {
        label: t("Customer.tickets.table.submissionTime"),
        element: (
          <DatePicker.RangePicker
            key="range-time"
            separator="-"
            format={["YYYY-MM-DD"]}
            placeholder={[
              t("CMS.common.placeholders.startTime"),
              t("CMS.common.placeholders.endTime"),
            ]}
            getPopupContainer={(node) => node}
            className="range-picker tickets-table-date-range-picker tickets-toolbar-date-range-picker"
          />
        ),
      },
      {
        label: t("Customer.tickets.table.type"),
        element: (
          <Select
            key="select-EnquiryType"
            placeholder={t("Customer.tickets.placeholders.allTypes")}
            options={enquiryTypeOptions}
            allowClear
          />
        ),
      },
      {
        label: t("Customer.tickets.filterModal.priority"),
        element: (
          <Select
            key="select-PriorityId"
            placeholder={t("Customer.tickets.filterModal.allPriority")}
            options={priorityOptions}
            allowClear
          />
        ),
      },
      {
        label: t("Customer.tickets.filterModal.source"),
        element: (
          <Select
            key="select-EnquirySourceId"
            placeholder={t("Customer.tickets.filterModal.allSource")}
            options={sourceOptions}
            allowClear
          />
        ),
      },
    ]
  }, [
    activeTab,
    enquiryTypeOptions,
    priorityOptions,
    sourceOptions,
    statuses,
    t,
  ])

  const getExtraBtn = useCallback(() => {
    return (
      <div className="filter-area">
        <div className="export-add">
          <PermissionGuard
            permissionCode={PERMISSION_CODES.customer.tickets.exportTeamTasks}
            routePath="/happiness/tickets"
          >
            <CustomButton
              text={t("common.export")}
              variant="outline"
              loading={exporting}
              disabled={exporting}
              onClick={exportTeamTasks}
            />
          </PermissionGuard>
          {activeTab === ACTIVE_TAB.todo && isCustomerHappness && (
            <CustomButton
              text={t("Customer.tickets.actions.addNew")}
              permissionCode="CustomerModule.Tickets.AddNew"
              permissionRoutePath="/happiness/tickets"
              onClick={() => setAddModalVisible(true)}
            />
          )}
        </div>
      </div>
    )
  }, [activeTab, exportTeamTasks, exporting, isCustomerHappness, t])

  useEffect(() => {
    void request(activeTab)
  }, [activeTab, request])

  return (
    <>
      <Card className="content-team-tasks">
        <Tabs
          activeKey={activeTab}
          onChange={(key: string) => {
            const nextTab = key as TKeyOfActiveTab
            filterStore.resetFields()
            requestIdRef.current += 1
            setChangeStatusModalVisible(false)
            setProcessModalVisible(false)
            setSendBackModalVisible(false)
            setAddModalVisible(false)
            setOpenActionRowId(null)
            setActiveTab(nextTab)
            tabRef.current = nextTab
          }}
        >
          <Tabs.TabPane tab={<span data-reader-view="todo">{t("Customer.tickets.tabs.todo")}</span>} key="1" />
          <Tabs.TabPane tab={<span data-reader-view="completed">{t("Customer.tickets.tabs.completed")}</span>} key="2" />
        </Tabs>

        <FilterTable
          key={`team-tasks-${activeTab}`}
          responsiveToolbar
          containerCls="custom-table"
          {...tableConfigs}
          scroll={{x: "max-content"}}
          loading={loading}
          filterStore={filterStore}
          tableFilters={tableFilterConfigs}
          extraBtn={getExtraBtn()}
          request={() => request(tabRef.current)}
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
        {isCustomerHappness && (
          <AddModal
            enquiryTypes={enquiryTypes}
            onSave={handleAddSave}
            visible={addModalVisible}
            onCancel={() => setAddModalVisible(false)}
          />
        )}
        {selectedRow && (
          <>
            <ChangeStatusModal
              enquiryTypes={enquiryTypes}
              row={selectedRow}
              visible={changeStatusModalVisible}
              onSave={() => {
                queryStatistics()
                void request(tabRef.current)
                setChangeStatusModalVisible(false)
              }}
              onCancel={() => setChangeStatusModalVisible(false)}
            />
            <ProcessModal
              row={selectedRow}
              visible={processModalVisible}
              onSave={() => {
                queryStatistics()
                void request(tabRef.current)
                setProcessModalVisible(false)
              }}
              onCancel={() => setProcessModalVisible(false)}
            />
            <SendBackModal
              row={selectedRow}
              visible={sendBackModalVisible}
              onSave={() => {
                queryStatistics()
                void request(tabRef.current)
                setSendBackModalVisible(false)
              }}
              onCancel={() => setSendBackModalVisible(false)}
            />
          </>
        )}
      </Card>
    </>
  )
}
