export interface MobileNumberSchemaFieldNames {
  fullNumber: string;
  countryCode: string;
  localNumber: string;
}

export interface MobileNumberSchemaFieldOverrides {
  countryCodeFieldName?: string;
  localNumberFieldName?: string;
}

export const resolveMobileNumberSchemaFieldNames = (
  fullNumberFieldName: string,
  overrides?: MobileNumberSchemaFieldOverrides,
): MobileNumberSchemaFieldNames => ({
  fullNumber: fullNumberFieldName,
  countryCode:
    overrides?.countryCodeFieldName || `${fullNumberFieldName}CountryCode`,
  localNumber:
    overrides?.localNumberFieldName || `${fullNumberFieldName}LocalNumber`,
});
