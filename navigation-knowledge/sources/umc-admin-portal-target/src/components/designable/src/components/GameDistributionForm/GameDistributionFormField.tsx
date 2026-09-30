import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { observer, useField, useForm, Field } from "@formily/react";
import { FormItem } from "@formily/antd";
import { Checkbox, Input, Select, Row, Col, Radio, Card as AntdCard, DatePicker, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import moment from "moment";
import DocumentViewer from "../../../../../components/common/DocumentViewer/index";
import { LanguageSelect as LanguageSelectComponent } from "../LanguageSelect/LanguageSelect";
import {
  getAgeRatingPermitByIds,
  getArtistWorkTypesByServiceCode,
  getAgeRatingPermitByProfileId,
  getLookupData,
  type AgeRatingPermitOption,
} from "../../../../../services/services";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import {
  getReadOnlyMultiSelectProps,
  isNonEditablePattern,
} from "@/components/designable/src/utils/readOnlyMultiSelect";
import i18n from "@/localization/config";
import { getNationalityList, type NationalityInfo } from "@/services/userProfile";
import { useUserStore } from "@/store/user";
import { preferLocalizedEnAr } from "@/utils/bilingualDisplay";
import { toPickerMoment } from "@/utils/dateLocale";
import "./styles.less";

const { Option } = Select;
const { RangePicker } = DatePicker;

type GameDistributionFormValue = {
  ageRatingPermit?: string | number;
  addDigitalVersion?: string;
  title?: string;
  type?: string;
  language?: string;
  source?: string;
  copyrightsType?: string;
  copyrightsValidityPeriod?: [string, string];
  economyCertificate?: unknown;
  gamePlatform?: string[];
  gameMaterialContent?: unknown;
  [key: string]: unknown;
};

type GameDistributionFormFormilyField = {
  value?: GameDistributionFormValue;
  setValue: (value: GameDistributionFormValue) => void;
  display?: string;
  designable?: boolean;
};

type OptionType = {
  label: string;
  value: number | string;
  [key: string]: unknown;
};

type ValidationVisibility = boolean | (() => boolean);

type GameDistributionFormFieldProps = React.HTMLAttributes<HTMLDivElement> & {
  disabled?: boolean;
  serviceCode?: string | number;
  [key: string]: unknown;
};

type RawLookupItem = Record<string, unknown>;

type LocalizedPermitField =
  | "label"
  | "title"
  | "type"
  | "language"
  | "source"
  | "copyrightsType";

const LOCALIZED_VALUE_KEYS: Record<string, string> = {
  English: "optionLanguageEnglish",
  "Arabic, English": "optionLanguageArabicEnglish",
};

export const GameDistributionFormField: React.FC<GameDistributionFormFieldProps> = observer((props) => {
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
  const field = useField() as GameDistributionFormFormilyField | undefined;
  const form = useForm();
  if (!field) {
    return null;
  }
  const fieldPattern = (field as { pattern?: string } | undefined)?.pattern;
  const isReadOnlyMode =
    isNonEditablePattern(fieldPattern) ||
    isNonEditablePattern(form.pattern);
  const readOnlyMultiSelectProps = getReadOnlyMultiSelectProps({
    isMultiple: true,
    isReadOnly: isReadOnlyMode,
    defaultMaxTagCount: 2,
  });

  const i18nLng =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const isDesignerHost = host === "designer";
  const tf = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(
        i18n.t(`GameDistributionForm.${key}`, {
          lng: i18nLng,
          ...(options ?? {}),
        }),
      ),
    [i18nLng],
  );
  const isAr = i18nLng === "ar";
  const currentProfileId = useUserStore((state) => state.currentProfileId);
  const current = useMemo(() => (field.value || {}) as GameDistributionFormValue, [field.value]);
  const [permitRows, setPermitRows] = useState<AgeRatingPermitOption[]>([]);
  const [gamePlatformRows, setGamePlatformRows] = useState<RawLookupItem[]>([]);
  const [artistWorkTypeRows, setArtistWorkTypeRows] = useState<RawLookupItem[]>([]);
  const [copyrightsTypeRows, setCopyrightsTypeRows] = useState<RawLookupItem[]>([]);
  const [sourceRows, setSourceRows] = useState<NationalityInfo[]>([]);

  const getLocalizedStaticDisplay = React.useCallback(
    (value: unknown) => {
      const rawValue = String(value ?? "").trim();
      const key = LOCALIZED_VALUE_KEYS[rawValue];
      return key ? tf(key) : rawValue;
    },
    [tf],
  );

  const getLocalizedPermitField = React.useCallback(
    (
      item: AgeRatingPermitOption | undefined,
      fieldName: LocalizedPermitField,
      fallback?: unknown,
    ) => {
      const record = item as Record<string, unknown> | undefined;
      const en = record?.[`${fieldName}En`] ?? record?.[fieldName] ?? fallback;
      const ar = record?.[`${fieldName}Ar`];
      const localized = preferLocalizedEnAr(
        isAr,
        String(en ?? ""),
        ar === undefined || ar === null ? undefined : String(ar),
      );
      return getLocalizedStaticDisplay(localized || fallback);
    },
    [getLocalizedStaticDisplay, isAr],
  );

  const permitOptions = useMemo<OptionType[]>(
    () =>
      permitRows.map((item) => ({
        ...item,
        label: getLocalizedPermitField(item, "label") || item.label,
      })),
    [getLocalizedPermitField, permitRows],
  );

  const getLookupLabel = React.useCallback(
    (item: RawLookupItem) =>
      preferLocalizedEnAr(
        isAr,
        String(item.nameEn ?? item.NameEn ?? item.labelEn ?? item.label ?? ""),
        String(item.nameAr ?? item.NameAr ?? item.labelAr ?? ""),
        ) || String(item.id ?? item.Id ?? item.value ?? ""),
    [isAr],
  );

  const gamePlatformOptions = useMemo<OptionType[]>(
    () =>
      gamePlatformRows.map((item) => ({
        label: getLookupLabel(item),
        value:
          (item.code as string | number | undefined) ??
          (item.Code as string | number | undefined) ??
          (item.id as string | number | undefined) ??
          (item.Id as string | number | undefined) ??
          "",
        ...item,
      })),
    [gamePlatformRows, getLookupLabel],
  );

  const getNormalizedValue = React.useCallback(
    (value: unknown) => String(value ?? "").trim().toLowerCase(),
    [],
  );

  const getLookupDisplayByValue = React.useCallback(
    (rows: RawLookupItem[], value: unknown) => {
      const normalizedValue = getNormalizedValue(value);
      if (!normalizedValue) {
        return getLocalizedStaticDisplay(value);
      }

      const matched = rows.find((item) =>
        [
          item.id,
          item.Id,
          item.value,
          item.Value,
          item.code,
          item.Code,
        ].some((candidate) => getNormalizedValue(candidate) === normalizedValue),
      );

      return matched ? getLookupLabel(matched) : getLocalizedStaticDisplay(value);
    },
    [getLocalizedStaticDisplay, getLookupLabel, getNormalizedValue],
  );

  const getSourceDisplayByValue = React.useCallback(
    (value: unknown) => {
      const normalizedValue = getNormalizedValue(value);
      if (!normalizedValue) {
        return getLocalizedStaticDisplay(value);
      }

      const matched = sourceRows.find((item) =>
        [
          item.id,
          item.numericCode,
          item.isocode2,
          item.isocode3,
          item.nameEn,
          item.nameAr,
          item.fullNameEn,
          item.fullNameAr,
        ].some((candidate) => getNormalizedValue(candidate) === normalizedValue),
      );

      return matched
        ? (
            preferLocalizedEnAr(
              isAr,
              matched.nameEn || matched.fullNameEn,
              matched.nameAr || matched.fullNameAr,
            ) || String(matched.id)
          )
        : getLocalizedStaticDisplay(value);
    },
    [getLocalizedStaticDisplay, getNormalizedValue, isAr, sourceRows],
  );

  const getPermitReadonlyDisplay = React.useCallback(
    (
      fieldName: Exclude<LocalizedPermitField, "label" | "language">,
      item: AgeRatingPermitOption | undefined,
      fallback?: unknown,
    ) => {
      if (fieldName === "title") {
        return getLocalizedPermitField(item, fieldName, fallback);
      }

      const record = item as Record<string, unknown> | undefined;
      const hasExplicitLocalizedValue =
        record?.[`${fieldName}En`] !== undefined ||
        record?.[`${fieldName}Ar`] !== undefined;

      if (hasExplicitLocalizedValue) {
        return getLocalizedPermitField(item, fieldName, fallback);
      }

      const rawValue = record?.[fieldName] ?? fallback;
      if (fieldName === "type") {
        return getLookupDisplayByValue(artistWorkTypeRows, rawValue);
      }
      if (fieldName === "source") {
        return getSourceDisplayByValue(rawValue);
      }
      return getLookupDisplayByValue(copyrightsTypeRows, rawValue);
    },
    [
      artistWorkTypeRows,
      copyrightsTypeRows,
      getLocalizedPermitField,
      getLookupDisplayByValue,
      getSourceDisplayByValue,
    ],
  );

  const selectedPermit = useMemo(
    () =>
      permitRows.find(
        (item) => String(item.value) === String(current.ageRatingPermit ?? ""),
      ),
    [current.ageRatingPermit, permitRows],
  );

  const isComponentVisible = field.display !== "none" && field.display !== "hidden";
  const isFieldDisplayed = React.useCallback(
    () => field.display !== "none" && field.display !== "hidden",
    [field],
  );

  const hasValue = React.useCallback((value: unknown) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
    return value !== undefined && value !== null && value !== "";
  }, []);

  const shouldValidateField = React.useCallback(
    (
      required: boolean,
      visible: boolean | (() => boolean) = true,
    ) => {
      const isVisible = typeof visible === "function" ? visible() : visible;
      return required && isVisible && isFieldDisplayed();
    },
    [isFieldDisplayed],
  );

  const clearFields = React.useCallback(
    (
      baseValue: GameDistributionFormValue,
      keys: Array<keyof GameDistributionFormValue>,
    ) => {
      const nextValue = { ...baseValue };
      keys.forEach((item) => {
        delete nextValue[item];
      });
      return nextValue;
    },
    [],
  );

  const getInputValue = React.useCallback((value: unknown) => {
    if (typeof value === "string" || typeof value === "number") return value;
    return "";
  }, []);

  const getStoredRangeValue = React.useCallback((value: unknown) => {
    if (!Array.isArray(value) || value.length !== 2) return null;
    const [start, end] = value;
    return [
      start ? toPickerMoment(String(start), "YYYY-MM-DD") : null,
      end ? toPickerMoment(String(end), "YYYY-MM-DD") : null,
    ] as [moment.Moment | null, moment.Moment | null];
  }, []);

  const getUploadValue = React.useCallback((value: unknown) => {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      return value as string[];
    }
    return undefined;
  }, []);

  const hasPermitValue = React.useCallback(
    () => Boolean(((field.value || {}) as GameDistributionFormValue).ageRatingPermit),
    [field],
  );

  const isDigitalVersion = current.addDigitalVersion === "Yes";

  useEffect(() => {
    if (isDesignerHost) return;
    if (!isComponentVisible || current.addDigitalVersion !== undefined) return;
    field.setValue({
      ...current,
      addDigitalVersion: "No",
    });
  }, [current, field, isComponentVisible, isDesignerHost]);

  useEffect(() => {
    if (isDesignerHost) {
      setPermitRows([]);
      return;
    }

    const profileId = String(currentProfileId || "").trim();
    const permitId = String(current.ageRatingPermit ?? "").trim();
    const loadSavedPermit = Boolean(props.disabled && permitId);
    if (!profileId && !loadSavedPermit) {
      setPermitRows([]);
      return;
    }

    let cancelled = false;
    const request = loadSavedPermit
      ? getAgeRatingPermitByIds(permitId)
      : getAgeRatingPermitByProfileId(profileId, props.serviceCode);

    request
      .then((rows) => {
        if (!cancelled) {
          setPermitRows(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPermitRows([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [current.ageRatingPermit, currentProfileId, isDesignerHost, props.disabled, props.serviceCode]);

  useEffect(() => {
    if (isDesignerHost) {
      setGamePlatformRows([]);
      setArtistWorkTypeRows([]);
      setCopyrightsTypeRows([]);
      setSourceRows([]);
      return;
    }

    let cancelled = false;

    getLookupData("GamePlatform").then((res) => {
      if (!cancelled) {
        const rows = Array.isArray(res?.data)
          ? (res.data as Array<Record<string, unknown>>)
          : [];
        setGamePlatformRows(rows);
      }
    });

    getArtistWorkTypesByServiceCode(props.serviceCode)
      .then((res) => {
        if (!cancelled) {
          const rows = Array.isArray(res?.data)
            ? (res.data as Array<Record<string, unknown>>)
            : [];
          setArtistWorkTypeRows(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArtistWorkTypeRows([]);
        }
      });

    getLookupData("CopyrightsTypes")
      .then((res) => {
        if (!cancelled) {
          const rows = Array.isArray(res?.data)
            ? (res.data as Array<Record<string, unknown>>)
            : [];
          setCopyrightsTypeRows(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCopyrightsTypeRows([]);
        }
      });

    getNationalityList()
      .then((res) => {
        if (!cancelled) {
          setSourceRows(Array.isArray(res?.data) ? res.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSourceRows([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isDesignerHost, props.serviceCode]);

  useEffect(() => {
    if (isDesignerHost) return;
    if (isComponentVisible || !hasValue(current)) return;
    field.setValue({});
  }, [current, field, hasValue, isComponentVisible, isDesignerHost]);

  const handleFieldChange = (key: string, value: unknown) => {
    let newValue: GameDistributionFormValue = {
      ...((field.value || {}) as GameDistributionFormValue),
      [key]: value,
    };

    if (key === "addDigitalVersion" && value === "No") {
      newValue = clearFields(newValue, ["gamePlatform", "gameMaterialContent"]);
    }

    if (key === "ageRatingPermit") {
      const selectedPermit = permitRows.find(
        (p) => String(p.value) === String(value ?? ""),
      );
      if (selectedPermit) {
        newValue.title = selectedPermit.title;
        newValue.type = selectedPermit.type;
        newValue.language = selectedPermit.language;
        newValue.source = selectedPermit.source;
        newValue.copyrightsType = selectedPermit.copyrightsType;
        newValue.copyrightsValidityPeriod = selectedPermit.copyrightsValidityPeriod;
        newValue.economyCertificate = selectedPermit.economyCertificate;
      } else {
        newValue = clearFields(newValue, [
          "title",
          "type",
          "language",
          "source",
          "copyrightsType",
          "copyrightsValidityPeriod",
          "economyCertificate",
        ]);
      }
    }

    field.setValue(newValue);
  };

  const renderLabel = (label: string, required: boolean = true, tooltip?: string) => (
    <div className="game-form-label">
      <span>
        {label}
        {required && <span className="game-form-required">*</span>}
      </span>
      {tooltip && (
        <Tooltip title={tooltip}>
          <QuestionCircleOutlined className="game-form-tooltip" />
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
    visible: ValidationVisibility = true
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (shouldValidateField(required, visible) && !value) {
            return tf("validationRequired", { label });
          }
          return "";
        }}
      >
        {renderLabel(label, required)}
        <Select
          disabled={props.disabled || disabled}
          placeholder={placeholder || label}
          value={current[name]}
          onChange={(value) => handleFieldChange(name, value)}
          showSearch
          optionFilterProp="children"
          className={disabled ? "game-form-readonly" : ""}
        >
          {options.map((o) => (
            <Option key={o.value} value={o.value}>
              {o.label}
            </Option>
          ))}
        </Select>
      </Field>
    );
  };

  const renderMultiSelect = (
    name: string,
    label: string,
    options: OptionType[],
    required: boolean = true,
    placeholder?: string,
    visible: ValidationVisibility = true
  ) => {
    const isRuntimeMultiSelect = field?.designable === false;
    const selectedValues: Array<string | number> = Array.isArray(current[name])
      ? current[name].filter(
          (item): item is string | number =>
            typeof item === "string" || typeof item === "number",
        )
      : [];
    const allSelected =
      options.length > 0 &&
      options.every((option) => selectedValues.includes(option.value));
    const hasSelectedValues = options.some((option) =>
      selectedValues.includes(option.value),
    );
    const handleSelectAll = (checked: boolean) => {
      if (!isRuntimeMultiSelect || props.disabled || options.length === 0) return;
      handleFieldChange(
        name,
        checked ? options.map((option) => option.value) : [],
      );
    };
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value: unknown) => {
          if (shouldValidateField(required, visible) && (!Array.isArray(value) || value.length === 0))
            return tf("validationRequired", { label });
          return "";
        }}
      >
        {renderLabel(label, required)}
        <Select
          mode="multiple"
          maxTagCount={readOnlyMultiSelectProps.maxTagCount}
          maxTagPlaceholder={readOnlyMultiSelectProps.maxTagPlaceholder}
          disabled={props.disabled}
          placeholder={
            placeholder ||
            label
          }
          value={current[name]}
          onChange={(value) => handleFieldChange(name, value)}
          showSearch
          optionFilterProp={isRuntimeMultiSelect ? "title" : "children"}
          optionLabelProp={isRuntimeMultiSelect ? "label" : undefined}
          className={
            isRuntimeMultiSelect
              ? "umc-select-arrow-manual game-distribution-multi-select"
              : "umc-select-arrow-manual"
          }
          dropdownClassName={
            isRuntimeMultiSelect
              ? "game-distribution-multi-select-dropdown"
              : undefined
          }
          dropdownRender={
            isRuntimeMultiSelect
              ? (menu) => (
                  <div>
                    <div className="game-distribution-multi-select-all">
                      <Checkbox
                        className={
                          hasSelectedValues && !allSelected
                            ? "game-distribution-multi-select-all-checkbox has-selection"
                            : "game-distribution-multi-select-all-checkbox"
                        }
                        checked={allSelected}
                        disabled={props.disabled || options.length === 0}
                        onChange={(event) =>
                          handleSelectAll(event.target.checked)
                        }
                      >
                        {i18n.t("LanguageSelectMulti.selectAll", {
                          lng: i18nLng,
                        })}
                      </Checkbox>
                    </div>
                    <div>{menu}</div>
                  </div>
                )
              : undefined
          }
        >
          {options.map((o) => (
            <Option
              key={o.value}
              value={o.value}
              title={o.label}
              label={
                isRuntimeMultiSelect ? (
                  <div className="game-distribution-multi-selection-item">
                    <Checkbox checked />
                    <span>{o.label}</span>
                  </div>
                ) : undefined
              }
            >
              {isRuntimeMultiSelect ? (
                <div className="game-distribution-multi-option">
                  <Checkbox checked={selectedValues.includes(o.value)} />
                  <span>{o.label}</span>
                </div>
              ) : (
                o.label
              )}
            </Option>
          ))}
        </Select>
      </Field>
    );
  };

  const renderTextInput = (
    name: string,
    label: string,
    required: boolean = true,
    disabled: boolean = false,
    maxLength?: number,
    placeholder?: string,
    displayValue?: string,
    visible: ValidationVisibility = true
  ) => {
    const isInputDisabled = props.disabled || disabled;
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (shouldValidateField(required, visible) && !value) {
            return tf("validationRequired", { label });
          }
          return "";
        }}
      >
        {renderLabel(label, required)}
        <Input
          disabled={isInputDisabled}
          placeholder={placeholder || label}
          value={
            isInputDisabled && displayValue !== undefined
              ? displayValue
              : getInputValue(current[name])
          }
          maxLength={maxLength}
          onChange={(e) => handleFieldChange(name, e.target.value)}
          className={disabled ? "game-form-readonly" : ""}
        />
      </Field>
    );
  };

  const renderRadio = (
    name: string,
    label: string,
    options: { label: string; value: string }[],
    required: boolean = true,
    visible: ValidationVisibility = true
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (shouldValidateField(required, visible) && !value) {
            return tf("validationRequired", { label });
          }
          return "";
        }}
      >
        {renderLabel(label, required)}
        <Radio.Group
          disabled={props.disabled}
          value={current[name]}
          onChange={(e) => handleFieldChange(name, e.target.value)}
          className="game-form-radio"
        >
          {options.map((o) => (
            <Radio key={o.value} value={o.value}>
              {o.label}
            </Radio>
          ))}
        </Radio.Group>
      </Field>
    );
  };

  const renderDateRangePicker = (
    name: string,
    label: string,
    required: boolean = true,
    visible: ValidationVisibility = true
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value: unknown) => {
          if (shouldValidateField(required, visible) && (!Array.isArray(value) || value.length !== 2))
            return tf("validationRequired", { label });
          if (Array.isArray(value) && value.length === 2) {
            const [start, end] = value;
            if (moment(start).isBefore(moment(), "day")) {
              return tf("validationStartDateTodayOrLater");
            }
            if (moment(end).isSameOrBefore(moment(start), "day")) {
              return tf("validationEndDateAfterStart");
            }
          }
          return "";
        }}
      >
        {renderLabel(label, required)}
        <RangePicker
          disabled={props.disabled}
          style={{ width: "100%" }}
          format="DD/MM/YYYY"
          placeholder={[
            tf("phStartDate"),
            tf("phEndDate"),
          ]}
          value={getStoredRangeValue(current[name])}
          onChange={(dates) => {
            if (dates && dates.length === 2) {
              handleFieldChange(name, [
                dates[0]?.format("YYYY-MM-DD"),
                dates[1]?.format("YYYY-MM-DD"),
              ]);
            } else {
              handleFieldChange(name, undefined);
            }
          }}
          disabledDate={(currentDate) => currentDate && currentDate < moment().startOf("day")}
        />
      </Field>
    );
  };

  const renderUpload = (
    name: string,
    label: string,
    required: boolean = true,
    tooltip?: string,
    visible: ValidationVisibility = true
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (shouldValidateField(required, visible) && !value) {
            return tf("validationRequired", { label });
          }
          return "";
        }}
      >
        {renderLabel(label, required, tooltip)}
        <DocumentViewer
          hasDelete={true}
          disabled={props.disabled}
          value={getUploadValue(current[name])}
          onChange={(value) => handleFieldChange(name, value)}
          uploadConfig={{
            maxCount: 1,
            maxSize: 5,
            uploadTip: tf("uploadTip"),
            accept: ".pdf,.jpg,.jpeg,.png",
          }}
        />
      </Field>
    );
  };

  const renderLanguageSelect = (
    name: string,
    label: string,
    required: boolean = true,
    disabled: boolean = false,
    visible: ValidationVisibility = true
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (shouldValidateField(required, visible) && !value) {
            return tf("validationRequired", { label });
          }
          return "";
        }}
      >
        {renderLabel(label, required)}
        <LanguageSelectComponent
          className={`game-form-language ${disabled ? "game-form-readonly" : ""}`}
          disabled={props.disabled || disabled}
          multiple={true}
          placeholder={label}
          value={
            current[name]
              ? typeof current[name] === "string"
                ? current[name]
                    .split(",")
                    .map((v: string) => Number(v.trim()) || v.trim())
                : current[name]
              : undefined
          }
          onChange={(value: unknown) => handleFieldChange(name, value)}
        />
      </Field>
    );
  };

  return (
    <div className="game-distribution-form-container" {...props}>
      <AntdCard
        title={
          <span data-content-editable="x-component-props.title">
            {tf("defaultCardTitle")}
          </span>
        }
      >
        <Row gutter={24}>
          <Col span={12}>
            {renderSelect(
              "ageRatingPermit",
              tf("labelAgeRatingPermit"),
              permitOptions,
              true,
              false,
              tf("phAgeRatingPermit")
            )}
          </Col>
          <Col span={12}>
            {renderRadio(
              "addDigitalVersion",
              tf("labelAddDigitalVersion"),
              [
                { label: tf("optionYes"), value: "Yes" },
                { label: tf("optionNo"), value: "No" },
              ],
              true
            )}
          </Col>

          {isDigitalVersion && (
            <Col span={12}>
              {renderMultiSelect(
                "gamePlatform",
                tf("labelGamePlatform"),
                gamePlatformOptions,
                true,
                tf("phGamePlatform"),
                isDigitalVersion
              )}
            </Col>
          )}

          <Col span={12}>
            {renderTextInput(
              "title",
              tf("labelTitle"),
              true,
              true,
              200,
              tf("phTitle"),
              getPermitReadonlyDisplay("title", selectedPermit, current.title),
              hasPermitValue
            )}
          </Col>

          <Col span={12}>
            {renderTextInput(
              "type",
              tf("labelType"),
              true,
              true,
              undefined,
              tf("phType"),
              getPermitReadonlyDisplay("type", selectedPermit, current.type),
              hasPermitValue
            )}
          </Col>

          <Col span={12}>
            {renderLanguageSelect(
              "language",
              tf("labelLanguage"),
              true,
              true,
              hasPermitValue
            )}
          </Col>

          <Col span={12}>
            {renderTextInput(
              "source",
              tf("labelSource"),
              true,
              true,
              undefined,
              tf("phSource"),
              getPermitReadonlyDisplay("source", selectedPermit, current.source),
              hasPermitValue
            )}
          </Col>

          <Col span={12}>
            {renderTextInput(
              "copyrightsType",
              tf("labelCopyrightsType"),
              true,
              true,
              undefined,
              tf("phCopyrightsType"),
              getPermitReadonlyDisplay(
                "copyrightsType",
                selectedPermit,
                current.copyrightsType,
              ),
              hasPermitValue
            )}
          </Col>

          <Col span={12}>
            {renderDateRangePicker(
              "copyrightsValidityPeriod",
              tf("labelCopyrightsValidityPeriod"),
              true
            )}
          </Col>

          <Col span={12}>
            {renderUpload(
              "economyCertificate",
              tf("labelEconomyCertificate"),
              true,
              tf("tooltipEconomyCertificate")
            )}
          </Col>

          {isDigitalVersion && (
            <Col span={12}>
              {renderUpload(
                "gameMaterialContent",
                tf("labelGameMaterialContent"),
                true,
                tf("tooltipGameMaterialContent"),
                isDigitalVersion
              )}
            </Col>
          )}
        </Row>
      </AntdCard>
    </div>
  );
});

GameDistributionFormField.displayName = "GameDistributionFormField";

export default GameDistributionFormField;
