import React, { useCallback, useEffect, useMemo } from "react";
import { observer, useField, useForm } from "@formily/react";
import { Radio } from "antd";
import type { RadioChangeEvent } from "antd";
import "./styles.less";
import EmiratesIdFields from "./sections/EmiratesIdFields";
import PassportFields from "./sections/PassportFields";
import UidFields from "./sections/UidFields";
import {
  type IDSelectorFieldProps,
  type IDSelectorValue,
  type IdSelectorType,
  SUB_FIELD_NAMES,
  getAvailableOptions,
  getShowList,
  normalizeIdSelectorValue,
  resolveCurrentType,
  withLegacyAddressFields,
} from "./idSelectorUtils";
import useIdSelectorIcp from "./useIdSelectorIcp";
import useIdSelectorValidators from "./useIdSelectorValidators";
import { useIDSelectorLabels } from "./useIdSelectorLabels";
import { useFormLanguageHost } from "@/components/designable/playground/FormPreviewLangContext";
import { getPressCardIdSelectorType } from "@/components/common/formilyActivityRules";

interface FeedbackSubField {
  setFeedback: (feedback: { type: string; messages: string[] }) => void;
  setValidator: (validator: (value: unknown) => string) => void;
}

interface FormilyFieldLike {
  value?: unknown;
  address: string;
  pattern?: string;
  setValue: (value: IDSelectorValue) => void;
  query: (pattern: string) => { take: () => FeedbackSubField | undefined };
}

export const IDSelectorField: React.FC<IDSelectorFieldProps> = observer((props) => {
  const {
    showEmiratesId,
    showPassport,
    showUID,
    serviceCode,
    editableFieldKeys,
    passportMode = "default",
  } = props;
  const labels = useIDSelectorLabels();
  const host = useFormLanguageHost();
  const field = useField() as unknown as FormilyFieldLike;
  const form = useForm();
  const activityRestrictedType =
    Number(serviceCode) === 1801
      ? getPressCardIdSelectorType(form.values)
      : undefined;
  const current = useMemo(
    () =>
      normalizeIdSelectorValue(
        ((field.value || {}) as IDSelectorValue),
        passportMode,
      ),
    [field.value, passportMode],
  );
  const availableOptions = useMemo(
    () =>
      getAvailableOptions({
        showEmiratesId:
          activityRestrictedType === undefined
            ? showEmiratesId
            : activityRestrictedType === "emiratesId",
        showPassport:
          activityRestrictedType === undefined
            ? showPassport
            : activityRestrictedType === "passport",
        showUID: activityRestrictedType === undefined ? showUID : false,
      }).map(
        (option) => ({
          ...option,
          label:
            option.value === "emiratesId"
              ? labels.optionEmiratesId
              : option.value === "uid"
                ? labels.optionUid
                : labels.optionPassport,
        }),
      ),
    [
      activityRestrictedType,
      labels,
      showEmiratesId,
      showPassport,
      showUID,
    ],
  );
  const currentType = useMemo(
    () => resolveCurrentType(current, availableOptions),
    [availableOptions, current],
  );
  const isReviewMode = field.pattern === "readPretty";
  const isFormLocked =
    form.pattern === "disabled" ||
    form.pattern === "readOnly" ||
    form.pattern === "readPretty";
  const isDisabled =
    !!props.disabled ||
    field.pattern === "disabled" ||
    field.pattern === "readOnly" ||
    isReviewMode ||
    isFormLocked;
  const editableFieldKeySet = useMemo(
    () => new Set(editableFieldKeys || []),
    [editableFieldKeys],
  );
  const hasEditRestriction = editableFieldKeySet.size > 0;
  const isTypeSelectionDisabled = isDisabled || hasEditRestriction;

  useEffect(() => {
    if (
      activityRestrictedType &&
      !isDisabled &&
      current.type !== activityRestrictedType
    ) {
      field.setValue({ type: activityRestrictedType });
    }
  }, [activityRestrictedType, current.type, field, isDisabled]);

  const isFieldEditable = useCallback(
    (key: keyof IDSelectorValue) => {
      if (isDisabled) return false;
      if (!hasEditRestriction) return true;
      return editableFieldKeySet.has(key);
    },
    [editableFieldKeySet, hasEditRestriction, isDisabled],
  );

  const {
    nationalityList,
    lookupStateMap,
    isIcpInfoLoaded,
    triggerQuery,
  } = useIdSelectorIcp({
    field,
    current,
    currentType,
    onIcpLoadedChange: props.onIcpLoadedChange,
  });

  const showList = getShowList(currentType, lookupStateMap[currentType], current);

  useIdSelectorValidators({
    field,
    current,
    currentType,
    passportMode,
    showList,
  });

  const handleTypeChange = useCallback(
    (event: RadioChangeEvent) => {
      if (isTypeSelectionDisabled) return;
      const nextType = event.target.value as IdSelectorType;

      SUB_FIELD_NAMES.forEach((fieldName) => {
        const subField = field.query(`${field.address}.${fieldName}`).take();
        if (subField) {
          subField.setFeedback({
            type: "error",
            messages: [],
          });
        }
      });

      field.setValue({
        type: nextType,
      });
    },
    [field, isTypeSelectionDisabled],
  );

  const handleFieldChange = useCallback(
    <K extends keyof IDSelectorValue>(key: K, value: IDSelectorValue[K]) => {
      if (!isFieldEditable(key)) return;
      field.setValue(withLegacyAddressFields({
        ...current,
        type: currentType,
        [key]: value,
      }, passportMode));
    },
    [current, currentType, field, isFieldEditable, passportMode],
  );

  const handleFieldsChange = useCallback(
    (
      value: Partial<IDSelectorValue>,
      editableKey: keyof IDSelectorValue,
    ) => {
      if (!isFieldEditable(editableKey)) return;
      field.setValue(
        withLegacyAddressFields(
          {
            ...current,
            type: currentType,
            ...value,
          },
          passportMode,
        ),
      );
    },
    [current, currentType, field, isFieldEditable, passportMode],
  );

  const commonSectionProps = {
    current,
    showList,
    showQueryButton: !isDisabled && !hasEditRestriction,
    isFieldEditable,
    nationalityList,
    passportMode,
    onFieldChange: handleFieldChange,
    onFieldsChange: handleFieldsChange,
    onQuery: () => triggerQuery(currentType),
    queryLoading: lookupStateMap[currentType].status === "loading",
    isQuerySuccess: isIcpInfoLoaded,
  };

  const renderFields = () => {
    if (currentType === "uid") return <UidFields {...commonSectionProps} />;
    if (currentType === "passport") {
      return <PassportFields {...commonSectionProps} />;
    }
    return <EmiratesIdFields {...commonSectionProps} />;
  };

  return (
    <div
      className={`idselector-container${
        host === "designer" ? " idselector-container--designer" : ""
      }`}
    >
      {activityRestrictedType === undefined && (
        <Radio.Group
          value={currentType}
          onChange={handleTypeChange}
          disabled={isTypeSelectionDisabled}
          className="idselector-radio-group"
        >
          {availableOptions.map((option) => (
            <Radio
              key={option.value}
              value={option.value}
              disabled={isTypeSelectionDisabled}
            >
              {option.label}
            </Radio>
          ))}
        </Radio.Group>
      )}
      {renderFields()}
    </div>
  );
});

export default IDSelectorField;
