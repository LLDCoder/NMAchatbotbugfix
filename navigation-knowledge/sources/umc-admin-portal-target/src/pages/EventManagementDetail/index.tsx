import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Col,
  Row,
  Radio,
} from "antd";
import { CmsDetailFooter, ConfirmModal, CustomMessage } from "@/components/common";
import { useLocation, useHistory } from "react-router-dom";
import NewsDetail1 from "@/assets/images/NewsDetail1.svg";
import NewsDetail2 from "@/assets/images/NewsDetail2.svg";
import NewsDetail3 from "@/assets/images/NewsDetail3.svg";
import NewsDetail4 from "@/assets/images/NewsDetail4.svg";
import redError from "@/assets/images/redError.svg";
import {
  GetEventByIdAsync,
  ApproveEvent,
  DeleteEventAsync,
  UnPublishEvent,
  type INewsItem,
} from "@/services/cms";
import moment from "moment";
import { DownOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import { AuthenticatedDocumentHtml } from "@/components/common/AuthenticatedDocumentHtml";

import { transformSpaceString } from "@/utils/transform";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import {
  getEmirateList,
  getRegionList,
  getAreaList,
  type EmirateItem,
  type RegionItem,
  type AreaItem,
} from "@/services/userProfile";
import { RejectPublishModal } from "../EventManagement/components/RejectPublishModal";
import type { IRejectModalRef } from "../EventManagement/components/RejectPublishModal/type";
import { Preview } from "../AddEventManagement/Preview";
import "./index.less";

type EventDetailInfo = Partial<INewsItem> & {
  eventNo?: string;
  publishType?: string;
  startTime?: string;
  endTime?: string;
  emirateId?: number;
  regionId?: number;
  areaId?: number;
  emirateInfo?: { name?: string; nameEn?: string; nameAr?: string };
  regionInfo?: { name?: string; nameEn?: string; nameAr?: string };
  areaInfo?: { name?: string; nameEn?: string; nameAr?: string };
  street?: string;
  streetAr?: string;
  online?: boolean;
  onsite?: boolean;
  onlineURL?: string;
};

const EventManagementDetail: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const idParam = searchParams.get("id");
  const id = idParam ? parseInt(idParam, 10) : NaN;
  const [DetailInfo, setDetailInfo] = useState<EventDetailInfo | null>(null);
  const [delVisible, setDelVisible] = useState(false);
  const [scheduledExpiredVisible, setScheduledExpiredVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [locationLists, setLocationLists] = useState<{
    emirates: EmirateItem[];
    regions: RegionItem[];
    areas: AreaItem[];
  }>({ emirates: [], regions: [], areas: [] });
  const rejectModalRef = useRef<IRejectModalRef>(null);
  const history = useHistory();
  const headerList = [
    {
      title: t("CMS.eventManagementDetail.labels.eventNo"),
      value: DetailInfo?.eventNo,
      img: <img src={NewsDetail1} />,
    },
    {
      title: t("CMS.eventManagementDetail.labels.status"),
      value: DetailInfo?.statusInfo?.name,
      img: <img src={NewsDetail2} />,
    },
    {
      title: t("CMS.eventManagementDetail.labels.updatedBy"),
      value: DetailInfo?.updateOnInfo?.name,
      img: <img src={NewsDetail3} />,
    },
    {
      title: t("CMS.eventManagementDetail.labels.lastUpdatedTime"),
      value: moment(DetailInfo?.updateAt).format("DD/MM/YYYY HH:mm:ss"),
      img: <img src={NewsDetail4} />,
    },
  ];
  const loadDetail = () => {
    GetEventByIdAsync(id).then((res) => {
      setDetailInfo(res.data);
    });
  };
  useEffect(() => {
    loadDetail();
  }, [id]);

  useEffect(() => {
    Promise.all([getEmirateList(), getRegionList(), getAreaList()]).then(
      ([emirateRes, regionRes, areaRes]) => {
        setLocationLists({
          emirates: emirateRes.data,
          regions: regionRes.data,
          areas: areaRes.data,
        });
      },
    );
  }, []);

  const previewLocationNames = useMemo(() => {
    const emirateFromList = locationLists.emirates.find(
      (item) => item.id === DetailInfo?.emirateId,
    );
    const regionFromList = locationLists.regions.find(
      (item) => item.id === DetailInfo?.regionId,
    );
    const areaFromList = locationLists.areas.find(
      (item) => item.id === DetailInfo?.areaId,
    );

    return {
      emirateName:
        emirateFromList?.nameEn ||
        DetailInfo?.emirateInfo?.nameEn ||
        DetailInfo?.emirateInfo?.name,
      emirateNameAr:
        emirateFromList?.nameAr ||
        DetailInfo?.emirateInfo?.nameAr ||
        DetailInfo?.emirateInfo?.name,
      regionName:
        regionFromList?.nameEn ||
        DetailInfo?.regionInfo?.nameEn ||
        DetailInfo?.regionInfo?.name,
      regionNameAr:
        regionFromList?.nameAr ||
        DetailInfo?.regionInfo?.nameAr ||
        DetailInfo?.regionInfo?.name,
      areaName:
        areaFromList?.nameEn ||
        DetailInfo?.areaInfo?.nameEn ||
        DetailInfo?.areaInfo?.name,
      areaNameAr:
        areaFromList?.nameAr ||
        DetailInfo?.areaInfo?.nameAr ||
        DetailInfo?.areaInfo?.name,
    };
  }, [DetailInfo, locationLists]);

  const status = DetailInfo?.statusInfo?.name || "";

  const doApprove = () => {
    ApproveEvent(id)
      .then(() => {
        CustomMessage.success(t("CMS.common.operationSuccessful"));
        loadDetail();
      })
      .catch(() => {
        CustomMessage.error(t("CMS.eventManagement.messages.operationFailed"));
      });
  };

  const handleApprove = () => {
    const isScheduled = DetailInfo?.publishType === "2";
    const expired =
      DetailInfo?.publishTime &&
      moment(DetailInfo.publishTime).isBefore(moment());
    if (isScheduled && expired) {
      setScheduledExpiredVisible(true);
    } else {
      doApprove();
    }
  };

  const handleDelete = () => {
    DeleteEventAsync({ id })
      .then(() => {
        CustomMessage.success(t("CMS.common.operationSuccessful"));
        history.push("/cms/EventManagement");
      })
      .finally(() => setDelVisible(false));
  };

  const handleUnpublish = () => {
    UnPublishEvent(id).then(() => {
      CustomMessage.success(t("CMS.common.operationSuccessful"));
      loadDetail();
    });
  };

  const goEdit = () => {
    history.push(
      `/cms/EventManagement/addEventManagement?id=${id}&type=edit`
    );
  };

  const goDuplicate = () => {
    history.push(
      `/cms/EventManagement/addEventManagement?id=${id}&type=duplicate`
    );
  };
  return (
    <div className="event-management-detail">
      {DetailInfo?.status === "4" && (
        <div className="event-management-detail-reject">
          <img src={redError} />
          <div>
            <div className="event-management-detail-reject-title">
              {t("CMS.eventManagementDetail.rejection.contentNotApproved")}
            </div>
            <div className="event-management-detail-reject-content text-ellipsis-2">
              {DetailInfo?.rejectedReason}
            </div>
          </div>
        </div>
      )}

      <div className="event-management-detail-header">
        <p className="event-management-detail-header-title">
          {DetailInfo?.titleEn}
        </p>

        <div className="event-management-detail-header-list">
          {headerList.map((item, index) => (
            <div className="event-management-detail-header-item" key={index}>
              <div className="event-management-detail-header-item-img">
                {item.img}
              </div>
              <div className="event-management-detail-header-dom">
                <div className="event-management-detail-header-item-title">
                  {item.title}
                </div>
                {item.title == "Status" ? (
                  <div
                    className={`status-tag ${transformSpaceString(item.value)}`}
                  >
                    {item.value}
                  </div>
                ) : (
                  <div className="event-management-detail-header-item-content">
                    {item.value}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="event-management-detail-body">
        <div className="event-management-detail-body-title">
          {t("CMS.eventManagementDetail.sections.cover")}
        </div>
        <div className="event-management-detail-body-label">
          {t("CMS.forms.image")}
        </div>
        <AuthenticatedDocumentImage
          className="event-management-detail-body-cover"
          src={DetailInfo?.imageUrl}
        />
      </div>
      <div className="event-management-detail-body">
        <div className="event-management-detail-body-title">
          {t("CMS.eventManagementDetail.sections.timing")}
        </div>

        <Row gutter={16}>
          <Col span={12}>
            <div className="event-management-detail-body-label">
              {t("CMS.addEventManagement.timing.publishMethod")}
            </div>
            <div className="event-management-detail-body-value">
              <Radio.Group value={DetailInfo?.publishType} disabled>
                <Radio value={"1"}>
                  {t("CMS.addEventManagement.timing.publishNow")}
                </Radio>
                <Radio value={"2"}>
                  {t("CMS.addEventManagement.timing.scheduled")}
                </Radio>
              </Radio.Group>
              {/* {DetailInfo?.publishType === "1" ? "Publish Now" : "Scheduled"} */}
            </div>
          </Col>
          {DetailInfo?.publishType != "1" && (
            <Col span={12}>
              <div className="event-management-detail-body-label">
                {t("CMS.addEventManagement.timing.scheduledTime")}
              </div>
              <div className="event-management-detail-body-value">
                {DetailInfo?.publishTime
                  ? moment(DetailInfo?.publishTime).format(
                    "DD/MM/YYYY HH:mm:ss",
                  )
                  : "-"}
              </div>
            </Col>
          )}
        </Row>
      </div>
      <div className="event-management-detail-body">
        <div className="event-management-detail-body-title">
          {t("CMS.eventManagementDetail.sections.eventPeriod")}
        </div>

        <Row gutter={16}>
          <Col span={12}>
            <div className="event-management-detail-body-label">
              {t("CMS.eventManagementDetail.labels.eventPeriod")}
            </div>
            <div className="event-management-detail-body-value">
              {DetailInfo?.startTime
                ? moment(DetailInfo?.startTime).format("DD/MM/YYYY HH:mm:ss")
                : "-"}{" "}
              -{" "}
              {DetailInfo?.endTime
                ? moment(DetailInfo?.endTime).format("DD/MM/YYYY HH:mm:ss")
                : "-"}
            </div>
          </Col>
        </Row>
      </div>
      <details className="event-management-detail-body" open>
        <summary className="detail-title event-management-detail-body-title nomb">
          <div>{t("CMS.eventManagementDetail.sections.location")}</div>
          <div>
            <DownOutlined className="collapse-icon" />
          </div>
        </summary>
        <div className="detail-content">
          <div>
            <div className="Content-main">
              <div className="Content-dom">
                <Row gutter={16}>
                  <Col span={12}>
                    {" "}
                    <div className="event-management-detail-body-label">
                      {t("CMS.addEventManagement.location.emirate")}
                    </div>
                    <div className="event-management-detail-body-value mb20">
                      {DetailInfo?.emirateInfo?.name}
                    </div>
                  </Col>
                  {DetailInfo?.emirateId == 1 ? (
                    <Col span={12}>
                      {" "}
                      <div className="event-management-detail-body-label">
                        {t("CMS.addEventManagement.location.region")}
                      </div>
                      <div className="event-management-detail-body-value mb20">
                        {DetailInfo?.regionInfo?.name}
                      </div>
                    </Col>
                  ) : (
                    <Col span={12}>
                      {" "}
                      <div className="event-management-detail-body-label">
                        {t("CMS.addEventManagement.location.area")}
                      </div>
                      <div className="event-management-detail-body-value mb20">
                        {DetailInfo?.areaInfo?.name}
                      </div>{" "}
                    </Col>
                  )}
                </Row>
                <Row gutter={16}>
                  {DetailInfo?.emirateId == 1 ? (
                    <Col span={12}>
                      {" "}
                      <div className="event-management-detail-body-label">
                        {t("CMS.addEventManagement.location.area")}
                      </div>
                      <div className="event-management-detail-body-value mb20">
                        {DetailInfo?.areaInfo?.name}
                      </div>{" "}
                    </Col>
                  ) : (
                    ""
                  )}
                  <Col span={12}>
                    {" "}
                    <div className="event-management-detail-body-label">
                      {t("CMS.addEventManagement.location.streetEn")}
                    </div>
                    <div className="event-management-detail-body-value mb20">
                      {DetailInfo?.street}
                    </div>{" "}
                  </Col>
                  <Col span={12}>
                    {" "}
                    <div className="event-management-detail-body-label">
                      {t("CMS.addEventManagement.location.streetAr")}
                    </div>
                    <div className="event-management-detail-body-value mb20">
                      {DetailInfo?.streetAr}
                    </div>{" "}
                  </Col>
                </Row>
              </div>
            </div>
          </div>
        </div>
      </details>

      <details className="event-management-detail-body" open>
        <summary className="detail-title event-management-detail-body-title nomb">
          <div>{t("CMS.eventManagementDetail.sections.registration")}</div>
          <div>
            <DownOutlined className="collapse-icon" />
          </div>
        </summary>
        <div className="detail-content">
          <div>
            <div className="Content-main">
              <div className="Content-dom">
                <Row gutter={16}>
                  <Col span={12}>
                    {" "}
                    <div className="event-management-detail-body-label">
                      {t("CMS.eventManagementDetail.labels.registrationMethod")}
                    </div>
                    <div className="event-management-detail-body-value mb20">
                      {DetailInfo?.onsite && DetailInfo?.online
                        ? t("CMS.eventManagement.registrationTypes.both")
                        : DetailInfo?.onsite
                          ? t("CMS.eventManagement.registrationTypes.onSite")
                          : DetailInfo?.online
                            ? t("CMS.eventManagement.registrationTypes.online")
                            : "-"}
                    </div>
                  </Col>
                  {DetailInfo?.online ? (
                    <Col span={12}>
                      {" "}
                      <div className="event-management-detail-body-label">
                        {t(
                          "CMS.eventManagementDetail.labels.onlineRegistrationLink",
                        )}
                      </div>
                      <div className="event-management-detail-body-value mb20">
                        {DetailInfo?.onlineURL || "-"}
                      </div>
                    </Col>
                  ) : (
                    <Col span={12}>
                      {" "}
                      <div className="event-management-detail-body-label">
                        {t("CMS.eventManagementDetail.labels.area")}
                      </div>
                      <div className="event-management-detail-body-value mb20">
                        {DetailInfo?.areaInfo?.name}
                      </div>{" "}
                    </Col>
                  )}
                </Row>
              </div>
            </div>
          </div>
        </div>
      </details>
      <details className="event-management-detail-body" open>
        <summary className="detail-title event-management-detail-body-title nomb">
          <div>{t("CMS.eventManagementDetail.sections.content")}</div>
          <div>
            <DownOutlined className="collapse-icon" />
          </div>
        </summary>
        <div className="detail-content">
          <div>
            <div className="Content-main">
              <div className="Content-dom">
                <div className="event-management-detail-body-label">
                  {t("CMS.eventManagementDetail.labels.englishTitle")}
                </div>
                <div className="event-management-detail-body-value mb20">
                  {DetailInfo?.titleEn}
                </div>
                <div className="event-management-detail-body-label">
                  {t("CMS.eventManagementDetail.labels.englishContent")}
                </div>
                <AuthenticatedDocumentHtml
                  className="event-management-detail-body-value"
                  html={DetailInfo?.contentEn}
                />
              </div>
              <div className="content-line"></div>
              <div className="Content-dom">
                <div className="event-management-detail-body-label">
                  {t("CMS.eventManagementDetail.labels.arabicTitle")}
                </div>
                <div
                  className="event-management-detail-body-value mb20 ar"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(DetailInfo?.titleAr),
                  }}
                ></div>
                <div className="event-management-detail-body-label">
                  {t("CMS.eventManagementDetail.labels.arabicContent")}
                </div>
                <AuthenticatedDocumentHtml
                  className="event-management-detail-body-value ar"
                  html={DetailInfo?.contentAr}
                />
              </div>
            </div>
          </div>
        </div>
      </details>

      <CmsDetailFooter
        status={status}
        routePath="/cms/EventManagement/EventManagementDetail"
        approvePermissionCode="CMS.Event.NewsManagementDetail.Approve"
        rejectPermissionCode="CMS.Event.NewsManagementDetail.Reject"
        deletePermissionCode="CMS.Event.NewsManagementDetail.Delete"
        unpublishPermissionCode="CMS.Event.NewsManagementDetail.Unpublish"
        supportsScheduled
        onBack={() => history.push("/cms/EventManagement")}
        onPreview={() => setPreviewVisible(true)}
        onApprove={handleApprove}
        onReject={() => {
          rejectModalRef.current?.show();
          rejectModalRef.current?.setId(id);
        }}
        onEdit={goEdit}
        onDelete={() => setDelVisible(true)}
        onUnpublish={handleUnpublish}
        onDuplicate={goDuplicate}
      />

      <RejectPublishModal ref={rejectModalRef} onCloseCb={loadDetail} />

      <ConfirmModal
        visible={delVisible}
        type="danger"
        title={t("CMS.eventManagement.modals.deleteEvent.title")}
        content={t("CMS.eventManagement.modals.deleteEvent.content")}
        cancelText={t("CMS.common.cancel")}
        confirmText={t("CMS.common.confirm")}
        onCancel={() => setDelVisible(false)}
        onConfirm={handleDelete}
      />

      <ConfirmModal
        visible={scheduledExpiredVisible}
        type="warning"
        title={t("CMS.eventManagement.modals.scheduledTimeExpired.title")}
        content={t("CMS.eventManagement.modals.scheduledTimeExpired.content")}
        cancelText={t("CMS.common.cancel")}
        confirmText={t("CMS.common.confirm")}
        onCancel={() => setScheduledExpiredVisible(false)}
        onConfirm={() => {
          setScheduledExpiredVisible(false);
          doApprove();
        }}
      />

      <Preview
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        data={{
          titleEn: DetailInfo?.titleEn || "",
          titleAr: DetailInfo?.titleAr || "",
          contentEn: DetailInfo?.contentEn || "",
          contentAr: DetailInfo?.contentAr || "",
          imageUrl: DetailInfo?.imageUrl || "",
          publishTime:
            DetailInfo?.startTime && DetailInfo?.endTime
              ? [moment(DetailInfo.startTime), moment(DetailInfo.endTime)]
              : undefined,
          emirateName: previewLocationNames.emirateName,
          emirateNameAr: previewLocationNames.emirateNameAr,
          regionName: previewLocationNames.regionName,
          regionNameAr: previewLocationNames.regionNameAr,
          areaName: previewLocationNames.areaName,
          areaNameAr: previewLocationNames.areaNameAr,
          streetName: DetailInfo?.street,
          streetNameAr: DetailInfo?.streetAr,
          emirateId: DetailInfo?.emirateId,
          online: DetailInfo?.online ?? false,
          onsite: DetailInfo?.onsite ?? false,
          onlineURL: DetailInfo?.onlineURL,
        }}
      />
    </div>
  );
};

export default EventManagementDetail;
