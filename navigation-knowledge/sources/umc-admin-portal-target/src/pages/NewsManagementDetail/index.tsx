import React, { useState, useEffect, useRef } from "react";
import {
  Col,
  Row,
  Radio,
  Tooltip,
} from "antd";
import { CmsDetailFooter, ConfirmModal, CustomMessage } from "@/components/common";
import { useLocation, useHistory } from "react-router-dom";
import NewsDetail1 from "@/assets/images/NewsDetail1.svg";
import NewsDetail2 from "@/assets/images/NewsDetail2.svg";
import NewsDetail3 from "@/assets/images/NewsDetail3.svg";
import NewsDetail4 from "@/assets/images/NewsDetail4.svg";
import redError from "@/assets/images/redError.svg";
import {
  GetByIdAsync,
  ApproveNew,
  DeleteAsync,
  UnPublishNew,
  type INewsItem,
} from "@/services/cms";
import moment from "moment";
import { DownOutlined } from "@ant-design/icons";
import Doubt from "@/assets/images/doubt.svg";
import { useTranslation } from "react-i18next";
import { AuthenticatedDocumentImage } from "@/components/common/AuthenticatedDocumentMedia";
import { AuthenticatedDocumentHtml } from "@/components/common/AuthenticatedDocumentHtml";

import { transformSpaceString } from "@/utils/transform";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { RejectPublishModal } from "../NewsManagement/components/RejectPublishModal";
import type { IRejectModalRef } from "../NewsManagement/components/RejectPublishModal/type";
import { Preview } from "../AddNewsManagement/Preview";
import "./index.less";

const renderSeoFieldLabel = (label: string, tooltip: string) => (
  <span className="seo-field-label">
    <span>{label}</span>
    <Tooltip
      title={tooltip}
      placement="topLeft"
      overlayClassName="seo-form-tooltip"
      getPopupContainer={() => document.body}
    >
      <img src={Doubt} alt="" className="seo-field-label__icon" />
    </Tooltip>
  </span>
);

type NewsDetailInfo = Partial<INewsItem> & {
  publishType?: string;
};

const NewsManagementDetail: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const idParam = searchParams.get("id");
  const id = idParam ? parseInt(idParam, 10) : NaN;
  const [DetailInfo, setDetailInfo] = useState<NewsDetailInfo | null>(null);
  const [delVisible, setDelVisible] = useState(false);
  const [scheduledExpiredVisible, setScheduledExpiredVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const rejectModalRef = useRef<IRejectModalRef>(null);
  const history = useHistory();
  const headerList = [
    {
      title: t("CMS.newsManagementDetail.labels.newsNo"),
      value: DetailInfo?.newsNo,
      img: <img src={NewsDetail1} />,
    },
    {
      title: t("CMS.newsManagementDetail.labels.status"),
      value: DetailInfo?.statusInfo?.name,
      img: <img src={NewsDetail2} />,
    },
    {
      title: t("CMS.newsManagementDetail.labels.updatedBy"),
      value: DetailInfo?.updateOnInfo?.name,
      img: <img src={NewsDetail3} />,
    },
    {
      title: t("CMS.newsManagementDetail.labels.lastUpdatedTime"),
      value: moment(DetailInfo?.updateAt).format("DD/MM/YYYY HH:mm:ss"),
      img: <img src={NewsDetail4} />,
    },
  ];
  const loadDetail = () => {
    GetByIdAsync(id).then((res) => {
      setDetailInfo(res.data);
    });
  };
  useEffect(() => {
    loadDetail();
  }, [id]);

  const status = DetailInfo?.statusInfo?.name || "";

  const doApprove = () => {
    ApproveNew(id)
      .then(() => {
        CustomMessage.success(t("CMS.common.operationSuccessful"));
        loadDetail();
      })
      .catch(() => {
        CustomMessage.error(t("CMS.newsManagement.messages.operationFailed"));
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
    DeleteAsync({ id })
      .then(() => {
        CustomMessage.success(t("CMS.common.operationSuccessful"));
        history.push("/cms/NewsManagement");
      })
      .finally(() => setDelVisible(false));
  };

  const handleUnpublish = () => {
    UnPublishNew(id).then(() => {
      CustomMessage.success(t("CMS.common.operationSuccessful"));
      loadDetail();
    });
  };

  const goEdit = () => {
    history.push(`/cms/NewsManagement/AddNewsManagement?id=${id}&type=edit`);
  };

  const goDuplicate = () => {
    history.push(
      `/cms/NewsManagement/AddNewsManagement?id=${id}&type=duplicate`
    );
  };
  return (
    <div className="news-management-detail">
      {DetailInfo?.status === "4" && (
        <div className="news-management-detail-reject">
          <img src={redError} />
          <div>
            <div className="news-management-detail-reject-title">
              {t("CMS.newsManagementDetail.rejection.contentNotApproved")}
            </div>
            <div className="news-management-detail-reject-content text-ellipsis-2">
              {DetailInfo?.rejectedReason}
            </div>
          </div>
        </div>
      )}

      <div className="news-management-detail-header">
        {headerList.map((item, index) => (
          <div className="news-management-detail-header-item" key={index}>
            <div className="news-management-detail-header-item-img">
              {item.img}
            </div>
            <div className="news-management-detail-header-dom">
              <div className="news-management-detail-header-item-title">
                {item.title}
              </div>
              {index === 1 ? (
                <div
                  className={`status-tag ${transformSpaceString(item.value)}`}
                >
                  {item.value}
                </div>
              ) : (
                <div className="news-management-detail-header-item-content">
                  {item.value}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="news-management-detail-body">
        <div className="news-management-detail-body-title">
          {t("CMS.newsManagementDetail.sections.cover")}
        </div>
        <div className="news-management-detail-body-label">
          {t("CMS.newsManagementDetail.labels.image")}
        </div>
        <AuthenticatedDocumentImage
          className="news-management-detail-body-cover"
          src={DetailInfo?.imageUrl}
        />
      </div>
      <div className="news-management-detail-body">
        <div className="news-management-detail-body-title">
          {t("CMS.newsManagementDetail.sections.timing")}
        </div>

        <Row gutter={16}>
          <Col span={12}>
            <div className="news-management-detail-body-label">
              {t("CMS.newsManagementDetail.labels.publishMethod")}
            </div>
            <div className="news-management-detail-body-value">
              {/* {DetailInfo?.publishType == "1" ? "Publish Now" : "Scheduled"} */}
              <Radio.Group value={DetailInfo?.publishType} disabled>
                <Radio value={"1"}>{t("CMS.newsManagementDetail.publishNow")}</Radio>
                <Radio value={"2"}>{t("CMS.newsManagementDetail.scheduled")}</Radio>
              </Radio.Group>
            </div>
          </Col>
          {DetailInfo?.publishType == "2" && (
            <Col span={12}>
              {" "}
              <div className="news-management-detail-body-label">
                {t("CMS.newsManagementDetail.labels.scheduledTime")}
              </div>
              <div className="news-management-detail-body-value">
                {DetailInfo?.publishTime
                  ? moment(DetailInfo?.publishTime).format(
                      "DD/MM/YYYY HH:mm:ss",
                    )
                  : "-"}
              </div>{" "}
            </Col>
          )}
        </Row>
      </div>
      <details className="news-management-detail-body" open>
        <summary className="detail-title news-management-detail-body-title nomb">
          <div>{t("CMS.newsManagementDetail.sections.content")}</div>
          <div>
            <DownOutlined className="collapse-icon" />
          </div>
        </summary>
        <div className="detail-content">
          <div>
            <div className="Content-main">
              <div className="Content-dom">
                <div className="news-management-detail-body-label">
                  {t("CMS.newsManagementDetail.labels.englishTitle")}
                </div>
                <div className="news-management-detail-body-value mb20">
                  {DetailInfo?.titleEn}
                </div>
                <div className="news-management-detail-body-label">
                  {t("CMS.newsManagementDetail.labels.englishContent")}
                </div>
                <AuthenticatedDocumentHtml
                  className="news-management-detail-body-value"
                  html={DetailInfo?.contentEn}
                />
              </div>
              <div className="content-line"></div>
              <div className="Content-dom">
                <div className="news-management-detail-body-label">
                  {t("CMS.newsManagementDetail.labels.arabicTitle")}
                </div>
                <div
                  className="news-management-detail-body-value mb20 ar"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(DetailInfo?.titleAr),
                  }}
                ></div>
                <div className="news-management-detail-body-label">
                  {t("CMS.newsManagementDetail.labels.arabicContent")}
                </div>
                <AuthenticatedDocumentHtml
                  className="news-management-detail-body-value ar"
                  html={DetailInfo?.contentAr}
                />
              </div>
            </div>
          </div>
        </div>
      </details>
      <details className="news-management-detail-body">
        <summary className="detail-title news-management-detail-body-title nomb">
          <div>{t("CMS.newsManagementDetail.sections.seo")}</div>
          <div>
            <DownOutlined className="collapse-icon" />
          </div>
        </summary>
        <div className="detail-content">
          <Row gutter={16}>
            <Col span={12}>
              <div className="news-management-detail-body-label">
                {renderSeoFieldLabel(
                  t("CMS.newsManagementDetail.labels.metaTitle"),
                  t("CMS.addNewsManagement.seo.metaTitleHelperDetailTooltip"),
                )}
              </div>
              <div className="news-management-detail-body-value">
                {DetailInfo?.seotitle}
              </div>
            </Col>
            <Col span={12}>
              <div className="news-management-detail-body-label">
                {renderSeoFieldLabel(
                  t("CMS.newsManagementDetail.labels.metaDescription"),
                  t("CMS.addNewsManagement.seo.metaDescriptionDetailTooltip"),
                )}
              </div>
              <div className="news-management-detail-body-value">
                {DetailInfo?.seodescription}
              </div>
            </Col>
          </Row>
          <Row gutter={16} className="mt44">
            <Col span={12}>
              <div className="news-management-detail-body-label">
                {renderSeoFieldLabel(
                  t("CMS.newsManagementDetail.labels.metaKeywords"),
                  t("CMS.addNewsManagement.seo.metaKeywordsDetailTooltip"),
                )}
              </div>
              <div className="news-management-detail-body-value">
                {DetailInfo?.seokeyWords}
              </div>
            </Col>
          </Row>
        </div>
      </details>

      <CmsDetailFooter
        status={status}
        routePath="/cms/NewsManagement/NewsManagementDetail"
        approvePermissionCode="CMS.News.NewsManagementDetail.Approve"
        rejectPermissionCode="CMS.News.NewsManagementDetail.Reject"
        deletePermissionCode="CMS.News.NewsManagementDetail.Delete"
        unpublishPermissionCode="CMS.News.NewsManagementDetail.Unpublish"
        supportsScheduled
        onBack={() => history.push("/cms/NewsManagement")}
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
        title={t("CMS.newsManagement.modals.deleteNews.title")}
        content={t("CMS.newsManagement.modals.deleteNews.content")}
        cancelText={t("CMS.common.cancel")}
        confirmText={t("CMS.common.confirm")}
        onCancel={() => setDelVisible(false)}
        onConfirm={handleDelete}
      />

      <ConfirmModal
        visible={scheduledExpiredVisible}
        type="warning"
        title={t("CMS.newsManagement.modals.scheduledTimeExpired.title")}
        content={t("CMS.newsManagement.modals.scheduledTimeExpired.content")}
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
        }}
      />
    </div>
  );
};

export default NewsManagementDetail;
