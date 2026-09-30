import moment from "moment";

import type {
  FahrInteractionLog,
  FahrLocalizedLabel,
  FahrMilestoneStatus,
  FahrPersonStatus,
  FahrReviewTarget,
} from "@/services/fahr";
import i18n from "@/localization/config";

const tr = (key: string) => i18n.t(`Licensing.fahrReview.${key}`);

export type FahrReviewStatusTone =
  | "success"
  | "warning"
  | "error"
  | "neutral";

export type FahrReviewAction =
  | "applyTransaction"
  | "unapplyTransaction"
  | "cancelTransaction"
  | "resubmitApplication"
  | "submitReconsideration";

const allowedActionMap: Record<string, FahrReviewAction> = {
  SubmitRfiResponse: "resubmitApplication",
  ApplyReconsider: "submitReconsideration",
  CancelApplication: "cancelTransaction",
  ApplyTransaction: "applyTransaction",
  UnapplyTransaction: "unapplyTransaction",
};

export interface FahrReviewTimelineAction {
  action: FahrReviewAction;
  label: string;
  variant: "primary" | "danger-outline";
  disabled?: boolean;
}

export interface FahrReviewTimelineAttachment {
  label: string;
  count: number;
  files?: Array<{ fileName: string; fileKey: string; fileSize: number }>;
}

export interface FahrReviewTimelineItem {
  id?: string | number;
  title: string;
  dateTime: string;
  status?: string;
  statusTone?: FahrReviewStatusTone;
  active?: boolean;
  description?: string;
  attachment?: FahrReviewTimelineAttachment;
  actions?: FahrReviewTimelineAction[];
}

export function getFahrActionForAllowedAction(
  value: string,
): FahrReviewAction | undefined {
  return allowedActionMap[value];
}

const formatDateTime = (value?: string | null): string => {
  if (!value?.trim()) return "-";
  const dateTime = moment(value);
  return dateTime.isValid() ? dateTime.format("DD/MM/YYYY HH:mm:ss") : value;
};

const localizedLabel = (
  label?: FahrLocalizedLabel | null,
  language?: string,
): string | undefined => {
  if (!label) return undefined;
  const isArabic = language?.toLowerCase().startsWith("ar");
  return isArabic ? label.ar || undefined : label.en || undefined;
};

const localizedDescription = (
  description: string | FahrLocalizedLabel | null | undefined,
  language?: string,
): string | undefined => {
  if (typeof description === "string") return description.trim() || undefined;
  return localizedLabel(description, language)?.trim() || undefined;
};

const statusPresentation = (
  status: FahrPersonStatus | FahrMilestoneStatus,
): Pick<FahrReviewTimelineItem, "status" | "statusTone"> => {
  const normalizedStatus = String(status).trim().toLowerCase();
  switch (normalizedStatus) {
    case "approved":
      return { status, statusTone: "success" };
    case "rejected":
      return { status, statusTone: "error" };
    case "pushfailed":
      return { status, statusTone: "error" };
    case "cancel":
    case "cancelled":
    case "revoked":
    case "received":
      return { status, statusTone: "neutral" };
    case "transactionapplied":
    case "approvetransactionapplied":
      return { status, statusTone: "success" };
    case "rfi":
    case "cancelrequested":
    case "revoke":
    case "submitted":
    case "transactionunapplied":
    case "unapplytransactionapplied":
    case "pending":
    default:
      return { status, statusTone: "warning" };
  }
};

const action = (
  value: FahrReviewAction,
  label: string,
  variant: FahrReviewTimelineAction["variant"] = "primary",
  disabled = false,
): FahrReviewTimelineAction => ({
  action: value,
  label,
  variant,
  disabled,
});

const getFahrActionLabel = (value: FahrReviewAction): string => {
  switch (value) {
    case "resubmitApplication":
      return tr("actions.submitRfiResponse");
    case "submitReconsideration":
      return tr("actions.applyReconsider");
    case "cancelTransaction":
      return tr("actions.cancelApplication");
    case "applyTransaction":
      return tr("actions.applyTransaction");
    case "unapplyTransaction":
      return tr("actions.unapplyTransaction");
  }
};

export function buildFahrActions(
  target: Pick<FahrReviewTarget, "status" | "allowedActions">,
): FahrReviewTimelineAction[] {
  return (target.allowedActions || []).flatMap((allowedAction) => {
    const resolvedAction = getFahrActionForAllowedAction(allowedAction);
    if (!resolvedAction) return [];
    return [
      action(
        resolvedAction,
        getFahrActionLabel(resolvedAction),
        resolvedAction === "cancelTransaction" ||
          resolvedAction === "unapplyTransaction"
          ? "danger-outline"
          : "primary",
      ),
    ];
  });
}

export function buildFahrInteractionTimeline(
  logs: FahrInteractionLog[] = [],
  target?: Pick<FahrReviewTarget, "status" | "statusReason">,
  language?: string,
): FahrReviewTimelineItem[] {
  const milestones = logs
    .filter((log) => log.isMilestone && log.milestone)
    .sort((left, right) =>
      String(right.createdAt || "").localeCompare(String(left.createdAt || "")),
    );

  const items = milestones.map<FahrReviewTimelineItem>((log, index) => {
    const milestone = log.milestone || log.action;
    const showsEmptyStatus =
      milestone === "Transaction Applied" ||
      milestone === "Transaction Unapplied" ||
      log.action === "TransactionApplied" ||
      log.action === "TransactionUnapplied";
    const displayStatus = showsEmptyStatus ? undefined : log.milestoneStatus;
    return {
      id: log.id,
      title:
        localizedLabel(log.milestoneLabel, language) ||
        (log.action === "DecisionReceived" && log.detail?.includes("code=4")
          ? "Decision Revoked"
          : milestone),
      dateTime: formatDateTime(log.createdAt),
      active: index === 0,
      ...(showsEmptyStatus
        ? {
            status: "-",
            statusTone: "neutral" as const,
          }
        : displayStatus
        ? {
            ...statusPresentation(displayStatus),
            status:
              localizedLabel(log.milestoneStatusLabel, language) ||
              displayStatus,
          }
        : {}),
      description:
        localizedDescription(log.description, language) ||
        log.note?.trim() ||
        undefined,
      ...(log.attachments?.length
        ? {
            attachment: {
              label: log.attachments[0].fileName,
              count: log.attachments.length,
              files: log.attachments,
            },
          }
        : {}),
    };
  });

  if (items[0] && target) {
    items[0].actions = buildFahrActions(target);
  }
  return items;
}

export function buildFahrReviewTimeline(
  target: Pick<
    FahrReviewTarget,
    "status" | "statusReason" | "createdAt" | "allowedActions"
  >,
): FahrReviewTimelineItem[] {
  return [
    {
      title: tr("timeline.registerRequest"),
      dateTime: formatDateTime(target.createdAt),
      active: true,
      ...statusPresentation(target.status),
      description:
        target.status === "PushFailed" ? target.statusReason || undefined : undefined,
      actions: buildFahrActions(target),
    },
  ];
}
