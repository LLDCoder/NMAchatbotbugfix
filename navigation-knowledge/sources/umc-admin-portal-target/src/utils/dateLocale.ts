import moment from "moment";

const DEFAULT_LANGUAGE = "en";
const ARABIC_PICKER_LOCALE = "ar-umc";

let dateLocalesRegistered = false;

const arabicPickerLocale: moment.LocaleSpecification = {
  months: [
    "\u064A\u0646\u0627\u064A\u0631",
    "\u0641\u0628\u0631\u0627\u064A\u0631",
    "\u0645\u0627\u0631\u0633",
    "\u0623\u0628\u0631\u064A\u0644",
    "\u0645\u0627\u064A\u0648",
    "\u064A\u0648\u0646\u064A\u0648",
    "\u064A\u0648\u0644\u064A\u0648",
    "\u0623\u063A\u0633\u0637\u0633",
    "\u0633\u0628\u062A\u0645\u0628\u0631",
    "\u0623\u0643\u062A\u0648\u0628\u0631",
    "\u0646\u0648\u0641\u0645\u0628\u0631",
    "\u062F\u064A\u0633\u0645\u0628\u0631",
  ],
  monthsShort: [
    "\u064A\u0646\u0627\u064A\u0631",
    "\u0641\u0628\u0631\u0627\u064A\u0631",
    "\u0645\u0627\u0631\u0633",
    "\u0623\u0628\u0631\u064A\u0644",
    "\u0645\u0627\u064A\u0648",
    "\u064A\u0648\u0646\u064A\u0648",
    "\u064A\u0648\u0644\u064A\u0648",
    "\u0623\u063A\u0633\u0637\u0633",
    "\u0633\u0628\u062A\u0645\u0628\u0631",
    "\u0623\u0643\u062A\u0648\u0628\u0631",
    "\u0646\u0648\u0641\u0645\u0628\u0631",
    "\u062F\u064A\u0633\u0645\u0628\u0631",
  ],
  weekdays: [
    "\u0627\u0644\u0623\u062D\u062F",
    "\u0627\u0644\u0627\u062B\u0646\u064A\u0646",
    "\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621",
    "\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621",
    "\u0627\u0644\u062E\u0645\u064A\u0633",
    "\u0627\u0644\u062C\u0645\u0639\u0629",
    "\u0627\u0644\u0633\u0628\u062A",
  ],
  weekdaysShort: [
    "\u0623\u062D\u062F",
    "\u0627\u062B\u0646\u064A\u0646",
    "\u062B\u0644\u0627\u062B\u0627\u0621",
    "\u0623\u0631\u0628\u0639\u0627\u0621",
    "\u062E\u0645\u064A\u0633",
    "\u062C\u0645\u0639\u0629",
    "\u0633\u0628\u062A",
  ],
  weekdaysMin: [
    "\u062D",
    "\u0646",
    "\u062B",
    "\u0631",
    "\u062E",
    "\u062C",
    "\u0633",
  ],
  weekdaysParseExact: true,
  longDateFormat: {
    LT: "HH:mm",
    LTS: "HH:mm:ss",
    L: "D/M/YYYY",
    LL: "D MMMM YYYY",
    LLL: "D MMMM YYYY HH:mm",
    LLLL: "dddd D MMMM YYYY HH:mm",
  },
  meridiemParse: /\u0635|\u0645/,
  isPM: (input: string) => input === "\u0645",
  meridiem: (hour: number) => (hour < 12 ? "\u0635" : "\u0645"),
  preparse: (input: string) => input,
  postformat: (input: string) => input,
  week: {
    dow: 6,
    doy: 12,
  },
};

function getMomentLocale(language: string) {
  return language.toLowerCase().startsWith("ar")
    ? ARABIC_PICKER_LOCALE
    : DEFAULT_LANGUAGE;
}

function ensureDateLocales() {
  if (dateLocalesRegistered) {
    return;
  }

  if (!moment.locales().includes(ARABIC_PICKER_LOCALE)) {
    moment.defineLocale(ARABIC_PICKER_LOCALE, arabicPickerLocale);
  }

  dateLocalesRegistered = true;
}

export function applyDateLocale(language: string) {
  ensureDateLocales();
  moment.locale(getMomentLocale(language || DEFAULT_LANGUAGE));
}

export function toPickerMoment(
  value?: string | Date | moment.Moment | null,
  parseFormat?: string | string[],
): moment.Moment | null {
  if (value == null || value === "") {
    return null;
  }

  ensureDateLocales();

  const locale = getMomentLocale(moment.locale());
  const initialValue = moment.isMoment(value)
    ? value.clone()
    : parseFormat
      ? moment(value, parseFormat, true)
      : moment(value);
  const parsedValue =
    initialValue.isValid() || !parseFormat || moment.isMoment(value)
      ? initialValue
      : moment(value);

  return parsedValue.isValid() ? parsedValue.locale(locale) : null;
}

export function formatLocalizedDate(
  value?: string | Date | moment.Moment | null,
  language = DEFAULT_LANGUAGE,
  format = " DD MMM YYYY",
): string {
  const parsed = toPickerMoment(value);
  if (!parsed) {
    return "";
  }

  return parsed.clone().locale(getMomentLocale(language)).format(format);
}
