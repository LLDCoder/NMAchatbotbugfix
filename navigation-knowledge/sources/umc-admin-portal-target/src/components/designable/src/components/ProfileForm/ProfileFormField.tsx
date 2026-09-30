/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { useCallback, useMemo } from "react";
import { Field, observer } from "@formily/react";
import {
  Input,
  Select,
  Row,
  Col,
  Card as AntdCard,
  DatePicker,
  Radio,
  Tooltip,
} from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import moment from "moment";
import { useTranslation } from "react-i18next";
import DocumentViewer from "../../../../../components/common/DocumentViewer/index";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import {
  getBilingualValueByLang,
  getEditableTitlePathByLang,
} from "@/components/designable/src/utils/bilingual";
import { AddressPicker } from "@/components/designable/src/components/AddressPicker/preview";
import { CompositeMobileNumberField } from "../MobileNumberInput";
import i18n from "@/localization/config";
import {
  getProfileFormDesignerPreviewValues,
} from "./profileFormRules";
import "./styles.less";

const { Option } = Select;

type ProfileFormValue = {
  establishmentSubTypes?: string;
  workEmail?: string;
  commercialLicenseNumber?: string;
  licenseExpiryDate?: string;
  establishmentNameArabic?: string;
  establishmentNameEnglish?: string;
  emirate?: string;
  licensingAuthority?: string;
  phoneNumber?: string;
  phoneNumberCountryCode?: string;
  phoneNumberLocalNumber?: string;
  tenancyContractEndDate?: string;
  commercialLicense?: any;
  tenancyContract?: any;
  memorandumOfAssociation?: any;
  powerOfAttorney?: any;
  hasTradeLicense?: boolean;
  reserveTradeNumber?: string;
  reserveTradeName?: any;
  [key: string]: any;
};

type OptionType = {
  label: string;
  value: string;
};

type KeyedOption = {
  labelKey: string;
  value: string;
};

const ESTABLISHMENT_SUBTYPES_OPTION_KEYS: KeyedOption[] = [
  { labelKey: "optionEstablishmentSubtypeCommercial", value: "commercial" },
  { labelKey: "optionEstablishmentSubtypeGovernment", value: "government" },
  { labelKey: "optionEstablishmentSubtypeNonProfit", value: "non_profit" },
];

const WORK_EMAIL_OPTIONS: OptionType[] = [
  { label: "democommercial@business.ae", value: "democommercial@business.ae" },
  { label: "info@company.ae", value: "info@company.ae" },
];

const EMIRATE_OPTION_KEYS: KeyedOption[] = [
  { labelKey: "optionEmirateAbuDhabi", value: "abu_dhabi" },
  { labelKey: "optionEmirateDubai", value: "dubai" },
  { labelKey: "optionEmirateSharjah", value: "sharjah" },
  { labelKey: "optionEmirateAjman", value: "ajman" },
  { labelKey: "optionEmirateUmmAlQuwain", value: "umm_al_quwain" },
  { labelKey: "optionEmirateRasAlKhaimah", value: "ras_al_khaimah" },
  { labelKey: "optionEmirateFujairah", value: "fujairah" },
];

const LICENSING_AUTHORITY_OPTION_KEYS: KeyedOption[] = [
  {
    labelKey: "optionLicensingAuthorityAbuDhabiDed",
    value: "ad_ded",
  },
  {
    labelKey: "optionLicensingAuthorityDubaiDed",
    value: "dubai_ded",
  },
  {
    labelKey: "optionLicensingAuthoritySharjahEdd",
    value: "sharjah_edd",
  },
];

function mapKeyedOptions(
  options: KeyedOption[],
  tf: (key: string, options?: Record<string, unknown>) => string,
): OptionType[] {
  return options.map((option) => ({
    value: option.value,
    label: tf(option.labelKey),
  }));
}

export const ProfileFormField: React.FC<any> = observer((props) => {
  const { titleEn, titleAr, title } = props;
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
  const previewValues = useMemo(
    () => getProfileFormDesignerPreviewValues(),
    [],
  );
  const displayValue: ProfileFormValue = previewValues;

  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const tf = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(
        i18n.t(`ProfileForm.${key}`, {
          lng: previewLang,
          ...(options ?? {}),
        }),
      ),
    [previewLang],
  );

  const displayCardTitle = useMemo(() => {
    const raw = getBilingualValueByLang({
      lang: previewLang,
      host,
      en: titleEn,
      ar: titleAr,
      legacy: typeof title === "string" ? title : undefined,
      fallback: "",
    });
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (trimmed.length > 0) {
      return trimmed;
    }
    if (host === "designer") {
      return "";
    }
    return tf("defaultCardTitle");
  }, [host, previewLang, tf, title, titleAr, titleEn]);
  const editableTitlePath = getEditableTitlePathByLang(previewLang);

  const establishmentSubtypeOptions = useMemo(
    () => mapKeyedOptions(ESTABLISHMENT_SUBTYPES_OPTION_KEYS, tf),
    [tf],
  );
  const emirateOptions = useMemo(
    () => mapKeyedOptions(EMIRATE_OPTION_KEYS, tf),
    [tf],
  );
  const licensingAuthorityOptions = useMemo(
    () => mapKeyedOptions(LICENSING_AUTHORITY_OPTION_KEYS, tf),
    [tf],
  );
  const renderLabel = (label: string, required: boolean = true, tooltip?: string) => (
    <div className="profile-form__label">
      <span>
        {label}
        {required && <span className="profile-form__required">*</span>}
      </span>
      {tooltip && (
        <Tooltip title={tooltip}>
          <QuestionCircleOutlined className="profile-form__tooltip" />
        </Tooltip>
      )}
    </div>
  );

  const renderSelect = (
    name: string,
    label: string,
    options: OptionType[],
    required: boolean = true,
    disabled: boolean = false,
    placeholder?: string,
  ) => {
    return (
      <div className="profile-form__field">
        {renderLabel(label, required)}
        <Select
          disabled
          placeholder={placeholder || tf("placeholderSelect", { label })}
          value={displayValue[name]}
          showSearch
          optionFilterProp="label"
          className={disabled ? "profile-form__readonly" : ""}
        >
          {options.map((o) => (
            <Option key={o.value} value={o.value} label={o.label}>
              {o.label}
            </Option>
          ))}
        </Select>
      </div>
    );
  };

  const renderTextInput = (
    name: string,
    label: string,
    required: boolean = true,
    disabled: boolean = false,
    maxLength?: number,
    placeholder?: string,
  ) => {
    return (
      <div className="profile-form__field">
        {renderLabel(label, required)}
        <Input
          disabled
          placeholder={placeholder || tf("placeholderEnter", { label })}
          value={displayValue[name] || ""}
          maxLength={maxLength}
          className={disabled ? "profile-form__readonly" : ""}
        />
      </div>
    );
  };

  const renderDatePicker = (
    name: string,
    label: string,
    required: boolean = true,
    disabled: boolean = false,
  ) => {
    return (
      <div className="profile-form__field">
        {renderLabel(label, required)}
        <DatePicker
          disabled
          format="DD/MM/YYYY"
          placeholder={tf("phSelectDate")}
          value={
            displayValue[name]
              ? moment(displayValue[name], "YYYY-MM-DD")
              : null
          }
          className={disabled ? "profile-form__readonly" : ""}
        />
      </div>
    );
  };

  const renderUpload = (
    name: string,
    label: string,
    required: boolean = true,
  ) => {
    return (
      <div className="profile-form__field">
        {renderLabel(label, required)}
        <DocumentViewer
          hasDelete={false}
          disabled
          value={displayValue[name]}
          uploadConfig={{
            maxCount: 1,
            maxSize: 5,
            uploadTip: tf("uploadTipPdf"),
            accept: ".pdf",
            placeholder: tf("uploadPlaceholder"),
            invalidFileTypeMessage: tf("validationPdfOnly"),
            maxSizeErrorMessage: tf("validationMaxFileSize"),
          }}
        />
      </div>
    );
  };

  return (
    <div className="profile-form">
      <AntdCard
        className="profile-form__card"
        title={<span data-content-editable={editableTitlePath}>{displayCardTitle}</span>}
      >
        <Row gutter={24}>
          <Col span={12}>
            {renderSelect(
              "establishmentSubTypes",
              tf("labelEstablishmentSubTypes"),
              establishmentSubtypeOptions,
              true,
              true,
            )}
          </Col>
          <Col span={12}>
            {renderSelect(
              "workEmail",
              tf("labelWorkEmail"),
              WORK_EMAIL_OPTIONS,
              false,
              false,
            )}
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            {renderTextInput(
              "establishmentNameArabic",
              tf("labelEstablishmentNameArabic"),
              true,
              false,
              200,
            )}
          </Col>
          <Col span={12}>
            {renderTextInput(
              "establishmentNameEnglish",
              tf("labelEstablishmentNameEnglish"),
              true,
              false,
              200,
            )}
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            {renderSelect("emirate", tf("labelEmirate"), emirateOptions, true, true)}
          </Col>
          <Col span={12}>
            {renderSelect(
              "licensingAuthority",
              tf("labelLicensingAuthority"),
              licensingAuthorityOptions,
              true,
              true,
            )}
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={24}>
            <div className="profile-form__field">
              {renderLabel(tf("labelHasTradeLicense"))}
              <Radio.Group
                className="profile-form__trade-license-radio"
                value={true}
                disabled={props.disabled}
              >
                <Radio value={true}>{tf("optionYes")}</Radio>
                <Radio value={false} disabled>
                  {tf("optionNo")}
                </Radio>
              </Radio.Group>
            </div>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            {renderTextInput(
              "commercialLicenseNumber",
              tf("labelTradeLicenseNumber"),
              true,
              true,
              50,
            )}
          </Col>
          <Col span={12}>
            {renderDatePicker(
              "licenseExpiryDate",
              tf("labelLicenseExpiryDate"),
              true,
            )}
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            <div className="profile-form-field">
              {renderLabel(tf("labelPhoneNumber"), true)}
              <CompositeMobileNumberField
                fieldNames={{
                  fullNumber: "phoneNumber",
                  countryCode: "phoneNumberCountryCode",
                  localNumber: "phoneNumberLocalNumber",
                }}
                fullNumber={displayValue.phoneNumber}
                countryCode={displayValue.phoneNumberCountryCode}
                localNumber={displayValue.phoneNumberLocalNumber}
                disabled={true}
                required
                placeholder={tf("placeholderEnter", {
                  label: tf("labelPhoneNumber"),
                })}
                requiredMessage={tf("validationPhoneNumberRequired")}
                invalidMessage={tf("validationPhoneNumberInvalid")}
                onChange={() => undefined}
              />
            </div>
          </Col>
          <Col span={12}>
            {renderDatePicker(
              "tenancyContractEndDate",
              tf("labelTenancyContractEndDate"),
              false,
              false,
            )}
          </Col>
        </Row>
      </AntdCard>

      <AntdCard className="profile-form__card" title={tf("cardEstablishmentDocuments")}>
        <Row gutter={24}>
          <Col span={12}>
            {renderUpload(
              "commercialLicense",
              tf("labelUploadCommercialLicense"),
              true,
            )}
          </Col>
          <Col span={12}>
            {renderUpload(
              "tenancyContract",
              tf("labelUploadTenancyContract"),
              false,
            )}
          </Col>
        </Row>

        <Row gutter={24}>
          <Col span={12}>
            {renderUpload(
              "memorandumOfAssociation",
              tf("labelMemorandumOfAssociation"),
              false,
            )}
          </Col>
          <Col span={12}>
            {renderUpload("powerOfAttorney", tf("labelPowerOfAttorney"), false)}
          </Col>
        </Row>
      </AntdCard>

      <AntdCard className="profile-form__card" title={tf("cardAddressInformation")}>
        <Field
          name="addressPicker"
          component={[AddressPicker, { disabled: true }]}
        />
      </AntdCard>
    </div>
  );
});

ProfileFormField.displayName = "ProfileFormField";

export default ProfileFormField;
