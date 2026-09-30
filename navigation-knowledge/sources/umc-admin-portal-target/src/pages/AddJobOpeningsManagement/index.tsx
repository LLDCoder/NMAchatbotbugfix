import { Content } from "./Content";
import { BasicInformation } from "./BasicInformation";
import { DownOutlined } from "@ant-design/icons";
import "./index.less";
import "./reset.less";
import { AuthBtns } from "./AuthBtns";
import { Form } from "antd";
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { IContentFieldType } from "./Content/type";
import type { IBasicFieldType } from "./BasicInformation/type";
import moment from "moment";
import {
  addJobAsync,
  type IAddNewsParams,
  UpdateJobAsync,
  GetJobByIdAsync,
} from "@/services/cms";
import { useUserStore } from "@/store/user";
import { ConfirmModal, CustomMessage } from "@/components/common";
import { useLocation, useHistory } from "react-router-dom";
import { useButtonPermission } from "@/routes/access";
import { Preview } from "./Preview";

const DRAFT_STATUS = "5";
const SUBMIT_STATUS = "1";
const PUBLISH_STATUS = "3";
const ADD_JOB_PERMISSION_ROUTE =
  "/cms/JobOpeningsManagement/addJobOpeningsManagement";

type BasicInformationRefValue = {
  regionName?: string | number;
};

export default function AddNewsManagement() {
  const { t } = useTranslation();
  const [resumeWorkVisible, setresumeWorkVisible] = useState(false);
  const [publishVisible, setPublishVisible] = useState(false);
  const [backVisible, setbackVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [formValuesa, seformValuesa] = useState<Partial<IAddNewsParams>>({});
  const [previewData, setPreviewData] = useState({
    contentEn: "",
    contentAr: "",
    jobTitleEn: "",
    jobTitleAr: "",
    jobTypes: "",
    applicationDeadline: "",
    emirateId: 0,
  });
  const [contentForm] = Form.useForm<IContentFieldType>();
  const [BasicInformationForm] = Form.useForm<IBasicFieldType>();
  const userInfo = useUserStore((state) => state.userInfo);
  const { canRenderButton } = useButtonPermission(ADD_JOB_PERMISSION_ROUTE);
  const canPublish = canRenderButton(
    "CMS.JobOpenings.AddJobOpeningsManagement.Publish",
  );
  const canSaveAndSubmit = canRenderButton(
    "CMS.JobOpenings.AddJobOpeningsManagement.SaveAndSubmit",
  );
  const history = useHistory();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const idParam = searchParams.get("id");
  const id = idParam ? parseInt(idParam, 10) : NaN;
  const type = searchParams.get("type") ? searchParams.get("type") : "";

  const contentContentEn = Form.useWatch("contentEn", contentForm);
  const contentContentAr = Form.useWatch("contentAr", contentForm);
  const basicapplicationDeadline = Form.useWatch(
    "applicationDeadline",
    BasicInformationForm,
  );
  const basicjobTitleEn = Form.useWatch("jobTitleEn", BasicInformationForm);
  const basicjobTitleAr = Form.useWatch("jobTitleAr", BasicInformationForm);
  const basicjobTypes = Form.useWatch("jobTypes", BasicInformationForm);
  const basicemirateId = Form.useWatch("emirateId", BasicInformationForm);

  const [SaveDraftDisabled, setIsSaveDraftDisabled] = useState(true);
  const [HasFormChanged, setHasFormChanged] = useState(false);
  const isInitializingRef = useRef(false);
  const isFirstCheckAfterInitRef = useRef(false);
  const BasicInformationRef = useRef<BasicInformationRefValue>(null);

  const checkFormValidity = () => {
    const contentValues = contentForm.getFieldsValue();
    const basicValues = BasicInformationForm.getFieldsValue();
    const isContentValid =
      contentValues.contentEn &&
      contentValues.contentEn !== "<p><br></p>" &&
      contentValues.contentAr &&
      contentValues.contentAr !== "<p><br></p>";
    const isBasicValid =
      basicValues.jobTitleEn &&
      basicValues.jobTitleAr &&
      basicValues.jobTypes &&
      basicValues.emirateId;
    if (isContentValid && isBasicValid) {
      setIsSaveDraftDisabled(false);
    } else {
      setIsSaveDraftDisabled(true);
    }
  };

  useEffect(() => {
    if (isInitializingRef.current) {
      checkFormValidity();
      return;
    }

    if (isFirstCheckAfterInitRef.current) {
      isFirstCheckAfterInitRef.current = false;
      checkFormValidity();
      return;
    }

    const allWatchedValues = [
      contentContentEn,
      contentContentAr,
      basicapplicationDeadline,
      basicjobTitleEn,
      basicjobTitleAr,
      basicjobTypes,
      basicemirateId,
    ];

    const hasAnyValueChanged = allWatchedValues.some(
      (value) => value !== undefined && value !== null && value !== "",
    );

    if (hasAnyValueChanged) {
      setHasFormChanged(true);
    }

    checkFormValidity();
  }, [
    contentContentEn,
    contentContentAr,
    basicapplicationDeadline,
    basicjobTitleEn,
    basicjobTitleAr,
    basicjobTypes,
    basicemirateId,
  ]);

  useEffect(() => {
    if (id) {
      isInitializingRef.current = true;
      GetJobByIdAsync(id)
        .then((res) => {
          contentForm.setFieldValue("contentAr", res.data.contentAr);
          contentForm.setFieldValue("contentEn", res.data.contentEn);
          BasicInformationForm.setFieldValue("jobTitleEn", res.data.jobTitleEn);
          BasicInformationForm.setFieldValue(
            "applicationDeadline",
            res.data.applicationDeadline
              ? moment(res.data.applicationDeadline)
              : "",
          );
          BasicInformationForm.setFieldValue("jobTitleAr", res.data.jobTitleAr);
          BasicInformationForm.setFieldValue("jobTypes", res.data.jobTypes);
          BasicInformationForm.setFieldValue("emirateId", res.data.emirateId);
          requestAnimationFrame(() => {
            setTimeout(() => {
              isInitializingRef.current = false;
              isFirstCheckAfterInitRef.current = true;
            }, 0);
          });
        })
        .catch(() => {
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
  const onConfirmPublish = () => {
    Submit(formValuesa);
    setPublishVisible(false);
  };
  const Submit = async (params: Partial<IAddNewsParams>) => {
    let uuid: number = 0;
    try {
      if (type === "edit") {
        await UpdateJobAsync({ ...(params as IAddNewsParams), id: id });
        uuid = id;
      } else {
        uuid = (await addJobAsync(params as IAddNewsParams)).data.id;
      }
      console.log(params.status);

      if (params.status == "5") {
        CustomMessage.success(t("CMS.jobOpeningsManagement.messages.saveDraftSuccess"));
        history.replace(
          `/cms/JobOpeningsManagement/addJobOpeningsManagement?id=${uuid}&type=edit`,
        );
      } else {
        CustomMessage.success(t("CMS.common.operationSuccessful"));
        history.replace("/cms/JobOpeningsManagement");
      }
    } catch (error) {
      console.error("Error submitting news:", error);
    }
  };

  const formValidates = async (btnStatus: string) => {
    if (btnStatus === "5") {
      const contentVals = contentForm.getFieldsValue();
      const BasicVals = BasicInformationForm.getFieldsValue();
      const params = {
        contentEn: contentVals.contentEn ?? "",
        contentAr: contentVals.contentAr ?? "",
        jobTitleEn: BasicVals.jobTitleEn ?? "",
        jobTitleAr: BasicVals.jobTitleAr ?? "",
        jobTypes: BasicVals.jobTypes ?? null,
        applicationDeadline: BasicVals.applicationDeadline
          ? moment(BasicVals.applicationDeadline).format("YYYY-MM-DD")
          : null,
        emirateId: BasicVals.emirateId ?? null,
        userId: userInfo?.id,
        status: btnStatus,
      };
      Submit(params);
      return;
    }
    BasicInformationForm.validateFields().then((BasicVals) => {
      contentForm
        .validateFields()
        .then((contentVals) => {
          if (btnStatus === SUBMIT_STATUS) {
            setresumeWorkVisible(true);
          } else if (btnStatus === PUBLISH_STATUS) {
            setPublishVisible(true);
          }
          const params = {
            ...contentVals,
            ...BasicVals,
            userId: userInfo?.id,
            status: btnStatus,
            jobTypes: BasicVals.jobTypes + "",
          };
          console.log(btnStatus);
          seformValuesa(params);
        })
        .catch(() => {});
    });
  };
  const btnsEvent = {
    preview: async () => {
      try {
        await contentForm.validateFields();
        const contentValues = contentForm.getFieldsValue();
        const basicValues = BasicInformationForm.getFieldsValue();

        setPreviewData({
          contentEn: contentValues.contentEn || "",
          contentAr: contentValues.contentAr || "",
          jobTitleEn: basicValues.jobTitleEn || "",
          jobTitleAr: basicValues.jobTitleAr || "",
          jobTypes: basicValues.jobTypes || "",
          applicationDeadline: basicValues.applicationDeadline || "",
          emirateId: BasicInformationRef.current?.regionName || 0,
        });
        setPreviewVisible(true);
      } catch (error) {
        console.error("Validation failed:", error);
      }
    },
    saveDraft: () => {
      setHasFormChanged(false);
      formValidates(DRAFT_STATUS);

    },
    submit: () => {
      formValidates(SUBMIT_STATUS);
    },
    publish: () => {
      formValidates(PUBLISH_STATUS);
    },
    back: () => {
      if (HasFormChanged) {
        setbackVisible(true);
      } else {
        history.goBack();
      }
    },
  };

  return (
    <div className="add-newsManagement-container">
      <div className="content-container">
        <details className="content-details" open>
          <summary className="detail-title">
            <b>{t("CMS.jobOpeningsManagement.sections.basicInformation")}</b>
            <div>
              <DownOutlined className="collapse-icon" />
            </div>
          </summary>
          <div className="detail-content">
            <BasicInformation BasicInformationForm={BasicInformationForm}  ref={BasicInformationRef}  />
          </div>
        </details>
      </div>
      <div className="content-container">
        <details className="content-details" open>
          <summary className="detail-title">
            <b>{t("CMS.jobOpeningsManagement.sections.content")}</b>
            <div>
              <DownOutlined className="collapse-icon" />
            </div>
          </summary>
          <div className="detail-content">
            <Content contentForm={contentForm} />
          </div>
        </details>
      </div>

      <AuthBtns
        btnsEvent={btnsEvent}
        btnsDisabled={SaveDraftDisabled}
        canPublish={canPublish}
        canSaveAndSubmit={canSaveAndSubmit}
      />
      <ConfirmModal
        visible={resumeWorkVisible}
        type="warning"
        title={t("CMS.modals.submitForReview.title")}
        content={t("CMS.modals.submitForReview.content")}
        cancelText={t("CMS.common.cancel")}
        confirmText={t("CMS.common.confirm")}
        onCancel={() => setresumeWorkVisible(false)}
        onConfirm={onConfirm}
      />
      <ConfirmModal
        visible={publishVisible}
        type="warning"
        title={t("CMS.jobOpeningsManagement.modals.publishJob.title")}
        content={t("CMS.jobOpeningsManagement.modals.publishJob.content")}
        cancelText={t("CMS.common.cancel")}
        confirmText={t("CMS.common.confirm")}
        onCancel={() => setPublishVisible(false)}
        onConfirm={onConfirmPublish}
      />
      <ConfirmModal
        visible={backVisible}
        type="danger"
        title={t("CMS.modals.leavePage.title")}
        content={t("CMS.modals.leavePage.content")}
        cancelText={t("CMS.common.cancel")}
        confirmText={t("CMS.modals.leavePage.leave")}
        onCancel={() => setbackVisible(false)}
        onConfirm={() => {
          history.goBack();
        }}
      />
      <Preview
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        data={previewData}
      />
    </div>
  );
}
