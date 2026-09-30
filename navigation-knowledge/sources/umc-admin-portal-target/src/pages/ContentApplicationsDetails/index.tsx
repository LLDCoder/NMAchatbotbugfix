import { useHistory, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { AIContentCheck } from "./components/AIContentCheck"
import { ApplicationTimeline } from "./components/ApplicationTimeline"
import { Details } from "./components/Details"
import { PublicationPrinting } from "./components/PublicationPrinting"
import "./index.less"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Modal } from "antd"
import {
  type IAIFiles,
  type ITaskDetails,
  type ITimeline,
} from "@/services/content"
import type { ISearchParams, TWhichExpanded } from "./type"
import {
  ApplicationOverviewCards,
  ApplicationOverviewDataProvider,
  CustomFooter,
  CustomMessage,
  useApplicationOverviewFullScreenController,
} from "@/components/common"
import { AuthBtns } from "./components/AuthBtns"
import { ApproveModal } from "../ContentApplications/components/ApproveModal"
import { RejectModal } from "../ContentApplications/components/RejectModal"
import type { IRejectModalRef } from "../ContentApplications/components/RejectModal/type"
import type { IApproveModalRef } from "../ContentApplications/components/ApproveModal/type"
import { approveTask, getReviewTaskDetail } from "@/services/content"
import { RequestModificationModal } from "../ContentApplications/components/RequestModificationModal"
import type { IRequestModalRef } from "../ContentApplications/components/RequestModificationModal/type"
import type { IChangeStatusRef } from "../ContentApplications/components/ChangeStatusModal/type"
import { ChangeStatusModal } from "../ContentApplications/components/ChangeStatusModal"
import type { ISendBackModalRef } from "../ContentApplications/components/SendBackModal/type"
import { SendBackModal } from "../ContentApplications/components/SendBackModal"
import { DispositionDecisionModal } from "../ContentApplications/components/DispositionDecisionModal"
import type { IDispositionDecisionModalRef } from "../ContentApplications/components/DispositionDecisionModal/type"
import { DispositionApproveConfirmModal } from "../ContentApplications/components/DispositionApproveConfirmModal"
import type { IDispositionApproveConfirmModalRef } from "../ContentApplications/components/DispositionApproveConfirmModal/type"
import { MediaMaterialReportModal } from "../ContentApplications/components/MediaMaterialReportModal"
import type { IMediaMaterialReportModalRef } from "../ContentApplications/components/MediaMaterialReportModal/type"
import { ExternalApprovalModal } from "../ContentApplications/components/ExternalApprovalModal"
import type { IExternalApprovalRef } from "../ContentApplications/components/ExternalApprovalModal/type"
import moment from "moment"
import FullScreen from "@/components/common/ApplicationOverviewCards/FullScreen/FullScreen"
import {
  getEstablishment,
  getUserIndividual,
  type IEstablishmentOverview,
  type IUserIndividualProfile,
} from "@/services/userProfile"
import {
  hasExplicitUserTypeId,
  isIndividualUserType,
} from "@/components/common/ApplicationOverviewCards/utils/userType"
import { ExpandContext } from "./context"
import {
  buildWorkflowApprovalPayload,
  resolveTaskWorkflowAction,
  type ResolvedWorkflowAction,
} from "../ContentApplications/utils/workflowActionRouting"
import {
  TeamTaskDetailReassignAction,
  useTeamTaskDetailContext,
} from "@/pages/TeamManagement/components/TeamTaskDetailReassignAction"
import { useServicesStore } from "@/store/services"
import { useContentApplicationReviewStore } from "@/store/content-application-review"
import { PERMISSION_CODES } from "@/constants/permissionCodes"
import {
  getService302MaterialStatusSummary,
  isMaterialStatusRequiredError,
  isService302MaterialStatusTaskReadOnly,
  type Service302MaterialStatusStateChange,
} from "@/utils/service302MaterialStatus"

const CONTENT_APPLICATION_DETAILS_PATH =
  "/content/ContentApplications/ContentApplicationsDetails"

type ContentApplicationsDetailsProps = {
  readOnly?: boolean
}

type DetailsExtra = { userProfileId?: string | number; userTypeId?: number }

type OverviewContentProps = {
  details: ITaskDetails
  timelineList: ITimeline[]
  currentAiResult: string
  effectiveConflictFiles: IAIFiles[]
  whichIsExpanded: TWhichExpanded
  formilyList: unknown[]
  applicant?: IUserIndividualProfile
  establishment?: IEstablishmentOverview
  applicationDetailId?: number
  taskId?: string
  materialStatusEditable: boolean
  onMaterialStatusStateChange: (
    change: Service302MaterialStatusStateChange,
  ) => void
}

const getDetailProfileId = (details: ITaskDetails) =>
  (details as unknown as DetailsExtra)?.userProfileId ?? details?.profileId

const OverviewContent = ({
  details,
  timelineList,
  currentAiResult,
  effectiveConflictFiles,
  whichIsExpanded,
  formilyList,
  applicant,
  establishment,
  applicationDetailId,
  taskId,
  materialStatusEditable,
  onMaterialStatusStateChange,
}: OverviewContentProps) => {
  const overviewFullScreen = useApplicationOverviewFullScreenController()

  if (overviewFullScreen.isFullScreen) {
    return (
      <FullScreen
        type={overviewFullScreen.fullScreenType}
        applicant={applicant}
        establishment={establishment}
        {...overviewFullScreen.fullScreenProps}
      />
    )
  }

  if (whichIsExpanded?.ai) {
    return (
      <div className="collapse-content">
        <AIContentCheck
          aiContent={{
            aiCheckTime:
              timelineList[timelineList.length - 1]?.approvalTime ||
              `${moment()}`,
            aiStatus: details?.aiStatus,
            aiResult: currentAiResult,
          }}
          conflictFiles={effectiveConflictFiles}
        />
      </div>
    )
  }

  return (
    <div className="detail-content">
      <div className="center-item">
        <AIContentCheck
          aiContent={{
            aiCheckTime:
              timelineList[timelineList.length - 1]?.approvalTime ||
              `${moment()}`,
            aiStatus: details?.aiStatus,
            aiResult: currentAiResult,
          }}
          conflictFiles={effectiveConflictFiles}
        />
        <Details
          tableData={formilyList}
          applicationId={details?.id}
          profileId={getDetailProfileId(details)}
          serviceCode={details?.serviceCode}
          applicationDetailId={applicationDetailId}
          taskId={taskId}
          materialStatusEditable={materialStatusEditable}
          onMaterialStatusStateChange={onMaterialStatusStateChange}
        />
      </div>
      <div className="right-side">
        <ApplicationOverviewCards
          profileOverviewDefaultExpanded
          additionalCards={
            <div className="right-item">
              <ApplicationTimeline
                timelineList={timelineList}
                serviceCode={details?.serviceCode}
              />
            </div>
          }
          {...overviewFullScreen.applicationOverviewCardProps}
          currentApplicationNumber={details?.applicationNumber}
          currentServiceId={details?.serviceId}
        />
      </div>
    </div>
  )
}

export default function ContentApplicationsDetails({
  readOnly = false,
}: ContentApplicationsDetailsProps) {
  const { t } = useTranslation()
  const { search, pathname, hash } = useLocation<ISearchParams>()
  const history = useHistory()
  const teamTaskDetailContext = useTeamTaskDetailContext()
  const searchParams = new URLSearchParams(search)
  const taskId = searchParams.get("taskId") || ""
  const effectiveReadOnly =
    readOnly ||
    searchParams.get("readOnly") === "1" ||
    searchParams.get("sourcePage") === "tickets"
  const isContentApplicationsDetailsRoute =
    pathname === CONTENT_APPLICATION_DETAILS_PATH
  const updateServicesCode = useServicesStore(
    (state) => state.updateServicesCode,
  )
  const setIsFirstApprovalRejected = useContentApplicationReviewStore(
    (state) => state.setIsFirstApprovalRejected,
  )
  const resetIsFirstApprovalRejected = useContentApplicationReviewStore(
    (state) => state.resetIsFirstApprovalRejected,
  )
  const [details, setDetails] = useState<ITaskDetails>({} as ITaskDetails)
  const isMaterialStatusTaskReadOnly =
    effectiveReadOnly || isService302MaterialStatusTaskReadOnly(details)
  const [aiRawResponseJson, setAiRawResponseJson] = useState<string>("")
  const [timelineList, setTimeLineList] = useState<ITimeline[]>([])
  const rejectModalRef = useRef<IRejectModalRef>(null)
  const requestModalRef = useRef<IRequestModalRef>(null)
  const approveModalRef = useRef<IApproveModalRef>(null)
  const changeStatusModalRef = useRef<IChangeStatusRef>(null)
  const sendBackModalRef = useRef<ISendBackModalRef>(null)
  const dispositionDecisionModalRef =
    useRef<IDispositionDecisionModalRef>(null)
  const dispositionApproveConfirmModalRef =
    useRef<IDispositionApproveConfirmModalRef>(null)
  const mediaMaterialReportModalRef =
    useRef<IMediaMaterialReportModalRef>(null)
  const externalApprovalModalRef = useRef<IExternalApprovalRef>(null)
  const workflowRefreshTimerRef = useRef<number | null>(null)
  const workflowRefreshSequenceRef = useRef(0)
  const detailRequestSequenceRef = useRef(0)
  const [whichIsExpanded, setWhichIsExpanded] = useState<TWhichExpanded>({
    ai: false,
  })
  const [conflictFiles, setConflictFiles] = useState<IAIFiles[]>([])
  const [applicant, setApplicant] = useState<IUserIndividualProfile>()
  const [establishment, setEstablishment] = useState<IEstablishmentOverview>()

  // ---------promise----------

  const [FormilyList, setFormilyList] = useState<unknown[]>([])
  const [hasLoadedReviewFormData, setHasLoadedReviewFormData] = useState(false)
  const [materialStatusOverrides, setMaterialStatusOverrides] = useState<
    Map<string, boolean>
  >(() => new Map())
  const [savingMaterialStatusKeys, setSavingMaterialStatusKeys] = useState<
    Set<string>
  >(() => new Set())
  const materialStatusSummary = useMemo(
    () => getService302MaterialStatusSummary(FormilyList),
    [FormilyList],
  )
  const hasCompleteMaterialStatuses = useMemo(() => {
    const initiallyAssigned = new Set(
      materialStatusSummary.assignedLocatorKeys,
    )

    return materialStatusSummary.locatorKeys.every((locatorKey) => {
      const override = materialStatusOverrides.get(locatorKey)
      return override === undefined
        ? initiallyAssigned.has(locatorKey)
        : override
    })
  }, [materialStatusOverrides, materialStatusSummary])

  const handleMaterialStatusStateChange = useCallback(
    (change: Service302MaterialStatusStateChange) => {
      setMaterialStatusOverrides((current) => {
        const next = new Map(current)
        next.set(change.locatorKey, change.assigned)
        return next
      })
      setSavingMaterialStatusKeys((current) => {
        const next = new Set(current)
        if (change.saving) {
          next.add(change.locatorKey)
        } else {
          next.delete(change.locatorKey)
        }
        return next
      })
    },
    [],
  )

  const canContinueService302Workflow = useCallback(() => {
    if (Number(details?.serviceCode) !== 302) return true

    if (
      hasLoadedReviewFormData &&
      hasCompleteMaterialStatuses &&
      savingMaterialStatusKeys.size === 0
    ) {
      return true
    }

    CustomMessage.error(
      t("DataList.validation.assignNewspapersMagazinesStatus"),
    )
    return false
  }, [
    details?.serviceCode,
    hasLoadedReviewFormData,
    hasCompleteMaterialStatuses,
    savingMaterialStatusKeys.size,
    t,
  ])

  const getTaskDetail = useCallback(async () => {
    const requestSequence = ++detailRequestSequenceRef.current
    if (!taskId) {
      if (isContentApplicationsDetailsRoute) {
        setIsFirstApprovalRejected(null)
      }
      return
    }

    try {
      setHasLoadedReviewFormData(false)
      const res = await getReviewTaskDetail(taskId)
      if (requestSequence !== detailRequestSequenceRef.current) {
        return
      }
      const responseData = res?.data
      if (isContentApplicationsDetailsRoute) {
        setIsFirstApprovalRejected(responseData?.isFirstApprovalRejected)
      }
      const nextDetails = responseData?.detail || {}
      const normalizedServiceCode = String(nextDetails?.serviceCode ?? "").trim()
      const serviceCodeNum = Number(normalizedServiceCode)
      updateServicesCode(
        normalizedServiceCode && !Number.isNaN(serviceCodeNum)
          ? serviceCodeNum
          : null,
      )
      setAiRawResponseJson(responseData?.aiRawResponseJson || "")
      setDetails(nextDetails)
      // getDataFromJson(res.data?.formData || "")
      const formilyData = JSON.parse(responseData?.formData || "[]")
      if (
        Number(nextDetails?.serviceCode) === 302 &&
        !Array.isArray(formilyData)
      ) {
        throw new Error("Invalid Service 302 review form data")
      }
      setFormilyList(Array.isArray(formilyData) ? formilyData : [])
      setHasLoadedReviewFormData(true)
      setTimeLineList(responseData?.applicationTimeline || [])
      setConflictFiles(responseData?.bookList || [])
    } catch (error) {
      if (requestSequence !== detailRequestSequenceRef.current) {
        return
      }
      if (isContentApplicationsDetailsRoute) {
        setIsFirstApprovalRejected(null)
      }
      setHasLoadedReviewFormData(false)
      CustomMessage.error(error as string)
    }
  }, [
    isContentApplicationsDetailsRoute,
    setIsFirstApprovalRejected,
    taskId,
    updateServicesCode,
  ])
  const replaceTaskIdIfChanged = useCallback(
    (nextTaskId?: string | null) => {
      const normalizedNextTaskId =
        typeof nextTaskId === "string" ? nextTaskId.trim() : ""
      const normalizedCurrentTaskId = taskId.trim()

      if (
        !normalizedNextTaskId ||
        normalizedNextTaskId === normalizedCurrentTaskId
      ) {
        return false
      }

      workflowRefreshSequenceRef.current += 1
      detailRequestSequenceRef.current += 1
      if (workflowRefreshTimerRef.current !== null) {
        window.clearTimeout(workflowRefreshTimerRef.current)
        workflowRefreshTimerRef.current = null
      }

      const nextSearchParams = new URLSearchParams(search)
      nextSearchParams.set("taskId", normalizedNextTaskId)
      history.replace({
        pathname,
        search: nextSearchParams.toString(),
        hash,
      })
      return true
    },
    [hash, history, pathname, search, taskId],
  )
  const refreshTaskDetailAfterWorkflowAction = useCallback(async () => {
    const refreshSequence = ++workflowRefreshSequenceRef.current

    if (workflowRefreshTimerRef.current !== null) {
      window.clearTimeout(workflowRefreshTimerRef.current)
      workflowRefreshTimerRef.current = null
    }

    await getTaskDetail()

    if (refreshSequence !== workflowRefreshSequenceRef.current) {
      return
    }
    workflowRefreshTimerRef.current = window.setTimeout(() => {
      workflowRefreshTimerRef.current = null
      void getTaskDetail()
    }, 500)
  }, [getTaskDetail])
  const handleApproveSuccess = useCallback(
    async (nextTaskId?: string | null) => {
      if (replaceTaskIdIfChanged(nextTaskId)) {
        return
      }

      await refreshTaskDetailAfterWorkflowAction()
    },
    [refreshTaskDetailAfterWorkflowAction, replaceTaskIdIfChanged],
  )

  const getApplicantDetails = async () => {
    try {
      const res = await getUserIndividual(details?.userId)
      setApplicant(res?.data || ({} as IUserIndividualProfile))
    } catch {
      return
    }
  }

  const getEstablishmentDetails = async () => {
    try {
      const res = await getEstablishment(details?.profileId)
      setEstablishment(res?.data || ({} as IEstablishmentOverview))
    } catch {
      return
    }
  }

  const executeDirectAction = (
    action: ResolvedWorkflowAction
  ) => {
    Modal.confirm({
      centered: true,
      title: action.config.label,
      content:
        action.intent === "approve"
          ? t("Content.contentApplicationsDetails.messages.confirmApprove")
          : t("Content.contentApplicationsDetails.messages.confirmReject"),
      okText: t("Content.contentApplicationsDetails.messages.confirm"),
      cancelText: t("Content.contentApplicationsDetails.messages.cancel"),
      onOk: async () => {
        try {
          const response = await approveTask(
            buildWorkflowApprovalPayload(details, action.config),
          )
          CustomMessage.success(
            t("Content.contentApplicationsDetails.messages.updateSuccess"),
          )
          if (replaceTaskIdIfChanged(response?.data?.nextTaskId)) return
          history.goBack()
        } catch (error) {
          console.error("Failed to update content application:", error)
          CustomMessage.error(
            t(
              isMaterialStatusRequiredError(error)
                ? "DataList.validation.assignNewspapersMagazinesStatus"
                : "common.operationFailed",
            ),
          )
          throw error
        }
      },
    })
  }

  const btnsEvent = {
    approve: () => {
      if (!canContinueService302Workflow()) return
      const action = resolveTaskWorkflowAction(details, "approve")
      if (action.route === "directConfirm") {
        executeDirectAction(action)
        return
      }
      if (action.route === "mediaMaterialReportModal") {
        mediaMaterialReportModalRef?.current?.show("approve")
        return
      }
      if (action.route === "externalApproveApplicationModal") {
        approveModalRef?.current?.show()
        return
      }
      if (action.route === "dispositionApproveConfirmModal") {
        dispositionApproveConfirmModalRef?.current?.show()
        return
      }
      if (action.route === "dispositionApproveModal") {
        dispositionDecisionModalRef?.current?.show("approve")
        return
      }

      approveModalRef?.current?.show()
    },
    reject: () => {
      if (!canContinueService302Workflow()) return
      const action = resolveTaskWorkflowAction(details, "reject")
      if (action.route === "directConfirm") {
        executeDirectAction(action)
        return
      }
      if (action.route === "mediaMaterialReportModal") {
        mediaMaterialReportModalRef?.current?.show("reject")
        return
      }
      if (action.route === "externalRejectApplicationModal") {
        rejectModalRef?.current?.show()
        return
      }
      if (action.route === "requestModificationModal") {
        requestModalRef?.current?.show()
        return
      }
      if (action.route === "dispositionRejectModal") {
        dispositionDecisionModalRef?.current?.show("reject")
        return
      }

      rejectModalRef?.current?.show()
    },
    requestModification: () => {
      requestModalRef?.current?.show()
    },
    changeStatus: () => {
      changeStatusModalRef?.current?.show()
    },
    sendBack: () => {
      sendBackModalRef?.current?.show()
    },
    externalApprove: () => {
      externalApprovalModalRef?.current?.show()
    },
  }

  const dispatch = useCallback((whichToCollapse: TWhichExpanded) => {
    // collapse which one to collapse
    setWhichIsExpanded(whichToCollapse)
  }, [])

  useEffect(() => {
    setMaterialStatusOverrides(new Map())
    setSavingMaterialStatusKeys(new Set())
    setHasLoadedReviewFormData(false)
  }, [taskId])

  useEffect(() => {
    getTaskDetail()
  }, [getTaskDetail])

  useEffect(() => {
    return () => {
      workflowRefreshSequenceRef.current += 1
      detailRequestSequenceRef.current += 1
      if (workflowRefreshTimerRef.current !== null) {
        window.clearTimeout(workflowRefreshTimerRef.current)
        workflowRefreshTimerRef.current = null
      }
    }
  }, [taskId])

  useEffect(() => {
    return () => {
      if (isContentApplicationsDetailsRoute) {
        resetIsFirstApprovalRejected()
      }
    }
  }, [isContentApplicationsDetailsRoute, resetIsFirstApprovalRejected])

  useEffect(() => {
    if (details?.userId) {
      getApplicantDetails()
    }
  }, [details?.userId])

  useEffect(() => {
    if (
      details?.profileId &&
      hasExplicitUserTypeId((details as unknown as DetailsExtra)?.userTypeId) &&
      !isIndividualUserType((details as unknown as DetailsExtra)?.userTypeId)
    ) {
      getEstablishmentDetails()
      return
    }

    setEstablishment(undefined)
  }, [details?.profileId, (details as unknown as DetailsExtra)?.userTypeId])

  return (
    <div className="applications-details content-applications-details">
      <PublicationPrinting data={details} />
      <ExpandContext.Provider
        value={{
          whichIsExpanded,
          dispatch,
        }}
      >
        <ApplicationOverviewDataProvider
          userProfileId={getDetailProfileId(details)}
          applicationId={details?.id}
        >
          <OverviewContent
            details={details}
            timelineList={timelineList}
            currentAiResult={aiRawResponseJson}
            effectiveConflictFiles={conflictFiles}
            whichIsExpanded={whichIsExpanded}
            formilyList={FormilyList}
            applicant={applicant}
            establishment={establishment}
            applicationDetailId={details?.applicationDetailId}
            taskId={details?.taskId}
            materialStatusEditable={
              !isMaterialStatusTaskReadOnly &&
              Number(details?.serviceCode) === 302
            }
            onMaterialStatusStateChange={handleMaterialStatusStateChange}
          />
        </ApplicationOverviewDataProvider>
      </ExpandContext.Provider>
      {!effectiveReadOnly && (
        <>
          {teamTaskDetailContext.shouldHideDefaultActions ? (
            <CustomFooter rightContent={<TeamTaskDetailReassignAction />} />
          ) : (
            <AuthBtns details={details} btnsEvent={btnsEvent} />
          )}
          <ApproveModal
            current={details}
            ref={approveModalRef}
            onOkCb={handleApproveSuccess}
          />
          <RejectModal
            current={details}
            ref={rejectModalRef}
            onOkCb={handleApproveSuccess}
          />
          <RequestModificationModal
            current={details}
            ref={requestModalRef}
            onOkCb={handleApproveSuccess}
          />
          <ChangeStatusModal
            ref={changeStatusModalRef}
            onOkCb={refreshTaskDetailAfterWorkflowAction}
          />
          <SendBackModal
            current={details}
            ref={sendBackModalRef}
            onOkCb={refreshTaskDetailAfterWorkflowAction}
            confirmPermissionCode={PERMISSION_CODES.content.applications.sendBack}
            permissionRoutePath="/content/ContentApplications"
          />
          <MediaMaterialReportModal
            current={details}
            ref={mediaMaterialReportModalRef}
            onOkCb={handleApproveSuccess}
          />
          <ExternalApprovalModal
            current={details}
            ref={externalApprovalModalRef}
            type={2}
            onOkCb={(nextTaskId) => {
              if (replaceTaskIdIfChanged(nextTaskId)) return
              history.goBack()
            }}
            confirmPermissionCode={
              PERMISSION_CODES.content.applications.externalApproval
            }
            permissionRoutePath="/content/ContentApplications"
          />
          <DispositionDecisionModal
            current={details}
            ref={dispositionDecisionModalRef}
            onOkCb={refreshTaskDetailAfterWorkflowAction}
          />
          <DispositionApproveConfirmModal
            current={details}
            ref={dispositionApproveConfirmModalRef}
            onOkCb={refreshTaskDetailAfterWorkflowAction}
          />
        </>
      )}
    </div>
  )
}
