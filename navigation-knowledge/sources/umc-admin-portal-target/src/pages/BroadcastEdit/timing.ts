import moment from "moment";
import type { Moment } from "moment";
import type { Dayjs } from "dayjs";
import { API_FMT, fromApi, nowGst } from "@/utils/gstTime";
import { BROADCAST_PUBLISH_TYPE } from "./constants";
import type { BroadcastFormValues } from "./types";

// AntD 4 pickers hold timezone-less Moment values, so parse with `fromApi` and
// keep the Dubai wall-clock fields. Submitting goes straight through `toApi`.
export const fromBroadcastApiTime = (value?: string | null): Moment | undefined => {
  const time = fromApi(value);
  return time ? moment(time.format(API_FMT), API_FMT, true) : undefined;
};

export const BROADCAST_TIMING_ERROR = {
  ExpiryTimeTooSoon: "EXPIRY_TIME_TOO_SOON",
  DisplayPeriodInvalid: "DISPLAY_PERIOD_INVALID",
} as const;

export type BroadcastTimingError =
  (typeof BROADCAST_TIMING_ERROR)[keyof typeof BROADCAST_TIMING_ERROR];

const MIN_EXPIRY_BUFFER_MINUTES = 1;

const toGstWallClock = (value?: Moment): Dayjs | null => {
  if (!value?.isValid()) return null;
  return fromApi(value.format(API_FMT));
};

export const getBroadcastTimingError = (
  values: BroadcastFormValues,
): BroadcastTimingError | null => {
  const currentTime = nowGst();
  const minimumExpiryTime = currentTime.add(
    MIN_EXPIRY_BUFFER_MINUTES,
    "minute",
  );

  if (values.publishType === BROADCAST_PUBLISH_TYPE.Now) {
    const expiryTime = toGstWallClock(values.expiryTime);
    return expiryTime && !expiryTime.isBefore(minimumExpiryTime)
      ? null
      : BROADCAST_TIMING_ERROR.ExpiryTimeTooSoon;
  }

  const [pushValue, expiryValue] = values.displayPeriod || [];
  const pushTime = toGstWallClock(pushValue);
  const expiryTime = toGstWallClock(expiryValue);

  return pushTime &&
    expiryTime &&
    pushTime.isAfter(currentTime) &&
    expiryTime.isAfter(pushTime) &&
    !expiryTime.isBefore(minimumExpiryTime)
    ? null
    : BROADCAST_TIMING_ERROR.DisplayPeriodInvalid;
};
