import * as React from "react";
import { useCallback, useMemo } from "react";
import { observer, useField, Field } from "@formily/react";
import {
  FormItem,
  FormGrid,
  Select as FormilySelect,
  Input as FormilyInput,
} from "@formily/antd";
import { Card, Col, DatePicker, Input, Row, Select } from "antd";
import DocumentViewer from "../../../../../components/common/DocumentViewer";
import moment from "moment";
import { useTranslation } from "react-i18next";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import "./styles.less";
import AddressPicker from "../AddressPicker/AddressPicker";
import { CompositeMobileNumberField } from "../MobileNumberInput";
import PersonalPhotoTooltip from "@/components/common/PersonalPhotoTooltip";

const { Option } = Select;

type KeyOfValue =
  | "personPhoto"
  | "unitedNumber"
  | "dateOfBirth"
  | "nationality"
  | "fullNameEn"
  | "fullNameAr"
  | "passportType"
  | "passportNo"
  | "placeOfIssueEn"
  | "placeOfIssueAr"
  | "dateOfExpiry"
  | "dateOfIssue"
  | "address"
  | "street"
  | "mobileNo"
  | "mobileNoCountryCode"
  | "mobileNoLocalNumber"
  | "telephoneNo"
  | "telephoneNoCountryCode"
  | "telephoneNoLocalNumber"
  | "fax"
  | "workNo"
  | "workNoCountryCode"
  | "workNoLocalNumber"
  | "areaCode"
  | "emailAddress";

type DataFormValue = Partial<Record<KeyOfValue, any>> & {
  addressPicker?: any;
};

const NATIONALITY_ORDER: { value: string; i18nKey: string }[] = [
  { value: "UAE", i18nKey: "UAE" },
  { value: "India", i18nKey: "India" },
  { value: "Pakistan", i18nKey: "Pakistan" },
  { value: "Egypt", i18nKey: "Egypt" },
  { value: "Saudi Arabia", i18nKey: "SaudiArabia" },
  { value: "Jordan", i18nKey: "Jordan" },
  { value: "Lebanon", i18nKey: "Lebanon" },
];

const PASSPORT_TYPE_VALUES = ["Ordinary", "Diplomatic", "Official", "Service"] as const;

const twoCol = 12;

export const DataFormField: React.FC<any> = observer((props) => {
  const field = useField<any>();
  const current: DataFormValue = field.value || {};
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n } = useTranslation();

  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18n.language);

  const lngOpt = previewLang === "ar" ? "ar" : "en";

  const tx = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(i18n.t(`DataForm.${key}`, { lng: lngOpt, ...options })),
    [i18n, lngOpt],
  );

  const nationalityOptions = useMemo(
    () =>
      NATIONALITY_ORDER.map(({ value, i18nKey }) => ({
        value,
        label: tx(`nationality.${i18nKey}`),
      })),
    [tx],
  );

  const passportTypeOptions = useMemo(
    () =>
      PASSPORT_TYPE_VALUES.map((value) => ({
        value,
        label: tx(`passportType.${value}`),
      })),
    [tx],
  );

  const handleFieldChange = (key: KeyOfValue, value: any) => {
    field.setValue({
      ...current,
      [key]: value,
    });
  };

  const renderTextInput = (
    name: KeyOfValue,
    placeholder: string,
    required?: boolean,
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) return placeholder;
          return "";
        }}
      >
        <Input
          className="ant-input-affix-wrapper"
          placeholder={placeholder}
          disabled={props.disabled}
          value={current[name] || ""}
          onChange={(e) => handleFieldChange(name, e.target.value)}
        />
      </Field>
    );
  };

  const renderSelect = (
    name: KeyOfValue,
    placeholder: string,
    options: { label: string; value: string }[],
    required?: boolean,
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) return placeholder;
          return "";
        }}
      >
        <Select
        className="umc-select-arrow-manual"
          placeholder={placeholder}
          disabled={props.disabled}
          value={current[name] ?? ""}
          onChange={(value) => handleFieldChange(name, value)}
          showSearch
          optionFilterProp="children"
        >
          {options
            .filter((o) => o.value !== "" || !required)
            .map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
        </Select>
      </Field>
    );
  };

  const renderDate = (
    name: KeyOfValue,
    placeholder: string,
    required?: boolean,
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) return placeholder;
          return "";
        }}
      >
        <DatePicker
          style={{ width: "100%" }}
          disabled={props.disabled}
          placeholder={placeholder}
          value={current[name] ? moment(current[name]) : null}
          onChange={(date) =>
            handleFieldChange(
              name,
              date ? date.format("YYYY-MM-DD") : undefined,
            )
          }
        />
      </Field>
    );
  };

  const renderUpload = (
    name: KeyOfValue,
    labelKey: string,
    required?: boolean,
  ) => {
    const uploadLabelText = tx(labelKey);
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) {
            return tx("validationUpload", { label: uploadLabelText });
          }
          return "";
        }}
      >
        <DocumentViewer
          label=""
          disabled={props.disabled}
          value={current[name]}
          onChange={(value) => handleFieldChange(name, value)}
          uploadConfig={{
            maxSize: 5,
            maxCount: 1,
            accept: ".pdf,.jpg,.jpeg,.png",
            placeholder: tx("uploadPlaceholder"),
          }}
          hasView={true}
          hasDelete={true}
        />
      </Field>
    );
  };

  return (
    <div className="data-form-container" {...props}>
      <Card className="data-form-card" title={tx("cardTitle")}>
        <Card className="data-form-section" title={tx("sectionPersonalInformation")}>
          <Row gutter={24}>
            <Col span={twoCol}>
              <PersonalPhotoTooltip>
                <div className="data-form-label">{tx("labelPersonPhoto")}</div>
              </PersonalPhotoTooltip>
              {renderUpload("personPhoto", "labelPersonPhoto", true)}
            </Col>
            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelUnitedNumber")}</div>
              {renderTextInput("unitedNumber", tx("phEmiratesIdNumber"), true)}
            </Col>

            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelDateOfBirth")}</div>
              {renderDate("dateOfBirth", tx("phDateDdMmYyyy"), true)}
            </Col>
            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelNationality")}</div>
              {renderSelect(
                "nationality",
                tx("phSelectNationality"),
                nationalityOptions,
                true,
              )}
            </Col>

            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelFullNameEn")}</div>
              {renderTextInput("fullNameEn", tx("phFullNameEnglish"), true)}
            </Col>
            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelFullNameAr")}</div>
              {renderTextInput("fullNameAr", tx("phFullNameArabic"), true)}
            </Col>
          </Row>
        </Card>

        <Card className="data-form-section" title={tx("sectionPassportDetails")}>
          <Row gutter={24}>
            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelPassportType")}</div>
              {renderSelect(
                "passportType",
                tx("phSelectPassportType"),
                passportTypeOptions,
                true,
              )}
            </Col>
            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelPassportNo")}</div>
              {renderTextInput("passportNo", tx("phPassportNumber"), true)}
            </Col>

            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelPlaceOfIssueEn")}</div>
              {renderTextInput(
                "placeOfIssueEn",
                tx("phPlaceOfIssueEnglish"),
                true,
              )}
            </Col>
            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelPlaceOfIssueAr")}</div>
              {renderTextInput(
                "placeOfIssueAr",
                tx("phPlaceOfIssueArabic"),
                true,
              )}
            </Col>

            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelDateOfExpiry")}</div>
              {renderDate("dateOfExpiry", tx("phDateDdMmYyyy"), true)}
            </Col>
            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelDateOfIssue")}</div>
              {renderDate("dateOfIssue", tx("phDateDdMmYyyy"), true)}
            </Col>
          </Row>
        </Card>

        <Card className="data-form-section" title={tx("sectionAddress")}>
          <Field
            name="addressPicker"
            decorator={[FormItem]}
            component={[AddressPicker]}
          >
            <FormGrid maxColumns={2} minColumns={2} columnGap={24} rowGap={12}>
              <div>
                <div className="data-form-label">{tx("labelEmirate")}</div>
                <Field
                  name="grid.emirate"
                  decorator={[FormItem]}
                  disabled={props.disabled}
                  component={[FormilySelect, { placeholder: tx("phSelectEmirate") }]}
                />
              </div>

              <div>
                <div className="data-form-label">{tx("labelRegion")}</div>
                <Field
                  name="grid.region"
                  decorator={[FormItem]}
                  disabled={props.disabled}
                  component={[FormilySelect, { placeholder: tx("phSelectRegion") }]}
                />
              </div>

              <div>
                <div className="data-form-label">{tx("labelAddressArea")}</div>
                <Field
                  name="grid.area"
                  decorator={[FormItem]}
                  disabled={props.disabled}
                  component={[FormilySelect, { placeholder: tx("phSelectAreaAddress") }]}
                />
              </div>

              <div>
                <div className="data-form-label">{tx("labelStreet")}</div>
                <Field
                  name="grid.street"
                  decorator={[FormItem]}
                  disabled={props.disabled}
                  component={[
                    FormilyInput.TextArea,
                    { placeholder: tx("phEnterStreet"), rows: 4 },
                  ]}
                />
              </div>
            </FormGrid>
          </Field>
        </Card>

        <Card className="data-form-section" title={tx("sectionContactInformation")}>
          <Row gutter={24}>
            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelMobileNo")}</div>
              <CompositeMobileNumberField
                fieldNames={{
                  fullNumber: "mobileNo",
                  countryCode: "mobileNoCountryCode",
                  localNumber: "mobileNoLocalNumber",
                }}
                fullNumber={current.mobileNo}
                countryCode={current.mobileNoCountryCode}
                localNumber={current.mobileNoLocalNumber}
                disabled={props.disabled}
                required
                placeholder={tx("phMobileNumber")}
                requiredMessage={tx("phMobileNumber")}
                onChange={(patch) => field.setValue({ ...current, ...patch })}
              />
            </Col>
            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelTelephoneNo")}</div>
              <CompositeMobileNumberField
                fieldNames={{
                  fullNumber: "telephoneNo",
                  countryCode: "telephoneNoCountryCode",
                  localNumber: "telephoneNoLocalNumber",
                }}
                fullNumber={current.telephoneNo}
                countryCode={current.telephoneNoCountryCode}
                localNumber={current.telephoneNoLocalNumber}
                disabled={props.disabled}
                required
                placeholder={tx("phTelephoneNumber")}
                requiredMessage={tx("validationPhoneNumberRequired")}
                invalidMessage={tx("validationPhoneNumberInvalid")}
                onChange={(patch) => field.setValue({ ...current, ...patch })}
              />
            </Col>

            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelFax")}</div>
              {renderTextInput("fax", tx("phFax"), true)}
            </Col>
            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelWorkNo")}</div>
              <CompositeMobileNumberField
                fieldNames={{
                  fullNumber: "workNo",
                  countryCode: "workNoCountryCode",
                  localNumber: "workNoLocalNumber",
                }}
                fullNumber={current.workNo}
                countryCode={current.workNoCountryCode}
                localNumber={current.workNoLocalNumber}
                disabled={props.disabled}
                required
                placeholder={tx("phWorkNumber")}
                requiredMessage={tx("validationPhoneNumberRequired")}
                invalidMessage={tx("validationPhoneNumberInvalid")}
                onChange={(patch) => field.setValue({ ...current, ...patch })}
              />
            </Col>

            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelContactArea")}</div>
              {renderTextInput("areaCode", tx("phSelectContactArea"), true)}
            </Col>
            <Col span={twoCol}>
              <div className="data-form-label">{tx("labelEmailAddress")}</div>
              {renderTextInput("emailAddress", tx("phEmailAddress"), true)}
            </Col>
          </Row>
        </Card>
      </Card>
    </div>
  );
});
