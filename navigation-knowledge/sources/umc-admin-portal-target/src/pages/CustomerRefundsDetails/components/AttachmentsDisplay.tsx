import React from "react";
import RefundAttachments from "@/pages/CustomerRefunds/components/RefundAttachments";
import type { RefundAttachment } from "@/pages/CustomerRefunds/types";

interface AttachmentsDisplayProps {
  attachments: RefundAttachment[];
  label?: string;
  className?: string;
  compact?: boolean;
  variant?:
    | "default"
    | "applicationInfo"
    | "communication"
    | "composer"
    | "decision";
  onDelete?: (attachmentId: string) => void;
}

const AttachmentsDisplay: React.FC<AttachmentsDisplayProps> = ({
  attachments,
  label,
  className,
  compact = false,
  variant = "default",
  onDelete,
}) => {
  return (
    <div className={`refund-attachments-display ${className ?? ""}`}>
      {label ? (
        <div className="refund-attachments-display-label">{label}</div>
      ) : null}
      <RefundAttachments
        attachments={attachments}
        compact={compact}
        variant={variant}
        onDelete={onDelete}
      />
    </div>
  );
};

export default AttachmentsDisplay;
