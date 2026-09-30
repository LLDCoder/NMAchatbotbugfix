export type InspectionLocationOption = {
  id: number;
  code?: string;
  nameEn: string;
  nameAr?: string;
  emirateId?: number;
  regionId?: number;
  requiresRegion?: boolean;
  establishmentCount?: number;
};

export type InspectionAreaSelection = {
  emirateIds: number[];
  regionIds: number[];
  areaIds: number[];
};

export type InspectionAssignedAreaNode = {
  emirateId: number;
  regionId?: number;
  communityId?: number;
};

type PruneInspectionAreaSelectionParams = InspectionAreaSelection & {
  emirates: InspectionLocationOption[];
  regions: InspectionLocationOption[];
  areas: InspectionLocationOption[];
};

type InspectionCampaignSelection = InspectionAreaSelection & {
  emirates: InspectionLocationOption[];
  activityIds: Array<number | string>;
};

const unique = <T,>(values: T[]) => Array.from(new Set(values));

export const requiresInspectionRegion = (
  emirates: InspectionLocationOption[],
  emirateIds: number[],
) => emirates.some(
  (emirate) => emirateIds.includes(emirate.id) && emirate.requiresRegion,
);

export const pruneInspectionAreaSelection = ({
  emirateIds,
  regionIds,
  areaIds,
  emirates,
  regions,
  areas,
}: PruneInspectionAreaSelectionParams): InspectionAreaSelection => {
  const nextEmirateIds = unique(emirateIds);
  const regionRequiredEmirateIds = new Set(
    emirates
      .filter((emirate) => emirate.requiresRegion && nextEmirateIds.includes(emirate.id))
      .map((emirate) => emirate.id),
  );
  const nextRegionIds = unique(regionIds).filter((regionId) => {
    const region = regions.find((item) => item.id === regionId);
    return Boolean(region?.emirateId && regionRequiredEmirateIds.has(region.emirateId));
  });
  const nextAreaIds = unique(areaIds).filter((areaId) => {
    const area = areas.find((item) => item.id === areaId);
    if (!area?.emirateId || !nextEmirateIds.includes(area.emirateId)) return false;
    const regionRequired = emirates.some(
      (emirate) => emirate.id === area.emirateId && emirate.requiresRegion,
    );
    return !area.regionId || !regionRequired || nextRegionIds.includes(area.regionId);
  });

  return {
    emirateIds: nextEmirateIds,
    regionIds: nextRegionIds,
    areaIds: nextAreaIds,
  };
};

export const isInspectionCampaignSelectionValid = ({
  emirates,
  emirateIds,
  regionIds,
}: InspectionCampaignSelection) => {
  if (!emirateIds.length) return false;
  return !requiresInspectionRegion(emirates, emirateIds) || regionIds.length > 0;
};

export const buildInspectionCampaignLocationPayload = ({
  emirateIds,
  regionIds,
  areaIds,
  activityIds,
}: Omit<InspectionCampaignSelection, "emirates">) => ({
  emirateIds: unique(emirateIds),
  regionIds: unique(regionIds),
  areaIds: unique(areaIds),
  activityIds: unique(activityIds),
});

export const buildInspectionCampaignRegionIds = ({
  emirates,
  regions,
  emirateIds,
  regionIds,
}: Pick<PruneInspectionAreaSelectionParams, "emirates" | "regions" | "emirateIds" | "regionIds">) => {
  const selectedEmirates = emirates.filter((emirate) => emirateIds.includes(emirate.id));
  if (!selectedEmirates.some((emirate) => emirate.requiresRegion)) {
    return unique(regionIds);
  }

  const technicalRegionIds = regions
    .filter((region) => selectedEmirates.some(
      (emirate) => !emirate.requiresRegion && emirate.id === region.emirateId,
    ))
    .map((region) => region.id);
  return unique([...regionIds, ...technicalRegionIds]);
};

export const buildInspectionAssignedAreaNodes = ({
  emirates,
  regions,
  areas,
  emirateIds,
  regionIds,
  areaIds,
}: PruneInspectionAreaSelectionParams): InspectionAssignedAreaNode[] => (
  unique(emirateIds).flatMap((emirateId) => {
    const emirate = emirates.find((item) => item.id === emirateId);
    const selectedAreas = unique(areaIds)
      .map((areaId) => areas.find((item) => item.id === areaId))
      .filter((area): area is InspectionLocationOption => area?.emirateId === emirateId);

    if (!emirate?.requiresRegion) {
      return selectedAreas.length
        ? selectedAreas.map((area) => ({
            emirateId,
            regionId: area.regionId,
            communityId: area.id,
          }))
        : [{ emirateId }];
    }

    return unique(regionIds)
      .map((regionId) => regions.find((item) => item.id === regionId))
      .filter((region): region is InspectionLocationOption => region?.emirateId === emirateId)
      .flatMap((region) => {
        const regionAreas = selectedAreas.filter((area) => area.regionId === region.id);
        return regionAreas.length
          ? regionAreas.map((area) => ({
              emirateId,
              regionId: region.id,
              communityId: area.id,
            }))
          : [{ emirateId, regionId: region.id }];
      });
  })
);
