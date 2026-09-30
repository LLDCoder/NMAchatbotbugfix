import newspapers from '@/assets/images/newspaper.png';
import user from "@/assets/images/user.png";
import buildings from "@/assets/images/buildings.png";
import gov from "@/assets/images/gov.png";
import './index.less';
import { DatePicker, Form, Input, Steps, Table, Spin, Modal, Radio } from 'antd';
import { useEffect, useState } from 'react';
import { getVideoGamesAppsInfoListById, getVideoGamesDetailsById, getVideoGamesStatusHistoryList, postChangeVideoGamesStatus, type ICinemaAppsInfoListRequest, type INewspaperStatusHistoryListResponse, type IVideoGamesAppsInfoListRequest, type IVideoGamesAppsInfoListResponse, type IVideoGamesDetailsResponse } from '@/services/contentLibrary';
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
import Sousuo from "@/assets/icons/Sousuo";

interface IPramas extends ICinemaAppsInfoListRequest{
    date: [moment.Moment, moment.Moment];
}
export default function VideoGames(){
    const { i18n, t } = useTranslation();
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    const [detail, setDetail] = useState<IVideoGamesDetailsResponse>({} as IVideoGamesDetailsResponse);
    const [appsInfoList, setAppsInfoList] = useState<IVideoGamesAppsInfoListResponse>({} as IVideoGamesAppsInfoListResponse);
    const [loading, setLoading] = useState(false);
    const [params, setParams] = useState<IPramas>({} as IPramas);
    const [timeline, setTimeline] = useState<INewspaperStatusHistoryListResponse[]>([]);
    const [timelienLoading, setTimelineLoading] = useState(false);
    const [changeStatusLoading, setChangeStatusLoading] = useState(false);
    const [changeStatusVisible, setChangeStatusVisible] = useState(false);
    const [form2] = Form.useForm();
    const [confirmModalLoading, setConfirmModalLoading] = useState(false);
    const [statusValue, setStatusValue] = useState(null);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const columns = [
        {
            title: t("Content.videoGamesDetail.relatedApplications.applicationNo"),
            dataIndex: 'applicationNumber',
            key: 'applicationNumber',
        },
        {
            title: t("Content.videoGamesDetail.relatedApplications.serviceName"),
            dataIndex: i18n.resolvedLanguage === 'ar' ? 'serviceNameAr' : 'serviceNameEn',
            key: 'serviceName',
        },
        {
            title: t("Content.videoGamesDetail.relatedApplications.status"),
            dataIndex: 'appStatusId',
            key: 'appStatusId',
            render(t: string){
                return <CustomStatusTag type="appStatus" status={t} />
            }
        },
        {
            title: t("Content.videoGamesDetail.relatedApplications.applyFor"),
            dataIndex: 'applyFor',
            key: 'applyFor',
            render(text: string, record: IVideoGamesAppsInfoListResponse['items'][0]) {
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
            title: t("Content.videoGamesDetail.relatedApplications.submissionTime"),
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
            getVideoGamesDetailsById({ videoGamesid: id }).then(res=>{
                if(res.data){
                    setDetail(res.data);
                }
            })
        }
    }
    function getDetailApp(){
        if(id){
            const data:IVideoGamesAppsInfoListRequest = {
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
            getVideoGamesAppsInfoListById({ videoGamesid: id, ...data }).then(res=>{
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
            getVideoGamesStatusHistoryList(id).then(res=>{
                if(res.data){
                    setTimeline(res.data);
                }
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
        <div className="video-games">
            <div className="basic-info">
                <div className="basic-info-header-wrapper">
                    <div className='basic-info-header'>
                        <div className="basic-info-header-icon"><img src={newspapers} /></div>
                        <div className="basic-info-info">
                            <div className="basic-info-header-title-wrapper">
                                <div className="basic-info-header-title">{detail.title || "-"}</div>
                                <CustomStatusTag type="newspaperStatus" status={detail.status} />
                            </div>
                            <div className="basic-info-tips">
                                {t("Content.videoGamesDetail.labels.language")}: {(i18n.resolvedLanguage === 'ar' ? detail.languageAr : detail.languageEn)?.join(', ') || '-'}
                            </div>
                        </div>
                    </div>
                    <div className="basic-info-content">
                        <div className="basic-info-content-title">{t("Content.videoGamesDetail.labels.gameInformation")}</div>
                        <div className="basic-info-content-items">
                            <div className="basic-info-content-item">
                                <div className="basic-info-content-field">{t("Content.videoGamesDetail.labels.category")}</div>
                                <div className="basic-info-content-value">{i18n.resolvedLanguage === 'ar' ? detail.typeNameAr ?? '-': detail.typeNameEn ?? '-'}</div>
                            </div>
                            <div className="basic-info-content-item">
                                <div className="basic-info-content-field">{t("Content.videoGamesDetail.labels.copyrightsType")}</div>
                                <div className="basic-info-content-value">{i18n.resolvedLanguage === 'ar' ? detail.copyrightsTypeNameAr ?? '-': detail.copyrightsTypeNameEn ?? '-'}</div>
                            </div>
                            <div className="basic-info-content-item">
                                <div className="basic-info-content-field">{t("Content.videoGamesDetail.labels.platform")}</div>
                                <div className="basic-info-content-value">{i18n.resolvedLanguage === 'ar' ? detail.platformAr ?? '-': detail.platformEn ?? '-'}</div>
                            </div>
                            <div className="basic-info-content-item">
                                <div className="basic-info-content-field">{t("Content.videoGamesDetail.labels.ageRating")}</div>
                                <div className="basic-info-content-value">{i18n.resolvedLanguage === 'ar' ? detail.ageRatingAr ?? '-': detail.ageRatingEn ?? '-'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="newspapers-content">
                <div className='related-app'>
                    <div className='related-app-title'>{t("Content.videoGamesDetail.relatedApplications.title")}</div>
                    <div className='related-app-filter'>
                        <Form className='custorm-form related-app-form' onValuesChange={(values)=>{
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
                        {t("Content.videoGamesDetail.statusHistory.title")}
                    </div>
                    <Spin spinning={timelienLoading}>
                        <Steps progressDot direction="vertical">
                            {timeline.map(item=>(<Steps.Step title={<div className="tickets-timeline-step">
                                <div className="tickets-timeline-step-title">{item.nodeName}</div>
                                <div className="tickets-timeline-step-item"><User2 />{item.approverName}</div>
                                <div className="tickets-timeline-step-item"><Time />{item.approverDate ? moment(item.approverDate).format('DD/MM/YYYY HH:mm') : ''}</div>
                                <div className="tickets-timeline-step-item">
                                    <Status />
                                    {t("Content.videoGamesDetail.statusHistory.status")}: &nbsp;&nbsp;
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
                    </Spin>
                </div>
            </div>
            <ConfirmModal loading={confirmModalLoading} onCancel={()=>setConfirmModalVisible(false)} onConfirm={()=>{
                if(detail){
                    setConfirmModalLoading(true);
                    postChangeVideoGamesStatus({
                        videoGamesId: detail.id,
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
            }} visible={confirmModalVisible} title={t("Content.videoGamesDetail.modals.confirmStatusChangeTitle")} content={t("Content.contentLibrary.modals.changeStatusToPendingReview")} confirmPermissionCode="Content.ContentLibrary.VideoGames.Save" permissionRoutePath="/content/ContentLibrary/videoGames" />
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
                    <CustomButton loading={changeStatusLoading} disabled={statusValue === null} variant="primary" text={t("common.save")} permissionCode="Content.ContentLibrary.VideoGames.Save" permissionRoutePath="/content/ContentLibrary/videoGames" onClick={()=>{
                        const id = detail?.id;
                            if(id){
                            setChangeStatusLoading(true);
                            postChangeVideoGamesStatus({
                                videoGamesId: Number(id),
                                status: Number(statusValue),
                                attachmentsURL: "",
                                notes: "",
                            }).then(()=>{
                                setChangeStatusVisible(false);
                                getDetail();
                                getTimeline();
                            }).finally(()=>{
                                setChangeStatusLoading(false);
                            });
                        }
                    }} />
                </div>
            </Modal>
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
