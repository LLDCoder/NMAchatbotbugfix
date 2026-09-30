import React from "react";
import { FormItem as FormilyFormItem } from "@formily/antd";
import { observer, useField } from "@formily/react";
import {
  useFormLanguageHost,
  useFormPreviewLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";
import PersonalPhotoTooltip from "@/components/common/PersonalPhotoTooltip";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

function isHtmlString(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

function isEffectivelyEmpty(str: string): boolean {
  if (!str) return true;
  const text = str.replace(/<[^>]*>/g, "").trim();
  return text.length === 0 && !/<img\s/i.test(str) && !/<video\s/i.test(str);
}

type FormItemProps = React.ComponentProps<typeof FormilyFormItem>;

const FormItemWithHtmlTooltip = observer((props: FormItemProps) => {
  const field = useField();
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const decoratorProps = (field?.decoratorProps ?? {}) as Record<string, unknown>;
  const explicitHideLabel =
    props.label === false || decoratorProps.label === false;
  const {
    tooltip,
    tooltipEn,
    tooltipAr,
    ...rest
  } = props as FormItemProps & {
    tooltipEn?: string;
    tooltipAr?: string;
  };
  const cp = field?.componentProps ?? {};
  const descriptionEnabled = cp.description === false ? false : true;
  let processedTooltip: React.ReactNode = tooltip;

  const resolveBilingualTooltip = (): string => {
    return getBilingualValueByLang({
      lang,
      host,
      en:
        typeof tooltipEn === "string"
          ? tooltipEn
          : decoratorProps.tooltipEn,
      ar:
        typeof tooltipAr === "string"
          ? tooltipAr
          : decoratorProps.tooltipAr,
      legacy: tooltip,
      fallback: "",
    });
  };

  if (descriptionEnabled) {
    const raw = resolveBilingualTooltip();
    if (typeof raw === "string") {
      if (isEffectivelyEmpty(raw)) {
        processedTooltip = undefined;
      } else if (isHtmlString(raw)) {
        processedTooltip = (
          <div
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(raw) }}
            style={{ maxWidth: 800 }}
            className="html-tooltip-content"
          />
        );
      } else {
        processedTooltip = raw;
      }
    } else {
      processedTooltip = undefined;
    }
  } else if (typeof tooltip === "string") {
    if (isEffectivelyEmpty(tooltip)) {
      processedTooltip = undefined;
    } else if (isHtmlString(tooltip)) {
      processedTooltip = (
        <div
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(tooltip) }}
          style={{ maxWidth: 800 }}
          className="html-tooltip-content"
        />
      );
    }
  }

  const titleEn = cp.titleEn;
  const titleAr = cp.titleAr;
  const legacyLabel =
    typeof cp.labelName === "string" ? cp.labelName : undefined;
  let label: FormItemProps["label"] = rest.label ?? field?.title;

  if (!explicitHideLabel) {
    const bilingualLabel = getBilingualValueByLang({
      lang,
      host,
      en: titleEn,
      ar: titleAr,
      legacy: legacyLabel,
      fallback: host === "designer" ? "" : typeof label === "string" ? label : "",
    });
    if (typeof bilingualLabel === "string" && bilingualLabel !== "") {
      label = bilingualLabel;
    } else if (host === "designer" && (titleEn != null || titleAr != null)) {
      label = bilingualLabel;
    }
  } else {
    label = false;
  }
  if (
    label !== false &&
    decoratorProps.personalPhotoTooltip === true
  ) {
    label = (
      <span className="personal-photo-label">
        {label}
        <PersonalPhotoTooltip />
      </span>
    );
  }

  const className = ["form-item-with-html-tooltip", rest.className]
    .filter(Boolean)
    .join(" ");

  return (
    <FormilyFormItem
      {...rest}
      className={className}
      label={label}
      tooltip={processedTooltip}
    />
  );
});

Object.assign(FormItemWithHtmlTooltip, {
  BaseComponent: FormilyFormItem,
});

export default FormItemWithHtmlTooltip;
