export type LicenseDashboardTaskCardSourceType =
  | "application"
  | "profile"
  | "enquiry"
  | "refund"
  | "appeal";

interface LicenseDashboardTaskCardTitleSource {
  title?: string;
  applyFor?: string;
  referenceNumber?: string;
}

interface LicenseDashboardTaskCardAction {
  actionCode?: string | null;
  actionUrl?: string | null;
}

export const getLicenseDashboardTaskCardTitle = (
  sourceType: LicenseDashboardTaskCardSourceType | undefined,
  card: LicenseDashboardTaskCardTitleSource,
) => {
  if (sourceType === "profile") {
    return card.applyFor;
  }

  if (sourceType === "enquiry" || sourceType === "refund") {
    return card.referenceNumber;
  }

  return card.title;
};

export const getLicenseDashboardTaskCardSubtitle = (
  sourceType: LicenseDashboardTaskCardSourceType | undefined,
  card: LicenseDashboardTaskCardTitleSource,
) => (sourceType === "profile" ? card.title : card.applyFor);

export const getLicenseDashboardTaskCardActionTarget = (
  sourceType: LicenseDashboardTaskCardSourceType | undefined,
  sourceId: string | undefined,
  actions?: LicenseDashboardTaskCardAction[] | null,
) => {
  if (sourceType === "refund") {
    return sourceId ? `/refunds/${sourceId}` : undefined;
  }

  const openAction = (actions || []).find((action) => {
    const actionCode = String(action?.actionCode || "").toLowerCase();

    return (
      actionCode === "open" ||
      actionCode === "view" ||
      actionCode === "message"
    );
  });

  return openAction?.actionUrl || undefined;
};
