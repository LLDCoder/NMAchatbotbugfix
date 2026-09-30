import type {
  InspectionTaskDuplicateWarningState,
  InspectionTaskModalMeta,
} from "./type"

export const createEmptyTaskModalMeta = (): InspectionTaskModalMeta => ({
  inspectionReasonCode: "",
  targetType: "establishment",
  manualTarget: false,
  targetSearch: "",
  selectedTarget: null,
  autoMatchedTarget: null,
})

export const createClosedDuplicateTaskWarningState =
  (): InspectionTaskDuplicateWarningState => ({
    visible: false,
    message: "",
    loading: false,
    onConfirm: undefined,
  })

export const getSelectPopupContainer = () => document.body

export const renderSelectOptionText = (label: string) => (
  <span className="inspection-task-management__select-option-text" title={label}>
    {label}
  </span>
)
