import Sousuo from "@/assets/icons/Sousuo";
import {
  useState,
  type FC,
  useEffect,
  useRef,
  useMemo,
  useContext,
  useCallback,
} from "react"
import { FilterTable, useFilter } from "@/components/common/FilterTable"
import PaginationTotal from "@/components/common/PaginationTotal"
import { Card, DatePicker, Input, Select, Tabs, Tag, Tooltip } from "antd"
import moment from "moment"
import type { ColumnType, TableProps } from "antd/lib/table"
import { CustomButton, CustomMessage, PermissionGuard } from "@/components/common"

import { useTranslation } from "react-i18next"
import "./index.less"
import {
  applicationMyTeamComplatedPage,
  applicationMyTeamTodoPage,
  type TTeamTodoPageQueryParams,
  exportMyTodoReview,
  exportMyCompletedReview,
} from "@/services/application"
import { applicationMyTeamMembers } from "@/services/team"
import type { ITeamTasksDto } from "@/services/team"
import { ReassignTaskModal } from "./ReassignTaskModal"
import type { IReassignTaskModalRef } from "./ReassignTaskModal/type"
import {
  ACTIVE_TAB,
  type IMemberSelection,
  type IRequestConfig,
  type TKeyOfActiveTab,
  type TStatusSelection,
} from "./type"
import {
  transformDate,
  transformNoValueString,
  transformSorterKeys,
  transformSpaceString,
} from "@/utils/transform"
import type { SorterResult } from "antd/lib/table/interface"
import { SorterKeys } from "@/pages/Profile/type"
import type { ITaskStatus } from "@/components/BusinessCmps/TasksPanel/type"
import { debounce } from "lodash"
import { ApplicationContext } from "../.."
import { ExportBtn } from "@/components/common/ExportBtn"
import { DEFAULT_PAGE_INFO, usePagination } from "@/hooks/usePagination"
import {
  DEFAULT_STATUS,
  TasksPanel,
} from "@/components/BusinessCmps/TasksPanel"
import applicationNoProfileStar from "@/assets/images/application-no-star.png"

type TableRowSelection<T extends object = object> =
  TableProps<T>["rowSelection"]

// refuse to display
export const disableStatus = ["External Approval", "Pending Modification"]

export const TeamTasks: FC = () => {
  const { t } = useTranslation()
  const [filterStore] = useFilter()
  const reAssignTaskModalRef = useRef<IReassignTaskModalRef>(null)
  const [activeTab, setActiveTab] = useState<TKeyOfActiveTab>(ACTIVE_TAB.todo)
  // CARE in case of not getting the true tab key when request
  const tabRef = useRef<TKeyOfActiveTab>(activeTab)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [dataSource, setDataSource] = useState<ITeamTasksDto[]>([])

  const [pageInfo, setPage] = usePagination()
  const [members, setMembers] = useState<IMemberSelection[]>([])
  const [statuses, setStatuses] = useState<TStatusSelection>({
    [ACTIVE_TAB.todo]: [],
    [ACTIVE_TAB.completed]: [],
  })
  const [taskStatus, setTaskStatus] = useState<ITaskStatus>(DEFAULT_STATUS)
  const [taskIds, setTaskIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const applicationContext = useContext(ApplicationContext)

  /*--------- promise --------- */

  const getMembers = async () => {
    try {
      const mem = await applicationMyTeamMembers()
      setMembers(
        (mem?.data || []).map((item) => ({
          label: item.userName,
          value: item.userId,
        }))
      )
    } catch (error) {
      CustomMessage.error(
        t("applications.teamModals.messages.membersLoadFailed")
      )
    }
  }

  const exportTodoReview = async () => {
    const { status, userId, time, keyword } = filterStore.getFieldsValue()
    try {
      await exportMyTodoReview({
        processInstanceStatus: status || undefined,
        userId: userId || undefined,
        startTime: transformDate(time)[0],
        endTime: transformDate(time)[1],
        keyword: keyword || undefined,
      })
    } catch (error) {
      CustomMessage.error(t("applications.messages.todoReviewExportFailed"))
    }
  }

  const exportCompletedReview = async () => {
    const { status, userId, time, keyword } = filterStore.getFieldsValue()
    try {
      await exportMyCompletedReview({
        processInstanceStatus: status || undefined,
        userId: userId || undefined,
        startTime: transformDate(time)[0],
        endTime: transformDate(time)[1],
        keyword: keyword || undefined,
      })
    } catch (error) {
      CustomMessage.error(t("applications.messages.todoReviewExportFailed"))
    }
  }

  const request = async (
    type: TKeyOfActiveTab = "1",
    config: IRequestConfig = {
      sortBy: "submissionTime" as keyof ITeamTasksDto,
      sortDirection: 1,
      pageIndex: 1,
      pageSize: 10,
    }
  ) => {
    const RequestConfig = {
      [ACTIVE_TAB.todo]: {
        getParams: () => {
          const { status, userId, time, keyword } = filterStore.getFieldsValue()
          const reqParams: TTeamTodoPageQueryParams = {
            pageSize: 10,
            pageIndex: 1,
            startTime: transformDate(time)[0],
            endTime: transformDate(time)[1],
            userId: userId || undefined,
            keyword: keyword || undefined,
            processInstanceStatus: status || undefined,
            ...config,
          }
          return reqParams
        },
        sendRequest: applicationMyTeamTodoPage,
      },
      [ACTIVE_TAB.completed]: {
        getParams: () => {
          const { status, userId, time, keyword } = filterStore.getFieldsValue()
          const reqParams: TTeamTodoPageQueryParams = {
            pageSize: 10,
            pageIndex: 1,
            startTime: transformDate(time)[0],
            endTime: transformDate(time)[1],
            userId: userId || undefined,
            keyword: keyword || undefined,
            processInstanceStatus: status || undefined,
            ...config,
          }
          return reqParams
        },
        sendRequest: applicationMyTeamComplatedPage,
      },
    }
    setLoading(true)
    const res = await RequestConfig[type].sendRequest(
      RequestConfig[type].getParams()
    )
    const { pageIndex, pageSize, total } = res?.data?.page || DEFAULT_PAGE_INFO
    setDataSource(res?.data?.page?.items || [])
    setTaskStatus(res?.data?.statusCount || {})
    // CARE every type only init once when request this api
    if (!statuses[type].length) {
      const value = (res?.data?.processInstanceStatus || [])?.map((item) => ({
        label: item,
        value: item,
      }))
      setStatuses({
        ...statuses,
        [type]: value,
      })
    }
    setPage({
      pageIndex,
      pageSize,
      total,
    })
    setLoading(false)
  }

  const debouncedRequest = debounce(request, 500)

  // Reserve the star gutter only when a row actually shows a star; otherwise the
  // placeholder pushes every Application No. 28px right of its header.
  const hasApplicationNoProfileStar = dataSource.some(
    (record) => record.profileIsVIP,
  )

  const columns: ColumnType<ITeamTasksDto>[] = [
    {
      title: t("applications.tableColumns.applicationNo"),
      dataIndex: "applicationNumber",
      key: "applicationNumber",
      align: "left",
      fixed: 'left',
      render: (text, record) => {
        const urgentFlag = record?.isUrgent ? "Urgent" : undefined
        return (
          <div
            className={`application-no-cell${
              hasApplicationNoProfileStar
                ? ""
                : " application-no-cell--without-star"
            }`}
          >
            <span className="application-no-leading">
              {hasApplicationNoProfileStar ? (
                <span className="application-no-star-slot">
                  {record.profileIsVIP ? (
                    <img
                      src={applicationNoProfileStar}
                      alt=""
                      className="application-no-profile-star"
                    />
                  ) : (
                    <span className="application-no-star-placeholder" aria-hidden />
                  )}
                </span>
              ) : null}
              <span className="application-no-text">{text}</span>
            </span>
            {record?.isUrgent && (
              <Tag color="rgba(235, 95, 36, 1)" className="app-number">
                {urgentFlag}
              </Tag>
            )}
          </div>
        )
      },
    },
    {
      title: t("applications.tableColumns.serviceName"),
      dataIndex: "serviceNameEn",
      key: "serviceNameEn",
      ellipsis: false,
      render: (text: string) => {
        const display = text?.trim() ? text : "-"
        return (
          <Tooltip
            title={display !== "-" ? display : undefined}
            color={"#fff"}
            overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
            placement="topLeft"
          >
            <span className="applications-cell-ellipsis-2-lines">{display}</span>
          </Tooltip>
        )
      },
    },
    {
      title: t("applications.tableColumns.serviceCategory"),
      dataIndex: "serviceCategoryNameEn",
      key: "serviceCategoryNameEn",
      ellipsis: false,
      render: (text: string) => {
        const display = text?.trim() ? text : "-"
        return (
          <Tooltip
            title={display !== "-" ? display : undefined}
            color={"#fff"}
            overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
            placement="topLeft"
          >
            <span className="applications-cell-ellipsis-1-line">{display}</span>
          </Tooltip>
        )
      },
    },
    {
      title: t("applications.tableColumns.type"),
      dataIndex: "serviceTypeNameEn",
      key: "serviceTypeNameEn",
    },
    {
      title: t("applications.tableColumns.status"),
      dataIndex: "status",
      key: "status",
      width: 240,
      render: (text: string) => {
        return (
          <div className={`status-tag ${transformSpaceString(text)}`}>
            {text}
          </div>
        )
      },
    },
    {
      title: t("applications.tableColumns.sla"),
      dataIndex: "slaDescription",
      key: "slaDescription",
      sorter: true,
      render: (text: string) => {
        return transformNoValueString(text)
      },
    },
    {
      title: t("applications.tableColumns.applyFor"),
      dataIndex: "applyForEn",
      key: "applyForEn",
      render: (text: string, record: ITeamTasksDto) => {
        return (
          <div className="user-name">
            <span>{text}</span>
          </div>
        )
      },
    },
    {
      title: t("applications.tableColumns.assignedTo"),
      dataIndex: "assignedTo",
      key: "assignedTo",
    },
    {
      title: t("applications.tableColumns.submissionTime"),
      dataIndex: "submissionTime",
      key: "submissionTime",
      sorter: true,
      render: (text: string) => {
        return moment(text).format("DD/MM/YYYY HH:mm:ss")
      },
    },
    {
      title: t("applications.tableColumns.action"),
      key: "actions",
      fixed: 'right',
      render: (_, record: ITeamTasksDto) => {
        if (disableStatus.includes(record?.status || "")) {
          return "-"
        }
        return (
          <div className="table-actions">
            <PermissionGuard
              permissionCode="Licensing.Applications.ConfirmReassignTaskModal"
              routePath="/licensing/applications"
            >
              <PermissionGuard
                permissionCode="Licensing.Applications.Reassign"
                routePath="/licensing/applications"
              >
                <div
                  className="table-btn"
                  onClick={(e) => {
                    setTaskIds([record.taskId])
                    reAssignTaskModalRef.current?.show()
                    e.stopPropagation()
                  }}
                >
                  {t("applications.buttons.reassign")}
                </div>
              </PermissionGuard>
            </PermissionGuard>
          </div>
        )
      },
    },
  ]

  const tableConfigs = useMemo<TableProps<ITeamTasksDto>>(() => {
    switch (activeTab) {
      case ACTIVE_TAB.todo: {
        const rowSelection: TableRowSelection<ITeamTasksDto> = {
          selectedRowKeys,
          onChange: (newSelectedRowKeys: React.Key[]) => {
            setTaskIds(newSelectedRowKeys.map((item) => item.toString()))
            setSelectedRowKeys(newSelectedRowKeys)
          },
          getCheckboxProps(record) {
            return {
              disabled: disableStatus.includes(record?.status || ""),
            }
          },
        }
        return {
          columns: columns,
          dataSource,
          rowKey: (record: ITeamTasksDto) => record.taskId,
          rowSelection,
          onChange: (pagination, _f, sorter) => {
            const { order = SorterKeys.descend, field } =
              sorter as SorterResult<ITeamTasksDto>
            request(activeTab, {
              pageIndex: pagination.current,
              pageSize: pagination.pageSize,
              ...transformSorterKeys<ITeamTasksDto>(
                field as keyof ITeamTasksDto,
                order as typeof SorterKeys.ascend
              ),
            })
          },
        }
      }
      case ACTIVE_TAB.completed: {
        const pickColumnsFromApplicationInfo = <T extends ITeamTasksDto>(
          target: ColumnType<T>[],
          ignoreKeys: Array<ColumnType<T>["key"]> = [
            "slaDescription",
            "assignedTo",
            "actions",
          ]
        ) => {
          return target.filter((item) => !ignoreKeys.includes(item.key))
        }

        return {
          rowKey: (record: ITeamTasksDto) => record.taskId,
          columns: pickColumnsFromApplicationInfo(columns),
          dataSource,
          onChange: (pagination, _f, sorter) => {
            const { order = SorterKeys.descend, field } =
              sorter as SorterResult<ITeamTasksDto>
            request(activeTab, {
              pageIndex: pagination.current,
              pageSize: pagination.pageSize,
              ...transformSorterKeys<ITeamTasksDto>(
                field as keyof ITeamTasksDto,
                order as typeof SorterKeys.ascend
              ),
            })
          },
        }
      }
    }
  }, [activeTab, dataSource, selectedRowKeys])

  const tableFilterConfigs = useMemo(() => {
    switch (activeTab) {
      case ACTIVE_TAB.todo:
        return [
          <Input
            placeholder={t("common.search")}
            prefix={<Sousuo className="search-icon" />}
            key="input-keyword"
            className="search-input"
            allowClear
          />,
          {
            label: t("teamManagement.filter.member"),
            element: (
              <Select
                options={members}
                placeholder={t("CMS.common.placeholders.allMembers")}
                className="select-style"
                key="select-userId"
                allowClear
              />
            ),
          },
          {
            label: t("applications.tableColumns.status"),
            element: (
              <Select
                key="select-status"
                placeholder={t("CMS.common.placeholders.allStatuses")}
                className="select-style"
                options={statuses[ACTIVE_TAB.todo]}
                allowClear
              />
            ),
          },
          {
            label: t("applications.filters.submissionTime"),
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
        ]
      case ACTIVE_TAB.completed:
        return [
          <Input
            placeholder={t("common.search")}
            prefix={<Sousuo className="search-icon" />}
            key="input-keyword"
            className="search-input"
            allowClear
          />,
          {
            label: t("applications.tableColumns.status"),
            element: (
              <Select
                key="select-status"
                placeholder={t("CMS.common.placeholders.allStatuses")}
                className="select-style"
                options={statuses[ACTIVE_TAB.completed]}
                allowClear
              />
            ),
          },
          {
            label: t("applications.filters.submissionTime"),
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
        ]
    }
  }, [activeTab, members, statuses, t])

  const getExtraBtn = useCallback(() => {
    switch (activeTab) {
      case ACTIVE_TAB.todo:
        return (
          <ExportBtn
            exportCb={exportTodoReview}
            exportName={`Applications_TeamTasks_ToDo_${moment().format("DDMMYYYY_HHmmss")}.csv`} />
        )
      case ACTIVE_TAB.completed:
        return (
          <ExportBtn
            exportCb={exportCompletedReview}
            exportName={`Applications_TeamTasks_Completed_${moment().format("DDMMYYYY_HHmmss")}.csv`} 
          />
        )
    }
  }, [activeTab])

  useEffect(() => {
    getMembers()
  }, [])

  useEffect(() => {
    request(activeTab)
  }, [activeTab])

  return (
    <>
      <TasksPanel status={taskStatus} />
      <Card className="content">
        <Tabs
          defaultActiveKey={activeTab}
          onChange={(key: string) => {
            setActiveTab(key as TKeyOfActiveTab)
            tabRef.current = key as TKeyOfActiveTab
            filterStore.resetFields()
          }}
        >
          <Tabs.TabPane tab={t("applications.subTabs.todo")} key="1" />
          <Tabs.TabPane tab={t("applications.subTabs.completed")} key="2" />
        </Tabs>

        <FilterTable
          responsiveToolbar
          containerCls="custom-table"
          {...tableConfigs}
          scroll={{ x: 1600 }}
          loading={loading}
          filterStore={filterStore}
          renderSelectionTip={() => {
            return (
              <div className="selection-tip">
                <span>
                  {t("teamManagement.reassign.tasksSelected", {
                    count: selectedRowKeys.length,
                  })}
                </span>
                <PermissionGuard
                  permissionCode="Licensing.Applications.ConfirmReassignTaskModal"
                  routePath="/licensing/applications"
                >
                  <CustomButton
                    onClick={() => {
                      reAssignTaskModalRef.current?.show()
                    }}
                    text={t("applications.buttons.reassign")}
                    permissionCode="Licensing.Applications.Reassign"
                    permissionRoutePath="/licensing/applications"
                  />
                </PermissionGuard>
              </div>
            )
          }}
          tableFilters={tableFilterConfigs}
          extraBtn={getExtraBtn()}
          request={() => debouncedRequest(tabRef.current)}
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
        <ReassignTaskModal
          title={
            selectedRowKeys.length ? `(${selectedRowKeys.length} selected)` : ""
          }
          taskIds={taskIds}
          onOkCb={() => {
            request(activeTab)
            applicationContext?.dispatch()
          }}
          ref={reAssignTaskModalRef}
        />
      </Card>
    </>
  )
}
