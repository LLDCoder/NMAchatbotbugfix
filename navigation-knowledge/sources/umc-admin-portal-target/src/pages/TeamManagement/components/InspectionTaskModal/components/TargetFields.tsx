import React from "react";
import { Button, Form, Input, Select } from "antd";
import { useTranslation } from "react-i18next";
import type { InspectionTargetSearchOption } from "@/services/inspection";
import type { TargetType } from "@/pages/InspectionTaskManagement/taskConfig";
import {
  FormMobileNumberInput,
  createMobileNumberFormRule,
} from "@/components/common/MobileNumberInput";
import { renderSelectOptionText } from "../helpers";
import type {
  CampaignActivitySelectOption,
  InspectionTaskModalMeta as TaskModalMeta,
  StaticSelectOption,
} from "../type";
import {
  normalizeArabicEnglishFullName,
} from "../utils/validation";
import {
  inspectionTaskMobileFieldNames,
} from "../utils/target";
import SearchOptionContent from "./SearchOptionContent";

interface NumberSelectOption {
  value: number;
  label: string;
}

interface TargetFieldsProps {
  isCampaignCreateMode: boolean;
  currentTargetType: TargetType;
  taskModalMeta: TaskModalMeta;
  targetSearchOptions: InspectionTargetSearchOption[];
  targetSearchLoading: boolean;
  isReadonlyTarget: boolean;
  isLicenseExemptSubtype: boolean;
  shouldShowRegion: boolean;
  establishmentSubtypeSelectOptions: StaticSelectOption[];
  emirateSelectOptions: StaticSelectOption[];
  authoritySelectOptions: StaticSelectOption[];
  regionSelectOptions: StaticSelectOption[];
  communitySelectOptions: StaticSelectOption[];
  campaignEmirateSelectOptions: NumberSelectOption[];
  campaignAuthoritySelectOptions: NumberSelectOption[];
  campaignActivityOptions: CampaignActivitySelectOption[];
  campaignEmirateId?: number;
  authorityLookupLoading: boolean;
  campaignActivityLoading: boolean;
  onTargetSearch: (searchText: string) => void;
  onTargetSelect: (value: string) => void;
  onTargetFocus: () => void;
  onTargetClear: () => void;
  onManualTargetStart: () => void;
}

const hasTargetPayloadValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
};

const TargetFields: React.FC<TargetFieldsProps> = ({
  isCampaignCreateMode,
  currentTargetType,
  taskModalMeta,
  targetSearchOptions,
  targetSearchLoading,
  isReadonlyTarget,
  isLicenseExemptSubtype,
  shouldShowRegion,
  establishmentSubtypeSelectOptions,
  emirateSelectOptions,
  authoritySelectOptions,
  regionSelectOptions,
  communitySelectOptions,
  campaignEmirateSelectOptions,
  campaignAuthoritySelectOptions,
  campaignActivityOptions,
  campaignEmirateId,
  authorityLookupLoading,
  campaignActivityLoading,
  onTargetSearch,
  onTargetSelect,
  onTargetFocus,
  onTargetClear,
  onManualTargetStart,
}) => {
  const { t } = useTranslation();
  const hasTargetFields =
    taskModalMeta.manualTarget ||
    taskModalMeta.selectedTarget ||
    taskModalMeta.autoMatchedTarget;
  const readonlyTargetPayload = isReadonlyTarget
    ? ((taskModalMeta.selectedTarget || taskModalMeta.autoMatchedTarget)?.payload ||
      {}) as Record<string, unknown>
    : {};
  const isReadonlyTargetField = (...fieldNames: string[]) =>
    isReadonlyTarget &&
    fieldNames.some((fieldName) =>
      hasTargetPayloadValue(readonlyTargetPayload[fieldName]),
    );

  if (isCampaignCreateMode) {
    return (
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
                {renderSelectOptionText(item.label)}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </>
    );
  }

  const renderTargetSearch = () => (
    <Form.Item
      className="inspection-task-management__modal-full-row"
      label={t("inspection.tasks.fields.targetSearch")}
      name="targetSearch"
      required={!taskModalMeta.manualTarget}
      rules={taskModalMeta.manualTarget ? [] : [{ required: true }]}
    >
      <div className="inspection-task-management__search-row">
        <Select
          className="umc-select-arrow-manual inspection-task-management__target-search"
          showSearch
          allowClear
          showArrow={false}
          value={taskModalMeta.selectedTarget?.value}
          loading={targetSearchLoading}
          optionLabelProp="label"
          placeholder={
            currentTargetType === "establishment"
              ? t("inspection.tasks.filters.searchTargetPlaceholderEstablishment")
              : t("inspection.tasks.filters.searchTargetPlaceholderIndividual")
          }
          dropdownClassName="inspection-task-management__target-search-dropdown"
          onSearch={onTargetSearch}
          onSelect={onTargetSelect}
          onFocus={onTargetFocus}
          onClear={onTargetClear}
          filterOption={false}
          notFoundContent={(
            <div className="inspection-task-management__target-search-empty">
              <div className="inspection-task-management__dropdown-empty-title">
                {t("inspection.tasks.messages.noRecordsFound")}
              </div>
            </div>
          )}
        >
          {targetSearchOptions.map((option) => (
            <Select.Option key={option.value} value={option.value} label={option.title}>
              <SearchOptionContent option={option} />
            </Select.Option>
          ))}
        </Select>
        <Button
          className="inspection-task-management__outline-button inspection-task-management__cant-find-button"
          onClick={onManualTargetStart}
        >
          {t("inspection.tasks.actions.cantFind")}
        </Button>
      </div>
    </Form.Item>
  );

  if (currentTargetType === "individual") {
    return (
      <>
        {renderTargetSearch()}
        {hasTargetFields ? (
          <>
            <Form.Item
              label={t("inspection.tasks.fields.eid")}
              name="eid"
              preserve={false}
              rules={[{ whitespace: true }]}
            >
              <Input
                allowClear={!isReadonlyTargetField("eid")}
                disabled={isReadonlyTargetField("eid")}
                placeholder={t("inspection.tasks.placeholders.eid")}
              />
            </Form.Item>
            <Form.Item
              label={t("inspection.tasks.fields.fullName")}
              name="fullName"
              normalize={normalizeArabicEnglishFullName}
              preserve={false}
              rules={
                isReadonlyTargetField("fullName")
                  ? [{ required: true }]
                  : [{ required: true, whitespace: true }]
              }
              validateTrigger="onBlur"
            >
              <Input
                allowClear={!isReadonlyTargetField("fullName")}
                disabled={isReadonlyTargetField("fullName")}
                placeholder={t("inspection.tasks.placeholders.fullName")}
              />
            </Form.Item>
            <Form.Item
              label={t("inspection.tasks.fields.email")}
              name="email"
              preserve={false}
              rules={[
                { required: true },
                { type: "email", message: t("signup.please.emailFormat") },
              ]}
            >
              <Input
                allowClear={!isReadonlyTargetField("email")}
                disabled={isReadonlyTargetField("email")}
                placeholder={t("inspection.tasks.placeholders.email")}
              />
            </Form.Item>
            <Form.Item
              className="inspection-task-management__mobile-number-form-item"
              label={t("inspection.tasks.fields.mobileNumber")}
              name="mobileNumber"
              preserve={false}
              rules={[
                createMobileNumberFormRule({
                  fieldNames: inspectionTaskMobileFieldNames,
                  messageOverrides: {
                    INVALID_COUNTRY: t("inspection.validation.invalidMobileNumber"),
                    NOT_A_NUMBER: t("inspection.validation.invalidMobileNumber"),
                    TOO_SHORT: t("inspection.validation.invalidMobileNumber"),
                    TOO_LONG: t("inspection.validation.invalidMobileNumber"),
                    INVALID_LENGTH: t("inspection.validation.invalidMobileNumber"),
                    INVALID_FORMAT: t("inspection.validation.invalidMobileNumber"),
                  },
                }),
              ]}
            >
              <FormMobileNumberInput
                fieldNames={inspectionTaskMobileFieldNames}
                defaultCountryCode=""
                disabled={isReadonlyTargetField("mobileNumber")}
                placeholder={t("inspection.tasks.placeholders.mobileNumber")}
              />
            </Form.Item>
          </>
        ) : null}
      </>
    );
  }

  return (
    <>
      {renderTargetSearch()}
      {hasTargetFields ? (
        <>
          <Form.Item
            label={t("inspection.tasks.fields.establishmentSubtype")}
            name="establishmentSubType"
            preserve={false}
            rules={[{ required: true }]}
          >
            <Select
              allowClear={!isReadonlyTargetField("establishmentSubType", "establishmentSubTypeId")}
              disabled={isReadonlyTargetField("establishmentSubType", "establishmentSubTypeId")}
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
              allowClear={!isReadonlyTargetField("emirateNameEn", "emirateId")}
              disabled={isReadonlyTargetField("emirateNameEn", "emirateId")}
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
                allowClear={!isReadonlyTargetField("tradeLicenseNumber")}
                disabled={isReadonlyTargetField("tradeLicenseNumber")}
                placeholder={t("inspection.tasks.placeholders.tradeLicenseNumber")}
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
              allowClear={!isReadonlyTargetField("establishmentNameEn")}
              disabled={isReadonlyTargetField("establishmentNameEn")}
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
                allowClear={!isReadonlyTargetField("authorityNameEn", "authorityId")}
                disabled={isReadonlyTargetField("authorityNameEn", "authorityId")}
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
                allowClear={!isReadonlyTargetField("region", "regionId")}
                disabled={isReadonlyTargetField("region", "regionId")}
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
              allowClear={!isReadonlyTargetField("area", "areaId", "communityId")}
              disabled={isReadonlyTargetField("area", "areaId", "communityId")}
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
              allowClear={!isReadonlyTargetField("street")}
              disabled={isReadonlyTargetField("street")}
              placeholder={t("inspection.tasks.placeholders.street")}
            />
          </Form.Item>
        </>
      ) : null}
    </>
  );
};

export default TargetFields;
