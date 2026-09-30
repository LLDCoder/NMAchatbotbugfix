import React from "react";
import { Checkbox as AntdCheckbox, Space } from "antd";
import {
  useFormLanguageHost,
  useFormPreviewLang,
  type FormLanguageHost,
  type PortalFormLang,
} from "@/components/designable/playground/FormPreviewLangContext";
import { getBilingualValueByLang } from "@/components/designable/src/utils/bilingual";

function resolveCheckboxOptionLabel(
  opt: {
    label?: React.ReactNode;
    labelEn?: string;
    labelAr?: string;
  },
  lang: PortalFormLang,
  host: FormLanguageHost,
): React.ReactNode {
  const legacy = typeof opt.label === "string" ? opt.label : undefined;
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

type CheckboxOptionItem = {
  value: string | number;
  label?: React.ReactNode;
  labelEn?: string;
  labelAr?: string;
};

export type CheckboxGroupLayoutProps = {
  layout?: string;
  style?: React.CSSProperties;
  options?: CheckboxOptionItem[];
  dataSource?: CheckboxOptionItem[];
  titleEn?: string;
  titleAr?: string;
  placeholderEn?: string;
  placeholderAr?: string;
  placeholder?: string;
  title?: string;
  [key: string]: unknown;
};

function CheckboxGroupWithLayout(props: CheckboxGroupLayoutProps) {
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

  const groupProps = rest as React.ComponentProps<typeof AntdCheckbox.Group>;

  return (
    <AntdCheckbox.Group {...groupProps} style={style}>
      <Space
        direction={layout === "vertical" ? "vertical" : "horizontal"}
        size={layout === "vertical" ? "small" : "middle"}
      >
        {opts.map((opt: CheckboxOptionItem) => (
          <AntdCheckbox key={String(opt.value)} value={opt.value}>
            {resolveCheckboxOptionLabel(opt, lang, host)}
          </AntdCheckbox>
        ))}
      </Space>
    </AntdCheckbox.Group>
  );
}

export default CheckboxGroupWithLayout;
