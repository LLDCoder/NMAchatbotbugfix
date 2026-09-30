import type { Field, FieldValidator, Form } from "@formily/core";
import { observer, useField, useForm } from "@formily/react";
import { useEffect, useRef, useState } from "react";
import {
  buildContactNumberDraft,
  createContactNumberSnapshot,
  StandaloneMobileNumberInput,
  validateMobileNumber,
} from "@/components/common/MobileNumberInput";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import { useResolvedMobileNumberDefaultCountryCode } from "./runtimeContext";
import { resolveMobileNumberSchemaFieldNames } from "./schemaContract";
import "./styles.less";

export interface MobileNumberInputFieldProps {
  disabled?: boolean;
  required?: boolean;
  defaultCountryCode?: string;
  countryCodeFieldName?: string;
  localNumberFieldName?: string;
  placeholder?: string;
  placeholderEn?: string;
  placeholderAr?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}

const getSiblingPath = (address: string, key: string) => {
  const segments = address.split(".");
  segments[segments.length - 1] = key;
  return segments.join(".");
};

const normalize = (value: unknown) => String(value ?? "");

interface MobileNumberValidationContext {
  form: Form;
  countryPath: string;
  localPath: string;
  defaultCountryCode: string;
  required: boolean;
}

const toValidatorList = (
  validator: FieldValidator | undefined,
): Exclude<FieldValidator, unknown[]>[] => {
  if (!validator) {
    return [];
  }
  return (Array.isArray(validator) ? validator : [validator]) as Exclude<
    FieldValidator,
    unknown[]
  >[];
};

export const MobileNumberInputField = observer(
  (props: MobileNumberInputFieldProps) => {
    const field = useField<Field>();
    const form = useForm();
    const lang = useFormPreviewLang();
    const host = useFormLanguageHost();
    const address = field.address.toString();
    const fieldName = address.split(".").at(-1) || "phoneNumber";
    const fieldNames = resolveMobileNumberSchemaFieldNames(fieldName, props);
    const countryPath = getSiblingPath(address, fieldNames.countryCode);
    const localPath = getSiblingPath(address, fieldNames.localNumber);
    const storedCountryCode = normalize(form.getValuesIn(countryPath));
    const splitLocalNumber = normalize(form.getValuesIn(localPath));
    const legacyFullNumber = normalize(field.value);
    const defaultCountryCode = useResolvedMobileNumberDefaultCountryCode(
      props.defaultCountryCode,
    );
    const [draftCountryCode, setDraftCountryCode] = useState<string | null>(
      null,
    );
    const snapshot = createContactNumberSnapshot({
      countryCode: storedCountryCode,
      localNumber: splitLocalNumber,
      fullNumber: legacyFullNumber,
    });
    const isLegacyValue = snapshot.sourceMode === "legacy";
    const countryCode =
      draftCountryCode || snapshot.value.countryCode || defaultCountryCode;
    const phoneNumber = snapshot.value.phoneNumber;
    const placeholder = getBilingualValueByLang({
      lang,
      host,
      en: props.placeholderEn,
      ar: props.placeholderAr,
      legacy: props.placeholder,
      fallback: "",
    });
    const disabled =
      props.disabled ||
      field.pattern === "disabled" ||
      field.pattern === "readOnly" ||
      field.pattern === "readPretty" ||
      form.pattern === "disabled" ||
      form.pattern === "readOnly" ||
      form.pattern === "readPretty";
    const required = props.required === true || field.required === true;
    const validationContextRef = useRef<MobileNumberValidationContext>({
      form,
      countryPath,
      localPath,
      defaultCountryCode,
      required,
    });
    const formatValidatorRef = useRef<
      ((value: unknown) => string) | undefined
    >();
    const updateSequenceRef = useRef(0);
    const validationQueueRef = useRef<Promise<void>>(Promise.resolve());

    validationContextRef.current = {
      form,
      countryPath,
      localPath,
      defaultCountryCode,
      required,
    };

    useEffect(() => {
      const subscription = form.subscribe(({ type, payload }) => {
        if (
          type === "onFormReset" ||
          (type === "onFieldReset" && payload === field)
        ) {
          setDraftCountryCode(null);
        }
      });
      return () => form.unsubscribe(subscription);
    }, [field, form]);

    useEffect(() => {
      if (snapshot.sourceMode !== "empty" && draftCountryCode !== null) {
        setDraftCountryCode(null);
      }
    }, [draftCountryCode, snapshot.sourceMode]);

    useEffect(() => {
      const currentCountryCode = normalize(form.getValuesIn(countryPath));
      const currentLocalNumber = normalize(form.getValuesIn(localPath));
      const currentFullNumber = normalize(field.value);
      if (!currentLocalNumber && !currentFullNumber && currentCountryCode) {
        form.setValuesIn(countryPath, "");
      }
    }, [countryPath, field, form, localPath, storedCountryCode]);

    if (!formatValidatorRef.current) {
      formatValidatorRef.current = (value: unknown) => {
        const context = validationContextRef.current;
        const splitLocalNumberValue = normalize(
          context.form.getValuesIn(context.localPath),
        );

        if (!splitLocalNumberValue) {
          const legacyFullNumberValue = normalize(value);
          if (!legacyFullNumberValue) {
            return context.required
              ? validateMobileNumber({
                  countryCode: "",
                  phoneNumber: "",
                }).message
              : "";
          }

          const legacyValidation = validateMobileNumber({
            countryCode: "",
            phoneNumber: legacyFullNumberValue,
          });

          return legacyValidation.isValid ? "" : legacyValidation.message;
        }

        const validation = validateMobileNumber({
          countryCode:
            normalize(context.form.getValuesIn(context.countryPath)) ||
            context.defaultCountryCode,
          phoneNumber: splitLocalNumberValue,
        });

        return validation.isValid ? "" : validation.message;
      };
    }

    useEffect(() => {
      if (!isLegacyValue) return;

      form.setValuesIn(countryPath, snapshot.value.countryCode);
      form.setValuesIn(localPath, snapshot.value.phoneNumber);
    }, [
      countryPath,
      form,
      isLegacyValue,
      snapshot.value.countryCode,
      snapshot.value.phoneNumber,
      localPath,
    ]);

    useEffect(() => {
      if (!splitLocalNumber) return;

      const validation = validateMobileNumber({
        countryCode,
        phoneNumber: splitLocalNumber,
      });
      const draft = buildContactNumberDraft({
        currentFullNumber: legacyFullNumber,
        countryCode,
        localNumber: splitLocalNumber,
        changedField: "phoneNumber",
        isValid: validation.isValid,
      });

      const nextFieldValue = draft.fullNumber || splitLocalNumber;
      if (legacyFullNumber !== nextFieldValue) {
        field.setValue(nextFieldValue);
      }
    }, [countryCode, field, legacyFullNumber, splitLocalNumber]);

    useEffect(() => {
      const originalValidator = field.validator;
      const formatValidator = formatValidatorRef.current;
      if (!formatValidator) {
        return;
      }
      const installedValidator = [
        ...toValidatorList(originalValidator),
        formatValidator,
      ];
      const originalAsterisk = field.decoratorProps.asterisk;

      field.setDecoratorProps({
        ...field.decoratorProps,
        asterisk: required || originalAsterisk,
      });
      field.setValidator(installedValidator);
      return () => {
        updateSequenceRef.current += 1;
        field.setDecoratorProps({
          ...field.decoratorProps,
          asterisk: originalAsterisk,
        });

        const remainingValidators = toValidatorList(field.validator).filter(
          (validator) => validator !== formatValidator,
        );
        field.setValidator(remainingValidators);
      };
    }, [field, required]);

    const update = (
      nextCountryCode: string,
      nextPhoneNumber: string,
      changedField: "countryCode" | "phoneNumber",
    ) => {
      const normalizedCountryCode = normalize(nextCountryCode);
      const normalizedPhoneNumber = normalize(nextPhoneNumber);
      const validation = validateMobileNumber({
        countryCode: normalizedCountryCode,
        phoneNumber: normalizedPhoneNumber,
      });
      const draft = buildContactNumberDraft({
        currentFullNumber: legacyFullNumber,
        countryCode: normalizedCountryCode,
        localNumber: normalizedPhoneNumber,
        changedField,
        isValid: validation.isValid,
      });
      const updateSequence = ++updateSequenceRef.current;

      if (!normalizedPhoneNumber) {
        setDraftCountryCode(normalizedCountryCode);
      }
      if (normalizedPhoneNumber || changedField === "phoneNumber") {
        form.setValuesIn(countryPath, draft.countryCode);
        form.setValuesIn(localPath, draft.localNumber);
        field.setValue(draft.fullNumber || normalizedPhoneNumber);
      }
      field.modify();

      validationQueueRef.current = validationQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (updateSequence !== updateSequenceRef.current) {
            return;
          }

          try {
            await field.validate("onInput");
          } catch {
            // Formily stores validation failures on the field for FormItem display.
          }
        });
    };

    const updateCountryCode = (nextCountryCode: string) => {
      update(nextCountryCode, phoneNumber, "countryCode");
    };

    return (
      <div className="designable-mobile-number-input">
        <StandaloneMobileNumberInput
          countryCode={countryCode}
          phoneNumber={phoneNumber}
          defaultCountryCode={defaultCountryCode}
          disabled={disabled}
          hasError={field.errors.length > 0}
          placeholder={placeholder}
          searchPlaceholder={props.searchPlaceholder}
          emptyText={props.emptyText}
          onCountryCodeChange={updateCountryCode}
          onPhoneNumberChange={(value) =>
            update(countryCode, value, "phoneNumber")
          }
        />
      </div>
    );
  },
);
