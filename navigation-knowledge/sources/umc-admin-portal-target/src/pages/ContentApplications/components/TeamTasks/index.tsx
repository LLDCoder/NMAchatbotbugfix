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
import { applicationMyTeamMembers } from "@/services/team"
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
} from "@/utils/transform"
import type { SorterResult } from "antd/lib/table/interface"
import { SorterKeys } from "@/pages/Profile/type"
import sortIcon from "@/assets/images/sort.png"
import { debounce } from "lodash"
import { ExportBtn } from "@/components/common/ExportBtn"
import {
  DEFAULT_STATUS,
  TasksPanel,
} from "@/components/BusinessCmps/TasksPanel"
import type { ITaskStatus } from "@/components/BusinessCmps/TasksPanel/type"
import { DEFAULT_PAGE_INFO, usePagination } from "@/hooks/usePagination"
import type { IReassignTaskModalRef } from "./ReassignTaskModal/type"
import { ContentContext } from "../../context"
import { ReassignTaskModal } from "./ReassignTaskModal"
import { ContentApplicationStatus } from "../ContentApplicationStatus"
import {
  exportMyTeamCompletedReview,
  exportMyTeamTodoReview,
  getMyTeamCompletedPageTasks,
  getMyTeamTodoPageTasks,
  type TTeamReqParams,
  type TTeamTasks,
} from "@/services/content"
import type {
  IFilterModalRef,
  IFilterParams,
  IStatus,
} from "../FilterModal/type"
import { DEFAULT_RESULTS, FilterModal } from "../FilterModal"
import applicationNoProfileStar from "@/assets/images/application-no-star.png"

type TableRowSelection<T extends object = object> =
  TableProps<T>["rowSelection"]

// refuse to display
const disableStatus = ["External Approval", "Pending Modification"]

const EMPTY_ADVANCED_FILTER_CONFIG: Pick<
  IRequestConfig,
  "approvalStatus" | "startTime" | "endTime"
> = {
  approvalStatus: null,
  startTime: null,
  endTime: null,
}

export const TeamTasks: FC = () => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.toLowerCase().startsWith("ar")
  const [filterStore] = useFilter()
  const [activeTab, setActiveTab] = useState<TKeyOfActiveTab>(ACTIVE_TAB.todo)
  // CARE in case of not getting the true tab key when request
  const tabRef = useRef<TKeyOfActiveTab>(activeTab)
  const [dataSource, setDataSource] = useState<TTeamTasks[]>([])
  const [pageInfo, setPage] = usePagination()
  const [members, setMembers] = useState<IMemberSelection[]>([])
  const [statuses, setStatuses] = useState<TStatusSelection[]>([
    { label: t("Content.contentApplications.filters.allStatuses"), value: "" },
  ])
  const [taskStatus, setTaskStatus] = useState<ITaskStatus>(DEFAULT_STATUS)
  const reAssignTaskModalRef = useRef<IReassignTaskModalRef>(null)
  const filterModalRef = useRef<IFilterModalRef>(null)
  const [advancedFiltersByTab, setAdvancedFiltersByTab] = useState<
    Partial<Record<TKeyOfActiveTab, IFilterParams>>
  >({})
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [taskIds, setTaskIds] = useState<string[]>([])
  const contentContext = useContext(ContentContext)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<IStatus[]>(DEFAULT_RESULTS)

  /*--------- promise --------- */

  const getMembers = useCallback(async () => {
    try {
      const mem = await applicationMyTeamMembers()
      setMembers(
        (mem?.data || []).map((item) => ({
          label: item.userName,
          value: item.userId,
        }))
      )
    } catch {
      CustomMessage.error(t("Content.contentApplications.messages.failedToGetTeamMembers"))
    }
  }, [t])

  const exportTodoReview = useCallback(async (): Promise<Blob> => {
    const { userId, time, keyword } = filterStore.getFieldsValue()
    try {
      const blob = await exportMyTeamTodoReview({
        userId: userId || undefined,
        startTime: transformDate(time)[0],
        endTime: transformDate(time)[1],
        keyword: keyword || undefined,
      })
      return blob as unknown as Blob
    } catch (error) {
      CustomMessage.error(t("Content.contentApplications.messages.failedToExportTodoReview"))
      throw error
    }
  }, [filterStore, t])

  const exportCompletedReview = useCallback(async (): Promise<Blob> => {
    const { userId, time, keyword } = filterStore.getFieldsValue()
    try {
      const blob = await exportMyTeamCompletedReview({
        userId: userId || undefined,
        startTime: transformDate(time)[0],
        endTime: transformDate(time)[1],
        keyword: keyword || undefined,
      })
      return blob as unknown as Blob
    } catch (error) {
      CustomMessage.error(t("Content.contentApplications.messages.failedToExportCompletedReview"))
      throw error
    }
  }, [filterStore, t])

  const request = useCallback(async (
    type: TKeyOfActiveTab = "1",
    config: IRequestConfig = {
      sortBy: "submissionTime" as keyof TTeamTasks,
      sortDirection: 1,
      pageIndex: 1,
      pageSize: 10,
    }
  ) => {
    const RequestConfig = {
      [ACTIVE_TAB.todo]: {
        getParams: () => {
          const { status, userId, time, keyword } = filterStore.getFieldsValue()
          const advancedFilters = advancedFiltersByTab[ACTIVE_TAB.todo] || {}
          const reqParams: TTeamReqParams = {
            pageSize: 10,
            pageIndex: 1,
            startTime: transformDate(time)[0],
            endTime: transformDate(time)[1],
            userId: userId || undefined,
            keyword: keyword || undefined,
            processInstanceStatus: status || undefined,
            ...advancedFilters,
            ...config,
          }
          return reqParams
        },
        sendRequest: getMyTeamTodoPageTasks,
      },
      [ACTIVE_TAB.completed]: {
        getParams: () => {
          const { status, userId, time, keyword } = filterStore.getFieldsValue()
          const advancedFilters = advancedFiltersByTab[ACTIVE_TAB.completed] || {}
          const reqParams: TTeamReqParams = {
            pageSize: 10,
            pageIndex: 1,
            startTime: transformDate(time)[0],
            endTime: transformDate(time)[1],
            userId: userId || undefined,
            keyword: keyword || undefined,
            processInstanceStatus: status || undefined,
            ...advancedFilters,
            ...config,
          }
          return reqParams
        },
        sendRequest: getMyTeamCompletedPageTasks,
      },
    }
    setLoading(true)
    try {
      const res = await RequestConfig[type].sendRequest(
        RequestConfig[type].getParams()
      )
      const { pageIndex, pageSize, total } = res?.data?.page || DEFAULT_PAGE_INFO
      const resultlist = (res.data?.approvalStatus || []).map(
        (item: string) => ({
          label: item,
          value: item,
        })
      )
      setResults(resultlist)
      setDataSource(res?.data?.page?.items || [])
      setTaskStatus(res?.data?.statusCount || {})
      const allStatuses = {
        label: t("Content.contentApplications.filters.allStatuses"),
        value: "",
      }
      const newStatuses = [
        allStatuses,
        ...(res?.data?.processInstanceStatus || []).map((item: string) => ({
          label: item,
          value: item,
        })),
      ]
      setStatuses((currentStatuses) => {
        const statusesChanged =
          JSON.stringify(newStatuses) !== JSON.stringify(currentStatuses)
        return statusesChanged ? newStatuses : currentStatuses
      })
      setPage({
        pageIndex,
        pageSize,
        total,
      })
    } catch {
      CustomMessage.error(t("Content.contentApplications.messages.failedToGetTeamMembersTasks"))
    } finally {
      setLoading(false)
    }
  }, [advancedFiltersByTab, filterStore, setPage, t])

  const debouncedRequest = useMemo(
    () => debounce((type: TKeyOfActiveTab) => request(type), 500),
    [request]
  )

  const resetAdvancedFilter = useCallback(() => {
    filterModalRef.current?.clear()
    setAdvancedFiltersByTab((current) => ({
      ...current,
      [activeTab]: undefined,
    }))
    request(activeTab, EMPTY_ADVANCED_FILTER_CONFIG)
  }, [activeTab, request])

  const handleFilterModalSuccess = useCallback(
    (params: IFilterParams) => {
      setAdvancedFiltersByTab((current) => ({
        ...current,
        [activeTab]: params,
      }))
      request(activeTab, params)
    },
    [activeTab, request],
  )

  const handleFilterModalReset = useCallback(() => {
    setAdvancedFiltersByTab((current) => ({
      ...current,
      [activeTab]: undefined,
    }))
    request(activeTab, EMPTY_ADVANCED_FILTER_CONFIG)
  }, [activeTab, request])

  const filterModalApplied = useMemo(() => {
    const params = advancedFiltersByTab[activeTab]
    return Boolean(
      (params?.approvalStatus?.length ?? 0) > 0 ||
        params?.startTime ||
        params?.endTime,
    )
  }, [activeTab, advancedFiltersByTab])

  const hasApplicationNoProfileStar = useMemo(
    () => dataSource.some((record) => record.profileIsVIP),
    [dataSource]
  )

  const columns = useMemo<ColumnType<TTeamTasks>[]>(() => [
    {
      title: t("Content.contentApplications.table.applicationNo"),
      dataIndex: "applicationNumber",
      key: "applicationNumber",
      fixed: "left",
      width: 200,
      render: (text, record) => {
        const urgentFlag = record?.isUrgent ? t("Content.contentApplications.labels.urgent") : undefined
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
      title: t("Content.contentApplications.table.serviceName"),
      dataIndex: isArabic ? "serviceNameAr" : "serviceNameEn",
      width: 240,
      key: "serviceName",
      ellipsis: {
        showTitle: false,
      },
      render: (text: string) => {
        return (
          <Tooltip
            title={text}
            color={"#fff"}
            overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
            placement="topLeft"
          >
            {transformNoValueString(text)}
          </Tooltip>
        )
      },
    },
    {
      title: t("Content.contentApplications.table.serviceCategory"),
      dataIndex: isArabic ? "serviceCategoryNameAr" : "serviceCategoryNameEn",
      key: "serviceCategoryName",
      width: 240,
    },
    {
      title: t("Content.contentApplications.table.type"),
      dataIndex: isArabic ? "serviceTypeNameAr" : "serviceTypeNameEn",
      key: "serviceTypeName",
    },
    {
      title: t("Content.contentApplications.table.status"),
      dataIndex: "status",
      key: "status",
      width: 200,
      render: (text: string | null | undefined, record) => (
        <ContentApplicationStatus
          status={text}
          statusId={record.statusId}
        />
      ),
    },
    {
      title: t("Content.contentApplications.table.sla"),
      dataIndex: "slaDescription",
      key: "slaDescription",
      sorter: true,
      render: (text: string) => {
        return transformNoValueString(text)
      },
    },
    {
      title: t("Content.contentApplications.table.applyFor"),
      dataIndex: isArabic ? "applyForAr" : "applyForEn",
      key: "applyFor",
      width: 240,
      render: (text: string) => {
        return (
          <div className="user-name">
            <span>{text}</span>
          </div>
        )
      },
    },
    {
      title: t("Content.contentApplications.table.assignedTo"),
      dataIndex: "assignedTo",
      key: "assignedTo",
    },
    {
      title: t("Content.contentApplications.table.submissionTime"),
      dataIndex: "submissionTime",
      key: "submissionTime",
      sorter: true,
      render: (text: string) => {
        return moment(text).format("DD/MM/YYYY HH:mm:ss")
      },
    },
    {
      title: t("Content.contentApplications.table.actions"),
      fixed: "right",
      render: (_, record) => {
        if (disableStatus.includes(record?.taskStatus || "")) {
          return "-"
        }
        return (
          <div className="table-actions">
            <PermissionGuard
              permissionCode="Content.Applications.ConfirmReassignTaskModal"
              routePath="/content/ContentApplications"
            >
              <PermissionGuard
                permissionCode="Content.Applications.Reassign"
                routePath="/content/ContentApplications"
              >
                <div
                  className="table-btn"
                  onClick={(e) => {
                    setTaskIds([record.taskId])
                    reAssignTaskModalRef.current?.show()
                    e.stopPropagation()
                  }}
                >
                  {t("Content.contentApplications.actions.reassign")}
                </div>
              </PermissionGuard>
            </PermissionGuard>
          </div>
        )
      },
    },
  ], [hasApplicationNoProfileStar, isArabic, t])

  const tableConfigs = useMemo<TableProps<TTeamTasks>>(() => {
    switch (activeTab) {
      case ACTIVE_TAB.todo: {
        const rowSelection: TableRowSelection<TTeamTasks> = {
          selectedRowKeys,
          onChange: (newSelectedRowKeys: React.Key[]) => {
            setTaskIds(newSelectedRowKeys.map((item) => item.toString()))
            setSelectedRowKeys(newSelectedRowKeys)
          },
          getCheckboxProps(record) {
            return {
              disabled: disableStatus.includes(record?.taskStatus || ""),
            }
          },
        }
        return {
          columns: columns,
          dataSource,
          rowKey: (record: TTeamTasks) => record.taskId,
          rowSelection,
          scroll: { x: 1600 },
          onChange: (pagination, _f, sorter) => {
            const { order = SorterKeys.descend, field } =
              sorter as SorterResult<TTeamTasks>
            request(activeTab, {
              pageSize: pagination.pageSize,
              pageIndex: pagination.current,
              ...transformSorterKeys<TTeamTasks>(
                field as keyof TTeamTasks,
                // default to ascend
                order as typeof SorterKeys.ascend
              ),
            })
          },
        }
      }
      case ACTIVE_TAB.completed: {
        const pickColumnsFromApplicationInfo = <T extends TTeamTasks>(
          target: ColumnType<T>[],
          ignoreTitles: ColumnType<T>["title"][] = [
            t("Content.contentApplications.table.actions"),
            t("Content.contentApplications.table.sla"),
            t("Content.contentApplications.table.assignedTo"),
          ]
        ) => {
          return target.filter((item) => !ignoreTitles.includes(item["title"]))
        }

        return {
          rowKey: (record: TTeamTasks) => record.taskId,
          columns: pickColumnsFromApplicationInfo(columns),
          dataSource,
          onChange: (pagination, _f, sorter) => {
            const { order = SorterKeys.ascend, field } =
              sorter as SorterResult<TTeamTasks>
            request(activeTab, {
              pageSize: pagination.pageSize,
              pageIndex: pagination.current,
              ...transformSorterKeys<TTeamTasks>(
                field as keyof TTeamTasks,
                // default to ascend
                order as typeof SorterKeys.ascend
              ),
            })
          },
        }
      }
    }
  }, [
    activeTab,
    columns,
    dataSource,
    request,
    selectedRowKeys,
    t,
  ])

  const tableFilterConfigs = useMemo(() => {
    switch (activeTab) {
      case ACTIVE_TAB.todo:
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
            label: t("Content.contentApplications.filters.teamMembers"),
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
            label: t("Content.contentApplications.table.status"),
            element: (
              <Select
                key="select-status"
                placeholder={t("CMS.common.placeholders.allStatuses")}
                className="select-style"
                options={statuses}
                allowClear
              />
            ),
          },
          {
            label: t("Content.contentApplications.table.lastUpdatedTime"),
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
            label: t("Content.contentApplications.table.status"),
            element: (
              <Select
                key="select-status"
                placeholder={t("CMS.common.placeholders.allStatuses")}
                className="select-style"
                options={statuses}
                allowClear
              />
            ),
          },
          {
            label: t("Content.contentApplications.table.lastUpdatedTime"),
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
          <div className="filter-area">
            <i />
            <ExportBtn exportCb={exportTodoReview} exportName="TodoReview.csv" />
          </div>
        )
      case ACTIVE_TAB.completed:
        return (
          <div className="filter-area">
            <div className="filter-area-actions">
              <CustomButton
                text={t("serviceConfiguration.filters.filter")}
                variant="outline"
                icon={sortIcon}
                iconPosition="right"
                onClick={() => filterModalRef.current?.show()}
              />
              {filterModalApplied && (
                <CustomButton
                  text={t("common.reset")}
                  variant="outline"
                  onClick={resetAdvancedFilter}
                />
              )}
            </div>
            <ExportBtn
              exportCb={exportCompletedReview}
              exportName="CompletedReview.csv"
            />
          </div>
        )
    }
  }, [
    activeTab,
    filterModalApplied,
    resetAdvancedFilter,
    t,
    exportTodoReview,
    exportCompletedReview,
  ])

  useEffect(() => {
    getMembers()
  }, [getMembers])

  useEffect(() => {
    request(activeTab)
  }, [activeTab, request])

  useEffect(() => {
    return () => {
      debouncedRequest.cancel()
    }
  }, [debouncedRequest])

  useEffect(() => {
    if (activeTab !== ACTIVE_TAB.completed) {
      setAdvancedFiltersByTab((current) => ({
        ...current,
        [ACTIVE_TAB.completed]: undefined,
      }))
      filterModalRef.current?.clear()
    }
  }, [activeTab])

  return (
    <>
      <div className="content-applications__task-summary">
        <TasksPanel status={taskStatus} variant="applicationStatistics" />
      </div>
      <Card className="content-team-tasks">
        <Tabs
          defaultActiveKey={activeTab}
          onChange={(key: string) => {
            setActiveTab(key as TKeyOfActiveTab)
            tabRef.current = key as TKeyOfActiveTab
          }}
        >
          <Tabs.TabPane tab={t("Content.contentApplications.tabs.todo")} key="1" />
          <Tabs.TabPane tab={t("Content.contentApplications.tabs.completed")} key="2" />
        </Tabs>

        <FilterTable
          containerCls="custom-table"
          {...tableConfigs}
          loading={loading}
          filterStore={filterStore}
          tableFilters={tableFilterConfigs}
          responsiveToolbar
          renderSelectionTip={() => {
            return (
              <div className="selection-tip">
                <span>{t("Content.contentApplications.labels.tasksSelected", { count: selectedRowKeys.length })}</span>
                <PermissionGuard
                  permissionCode="Content.Applications.ConfirmReassignTaskModal"
                  routePath="/content/ContentApplications"
                >
                  <CustomButton
                    onClick={() => {
                      reAssignTaskModalRef.current?.show()
                    }}
                    text={t("applications.buttons.reassign")}
                    permissionCode="Content.Applications.Reassign"
                    permissionRoutePath="/content/ContentApplications"
                  />
                </PermissionGuard>
              </div>
            )
          }}
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
            selectedRowKeys.length ? t("Content.contentApplications.labels.selectedCount", { count: selectedRowKeys.length }) : ""
          }
          taskIds={taskIds}
          onOkCb={() => {
            request(activeTab)
            contentContext?.dispatch()
          }}
          ref={reAssignTaskModalRef}
        />
        <FilterModal
          approvalStatus={results}
          ref={filterModalRef}
          onSuccess={handleFilterModalSuccess}
          onReset={handleFilterModalReset}
        />
      </Card>
    </>
  )
}
