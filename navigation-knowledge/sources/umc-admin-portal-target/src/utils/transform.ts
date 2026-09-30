import type { RangePickerProps } from "antd/lib/date-picker"
import moment from "moment"

const Sorter = {
  ascend: 0,
  descend: 1,
} as const

const SorterKeys = {
  ascend: "ascend",
  descend: "descend",
} as const

type TSorter = typeof Sorter

// single sort rule
interface ISortRule<T extends Record<string, any>> {
  sortOrder: TSorter[keyof TSorter]
  sortField: keyof T | string
}

type TStringTuple = [string, string]

// change format — project time contract: Dubai wall-clock without offset suffix.
// (moment().format() used to emit the BROWSER offset, e.g. +08:00, which the
// backend folded into UTC and shifted the filter window by hours.)
const transformDate = (
  value: RangePickerProps["value"]
): TStringTuple | [null, null] =>
  value && value.length
    ? [
        moment(value[0]).clone().startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
        moment(value[1]).clone().endOf("day").format("YYYY-MM-DDTHH:mm:ss"),
      ]
    : [null, null]

// date-only (YYYY-MM-DD, no time/timezone offset) — for date-range filters the backend
// compares with .Date. Sending a full ISO timestamp with offset (e.g. +04:00) makes the
// backend resolve .Date to the previous day under UTC, so the filter returns the wrong day.
const transformDateOnly = (
  value: RangePickerProps["value"]
): TStringTuple | [null, null] =>
  value && value.length
    ? [moment(value[0]).format("YYYY-MM-DD"), moment(value[1]).format("YYYY-MM-DD")]
    : [null, null]

// default items show
const transformNoValueString = (text: string | number, fallback = "-") => {
  return text ?? fallback
}

// transform sorter keys
const transformSorterKeys = <
  T extends Object,
  K extends (typeof SorterKeys)[keyof typeof SorterKeys] = typeof SorterKeys.ascend
>(
  target: keyof T,
  order: K
) => {
  return { sortBy: target, sortDirection: Sorter[order] }
}

const transformSpaceString = (text: string) => {
  if(!text) return "";
  return text.split(" ").join("")
}

export {
  SorterKeys,
  transformDate,
  transformDateOnly,
  transformNoValueString,
  transformSorterKeys,
  transformSpaceString,
}
export type { TStringTuple, ISortRule, TSorter }
