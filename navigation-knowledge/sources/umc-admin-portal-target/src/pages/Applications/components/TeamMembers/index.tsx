import Sousuo from "@/assets/icons/Sousuo";
import {
  type CSSProperties,
  type FC,
  useReducer,
  useRef,
  useEffect,
  useState,
} from "react"
import "./index.less"
import {
  DatePicker,
  Divider,
  Input,
  Progress,
  Select,
  Spin,
  Tooltip,
} from "antd"
import { useTranslation } from "react-i18next"
import {
  type IFilter,
  type IAction,
  type IResumeWorkModalRef,
  type IMarkEmgLeaveModalRef,
  type TMomentTuple,
} from "./type"
import moment from "moment"
import { CustomButton, CustomMessage, PermissionGuard } from "@/components/common"
import { QuestionCircleOutlined } from "@ant-design/icons"
import { ResumeWorkModal } from "./ResumeWorkModal"
import { MarkEmgLeaveModal } from "./MarkEmgLeaveModal"
import UserImg from "@/assets/icons/UserImg"
import type { IMemberSelection } from "./type"
import {
  applicationMyTeamMemberTask,
  type IMembersTasksDto,
} from "@/services/application"
import { applicationMyTeamMembers } from "@/services/team"
import { debounce } from "lodash"
import { transformDate } from "@/utils/transform"
import EmptyBox from "@/components/common/EmptyBox/EmptyBox"

const FILTER_STATE = {
  keyword: "",
  range: [moment().add(-7, "day"), moment()] as TMomentTuple,
  member: "",
}

const QUESTIONS_TIPS: Record<string, string> = {
  tasks: "Completed Tasks / Total Assigned Tasks",
  workload: "(Current Assigned Tasks / Task Capacity Limit) × 100%",
  avgDurationDescription:
    "Total Processing Time of All Completed Tasks / Number of Completed Tasks",
  sla: "(Tasks Completed Within SLA Timeframe / Total Completed Tasks) × 100%",
  overdueCount: "The number of tasks exceeding the SLA deadline",
}

/** White tooltip panels need explicit dark text or title is unreadable (AntD 4). */
const HELP_TOOLTIP_OVERLAY_INNER_STYLE: CSSProperties = {
  color: "rgba(0, 0, 0, 0.85)",
  maxWidth: 800,
}

const reducer = (state: IFilter, action: IAction) => {
  switch (action.type) {
    case "update":
      return { ...state, ...action.payload }
    default:
      return state
  }
}

export const TeamMembers: FC = () => {
  const { t } = useTranslation()
  const [filter, dispatch] = useReducer(reducer, FILTER_STATE)
  const [members, setMembers] = useState<IMemberSelection[]>([])
  const [membersTasks, setMembersTasks] = useState<IMembersTasksDto[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [currentMember, setCurrentMember] = useState<string>()
  const resumeWorkModalRef = useRef<IResumeWorkModalRef>(null)
  const markEmgLeaveModalRef = useRef<IMarkEmgLeaveModalRef>(null)

  const renderSearch = () => {
    return (
      <Input
        placeholder={t("common.search")}
        prefix={<Sousuo className="search-icon" />}
        value={filter.keyword}
        allowClear
        onChange={(e) =>
          dispatch({ type: "update", payload: { keyword: e.target.value } })
        }
        className="search-input gap"
      />
    )
  }

  const renderRangePicker = () => {
    return (
      <DatePicker.RangePicker
        defaultValue={FILTER_STATE.range as TMomentTuple}
        placeholder={[t("common.startTime"), t("common.endTime")]}
        format={["DD/MM/YYYY"]}
        className="range-picker"
        onChange={(value) =>
          value &&
          dispatch({
            type: "update",
            payload: { range: value as TMomentTuple },
          })
        }
      />
    )
  }

  const renderSelection = () => {
    return (
      <Select
        placeholder={t("applications.tabs.teamMembers")}
        className="gap"
        options={members}
        allowClear
        onChange={(value: string) =>
          dispatch({
            type: "update",
            payload: { member: value },
          })
        }
      />
    )
  }

  const generateArr = () => {
    const renderResumeWork = (v: IMembersTasksDto) => {
      const description = (v?.briefDescription ?? "").length
        ? `Description: ${v?.briefDescription}`
        : ""
      return (
        <div className="resume-work" key={v.userId}>
          <div className="resume-work-content">
            <p>
              {t("applications.teamMembers.emergencyLeave")}：
              {moment(v.leaveCreatedOn).format("DD/MM/YYYY hh:mm:ss")}
            </p>
            <p>
              <Tooltip
                color="rgba(255, 255, 255, 1)"
                overlayInnerStyle={HELP_TOOLTIP_OVERLAY_INNER_STYLE}
                title={description}
              >
                {t("teamManagement.memberCard.reason")}：{v.leaveTypeNameEn}
              </Tooltip>
            </p>
            <p>
              {t("applications.teamMembers.returnTime")}：
              {moment(v.expectedReturnDate).format("DD/MM/YYYY hh:mm:ss")}
            </p>
          </div>
          <CustomButton
            onClick={() => {
              setCurrentMember(v.userId)
              resumeWorkModalRef.current?.show()
            }}
            text={t("applications.buttons.resumeWork")}
            permissionCode="Licensing.Applications.ResumeWork"
            permissionRoutePath="/licensing/applications"
          />
        </div>
      )
    }

    const renderUserTask = (v: IMembersTasksDto) => {
      const FILTER_SRC = [
        "workload",
        "avgDurationDescription",
        "sla",
        "overdueCount",
      ]
      // data => display
      const filterKeyMap: Record<string, string> = {
        workload: "WorkLoad",
        avgDurationDescription: "Average task duration",
        sla: "SLA",
        overdueCount: "Overdue",
      }
      const dealWithWorkload = {
        ...v,
        workload: `${v.workload}(${v.totalTaskCount}/${v.maxWorkTaskCount})`,
        workloadProgress: (v.totalTaskCount / v.maxWorkTaskCount) * 100,
      }
      const renderTaskItems = (d: string[]) => {
        return d.map((key) => (
          <div className="task-item" key={key}>
            <b
              className={
                key === "overdueCount" && Number(v.overdueCount) > 0
                  ? "warning-txt"
                  : ""
              }
            >
              {dealWithWorkload[key as keyof typeof v]}
            </b>
            <p>
              {filterKeyMap[key]}
              <Tooltip
                title={QUESTIONS_TIPS[key]}
                color="rgba(255, 255, 255, 1)"
                overlayInnerStyle={HELP_TOOLTIP_OVERLAY_INNER_STYLE}
              >
                <QuestionCircleOutlined
                  style={{ marginLeft: "2px", fontSize: "12px" }}
                />
              </Tooltip>
            </p>
            {key === "workload" && (
              <Progress
                className={`workload-progress ${
                  dealWithWorkload["workloadProgress"] >= 100 ? "success" : ""
                }`}
                showInfo={false}
                percent={dealWithWorkload["workloadProgress"]}
              />
            )}
          </div>
        ))
      }

      return renderTaskItems(FILTER_SRC)
    }

    return membersTasks?.map((v) => (
      <div className={v.isLeave ? "user-content leave" : "user-content"}>
        <div className="user-img">
          <UserImg />
        </div>
        <div className="user-information">
          <div className="user-tasks">
            <b>{v.userName}</b>
            <div
              className={
                v.isLeave ? "user-tasks-content flow" : "user-tasks-content"
              }
            >
              <p className="task-title-container">
                <span className="task-title">
                  {t("applications.teamMembers.tasks")}
                </span>
                <Tooltip
                  title={QUESTIONS_TIPS.tasks}
                  color="rgba(255, 255, 255, 1)"
                  overlayInnerStyle={HELP_TOOLTIP_OVERLAY_INNER_STYLE}
                >
                  <QuestionCircleOutlined
                    style={{
                      marginLeft: "2px",
                      fontSize: "12px",
                    }}
                  />
                </Tooltip>
              </p>
              <b>
                {v.completedTaskCount}/{v.totalTaskCount}
              </b>
            </div>
          </div>
          {v?.isLeave && renderResumeWork(v)}
          <Divider
            style={{ margin: "20px 0", color: "rgba(225, 227, 229, 1)" }}
          />
          <div className="user-work">{renderUserTask(v)}</div>
          {!v?.isLeave && (
            <PermissionGuard
              permissionCode="Licensing.Applications.ConfirmMarkEmgLeaveModal"
              routePath="/licensing/applications"
            >
              <div
                className="mark-emg-btn"
                onClick={() => {
                  setCurrentMember(v.userId)
                  markEmgLeaveModalRef.current?.show()
                }}
              >
                {t("applications.buttons.markEmergencyLeave")}
              </div>
            </PermissionGuard>
          )}
        </div>
      </div>
    ))
  }

  /*----------- promise ----------- */

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

  const getMembersTasks = async () => {
    setLoadingTasks(true)
    try {
      const { range, keyword, member } = filter
      const reqParams = {
        memberId: member,
        keyword,
        startTime: transformDate(range)[0],
        endTime: transformDate(range)[1],
      }
      const mem = await applicationMyTeamMemberTask(reqParams)
      setMembersTasks(mem?.data || [])
    } catch (error) {
      CustomMessage.error(t("applications.messages.memberTasksLoadFailed"))
    } finally {
      setLoadingTasks(false)
    }
  }

  useEffect(() => {
    getMembers()
  }, [])

  const debGetMembersTasks = debounce(getMembersTasks, 500)

  // get new tasks when filter changed
  useEffect(() => {
    setLoadingTasks(true)
    debGetMembersTasks()
    return () => {
      debGetMembersTasks.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  return (
    <div className="members-container">
      <Spin spinning={loadingTasks} wrapperClassName="members-spin-wrap">
        <div className="members-filter">
          {/* {renderSearch()} */}
          {renderSelection()}
          {renderRangePicker()}
        </div>
        {!loadingTasks && membersTasks?.length ? (
          <div className="members-content">{generateArr()}</div>
        ) : null}
        {!loadingTasks && !membersTasks?.length ? (
          <EmptyBox customClassName="empty-members" title="" />
        ) : null}
      </Spin>
      <ResumeWorkModal
        userId={currentMember ?? ""}
        ref={resumeWorkModalRef}
        onOkCb={() => void getMembersTasks()}
      />
      <MarkEmgLeaveModal
        onOkCb={() => void getMembersTasks()}
        userId={currentMember ?? ""}
        ref={markEmgLeaveModalRef}
      />
    </div>
  )
}
