export const COMMERCIAL_SUBTYPE_KEYWORDS = [
  /\bcommercial\s*entity\b/,
  /\bfree[\s-]*zone\b/,
  /\badvertising\s*\/\s*talent\s*agency\b/,
  /\btalent\s*agency\b/,
  /\bshipping\s*company\s*\/\s*clearing\s*agency\b/,
  /\bshipping\s*company\b/,
  /\bclearing\s*agency\b/,
];

export const COMMERCIAL_SUBTYPE_IDS = new Set([2, 5, 20, 27]);
export const COMMERCIAL_SUBTYPE_CODES = new Set(["2", "5", "7", "12"]);

export const GOVERNMENT_SUBTYPE_IDS = new Set([3, 4, 31, 32, 33]);
export const GOVERNMENT_SUBTYPE_CODES = new Set(["3", "4", "13", "14", "15"]);
export const EGAMING_SUBTYPE_IDS = new Set([34]);
export const EGAMING_SUBTYPE_CODES = new Set(["17"]);

export const ESTABLISHMENT_GOVERNMENT_NAME_KEYWORDS = [
  "government entity",
  "non-profit organization",
  "non profit organization",
  "embassy",
  "consulate",
  "cultural club",
];

export const ESTABLISHMENT_SUBTYPE_ARABIC_KEYWORDS = {
  commercialEntity: ["كيان", "تجاري"],
  freeZone: ["منطقة حرة", "المنطقة الحرة"],
  talentAgency: ["وكالة مواهب"],
  shippingClearingAgency: ["شركة شحن", "وكالة تخليص", "تخليص"],
  embassy: ["سفارة"],
  consulate: ["قنصل"],
  culturalClub: ["نادي ثقافي", "نوادي ثقافية", "أندية ثقافية"],
  government: ["حكوم"],
  nonProfit: ["غير ربحي", "غير ربحية"],
} as const;
