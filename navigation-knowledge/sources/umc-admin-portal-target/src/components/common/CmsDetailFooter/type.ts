export interface CmsDetailFooterProps {
  /** Status display name, e.g. statusInfo.name ("Pending Review" / "Published" ...) */
  status?: string;
  /** Route path used for button-level permission checks, e.g. "/cms/NewsManagement" */
  routePath: string;
  /** Permission code gating the review actions (Approve / Reject). Empty = always visible. */
  approvePermissionCode?: string;
  rejectPermissionCode?: string;
  deletePermissionCode?: string;
  unpublishPermissionCode?: string;
  /** Whether the module has a Scheduled status (News/Event = true, Job = false). */
  supportsScheduled?: boolean;
  onBack: () => void;
  onPreview?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onUnpublish?: () => void;
  onDuplicate?: () => void;
}
