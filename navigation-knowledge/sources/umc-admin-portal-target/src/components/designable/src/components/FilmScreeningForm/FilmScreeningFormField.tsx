import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { observer, useField, Field } from "@formily/react";
import { FormItem } from "@formily/antd";
import { Input, Select, Row, Col, Card as AntdCard, DatePicker, Tooltip, Radio } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import moment from "moment";
import DocumentViewer from "../../../../../components/common/DocumentViewer/index";
import {
  getAgeRatingPermitByIds,
  getAgeRatingPermitByProfileId,
  getArtistWorkTypesByServiceCode,
  getLookupData,
  type AgeRatingPermitOption,
} from "@/services/services";
import { getNationalityList, type NationalityInfo } from "@/services/userProfile";
import { useUserStore } from "@/store/user";
import LanguageSelectMulti from "../LanguageSelectMulti/LanguageSelectMulti";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import { preferLocalizedEnAr } from "@/utils/bilingualDisplay";
import { toPickerMoment } from "@/utils/dateLocale";
import i18n from "@/localization/config";
import DurationInput from "../DurationInput/DurationInput";
import { isDurationHmsValue } from "../DurationInput/utils";
import { normalizeLookupOptions } from "@/utils/lookupOptions";
import "./styles.less";

const { Option } = Select;
const { RangePicker } = DatePicker;

type FilmScreeningFormValue = {
  ageRatingPermit?: string;
  applyingPermitForLocalCinematicFilms?: "Yes" | "No";
  filmDirector?: string;
  filmWriter?: string;
  writerEmiratesId?: string;
  nationalityId?: number;
  title?: string;
  type?: string;
  /** @deprecated Kept only for migrating previously saved form values. */
  language?: string | number | Array<string | number>;
  languages?: Array<string | number>;
  source?: string;
  copyrightsType?: string;
  durationInMinutes?: string;
  copyrightsValidityPeriod?: [string, string];
  economyCertificate?: string;
  writerEmiratesIdCopy?: string;
  [key: string]: unknown;
};

type OptionType = {
  label: string;
  value: number | string;
  [key: string]: unknown;
};

const NAME_REGEX = /^[\u4e00-\u9fa5a-zA-Z\s.'-]*$/;

const LOCALIZED_VALUE_KEYS: Record<string, string> = {
  "Distribution of electronic video games": "distributionOfElectronicVideoGames",
  "Programs Distribution": "programsDistribution",
  "Cinema Distribution": "cinemaDistribution",
  "Distribution of songs": "distributionOfSongs",
  "Distribution DVD, BD & 3DBD": "distributionDvdBd3dbd",
  USA: "usa",
  English: "english",
  "Arabic, English": "arabicEnglish",
};

type FilmScreeningFormFieldProps = React.HTMLAttributes<HTMLDivElement> & {
  disabled?: boolean;
  serviceCode?: string | number | null;
};

type FilmScreeningFormValueMap = FilmScreeningFormValue & Record<string, unknown>;

type FilmScreeningFormFormilyField = {
  value?: FilmScreeningFormValue;
  setValue: (value: FilmScreeningFormValue) => void;
};

const unwrapNationalities = (res: unknown): NationalityInfo[] => {
  const rows = (res as { data?: unknown[] })?.data;
  return Array.isArray(rows) ? (rows as NationalityInfo[]) : [];
};

const findOptionValue = (
  options: OptionType[],
  rawValue: unknown,
): string | number | undefined => {
  const normalizedValue = String(rawValue ?? "").trim();
  if (!normalizedValue) {
    return undefined;
  }

  return options.find((option) => String(option.value) === normalizedValue)?.value;
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

export const FilmScreeningFormField: React.FC<FilmScreeningFormFieldProps> = observer((props) => {
  const { serviceCode, disabled: formDisabled, ...divProps } = props;
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
  const field = useField() as FilmScreeningFormFormilyField | undefined;
  if (!field) {
    return null;
  }

  const i18nLng =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const isAr = i18nLng === "ar";
  const currentProfileId = useUserStore((state) => state.currentProfileId);
  const fieldValue = field.value;
  const current = useMemo<FilmScreeningFormValueMap>(
    () => {
      const currentValue = (fieldValue || {}) as FilmScreeningFormValueMap;
      const languageSource = Object.prototype.hasOwnProperty.call(
        currentValue,
        "languages",
      )
        ? currentValue.languages
        : currentValue.language;

      return {
        ...currentValue,
        languages: normalizeLanguageIds(languageSource),
      };
    },
    [fieldValue],
  );
  const [permitOptions, setPermitOptions] = useState<AgeRatingPermitOption[]>([]);
  const [nationalityOptions, setNationalityOptions] = useState<NationalityInfo[]>([]);
  const [typeOptions, setTypeOptions] = useState<OptionType[]>([]);
  const [copyrightsTypeOptions, setCopyrightsTypeOptions] = useState<OptionType[]>([]);
  const tf = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(
        i18n.t(`FilmScreeningForm.${key}`, {
          lng: i18nLng,
          ...(options ?? {}),
        }),
      ),
    [i18nLng],
  );

  const getLocalizedStaticDisplay = React.useCallback(
    (value: unknown) => {
      const rawValue = String(value ?? "").trim();
      const key = LOCALIZED_VALUE_KEYS[rawValue];
      return key ? tf(`value.${key}`, { defaultValue: rawValue }) : rawValue;
    },
    [tf],
  );

  const getLocalizedPermitField = React.useCallback(
    (
      item: AgeRatingPermitOption | undefined,
      fieldName:
        | "label"
        | "title"
        | "type"
        | "language"
        | "source"
        | "copyrightsType",
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
    const resolvedProfileId = String(currentProfileId || "").trim();
    const resolvedPermitId = String(current.ageRatingPermit ?? "").trim();
    if (!resolvedProfileId && !resolvedPermitId) {
      setPermitOptions([]);
      return;
    }

    let cancelled = false;
    const requests: Array<Promise<AgeRatingPermitOption[]>> = [];

    if (resolvedProfileId) {
      requests.push(getAgeRatingPermitByProfileId(resolvedProfileId, serviceCode));
    }
    if (resolvedPermitId) {
      requests.push(getAgeRatingPermitByIds(resolvedPermitId));
    }

    Promise.all(requests.map((request) => request.catch(() => [])))
      .then((groups) => {
        if (cancelled) {
          return;
        }

        const byValue = new Map<string, AgeRatingPermitOption>();
        groups.forEach((rows) => {
          rows.forEach((row) => {
            byValue.set(String(row.value), row);
          });
        });
        setPermitOptions([...byValue.values()]);
      });

    return () => {
      cancelled = true;
    };
  }, [current.ageRatingPermit, currentProfileId, serviceCode]);

  useEffect(() => {
    let cancelled = false;

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
  }, []);

  useEffect(() => {
    const normalizedServiceCode = Number(serviceCode ?? 0);
    if (!normalizedServiceCode) {
      setTypeOptions([]);
      setCopyrightsTypeOptions([]);
      return;
    }

    let cancelled = false;

    getArtistWorkTypesByServiceCode(normalizedServiceCode)
      .then((res) => {
        if (!cancelled) {
          setTypeOptions(normalizeLookupOptions(res, isAr));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTypeOptions([]);
        }
      });

    getLookupData("CopyrightsTypes", normalizedServiceCode)
      .then((res) => {
        if (!cancelled) {
          setCopyrightsTypeOptions(normalizeLookupOptions(res, isAr));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCopyrightsTypeOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAr, serviceCode]);

  const permitSelectOptions = useMemo<OptionType[]>(
    () =>
      permitOptions.map((item) => ({
        label: getLocalizedPermitField(item, "label"),
        value: item.value,
      })),
    [getLocalizedPermitField, permitOptions]
  );

  const writerNationalitySelectOptions = useMemo<OptionType[]>(
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

  const isLocalCinematic = current.applyingPermitForLocalCinematicFilms === "Yes";

  const selectedPermit = useMemo(
    () =>
      permitOptions.find(
        (item) => String(item.value) === String(current.ageRatingPermit ?? ""),
      ),
    [current.ageRatingPermit, permitOptions],
  );

  const selectedTypeValue = findOptionValue(typeOptions, current.type);
  const selectedSourceValue = findOptionValue(writerNationalitySelectOptions, current.source);
  const selectedCopyrightsTypeValue = findOptionValue(
    copyrightsTypeOptions,
    current.copyrightsType,
  );

  const applyPermitValue = (selectedPermit?: AgeRatingPermitOption) => {
    if (!selectedPermit) {
      return {
        applyingPermitForLocalCinematicFilms: undefined,
        filmDirector: undefined,
        filmWriter: undefined,
        writerEmiratesId: undefined,
        nationalityId: undefined,
        title: undefined,
        type: undefined,
        languages: [],
        source: undefined,
        copyrightsType: undefined,
        durationInMinutes: undefined,
        copyrightsValidityPeriod: undefined,
        economyCertificate: undefined,
        writerEmiratesIdCopy: undefined,
      };
    }

    const nextValue: Partial<FilmScreeningFormValue> = {
      applyingPermitForLocalCinematicFilms:
        selectedPermit.applyingPermitForLocalCinematicFilms,
      filmDirector: selectedPermit.filmDirector,
      filmWriter: selectedPermit.filmWriter,
      title: selectedPermit.title,
      type: selectedPermit.type,
      languages: selectedPermit.languages,
      source: selectedPermit.source,
      copyrightsType: selectedPermit.copyrightsType,
      durationInMinutes: selectedPermit.durationInMinutes,
      copyrightsValidityPeriod: selectedPermit.copyrightsValidityPeriod,
      economyCertificate: selectedPermit.economyCertificate,
    };

    if (selectedPermit.applyingPermitForLocalCinematicFilms === "Yes") {
      nextValue.writerEmiratesId = selectedPermit.writerEmiratesId;
      nextValue.nationalityId = selectedPermit.nationalityId;
      nextValue.writerEmiratesIdCopy = selectedPermit.writerEmiratesIdCopy;
    } else {
      nextValue.writerEmiratesId = undefined;
      nextValue.nationalityId = undefined;
      nextValue.writerEmiratesIdCopy = undefined;
    }

    return nextValue;
  };

  const handleFieldChange = (key: string, value: unknown) => {
    const newValue: FilmScreeningFormValue = {
      ...current,
      [key]: value,
    };

    if (key === "ageRatingPermit") {
      const selectedPermit = permitOptions.find(
        (p) => String(p.value) === String(value ?? ""),
      );
      Object.assign(newValue, applyPermitValue(selectedPermit));
    }

    delete newValue.language;
    field.setValue(newValue);
  };

  const renderLabel = (label: string, required: boolean = true, tooltip?: string) => (
    <div className="film-screening-form-label">
      <span>
        {label}
        {required && <span className="film-screening-form-required">*</span>}
      </span>
      {tooltip && (
        <Tooltip title={tooltip}>
          <QuestionCircleOutlined className="film-screening-form-tooltip" />
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
    valueOverride?: string | number,
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) return tf("validationRequired", { label });
          return "";
        }}
      >
        {renderLabel(label, required)}
        <Select
          disabled={formDisabled || disabled}
          placeholder={placeholder || tf("placeholderSelect", { label })}
          value={valueOverride ?? (current[name] as string | number | undefined)}
          onChange={(value) => handleFieldChange(name, value)}
          showSearch
          optionFilterProp="children"
          allowClear={!required}
          className={disabled ? "film-screening-form-readonly" : ""}
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
    maxLength?: number,
    placeholder?: string,
    regex?: RegExp,
    displayValue?: string
  ) => {
    const isInputDisabled = formDisabled || disabled;
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (regex) {
        if (regex.test(value) || value === "") {
          handleFieldChange(name, value);
        }
      } else {
        handleFieldChange(name, value);
      }
    };

    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          const trimmedValue = typeof value === "string" ? value.trim() : value;
          if (required && !trimmedValue) return tf("validationRequired", { label });
          if (typeof value === "string" && maxLength && value.length > maxLength) {
            return tf("validationMaxCharacters", {
              label,
              max: maxLength,
            });
          }
          if (typeof value === "string" && value && regex && !regex.test(value)) {
            return tf("validationInvalidCharacters", {
              label,
            });
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
              : typeof current[name] === "string"
                ? current[name]
                : ""
          }
          maxLength={maxLength}
          onChange={handleChange}
          className={disabled ? "film-screening-form-readonly" : ""}
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
          if (required && !value) return tf("validationRequired", { label });
          if (value && !isDurationHmsValue(value)) {
            return tf("validationDurationFormat");
          }
          return "";
        }}
      >
        {renderLabel(label, required)}
        <DurationInput
          disabled={formDisabled || disabled}
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
            return tf("validationRequired", { label });
          if (value && value.length === 2) {
            const [start, end] = value;
            if (!disabled && moment(start).isBefore(moment(), "day")) {
              return tf("validationStartDateTodayOrLater");
            }
            if (!disabled && moment(end).isSameOrBefore(moment(start), "day")) {
              return tf("validationEndDateAfterStart");
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
          disabled={formDisabled || disabled}
          style={{ width: "100%" }}
          format="DD/MM/YYYY"
          placeholder={[tf("phStartDate"), tf("phEndDate")]}
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
    disabled: boolean = false,
    accept: string = ".pdf,.jpg,.jpeg,.png",
    uploadTip: string = tf("uploadTip")
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) return tf("validationRequired", { label });
          return "";
        }}
      >
        {renderLabel(label, required, tooltip)}
        <DocumentViewer
          hasDelete={true}
          disabled={formDisabled || disabled}
          value={current[name] as string | string[] | undefined}
          onChange={(value) => handleFieldChange(name, value)}
          uploadConfig={{
            maxCount: 1,
            maxSize: 5,
            uploadTip,
            accept,
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
            return tf("validationRequired", { label });
          }
          return "";
        }}
      >
        {renderLabel(label, required)}
        <LanguageSelectMulti
          disabled={formDisabled || disabled}
          placeholder={label}
          value={current[name]}
          onChange={(value: unknown) => handleFieldChange(name, value)}
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
          if (required && !value) return tf("validationRequired", { label });
          return "";
        }}
      >
        {renderLabel(label, required)}
        <Radio.Group
          disabled
          value={current[name] as string | undefined}
          className="film-screening-form-readonly"
        >
          <Radio value="Yes">{tf("radioYes")}</Radio>
          <Radio value="No">{tf("radioNo")}</Radio>
        </Radio.Group>
      </Field>
    );
  };

  return (
    <div className="film-screening-form-container" {...divProps}>
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
              permitSelectOptions,
              true,
              false,
              tf("phAgeRatingPermit")
            )}
          </Col>
            <Col span={12}>
              {renderRadioReadonly(
                "applyingPermitForLocalCinematicFilms",
                tf("labelApplyingPermitForLocalCinematicFilms"),
                true
              )}
            </Col>
          <Col span={12}>
            {renderTextInput(
              "filmDirector",
              tf("labelFilmDirector"),
              true,
                true,
                100,
                tf("phFilmDirector"),
              NAME_REGEX
            )}
          </Col>

          <Col span={12}>
            {renderTextInput(
              "filmWriter",
              tf("labelFilmWriter"),
              true,
              true,
              100,
              tf("phFilmWriter"),
              NAME_REGEX
            )}
          </Col>
          {isLocalCinematic ? (
            <>
              <Col span={12}>
                {renderTextInput(
                  "writerEmiratesId",
                  tf("labelWriterEmiratesId"),
                  true,
                  true,
                  undefined,
                  tf("phWriterEmiratesId")
                )}
              </Col>
              <Col span={12}>
                {renderSelect(
                  "nationalityId",
                  tf("labelWriterNationality"),
                  writerNationalitySelectOptions,
                  true,
                  true,
                  tf("phWriterNationality")
                )}
              </Col>
            </>
          ) : null}
          <Col span={12}>
            {renderTextInput(
              "title",
              tf("labelTitle"),
              true,
              true,
              undefined,
              tf("phTitle"),
              undefined,
              getLocalizedPermitField(selectedPermit, "title", current.title)
            )}
          </Col>

          <Col span={12}>
            {renderSelect(
              "type",
              tf("labelType"),
              typeOptions,
              true,
              true,
              tf("phType"),
              selectedTypeValue,
            )}
          </Col>
          <Col span={12}>
            {renderLanguageSelect(
              "languages",
              tf("labelLanguage"),
              true,
              true
            )}
          </Col>

          <Col span={12}>
            {renderSelect(
              "source",
              tf("labelSource"),
              writerNationalitySelectOptions,
              true,
              true,
              tf("phSource"),
              selectedSourceValue,
            )}
          </Col>
          <Col span={12}>
            {renderSelect(
              "copyrightsType",
              tf("labelCopyrightsType"),
              copyrightsTypeOptions,
              true,
              true,
              tf("phCopyrightsType"),
              selectedCopyrightsTypeValue,
            )}
          </Col>

          <Col span={12}>
            {renderDurationInput(
              "durationInMinutes",
              tf("labelDurationInMinutes"),
              true,
              true,
            )}
          </Col>
          <Col span={12}>
            {renderDateRangePicker(
              "copyrightsValidityPeriod",
              tf("labelCopyrightsValidityPeriod"),
              true,
              true
            )}
          </Col>

          <Col span={12}>
            {renderUpload(
              "economyCertificate",
              tf("labelEconomyCertificate"),
              true,
              tf("tooltipEconomyCertificate"),
              true,
              ".pdf",
              tf("uploadTipPdf")
            )}
          </Col>
          {isLocalCinematic ? (
            <Col span={12}>
              {renderUpload(
                "writerEmiratesIdCopy",
                tf("labelWriterEmiratesIdCopy"),
                true,
                undefined,
                false,
                ".pdf",
                tf("uploadTipPdf")
              )}
            </Col>
          ) : null}
        </Row>
      </AntdCard>
    </div>
  );
});

FilmScreeningFormField.displayName = "FilmScreeningFormField";

export default FilmScreeningFormField;
