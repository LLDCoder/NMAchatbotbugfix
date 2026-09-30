import React from "react";
import { observer, useForm } from "@formily/react";
import i18n from "@/localization/config";
import { useFormUiLang } from "@/components/designable/playground/FormPreviewLangContext";
import "./StyleSelector.less";

export interface StyleSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
}

const StyleSelector = observer((props: StyleSelectorProps) => {
  const { value, onChange, defaultValue = "warning" } = props;
  const form = useForm();
  const uiLang = useFormUiLang();
  const tf = i18n.getFixedT(uiLang);

  const current = value ?? defaultValue ?? "warning";

  const handleSelect = (val: "warning" | "reminder") => {
    onChange?.(val);
    const key =
      val === "warning"
        ? "Information.defaultHtmlWarning"
        : "Information.defaultHtmlReminder";
    form?.setValuesIn?.(
      "x-component-props.textEn",
      i18n.t(key, { lng: "en" }),
    );
    form?.setValuesIn?.(
      "x-component-props.textAr",
      i18n.t(key, { lng: "ar" }),
    );
  };

  return (
    <div className="style-selector">
      <div
        className={`style-option style-warning${
          current === "warning" ? " active" : ""
        }`}
        onClick={() => handleSelect("warning")}
      >
        <span className="style-icon">!</span>
        <span className="style-text">
          {tf("Information.styleOptionWarning")}
        </span>
      </div>
      <div
        className={`style-option style-reminder${
          current === "reminder" ? " active" : ""
        }`}
        onClick={() => handleSelect("reminder")}
      >
        <span className="style-icon">!</span>
        <span className="style-text">
          {tf("Information.styleOptionReminder")}
        </span>
      </div>
    </div>
  );
});

StyleSelector.displayName = "StyleSelector";

export default StyleSelector;
