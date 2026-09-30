import { fileUpload } from "@/services/media";
import { Upload } from "antd";
import "./index.less";
import CameraIcon from "@/assets/images/Camera.svg";
import Camera2Icon from "@/assets/images/Camera2.svg";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomMessage } from "@/components/common";
import { useAuthenticatedDocumentUrl } from "@/hooks/useAuthenticatedDocumentUrl";
import PersonalPhotoTooltip from "@/components/common/PersonalPhotoTooltip";
import type { RcFile } from "antd/lib/upload";

function normalizeUploadResult(item: unknown): string {
  if (item == null) return "";
  if (typeof item === "string") return item.trim();
  if (typeof item === "object") {
    const o = item as Record<string, unknown>;
    const v = o.url ?? o.fileName ?? o.name;
    return typeof v === "string" ? v.trim() : "";
  }
  return String(item).trim();
}

const Avatar = (props: any) => {
  const { t } = useTranslation();
  const { url, onSuccess, onError, isAdd } = props;
  const [innerUrl, setInnerUrl] = useState<string | undefined>(url);

  useEffect(() => {
    setInnerUrl(url);
  }, [url]);

  // Avatar files live behind the authenticated Document API, so a plain <img>
  // request cannot attach the bearer token. Resolve it through the shared hook.
  const imgSrc = useAuthenticatedDocumentUrl(innerUrl);
  // Built-in upload method
  const uploadFile = async (options: any) => {
    const { file } = options;
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await fileUpload(formData);
      const raw = (res as { data?: unknown })?.data;
      const candidate =
        Array.isArray(raw) ? raw[0] : raw !== undefined ? raw : undefined;
      const fileRef = normalizeUploadResult(candidate);
      if (fileRef) {
        onSuccess(fileRef);
        setInnerUrl(fileRef);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      if (onError) {
        onError(error);
      }
    } finally {
    }
  };

  const beforeUpload = (file: RcFile) => {
    const allowedMimeTypes: string[] = [];
    let accept = "jpg,jpeg,png";
    accept.split(",").forEach((mimeType) => {
      allowedMimeTypes.push(mimeType.trim().toLowerCase());
    });

    if (allowedMimeTypes.includes(file.type?.split("/")[1]?.toLowerCase())) {
      const maxBytes = 5 * 1024 * 1024;
      if (file.size > maxBytes) {
        CustomMessage.error(
          t("Settings.userManagement.avatar.maxFileSize"),
        );
        return false;
      } else {
        return true;
      }
    } else {
      CustomMessage.error(
        t("Settings.userManagement.avatar.invalidFileType"),
      );
      return false;
    }
  };

  const showAddPlaceholder = Boolean(isAdd && !imgSrc);

  return (
    <PersonalPhotoTooltip>
      <Upload
        accept=".jpg,.jpeg,.png"
        beforeUpload={beforeUpload}
        customRequest={uploadFile}
        showUploadList={false}
      >
        {showAddPlaceholder ? (
          <div className="add-avatar-person">
            <img src={Camera2Icon} className="add-avatar-cameraIcon" alt="" />
          </div>
        ) : (
          <div className={isAdd ? "add-avatar-person" : "avatar-person"}>
            <img src={imgSrc} className="avatar-img" alt="" />
            <img src={CameraIcon} className="avatar-cameraIcon" alt="" />
          </div>
        )}
      </Upload>
    </PersonalPhotoTooltip>
  );
};

export default Avatar;
