import React, { useMemo, useState, useEffect } from "react";
import type { TFunction } from "i18next";
import type { Field as FormilyFieldModel } from "@formily/core";
import { observer, useField, Field,  useForm } from "@formily/react";
import { FormItem } from "@formily/antd";
import selectedTexts from "@/utils/showTitle";
import DocumentViewer from "@/components/common/DocumentViewer";
import { useFormPreviewLang } from "@/components/designable/playground/FormPreviewLangContext";
import i18n from "@/localization/config";

import { Card, Checkbox, Col, DatePicker, Input, Radio, Row, Select } from "antd";
import CustomButton from "@/components/common/CustomButton";
import moment from "moment";
import "./styles.less";
import {
  getLookupData,
  getPortsList,
  getLanguages,
} from "@/services/services";
import {
  ALL_COUNTRIES,
  type CountryOption,
} from "../CountryDropdown/countries";
import {
  getEmirateList,
  getRegionList,
  getAreaList,
  type EmirateItem,
  type RegionItem,
  type AreaItem,
} from "@/services/address";
import { useServicesStore } from "@/store/services";
import { normalizeLookupOptions } from "@/utils/lookupOptions";
import { CompositeMobileNumberField } from "../MobileNumberInput";

const { Option } = Select;

type KeyOfValue =
  | "fullName"
  | "fullNameArabic"
  | "surname"
  | "surnameArabic"
  | "dateOfBirth"
  | "placeOfBirth"
  | "currentNationality"
  | "previousNationality"
  | "religion"
  | "sect"
  | "profession"
  | "monthlyIncome"
  | "poBox"
  | "maritalStatus"
  | "entryDateToUae"
  | "portOfEntry"
  | "sponsorUponEntry"
  | "arrivingFrom"
  | "languages"
  | "educationalQualification"
  | "spouseName"
  | "spouseNationality"
  | "spouseProfession"
  | "countriesVisited"
  | "hasChildren"
  | "children"
  | "fatherName"
  | "fatherNationality"
  | "fatherProfession"
  | "fatherEmployer"
  | "fatherDateOfBirth"
  | "fatherPlaceOfBirth"
  | "motherName"
  | "motherNationality"
  | "motherProfession"
  | "motherEmployer"
  | "motherDateOfBirth"
  | "motherPlaceOfBirth"
  | "workedInMilitary"
  | "militaryCountry"
  | "militaryDecorations"
  | "militaryServiceFrom"
  | "militaryServiceTo"
  | "militaryRank"
  | "previousEmploymentInUae"
  | "relatives"
  | "friends"
  | "residenceFlatHouseNumber"
  | "residenceStreet"
  | "residenceEmirateId"
  | "residenceRegionId"
  | "residenceAreaId"
  | "residenceTelephone"
  | "residenceTelephoneCountryCode"
  | "residenceTelephoneLocalNumber"
  | "passportNumber"
  | "passportPlaceOfIssue"
  | "passportDateOfIssue"
  | "passportExpiryDate"
  | "residencyNumber"
  | "residencyPlaceOfIssue"
  | "residencyDateOfIssue"
  | "residencyExpiryDate"
  | "sponsorFullName"
  | "sponsorAddress"
  | "sponsorPlaceOfEmployment"
  | "sponsorProfession"
  | "sponsorWorkPhone"
  | "sponsorWorkPhoneCountryCode"
  | "sponsorWorkPhoneLocalNumber"
  | "declarationSignature"
  | "declarationDate";

type RelativeFriendItem = {
  name?: string;
  employer?: string;
  /** legacy */
  kinship?: string;
  continent?: string;
};

type AcquaintanceFormValue = Partial<Record<KeyOfValue, any>> & {
  children?: string[];
  relatives?: RelativeFriendItem[];
  friends?: RelativeFriendItem[];
};

type LookupOption = {
  label: string;
  value: string | number;
};

/** ISO3166-1 alpha-2，（） */
const PINNED_COUNTRY_CODES = ["AE", "IN", "PK", "PH", "EG", "BD", "NP", "LK"];

function buildCountrySelectOptions(
  t: TFunction,
): { label: string; value: string }[] {
  const pinned = PINNED_COUNTRY_CODES.map((code) =>
    ALL_COUNTRIES.find((c) => c.value === code),
  ).filter(Boolean) as CountryOption[];
  const pinSet = new Set(PINNED_COUNTRY_CODES);
  const rest = ALL_COUNTRIES.filter((c) => !pinSet.has(c.value)).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  return [{ label: t("AcquaintanceForm.select.country"), value: "" }, ...pinned, ...rest];
}

/** ：、、、 */
const ARABIC_NAME_PATTERN =
  /^[\p{Script_Extensions=Arabic}\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\-']*$/u;

const twoCol = 12;

/** ；（） */
const ACQUAINTANCE_VALIDATE_TRIGGER: Array<"onBlur" | "onSubmit"> = [
  "onBlur",
  "onSubmit",
];

/**
 * ； Field  `onBlur`（ `bindInnerFieldBlur`）。
 * Formily  ReactiveField  `component`  onBlur， JSX 。
 */
const ACQUAINTANCE_FIELD_BLUR = {
  validateTrigger: ACQUAINTANCE_VALIDATE_TRIGGER,
} as any;

/**
 * Formily： validator  triggerType  onInput（ @formily/validator parseValidator）。
 *  field.onBlur  triggerType === 'onBlur' ；。
 */
function acqFieldValidator(
  fn: (value: any, rule?: any, ctx?: any) => string | Promise<string>,
) {
  return { triggerType: "onBlur" as const, validator: fn };
}

/**  Field.onBlur； message （FormItem ） */
function bindAcqControlBlur(inner: FormilyFieldModel) {
  return {
    onBlur: async (e: React.FocusEvent) => {
      await inner.onBlur(e);
    },
  };
}

function getRelativeEmployer(item?: RelativeFriendItem) {
  return item?.employer ?? item?.kinship ?? "";
}

function getFriendEmployer(item?: RelativeFriendItem) {
  return item?.employer ?? item?.continent ?? "";
}

type TextFieldOptions = {
  required?: boolean;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  /** When false, skip all validation (hidden / not applicable) */
  when?: () => boolean;
  custom?: (raw: string) => string;
};

type SelectFieldOptions = TextFieldOptions & {
  mode?: "multiple";
  /** （ Area ） */
  selectDisabled?: boolean;
};
type PortOption = { label: string; value: string | number; country: string };

type DateFieldOptions = {
  required?: boolean;
  when?: () => boolean;
  /** Date string YYYY-MM-DD must be <= today */
  notAfterToday?: boolean;
  /** 「」（） */
  onlyAfterToday?: boolean;
  /** Must be at least 18 years before today */
  minAge18?: boolean;
  /** Must be strictly after this other field (YYYY-MM-DD) */
  afterField?: KeyOfValue;
  /** Custom message when afterField fails */
  afterFieldMessage?: string;
  custom?: (
    dateStr: string | undefined,
    parent?: AcquaintanceFormValue,
  ) => string;
};

/** Root object value for this component (avoids stale React closure in validators). */
function getAcquaintanceRootValue(ctx: any): AcquaintanceFormValue {
  let f = ctx?.field?.parent;
  while (f) {
    const v = f.value;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const rec = v as Record<string, unknown>;
      if (
        ("fullName" in rec && "surname" in rec) ||
        "declarationDate" in rec ||
        "friends" in rec ||
        "relatives" in rec
      ) {
        return v as AcquaintanceFormValue;
      }
    }
    f = f.parent;
  }
  return {};
}

function isEmptyValue(v: unknown, mode?: "multiple") {
  if (mode === "multiple") return !Array.isArray(v) || v.length === 0;
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

function extractResponseArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && "data" in res) {
    const data = (res as { data?: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return [];
}

export const AcquaintanceFormField: React.FC<any> = observer((props) => {
  const lang = useFormPreviewLang();
  const t = i18n.getFixedT(lang);
  const field = useField<any>();
  const form = useForm();
  const current: AcquaintanceFormValue = field.value || {};
  const serviceCode = useServicesStore((state) => state.userInfo.servicesCode);
  const isAr = Boolean(lang?.startsWith("ar"));

    const hideRelationAddButtons =
    props?.disabled ||
    field.pattern === "disabled" ||
    field.pattern === "readOnly" ||
    field.pattern === "readPretty" ||
    form.pattern === "disabled" ||
    form.pattern === "readOnly" ||
    form.pattern === "readPretty";

  const [religionOptions, setReligionOptions] = useState<LookupOption[]>([]);
  const [maritalOptions, setMaritalOptions] = useState<LookupOption[]>([]);
  const [educationOptions, setEducationOptions] = useState<LookupOption[]>([]);
  const [portOfEntryList, setPortOfEntryList] = useState<PortOption[]>([]);
  const [languageOptionsList, setLanguageOptionsList] = useState<
    { label: string; value: number }[]
  >([]);
  const [emirates, setEmirates] = useState<EmirateItem[]>([]);
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [loadingReligion, setLoadingReligion] = useState(false);
  const [loadingMarital, setLoadingMarital] = useState(false);
  const [loadingEducation, setLoadingEducation] = useState(false);
  const [loadingPortOfEntry, setLoadingPortOfEntry] = useState(false);
  const [loadingAddressLists, setLoadingAddressLists] = useState(false);

  useEffect(() => {
    const loadReligion = async () => {
      setLoadingReligion(true);
      try {
        const res = await getLookupData("Religion", serviceCode);
        setReligionOptions(normalizeLookupOptions(res, isAr));
      } catch (error) {
        console.error("Failed to load religion list", error);
      } finally {
        setLoadingReligion(false);
      }
    };

    const loadMarital = async () => {
      setLoadingMarital(true);
      try {
        const res = await getLookupData("MaritalStatus", serviceCode);
        setMaritalOptions(normalizeLookupOptions(res, isAr));
      } catch (error) {
        console.error("Failed to load marital list", error);
      } finally {
        setLoadingMarital(false);
      }
    };

    const loadEducation = async () => {
      setLoadingEducation(true);
      try {
        const res = await getLookupData("Qualifications", serviceCode);
        setEducationOptions(normalizeLookupOptions(res, isAr));
      } catch (error) {
        console.error("Failed to load education list", error);
      } finally {
        setLoadingEducation(false);
      }
    };
    const normalizeOptions = (data: Array<Record<string, unknown>>): PortOption[] => {
      if (!Array.isArray(data)) return [];
      return data.map((item) => {
        const label =
          item.nameEn ??
          item.name ??
          item.label ??
          item.labelEn ??
          String(item.Id ?? item.value ?? "");
        const rawValue = item.Id ?? item.value ?? item.code ?? label;
        const value =
          typeof rawValue === "string" || typeof rawValue === "number"
            ? rawValue
            : String(rawValue);
        const rawCountry = item.emirateNameEn;
        const country =
          typeof rawCountry === "string" || typeof rawCountry === "number"
            ? String(rawCountry)
            : "-";
        return { label: String(label), value, country };
      });
    };
    const loadPortOfEntry = async () => {
      setLoadingPortOfEntry(true);
      try {
        // const res = await GetPorts();
        const res = await getPortsList();
        const data = extractResponseArray<Record<string, unknown>>(res);
        setPortOfEntryList(normalizeOptions(data));
      } catch (error) {
        console.error("Failed to load port of entry list", error);
      } finally {
        setLoadingPortOfEntry(false);
      }
    };

    const loadLanguages = async () => {
      try {
        const res = await getLanguages();
        const data = extractResponseArray<{ id: number; nameEn: string }>(res);
        setLanguageOptionsList(
          data.map((x) => ({
            label: x.nameEn,
            value: x.id,
          })),
        );
      } catch (error) {
        console.error("Failed to load languages list", error);
      }
    };

    const loadAddressLists = async () => {
      setLoadingAddressLists(true);
      try {
        const [eRes, rRes, aRes] = await Promise.all([
          getEmirateList(),
          getRegionList(),
          getAreaList(),
        ]);
        setEmirates(eRes.data || []);
        setRegions(rRes.data || []);
        setAreas(aRes.data || []);
      } catch (error) {
        console.error("Failed to load emirate/region/area lists", error);
      } finally {
        setLoadingAddressLists(false);
      }
    };

    loadReligion();
    loadMarital();
    loadEducation();
    loadPortOfEntry();
    loadLanguages();
    loadAddressLists();
  }, [isAr, serviceCode]);

  /** Declaration date defaults to today; no future dates allowed by validator */
  useEffect(() => {
    if (props?.disabled) return;
    const v = field.value as AcquaintanceFormValue | undefined;
    if (v?.declarationDate) return;
    field.setValue({
      ...(v || {}),
      declarationDate: moment().format("YYYY-MM-DD"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init default once on mount
  }, []);

  const childrenList = useMemo(
    () => (current.children || [""]) as string[],
    [current.children],
  );
  const childrenRenderList = useMemo(
    () => (childrenList.length ? childrenList : ([""] as string[])),
    [childrenList],
  );
  const relativesList = useMemo(() => {
    const raw = current.relatives || [{ name: "", employer: "" }];
    return raw.map((item: RelativeFriendItem) => ({
      name: item.name ?? "",
      employer: getRelativeEmployer(item),
    })) as RelativeFriendItem[];
  }, [current.relatives]);
  const relativesRenderList = useMemo(
    () =>
      relativesList.length
        ? relativesList
        : ([{ name: "", employer: "" }] as RelativeFriendItem[]),
    [relativesList],
  );
  const friendsList = useMemo(() => {
    const raw = current.friends || [{ name: "", employer: "" }];
    return raw.map((item: RelativeFriendItem) => ({
      name: item.name ?? "",
      employer: getFriendEmployer(item),
    })) as RelativeFriendItem[];
  }, [current.friends]);
  const friendsRenderList = useMemo(
    () =>
      friendsList.length
        ? friendsList
        : ([{ name: "", employer: "" }] as RelativeFriendItem[]),
    [friendsList],
  );

  const showResidenceRegion = Number(current.residenceEmirateId) === 1;

  const filteredResidenceRegions = useMemo(() => {
    if (!current.residenceEmirateId) return [];
    return regions.filter((r) => r.emirateId === current.residenceEmirateId);
  }, [regions, current.residenceEmirateId]);

  const filteredResidenceAreas = useMemo(() => {
    if (!current.residenceEmirateId) return [];
    if (Number(current.residenceEmirateId) === 1) {
      if (!current.residenceRegionId) return [];
      return areas.filter((a) => a.regionId === current.residenceRegionId);
    }
    const regionIds = new Set(
      regions
        .filter((r) => r.emirateId === current.residenceEmirateId)
        .map((r) => r.id),
    );
    return areas.filter((a) => regionIds.has(a.regionId));
  }, [areas, regions, current.residenceEmirateId, current.residenceRegionId]);

  const residenceAreaSelectDisabled =
    props?.disabled ||
    !current.residenceEmirateId ||
    (Number(current.residenceEmirateId) === 1 && !current.residenceRegionId);

  const emirateSelectOptions = useMemo(
    () => [
      { label: t("AcquaintanceForm.select.emirate"), value: "" },
      ...emirates.map((e) => ({ label: e.nameEn, value: e.id })),
    ],
    [emirates, t],
  );

  const regionSelectOptions = useMemo(
    () => [
      { label: t("AcquaintanceForm.select.region"), value: "" },
      ...filteredResidenceRegions.map((r) => ({
        label: r.nameEn,
        value: r.id,
      })),
    ],
    [filteredResidenceRegions, t],
  );

  const areaSelectOptions = useMemo(
    () => [
      { label: t("AcquaintanceForm.select.area"), value: "" },
      ...filteredResidenceAreas.map((a) => ({ label: a.nameEn, value: a.id })),
    ],
    [filteredResidenceAreas, t],
  );

  const handleFieldChange = (key: KeyOfValue, value: unknown) => {
    const updates: AcquaintanceFormValue = {
      ...current,
      [key]: value,
    } as AcquaintanceFormValue;

    if (key === "religion") {
      updates.sect = undefined;
    }

    if (key === "hasChildren") {
      if (value === "No") {
        updates.children = ["N/A"];
      } else if (value === "Yes") {
        const ch = (current.children || []) as string[];
        const next = ch.filter((c) => c !== "N/A");
        updates.children = next.length ? next : [""];
      }
    }

    if (key === "workedInMilitary") {
      if (value === "No") {
        updates.militaryCountry = "N/A";
        updates.militaryDecorations = "N/A";
        updates.militaryRank = "N/A";
        updates.previousEmploymentInUae = "N/A";
      } else if (value === "Yes") {
        const clearNa = (x: unknown) => (x === "N/A" ? undefined : x);
        updates.militaryCountry = clearNa(current.militaryCountry);
        updates.militaryDecorations = clearNa(current.militaryDecorations);
        updates.militaryRank = clearNa(current.militaryRank);
        updates.previousEmploymentInUae = clearNa(
          current.previousEmploymentInUae,
        );
      }
    }

    if (key === "residenceEmirateId") {
      updates.residenceRegionId = undefined;
      updates.residenceAreaId = undefined;
    }
    if (key === "residenceRegionId") {
      updates.residenceAreaId = undefined;
    }

    field.setValue(updates);
  };

  const portOfEntryOptions = useMemo(() => {
    return portOfEntryList.map((item) => ({
      label: item.label,
      value: String(item.value),
    }));
  }, [portOfEntryList]);

  const countryOptions = useMemo(() => buildCountrySelectOptions(t), [t]);

  const addChild = () => {
    field.setValue({
      ...current,
      children: [...childrenRenderList, ""],
    });
  };

  const addRelative = () => {
    field.setValue({
      ...current,
      relatives: [...relativesRenderList, { name: "", employer: "" }],
    });
  };

  const addFriend = () => {
    field.setValue({
      ...current,
      friends: [...friendsRenderList, { name: "", employer: "" }],
    });
  };

  const updateChildName = (index: number, value: string) => {
    const next = [...childrenList];
    next[index] = value;
    field.setValue({
      ...current,
      children: next,
    });
  };

  const updateRelative = (
    index: number,
    key: "name" | "employer",
    value: string,
  ) => {
    const next = relativesList.map((item, idx) =>
      idx === index ? { ...item, [key]: value } : item,
    );
    field.setValue({
      ...current,
      relatives: next,
    });
  };

  const updateFriend = (
    index: number,
    key: "name" | "employer",
    value: string,
  ) => {
    const next = friendsList.map((item, idx) =>
      idx === index ? { ...item, [key]: value } : item,
    );
    field.setValue({
      ...current,
      friends: next,
    });
  };

  const renderRequiredLabel = (
    label: React.ReactNode,
    align: "left" | "right" = "left",
  ) => {
    return (
      <div
        className="acq-form-label"
        // style={align === "right" ? { direction: "rtl" } : undefined}
      >
        {label}
        <span className="formItem-required"> *</span>
      </div>
    );
  };

  const renderOptionalLabel = (label: React.ReactNode) => {
    return <div className="acq-form-label">{label}</div>;
  };

  /** /： */
  const renderArabicNameInput = (
    name: KeyOfValue,
    placeholder: string,
    required?: boolean,
    maxLen?: number,
  ) => {
    return (
      <Field
        name={name}
        {...ACQUAINTANCE_FIELD_BLUR}
        decorator={[FormItem]}
        validator={acqFieldValidator((value) => {
          const raw = String(value ?? "").trim();
          if (required && raw === "") return t("AcquaintanceForm.validation.required");
          if (raw && !ARABIC_NAME_PATTERN.test(raw))
            return t("AcquaintanceForm.validation.arabicOnly");
          if (maxLen != null && raw.length > maxLen)
            return t("AcquaintanceForm.validation.maxChars", { max: maxLen });
          return "";
        })}
      >
        {(inner: FormilyFieldModel) => (
          <Input
            disabled={props?.disabled}
            dir="rtl"
            className="ant-input-affix-wrapper"
            placeholder={placeholder}
            maxLength={maxLen}
            value={current[name] || ""}
            onChange={(e) => handleFieldChange(name, e.target.value)}
            {...bindAcqControlBlur(inner)}
          />
        )}
      </Field>
    );
  };

  const renderTextInput = (
    name: KeyOfValue,
    placeholder: string,
    required?: boolean,
    opts?: TextFieldOptions,
  ) => {
    const merged: TextFieldOptions = {
      required,
      ...opts,
    };
    return (
      <Field
        name={name}
        {...ACQUAINTANCE_FIELD_BLUR}
        decorator={[FormItem]}
        validator={acqFieldValidator((value, _rule, ctx) => {
          const root = getAcquaintanceRootValue(ctx);
          if (merged.when && root.workedInMilitary !== "Yes") return "";
          const raw = String(value ?? "").trim();
          if (merged.required && raw === "") return t("AcquaintanceForm.validation.required");
          if (merged.maxLength != null && raw.length > merged.maxLength)
            return t("AcquaintanceForm.validation.maxChars", {
              max: merged.maxLength,
            });
          if (merged.pattern && raw && !merged.pattern.test(raw))
            return merged.patternMessage || t("AcquaintanceForm.validation.invalidFormat");
          if (merged.custom) {
            const msg = merged.custom(raw);
            if (msg) return msg;
          }
          return "";
        })}
      >
        {(inner: FormilyFieldModel) => (
          <Input
            disabled={props?.disabled}
            className="ant-input-affix-wrapper"
            placeholder={placeholder}
            maxLength={opts?.maxLength}
            value={current[name] || ""}
            onChange={(e) => handleFieldChange(name, e.target.value)}
            {...bindAcqControlBlur(inner)}
          />
        )}
      </Field>
    );
  };

  const renderSelect = (
    name: KeyOfValue,
    placeholder: string,
    options: { label: string; value: string | number }[],
    required?: boolean,
    mode?: "multiple",
    opts?: SelectFieldOptions,
  ) => {
    const merged: SelectFieldOptions = { required, mode, ...opts };
    const isRuntimeMultiple =
      mode === "multiple" && field?.designable === false;
    const availableOptions = options.filter(
      (option) => String(option.value) !== "" || !merged.required,
    );
    const selectedValues: Array<string | number> = Array.isArray(current[name])
      ? (current[name] as Array<string | number>)
      : current[name] !== undefined &&
        current[name] !== null &&
        current[name] !== ""
      ? [current[name] as string | number]
      : [];
    const allSelected =
      availableOptions.length > 0 &&
      availableOptions.every((option) =>
        selectedValues.includes(option.value),
      );
    const hasSelectedValues = availableOptions.some((option) =>
      selectedValues.includes(option.value),
    );
    const selectDisabled = Boolean(props?.disabled || merged.selectDisabled);
    const handleSelectAll = (checked: boolean) => {
      if (!isRuntimeMultiple || selectDisabled || availableOptions.length === 0)
        return;
      handleFieldChange(
        name,
        checked ? availableOptions.map((option) => option.value) : [],
      );
    };
    return (
      <Field
        name={name}
        {...ACQUAINTANCE_FIELD_BLUR}
        decorator={[FormItem]}
        validator={acqFieldValidator((value, _rule, ctx) => {
          const root = getAcquaintanceRootValue(ctx);
          if (merged.when && root.workedInMilitary !== "Yes") return "";
          if (merged.required && isEmptyValue(value, merged.mode))
            return t("AcquaintanceForm.validation.required");
          return "";
        })}
      >
        {(inner: FormilyFieldModel) => (
          <span
            style={{
              display: "inline-block",
              width: "100%",
              verticalAlign: "top",
            }}
            title={selectedTexts(current[name], options, "label", "value")}
            className="Formily-multi-select"
          >
            <Select
              className={
                isRuntimeMultiple
                  ? "umc-select-arrow-manual acquaintance-multi-select"
                  : "umc-select-arrow-manual"
              }
              dropdownClassName={
                isRuntimeMultiple
                  ? "acquaintance-multi-select-dropdown"
                  : undefined
              }
              placeholder={placeholder}
              disabled={selectDisabled}
              loading={
                (name === "religion" && loadingReligion) ||
                  (name === "maritalStatus" && loadingMarital) ||
                  (name === "educationalQualification" && loadingEducation) ||
                  (name === "portOfEntry" && loadingPortOfEntry) ||
                  ((name === "residenceEmirateId" ||
                    name === "residenceRegionId" ||
                    name === "residenceAreaId") &&
                    loadingAddressLists)
              }
              value={current[name] ?? (mode === "multiple" ? [] : undefined)}
              onChange={(value) => handleFieldChange(name, value)}
              mode={mode}
              maxTagCount={mode === "multiple" ? 2 : undefined}
              showSearch
              showArrow
              optionFilterProp={isRuntimeMultiple ? "title" : "children"}
              optionLabelProp={isRuntimeMultiple ? "label" : undefined}
              dropdownRender={
                isRuntimeMultiple
                  ? (menu) => (
                      <div>
                        <div className="acquaintance-multi-select-all">
                          <Checkbox
                            className={
                              hasSelectedValues && !allSelected
                                ? "acquaintance-multi-select-all-checkbox has-selection"
                                : "acquaintance-multi-select-all-checkbox"
                            }
                            checked={allSelected}
                            disabled={
                              selectDisabled || availableOptions.length === 0
                            }
                            onChange={(event) =>
                              handleSelectAll(event.target.checked)
                            }
                          >
                            {t("LanguageSelectMulti.selectAll")}
                          </Checkbox>
                        </div>
                        <div>{menu}</div>
                      </div>
                    )
                  : undefined
              }
              {...bindAcqControlBlur(inner)}
            >
              {availableOptions.map((o) => (
                  <Option
                    key={String(o.value)}
                    value={o.value as never}
                    title={o.label}
                    label={
                      isRuntimeMultiple ? (
                        <div className="acquaintance-multi-selection-item">
                          <Checkbox checked />
                          <span>{o.label}</span>
                        </div>
                      ) : undefined
                    }
                  >
                    {isRuntimeMultiple ? (
                      <div className="acquaintance-multi-option">
                        <Checkbox checked={selectedValues.includes(o.value)} />
                        <span>{o.label}</span>
                      </div>
                    ) : (
                      o.label
                    )}
                  </Option>
                ))}
            </Select>
          </span>
        )}
      </Field>
    );
  };

  const renderDate = (
    name: KeyOfValue,
    placeholder: string,
    required?: boolean,
    opts?: DateFieldOptions,
  ) => {
    const merged: DateFieldOptions = { required, ...opts };
    return (
      <Field
        name={name}
        {...ACQUAINTANCE_FIELD_BLUR}
        decorator={[FormItem]}
        validator={acqFieldValidator((value, _rule, ctx) => {
          const root = getAcquaintanceRootValue(ctx);
          if (merged.when && root.workedInMilitary !== "Yes") return "";
          const raw = value as string | undefined;
          if (merged.required && !raw) return t("AcquaintanceForm.validation.required");
          if (raw) {
            const d = moment(raw, "YYYY-MM-DD", true);
            if (!d.isValid()) return t("AcquaintanceForm.validation.invalidDate");
            if (merged.onlyAfterToday) {
              if (
                !d
                  .clone()
                  .startOf("day")
                  .isAfter(moment().clone().startOf("day"))
              ) {
                return t("AcquaintanceForm.validation.dateAfterToday");
              }
            }
            if (merged.notAfterToday && d.isAfter(moment(), "day"))
              return t("AcquaintanceForm.validation.dateNotFuture");
            if (merged.minAge18) {
              const age = moment().diff(d, "years", true);
              if (age < 18) return t("AcquaintanceForm.validation.minAge18");
            }
            if (merged.afterField) {
              const other = root[merged.afterField] as string | undefined;
              if (other) {
                const od = moment(other, "YYYY-MM-DD", true);
                if (d.isSameOrBefore(od, "day"))
                  return (
                    merged.afterFieldMessage ||
                    t("AcquaintanceForm.validation.dateAfterRelated")
                  );
              }
            }
            if (merged.custom) {
              const msg = merged.custom(raw, root);
              if (msg) return msg;
            }
          }
          return "";
        })}
      >
        {(inner: FormilyFieldModel) => {
          const pickerValue = current[name]
            ? moment(current[name] as string, "YYYY-MM-DD")
            : null;
          const controlBlur = bindAcqControlBlur(inner).onBlur;

          return (
            <DatePicker
              disabled={props?.disabled}
              format="DD/MM/YYYY"
              style={{ width: "100%" }}
              placeholder={placeholder}
              disabledDate={
                merged.onlyAfterToday
                  ? (d) => {
                      if (!d) return false;
                      return !d
                        .clone()
                        .startOf("day")
                        .isAfter(moment().clone().startOf("day"));
                    }
                  : merged.notAfterToday
                    ? (d) =>
                        !!d &&
                        d.clone().startOf("day").isAfter(moment().startOf("day"))
                    : undefined
              }
              value={pickerValue}
              onChange={(date) =>
                handleFieldChange(
                  name,
                  date ? date.format("YYYY-MM-DD") : undefined,
                )
              }
              onBlur={(e) => {
                void controlBlur(e);
              }}
            />
          );
        }}
      </Field>
    );
  };

  const renderTextArea = (
    name: KeyOfValue,
    placeholder: string,
    required?: boolean,
    opts?: TextFieldOptions & { rows?: number },
  ) => {
    const merged: TextFieldOptions = { required, ...opts };
    return (
      <Field
        name={name}
        {...ACQUAINTANCE_FIELD_BLUR}
        decorator={[FormItem]}
        validator={acqFieldValidator((value, _rule, ctx) => {
          const root = getAcquaintanceRootValue(ctx);
          if (merged.when && root.workedInMilitary !== "Yes") return "";
          const raw = String(value ?? "").trim();
          if (merged.required && raw === "") return t("AcquaintanceForm.validation.required");
          if (merged.maxLength != null && raw.length > merged.maxLength)
            return t("AcquaintanceForm.validation.maxChars", {
              max: merged.maxLength,
            });
          if (merged.custom) {
            const msg = merged.custom(raw);
            if (msg) return msg;
          }
          return "";
        })}
      >
        {(inner: FormilyFieldModel) => (
          <Input.TextArea
            disabled={props?.disabled}
            placeholder={placeholder}
            rows={opts?.rows ?? 4}
            maxLength={opts?.maxLength}
            value={current[name] || ""}
            onChange={(e) => handleFieldChange(name, e.target.value)}
            {...bindAcqControlBlur(inner)}
          />
        )}
      </Field>
    );
  };

  const renderUpload = (
    name: KeyOfValue,
    required?: boolean,
  ) => {
    return (
      <Field
        name={name}
        {...ACQUAINTANCE_FIELD_BLUR}
        decorator={[FormItem]}
        validator={acqFieldValidator((value) => {
          if (required && isEmptyValue(value)) {
            return t("AcquaintanceForm.validation.required");
          }
          return "";
        })}
      >
        <DocumentViewer
          label=""
          disabled={props?.disabled}
          value={typeof current[name] === "string" ? current[name] : undefined}
          onChange={(value) => handleFieldChange(name, value)}
          uploadConfig={{
            maxSize: 5,
            maxCount: 1,
            accept: ".jpg,.jpeg,.png",
            placeholder: t("common.uploadFile"),
            uploadTip: t("AcquaintanceForm.placeholder.uploadSignatureImage"),
            invalidFileTypeMessage: t(
              "AcquaintanceForm.validation.signatureImageOnly",
            ),
          }}
          hasView={true}
          hasDelete={true}
        />
      </Field>
    );
  };

  const hasChildren = current.hasChildren === "Yes";
  const childrenNo = current.hasChildren === "No";
  const workedInMilitary = current.workedInMilitary === "Yes";
  const militaryNo = current.workedInMilitary === "No";

  return (
    <div className="acq-form-container" {...props}>
      {/* <Card className="acq-form-card" title="Acquaintance Form">
      </Card> */}
      <div>
        <Card
          className="acq-form-section"
          title={t("AcquaintanceForm.section.personalInformation")}
        >
          <Row gutter={24}>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.fullName"))}
              {renderTextInput(
                "fullName",
                t("AcquaintanceForm.placeholder.enterFullName"),
                true,
                {
                  maxLength: 100,
                  pattern: /^[a-zA-Z\s-]+$/,
                  patternMessage: t(
                    "AcquaintanceForm.validation.patternLettersHyphens",
                  ),
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(
                t("AcquaintanceForm.label.fullNameArabic"),
                "right",
              )}
              {renderArabicNameInput(
                "fullNameArabic",
                t("AcquaintanceForm.placeholder.enterFullNameArabic"),
                true,
                100,
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.surname"))}
              {renderTextInput(
                "surname",
                t("AcquaintanceForm.placeholder.enterSurname"),
                true,
                {
                  maxLength: 50,
                  pattern: /^[a-zA-Z]+$/,
                  patternMessage: t(
                    "AcquaintanceForm.validation.patternLettersOnly",
                  ),
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(
                t("AcquaintanceForm.label.surnameArabic"),
                "right",
              )}
              {renderArabicNameInput(
                "surnameArabic",
                t("AcquaintanceForm.placeholder.enterSurnameArabic"),
                true,
                50,
              )}
            </Col>

            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.dateOfBirth"))}
              {renderDate(
                "dateOfBirth",
                t("AcquaintanceForm.common.datePlaceholder"),
                true,
                {
                  notAfterToday: true,
                  minAge18: true,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.placeOfBirth"))}
              {renderTextInput(
                "placeOfBirth",
                t("AcquaintanceForm.placeholder.placeOfBirth"),
                true,
                {
                  maxLength: 100,
                },
              )}
            </Col>

            <Col span={twoCol}>
              {renderRequiredLabel(
                t("AcquaintanceForm.label.currentNationality"),
              )}
              {renderSelect(
                "currentNationality",
                t("AcquaintanceForm.select.nationality"),
                countryOptions,
                true,
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(
                t("AcquaintanceForm.label.previousNationality"),
              )}
              {renderSelect(
                "previousNationality",
                t("AcquaintanceForm.select.nationality"),
                countryOptions,
                true,
              )}
            </Col>

            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.religion"))}
              {renderSelect(
                "religion",
                t("AcquaintanceForm.select.religion"),
                religionOptions,
                true,
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.sect"))}
              {renderTextInput(
                "sect",
                t("AcquaintanceForm.label.sect"),
                true,
                { maxLength: 100 },
              )}
            </Col>

            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.profession"))}
              {renderTextInput(
                "profession",
                t("AcquaintanceForm.placeholder.enterProfession"),
                true,
                {
                  maxLength: 100,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.maritalStatus"))}
              {renderSelect(
                "maritalStatus",
                t("AcquaintanceForm.select.maritalStatus"),
                maritalOptions,
                true,
              )}
            </Col>

            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.entryDateToUae"))}
              {renderDate(
                "entryDateToUae",
                t("AcquaintanceForm.common.datePlaceholder"),
                true,
                {
                  notAfterToday: true,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.portOfEntry"))}
              {renderSelect(
                "portOfEntry",
                t("AcquaintanceForm.select.portOfEntry"),
                portOfEntryOptions,
                true,
              )}
            </Col>

            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.sponsorUponEntry"))}
              {renderTextInput(
                "sponsorUponEntry",
                t("AcquaintanceForm.placeholder.enterSponsorUponEntry"),
                true,
                { maxLength: 100 },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.arrivingFrom"))}
              {renderSelect(
                "arrivingFrom",
                t("AcquaintanceForm.select.country"),
                countryOptions,
                true,
              )}
            </Col>

            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.languages"))}
              {renderSelect(
                "languages",
                t("AcquaintanceForm.select.language"),
                languageOptionsList,
                true,
                "multiple",
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(
                t("AcquaintanceForm.label.educationalQualification"),
              )}
              {renderSelect(
                "educationalQualification",
                t("AcquaintanceForm.select.educationalQualification"),
                educationOptions,
                true,
              )}
            </Col>

            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.spouseName"))}
              {renderTextInput(
                "spouseName",
                t("AcquaintanceForm.placeholder.spouseName"),
                true,
                {
                  maxLength: 100,
                  pattern: /^[a-zA-Z\s]+$/,
                  patternMessage: t(
                    "AcquaintanceForm.validation.patternLettersSpaces",
                  ),
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(
                t("AcquaintanceForm.label.spouseNationality"),
              )}
              {renderSelect(
                "spouseNationality",
                t("AcquaintanceForm.select.nationality"),
                countryOptions,
                true,
              )}
            </Col>

            <Col span={twoCol}>
              {renderRequiredLabel(
                t("AcquaintanceForm.label.spouseProfession"),
              )}
              {renderTextInput(
                "spouseProfession",
                t("AcquaintanceForm.placeholder.enterHusbandWifeProfession"),
                true,
                { maxLength: 100 },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.countriesVisited"))}
              {renderSelect(
                "countriesVisited",
                t("AcquaintanceForm.select.countries"),
                countryOptions,
                true,
                "multiple",
              )}
            </Col>
          </Row>
        </Card>

        <Card
          className="acq-form-section"
          title={t("AcquaintanceForm.section.childrenInformation")}
        >
          <Row gutter={24}>
            <Col span={24}>
              {renderRequiredLabel(t("AcquaintanceForm.label.hasChildren"))}
              <Field
                name="hasChildren"
                {...ACQUAINTANCE_FIELD_BLUR}
                decorator={[FormItem]}
                validator={acqFieldValidator((value) => {
                  if (value !== "Yes" && value !== "No")
                    return t("AcquaintanceForm.validation.required");
                  return "";
                })}
              >
                {(inner: FormilyFieldModel) => (
                  <Radio.Group
                    disabled={props?.disabled}
                    value={current.hasChildren ?? undefined}
                    onChange={(e) =>
                      handleFieldChange("hasChildren", e.target.value)
                    }
                    {...bindAcqControlBlur(inner)}
                  >
                    <Radio value="Yes">{t("AcquaintanceForm.common.yes")}</Radio>
                    <Radio value="No">{t("AcquaintanceForm.common.no")}</Radio>
                  </Radio.Group>
                )}
              </Field>
            </Col>

            {childrenNo && (
              <Col span={24}>
                {renderRequiredLabel(t("AcquaintanceForm.label.childrenNames"))}
                <Input
                  disabled
                  className="ant-input-affix-wrapper"
                  value={t("AcquaintanceForm.common.na")}
                />
              </Col>
            )}

            {hasChildren && (
              <Col span={24} className="acq-form-list-block">
                <Row gutter={24}>
                  {(childrenList.length ? childrenList : [""]).map((_, idx) => (
                    <Col key={`child-${idx}`} span={12}>
                      {renderRequiredLabel(
                        t("AcquaintanceForm.label.childrenNameIndexed", {
                          index: idx + 1,
                        }),
                      )}
                      <Field
                        name={`children.${idx}`}
                        {...ACQUAINTANCE_FIELD_BLUR}
                        decorator={[FormItem]}
                        validator={acqFieldValidator((value, _rule, ctx) => {
                          if (
                            getAcquaintanceRootValue(ctx).hasChildren !== "Yes"
                          )
                            return "";
                          const v = String(value ?? "").trim();
                          if (!v) return t("AcquaintanceForm.validation.required");
                          if (v.length > 100)
                            return t("AcquaintanceForm.validation.maxChars", {
                              max: 100,
                            });
                          return "";
                        })}
                      >
                        {(inner: FormilyFieldModel) => (
                          <Input
                            disabled={props?.disabled}
                            className="ant-input-affix-wrapper"
                            placeholder={t("AcquaintanceForm.placeholder.enterName")}
                            maxLength={100}
                            value={childrenList[idx] ?? ""}
                            onChange={(e) =>
                              updateChildName(idx, e.target.value)
                            }
                            {...bindAcqControlBlur(inner)}
                          />
                        )}
                      </Field>
                    </Col>
                  ))}
                </Row>
                {!hideRelationAddButtons && (
                  <div className="acq-form-actions">
                    <CustomButton
                      disabled={
                        props?.disabled || childrenRenderList.length >= 10
                      }
                      onClick={addChild}
                    >
                      {t("AcquaintanceForm.common.add")}
                    </CustomButton>
                  </div>
                 )}
              </Col>
            )}
          </Row>
        </Card>

        <Card
          className="acq-form-section"
          title={t("AcquaintanceForm.section.parentsInformation")}
        >
          <Row gutter={24}>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.fatherName"))}
              {renderTextInput(
                "fatherName",
                t("AcquaintanceForm.placeholder.enterFatherName"),
                true,
                {
                  maxLength: 100,
                  pattern: /^[a-zA-Z\s]+$/,
                  patternMessage: t(
                    "AcquaintanceForm.validation.patternLettersSpaces",
                  ),
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.fatherNationality"))}
              {renderSelect(
                "fatherNationality",
                t("AcquaintanceForm.select.nationality"),
                countryOptions,
                true,
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.profession"))}
              {renderTextInput(
                "fatherProfession",
                t("AcquaintanceForm.placeholder.enterProfession"),
                true,
                {
                  maxLength: 100,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.employer"))}
              {renderTextInput(
                "fatherEmployer",
                t("AcquaintanceForm.placeholder.enterEmployer"),
                true,
                {
                  maxLength: 100,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.dateOfBirth"))}
              {renderDate(
                "fatherDateOfBirth",
                t("AcquaintanceForm.common.datePlaceholder"),
                true,
                {
                  notAfterToday: true,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.placeOfBirth"))}
              {renderTextInput(
                "fatherPlaceOfBirth",
                t("AcquaintanceForm.placeholder.placeOfBirth"),
                true,
                {
                  maxLength: 100,
                },
              )}
            </Col>

            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.motherName"))}
              {renderTextInput(
                "motherName",
                t("AcquaintanceForm.placeholder.enterMotherName"),
                true,
                {
                  maxLength: 100,
                  pattern: /^[a-zA-Z\s]+$/,
                  patternMessage: t(
                    "AcquaintanceForm.validation.patternLettersSpaces",
                  ),
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.motherNationality"))}
              {renderSelect(
                "motherNationality",
                t("AcquaintanceForm.select.nationality"),
                countryOptions,
                true,
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.profession"))}
              {renderTextInput(
                "motherProfession",
                t("AcquaintanceForm.placeholder.enterProfession"),
                true,
                {
                  maxLength: 100,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderOptionalLabel(t("AcquaintanceForm.label.employer"))}
              {renderTextInput(
                "motherEmployer",
                t("AcquaintanceForm.placeholder.enterEmployer"),
                false,
                {
                  maxLength: 100,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.dateOfBirth"))}
              {renderDate(
                "motherDateOfBirth",
                t("AcquaintanceForm.common.datePlaceholder"),
                true,
                {
                  notAfterToday: true,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.placeOfBirth"))}
              {renderTextInput(
                "motherPlaceOfBirth",
                t("AcquaintanceForm.placeholder.enterPlaceOfBirth"),
                true,
                {
                  maxLength: 100,
                },
              )}
            </Col>
          </Row>
        </Card>

        <Card
          className="acq-form-section"
          title={t("AcquaintanceForm.section.military")}
        >
          <Row gutter={24}>
            <Col span={24}>
              {renderRequiredLabel(t("AcquaintanceForm.label.workedInMilitary"))}
              <Field
                name="workedInMilitary"
                {...ACQUAINTANCE_FIELD_BLUR}
                decorator={[FormItem]}
                validator={acqFieldValidator((value) => {
                  if (value !== "Yes" && value !== "No")
                    return t("AcquaintanceForm.validation.required");
                  return "";
                })}
              >
                {(inner: FormilyFieldModel) => (
                  <Radio.Group
                    disabled={props?.disabled}
                    value={current.workedInMilitary ?? undefined}
                    onChange={(e) =>
                      handleFieldChange("workedInMilitary", e.target.value)
                    }
                    {...bindAcqControlBlur(inner)}
                  >
                    <Radio value="Yes">{t("AcquaintanceForm.common.yes")}</Radio>
                    <Radio value="No">{t("AcquaintanceForm.common.no")}</Radio>
                  </Radio.Group>
                )}
              </Field>
            </Col>

            {militaryNo && (
              <>
                <Col span={twoCol}>
                  {renderRequiredLabel(t("AcquaintanceForm.label.nameOfCountry"))}
                  <Input
                    disabled
                    className="ant-input-affix-wrapper"
                    value={t("AcquaintanceForm.common.na")}
                  />
                </Col>
                <Col span={twoCol}>
                  {renderRequiredLabel(t("AcquaintanceForm.label.periodOfService"))}
                  <Input
                    disabled
                    className="ant-input-affix-wrapper"
                    value={t("AcquaintanceForm.common.na")}
                  />
                </Col>
                <Col span={twoCol}>
                  {renderRequiredLabel(t("AcquaintanceForm.label.rank"))}
                  <Input
                    disabled
                    className="ant-input-affix-wrapper"
                    value={t("AcquaintanceForm.common.na")}
                  />
                </Col>
                <Col span={24}>
                  {renderRequiredLabel(
                    t("AcquaintanceForm.label.previousEmploymentUae"),
                  )}
                  <Input
                    disabled
                    className="ant-input-affix-wrapper"
                    value={t("AcquaintanceForm.common.na")}
                  />
                </Col>
              </>
            )}

            {workedInMilitary && (
              <>
                <Col span={twoCol}>
                  {renderRequiredLabel(t("AcquaintanceForm.label.nameOfCountry"))}
                  {renderSelect(
                    "militaryCountry",
                    t("AcquaintanceForm.select.country"),
                    countryOptions,
                    true,
                    undefined,
                    { when: () => workedInMilitary },
                  )}
                </Col>
                <Col span={twoCol}>
                  {renderRequiredLabel(t("AcquaintanceForm.label.periodOfService"))}
                  {renderTextInput(
                    "militaryDecorations",
                    t("AcquaintanceForm.placeholder.militaryPeriodRange"),
                    true,
                    {
                      maxLength: 200,
                      when: () => workedInMilitary,
                    },
                  )}
                </Col>
                <Col span={twoCol}>
                  {renderRequiredLabel(t("AcquaintanceForm.label.rank"))}
                  {renderTextInput(
                    "militaryRank",
                    t("AcquaintanceForm.placeholder.enterRank"),
                    true,
                    {
                      maxLength: 50,
                      when: () => workedInMilitary,
                    },
                  )}
                </Col>
                <Col span={24}>
                  {renderRequiredLabel(
                    t("AcquaintanceForm.label.previousEmploymentUae"),
                  )}
                  {renderTextArea(
                    "previousEmploymentInUae",
                    t("AcquaintanceForm.placeholder.enterPreviousEmployment"),
                    true,
                    {
                      maxLength: 500,
                      rows: 4,
                      when: () => workedInMilitary,
                    },
                  )}
                </Col>
              </>
            )}
          </Row>
        </Card>

        <Card
          className="acq-form-section"
          title={t("AcquaintanceForm.section.relatives")}
        >
          <Row gutter={24}>
            {(relativesList.length
              ? relativesList
              : [{ name: "", employer: "" }]
            ).map((_, idx) => (
              <React.Fragment key={`relative-${idx}`}>
                <Col span={12}>
                  {renderRequiredLabel(
                    t("AcquaintanceForm.label.indexedName", {
                      index: idx + 1,
                    }),
                  )}
                  <Field
                    name={`relatives.${idx}.name`}
                    {...ACQUAINTANCE_FIELD_BLUR}
                    decorator={[FormItem]}
                    validator={acqFieldValidator((value) => {
                      const v = String(value ?? "").trim();
                      if (!v) return t("AcquaintanceForm.validation.required");
                      if (v.length > 100)
                        return t("AcquaintanceForm.validation.maxChars", {
                          max: 100,
                        });
                      if (!/^[a-zA-Z\s]+$/.test(v))
                        return t("AcquaintanceForm.validation.patternLettersSpaces");
                      return "";
                    })}
                  >
                    {(inner: FormilyFieldModel) => (
                      <Input
                        disabled={props?.disabled}
                        className="ant-input-affix-wrapper"
                        placeholder={t(
                          "AcquaintanceForm.placeholder.firstLastName",
                        )}
                        maxLength={100}
                        value={relativesList[idx]?.name ?? ""}
                        onChange={(e) =>
                          updateRelative(idx, "name", e.target.value)
                        }
                        {...bindAcqControlBlur(inner)}
                      />
                    )}
                  </Field>
                </Col>
                <Col span={12}>
                  {renderRequiredLabel(
                    t("AcquaintanceForm.label.indexedEmployer", {
                      index: idx + 1,
                    }),
                  )}
                  <Field
                    name={`relatives.${idx}.employer`}
                    {...ACQUAINTANCE_FIELD_BLUR}
                    decorator={[FormItem]}
                    validator={acqFieldValidator((value) => {
                      const v = String(value ?? "").trim();
                      if (!v) return t("AcquaintanceForm.validation.required");
                      if (v.length > 50)
                        return t("AcquaintanceForm.validation.maxChars", {
                          max: 50,
                        });
                      return "";
                    })}
                  >
                    {(inner: FormilyFieldModel) => (
                      <Input
                        disabled={props?.disabled}
                        className="ant-input-affix-wrapper"
                        placeholder={t(
                          "AcquaintanceForm.placeholder.enterEmployer",
                        )}
                        maxLength={50}
                        value={relativesList[idx]?.employer ?? ""}
                        onChange={(e) =>
                          updateRelative(idx, "employer", e.target.value)
                        }
                        {...bindAcqControlBlur(inner)}
                      />
                    )}
                  </Field>
                </Col>
              </React.Fragment>
            ))}
            {!hideRelationAddButtons && (
              <Col span={24} className="acq-form-actions">
                <CustomButton
                  disabled={props?.disabled || relativesRenderList.length >= 10}
                  onClick={addRelative}
                >
                  {t("AcquaintanceForm.common.add")}
                </CustomButton>
              </Col>
            )}
          </Row>
        </Card>

        <Card
          className="acq-form-section"
          title={t("AcquaintanceForm.section.friends")}
        >
          <Row gutter={24}>
            {(friendsList.length
              ? friendsList
              : [{ name: "", employer: "" }]
            ).map((_, idx) => (
              <React.Fragment key={`friend-${idx}`}>
                <Col span={12}>
                  {renderRequiredLabel(
                    t("AcquaintanceForm.label.indexedName", {
                      index: idx + 1,
                    }),
                  )}
                  <Field
                    name={`friends.${idx}.name`}
                    {...ACQUAINTANCE_FIELD_BLUR}
                    decorator={[FormItem]}
                    validator={acqFieldValidator((value) => {
                      const v = String(value ?? "").trim();
                      if (!v) return t("AcquaintanceForm.validation.required");
                      if (v.length > 100)
                        return t("AcquaintanceForm.validation.maxChars", {
                          max: 100,
                        });
                      if (!/^[a-zA-Z\s]+$/.test(v))
                        return t("AcquaintanceForm.validation.patternLettersSpaces");
                      return "";
                    })}
                  >
                    {(inner: FormilyFieldModel) => (
                      <Input
                        disabled={props?.disabled}
                        className="ant-input-affix-wrapper"
                        placeholder={t(
                          "AcquaintanceForm.placeholder.firstLastName",
                        )}
                        maxLength={100}
                        value={friendsList[idx]?.name ?? ""}
                        onChange={(e) =>
                          updateFriend(idx, "name", e.target.value)
                        }
                        {...bindAcqControlBlur(inner)}
                      />
                    )}
                  </Field>
                </Col>
                <Col span={12}>
                  {renderRequiredLabel(
                    t("AcquaintanceForm.label.indexedEmployer", {
                      index: idx + 1,
                    }),
                  )}
                  <Field
                    name={`friends.${idx}.employer`}
                    {...ACQUAINTANCE_FIELD_BLUR}
                    decorator={[FormItem]}
                    validator={acqFieldValidator((value) => {
                      const v = String(value ?? "").trim();
                      if (!v) return t("AcquaintanceForm.validation.required");
                      if (v.length > 50)
                        return t("AcquaintanceForm.validation.maxChars", {
                          max: 50,
                        });
                      return "";
                    })}
                  >
                    {(inner: FormilyFieldModel) => (
                      <Input
                        disabled={props?.disabled}
                        className="ant-input-affix-wrapper"
                        placeholder={t(
                          "AcquaintanceForm.placeholder.enterEmployer",
                        )}
                        maxLength={50}
                        value={friendsList[idx]?.employer ?? ""}
                        onChange={(e) =>
                          updateFriend(idx, "employer", e.target.value)
                        }
                        {...bindAcqControlBlur(inner)}
                      />
                    )}
                  </Field>
                </Col>
              </React.Fragment>
            ))}
            {!hideRelationAddButtons && (
              <Col span={24} className="acq-form-actions">
                <CustomButton
                  disabled={friendsRenderList.length >= 10}
                  onClick={addFriend}
                >
                  {t("AcquaintanceForm.common.add")}
                </CustomButton>
              </Col>
            )}
          </Row>
        </Card>

        <Card
          className="acq-form-section"
          title={t("AcquaintanceForm.section.residence")}
        >
          <Row gutter={24}>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.flatHouseNumber"))}
              {renderTextInput(
                "residenceFlatHouseNumber",
                t("AcquaintanceForm.placeholder.enterFlatHouseNumber"),
                true,
                {
                  maxLength: 100,
                  pattern: /^[a-zA-Z0-9\s-]+$/,
                  patternMessage: t(
                    "AcquaintanceForm.validation.patternLettersNumbersSpacesHyphens",
                  ),
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.street"))}
              {renderTextInput(
                "residenceStreet",
                t("AcquaintanceForm.placeholder.enterStreet"),
                true,
                {
                  maxLength: 50,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.emirate"))}
              {renderSelect(
                "residenceEmirateId",
                t("AcquaintanceForm.select.emirate"),
                emirateSelectOptions,
                true,
              )}
            </Col>
            {showResidenceRegion ? (
              <Col span={twoCol}>
                {renderRequiredLabel(t("AcquaintanceForm.label.region"))}
                {renderSelect(
                  "residenceRegionId",
                  t("AcquaintanceForm.select.region"),
                  regionSelectOptions,
                  true,
                  undefined,
                  {
                    selectDisabled:
                      props?.disabled || !current.residenceEmirateId,
                  },
                )}
              </Col>
            ) : null}
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.area"))}
              {renderSelect(
                "residenceAreaId",
                t("AcquaintanceForm.select.area"),
                areaSelectOptions,
                true,
                undefined,
                { selectDisabled: residenceAreaSelectDisabled },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.telephoneNo"))}
              <CompositeMobileNumberField
                fieldNames={{
                  fullNumber: "residenceTelephone",
                  countryCode: "residenceTelephoneCountryCode",
                  localNumber: "residenceTelephoneLocalNumber",
                }}
                fullNumber={current.residenceTelephone}
                countryCode={current.residenceTelephoneCountryCode}
                localNumber={current.residenceTelephoneLocalNumber}
                disabled={props?.disabled}
                required
                placeholder={t("AcquaintanceForm.placeholder.enterTelephoneNo")}
                requiredMessage={t("AcquaintanceForm.validation.required")}
                invalidMessage={t("AcquaintanceForm.validation.phoneInvalid")}
                onChange={(patch) => field.setValue({ ...current, ...patch })}
              />
            </Col>
          </Row>
        </Card>

        <Card
          className="acq-form-section"
          title={t("AcquaintanceForm.section.passport")}
        >
          <Row gutter={24}>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.passportNumber"))}
              {renderTextInput(
                "passportNumber",
                t("AcquaintanceForm.placeholder.enterPassportNumber"),
                true,
                {
                  maxLength: 20,
                  pattern: /^[a-zA-Z0-9]+$/,
                  patternMessage: t(
                    "AcquaintanceForm.validation.patternAlphanumeric20",
                  ),
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.placeOfIssue"))}
              {renderTextInput(
                "passportPlaceOfIssue",
                t("AcquaintanceForm.placeholder.enterPlaceOfIssue"),
                true,
                { maxLength: 100 },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.dateOfIssue"))}
              {renderDate(
                "passportDateOfIssue",
                t("AcquaintanceForm.common.datePlaceholder"),
                true,
                {
                  notAfterToday: true,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.expiryDate"))}
              {renderDate(
                "passportExpiryDate",
                t("AcquaintanceForm.common.datePlaceholder"),
                true,
                {
                  onlyAfterToday: true,
                },
              )}
            </Col>
          </Row>
        </Card>

        <Card
          className="acq-form-section"
          title={t("AcquaintanceForm.section.residency")}
        >
          <Row gutter={24}>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.ResidencyNumber"))}
              {renderTextInput(
                "residencyNumber",
                t("AcquaintanceForm.label.enterResidencyNumber"),
                true,
                { maxLength: 50 },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(
                t("AcquaintanceForm.label.PlaceofIssue"),
              )}
              {renderTextInput(
                "residencyPlaceOfIssue",
                t("AcquaintanceForm.label.enterPlaceofIssue"),
                true,
                { maxLength: 100 },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.dateOfIssue"))}
              {renderDate(
                "residencyDateOfIssue",
                t("AcquaintanceForm.common.datePlaceholder"),
                true,
                {
                  notAfterToday: true,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.expiryDate"))}
              {renderDate(
                "residencyExpiryDate",
                t("AcquaintanceForm.common.datePlaceholder"),
                true,
                {
                  custom: (raw) => {
                    if (!raw) return "";
                    const d = moment(raw, "YYYY-MM-DD", true);
                    if (!d.isValid())
                      return t("AcquaintanceForm.validation.invalidDate");
                    if (!d.isAfter(moment(), "day"))
                      return t("AcquaintanceForm.validation.expiryAfterToday");
                    return "";
                  },
                },
              )}
            </Col>
          </Row>
        </Card>

        <Card
          className="acq-form-section"
          title={t("AcquaintanceForm.section.sponsor")}
        >
          <Row gutter={24}>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.fullName"))}
              {renderTextInput(
                "sponsorFullName",
                t("AcquaintanceForm.placeholder.firstFullName"),
                true,
                {
                  maxLength: 100,
                  pattern: /^[a-zA-Z\s]+$/,
                  patternMessage: t(
                    "AcquaintanceForm.validation.patternLettersSpaces",
                  ),
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.address"))}
              {renderTextInput(
                "sponsorAddress",
                t("AcquaintanceForm.placeholder.enterAddress"),
                true,
                {
                  maxLength: 300,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.placeOfEmployment"))}
              {renderTextInput(
                "sponsorPlaceOfEmployment",
                t("AcquaintanceForm.placeholder.enterPlaceOfEmployment"),
                true,
                { maxLength: 200 },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.profession"))}
              {renderTextInput(
                "sponsorProfession",
                t("AcquaintanceForm.placeholder.enterProfession"),
                true,
                {
                  maxLength: 100,
                },
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.workPhone"))}
              <CompositeMobileNumberField
                fieldNames={{
                  fullNumber: "sponsorWorkPhone",
                  countryCode: "sponsorWorkPhoneCountryCode",
                  localNumber: "sponsorWorkPhoneLocalNumber",
                }}
                fullNumber={current.sponsorWorkPhone}
                countryCode={current.sponsorWorkPhoneCountryCode}
                localNumber={current.sponsorWorkPhoneLocalNumber}
                disabled={props?.disabled}
                required
                placeholder={t("AcquaintanceForm.placeholder.enterWorkPhone")}
                requiredMessage={t("AcquaintanceForm.validation.required")}
                invalidMessage={t("AcquaintanceForm.validation.phoneInvalid")}
                onChange={(patch) => field.setValue({ ...current, ...patch })}
              />
            </Col>
          </Row>
        </Card>

        <Card
          className="acq-form-section"
          title={t("AcquaintanceForm.section.declaration")}
        >
          <div className="acq-form-declaration">
            {t("AcquaintanceForm.declarationBody")}
          </div>
          <Row gutter={24}>
            <Col span={twoCol}>
              {renderRequiredLabel(
                t("AcquaintanceForm.label.declarationSignature"),
              )}
              {renderUpload(
                "declarationSignature",
                true,
              )}
            </Col>
            <Col span={twoCol}>
              {renderRequiredLabel(t("AcquaintanceForm.label.declarationDate"))}
              {renderDate(
                "declarationDate",
                t("AcquaintanceForm.common.datePlaceholder"),
                true,
                {
                  notAfterToday: true,
                },
              )}
            </Col>
          </Row>
        </Card>
      </div>
    </div>
  );
});
