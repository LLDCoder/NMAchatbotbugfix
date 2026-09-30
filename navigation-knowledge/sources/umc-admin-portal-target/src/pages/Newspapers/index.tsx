import newspapers from '@/assets/images/newspaper.png';
import { DownOutlined } from "@ant-design/icons";
import user from "@/assets/images/user.png";
import buildings from "@/assets/images/buildings.png";
import gov from "@/assets/images/gov.png";
import './index.less';
import { DatePicker, Form, Input, Popover, Steps, Table, Spin, Modal, Radio } from 'antd';
import { useEffect, useState } from 'react';
import { getNewspaperAppsInfoListById, getNewspaperDetailsById, getNewspaperStatusHistoryList, postChangeNewspaperStatus, type INewspaperAppsInfoListRequest, type INewspaperAppsInfoListResponse, type INewspaperDetailsResponse, type INewspaperStatusHistoryListResponse } from '@/services/contentLibrary';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import Time from "@/assets/icons/Time";
import User2 from "@/assets/icons/User2";
import Status from "@/assets/icons/Status";
import CustomStatusTag from '@/components/common/CustomStatusTag';
import PaginationTotal from '@/components/common/PaginationTotal';
import Draft from '@/assets/icons/Draft';
import { ConfirmModal, CustomButton, CustomFooter } from '@/components/common';
import AlertBanner from '@/components/common/AlertBanner';
import '../ContentLibrary/index.less';
import Sousuo from "@/assets/icons/Sousuo";
import EmptyBox from "@/components/common/EmptyBox/EmptyBox";
interface IPramas extends INewspaperAppsInfoListRequest{
    KeyWord?: string;
    date: [moment.Moment, moment.Moment];
}

const getNewspaperStatusHistoryItems = (
    response: unknown,
): INewspaperStatusHistoryListResponse[] => {
    if (Array.isArray(response)) return response;

    const responseRecord = response as Record<string, unknown> | null;
    if (!responseRecord) return [];

    if (Array.isArray(responseRecord.data)) {
        return responseRecord.data as INewspaperStatusHistoryListResponse[];
    }
    if (Array.isArray(responseRecord.items)) {
        return responseRecord.items as INewspaperStatusHistoryListResponse[];
    }

    const dataRecord = responseRecord.data as Record<string, unknown> | null;
    if (dataRecord && Array.isArray(dataRecord.items)) {
        return dataRecord.items as INewspaperStatusHistoryListResponse[];
    }

    return [];
};

export default function Newspapers(){
    const { i18n, t } = useTranslation();
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    const [detail, setDetail] = useState<INewspaperDetailsResponse>({} as INewspaperDetailsResponse);
    const [appsInfoList, setAppsInfoList] = useState<INewspaperAppsInfoListResponse>({} as INewspaperAppsInfoListResponse);
    const [loading, setLoading] = useState(false);
    const [params, setParams] = useState<IPramas>({} as IPramas);
    const [popupVisible, setPopupVisible] = useState(false);
    const [timeline, setTimeline] = useState<INewspaperStatusHistoryListResponse[]>([]);
    const [timelienLoading, setTimelineLoading] = useState(false);
    const [changeStatusLoading, setChangeStatusLoading] = useState(false);
    const [changeStatusVisible, setChangeStatusVisible] = useState(false);
    const [form2] = Form.useForm();
    const [confirmModalLoading, setConfirmModalLoading] = useState(false);
    const [statusValue, setStatusValue] = useState(null);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const titleItems = Array.isArray(detail.titles)
        ? detail.titles.reduce<Array<{ language: string; title: string }>>((items, title) => {
            const titleText = typeof title?.key === "string" ? title.key.trim() : "";
            if (!titleText) return items;

            const language = typeof title?.value === "string" ? title.value.trim() : "";
            items.push({
                language: language || "-",
                title: titleText,
            });
            return items;
        }, [])
        : [];
    const columns = [
        {
            title: t("Content.newspapersDetail.relatedApplications.applicationNo"),
            dataIndex: 'applicationNumber',
            key: 'applicationNumber',
        },
        {
            title: t("Content.newspapersDetail.relatedApplications.serviceName"),
            dataIndex: i18n.resolvedLanguage === 'ar' ? 'serviceNameAr' : 'serviceNameEn',
            key: 'serviceName',
        },
        {
            title: t("Content.newspapersDetail.relatedApplications.status"),
            dataIndex: 'appStatusId',
            key: 'appStatusId',
            render(t: string){
                return <CustomStatusTag type="appStatus" status={t} />
            }
        },
        {
            title: t("Content.newspapersDetail.relatedApplications.applyFor"),
            dataIndex: 'applyFor',
            key: 'applyFor',
            render(text: string, record: INewspaperAppsInfoListResponse['items'][0]) {
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
            title: t("Content.newspapersDetail.relatedApplications.submissionTime"),
            dataIndex: 'submissionTime',
            key: 'submissionTime',
            sorter: true,
            render(t: string){
                return !!t ? moment(t).format('DD/MM/YYYY HH:mm:ss') : ''
            }
        },
    ];
    function getDetail(){
        if(id){
            getNewspaperDetailsById({ newspaperid: id }).then(res=>{
                if(res.data){
                    setDetail(res.data);
                }
            })
        }
    }
    function getDetailApp(){
        if(id){
             const data:INewspaperAppsInfoListRequest = {
                KeyWord: params.KeyWord,
                PageIndex: params.PageIndex,
                PageSize: params.PageSize,
                SortBy: params.SortBy,
                SortDirection: params.SortDirection,
            };
            if(params.date){
                data.SubmissionTimeFr = params.date[0].format('YYYY-MM-DD 00:00:00');
                data.SubmissionTimeTo = params.date[1].format('YYYY-MM-DD 23:59:59');
            }
            setLoading(true);
            getNewspaperAppsInfoListById({ newspaperid: id, ...data }).then(res=>{
                if(res.data){
                    setAppsInfoList(res.data);
                }
            }).finally(()=>{
                setLoading(false);
            })
        }
      
    }
    useEffect(()=>{
        getDetailApp();
    }, [params])
    function getTimeline(){
        if(id){
            setTimelineLoading(true)
            getNewspaperStatusHistoryList(id).then(res=>{
                setTimeline(getNewspaperStatusHistoryItems(res));
            }).finally(()=>{
                setTimelineLoading(false);
            })
        }
       
    }
    useEffect(()=>{
        getDetail();
        getTimeline();
    },[])

    return (
        <div className="newspapers">
            <div className="basic-info">
                <div className="basic-info-header-wrapper">
                    <div className='basic-info-header'>
                        <div className="basic-info-header-icon"><img src={newspapers} /></div>
                        <div className="basic-info-info">
                            <div className="basic-info-header-title-box">
                                <div className="basic-info-header-title-wrapper">
                                    <div className="basic-info-header-title">{titleItems[0]?.title || "-"}</div>
                                    <Popover
                                        popupVisible={popupVisible}
                                        onVisibleChange={(visible) => setPopupVisible(visible)}
                                        showArrow={false}
                                        placement="bottomLeft"
                                        trigger="click"
                                        overlayClassName="newspapers-title-popover"
                                        content={
                                            <div className="newspapers-title-popover__list">
                                                {titleItems.map((item, index) => (
                                                    <div className="newspapers-title-popover__item" key={`${item.title}-${index}`}>
                                                        <span className="newspapers-title-popover__language">{item.language}</span>
                                                        <span className="newspapers-title-popover__title">{item.title}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        }
                                    >
                                        <div className={`basic-info-header-num ${popupVisible ? 'popup-visible': ''}`}>
                                            <div className='basic-info-header-title-num'>{t("Content.newspapersDetail.labels.titlesCount", { count: titleItems.length })}</div>
                                            <DownOutlined className="collapse-icon" />
                                        </div>
                                    </Popover>
                                </div>
                                <div><CustomStatusTag type="newspaperStatus" status={detail.status} /></div>
                            </div>
                            <div className="basic-info-tips">
                                {t("Content.newspapersDetail.labels.language")}: {(i18n.resolvedLanguage === 'ar' ? detail.languageAr : detail.languageEn)?.join(', ') || '-'}
                            </div>
                        </div>
                    </div>
                    <div className="basic-info-content">
                        <div className="basic-info-content-title">{t("Content.newspapersDetail.labels.publicationInformation")}</div>
                        <div className="basic-info-content-items">
                            <div className="basic-info-content-item">
                                <div className="basic-info-content-field">{t("Content.contentLibrary.columns.type")}</div>
                                <div className="basic-info-content-value">{detail.type ?? '-'}</div>
                            </div>
                            <div className="basic-info-content-item">
                                <div className="basic-info-content-field">{t("Content.contentLibrary.columns.periodicalType")}</div>
                                <div className="basic-info-content-value">{i18n.resolvedLanguage === 'ar' ? detail.periodicalTypeAr ?? '-': detail.periodicalTypeEn ?? '-'}</div>
                            </div>
                            <div className="basic-info-content-item">
                                <div className="basic-info-content-field">{t("Content.contentLibrary.columns.subjectCategory")}</div>
                                <div className="basic-info-content-value">{i18n.resolvedLanguage === 'ar' ? detail.subjectCategoryAr?.join(',') || '-': detail.subjectCategoryEn?.join(',') || '-'}</div>
                            </div>
                            <div className="basic-info-content-item">
                                <div className="basic-info-content-field">{t("Content.newspapersDetail.labels.language")}</div>
                                <div className="basic-info-content-value">{i18n.resolvedLanguage === 'ar' ? detail.languageAr?.join(',') || '-': detail.languageEn?.join(',') || '-'}</div>
                            </div>
                            <div className="basic-info-content-item">
                                <div className="basic-info-content-field">{t("Content.newspapersDetail.labels.source")}</div>
                                <div className="basic-info-content-value">{detail.source ?? '-'}</div>
                            </div>
                            <div className="basic-info-content-item">
                                <div className="basic-info-content-field">{t("Content.contentLibrary.columns.copies")}</div>
                                <div className="basic-info-content-value">{detail.copies ?? '-'}</div>
                            </div>
                            <div className="basic-info-content-item">
                                <div className="basic-info-content-field">{t("Content.newspapersDetail.labels.lastVersionNumber")}</div>
                                <div className="basic-info-content-value">{detail.lastVersionNumber ?? '-'}</div>
                            </div>
                            <div className="basic-info-content-item">
                                <div className="basic-info-content-field">{t("Content.newspapersDetail.labels.publishingHouse")}</div>
                                <div className="basic-info-content-value">{detail.publishingHouse ?? '-'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="newspapers-content">
                <div className='related-app'>
                    <div className='related-app-title'>{t("Content.newspapersDetail.relatedApplications.title")}</div>
                    <div className='related-app-filter'>
                        <Form className='custorm-form related-app-form' onValuesChange={values=>{
                            setParams({
                                ...params,
                                ...values
                            })
                        }}>
                            <Form.Item name="KeyWord">
                                <Input
                                    placeholder={t("common.search")}
                                    prefix={<Sousuo className="search-icon" />}
                                    allowClear
                                />
                            </Form.Item>
                            <Form.Item name="date">
                                <DatePicker.RangePicker
                                    placeholder={[t("common.startTime"), t("common.endTime")]}
                                    separator="-"
                                    allowClear
                                />
                            </Form.Item>
                        </Form>
                    </div>
                    <div className='related-app-table'>
                    <Table 
                        className='admin-table' 
                        loading={loading}
                        scroll={{x: "max-content"}}
                        onChange={(page, _filter, sorter)=>{
                            // @ts-ignore
                            const { field, order } = sorter;
                            setParams({
                                ...params,
                                PageIndex: page.current ?? 1,
                                PageSize: page.pageSize ?? 10,
                                SortBy: order ? field : 'id',
                                SortDirection: order === 'ascend' ? 0 : 1,
                            });
                        }}
                        pagination={{
                            size: "default",
                            current: appsInfoList.currentPage ?? 1,
                            pageSize: appsInfoList.itemsPerPage ?? 10,
                            total: appsInfoList.totalItems ?? 0,
                            pageSizeOptions: ["10", "20", "50", "100"],
                            showTotal: (total: number) => <PaginationTotal label={t("common.total")} total={total} current={appsInfoList.currentPage ?? 1} pageSize={appsInfoList.itemsPerPage ?? 10} />,
                        }}
                        dataSource={appsInfoList.items}
                        columns={columns} 
                    />
                    </div>
                </div>
                <div className='timeline'>
                    <div className='timeline-title'>
                        {t("Content.newspapersDetail.statusHistory.title")}
                    </div>
                    <Spin spinning={timelienLoading}>
                        {timeline.length > 0 ? (
                            <Steps progressDot direction="vertical">
                                {timeline.map(item=>(<Steps.Step title={<div className="tickets-timeline-step">
                                    <div className="tickets-timeline-step-title">{item.nodeName}</div>
                                    <div className="tickets-timeline-step-item"><User2 />{item.approverName}</div>
                                    <div className="tickets-timeline-step-item"><Time />{item.approverDate ? moment(item.approverDate).format('DD/MM/YYYY HH:mm') : ''}</div>
                                    <div className="tickets-timeline-step-item">
                                        <Status />
                                        {t("Content.newspapersDetail.statusHistory.status")}: &nbsp;&nbsp;
                                        <CustomStatusTag
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
                                    {item.applicationNum && (
                                        <div className="books-detail-step-number">
                                            <div className="books-detail-step-number-icon">
                                                <Draft />
                                            </div>
                                            <div className="books-detail-step-number-text">
                                            {item.applicationNum}
                                            </div>
                                        </div>
                                    )}
                                </div>} />))}
                            </Steps>
                        ) : (
                            <div className="newspapers-timeline__empty">
                                <EmptyBox title={t("common.noData")} />
                            </div>
                        )}
                    </Spin>
                </div>
            </div>
            <Modal centered className='books-change-status-modal' footer={false} visible={changeStatusVisible} title={t("Content.contentLibrary.modals.changeStatus")} onCancel={()=>setChangeStatusVisible(false)}>
                <div className='books-change-status-modal-content'>
                    <AlertBanner type='warning' content={t("Content.contentLibrary.modals.changeStatusImpact")} />
                    <Form form={form2} layout='vertical' className='books-status-form custorm-form'>
                        <Form.Item label={t("Content.contentLibrary.modals.newStatus")} name="status" rules={[
                            {required: true, message: t("Content.contentLibrary.modals.selectNewStatus")}
                        ]}> 
                            <Radio.Group value={statusValue} onChange={(e) => setStatusValue(e.target.value)}> 
                                <Radio value={0}>{t("Content.contentLibrary.stats.rejected")}</Radio>
                                <Radio value={2}>{t("Content.contentLibrary.stats.pendingReview")}</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </Form>
                </div>
                <div className='books-change-status-modal-footer'>
                    <CustomButton variant="outline" text={t("common.cancel")} onClick={()=>setChangeStatusVisible(false)} />
                    <CustomButton loading={changeStatusLoading} disabled={statusValue === null} variant="primary" text={t("common.save")} permissionCode="Content.ContentLibrary.NewsPapers.Save" permissionRoutePath="/content/ContentLibrary/Newspapers" onClick={()=>{
                            if(id){
                            setChangeStatusLoading(true);
                            postChangeNewspaperStatus({
                                newspapeId: Number(id),
                                status: Number(statusValue),
                                attachmentsURL: "",
                                notes: "",
                            }).then(()=>{
                                getDetail();
                                getTimeline();
                                setChangeStatusVisible(false)
                            }).finally(()=>{
                                setChangeStatusLoading(false);
                            });
                        }
                    }} />
                </div>
            </Modal>
            <ConfirmModal loading={confirmModalLoading} onCancel={()=>setConfirmModalVisible(false)} onConfirm={()=>{
                if(detail){
                    setConfirmModalLoading(true);
                    postChangeNewspaperStatus({
                        newspapeId: detail.id,
                        status: 2,
                        attachmentsURL: "",
                        notes: "",
                    }).then(()=>{
                        setConfirmModalVisible(false);
                        getDetail();
                        getTimeline();
                    }).finally(()=>{
                        setConfirmModalLoading(false);
                    });
                }
            }} visible={confirmModalVisible} title={t("Content.newspapersDetail.modals.confirmStatusChangeTitle")} content={t("Content.contentLibrary.modals.changeStatusToPendingReview")} confirmPermissionCode="Content.ContentLibrary.NewsPapers.Save" permissionRoutePath="/content/ContentLibrary/Newspapers" />
            <CustomFooter rightContent={(detail.status === 'Approved' || detail.status === 'Rejected') && <CustomButton text={t("Content.contentLibrary.actions.changeStatus")} onClick={()=>{
                if(detail.status === 'Rejected'){
                    setConfirmModalVisible(true);
                }
                if(detail.status === 'Approved'){
                    form2.resetFields();
                    setChangeStatusVisible(true);
                }
            }} />} />
        </div>
    )
}
