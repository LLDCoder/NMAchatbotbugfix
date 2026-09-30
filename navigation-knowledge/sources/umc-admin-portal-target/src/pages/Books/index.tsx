import Book from "@/assets/images/book.png";
import Sousuo from "@/assets/icons/Sousuo";
import "./index.less";
import { Form, Input, DatePicker, Table, Steps, Modal, Radio, Popover } from "antd";
import { useEffect, useState } from "react";
import Name from "@/assets/icons/Name";
import Time from "@/assets/icons/Time";
import Auth from "@/assets/icons/Auth";
import Draft from "@/assets/icons/Draft";
import CustomButton from "@/components/common/CustomButton";
import { useHistory } from "react-router-dom";
import {
  getBookAppsInfoListById,
  getBookDetailsById,
  getHistoryList,
  postChangeBookStatus,
  type IBookAppsInfoListItem,
  type IBookAppsInfoListRequest,
  type IBookAppsInfoListResponse,
  type IBookDetailsResponse,
  type IGetHistoryListResponse,
} from "@/services/contentLibrary";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import OverflowTooltip from "@/components/common/OverflowTooltip";
import { useTranslation } from "react-i18next";
import moment from "moment";
import { ConfirmModal, PaginationTotal } from "@/components/common";
import AlertBanner from "@/components/common/AlertBanner";
import { debounce } from "lodash";
import user from "@/assets/images/user.png";
import buildings from "@/assets/images/buildings.png";
import gov from "@/assets/images/gov.png";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
import SimpleBar from "@/components/SimpleBar";

const RangePicker = DatePicker.RangePicker;
export default function Books() {
  const { t, i18n } = useTranslation();
  // Align the overflow tooltip to the text start edge (flips for RTL).
  const overflowTooltipPlacement = i18n.resolvedLanguage === "ar" ? "topRight" : "topLeft";
  const history = useHistory();
  const [form] = Form.useForm();
  const [form2] = Form.useForm();
  const [detail, setDetail] = useState<IBookDetailsResponse>(
    {} as IBookDetailsResponse
  );
  const [historyList, setHistoryList] = useState<IGetHistoryListResponse[]>([]);
  const [confirmModalLoading, setConfirmModalLoading] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const urlSearchParams = new URLSearchParams(window.location.search);
  const id = urlSearchParams.get("id");
  const [statusValue, setStatusValue] = useState(null);
  const [changeStatusVisible, setChangeStatuasVisible] = useState(false);
  const [changeStatusLoading, setChangeStatusLoading] = useState(false);
  const [data, setData] = useState<IBookAppsInfoListResponse>(
    {} as IBookAppsInfoListResponse
  );
  const [bookAppsInfoListByIdLoading, setBookAppsInfoListByIdLoading] =
    useState(false);
  const [params, setParams] = useState<IBookAppsInfoListRequest>({
    KeyWord: "",
    bookid: id || "",
    PageSize: 10,
    PageIndex: 1,
    SortBy: "submissionTime",
    SortDirection: 1,
    SubmissionTimeFr: "",
    SubmissionTimeTo: "",
  });
  const columns = [
    {
      title: t("Content.booksDetail.relatedApplications.applicationNo"),
      dataIndex: "applicationNumber",
      key: "applicationNumber",
    },
    {
      title: t("Content.booksDetail.relatedApplications.serviceName"),
      dataIndex: i18n.resolvedLanguage === "en" ? "serviceNameEn" : "serviceNameAr",
      key: "serviceName",
    },
    {
      title: t("Content.booksDetail.relatedApplications.status"),
      dataIndex: i18n.resolvedLanguage === "en" ? "appStatusEn" : "appStatusAr",
      key: "status",

      render(_text: string, record: IBookAppsInfoListItem) {
        return <CustomStatusTag type="appStatus" status={record.appStatusId} />;
      },
    },
    {
      title: t("Content.booksDetail.relatedApplications.applyFor"),
      dataIndex: "applyFor",
      key: "applyFor",
      render(text: string, record: IBookAppsInfoListItem) {
        return (
          <div className="apply-for-wrapper">
            <div className="apply-for-icon">
              {record.userTypeName === "Individual" && (
                <img src={user} alt="" />
              )}
              {record.userTypeName === "Establishment" && (
                <img src={buildings} alt="" />
              )}
              {record.userTypeName === "Government" && <img src={gov} alt="" />}
            </div>
            {text}
          </div>
        );
      },
    },
    {
      title: t("Content.booksDetail.relatedApplications.submissionTime"),
      dataIndex: "submissionTime",
      key: "submissionTime",
      sorter: true,
      render(text: string) {
        return text ? moment(text).format("DD/MM/YYYY HH:mm:ss") : "-";
      },
    },
  ];
  function pullBookAppsInfoListById() {
    setBookAppsInfoListByIdLoading(true);
    getBookAppsInfoListById(params)
      .then((res) => {
        if (res.data) {
          setData(res.data);
        }
      })
      .finally(() => {
        setBookAppsInfoListByIdLoading(false);
      });
  }
  useEffect(() => {
    if (!id) {
      history.goBack();
    } else {
      getBookDetailsById(Number(id)).then((res) => {
        if (res.data) {
          setDetail(res.data);
        }
      });
      getHistoryList(Number(id)).then((res) => {
        if (res.data) {
          setHistoryList(res.data);
        }
      });
    }
  }, []);

  useEffect(() => {
    pullBookAppsInfoListById();
  }, [params]);

  return (
    <div className="books-detial">
      <div className="books-detial-box">
        <div className="books-detail-box">
          <div className="books-detail-header">
            <div className="books-detail-header-image">
              <img src={Book} alt="" />
            </div>
            <div className="books-detail-header-desc">
              <div className="books-detail-header-title">
                <OverflowTooltip
                className="books-detail-header-title-name"
                title={detail.title}
                placement={overflowTooltipPlacement}
                >
                {detail.title ?? "-"}
                </OverflowTooltip>
                <div className="books-detail-header-title-status">
                  <CustomStatusTag
                    type="contentLibraryStatus"
                    status={detail?.status}
                  />
                </div>
              </div>
              <div className="books-detail-header-info">
                <div className="books-detail-header-info__item">
                  {t("Content.booksDetail.labels.isbn")}: {detail.isbn ?? "-"}
                </div>
                <div className="books-detail-header-info__item books-detail-header-info__item--language">
                  <span className="books-detail-header-info__label">
                    {t("Content.booksDetail.labels.language")}:
                  </span>
                  <Popover title={Array.isArray(detail.language) && detail.language.length > 0 ? detail.language?.join(", ") : "-"}>
                    <span className="books-detail-header-info__value">
                      {Array.isArray(detail.language) && detail.language.length > 0 ? detail.language?.join(", ") : "-"}
                    </span>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
          <div className="books-detials-info">
            <div className="books-detials-info-title">{t("Content.booksDetail.labels.bookInformation")}</div>
            <div className="books-detials-info-content">
              <div className="books-details-info-item">
                <div className="books-detail-name">{t("Content.booksDetail.labels.isbn")}</div>
                <div className="books-detial-value">{detail.isbn ?? "-"}</div>
              </div>
              <div className="books-details-info-item">
                <div className="books-detail-name">{t("Content.contentLibrary.columns.authorName")}</div>
                <OverflowTooltip
                className="books-detial-value books-detial-value-title"
                title={detail.authorName}
                placement={overflowTooltipPlacement}
                >
                {detail.authorName ?? "-"}
                </OverflowTooltip>
              </div>
              <div className="books-details-info-item">
                <div className="books-detail-name">{t("Content.contentLibrary.columns.numberOfCopies")}</div>
                <div className="books-detial-value">
                  {detail.numberOfCopies ?? "-"}
                </div>
              </div>
              <div className="books-details-info-item">
                <div className="books-detail-name">{t("Content.booksDetail.labels.printYear")}</div>
                <div className="books-detial-value">
                  {detail.printYear ?? "-"}
                </div>
              </div>
              <div className="books-details-info-item">
                <div className="books-detail-name">{t("Content.contentLibrary.columns.subjectCategory")}</div>
                <div className="books-detial-value">
                  {i18n.resolvedLanguage === "en"
                    ? detail.subjectNameEn ?? "-"
                    : detail.subjectNameAr ?? "-"}
                </div>
              </div>
              <div className="books-details-info-item">
                <div className="books-detail-name">{t("Content.contentLibrary.columns.subjectSubCategory", "Subject Sub Category")}</div>
                <div className="books-detial-value">
                  {i18n.language === "en"
                    ? detail.subjectSubCategoryNameEn ?? "-"
                    : detail.subjectSubCategoryNameAr ?? "-"}
                </div>
              </div>

              <div className="books-details-info-item">
                <div className="books-detail-name">{t("Content.booksDetail.labels.versionNumber")}</div>
                <div className="books-detial-value">
                  {detail.versionNumber ?? "-"}
                </div>
              </div>
              <div className="books-details-info-item">
                <div className="books-detail-name">
                  {t("Content.booksDetail.labels.nationalDepositoryNumber")}
                </div>
                <div className="books-detial-value">
                  {detail.nationalDepositoryNo ?? "-"}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="books-detail-bottom">
          <div className="books-detail-table">
            <div className="books-detail-table-title">{t("Content.booksDetail.relatedApplications.title")}</div>
            <SimpleBar
              className="books-detail-table__scroll"
              autoHide={false}
            >
              <div className="books-detail-table__scroll-content">
                <Form
                  form={form}
                  className="custorm-form books-form"
                  onValuesChange={debounce((values) => {
                    const date = values.date;
                    if (date && date.length === 2) {
                      const [start, end] = date;
                      params.SubmissionTimeFr = start.format("YYYY-MM-DD 00:00:00");
                      params.SubmissionTimeTo = end.format("YYYY-MM-DD 23:59:59");
                    } else {
                      params.SubmissionTimeFr = "";
                      params.SubmissionTimeTo = "";
                    }
                    setParams({
                      ...params,
                      ...values,
                      PageIndex: 1,
                    });
                  }, 300)}
                >
                  <Form.Item name="KeyWord">
                    <Input
                      allowClear
                      placeholder={t("common.search")}
                      prefix={<Sousuo className="books-search-icon" />}
                    />
                  </Form.Item>
                  <Form.Item name="date">
                    <RangePicker
                      className="custorm-picker"
                      getPopupContainer={(node) => node}
                      allowClear
                      separator="-"
                    />
                  </Form.Item>
                </Form>
                <Table
                  onChange={(page, _filter, sorter) => {
                    //@ts-ignore
                    const { field, order } = sorter;
                    setParams({
                      ...params,
                      PageIndex: page.current ?? 1,
                      PageSize: page.pageSize ?? 10,
                      SortBy: field ?? "id",
                      SortDirection: order === "ascend" ? 0 : 1,
                    });
                  }}
                  pagination={{
                    size: "default",
                    current: data.pageIndex,
                    pageSize: data.pageSize,
                    total: data.total,
                    showTotal: (total) => (
                      <PaginationTotal
                        label={t("common.total")}
                        total={total}
                        current={data.pageIndex}
                        pageSize={data.pageSize}
                      />
                    ),
                  }}
                  className="admin-table"
                  loading={bookAppsInfoListByIdLoading}
                  columns={columns}
                  dataSource={data.items}
                />
              </div>
            </SimpleBar>
          </div>
          <div className="books-detail-steps">
            <div className="books-detail-steps-title">{t("Content.booksDetail.statusHistory.title")}</div>
            {Array.isArray(historyList) && historyList.length > 0 ? (
              <Steps progressDot direction="vertical">
                {historyList.map((item) => {
                  return (
                    <Steps.Step
                      title={
                        <div className="books-detail-step">
                          <div className="books-detail-step-title books-detail-step__text">
                            {item.nodeName}
                          </div>
                          <div className="books-detail-step-info">
                            <div className="books-detail-step-name">
                              <div className="books-detail-step-icon">
                                <Name />
                              </div>
                              <span className="books-detail-step__text">
                                {item.approverName}
                              </span>
                            </div>
                            <div className="books-detail-step-date">
                              <div className="books-detail-step-icon">
                                <Time />
                              </div>
                              <span className="books-detail-step__text">
                                {item.approverDate
                                  ? moment(item.approverDate).format(
                                      "DD/MM/YYYY HH:mm"
                                    )
                                  : "-"}
                              </span>
                            </div>
                            <div className="books-detail-step-status">
                              <div className="books-detail-step-icon">
                                <Auth />
                              </div>
                              <span className="books-detail-step__text">
                                {t("Content.booksDetail.statusHistory.status")}:
                                &nbsp;&nbsp;
                              </span>
                              <CustomStatusTag
                                className="books-detail-step__status-tag"
                                type="contentLibraryStatus"
                                status={
                                  item.approvalStatus === 0
                                    ? "Rejected"
                                    : item.approvalStatus === 2
                                    ? "Pending Review"
                                    : "Approved"
                                }
                              />
                            </div>
                          </div>
                          {item.applicationNum && (
                            <div className="books-detail-step-number">
                              <div className="books-detail-step-number-icon">
                                <Draft />
                              </div>
                              <div className="books-detail-step-number-text books-detail-step__text">
                                {item.applicationNum}
                              </div>
                            </div>
                          )}
                        </div>
                      }
                    />
                  );
                })}
              </Steps>
            ) : (
              <div className="books-detail-no-data">
                <EmptyBox title={t("Content.booksDetail.labels.noData")} />
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmModal
        loading={confirmModalLoading}
        onCancel={() => setConfirmModalVisible(false)}
        onConfirm={() => {
          if (id) {
            setConfirmModalLoading(true);
            postChangeBookStatus({
              bookId: Number(id),
              status: 2,
              attachmentsURL: "",
              notes: "",
            })
              .then(() => {
                setConfirmModalVisible(false);
                getBookDetailsById(Number(id)).then((res) => {
                  if (res.data) {
                    setDetail(res.data);
                  }
                });
                getHistoryList(Number(id)).then((res) => {
                  if (res.data) {
                    setHistoryList(res.data);
                  }
                });
              })
              .finally(() => {
                setConfirmModalLoading(false);
              });
          }
        }}
        visible={confirmModalVisible}
        title={t("Content.booksDetail.modals.confirmStatusChangeTitle")}
        content={t("Content.contentLibrary.modals.changeStatusToPendingReview")}
        confirmPermissionCode="Content.ContentLibrary.Books.Save"
        permissionRoutePath="/content/ContentLibrary/Books"
      />
      <Modal
        centered
        className="books-change-status-modal"
        footer={false}
        visible={changeStatusVisible}
        title={t("Content.contentLibrary.modals.changeStatus")}
        onCancel={() => setChangeStatuasVisible(false)}
      >
        <div className="books-change-status-modal-content">
          <AlertBanner
            type="warning"
            content={t("Content.contentLibrary.modals.changeStatusImpact")}
          />
          <Form
            form={form2}
            layout="vertical"
            className="books-status-form custorm-form"
          >
            <Form.Item
              label={t("Content.contentLibrary.modals.newStatus")}
              name="status"
              rules={[
                { required: true, message: t("Content.contentLibrary.modals.selectNewStatus") },
              ]}
            >
              <Radio.Group
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
              >
                <Radio value={0}>{t("Content.contentLibrary.stats.rejected")}</Radio>
                <Radio value={2}>{t("Content.contentLibrary.stats.pendingReview")}</Radio>
              </Radio.Group>
            </Form.Item>
          </Form>
        </div>
        <div className="books-change-status-modal-footer">
          <CustomButton
            variant="outline"
            text={t("common.cancel")}
            onClick={() => setChangeStatuasVisible(false)}
          />
          <CustomButton
            loading={changeStatusLoading}
            disabled={statusValue === null}
            variant="primary"
            text={t("common.save")}
            permissionCode="Content.ContentLibrary.Books.Save"
            permissionRoutePath="/content/ContentLibrary/Books"
            onClick={() => {
              if (id) {
                setChangeStatusLoading(true);
                postChangeBookStatus({
                  bookId: Number(id),
                  status: Number(statusValue),
                  attachmentsURL: "",
                  notes: "",
                })
                  .then(() => {
                    getBookDetailsById(Number(id)).then((res) => {
                      if (res.data) {
                        setDetail(res.data);
                      }
                    });
                    getHistoryList(Number(id)).then((res) => {
                      if (res.data) {
                        setHistoryList(res.data);
                      }
                    });
                    setChangeStatuasVisible(false);
                  })
                  .finally(() => {
                    setChangeStatusLoading(false);
                  });
              }
            }}
          />
        </div>
      </Modal>
      <div className="books-detail-footer detail-action-footer">
        <CustomButton
          variant="outline"
          text={t("common.back")}
          onClick={() => history.goBack()}
        />
        {(detail.status === "Approved" || detail.status === "Rejected") && (
          <CustomButton
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              if (detail.status === "Rejected") {
                setConfirmModalVisible(true);
              }
              if (detail.status === "Approved") {
                form2.resetFields();
                setChangeStatuasVisible(true);
              }
            }}
          >
            {t("Content.contentLibrary.actions.changeStatus")}
          </CustomButton>
        )}
      </div>
    </div>
  );
}
