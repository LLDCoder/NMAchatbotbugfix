import "./index.less";
import { Tooltip } from "antd";
import CustomStatusTag, {
  type CustomStatusTone,
  type StatusType,
} from "@/components/common/CustomStatusTag";

export type RelatedSectionVariant =
  | "relatedEnquiry"
  | "relatedApplication"
  | "relatedRefund"
  | "relatedAppeal";

export type RelatedSectionStatusTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "open"
  | "departmentProcessing"
  | "orange"
  | "gold";

export interface RelatedSectionField {
  label: string;
  value: string;
}

export interface RelatedSectionCardProps {
  variant: RelatedSectionVariant;
  title: string;
  referenceNo: string;
  enquiryId?: number | string | null;
  appealId?: number | string | null;
  applicationNo?: string | null;
  sortTime?: string | null;
  sourceServiceId?: number | null;
  statusLabel: string;
  statusValue?: number | string | null;
  statusType?: StatusType;
  statusTone?: RelatedSectionStatusTone;
  fields: RelatedSectionField[];
  hideTitle?: boolean;
  onReferenceClick?: () => void;
}

const getStatusTone = (
  tone: RelatedSectionStatusTone = "neutral",
): CustomStatusTone => {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    case "open":
      return "open";
    case "departmentProcessing":
      return "departmentProcessing";
    case "orange":
      return "orange";
    case "gold":
      return "gold";
    case "neutral":
    default:
      return "neutral";
  }
};

export default function RelatedSectionCard({
  variant,
  title,
  referenceNo,
  statusLabel,
  statusValue,
  statusType,
  statusTone = "neutral",
  fields,
  hideTitle = false,
  onReferenceClick,
}: RelatedSectionCardProps) {
  return (
    <div className="application-overview-related-section">
      {!hideTitle ? (
        <div className="application-overview-related-title">{title}</div>
      ) : null}
      <div className="application-overview-related-card">
        <div className="application-overview-related-card-top">
          {statusLabel !== "-" ? (
            <CustomStatusTag
              className="application-overview-related-status"
              label={statusLabel}
              size="compact"
              status={statusValue}
              tone={statusType ? undefined : getStatusTone(statusTone)}
              type={statusType}
            />
          ) : null}
          {onReferenceClick ? (
            <button
              type="button"
              className="application-overview-related-reference is-link"
              onClick={onReferenceClick}
            >
              {referenceNo}
            </button>
          ) : (
            <span className="application-overview-related-reference">
              {referenceNo}
            </span>
          )}
        </div>
        <div className="application-overview-related-field-list">
          {fields.map((field, index) => (
            <div
              key={`${field.label}-${index}`}
              className="application-overview-related-field"
            >
              <div className="application-overview-related-field-label">
                {field.label}
              </div>
              <Tooltip
                placement="topLeft"
                title={
                  variant === "relatedEnquiry" && index === 0 && field.value !== "-"
                    ? field.value
                    : null
                }
              >
                <div
                  className={`application-overview-related-field-value ${
                    variant === "relatedEnquiry" && index === 0
                      ? "is-clamped"
                      : ""
                  }`}
                >
                  {field.value}
                </div>
              </Tooltip>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
