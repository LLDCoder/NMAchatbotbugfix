import { useCallback } from "react";
import { Select, Input } from "antd";
import AddressPickerComponent from "./AddressPicker";
import { createBehavior, createResource } from "@designable/core";
import { useDesigner } from "@designable/react";
import type { DnFC } from "@designable/react";
import { useTranslation } from "react-i18next";
import { AllLocales } from "../../locales";
import i18n from "@/localization/config";
import {
  mapDesignerLanguageToContentLang,
  useFormContentLang,
  useFormLanguageHost,
} from "@/components/designable/playground/FormPreviewLangContext";
import MapPlaceholder from "@/assets/images/address-picker-map-placeholder.png";
import { resourceIcons } from "../../assets/resource-icons";
import "./preview.less";

type AddressPickerPreviewProps = Record<string, unknown> & {
  disabled?: boolean;
};

const Wrapper: DnFC<AddressPickerPreviewProps> = (props) => {
  const designer = useDesigner();
  const host = useFormLanguageHost();
  const contentLang = useFormContentLang();
  const { i18n: i18nInstance } = useTranslation();
  const previewLang =
    host === "designer"
      ? contentLang
      : mapDesignerLanguageToContentLang(i18nInstance.language);
  const lngOpt = previewLang === "ar" ? "ar" : "en";

  const tx = useCallback(
    (key: string) =>
      String(i18nInstance.t(`AddressPicker.${key}`, { lng: lngOpt })),
    [i18nInstance, lngOpt],
  );

  if (designer) {
    return (
      <div className="address-picker-preview">
        <div className="grid-container">
          <div className="field-wrapper">
            <div className="field-label">
              <span className="label-text">{tx("labelEmirate")} </span>
              <span className="required-mark">*</span>
            </div>
            <Select
              disabled={props.disabled}
              placeholder={tx("phSelectEmirate")}
              className="field-select"
            />
          </div>
          <div className="field-wrapper">
            <div className="field-label">
              <span className="label-text">{tx("labelRegion")} </span>
              <span className="required-mark">*</span>
            </div>
            <Select
              disabled={props.disabled}
              placeholder={tx("phSelectRegion")}
              className="field-select"
            />
          </div>
          <div className="field-wrapper">
            <div className="field-label">
              <span className="label-text">{tx("labelArea")} </span>
              <span className="required-mark">*</span>
            </div>
            <Select
              disabled={props.disabled}
              placeholder={tx("phSelectArea")}
              className="field-select"
            />
          </div>
          <div className="field-wrapper">
            <div className="field-label">
              <span className="label-text">{tx("labelStreet")} </span>
              <span className="required-mark">*</span>
            </div>
            <Input.TextArea
              disabled={props.disabled}
              placeholder={tx("phEnterStreet")}
              className="field-textarea"
              rows={4}
            />
          </div>
        </div>
        <img
          src={MapPlaceholder}
          alt=""
          className="map-placeholder"
          draggable={false}
        />
      </div>
    );
  }
  return <AddressPickerComponent {...props} />;
};

export const AddressPicker: DnFC<AddressPickerPreviewProps> = Wrapper;

AddressPicker.Behavior = createBehavior({
  name: "AddressPicker",
  extends: ["Field"],
  selector: (node) => node.props?.["x-component"] === "AddressPicker",
  designerProps: {
    propsSchema: {
      type: "object",
      properties: {
        "field-group": {
          type: "void",
          "x-component": "CollapseItem",
          properties: {
            "x-display": {
              type: "string",
              "x-decorator": "FormItem",
              "x-component": "StringSwitchSetter",
              default: "visible",
              "x-component-props": {
                checkedValue: "visible",
                unCheckedValue: "none",
              },
            },
            "x-pattern": {
              type: "string",
              "x-decorator": "FormItem",
              "x-component": "StringSwitchSetter",
              default: "editable",
              "x-component-props": {
                checkedValue: "editable",
                unCheckedValue: "disabled",
              },
            },
          },
        },
      },
    },
  },
  designerLocales: AllLocales.AddressPicker,
});

const paletteTitleEn = i18n.t("AddressPicker.resourcePaletteTitle", {
  lng: "en",
});
const paletteTitleAr = i18n.t("AddressPicker.resourcePaletteTitle", {
  lng: "ar",
});

AddressPicker.Resource = createResource({
  title: { "en-US": paletteTitleEn, "ar-AE": paletteTitleAr },
  icon: resourceIcons.addressPicker,
  elements: [
    {
      componentName: "Field",
      props: {
        name: "addressPicker",
        "x-decorator": "FormItem",
        "x-component": "AddressPicker",
      },
    },
  ],
});
