import {
  DEFAULT_COUNTRY_DIAL_CODE,
  FormMobileNumberInput,
} from "@/components/common/MobileNumberInput"
import { useCallback, type FC } from "react"
import moment from "moment"
import { DatePicker, Form, Input, Radio, Select, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { inspectionFigmaAssets } from "@/pages/InspectionCommon/assets"
import InspectorSelect from "@/pages/InspectionTaskManagement/components/InspectorSelect"
import TaskAttachmentUpload from "@/pages/InspectionTaskManagement/components/TaskAttachmentUpload"
import type {
  InspectionTaskFormSectionsProps,
  TaskRemarksTextAreaProps,
} from "./type"

const TaskRemarksTextArea: FC<TaskRemarksTextAreaProps> = ({
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
          <img
            src={inspectionFigmaAssets.createTask.clearIcon}
            alt=""
            aria-hidden="true"
          />
        </button>
      ) : null}
    </div>
  )
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
        <img
          src={inspectionFigmaAssets.createTask.helpIcon}
          alt=""
          aria-hidden="true"
        />
      </span>
    </Tooltip>
  </span>
)

export const InspectionTaskFormSections: FC<
  InspectionTaskFormSectionsProps
> = ({
  targetFormType,
  canRenderTargetDetails,
  targetSearchNode,
  isReadonlyTarget,
  isLicenseExemptSubtype,
  shouldShowRegion,
  isInspectorSelfCreate,
  authorityLookupLoading,
  campaignActivityLoading,
  campaignEmirateId,
  establishmentSubtypeSelectOptions,
  emirateSelectOptions,
  authoritySelectOptions,
  regionSelectOptions,
  communitySelectOptions,
  campaignEmirateSelectOptions,
  campaignAuthoritySelectOptions,
  campaignActivityOptions,
  inspectionMethodSelectOptions,
  taskAttachments,
  onTaskAttachmentsChange,
  onAttachmentUploadingChange,
  renderCampaignActivityOption,
}) => {
  const { t } = useTranslation()
  const shouldShowCampaignFields = targetFormType === "inspectionCampaign"
  const shouldShowInspector = !shouldShowCampaignFields
  const shouldShowMethod = !shouldShowCampaignFields

  const renderEstablishmentFields = () => (
    <>
      {targetSearchNode}
      {canRenderTargetDetails ? (
        <>
          <Form.Item
            label={t("inspection.tasks.fields.establishmentSubtype")}
            name="establishmentSubType"
            preserve={false}
            rules={[{ required: true }]}
          >
            <Select
              allowClear={!isReadonlyTarget}
              disabled={isReadonlyTarget}
              placeholder={t("inspection.tasks.filters.selectSubtype")}
            >
              {establishmentSubtypeSelectOptions.map((item) => (
                <Select.Option key={item.value} value={item.value}>
                  {item.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={t("inspection.tasks.columns.emirate")}
            name="emirateNameEn"
            preserve={false}
            rules={[{ required: true }]}
          >
            <Select
              allowClear={!isReadonlyTarget}
              disabled={isReadonlyTarget}
              placeholder={t("inspection.tasks.filters.selectEmirate")}
            >
              {emirateSelectOptions.map((item) => (
                <Select.Option key={item.value} value={item.value}>
                  {item.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          {!isLicenseExemptSubtype ? (
            <Form.Item
              label={t("inspection.tasks.fields.tradeLicenseNumber")}
              name="tradeLicenseNumber"
              preserve={false}
              rules={[{ required: true }]}
            >
              <Input
                allowClear={!isReadonlyTarget}
                disabled={isReadonlyTarget}
                placeholder={t(
                  "inspection.tasks.placeholders.tradeLicenseNumber"
                )}
              />
            </Form.Item>
          ) : null}
          <Form.Item
            label={t("inspection.tasks.fields.establishmentName")}
            name="establishmentNameEn"
            preserve={false}
            rules={[{ required: true }]}
          >
            <Input
              allowClear={!isReadonlyTarget}
              disabled={isReadonlyTarget}
              placeholder={t("inspection.tasks.placeholders.establishmentName")}
            />
          </Form.Item>
          {!isLicenseExemptSubtype ? (
            <Form.Item
              label={t("inspection.tasks.columns.authority")}
              name="authorityNameEn"
              preserve={false}
              rules={[{ required: true }]}
            >
              <Select
                allowClear={!isReadonlyTarget}
                disabled={isReadonlyTarget}
                placeholder={t("inspection.tasks.filters.selectAuthority")}
              >
                {authoritySelectOptions.map((item) => (
                  <Select.Option key={item.value} value={item.value}>
                    {item.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}
          {shouldShowRegion ? (
            <Form.Item
              label={t("inspection.tasks.fields.region")}
              name="region"
              preserve={false}
              rules={[{ required: true }]}
            >
              <Select
                allowClear={!isReadonlyTarget}
                disabled={isReadonlyTarget}
                placeholder={t("inspection.tasks.filters.selectRegion")}
              >
                {regionSelectOptions.map((item) => (
                  <Select.Option key={item.value} value={item.value}>
                    {item.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}
          <Form.Item
            label={t("inspection.tasks.fields.area")}
            name="area"
            preserve={false}
            rules={[{ required: true }]}
          >
            <Select
              allowClear={!isReadonlyTarget}
              disabled={isReadonlyTarget}
              placeholder={t("inspection.tasks.filters.selectArea")}
            >
              {communitySelectOptions.map((item) => (
                <Select.Option key={item.value} value={item.value}>
                  {item.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={t("inspection.tasks.fields.street")}
            name="street"
            preserve={false}
            rules={[{ required: true }]}
          >
            <Input
              allowClear={!isReadonlyTarget}
              disabled={isReadonlyTarget}
              placeholder={t("inspection.tasks.placeholders.street")}
            />
          </Form.Item>
        </>
      ) : null}
    </>
  )

  const renderIndividualFields = () => (
    <>
      {targetSearchNode}
      {canRenderTargetDetails ? (
        <>
          <Form.Item
            label={t("inspection.tasks.fields.eid")}
            name="eid"
            preserve={false}
            rules={[{ required: true }]}
          >
            <Input
              allowClear={!isReadonlyTarget}
              disabled={isReadonlyTarget}
              placeholder={t("inspection.tasks.placeholders.eid")}
            />
          </Form.Item>
          <Form.Item
            label={t("inspection.tasks.fields.fullName")}
            name="fullName"
            preserve={false}
            rules={[{ required: true }]}
          >
            <Input
              allowClear={!isReadonlyTarget}
              disabled={isReadonlyTarget}
              placeholder={t("inspection.tasks.placeholders.fullName")}
            />
          </Form.Item>
          <Form.Item
            label={t("inspection.tasks.fields.email")}
            name="email"
            preserve={false}
            rules={[{ required: true, type: "email" }]}
          >
            <Input
              allowClear={!isReadonlyTarget}
              disabled={isReadonlyTarget}
              placeholder={t("inspection.tasks.placeholders.email")}
            />
          </Form.Item>
          <Form.Item
            label={t("inspection.tasks.fields.mobileNumber")}
            name="mobileNumber"
            preserve={false}
          >
            <FormMobileNumberInput
              defaultCountryCode={DEFAULT_COUNTRY_DIAL_CODE}
              disabled={isReadonlyTarget}
              placeholder={t("inspection.tasks.placeholders.mobileNumber")}
              singlePhoneField
            />
          </Form.Item>
        </>
      ) : null}
    </>
  )

  const renderCampaignFields = () => (
    <>
      <Form.Item
        label={t("inspection.tasks.columns.emirate")}
        name="emirateId"
        rules={[{ required: true }]}
      >
        <Select
          allowClear
          optionLabelProp="label"
          placeholder={t("inspection.tasks.filters.selectEmirate")}
        >
          {campaignEmirateSelectOptions.map((item) => (
            <Select.Option
              key={item.value}
              value={item.value}
              label={item.label}
              title={item.label}
            >
              {item.label}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        label={t("inspection.tasks.columns.authority")}
        name="authorityId"
        rules={[{ required: true }]}
      >
        <Select
          allowClear
          disabled={!campaignEmirateId || authorityLookupLoading}
          loading={authorityLookupLoading}
          optionLabelProp="label"
          placeholder={t("inspection.tasks.filters.selectAuthority")}
        >
          {campaignAuthoritySelectOptions.map((item) => (
            <Select.Option
              key={item.value}
              value={item.value}
              label={item.label}
              title={item.label}
            >
              {item.label}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        className="inspection-task-management__modal-full-row"
        label={t("inspection.tasks.fields.activity")}
        name="activityIds"
        rules={[{ required: true }]}
      >
        <Select
          allowClear
          className="inspection-task-management__campaign-activity-select"
          mode="multiple"
          maxTagCount={2}
          loading={campaignActivityLoading}
          optionFilterProp="label"
          placeholder={t("inspection.tasks.filters.selectActivity")}
        >
          {campaignActivityOptions.map((item) => (
            <Select.Option
              key={item.value}
              value={item.value}
              label={item.label}
              title={item.label}
            >
              {renderCampaignActivityOption(item.label)}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
    </>
  )

  const renderExecutionFields = () => (
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
                return Promise.resolve()
              }

              return Promise.reject(
                new Error(t("inspection.tasks.messages.dueDateFuture"))
              )
            },
          },
        ]}
      >
        <DatePicker
          className="inspection-task-management__date-picker"
          format="DD/MM/YYYY"
          disabledDate={(current) =>
            Boolean(current && current < moment().startOf("day"))
          }
        />
      </Form.Item>
      {shouldShowInspector ? (
        <Form.Item
          className="inspection-task-management__modal-full-row"
          label={t("inspection.tasks.fields.assignedInspector")}
          name="assignedInspector"
          rules={isInspectorSelfCreate ? [] : [{ required: true }]}
        >
          <InspectorSelect
            allowClear={!isInspectorSelfCreate}
            disabled={isInspectorSelfCreate}
            multiple={false}
            placeholder={t("inspection.tasks.fields.selectInspector")}
          />
        </Form.Item>
      ) : null}
      <Form.Item
        className="inspection-task-management__modal-full-row inspection-task-management__remarks-form-item"
        label={t("inspection.tasks.fields.remarks")}
        name="description"
      >
        <TaskRemarksTextArea
          placeholder={t("inspection.tasks.placeholders.remarks")}
        />
      </Form.Item>
      <Form.Item
        className="inspection-task-management__modal-full-row inspection-task-management__upload-form-item"
        label={renderAttachmentLabel(
          t("inspection.tasks.fields.attachments"),
          t("inspection.tasks.messages.attachmentsHelp")
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
  )

  return (
    <>
      <div className="inspection-task-management__modal-section">
        <div className="inspection-task-management__modal-section-title">
          {t("inspection.tasks.sections.inspectionTarget")}
        </div>
        <div className="inspection-task-management__modal-grid">
          {shouldShowCampaignFields ? null : (
            <Form.Item
              className="inspection-task-management__modal-full-row"
              label={t("inspection.tasks.fields.targetType")}
              name="targetType"
              initialValue="establishment"
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
          )}
          {shouldShowCampaignFields
            ? renderCampaignFields()
            : targetFormType === "establishment"
              ? renderEstablishmentFields()
              : renderIndividualFields()}
        </div>
      </div>

      <div className="inspection-task-management__modal-section">
        <div className="inspection-task-management__modal-section-title">
          {t("inspection.tasks.sections.executionTimeline")}
        </div>
        <div className="inspection-task-management__modal-grid">
          {renderExecutionFields()}
        </div>
      </div>
    </>
  )
}

export default InspectionTaskFormSections
