import moment from "moment";
import DatePickerIcon from "@/assets/images/datepicker.svg";
import SelectDownIcon from "@/assets/images/selectDown.svg";
import i18n from "@/localization/config";

export const disabledDateBefore: any = (current: any) => {
  // Can not select days before today and today
  return current && current > moment().add(-1, "day").endOf("day");
};
export const disabledDate: any = (current: any) => {
  // Can not select days before today and today
  return current && current < moment().add(-1, "day").endOf("day");
};
export const suffixIcon = (
  <img src={DatePickerIcon} className="self-datepickerIcon" />
);
export const selectDownIcon = (
  <img src={SelectDownIcon} className="self-selectIcon" />
);

const getLastLoginLocale = () =>
  i18n.language?.toLowerCase().startsWith("ar") ? "ar-AE" : "en-US";

const getTodayPrefix = () =>
  i18n.language?.toLowerCase().startsWith("ar") ? "اليوم في" : "Today at";

export const formatLastLoginTime = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";

  const date = moment(dateString);
  if (!date.isValid()) {
    return dateString;
  }

  const now = moment();

  const locale = getLastLoginLocale();
  const timeText = date.toDate().toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (date.isSame(now, "day")) {
    return `${getTodayPrefix()} ${timeText}`;
  }

  if (i18n.language?.toLowerCase().startsWith("ar")) {
    return date.toDate().toLocaleString(locale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const dateText = date.toDate().toLocaleDateString(locale, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  return `${dateText} at ${timeText}`;
};
