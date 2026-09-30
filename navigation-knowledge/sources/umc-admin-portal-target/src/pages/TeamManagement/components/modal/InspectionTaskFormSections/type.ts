import type { ReactNode } from "react"
import type { TargetType } from "@/pages/InspectionTaskManagement/taskConfig"
import type { InspectionTaskAttachmentPayload } from "@/services/inspection"

export type InspectionTaskFormVariant = TargetType | "inspectionCampaign"

export interface SharedSelectOption {
  value: string | number
  label: string
}

export interface TaskRemarksTextAreaProps {
  value?: string
  onChange?: (event: any) => void
  placeholder?: string
}

export interface InspectionTaskFormSectionsProps {
  targetFormType: InspectionTaskFormVariant
  canRenderTargetDetails: boolean
  targetSearchNode: ReactNode
  isReadonlyTarget: boolean
  isLicenseExemptSubtype: boolean
  shouldShowRegion: boolean
  isInspectorSelfCreate: boolean
  authorityLookupLoading: boolean
  campaignActivityLoading: boolean
  campaignEmirateId?: number
  establishmentSubtypeSelectOptions: SharedSelectOption[]
  emirateSelectOptions: SharedSelectOption[]
  authoritySelectOptions: SharedSelectOption[]
  regionSelectOptions: SharedSelectOption[]
  communitySelectOptions: SharedSelectOption[]
  campaignEmirateSelectOptions: SharedSelectOption[]
  campaignAuthoritySelectOptions: SharedSelectOption[]
  campaignActivityOptions: SharedSelectOption[]
  inspectionMethodSelectOptions: SharedSelectOption[]
  taskAttachments: InspectionTaskAttachmentPayload[]
  onTaskAttachmentsChange: (
    attachments: InspectionTaskAttachmentPayload[]
  ) => void
  onAttachmentUploadingChange: (uploading: boolean) => void
  renderCampaignActivityOption: (label: string) => ReactNode
}
