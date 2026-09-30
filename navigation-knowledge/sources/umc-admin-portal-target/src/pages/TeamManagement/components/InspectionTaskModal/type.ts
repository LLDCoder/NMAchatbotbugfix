import type { ReactNode } from "react"
import type { InspectionTargetSearchOption } from "@/services/inspection"
import type { TargetType } from "@/pages/InspectionTaskManagement/taskConfig"
import type { InspectorSelectOption } from "@/pages/InspectionTaskManagement/components/InspectorSelect"
import type { ContactNumberSnapshot } from "@/components/common/MobileNumberInput"

export type InspectionTaskModalRecord = Record<string, any>
export type InspectionTaskModalMode = "create" | "edit" | "duplicate"

export interface InspectionTaskModalMeta {
  inspectionReasonCode: string
  targetType: TargetType
  manualTarget: boolean
  targetSearch: string
  selectedTarget?: InspectionTargetSearchOption | null
  autoMatchedTarget?: InspectionTargetSearchOption | null
}

export interface InspectionTaskDuplicateWarningState {
  visible: boolean
  message: string
  loading: boolean
  onConfirm?: () => void | Promise<void>
}

export interface CampaignActivitySelectOption {
  value: number
  label: string
}

export interface CampaignGeoSelectOption {
  value: number
  label: string
}

export interface InspectionTaskModalProps {
  visible: boolean
  mode: InspectionTaskModalMode
  editingTask?: InspectionTaskModalRecord | null
  isInspectorSelfCreate: boolean
  currentInspectorId: string
  inspectorOptions?: InspectorSelectOption[]
  inspectorOptionsLoading?: boolean
  getAuthorityName: (record?: InspectionTaskModalRecord) => string
  onVisibleChange: (visible: boolean) => void
  onSubmitted: () => void | Promise<void>
}

export interface InspectionTaskModalSectionsProps {
  showTargetTypeSwitch: boolean
  targetTypeContent: ReactNode
  executionTimelineContent: ReactNode
}

export interface StaticSelectOption {
  value: string
  label: string
}

export interface InspectionTaskMobileFormValue {
  mobileCountryCode: string
  mobileLocalNumber: string
  initialSnapshot: ContactNumberSnapshot
}

export interface TaskRemarksTextAreaProps {
  value?: string
  onChange?: (event: any) => void
  placeholder?: string
}
