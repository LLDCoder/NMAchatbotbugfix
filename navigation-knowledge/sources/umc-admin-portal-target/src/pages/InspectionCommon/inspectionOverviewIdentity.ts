export type InspectionOverviewIdentity = {
  field: "emiratesId" | "passportNumber" | "uid";
  labelKey:
    | "applicationOverviewCards.emiratesId"
    | "applicationOverviewCards.passport"
    | "applicationOverviewCards.uid";
  value: string;
};

const IDENTITY_FIELDS = [
  ["emiratesId", "applicationOverviewCards.emiratesId"],
  ["passportNumber", "applicationOverviewCards.passport"],
  ["uid", "applicationOverviewCards.uid"],
] as const;

export const resolveInspectionOverviewIdentity = (
  profile?: {
    emiratesId?: string | null;
    passportNumber?: string | null;
    uid?: string | null;
  } | null,
): InspectionOverviewIdentity | null => {
  for (const [field, labelKey] of IDENTITY_FIELDS) {
    const value = String(profile?.[field] ?? "").trim();
    if (value) return { field, labelKey, value };
  }

  return null;
};
