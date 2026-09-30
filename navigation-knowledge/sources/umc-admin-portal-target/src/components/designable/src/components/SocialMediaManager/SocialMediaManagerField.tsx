import React from "react";
import { useTranslation } from "react-i18next";
import { observer, useField, Field, useFieldSchema } from "@formily/react";
import { Radio, Card as AntdCard, Divider } from "antd";
import type { RadioChangeEvent } from "antd";
import { useServicesStore } from "@/store/services";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import i18n from "@/localization/config";
import { IDSelectorField } from "../IDSelector/IDSelectorField";
import type { IDSelectorValue } from "../IDSelector/idSelectorUtils";
import { SUB_FIELD_NAMES } from "../IDSelector/idSelectorUtils";
import type { GuardianConsentDetailsValue } from "../GuardianConsentDetails/GuardianConsentDetailsField";
import moment, { type Moment } from "moment";
import {
  FORMILY_COMPONENT_KEYS,
  FORMILY_SLOT_KEYS,
} from "@/components/common/FormliyView/runtimeSlots";
import { useFormilyRenderSlot } from "@/components/common/FormliyView/useFormilyRenderSlot";
import "./styles.less";

type SocialMediaManagerValue = {
  managesSocialMedia?: string;
  idSelector?: IDSelectorValue;
  guardianConsentDetails?: GuardianConsentDetailsValue;
};

type FormilyFeedback = {
  type: string;
  messages: string[];
};

type ResettableField = {
  setFeedback?: (feedback: FormilyFeedback) => void;
  setValidator?: (validator: (value: unknown) => string) => void;
  setValue?: (value: unknown) => void;
  setState?: (updater: (state: Record<string, unknown>) => void) => void;
};

type SocialMediaManagerFormField = {
  address: string;
  value?: SocialMediaManagerValue;
  setValue: (value: SocialMediaManagerValue) => void;
  query: (pattern: string) => { take: () => ResettableField | undefined };
};

type SocialMediaManagerFieldProps = {
  disabled?: boolean;
  editable?: boolean;
  showEmiratesId?: boolean;
  showUID?: boolean;
  showPassport?: boolean;
  [key: string]: unknown;
};

const ELIGIBLE_MIN_AGE = 15;
const ELIGIBLE_MAX_AGE = 18;
const GUARDIAN_SUB_FIELD_NAMES: Array<keyof GuardianConsentDetailsValue> = [
  "consentFile",
  "fullName",
  "passportNumber",
  "nationalityId",
  "guardianDateOfBirth",
  "gender",
  "occupation",
  "email",
  "phoneNumber",
  "phoneNumberCountryCode",
  "phoneNumberLocalNumber",
];

const parseDateValue = (value: unknown): Moment | null => {
  if (!value) return null;
  if (moment.isMoment(value)) return value.clone();
  if (value instanceof Date) return moment(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const strictFormats = [
      "YYYY-MM-DD",
      "YYYY-MM-DDTHH:mm:ss",
      "YYYY-MM-DDTHH:mm:ss.SSSZ",
      "DD/MM/YYYY",
    ];
    for (const format of strictFormats) {
      const parsed = moment(trimmed, format, true);
      if (parsed.isValid()) return parsed;
    }
    const loose = moment(trimmed);
    return loose.isValid() ? loose : null;
  }
  return null;
};

const computeAge = (value: unknown): number | null => {
  const parsed = parseDateValue(value);
  if (!parsed) return null;
  return moment().diff(parsed, "years", true);
};

const shouldShowGuardianByDob = (value: unknown) => {
  const age = computeAge(value);
  return age != null && age >= ELIGIBLE_MIN_AGE && age < ELIGIBLE_MAX_AGE;
};

const hasAnyGuardianValue = (
  value: GuardianConsentDetailsValue | undefined,
) => {
  if (!value) return false;
  return Object.values(value).some((item) => {
    if (typeof item === "number") return true;
    return String(item ?? "").trim() !== "";
  });
};

export const SocialMediaManagerField: React.FC<SocialMediaManagerFieldProps> =
  observer((props) => {
    const host = useFormLanguageHost();
    const contentLang = useFormContentLang();
    const { i18n: i18nReact } = useTranslation();
    const field = useField<SocialMediaManagerFormField>();
    const fieldSchema = useFieldSchema();
    const renderSlot = useFormilyRenderSlot();
    if (!field) return null;

    const current = React.useMemo<SocialMediaManagerValue>(
      () => field.value || {},
      [field.value],
    );
    const {
      disabled = false,
      editable = true,
      showEmiratesId = true,
      showPassport = true,
      showUID = true,
    } = props;
    const isEditable = editable && !disabled;
    const previewLang =
      host === "designer"
        ? contentLang
        : mapDesignerLanguageToContentLang(i18nReact.language);
    const tf = React.useCallback(
      (key: string) =>
        String(
          i18n.t(`SocialMediaManager.${key}`, {
            lng: previewLang,
          }),
        ),
      [previewLang],
    );
    const serviceCode = String(
      useServicesStore((state) => state.userInfo.servicesCode ?? ""),
    ).trim();
    const shouldHideUID =
      serviceCode === "8006" ||
      serviceCode === "8007" ||
      serviceCode === "80011" ||
      serviceCode === "80012" ||
      serviceCode === "80021";
    const effectiveShowUID = shouldHideUID ? false : showUID;
    // The instance id lets the host add label content to this exact schema field.
    const rawDesignableId = (
      fieldSchema as unknown as Record<string, unknown> | undefined
    )?.["x-designable-id"];
    const designableId =
      typeof rawDesignableId === "string" ? rawDesignableId : undefined;
    const labelExtra = renderSlot?.({
      componentKey: FORMILY_COMPONENT_KEYS.SOCIAL_MEDIA_MANAGER,
      designableId,
      slotKey: FORMILY_SLOT_KEYS.LABEL_EXTRA,
      componentProps: props,
    });
    const guardianDob = current.idSelector?.dateOfBirth;
    const shouldShowGuardian =
      current.managesSocialMedia === "No" &&
      shouldShowGuardianByDob(guardianDob);
    const previousShouldShowGuardianRef = React.useRef(shouldShowGuardian);

    const resetFieldState = React.useCallback(
      (path: string) => {
        const targetField = field.query(path).take();
        if (!targetField) return;

        targetField.setFeedback?.({
          type: "error",
          messages: [],
        });
        targetField.setValidator?.(() => "");
        targetField.setValue?.(undefined);
        targetField.setState?.((state) => {
          state.selfErrors = [];
          state.selfWarnings = [];
          state.selfSuccesses = [];
          state.selfValidating = false;
          state.validating = false;
        });
      },
      [field],
    );

    const clearIdSelectorState = React.useCallback(() => {
      resetFieldState(`${field.address}.idSelector`);
      SUB_FIELD_NAMES.forEach((fieldName) => {
        resetFieldState(`${field.address}.idSelector.${fieldName}`);
      });
    }, [field.address, resetFieldState]);

    const clearGuardianState = React.useCallback(() => {
      resetFieldState(`${field.address}.guardianConsentDetails`);
      GUARDIAN_SUB_FIELD_NAMES.forEach((fieldName) => {
        resetFieldState(`${field.address}.guardianConsentDetails.${fieldName}`);
      });
    }, [field.address, resetFieldState]);

    const handleRadioChange = (e: RadioChangeEvent) => {
      const val = e.target.value;
      const newValue: SocialMediaManagerValue = {
        ...current,
        managesSocialMedia: val,
      };
      if (val === "Yes") {
        clearIdSelectorState();
        clearGuardianState();
        newValue.idSelector = undefined;
        newValue.guardianConsentDetails = undefined;
      }
      field.setValue(newValue);
    };

    React.useEffect(() => {
      if (!shouldShowGuardian) {
        const wasVisible = previousShouldShowGuardianRef.current;
        const hasGuardianValue = hasAnyGuardianValue(
          current.guardianConsentDetails,
        );

        if (wasVisible || hasGuardianValue) {
          clearGuardianState();
        }

        if (hasGuardianValue) {
          field.setValue({
            ...current,
            guardianConsentDetails: undefined,
          });
        }
      }

      previousShouldShowGuardianRef.current = shouldShowGuardian;
    }, [clearGuardianState, current, field, shouldShowGuardian]);

    const content = (
      <>
        <div className="smm-field-item">
          <div className="smm-field-item__header">
            <div className="smm-label">
              {tf("labelDoesAccountOwnerManageSocialMedia")}
              <span className="smm-required">*</span>
            </div>
            {labelExtra ? (
              <div className="smm-field-item__label-extra">{labelExtra}</div>
            ) : null}
          </div>
          <Radio.Group
            className="smm-radio-group"
            disabled={!isEditable}
            value={current.managesSocialMedia}
            onChange={handleRadioChange}
          >
            <Radio value="Yes">{tf("optionYes")}</Radio>
            <Radio value="No">{tf("optionNo")}</Radio>
          </Radio.Group>
        </div>

        {current.managesSocialMedia === "No" && (
          <>
            <Divider />
            <Field
              name="idSelector"
              component={[
                IDSelectorField,
                {
                  disabled,
                  editable,
                  showEmiratesId,
                  showUID: effectiveShowUID,
                  showPassport,
                },
              ]}
            />
            {/* {shouldShowGuardian && (
            <>
              <Divider />
              <Field
                name="guardianConsentDetails"
                component={[
                  GuardianConsentDetailsField,
                  {
                    disabled,
                    disableAutoVisibility: true,
                  },
                ]}
              />
            </>
          )} */}
          </>
        )}
      </>
    );

    return (
      <div className="social-media-manager-container" {...props}>
        {!isEditable ? (
          content
        ) : (
          <AntdCard title={tf("defaultCardTitle")}>{content}</AntdCard>
        )}
      </div>
    );
  });

SocialMediaManagerField.displayName = "SocialMediaManagerField";

export default SocialMediaManagerField;
