import { fileUpload, getDocumentUploadResponseUrl } from "@/services/media";
import { Upload } from "antd";
import "./index.less";
import AvatarImg from "@/assets/images/default-admin-avatar.svg";
import CameraIcon from "@/assets/images/Camera.svg";
import { CustomMessage } from "@/components/common";
import type { RcFile } from "antd/lib/upload";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import { useTranslation } from "react-i18next";
import { useAuthenticatedDocumentSource } from "@/hooks/useAuthenticatedDocumentUrl";
import PersonalPhotoTooltip from "@/components/common/PersonalPhotoTooltip";

interface AvatarProps {
  url?: string | null;
  disabled?: boolean;
  loading?: boolean;
  onSuccess: (url: string) => void | Promise<unknown>;
  onError?: (error: unknown) => void;
}
const Avatar = (props: AvatarProps) => {
  const { url, disabled = false, loading = false, onSuccess, onError } = props;
  const { t } = useTranslation();
  // Built-in upload method
  const uploadFile = async (options: UploadRequestOption) => {
    if (disabled) {
      return;
    }

    const { file } = options;
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await fileUpload(formData);
      const uploadedUrl = getDocumentUploadResponseUrl(res);
      if (uploadedUrl) {
        await onSuccess(uploadedUrl);
      }
    } catch (error:any) {
      CustomMessage.error(error.message);
      console.log("Upload failed:", error);
      if (onError) {
        onError(error);
      }
    }
  };

  const beforeUpload = (file: RcFile) => {
    if (disabled) {
      return false;
    }

    const allowedMimeTypes: string[] = [];
    const accept = "jpg,jpeg,png";
    accept.split(",").forEach((mimeType) => {
      allowedMimeTypes.push(mimeType.trim().toLowerCase());
    });

    if (allowedMimeTypes.includes(file.type?.split("/")[1]?.toLowerCase())) {
      if (file.size >= 1000 * 1024 * 5) {
        CustomMessage.error(t("PersonalCenter.avatarMaxFileSize"));
        return false;
      } else {
        return true;
      }
    } else {
      CustomMessage.error(t("PersonalCenter.avatarInvalidFileType"));
      return false;
    }
  };

  const { source: imgSrc, status } = useAuthenticatedDocumentSource(
    url,
    AvatarImg,
  );
  const showAvatar = !loading && status !== "loading";

  return (
    <PersonalPhotoTooltip>
      <Upload
        accept=".jpg,.jpeg,.png"
        disabled={disabled}
        beforeUpload={beforeUpload}
        customRequest={uploadFile}
        showUploadList={false}
      >
        <div className={`avatar-person${disabled ? " avatar-person--disabled" : ""}`}>
          {showAvatar && (
            <img
              src={imgSrc}
              className="avatar-img"
              alt={t("header.userAvatarAlt")}
            />
          )}
          {!disabled && showAvatar && (
            <div className="avatar-person__camera-overlay" aria-hidden="true">
              <img src={CameraIcon} className="avatar-person__camera-icon" alt="" />
            </div>
          )}
        </div>
      </Upload>
    </PersonalPhotoTooltip>
  );
};

export default Avatar;
