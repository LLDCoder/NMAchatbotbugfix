import moment from "moment";
import type { Moment } from "moment";

export const TEN_DAYS_FROM_TODAY = 10;
export const SIX_MONTHS_FROM_TODAY = 6;

export interface RestrictionSetterValue {
  beforeToday?: boolean;
  afterToday?: boolean;
  includeToday?: boolean;
  tenDaysFromToday?: boolean;
  withinSixMonthsFromToday?: boolean;
}

export interface DateRestrictionOptions {
  allowTenDaysFromToday?: boolean;
  allowWithinSixMonthsFromToday?: boolean;
  replaceDisabledDateWhenRestricted?: boolean;
  today?: Moment;
}

export type DisabledDatePredicate = (current: Moment) => boolean;

export function getDisabledDateInputValue(
  value: string,
  disabledDate?: DisabledDatePredicate,
  format: string = "DD/MM/YYYY",
): string | undefined {
  const normalizedValue = value.trim();
  const parsedValue = moment(normalizedValue, format, true);

  return parsedValue.isValid() && Boolean(disabledDate?.(parsedValue))
    ? normalizedValue
    : undefined;
}

export function isDateWithinTenDaysFromToday(
  current: Moment,
  today: Moment = moment(),
): boolean {
  return !current.isAfter(
    today.clone().add(TEN_DAYS_FROM_TODAY, "days"),
    "day",
  );
}

export function isDateAfterMonthsFromToday(
  current: Moment,
  months: number,
  today: Moment = moment(),
): boolean {
  return current.isAfter(today.clone().add(months, "months"), "day");
}

export function exceedsDateRangeDays(
  start: Moment,
  end: Moment,
  maximumDays: number,
): boolean {
  return end.diff(start, "days") > maximumDays;
}

export function hasActiveDateRestriction(
  restriction?: RestrictionSetterValue,
  allowTenDaysFromToday: boolean = true,
  allowWithinSixMonthsFromToday: boolean = true,
): boolean {
  return Boolean(
    restriction?.beforeToday ||
      restriction?.afterToday ||
      (allowTenDaysFromToday && restriction?.tenDaysFromToday) ||
      (allowWithinSixMonthsFromToday &&
        restriction?.withinSixMonthsFromToday),
  );
}

export function mergeDisabledDateWithRestriction(
  restriction?: RestrictionSetterValue,
  disabledDate?: DisabledDatePredicate,
  options: DateRestrictionOptions = {},
): DisabledDatePredicate | undefined {
  const {
    allowTenDaysFromToday = true,
    allowWithinSixMonthsFromToday = true,
    replaceDisabledDateWhenRestricted = false,
    today,
  } = options;
  const hasRestriction = hasActiveDateRestriction(
    restriction,
    allowTenDaysFromToday,
    allowWithinSixMonthsFromToday,
  );
  const effectiveDisabledDate =
    replaceDisabledDateWhenRestricted && hasRestriction
      ? undefined
      : disabledDate;

  if (!hasRestriction && !effectiveDisabledDate) {
    return effectiveDisabledDate;
  }

  return (current: Moment) => {
    if (!current) return false;
    const effectiveToday = today ?? moment();

    if (allowTenDaysFromToday && restriction?.tenDaysFromToday) {
      return (
        isDateWithinTenDaysFromToday(current, effectiveToday) ||
        (allowWithinSixMonthsFromToday &&
          restriction?.withinSixMonthsFromToday &&
          isDateAfterMonthsFromToday(
            current,
            SIX_MONTHS_FROM_TODAY,
            effectiveToday,
          )) ||
        Boolean(effectiveDisabledDate?.(current))
      );
    }
    if (
      allowWithinSixMonthsFromToday &&
      restriction?.withinSixMonthsFromToday &&
      isDateAfterMonthsFromToday(
        current,
        SIX_MONTHS_FROM_TODAY,
        effectiveToday,
      )
    ) {
      return true;
    }
    if (
      restriction?.includeToday &&
      current.isSame(effectiveToday, "day")
    ) {
      return false;
    }
    if (
      restriction?.beforeToday &&
      !current.isBefore(effectiveToday, "day")
    ) {
      return true;
    }
    if (
      restriction?.afterToday &&
      !current.isAfter(effectiveToday, "day")
    ) {
      return true;
    }

    return Boolean(effectiveDisabledDate?.(current));
  };
}
