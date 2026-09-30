import type { ITaskDetails } from "@/services/content"
import type { WorkflowActionIntent } from "../../utils/workflowActionRouting"

interface IMediaMaterialReportModalProps {
  current: ITaskDetails
  onOkCb?: (nextTaskId?: string | null) => Promise<void> | void
  confirmPermissionCode?: string
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
  detailedReport?: string
  notes?: IReportNote[]
}

export type {
  IMediaMaterialReportModalProps,
  IMediaMaterialReportModalRef,
  IReportNote,
  IFieldType,
}
