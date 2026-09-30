import React, { useCallback } from "react"
import { Input } from "antd"
import { inspectionFigmaAssets } from "@/pages/InspectionCommon/assets"
import type { TaskRemarksTextAreaProps } from "../type"
import { useTranslation } from "react-i18next"

const TaskRemarksTextArea: React.FC<TaskRemarksTextAreaProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  const { t } = useTranslation()
  const hasValue = Boolean(value)

  const handleClear = useCallback(() => {
    onChange?.("")
  }, [onChange])

  return (
    <div className="inspection-task-management__remarks-textarea-control">
      <Input.TextArea
        maxLength={1000}
        placeholder={placeholder}
        rows={4}
        showCount
        value={value}
        onChange={onChange}
      />
      {hasValue ? (
        <button
          type="button"
          aria-label={t("common.clearRemarks")}
          className="inspection-task-management__remarks-clear"
          onClick={handleClear}
          onMouseDown={(event) => event.preventDefault()}
        >
          <img src={inspectionFigmaAssets.createTask.clearIcon} alt="" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

export default TaskRemarksTextArea
