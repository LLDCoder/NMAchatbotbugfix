import { formatIcpDate } from "@/components/designable/src/components/IDSelector/idSelectorUtils";
import type { PartnerItem } from "@/components/designable/src/components/PartnerList/PartnerListField";
import type { IEstablishmentPartner } from "@/services/userProfile";
type OwnerPartnerSource = IEstablishmentPartner &
  Pick<
    PartnerItem,
    "representativeNameEn" | "representativeNameAr" | "representativeEmiratesId"
  >;

export const PARTNER_MANAGEMENT_SERVICE_CODES = new Set(["804", "905", "1205"]);

type VerificationType = "emiratesId" | "uid" | "passport";

const firstFilledValue = <T,>(
  ...values: Array<T | null | undefined>
): T | undefined => {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string" && !value.trim()) {
      continue;
    }

    return value;
  }

  return undefined;
};

const normalizePartnerType = (
  partner: IEstablishmentPartner,
): PartnerItem["partnerType"] => {
  const partnerTypeName = String(
    partner.partnerType ?? partner.partnerTypeName ?? "",
  )
    .trim()
    .toLowerCase();

  if (partnerTypeName === "company") {
    return "company";
  }

  return String(partner.partnerTypeCode ?? "").trim() === "1"
    ? "company"
    : "individual";
};

const normalizeVerificationType = (
  value: unknown,
): VerificationType | undefined => {
  const normalizedValue = String(value ?? "").trim().toLowerCase();

  if (normalizedValue === "uid" || normalizedValue === "2") {
    return "uid";
  }

  if (normalizedValue === "passport" || normalizedValue === "3") {
    return "passport";
  }

  if (normalizedValue === "emiratesid" || normalizedValue === "1") {
    return "emiratesId";
  }

  return undefined;
};

const inferVerificationType = (
  partner: IEstablishmentPartner,
): VerificationType => {
  if (String(partner.emiratesId ?? "").trim()) {
    return "emiratesId";
  }

  if (firstFilledValue(partner.uid, partner.uaeNumber)) {
    return "uid";
  }

  if (String(partner.passportNumber ?? "").trim()) {
    return "passport";
  }

  return "emiratesId";
};

const resolveVerificationType = (
  partner: IEstablishmentPartner,
): VerificationType =>
  normalizeVerificationType(partner.type) ??
  normalizeVerificationType(partner.verificationMethodCode) ??
  inferVerificationType(partner);

const normalizeGender = (value: unknown): string | undefined => {
  if (value === 1 || String(value) === "1") {
    return "male";
  }

  if (value === 2 || String(value) === "2") {
    return "female";
  }

  return typeof value === "string" ? value : undefined;
};

const mapOwnerPartner = (partner: OwnerPartnerSource): PartnerItem | null => {
  const id = String(partner.id ?? "").trim();

  if (!id) {
    return null;
  }

  const partnerType = normalizePartnerType(partner);

  if (partnerType === "company") {
    return {
      id,
      isOwner: true,
      partnerType,
      partnerTypeCode: partner.partnerTypeCode ?? undefined,
      nationality: firstFilledValue(partner.nationality, partner.nationalityId),
      establishmentNameArabic: firstFilledValue(
        partner.establishmentNameArabic,
        partner.fullNameAr,
      ),
      establishmentNameEnglish: firstFilledValue(
        partner.establishmentNameEnglish,
        partner.fullNameEn,
      ),
      representativeNameEn: firstFilledValue(partner.representativeNameEn) ?? null,
      representativeNameAr: firstFilledValue(partner.representativeNameAr) ?? null,
      representativeEmiratesId: firstFilledValue(partner.representativeEmiratesId) ?? null,
      memorandumOfAssociation: firstFilledValue(
        partner.memorandumOfAssociation,
        partner.memorandumOfAssociationUrl,
      ),
      powerOfAttorney: firstFilledValue(
        partner.powerOfAttorney,
        partner.powerOfAttorneyUrl,
      ),
      statement: firstFilledValue(partner.statement, partner.statementUrl),
    };
  }

  return {
    id,
    isOwner: true,
    representativeNameEn: null,
    representativeNameAr: null,
    representativeEmiratesId: null,
    partnerType,
    partnerTypeCode: partner.partnerTypeCode ?? undefined,
    type: resolveVerificationType(partner),
    dateOfBirth: formatIcpDate(
      firstFilledValue(partner.dateOfBirth, partner.dateBirth),
    ),
    emiratesId: firstFilledValue(partner.emiratesId),
    uid: firstFilledValue(partner.uid, partner.uaeNumber),
    passportNumber: firstFilledValue(partner.passportNumber),
    fullNameArabic: firstFilledValue(partner.fullNameArabic, partner.fullNameAr),
    fullNameEnglish: firstFilledValue(partner.fullNameEnglish, partner.fullNameEn),
    nationality: firstFilledValue(partner.nationality, partner.nationalityId),
    gender:
      typeof partner.gender === "string"
        ? partner.gender
        : partner.genderId != null
          ? normalizeGender(partner.genderId)
          : undefined,
    occupation: firstFilledValue(partner.occupation),
    emiratesIdexpiryDate: formatIcpDate(
      firstFilledValue(
        partner.emiratesIdexpiryDate,
        partner.emiratesIdExpiryDate,
        partner.expiryDate,
      ),
    ),
    passportExpiryDate: formatIcpDate(
      firstFilledValue(partner.passportExpiryDate),
    ),
    visaExpiryDate: formatIcpDate(firstFilledValue(partner.visaExpiryDate)),
    PersonalPhoto: firstFilledValue(
      partner.personalPhoto,
      partner.personalPhotoUrl,
      partner.photoUrl,
    ),
    EmiratesID: firstFilledValue(
      partner.emiratesIdFile,
      partner.emiratesIdUrl,
      partner.emiratesIdurl,
    ),
    Passport: firstFilledValue(partner.passport, partner.passportUrl),
    Visa: firstFilledValue(partner.visaUrl),
    PassportScan: firstFilledValue(partner.passportScan, partner.passportScanUrl),
  };
};

export const resolvePartnerManagementOwnerPartners = (
  partners: OwnerPartnerSource[] | null | undefined,
): PartnerItem[] => {
  const establishmentPartners = Array.isArray(partners) ? partners : [];

  return establishmentPartners
    .filter((partner) => partner?.isOwner === true)
    .map(mapOwnerPartner)
    .filter((partner): partner is PartnerItem => partner != null);
};
