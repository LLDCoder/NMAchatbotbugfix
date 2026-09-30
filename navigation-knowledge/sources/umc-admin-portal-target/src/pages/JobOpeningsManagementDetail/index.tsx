import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { Col, Row } from "antd";
import { useLocation, useHistory } from "react-router-dom";
import NewsDetail1 from "@/assets/images/NewsDetail1.svg";
import NewsDetail2 from "@/assets/images/NewsDetail2.svg";
import NewsDetail3 from "@/assets/images/NewsDetail3.svg";
import NewsDetail4 from "@/assets/images/NewsDetail4.svg";
import redError from "@/assets/images/redError.svg";
import {
  GetJobByIdAsync,
  ApproveJob,
  DeleteJob,
  UnpublishJob,
  type INewsItem,
} from "@/services/cms";
import { CmsDetailFooter, ConfirmModal, CustomMessage } from "@/components/common";
import moment from "moment";
import { DownOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { transformNoValueString, transformSpaceString } from "@/utils/transform";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { RejectPublishModal } from "../JobOpeningsManagement/components/RejectPublishModal";
import type { IRejectModalRef } from "../JobOpeningsManagement/components/RejectPublishModal/type";
import { Preview } from "../AddJobOpeningsManagement/Preview";
import "./index.less";

type HeaderItemKey = "jobNo" | "status" | "updatedBy" | "lastUpdatedTime";

type HeaderItem = {
  key: HeaderItemKey;
  title: string;
  value?: string;
  rawValue?: string;
  img: React.ReactNode;
};

const JOB_STATUS_LABEL_KEYS: Record<string, string> = {
  Published: "published",
  "Pending Review": "pendingReview",
  Draft: "draft",
  Rejected: "rejected",
  Unpublished: "unpublished",
};

type LocalizedInfo = {
  name?: string;
  nameEn?: string;
  nameAr?: string;
};

type JobDetailInfo = Partial<INewsItem> & {
  jobNo?: string;
  jobTitleEn?: string;
  jobTitleAr?: string;
  jobTypes?: string;
  emirateId?: number;
  jobTypesInfo?: LocalizedInfo;
  emirateInfo?: LocalizedInfo;
  applicationDeadline?: string;
};

const JobOpeningsManagementDetail: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const idParam = searchParams.get("id");
  const id = idParam ? parseInt(idParam, 10) : NaN;
  const [DetailInfo, setDetailInfo] = useState<JobDetailInfo | null>(null);
  const [delVisible, setDelVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const rejectModalRef = useRef<IRejectModalRef>(null);
  const history = useHistory();
  const isArabic = i18n.resolvedLanguage === "ar";
  const getLocalizedName = useCallback((info?: LocalizedInfo) => {
    if (!info) return "";
    return isArabic
      ? info.nameAr || info.nameEn || info.name || ""
      : info.nameEn || info.name || info.nameAr || "";
  }, [isArabic]);
  const getStatusLabel = useCallback((statusName?: string) => {
    if (!statusName) return "";
    const key = JOB_STATUS_LABEL_KEYS[statusName];
    return key
      ? t(`CMS.jobOpeningsManagement.statuses.${key}`)
      : statusName;
  }, [t]);

  const headerList = useMemo<HeaderItem[]>(() => {
    const lastUpdated =
      DetailInfo?.updateAt != null
        ? moment(DetailInfo.updateAt).format("DD/MM/YYYY HH:mm:ss")
        : transformNoValueString(undefined);
    return [
      {
        key: "jobNo" as HeaderItemKey,
        title: t("CMS.jobOpeningsManagementDetail.header.jobNo"),
        value: DetailInfo?.jobNo,
        img: <img src={NewsDetail1} alt="" />,
      },
      {
        key: "status" as HeaderItemKey,
        title: t("CMS.jobOpeningsManagementDetail.header.status"),
        value: getStatusLabel(DetailInfo?.statusInfo?.name),
        rawValue: DetailInfo?.statusInfo?.name,
        img: <img src={NewsDetail2} alt="" />,
      },
      {
        key: "updatedBy" as HeaderItemKey,
        title: t("CMS.jobOpeningsManagementDetail.header.updatedBy"),
        value: DetailInfo?.updateOnInfo?.name,
        img: <img src={NewsDetail3} alt="" />,
      },
      {
        key: "lastUpdatedTime" as HeaderItemKey,
        title: t("CMS.jobOpeningsManagementDetail.header.lastUpdatedTime"),
        value: lastUpdated,
        img: <img src={NewsDetail4} alt="" />,
      },
    ];
  }, [DetailInfo, t, getStatusLabel]);

  const loadDetail = () => {
    if (Number.isNaN(id)) return;
    GetJobByIdAsync(id).then((res) => {
      setDetailInfo(res.data);
    });
  };
  useEffect(() => {
    loadDetail();
  }, [id]);

  const status = DetailInfo?.statusInfo?.name || "";

  const handleApprove = () => {
    ApproveJob(id)
      .then(() => {
        CustomMessage.success(t("CMS.common.operationSuccessful"));
        loadDetail();
      })
      .catch(() => {
        CustomMessage.error(
          t("CMS.jobOpeningsManagement.messages.operationFailed")
        );
      });
  };

  const handleDelete = () => {
    DeleteJob(id)
      .then(() => {
        CustomMessage.success(t("CMS.common.operationSuccessful"));
        history.push("/cms/JobOpeningsManagement");
      })
      .finally(() => setDelVisible(false));
  };

  const handleUnpublish = () => {
    UnpublishJob(id).then(() => {
      CustomMessage.success(t("CMS.common.operationSuccessful"));
      loadDetail();
    });
  };

  const goEdit = () => {
    history.push(
      `/cms/JobOpeningsManagement/addJobOpeningsManagement?id=${id}&type=edit`
    );
  };

  const goDuplicate = () => {
    history.push(
      `/cms/JobOpeningsManagement/addJobOpeningsManagement?id=${id}&type=duplicate`
    );
  };

  return (
    <div className="news-management-detail">
      {DetailInfo?.status === "4" && (
        <div className="news-management-detail-reject">
          <img src={redError} alt="" />
          <div>
            <div className="news-management-detail-reject-title">
              {t("CMS.jobOpeningsManagementDetail.rejection.contentNotApproved")}
            </div>
            <div className="news-management-detail-reject-content text-ellipsis-2">
              {DetailInfo?.rejectedReason}
            </div>
          </div>
        </div>
      )}

      <div className="news-management-detail-header">
        <p className="news-management-detail-header-title">
          {DetailInfo?.titleEn}
        </p>

        <div className="news-management-detail-header-list">
          {headerList.map((item) => (
            <div className="news-management-detail-header-item" key={item.key}>
              <div className="news-management-detail-header-item-img">
                {item.img}
              </div>
              <div className="news-management-detail-header-dom">
                <div className="news-management-detail-header-item-title">
                  {item.title}
                </div>
                {item.key === "status" ? (
                  <div
                    className={`status-tag ${transformSpaceString(
                      item.rawValue || item.value,
                    )}`}
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
      </div>
      <details className="news-management-detail-body" open>
        <summary className="detail-title news-management-detail-body-title nomb">
          <div>{t("CMS.jobOpeningsManagement.sections.basicInformation")}</div>
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
                    <div className="news-management-detail-body-label">
                      {t("CMS.jobOpeningsManagement.basicInformation.labels.englishJobTitle")}
                    </div>
                    <div className="news-management-detail-body-value mb20">
                      {DetailInfo?.jobTitleEn}
                    </div>
                  </Col>
                  <Col span={12}>
                    <div className="news-management-detail-body-label">
                      {t("CMS.jobOpeningsManagement.basicInformation.labels.arabicJobTitle")}
                    </div>
                    <div className="news-management-detail-body-value mb20">
                      {DetailInfo?.jobTitleAr}
                    </div>
                  </Col>

                  <Col span={12}>
                    <div className="news-management-detail-body-label">
                      {t("CMS.jobOpeningsManagement.basicInformation.labels.jobLocation")}
                    </div>
                    <div className="news-management-detail-body-value mb20">
                      {transformNoValueString(getLocalizedName(DetailInfo?.emirateInfo))}
                    </div>
                  </Col>

                  <Col span={12}>
                    <div className="news-management-detail-body-label">
                      {t("CMS.jobOpeningsManagement.basicInformation.labels.jobTypes")}
                    </div>
                    <div className="news-management-detail-body-value mb20">
                      {transformNoValueString(getLocalizedName(DetailInfo?.jobTypesInfo))}
                    </div>
                  </Col>

                  <Col span={12}>
                    <div className="news-management-detail-body-label">
                      {t(
                        "CMS.jobOpeningsManagement.basicInformation.labels.applicationDeadline",
                      )}
                    </div>
                    <div className="news-management-detail-body-value mb20">
                      {DetailInfo?.applicationDeadline != null
                        ? moment(DetailInfo.applicationDeadline).format(
                            "DD/MM/YYYY HH:mm:ss",
                          )
                        : ""}
                    </div>
                  </Col>
                </Row>
              </div>
            </div>
          </div>
        </div>
      </details>
      <details className="news-management-detail-body" open>
        <summary className="detail-title news-management-detail-body-title nomb">
          <div>{t("CMS.jobOpeningsManagement.sections.content")}</div>
          <div>
            <DownOutlined className="collapse-icon" />
          </div>
        </summary>
        <div className="detail-content">
          <div>
            <div className="Content-main">
              <div className="Content-dom">
                <div className="news-management-detail-body-label">
                  {t("CMS.jobOpeningsManagementDetail.labels.englishDescription")}
                </div>
                <div
                  className="news-management-detail-body-value"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(DetailInfo?.contentEn),
                  }}
                ></div>
              </div>
              <div className="content-line"></div>
              <div className="Content-dom">
                <div className="news-management-detail-body-label">
                  {t("CMS.jobOpeningsManagementDetail.labels.arabicDescription")}
                </div>
                <div
                  className="news-management-detail-body-value ar"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(DetailInfo?.contentAr),
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </details>

      <CmsDetailFooter
        status={status}
        routePath="/cms/JobOpeningsManagement/JobOpeningsManagementDetail"
        approvePermissionCode="CMS.JobOpenings.JobOpeningsManagementDetail.Approve"
        rejectPermissionCode="CMS.JobOpenings.JobOpeningsManagementDetail.Reject"
        deletePermissionCode="CMS.JobOpenings.JobOpeningsManagementDetail.Delete"
        unpublishPermissionCode="CMS.JobOpenings.JobOpeningsManagementDetail.Unpublish"
        onBack={() => history.push("/cms/JobOpeningsManagement")}
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

      <Preview
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        data={{
          jobTitleEn: DetailInfo?.jobTitleEn || "",
          jobTitleAr: DetailInfo?.jobTitleAr || "",
          contentEn: DetailInfo?.contentEn || "",
          contentAr: DetailInfo?.contentAr || "",
          jobTypes: DetailInfo?.jobTypes || "",
          applicationDeadline: DetailInfo?.applicationDeadline || "",
          emirateId: DetailInfo?.emirateId,
          emirateName: getLocalizedName(DetailInfo?.emirateInfo),
        }}
      />

      <RejectPublishModal ref={rejectModalRef} onCloseCb={loadDetail} />

      <ConfirmModal
        visible={delVisible}
        type="danger"
        title={t("CMS.jobOpeningsManagement.modals.deleteJob.title")}
        content={t("CMS.jobOpeningsManagement.modals.deleteJob.content")}
        cancelText={t("CMS.common.cancel")}
        confirmText={t("CMS.common.confirm")}
        onCancel={() => setDelVisible(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default JobOpeningsManagementDetail;
