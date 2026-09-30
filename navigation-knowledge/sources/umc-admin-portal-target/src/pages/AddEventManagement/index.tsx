import { Content } from "./Content";
import { toApi } from "@/utils/gstTime";
import { Cover } from "./Cover";
import { DownOutlined } from "@ant-design/icons";
import "./index.less";
import "./reset.less";
import { Timing } from "./Timing";

import { Location } from "./Location";
import { EventPeriod } from "./EventPeriod";
import { Registration } from "./Registration";
import { AuthBtns } from "./AuthBtns";
import { Form } from "antd";
import type { UploadFile } from "antd";
import { useRef, useState, useEffect } from "react";
import type { ICoverRef, ICoverFieldType } from "./Cover/type";
import type { IContentFieldType } from "./Content/type";
import type { ILocationRef } from "./Location/type";
import type { ISEOFieldType } from "./Location/type";
import type { EventPeriodFieldType } from "./EventPeriod/type";
import type { RegistrationPeriodFieldType } from "./Registration/type";
import moment from "moment";
import {
  addEventAsync,
  type IAddNewsParams,
  UpdateEventAsync,
  GetEventByIdAsync,
} from "@/services/cms";
import { useUserStore } from "@/store/user";
import { useButtonPermission } from "@/routes/access";
import { ConfirmModal, CustomMessage } from "@/components/common";
import { useLocation, useHistory } from "react-router-dom";
import { Preview } from "./Preview";
import type { ITimingFieldType } from "./Timing/type";
import { useTranslation } from "react-i18next";

const DRAFT_STATUS = "5";
const SUBMIT_STATUS = "1";
const ADD_EVENT_PERMISSION_ROUTE = "/cms/EventManagement/AddEventManagement";
export default function AddEventManagement() {
  const { t } = useTranslation();
  const [resumeWorkVisible, setresumeWorkVisible] = useState(false);
  const [backVisible, setbackVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [formValuesa, seformValuesa] = useState<Partial<IAddNewsParams>>({});
  const [previewData, setPreviewData] = useState<{
    titleEn: string;
    titleAr: string;
    contentEn: string;
    contentAr: string;
    imageUrl: string;
    publishTime: null | [moment.Moment, moment.Moment];
    emirateName: string | undefined;
    emirateNameAr: string | undefined;
    regionName: string | undefined;
    regionNameAr: string | undefined;
    areaName: string | undefined;
    areaNameAr: string | undefined;
    streetName: string | undefined;
    emirateId: number | undefined;
    online: boolean;
    onsite: boolean;
    onlineURL: string | undefined;
  }>({
    titleEn: "",
    titleAr: "",
    contentEn: "",
    contentAr: "",
    imageUrl: "",
    publishTime: null,
    emirateName: undefined,
    emirateNameAr: undefined,
    regionName: undefined,
    regionNameAr: undefined,
    areaName: undefined,
    areaNameAr: undefined,
    streetName: undefined,
    emirateId: undefined,
    online: false,
    onsite: false,
    onlineURL: "",
  });
  const coverRef = useRef<ICoverRef>(null);
  const LocationRef = useRef<ILocationRef>(null);
  const [coverForm] = Form.useForm<ICoverFieldType>();
  const [contentForm] = Form.useForm<IContentFieldType>();
  const [LocationForm] = Form.useForm<ISEOFieldType>();
  const [EventForm] = Form.useForm<EventPeriodFieldType>();
  const [RegistrationForm] = Form.useForm<RegistrationPeriodFieldType>();
  const [timingForm] = Form.useForm<ITimingFieldType>();
  const userInfo = useUserStore((state) => state.userInfo);
  const { canRenderButton } = useButtonPermission(ADD_EVENT_PERMISSION_ROUTE);
  const canPublish = canRenderButton("CMS.Event.AddEventManagement.Publish");
  const canSaveAndSubmit = canRenderButton(
    "CMS.Event.AddEventManagement.SaveAndSubmit",
  );
  const [publishVisible, setPublishVisible] = useState(false);
  const history = useHistory();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const idParam = searchParams.get("id");
  const id = idParam ? parseInt(idParam, 10) : NaN;
  const [SaveDraftDisabled, setIsSaveDraftDisabled] = useState(false);
  const timingpublishType = Form.useWatch("publishType", timingForm);
  const timingpublishTime = Form.useWatch("publishTime", timingForm);
  const Registrationonline = Form.useWatch("online", RegistrationForm);
  const Registrationonsite = Form.useWatch("onsite", RegistrationForm);
  const RegistrationonlineURL = Form.useWatch("onlineURL", RegistrationForm);
  const contentTitleEn = Form.useWatch("titleEn", contentForm);
  const contentTitleAr = Form.useWatch("titleAr", contentForm);
  const contentContentEn = Form.useWatch("contentEn", contentForm);
  const contentContentAr = Form.useWatch("contentAr", contentForm);
  const locationEmirateId = Form.useWatch("emirateId", LocationForm);
  const locationRegionId = Form.useWatch("regionId", LocationForm);
  const locationAreaId = Form.useWatch("areaId", LocationForm);
  const locationStreet = Form.useWatch("street", LocationForm);
  const eventPublishTime = Form.useWatch("publishTime", EventForm);
  const imageCover = Form.useWatch("imageUrl", coverForm);
  const isFirstCheckAfterInitRef = useRef(false);
  const [coverFileList, setCoverFileList] = useState<UploadFile[]>([]);
  const handleCoverChange = (files: UploadFile[]) => {
    setCoverFileList(files);
    if (!isInitializingRef.current) {
      setHasFormChanged(true);
    }
  };
  const type = searchParams.get("type") ? searchParams.get("type") : "";
  const checkFormValidity = () => {
    const { getFileList } = coverRef.current || {};
    const hasImage = getFileList && getFileList().length > 0;
    const timingValues = timingForm.getFieldsValue();
    const timingValid =
      timingValues.publishType &&
      (timingValues.publishType == "1" ? true : timingValues.publishTime);
    const contentValues = contentForm.getFieldsValue();
    const isContentValid =
      contentValues.titleEn &&
      contentValues.titleAr &&
      contentValues.contentEn &&
      contentValues.contentEn != "<p><br></p>" &&
      contentValues.contentAr &&
      contentValues.contentAr != "<p><br></p>";
    const locationValues = LocationForm.getFieldsValue();
    const isLocationValid =
      locationValues.emirateId &&
      (locationValues.emirateId == 1 ? locationValues.regionId : true) &&
      locationValues.areaId &&
      locationValues.street &&
      locationValues.streetAr;
    const eventValues = EventForm.getFieldsValue();
    const isEventValid =
      eventValues.publishTime &&
      Array.isArray(eventValues.publishTime) &&
      eventValues.publishTime.length === 2;
    console.log(hasImage);

    if (
      hasImage &&
      isContentValid &&
      isLocationValid &&
      isEventValid &&
      imageCover &&
      timingValid
    ) {
      setIsSaveDraftDisabled(false);
    } else {
      setIsSaveDraftDisabled(true);
    }
  };
  const [HasFormChanged, setHasFormChanged] = useState(false);
  const isInitializingRef = useRef(false);

  useEffect(() => {
    // ， hasFormChanged
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
      contentTitleEn,
      contentTitleAr,
      contentContentEn,
      contentContentAr,
      locationEmirateId,
      locationRegionId,
      locationAreaId,
      locationStreet,
      eventPublishTime,
      timingpublishType,
      timingpublishTime,
      Registrationonline,
      Registrationonsite,
      RegistrationonlineURL,
      imageCover,
    ];
    const hasAnyValueChanged = allWatchedValues.some(
      (value) => value !== undefined && value !== null,
    );
    console.log(allWatchedValues, hasAnyValueChanged);

    if (hasAnyValueChanged) {
      setHasFormChanged(true);
    } else {
      setHasFormChanged(false);
    }

    checkFormValidity();
  }, [
    contentTitleEn,
    contentTitleAr,
    contentContentEn,
    contentContentAr,
    locationEmirateId,
    locationRegionId,
    locationAreaId,
    locationStreet,
    eventPublishTime,
    coverRef,
    imageCover,
    timingpublishType,
    timingpublishTime,
    Registrationonline,
    Registrationonsite,
    RegistrationonlineURL,
    coverFileList
  ]);

  useEffect(() => {
    if (id) {
      isInitializingRef.current = true;
      GetEventByIdAsync(id)
        .then((res) => {
          if (coverRef.current) {
            const imageUrl = res.data?.imageUrl ? res.data?.imageUrl : "";
            coverRef.current.setFileList(imageUrl);
            if (imageUrl) {
              const fileList = coverRef.current.getFileList();
              setCoverFileList(fileList);
            }
          }

          contentForm.setFieldValue("titleEn", res.data.titleEn);
          contentForm.setFieldValue("titleAr", res.data.titleAr);
          contentForm.setFieldValue("contentAr", res.data.contentAr);
          contentForm.setFieldValue("contentEn", res.data.contentEn);
          RegistrationForm.setFieldValue("online", res.data.online);
          RegistrationForm.setFieldValue("onsite", res.data.onsite);
          RegistrationForm.setFieldValue("onlineURL", res.data.onlineURL);
          timingForm.setFieldValue("publishType", res.data.publishType);
          if (res.data.publishType == "2") {
            timingForm.setFieldValue(
              "publishTime",
              moment(res.data.publishTime),
            );
          }
          if (res.data.startTime && res.data.endTime) {
            EventForm.setFieldValue("publishTime", [
              moment(res.data.startTime),
              moment(res.data.endTime),
            ]);
          }

          if (LocationRef.current) {
            LocationRef.current
              .setLocationValues({
                emirateId: res.data.emirateId || undefined,
                regionId: res.data.regionId || undefined,
                areaId: res.data.areaId || undefined,
                street: res.data.street,
                streetAr: res.data.streetAr,
              })
              .finally(() => {
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    isInitializingRef.current = false;
                    isFirstCheckAfterInitRef.current = true;
                  }, 0);
                });
              });
          } else {
            requestAnimationFrame(() => {
              setTimeout(() => {
                isInitializingRef.current = false;
                isFirstCheckAfterInitRef.current = true;
              }, 0);
            });
          }
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
  const Submit = async (params: Partial<IAddNewsParams>) => {
    let uuid: number = 0;
    try {
      if (type === "edit") {
        await UpdateEventAsync({ ...(params as IAddNewsParams), id: id });
        uuid = id;
      } else {
        uuid = (await addEventAsync(params as IAddNewsParams)).data.id;
      }

      if (params.status == "5") {
        CustomMessage.success(
          t("CMS.addEventManagement.messages.saveDraftSuccess"),
        );
        setHasFormChanged(false);
        history.replace(
          `/cms/EventManagement/addEventManagement?id=${uuid}&type=edit`,
        );
      } else {
        CustomMessage.success(t("CMS.common.operationSuccessful"));
        history.replace("/cms/EventManagement");
      }
    } catch (error) {
      console.error("Error submitting event:", error);
    }
  };

  const formValidates = async (btnStatus: string) => {
    const { getFileList } = coverRef.current || {};
    if (btnStatus === "5") {
      try {
        await coverForm.validateFields();
        await contentForm.validateFields();
        await LocationForm.validateFields();
        await EventForm.validateFields();
        await timingForm.validateFields();
        await RegistrationForm.validateFields();
      } catch {
        return;
      }

      const contentVals = contentForm.getFieldsValue();
      const seoVals = LocationForm.getFieldsValue();
      const EventVals = EventForm.getFieldsValue();
      const timingVals = timingForm.getFieldsValue();
      const regVals = RegistrationForm.getFieldsValue();

      const params = {
        ...contentVals,
        ...seoVals,
        ...EventVals,
        online: regVals.online,
        onsite: regVals.onsite,
        onlineURL: regVals.onlineURL,
        startTime: EventVals.publishTime
          ? toApi(EventVals.publishTime[0])
          : undefined,
        endTime: EventVals.publishTime
          ? toApi(EventVals.publishTime[1])
          : undefined,
        imageUrl: getFileList?.()[0]?.url ?? "",
        userId: userInfo?.id,
        status: btnStatus,
        publishType: timingVals.publishType,
        publishTime:
          timingVals.publishType == "1"
            ? undefined
            : toApi(timingVals.publishTime),
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
            LocationForm.validateFields()
              .then((seoVals) => {
                EventForm.validateFields()
                  .then((EventVals) => {
                    timingForm
                      .validateFields()
                      .then((timingVals) => {
                        RegistrationForm.validateFields()
                          .then((regVals) => {
                            if (btnStatus === SUBMIT_STATUS) {
                              setresumeWorkVisible(true);
                            }
                            const params = {
                              ...contentVals,
                              ...seoVals,
                              ...EventVals,
                              online: regVals.online,
                              onsite: regVals.onsite,
                              onlineURL: regVals.onlineURL,
                              startTime: EventVals.publishTime
                                ? toApi(EventVals.publishTime[0])
                                : undefined,
                              endTime: EventVals.publishTime
                                ? toApi(EventVals.publishTime[1])
                                : undefined,
                              imageUrl: getFileList?.()[0]?.url ?? "",
                              userId: userInfo?.id,
                              status: btnStatus,
                              publishType: timingVals.publishType,
                              publishTime:
                                timingVals.publishType == "1"
                                  ? undefined
                                  : toApi(timingVals.publishTime),
                            };
                            if (btnStatus === "5") {
                              Submit(params);
                            } else {
                              seformValuesa(params);
                            }
                          })
                          .catch(() => {});
                      })
                      .catch(() => {});
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
        await EventForm.validateFields();
        await LocationForm.validateFields();
        const contentValues = contentForm.getFieldsValue();
        const imageUrl = getFileList?.()[0]?.url ?? "";
        const regValues = RegistrationForm.getFieldsValue();
        setPreviewData({
          titleEn: contentValues.titleEn || "",
          titleAr: contentValues.titleAr || "",
          contentEn: contentValues.contentEn || "",
          contentAr: contentValues.contentAr || "",
          online: regValues.online,
          onsite: regValues.onsite,
          onlineURL: regValues.onlineURL,
          imageUrl: imageUrl,
          publishTime: EventForm.getFieldValue("publishTime"),
          emirateName: LocationRef.current?.emirateName,
          emirateNameAr: LocationRef.current?.emirateNameAr,
          regionName: LocationRef.current?.regionName,
          regionNameAr: LocationRef.current?.regionNameAr,
          areaName: LocationRef.current?.areaName,
          areaNameAr: LocationRef.current?.areaNameAr,
          streetName: LocationRef.current?.streetName,
          streetNameAr: LocationRef.current?.streetNameAr,
          emirateId: LocationForm.getFieldValue("emirateId"),
          // address: LocationForm.getFieldValue("street"),
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
        await LocationForm.validateFields();
        await EventForm.validateFields();
        await timingForm.validateFields();
        await RegistrationForm.validateFields();
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
    const seoVals = LocationForm.getFieldsValue();
    const EventVals = EventForm.getFieldsValue();
    const timingVals = timingForm.getFieldsValue();
    const regVals = RegistrationForm.getFieldsValue();
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
      ...EventVals,
      online: regVals.online,
      onsite: regVals.onsite,
      onlineURL: regVals.onlineURL,
      startTime: EventVals.publishTime
        ? toApi(EventVals.publishTime[0])
        : undefined,
      endTime: EventVals.publishTime
        ? toApi(EventVals.publishTime[1])
        : undefined,
      imageUrl: getFileList?.()[0]?.url ?? "",
      userId: userInfo?.id,
      status: publishStatus,
      publishType: timingVals.publishType,
      publishTime:
        timingVals.publishType == "1" ? undefined : toApi(timingVals.publishTime),
    };
    setPublishVisible(false);
    Submit(params);
  };

  return (
    <div className="add-eventManagement-container">
      <div>
        <Cover
          ref={coverRef}
          coverForm={coverForm}
          onChange={handleCoverChange}
        />
      </div>

      <div className="timing-container">
        <details className="timing-details" open>
          <summary className="detail-title">
            <b>{t("CMS.addEventManagement.sections.timing")}</b>
            <div>
              <DownOutlined className="collapse-icon" />
            </div>
          </summary>
          <div className="detail-content">
            <Timing timingForm={timingForm} />
          </div>
        </details>
      </div>
      <div className="timing-container">
        <details className="timing-details" open>
          <summary className="detail-title">
            <b>{t("CMS.addEventManagement.sections.eventPeriod")}</b>
            <div>
              <DownOutlined className="collapse-icon" />
            </div>
          </summary>
          <div className="detail-content">
            <EventPeriod EventForm={EventForm} />
          </div>
        </details>
      </div>
      <div className="seo-container">
        <details className="seo-details" open>
          <summary className="detail-title">
            <b>{t("CMS.addEventManagement.sections.location")}</b>
            <div>
              <DownOutlined className="collapse-icon" />
            </div>
          </summary>
          <div className="detail-content">
            <Location LocationForm={LocationForm} ref={LocationRef} />
          </div>
        </details>
      </div>

      <div className="seo-container">
        <details className="seo-details" open>
          <summary className="detail-title">
            <b>{t("CMS.addEventManagement.sections.registration")}</b>
            <div>
              <DownOutlined className="collapse-icon" />
            </div>
          </summary>
          <div className="detail-content">
            <Registration RegistrationForm={RegistrationForm} />
          </div>
        </details>
      </div>
      <div className="content-container">
        <details className="content-details" open>
          <summary className="detail-title">
            <b>{t("CMS.addEventManagement.sections.content")}</b>
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
        title={t("CMS.modals.publishEvent.title")}
        content={t("CMS.modals.publishEvent.content")}
        cancelText={t("CMS.common.cancel")}
        confirmText={t("CMS.common.confirm")}
        onCancel={() => setPublishVisible(false)}
        onConfirm={doPublish}
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
