type CampaignPreviewCounts = {
  matchedEstablishmentCount: number;
  willCreateCount: number;
  recentInspectionTaskCount: number;
};

export const getCampaignPreviewDecision = (
  preview: CampaignPreviewCounts | null | undefined,
): "empty" | "confirm" | "create" => {
  if (!preview || ![
    preview.matchedEstablishmentCount,
    preview.willCreateCount,
    preview.recentInspectionTaskCount,
  ].every((count) => Number.isSafeInteger(count) && count >= 0)
    || preview.willCreateCount !== preview.matchedEstablishmentCount) {
    throw new Error("Invalid inspection campaign preview counts");
  }
  if (preview.willCreateCount === 0) return "empty";
  return preview.recentInspectionTaskCount > 0 ? "confirm" : "create";
};
