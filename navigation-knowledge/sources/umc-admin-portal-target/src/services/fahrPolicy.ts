import type {
  FahrExternalApprovalEligibility,
  FahrExternalReviewReadiness,
} from "./fahr";

export const shouldLoadFahrApplicationStatus = (
  eligibility?: FahrExternalApprovalEligibility | null,
) =>
  eligibility?.requiresExternalApproval === true &&
  eligibility.status !== "NotRequired";

export type FahrExternalApprovalRoute =
  | "legacyDialog"
  | "fahrDialog"
  | "direct"
  | "blocked";

export type FahrExternalDecisionRoute = "workflow" | "external" | "blocked";

export function resolveFahrExternalApprovalRoute(
  isFahrService: boolean,
  eligibility: FahrExternalApprovalEligibility | null | undefined,
): FahrExternalApprovalRoute {
  if (!isFahrService) return "legacyDialog";
  if (!eligibility) return "blocked";
  if (!shouldLoadFahrApplicationStatus(eligibility)) return "legacyDialog";
  if (eligibility.status !== "Eligible" || eligibility.eligible !== true) {
    return "blocked";
  }
  if (
    eligibility.requiresPersonSelection ||
    eligibility.showExternalApprovalDialog
  ) {
    return "fahrDialog";
  }
  return eligibility.requiresExternalApproval ? "direct" : "blocked";
}

export function resolveFahrExternalDecisionRoute(
  eligibility: FahrExternalApprovalEligibility | null | undefined,
  readiness: FahrExternalReviewReadiness | null | undefined,
  intent: "approve" | "reject",
): FahrExternalDecisionRoute {
  if (!shouldLoadFahrApplicationStatus(eligibility)) return "workflow";
  if (eligibility?.status !== "Eligible" || eligibility.eligible !== true) {
    return "blocked";
  }
  const expectedAction = intent === "approve" ? "Approve" : "Reject";
  return readiness?.externalReviewAction === expectedAction
    ? "external"
    : "blocked";
}

export function getFahrExternalDecisionDisabledReason(
  readiness: FahrExternalReviewReadiness | null | undefined,
) {
  return readiness?.disabledReason?.trim() || null;
}

export function getFahrRejectReasonFile(
  value?: string | string[] | null,
): string | undefined {
  const files = Array.isArray(value) ? value : value?.split(";");
  return files?.map((item) => item.trim()).find(Boolean);
}
