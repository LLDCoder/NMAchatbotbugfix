import { inspectionFigmaAssets } from './assets';

type InspectionTargetIconRecord = {
  inspectionTarget?: {
    targetType?: number | string | null;
    targetTypeCode?: string | null;
    targetTypeName?: string | null;
    targetTypeNameEn?: string | null;
  } | null;
};

const GOVERNMENT_TARGET_KEYWORDS = ['government', 'embassy', 'consulate', 'cultural'];

export const getInspectionTargetIcon = (record?: InspectionTargetIconRecord) => {
  const target = record?.inspectionTarget;
  const targetTypeCode = target?.targetTypeCode?.trim().toLowerCase();
  const targetTypeName = `${target?.targetTypeName || ''} ${target?.targetTypeNameEn || ''}`.toLowerCase();

  if (targetTypeCode === 'individual' || Number(target?.targetType) === 2 || targetTypeName.includes('individual')) {
    return inspectionFigmaAssets.taskTargetIcons.user;
  }

  if (GOVERNMENT_TARGET_KEYWORDS.some((keyword) => targetTypeName.includes(keyword))) {
    return inspectionFigmaAssets.taskTargetIcons.government;
  }

  return inspectionFigmaAssets.taskTargetIcons.company;
};
