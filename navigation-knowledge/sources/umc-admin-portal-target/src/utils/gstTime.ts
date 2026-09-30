/**
 * Project time utilities — UAE (Asia/Dubai, UTC+4, no DST).
 *
 * Backend time contract: all business DateTime values travel as Dubai wall-clock
 * strings in the format "YYYY-MM-DDTHH:mm:ss" with NO timezone suffix (no Z, no
 * offset). This module is the single place that reads/writes that contract so
 * the app behaves identically regardless of the user's browser timezone.
 *
 * Rules:
 *  - Parse backend values with `fromApi` (never `new Date(str)` / bare `moment(str)`).
 *  - Submit picker values with `toApi` (never `.toISOString()`).
 *  - Compare against "now" with `nowGst()` (never `Date.now()` for business logic).
 *  - Format for display with `fmt`.
 */
import dayjs from "dayjs";
import type { Dayjs, ConfigType } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

/** IANA timezone of the project. */
export const GST = "Asia/Dubai";

/** Wire format of the backend time contract (Dubai wall-clock, no offset). */
export const API_FMT = "YYYY-MM-DDTHH:mm:ss";

/** Common display formats. */
export const DISPLAY_DATE = "DD/MM/YYYY";
export const DISPLAY_DATETIME = "DD/MM/YYYY HH:mm";
export const DISPLAY_DATETIME_SEC = "DD/MM/YYYY HH:mm:ss";

/**
 * Parse a backend contract string (Dubai wall-clock, offset-less) into a Dayjs
 * anchored in the Dubai timezone. Strings that DO carry Z / an explicit offset
 * (legacy responses) are converted into Dubai time instead of being trusted as-is.
 */
export function fromApi(value?: string | null): Dayjs | null {
  if (!value) return null;
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(value);
  const d = hasOffset ? dayjs(value).tz(GST) : dayjs.tz(value, GST);
  return d.isValid() ? d : null;
}

/**
 * Serialize any dayjs-compatible value (Moment/Dayjs/Date/string) into the
 * backend contract string. The instant is expressed as Dubai wall-clock time.
 */
export function toApi(value: ConfigType): string;
export function toApi(value: ConfigType | null | undefined): string | undefined;
export function toApi(value: ConfigType | null | undefined): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const d = dayjs(value as ConfigType).tz(GST);
  return d.isValid() ? d.format(API_FMT) : undefined;
}

/** Serialize to a pure Dubai calendar date "YYYY-MM-DD" (for date-only fields). */
export function toApiDate(value: ConfigType): string {
  return dayjs(value as ConfigType).tz(GST).format("YYYY-MM-DD");
}

/** Convert a selected Dubai calendar day boundary to an absolute UTC ISO timestamp. */
export function gstDayBoundaryUtc(value: ConfigType, addDays = 0): string {
  const calendarDate = dayjs(value as ConfigType).format("YYYY-MM-DD");
  return dayjs
    .tz(`${calendarDate} 00:00:00`, "YYYY-MM-DD HH:mm:ss", GST)
    .add(addDays, "day")
    .utc()
    .format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
}

/** Format a backend contract string for display; returns fallback when empty/invalid. */
export function fmt(value?: string | null, format: string = DISPLAY_DATETIME, fallback = "-"): string {
  const d = fromApi(value);
  return d ? d.format(format) : fallback;
}

/** Current time in Dubai — use instead of Date.now()/moment() for business comparisons. */
export function nowGst(): Dayjs {
  return dayjs().tz(GST);
}

/** Milliseconds between a backend timestamp and "now" in Dubai (positive = in the future). */
export function msUntil(value?: string | null): number | null {
  const d = fromApi(value);
  return d ? d.valueOf() - Date.now() : null;
}
