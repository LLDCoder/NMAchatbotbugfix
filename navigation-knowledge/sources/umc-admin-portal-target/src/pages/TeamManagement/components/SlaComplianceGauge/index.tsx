import type { FC } from "react"
import type { GaugeSegmentLine, SlaComplianceGaugeProps } from "./type"
import "./index.less"

const VIEWBOX_WIDTH = 78
const VIEWBOX_HEIGHT = 45
const CENTER_X = 39
const CENTER_Y = 41
const INNER_RADIUS = 29
const OUTER_RADIUS = 34
const STROKE_WIDTH = 6
const SEGMENT_COUNT = 10
const SEGMENT_START_ANGLE = 186
const SEGMENT_END_ANGLE = 354
const SEGMENT_ANGLE_STEP =
  (SEGMENT_END_ANGLE - SEGMENT_START_ANGLE) / (SEGMENT_COUNT - 1)
const SEGMENT_ANGLES = Array.from({ length: SEGMENT_COUNT }, (_, index) =>
  SEGMENT_START_ANGLE + SEGMENT_ANGLE_STEP * index
)

const toRadians = (angle: number) => (Math.PI / 180) * angle

const getPointByAngle = (radius: number, angle: number) => ({
  x: CENTER_X + radius * Math.cos(toRadians(angle)),
  y: CENTER_Y + radius * Math.sin(toRadians(angle)),
})

const SEGMENT_LINES: GaugeSegmentLine[] = SEGMENT_ANGLES.map((angle) => {
  const startPoint = getPointByAngle(INNER_RADIUS, angle)
  const endPoint = getPointByAngle(OUTER_RADIUS, angle)

  return {
    angle,
    x1: startPoint.x,
    y1: startPoint.y,
    x2: endPoint.x,
    y2: endPoint.y,
  }
})

const normalizeGaugeValue = (value?: number | null) => {
  const numericValue = Number(value)

  return Number.isFinite(numericValue)
    ? Math.max(0, Math.min(100, numericValue))
    : 0
}

const getGaugeColor = (value?: number | null) => {
  const safeValue = normalizeGaugeValue(value)

  if (safeValue >= 60) {
    return "#00B259"
  }

  if (safeValue >= 30) {
    return "#F29F0E"
  }

  return "#EA4F49"
}

const getActiveSegments = (value?: number | null) => {
  const safeValue = normalizeGaugeValue(value)

  if (safeValue <= 0) {
    return 0
  }

  return Math.min(SEGMENT_LINES.length, Math.ceil(safeValue / 10))
}

const SlaComplianceGauge: FC<SlaComplianceGaugeProps> = ({ value }) => {
  const activeSegments = getActiveSegments(value)
  const activeColor = getGaugeColor(value)

  return (
    <div className="sla-compliance-gauge" aria-hidden="true">
      <svg
        className="sla-compliance-gauge__svg"
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
  )
}

export default SlaComplianceGauge
