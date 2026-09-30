import type { IApplicationInfo } from "@/store/app-store"
import type { WorkflowActionIntent } from "../../utils/workflowActionRouting"

interface IMediaMaterialReportModalProps {
  current: IApplicationInfo
  onOkCb?: (nextTaskId?: string | null) => Promise<void> | void
  confirmPermissionCode?:
    | string
    | ((intent: WorkflowActionIntent) => string | undefined)
  permissionRoutePath?: string
}

interface IMediaMaterialReportModalRef {
  show: (intent: WorkflowActionIntent) => void
}

interface IReportNote {
  sceneTime?: string
  pageNumber?: string
  action?: string
  note?: string
}

interface IFieldType {
  checks?: Record<string, Array<string | number> | null | undefined>
  ageClassification?: string | number
  obligationLetter?: string[]
  detailedReport?: string
  notes?: IReportNote[]
}

export type {
  IMediaMaterialReportModalProps,
  IMediaMaterialReportModalRef,
  IReportNote,
  IFieldType,
}
