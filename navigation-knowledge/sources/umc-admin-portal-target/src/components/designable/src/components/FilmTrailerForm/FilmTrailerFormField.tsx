import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { observer, useField, useForm, Field } from "@formily/react";
import { FormItem } from "@formily/antd";
import { Input, Select, Row, Col, Card as AntdCard, DatePicker, Tooltip, Radio } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import moment from "moment";
import DocumentViewer from "../../../../../components/common/DocumentViewer/index";
import {
  getArtistWorkTypesByServiceCode,
  getLookupData,
  getPosterTrailerPermitByIds,
  type TODOPermitOption,
} from "@/services/services";
import { getTypeDictionaries, type TypeDictionary } from "@/services/form";
import { getNationalityList, type NationalityInfo } from "@/services/userProfile";
import { CountryDropdown } from "../CountryDropdown/CountryDropdown";
import LanguageSelectMulti from "../LanguageSelectMulti/LanguageSelectMulti";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import {
  getBilingualValueByLang,
  getEditableTitlePathByLang,
} from "@/components/designable/src/utils/bilingual";
import i18n from "@/localization/config";
import { useServicesStore } from "@/store/services";
import { preferLocalizedEnAr } from "@/utils/bilingualDisplay";
import { toPickerMoment } from "@/utils/dateLocale";
import { normalizeLookupOptions } from "@/utils/lookupOptions";
import DurationInput from "../DurationInput/DurationInput";
import { isDurationHmsValue } from "../DurationInput/utils";
import "./styles.less";

const { Option } = Select;
const { RangePicker } = DatePicker;

type FilmTrailerFormValue = {
  posterTrailerPermit?: string;
  requestType?: string;
  applyingPermitForLocalCinematicFilms?: "Yes" | "No";
  filmDirector?: string;
  filmWriter?: string;
  writerEmiratesId?: string;
  writerNationalityId?: number;
  title?: string;
  category?: string;
  languages?: Array<string | number>;
  originCountry?: string;
  copyrightsType?: string;
  durationInMinutes?: string;
  permitValidityPeriod?: [string, string];
  ministryOfEconomyRegistrationCertificate?: string;
  writerEmiratesIdCopy?: string;
  movieMaterialContent?: unknown;
  [key: string]: unknown;
};

type OptionType = {
  label: string;
  value: number | string;
  matchValues?: Array<number | string>;
  [key: string]: unknown;
};

type FilmTrailerFormFieldProps = React.HTMLAttributes<HTMLDivElement> & {
  disabled?: boolean;
  titleEn?: string;
  titleAr?: string;
  title?: string;
};

type FilmTrailerFormValueMap = FilmTrailerFormValue & Record<string, unknown>;

type FilmTrailerFormFormilyField = {
  value?: FilmTrailerFormValue;
  setValue: (value: FilmTrailerFormValue) => void;
  address: string | { toString: () => string };
};

type LocalizedPermitField =
  | "label"
  | "title"
  | "category"
  | "languages"
  | "originCountry"
  | "copyrightsType";

const LOCALIZED_VALUE_KEYS: Record<string, string> = {
  Action: "action",
  Drama: "drama",
  English: "english",
  Arabic: "arabic",
  Japanese: "japanese",
  USA: "usa",
  UAE: "uae",
  Japan: "japan",
  "Cinema Distribution": "cinemaDistribution",
  "Programs Distribution": "programsDistribution",
};

const unwrapNationalities = (res: unknown): NationalityInfo[] => {
  const rows = (res as { data?: unknown[] })?.data;
  return Array.isArray(rows) ? (rows as NationalityInfo[]) : [];
};

const normalizeLanguageIds = (value: unknown): Array<string | number> => {
  const values = Array.isArray(value) ? value : [value];

  return values.reduce<Array<string | number>>((result, item) => {
    const candidates = typeof item === "string" ? item.split(",") : [item];

    candidates.forEach((candidate) => {
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        result.push(candidate);
        return;
      }

      if (typeof candidate !== "string") {
        return;
      }

      const normalized = candidate.trim();
      if (!normalized) {
        return;
      }

      result.push(
        /^-?\d+(\.\d+)?$/.test(normalized)
          ? Number(normalized)
          : normalized,
      );
    });

    return result;
  }, []);
};

export const FilmTrailerFormField: React.FC<FilmTrailerFormFieldProps> = observer((props) => {
  const { titleEn, titleAr, title, ...restProps } = props;
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
  const form = useForm();
  const field = useField() as FilmTrailerFormFormilyField | undefined;
  if (!field) {
    return null;
  }

  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const isAr = previewLang === "ar";
  const serviceCode = useServicesStore((state) => state.userInfo.servicesCode);
  const current = useMemo(
    () => {
      const currentValue = (field.value || {}) as FilmTrailerFormValueMap;
      return {
        ...currentValue,
        languages: normalizeLanguageIds(currentValue.languages),
      };
    },
    [field.value],
  );
  const [permitOptions, setPermitOptions] = useState<TODOPermitOption[]>([]);
  const [nationalityOptions, setNationalityOptions] = useState<NationalityInfo[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<OptionType[]>([]);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = useState(false);
  const [copyrightsTypeOptions, setCopyrightsTypeOptions] = useState<OptionType[]>([]);
  const [copyrightsTypeOptionsLoading, setCopyrightsTypeOptionsLoading] = useState(false);
  const [requestTypeDictionaries, setRequestTypeDictionaries] = useState<TypeDictionary[]>([]);
  const [requestTypeOptionsLoading, setRequestTypeOptionsLoading] = useState(false);
  const tf = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(
        i18n.t(`FilmTrailerForm.${key}`, {
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

  const getLocalizedStaticDisplay = React.useCallback(
    (value: unknown) => {
      const rawValue = String(value ?? "").trim();
      const key = LOCALIZED_VALUE_KEYS[rawValue];
      return key ? tf(`value.${key}`, { defaultValue: rawValue }) : rawValue;
    },
    [tf],
  );

  const matchesOptionValue = React.useCallback(
    (
      option: Pick<OptionType, "value" | "matchValues"> | undefined,
      value: unknown,
    ) => {
      if (option === undefined || value === undefined || value === null || value === "") {
        return false;
      }

      return [option.value, ...(option.matchValues ?? [])].some(
        (candidate) => String(candidate) === String(value),
      );
    },
    [],
  );

  const getLocalizedPermitField = React.useCallback(
    (
      item: TODOPermitOption | undefined,
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

  useEffect(() => {
    let cancelled = false;
    const permitIds =
      current.posterTrailerPermit === undefined || current.posterTrailerPermit === null
        ? ""
        : String(current.posterTrailerPermit);

    getPosterTrailerPermitByIds(permitIds)
      .then((options) => {
        if (!cancelled) {
          setPermitOptions(options);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPermitOptions([]);
        }
      });

    getNationalityList()
      .then((res) => {
        if (!cancelled) {
          setNationalityOptions(unwrapNationalities(res));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNationalityOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [current.posterTrailerPermit]);

  useEffect(() => {
    const normalizedServiceCode = Number(serviceCode ?? 0);
    if (!normalizedServiceCode) {
      setCategoryOptions([]);
      return;
    }

    let cancelled = false;
    setCategoryOptionsLoading(true);

    getArtistWorkTypesByServiceCode(normalizedServiceCode)
      .then((res) => {
        if (!cancelled) {
          setCategoryOptions(
            normalizeLookupOptions(res, isAr).map((item) => ({
              label: item.label,
              value: String(item.value),
            })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCategoryOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCategoryOptionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAr, serviceCode]);

  useEffect(() => {
    const normalizedServiceCode = Number(serviceCode ?? 0);
    if (!normalizedServiceCode) {
      setCopyrightsTypeOptions([]);
      return;
    }

    let cancelled = false;
    setCopyrightsTypeOptionsLoading(true);

    getLookupData("CopyrightsTypes", normalizedServiceCode)
      .then((res) => {
        if (!cancelled) {
          setCopyrightsTypeOptions(
            normalizeLookupOptions(res, isAr).map((item) => ({
              label: item.label,
              value: String(item.value),
            })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCopyrightsTypeOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCopyrightsTypeOptionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAr, serviceCode]);

  useEffect(() => {
    let cancelled = false;
    setRequestTypeOptionsLoading(true);

    getTypeDictionaries("PosterTrailerTypes")
      .then((res) => {
        if (!cancelled) {
          setRequestTypeDictionaries(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRequestTypeDictionaries([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRequestTypeOptionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const writerNationalitySelectOptions = useMemo(
    () =>
      nationalityOptions.map((item) => ({
        label:
          preferLocalizedEnAr(
            isAr,
            item.nameEn || item.fullNameEn,
            item.nameAr || item.fullNameAr,
          ) || String(item.id),
        value: item.id,
      })),
    [isAr, nationalityOptions]
  );

  const permitSelectOptions = useMemo<OptionType[]>(
    () =>
      permitOptions.map((item, index) => ({
        label: tf(`permitOptions.${index}`, {
          defaultValue: getLocalizedPermitField(item, "label") || item.label,
        }),
        value: String(item.value),
        matchValues: item.matchValues,
      })),
    [getLocalizedPermitField, permitOptions, tf]
  );

  const requestTypeOptions = useMemo<OptionType[]>(
    () =>
      requestTypeDictionaries.map((item) => ({
        label:
          preferLocalizedEnAr(isAr, item.nameEn, item.nameAr) ||
          String(item.code ?? ""),
        value: String(item.code ?? ""),
      })),
    [isAr, requestTypeDictionaries],
  );

  const isLocalCinematic = current.applyingPermitForLocalCinematicFilms === "Yes";
  const selectedPermit = useMemo(
    () =>
      permitOptions.find(
        (item) => matchesOptionValue(item, current.posterTrailerPermit),
      ),
    [current.posterTrailerPermit, matchesOptionValue, permitOptions],
  );

  useEffect(() => {
    const fieldBasePath = String(field.address);
    const conditionalFieldNames: Array<keyof FilmTrailerFormValue> = [
      "writerEmiratesId",
      "writerNationalityId",
      "writerEmiratesIdCopy",
    ];

    conditionalFieldNames.forEach((name) => {
      form.setFieldState(`${fieldBasePath}.${String(name)}`, (state) => {
        state.display = isLocalCinematic ? "visible" : "none";
        state.required = isLocalCinematic;
        state.selfErrors = [];
        state.selfWarnings = [];
        state.selfSuccesses = [];
        state.validating = false;

        if (!isLocalCinematic) {
          state.validator = undefined;
        }
      });
    });
  }, [field.address, form, isLocalCinematic]);

  const applyPermitValue = (selectedPermit?: TODOPermitOption) => {
    if (!selectedPermit) {
      return {
        title: undefined,
        category: undefined,
        languages: [],
        originCountry: undefined,
        copyrightsType: undefined,
        durationInMinutes: undefined,
        permitValidityPeriod: undefined,
        applyingPermitForLocalCinematicFilms: undefined,
        filmDirector: undefined,
        filmWriter: undefined,
        writerEmiratesId: undefined,
        writerNationalityId: undefined,
        ministryOfEconomyRegistrationCertificate: undefined,
        writerEmiratesIdCopy: undefined,
      };
    }

    const nextValue: Partial<FilmTrailerFormValue> = {
      requestType: selectedPermit.requestType,
      title: selectedPermit.title,
      category: selectedPermit.category,
      languages: selectedPermit.languages,
      originCountry: selectedPermit.originCountry,
      copyrightsType: selectedPermit.copyrightsType,
      durationInMinutes: selectedPermit.durationInMinutes,
      permitValidityPeriod: selectedPermit.permitValidityPeriod,
      applyingPermitForLocalCinematicFilms:
        selectedPermit.applyingPermitForLocalCinematicFilms,
      filmDirector: selectedPermit.filmDirector,
      filmWriter: selectedPermit.filmWriter,
      ministryOfEconomyRegistrationCertificate:
        selectedPermit.ministryOfEconomyRegistrationCertificate,
    };

    if (selectedPermit.applyingPermitForLocalCinematicFilms === "Yes") {
      nextValue.writerEmiratesId = selectedPermit.writerEmiratesId;
      nextValue.writerNationalityId = selectedPermit.writerNationalityId;
      nextValue.writerEmiratesIdCopy = selectedPermit.writerEmiratesIdCopy;
    } else {
      nextValue.writerEmiratesId = undefined;
      nextValue.writerNationalityId = undefined;
      nextValue.writerEmiratesIdCopy = undefined;
    }

    return nextValue;
  };

  const handleFieldChange = (key: string, value: unknown) => {
    const newValue: FilmTrailerFormValue = {
      ...current,
      [key]: value,
    };

    if (key === "posterTrailerPermit") {
      const selectedPermit = permitOptions.find(
        (p) => matchesOptionValue(p, value),
      );
      Object.assign(newValue, applyPermitValue(selectedPermit));
    }

    field.setValue(newValue);
  };

  const getSelectValue = (value: unknown, options: OptionType[]) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const matchedOption = options.find(
      (option) => matchesOptionValue(option, value),
    );

    return matchedOption ? matchedOption.value : value;
  };

  const renderLabel = (label: string, required: boolean = true, tooltip?: string) => (
    <div className="film-trailer-form-label">
      <span>
        {label}
        {required && <span className="film-trailer-form-required">*</span>}
      </span>
      {tooltip && (
        <Tooltip title={tooltip}>
          <QuestionCircleOutlined className="film-trailer-form-tooltip" />
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
    loading: boolean = false
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) return tf("validation.required");
          return "";
        }}
      >
        {renderLabel(label, required)}
        <Select
          disabled={props.disabled || disabled}
          loading={loading}
          placeholder={placeholder || tf("placeholder.select", { label })}
          value={getSelectValue(current[name], options) as string | number | undefined}
          onChange={(value) => handleFieldChange(name, value)}
          showSearch
          optionFilterProp="children"
          allowClear={!required}
          className={disabled ? "film-trailer-form-readonly" : ""}
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

  const renderTextInput = (
    name: string,
    label: string,
    required: boolean = true,
    disabled: boolean = false,
    placeholder?: string,
    displayValue?: string
  ) => {
    const isInputDisabled = props.disabled || disabled;
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !String(value || "").trim())
            return tf("validation.required");
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
              : typeof current[name] === "string"
                ? current[name]
                : ""
          }
          onChange={(e) => handleFieldChange(name, e.target.value)}
          className={disabled ? "film-trailer-form-readonly" : ""}
        />
      </Field>
    );
  };

  const renderCountryDropdown = (
    name: string,
    label: string,
    required: boolean = true,
    disabled: boolean = false,
    placeholder?: string
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !String(value ?? "").trim()) {
            return tf("validation.required");
          }
          return "";
        }}
      >
        {renderLabel(label, required)}
        <CountryDropdown
          disabled={props.disabled || disabled}
          placeholder={placeholder || label}
          value={current[name] as string | undefined}
          onChange={(value: string) => handleFieldChange(name, value)}
          className={disabled ? "film-trailer-form-readonly" : ""}
        />
      </Field>
    );
  };

  const renderDurationInput = (
    name: string,
    label: string,
    required: boolean = true,
    disabled: boolean = false,
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) return tf("validation.required");
          if (value && !isDurationHmsValue(value)) {
            return tf("validation.durationFormat");
          }
          return "";
        }}
      >
        {renderLabel(label, required)}
        <DurationInput
          disabled={props.disabled || disabled}
          value={typeof current[name] === "string" ? current[name] : undefined}
          onChange={(value) => handleFieldChange(name, value)}
        />
      </Field>
    );
  };

  const renderDateRangePicker = (
    name: string,
    label: string,
    required: boolean = true,
    disabled: boolean = false
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && (!value || value.length !== 2))
            return tf("validation.required");
          if (value && value.length === 2) {
            const [start, end] = value;
            if (!disabled && moment(start).isBefore(moment(), "day")) {
              return tf("validation.startTodayOrLater");
            }
            if (!disabled && moment(end).isSameOrBefore(moment(start), "day")) {
              return tf("validation.endAfterStart");
            }
          }
          return "";
        }}
      >
        {renderLabel(label, required)}
        {(() => {
          const rangeValue = current[name];
          const normalizedRange =
            Array.isArray(rangeValue) && rangeValue.length === 2
              ? [
                  typeof rangeValue[0] === "string" ? rangeValue[0] : undefined,
                  typeof rangeValue[1] === "string" ? rangeValue[1] : undefined,
                ]
              : null;

          return (
        <RangePicker
          disabled={props.disabled || disabled}
          style={{ width: "100%" }}
          format="DD/MM/YYYY"
          placeholder={[
            tf("placeholder.startDate"),
            tf("placeholder.endDate"),
          ]}
          value={
            normalizedRange && normalizedRange.length === 2
              ? [
                  toPickerMoment(normalizedRange[0], "YYYY-MM-DD"),
                  toPickerMoment(normalizedRange[1], "YYYY-MM-DD"),
                ]
              : null
          }
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
          disabledDate={
            disabled
              ? undefined
              : (currentDate) => currentDate && currentDate < moment().startOf("day")
          }
        />
          );
        })()}
      </Field>
    );
  };

  const renderUpload = (
    name: string,
    label: string,
    required: boolean = true,
    tooltip?: string,
    maxSize: number = 5,
    accept?: string,
    uploadTip: string = tf("uploadTip.common")
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) return tf("validation.required");
          return "";
        }}
      >
        {renderLabel(label, required, tooltip)}
        <DocumentViewer
          hasDelete={true}
          disabled={props.disabled}
          value={current[name] as string | string[] | undefined}
          onChange={(value) => handleFieldChange(name, value)}
          uploadConfig={{
            maxCount: 1,
            maxSize: maxSize,
            uploadTip,
            accept: accept || ".pdf,.jpg,.jpeg,.png",
          }}
        />
      </Field>
    );
  };

  const renderLanguageSelect = (
    name: string,
    label: string,
    required: boolean = true,
    disabled: boolean = false
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && normalizeLanguageIds(value).length === 0) {
            return tf("validation.required");
          }
          return "";
        }}
      >
        {renderLabel(label, required)}
        <LanguageSelectMulti
          className={`film-trailer-form-language ${disabled ? "film-trailer-form-readonly" : ""}`}
          disabled={props.disabled || disabled}
          placeholder={label}
          value={current[name]}
          onChange={(value: unknown) =>
            handleFieldChange(name, normalizeLanguageIds(value))
          }
        />
      </Field>
    );
  };

  const renderRadioReadonly = (name: string, label: string, required: boolean = true) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) return tf("validation.required");
          return "";
        }}
      >
        {renderLabel(label, required)}
        <Radio.Group
          disabled
          value={current[name] as string | undefined}
          className="film-trailer-form-readonly"
        >
          <Radio value="Yes">{tf("common.yes")}</Radio>
          <Radio value="No">{tf("common.no")}</Radio>
        </Radio.Group>
      </Field>
    );
  };

  return (
    <div className="film-trailer-form-container" {...restProps}>
      <AntdCard
        title={
          <span data-content-editable={editableTitlePath}>
            {displayCardTitle}
          </span>
        }
      >
        <Row gutter={24}>
          <Col span={12}>
            {renderSelect(
              "posterTrailerPermit",
              tf("label.posterTrailerPermit"),
              permitSelectOptions,
              true,
              false,
              tf("placeholder.posterTrailerPermit")
            )}
          </Col>
          <Col span={12}>
            {renderSelect(
              "requestType",
              tf("label.requestType"),
              requestTypeOptions,
              false,
              false,
              tf("placeholder.requestType"),
              requestTypeOptionsLoading
            )}
          </Col>

          <Col span={12}>
            {renderRadioReadonly(
              "applyingPermitForLocalCinematicFilms",
              tf("label.applyingPermitForLocalCinematicFilms"),
              true
            )}
          </Col>
          <Col span={12}>
            {renderTextInput(
              "filmDirector",
              tf("label.filmDirector"),
              true,
              true,
              tf("placeholder.filmDirector")
            )}
          </Col>

          <Col span={12}>
            {renderTextInput(
              "filmWriter",
              tf("label.filmWriter"),
              true,
              true,
              tf("placeholder.filmWriter")
            )}
          </Col>
          {isLocalCinematic ? (
            <>
              <Col span={12}>
                {renderTextInput(
                  "writerEmiratesId",
                  tf("label.writerEmiratesId"),
                  true,
                  true,
                  tf("placeholder.writerEmiratesId")
                )}
              </Col>
              <Col span={12}>
                {renderSelect(
                  "writerNationalityId",
                  tf("label.writerNationality"),
                  writerNationalitySelectOptions,
                  true,
                  true,
                  tf("placeholder.writerNationality")
                )}
              </Col>
            </>
          ) : null}

          <Col span={12}>
            {renderTextInput(
              "title",
              tf("label.title"),
              true,
              true,
              tf("placeholder.title"),
              getLocalizedPermitField(selectedPermit, "title", current.title)
            )}
          </Col>
          <Col span={12}>
            {renderSelect(
              "category",
              tf("label.category"),
              categoryOptions,
              true,
              true,
              tf("placeholder.category"),
              categoryOptionsLoading,
            )}
          </Col>

          <Col span={12}>
            {renderLanguageSelect(
              "languages",
              tf("label.languages"),
              true,
              true
            )}
          </Col>
          <Col span={12}>
            {renderCountryDropdown(
              "originCountry",
              tf("label.originCountry"),
              true,
              true,
              tf("placeholder.originCountry"),
            )}
          </Col>

          <Col span={12}>
            {renderSelect(
              "copyrightsType",
              tf("label.copyrightsType"),
              copyrightsTypeOptions,
              true,
              true,
              tf("placeholder.copyrightsType"),
              copyrightsTypeOptionsLoading
            )}
          </Col>
          <Col span={12}>
            {renderDurationInput(
              "durationInMinutes",
              tf("label.durationInMinutes"),
              true,
              true,
            )}
          </Col>

          <Col span={12}>
            {renderDateRangePicker(
              "permitValidityPeriod",
              tf("label.permitValidityPeriod"),
              true,
              true
            )}
          </Col>
          <Col span={12}>
            {renderUpload(
              "ministryOfEconomyRegistrationCertificate",
              tf("label.ministryOfEconomyRegistrationCertificate"),
              true
            )}
          </Col>
          {isLocalCinematic ? (
            <Col span={12}>
              {renderUpload(
                "writerEmiratesIdCopy",
                tf("label.writerEmiratesIdCopy"),
                true
              )}
            </Col>
          ) : null}
          <Col span={12}>
            {renderUpload(
              "movieMaterialContent",
              tf("label.movieMaterialContent"),
              false,
              undefined,
              100,
              ".pdf,.jpg,.jpeg,.png,.mp4,.mov",
              tf("uploadTip.movieMaterialContent")
            )}
          </Col>
        </Row>
      </AntdCard>
    </div>
  );
});

FilmTrailerFormField.displayName = "FilmTrailerFormField";

export default FilmTrailerFormField;
