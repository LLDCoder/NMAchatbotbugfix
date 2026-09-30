import React from "react";
import { Radio as AntdRadio, Space } from "antd";
import { useField, useForm } from "@formily/react";
import {
  useFormLanguageHost,
  useFormPreviewLang,
  type FormLanguageHost,
  type PortalFormLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";

function resolveRadioOptionLabel(
  opt: {
    label?: React.ReactNode;
    labelEn?: string;
    labelAr?: string;
  },
  lang: PortalFormLang,
  host: FormLanguageHost,
): React.ReactNode {
  const legacy =
    typeof opt.label === "string" ? opt.label : undefined;
  const resolved = getBilingualValueByLang({
    lang,
    host,
    en: opt.labelEn,
    ar: opt.labelAr,
    legacy,
    fallback: "",
  });
  if (resolved !== "") {
    return resolved;
  }
  if (opt.label != null && opt.label !== "") {
    return opt.label;
  }
  return "";
}

type RadioOptionItem = {
  value: string | number;
  label?: React.ReactNode;
  labelEn?: string;
  labelAr?: string;
};

export type RadioGroupLayoutProps = {
  layout?: string;
  style?: React.CSSProperties;
  options?: RadioOptionItem[];
  dataSource?: RadioOptionItem[];
  titleEn?: string;
  titleAr?: string;
  placeholderEn?: string;
  placeholderAr?: string;
  placeholder?: string;
  title?: string;
  [key: string]: unknown;
};

type FormilyPatternCarrier = {
  pattern?: string;
};

function RadioGroupWithLayout(props: RadioGroupLayoutProps) {
  const field = useField<FormilyPatternCarrier>();
  const form = useForm();
  const lang = useFormPreviewLang();
  const host = useFormLanguageHost();
  const layout =
    props.layout ??
    (props["x-component-props"] as { layout?: string } | undefined)?.layout ??
    "horizontal";
  const {
    layout: _layoutStrip,
    style,
    "x-component-props": _xcpStrip,
    options,
    dataSource,
    titleEn: _te,
    titleAr: _ta,
    placeholderEn: _pe,
    placeholderAr: _pa,
    placeholder: _ph,
    title: _ti,
    ...rest
  } = props;
  void _layoutStrip;
  void _xcpStrip;
  void _te;
  void _ta;
  void _pe;
  void _pa;
  void _ph;
  void _ti;
  const opts = Array.isArray(options ?? dataSource)
    ? (options ?? dataSource)!
    : [];
  const isDisabled =
    Boolean(rest.disabled) ||
    Boolean((rest as { readOnly?: boolean }).readOnly) ||
    field?.pattern === "disabled" ||
    field?.pattern === "readOnly" ||
    field?.pattern === "readPretty" ||
    form.pattern === "disabled" ||
    form.pattern === "readOnly" ||
    form.pattern === "readPretty";

  const groupProps = {
    ...(rest as React.ComponentProps<typeof AntdRadio.Group>),
    disabled: isDisabled,
  };

  return (
    <AntdRadio.Group {...groupProps} style={style}>
      <Space
        direction={layout === "vertical" ? "vertical" : "horizontal"}
        size={layout === "vertical" ? "small" : "middle"}
      >
        {opts.map((opt: RadioOptionItem) => (
          <AntdRadio key={String(opt.value)} value={opt.value}>
            {resolveRadioOptionLabel(opt, lang, host)}
          </AntdRadio>
        ))}
      </Space>
    </AntdRadio.Group>
  );
}

export default RadioGroupWithLayout;
