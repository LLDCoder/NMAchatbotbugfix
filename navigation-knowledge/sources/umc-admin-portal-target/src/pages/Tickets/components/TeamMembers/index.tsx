import { type FC, useReducer, useRef, useEffect, useState } from "react"
import "./index.less"
import { DatePicker, Divider, Input, Progress, Select, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import Sousuo from "@/assets/icons/Sousuo";
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
import { type IMembersTasksDto } from "@/services/application"
import { applicationMyTeamMembers } from "@/services/team"
import { debounce } from "lodash"
import EmptyBox from "@/components/common/EmptyBox/EmptyBox"
import { getTeamMenber, type ITeamMenberResponse } from "@/services/tickets"

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
  const [membersTasks, setMembersTasks] = useState<ITeamMenberResponse[]>([])
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
        placeholder={[t("Customer.tickets.placeholders.startTime"), t("Customer.tickets.placeholders.endTime")]}
        className="range-picker"
        format={["DD/MM/YYYY"]}
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
        placeholder={t("Customer.tickets.placeholders.teamMembers")}
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
      return (
        <div className="resume-work" key={v.userId}>
          <div className="resume-work-content">
            <p>
              {t("Customer.tickets.teamMembers.emergencyLeave")}：
              {moment(v.expectedReturnDate).format("DD/MM/YYYY hh:mm:ss")}
            </p>
            <p>{t("Customer.tickets.teamMembers.reason")}：{v.briefDescription}</p>
            <p>
              {t("Customer.tickets.teamMembers.returnTime")}：
              {moment(v.expectedReturnDate).format("DD/MM/YYYY hh:mm:ss")}
            </p>
          </div>
          <CustomButton
            onClick={() => {
              setCurrentMember(v.userId)
              resumeWorkModalRef.current?.show()
            }}
            text={t("applications.buttons.resumeWork")}
            permissionCode="CustomerModule.Tickets.ResumeWork"
            permissionRoutePath="/happiness/tickets"
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
        workload: t("Customer.tickets.teamMembers.workload"),
        avgDurationDescription: t("Customer.tickets.teamMembers.avgTaskDuration"),
        sla: "SLA",
        overdueCount: t("Customer.tickets.teamMembers.overdue"),
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
              <Tooltip title={QUESTIONS_TIPS[key]}>
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
                <span className="task-title">{t("Customer.tickets.teamMembers.tasks")}</span>
                <Tooltip title={QUESTIONS_TIPS.tasks}>
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
            <PermissionGuard permissionCode="CustomerModule.Tickets.ConfirmMarkEmgLeaveModal" routePath="/happiness/tickets">
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

  const renderMemberTasks = () => {
    return membersTasks?.length ? (
      <div className="members-content">{generateArr()}</div>
    ) : (
      <EmptyBox customClassName="empty-members" title={""} />
    )
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
      CustomMessage.error(t("Customer.tickets.messages.failedToGetTeamMembers"))
    }
  }

  const getMembersTasks = async () => {
    try {
      const { range, keyword, member } = filter
      const reqParams = {
        MemberId: member,
        Keyword: keyword,
        StartTime: range[0] ? range[0].format('YYYY-MM-DD') : null,
        EndTime: range[1] ? range[1].format('YYYY-MM-DD') : null,
      }
      const mem = await getTeamMenber(reqParams)
      setMembersTasks(mem?.data || [])
    } catch (error) {
      CustomMessage.error(t("Customer.tickets.messages.failedToGetTeamMembersTasks"))
    }
  }

  useEffect(() => {
    getMembers()
  }, [])

  const debGetMembersTasks = debounce(getMembersTasks, 500)

  // get new tasks when filter changed
  useEffect(() => {
    debGetMembersTasks()
    return () => {
      debGetMembersTasks.cancel()
    }
  }, [filter])

  return (
    <div className="members-container">
      <div className="members-filter">
        {renderSearch()}
        {renderSelection()}
        {renderRangePicker()}
      </div>
      {renderMemberTasks()}
      <ResumeWorkModal
        userId={currentMember ?? ""}
        ref={resumeWorkModalRef}
        onOkCb={() => debGetMembersTasks()}
      />
      <MarkEmgLeaveModal
        onOkCb={() => debGetMembersTasks()}
        userId={currentMember ?? ""}
        ref={markEmgLeaveModalRef}
      />
    </div>
  )
}
