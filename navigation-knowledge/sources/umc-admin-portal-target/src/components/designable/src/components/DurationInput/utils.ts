type DurationSegmentKey = "hours" | "minutes" | "seconds";

type DurationSegments = Record<DurationSegmentKey, string>;

const EMPTY_SEGMENTS: DurationSegments = {
  hours: "",
  minutes: "",
  seconds: "",
};

const SEGMENT_CONFIG: Record<
  DurationSegmentKey,
  { max: number; maxLength: number }
> = {
  hours: { max: 99, maxLength: 2 },
  minutes: { max: 59, maxLength: 2 },
  seconds: { max: 59, maxLength: 2 },
};

const DURATION_PATTERN = /^(\d{2}):([0-5]\d):([0-5]\d)$/;

function allSegmentsEmpty(segments: DurationSegments) {
  return Object.values(segments).every((value) => value === "");
}

function padSegment(value: string) {
  if (!value) return "00";
  return value.padStart(2, "0");
}

function parseLegacyMinuteDuration(value: string): string | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const totalMinutes = Number(value);
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return undefined;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > SEGMENT_CONFIG.hours.max) return undefined;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:00`;
}

export function getDurationSegmentMaxLength(key: DurationSegmentKey) {
  return SEGMENT_CONFIG[key].maxLength;
}

export function isDurationSegmentWithinRange(
  key: DurationSegmentKey,
  digits: string,
) {
  if (!digits) return true;
  return Number(digits) <= SEGMENT_CONFIG[key].max;
}

export function normalizeDurationHmsValue(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;

  const legacyMinutes = parseLegacyMinuteDuration(raw);
  if (legacyMinutes) {
    return legacyMinutes;
  }

  const colonMatch = raw.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (!colonMatch) return undefined;

  const [, hoursRaw, minutesRaw, secondsRaw] = colonMatch;
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > SEGMENT_CONFIG.hours.max ||
    minutes < 0 ||
    minutes > SEGMENT_CONFIG.minutes.max ||
    seconds < 0 ||
    seconds > SEGMENT_CONFIG.seconds.max
  ) {
    return undefined;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
}

export function isDurationHmsValue(value: unknown): boolean {
  const normalized = normalizeDurationHmsValue(value);
  if (!normalized || !DURATION_PATTERN.test(normalized)) return false;
  return normalized !== "00:00:00";
}

export function parseDurationSegments(value: unknown): DurationSegments {
  const normalized = normalizeDurationHmsValue(value);
  if (!normalized) return EMPTY_SEGMENTS;
  const [hours, minutes, seconds] = normalized.split(":");
  return { hours, minutes, seconds };
}

export function buildDurationValue(
  segments: DurationSegments,
): string | undefined {
  if (allSegmentsEmpty(segments)) return undefined;
  return `${padSegment(segments.hours)}:${padSegment(
    segments.minutes,
  )}:${padSegment(segments.seconds)}`;
}
