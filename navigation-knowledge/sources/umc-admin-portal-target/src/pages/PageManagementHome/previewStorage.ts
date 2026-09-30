import type { BannerItem, AboutParam, PartnershipParam, FooterParam } from "@/services/cms";

// Bridges the editor and the new-window preview page (PRD: Preview opens the
// whole homepage in a new window). sessionStorage is shared across same-origin
// tabs opened via window.open, so the unsaved draft can travel without saving.
export const HOME_PREVIEW_STORAGE_KEY = "cms-homepage-preview-data";

export interface HomePreviewData {
  bannerList: BannerItem[];
  aboutParam: AboutParam;
  partnerParam: PartnershipParam;
  footerParam: FooterParam;
  lan: string;
}

export const readHomePreviewData = (): HomePreviewData | null => {
  try {
    const raw = sessionStorage.getItem(HOME_PREVIEW_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HomePreviewData) : null;
  } catch {
    return null;
  }
};
