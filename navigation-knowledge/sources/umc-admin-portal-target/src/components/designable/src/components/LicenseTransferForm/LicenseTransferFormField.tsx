/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { observer, useField } from "@formily/react";
import { Input, Select, Row, Col, Card as AntdCard, DatePicker, Alert } from "antd";
import { WarningOutlined } from "@ant-design/icons";
import moment from "moment";
import { useTranslation } from "react-i18next";
import DocumentViewer from "../../../../../components/common/DocumentViewer/index";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import { CompositeMobileNumberField } from "../MobileNumberInput";
import PersonalPhotoTooltip from "@/components/common/PersonalPhotoTooltip";
import i18n from "@/localization/config";
import "./styles.less";

const { Option } = Select;

type IdentityType = "individual" | "entity";

type LicenseTransferFormValue = {
  identityType?: IdentityType;
  verified?: boolean;
  dateOfBirth?: string;
  emiratesId?: string;
  licenseExpiryDate?: string;
  commercialLicenseNumber?: string;
  fullNameArabic?: string;
  fullNameEnglish?: string;
  nationality?: string;
  gender?: string;
  occupation?: string;
  expiryDate?: string;
  personalPhoto?: any;
  emiratesIdFile?: any;
  establishmentNameArabic?: string;
  establishmentNameEnglish?: string;
  emirate?: string;
  licensingAuthority?: string;
  phoneNumber?: string;
  phoneNumberCountryCode?: string;
  phoneNumberLocalNumber?: string;
  tenancyContractEndDate?: string;
  commercialLicenseFile?: any;
  tenancyContract?: any;
  memorandumOfAssociation?: any;
  legalPerson?: string;
  legalPersonContact?: string;
  legalPersonContactCountryCode?: string;
  legalPersonContactLocalNumber?: string;
  legalPersonIdType?: string;
  legalPersonEmiratesId?: string;
  legalPersonDateOfBirth?: string;
  legalPersonEmail?: string;
  addressEmirate?: string;
  addressRegion?: string;
  addressArea?: string;
  addressStreet?: string;
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

const MOCK_INDIVIDUAL_DATA = {
  dateOfBirth: "1990-05-15",
  emiratesId: "784-1990-1234567-1",
  fullNameArabic: "\u0623\u062d\u0645\u062f\u0020\u0645\u062d\u0645\u062f",
  fullNameEnglish: "Ahmed Mohammed",
  nationality: "UAE",
  gender: "Male",
  expiryDate: "2030-05-15",
};

const MOCK_ENTITY_DATA = {
  licenseExpiryDate: "2028-09-08",
  commercialLicenseNumber: "UAEMC-4458",
  establishmentNameArabic:
    "\u0634\u0631\u0643\u0629\u0020\u0628\u0627\u0646\u062f\u0627\u064a\u0020\u0646\u0627\u0645\u0643\u0648",
  establishmentNameEnglish: "BANDAI NAMCO",
  emirate: "abu_dhabi",
  licensingAuthority: "ad_ded",
  phoneNumber: "0212345678",
  tenancyContractEndDate: "2027-07-07",
};

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

const REGION_OPTION_KEYS: KeyedOption[] = [
  { labelKey: "optionRegionAbuDhabi", value: "abu_dhabi" },
  { labelKey: "optionRegionAlAin", value: "al_ain" },
  { labelKey: "optionRegionWesternRegion", value: "western_region" },
];

const AREA_OPTION_KEYS: KeyedOption[] = [
  { labelKey: "optionAreaMap", value: "map" },
  { labelKey: "optionAreaKhalifaCity", value: "khalifa_city" },
  { labelKey: "optionAreaAlReemIsland", value: "al_reem_island" },
];

const ID_TYPE_OPTION_KEYS: KeyedOption[] = [
  { labelKey: "optionIdTypeEmiratesId", value: "emirates_id" },
  { labelKey: "optionIdTypePassport", value: "passport" },
];

const DEFAULT_ALERT_MESSAGE_EN =
  "License transfer is subject to approval. The recipient must have a valid UAE Media Council account and meet all eligibility requirements.";
const DEFAULT_ALERT_MESSAGE_AR =
  "\u064a\u062e\u0636\u0639\u0020\u0646\u0642\u0644\u0020\u0627\u0644\u0631\u062e\u0635\u0629\u0020\u0644\u0644\u0645\u0648\u0627\u0641\u0642\u0629\u002e\u0020\u064a\u062c\u0628\u0020\u0623\u0646\u0020\u064a\u0643\u0648\u0646\u0020\u0644\u062f\u0649\u0020\u0627\u0644\u0645\u0633\u062a\u0644\u0645\u0020\u062d\u0633\u0627\u0628\u0020\u0635\u0627\u0644\u062d\u0020\u0644\u062f\u0649\u0020\u0645\u062c\u0644\u0633\u0020\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a\u0020\u0644\u0644\u0625\u0639\u0644\u0627\u0645\u0020\u0648\u0623\u0646\u0020\u064a\u0633\u062a\u0648\u0641\u064a\u0020\u062c\u0645\u064a\u0639\u0020\u0645\u062a\u0637\u0644\u0628\u0627\u062a\u0020\u0627\u0644\u0623\u0647\u0644\u064a\u0629\u002e";

function mapKeyedOptions(
  options: KeyedOption[],
  tf: (key: string, options?: Record<string, unknown>) => string,
): OptionType[] {
  return options.map((option) => ({
    value: option.value,
    label: tf(option.labelKey),
  }));
}

export const LicenseTransferFormField: React.FC<any> = observer((props) => {
  const {
    alertMessageEn,
    alertMessageAr,
    alertMessage: legacyAlertMessage,
    disabled = false,
    ...restProps
  } = props;
  const field = useField<any>();
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
  const current: LicenseTransferFormValue = field.value || {};

  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const tf = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(
        i18n.t(`LicenseTransferForm.${key}`, {
          lng: previewLang,
          ...(options ?? {}),
        }),
      ),
    [previewLang],
  );

  const alertMessage = getBilingualValueByLang({
    lang: previewLang,
    host,
    en: alertMessageEn,
    ar: alertMessageAr,
    legacy: previewLang === "en" ? legacyAlertMessage : undefined,
    fallback:
      previewLang === "ar"
        ? DEFAULT_ALERT_MESSAGE_AR
        : DEFAULT_ALERT_MESSAGE_EN,
  });

  const emirateOptions = useMemo(
    () => mapKeyedOptions(EMIRATE_OPTION_KEYS, tf),
    [tf],
  );
  const licensingAuthorityOptions = useMemo(
    () => mapKeyedOptions(LICENSING_AUTHORITY_OPTION_KEYS, tf),
    [tf],
  );
  const regionOptions = useMemo(
    () => mapKeyedOptions(REGION_OPTION_KEYS, tf),
    [tf],
  );
  const areaOptions = useMemo(() => mapKeyedOptions(AREA_OPTION_KEYS, tf), [tf]);
  const idTypeOptions = useMemo(
    () => mapKeyedOptions(ID_TYPE_OPTION_KEYS, tf),
    [tf],
  );

  const [identityType] = useState<IdentityType>("entity");
  const [isVerified, setIsVerified] = useState(current.verified || false);
  const [verificationErrorKey, setVerificationErrorKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!current.identityType && identityType) {
      handleFieldChange("identityType", identityType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize the persisted identityType once from the component default
  }, [identityType]);

  useEffect(() => {
    if (isVerified) return;

    if (identityType === "individual") {
      if (current.dateOfBirth && current.emiratesId) {
        performVerification();
      }
    } else if (current.licenseExpiryDate && current.commercialLicenseNumber) {
      performVerification();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preserve current auto-verification behavior without recreating callbacks across the large form
  }, [
    current.dateOfBirth,
    current.emiratesId,
    current.licenseExpiryDate,
    current.commercialLicenseNumber,
    identityType,
  ]);

  const handleFieldChange = (key: string, value: any) => {
    field.setValue({
      ...current,
      [key]: value,
    });
  };

  const performVerification = () => {
    setVerificationErrorKey(null);

    if (identityType === "individual") {
      if (
        current.dateOfBirth === MOCK_INDIVIDUAL_DATA.dateOfBirth &&
        current.emiratesId === MOCK_INDIVIDUAL_DATA.emiratesId
      ) {
        setIsVerified(true);
        field.setValue({
          ...current,
          verified: true,
          fullNameArabic: MOCK_INDIVIDUAL_DATA.fullNameArabic,
          fullNameEnglish: MOCK_INDIVIDUAL_DATA.fullNameEnglish,
          nationality: MOCK_INDIVIDUAL_DATA.nationality,
          gender: MOCK_INDIVIDUAL_DATA.gender,
          expiryDate: MOCK_INDIVIDUAL_DATA.expiryDate,
        });
      } else {
        setVerificationErrorKey("errorVerificationFailed");
      }
      return;
    }

    if (
      current.licenseExpiryDate === MOCK_ENTITY_DATA.licenseExpiryDate &&
      current.commercialLicenseNumber === MOCK_ENTITY_DATA.commercialLicenseNumber
    ) {
      setIsVerified(true);
      field.setValue({
        ...current,
        verified: true,
        establishmentNameArabic: MOCK_ENTITY_DATA.establishmentNameArabic,
        establishmentNameEnglish: MOCK_ENTITY_DATA.establishmentNameEnglish,
        emirate: MOCK_ENTITY_DATA.emirate,
        licensingAuthority: MOCK_ENTITY_DATA.licensingAuthority,
        phoneNumber: MOCK_ENTITY_DATA.phoneNumber,
        phoneNumberCountryCode: "",
        phoneNumberLocalNumber: "",
        tenancyContractEndDate: MOCK_ENTITY_DATA.tenancyContractEndDate,
      });
    } else {
      setVerificationErrorKey("errorVerificationFailed");
    }
  };

  const renderLabel = (label: string, required: boolean = true) => (
    <div className="license-transfer-form-label">
      <span>
        {label}
        {required && <span className="license-transfer-form-required">*</span>}
      </span>
    </div>
  );

  const renderSelect = (
    name: string,
    label: string,
    options: OptionType[],
    required: boolean = true,
    readOnly: boolean = false,
    placeholder?: string,
  ) => (
    <div className="license-transfer-form-field">
      {renderLabel(label, required)}
      <Select
        disabled={disabled || readOnly}
        placeholder={placeholder || tf("placeholderSelect", { label })}
        value={current[name]}
        onChange={(value) => handleFieldChange(name, value)}
        showSearch
        optionFilterProp="label"
        className={readOnly ? "license-transfer-form-readonly" : ""}
      >
        {options.map((option) => (
          <Option
            key={option.value}
            value={option.value}
            label={option.label}
          >
            {option.label}
          </Option>
        ))}
      </Select>
    </div>
  );

  const renderTextInput = (
    name: string,
    label: string,
    required: boolean = true,
    readOnly: boolean = false,
    maxLength?: number,
    placeholder?: string,
  ) => (
    <div className="license-transfer-form-field">
      {renderLabel(label, required)}
      <Input
        disabled={disabled || readOnly}
        placeholder={placeholder || tf("placeholderEnter", { label })}
        value={current[name] || ""}
        maxLength={maxLength}
        onChange={(e) => handleFieldChange(name, e.target.value)}
        className={readOnly ? "license-transfer-form-readonly" : ""}
      />
    </div>
  );

  const renderTextDisplay = (
    name: string,
    label: string,
    required: boolean = true,
  ) => (
    <div className="license-transfer-form-field">
      {renderLabel(label, required)}
      <Input
        disabled
        value={current[name] || ""}
        className="license-transfer-form-readonly"
      />
    </div>
  );

  const renderDatePicker = (
    name: string,
    label: string,
    required: boolean = true,
    readOnly: boolean = false,
    placeholder?: string,
  ) => (
    <div className="license-transfer-form-field">
      {renderLabel(label, required)}
      <DatePicker
        disabled={disabled || readOnly}
        style={{ width: "100%" }}
        format="DD/MM/YYYY"
        placeholder={placeholder || tf("phDateFormat")}
        value={current[name] ? moment(current[name], "YYYY-MM-DD") : null}
        onChange={(date) => {
          handleFieldChange(name, date?.format("YYYY-MM-DD") || null);
        }}
        className={readOnly ? "license-transfer-form-readonly" : ""}
      />
    </div>
  );

  const renderUpload = (
    name: string,
    label: string,
    required: boolean = true,
    accept: string = ".pdf",
    uploadTip: string = tf("uploadTipPdf"),
  ) => (
    <div className="license-transfer-form-field">
      {name === "personalPhoto" ? (
        <PersonalPhotoTooltip>{renderLabel(label, required)}</PersonalPhotoTooltip>
      ) : (
        renderLabel(label, required)
      )}
      <DocumentViewer
        hasDelete={true}
        disabled={disabled}
        value={current[name]}
        onChange={(value) => handleFieldChange(name, value)}
        uploadConfig={{
          maxCount: 1,
          maxSize: 5,
          uploadTip,
          accept,
          placeholder: tf("uploadPlaceholder"),
        }}
      />
    </div>
  );

  const renderVerificationFields = () => {
    if (identityType === "individual") {
      return (
        <Row gutter={24}>
          <Col span={12}>
            {renderDatePicker(
              "dateOfBirth",
              tf("labelDateOfBirth"),
              true,
              isVerified,
              tf("phDateFormat"),
            )}
          </Col>
          <Col span={12}>
            {renderTextInput(
              "emiratesId",
              tf("labelEmiratesId"),
              true,
              isVerified,
              undefined,
              tf("phEmiratesId"),
            )}
          </Col>
        </Row>
      );
    }

    return (
      <Row gutter={24}>
        <Col span={12}>
          {renderDatePicker(
            "licenseExpiryDate",
            tf("labelLicenseExpiryDate"),
            true,
            isVerified,
            tf("phDateFormat"),
          )}
        </Col>
        <Col span={12}>
          {renderTextInput(
            "commercialLicenseNumber",
            tf("labelCommercialLicenseNumber"),
            true,
            isVerified,
            50,
            tf("phEnterLicenseNumber"),
          )}
        </Col>
      </Row>
    );
  };

  const renderIndividualExpandedForm = () => (
    <>
      <div className="license-transfer-form-section-title">
        {tf("sectionBasicInformation")}
      </div>
      <Row gutter={24}>
        <Col span={12}>
          {renderTextDisplay("fullNameArabic", tf("labelFullNameArabic"), true)}
        </Col>
        <Col span={12}>
          {renderTextDisplay("fullNameEnglish", tf("labelFullNameEnglish"), true)}
        </Col>
      </Row>
      <Row gutter={24}>
        <Col span={12}>
          {renderTextDisplay("nationality", tf("labelNationality"), true)}
        </Col>
        <Col span={12}>
          {renderTextDisplay("gender", tf("labelGender"), true)}
        </Col>
      </Row>
      <Row gutter={24}>
        <Col span={12}>
          {renderTextInput("occupation", tf("labelOccupation"), false, false, 100)}
        </Col>
        <Col span={12}>
          {renderTextDisplay("expiryDate", tf("labelExpiryDate"), true)}
        </Col>
      </Row>

      <div className="license-transfer-form-section-title">
        {tf("sectionPersonalDocuments")}
      </div>
      <Row gutter={24}>
        <Col span={12}>
          {renderUpload(
            "personalPhoto",
            tf("labelPersonalPhoto"),
            true,
            ".jpg,.jpeg,.png",
            tf("uploadTipImage"),
          )}
        </Col>
        <Col span={12}>
          {renderUpload("emiratesIdFile", tf("labelEmiratesId"), true)}
        </Col>
      </Row>

      <div className="license-transfer-form-section-title">
        {tf("sectionAddressInformation")}
      </div>
      <Row gutter={24}>
        <Col span={12}>
          {renderSelect("addressEmirate", tf("labelEmirate"), emirateOptions, true)}
        </Col>
        <Col span={12}>
          {renderSelect("addressRegion", tf("labelRegion"), regionOptions, true)}
        </Col>
      </Row>
      <Row gutter={24}>
        <Col span={12}>
          {renderSelect("addressArea", tf("labelArea"), areaOptions, true)}
        </Col>
        <Col span={12}>
          {renderTextInput("addressStreet", tf("labelStreet"), true, false, 500)}
        </Col>
      </Row>
    </>
  );

  const renderEntityExpandedForm = () => (
    <>
      <div className="license-transfer-form-section-title">
        {tf("sectionBasicInformation")}
      </div>
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
            false,
            false,
            200,
          )}
        </Col>
      </Row>
      <Row gutter={24}>
        <Col span={12}>
          {renderSelect("emirate", tf("labelEmirate"), emirateOptions, true)}
        </Col>
        <Col span={12}>
          {renderSelect(
            "licensingAuthority",
            tf("labelLicensingAuthority"),
            licensingAuthorityOptions,
            true,
          )}
        </Col>
      </Row>
      <Row gutter={24}>
        <Col span={12}>
          <div className="license-transfer-form-field">
            {renderLabel(tf("labelPhoneNumber"), true)}
            <CompositeMobileNumberField
              fieldNames={{
                fullNumber: "phoneNumber",
                countryCode: "phoneNumberCountryCode",
                localNumber: "phoneNumberLocalNumber",
              }}
              fullNumber={current.phoneNumber}
              countryCode={current.phoneNumberCountryCode}
              localNumber={current.phoneNumberLocalNumber}
              disabled={disabled}
              required
              placeholder={tf("placeholderEnter", {
                label: tf("labelPhoneNumber"),
              })}
              requiredMessage={tf("validationPhoneNumberRequired")}
              invalidMessage={tf("validationPhoneNumberInvalid")}
              onChange={(patch) => field.setValue({ ...current, ...patch })}
            />
          </div>
        </Col>
        <Col span={12}>
          {renderDatePicker(
            "tenancyContractEndDate",
            tf("labelTenancyContractEndDate"),
            true,
          )}
        </Col>
      </Row>

      <div className="license-transfer-form-section-title">
        {tf("sectionEstablishmentDocuments")}
      </div>
      <Row gutter={24}>
        <Col span={12}>
          {renderUpload(
            "commercialLicenseFile",
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
        <Col span={12} />
      </Row>

      <div className="license-transfer-form-section-title">
        {tf("sectionLegalPersonInformation")}
      </div>
      <Row gutter={24}>
        <Col span={12}>
          {renderTextInput("legalPerson", tf("labelLegalPerson"), true, false, 100)}
        </Col>
        <Col span={12}>
          <div className="license-transfer-form-field">
            {renderLabel(tf("labelLegalPersonContact"), true)}
            <CompositeMobileNumberField
              fieldNames={{
                fullNumber: "legalPersonContact",
                countryCode: "legalPersonContactCountryCode",
                localNumber: "legalPersonContactLocalNumber",
              }}
              fullNumber={current.legalPersonContact}
              countryCode={current.legalPersonContactCountryCode}
              localNumber={current.legalPersonContactLocalNumber}
              disabled={disabled}
              required
              placeholder={tf("placeholderEnter", {
                label: tf("labelLegalPersonContact"),
              })}
              requiredMessage={tf("validationPhoneNumberRequired")}
              invalidMessage={tf("validationPhoneNumberInvalid")}
              onChange={(patch) => field.setValue({ ...current, ...patch })}
            />
          </div>
        </Col>
      </Row>
      <Row gutter={24}>
        <Col span={12}>
          {renderSelect("legalPersonIdType", tf("labelIdType"), idTypeOptions, true)}
        </Col>
        <Col span={12}>
          {renderTextInput(
            "legalPersonEmiratesId",
            tf("labelEmiratesId"),
            true,
            false,
          )}
        </Col>
      </Row>
      <Row gutter={24}>
        <Col span={12}>
          {renderDatePicker(
            "legalPersonDateOfBirth",
            tf("labelDateOfBirth"),
            true,
          )}
        </Col>
        <Col span={12}>
          {renderTextInput("legalPersonEmail", tf("labelEmail"), true, false)}
        </Col>
      </Row>

      <div className="license-transfer-form-section-title">
        {tf("sectionAddressInformation")}
      </div>
      <Row gutter={24}>
        <Col span={12}>
          {renderSelect("addressEmirate", tf("labelEmirate"), emirateOptions, true)}
        </Col>
        <Col span={12}>
          {renderSelect("addressRegion", tf("labelRegion"), regionOptions, true)}
        </Col>
      </Row>
      <Row gutter={24}>
        <Col span={12}>
          {renderSelect("addressArea", tf("labelArea"), areaOptions, true)}
        </Col>
        <Col span={12}>
          {renderTextInput("addressStreet", tf("labelStreet"), true, false, 500)}
        </Col>
      </Row>
    </>
  );

  return (
    <div className="license-transfer-form-container" {...restProps}>
      <AntdCard
        className="license-transfer-form-card"
        title={tf("defaultCardTitle")}
      >
        <Alert
          message={alertMessage}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          className="license-transfer-form-alert"
        />

        {verificationErrorKey && (
          <Alert
            message={tf(verificationErrorKey)}
            type="error"
            showIcon
            className="license-transfer-form-error"
          />
        )}

        {renderVerificationFields()}

        {isVerified && (
          <div className="license-transfer-form-expanded">
            {identityType === "individual"
              ? renderIndividualExpandedForm()
              : renderEntityExpandedForm()}
          </div>
        )}
      </AntdCard>
    </div>
  );
});

LicenseTransferFormField.displayName = "LicenseTransferFormField";

export default LicenseTransferFormField;
