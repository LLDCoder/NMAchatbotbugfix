import { CustomMessage } from "@/components/common";
import i18n from "@/localization/config";
import { getFahrPermitFile, type FahrReviewPermit } from "@/services/fahr";

const permitError = () =>
  i18n.t("Licensing.fahrReview.messages.permitUnavailable");

const resolveFileName = (
  permit: FahrReviewPermit,
  contentDisposition?: string,
) => {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(
    contentDisposition || "",
  );
  const responseFileName = match?.[1];
  if (responseFileName) {
    try {
      return decodeURIComponent(responseFileName);
    } catch {
      return responseFileName;
    }
  }
  return permit.fileName || permit.name || "fahr-permit.pdf";
};

const loadPermit = async (permit: FahrReviewPermit) => {
  if (!Number.isFinite(permit.permitId) || permit.permitId <= 0) {
    throw new Error("Invalid FAHR permit id.");
  }
  const response = await getFahrPermitFile(permit.permitId);
  return {
    blob: response.data,
    fileName: resolveFileName(
      permit,
      response.headers?.["content-disposition"],
    ),
  };
};

export async function viewFahrPermit(permit: FahrReviewPermit) {
  const previewWindow = window.open("", "_blank");
  try {
    const { blob } = await loadPermit(permit);
    const url = URL.createObjectURL(blob);
    if (previewWindow) {
      previewWindow.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    previewWindow?.close();
    console.error("Failed to open FAHR permit:", error);
    CustomMessage.error(permitError());
    throw error;
  }
}

export async function downloadFahrPermit(permit: FahrReviewPermit) {
  try {
    const { blob, fileName } = await loadPermit(permit);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to download FAHR permit:", error);
    CustomMessage.error(permitError());
    throw error;
  }
}
