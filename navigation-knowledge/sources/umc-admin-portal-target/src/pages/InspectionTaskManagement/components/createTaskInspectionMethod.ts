export type EstablishmentLookupInspectionCode = 'digital_inspection' | 'field_inspection';

export const getInspectionMethodFromLookupInspection = (
  inspection?: EstablishmentLookupInspectionCode | null | string,
) => {
  if (inspection === 'digital_inspection') return 'Digital Inspection';
  if (inspection === 'field_inspection') return 'Field Inspection';
  return undefined;
};

