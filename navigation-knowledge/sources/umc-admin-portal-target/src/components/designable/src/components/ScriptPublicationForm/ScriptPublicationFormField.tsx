import * as React from "react";
import type { Field as FormilyFieldModel } from "@formily/core";
import { useTranslation } from "react-i18next";
import { observer, useField, Field } from "@formily/react";
import { FormItem } from "@formily/antd";
import {
  Input,
  Select,
  Radio,
  Row,
  Col,
  Card as AntdCard,
  Tooltip,
} from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import DocumentViewer from "../../../../../components/common/DocumentViewer/index";
import CustomMessage from "../../../../../components/common/CustomMessage";
import { LanguageSelect as LanguageSelectComponent } from "../LanguageSelect/LanguageSelect";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getPublicationTypeByProfileId, type TypeDictionary } from "@/services/userProfile.ts";
import { preferLocalizedEnAr } from "@/utils/bilingualDisplay";
import i18n from "@/localization/config";
import {
  ALL_COUNTRIES,
  getLocalizedCountryLabel,
} from "../CountryDropdown/countries";
import { DraftFileOrLinkField } from "../DraftFileOrLink/DraftFileOrLinkField";
import type { DraftFileOrLinkType } from "../DraftFileOrLink/schemaContract";
import "./styles.less";
import type { RcFile } from "antd/lib/upload";

const { Option } = Select;
const MOVIE_TYPE_MATCHERS = new Set(["3", "mv", "movie"]);

type ScriptPublicationFormValue = {
  typeOfPublication?: string | number;
  applyingLocalMaterial?: "yes" | "no";
  publicationTitle?: string;
  authorName?: string;
  languages?: string[];
  productionCompany?: string;
  uploadMaterial?: string | string[];
  uploadMaterialType?: DraftFileOrLinkType;
  uploadMaterialPassword?: string;
  filmDirector?: string;
  filmWriter?: string;
  writerNationality?: string;
  writerEmiratesId?: string;
  writerEmiratesIdCopy?: string | string[];
  UploadObligationLetter?: string | string[];
  [key: string]: unknown;
};

type ScriptPublicationFormFieldProps = React.HTMLAttributes<HTMLDivElement> & {
  disabled?: boolean;
  serviceCode?: string | number | null;
  profileId?: string | number | null;
};

type OptionType = {
  label: string;
  value: string | number;
  id?: number;
  code?: string;
};

type ResettableField = {
  setFeedback?: (feedback: { type: string; messages: string[] }) => void;
  setValidator?: (validator: () => string) => void;
  setValue?: (value: unknown) => void;
  setState?: (
    setter: (state: {
      visible?: boolean;
      display?: string;
      required?: boolean;
      selfErrors?: unknown[];
      selfWarnings?: unknown[];
      selfSuccesses?: unknown[];
      selfValidating?: boolean;
      validating?: boolean;
    }) => void,
  ) => void;
};

function extractResponseArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && "data" in res) {
    const data = (res as { data?: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return [];
}

const NAME_REGEX = /^[a-zA-Z\s\-']*$/;
const EMIRATES_ID_REGEX = /^784\d{4}\d{7}\d$/;

function normalizeText(value?: string | number | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export const ScriptPublicationFormField: React.FC<ScriptPublicationFormFieldProps> = observer((props) => {
  const { i18n: i18nReact } = useTranslation();
  const field = useField<FormilyFieldModel>();
  if (!field) return null;
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nReact.language);
  const currentLanguage = previewLang;
  const isAr = currentLanguage?.startsWith("ar");
  const tf = React.useCallback(
    (key: string, options?: Record<string, unknown>) =>
      String(
        i18n.t(`ScriptPublicationForm.${key}`, {
          lng: previewLang,
          ...(options ?? {}),
        }),
      ),
    [previewLang],
  );
  const requiredMessage = tf("validation.required");

  const current = React.useMemo(
    () =>
      (field.value || {
        applyingLocalMaterial: "no",
      }) as ScriptPublicationFormValue,
    [field.value],
  );
  const [typeOfPublicationOptions, setTypeOfPublicationOptions] =
    React.useState<OptionType[]>([]);
  const getSelectedTypeOfPublicationOption = React.useCallback(
    (typeValue?: string | number | null) => {
      const normalizedValue = normalizeText(typeValue);
      if (!normalizedValue) return undefined;

      return typeOfPublicationOptions.find((item) =>
        [item.value, item.id, item.code, item.label].some(
          (candidate) => normalizeText(candidate) === normalizedValue,
        ),
      );
    },
    [typeOfPublicationOptions],
  );
  const getSubField = React.useCallback(
    (name: string) =>
      ((field.query(`${field.address}.${name}`).take() as ResettableField) ||
        (field.query(name).take() as ResettableField | undefined)),
    [field],
  );
  const syncDependentFieldState = React.useCallback(
    (name: string, visible: boolean, required: boolean) => {
      const targetField = getSubField(name);
      if (!targetField) return;

      if (!visible) {
        targetField.setFeedback?.({
          type: "error",
          messages: [],
        });
        targetField.setValidator?.(() => "");
        targetField.setValue?.(undefined);
      }

      targetField.setState?.((state) => {
        state.visible = visible;
        state.display = visible ? "visible" : "none";
        state.required = visible ? required : false;

        if (!visible) {
          state.selfErrors = [];
          state.selfWarnings = [];
          state.selfSuccesses = [];
          state.selfValidating = false;
          state.validating = false;
        }
      });
    },
    [getSubField],
  );

  const selectedTypeOfPublicationOption = React.useMemo(
    () => getSelectedTypeOfPublicationOption(current.typeOfPublication),
    [current.typeOfPublication, getSelectedTypeOfPublicationOption],
  );
  const isLocalMaterial = current.applyingLocalMaterial === "yes";
  const isMoviePublication =
    [
      current.typeOfPublication,
      selectedTypeOfPublicationOption?.id,
      selectedTypeOfPublicationOption?.code,
      selectedTypeOfPublicationOption?.label,
    ]
      .map((item) => normalizeText(item))
      .some((item) => MOVIE_TYPE_MATCHERS.has(item));
  const countryOptions = React.useMemo(
    () =>
      ALL_COUNTRIES.map((country) => ({
        value: country.label,
        label: getLocalizedCountryLabel(country, currentLanguage),
        key: country.value,
      })),
    [currentLanguage],
  );

  React.useEffect(() => {
    getPublicationTypeByProfileId()
      .then((res) => {
        setTypeOfPublicationOptions(
          extractResponseArray<TypeDictionary>(res).map((item) => ({
            label:
              preferLocalizedEnAr(isAr, item.nameEn, item.nameAr) ||
              item.code,
            value: item.id,
            id: item.id,
            code: item.code,
          })),
        );
      })
      .catch(() => {
        setTypeOfPublicationOptions([]);
      });
  }, [isAr]);

  const handleFieldChange = React.useCallback((
    key: string,
    value: ScriptPublicationFormValue[keyof ScriptPublicationFormValue]
  ) => {
    const next = { ...current, [key]: value };

    if (key === "applyingLocalMaterial" && value === "no") {
      delete next.filmDirector;
      delete next.filmWriter;
      delete next.writerNationality;
      delete next.writerEmiratesId;
      delete next.writerEmiratesIdCopy;
    }

    if (key === "typeOfPublication") {
      const nextTypeOption = getSelectedTypeOfPublicationOption(
        value as string | number | null,
      );
      const isNextMovieType = [
        value,
        nextTypeOption?.id,
        nextTypeOption?.code,
        nextTypeOption?.label,
      ]
        .map((item) => normalizeText(item as string | number | null))
        .some((item) => MOVIE_TYPE_MATCHERS.has(item));
      if (!isNextMovieType) {
        delete next.productionCompany;
      }
    }

    field.setValue(next);
  }, [current, field, getSelectedTypeOfPublicationOption]);

  React.useEffect(() => {
    if (!selectedTypeOfPublicationOption) return;

    if (
      String(current.typeOfPublication ?? "") ===
      String(selectedTypeOfPublicationOption.value)
    ) {
      return;
    }

    handleFieldChange("typeOfPublication", selectedTypeOfPublicationOption.value);
  }, [
    current.typeOfPublication,
    handleFieldChange,
    selectedTypeOfPublicationOption,
  ]);

  React.useEffect(() => {
    syncDependentFieldState("productionCompany", isMoviePublication, false);
  }, [isMoviePublication, syncDependentFieldState]);

  React.useEffect(() => {
    [
      "filmDirector",
      "filmWriter",
      "writerNationality",
      "writerEmiratesId",
      "writerEmiratesIdCopy",
    ].forEach((name) => {
      syncDependentFieldState(name, isLocalMaterial, true);
    });
  }, [isLocalMaterial, syncDependentFieldState]);

  const renderLabel = (
    label: string,
    required = true,
    tooltip?: string
  ) => (
    <div className="script-pub-label">
      <span>
        {label}
        {required && <span className="script-pub-required">*</span>}
      </span>
      {tooltip && (
        <Tooltip title={tooltip}>
          <QuestionCircleOutlined className="script-pub-tooltip-icon" />
        </Tooltip>
      )}
    </div>
  );

  const renderTextInput = (
    name: string,
    label: string,
    required = true,
    maxLength?: number,
    placeholder?: string,
    regex?: RegExp
  ) => (
    <Field
      name={name}
      decorator={[FormItem]}
      validator={(value) => {
        if (required && !value) return requiredMessage;
        if (value && maxLength && value.length > maxLength)
          return tf("validation.maxChars", { max: maxLength });
        if (value && regex && !regex.test(value)) return tf("validation.namePattern");
        return "";
      }}
    >
      {renderLabel(label, required)}
      <Input
        disabled={props.disabled}
        placeholder={placeholder || label}
        value={String(current[name] || "")}
        maxLength={maxLength}
        onChange={(e) => {
          const val = e.target.value;
          if (regex) {
            if (regex.test(val) || val === "") handleFieldChange(name, val);
          } else {
            handleFieldChange(name, val);
          }
        }}
      />
    </Field>
  );

  const renderEmiratesIdInput = (
    name: string,
    label: string,
    required = true
  ) => (
    <Field
      name={name}
      decorator={[FormItem]}
      validator={(value) => {
        if (required && !value) return requiredMessage;
        if (value && !EMIRATES_ID_REGEX.test(value))
          return tf("validationInvalidEmiratesId");
        return "";
      }}
    >
      {renderLabel(label, required)}
      <Input
        disabled={props.disabled}
        placeholder={tf("placeholderEmiratesId")}
        value={String(current[name] || "")}
        maxLength={15}
        onChange={(e) => handleFieldChange(name, e.target.value)}
      />
    </Field>
  );

  const renderMultiLangSelect = (
    name: string,
    label: string,
    required = true
  ) => (
    <Field
      name={name}
      decorator={[FormItem]}
      validator={(value) => {
        if (required && (!value || !value.length))
          return requiredMessage;
        return "";
      }}
    >
      {renderLabel(label, required)}
      <LanguageSelectComponent
        className="script-pub-lang-select"
        disabled={props.disabled}
        multiple={true}
        placeholder={tf("placeholderSelect", { label })}
        value={current[name]}
        onChange={(value: unknown) =>
          handleFieldChange(
            name,
            value as ScriptPublicationFormValue[keyof ScriptPublicationFormValue],
          )
        }
      />
    </Field>
  );

  const renderUpload = (
    name: string,
    label: string,
    required = true,
    accept = ".pdf",
    maxSize = 50,
    tooltip?: string,
    beforeUpload?: (file: RcFile) => boolean
  ) => (
    <Field
      name={name}
      decorator={[FormItem]}
      validator={(value) => {
        if (required && !value) return requiredMessage;
        return "";
      }}
    >
      {renderLabel(label, required, tooltip)}
      <DocumentViewer
        hasDelete
        disabled={props.disabled}
        value={current[name] as string | string[] | undefined}
        onChange={(value) => handleFieldChange(name, value)}
        uploadConfig={{
          maxCount: 1,
          maxSize,
          uploadTip: "",
          accept,
          beforeUpload,
          invalidFileTypeMessage: tf("validation.pdfOnly"),
          maxSizeErrorMessage: tf("validation.maxFileSize", { max: maxSize }),
        }}
      />
    </Field>
  );

  const renderFileOrLink = (
    name: string,
    label: string,
    required = true,
    maxSize = 100,
    tooltip?: string,
  ) => {
    const rawValue = current[name];
    const value = Array.isArray(rawValue) ? rawValue[0] ?? "" : rawValue;

    return (
      <Field
        name={name}
        decorator={[FormItem]}
        validator={(fieldValue) => {
          if (required && !fieldValue) return requiredMessage;
          return "";
        }}
      >
        {renderLabel(label, required, tooltip)}
        <DraftFileOrLinkField
          disabled={props.disabled}
          value={String(value ?? "")}
          onChange={(nextValue) => handleFieldChange(name, nextValue)}
          fileFormat={["PDF"]}
          fileSizeLimit={maxSize}
          uploadPlaceholder={tf("uploadPlaceholder")}
          invalidFileTypeMessage={tf("validation.pdfOnly")}
          maxSizeErrorMessage={tf("validation.maxFileSize", { max: maxSize })}
        />
      </Field>
    );
  };

  const renderCountrySelect = (
    name: string,
    label: string,
    required = true
  ) => (
    <Field
      name={name}
      decorator={[FormItem]}
      validator={(value) => {
        if (required && !value) return requiredMessage;
        return "";
      }}
    >
      {renderLabel(label, required)}
      <Select
        showSearch
        disabled={props.disabled}
        placeholder={tf("placeholder.select", { label })}
        value={current[name]}
        optionFilterProp="label"
        className="script-pub-select"
        filterOption={(input, option) =>
          String(option?.label ?? "")
            .toLowerCase()
            .includes(input.toLowerCase())
        }
        onChange={(value) => handleFieldChange(name, value)}
      >
        {countryOptions.map((country) => (
          <Option
            key={country.key}
            value={country.value}
            label={country.label}
          >
            {country.label}
          </Option>
        ))}
      </Select>
    </Field>
  );

  const createPdfBeforeUpload =
    (maxSize: number) =>
    (file: RcFile): boolean => {
      const isPdf =
        file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!isPdf) {
        CustomMessage.error(tf("validation.pdfOnly"));
        return false;
      }

      const isWithinLimit = file.size / 1024 / 1024 <= maxSize;
      if (!isWithinLimit) {
        CustomMessage.error(tf("validation.maxFileSize", { max: maxSize }));
        return false;
      }

      return true;
    };

  return (
    <div className="script-pub-container" {...props}>
      <AntdCard
        className="script-pub-card"
        title={
          <span data-content-editable="x-component-props.title">
            {tf("title")}
          </span>
        }
      >
        <Row gutter={24}>
          {/* Type of Publication */}
          <Col span={12}>
            <Field
              name="typeOfPublication"
              decorator={[FormItem]}
              validator={(value) => {
                if (!value) return requiredMessage;
                return "";
              }}
            >
              {renderLabel(tf("labelTypeOfPublication"))}
              <Select
                disabled={props.disabled}
                placeholder={tf("placeholderSelectTypeOfPublication")}
                value={
                  selectedTypeOfPublicationOption?.value ??
                  current.typeOfPublication
                }
                onChange={(val) => handleFieldChange("typeOfPublication", val)}
                className="script-pub-select"
              >
                {typeOfPublicationOptions.map((option) => (
                  <Option key={String(option.value)} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Field>
          </Col>

          {/* Applying permit for local material */}
          <Col span={12}>
            <Field name="applyingLocalMaterial" decorator={[FormItem]}>
              {renderLabel(tf("labelApplyingLocalMaterial"))}
              <div className="script-pub-radio-group">
                <Radio.Group
                  disabled={props.disabled}
                  value={current.applyingLocalMaterial ?? "no"}
                  onChange={(e) =>
                    handleFieldChange("applyingLocalMaterial", e.target.value)
                  }
                >
                  <Radio value="yes">{tf("optionYes")}</Radio>
                  <Radio value="no">{tf("optionNo")}</Radio>
                </Radio.Group>
              </div>
            </Field>
          </Col>

          {/* Publication Title */}
          <Col span={12}>
            {renderTextInput(
              "publicationTitle",
              tf("labelPublicationTitle"),
              true,
              200,
              tf("placeholderPublicationTitle")
            )}
          </Col>

          {/* Author Name */}
          <Col span={12}>
            {renderTextInput(
              "authorName",
              tf("labelAuthorName"),
              true,
              100,
              tf("placeholderAuthorName"),
              NAME_REGEX
            )}
          </Col>

          {/* Languages */}
          <Col span={12}>
            {renderMultiLangSelect("languages", tf("labelLanguages"))}
          </Col>

          {/* Production Company */}
          {isMoviePublication && (
            <Col span={12}>
              {renderTextInput(
                "productionCompany",
                tf("labelProductionCompany"),
                false,
                200,
                tf("placeholderProductionCompany")
              )}
            </Col>
          )}

          {/* Upload Material */}
          <Col span={12}>
            {renderFileOrLink(
              "uploadMaterial",
              tf("labelUploadMaterial"),
              true,
              100,
              tf("tooltipUploadMaterial"),
            )}
          </Col>

          <Col span={12}>
            {renderUpload(
              "UploadObligationLetter",
              tf("labelUploadObligationLetter"),
              false,
              ".pdf",
              5,
              tf("tooltipUploadObligationLetter"),
              createPdfBeforeUpload(5),
            )}
          </Col>

          {/* ---- Conditional: Local material fields ---- */}
          {isLocalMaterial && (
            <>
              <Col span={24}>
                <div className="script-pub-section-divider">
                  {tf("sectionLocalCreatorInformation")}
                </div>
              </Col>

              {/* Film Director */}
              <Col span={12}>
                {renderTextInput(
                  "filmDirector",
                  tf("labelFilmDirector"),
                  true,
                  100,
                  tf("placeholderFilmDirector"),
                  NAME_REGEX
                )}
              </Col>

              {/* Film Writer */}
              <Col span={12}>
                {renderTextInput(
                  "filmWriter",
                  tf("labelFilmWriter"),
                  true,
                  100,
                  tf("placeholderFilmWriter"),
                  NAME_REGEX
                )}
              </Col>

              {/* Writer Nationality */}
              <Col span={12}>
                {renderCountrySelect(
                  "writerNationality",
                   tf("labelWriterNationality"),
                )}
              </Col>

              {/* Writer Emirates ID */}
              <Col span={12}>
                {renderEmiratesIdInput(
                  "writerEmiratesId",
                  tf("labelWriterEmiratesId")
                )}
              </Col>

              {/* Writer Emirates ID Copy */}
              <Col span={12}>
                {renderUpload(
                  "writerEmiratesIdCopy",
                  tf("labelWriterEmiratesIdCopy"),
                  true,
                  ".pdf",
                  5,
                  tf("tooltipWriterEmiratesIdCopy"),
                  createPdfBeforeUpload(5)
                )}
              </Col>
            </>
          )}
        </Row>
      </AntdCard>
    </div>
  );
});

ScriptPublicationFormField.displayName = "ScriptPublicationFormField";

export default ScriptPublicationFormField;
