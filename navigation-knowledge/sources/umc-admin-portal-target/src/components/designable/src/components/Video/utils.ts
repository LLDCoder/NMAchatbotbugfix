import { ImageBaseUrl } from "../../../../../utils/url";

export const normalizeVideoUrl = (value?: string) =>
  value ? `${ImageBaseUrl}${value.replace(ImageBaseUrl, "")}` : "";
