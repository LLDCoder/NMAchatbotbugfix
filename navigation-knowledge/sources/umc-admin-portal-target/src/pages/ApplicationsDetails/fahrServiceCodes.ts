export const FAHR_ESTABLISHMENT_PARTNER_SERVICE_CODES = [
  "901",
  "903",
  "8006",
] as const;

export const FAHR_EXTERNAL_APPROVAL_SERVICE_CODES = [
  "4",
  "801",
  "803",
  "804",
  "905",
  "1201",
  "1203",
  "1205",
  "1801",
  "1802",
  "8007",
  "80021",
  "8008",
  ...FAHR_ESTABLISHMENT_PARTNER_SERVICE_CODES,
] as const;

export const isFahrEstablishmentPartnerService = (
  serviceCode: string | number | null | undefined,
): boolean =>
  FAHR_ESTABLISHMENT_PARTNER_SERVICE_CODES.includes(
    String(
      serviceCode,
    ) as (typeof FAHR_ESTABLISHMENT_PARTNER_SERVICE_CODES)[number],
  );

export const isFahrExternalApprovalService = (
  serviceCode: string | number | null | undefined,
): boolean =>
  FAHR_EXTERNAL_APPROVAL_SERVICE_CODES.includes(
    String(
      serviceCode,
    ) as (typeof FAHR_EXTERNAL_APPROVAL_SERVICE_CODES)[number],
  );
