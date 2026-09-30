import type { FC } from "react"
import { Form, Radio } from "antd"
import { useTranslation } from "react-i18next"
import type { TargetType } from "@/pages/InspectionTaskManagement/taskConfig"
import type { InspectionTaskModalSectionsProps } from "./type"
import "./InspectionTaskModalSections.less"

const InspectionTaskModalSections: FC<InspectionTaskModalSectionsProps> = ({
  showTargetTypeSwitch,
  targetTypeContent,
  executionTimelineContent,
}) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="inspection-task-management__modal-section">
        <div className="inspection-task-management__modal-section-title">
          {t("inspection.tasks.sections.inspectionTarget")}
        </div>
        <div className="inspection-task-management__modal-grid">
          {showTargetTypeSwitch ? (
            <Form.Item
              className="inspection-task-management__modal-full-row"
              label={t("inspection.tasks.fields.targetType")}
              name="targetType"
              initialValue={"establishment" as TargetType}
              required
            >
              <Radio.Group className="inspection-task-management__radio-group">
                <Radio value="establishment">
                  {t("inspection.target.establishment")}
                </Radio>
                <Radio value="individual">
                  {t("inspection.target.individual")}
                </Radio>
              </Radio.Group>
            </Form.Item>
          ) : null}
          {targetTypeContent}
        </div>
      </div>

      <div className="inspection-task-management__modal-section">
        <div className="inspection-task-management__modal-section-title">
          {t("inspection.tasks.sections.executionTimeline")}
        </div>
        <div className="inspection-task-management__modal-grid">
          {executionTimelineContent}
        </div>
      </div>
    </>
  )
}

export default InspectionTaskModalSections
