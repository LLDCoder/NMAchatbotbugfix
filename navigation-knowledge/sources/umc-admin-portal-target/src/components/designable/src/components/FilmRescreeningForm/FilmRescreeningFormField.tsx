import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { observer, useField, Field } from "@formily/react";
import { FormItem } from "@formily/antd";
import { Input, Select, Row, Col, Card as AntdCard, DatePicker, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import moment from "moment";
import DocumentViewer from "../../../../../components/common/DocumentViewer/index";
import LanguageSelectMulti from "../LanguageSelectMulti/LanguageSelectMulti";
import {
  getCirculationMediaMaterialTitles,
  getCirculationMediaMaterialTitlesByPermitNumber,
} from "@/services/circulationMediaMaterial";
import { useUserStore } from "@/store/user";
import { getNationalityList } from "../../../../../services/userProfile";
import {
  getArtistWorkTypes,
  getLanguages,
  getLookupData,
} from "@/services/services";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import { preferLocalizedEnAr } from "@/utils/bilingualDisplay";
import { toPickerMoment } from "@/utils/dateLocale";
import { normalizeLookupOptions } from "@/utils/lookupOptions";
import i18n from "@/localization/config";
import DurationInput from "../DurationInput/DurationInput";
import { isDurationHmsValue } from "../DurationInput/utils";
import "./styles.less";

const { Option } = Select;
const { RangePicker } = DatePicker;
const SERVICE_CODE_1008 = "1008";

type FilmRescreeningFormValue = {
  title?: string;
  permitNumber?: string | number;
  mediaMaterialType?: string | number;
  type?: string | number;
  /** @deprecated Kept only for migrating previously saved form values. */
  language?: string | number | Array<string | number>;
  languages?: Array<string | number>;
  durationInMinutes?: string;
  source?: string | number;
  copyrightsType?: string | number;
  copyrightsValidityPeriod?: [string, string];
  economyCertificate?: any;
  [key: string]: any;
};

type OptionType = {
  label: string;
  value: number | string;
  [key: string]: any;
};

type ArtistWorkTypeOption = {
  label: string;
  value: number | string;
};

const normalizeLanguageIds = (value: unknown): Array<string | number> => {
  const values = Array.isArray(value) ? value : [value];

  return values.reduce<Array<string | number>>((result, item) => {
    if (typeof item === "number" && Number.isFinite(item)) {
      result.push(item);
      return result;
    }

    if (typeof item !== "string") {
      return result;
    }

    const normalized = item.trim();
    if (!normalized) {
      return result;
    }

    result.push(
      /^-?\d+(\.\d+)?$/.test(normalized)
        ? Number(normalized)
        : normalized,
    );
    return result;
  }, []);
};

const areLanguageIdsEqual = (left: unknown, right: unknown) => {
  const normalizedLeft = normalizeLanguageIds(left);
  const normalizedRight = normalizeLanguageIds(right);

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
};

const toDateOnly = (value?: string) => (value ? value.slice(0, 10) : undefined);

const findOptionLabel = (options: OptionType[], value: unknown) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    return undefined;
  }

  return options.find((option) => String(option.value) === normalizedValue)?.label;
};

const alignOptionsWithCurrentValue = (
  options: OptionType[],
  currentValue: unknown,
): OptionType[] => {
  if (
    currentValue === undefined ||
    currentValue === null ||
    String(currentValue).trim() === ""
  ) {
    return options;
  }

  const normalizedCurrentValue = String(currentValue);
  return options.map((option) =>
    String(option.value) === normalizedCurrentValue
      ? { ...option, value: currentValue as string | number }
      : option,
  );
};

const COPYRIGHTS_TYPE_OPTIONS = [
  {
    labelKey: "optionCopyrightDistributionDvdBd3dBd",
    value: "1",
  },
  {
    labelKey: "optionCopyrightDistributionElectronicVideoGames",
    value: "2",
  },
  { labelKey: "optionCopyrightCinemaDistribution", value: "3" },
  {
    labelKey: "optionCopyrightProgramsDistribution",
    value: "4",
  },
  { labelKey: "optionCopyrightDistributionSongs", value: "5" },
];

type FilmPermitOption = OptionType & {
  title?: string;
  applicationNumber?: string | number;
  permitNumber?: string | number;
  mediaMaterialType?: string | number;
  mediaMaterialTypeId?: string | number;
  type?: string | number;
  artistWorkTypeId?: string | number;
  language?: Array<string | number>;
  languageId?: string | number;
  languageIds?: Array<string | number>;
  durationInMinutes?: string;
  source?: string | number;
  sourceCountryId?: string | number;
  copyrightsType?: string | number;
  copyrightsTypeId?: string | number;
  copyrightsStartDate?: string;
  copyrightsEndDate?: string;
  ministryOfEconomyRegistrationCertificate?: string | null;
};

export const FilmRescreeningFormField: React.FC<{
  disabled?: boolean;
  artistWorkTypeOptions?: ArtistWorkTypeOption[];
  artistWorkTypeOptionsLoading?: boolean;
  materialTypeId?: number | null;
  profileId?: string | number | null;
  serviceCode?: string | number | null;
}> = observer((props) => {
  const { profileId: applicationProfileId, serviceCode, ...containerProps } = props;
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
  const field = useField<any>();
  if (!field) {
    return null;
  }

  const i18nLng =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const tf = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(
        i18n.t(`FilmRescreeningForm.${key}`, {
          lng: i18nLng,
          ...(options ?? {}),
        }),
      ),
    [i18nLng],
  );
  const isAr = i18nLng === "ar";
  const currentProfileId = useUserStore((state) => state.currentProfileId);
  const fieldValue = field.value as FilmRescreeningFormValue | undefined;
  const current = useMemo<FilmRescreeningFormValue>(
    () => {
      const currentValue = fieldValue || {};
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
  const isService1008 = String(serviceCode ?? "").trim() === SERVICE_CODE_1008;
  const [filmOptions, setFilmOptions] = useState<FilmPermitOption[]>([]);
  const [filmOptionsLoading, setFilmOptionsLoading] = useState(false);
  const [sourceRows, setSourceRows] = useState<any[]>([]);
  const [service1008MediaMaterialTypeOptions, setService1008MediaMaterialTypeOptions] =
    useState<OptionType[]>([]);
  const [service1008TypeOptions, setService1008TypeOptions] =
    useState<OptionType[]>([]);
  const [service1008CopyrightsTypeOptions, setService1008CopyrightsTypeOptions] =
    useState<OptionType[]>([]);
  const [service1008LanguageOptions, setService1008LanguageOptions] =
    useState<OptionType[]>([]);
  const [service1008LookupLoading, setService1008LookupLoading] = useState(false);

  const getLocalizedOptionLabel = React.useCallback(
    (item: Record<string, unknown>) =>
      preferLocalizedEnAr(
        isAr,
        String(
          item.labelEn ??
            item.nameEn ??
            item.NameEn ??
            item.fullNameEn ??
            item.label ??
            item.name ??
            "",
        ),
        String(item.labelAr ?? item.nameAr ?? item.NameAr ?? item.fullNameAr ?? ""),
      ) || String(item.value ?? item.id ?? item.Id ?? ""),
    [isAr],
  );

  const legacyTypeOptions = useMemo(
    () =>
      ((props.artistWorkTypeOptions ?? []) as OptionType[]).map((item) => ({
        ...item,
        label: getLocalizedOptionLabel(item),
      })),
    [getLocalizedOptionLabel, props.artistWorkTypeOptions],
  );
  const typeOptions = isService1008
    ? service1008TypeOptions
    : legacyTypeOptions;
  const typeOptionsLoading = isService1008
    ? service1008LookupLoading
    : !!props.artistWorkTypeOptionsLoading;
  const mediaMaterialTypeOptions = useMemo<OptionType[]>(
    () =>
      isService1008
        ? service1008MediaMaterialTypeOptions
        : [
            { label: tf("optionMediaMaterialCinema"), value: "cinema" },
            { label: tf("optionMediaMaterialClip"), value: "clip" },
          ],
    [isService1008, service1008MediaMaterialTypeOptions, tf],
  );
  const copyrightsTypeOptions = useMemo<OptionType[]>(
    () =>
      isService1008
        ? service1008CopyrightsTypeOptions
        : COPYRIGHTS_TYPE_OPTIONS.map((item) => ({
            value: item.value,
            label: tf(item.labelKey),
          })),
    [isService1008, service1008CopyrightsTypeOptions, tf],
  );
  const filmTitleOptions = useMemo<OptionType[]>(
    () =>
      filmOptions.map((item) => {
        const languageLabels = normalizeLanguageIds(
          item.languageIds ?? item.languageId ?? item.language,
        )
          .map((languageId) =>
            findOptionLabel(service1008LanguageOptions, languageId),
          )
          .filter((label): label is string => Boolean(label))
          .join(", ");

        return {
          ...item,
          label: isService1008
            ? [item.title, languageLabels]
                .filter((part) => String(part ?? "").trim())
                .join(" | ")
            : preferLocalizedEnAr(
                isAr,
                item.labelEn ?? item.label,
                item.labelAr,
              ) || String(item.value ?? ""),
        };
      }),
    [filmOptions, isAr, isService1008, service1008LanguageOptions],
  );
  const sourceOptions = useMemo<OptionType[]>(
    () =>
      sourceRows.map((item: any) => ({
        label:
          preferLocalizedEnAr(
            isAr,
            item.nameEn || item.fullNameEn || item.name,
            item.nameAr || item.fullNameAr,
          ) || String(item.id ?? ""),
        value: item.id,
      })),
    [isAr, sourceRows],
  );

  useEffect(() => {
    const permitNumber = String(current.permitNumber ?? "").trim();
    const profileId = String(
      applicationProfileId ?? currentProfileId ?? "",
    ).trim();
    const hasLookupValue = isService1008 ? Boolean(permitNumber) : Boolean(profileId);
    if (!hasLookupValue) {
      setFilmOptions([]);
      setFilmOptionsLoading(false);
      return;
    }

    let cancelled = false;

    const loadFilmOptions = async () => {
      setFilmOptionsLoading(true);
      try {
        const options = isService1008
          ? await getCirculationMediaMaterialTitlesByPermitNumber(
              permitNumber,
              100,
            )
          : await getCirculationMediaMaterialTitles(profileId);
        if (!cancelled) {
          setFilmOptions(options);
        }
      } catch {
        if (!cancelled) {
          setFilmOptions([]);
        }
      } finally {
        if (!cancelled) {
          setFilmOptionsLoading(false);
        }
      }
    };

    loadFilmOptions();

    return () => {
      cancelled = true;
    };
  }, [
    applicationProfileId,
    current.permitNumber,
    currentProfileId,
    isService1008,
  ]);

  useEffect(() => {
    if (!isService1008) {
      setService1008MediaMaterialTypeOptions([]);
      setService1008TypeOptions([]);
      setService1008CopyrightsTypeOptions([]);
      setService1008LanguageOptions([]);
      setService1008LookupLoading(false);
      return;
    }

    let cancelled = false;
    setService1008LookupLoading(true);

    Promise.allSettled([
      getLookupData("MediaMaterialTypes", SERVICE_CODE_1008),
      getArtistWorkTypes(1),
      getLookupData("CopyrightsTypes", SERVICE_CODE_1008),
      getLanguages(),
    ])
      .then(([
        mediaMaterialTypesResult,
        artistWorkTypesResult,
        copyrightsTypesResult,
        languagesResult,
      ]) => {
        if (cancelled) {
          return;
        }

        setService1008MediaMaterialTypeOptions(
          mediaMaterialTypesResult.status === "fulfilled"
            ? normalizeLookupOptions(mediaMaterialTypesResult.value, isAr)
            : [],
        );
        setService1008TypeOptions(
          artistWorkTypesResult.status === "fulfilled"
            ? normalizeLookupOptions(artistWorkTypesResult.value, isAr)
            : [],
        );
        setService1008CopyrightsTypeOptions(
          copyrightsTypesResult.status === "fulfilled"
            ? normalizeLookupOptions(copyrightsTypesResult.value, isAr)
            : [],
        );
        setService1008LanguageOptions(
          languagesResult.status === "fulfilled"
            ? normalizeLookupOptions(languagesResult.value, isAr)
            : [],
        );
      })
      .finally(() => {
        if (!cancelled) {
          setService1008LookupLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAr, isService1008]);

  useEffect(() => {
    getNationalityList().then((res) => {
      if (res?.data) {
        setSourceRows(res.data);
      }
    });
  }, []);

  useEffect(() => {
    if (current.title) {
      return;
    }

    const currentType = String(current.type ?? "").trim();
    if (!currentType || typeOptionsLoading) {
      return;
    }

    const isCurrentTypeValid = typeOptions.some(
      (option) => String(option.value) === currentType,
    );
    if (!isCurrentTypeValid) {
      field.setValue({
        ...(field.value || {}),
        type: undefined,
      });
    }
  }, [current.title, current.type, field, typeOptions, typeOptionsLoading]);

  const getSelectedFilm = React.useCallback(
    (titleValue: unknown) =>
      filmOptions.find((film) => String(film.value) === String(titleValue ?? "")),
    [filmOptions],
  );

  const buildAutoFilledValues = React.useCallback(
    (
      selectedFilm?: FilmPermitOption,
    ): Partial<FilmRescreeningFormValue> => {
      if (!selectedFilm) {
        const emptyValues = {
          mediaMaterialType: undefined,
          type: undefined,
          languages: [],
          durationInMinutes: undefined,
          source: undefined,
        };

        return isService1008
          ? {
              ...emptyValues,
              copyrightsType: undefined,
              copyrightsValidityPeriod: undefined,
              economyCertificate: undefined,
            }
          : {
              ...emptyValues,
              permitNumber: undefined,
            };
      }

      if (isService1008) {
        const copyrightStartDate = toDateOnly(selectedFilm.copyrightsStartDate);
        const copyrightEndDate = toDateOnly(selectedFilm.copyrightsEndDate);

        return {
          mediaMaterialType: selectedFilm.mediaMaterialTypeId,
          type: selectedFilm.artistWorkTypeId,
          languages: normalizeLanguageIds(
            selectedFilm.languageIds ?? selectedFilm.languageId,
          ),
          durationInMinutes: selectedFilm.durationInMinutes,
          source: selectedFilm.sourceCountryId,
          copyrightsType: selectedFilm.copyrightsTypeId,
          copyrightsValidityPeriod:
            copyrightStartDate && copyrightEndDate
              ? [copyrightStartDate, copyrightEndDate]
              : undefined,
          economyCertificate:
            selectedFilm.ministryOfEconomyRegistrationCertificate,
        };
      }

      return {
        permitNumber: selectedFilm.permitNumber,
        mediaMaterialType: selectedFilm.mediaMaterialType,
        type: selectedFilm.type,
        languages: normalizeLanguageIds(selectedFilm.language),
        durationInMinutes: selectedFilm.durationInMinutes,
        source: selectedFilm.source,
      };
    },
    [isService1008],
  );

  useEffect(() => {
    const selectedFilm = getSelectedFilm(current.title);
    if (!selectedFilm) {
      return;
    }

    const nextAutoValues = buildAutoFilledValues(selectedFilm);
    const shouldSync = Object.entries(nextAutoValues).some(([key, value]) =>
      key === "languages"
        ? !areLanguageIdsEqual(current.languages, value)
        : String(current[key] ?? "") !== String(value ?? ""),
    );

    if (shouldSync) {
      const nextValue: FilmRescreeningFormValue = {
        ...current,
        ...nextAutoValues,
      };
      delete nextValue.language;
      field.setValue(nextValue);
    }
  }, [buildAutoFilledValues, current, field, getSelectedFilm]);

  const handleFieldChange = (key: string, value: any) => {
    const newValue = {
      ...current,
      [key]: value,
    };

    if (key === "title") {
      Object.assign(newValue, buildAutoFilledValues(getSelectedFilm(value)));
    }

    delete newValue.language;
    field.setValue(newValue);
  };

  const renderLabel = (label: string, required: boolean = true, tooltip?: string) => (
    <div className="film-form-label">
      <span>
        {label}
        {required && <span className="film-form-required">*</span>}
      </span>
      {tooltip && (
        <Tooltip title={tooltip}>
          <QuestionCircleOutlined className="film-form-tooltip" />
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
    loading = false
  ) => {
    const renderedOptions = alignOptionsWithCurrentValue(
      options,
      current[name],
    );

    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value)
            return tf("validationRequired", { label });
          return "";
        }}
      >
        {renderLabel(label, required)}
        <Select
          disabled={
            props.disabled ||
            disabled ||
            (name === "type" &&
              (!props.materialTypeId ||
                (!!props.materialTypeId && !loading && options.length === 0)))
          }
          loading={loading}
          placeholder={placeholder || tf("placeholderSelect", { label })}
          value={current[name]}
          onChange={(value) => handleFieldChange(name, value)}
          showSearch
          optionFilterProp="children"
          className={disabled ? "film-form-readonly" : ""}
        >
          {renderedOptions.map((o) => (
            <Option key={String(o.value)} value={o.value}>
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
    placeholder?: string
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value)
            return tf("validationRequired", { label });
          return "";
        }}
      >
        {renderLabel(label, required)}
        <Input
          disabled={props.disabled || disabled}
          placeholder={placeholder || label}
          value={current[name] || ""}
          onChange={(e) => handleFieldChange(name, e.target.value)}
          className={disabled ? "film-form-readonly" : ""}
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
          if (required && !value)
            return tf("validationRequired", { label });
          if (value && !isDurationHmsValue(value)) {
            return tf("validationDurationFormat");
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
    enforceFutureStart = true,
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
            if (
              enforceFutureStart &&
              moment(start).isBefore(moment(), "day")
            ) {
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
          value={
            current[name] && current[name].length === 2
              ? [
                  toPickerMoment(current[name][0], "YYYY-MM-DD"),
                  toPickerMoment(current[name][1], "YYYY-MM-DD"),
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
            enforceFutureStart
              ? (currentDate) =>
                  Boolean(currentDate && currentDate < moment().startOf("day"))
              : undefined
          }
        />
      </Field>
    );
  };

  const renderUpload = (
    name: string,
    label: string,
    required: boolean = true,
    tooltip?: string,
    accept: string = ".pdf,.jpg,.jpeg,.png",
    uploadTip: string = "Maximum size: 5MB. File types: PDF, JPG, PNG."
  ) => {
    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value)
            return tf("validationRequired", { label });
          return "";
        }}
      >
        {renderLabel(label, required, tooltip)}
        <DocumentViewer
          hasDelete={true}
          disabled={props.disabled}
          value={current[name]}
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
          if (required && normalizeLanguageIds(value).length === 0)
            return tf("validationRequired", { label });
          return "";
        }}
      >
        {renderLabel(label, required)}
        <LanguageSelectMulti
          disabled={props.disabled || disabled}
          placeholder={tf("placeholderSelect", { label })}
          value={current[name]}
          onChange={(value: unknown) => handleFieldChange(name, value)}
        />
      </Field>
    );
  };

  return (
    <div className="film-rescreening-form-container" {...containerProps}>
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
              "title",
              tf("labelTitle"),
              filmTitleOptions,
              true,
              false,
              tf("phSelectMovie"),
              filmOptionsLoading
            )}
          </Col>
          <Col span={12}>
            {renderTextInput(
              "permitNumber",
              tf("labelPermitNumber"),
              true,
              true,
              tf("phPermitNumber")
            )}
          </Col>

          <Col span={12}>
            {renderSelect(
              "mediaMaterialType",
              tf("labelMediaMaterialType"),
              mediaMaterialTypeOptions,
              true,
              true,
              tf("phMediaMaterialType"),
              isService1008 ? service1008LookupLoading : false,
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
              typeOptionsLoading
            )}
          </Col>

          <Col span={12}>
            {renderLanguageSelect(
              "languages",
              tf("labelLanguage"),
              true,
              true,
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
            {renderSelect(
              "source",
              tf("labelSource"),
              sourceOptions,
              true,
              true,
              tf("phSource")
            )}
          </Col>
          <Col span={12}>
            {renderSelect(
              "copyrightsType",
              tf("labelCopyrightsType"),
              copyrightsTypeOptions,
              true,
              false,
              tf("phCopyrightsType"),
              isService1008 ? service1008LookupLoading : false,
            )}
          </Col>

          <Col span={12}>
            {renderDateRangePicker(
              "copyrightsValidityPeriod",
              tf("labelCopyrightsValidityPeriod"),
              true,
              !isService1008,
            )}
          </Col>
          <Col span={12}>
            {renderUpload(
              "economyCertificate",
              tf("labelEconomyCertificate"),
              false,
              tf("tooltipEconomyCertificate"),
              ".pdf",
              tf("uploadTipPdf")
            )}
          </Col>
        </Row>
      </AntdCard>
    </div>
  );
});

FilmRescreeningFormField.displayName = "FilmRescreeningFormField";

export default FilmRescreeningFormField;
