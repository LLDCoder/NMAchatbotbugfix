import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { observer, useField, useForm, Field } from "@formily/react";
import { FormItem } from "@formily/antd";
import {
  Input,
  Select,
  Row,
  Col,
  Radio,
  Card as AntdCard,
  DatePicker,
  Tooltip,
  Checkbox,
} from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import moment from "moment";
import type { Moment } from "moment";
import DocumentViewer from "../../../../../components/common/DocumentViewer/index";
import { LanguageSelect as LanguageSelectComponent } from "../LanguageSelect/LanguageSelect";
import {
  ALL_COUNTRIES,
  getLocalizedCountryLabel,
} from "../CountryDropdown/countries";
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
import { toPickerMoment } from "@/utils/dateLocale";
import "./index.less";

const { Option } = Select;
const { RangePicker } = DatePicker;

const clamp = (s: string, max: number) =>
  s.length > max ? s.slice(0, max) : s;

const GAME_PLATFORM_OPTION_KEYS = [
  {
    value: "Sony/Playstation",
    labelKey: "optionPlatformSonyPlaystation",
  },
  { value: "Xbox", labelKey: "optionPlatformXbox" },
  { value: "Nintendo", labelKey: "optionPlatformNintendo" },
  { value: "PC", labelKey: "optionPlatformPc" },
  { value: "Mobile", labelKey: "optionPlatformMobile" },
  { value: "Other", labelKey: "optionPlatformOther" },
] as const;

const TYPE_OPTION_KEYS = [
  { value: "Action", labelKey: "optionTypeAction" },
  {
    value: "Action - Adventure",
    labelKey: "optionTypeActionAdventure",
  },
  { value: "Adventure", labelKey: "optionTypeAdventure" },
  { value: "Role-Playing", labelKey: "optionTypeRolePlaying" },
  { value: "Simulation", labelKey: "optionTypeSimulation" },
  { value: "Strategy", labelKey: "optionTypeStrategy" },
] as const;

const COPYRIGHTS_TYPE_OPTION_KEYS = [
  {
    value: "Distribution DVD, BD & 3DBD",
    labelKey: "optionCopyrightDistributionDvdBd3dBd",
  },
  {
    value: "Distribution of electronic video games",
    labelKey: "optionCopyrightDistributionElectronicVideoGames",
  },
  {
    value: "Cinema Distribution",
    labelKey: "optionCopyrightCinemaDistribution",
  },
  {
    value: "Programs Distribution",
    labelKey: "optionCopyrightProgramsDistribution",
  },
  {
    value: "Distribution of songs",
    labelKey: "optionCopyrightDistributionSongs",
  },
] as const;

const PERMIT_LABEL_KEYS = [
  "permitAgeRatingVideoGames",
  "permitDistributionNonDigitalVideoGames",
  "permitDistributionDigitalVideoGames",
] as const;

type VideoGamePackageFormValue = {
  addDigitalVersion?: boolean;
  gamePlatforms?: string[];
  title?: string;
  type?: string;
  languages?: (number | string)[];
  source?: string;
  copyrightsType?: string;
  copyrightStartDate?: string;
  copyrightEndDate?: string;
  digitalGameContentLink?: string;
  economyRegistrationCertificate?: unknown;
  gameMaterialContent?: unknown;
  [key: string]: unknown;
};

type OptionType = {
  key?: string;
  label: string;
  value: string;
  searchLabel?: string;
};

type VideoGamePackageFormFieldProps = {
  disabled?: boolean;
  [key: string]: unknown;
};

type VideoGamePackageCompositeField = {
  value?: VideoGamePackageFormValue;
  setValue: (value: VideoGamePackageFormValue) => void;
  designable?: boolean;
};

type PackageValueContextNode = {
  value?: unknown;
  parent?: PackageValueContextNode;
  address?: unknown;
};

type PackageValueContext = {
  form?: {
    getValuesIn?: (address: unknown) => unknown;
  };
  field?: {
    parent?: PackageValueContextNode;
  };
};

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Nested Field validators must not rely on outer `current` (shadowing / stale closure). Read from ctx. */
function getPackageValueFromCtx(ctx: unknown): VideoGamePackageFormValue {
  const typedCtx = (ctx ?? {}) as PackageValueContext;
  const form = typedCtx.form;
  const leaf = typedCtx.field;
  if (!leaf) return {};
  let f = leaf.parent;
  let depth = 0;
  while (f && depth++ < 12) {
    let v = f.value;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if (
        "copyrightStartDate" in o ||
        "addDigitalVersion" in o ||
        "title" in o
      ) {
        return v as VideoGamePackageFormValue;
      }
    }
    if (form?.getValuesIn && f.address != null) {
      v = form.getValuesIn(f.address);
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const o = v as Record<string, unknown>;
        if (
          "copyrightStartDate" in o ||
          "addDigitalVersion" in o ||
          "title" in o
        ) {
          return v as VideoGamePackageFormValue;
        }
      }
    }
    f = f.parent;
  }
  return {};
}

export const VideoGamePackageFormField: React.FC<VideoGamePackageFormFieldProps> =
  observer((props) => {
    const field =
      useField() as unknown as VideoGamePackageCompositeField | undefined;
    const form = useForm();
    const host = useFormLanguageHost();
    const contentLang = useFormContentLang();
    const { i18n: i18nReact } = useTranslation();
    if (!field) {
      return null;
    }
    const fieldPattern = (field as { pattern?: string } | undefined)?.pattern;
    const isReadOnlyMode =
      isNonEditablePattern(fieldPattern) ||
      isNonEditablePattern(form.pattern);

    const i18nLng =
      host === "designer"
        ? contentLang
        : mapDesignerLanguageToContentLang(i18nReact.language);

    const tf = useCallback(
      (key: string, options?: Record<string, unknown>) =>
        String(
          i18n.t(`VideoGamePackageForm.${key}`, {
            lng: i18nLng,
            ...(options ?? {}),
          }),
        ),
      [i18nLng],
    );

    const current: VideoGamePackageFormValue = field.value || {};
    const requiredMessage = tf("validationRequired");
    const invalidUrlMessage = tf("validationInvalidUrl");
    const startDatePastMessage = tf("validationStartDatePast");
    const endDateAfterStartMessage = tf("validationEndDateAfterStart");
    const [rangeDates, setRangeDates] = useState<
      [Moment | null, Moment | null] | null
    >(null);

    const [searchType, setSearchType] = useState("");
    const [searchCopyrights, setSearchCopyrights] = useState("");
    const [searchSource, setSearchSource] = useState("");
    const [searchPlatform, setSearchPlatform] = useState("");
    const [languagesSearch, setLanguagesSearch] = useState("");

    const gamePlatformOptions = useMemo(
      () =>
        GAME_PLATFORM_OPTION_KEYS.map((option) => ({
          value: option.value,
          label: tf(option.labelKey),
        })),
      [tf],
    );

    const typeOptions = useMemo(
      () =>
        TYPE_OPTION_KEYS.map((option) => ({
          value: option.value,
          label: tf(option.labelKey),
        })),
      [tf],
    );

    const copyrightsTypeOptions = useMemo(
      () =>
        COPYRIGHTS_TYPE_OPTION_KEYS.map((option) => ({
          value: option.value,
          label: tf(option.labelKey),
        })),
      [tf],
    );

    const permitLabels = useMemo(
      () => PERMIT_LABEL_KEYS.map((key) => tf(key)),
      [tf],
    );

    const countryOptions = useMemo(
      () =>
        ALL_COUNTRIES.map((country) => ({
          key: country.value,
          value: country.label,
          label: getLocalizedCountryLabel(country, i18nLng),
          searchLabel: `${country.label} ${getLocalizedCountryLabel(
            country,
            "ar",
          )}`,
        })),
      [i18nLng],
    );

    useEffect(() => {
      const v = (field.value || {}) as VideoGamePackageFormValue;
      if (v.addDigitalVersion === undefined) {
        field.setValue({ ...v, addDigitalVersion: false });
      }
    }, [field]);

    const handleFieldChange = (key: string, value: unknown) => {
      const newValue: VideoGamePackageFormValue = {
        ...current,
        [key]: value,
      };

      if (key === "addDigitalVersion" && value === false) {
        newValue.gamePlatforms = undefined;
      }

      field.setValue(newValue);
    };

    /** RangePicker must set start+end in one setValue; two handleFieldChange calls race on stale `current`. */
    const handleCopyrightRangeChange = (
      dates: [Moment | null, Moment | null] | null
    ) => {
      const base = (field.value || {}) as VideoGamePackageFormValue;
      if (dates && dates.length === 2 && dates[0] && dates[1]) {
        field.setValue({
          ...base,
          copyrightStartDate: dates[0].format("YYYY-MM-DD"),
          copyrightEndDate: dates[1].format("YYYY-MM-DD"),
        });
      } else {
        field.setValue({
          ...base,
          copyrightStartDate: undefined,
          copyrightEndDate: undefined,
        });
      }
    };

    const renderLabel = (
      label: string,
      required: boolean = true,
      tooltip?: string
    ) => (
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

    const renderSelectSearchable = (
      name: keyof VideoGamePackageFormValue,
      label: string,
      options: OptionType[],
      required: boolean,
      placeholder: string,
      searchValue: string,
      setSearchValue: (v: string) => void
    ) => {
      return (
        <Field
          name={name as string}
          decorator={[FormItem]}
          validator={(value) => {
            if (
              required &&
              (value === undefined || value === null || value === "")
            )
              return requiredMessage;
            return "";
          }}
        >
          {renderLabel(label, required)}
          <Select
            showSearch
            disabled={props.disabled}
            placeholder={placeholder}
            value={current[name] as string | undefined}
            onChange={(v) => handleFieldChange(name as string, v)}
            optionFilterProp="label"
            filterOption={(input, opt) =>
              String(opt?.label ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            onSearch={(v) => setSearchValue(clamp(v, 50))}
            searchValue={searchValue}
            onSelect={() => setSearchValue("")}
            onDropdownVisibleChange={(open) => {
              if (!open) setSearchValue("");
            }}
            className="umc-select-arrow-manual"
          >
            {options.map((o) => (
              <Option key={o.value} value={o.value} label={o.label}>
                {o.label}
              </Option>
            ))}
          </Select>
        </Field>
      );
    };

    const renderCountrySelect = () => {
      const name = "source";
      return (
        <Field
          name={name}
          decorator={[FormItem]}
          validator={(value) => {
            if (!value) return requiredMessage;
            return "";
          }}
        >
          {renderLabel(tf("labelSource"), true)}
          <Select
            showSearch
            disabled={props.disabled}
            placeholder={tf("phSource")}
            value={current.source}
            onChange={(v) => handleFieldChange("source", v)}
            optionFilterProp="label"
            filterOption={(input, opt) =>
              String(opt?.label ?? "")
                .toLowerCase()
                .includes(input.toLowerCase()) ||
              String((opt as unknown as OptionType | undefined)?.searchLabel ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            onSearch={(v) => setSearchSource(clamp(v, 50))}
            searchValue={searchSource}
            onSelect={() => setSearchSource("")}
            onDropdownVisibleChange={(open) => {
              if (!open) setSearchSource("");
            }}
            className="umc-select-arrow-manual"
          >
            {countryOptions.map((o) => (
              <Option
                key={o.key}
                value={o.value}
                label={o.label}
                searchLabel={o.searchLabel}
              >
                {o.label}
              </Option>
            ))}
          </Select>
        </Field>
      );
    };

    const renderGamePlatformMulti = () => {
      const isRuntimeMultiSelect = field?.designable === false;
      const selectedValues = Array.isArray(current.gamePlatforms)
        ? current.gamePlatforms
        : [];
      const allSelected =
        gamePlatformOptions.length > 0 &&
        gamePlatformOptions.every((option) =>
          selectedValues.includes(option.value),
        );
      const hasSelectedValues = gamePlatformOptions.some((option) =>
        selectedValues.includes(option.value),
      );
      const handleSelectAll = (checked: boolean) => {
        if (
          !isRuntimeMultiSelect ||
          props.disabled ||
          gamePlatformOptions.length === 0
        )
          return;
        handleFieldChange(
          "gamePlatforms",
          checked ? gamePlatformOptions.map((option) => option.value) : [],
        );
      };
      const readOnlyMultiSelectProps = getReadOnlyMultiSelectProps({
        isMultiple: true,
        isReadOnly: isReadOnlyMode,
        defaultMaxTagCount: 2,
      });
      return (
        <Field
          name="gamePlatforms"
          decorator={[FormItem]}
          validator={(value) => {
            if (!value || !Array.isArray(value) || value.length === 0)
              return requiredMessage;
            return "";
          }}
        >
          {renderLabel(tf("labelGamePlatforms"), true)}
          <Select
            mode="multiple"
            maxTagCount={readOnlyMultiSelectProps.maxTagCount}
            maxTagPlaceholder={readOnlyMultiSelectProps.maxTagPlaceholder}
            disabled={props.disabled}
            className={
              isRuntimeMultiSelect
                ? "umc-select-arrow-manual video-game-package-multi-select"
                : "umc-select-arrow-manual"
            }
            dropdownClassName={
              isRuntimeMultiSelect
                ? "video-game-package-multi-select-dropdown"
                : undefined
            }
            placeholder={tf("phGamePlatforms")}
            value={current.gamePlatforms}
            onChange={(v) => handleFieldChange("gamePlatforms", v)}
            showSearch
            optionFilterProp={isRuntimeMultiSelect ? "title" : "label"}
            optionLabelProp={isRuntimeMultiSelect ? "label" : undefined}
            filterOption={(input, opt) =>
              String(opt?.title ?? opt?.label ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
            onSearch={(v) => setSearchPlatform(clamp(v, 50))}
            searchValue={searchPlatform}
            onSelect={() => setSearchPlatform("")}
            onDropdownVisibleChange={(open) => {
              if (!open) setSearchPlatform("");
            }}
            dropdownRender={
              isRuntimeMultiSelect
                ? (menu) => (
                    <div>
                      <div className="video-game-package-multi-select-all">
                        <Checkbox
                          className={
                            hasSelectedValues && !allSelected
                              ? "video-game-package-multi-select-all-checkbox has-selection"
                              : "video-game-package-multi-select-all-checkbox"
                          }
                          checked={allSelected}
                          disabled={
                            props.disabled || gamePlatformOptions.length === 0
                          }
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
            {gamePlatformOptions.map((o) => (
              <Option
                key={o.value}
                value={o.value}
                title={o.label}
                label={
                  isRuntimeMultiSelect ? (
                    <div className="video-game-package-multi-selection-item">
                      <Checkbox checked />
                      <span>{o.label}</span>
                    </div>
                  ) : (
                    o.label
                  )
                }
              >
                {isRuntimeMultiSelect ? (
                  <div className="video-game-package-multi-option">
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

    const renderTitleInput = () => (
      <Field
        name="title"
        decorator={[FormItem]}
        validator={(value) => {
          if (!value || String(value).trim() === "") return requiredMessage;
          return "";
        }}
      >
        {renderLabel(tf("labelTitle"), true)}
        <Input
          disabled={props.disabled}
          placeholder={tf("phTitle")}
          value={current.title || ""}
          maxLength={200}
          onChange={(e) =>
            handleFieldChange("title", clamp(e.target.value, 200))
          }
        />
      </Field>
    );

    const renderDigitalLinkInput = () => (
      <Field
        name="digitalGameContentLink"
        decorator={[FormItem]}
        validator={(value) => {
          if (!value || String(value).trim() === "") return requiredMessage;
          const s = String(value).trim();
          if (!isValidHttpUrl(s)) return invalidUrlMessage;
          return "";
        }}
      >
        {renderLabel(tf("labelDigitalGameContentLink"), true)}
        <Input
          disabled={props.disabled}
          placeholder={tf("phDigitalGameContentLink")}
          value={current.digitalGameContentLink || ""}
          maxLength={2048}
          onChange={(e) =>
            handleFieldChange(
              "digitalGameContentLink",
              clamp(e.target.value, 2048)
            )
          }
        />
      </Field>
    );

    const renderLanguageSelect = () => (
      <Field
        name="languages"
        decorator={[FormItem]}
        validator={(value) => {
          if (!value || !Array.isArray(value) || value.length === 0)
            return requiredMessage;
          return "";
        }}
      >
        {renderLabel(tf("labelLanguages"), true)}
        <LanguageSelectComponent
          className="game-form-language umc-select-arrow-manual"
          disabled={props.disabled}
          multiple={true}
          showSearch
          searchValue={languagesSearch}
          onSearch={(v: string) => setLanguagesSearch(clamp(v, 50))}
          onSelect={() => setLanguagesSearch("")}
          onDropdownVisibleChange={(open: boolean) => {
            if (!open) setLanguagesSearch("");
          }}
          filterOption={(
            input: string,
            option?: {
              nameEn?: unknown;
              nameAr?: unknown;
              label?: unknown;
            },
          ) =>
            `${String(option?.nameEn ?? "")} ${String(
              option?.nameAr ?? "",
            )} ${String(option?.label ?? "")}`
              .toLowerCase()
              .includes(String(input).toLowerCase())
          }
          placeholder={tf("phLanguages")}
          value={
            current.languages
              ? typeof current.languages === "string"
                ? (current.languages as string)
                    .split(",")
                    .map((v: string) => Number(v.trim()) || v.trim())
                : current.languages
              : undefined
          }
          onChange={(value: unknown) => handleFieldChange("languages", value)}
        />
      </Field>
    );

    const renderDateRangePicker = () => (
      <Field
        name="copyrightStartDate"
        decorator={[FormItem]}
        validator={(_value, _rule, ctx) => {
          const pkg = getPackageValueFromCtx(ctx);
          const start = pkg.copyrightStartDate;
          const end = pkg.copyrightEndDate;
          if (!start || !end) return requiredMessage;
          if (moment(start).isBefore(moment(), "day"))
            return startDatePastMessage;
          if (moment(end).isSameOrBefore(moment(start), "day"))
            return endDateAfterStartMessage;
          return "";
        }}
      >
        {renderLabel(tf("labelCopyrightValidityPeriod"), true)}
        <RangePicker
          disabled={props.disabled}
          style={{ width: "100%" }}
          format="DD/MM/YYYY"
          className="video-game-package-form-date-range-picker"
          placeholder={[tf("phDate"), tf("phDate")]}
          value={
            current.copyrightStartDate && current.copyrightEndDate
              ? [
                  toPickerMoment(current.copyrightStartDate, "YYYY-MM-DD"),
                  toPickerMoment(current.copyrightEndDate, "YYYY-MM-DD"),
                ]
              : null
          }
          onCalendarChange={(dates) => {
            setRangeDates(dates as [Moment | null, Moment | null]);
          }}
          onOpenChange={(open) => {
            if (!open) setRangeDates(null);
          }}
          onChange={(dates) => handleCopyrightRangeChange(dates)}
          disabledDate={(date) => {
            if (!date) return false;
            if (date < moment().startOf("day")) return true;
            if (rangeDates && rangeDates[0] && !rangeDates[1]) {
              return date <= rangeDates[0].clone().startOf("day");
            }
            return false;
          }}
        />
      </Field>
    );

    const renderUpload = (
      name: keyof VideoGamePackageFormValue,
      label: string,
      required: boolean,
      tooltip: string
    ) => (
      <Field
        name={name as string}
        decorator={[FormItem]}
        validator={(value) => {
          if (required && !value) return requiredMessage;
          return "";
        }}
      >
        {renderLabel(label, required, tooltip)}
        <DocumentViewer
          hasDelete={true}
          disabled={props.disabled}
          value={current[name] as string | string[] | undefined}
          onChange={(value) => handleFieldChange(name as string, value)}
          uploadConfig={{
            maxCount: 1,
            maxSize: 5,
            uploadTip: tooltip,
            accept: ".pdf",
            placeholder: tf("uploadPlaceholder"),
          }}
        />
      </Field>
    );

    const renderRadioDigital = () => (
      <Field
        name="addDigitalVersion"
        decorator={[FormItem]}
        validator={(value) => {
          if (value === undefined || value === null) return requiredMessage;
          return "";
        }}
      >
        {renderLabel(tf("labelAddDigitalVersion"), true)}
        <Radio.Group
          disabled={props.disabled}
          className="game-form-radio"
          value={current.addDigitalVersion === true ? "yes" : "no"}
          onChange={(e) =>
            handleFieldChange("addDigitalVersion", e.target.value === "yes")
          }
        >
          <Radio value="yes">{tf("radioYes")}</Radio>
          <Radio value="no">{tf("radioNo")}</Radio>
        </Radio.Group>
      </Field>
    );

    const isDigital = current.addDigitalVersion === true;

    return (
      <div className="video-game-package-form-container" {...props}>
        <AntdCard
          title={
            <span data-content-editable="x-component-props.title">
              {tf("defaultCardTitle")}
            </span>
          }
        >
          <div className="vgp-permit-section">
            <div className="vgp-permit-title">{tf("permitTypesTitle")}</div>
            {permitLabels.map((text) => (
              <Checkbox key={text} checked disabled>
                {text}
              </Checkbox>
            ))}
          </div>

          <Row gutter={24}>
            <Col span={12}>{renderRadioDigital()}</Col>

            {isDigital && <Col span={12}>{renderGamePlatformMulti()}</Col>}

            <Col span={12}>{renderTitleInput()}</Col>

            <Col span={12}>
              {renderSelectSearchable(
                "type",
                tf("labelType"),
                typeOptions,
                true,
                tf("phType"),
                searchType,
                setSearchType
              )}
            </Col>

            <Col span={12}>{renderLanguageSelect()}</Col>

            <Col span={12}>{renderCountrySelect()}</Col>

            <Col span={12}>
              {renderSelectSearchable(
                "copyrightsType",
                tf("labelCopyrightsType"),
                copyrightsTypeOptions,
                true,
                tf("phCopyrightsType"),
                searchCopyrights,
                setSearchCopyrights
              )}
            </Col>

            <Col span={12}>{renderDateRangePicker()}</Col>

            <Col span={12}>{renderDigitalLinkInput()}</Col>

            <Col span={12}>
              {renderUpload(
                "economyRegistrationCertificate",
                tf("labelEconomyRegistrationCertificate"),
                true,
                tf("tooltipEconomyRegistrationCertificate")
              )}
            </Col>

            <Col span={12}>
              {renderUpload(
                "gameMaterialContent",
                tf("labelGameMaterialContent"),
                false,
                tf("tooltipGameMaterialContent")
              )}
            </Col>
          </Row>
        </AntdCard>
      </div>
    );
  });

VideoGamePackageFormField.displayName = "VideoGamePackageFormField";

export default VideoGamePackageFormField;
