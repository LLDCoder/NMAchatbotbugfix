import type {
  AboutFormParam,
  VisionMissionValues,
  StrategicObjectives,
  AboutPartnership,
} from "@/services/cms";

// Bridges the About NMA editor and its new-window preview page (PRD: Preview
// opens the whole page in a new window). sessionStorage is shared with
// windows opened via window.open, so the unsaved draft travels without saving.
export const ABOUT_PREVIEW_STORAGE_KEY = "cms-aboutnma-preview-data";

export interface AboutPreviewData {
  aboutParam: AboutFormParam;
  visionParam: VisionMissionValues;
  strategicParam: StrategicObjectives;
  partnerParam: AboutPartnership;
  lan: string;
}

export const readAboutPreviewData = (): AboutPreviewData | null => {
  try {
    const raw = sessionStorage.getItem(ABOUT_PREVIEW_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AboutPreviewData) : null;
  } catch {
    return null;
  }
};
