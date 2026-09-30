import type {
  FahrReviewRequestDetails,
  FahrReviewTarget,
} from "@/services/fahr";

export function findFahrTargetByPersonType(
  reviewDetails: FahrReviewRequestDetails | null | undefined,
  personType: string,
): FahrReviewTarget | undefined {
  return reviewDetails?.targets?.find(
    (target) => target.personType === personType,
  );
}

const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";

export function findFahrTargetForPartner(
  reviewDetails: FahrReviewRequestDetails | null | undefined,
  personType: string,
  partner: unknown,
): FahrReviewTarget | undefined {
  if (!partner || typeof partner !== "object" || Array.isArray(partner)) {
    return undefined;
  }

  const partnerRecord = partner as Record<string, unknown>;
  const candidates = (reviewDetails?.targets || []).filter(
    (target) => target.personType === personType,
  );
  const partnerId = text(partnerRecord.id);
  return partnerId
    ? candidates.find((item) => text(item.personRefId) === partnerId)
    : undefined;
}

export function matchFahrTargetsForPartners(
  reviewDetails: FahrReviewRequestDetails | null | undefined,
  personType: string,
  partners: unknown[],
): Array<FahrReviewTarget | undefined> {
  return partners.map((partner) =>
    findFahrTargetForPartner(reviewDetails, personType, partner),
  );
}
