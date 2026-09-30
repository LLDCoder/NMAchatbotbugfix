import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { observer, useField, Field } from "@formily/react";
import { FormItem } from "@formily/antd";
import { Checkbox, Select, Row, Col, DatePicker, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import selectedTexts from "../../../../../utils/showTitle";

import moment from "moment";
import {
  getLookupData,
  getPrintingPermitByProfileId,
} from "@/services/services";
import { useUserStore } from "@/store/user";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import i18n from "@/localization/config";
import {
  exceedsDateRangeDays,
  getDisabledDateInputValue,
  isDateAfterMonthsFromToday,
  mergeDisabledDateWithRestriction,
  type RestrictionSetterValue,
} from "@/components/designable/src/utils/dateRestriction";
import "./index.less";
const { Option } = Select;

const DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;
const MAXIMUM_START_DATE_MONTHS = 6;
const MAXIMUM_FILMING_DURATION_DAYS = 90;
const MINIMUM_FILMING_DURATION_DAYS = 1;

const clamp = (s: string, max: number) =>
  s.length > max ? s.slice(0, max) : s;

export type FilmingPurposeFormValue = {
  purposeOfPhotography?: string[];
  photographyStartingDate?: string;
  photographyEndingDate?: string;
  textPermit?: string;
  [key: string]: unknown;
};

type PurposePhotographyOption = {
  label: string;
  value: string;
  code: string;
  nameEn: string;
  nameAr?: string;
};

const TEXT_PERMIT_REQUIRED_PURPOSE_IDS = new Set(["1", "4", "5"]);
const TEXT_PERMIT_SERVICE_CODES = new Set(["7", "14", "20"]);

const resolvePrintingPermitPublicationTypeId = (
  serviceCode?: string | number
): number | null => {
  const normalizedServiceCode = String(serviceCode ?? "").trim();

  if (TEXT_PERMIT_SERVICE_CODES.has(normalizedServiceCode)) {
    return 3;
  }

  if (normalizedServiceCode === "203") {
    return 1;
  }

  return null;
};

const normalizePurposeValues = (purpose?: unknown): string[] => {
  if (Array.isArray(purpose)) {
    return purpose
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }

  const single = String(purpose ?? "").trim();
  return single ? [single] : [];
};

export function needsTextPermit(purpose?: unknown): boolean {
  return normalizePurposeValues(purpose).some((value) =>
    TEXT_PERMIT_REQUIRED_PURPOSE_IDS.has(value)
  );
}

export function getTextPermitServiceType(purpose?: unknown): string[] {
  return normalizePurposeValues(purpose).filter((value) =>
    TEXT_PERMIT_REQUIRED_PURPOSE_IDS.has(value)
  );
}

function getFilmingPurposeValueFromCtx(ctx: any): FilmingPurposeFormValue {
  const form = ctx?.form;
  const leaf = ctx?.field;
  if (!leaf) return {};
  let f: any = leaf.parent;
  let depth = 0;
  while (f && depth++ < 12) {
    let v = f.value;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      if ("purposeOfPhotography" in o || "photographyStartingDate" in o) {
        return v as FilmingPurposeFormValue;
      }
    }
    if (form && f.address != null) {
      v = form.getValuesIn(f.address);
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const o = v as Record<string, unknown>;
        if ("purposeOfPhotography" in o || "photographyStartingDate" in o) {
          return v as FilmingPurposeFormValue;
        }
      }
    }
    f = f.parent;
  }
  return {};
}

function parseDdMmYyyy(s: string) {
  const m = moment(s, "DD/MM/YYYY", true);
  return m.isValid() ? m : null;
}

function resolveMaximumDurationDays(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const duration = Number(value);

  if (!Number.isFinite(duration)) {
    return undefined;
  }

  return Math.min(
    MAXIMUM_FILMING_DURATION_DAYS,
    Math.max(MINIMUM_FILMING_DURATION_DAYS, Math.floor(duration)),
  );
}

export const FilmingPurposeFormField: React.FC<any> = observer((props) => {
  const {
    duration: durationProp,
    restriction: restrictionProp,
    ...containerProps
  } = props;
  const restriction = restrictionProp as RestrictionSetterValue | undefined;
  const maximumDurationDays = resolveMaximumDurationDays(durationProp);
  const field = useField<any>();
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nReact } = useTranslation();
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
        i18n.t(`FilmingPurposeForm.${key}`, {
          lng: i18nLng,
          ...(options ?? {}),
        }),
      ),
    [i18nLng],
  );
  const currentProfileId = useUserStore((state) => state.currentProfileId);
  const current: FilmingPurposeFormValue = field.value || {};
  const restrictionStartDateDisabled = mergeDisabledDateWithRestriction(
    restriction,
    (date) => date.isBefore(moment(), "day"),
    {
      allowWithinSixMonthsFromToday: false,
      replaceDisabledDateWhenRestricted: true,
    },
  );
  const startDateDisabled = (date: moment.Moment) => {
    if (restrictionStartDateDisabled?.(date)) return true;

    return Boolean(
      restriction?.withinSixMonthsFromToday &&
        isDateAfterMonthsFromToday(
          date,
          MAXIMUM_START_DATE_MONTHS,
        ),
    );
  };
  const startDateInputValueRef = useRef("");
  const [searchPurpose, setSearchPurpose] = useState("");
  const [searchPermit, setSearchPermit] = useState("");
  const [PurposePhotography, setPurposePhotography] = useState<
    PurposePhotographyOption[]
  >([]);
  const [permitOptions, setPermitOptions] = useState<
    {
      label: string;
      value: string;
      ApplicationId: string;
      ApplicationNumber: string;
    }[]
  >([]);
  const [permitLoading, setPermitLoading] = useState(false);

  const showTextPermit = needsTextPermit(current.purposeOfPhotography);
  const purposeOptions = React.useMemo(
    () =>
      PurposePhotography.map((item) => ({
        ...item,
        label:
          i18nLng === "ar"
            ? item.nameAr || item.nameEn || item.code
            : item.nameEn || item.nameAr || item.code,
        searchLabel: `${item.nameEn ?? ""} ${item.nameAr ?? ""}`.trim(),
      })),
    [PurposePhotography, i18nLng],
  );

  useEffect(() => {
    getLookupData("PhotographyPurposes").then((opts: any) => {
      const rows = Array.isArray(opts?.data) ? opts.data : [];
      setPurposePhotography(
        rows.map((item: any) => ({
          label: String(item.NameEn || item.NameAr || item.Id || ""),
          value: String(item.Id ?? ""),
          code: String(item.Id ?? ""),
          nameEn: String(item.NameEn || item.NameAr || item.Id || ""),
          nameAr: item.NameAr,
        }))
      );
    });
  }, []);
  useEffect(() => {
    const v = (field.value || {}) as FilmingPurposeFormValue;
    if (!needsTextPermit(v.purposeOfPhotography) && v.textPermit) {
      field.setValue({ ...v, textPermit: undefined });
    }
  }, [field, current.purposeOfPhotography, current.textPermit]);

  useEffect(() => {
    const requiredPurposes = getTextPermitServiceType(current.purposeOfPhotography);
    const profileId = String(currentProfileId || "").trim();
    const publicationTypeId = resolvePrintingPermitPublicationTypeId(
      props.serviceCode
    );

    if (requiredPurposes.length === 0 || !profileId || publicationTypeId === null) {
      setPermitOptions([]);
      return;
    }

    let cancelled = false;
    setPermitLoading(true);
    getPrintingPermitByProfileId(
      profileId,
      publicationTypeId,
      normalizePurposeValues(current.purposeOfPhotography),
    )
      .then((opts: any) => {
        if (!cancelled) {
          const rows = Array.isArray(opts?.data) ? opts.data : [];
          setPermitOptions(
            rows.map((item: any) => ({
              label: String(
                item.ApplicationNumber ||
                  item.applicationNumber ||
                  item.PermitNumber ||
                  item.permitNumber ||
                  item.NameEn ||
                  item.nameEn ||
                  item.Id ||
                  item.id ||
                  ""
              ),
              value: String(
                item.ApplicationNumber ||
                  item.applicationNumber ||
                  item.PermitNumber ||
                  item.permitNumber ||
                  item.Id ||
                  item.id ||
                  ""
              ),
              ApplicationId: String(
                item.ApplicationId || item.applicationId || item.Id || item.id || ""
              ),
              ApplicationNumber: String(
                item.ApplicationNumber ||
                  item.applicationNumber ||
                  item.PermitNumber ||
                  item.permitNumber ||
                  item.NameEn ||
                  item.nameEn ||
                  ""
              ),
            }))
          );
        }
      })
      .catch(() => {
        if (!cancelled) setPermitOptions([]);
      })
      .finally(() => {
        if (!cancelled) setPermitLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [current.purposeOfPhotography, currentProfileId, props.serviceCode]);

  const handleFieldChange = (key: string, value: unknown) => {
    const base = (field.value || {}) as FilmingPurposeFormValue;
    const newValue: FilmingPurposeFormValue = { ...base, [key]: value };

    if (key === "purposeOfPhotography") {
      if (!needsTextPermit(value as string)) {
        newValue.textPermit = undefined;
      } else if (base.purposeOfPhotography !== value) {
        newValue.textPermit = undefined;
      }
    }

    if (key === "photographyStartingDate") {
      const end = base.photographyEndingDate;
      const startStr = value as string | undefined;
      if (startStr && end) {
        const mStart = parseDdMmYyyy(startStr);
        const mEnd = parseDdMmYyyy(end);
        if (
          mStart &&
          mEnd &&
          (mEnd.isBefore(mStart, "day") ||
            (maximumDurationDays !== undefined &&
              exceedsDateRangeDays(
                mStart,
                mEnd,
                maximumDurationDays,
              )))
        ) {
          newValue.photographyEndingDate = undefined;
        }
      }
    }

    field.setValue(newValue);
  };

  const renderLabel = (
    label: string,
    required: boolean = true,
    tooltip?: string,
  ) => (
    <div className="fp-form-label">
      {label}
      {required && <span className="fp-required">*</span>}
      {tooltip && (
        <Tooltip title={tooltip}>
          <QuestionCircleOutlined className="fp-form-label__tooltip" />
        </Tooltip>
      )}
    </div>
  );
  const getStartDateRestrictionTooltip = () => {
    if (
      restriction?.tenDaysFromToday &&
      restriction?.withinSixMonthsFromToday
    ) {
      return tf("tooltipStartWithinAllowedRange");
    }
    if (restriction?.tenDaysFromToday) {
      return tf("tooltipStartMoreThanTenDays");
    }
    if (restriction?.withinSixMonthsFromToday) {
      return tf("tooltipStartWithinSixMonths");
    }

    return undefined;
  };
  const isRuntimeMultiSelect = field?.designable === false;
  const selectedPurposeValues = normalizePurposeValues(
    current.purposeOfPhotography,
  );
  const allPurposeSelected =
    purposeOptions.length > 0 &&
    purposeOptions.every((option) =>
      selectedPurposeValues.includes(option.code),
    );
  const hasSelectedPurposeValues = purposeOptions.some((option) =>
    selectedPurposeValues.includes(option.code),
  );
  const handleSelectAllPurposes = (checked: boolean) => {
    if (!isRuntimeMultiSelect || props.disabled || purposeOptions.length === 0)
      return;
    handleFieldChange(
      "purposeOfPhotography",
      checked ? purposeOptions.map((option) => option.code) : [],
    );
  };

  return (
    <div className="filming-purpose-form-container" {...containerProps}>
      <Row gutter={24}>
        <Col span={12}>
          <Field
            name="purposeOfPhotography"
            decorator={[FormItem]}
            validator={(value) => {
              if (value === undefined || value === null || value === "")
                return tf("validationRequired");
              return "";
            }}
          >
            {renderLabel(tf("labelPurposeOfPhotography"), true)}
            <span
              style={{
                display: "inline-block",
                width: "100%",
                verticalAlign: "top",
              }}
              title={selectedTexts(
                current.purposeOfPhotography,
                purposeOptions,
                "label",
                "code",
              )}
              className="Formily-multi-select"
            >
              <Select
                className={
                  isRuntimeMultiSelect
                    ? "umc-select-arrow-manual filming-purpose-multi-select"
                    : "umc-select-arrow-manual"
                }
                dropdownClassName={
                  isRuntimeMultiSelect
                    ? "filming-purpose-multi-select-dropdown"
                    : undefined
                }
                showSearch
                showArrow
                mode="multiple"
                maxTagCount={2}
                allowClear={true}
                disabled={props.disabled}
                placeholder={tf("phPurposeOfPhotography")}
                value={current.purposeOfPhotography}
                onChange={(v) => handleFieldChange("purposeOfPhotography", v)}
                optionFilterProp={isRuntimeMultiSelect ? "title" : "label"}
                optionLabelProp={isRuntimeMultiSelect ? "label" : undefined}
                filterOption={(input, opt) =>
                  `${String(opt?.title ?? opt?.label ?? "")} ${String(
                    opt?.searchLabel ?? opt?.value ?? "",
                  )}`
                    .toLowerCase()
                    .includes(String(input).toLowerCase())
                }
                onSearch={(v) => setSearchPurpose(clamp(v, 50))}
                searchValue={searchPurpose}
                onSelect={() => setSearchPurpose("")}
                onDropdownVisibleChange={(open: boolean) => {
                  if (!open) setSearchPurpose("");
                }}
                notFoundContent={null}
                dropdownRender={
                  isRuntimeMultiSelect
                    ? (menu) => (
                        <div>
                          <div className="filming-purpose-multi-select-all">
                            <Checkbox
                              className={
                                hasSelectedPurposeValues && !allPurposeSelected
                                  ? "filming-purpose-multi-select-all-checkbox has-selection"
                                  : "filming-purpose-multi-select-all-checkbox"
                              }
                              checked={allPurposeSelected}
                              disabled={
                                props.disabled || purposeOptions.length === 0
                              }
                              onChange={(event) =>
                                handleSelectAllPurposes(event.target.checked)
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
                {purposeOptions.map((p) => (
                  <Option
                    key={p.code}
                    value={p.code}
                    label={
                      isRuntimeMultiSelect ? (
                        <div className="filming-purpose-multi-selection-item">
                          <Checkbox checked />
                          <span>{p.label}</span>
                        </div>
                      ) : (
                        p.label
                      )
                    }
                    title={p.label}
                    searchLabel={p.searchLabel}
                  >
                    {isRuntimeMultiSelect ? (
                      <div className="filming-purpose-multi-option">
                        <Checkbox
                          checked={selectedPurposeValues.includes(p.code)}
                        />
                        <span>{p.label}</span>
                      </div>
                    ) : (
                      p.label
                    )}
                  </Option>
                ))}
              </Select>
            </span>
          </Field>
        </Col>

        <Col span={12}>
          <Field
            name="photographyStartingDate"
            decorator={[FormItem]}
            validator={(value, _rule, ctx) => {
              const pkg = getFilmingPurposeValueFromCtx(ctx);
              const v = (value ?? pkg.photographyStartingDate) as
                | string
                | undefined;
              if (!v || String(v).trim() === "") return tf("validationRequired");
              const s = String(v).trim();
              if (s.length !== 10 || !DATE_REGEX.test(s))
                return tf("validationDateInvalid");
              const m = parseDdMmYyyy(s);
              if (!m) return tf("validationDateInvalid");
              if (startDateDisabled?.(m)) {
                if (
                  restriction?.withinSixMonthsFromToday &&
                  isDateAfterMonthsFromToday(
                    m,
                    MAXIMUM_START_DATE_MONTHS,
                  )
                ) {
                  return tf("validationStartWithinSixMonths");
                }
                if (restriction?.tenDaysFromToday) {
                  return tf("validationStartMoreThanTenDays");
                }
                if (restriction?.beforeToday) {
                  return tf("validationStartBeforeToday");
                }
                if (restriction?.afterToday) {
                  return tf("validationStartAfterToday");
                }
                return tf("validationStartPast");
              }
              return "";
            }}
          >
            {renderLabel(
              tf("labelPhotographyStartingDate"),
              true,
              getStartDateRestrictionTooltip(),
            )}
            <DatePicker
              disabled={props.disabled}
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              placeholder={tf("phDate")}
              value={
                current.photographyStartingDate
                  ? moment(current.photographyStartingDate, "DD/MM/YYYY", true)
                  : null
              }
              onChange={(d) =>
                handleFieldChange(
                  "photographyStartingDate",
                  d ? d.format("DD/MM/YYYY") : undefined,
                )
              }
              inputRender={(inputProps) => (
                <input
                  {...inputProps}
                  onChange={(event) => {
                    startDateInputValueRef.current = event.currentTarget.value;
                    inputProps.onChange?.(event);
                  }}
                />
              )}
              onBlur={() => {
                const disabledInputValue = getDisabledDateInputValue(
                  startDateInputValueRef.current,
                  startDateDisabled,
                );
                startDateInputValueRef.current = "";
                if (disabledInputValue) {
                  handleFieldChange(
                    "photographyStartingDate",
                    disabledInputValue,
                  );
                }
              }}
              disabledDate={startDateDisabled}
            />
          </Field>
        </Col>

        <Col span={12}>
          <Field
            name="photographyEndingDate"
            decorator={[FormItem]}
            validator={(value, _rule, ctx) => {
              const pkg = getFilmingPurposeValueFromCtx(ctx);
              const v = (value ?? pkg.photographyEndingDate) as
                | string
                | undefined;
              if (!v || String(v).trim() === "") return tf("validationRequired");
              const s = String(v).trim();
              if (s.length !== 10 || !DATE_REGEX.test(s))
                return tf("validationDateInvalid");
              const mEnd = parseDdMmYyyy(s);
              if (!mEnd) return tf("validationDateInvalid");
              const startStr = pkg.photographyStartingDate;
              if (startStr) {
                const mStart = parseDdMmYyyy(String(startStr).trim());
                if (mStart && mEnd.isBefore(mStart, "day"))
                  return tf("validationEndBeforeStart");
                if (
                  mStart &&
                  maximumDurationDays !== undefined &&
                  exceedsDateRangeDays(
                    mStart,
                    mEnd,
                    maximumDurationDays,
                  )
                ) {
                  return tf("validationDurationWithinDays", {
                    count: maximumDurationDays,
                  });
                }
              }
              return "";
            }}
          >
            {renderLabel(tf("labelPhotographyEndingDate"), true)}
            <DatePicker
              disabled={props.disabled}
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              placeholder={tf("phDate")}
              value={
                current.photographyEndingDate
                  ? moment(current.photographyEndingDate, "DD/MM/YYYY", true)
                  : null
              }
              onChange={(d) =>
                handleFieldChange(
                  "photographyEndingDate",
                  d ? d.format("DD/MM/YYYY") : undefined,
                )
              }
              disabledDate={(date) => {
                if (!date) return false;
                if (date < moment().startOf("day")) return true;
                const startStr = current.photographyStartingDate;
                if (startStr) {
                  const mStart = parseDdMmYyyy(startStr);
                  if (mStart && date < mStart.clone().startOf("day"))
                    return true;
                  if (
                    mStart &&
                    maximumDurationDays !== undefined &&
                    date.isAfter(
                      mStart.clone().add(maximumDurationDays, "days"),
                      "day",
                    )
                  ) {
                    return true;
                  }
                }
                return false;
              }}
            />
          </Field>
        </Col>

        {showTextPermit && (
          <Col span={12} className="filming-purpose-text-permit-wrap">
            <Field
              name="textPermit"
              decorator={[FormItem]}
              validator={(value, _rule, ctx) => {
                const pkg = getFilmingPurposeValueFromCtx(ctx);
                if (!needsTextPermit(pkg.purposeOfPhotography)) return "";
                const v = value as string | undefined;
                if (!v || String(v).trim() === "") return tf("validationRequired");

                return "";
              }}
            >
              {renderLabel(tf("labelTextPermit"), true)}
              <Select
              className="umc-select-arrow-manual"
                showSearch
                loading={permitLoading}
                disabled={props.disabled}
                placeholder={tf("phTextPermit")}
                value={current.textPermit}
                onChange={(v) => handleFieldChange("textPermit", v)}
                optionFilterProp="label"
                filterOption={(input, opt) =>
                  String(opt?.label ?? opt?.value ?? "")
                    .toLowerCase()
                    .includes(String(input).toLowerCase())
                }
                onSearch={(v) => setSearchPermit(clamp(v, 50))}
                searchValue={searchPermit}
                onSelect={() => setSearchPermit("")}
                onDropdownVisibleChange={(open: boolean) => {
                  if (!open) setSearchPermit("");
                }}
                notFoundContent={
                  <span>
                    {tf("textPermitNotFound")}
                  </span>
                }
              >
                {permitOptions.map((o) => (
                  <Option
                    key={o.ApplicationNumber}
                    value={o.ApplicationNumber}
                    label={o.ApplicationNumber}
                  >
                    {o.ApplicationNumber}
                  </Option>
                ))}
              </Select>
            </Field>
          </Col>
        )}
      </Row>
      {/* Designable ObjectField passes droppable children; preset blocks usually omit type:object */}
      {props.children}
    </div>
  );
});

FilmingPurposeFormField.displayName = "FilmingPurposeFormField";

export default FilmingPurposeFormField;
