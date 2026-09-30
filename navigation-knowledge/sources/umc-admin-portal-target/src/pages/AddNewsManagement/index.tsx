import { Content } from "./Content";
import { toApi } from "@/utils/gstTime";
import { Cover } from "./Cover";
import { DownOutlined } from "@ant-design/icons";
import "./index.less";
import "./reset.less";
import { SEO } from "./SEO";
import { Timing } from "./Timing";
import { AuthBtns } from "./AuthBtns";
import { Form } from "antd";
import type { UploadFile } from "antd";
import { useRef, useState, useEffect } from "react";
import type { ICoverRef, ICoverFieldType } from "./Cover/type";
import type { IContentFieldType } from "./Content/type";
import type { ISEOFieldType } from "./SEO/type";
import type { ITimingFieldType } from "./Timing/type";
import moment from "moment";
import {
  addNewsAsync,
  type IAddNewsParams,
  UpdateAsync,
  GetByIdAsync,
} from "@/services/cms";
import { useUserStore } from "@/store/user";
import { ConfirmModal, CustomMessage } from "@/components/common";
import { useLocation, useHistory } from "react-router-dom";
import { Preview } from "./Preview";
import { useTranslation } from "react-i18next";

const DRAFT_STATUS = "5";
const SUBMIT_STATUS = "1";

const isEmptyRichText = (value?: string) =>
  !value ||
  value === "<p><br></p>" ||
  value.replace(/<[^>]*>/g, "").trim() === "";

export default function AddNewsManagement() {
  const { t } = useTranslation();
  const [resumeWorkVisible, setresumeWorkVisible] = useState(false);
  const [backVisible, setbackVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [formValuesa, seformValuesa] = useState<Partial<IAddNewsParams>>({});
  const [previewData, setPreviewData] = useState({
    titleEn: "",
    titleAr: "",
    contentEn: "",
    contentAr: "",
    imageUrl: "",
    publishTime: null as moment.Moment | null,
  });
  const coverRef = useRef<ICoverRef>(null);
  const [coverForm] = Form.useForm<ICoverFieldType>();
  const [contentForm] = Form.useForm<IContentFieldType>();
  const [seoForm] = Form.useForm<ISEOFieldType>();
  const [timingForm] = Form.useForm<ITimingFieldType>();
  const userInfo = useUserStore((state) => state.userInfo);
  const [publishVisible, setPublishVisible] = useState(false);
  const history = useHistory();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const idParam = searchParams.get("id");
  const id = idParam ? parseInt(idParam, 10) : NaN;
  const type = searchParams.get("type") ? searchParams.get("type") : "";
  
  const contentTitleEn = Form.useWatch("titleEn", contentForm);
  const contentTitleAr = Form.useWatch("titleAr", contentForm);
  const contentContentEn = Form.useWatch("contentEn", contentForm);
  const contentContentAr = Form.useWatch("contentAr", contentForm);
  const seoTitle = Form.useWatch("seotitle", seoForm);
  const seoDescription = Form.useWatch("seodescription", seoForm);
  const seoKeyWords = Form.useWatch("seokeyWords", seoForm);
  const publishType = Form.useWatch("publishType", timingForm);
  const publishTime = Form.useWatch("publishTime", timingForm);
  
  const [saveDraftDisabled, setSaveDraftDisabled] = useState(true);
  const [actionBtnsDisabled, setActionBtnsDisabled] = useState(true);
  const [HasFormChanged, setHasFormChanged] = useState(false);
  const isInitializingRef = useRef(false);
  const isFirstCheckAfterInitRef = useRef(false);
  const [coverFileList, setCoverFileList] = useState<UploadFile[]>([]);

  const hasAnyFilledField = (): boolean => {
    const { getFileList } = coverRef.current || {};
    if (getFileList && getFileList().length > 0) {
      return true;
    }

    const contentValues = contentForm.getFieldsValue();
    if (contentValues.titleEn?.trim()) return true;
    if (contentValues.titleAr?.trim()) return true;
    if (!isEmptyRichText(contentValues.contentEn)) return true;
    if (!isEmptyRichText(contentValues.contentAr)) return true;

    const seoValues = seoForm.getFieldsValue();
    if (seoValues.seotitle?.trim()) return true;
    if (seoValues.seodescription?.trim()) return true;
    if (seoValues.seokeyWords?.trim()) return true;

    const timingValues = timingForm.getFieldsValue();
    if (timingValues.publishTime) return true;

    return false;
  };

  const isFormComplete = (): boolean => {
    const { getFileList } = coverRef.current || {};
    const hasImage = getFileList && getFileList().length > 0;

    const contentValues = contentForm.getFieldsValue();
    const isContentValid =
      contentValues.titleEn &&
      contentValues.titleAr &&
      contentValues.contentEn &&
      contentValues.contentEn !== "<p><br></p>" &&
      contentValues.contentAr &&
      contentValues.contentAr !== "<p><br></p>";

    const timingValues = timingForm.getFieldsValue();
    const isTimingValid =
      timingValues.publishType &&
      (timingValues.publishType === "1" || timingValues.publishTime);

    return Boolean(hasImage && isContentValid && isTimingValid);
  };

  const updateButtonStates = () => {
    setSaveDraftDisabled(!hasAnyFilledField());
    setActionBtnsDisabled(!isFormComplete());
  };
  
  useEffect(() => {
    if (isInitializingRef.current) {
      updateButtonStates();
      return;
    }

    if (isFirstCheckAfterInitRef.current) {
      isFirstCheckAfterInitRef.current = false;
      updateButtonStates();
      return;
    }

    if (hasAnyFilledField()) {
      setHasFormChanged(true);
    }

    updateButtonStates();
  }, [
    contentTitleEn,
    contentTitleAr,
    contentContentEn,
    contentContentAr,
    seoTitle,
    seoDescription,
    seoKeyWords,
    publishType,
    publishTime,
    coverFileList,
  ]);
  
  const handleCoverChange = (files: UploadFile[]) => {
    setCoverFileList(files);
    if (!isInitializingRef.current) {
      setHasFormChanged(true);
    }
  };
  
  useEffect(() => {
    if (id) {
      isInitializingRef.current = true;
      GetByIdAsync(id).then((res) => {
        if (coverRef.current) {
          const imageUrl = res.data?.imageUrl ? res.data?.imageUrl : "";
          coverRef.current.setFileList(imageUrl);
          if (imageUrl) {
            const fileList = coverRef.current.getFileList();
            setCoverFileList(fileList);
          }
          seoForm.setFieldValue("seotitle", res.data.seotitle);
          seoForm.setFieldValue("seodescription", res.data.seodescription);
          seoForm.setFieldValue("seokeyWords", res.data.seokeyWords);
          contentForm.setFieldValue("titleEn", res.data.titleEn);
          contentForm.setFieldValue("titleAr", res.data.titleAr);
          contentForm.setFieldValue("contentAr", res.data.contentAr);
          contentForm.setFieldValue("contentEn", res.data.contentEn);
          if (res.data.publishType) {
            timingForm.setFieldValue("publishType", res.data.publishType);
            if (res.data.publishTime) {
              timingForm.setFieldValue(
                "publishTime",
                moment(res.data.publishTime)
              );
            }
          }
          
          requestAnimationFrame(() => {
            setTimeout(() => {
              isInitializingRef.current = false;
              isFirstCheckAfterInitRef.current = true;
            }, 0);
          });
        } else {
          isInitializingRef.current = false;
          isFirstCheckAfterInitRef.current = true;
        }
      }).catch(() => {
        isInitializingRef.current = false;
        isFirstCheckAfterInitRef.current = true;
      });
    } else {
      isInitializingRef.current = false;
      isFirstCheckAfterInitRef.current = true;
    }
  }, [id]);
  const onConfirm = () => {
    Submit(formValuesa);
    setresumeWorkVisible(false);
  };
  const Submit = async (params: Partial<IAddNewsParams>) => {
    let uuid:number = 0
    try {
      if (type === "edit") {
        await UpdateAsync({ ...(params as IAddNewsParams), id: id });
        uuid = id
      } else {
      uuid  =  (await addNewsAsync(params as IAddNewsParams)).data.id;
      }

      if (params.status == "5") {
        CustomMessage.success(t("CMS.addNewsManagement.messages.saveDraftSuccess"));
        setHasFormChanged(false);
        history.replace(`/cms/NewsManagement/AddNewsManagement?id=${uuid}&type=edit`);

      } else {
        CustomMessage.success(t("CMS.addNewsManagement.messages.operationSuccess"));
        setHasFormChanged(false);
        history.replace("/cms/NewsManagement");
      }
    } catch (error) {
      console.error("Error submitting news:", error);
    }
  };

  const formValidates = async (btnStatus: string) => {
    const { getFileList } = coverRef.current || {};

    if (btnStatus === "5") {
      const contentVals = contentForm.getFieldsValue();
      const seoVals = seoForm.getFieldsValue();
      const timingVals = timingForm.getFieldsValue();

      const params = {
        titleEn: contentVals.titleEn ?? "",
        titleAr: contentVals.titleAr ?? "",
        contentEn: contentVals.contentEn ?? "",
        contentAr: contentVals.contentAr ?? "",
        seotitle: seoVals.seotitle ?? "",
        seodescription: seoVals.seodescription ?? "",
        seokeyWords: seoVals.seokeyWords ?? "",
        publishType: timingVals.publishType ?? "",
        publishTime: timingVals.publishTime
          ? toApi(timingVals.publishTime)
          : undefined,
        imageUrl: getFileList?.()[0]?.url ?? null,
        userId: userInfo?.id,
        status: btnStatus,
      };
      await Submit(params);
      return;
    }

    coverForm
      .validateFields()
      .then(() => {
        contentForm
          .validateFields()
          .then((contentVals) => {
            seoForm
              .validateFields()
              .then((seoVals) => {
                timingForm
                  .validateFields()
                  .then((timingVals) => {
                    if (btnStatus === SUBMIT_STATUS) {
                      setresumeWorkVisible(true);
                    }
                    const params = {
                      ...contentVals,
                      ...seoVals,
                      ...timingVals,
                      publishTime: timingVals.publishTime
                        ? toApi(timingVals.publishTime)
                        : undefined,
                      imageUrl: getFileList?.()[0]?.url ?? "",
                      userId: userInfo?.id,
                      status: btnStatus,
                    };
                    seformValuesa(params);
                  })
                  .catch(() => {});
              })
              .catch(() => {});
          })
          .catch(() => {});
      })
      .catch(() => {});
  };
  const btnsEvent = {
    preview: async () => {
      const { getFileList } = coverRef.current || {};

      try {
        await coverForm.validateFields();
        await contentForm.validateFields();
        await seoForm.validateFields();
        await timingForm.validateFields();
        const contentValues = contentForm.getFieldsValue();
        const timingValues = timingForm.getFieldsValue();
        const imageUrl = getFileList?.()[0]?.url ?? "";

        setPreviewData({
          titleEn: contentValues.titleEn || "",
          titleAr: contentValues.titleAr || "",
          contentEn: contentValues.contentEn || "",
          contentAr: contentValues.contentAr || "",
          imageUrl: imageUrl,
          publishTime:
            timingValues.publishType === "2"
              ? timingValues.publishTime
              : moment(),
        });
        setPreviewVisible(true);
      } catch (error) {
        console.error("Validation failed:", error);
      }
    },
    saveDraft: () => {
      void formValidates(DRAFT_STATUS);
    },
    submit: () => {
      formValidates(SUBMIT_STATUS);
    },
    publish: async () => {
      try {
        await coverForm.validateFields();
        await contentForm.validateFields();
        await timingForm.validateFields();
      } catch {
        return;
      }
      setPublishVisible(true);
    },
    back: () => {
      if (HasFormChanged) {
        setbackVisible(true);
      } else {
        history.goBack();
      }
    },
  };

  const doPublish = () => {
    const contentVals = contentForm.getFieldsValue();
    const seoVals = seoForm.getFieldsValue();
    const timingVals = timingForm.getFieldsValue();
    const { getFileList } = coverRef.current || {};
    const pType = timingVals.publishType ?? "1";
    let publishStatus = "3";
    if (pType === "2") {
      publishStatus =
        timingVals.publishTime &&
        moment(timingVals.publishTime).isBefore(moment())
          ? "3"
          : "6";
    }
    const params = {
      ...contentVals,
      ...seoVals,
      ...timingVals,
      publishTime: timingVals.publishTime
        ? toApi(timingVals.publishTime)
        : undefined,
      imageUrl: getFileList?.()[0]?.url ?? "",
      userId: userInfo?.id,
      status: publishStatus,
    };
    setPublishVisible(false);
    Submit(params);
  };

  return (
    <div className="add-newsManagement-container">
      <div>
        <Cover ref={coverRef} coverForm={coverForm} onChange={handleCoverChange} />
      </div>
      <div className="timing-container">
        <details className="timing-details" open>
          <summary className="detail-title">
            <b>{t("CMS.addNewsManagement.timing.title")}</b>
            <div>
              <DownOutlined className="collapse-icon" />
            </div>
          </summary>
          <div className="detail-content">
            <Timing timingForm={timingForm} />
          </div>
        </details>
      </div>
      <div className="content-container">
        <details className="content-details" open>
          <summary className="detail-title">
            <b>{t("CMS.addNewsManagement.content.title")}</b>
            <div>
              <DownOutlined className="collapse-icon" />
            </div>
          </summary>
          <div className="detail-content">
            <Content contentForm={contentForm} />
          </div>
        </details>
      </div>
      <div className="seo-container">
        <details className="seo-details">
          <summary className="detail-title">
            <b>{t("CMS.addNewsManagement.seo.title")}</b>
            <div>
              <DownOutlined className="collapse-icon" />
            </div>
          </summary>
          <div className="detail-content">
            <SEO seoForm={seoForm} />
          </div>
        </details>
      </div>

      <AuthBtns
        btnsEvent={btnsEvent}
        saveDraftDisabled={saveDraftDisabled}
        actionBtnsDisabled={actionBtnsDisabled}
      />
      <ConfirmModal
        visible={resumeWorkVisible}
        type="warning"
        title={t("CMS.addNewsManagement.modal.submitReviewTitle")}
        content={t("CMS.addNewsManagement.modal.submitReviewContent")}
        cancelText={t("CMS.addNewsManagement.buttons.cancel")}
        confirmText={t("CMS.addNewsManagement.buttons.confirm")}
        onCancel={() => setresumeWorkVisible(false)}
        onConfirm={onConfirm}
      />
      <ConfirmModal
        visible={backVisible}
        type="danger"
        title={t("CMS.addNewsManagement.modal.leavePageTitle")}
        content={t("CMS.addNewsManagement.modal.leavePageContent")}
        cancelText={t("CMS.addNewsManagement.buttons.cancel")}
        confirmText={t("CMS.addNewsManagement.buttons.leave")}
        onCancel={() => setbackVisible(false)}
        onConfirm={() => {
          history.goBack();
        }}
      />
      <ConfirmModal
        visible={publishVisible}
        type="warning"
        title={t("CMS.addNewsManagement.modal.publishNewsTitle")}
        content={t("CMS.addNewsManagement.modal.publishNewsContent")}
        cancelText={t("CMS.addNewsManagement.buttons.cancel")}
        confirmText={t("CMS.addNewsManagement.buttons.confirm")}
        onCancel={() => setPublishVisible(false)}
        onConfirm={doPublish}
      />
      <Preview
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        data={previewData}
      />
    </div>
  );
}
