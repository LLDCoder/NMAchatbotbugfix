import { Modal, Timeline, Tooltip } from "antd"
import moment from "moment"
import LineUser from "@/assets/images/line-user.svg"
import LineDate from "@/assets/images/line-date.svg"
import docIcon from "@/assets/images/fujian.svg"
import ReviewResultIcon from "@/assets/images/ReviewResult.svg"
import RejectionReasonIcon from "@/assets/images/RejectionReason.svg"
import DisposalMethodIcon from "@/assets/images/ReviewResult.svg"
import TimelineToggleIcon from "@/pages/CustomerRefundsDetails/assets/icons/card_header_collapse.svg"
import "./index.less"
import type { FC, ReactNode } from "react"
import React from "react"
import type { TFunction } from "i18next"
import type { ITimeline } from "@/services/content"
import type { IProps } from "./type"
import { sanitizeHtml } from "@/utils/sanitizeHtml"
import { useTranslation } from "react-i18next"
import { useHistory } from "react-router-dom"
import PreviewModal from "@/components/common/PreviewModal"
import CustomMessage from "@/components/common/CustomMessage"
import InspectionAttachmentGrid, {
  type InspectionAttachmentSource,
} from "@/pages/InspectionStartVisit/components/InspectionAttachmentGrid"
import PayPromt from "@/assets/images/PayPromt.svg"
import { getTypeDictionaries } from "@/services/form"
import { downloadDocumentFile } from "@/services/media"
import { isRecallApprovalNode } from "./timelineNode"

const APPROVE_ACTION_CODES = new Set(["1", "2", "3", "4", "5", "6", "201"])
const REJECT_ACTION_CODES = new Set([
  "101",
  "102",
  "103",
  "104",
  "105",
  "106",
  "107",
  "202",
])
const SERVICE_302_CODE = "302"
const INSPECTION_TASK_DETAIL_PATH = "/inspection/tasks/detail"
const SUPERVISOR_REPORT_APPROVE_ACTION_CODES = new Set(["3", "4", "5", "6"])
const SUPERVISOR_REPORT_REJECT_ACTION_CODES = new Set([
  "104",
  "105",
  "106",
  "107",
])
const SUPERVISOR_REPORT_ACTION_CODES = new Set([
  ...SUPERVISOR_REPORT_APPROVE_ACTION_CODES,
  ...SUPERVISOR_REPORT_REJECT_ACTION_CODES,
])
const SUPERVISOR_REPORT_APPROVE_ACTION_NAMES = new Set([
  "bookcontentapproval",
  "cinemavisualmediacontentapproval",
  "videogamecontentapproval",
  "newspapermagazineothermediacontentapproval",
])
const SUPERVISOR_REPORT_REJECT_ACTION_NAMES = new Set([
  "bookcontentrejection",
  "cinemavisualmediacontentrejection",
  "videogamecontentrejection",
  "newspapermagazineothermediacontentrejection",
])
const SUPERVISOR_REPORT_ACTION_NAMES = new Set([
  ...SUPERVISOR_REPORT_APPROVE_ACTION_NAMES,
  ...SUPERVISOR_REPORT_REJECT_ACTION_NAMES,
])

type PreviewFileData = {
  url: string
  name: string
  filePath?: string
}

type TimelineAttachment = {
  name: string
  url: string
}

type TimelineNotesTextProps = {
  text: string
  html?: string
}

type TimelineDetailRowProps = {
  label: string
  value: ReactNode
  className?: string
  iconSrc?: string
  tooltipText?: string
}

type TimelineCommentRowProps = {
  content: ReactNode
  tooltipText: string
}

type TimelineNotesRenderData = {
  content: ReactNode
  tooltipText: string
}

type TimelineScenario =
  | "submitted"
  | "review"
  | "reviewApproved"
  | "reviewRejected"
  | "reviewModification"
  | "reviewExternalApprovalAction"
  | "reviewSendBack"
  | "externalWaiting"
  | "externalResult"
  | "pendingPayment"
  | "paid"
  | "pendingModification"
  | "pendingDisposition"
  | "dispositionSubmitted"
  | "dispositionVerificationApproved"
  | "dispositionVerificationRejected"
  | "aiReview"
  | "autoApproved"
  | "supervisorReport"
  | "completed"
  | "rejectedTerminal"
  | "cancelled"
  | "unknown"

const HIDDEN_ACTOR_NODE_TYPES = new Set(["autoapproved", "autocreated"])

const ACTOR_SCENARIOS = new Set<TimelineScenario>([
  "submitted",
  "review",
  "reviewApproved",
  "reviewRejected",
  "reviewModification",
  "reviewExternalApprovalAction",
  "reviewSendBack",
  "paid",
  "dispositionSubmitted",
  "dispositionVerificationApproved",
  "dispositionVerificationRejected",
  "aiReview",
  "autoApproved",
  "supervisorReport",
  "unknown",
])

const APPROVAL_TIME_SCENARIOS = new Set<TimelineScenario>([
  "submitted",
  "review",
  "reviewApproved",
  "reviewRejected",
  "reviewModification",
  "reviewExternalApprovalAction",
  "reviewSendBack",
  "externalResult",
  "paid",
  "dispositionSubmitted",
  "dispositionVerificationApproved",
  "dispositionVerificationRejected",
  "aiReview",
  "autoApproved",
  "supervisorReport",
  "completed",
  "rejectedTerminal",
  "cancelled",
  "unknown",
])

const REVIEW_SCENARIOS = new Set<TimelineScenario>([
  "review",
  "reviewApproved",
  "reviewRejected",
  "reviewModification",
  "reviewExternalApprovalAction",
  "reviewSendBack",
])

const RESULT_SCENARIOS = new Set<TimelineScenario>([
  "review",
  "reviewApproved",
  "reviewRejected",
  "reviewModification",
  "reviewExternalApprovalAction",
  "reviewSendBack",
  "externalResult",
  "dispositionVerificationApproved",
  "dispositionVerificationRejected",
  "aiReview",
  "autoApproved",
  "supervisorReport",
])

const ATTACHMENT_SCENARIOS = new Set<TimelineScenario>([
  "reviewApproved",
  "reviewRejected",
  "externalResult",
  "dispositionSubmitted",
  "dispositionVerificationRejected",
  "supervisorReport",
])

const PROMPT_SCENARIOS = new Set<TimelineScenario>([
  "pendingPayment",
  "paid",
  "pendingModification",
  "pendingDisposition",
  "autoApproved",
  "completed",
  "rejectedTerminal",
  "cancelled",
])

const CUSTOMER_ROLE_SCENARIOS = new Set<TimelineScenario>([
  "submitted",
  "paid",
  "dispositionSubmitted",
])

const getSafeText = (value: unknown, fallback = "") => {
  if (value === null || value === undefined) {
    return fallback
  }

  const text = String(value).trim()
  return text || fallback
}

const hasText = (value: unknown) => Boolean(getSafeText(value))

const normalizeKey = (value: unknown) =>
  getSafeText(value).replace(/\s+/g, "").toLowerCase()

const normalizeActionKey = (value: unknown) =>
  getSafeText(value).replace(/[^a-z0-9]/gi, "").toLowerCase()

const formatDate = (value?: string | null) => {
  if (!value) {
    return ""
  }

  const date = moment(value)
  return date.isValid() ? date.format("DD/MM/YYYY HH:mm:ss") : ""
}

const splitFileList = (value?: string | null) => {
  if (!value) {
    return []
  }

  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
}

const getFileDisplayName = (fileUrl: string) => {
  const cleanUrl = fileUrl.split("?")[0] || fileUrl
  const name = cleanUrl.split(/[/\\]/).pop() || cleanUrl

  try {
    return decodeURIComponent(name)
  } catch {
    return name
  }
}

const normalizeTimelineAttachment = (
  value: unknown
): TimelineAttachment | null => {
  if (typeof value === "string") {
    const url = getSafeText(value)
    return url ? { name: getFileDisplayName(url), url } : null
  }

  if (!value || typeof value !== "object") {
    return null
  }

  const attachment = value as { fileName?: unknown; key?: unknown }
  const url = getSafeText(attachment.key)
  if (!url) {
    return null
  }

  return {
    name: getSafeText(attachment.fileName) || getFileDisplayName(url),
    url,
  }
}

const uniqueTimelineAttachments = (attachments: TimelineAttachment[]) => {
  const attachmentMap = new Map<string, TimelineAttachment>()
  attachments.forEach((attachment) => {
    if (!attachmentMap.has(attachment.url)) {
      attachmentMap.set(attachment.url, attachment)
    }
  })

  return Array.from(attachmentMap.values())
}

const normalizeTimelineAttachments = (values: unknown[]) =>
  uniqueTimelineAttachments(
    values
      .map((value) => normalizeTimelineAttachment(value))
      .filter((attachment): attachment is TimelineAttachment => Boolean(attachment))
  )

const normalizeAttachments = (item: ITimeline) => {
  return normalizeTimelineAttachments(
    Array.isArray(item.attachments) ? item.attachments : []
  )
}

const isPdfFile = (attachment: TimelineAttachment) => {
  const value = `${attachment.name} ${attachment.url}`.toLowerCase()
  return value.split(/[?#]/)[0].includes(".pdf")
}

const normalizeSupervisorReportAttachments = (
  item: ITimeline,
  allowAttachmentFallback: boolean
) => {
  const obligationLetterAttachments = normalizeTimelineAttachments(
    splitFileList(item.obligationLetterUrl)
  )
  const systemPdfAttachments = normalizeTimelineAttachments([
    ...splitFileList(item.supervisorReportUrl),
    ...splitFileList(item.supervisorReportFile),
    ...splitFileList(item.contentReportPdfFileName),
    ...splitFileList(item.contentReportPdfUrl),
    ...splitFileList(item.mediaMaterialReportUrl),
    ...splitFileList(item.mediaMaterialReportFile),
  ])

  if (systemPdfAttachments.length > 0) {
    return uniqueTimelineAttachments([
      ...systemPdfAttachments,
      ...obligationLetterAttachments,
    ])
  }

  if (!allowAttachmentFallback) {
    return obligationLetterAttachments
  }

  const attachmentPdfFallback = normalizeAttachments(item).filter(isPdfFile)

  return uniqueTimelineAttachments([
    ...attachmentPdfFallback,
    ...obligationLetterAttachments,
  ])
}

const getPositiveNumberText = (value: unknown) => {
  const text = getSafeText(value)
  if (!text) {
    return ""
  }

  const numericValue = Number(text)
  return Number.isFinite(numericValue) && numericValue > 0 ? text : ""
}

const getLocalizedText = (
  isArabic: boolean,
  nameEn?: unknown,
  nameAr?: unknown,
  fallback?: unknown
) => {
  const primary = isArabic ? nameAr : nameEn
  const secondary = isArabic ? nameEn : nameAr
  return getSafeText(primary) || getSafeText(secondary) || getSafeText(fallback)
}

const getDepartmentText = (item: ITimeline, isArabic: boolean) =>
  getLocalizedText(
    isArabic,
    item.serviceConfigDepartmentNameEn,
    item.serviceConfigDepartmentNameAr,
    item.serviceConfigDepartmentName
  ) ||
  getLocalizedText(
    isArabic,
    item.departmentNameEn,
    item.departmentNameAr,
    item.departmentName
  ) ||
  getSafeText(item.department) ||
  getSafeText(item.userRole)

const buildPreviewFileData = (attachment: TimelineAttachment): PreviewFileData => ({
  url: attachment.url,
  name: attachment.name,
  filePath: attachment.url,
})

const getSupervisorReportActionCandidates = (item: ITimeline) => [
  item.approvalResultCode,
  item.workflowAction,
  item.actionCode,
  item.approveAction,
  item.rejectAction,
  item.serviceConfigAction,
  item.approvalAction,
  item.workflowActionLabel,
]

const getSupervisorReportActionResult = (value: unknown) => {
  const actionCode = getSafeText(value)
  if (SUPERVISOR_REPORT_APPROVE_ACTION_CODES.has(actionCode)) {
    return "Approved"
  }
  if (SUPERVISOR_REPORT_REJECT_ACTION_CODES.has(actionCode)) {
    return "Rejected"
  }

  const actionName = normalizeActionKey(value)
  if (SUPERVISOR_REPORT_APPROVE_ACTION_NAMES.has(actionName)) {
    return "Approved"
  }
  if (SUPERVISOR_REPORT_REJECT_ACTION_NAMES.has(actionName)) {
    return "Rejected"
  }

  return ""
}

const getSupervisorReportResult = (item: ITimeline) => {
  for (const action of getSupervisorReportActionCandidates(item)) {
    const result = getSupervisorReportActionResult(action)
    if (result) {
      return result
    }
  }

  return ""
}

const isSupervisorReportAction = (value: unknown) => {
  const actionCode = getSafeText(value)
  if (SUPERVISOR_REPORT_ACTION_CODES.has(actionCode)) {
    return true
  }

  return SUPERVISOR_REPORT_ACTION_NAMES.has(normalizeActionKey(value))
}

const isSupervisorReportActionNode = (item: ITimeline) =>
  getSupervisorReportActionCandidates(item).some(isSupervisorReportAction)

const getApprovalResult = (item: ITimeline) => {
  const result = getSafeText(item.approvalResult)
  if (result) {
    return result
  }

  const code = getSafeText(item.approvalResultCode)
  if (APPROVE_ACTION_CODES.has(code)) {
    return "Approved"
  }
  if (REJECT_ACTION_CODES.has(code)) {
    return "Rejected"
  }
  if (code === "200") {
    return "Request Modification"
  }

  const supervisorReportResult = getSupervisorReportResult(item)
  if (supervisorReportResult) {
    return supervisorReportResult
  }

  return ""
}

const getReasonText = (item: ITimeline, isArabic: boolean) => {
  const primary = isArabic ? item.reasonAr : item.reasonEn
  const secondary = isArabic ? item.reasonEn : item.reasonAr
  return getSafeText(primary) || getSafeText(secondary)
}

const getReasonTextByDictionary = (
  item: ITimeline,
  isArabic: boolean,
  reasonMap: Map<string, string>
) => {
  const rejectReasonCode = getSafeText(item.rejectReasonCode)
  const dictionaryName = rejectReasonCode
    ? reasonMap.get(rejectReasonCode)
    : undefined

  if (dictionaryName) {
    return dictionaryName
  }

  return getReasonText(item, isArabic)
}

const isApprovedResult = (result: string) => {
  const normalizedResult = normalizeKey(result)
  return normalizedResult.includes("approved") || normalizedResult === "approve"
}

const isRejectedResult = (result: string) => {
  const normalizedResult = normalizeKey(result)
  return normalizedResult.includes("rejected") || normalizedResult === "reject"
}

const isDispositionSubmittedNode = (item: ITimeline) =>
  normalizeKey(item.nodeType) === "dispositionsubmitted"

const isInitialApprovalNode = (item: ITimeline) =>
  normalizeKey(item.title) === "initialapproval" ||
  normalizeKey(item.nodeType) === "initialapproval"

const isExternalApprovalNode = (item: ITimeline) =>
  hasText(item.externalOrganization)

const getTimelineServiceCode = (
  item: ITimeline,
  serviceCode?: number | string | null
) => getSafeText(serviceCode) || getSafeText(item.serviceCode)

const isService302TimelineNode = (
  item: ITimeline,
  serviceCode?: number | string | null
) => getTimelineServiceCode(item, serviceCode) === SERVICE_302_CODE

const is302InitialApprovalNode = (
  item: ITimeline,
  serviceCode?: number | string | null
) => isInitialApprovalNode(item) && isService302TimelineNode(item, serviceCode)

const isTruthyFlag = (value: unknown) => {
  if (value === true) {
    return true
  }

  const text = normalizeKey(value)
  return text === "true" || text === "1" || text === "yes"
}

const isSupervisorReportTitleNode = (item: ITimeline) => {
  const titleKey = normalizeKey(item.title)
  const nodeTypeKey = normalizeKey(item.nodeType)
  return (
    titleKey === "supervisorreport" ||
    nodeTypeKey === "supervisorreport" ||
    titleKey.includes("supervisorreport") ||
    nodeTypeKey.includes("supervisorreport")
  )
}

const isSupervisorReportNode = (item: ITimeline) =>
  isSupervisorReportActionNode(item) || isSupervisorReportTitleNode(item)

const isDispositionApproved = (item: ITimeline) =>
  isDispositionSubmittedNode(item) && isApprovedResult(getApprovalResult(item))

const isDispositionRejected = (item: ITimeline) =>
  isDispositionSubmittedNode(item) && isRejectedResult(getApprovalResult(item))

const isDispositionPending = (item: ITimeline) =>
  isDispositionSubmittedNode(item) &&
  !isDispositionApproved(item) &&
  !isDispositionRejected(item)

const isModificationReason = (item: ITimeline) => {
  const result = normalizeKey(getApprovalResult(item))
  const code = getSafeText(item.approvalResultCode)
  return result.includes("requestmodification") || code === "200"
}

const getTimelineScenario = (item: ITimeline): TimelineScenario => {
  const nodeType = normalizeKey(item.nodeType || item.title)
  const approvalResult = getApprovalResult(item)
  const normalizedResult = normalizeKey(approvalResult)
  const isReviewNode = nodeType === "review" || isInitialApprovalNode(item)

  if (isExternalApprovalNode(item)) {
    return approvalResult ? "externalResult" : "externalWaiting"
  }

  if (isSupervisorReportNode(item)) {
    return "supervisorReport"
  }

  if (isReviewNode) {
    if (isApprovedResult(approvalResult)) return "reviewApproved"
    if (isRejectedResult(approvalResult)) return "reviewRejected"
    if (isModificationReason(item)) return "reviewModification"
    if (normalizedResult.includes("externalapproval")) {
      return "reviewExternalApprovalAction"
    }
    if (normalizedResult.includes("sendback")) return "reviewSendBack"
    return "review"
  }

  if (isDispositionSubmittedNode(item)) {
    if (isApprovedResult(approvalResult)) return "dispositionVerificationApproved"
    if (isRejectedResult(approvalResult)) return "dispositionVerificationRejected"
    return "dispositionSubmitted"
  }

  switch (nodeType) {
    case "submitted":
      return "submitted"
    case "pendingpayment":
      return "pendingPayment"
    case "paid":
      return "paid"
    case "pendingmodification":
      return "pendingModification"
    case "pendingdisposition":
      return "pendingDisposition"
    case "aireview":
      return "aiReview"
    case "autoapproved":
      return "autoApproved"
    case "completed":
      return "completed"
    case "rejected":
      return "rejectedTerminal"
    case "cancelled":
      return "cancelled"
    default:
      return "unknown"
  }
}

const shouldRenderActor = (scenario: TimelineScenario, item: ITimeline) => {
  if (!hasText(item.userName)) return false

  return ACTOR_SCENARIOS.has(scenario)
}

const shouldRenderApprovalTime = (
  scenario: TimelineScenario,
  item: ITimeline
) => {
  if (!hasText(item.approvalTime)) return false

  return APPROVAL_TIME_SCENARIOS.has(scenario)
}

const getActorLabelKey = (scenario: TimelineScenario) =>
  scenario === "submitted" ? "submittedBy" : "handledBy"

const DEPARTMENT_SCENARIOS = new Set<TimelineScenario>([
  "review",
  "reviewApproved",
  "reviewRejected",
  "reviewModification",
  "reviewExternalApprovalAction",
  "reviewSendBack",
  "dispositionVerificationApproved",
  "dispositionVerificationRejected",
  "supervisorReport",
])

const shouldRenderDepartment = (
  scenario: TimelineScenario,
  item: ITimeline,
  isArabic: boolean
) =>
  Boolean(
    getDepartmentText(item, isArabic) && DEPARTMENT_SCENARIOS.has(scenario)
  )

const hasRenderableItemStats = (
  item: ITimeline,
  scenario: TimelineScenario,
  serviceCode?: number | string | null
) => {
  if (
    !isService302TimelineNode(item, serviceCode) ||
    (scenario !== "reviewApproved" && scenario !== "reviewRejected")
  ) {
    return false
  }

  if (scenario === "reviewRejected") {
    return Boolean(getPositiveNumberText(item.itemsRejected))
  }

  return Boolean(getPositiveNumberText(item.itemsApproved))
}

const translateWithFallback = (
  t: TFunction,
  key: string,
  fallback: string,
  options?: Record<string, unknown>
): string => String(t(key, { defaultValue: fallback, ...options }))

const getTitle = (item: ITimeline, t: TFunction) => {
  const normalizedTitle = normalizeKey(item.title || item.nodeType)
  if (normalizedTitle === "finalapproval") {
    return translateWithFallback(
      t,
      "Licensing.details.timeline.finalApproval",
      "Final Approval"
    )
  }
  if (isRecallApprovalNode(item)) {
    return String(
      t("Content.contentApplicationsDetails.timeline.nodes.recalledapproval")
    )
  }

  if (isExternalApprovalNode(item)) {
    return String(
      t("Content.contentApplicationsDetails.timeline.nodes.externalapproval")
    )
  }

  if (isDispositionApproved(item) || isDispositionRejected(item)) {
    return translateWithFallback(
      t,
      "Content.contentApplicationsDetails.timeline.nodes.dispositionverification",
      "Disposition Verification"
    )
  }

  if (isDispositionPending(item)) {
    return translateWithFallback(
      t,
      "Content.contentApplicationsDetails.timeline.nodes.dispositionsubmitted",
      "Disposition Submitted"
    )
  }

  if (isSupervisorReportNode(item)) {
    const title = getSafeText(item.title)
    if (title) {
      return title
    }

    return translateWithFallback(
      t,
      "Content.contentApplicationsDetails.timeline.nodes.supervisorreport",
      "Supervisor Report"
    )
  }

  if (isInitialApprovalNode(item)) {
    return translateWithFallback(
      t,
      "Content.contentApplicationsDetails.timeline.nodes.initialapproval",
      "Initial Approval"
    )
  }

  const title = getSafeText(item.title)
  if (title) {
    return title
  }

  return ""
}

const getPrompt = (item: ITimeline, t: TFunction) => {
  const rawPrompt = getSafeText(item.prompt)
  if (!rawPrompt) {
    return ""
  }

  const promptCode = getSafeText(item.promptCode) || getSafeText(item.nodeType)
  const promptKey = normalizeKey(promptCode)
  if (!promptKey) {
    return rawPrompt
  }

  return translateWithFallback(
    t,
    `Content.contentApplicationsDetails.timeline.prompts.${promptKey}`,
    rawPrompt
  )
}

const getResultClassName = (result: string) => {
  const normalizedResult = normalizeKey(result)
  if (isApprovedResult(result)) {
    return "is-approved"
  }
  if (isRejectedResult(result)) {
    return "is-rejected"
  }
  if (
    normalizedResult.includes("modification") ||
    normalizedResult.includes("externalapproval")
  ) {
    return "is-warning"
  }
  if (normalizedResult.includes("sendback")) {
    return "is-neutral"
  }
  return ""
}

const isHtmlText = (value: string) => /<[a-z][\s\S]*>/i.test(value)

const getPlainTextFromHtml = (html: string) => {
  if (!html) {
    return ""
  }

  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  }

  const element = document.createElement("div")
  element.innerHTML = html
  return (element.textContent || element.innerText || "").replace(/\s+/g, " ").trim()
}

const TimelineDetailRow: FC<TimelineDetailRowProps> = ({
  label,
  value,
  className,
  iconSrc,
  tooltipText,
}) => {
  const rowRef = React.useRef<HTMLDivElement | null>(null)
  const [isOverflowing, setIsOverflowing] = React.useState(false)
  const valueTooltipText =
    getSafeText(tooltipText) ||
    (typeof value === "string" ? getSafeText(value) : "")
  const rowTooltipText = valueTooltipText
    ? `${label}: ${valueTooltipText}`
    : ""

  const checkOverflow = React.useCallback(() => {
    const element = rowRef.current
    if (!element || !rowTooltipText) {
      setIsOverflowing(false)
      return
    }

    const hasVerticalOverflow = element.scrollHeight > element.clientHeight + 1
    setIsOverflowing(hasVerticalOverflow)
  }, [rowTooltipText])

  React.useLayoutEffect(() => {
    checkOverflow()

    const element = rowRef.current
    if (!element || typeof window === "undefined") {
      return undefined
    }

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(checkOverflow)
      resizeObserver.observe(element)
      return () => resizeObserver.disconnect()
    }

    window.addEventListener("resize", checkOverflow)
    return () => window.removeEventListener("resize", checkOverflow)
  }, [checkOverflow, value])

  const content = (
    <div
      className={["timeline-detail-row", className].filter(Boolean).join(" ")}
    >
      {iconSrc && <img src={iconSrc} alt="" className="timeline-detail-icon" />}
      <div ref={rowRef} className="timeline-detail-content">
        <span className="timeline-detail-label">{label}:</span>
        <span className="timeline-detail-value">{value}</span>
      </div>
    </div>
  )

  return isOverflowing && rowTooltipText ? (
    <Tooltip
      title={rowTooltipText}
      overlayClassName="content-application-timeline__tooltip"
      getPopupContainer={() => document.body}
    >
      {content}
    </Tooltip>
  ) : (
    content
  )
}

const TimelineNotesText: FC<TimelineNotesTextProps> = ({ text, html }) => {
  const shouldRenderHtml = Boolean(html)

  return shouldRenderHtml ? (
    <span
      className="timeline-notes-text"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  ) : (
    <span className="timeline-notes-text">{text}</span>
  )
}

const TimelineCommentRow: FC<TimelineCommentRowProps> = ({
  content,
  tooltipText,
}) => {
  const rowRef = React.useRef<HTMLDivElement | null>(null)
  const [isOverflowing, setIsOverflowing] = React.useState(false)
  const rowTooltipText = getSafeText(tooltipText)

  const checkOverflow = React.useCallback(() => {
    const element = rowRef.current
    if (!element || !rowTooltipText) {
      setIsOverflowing(false)
      return
    }

    const hasVerticalOverflow = element.scrollHeight > element.clientHeight + 1
    setIsOverflowing(hasVerticalOverflow)
  }, [rowTooltipText])

  React.useLayoutEffect(() => {
    checkOverflow()

    const element = rowRef.current
    if (!element || typeof window === "undefined") {
      return undefined
    }

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(checkOverflow)
      resizeObserver.observe(element)
      return () => resizeObserver.disconnect()
    }

    window.addEventListener("resize", checkOverflow)
    return () => window.removeEventListener("resize", checkOverflow)
  }, [checkOverflow, content])

  const row = (
    <div ref={rowRef} className="timeline-comment-row">
      {content}
    </div>
  )

  return isOverflowing && rowTooltipText ? (
    <Tooltip
      title={rowTooltipText}
      overlayClassName="content-application-timeline__tooltip"
      getPopupContainer={() => document.body}
    >
      {row}
    </Tooltip>
  ) : (
    row
  )
}

export const ApplicationTimeline: FC<IProps> = React.memo((props) => {
  const { t, i18n } = useTranslation()
  const history = useHistory()
  const isArabic = i18n.language?.toLowerCase().startsWith("ar")
  const { timelineList, serviceCode } = props
  const safeTimelineList = Array.isArray(timelineList) ? timelineList : []
  const [selectedAttachments, setSelectedAttachments] = React.useState<
    TimelineAttachment[]
  >([])
  const [previewFileData, setPreviewFileData] =
    React.useState<PreviewFileData | null>(null)
  const [rejectDispositionReasonMap, setRejectDispositionReasonMap] =
    React.useState<Map<string, string>>(() => new Map())
  // Content and Licensing both mount this timeline and want it open on arrival;
  // Inspection has its own timeline components and is unaffected.
  const [isTimelineExpanded, setIsTimelineExpanded] = React.useState(true)

  const labels = React.useMemo(
    () => ({
      attachmentList: translateWithFallback(
        t,
        "Customer.customerRefundsDetails.attachmentList.title",
        "Attachment List"
      ),
      attachments: String(t("Content.contentLibrary.modals.attachments")),
      customer: translateWithFallback(
        t,
        "Content.contentApplicationsDetails.timeline.customer",
        "Customer"
      ),
      department: translateWithFallback(
        t,
        "Content.contentApplicationsDetails.timeline.department",
        "Department"
      ),
      disposalMethod: translateWithFallback(
        t,
        "Content.contentApplicationsDetails.timeline.disposalMethod",
        "Disposal Method"
      ),
      externalOrganization: translateWithFallback(
        t,
        "Content.contentApplicationsDetails.timeline.externalOrganization",
        "External Organization"
      ),
      handledBy: translateWithFallback(
        t,
        "Content.contentApplicationsDetails.timeline.handledBy",
        "Handled by"
      ),
      submittedBy: translateWithFallback(
        t,
        "Content.contentApplicationsDetails.timeline.submittedBy",
        "Submitted by"
      ),
      inspectionTaskNo: translateWithFallback(
        t,
        "Content.contentApplicationsDetails.timeline.inspectionTaskNo",
        "Task No."
      ),
      modificationReason: translateWithFallback(
        t,
        "Content.contentApplicationsDetails.timeline.modificationReason",
        "Modification Reason"
      ),
      customerRemark: translateWithFallback(
        t,
        "Content.contentApplicationsDetails.timeline.customerRemark",
        "Customer Remark"
      ),
      reason: translateWithFallback(
        t,
        "Content.contentApplicationsDetails.timeline.rejectionReason",
        "Rejection Reason"
      ),
      recallReason: translateWithFallback(
        t,
        "applications.recallApproval.reason",
        "Recall Reason"
      ),
      remark: translateWithFallback(
        t,
        "Content.contentApplicationsDetails.timeline.remark",
        "Remark"
      ),
      reviewResult: translateWithFallback(
        t,
        "Content.contentApplicationsDetails.timeline.reviewResult",
        "Review Result"
      ),
    }),
    [t]
  )

  React.useEffect(() => {
    let isActive = true

    getTypeDictionaries("RejectDispositionReason")
      .then((res) => {
        if (!isActive) {
          return
        }

        const nextReasonMap = new Map<string, string>()
        const reasonList = Array.isArray(res?.data) ? res.data : []

        reasonList.forEach((item) => {
          const code =
            item?.code === null || item?.code === undefined
              ? ""
              : String(item.code).trim()
          const nameEn =
            typeof item?.nameEn === "string" ? item.nameEn.trim() : ""
          const nameAr =
            typeof item?.nameAr === "string" ? item.nameAr.trim() : ""
          const label = isArabic ? nameAr || nameEn : nameEn || nameAr

          if (code && label) {
            nextReasonMap.set(code, label)
          }
        })

        setRejectDispositionReasonMap(nextReasonMap)
      })
      .catch((error) => {
        if (!isActive) {
          return
        }

        console.error("Load reject disposition reasons failed:", error)
        setRejectDispositionReasonMap(new Map())
      })

    return () => {
      isActive = false
    }
  }, [isArabic])

  const handleDocumentDownload = React.useCallback(
    async (fileReference: string, fileName: string) => {
      if (!fileReference) {
        CustomMessage.error(t("common.downloadFailed"))
        return
      }

      try {
        await downloadDocumentFile(fileReference, fileName || "download")
      } catch (error) {
        console.error("Download timeline attachment failed:", error)
        CustomMessage.error(t("common.downloadFailed"))
      }
    },
    [t]
  )

  const handleAttachmentDownload = React.useCallback(
    (attachment: InspectionAttachmentSource) => {
      const fileReference = getSafeText(attachment.fileUrl) || getSafeText(attachment.url)
      const fileName =
        getSafeText(attachment.fileName) ||
        getSafeText(attachment.name) ||
        getFileDisplayName(fileReference)

      void handleDocumentDownload(fileReference, fileName)
    },
    [handleDocumentDownload]
  )

  const handlePreviewDownload = React.useCallback(
    (fileData: PreviewFileData) => {
      void handleDocumentDownload(
        getSafeText(fileData.filePath) || getSafeText(fileData.url),
        fileData.name
      )
    },
    [handleDocumentDownload]
  )

  const openAttachment = (attachments: TimelineAttachment[]) => {
    if (attachments.length === 1) {
      setPreviewFileData(buildPreviewFileData(attachments[0]))
      return
    }

    if (attachments.length > 1) {
      setSelectedAttachments(attachments)
    }
  }

  const renderExpandableText = (value?: string | null) => {
    const text = getSafeText(value)
    if (!text) {
      return null
    }

    return <span className="timeline-long-text">{text}</span>
  }

  const renderNotesText = (
    value?: string | null
  ): TimelineNotesRenderData | null => {
    const text = getSafeText(value)
    if (!text) {
      return null
    }

    const shouldRenderHtml = isHtmlText(text)
    const sanitizedHtml = shouldRenderHtml ? sanitizeHtml(text) : ""
    const tooltipText = shouldRenderHtml
      ? getPlainTextFromHtml(sanitizedHtml)
      : text

    if (!tooltipText) {
      return null
    }

    return {
      content: (
        <TimelineNotesText
          text={text}
          html={shouldRenderHtml ? sanitizedHtml : undefined}
        />
      ),
      tooltipText,
    }
  }

  const renderDetailRow = (
    label: string,
    value: ReactNode,
    className?: string,
    iconSrc?: string,
    tooltipText?: string
  ) => {
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && !value.trim())
    ) {
      return null
    }

    return (
      <TimelineDetailRow
        label={label}
        value={value}
        className={className}
        iconSrc={iconSrc}
        tooltipText={tooltipText}
      />
    )
  }

  const renderActorRow = (item: ITimeline, scenario: TimelineScenario) => {
    if (HIDDEN_ACTOR_NODE_TYPES.has(normalizeKey(item.nodeType))) {
      return null
    }

    if (!shouldRenderActor(scenario, item)) {
      return null
    }

    const isExternalOrganizationScenario =
      scenario === "externalWaiting" || scenario === "externalResult"
    const label = isExternalOrganizationScenario
      ? labels.externalOrganization
      : getActorLabelKey(scenario) === "submittedBy"
        ? labels.submittedBy
        : labels.handledBy
    const value = getSafeText(item.userName)

    return (
      <div className="info-item">
        <img src={LineUser} alt="" />
        <span>
          {label}: {value}
        </span>
      </div>
    )
  }

  const renderCustomerRoleTag = (scenario: TimelineScenario) => {
    if (!CUSTOMER_ROLE_SCENARIOS.has(scenario)) {
      return null
    }

    return <div className="timeline-role-tag">{labels.customer}</div>
  }

  const renderExternalOrganizationRow = (
    item: ITimeline,
    scenario: TimelineScenario
  ) => {
    if (
      scenario !== "externalWaiting" &&
      scenario !== "externalResult"
    ) {
      return null
    }

    const externalOrganization = getSafeText(item.externalOrganization)
    if (!externalOrganization) {
      return null
    }

    return (
      <div className="info-item">
        <img src={LineUser} alt="" />
        <span>
          {labels.externalOrganization}: {externalOrganization}
        </span>
      </div>
    )
  }

  const renderDepartmentRow = (
    item: ITimeline,
    scenario: TimelineScenario
  ) => {
    if (!shouldRenderDepartment(scenario, item, isArabic)) {
      return null
    }

    return (
      <div className="timeline-role-tag">
        {getDepartmentText(item, isArabic)}
      </div>
    )
  }

  const renderApprovalTimeRow = (
    item: ITimeline,
    scenario: TimelineScenario
  ) => {
    if (!shouldRenderApprovalTime(scenario, item)) {
      return null
    }

    const formattedDate = formatDate(item.approvalTime)
    if (!formattedDate) {
      return null
    }

    return (
      <div className="info-item">
        <img src={LineDate} alt="" />
        <span>{formattedDate}</span>
      </div>
    )
  }

  const openInspectionTask = (item: ITimeline) => {
    const taskNo = getSafeText(item.inspectionTaskNo)
    if (!taskNo) {
      return
    }

    const taskId =
      getSafeText(item.inspectionTaskId) || getSafeText(item.taskId)
    const searchParams = new URLSearchParams()
    searchParams.set("from", "tasks")
    if (taskId) {
      searchParams.set("taskId", taskId)
    }
    searchParams.set("taskNo", taskNo)

    history.push(`${INSPECTION_TASK_DETAIL_PATH}?${searchParams.toString()}`)
  }

  const renderInspectionTaskNo = (item: ITimeline) => {
    const taskNo = getSafeText(item.inspectionTaskNo)
    if (!taskNo) {
      return null
    }

    return (
      <button
        type="button"
        className="timeline-link-button"
        onClick={() => openInspectionTask(item)}
      >
        {taskNo}
      </button>
    )
  }

  const renderPrompt = (prompt: string) => {
    if (!prompt) {
      return null
    }

    return (
      <div className="timeline-prompt">
        <img src={PayPromt} alt="" className="timeline-prompt-icon" />
        <span>{prompt}</span>
      </div>
    )
  }

  const renderItemStats = (
    item: ITimeline,
    scenario: TimelineScenario,
    serviceCode?: number | string | null
  ) => {
    const approved = getPositiveNumberText(item.itemsApproved)
    const rejected = getPositiveNumberText(item.itemsRejected)

    if (!hasRenderableItemStats(item, scenario, serviceCode)) {
      return null
    }

    const stats = [
      scenario !== "reviewRejected" && approved
        ? {
            key: "approved",
            className: "is-approved",
            text: translateWithFallback(
              t,
              "Content.contentApplicationsDetails.timeline.itemsApproved",
              `${approved} items approved`,
              { count: Number(approved), value: approved }
            ),
          }
        : null,
      rejected
        ? {
            key: "rejected",
            className: "is-rejected",
            text: translateWithFallback(
              t,
              "Content.contentApplicationsDetails.timeline.itemsRejected",
              `${rejected} items rejected`,
              { count: Number(rejected), value: rejected }
            ),
          }
        : null,
    ].filter(
      (
        stat
      ): stat is { key: string; className: string; text: string } =>
        Boolean(stat)
    )

    return (
      <div className="timeline-item-stats">
        {stats.map((stat, index) => (
          <React.Fragment key={stat.key}>
            {index > 0 && (
              <span className="timeline-item-stat-separator">  </span>
            )}
            <span className={["timeline-item-stat", stat.className].join(" ")}>
              {stat.text}
            </span>
          </React.Fragment>
        ))}
      </div>
    )
  }

  const renderAttachments = (attachments: TimelineAttachment[]) => {
    if (attachments.length === 0) {
      return null
    }

    return (
      <button
        type="button"
        className="timeline-attachments"
        onClick={() => openAttachment(attachments)}
      >
        <span className="attach-title">
          <img src={docIcon} alt="" />
          <span className="title-text">{labels.attachments}</span>
        </span>
        <span className="attach-value">{attachments.length}</span>
      </button>
    )
  }

  const renderInlineAttachments = (attachments: TimelineAttachment[]) => (
    <div className="timeline-single-certificate">
      <InspectionAttachmentGrid
        attachments={attachments.map((attachment) => ({
          fileName: attachment.name,
          fileUrl: attachment.url,
        }))}
        onDownload={handleAttachmentDownload}
        className="content-application-timeline__single-certificate inspection-attachment-grid--single"
        compact
      />
    </div>
  )

  const renderNodeDetails = (item: ITimeline) => {
    const scenario = getTimelineScenario(item)
    const is302ServiceNode = isService302TimelineNode(item, serviceCode)
    const is302InitialApproval =
      scenario !== "supervisorReport" &&
      is302InitialApprovalNode(item, serviceCode)
    const isSupervisorReportByAction =
      scenario === "supervisorReport" && isSupervisorReportActionNode(item)
    const supervisorReportResult =
      scenario === "supervisorReport" ? getSupervisorReportResult(item) : ""
    const approvalResult = supervisorReportResult || getApprovalResult(item)
    const reasonText =
      scenario === "externalResult"
        ? getReasonText(item, isArabic)
        : getReasonTextByDictionary(
            item,
            isArabic,
            rejectDispositionReasonMap
          )
    const prompt = (() => {
      if (scenario === "externalWaiting") {
        return getSafeText(item.prompt)
      }

      if (PROMPT_SCENARIOS.has(scenario)) {
        return getPrompt(item, t)
      }

      return ""
    })()
    const shouldRenderReviewResult = Boolean(
      approvalResult && RESULT_SCENARIOS.has(scenario)
    )
    const shouldRenderTerminalReason =
      scenario === "rejectedTerminal" &&
      is302ServiceNode &&
      isTruthyFlag(item.terminalReasonVisible)
    const shouldRenderReason =
      Boolean(reasonText) &&
      (scenario === "reviewRejected" ||
        scenario === "reviewModification" ||
        (scenario === "externalResult" && isRejectedResult(approvalResult)) ||
        scenario === "dispositionVerificationRejected" ||
        shouldRenderTerminalReason)
    const shouldUseModificationLabel = scenario === "reviewModification"
    const shouldRenderRecallReason =
      isRecallApprovalNode(item) && hasText(item.approvalComment)
    const shouldRenderRemark =
      hasText(item.approvalComment) &&
      !shouldRenderRecallReason &&
      is302InitialApproval &&
      (scenario === "reviewApproved" || scenario === "reviewRejected")
    const shouldRenderNotes =
      hasText(item.approvalComment) &&
      !shouldRenderRecallReason &&
      !shouldRenderRemark &&
      (REVIEW_SCENARIOS.has(scenario) ||
        scenario === "externalResult" ||
        scenario === "pendingDisposition")
    const shouldRenderCustomerComment =
      hasText(item.customerComment) &&
      (scenario === "dispositionSubmitted" ||
        scenario === "dispositionVerificationRejected")
    const approvalCommentData =
      shouldRenderRecallReason || shouldRenderNotes || shouldRenderRemark
        ? renderNotesText(item.approvalComment)
        : null
    const customerCommentData = shouldRenderCustomerComment
      ? renderNotesText(item.customerComment)
      : null
    const shouldRenderInspectionTask =
      hasText(item.inspectionTaskNo) &&
      is302ServiceNode &&
      isTruthyFlag(item.autoCreatedInspectionTask) &&
      (scenario === "completed" || scenario === "rejectedTerminal")
    const shouldRenderDisposalMethod = scenario === "dispositionSubmitted"
    const shouldRenderStats = hasRenderableItemStats(
      item,
      scenario,
      serviceCode
    )
    const attachments =
      scenario === "supervisorReport"
        ? normalizeSupervisorReportAttachments(item, isSupervisorReportByAction)
        : normalizeAttachments(item)
    const shouldRenderAttachments = ATTACHMENT_SCENARIOS.has(scenario)
    const shouldRenderInlineAttachments =
      shouldRenderAttachments && attachments.length > 0 && attachments.length < 3
    const shouldRenderAttachmentButton =
      shouldRenderAttachments && attachments.length >= 3

    return (
      <>
        {shouldRenderReviewResult &&
          renderDetailRow(
            labels.reviewResult,
            <span
              className={[
                "timeline-result",
                getResultClassName(approvalResult),
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {approvalResult}
            </span>,
            undefined,
            ReviewResultIcon,
            approvalResult
          )}
        {renderPrompt(prompt)}
        {shouldRenderReason &&
          renderDetailRow(
            shouldUseModificationLabel
              ? labels.modificationReason
              : labels.reason,
            renderExpandableText(reasonText),
            "content-application-timeline__reason-row",
            RejectionReasonIcon,
            reasonText
          )}
        {shouldRenderRecallReason &&
          approvalCommentData &&
          renderDetailRow(
            labels.recallReason,
            approvalCommentData.content,
            "content-application-timeline__recall-reason-row",
            RejectionReasonIcon,
            approvalCommentData.tooltipText
          )}
        {shouldRenderRemark &&
          approvalCommentData &&
          renderDetailRow(
            labels.remark,
            approvalCommentData.content,
            undefined,
            undefined,
            approvalCommentData.tooltipText
          )}
        {shouldRenderNotes && approvalCommentData && (
          <TimelineCommentRow
            content={approvalCommentData.content}
            tooltipText={approvalCommentData.tooltipText}
          />
        )}
        {customerCommentData &&
          renderDetailRow(
            labels.customerRemark,
            customerCommentData.content,
            undefined,
            undefined,
            customerCommentData.tooltipText
          )}
        {shouldRenderDisposalMethod &&
          renderDetailRow(
            labels.disposalMethod,
            getSafeText(item.disposalMethod),
            "timeline-disposal-method",
            DisposalMethodIcon
          )}
        {shouldRenderStats && renderItemStats(item, scenario, serviceCode)}
        {shouldRenderInlineAttachments && renderInlineAttachments(attachments)}
        {shouldRenderAttachmentButton && renderAttachments(attachments)}
        {shouldRenderInspectionTask &&
          renderDetailRow(
            labels.inspectionTaskNo,
            renderInspectionTaskNo(item),
            undefined,
            undefined,
            getSafeText(item.inspectionTaskNo)
          )}
      </>
    )
  }

  return (
    <div className="timeline-card timeline-card--sidebar">
      <button
        type="button"
        className="content-application-timeline__header"
        aria-expanded={isTimelineExpanded}
        aria-label={
          isTimelineExpanded
            ? t("Content.contentApplicationsDetails.timeline.collapse")
            : t("Content.contentApplicationsDetails.timeline.expand")
        }
        onClick={() => setIsTimelineExpanded((expanded) => !expanded)}
      >
        <span className="timeline-title-top">
          {t("Content.contentApplicationsDetails.timeline.title")}
        </span>
        <span
          className={`content-application-timeline__toggle${
            isTimelineExpanded
              ? " content-application-timeline__toggle--expanded"
              : ""
          }`}
          aria-hidden="true"
        >
          <img
            src={TimelineToggleIcon}
            alt=""
            className="content-application-timeline__toggle-icon"
          />
        </span>
      </button>
      {isTimelineExpanded ? (
        <div className="content-application-timeline__content">
          <Timeline className="custom-timeline">
            {safeTimelineList.map((item, i) => {
              const scenario = getTimelineScenario(item)
              const title = getTitle(item, t)
              const itemKey = [
                item.nodeType,
                item.title,
                item.approvalTime,
                i,
              ].map((value) => getSafeText(value)).join("-")

              return (
                <Timeline.Item
                  key={itemKey || String(i)}
                  dot={
                    <div
                      className={
                        i === 0
                          ? "active-dot"
                          : "normal-dot"
                      }
                    ></div>
                  }
                >
                  {title && <div className="timeline-title">{title}</div>}
                  <div className="info-content">
                    {renderActorRow(item, scenario)}
                    {renderCustomerRoleTag(scenario)}
                    {renderDepartmentRow(item, scenario)}
                    {renderExternalOrganizationRow(item, scenario)}
                    {renderApprovalTimeRow(item, scenario)}
                    {renderNodeDetails(item)}
                  </div>
                </Timeline.Item>
              )
            })}
          </Timeline>
        </div>
      ) : null}
      <Modal
        visible={selectedAttachments.length > 0}
        title={labels.attachmentList}
        onCancel={() => setSelectedAttachments([])}
        footer={null}
        width={960}
        centered
        destroyOnClose
        className="content-application-timeline__attachments-modal"
      >
        <InspectionAttachmentGrid
          attachments={selectedAttachments.map((attachment) => ({
            fileName: attachment.name,
            fileUrl: attachment.url,
          }))}
          onDownload={handleAttachmentDownload}
          className="content-application-timeline__attachments-grid inspection-attachment-grid--two-columns"
        />
      </Modal>
      {previewFileData && (
        <PreviewModal
          visible={Boolean(previewFileData)}
          fileData={previewFileData}
          onCancel={() => setPreviewFileData(null)}
          onDownload={handlePreviewDownload}
        />
      )}
    </div>
  )
})
