import { Image, type UploadFile, Form } from "antd";
import { useState, forwardRef, useImperativeHandle } from "react";
import type { ICoverRef, IProps } from "./type";
import { fileUpload } from "@/services/media";
import uploadCloud from "@/assets/images/uploadCloud.png";
import "./index.less";
import Dragger from "antd/lib/upload/Dragger";
import { ImageBaseUrl } from "@/utils/url";
import eyeIcon from "@/assets/images/ImgView.png";
import trashIcon from "@/assets/images/ImgDelete.png";
import { CustomMessage } from "@/components/common";
import { useTranslation } from "react-i18next";
import { useAuthenticatedDocumentUrl } from "@/hooks/useAuthenticatedDocumentUrl";

const maxCount = 1;
const maxSize = 5;
const accept = ".jpg,.jpeg,.png,.pdf";

export const Cover = forwardRef<ICoverRef, IProps>(
  ({ coverForm, onChange }, ref) => {
    const { t } = useTranslation();
    const [fileList, setFileList] = useState<UploadFile[]>([] as UploadFile[]);
    const [imgPreview, setImgPreview] = useState(false);
    const authenticatedPreviewUrl = useAuthenticatedDocumentUrl(fileList[0]?.url);

    const uploadFile = async (options: any) => {
      const { file, onSuccess, onError } = options;
      const formData = new FormData();
      formData.append("files", file);
      try {
        const res = await fileUpload(formData);
        if (res.data && res.data.length > 0) {
          onSuccess(res.data[0]);
        }
      } catch (error) {
        console.error("Upload failed:", error);
        if (onError) {
          onError(error);
        }
      }
    };

    const uploadProps = {
      fileList,
      maxCount,
      className: "cover-upload",
      onRemove: async () => {
        setFileList([]);
        coverForm.setFieldsValue({ imageUrl: "" });
        onChange?.([]);
        return true;
      },
      customRequest: async (options: any) => {
        const { file } = options;
        if (file.size / 1024 / 1024 > maxSize) {
          CustomMessage.error(
            t("CMS.addEventManagement.cover.errors.fileSizeExceeded", {
              maxSize,
            }),
          );
          return;
        }

        const image = document.createElement("img") as HTMLImageElement;
        const imageUrl = URL.createObjectURL(file);

        image.onload = async () => {
          URL.revokeObjectURL(imageUrl);
          const width = image.width;
          const height = image.height;
          const expectedWidth = 1400;
          const expectedHeight = 800;

          // if (width < expectedWidth || height < expectedHeight) {
          //   CustomMessage.error(
          //     `Image dimensions are ${width}x${height}, but expected ${expectedWidth}x${expectedHeight}`
          //   );
          //   return;
          // }

          await uploadFile({
            ...options,
            onSuccess: (url: string) => {
              const newFile: UploadFile = {
                ...file,
                url: `${ImageBaseUrl}${url}`,
                name: file.name,
              };
              setFileList([newFile]);
              onChange?.([newFile]);
            },
          });
        };

        image.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          CustomMessage.error(
            t("CMS.addEventManagement.cover.errors.loadImageFailed"),
          );
        };

        image.src = imageUrl;
      },
      showUploadList: false,
      accept,
    };

    useImperativeHandle(ref, () => ({
      getFileList: () => {
        return fileList;
      },
      setFileList: (url: string) => {
        if(!url) return;
        setFileList([{url,uid:"1",name:'test'}]);
        coverForm.setFieldsValue({ imageUrl: url });
      },
    }));

    return (
      <div className="cover-container">
        <Form<{ imageUrl: string }>
          form={coverForm}
          className="custom-form cover-form"
          layout="vertical"
        >
          <span>{t("CMS.addEventManagement.cover.title")}</span>
          <div className="cover-upload-container">
            {/* <p className="upload-title">image</p> */}
            <Form.Item
              label={t("CMS.forms.image")}
              name="imageUrl"
              rules={[
                { required: true, message: t("CMS.common.requiredField") },
              ]}
            >
              <div
                className={
                  fileList.length > 0
                    ? "uploaded-file-container has-file"
                    : "uploaded-file-container"
                }
              >
                {fileList.length > 0 ? (
                  <div className="file-content">
                    <div className="cropped-image-container">
                      <Image
                        className="uploaded-image"
                        src={authenticatedPreviewUrl}
                        preview={{
                          visible: imgPreview,
                          src: authenticatedPreviewUrl,
                          onVisibleChange: (value) => {
                            setImgPreview(value);
                          },
                        }}
                      />
                    </div>
                  <div className="file-actions">
                      <div>
                        <img
                          src={eyeIcon}
                          alt={t("CMS.addEventManagement.cover.viewAlt")}
                          className="action-icon"
                          onClick={() => setImgPreview(true)}
                        />
                      </div>
                      <div>
                        <img
                          src={trashIcon}
                          alt={t("CMS.addEventManagement.cover.deleteAlt")}
                          className="action-icon"
                          onClick={() => {
                            setFileList([]);
                            coverForm.setFieldsValue({ imageUrl: "" });
                            onChange?.([]);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <Dragger {...uploadProps}>
                    <img
                      src={uploadCloud}
                      alt={t("CMS.addEventManagement.cover.uploadAlt")}
                    />
                    <div className="cover-upload-text">
                      <span className="cover-click-btn">
                        {t("CMS.addEventManagement.cover.click")}
                      </span>{" "}
                      {t("CMS.addEventManagement.cover.orDrag")}
                    </div>
                    <div className="cover-upload-size">
                      {t("CMS.addEventManagement.cover.maxSizeAndTypes")}
                    </div>
                    <div className="cover-upload-size">
                      {t("CMS.addEventManagement.cover.recommendedSize")}
                    </div>
                  </Dragger>
                )}
              </div>
            </Form.Item>
          </div>
        </Form>
      </div>
    );
  }
);
