import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Field, observer, useField } from "@formily/react";
import { FormItem } from "@formily/antd";
import {
  Card as AntdCard,
  Col,
  DatePicker,
  Input,
  Radio,
  Row,
  Select,
  Tooltip,
} from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import type { RcFile } from "antd/lib/upload";
import moment from "moment";
import type { Moment } from "moment";
import { useTranslation } from "react-i18next";
import { useMaskInputAntd } from "use-mask-input/antd";
import DocumentViewer from "../../../../../components/common/DocumentViewer/index";
import CustomMessage from "../../../../../components/common/CustomMessage/index";
import {
  getNationalityList,
  type NationalityInfo,
} from "../../../../../services/userProfile";
import get from "lodash/get";
import {
  getArtistWorkTypesByServiceCode,
  getLanguages,
  getLookupData,
} from "@/services/services";
import { useServicesStore } from "@/store/services";
import { normalizeLookupOptions } from "@/utils/lookupOptions";
import { preferLocalizedEnAr } from "@/utils/bilingualDisplay";
import { toPickerMoment } from "@/utils/dateLocale";
import LanguageSelectMulti from "../LanguageSelectMulti/LanguageSelectMulti";
import DurationInput from "../DurationInput/DurationInput";
import { isDurationHmsValue } from "../DurationInput/utils";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import i18n from "@/localization/config";
import "./styles.less";

const { Option } = Select;
const { RangePicker } = DatePicker;

const MAX_PERSON_NAME_LEN = 100;
const MAX_TITLE_LEN = 200;
const EMIRATES_ID_MASK = "784-9999-9999999-9";
const EMIRATES_ID_REGEX = /^784-\d{4}-\d{7}-\d$/;
type StringSelectOption = { label: string; value: string };
type LanguageSelectOption = { label: string; value: string | number };

const MaskedInput: React.FC<
  React.ComponentProps<typeof Input> & { mask: string }
> = ({ mask, ...props }) => {
  const inputRef = useMaskInputAntd({ mask });

  return <Input {...props} ref={inputRef} />;
};

/** Prefer envelope `.data`; if missing, treat `res` as the array (e.g. raw list). */
const unwrapResponseRows = (res: unknown): unknown[] => {
  const raw = get(res as object, "data", res);
  return Array.isArray(raw) ? raw : [];
};

const unwrapArtistWorkTypeOptions = (
  res: unknown,
  isAr: boolean,
): StringSelectOption[] => {
  return unwrapResponseRows(res)
    .map((row) => {
      const item = row as Record<string, unknown>;
      const label = preferLocalizedEnAr(
        isAr,
        String(item.NameEn ?? item.nameEn ?? ""),
        String(item.NameAr ?? item.nameAr ?? ""),
      );
      const value = String(item.id ?? item.Id ?? "").trim();
      if (!label || !value) {
        return null;
      }

      return {
        label,
        value,
      };
    })
    .filter((option): option is StringSelectOption => option != null);
};

const unwrapLanguageOptions = (
  res: unknown,
  isAr: boolean,
): LanguageSelectOption[] => {
  return unwrapResponseRows(res)
    .map((row) => {
      const item = row as Record<string, unknown>;
      const value = item.id ?? item.Id ?? item.value;
      const nameEn = String(
        item.nameEn ?? item.NameEn ?? item.label ?? "",
      ).trim();
      const nameAr = String(item.nameAr ?? item.NameAr ?? "").trim();
      const label = isAr ? nameAr || nameEn : nameEn || nameAr;

      if (
        (typeof value !== "string" && typeof value !== "number") ||
        !String(value).trim() ||
        !label
      ) {
        return null;
      }

      return { label, value };
    })
    .filter((option): option is LanguageSelectOption => option != null);
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

type MoviePackageFormValue = {
  applyingPermitForLocalCinematicFilms?: "Yes" | "No";
  filmDirector?: string;
  filmWriter?: string;
  title?: string;
  type?: string;
  /** @deprecated Kept only for migrating previously saved form values. */
  language?: string | number | (string | number)[];
  languages?: Array<string | number>;
  source?: string;
  copyrightsType?: string;
  durationInMinutes?: string;
  copyrightsValidityPeriod?: [string, string];
  ministryOfEconomyRegistrationCertificate?: string;
  writerEmiratesId?: string;
  writerNationalityId?: number;
  writerEmiratesIdCopy?: string;
};

type MoviePackageFormFieldProps = {
  className?: string;
  disabled?: boolean;
  artistWorkTypeOptions?: StringSelectOption[];
  artistWorkTypeOptionsLoading?: boolean;
  materialTypeId?: number | null;
};

const unwrapNationalities = (res: unknown): NationalityInfo[] => {
  const rows = unwrapResponseRows(res);
  return rows as NationalityInfo[];
};

const clamp = (value: string, max: number) => value.slice(0, max);

const sanitizePersonName = (value: string, max: number) =>
  value.replace(/[^a-zA-Z\s.'-]/g, "").slice(0, max);

const parseRangeValue = (
  value: MoviePackageFormValue["copyrightsValidityPeriod"]
): [Moment, Moment] | null => {
  if (!value || value.length !== 2 || !value[0] || !value[1]) return null;
  const start = toPickerMoment(value[0], "YYYY-MM-DD");
  const end = toPickerMoment(value[1], "YYYY-MM-DD");
  if (!start || !end || !start.isValid() || !end.isValid()) return null;
  return [start, end];
};

const hasAnyConditionalValue = (
  value: MoviePackageFormValue | undefined
): boolean => {
  if (!value) return false;
  return [
    value.writerEmiratesId,
    value.writerNationalityId,
    value.writerEmiratesIdCopy,
  ].some((item) => {
    if (typeof item === "number") return true;
    return String(item ?? "").trim() !== "";
  });
};

export const MoviePackageFormField: React.FC<MoviePackageFormFieldProps> =
  observer((props) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- align with other designable composite fields
    const field = useField<any>();
    const host = useFormLanguageHost();
    const contentLang = useFormContentLang();
    const { i18n: i18nReact } = useTranslation();
    const serviceCode = useServicesStore((state) => state.userInfo.servicesCode);
    const disabled = !!props.disabled;
    const i18nLng =
      host === "designer"
        ? contentLang
        : mapDesignerLanguageToContentLang(i18nReact.language);
    const tf = useCallback(
      (key: string, options?: Record<string, unknown>) =>
        String(
          i18n.t(`MoviePackageForm.${key}`, {
            lng: i18nLng,
            ...(options ?? {}),
          }),
        ),
      [i18nLng],
    );
    const isAr = i18nLng === "ar";
    const requiredMessage = tf("validationRequired");
    const raw = (field.value || {}) as MoviePackageFormValue;
    const languageSource = Object.prototype.hasOwnProperty.call(
      raw,
      "languages",
    )
      ? raw.languages
      : raw.language;
    const current: MoviePackageFormValue = {
      applyingPermitForLocalCinematicFilms:
        raw.applyingPermitForLocalCinematicFilms ?? "No",
      filmDirector: raw.filmDirector ?? "",
      filmWriter: raw.filmWriter ?? "",
      title: raw.title ?? "",
      type: raw.type,
      language: raw.language,
      languages: normalizeLanguageIds(languageSource),
      source: raw.source,
      copyrightsType: raw.copyrightsType,
      durationInMinutes: raw.durationInMinutes ?? "",
      copyrightsValidityPeriod: raw.copyrightsValidityPeriod,
      ministryOfEconomyRegistrationCertificate:
        raw.ministryOfEconomyRegistrationCertificate,
      writerEmiratesId: raw.writerEmiratesId ?? "",
      writerNationalityId: raw.writerNationalityId,
      writerEmiratesIdCopy: raw.writerEmiratesIdCopy,
    };

    const [nationalities, setNationalities] = useState<NationalityInfo[]>([]);
    const [nationalityLoading, setNationalityLoading] = useState(false);
    const [typeSearch, setTypeSearch] = useState("");
    const [sourceSearch, setSourceSearch] = useState("");
    const [copyrightsSearch, setCopyrightsSearch] = useState("");
    const [writerNationalitySearch, setWriterNationalitySearch] = useState("");
    const [copyrightsTypeOptions, setCopyrightsTypeOptions] = useState<
      StringSelectOption[]
    >([]);
    const [copyrightsTypeOptionsLoading, setCopyrightsTypeOptionsLoading] =
      useState(false);
    const [internalTypeOptions, setInternalTypeOptions] = useState<
      StringSelectOption[]
    >([]);
    const [internalTypeOptionsLoading, setInternalTypeOptionsLoading] =
      useState(false);
    const [languageReadPrettyOptions, setLanguageReadPrettyOptions] = useState<
      LanguageSelectOption[]
    >([]);
    const isReadPretty = field.pattern === "readPretty";
    const externalTypeOptions = useMemo(
      () => props.artistWorkTypeOptions ?? [],
      [props.artistWorkTypeOptions],
    );
    const typeOptions = externalTypeOptions.length
      ? externalTypeOptions
      : internalTypeOptions;
    const normalizedTypeOptions = useMemo(() => {
      const currentType = String(current.type ?? "").trim();
      if (!currentType) {
        return typeOptions;
      }

      const hasCurrentType = typeOptions.some(
        (option) => String(option.value).trim() === currentType,
      );
      if (hasCurrentType) {
        return typeOptions;
      }

      return [
        {
          label: currentType,
          value: currentType,
        },
        ...typeOptions,
      ];
    }, [current.type, typeOptions]);
    const typeOptionsLoading =
      !!props.artistWorkTypeOptionsLoading || internalTypeOptionsLoading;
    const validateRequiredText = React.useCallback(
      (maxLength: number) =>
        (value: unknown): string => {
          const text = String(value ?? "").trim();
          if (!text) return requiredMessage;
          if (text.length > maxLength) {
            return tf("validationMaxCharacters", { max: maxLength });
          }
          return "";
        },
      [requiredMessage, tf],
    );

    const validateSelect = React.useCallback(
      (value: unknown): string =>
        value == null || String(value).trim() === "" ? requiredMessage : "",
      [requiredMessage],
    );

    const validateDuration = React.useCallback(
      (value: unknown): string => {
        const text = String(value ?? "").trim();
        if (!text) return requiredMessage;
        if (!isDurationHmsValue(value)) {
          return tf("validationDurationFormat");
        }
        return "";
      },
      [requiredMessage, tf],
    );

    const validateCopyrightsValidityPeriod = React.useCallback(
      (value: unknown): string => {
        if (!Array.isArray(value) || value.length !== 2) return requiredMessage;
        const [start, end] = value;
        const startDate = moment(start, "YYYY-MM-DD", true);
        const endDate = moment(end, "YYYY-MM-DD", true);
        if (!startDate.isValid() || !endDate.isValid()) return requiredMessage;
        if (!endDate.isAfter(startDate, "day")) {
          return tf("validationEndDateAfterStart");
        }
        return "";
      },
      [requiredMessage, tf],
    );

    const validateUpload = React.useCallback(
      (value: unknown): string => {
        if (!value) return requiredMessage;
        if (Array.isArray(value) && value.length === 0) return requiredMessage;
        return "";
      },
      [requiredMessage],
    );

    const validateWriterEmiratesId = React.useCallback(
      (value: unknown): string => {
        const text = String(value ?? "").trim();
        if (!text) return requiredMessage;
        if (!EMIRATES_ID_REGEX.test(text)) {
          return tf("validationWriterEmiratesId");
        }
        return "";
      },
      [requiredMessage, tf],
    );

    useEffect(() => {
      const currentValue = (field.value || {}) as MoviePackageFormValue;
      if (currentValue.applyingPermitForLocalCinematicFilms) {
        return;
      }

      field.setValue({
        ...currentValue,
        applyingPermitForLocalCinematicFilms: "No",
      });
    }, [field, raw.applyingPermitForLocalCinematicFilms]);

    useEffect(() => {
      if (!isReadPretty) {
        return;
      }

      let cancelled = false;

      getLanguages()
        .then((res) => {
          if (!cancelled) {
            setLanguageReadPrettyOptions(unwrapLanguageOptions(res, isAr));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLanguageReadPrettyOptions([]);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [isAr, isReadPretty]);

    useEffect(() => {
      let cancelled = false;
      setNationalityLoading(true);
      getNationalityList()
        .then((res) => {
          if (!cancelled) {
            setNationalities(unwrapNationalities(res));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setNationalities([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setNationalityLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (externalTypeOptions.length > 0 || props.artistWorkTypeOptionsLoading) {
        return;
      }

      const normalizedServiceCode = Number(serviceCode ?? 0);
      if (!normalizedServiceCode) {
        setInternalTypeOptions([]);
        return;
      }

      let cancelled = false;
      setInternalTypeOptionsLoading(true);

      getArtistWorkTypesByServiceCode(normalizedServiceCode)
        .then((artistWorkTypesRes) => {
          if (cancelled) {
            return;
          }

          setInternalTypeOptions(
            unwrapArtistWorkTypeOptions(artistWorkTypesRes, isAr),
          );
        })
        .catch(() => {
          if (!cancelled) {
            setInternalTypeOptions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setInternalTypeOptionsLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [
      externalTypeOptions.length,
      isAr,
      props.artistWorkTypeOptionsLoading,
      serviceCode,
    ]);

    useEffect(() => {
      let cancelled = false;
      setCopyrightsTypeOptionsLoading(true);

      getLookupData("CopyrightsTypes", serviceCode)
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
          if (!cancelled) setCopyrightsTypeOptions([]);
        })
        .finally(() => {
          if (!cancelled) setCopyrightsTypeOptionsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [isAr, serviceCode]);

    const patch = (partial: Partial<MoviePackageFormValue>) => {
      const nextValue: MoviePackageFormValue = {
        ...current,
        ...partial,
      };
      delete nextValue.language;
      field.setValue(nextValue);
    };

    const isLocalCinematic =
      current.applyingPermitForLocalCinematicFilms === "Yes";

    const getNestedField = React.useCallback(
      (name: keyof MoviePackageFormValue) =>
        (field.query(`${field.address}.${String(name)}`).take() as any) ||
        (field.query(String(name)).take() as any),
      [field],
    );

    const setConditionalFieldState = React.useCallback(
      (
        name: keyof MoviePackageFormValue,
        validator: (value: unknown) => string,
        required: boolean,
      ) => {
        const targetField = getNestedField(name);
        if (!targetField) {
          return;
        }

        targetField.setValidator?.(validator);
        targetField.setState?.((state: any) => {
          state.required = required;
          state.selfErrors = [];
          state.selfWarnings = [];
          state.selfSuccesses = [];
          state.selfValidating = false;
          state.validating = false;
        });

        if (!required) {
          targetField.setFeedback?.({
            type: "error",
            messages: [],
          });
          targetField.setValue?.(undefined);
        }
      },
      [getNestedField],
    );

    useEffect(() => {
      setConditionalFieldState(
        "writerEmiratesId",
        isLocalCinematic ? validateWriterEmiratesId : () => "",
        isLocalCinematic,
      );
      setConditionalFieldState(
        "writerNationalityId",
        isLocalCinematic ? validateSelect : () => "",
        isLocalCinematic,
      );
      setConditionalFieldState(
        "writerEmiratesIdCopy",
        isLocalCinematic ? validateUpload : () => "",
        isLocalCinematic,
      );

      if (!isLocalCinematic && hasAnyConditionalValue(field.value)) {
        const latest = (field.value || {}) as MoviePackageFormValue;
        field.setValue({
          ...latest,
          writerEmiratesId: undefined,
          writerNationalityId: undefined,
          writerEmiratesIdCopy: undefined,
        });
      }
    }, [
      field,
      isLocalCinematic,
      raw.writerEmiratesId,
      raw.writerNationalityId,
      raw.writerEmiratesIdCopy,
      setConditionalFieldState,
      validateSelect,
      validateUpload,
      validateWriterEmiratesId,
    ]);

    const sourceOptions = useMemo(
      () =>
        nationalities.map((item) => ({
          label:
            preferLocalizedEnAr(
              isAr,
              item.nameEn || item.fullNameEn,
              item.nameAr || item.fullNameAr,
            ) || String(item.id),
          value: String(item.id),
          flagUrl: item.flagUrl,
          key: item.id,
        })),
      [isAr, nationalities]
    );

    const normalizedSourceOptions = useMemo(() => {
      const currentSource = String(current.source ?? "").trim();
      if (!currentSource) {
        return sourceOptions;
      }

      const hasCurrentSource = sourceOptions.some(
        (option) => String(option.value).trim() === currentSource,
      );
      if (hasCurrentSource) {
        return sourceOptions;
      }

      const matchedNationality = nationalities.find((item) =>
        [
          item.id,
          item.numericCode,
          item.isocode2,
          item.isocode3,
          item.nameEn,
          item.nameAr,
          item.fullNameEn,
          item.fullNameAr,
        ].some((candidate) => String(candidate ?? "").trim() === currentSource),
      );

      return [
        {
          label:
            preferLocalizedEnAr(
              isAr,
              matchedNationality?.nameEn || matchedNationality?.fullNameEn,
              matchedNationality?.nameAr || matchedNationality?.fullNameAr,
            ) || currentSource,
          value: currentSource,
          flagUrl: matchedNationality?.flagUrl,
          key: currentSource,
        },
        ...sourceOptions,
      ];
    }, [current.source, isAr, nationalities, sourceOptions]);

    const writerNationalityOptions = useMemo(
      () =>
        nationalities.map((item) => ({
          label:
            preferLocalizedEnAr(
              isAr,
              item.nameEn || item.fullNameEn,
              item.nameAr || item.fullNameAr,
            ) || String(item.id),
          value: item.id,
          flagUrl: item.flagUrl,
        })),
      [isAr, nationalities]
    );

    const beforeUploadPdf = (file: RcFile) => {
      const isPdf = /\.pdf$/i.test(file.name);
      const validSize = file.size / 1024 / 1024 <= 5;
      if (!isPdf || !validSize) {
        CustomMessage.error(tf("validationUploadPdf"));
        return false;
      }
      return true;
    };

    const renderLabel = (
      label: string,
      required = true,
      tooltip?: string
    ) => (
      <div className="movie-package-form-label">
        <span>
          {label}
          {required && <span className="movie-package-form-required">*</span>}
        </span>
        {tooltip && (
          <Tooltip title={tooltip}>
            <QuestionCircleOutlined className="movie-package-form-tooltip" />
          </Tooltip>
        )}
      </div>
    );

    const renderSimpleSelect = (
      name: keyof MoviePackageFormValue,
      label: string,
      value: string | undefined,
      options: { label: string; value: string }[],
      placeholder: string,
      searchValue: string,
      setSearchValue: (value: string) => void,
      loading?: boolean,
      customDisabled?: boolean
    ) => (
      <Field
        name={name as string}
        decorator={[FormItem]}
        validator={validateSelect}
      >
        {renderLabel(label)}
        <Select
          showSearch
          disabled={
            customDisabled ?? disabled
          }
          loading={!!loading}
          placeholder={placeholder}
          value={value}
          optionFilterProp="label"
          searchValue={searchValue}
          onSearch={(nextValue) => setSearchValue(clamp(nextValue, 50))}
          onSelect={() => setSearchValue("")}
          onDropdownVisibleChange={(open) => {
            if (!open) setSearchValue("");
          }}
          filterOption={(input, option) =>
            String(option?.label ?? "")
              .toLowerCase()
              .includes(input.toLowerCase())
          }
          onChange={(nextValue) => patch({ [name]: nextValue })}
          className="umc-select-arrow-manual"
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
      </Field>
    );

    const renderNationalitySelect = (
      name: keyof MoviePackageFormValue,
      label: string,
      value: string | number | undefined,
      options: Array<{
        label: string;
        value: string | number;
        flagUrl?: string;
        key?: string | number;
      }>,
      placeholder: string,
      searchValue: string,
      setSearchValue: (value: string) => void
    ) => (
      <Field
        name={name as string}
        decorator={[FormItem]}
        validator={validateSelect}
      >
        {renderLabel(label)}
        <Select
          showSearch
          disabled={disabled}
          loading={nationalityLoading}
          placeholder={placeholder}
          value={value}
          optionFilterProp="label"
          searchValue={searchValue}
          onSearch={(nextValue) => setSearchValue(clamp(nextValue, 50))}
          onSelect={() => setSearchValue("")}
          onDropdownVisibleChange={(open) => {
            if (!open) setSearchValue("");
          }}
          filterOption={(input, option) =>
            String(option?.label ?? "")
              .toLowerCase()
              .includes(input.toLowerCase())
          }
          onChange={(nextValue) => patch({ [name]: nextValue })}
          className="umc-select-arrow-manual"
        >
          {options.map((option) => (
            <Option
              key={option.key ?? option.value}
              value={option.value}
              label={option.label}
            >
              <div className="movie-package-form-option">
                {option.flagUrl ? (
                  <img
                    className="movie-package-form-option-flag"
                    src={option.flagUrl}
                    alt=""
                  />
                ) : null}
                <span>{option.label}</span>
              </div>
            </Option>
          ))}
        </Select>
      </Field>
    );

    return (
      <div className={`movie-package-form-container ${props.className || ""}`}>
        <AntdCard
          className="movie-package-form-card"
          title={
            <span data-content-editable="x-component-props.title">
              {tf("defaultCardTitle")}
            </span>
          }
        >
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <div className="movie-package-form-field">
                <Field
                  name="applyingPermitForLocalCinematicFilms"
                  decorator={[FormItem]}
                  validator={validateSelect}
                >
                  {renderLabel(tf("labelApplyingPermitForLocalCinematicFilms"))}
                  <Radio.Group
                    disabled={disabled}
                    className="movie-package-form-radio-group"
                    value={current.applyingPermitForLocalCinematicFilms}
                    onChange={(event) =>
                      patch({
                        applyingPermitForLocalCinematicFilms: event.target
                          .value as "Yes" | "No",
                      })
                    }
                  >
                    <Radio value="Yes">{tf("radioYes")}</Radio>
                    <Radio value="No">{tf("radioNo")}</Radio>
                  </Radio.Group>
                </Field>
              </div>
            </Col>

            <Col span={12}>
              <div className="movie-package-form-field">
                <Field
                  name="filmDirector"
                  decorator={[FormItem]}
                  validator={validateRequiredText(MAX_PERSON_NAME_LEN)}
                >
                  {renderLabel(tf("labelFilmDirector"))}
                  <Input
                    disabled={disabled}
                    placeholder={tf("phFilmDirector")}
                    value={current.filmDirector}
                    maxLength={MAX_PERSON_NAME_LEN}
                    onChange={(event) =>
                      patch({
                        filmDirector: sanitizePersonName(
                          event.target.value,
                          MAX_PERSON_NAME_LEN
                        ),
                      })
                    }
                  />
                </Field>
              </div>
            </Col>

            <Col span={12}>
              <div className="movie-package-form-field">
                <Field
                  name="filmWriter"
                  decorator={[FormItem]}
                  validator={validateRequiredText(MAX_PERSON_NAME_LEN)}
                >
                  {renderLabel(tf("labelFilmWriter"))}
                  <Input
                    disabled={disabled}
                    placeholder={tf("phFilmWriter")}
                    value={current.filmWriter}
                    maxLength={MAX_PERSON_NAME_LEN}
                    onChange={(event) =>
                      patch({
                        filmWriter: sanitizePersonName(
                          event.target.value,
                          MAX_PERSON_NAME_LEN
                        ),
                      })
                    }
                  />
                </Field>
              </div>
            </Col>

            <Col span={12}>
              <div className="movie-package-form-field">
                <Field
                  name="title"
                  decorator={[FormItem]}
                  validator={validateRequiredText(MAX_TITLE_LEN)}
                >
                  {renderLabel(tf("labelTitle"))}
                  <Input
                    disabled={disabled}
                    placeholder={tf("phTitle")}
                    value={current.title}
                    maxLength={MAX_TITLE_LEN}
                    onChange={(event) =>
                      patch({
                        title: clamp(event.target.value, MAX_TITLE_LEN),
                      })
                    }
                  />
                </Field>
              </div>
            </Col>

            <Col span={12}>
              <div className="movie-package-form-field">
                {renderSimpleSelect(
                  "type",
                  tf("labelType"),
                  current.type,
                  normalizedTypeOptions,
                  tf("phType"),
                  typeSearch,
                  setTypeSearch,
                  typeOptionsLoading,
                  disabled ||
                    (!typeOptionsLoading && typeOptions.length === 0)
                )}
              </div>
            </Col>

            <Col span={12}>
              <div className="movie-package-form-field">
                <Field
                  name="languages"
                  decorator={[FormItem]}
                  validator={(value) =>
                    normalizeLanguageIds(value).length === 0
                      ? requiredMessage
                      : ""
                  }
                >
                  {renderLabel(tf("labelLanguage"))}
                  <LanguageSelectMulti
                    className="movie-package-form-language-select"
                    disabled={disabled}
                    mode="multiple"
                    options={
                      isReadPretty ? languageReadPrettyOptions : undefined
                    }
                    placeholder={tf("phLanguage")}
                    value={current.languages}
                    onChange={(value: unknown) =>
                      patch({
                        languages: normalizeLanguageIds(value),
                      })
                    }
                  />
                </Field>
              </div>
            </Col>

            <Col span={12}>
              <div className="movie-package-form-field">
                {renderNationalitySelect(
                  "source",
                  tf("labelSource"),
                  current.source,
                  normalizedSourceOptions,
                  tf("phSource"),
                  sourceSearch,
                  setSourceSearch
                )}
              </div>
            </Col>

            <Col span={12}>
              <div className="movie-package-form-field">
                {renderSimpleSelect(
                  "copyrightsType",
                  tf("labelCopyrightsType"),
                  current.copyrightsType,
                  copyrightsTypeOptions,
                  tf("phCopyrightsType"),
                  copyrightsSearch,
                  setCopyrightsSearch,
                  copyrightsTypeOptionsLoading,
                  disabled
                )}
              </div>
            </Col>

            <Col span={12}>
              <div className="movie-package-form-field">
                <Field
                  name="durationInMinutes"
                  decorator={[FormItem]}
                  validator={validateDuration}
                >
                  {renderLabel(tf("labelDurationInMinutes"))}
                  <DurationInput
                    disabled={disabled}
                    value={current.durationInMinutes}
                    onChange={(value) => patch({ durationInMinutes: value })}
                  />
                </Field>
              </div>
            </Col>

            <Col span={12}>
              <div className="movie-package-form-field">
                <Field
                  name="copyrightsValidityPeriod"
                  decorator={[FormItem]}
                  validator={validateCopyrightsValidityPeriod}
                >
                  {renderLabel(tf("labelCopyrightsValidityPeriod"))}
                  <RangePicker
                    disabled={disabled}
                    style={{ width: "100%" }}
                    format="DD/MM/YYYY"
                    placeholder={[
                      tf("phStartDate"),
                      tf("phEndDate"),
                    ]}
                    value={parseRangeValue(current.copyrightsValidityPeriod)}
                    onChange={(dates) => {
                      if (dates && dates.length === 2) {
                        patch({
                          copyrightsValidityPeriod: [
                            dates[0]?.format("YYYY-MM-DD") || "",
                            dates[1]?.format("YYYY-MM-DD") || "",
                          ],
                        });
                        return;
                      }
                      patch({
                        copyrightsValidityPeriod: undefined,
                      });
                    }}
                  />
                </Field>
              </div>
            </Col>

            <Col span={12}>
              <div className="movie-package-form-field movie-package-form-upload">
                <Field
                  name="ministryOfEconomyRegistrationCertificate"
                  decorator={[FormItem]}
                  validator={validateUpload}
                >
                  {renderLabel(
                    tf("labelMinistryOfEconomyRegistrationCertificate"),
                    true,
                    tf("tooltipEconomyRegistrationCertificate")
                  )}
                  <DocumentViewer
                    hasDelete={!disabled}
                    disabled={disabled}
                    value={current.ministryOfEconomyRegistrationCertificate}
                    onChange={(value) =>
                      patch({
                        ministryOfEconomyRegistrationCertificate:
                          Array.isArray(value)
                            ? value[0]
                            : (value as string | undefined),
                      })
                    }
                    uploadConfig={{
                      maxCount: 1,
                      maxSize: 5,
                      accept: ".pdf",
                      uploadTip: tf("uploadTipPdf"),
                      beforeUpload: beforeUploadPdf,
                    }}
                  />
                </Field>
              </div>
            </Col>
          </Row>

          {isLocalCinematic ? (
            <Row gutter={24}>
              <Col span={12}>
                <div className="movie-package-form-field">
                  <Field
                    name="writerEmiratesId"
                    decorator={[FormItem]}
                    validator={validateWriterEmiratesId}
                  >
                    {renderLabel(tf("labelWriterEmiratesId"))}
                    <MaskedInput
                      mask={EMIRATES_ID_MASK}
                      disabled={disabled}
                      placeholder={tf("phWriterEmiratesId")}
                      value={current.writerEmiratesId}
                      maxLength={18}
                      onChange={(event) =>
                        patch({
                          writerEmiratesId: clamp(event.target.value, 18),
                        })
                      }
                    />
                  </Field>
                </div>
              </Col>

              <Col span={12}>
                <div className="movie-package-form-field">
                  {renderNationalitySelect(
                    "writerNationalityId",
                    tf("labelWriterNationality"),
                    current.writerNationalityId,
                    writerNationalityOptions,
                    tf("phWriterNationality"),
                    writerNationalitySearch,
                    setWriterNationalitySearch
                  )}
                </div>
              </Col>

              <Col span={12}>
                <div className="movie-package-form-field movie-package-form-upload">
                  <Field
                    name="writerEmiratesIdCopy"
                    decorator={[FormItem]}
                    validator={validateUpload}
                  >
                    {renderLabel(tf("labelWriterEmiratesIdCopy"))}
                    <DocumentViewer
                      hasDelete={!disabled}
                      disabled={disabled}
                      value={current.writerEmiratesIdCopy}
                      onChange={(value) =>
                        patch({
                          writerEmiratesIdCopy: Array.isArray(value)
                            ? value[0]
                            : (value as string | undefined),
                        })
                      }
                      uploadConfig={{
                        maxCount: 1,
                        maxSize: 5,
                        accept: ".pdf",
                        uploadTip: tf("uploadTipPdf"),
                        beforeUpload: beforeUploadPdf,
                      }}
                    />
                  </Field>
                </div>
              </Col>
            </Row>
          ) : null}
        </AntdCard>
      </div>
    );
  });

MoviePackageFormField.displayName = "MoviePackageFormField";

export default MoviePackageFormField;
