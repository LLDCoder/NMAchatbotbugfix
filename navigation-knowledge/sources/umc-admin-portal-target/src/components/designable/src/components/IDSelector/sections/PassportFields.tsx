import React from "react";
import { Field } from "@formily/react";
import { FormItem } from "@formily/antd";
import { Col, DatePicker, Row, Select, Input } from "antd";
import DocumentViewer from "@/components/common/DocumentViewer/index";
import PersonalPhotoTooltip from "@/components/common/PersonalPhotoTooltip";
import AddressPicker from "../../AddressPicker/AddressPicker";
import { selectDownIcon } from "@/utils/date";
import { toPickerMoment } from "@/utils/dateLocale";
import QueryInput from "../components/QueryInput";
import {
  CONTACT_AREA_MAX_LENGTH,
  FULL_NAME_MAX_LENGTH,
  OCCUPATION_MAX_LENGTH,
  PASSPORT_NUMBER_MAX_LENGTH,
  PASSPORT_TYPE_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  PLACE_OF_ISSUE_MAX_LENGTH,
  type SectionCommonProps,
  disableFutureDate,
  disablePastDate,
  formatNumericInput,
  validateArabicFullName,
  validateContactArea,
  validateEmailAddress,
  validateEnglishFullName,
  validateFutureDateField,
  validateOccupation,
  validatePassportNumber,
  validatePassportType,
  validatePhoneNumberField,
  validatePlaceOfIssueAr,
  validatePlaceOfIssueEn,
} from "../idSelectorUtils";
import {
  useIDSelectorDisplayLang,
  useIDSelectorLabels,
} from "../useIdSelectorLabels";
import { CompositeMobileNumberField } from "../../MobileNumberInput";

const { Option } = Select;

export const PassportFields: React.FC<SectionCommonProps> = ({
  current,
  showList,
  showQueryButton,
  isFieldEditable,
  nationalityList,
  passportMode,
  onFieldChange,
  onFieldsChange,
  onQuery,
  queryLoading,
  isQuerySuccess,
}) => {
  const labels = useIDSelectorLabels();
  const displayLang = useIDSelectorDisplayLang();
  const isFilmingTeamMode = passportMode === "filmingTeam";
  const disableAutoFilledFields = (key: keyof typeof current) =>
    !isFieldEditable(key) || isQuerySuccess;
  const disableManualFields = (key: keyof typeof current) => !isFieldEditable(key);

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
          {labels.labelPassportNumber} <span className="idselector-required">*</span>
        </div>
        <Field
          name="passportNumber"
          validator={(value) => validatePassportNumber(String(value || ""), labels)}
          decorator={[FormItem]}
        >
          <QueryInput
            placeholder={labels.phEnterPassportNumber}
            value={current.passportNumber || ""}
            disabled={!isFieldEditable("passportNumber")}
            queryLoading={queryLoading}
            queryLabel={labels.queryLabel}
            showQueryButton={showQueryButton}
            maxLength={PASSPORT_NUMBER_MAX_LENGTH}
            onQuery={onQuery}
            onChange={(e) => onFieldChange("passportNumber", e.target.value)}
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
          <Col span={12}>
            <div className="idselector-label">
              {labels.labelExpiryDate}<span className="idselector-required">*</span>
            </div>
            <Field
              name="passportExpiryDate"
              validator={(value) =>
                isFilmingTeamMode
                  ? validateFutureDateField(value as string | undefined, labels)
                  : !value
                    ? labels.valDate
                    : ""
              }
              decorator={[FormItem]}
            >
              <DatePicker
                style={{ width: "100%" }}
                placeholder={labels.dateFormat}
                format="DD/MM/YYYY"
                disabled={disableAutoFilledFields("passportExpiryDate")}
                disabledDate={disablePastDate}
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
          {isFilmingTeamMode && (
            <>
              <Col span={12}>
                <div className="idselector-label">
                  {labels.labelPassportType}
                  <span className="idselector-required">*</span>
                </div>
                <Field
                  name="passportType"
                  validator={(value) => validatePassportType(String(value || ""), labels)}
                  decorator={[FormItem]}
                >
                  <Input
                    placeholder={labels.phEnterPassportType}
                    maxLength={PASSPORT_TYPE_MAX_LENGTH}
                    value={current.passportType || ""}
                    disabled={disableManualFields("passportType")}
                    onChange={(e) => onFieldChange("passportType", e.target.value)}
                  />
                </Field>
              </Col>
              <Col span={12}>
                <div className="idselector-label">
                  {labels.labelPlaceOfIssueEn}
                  <span className="idselector-required">*</span>
                </div>
                <Field
                  name="placeOfIssueEn"
                  validator={(value) =>
                    validatePlaceOfIssueEn(String(value || ""), labels)
                  }
                  decorator={[FormItem]}
                >
                  <Input
                    placeholder={labels.phPlaceOfIssueEn}
                    maxLength={PLACE_OF_ISSUE_MAX_LENGTH}
                    value={current.placeOfIssueEn || ""}
                    disabled={disableManualFields("placeOfIssueEn")}
                    onChange={(e) => onFieldChange("placeOfIssueEn", e.target.value)}
                  />
                </Field>
              </Col>
              <Col span={12}>
                <div className="idselector-label">
                  {labels.labelPlaceOfIssueAr}
                  <span className="idselector-required">*</span>
                </div>
                <Field
                  name="placeOfIssueAr"
                  validator={(value) =>
                    validatePlaceOfIssueAr(String(value || ""), labels)
                  }
                  decorator={[FormItem]}
                >
                  <Input
                    placeholder={labels.phPlaceOfIssueAr}
                    dir="rtl"
                    maxLength={PLACE_OF_ISSUE_MAX_LENGTH}
                    value={current.placeOfIssueAr || ""}
                    disabled={disableManualFields("placeOfIssueAr")}
                    onChange={(e) => onFieldChange("placeOfIssueAr", e.target.value)}
                  />
                </Field>
              </Col>
              <Col span={24}>
                <Field
                  name="addressPicker"
                  component={[
                    AddressPicker,
                    {
                      disabled: disableManualFields("addressPicker"),
                    },
                  ]}
                />
              </Col>
              <Col span={12}>
                <div className="idselector-label">
                  {labels.labelMobileNo}
                  <span className="idselector-required">*</span>
                </div>
                <CompositeMobileNumberField
                  fieldNames={{
                    fullNumber: "mobileNo",
                    countryCode: "mobileNoCountryCode",
                    localNumber: "mobileNoLocalNumber",
                  }}
                  fullNumber={current.mobileNo}
                  countryCode={current.mobileNoCountryCode}
                  localNumber={current.mobileNoLocalNumber}
                  disabled={disableManualFields("mobileNo")}
                  required
                  placeholder={labels.phMobileNumber}
                  requiredMessage={labels.valPhoneNumberRequired}
                  invalidMessage={labels.valPhoneNumberInvalid}
                  onChange={(patch) => onFieldsChange(patch, "mobileNo")}
                />
              </Col>
              <Col span={12}>
                <div className="idselector-label">
                  {labels.labelTelephoneNo}
                  <span className="idselector-required">*</span>
                </div>
                <CompositeMobileNumberField
                  fieldNames={{
                    fullNumber: "telephoneNo",
                    countryCode: "telephoneNoCountryCode",
                    localNumber: "telephoneNoLocalNumber",
                  }}
                  fullNumber={current.telephoneNo}
                  countryCode={current.telephoneNoCountryCode}
                  localNumber={current.telephoneNoLocalNumber}
                  disabled={disableManualFields("telephoneNo")}
                  required
                  placeholder={labels.phTelephoneNumber}
                  requiredMessage={labels.valPhoneNumberRequired}
                  invalidMessage={labels.valPhoneNumberInvalid}
                  onChange={(patch) => onFieldsChange(patch, "telephoneNo")}
                />
              </Col>
              <Col span={12}>
                <div className="idselector-label">
                  {labels.labelFax}
                  <span className="idselector-required">*</span>
                </div>
                <Field
                  name="fax"
                  validator={(value) =>
                    validatePhoneNumberField(String(value || ""), labels)
                  }
                  decorator={[FormItem]}
                >
                  <Input
                    placeholder={labels.phFax}
                    inputMode="numeric"
                    maxLength={PHONE_MAX_LENGTH}
                    value={current.fax || ""}
                    disabled={disableManualFields("fax")}
                    onChange={(e) =>
                      onFieldChange("fax", formatNumericInput(e.target.value))
                    }
                  />
                </Field>
              </Col>
              <Col span={12}>
                <div className="idselector-label">
                  {labels.labelWorkNo}
                  <span className="idselector-required">*</span>
                </div>
                <CompositeMobileNumberField
                  fieldNames={{
                    fullNumber: "workNo",
                    countryCode: "workNoCountryCode",
                    localNumber: "workNoLocalNumber",
                  }}
                  fullNumber={current.workNo}
                  countryCode={current.workNoCountryCode}
                  localNumber={current.workNoLocalNumber}
                  disabled={disableManualFields("workNo")}
                  required
                  placeholder={labels.phWorkNumber}
                  requiredMessage={labels.valPhoneNumberRequired}
                  invalidMessage={labels.valPhoneNumberInvalid}
                  onChange={(patch) => onFieldsChange(patch, "workNo")}
                />
              </Col>
              <Col span={12}>
                <div className="idselector-label">
                  {labels.labelContactArea}
                  <span className="idselector-required">*</span>
                </div>
                <Field
                  name="areaCode"
                  validator={(value) => validateContactArea(String(value || ""), labels)}
                  decorator={[FormItem]}
                >
                  <Input
                    placeholder={labels.phSelectContactArea}
                    maxLength={CONTACT_AREA_MAX_LENGTH}
                    value={current.areaCode || ""}
                    disabled={disableManualFields("areaCode")}
                    onChange={(e) => onFieldChange("areaCode", e.target.value)}
                  />
                </Field>
              </Col>
              <Col span={12}>
                <div className="idselector-label">
                  {labels.labelEmailAddress}
                  <span className="idselector-required">*</span>
                </div>
                <Field
                  name="emailAddress"
                  validator={(value) =>
                    validateEmailAddress(String(value || ""), labels)
                  }
                  decorator={[FormItem]}
                >
                  <Input
                    placeholder={labels.phEmailAddress}
                    value={current.emailAddress || ""}
                    disabled={disableManualFields("emailAddress")}
                    onChange={(e) => onFieldChange("emailAddress", e.target.value)}
                  />
                </Field>
              </Col>
            </>
          )}
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
              {labels.labelPassportScan}<span className="idselector-required">*</span>
            </div>
            <Field
              name="PassportScan"
              validator={(value) => (!value ? labels.valRequired : "")}
              decorator={[FormItem]}
            >
              <DocumentViewer
                hasDelete={isFieldEditable("PassportScan")}
                disabled={!isFieldEditable("PassportScan")}
                value={current.PassportScan}
                onChange={(value) =>
                  onFieldChange(
                    "PassportScan",
                    Array.isArray(value) ? value[0] : value,
                  )
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

export default PassportFields;
