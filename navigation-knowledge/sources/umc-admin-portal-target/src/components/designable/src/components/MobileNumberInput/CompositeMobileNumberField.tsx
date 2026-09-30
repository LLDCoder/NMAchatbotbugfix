import type { Field as FormilyField } from "@formily/core";
import { FormItem } from "@formily/antd";
import { Field, useForm } from "@formily/react";
import { useEffect, useState } from "react";
import {
  StandaloneMobileNumberInput,
  validateMobileNumber,
} from "@/components/common/MobileNumberInput";
import {
  buildContactNumberDraft,
  createContactNumberSnapshot,
  toContactNumberDraftFields,
  type ContactNumberChangedField,
} from "@/components/common/MobileNumberInput";
import { useResolvedMobileNumberDefaultCountryCode } from "./runtimeContext";

export interface CompositeMobileNumberFieldNames {
  fullNumber: string;
  countryCode: string;
  localNumber: string;
}

export interface CompositeMobileNumberFieldProps {
  fieldNames: CompositeMobileNumberFieldNames;
  fullNumber?: unknown;
  countryCode?: unknown;
  localNumber?: unknown;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  requiredMessage?: string;
  invalidMessage?: string;
  defaultCountryCode?: string;
  onChange: (patch: Record<string, string>) => void;
}

export const CompositeMobileNumberField = ({
  fieldNames,
  fullNumber,
  countryCode,
  localNumber,
  disabled = false,
  required = false,
  placeholder,
  searchPlaceholder,
  emptyText,
  requiredMessage,
  invalidMessage,
  defaultCountryCode,
  onChange,
}: CompositeMobileNumberFieldProps) => {
  const form = useForm();
  const resolvedDefaultCountryCode =
    useResolvedMobileNumberDefaultCountryCode(defaultCountryCode);
  const [draftCountryCode, setDraftCountryCode] = useState<string | null>(null);
  const snapshot = createContactNumberSnapshot({
    countryCode,
    localNumber,
    fullNumber,
  });

  useEffect(() => {
    const subscription = form.subscribe(({ type }) => {
      if (type === "onFormReset") {
        setDraftCountryCode(null);
      }
    });
    return () => form.unsubscribe(subscription);
  }, [form]);

  useEffect(() => {
    if (snapshot.sourceMode === "empty") {
      if (snapshot.value.countryCode) {
        onChange(
          toContactNumberDraftFields(
            { fullNumber: "", countryCode: "", localNumber: "" },
            fieldNames,
          ),
        );
      }
      return;
    }

    if (snapshot.sourceMode !== "split") return;

    const effectiveCountryCode =
      snapshot.value.countryCode || resolvedDefaultCountryCode;
    const validation = validateMobileNumber({
      countryCode: effectiveCountryCode,
      phoneNumber: snapshot.value.phoneNumber,
    });
    if (!validation.isValid) return;

    const draft = buildContactNumberDraft({
      currentFullNumber: fullNumber,
      countryCode: effectiveCountryCode,
      localNumber: snapshot.value.phoneNumber,
      changedField: "phoneNumber",
      isValid: true,
    });
    const patch = toContactNumberDraftFields(draft, fieldNames);
    const currentValues: Record<string, string> = {
      [fieldNames.fullNumber]: String(fullNumber ?? ""),
      [fieldNames.countryCode]: String(countryCode ?? ""),
      [fieldNames.localNumber]: String(localNumber ?? ""),
    };
    const needsSync = Object.entries(patch).some(
      ([key, value]) => currentValues[key] !== value,
    );

    if (needsSync) {
      onChange(patch);
    }
  }, [
    countryCode,
    fieldNames,
    fieldNames.countryCode,
    fieldNames.fullNumber,
    fieldNames.localNumber,
    fullNumber,
    localNumber,
    onChange,
    resolvedDefaultCountryCode,
    snapshot.sourceMode,
    snapshot.value,
    snapshot.value.countryCode,
    snapshot.value.phoneNumber,
  ]);

  const displayCountryCode =
    draftCountryCode ||
    snapshot.value.countryCode ||
    resolvedDefaultCountryCode;
  const displayPhoneNumber = snapshot.value.phoneNumber;
  useEffect(() => {
    if (snapshot.sourceMode !== "empty" && draftCountryCode !== null) {
      setDraftCountryCode(null);
    }
  }, [draftCountryCode, snapshot.sourceMode]);

  const update = (
    nextCountryCode: string,
    nextLocalNumber: string,
    changedField: ContactNumberChangedField,
  ) => {
    if (!nextLocalNumber) {
      setDraftCountryCode(nextCountryCode);
      if (changedField === "countryCode") return;
    }

    const validation = validateMobileNumber({
      countryCode: nextCountryCode,
      phoneNumber: nextLocalNumber,
    });
    const draft = buildContactNumberDraft({
      currentFullNumber: fullNumber,
      countryCode: nextCountryCode,
      localNumber: nextLocalNumber,
      changedField,
      isValid: validation.isValid,
    });

    onChange(toContactNumberDraftFields(draft, fieldNames));
  };

  return (
    <Field
      name={fieldNames.fullNumber}
      decorator={[FormItem]}
      validator={(value) => {
        const validation = validateMobileNumber({
          countryCode: displayCountryCode,
          phoneNumber: String(displayPhoneNumber || value || ""),
        });
        if (validation.isValid) return "";
        if (validation.errorCode === "REQUIRED") {
          return required ? requiredMessage || validation.message : "";
        }
        return invalidMessage || validation.message;
      }}
    >
      {(field: FormilyField) => (
        <StandaloneMobileNumberInput
          countryCode={displayCountryCode}
          phoneNumber={displayPhoneNumber}
          defaultCountryCode={resolvedDefaultCountryCode}
          disabled={disabled}
          hasError={field.errors.length > 0}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          onCountryCodeChange={(value) =>
            update(value, displayPhoneNumber, "countryCode")
          }
          onPhoneNumberChange={(value) =>
            update(displayCountryCode, value, "phoneNumber")
          }
        />
      )}
    </Field>
  );
};
