import type { FC } from "react";
import type { DashboardTone } from "../type";

interface DashboardSlaComplianceGaugeProps {
  value?: string | number | null;
  tone?: DashboardTone;
  className?: string;
}

interface GaugeSegmentLine {
  angle: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const VIEWBOX_WIDTH = 40;
const VIEWBOX_HEIGHT = 40;
const CENTER_X = 20;
const CENTER_Y = 32;
const INNER_RADIUS = 15.5;
const OUTER_RADIUS = 19.5;
const STROKE_WIDTH = 3.2;
const SEGMENT_COUNT = 10;
const SEGMENT_START_ANGLE = 190;
const SEGMENT_END_ANGLE = 350;
const SEGMENT_ANGLE_STEP =
  (SEGMENT_END_ANGLE - SEGMENT_START_ANGLE) / (SEGMENT_COUNT - 1);
const SEGMENT_ANGLES = Array.from(
  { length: SEGMENT_COUNT },
  (_, index) => SEGMENT_START_ANGLE + SEGMENT_ANGLE_STEP * index
);

const toRadians = (angle: number) => (Math.PI / 180) * angle;

const getPointByAngle = (radius: number, angle: number) => ({
  x: CENTER_X + radius * Math.cos(toRadians(angle)),
  y: CENTER_Y + radius * Math.sin(toRadians(angle)),
});

const SEGMENT_LINES: GaugeSegmentLine[] = SEGMENT_ANGLES.map((angle) => {
  const startPoint = getPointByAngle(INNER_RADIUS, angle);
  const endPoint = getPointByAngle(OUTER_RADIUS, angle);

  return {
    angle,
    x1: startPoint.x,
    y1: startPoint.y,
    x2: endPoint.x,
    y2: endPoint.y,
  };
});

const parseGaugeValue = (value?: string | number | null) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const matchedValue = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  const numericValue = Number(matchedValue?.[0]);

  return Number.isFinite(numericValue) ? numericValue : 0;
};

const normalizeGaugeValue = (value?: string | number | null) =>
  Math.max(0, Math.min(100, parseGaugeValue(value)));

const getGaugeColor = (value?: string | number | null) => {
  const safeValue = normalizeGaugeValue(value);

  if (safeValue >= 60) {
    return "#00B259";
  }

  if (safeValue >= 30) {
    return "#F29F0E";
  }

  return "#EA4F49";
};

const getActiveSegments = (value?: string | number | null) => {
  const safeValue = normalizeGaugeValue(value);

  if (safeValue <= 0) {
    return 0;
  }

  return Math.min(SEGMENT_LINES.length, Math.ceil(safeValue / 10));
};

const toneClass = (tone?: DashboardTone) =>
  tone && tone !== "default" ? ` dashboard-tone--${tone}` : "";

export const DashboardSlaComplianceGauge: FC<
  DashboardSlaComplianceGaugeProps
> = ({ value, tone, className }) => {
  const activeSegments = getActiveSegments(value);
  const activeColor = getGaugeColor(value);
  const classNameSuffix = className ? ` ${className}` : "";

  return (
    <div
      className={`dashboard__metric-icon dashboard__metric-icon--gauge dashboard__metric-icon--sla-gauge${toneClass(
        tone
      )}${classNameSuffix}`}
      aria-hidden="true"
    >
      <svg
        className="dashboard__metric-sla-gauge-svg"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        focusable="false"
      >
        {SEGMENT_LINES.map((segment, index) => (
          <line
            key={segment.angle}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke={index < activeSegments ? activeColor : "#D9D9D9"}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
};
