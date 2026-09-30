import type { TFunction } from "i18next"
import type { WorkflowActionIntent } from "./workflowActionRouting"

export interface WorkflowActionModalCopy {
  title: string
  tip: string
  notesLabel?: string
  attachmentLabel?: string
  summaryTitle?: string
  summaryItems?: string[]
}

const translate = (
  t: TFunction,
  key: string,
  _fallback?: string
) => {
  void _fallback
  return t(key)
}

export const getApproveApplicationModalCopy = (
  action: number,
  t: TFunction
): WorkflowActionModalCopy => {
  if (action === 2) {
    return {
      title: translate(t, "applications.approvalModals.approve.title", "Approve Application"),
      tip: translate(
        t,
        "applications.approvalModals.approve.conditionalTip",
        "After approval, draft applications for distribution permits will be automatically generated for Approved and Review Required items. Rejected items will require disposition."
      ),
      notesLabel: translate(t, "applications.approvalModals.common.notes", "Notes"),
      attachmentLabel: translate(
        t,
        "applications.approvalModals.common.attachments",
        "Attachments"
      ),
    }
  }

  return {
    title: translate(t, "applications.approvalModals.approve.title", "Approve Application"),
    tip: translate(
      t,
      "applications.approvalModals.approve.defaultTip",
      "Please confirm that all application details are correct. After approval, the application will proceed to the next step if applicable."
    ),
    notesLabel: translate(t, "applications.approvalModals.common.notes", "Notes"),
    attachmentLabel: translate(
      t,
      "applications.approvalModals.common.attachments",
      "Attachments"
    ),
  }
}

export const getRejectApplicationModalCopy = (
  action: number,
  t: TFunction
): WorkflowActionModalCopy => {
  if (action === 102) {
    return {
      title: translate(t, "applications.approvalModals.reject.title", "Reject Application"),
      tip: translate(
        t,
        "applications.approvalModals.reject.routeTip",
        "This rejection applies to this step only. The application will still move to the next review stage."
      ),
      notesLabel: translate(t, "applications.approvalModals.common.notes", "Notes"),
      attachmentLabel: translate(
        t,
        "applications.approvalModals.common.attachments",
        "Attachments"
      ),
    }
  }

  if (action === 101 || action === 103) {
    return {
      title: translate(t, "applications.approvalModals.reject.title", "Reject Application"),
      tip: translate(
        t,
        "applications.approvalModals.reject.materialDispositionTip",
        "Once rejected, all publications in this application will be rejected. The applicant will be required to select a disposition method and submit supporting documentation within 14 days."
      ),
      notesLabel: translate(t, "applications.approvalModals.common.notes", "Notes"),
      attachmentLabel: translate(
        t,
        "applications.approvalModals.common.attachments",
        "Attachments"
      ),
    }
  }

  return {
    title: translate(t, "applications.approvalModals.reject.title", "Reject Application"),
    tip: translate(
      t,
      "applications.approvalModals.reject.defaultTip",
      "Note that after rejection, it will still flow to the next node."
    ),
    notesLabel: translate(t, "applications.approvalModals.common.notes", "Notes"),
    attachmentLabel: translate(
      t,
      "applications.approvalModals.common.attachments",
      "Attachments"
    ),
  }
}

export const getApproveModalCopy = (
  action: number,
  _label: string,
  t: TFunction
) => {
  void _label
  return getApproveApplicationModalCopy(action, t)
}

export const getRejectModalCopy = (
  action: number,
  _label: string,
  t: TFunction
) => {
  void _label
  return getRejectApplicationModalCopy(action, t)
}

export const getDispositionModalCopy = (
  intent: WorkflowActionIntent,
  t: TFunction
): WorkflowActionModalCopy => {
  if (intent === "approve") {
    return {
      title: translate(
        t,
        "applications.approvalModals.disposition.approveTitle",
        "Approve Disposition"
      ),
      tip: translate(
        t,
        "applications.approvalModals.disposition.approveTip",
        "Are you sure you want to approve this disposition? Please ensure all uploaded documents have been verified."
      ),
      notesLabel: translate(
        t,
        "applications.approvalModals.disposition.verificationNotes",
        "Verification Notes"
      ),
      attachmentLabel: translate(
        t,
        "applications.approvalModals.common.attachments",
        "Attachments"
      ),
    }
  }

  return {
    title: translate(
      t,
      "applications.approvalModals.disposition.rejectTitle",
      "Reject Disposition"
    ),
    tip: translate(
      t,
      "applications.approvalModals.disposition.rejectTip",
      "Once rejected, the applicant must resubmit the disposition documents within the remaining timeframe."
    ),
    notesLabel: translate(t, "applications.approvalModals.common.notes", "Notes"),
    attachmentLabel: translate(
      t,
      "applications.approvalModals.common.attachments",
      "Attachments"
    ),
  }
}

export const getMediaMaterialReportTitle = (t: TFunction) =>
  translate(
    t,
    "applications.approvalModals.mediaReport.title",
    "Media Material Report"
  )
