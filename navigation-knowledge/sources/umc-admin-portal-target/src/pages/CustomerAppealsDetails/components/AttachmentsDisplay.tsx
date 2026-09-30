import React from "react";
import AppealAttachments from "@/pages/CustomerAppeals/components/AppealAttachments";
import type { AppealAttachment } from "@/pages/CustomerAppeals/types";

interface AttachmentsDisplayProps {
  attachments: AppealAttachment[];
  label?: string;
  variant?: "applicationInfo" | "communication" | "decision";
  className?: string;
  compact?: boolean;
}

const AttachmentsDisplay: React.FC<AttachmentsDisplayProps> = ({
  attachments,
  label,
  variant = "applicationInfo",
  className = "",
  compact = variant !== "applicationInfo",
}) => (
  <div className={`appeal-attachments-display ${className}`.trim()}>
    {label ? <div className="appeal-attachments-display__label">{label}</div> : null}
    <AppealAttachments
      attachments={attachments}
      variant={variant}
      compact={compact}
    />
  </div>
);

export default AttachmentsDisplay;
