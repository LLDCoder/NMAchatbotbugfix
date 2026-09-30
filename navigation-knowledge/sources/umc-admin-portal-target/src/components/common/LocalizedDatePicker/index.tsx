import DatePicker from "antd/lib/date-picker";
import datePickerEnUS from "antd/lib/date-picker/locale/en_US";
import datePickerArEG from "antd/lib/date-picker/locale/ar_EG";
import type { DatePickerProps, RangePickerProps } from "antd/es/date-picker";
import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { applyDateLocale } from "@/utils/dateLocale";
import "./index.less";

const DEFAULT_DROPDOWN_CLASS_NAME = "localized-date-picker-dropdown";
const DEFAULT_PICKER_CLASS_NAME = "localized-date-picker";
const RTL_PICKER_CLASS_NAME = "localized-date-picker-rtl";

const datePickerArLocale = {
  ...datePickerArEG,
  lang: {
    ...datePickerArEG.lang,
    locale: "ar-umc",
    monthBeforeYear: false,
    monthFormat: "MMMM",
  },
};

function isArabicLanguage(language: string) {
  return language.toLowerCase().startsWith("ar");
}

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function getPickerClassName(language: string, className?: string) {
  return mergeClassNames(
    DEFAULT_PICKER_CLASS_NAME,
    isArabicLanguage(language) ? RTL_PICKER_CLASS_NAME : undefined,
    className,
  );
}

function useLocalizedDatePickerDefaults(language: string) {
  useEffect(() => {
    applyDateLocale(language);
  }, [language]);

  return isArabicLanguage(language) ? datePickerArLocale : datePickerEnUS;
}

function getPopupStyle(popupStyle?: CSSProperties): CSSProperties {
  return {
    direction: "ltr",
    ...popupStyle,
  };
}

function renderLtrPanel(panelNode: ReactNode) {
  return <div dir="ltr">{panelNode}</div>;
}

function LocalizedSingleDatePicker(props: DatePickerProps) {
  const { i18n } = useTranslation();
  const locale = useLocalizedDatePickerDefaults(i18n.language);

  return (
    <DatePicker
      {...props}
      className={getPickerClassName(i18n.language, props.className)}
      locale={props.locale ?? locale}
      dropdownClassName={mergeClassNames(
        DEFAULT_DROPDOWN_CLASS_NAME,
        props.dropdownClassName,
      )}
      popupStyle={getPopupStyle(props.popupStyle)}
      panelRender={props.panelRender ?? renderLtrPanel}
    />
  );
}

function LocalizedRangePicker(props: RangePickerProps) {
  const { i18n } = useTranslation();
  const locale = useLocalizedDatePickerDefaults(i18n.language);

  return (
    <DatePicker.RangePicker
      {...props}
      className={getPickerClassName(i18n.language, props.className)}
      locale={props.locale ?? locale}
      dropdownClassName={mergeClassNames(
        DEFAULT_DROPDOWN_CLASS_NAME,
        props.dropdownClassName,
      )}
      popupStyle={getPopupStyle(props.popupStyle)}
      panelRender={props.panelRender ?? renderLtrPanel}
    />
  );
}

type LocalizedDatePickerComponent = typeof DatePicker & {
  RangePicker: typeof DatePicker.RangePicker;
};

const LocalizedDatePicker =
  LocalizedSingleDatePicker as unknown as LocalizedDatePickerComponent;

LocalizedDatePicker.RangePicker =
  LocalizedRangePicker as unknown as typeof DatePicker.RangePicker;
LocalizedDatePicker.WeekPicker = DatePicker.WeekPicker;
LocalizedDatePicker.MonthPicker = DatePicker.MonthPicker;
LocalizedDatePicker.YearPicker = DatePicker.YearPicker;
LocalizedDatePicker.TimePicker = DatePicker.TimePicker;
LocalizedDatePicker.QuarterPicker = DatePicker.QuarterPicker;

export { LocalizedRangePicker as RangePicker };
export default LocalizedDatePicker;
