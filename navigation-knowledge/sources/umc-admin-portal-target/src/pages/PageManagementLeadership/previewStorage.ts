import type { ChairmanParam, DirectorParam, ManagementParam } from "@/services/cms";

// Bridges the Leadership editor and its new-window preview page (PRD: Preview
// opens the whole page in a new window). sessionStorage is shared with
// windows opened via window.open, so the unsaved draft travels without saving.
export const LEADERSHIP_PREVIEW_STORAGE_KEY = "cms-leadership-preview-data";

export interface LeadershipPreviewData {
  chairmanData: ChairmanParam;
  directorsData: DirectorParam;
  managementData: ManagementParam;
  lan: string;
}

export const readLeadershipPreviewData = (): LeadershipPreviewData | null => {
  try {
    const raw = sessionStorage.getItem(LEADERSHIP_PREVIEW_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeadershipPreviewData) : null;
  } catch {
    return null;
  }
};
