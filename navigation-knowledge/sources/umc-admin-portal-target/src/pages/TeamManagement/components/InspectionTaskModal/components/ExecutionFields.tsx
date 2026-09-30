import React from "react";
import moment from "moment";
import { DatePicker, Form, Radio, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { InspectionTaskAttachmentPayload } from "@/services/inspection";
import { inspectionFigmaAssets } from "@/pages/InspectionCommon/assets";
import InspectorSelect, {
  type InspectorSelectOption,
} from "@/pages/InspectionTaskManagement/components/InspectorSelect";
import TaskAttachmentUpload from "@/pages/InspectionTaskManagement/components/TaskAttachmentUpload";
import type { StaticSelectOption } from "../type";
import TaskRemarksTextArea from "./TaskRemarksTextArea";

interface ExecutionFieldsProps {
  isCampaignCreateMode: boolean;
  isInspectorSelfCreate: boolean;
  inspectorOptionsLoading: boolean;
  inspectionMethodSelectOptions: StaticSelectOption[];
  resolvedInspectorOptions: InspectorSelectOption[];
  taskAttachments: InspectionTaskAttachmentPayload[];
  onTaskAttachmentsChange: (attachments: InspectionTaskAttachmentPayload[]) => void;
  onAttachmentUploadingChange: (uploading: boolean) => void;
}

const renderAttachmentLabel = (label: string, helpText: string) => (
  <span className="inspection-task-management__attachment-label">
    <span>{label}</span>
    <Tooltip
      title={helpText}
      placement="top"
      overlayClassName="inspection-task-management__attachment-tooltip"
      getPopupContainer={() => document.body}
    >
      <span
        className="inspection-task-management__attachment-help"
        tabIndex={0}
        aria-label={helpText}
      >
        <img src={inspectionFigmaAssets.createTask.helpIcon} alt="" aria-hidden="true" />
      </span>
    </Tooltip>
  </span>
);

const ExecutionFields: React.FC<ExecutionFieldsProps> = ({
  isCampaignCreateMode,
  isInspectorSelfCreate,
  inspectorOptionsLoading,
  inspectionMethodSelectOptions,
  resolvedInspectorOptions,
  taskAttachments,
  onTaskAttachmentsChange,
  onAttachmentUploadingChange,
}) => {
  const { t } = useTranslation();
  const shouldShowInspector = !isCampaignCreateMode;
  const shouldShowMethod = !isCampaignCreateMode;

  return (
    <>
      {shouldShowMethod ? (
        <Form.Item
          label={t("inspection.tasks.columns.inspectionMethod")}
          name="inspectionMethod"
          rules={[{ required: true }]}
        >
          <Radio.Group className="inspection-task-management__radio-group">
            {inspectionMethodSelectOptions.map((item) => (
              <Radio key={item.value} value={item.value}>
                {item.label}
              </Radio>
            ))}
          </Radio.Group>
        </Form.Item>
      ) : null}
      <Form.Item
        label={t("inspection.tasks.columns.dueDate")}
        name="dueDate"
        rules={[
          { required: true },
          {
            validator: (_, value) => {
              if (!value || value.isSameOrAfter(moment().startOf("day"), "day")) {
                return Promise.resolve();
              }
              return Promise.reject(
                new Error(t("inspection.tasks.messages.dueDateFuture")),
              );
            },
          },
        ]}
      >
        <DatePicker
          className="inspection-task-management__date-picker"
          format="DD/MM/YYYY"
          inputReadOnly
          disabledDate={(current) => !!current && current < moment().startOf("day")}
        />
      </Form.Item>
      {shouldShowInspector ? (
        <Form.Item
          className="inspection-task-management__modal-full-row"
          label={t("inspection.tasks.columns.inspector")}
          name="assignedInspector"
          rules={isInspectorSelfCreate ? [] : [{ required: true }]}
        >
          <InspectorSelect
            allowClear={!isInspectorSelfCreate}
            disabled={isInspectorSelfCreate}
            loading={inspectorOptionsLoading}
            maxTagCount={isInspectorSelfCreate ? undefined : 2}
            multiple={!isInspectorSelfCreate}
            options={resolvedInspectorOptions}
            placeholder={t("inspection.tasks.fields.selectInspector")}
          />
        </Form.Item>
      ) : null}
      <Form.Item
        className="inspection-task-management__modal-full-row inspection-task-management__remarks-form-item"
        label={t("inspection.tasks.fields.remarks")}
        name="description"
      >
        <TaskRemarksTextArea placeholder={t("inspection.tasks.placeholders.remarks")} />
      </Form.Item>
      <Form.Item
        className="inspection-task-management__modal-full-row inspection-task-management__upload-form-item"
        label={renderAttachmentLabel(
          t("inspection.tasks.fields.attachments"),
          t("inspection.tasks.messages.attachmentsHelp"),
        )}
      >
        <TaskAttachmentUpload
          value={taskAttachments}
          uploadText={t("inspection.tasks.fields.uploadFile")}
          className="inspection-task-management__task-attachment-upload"
          attachmentGridClassName="inspection-task-management__attachment-grid inspection-attachment-grid--two-columns"
          onChange={onTaskAttachmentsChange}
          onUploadingChange={onAttachmentUploadingChange}
        />
      </Form.Item>
    </>
  );
};

export default ExecutionFields;
