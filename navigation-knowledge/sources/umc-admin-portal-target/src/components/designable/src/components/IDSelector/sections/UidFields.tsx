import React from "react";
import { Field } from "@formily/react";
import { FormItem } from "@formily/antd";
import { Col, DatePicker, Row, Select, Input } from "antd";
import DocumentViewer from "@/components/common/DocumentViewer/index";
import PersonalPhotoTooltip from "@/components/common/PersonalPhotoTooltip";
import { selectDownIcon } from "@/utils/date";
import { toPickerMoment } from "@/utils/dateLocale";
import QueryInput from "../components/QueryInput";
import {
  FULL_NAME_MAX_LENGTH,
  OCCUPATION_MAX_LENGTH,
  type SectionCommonProps,
  UID_MAX_LENGTH,
  disablePastDate,
  disableFutureDate,
  formatUidInput,
  validateArabicFullName,
  validateEnglishFullName,
  validateOccupation,
  validateUid,
} from "../idSelectorUtils";
import {
  useIDSelectorDisplayLang,
  useIDSelectorLabels,
} from "../useIdSelectorLabels";

const { Option } = Select;

export const UidFields: React.FC<SectionCommonProps> = ({
  current,
  showList,
  showQueryButton,
  isFieldEditable,
  nationalityList,
  onFieldChange,
  onQuery,
  queryLoading,
  isQuerySuccess,
}) => {
  const labels = useIDSelectorLabels();
  const displayLang = useIDSelectorDisplayLang();
  const disableAutoFilledFields = (key: keyof typeof current) =>
    !isFieldEditable(key) || isQuerySuccess;

  return (
    <Row gutter={24} className="idselector-row">
      <Col span={12}>
        <div className="idselector-label">
          {labels.labelDateOfBirth} <span className="idselector-required">*</span>
        </div>
        <Field
          name="dateOfBirth"
          validator={(value) => (!value ? labels.valDate : "")}
          decorator={[FormItem]}
        >
          <DatePicker
            style={{ width: "100%" }}
            placeholder={labels.dateFormat}
            format="DD/MM/YYYY"
            disabled={!isFieldEditable("dateOfBirth")}
            disabledDate={disableFutureDate}
            value={toPickerMoment(current.dateOfBirth as string, "YYYY-MM-DD")}
            onChange={(date) =>
              onFieldChange(
                "dateOfBirth",
                date ? date.format("YYYY-MM-DD") : undefined,
              )
            }
          />
        </Field>
      </Col>
      <Col span={12}>
        <div className="idselector-label">
          {labels.labelUid} <span className="idselector-required">*</span>
        </div>
        <Field
          name="uid"
          validator={(value) => validateUid(String(value || ""), labels)}
          decorator={[FormItem]}
        >
          <QueryInput
            placeholder={labels.phEnterUid}
            value={current.uid || ""}
            disabled={!isFieldEditable("uid")}
            queryLoading={queryLoading}
            queryLabel={labels.queryLabel}
            showQueryButton={showQueryButton}
            onQuery={onQuery}
            onChange={(e) => onFieldChange("uid", formatUidInput(e.target.value))}
            maxLength={UID_MAX_LENGTH}
          />
        </Field>
      </Col>
      {showList && (
        <>
          <Col span={12}>
            <div className="idselector-label">
              {labels.labelFullNameAr} <span className="idselector-required">*</span>
            </div>
            <Field
              name="fullNameArabic"
              validator={(value) => validateArabicFullName(String(value || ""), labels)}
              decorator={[FormItem]}
            >
              <Input
                placeholder={labels.phFullNameAr}
                dir="rtl"
                maxLength={FULL_NAME_MAX_LENGTH}
                value={current.fullNameArabic || ""}
                disabled={disableAutoFilledFields("fullNameArabic")}
                onChange={(e) => onFieldChange("fullNameArabic", e.target.value)}
              />
            </Field>
          </Col>
          <Col span={12}>
            <div className="idselector-label">
              {labels.labelFullNameEn} <span className="idselector-required">*</span>
            </div>
            <Field
              name="fullNameEnglish"
              validator={(value) => validateEnglishFullName(String(value || ""), labels)}
              decorator={[FormItem]}
            >
              <Input
                placeholder={labels.phFullNameEn}
                maxLength={FULL_NAME_MAX_LENGTH}
                value={current.fullNameEnglish || ""}
                disabled={disableAutoFilledFields("fullNameEnglish")}
                onChange={(e) => onFieldChange("fullNameEnglish", e.target.value)}
              />
            </Field>
          </Col>
          <Col span={12}>
            <div className="idselector-label">
              {labels.labelNationality} <span className="idselector-required">*</span>
            </div>
            <Field
              name="nationality"
              validator={(value) => (!value ? labels.valNationality : "")}
              decorator={[FormItem]}
            >
              <Select
                placeholder={labels.phNationality}
                showSearch
                value={current.nationality || undefined}
                disabled={disableAutoFilledFields("nationality")}
                onChange={(value) => onFieldChange("nationality", value)}
                suffixIcon={selectDownIcon}
                filterOption={(input, option) =>
                  (option?.children as unknown as string)
                    ?.toLowerCase()
                    .includes(input.toLowerCase())
                }
                className="umc-select-arrow-manual"
              >
                {nationalityList.map((nationality) => (
                  <Option key={nationality.id} value={nationality.id}>
                    {displayLang === "ar" && nationality.nameAr
                      ? nationality.nameAr
                      : nationality.nameEn}
                  </Option>
                ))}
              </Select>
            </Field>
          </Col>
          <Col span={12}>
            <div className="idselector-label">
              {labels.labelGender}<span className="idselector-required">*</span>
            </div>
            <Field
              name="gender"
              validator={(value) => (!value ? labels.valGender : "")}
              decorator={[FormItem]}
            >
              <Select
                placeholder={labels.phGender}
                value={current.gender || undefined}
                disabled={disableAutoFilledFields("gender")}
                onChange={(value) => onFieldChange("gender", value)}
                suffixIcon={selectDownIcon}
              >
                <Option key="male" value="male">
                  {labels.genderMale}
                </Option>
                <Option key="female" value="female">
                  {labels.genderFemale}
                </Option>
              </Select>
            </Field>
          </Col>
          <Col span={12}>
            <div className="idselector-label">
              {labels.labelPassportExpiry}<span className="idselector-required">*</span>
            </div>
            <Field
              name="passportExpiryDate"
              validator={(value) => (!value ? labels.valDate : "")}
              decorator={[FormItem]}
            >
              <DatePicker
                style={{ width: "100%" }}
                placeholder={labels.dateFormat}
                format="DD/MM/YYYY"
                disabled={disableAutoFilledFields("passportExpiryDate")}
                value={toPickerMoment(
                  current.passportExpiryDate as string,
                  "YYYY-MM-DD",
                )}
                onChange={(date) =>
                  onFieldChange(
                    "passportExpiryDate",
                    date ? date.format("YYYY-MM-DD") : undefined,
                  )
                }
              />
            </Field>
          </Col>
          <Col span={12}>
            <div className="idselector-label">
              {labels.labelVisaExpiry}<span className="idselector-required">*</span>
            </div>
            <Field
              name="visaExpiryDate"
              validator={(value) => (!value ? labels.valDate : "")}
              decorator={[FormItem]}
            >
              <DatePicker
                style={{ width: "100%" }}
                placeholder={labels.dateFormat}
                format="DD/MM/YYYY"
                disabled={disableAutoFilledFields("visaExpiryDate")}
                disabledDate={disablePastDate}
                value={toPickerMoment(
                  current.visaExpiryDate as string,
                  "YYYY-MM-DD",
                )}
                onChange={(date) =>
                  onFieldChange(
                    "visaExpiryDate",
                    date ? date.format("YYYY-MM-DD") : undefined,
                  )
                }
              />
            </Field>
          </Col>
          <Col span={12}>
            <div className="idselector-label">
              {labels.labelOccupation}<span className="idselector-required">*</span>
            </div>
            <Field
              name="occupation"
              validator={(value) => validateOccupation(String(value || ""), labels)}
              decorator={[FormItem]}
            >
              <Input
                placeholder={labels.phOccupation}
                maxLength={OCCUPATION_MAX_LENGTH}
                value={current.occupation || ""}
                disabled={disableAutoFilledFields("occupation")}
                onChange={(e) => onFieldChange("occupation", e.target.value)}
              />
            </Field>
          </Col>
          <Col span={12}></Col>
          <Col span={12}>
            <div className="idselector-label">
              {labels.labelPersonalPhoto}
              <PersonalPhotoTooltip />
              <span className="idselector-required">*</span>
            </div>
            <Field
              name="PersonalPhoto"
              validator={(value) => (!value ? labels.valRequired : "")}
              decorator={[FormItem]}
            >
              <DocumentViewer
                hasDelete={isFieldEditable("PersonalPhoto")}
                disabled={!isFieldEditable("PersonalPhoto")}
                value={current.PersonalPhoto}
                onChange={(value) =>
                  onFieldChange(
                    "PersonalPhoto",
                    Array.isArray(value) ? value[0] : value,
                  )
                }
                uploadConfig={{
                  maxCount: 1,
                  maxSize: 5,
                  uploadTip: labels.uploadTipImage5mb,
                  accept: ".jpg,.jpeg,.png",
                  placeholder: labels.uploadPlaceholder,
                }}
              />
            </Field>
          </Col>
          <Col span={12}>
            <div className="idselector-label">
              {labels.labelPassportDoc}<span className="idselector-required">*</span>
            </div>
            <Field
              name="Passport"
              validator={(value) => (!value ? labels.valRequired : "")}
              decorator={[FormItem]}
            >
              <DocumentViewer
                hasDelete={isFieldEditable("Passport")}
                disabled={!isFieldEditable("Passport")}
                value={current.Passport}
                onChange={(value) =>
                  onFieldChange("Passport", Array.isArray(value) ? value[0] : value)
                }
                uploadConfig={{
                  maxCount: 1,
                  maxSize: 5,
                  uploadTip: labels.uploadTipPdf5mb,
                  accept: ".pdf",
                  placeholder: labels.uploadPlaceholder,
                }}
              />
            </Field>
          </Col>
          <Col span={12}>
            <div className="idselector-label">
              {labels.labelVisaDoc}<span className="idselector-required">*</span>
            </div>
            <Field
              name="Visa"
              validator={(value) => (!value ? labels.valRequired : "")}
              decorator={[FormItem]}
            >
              <DocumentViewer
                hasDelete={isFieldEditable("Visa")}
                disabled={!isFieldEditable("Visa")}
                value={current.Visa}
                onChange={(value) =>
                  onFieldChange("Visa", Array.isArray(value) ? value[0] : value)
                }
                uploadConfig={{
                  maxCount: 1,
                  maxSize: 5,
                  uploadTip: labels.uploadTipPdf5mb,
                  accept: ".pdf",
                  placeholder: labels.uploadPlaceholder,
                }}
              />
            </Field>
          </Col>
        </>
      )}
    </Row>
  );
};

export default UidFields;
