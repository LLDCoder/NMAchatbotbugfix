import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, observer, useField, useForm } from "@formily/react";
import { FormItem } from "@formily/antd";
import { Button, Card as AntdCard, Checkbox, Col, DatePicker, Input, Radio, Row, Select } from "antd";
import type { RcFile } from "antd/lib/upload";
import moment, { type Moment } from "moment";
import DocumentViewer from "@/components/common/DocumentViewer";
import CustomMessage from "@/components/common/CustomMessage";
import DataListInner from "@/components/designable/src/components/DataList/DataList";
import LanguageSelect from "@/components/designable/src/components/LanguageSelect/LanguageSelect";
import type { DataListSourceConfig } from "@/components/designable/src/components/DataList/Setter";
import { getEmirateList, type EmirateItem } from "@/services/address";
import { lookupNewpaperMagazineLicense } from "@/services/newpaperMagazineCirculation";
import { getLookupData } from "@/services/services";
import { getNationalityList, type NationalityInfo } from "@/services/userProfile";
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
import "./styles.less";

const { Option } = Select;

const UAE_SOURCE_ID = 212;
const MEDIA_LICENSE_NUMBER_MAX_LEN = 32;
const PUBLISHING_HOUSE_MAX_LEN = 100;
const LAST_VERSION_MAX_LEN = 10;
const COPIES_MAX_LEN = 5;
const PUBLICATION_TITLE_MAX_LEN = 100;
/**
 * Subject categories come from the shared lookup table the customer portal
 * writes against, so the saved ids resolve to names here too. GetSubjectList
 * is a different dictionary and its ids do not match.
 */
const NEWSPAPER_CATEGORIES_LOOKUP = "NewspaperCategories";

type SubjectOption = {
  id: number;
  nameEn: string;
  nameAr?: string;
};

/** The lookup endpoint is inconsistent about casing across tables. */
type NewspaperCategoryLookupItem = {
  id?: number;
  nameEn?: string;
  nameAr?: string;
  Id?: number;
  NameEn?: string;
  NameAr?: string;
};

const normalizeSubjectOption = (
  item: NewspaperCategoryLookupItem,
): SubjectOption | null => {
  const id = Number(item.id ?? item.Id);
  if (Number.isNaN(id)) return null;

  return {
    id,
    nameEn: item.nameEn ?? item.NameEn ?? "",
    nameAr: item.nameAr ?? item.NameAr,
  };
};

export type NewpaperMagazineCirculationLanguageNameItem = {
  language?: string;
  publication_title?: string;
};

export type NewpaperMagazineCirculationValue = {
  isLicensed?: boolean;
  mediaLicenseNumber?: string;
  sourceId?: number;
  subjectCategoryIds?: number[];
  publicationTitle?: string;
  language?: string | number;
  publishingHouse?: string;
  lastVersionNumber?: string;
  distributionStartingDate?: string;
  distributionEndingDate?: string;
  distributionScopeIds?: number[];
  numberOfCopies?: string;
  distributionCopyrights?: string;
  publicationLicenseCopy?: string;
  languageNameList?: NewpaperMagazineCirculationLanguageNameItem[];
  licenseLookupMatched?: boolean;
};

type NewpaperMagazineCirculationFieldProps = {
  className?: string;
  disabled?: boolean;
  designMode?: boolean;
  serviceCode?: string | number;
};

type FormilyFeedback = {
  type: string;
  messages: string[];
};

type ResettableField = {
  setFeedback?: (feedback: FormilyFeedback) => void;
  setValue?: (value: unknown) => void;
  setState?: (updater: (state: Record<string, unknown>) => void) => void;
};

type NewpaperMagazineCirculationFormField = {
  address: string;
  value?: NewpaperMagazineCirculationValue;
  setValue: (value: NewpaperMagazineCirculationValue) => void;
  designable?: boolean;
  query: (pattern: string) => { take: () => ResettableField | undefined };
};

const unwrapList = <T,>(res: unknown): T[] => {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && "data" in res) {
    const data = (res as { data?: unknown }).data;
    if (Array.isArray(data)) return data as T[];
  }
  return [];
};

const sanitizeDigits = (value: string, maxLength: number) =>
  value.replace(/\D/g, "").slice(0, maxLength);

const sanitizeText = (value: string, maxLength: number) =>
  value.slice(0, maxLength);

const parseMoment = (value?: string): Moment | null => {
  if (!value) return null;
  const parsed = moment(value, "YYYY-MM-DD", true);
  return parsed.isValid() ? parsed : null;
};

const isPdfUnder5Mb = (file: RcFile) =>
  /\.pdf$/i.test(file.name) && file.size / 1024 / 1024 <= 5;

const normalizeUploadValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const preventInvalidNumberKeys = (event: React.KeyboardEvent<HTMLInputElement>) => {
  if (["e", "E", "+", "-", "."].includes(event.key)) {
    event.preventDefault();
  }
};

export const NewpaperMagazineCirculationField: React.FC<NewpaperMagazineCirculationFieldProps> =
  observer((props) => {
    const host = useFormLanguageHost();
    const contentLang = useFormContentLang();
    const { i18n: i18nReact } = useTranslation();
    const field = useField<NewpaperMagazineCirculationFormField>();
    const form = useForm();
    const disabled = !!props.disabled;
    const fieldPattern = (field as { pattern?: string } | undefined)?.pattern;
    const isReadOnlyMode =
      isNonEditablePattern(fieldPattern) ||
      isNonEditablePattern(form.pattern);
    const readOnlyMultiSelectProps = getReadOnlyMultiSelectProps({
      isMultiple: true,
      isReadOnly: isReadOnlyMode,
      defaultMaxTagCount: 2,
    });
    const previewLang =
      host === "designer"
        ? contentLang
        : mapDesignerLanguageToContentLang(i18nReact.language);
    const tf = React.useCallback(
      (key: string, options?: Record<string, unknown>) =>
        String(
          i18n.t(`NewpaperMagazineCirculation.${key}`, {
            lng: previewLang,
            ...(options ?? {}),
          }),
        ),
      [previewLang],
    );
    const isAr = Boolean(previewLang?.startsWith("ar"));
    const raw = (field.value || {}) as NewpaperMagazineCirculationValue;
    const current: NewpaperMagazineCirculationValue = {
      isLicensed:
        typeof raw.isLicensed === "boolean"
          ? raw.isLicensed
          : props.designMode
            ? false
            : undefined,
      mediaLicenseNumber: raw.mediaLicenseNumber ?? "",
      sourceId: raw.sourceId,
      subjectCategoryIds: Array.isArray(raw.subjectCategoryIds)
        ? raw.subjectCategoryIds
        : [],
      publicationTitle: raw.publicationTitle ?? "",
      language: raw.language ?? "",
      publishingHouse: raw.publishingHouse ?? "",
      lastVersionNumber: raw.lastVersionNumber ?? "",
      distributionStartingDate: raw.distributionStartingDate,
      distributionEndingDate: raw.distributionEndingDate,
      distributionScopeIds: Array.isArray(raw.distributionScopeIds)
        ? raw.distributionScopeIds
        : [],
      numberOfCopies: raw.numberOfCopies ?? "",
      distributionCopyrights: raw.distributionCopyrights,
      publicationLicenseCopy: raw.publicationLicenseCopy,
      languageNameList: Array.isArray(raw.languageNameList)
        ? raw.languageNameList
        : [],
      licenseLookupMatched: !!raw.licenseLookupMatched,
    };

    const [sourceOptions, setSourceOptions] = useState<NationalityInfo[]>([]);
    const [sourceLoading, setSourceLoading] = useState(false);
    const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
    const [subjectLoading, setSubjectLoading] = useState(false);
    const [scopeOptions, setScopeOptions] = useState<EmirateItem[]>([]);
    const [scopeLoading, setScopeLoading] = useState(false);
    const [lookupLoading, setLookupLoading] = useState(false);

    const isLicensed = current.isLicensed === true;
    const lookupMatched = current.licenseLookupMatched === true;
    const showLicenseFields = current.isLicensed === true;
    const showPublishingHouse = current.isLicensed === false;
    const showLanguageNameList = current.isLicensed === false;
    const showPublicationLicenseCopy =
      current.isLicensed === false && Number(current.sourceId) === UAE_SOURCE_ID;
    const canEditLookupDrivenFields = !isLicensed || lookupMatched;
    const invalidMediaLicenseMessage = tf("messageInvalidMediaLicense");

    const languageNameListSource = useMemo<DataListSourceConfig>(
      () => ({
        dataSource: "languages_name_list",
        fields: [
          {
            fieldName: tf("fieldLanguage"),
            fieldType: "string",
            required: true,
            placeholderText: tf("placeholderSelectLanguage"),
            listVisible: true,
            formVisible: true,
            displayType: "Dropdown",
          },
          {
            fieldName: tf("fieldPublicationTitle"),
            fieldType: "string",
            required: true,
            placeholderText: tf("placeholderEnterPublicationTitle"),
            listVisible: true,
            formVisible: true,
            displayType: "Text Input",
          },
        ],
      }),
      [tf],
    );

    const validateMediaLicenseNumberLocal = React.useCallback(
      (value: unknown, licensed: boolean): string => {
        if (!licensed) return "";
        const text = String(value ?? "").trim();
        if (!text) {
          return tf("validationMediaLicenseNumberRequired");
        }
        if (text.length > MEDIA_LICENSE_NUMBER_MAX_LEN) {
          return tf("validationMaxCharacters", {
            label: tf("labelMediaLicenseNumber"),
            count: MEDIA_LICENSE_NUMBER_MAX_LEN,
          });
        }
        return "";
      },
      [tf],
    );

    const queryFirstMessage = tf("validationQueryMediaLicenseFirst");

    const validateSourceLocal = React.useCallback(
      (value: unknown, licensed: boolean, matched: boolean): string => {
        if (licensed && !matched) return queryFirstMessage;
        if (value == null || Number.isNaN(Number(value))) {
          return tf("validationSourceRequired");
        }
        return "";
      },
      [queryFirstMessage, tf],
    );

    const validateSubjectCategoryLocal = React.useCallback(
      (value: unknown, licensed: boolean, matched: boolean): string => {
        const list = Array.isArray(value) ? value : [];
        if (licensed && !matched) return queryFirstMessage;
        if (list.length === 0) {
          return tf("validationSubjectCategoryRequired");
        }
        return "";
      },
      [queryFirstMessage, tf],
    );

    const validatePublicationTitleLocal = React.useCallback(
      (value: unknown, licensed: boolean, matched: boolean): string => {
        if (!licensed) return "";
        if (!matched) return queryFirstMessage;
        const text = String(value ?? "").trim();
        if (!text) {
          return tf("validationPublicationTitleRequired");
        }
        if (text.length > PUBLICATION_TITLE_MAX_LEN) {
          return tf("validationMaxCharacters", {
            label: tf("labelPublicationTitle"),
            count: PUBLICATION_TITLE_MAX_LEN,
          });
        }
        return "";
      },
      [queryFirstMessage, tf],
    );

    const validateLanguageLocal = React.useCallback(
      (value: unknown, licensed: boolean, matched: boolean): string => {
        if (!licensed) return "";
        if (!matched) return queryFirstMessage;
        return String(value ?? "").trim() ? "" : tf("validationRequired", { label: tf("labelLanguage") });
      },
      [queryFirstMessage, tf],
    );

    const validatePublishingHouseLocal = React.useCallback(
      (value: unknown, licensed: boolean): string => {
        if (licensed) return "";
        const text = String(value ?? "").trim();
        if (!text) {
          return tf("validationPublishingHouseRequired");
        }
        if (text.length > PUBLISHING_HOUSE_MAX_LEN) {
          return tf("validationMaxCharacters", {
            label: tf("labelPublishingHouse"),
            count: PUBLISHING_HOUSE_MAX_LEN,
          });
        }
        return "";
      },
      [tf],
    );

    const validateDigitsFieldLocal = React.useCallback(
      (label: string, value: unknown, maxLength: number): string => {
        const text = String(value ?? "").trim();
        if (!text) {
          return tf("validationRequired", { label });
        }
        if (!/^\d+$/.test(text)) {
          return tf("validationDigitsOnly", { label });
        }
        if (text.length > maxLength) {
          return tf("validationMaxDigits", {
            label,
            count: maxLength,
          });
        }
        return "";
      },
      [tf],
    );

    const validateStartingDateLocal = React.useCallback(
      (value: unknown): string => {
        if (!value) {
          return tf("validationDistributionStartingDateRequired");
        }
        const parsed = parseMoment(String(value));
        if (!parsed) return tf("validationInvalidDate");
        if (!parsed.isAfter(moment(), "day")) {
          return tf("validationDistributionStartingDateLaterThanToday");
        }
        return "";
      },
      [tf],
    );

    const validateEndingDateLocal = React.useCallback(
      (value: unknown, startDate?: string): string => {
        if (!value) {
          return tf("validationDistributionEndingDateRequired");
        }
        const parsed = parseMoment(String(value));
        if (!parsed) return tf("validationInvalidDate");
        const parsedStart = parseMoment(startDate);
        if (parsedStart && parsed.isBefore(parsedStart, "day")) {
          return tf("validationDistributionEndingDateAfterStartingDate");
        }
        return "";
      },
      [tf],
    );

    const validateDistributionScopeLocal = React.useCallback(
      (value: unknown): string => {
        if (!Array.isArray(value) || value.length === 0) {
          return tf("validationDistributionScopeRequired");
        }
        return "";
      },
      [tf],
    );

    const validatePdfFieldLocal = React.useCallback(
      (label: string, value: unknown, required: boolean): string => {
        if (!required) return "";
        const file = normalizeUploadValue(value as string | string[] | undefined);
        return file ? "" : tf("validationRequired", { label });
      },
      [tf],
    );

    const validateLanguageNameListLocal = React.useCallback(
      (value: unknown, licensed: boolean): string => {
        if (licensed) return "";
        if (!Array.isArray(value) || value.length === 0) {
          return tf("validationLanguageNameListRequired");
        }
        return "";
      },
      [tf],
    );

    const beforeUploadPdfLocal = React.useCallback(
      (file: RcFile) => {
        if (!isPdfUnder5Mb(file)) {
          CustomMessage.error(tf("errorPdfUnder5Mb"));
          return false;
        }
        return true;
      },
      [tf],
    );

    useEffect(() => {
      let cancelled = false;
      setSourceLoading(true);
      getNationalityList()
        .then((res) => {
          if (!cancelled) {
            setSourceOptions(unwrapList<NationalityInfo>(res));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSourceOptions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSourceLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      let cancelled = false;
      setSubjectLoading(true);
      getLookupData(NEWSPAPER_CATEGORIES_LOOKUP, props.serviceCode)
        .then((res) => {
          if (!cancelled) {
            setSubjectOptions(
              unwrapList<NewspaperCategoryLookupItem>(res)
                .map(normalizeSubjectOption)
                .filter((item): item is SubjectOption => Boolean(item))
            );
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSubjectOptions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSubjectLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [props.serviceCode]);

    useEffect(() => {
      let cancelled = false;
      setScopeLoading(true);
      getEmirateList()
        .then((res) => {
          if (!cancelled) {
            setScopeOptions(unwrapList<EmirateItem>(res));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setScopeOptions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setScopeLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }, []);

    const patch = (partial: Partial<NewpaperMagazineCirculationValue>) => {
      const nextValue = {
        ...current,
        ...partial,
      };
      field.setValue(nextValue);

      Object.entries(partial).forEach(([name, value]) => {
        const targetField = field.query(`${field.address}.${name}`).take();
        targetField?.setValue?.(value);
      });
    };

    const resolveSelectedPermitActivityId = React.useCallback(() => {
      const activityContainers = [
        form.getValuesIn("SelectTableSingle"),
        form.getValuesIn("SelectTable"),
      ];

      for (const container of activityContainers) {
        if (!container || typeof container !== "object") continue;

        const record = container as {
          selectedKey?: unknown;
          tableData?: Array<{ Id?: unknown; id?: unknown }>;
        };
        const selectedKey = Array.isArray(record.selectedKey)
          ? record.selectedKey[0]
          : record.selectedKey;

        if (selectedKey !== undefined && selectedKey !== null && String(selectedKey).trim()) {
          return selectedKey as string | number;
        }

        const fallbackId = record.tableData?.[0]?.Id ?? record.tableData?.[0]?.id;
        if (fallbackId !== undefined && fallbackId !== null && String(fallbackId).trim()) {
          return fallbackId as string | number;
        }
      }

      return undefined;
    }, [form]);

    const getLiveValue = React.useCallback(() => {
      return (field.value || {}) as NewpaperMagazineCirculationValue;
    }, [field]);

    const getLiveValidationState = React.useCallback(() => {
      const value = getLiveValue();
      return {
        isLicensed: value.isLicensed === true,
        lookupMatched: value.licenseLookupMatched === true,
        showPublicationLicenseCopy:
          value.isLicensed === false && Number(value.sourceId) === UAE_SOURCE_ID,
      };
    }, [getLiveValue]);

    const resetFieldState = React.useCallback((name: string) => {
      const targetField = field.query(`${field.address}.${name}`).take();
      if (!targetField) return;

      targetField.setFeedback?.({
        type: "error",
        messages: [],
      });
      targetField.setState?.((state) => {
        state.selfErrors = [];
        state.selfWarnings = [];
        state.selfSuccesses = [];
        state.selfValidating = false;
        state.validating = false;
      });
    }, [field]);

    const clearConditionalFieldStates = React.useCallback((names: string[]) => {
      names.forEach((name) => resetFieldState(name));
    }, [resetFieldState]);

    const clearLookupDerivedFields = () => {
      patch({
        sourceId: undefined,
        subjectCategoryIds: [],
        publicationTitle: "",
        language: "",
        licenseLookupMatched: false,
      });
    };

    const handleLicensedChange = (value: boolean) => {
      if (value) {
        clearConditionalFieldStates([
          "publishingHouse",
          "languageNameList",
          "publicationLicenseCopy",
        ]);
        patch({
          isLicensed: true,
          publishingHouse: "",
          languageNameList: [],
          publicationLicenseCopy: undefined,
          sourceId: undefined,
          subjectCategoryIds: [],
          publicationTitle: "",
          language: "",
          licenseLookupMatched: false,
        });
        return;
      }

      clearConditionalFieldStates([
        "mediaLicenseNumber",
        "publicationTitle",
        "language",
        "publicationLicenseCopy",
      ]);
      patch({
        isLicensed: false,
        mediaLicenseNumber: "",
        sourceId: undefined,
        subjectCategoryIds: [],
        publicationTitle: "",
        language: "",
        licenseLookupMatched: false,
      });
    };

    const handleMediaLicenseQuery = async () => {
      const mediaLicenseNumber = String(current.mediaLicenseNumber ?? "").trim();
      const hasActivityId = !!resolveSelectedPermitActivityId();
      if (!mediaLicenseNumber) {
        CustomMessage.error(tf("messageEnterMediaLicenseNumber"));
        return;
      }

      if (!hasActivityId) {
        CustomMessage.error(tf("messageSelectPermitActivity"));
        return;
      }

      setLookupLoading(true);
      try {
        const response = await lookupNewpaperMagazineLicense(
          {
            mediaLicenseNumber,
            serviceCode: props.serviceCode,
            permitActivityId: resolveSelectedPermitActivityId(),
          }
        );

        if (response.matched) {
          patch({
            licenseLookupMatched: true,
            sourceId: response.sourceId ?? UAE_SOURCE_ID,
            subjectCategoryIds: response.subjectCategoryIds ?? [],
            publicationTitle: response.publicationTitle ?? "",
            language: response.language ?? "",
          });
          clearConditionalFieldStates([
            "mediaLicenseNumber",
            "sourceId",
            "subjectCategoryIds",
            "publicationTitle",
            "language",
          ]);
          CustomMessage.success(tf("messageMediaLicenseMatched"));
          return;
        }

        clearLookupDerivedFields();
        CustomMessage.error(invalidMediaLicenseMessage);
      } catch {
        clearLookupDerivedFields();
        CustomMessage.error(invalidMediaLicenseMessage);
      } finally {
        setLookupLoading(false);
      }
    };

    const renderLabel = (label: string, required = true) => (
      <div className="newpaper-magazine-circulation-label">
        <span>
          {label}
          {required && (
            <span className="newpaper-magazine-circulation-required">*</span>
          )}
        </span>
      </div>
    );

    const startDateValue = useMemo(
      () => parseMoment(current.distributionStartingDate),
      [current.distributionStartingDate]
    );
    const endDateValue = useMemo(
      () => parseMoment(current.distributionEndingDate),
      [current.distributionEndingDate]
    );
    const isRuntimeMultiSelect =
      props.designMode === false || field?.designable === false;
    const subjectSelectedValues = Array.isArray(current.subjectCategoryIds)
      ? current.subjectCategoryIds
      : [];
    const scopeSelectedValues = Array.isArray(current.distributionScopeIds)
      ? current.distributionScopeIds
      : [];
    const allSubjectsSelected =
      subjectOptions.length > 0 &&
      subjectOptions.every((option) =>
        subjectSelectedValues.includes(option.id),
      );
    const hasSelectedSubjects = subjectOptions.some((option) =>
      subjectSelectedValues.includes(option.id),
    );
    const allScopesSelected =
      scopeOptions.length > 0 &&
      scopeOptions.every((option) =>
        scopeSelectedValues.includes(option.id),
      );
    const hasSelectedScopes = scopeOptions.some((option) =>
      scopeSelectedValues.includes(option.id),
    );
    const subjectSelectDisabled = disabled || !canEditLookupDrivenFields;
    const handleSelectAllSubjects = (checked: boolean) => {
      if (
        !isRuntimeMultiSelect ||
        subjectSelectDisabled ||
        subjectOptions.length === 0
      )
        return;
      patch({
        subjectCategoryIds: checked
          ? subjectOptions.map((option) => option.id)
          : [],
      });
    };
    const handleSelectAllScopes = (checked: boolean) => {
      if (!isRuntimeMultiSelect || disabled || scopeOptions.length === 0) return;
      patch({
        distributionScopeIds: checked
          ? scopeOptions.map((option) => option.id)
          : [],
      });
    };

    return (
      <div
        className={`newpaper-magazine-circulation-container ${props.className || ""}`}
      >
        <AntdCard
          className="newpaper-magazine-circulation-card"
          title={tf("defaultCardTitle")}
        >
          <Row gutter={24}>
            <Col span={24}>
              <div className="newpaper-magazine-circulation-field">
                {renderLabel(
                  tf("labelIsLicensed")
                )}
                <Field
                  name="isLicensed"
                  validator={(value: unknown) =>
                    typeof value === "boolean"
                      ? ""
                      : tf("validationPleaseSelectYesOrNo")
                  }
                  decorator={[FormItem]}
                >
                  <Radio.Group
                    disabled={disabled}
                    value={current.isLicensed}
                    onChange={(event) => handleLicensedChange(event.target.value)}
                  >
                    <Radio value={true}>{tf("optionYes")}</Radio>
                    <Radio value={false}>{tf("optionNo")}</Radio>
                  </Radio.Group>
                </Field>
              </div>
            </Col>
          </Row>

          {showLicenseFields && (
            <Row gutter={24}>
              <Col span={12}>
                <div className="newpaper-magazine-circulation-field">
                  {renderLabel(tf("labelMediaLicenseNumber"))}
                  <Field
                    name="mediaLicenseNumber"
                    validator={(value: unknown) => {
                      const state = getLiveValidationState();
                      return validateMediaLicenseNumberLocal(value, state.isLicensed);
                    }}
                    decorator={[FormItem]}
                  >
                    <div className="newpaper-magazine-circulation-query-row">
                      <Input
                        disabled={disabled}
                        placeholder={tf("placeholderEnterMediaLicenseNumber")}
                        maxLength={MEDIA_LICENSE_NUMBER_MAX_LEN}
                        value={current.mediaLicenseNumber}
                        onChange={(event) => {
                          const value = sanitizeText(
                            event.target.value,
                            MEDIA_LICENSE_NUMBER_MAX_LEN
                          );
                          patch({
                            mediaLicenseNumber: value,
                            licenseLookupMatched: false,
                            sourceId: undefined,
                            subjectCategoryIds: [],
                            publicationTitle: "",
                            language: "",
                          });
                        }}
                      />
                      <Button
                        type="primary"
                        loading={lookupLoading}
                        disabled={disabled}
                        onClick={handleMediaLicenseQuery}
                      >
                        {tf("buttonQuery")}
                      </Button>
                    </div>
                  </Field>
                </div>
              </Col>
            </Row>
          )}

          <Row gutter={24}>
            <Col span={12}>
              <div className="newpaper-magazine-circulation-field">
                {renderLabel(tf("labelSource"))}
                <Field
                  name="sourceId"
                  validator={(value: unknown) => {
                    const state = getLiveValidationState();
                    return validateSourceLocal(
                      value,
                      state.isLicensed,
                      state.lookupMatched,
                    );
                  }}
                  decorator={[FormItem]}
                >
                  <Select
                    disabled={
                      disabled || (isLicensed && !props.designMode)
                    }
                    loading={sourceLoading}
                    placeholder={tf("placeholderSelectCountry")}
                    value={current.sourceId}
                    onChange={(value) => {
                      const nextSourceId = value as number | undefined;
                      if (Number(nextSourceId) !== UAE_SOURCE_ID) {
                        resetFieldState("publicationLicenseCopy");
                      }
                      patch({
                        sourceId: nextSourceId,
                        publicationLicenseCopy:
                          Number(nextSourceId) === UAE_SOURCE_ID
                            ? current.publicationLicenseCopy
                            : undefined,
                      });
                    }}
                    showSearch
                    optionFilterProp="children"
                    allowClear={!isLicensed}
                    className="umc-select-arrow-manual"
                  >
                    {sourceOptions.map((item) => (
                      <Option key={item.id} value={item.id}>
                        {isAr
                          ? item.nameAr || item.fullNameAr || item.nameEn || item.fullNameEn
                          : item.nameEn || item.fullNameEn || item.nameAr || item.fullNameAr}
                      </Option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Col>
            <Col span={12}>
              <div className="newpaper-magazine-circulation-field">
                {renderLabel(tf("labelSubjectCategory"))}
                <Field
                  name="subjectCategoryIds"
                  validator={(value: unknown) => {
                    const state = getLiveValidationState();
                    return validateSubjectCategoryLocal(
                      value,
                      state.isLicensed,
                      state.lookupMatched,
                    );
                  }}
                  decorator={[FormItem]}
                >
                  <Select
                    className={
                      isRuntimeMultiSelect
                        ? "newpaper-magazine-circulation-multi-select newpaper-magazine-subject-multi-select"
                        : "newpaper-magazine-circulation-multi-select"
                    }
                    mode="multiple"
                    maxTagCount={readOnlyMultiSelectProps.maxTagCount}
                    maxTagPlaceholder={readOnlyMultiSelectProps.maxTagPlaceholder}
                    disabled={subjectSelectDisabled}
                    loading={subjectLoading}
                    placeholder={tf("placeholderSelectSubjectCategories")}
                    value={current.subjectCategoryIds}
                    onChange={(value) =>
                      patch({ subjectCategoryIds: value as number[] })
                    }
                    showSearch
                    optionFilterProp={
                      isRuntimeMultiSelect ? "title" : "children"
                    }
                    optionLabelProp={
                      isRuntimeMultiSelect ? "label" : undefined
                    }
                    allowClear
                    dropdownClassName={
                      isRuntimeMultiSelect
                        ? "newpaper-magazine-multi-select-dropdown"
                        : undefined
                    }
                    dropdownRender={
                      isRuntimeMultiSelect
                        ? (menu) => (
                            <div>
                              <div className="newpaper-magazine-multi-select-all">
                                <Checkbox
                                  className={
                                    hasSelectedSubjects && !allSubjectsSelected
                                      ? "newpaper-magazine-multi-select-all-checkbox has-selection"
                                      : "newpaper-magazine-multi-select-all-checkbox"
                                  }
                                  checked={allSubjectsSelected}
                                  disabled={
                                    subjectSelectDisabled ||
                                    subjectOptions.length === 0
                                  }
                                  onChange={(event) =>
                                    handleSelectAllSubjects(event.target.checked)
                                  }
                                >
                                  {i18n.t("LanguageSelectMulti.selectAll", {
                                    lng: previewLang,
                                  })}
                                </Checkbox>
                              </div>
                              <div>{menu}</div>
                            </div>
                          )
                        : undefined
                    }
                  >
                    {subjectOptions.map((item) => (
                      <Option
                        key={item.id}
                        value={item.id}
                        title={
                          isAr
                            ? item.nameAr || item.nameEn
                            : item.nameEn || item.nameAr
                        }
                        label={
                          isRuntimeMultiSelect ? (
                            <div className="newpaper-magazine-multi-selection-item">
                              <Checkbox checked />
                              <span>
                                {isAr
                                  ? item.nameAr || item.nameEn
                                  : item.nameEn || item.nameAr}
                              </span>
                            </div>
                          ) : undefined
                        }
                      >
                        {isRuntimeMultiSelect ? (
                          <div className="newpaper-magazine-multi-option">
                            <Checkbox
                              checked={subjectSelectedValues.includes(item.id)}
                            />
                            <span>
                              {isAr
                                ? item.nameAr || item.nameEn
                                : item.nameEn || item.nameAr}
                            </span>
                          </div>
                        ) : isAr ? (
                          item.nameAr || item.nameEn
                        ) : (
                          item.nameEn || item.nameAr
                        )}
                      </Option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Col>
          </Row>

          {showLicenseFields && (
            <Row gutter={24}>
              <Col span={12}>
                <div className="newpaper-magazine-circulation-field">
                  {renderLabel(tf("labelPublicationTitle"))}
                  <Field
                    name="publicationTitle"
                    validator={(value: unknown) => {
                      const state = getLiveValidationState();
                      return validatePublicationTitleLocal(
                        value,
                        state.isLicensed,
                        state.lookupMatched,
                      );
                    }}
                    decorator={[FormItem]}
                  >
                    <Input
                      disabled
                      placeholder={tf("labelPublicationTitle")}
                      value={current.publicationTitle}
                    />
                  </Field>
                </div>
              </Col>
              <Col span={12}>
                <div className="newpaper-magazine-circulation-field">
                  {renderLabel(tf("labelLanguage"))}
                  <Field
                    name="language"
                    validator={(value: unknown) => {
                      const state = getLiveValidationState();
                      return validateLanguageLocal(
                        value,
                        state.isLicensed,
                        state.lookupMatched,
                      );
                    }}
                    decorator={[FormItem]}
                  >
                    <LanguageSelect
                      disabled
                      placeholder={tf("labelLanguage")}
                      value={current.language}
                      onChange={(value: string | number | Array<string | number>) =>
                        patch({ language: value as string | number | undefined })
                      }
                    />
                  </Field>
                </div>
              </Col>
            </Row>
          )}

          {showPublishingHouse && (
            <Row gutter={24}>
              <Col span={12}>
                <div className="newpaper-magazine-circulation-field">
                  {renderLabel(tf("labelPublishingHouse"))}
                  <Field
                    name="publishingHouse"
                    validator={(value: unknown) => {
                      const state = getLiveValidationState();
                      return validatePublishingHouseLocal(value, state.isLicensed);
                    }}
                    decorator={[FormItem]}
                  >
                    <Input
                      disabled={disabled}
                      placeholder={tf("placeholderEnterPublishingHouse")}
                      maxLength={PUBLISHING_HOUSE_MAX_LEN}
                      value={current.publishingHouse}
                      onChange={(event) =>
                        patch({
                          publishingHouse: sanitizeText(
                            event.target.value,
                            PUBLISHING_HOUSE_MAX_LEN
                          ),
                        })
                      }
                    />
                  </Field>
                </div>
              </Col>
            </Row>
          )}

          <Row gutter={24}>
            <Col span={12}>
              <div className="newpaper-magazine-circulation-field">
                {renderLabel(tf("labelLastVersionNumber"))}
                <Field
                  name="lastVersionNumber"
                  validator={(value: unknown) =>
                    validateDigitsFieldLocal(
                      tf("labelLastVersionNumber"),
                      value,
                      LAST_VERSION_MAX_LEN
                    )
                  }
                  decorator={[FormItem]}
                >
                  <Input
                    disabled={disabled}
                    inputMode="numeric"
                    placeholder={tf("placeholderEnterLastVersionNumber")}
                    maxLength={LAST_VERSION_MAX_LEN}
                    value={current.lastVersionNumber}
                    onKeyDown={preventInvalidNumberKeys}
                    onChange={(event) =>
                      patch({
                        lastVersionNumber: sanitizeDigits(
                          event.target.value,
                          LAST_VERSION_MAX_LEN
                        ),
                      })
                    }
                  />
                </Field>
              </div>
            </Col>
            <Col span={12}>
              <div className="newpaper-magazine-circulation-field">
                {renderLabel(tf("labelDistributionStartingDate"))}
                <Field
                  name="distributionStartingDate"
                  validator={(value: unknown) => validateStartingDateLocal(value)}
                  decorator={[FormItem]}
                >
                  <DatePicker
                    disabled={disabled}
                    style={{ width: "100%" }}
                    placeholder={tf("placeholderSelectDate")}
                    format="DD/MM/YYYY"
                    value={startDateValue}
                    disabledDate={(date) =>
                      !!date && date.isSameOrBefore(moment(), "day")
                    }
                    onChange={(value) =>
                      patch({
                        distributionStartingDate: value
                          ? value.format("YYYY-MM-DD")
                          : undefined,
                        distributionEndingDate:
                          value &&
                          current.distributionEndingDate &&
                          parseMoment(current.distributionEndingDate)?.isBefore(
                            value,
                            "day"
                          )
                            ? undefined
                            : current.distributionEndingDate,
                      })
                    }
                  />
                </Field>
              </div>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <div className="newpaper-magazine-circulation-field">
                {renderLabel(tf("labelDistributionEndingDate"))}
                <Field
                  name="distributionEndingDate"
                  validator={(value: unknown) =>
                    validateEndingDateLocal(value, current.distributionStartingDate)
                  }
                  decorator={[FormItem]}
                >
                  <DatePicker
                    disabled={disabled}
                    style={{ width: "100%" }}
                    placeholder={tf("placeholderSelectDate")}
                    format="DD/MM/YYYY"
                    value={endDateValue}
                    disabledDate={(date) =>
                      !!date &&
                      !!startDateValue &&
                      date.isBefore(startDateValue, "day")
                    }
                    onChange={(value) =>
                      patch({
                        distributionEndingDate: value
                          ? value.format("YYYY-MM-DD")
                          : undefined,
                      })
                    }
                  />
                </Field>
              </div>
            </Col>
            <Col span={12}>
              <div className="newpaper-magazine-circulation-field">
                {renderLabel(tf("labelDistributionScope"))}
                <Field
                  name="distributionScopeIds"
                  validator={(value: unknown) => validateDistributionScopeLocal(value)}
                  decorator={[FormItem]}
                >
                  <Select
                    className={
                      isRuntimeMultiSelect
                        ? "newpaper-magazine-circulation-multi-select newpaper-magazine-scope-multi-select"
                        : "newpaper-magazine-circulation-multi-select"
                    }
                    mode="multiple"
                    maxTagCount={readOnlyMultiSelectProps.maxTagCount}
                    maxTagPlaceholder={readOnlyMultiSelectProps.maxTagPlaceholder}
                    disabled={disabled}
                    loading={scopeLoading}
                    placeholder={tf("placeholderSelectEmirates")}
                    value={current.distributionScopeIds}
                    onChange={(value) =>
                      patch({ distributionScopeIds: value as number[] })
                    }
                    showSearch
                    optionFilterProp={
                      isRuntimeMultiSelect ? "title" : "children"
                    }
                    optionLabelProp={
                      isRuntimeMultiSelect ? "label" : undefined
                    }
                    allowClear
                    dropdownClassName={
                      isRuntimeMultiSelect
                        ? "newpaper-magazine-multi-select-dropdown"
                        : undefined
                    }
                    dropdownRender={
                      isRuntimeMultiSelect
                        ? (menu) => (
                            <div>
                              <div className="newpaper-magazine-multi-select-all">
                                <Checkbox
                                  className={
                                    hasSelectedScopes && !allScopesSelected
                                      ? "newpaper-magazine-multi-select-all-checkbox has-selection"
                                      : "newpaper-magazine-multi-select-all-checkbox"
                                  }
                                  checked={allScopesSelected}
                                  disabled={
                                    disabled || scopeOptions.length === 0
                                  }
                                  onChange={(event) =>
                                    handleSelectAllScopes(event.target.checked)
                                  }
                                >
                                  {i18n.t("LanguageSelectMulti.selectAll", {
                                    lng: previewLang,
                                  })}
                                </Checkbox>
                              </div>
                              <div>{menu}</div>
                            </div>
                          )
                        : undefined
                    }
                  >
                    {scopeOptions.map((item) => (
                      <Option
                        key={item.id}
                        value={item.id}
                        title={
                          isAr
                            ? item.nameAr || item.nameEn
                            : item.nameEn || item.nameAr
                        }
                        label={
                          isRuntimeMultiSelect ? (
                            <div className="newpaper-magazine-multi-selection-item">
                              <Checkbox checked />
                              <span>
                                {isAr
                                  ? item.nameAr || item.nameEn
                                  : item.nameEn || item.nameAr}
                              </span>
                            </div>
                          ) : undefined
                        }
                      >
                        {isRuntimeMultiSelect ? (
                          <div className="newpaper-magazine-multi-option">
                            <Checkbox
                              checked={scopeSelectedValues.includes(item.id)}
                            />
                            <span>
                              {isAr
                                ? item.nameAr || item.nameEn
                                : item.nameEn || item.nameAr}
                            </span>
                          </div>
                        ) : isAr ? (
                          item.nameAr || item.nameEn
                        ) : (
                          item.nameEn || item.nameAr
                        )}
                      </Option>
                    ))}
                  </Select>
                </Field>
              </div>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <div className="newpaper-magazine-circulation-field">
                {renderLabel(tf("labelNumberOfCopies"))}
                <Field
                  name="numberOfCopies"
                  validator={(value: unknown) =>
                    validateDigitsFieldLocal(
                      tf("labelNumberOfCopies"),
                      value,
                      COPIES_MAX_LEN,
                    )
                  }
                  decorator={[FormItem]}
                >
                  <Input
                    disabled={disabled}
                    inputMode="numeric"
                    placeholder={tf("placeholderEnterNumberOfCopies")}
                    maxLength={COPIES_MAX_LEN}
                    value={current.numberOfCopies}
                    onKeyDown={preventInvalidNumberKeys}
                    onChange={(event) =>
                      patch({
                        numberOfCopies: sanitizeDigits(
                          event.target.value,
                          COPIES_MAX_LEN
                        ),
                      })
                    }
                  />
                </Field>
              </div>
            </Col>
            <Col span={12}>
              <div className="newpaper-magazine-circulation-field newpaper-magazine-circulation-upload">
                {renderLabel(tf("labelDistributionCopyrights"))}
                <Field
                  name="distributionCopyrights"
                  validator={(value: unknown) =>
                    validatePdfFieldLocal(
                      tf("labelDistributionCopyrights"),
                      value,
                      true,
                    )
                  }
                  decorator={[FormItem]}
                >
                  <DocumentViewer
                    hasDelete={!disabled}
                    disabled={disabled}
                    value={current.distributionCopyrights}
                    onChange={(value) =>
                      patch({
                        distributionCopyrights: normalizeUploadValue(
                          value as string | string[] | undefined
                        ),
                      })
                    }
                    uploadConfig={{
                      maxCount: 1,
                      maxSize: 5,
                      accept: ".pdf",
                      uploadTip: tf("uploadTipPdf5Mb"),
                      beforeUpload: beforeUploadPdfLocal,
                    }}
                  />
                </Field>
              </div>
            </Col>
          </Row>

          <Row gutter={24}>
            {showPublicationLicenseCopy && (
              <Col span={12}>
                <div className="newpaper-magazine-circulation-field newpaper-magazine-circulation-upload">
                  {renderLabel(tf("labelPublicationLicenseCopy"))}
                  <Field
                    name="publicationLicenseCopy"
                    validator={(value: unknown) => {
                      const state = getLiveValidationState();
                      return validatePdfFieldLocal(
                        tf("labelPublicationLicenseCopy"),
                        value,
                        state.showPublicationLicenseCopy,
                      );
                    }}
                    decorator={[FormItem]}
                  >
                    <DocumentViewer
                      hasDelete={!disabled}
                      disabled={disabled}
                      value={current.publicationLicenseCopy}
                      onChange={(value) =>
                        patch({
                          publicationLicenseCopy: normalizeUploadValue(
                            value as string | string[] | undefined
                          ),
                        })
                      }
                      uploadConfig={{
                        maxCount: 1,
                        maxSize: 5,
                        accept: ".pdf",
                        uploadTip: tf("uploadTipPdf5Mb"),
                        beforeUpload: beforeUploadPdfLocal,
                      }}
                    />
                  </Field>
                </div>
              </Col>
            )}
          </Row>

          {showLanguageNameList && (
            <Row gutter={24}>
              <Col span={24}>
                <div className="newpaper-magazine-circulation-field newpaper-magazine-circulation-datalist">
                  <Field
                    name="languageNameList"
                    validator={(value: unknown) => {
                      const state = getLiveValidationState();
                      return validateLanguageNameListLocal(value, state.isLicensed);
                    }}
                    decorator={[FormItem]}
                  >
                    <DataListInner
                      value={current.languageNameList as Record<string, string>[]}
                      onChange={(value) =>
                        patch({
                          languageNameList:
                            value as NewpaperMagazineCirculationLanguageNameItem[],
                        })
                      }
                      fieldSource={languageNameListSource}
                      addButtonText={tf("buttonAdd")}
                      title={tf("titleLanguageNameList")}
                      designMode={props.designMode}
                    />
                  </Field>
                </div>
              </Col>
            </Row>
          )}
        </AntdCard>
      </div>
    );
  });

NewpaperMagazineCirculationField.displayName =
  "NewpaperMagazineCirculationField";

export default NewpaperMagazineCirculationField;
