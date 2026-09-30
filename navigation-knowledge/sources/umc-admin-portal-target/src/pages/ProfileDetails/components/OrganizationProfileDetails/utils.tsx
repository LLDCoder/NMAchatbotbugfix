import type {
  EstablishmentInfo,
  EstablishmentInfoDto,
  PartnerInfo,
  UserProfileAddressInfoDto,
} from "@/services/userManagement";
import type { InfoItem, ViewType } from "../../type";
import {
  formatDate,
  getEstablishmentSubTypeLabel,
  getValueObjectName,
  normalizeText,
  resolveProfileViewByUserTypeId,
  safeText,
} from "../../utils";
import {
  COMMERCIAL_SUBTYPE_KEYWORDS,
  COMMERCIAL_SUBTYPE_CODES,
  COMMERCIAL_SUBTYPE_IDS,
  EGAMING_SUBTYPE_CODES,
  EGAMING_SUBTYPE_IDS,
  ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS,
  ESTABLISHMENT_GOVERNMENT_NAME_KEYWORDS,
  GOVERNMENT_SUBTYPE_CODES,
  GOVERNMENT_SUBTYPE_IDS,
} from "./constants";
import type { PartnerItem } from "./type";

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const isCommercialUserTypeForProfile = (
  userTypeId?: number | null,
): boolean => resolveProfileViewByUserTypeId(userTypeId) === "commercial";

export const isCommercialStyleEstablishmentSubType = (
  establishment?: EstablishmentInfo | null,
): boolean => {
  if (
    isSubTypeInGroup(
      establishment,
      COMMERCIAL_SUBTYPE_IDS,
      COMMERCIAL_SUBTYPE_CODES,
    )
  ) {
    return true;
  }

  const nameEn = normalizeText(establishment?.establishmentTypeObj?.nameEn);
  const nameAr = establishment?.establishmentTypeObj?.nameAr ?? "";

  return (
    COMMERCIAL_SUBTYPE_KEYWORDS.some((keyword) => keyword.test(nameEn)) ||
    /\bfreezone\b/.test(nameEn.replace(/\s/g, "")) ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.commercialEntity.every((keyword) =>
      nameAr.includes(keyword),
    ) ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.freeZone.some((keyword) =>
      nameAr.includes(keyword),
    ) ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.talentAgency.some((keyword) =>
      nameAr.includes(keyword),
    ) ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.shippingClearingAgency.some((keyword) =>
      nameAr.includes(keyword),
    )
  );
};

export const isEstablishmentStyleGovernmentSubType = (
  establishment?: EstablishmentInfo | null,
): boolean => {
  if (
    isSubTypeInGroup(
      establishment,
      GOVERNMENT_SUBTYPE_IDS,
      GOVERNMENT_SUBTYPE_CODES,
    )
  ) {
    return true;
  }

  const nameEn = normalizeText(establishment?.establishmentTypeObj?.nameEn);
  const nameAr = establishment?.establishmentTypeObj?.nameAr ?? "";

  return (
    ESTABLISHMENT_GOVERNMENT_NAME_KEYWORDS.some((keyword) =>
      nameEn.includes(keyword),
    ) ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.embassy.some((keyword) =>
      nameAr.includes(keyword),
    ) ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.consulate.some((keyword) =>
      nameAr.includes(keyword),
    ) ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.culturalClub.some((keyword) =>
      nameAr.includes(keyword),
    ) ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.government.some((keyword) =>
      nameAr.includes(keyword),
    ) ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.nonProfit.some((keyword) =>
      nameAr.includes(keyword),
    )
  );
};

const isSubTypeInGroup = (
  establishment: EstablishmentInfo | null | undefined,
  groupIds: Set<number>,
  groupCodes: Set<string>,
): boolean => {
  const subTypeId = establishment?.establishmentTypeId;
  if (
    subTypeId !== null &&
    subTypeId !== undefined &&
    groupIds.has(Number(subTypeId))
  ) {
    return true;
  }

  const subTypeCode = String(
    establishment?.establishmentTypeObj?.code ?? "",
  ).trim();
  return subTypeCode.length > 0 && groupCodes.has(subTypeCode);
};

const buildPhoneDisplay = (establishment?: EstablishmentInfo | null) => {
  const countryCode = String(establishment?.phoneCountryCode ?? "").trim();
  const localNumber = String(establishment?.phoneLocalNumber ?? "").trim();

  if (localNumber) {
    return safeText(`${countryCode}${localNumber}`);
  }

  return safeText(establishment?.phoneNumber || establishment?.personalMobile);
};

const getLocalizedAuthorityName = (
  establishment?: EstablishmentInfo | null,
  preferAr = false,
) => {
  const authorityNameEn = establishment?.authorityIdNameEn?.trim();
  const authorityNameAr = establishment?.authorityIdNameAr?.trim();
  const authorityName = preferAr
    ? authorityNameAr || authorityNameEn
    : authorityNameEn || authorityNameAr;

  return authorityName || getValueObjectName(
    establishment?.licensingAutharityObj,
    preferAr,
  );
};

const resolveEstablishmentInfoGroup = (
  establishment: EstablishmentInfo | null | undefined,
  currentView?: string,
): "commercial" | "government" | "egaming" => {
  if (isSubTypeInGroup(establishment, EGAMING_SUBTYPE_IDS, EGAMING_SUBTYPE_CODES)) {
    return "egaming";
  }

  if (
    isSubTypeInGroup(
      establishment,
      COMMERCIAL_SUBTYPE_IDS,
      COMMERCIAL_SUBTYPE_CODES,
    )
  ) {
    return "commercial";
  }

  if (
    isSubTypeInGroup(
      establishment,
      GOVERNMENT_SUBTYPE_IDS,
      GOVERNMENT_SUBTYPE_CODES,
    )
  ) {
    return "government";
  }

  if (isCommercialStyleEstablishmentSubType(establishment)) {
    return "commercial";
  }

  if (isEstablishmentStyleGovernmentSubType(establishment)) {
    return "government";
  }

  if (currentView === "egaming") return "egaming";
  return currentView === "government" ? "government" : "commercial";
};
export const resolveEstablishmentProfileView = (
  establishment: EstablishmentInfo | null | undefined,
  userTypeId?: number | null,
): Exclude<ViewType, "individual"> => {
  if (resolveProfileViewByUserTypeId(userTypeId) === "egaming") {
    return "egaming";
  }

  return resolveEstablishmentInfoGroup(establishment);
};


const getEstablishmentSubTypeTranslationKey = (
  establishment?: EstablishmentInfo | null,
) => {
  const nameEn = normalizeText(establishment?.establishmentTypeObj?.nameEn);
  const nameAr = establishment?.establishmentTypeObj?.nameAr ?? "";

  if (
    /\bcommercial\s*entity\b/.test(nameEn) ||
    nameEn.includes("commercial") ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.commercialEntity.every((keyword) =>
      nameAr.includes(keyword),
    )
  ) {
    return "Profile.stats.commercial";
  }
  if (
    /\bfree[\s-]*zone\b/.test(nameEn) ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.freeZone.some((keyword) =>
      nameAr.includes(keyword),
    )
  ) {
    return "Profile.stats.freeZone";
  }
  if (
    nameEn.includes("talent agency") ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.talentAgency.some((keyword) =>
      nameAr.includes(keyword),
    )
  ) {
    return "Profile.stats.talentAgency";
  }
  if (
    nameEn.includes("embassy") ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.embassy.some((keyword) =>
      nameAr.includes(keyword),
    )
  ) {
    return "Profile.stats.embassy";
  }
  if (
    nameEn.includes("consulate") ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.consulate.some((keyword) =>
      nameAr.includes(keyword),
    )
  ) {
    return "Profile.stats.consulate";
  }
  if (
    nameEn.includes("cultural club") ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.culturalClub.some((keyword) =>
      nameAr.includes(keyword),
    )
  ) {
    return "Profile.stats.culturalClubs";
  }
  if (
    nameEn.includes("government") ||
    ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS.government.some((keyword) =>
      nameAr.includes(keyword),
    )
  ) {
    return "Profile.stats.government";
  }

  return undefined;
};

export const getLocalizedEstablishmentSubTypeLabel = (
  establishment?: EstablishmentInfo | null,
  preferAr?: boolean,
  t?: Translate,
) => {
  const translate = t || ((key: string) => key);
  const translationKey = getEstablishmentSubTypeTranslationKey(establishment);

  if (translationKey) {
    return translate(translationKey);
  }

  return getEstablishmentSubTypeLabel(establishment, preferAr);
};

export const buildOrganizationAddressItems = (
  addressInfo?: UserProfileAddressInfoDto | null,
  t?: Translate,
  preferAr = false,
): InfoItem[] => {
  const translate = t || ((key: string) => key);

  return [
    {
      key: "emirate",
      label: translate("Profile.details.address.emirate"),
      value: getValueObjectName(addressInfo?.emirateObj, preferAr),
    },
    {
      key: "region",
      label: translate("Profile.details.address.region"),
      value: getValueObjectName(addressInfo?.regionObj, preferAr),
    },
    {
      key: "area",
      label: translate("Profile.details.address.area"),
      value: getValueObjectName(addressInfo?.areaObj, preferAr),
    },
    {
      key: "street",
      label: translate("Profile.details.address.street"),
      value: getValueObjectName(addressInfo?.streetObj, preferAr),
      fullWidth: true,
    },
  ];
};

export const buildEstablishmentInfoItems = (
  establishment?: EstablishmentInfo | null,
  currentView?: string,
  t?: Translate,
  preferAr = false,
): InfoItem[] => {
  const translate = t || ((key: string) => key);
  const establishmentSubTypeItem: InfoItem = {
    key: "establishment-sub-type",
    label: translate("Profile.details.establishment.subTypes"),
    value: getLocalizedEstablishmentSubTypeLabel(
      establishment,
      preferAr,
      translate,
    ),
    fullWidth: true,
  };
  const infoGroup = resolveEstablishmentInfoGroup(establishment, currentView);

  if (infoGroup === "egaming") {
    return [
      establishmentSubTypeItem,
      {
        key: "establishment-name-en",
        label: translate("Profile.details.establishment.establishmentNameEn"),
        value: safeText(establishment?.nameEn),
      },
      {
        key: "work-email",
        label: translate("Profile.details.establishment.workEmail"),
        value: safeText(establishment?.workEmail),
      },
      {
        key: "phone-number",
        label: translate("Profile.details.establishment.phoneNumber"),
        value: buildPhoneDisplay(establishment),
      },
    ];
  }

  if (infoGroup === "commercial") {
    return [
      establishmentSubTypeItem,
      {
        key: "work-email",
        label: translate("Profile.details.establishment.workEmail"),
        value: safeText(establishment?.workEmail),
      },
      {
        key: "commercial-license-number",
        label: translate("Profile.details.establishment.commercialLicenseNumber"),
        value: safeText(establishment?.licenseNumber),
      },
      {
        key: "license-expiry-date",
        label: translate("Profile.details.establishment.licenseExpiryDate"),
        value: formatDate(establishment?.licenseExpiryDate),
      },
      {
        key: "establishment-name-ar",
        label: translate("Profile.details.establishment.establishmentNameAr"),
        value: safeText(establishment?.nameAr),
        valueClassName: "info-arabic",
      },
      {
        key: "establishment-name-en",
        label: translate("Profile.details.establishment.establishmentNameEn"),
        value: safeText(establishment?.nameEn),
      },
      {
        key: "emirate",
        label: translate("Profile.details.address.emirate"),
        value: getValueObjectName(establishment?.emirateObj, preferAr),
      },
      {
        key: "licensing-authority",
        label: translate("Profile.details.establishment.licensingAuthority"),
        value: getLocalizedAuthorityName(establishment, preferAr),
      },
      {
        key: "phone-number",
        label: translate("Profile.details.establishment.phoneNumber"),
        value: buildPhoneDisplay(establishment),
      },
      {
        key: "tenancy-contract-end-date",
        label: translate("Profile.details.establishment.tenancyContractEndDate"),
        value: formatDate(establishment?.tenancyContractEndDate),
      },
    ];
  }

  return [
    establishmentSubTypeItem,
    {
      key: "work-email",
      label: translate("Profile.details.establishment.workEmail"),
      value: safeText(establishment?.workEmail),
    },
    {
      key: "establishment-name-ar",
      label: translate("Profile.details.establishment.entityEstablishmentNameAr"),
      value: safeText(establishment?.nameAr),
      valueClassName: "info-arabic",
    },
    {
      key: "establishment-name-en",
      label: translate("Profile.details.establishment.entityEstablishmentNameEn"),
      value: safeText(establishment?.nameEn),
    },
    {
      key: "emirate",
      label: translate("Profile.details.address.emirate"),
      value: getValueObjectName(establishment?.emirateObj, preferAr),
    },
    {
      key: "phone-number",
      label: translate("Profile.details.establishment.phoneNumber"),
      value: buildPhoneDisplay(establishment),
    },
  ];
};

export const buildPartnerList = (
  partnerList?: PartnerInfo[] | null,
  i18n?: { language?: string },
): PartnerItem[] => {
  if (!partnerList || !Array.isArray(partnerList)) return [];
  const preferAr = i18n?.language?.startsWith("ar") === true;
  return partnerList.map((partner) => {
    const avatar =
      partner.photoUrl && partner.photoUrl.trim()
        ? partner.photoUrl
        : undefined;
    const partnerTypeName = normalizeText(
      partner.partnerTypeName ||
        (preferAr
          ? partner.partnerTypeCodeInfo?.nameAr || partner.partnerTypeCodeInfo?.nameEn
          : partner.partnerTypeCodeInfo?.nameEn || partner.partnerTypeCodeInfo?.nameAr),
    );
    const nationalityName = normalizeText(
      partner.nationalityName ||
        (preferAr
          ? partner.nationalityIdInfo?.nameAr || partner.nationalityIdInfo?.nameEn
          : partner.nationalityIdInfo?.nameEn || partner.nationalityIdInfo?.nameAr),
    );
    return {
      id: partner.id,
      key: String(partner.id),
      name: safeText(
        preferAr ? partner.fullNameAr : partner.fullNameEn,
      ),
      identifier: safeText(
        partner.emiratesId || partner.uaeNumber || partner.passportNumber || String(partner.id),
      ),
      location:
        (preferAr
          ? partner?.emirateObj?.nameAr || partner?.emirateObj?.nameEn
          : partner?.emirateObj?.nameEn || partner?.emirateObj?.nameAr) ?? "-",
      partnerTypeName,
      partnerTypeCode: normalizeText(partner.partnerTypeCode),
      nationalityName,
      emirateObj: partner.emirateObj,
      isOwner: partner.isOwner === true,
      avatar,
      representativeNameEn: partner.representativeNameEn ?? null,
      representativeNameAr: partner.representativeNameAr ?? null,
      representativeEmiratesId: partner.representativeEmiratesId ?? null,
    };
  });
};

export const getEstablishmentApplicationTitle = (
  currentView: ViewType,
  establishmentData: EstablishmentInfoDto | null,
  language: string | undefined,
  t: Translate,
) => {
  const preferAr = language?.startsWith("ar");
  const subTypeRaw = getLocalizedEstablishmentSubTypeLabel(
    establishmentData?.establishment,
    preferAr,
    t,
  );
  if (subTypeRaw) {
    return t("Profile.details.summary.applicationWithType", {
      type: subTypeRaw,
    });
  }


  return currentView === "government"
    ? t("Profile.details.summary.governmentApplication")
    : t("Profile.details.summary.commercialApplication");
};

export const getEstablishmentOverviewSectionTitle = (
  currentView: ViewType,
  establishmentData: EstablishmentInfoDto | null,
  t: Translate,
) => {
  const establishmentTitle = () =>
    t("Profile.details.section.establishmentInformation");

  if (currentView !== "government") {
    return establishmentTitle();
  }

  const userTypeId = establishmentData?.userTypeId;
  if (isCommercialUserTypeForProfile(userTypeId)) {
    return establishmentTitle();
  }
  if (isCommercialStyleEstablishmentSubType(establishmentData?.establishment)) {
    return establishmentTitle();
  }
  if (isEstablishmentStyleGovernmentSubType(establishmentData?.establishment)) {
    return establishmentTitle();
  }

  return establishmentTitle();
};
