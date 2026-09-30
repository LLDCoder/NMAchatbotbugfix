import { Input, Modal, Pagination } from "antd";
import User3 from "@/assets/icons/User3";
import Tag from "@/assets/icons/Tag";
import Floder from "@/assets/icons/Floder";
import './index.less';
import Cloud from "@/assets/icons/Cloud";
import { useEffect, useState } from "react";
import { ConfirmModal, CustomMessage, PaginationTotal } from "@/components/common";
import { deleteService, getServiceCurrentVersion, getServiceHistoryBackUps, getServiceRestore, type IServiceCurrentVersionResponse, type IServiceHistoryBackUpsRequest, type IServiceHistoryBackUpsResponse } from "@/services/serviceApi";
import moment from "moment";
import debounce from 'lodash/debounce';
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sousuo from "@/assets/icons/Sousuo";
const ADD_NEW_SERVICE_PATH = "/service-management/service-configuration/addnewservice";
const SERVICE_STATUS_DRAFT = "2";
const SERVICE_STATUS_SUSPENDED = "3";

interface IProps{
    visible: boolean;
    serviceCode: string;
    onClose: () => void;
    status: string;
}

export default function History({ visible, serviceCode, status, onClose }: IProps){
    const { t } = useTranslation();
    const normalizedStatus = String(status ?? "").trim();
    const canRestoreHistory =
        normalizedStatus === SERVICE_STATUS_DRAFT ||
        normalizedStatus === SERVICE_STATUS_SUSPENDED;
    const [params, setParams] = useState<IServiceHistoryBackUpsRequest>({
        pageIndex: 1,
        pageSize: 10,
    });
    const history = useHistory();
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [switchLoading, setSwitchLoading] = useState(false);
    const [data, setData] = useState<IServiceHistoryBackUpsResponse>({} as IServiceHistoryBackUpsResponse);
    const [currentVersion, setCurrentVersion] = useState<IServiceCurrentVersionResponse>({} as IServiceCurrentVersionResponse);
    const [deleteModal, setDeleteModal] = useState({
        visible: false,
        serviceId: 0,
    });
    const [switchModal, setSwitchModal] = useState({
        visible: false,
        serviceId: 0,
    });

   
    useEffect(() => { 
        if(visible){
            getServiceHistoryBackUps(serviceCode, params).then((res) => { 
                if(res.data){
                    setData(res.data);
                }
            });
            getServiceCurrentVersion(serviceCode).then((res) => { 
                if(res.data){
                    setCurrentVersion(res.data);
                }
            });
        }
    }, [params, visible]);
    return (
        <Modal
            centered
            className="history-modal"
            visible={visible}
            onCancel={onClose}
            title={t("serviceConfiguration.history.title")}
            footer={null}
        >
            <div className="history-modal-body">
                <div className="history-configuration">
                    <div>
                        <div className="history-configuration-title">
                            {t("serviceConfiguration.history.currentConfiguration")}
                        </div>
                        <div className="history-configuration-items">
                            <div className="history-configuration-item"><User3 />{currentVersion.updateName}</div>
                            <div className="history-configuration-item"><Tag />v{currentVersion.version}</div>
                            <div className="history-configuration-item">
                                <Floder />
                                {t("serviceConfiguration.history.updated")}:
                                {" "}
                                {currentVersion.updateTime
                                    ? moment(currentVersion.updateTime).format('DD/MM/YYYY')
                                    : '-'}
                            </div>
                        </div>
                    </div>
                    <div className="history-view-btns">
                        <div className="history-view-btn" onClick={()=>{
                            history.push(
                                `${ADD_NEW_SERVICE_PATH}?pageTitleKey=pageTitle.viewService&serviceCode=${serviceCode}&id=${currentVersion.serviceId}&view=1`
                            );
                        }}>
                            {t("serviceConfiguration.actions.view")}
                        </div>
                    </div>
                    
                </div>
                <div className="history-search">
                    <Input
                        placeholder={t("common.search")}
                        prefix={<Sousuo className="search-icon" />}
                        className="search-input"
                        allowClear
                        onChange={debounce((e)=>{
                            setParams({
                                ...params,
                                keyword: e.target.value,
                            })
                        }, 300)}
                    />
                </div>
                <div className="history-list">
                    {data.items?.map((item)=>{
                        return <div className="history-li" key={`${item.serviceId}-${item.version}`}>
                            <div className="hisotry-li-top">
                                <div className="hisotry-li-top-left">
                                    <div className="hisotry-li-top-item"><Cloud />{item.updateName}</div>
                                    <div className="hisotry-li-top-item"><Tag />v{item.version}</div>
                                    <div className="hisotry-li-top-item">
                                        <Floder />
                                        {t("serviceConfiguration.history.updated")}:
                                        {" "}
                                        {item.updateTime ? moment(item.updateTime).format('DD/MM/YYYY') : '-'}
                                    </div>
                                </div>
                            <div className="hisotry-li-top-right">
                                    <div className="hisotry-li-tag hisotry-li-tag-open">
                                        {t("serviceConfiguration.history.system")}
                                    </div>
                                </div>
                            </div>
                            <div className="history-li-trigger">
                                {item.text}
                            </div>
                            <div className="history-li-footer">
                                <div className="history-li-footer-btn" onClick={()=>{
                                    history.push(
                                        `${ADD_NEW_SERVICE_PATH}?pageTitleKey=pageTitle.viewService&serviceCode=${serviceCode}&id=${item.serviceId}&view=1&version=${item.version}`
                                    );
                                }}>
                                    {t("serviceConfiguration.actions.view")}
                                </div>
                                <div className={`history-li-footer-btn ${!canRestoreHistory || item.isCurrentVersion ? 'history-li-footer-btn-disabled' : ''}`} onClick={()=>{
                                    if(!canRestoreHistory || item.isCurrentVersion) return ;
                                    setSwitchModal({
                                        visible: true,
                                        serviceId: item.serviceId,
                                    })
                                }}>
                                    {t("serviceConfiguration.actions.restore")}
                                </div>
                                {/* {canRestoreHistory &&<div className="history-li-footer-btn history-li-footer-btn-delete" onClick={()=>setDeleteModal({
                                    visible: true,
                                    serviceId: item.serviceId,
                                })}>
                                    Delete
                                </div>} */}
                            </div>
                        </div>
                    })}
                    
                </div>
                <div className="history-pagination admin-table">
                    <Pagination
                        current={data.currentPage ?? 1}
                        pageSize={data.itemsPerPage ?? 10}
                        total={data.totalItems ?? 0}
                        showTotal={(total) => (
                            <PaginationTotal
                                label={t("common.total")}
                                total={total}
                                current={data.currentPage ?? 1}
                                pageSize={data.itemsPerPage ?? 10}
                            />
                        )}
                        onChange={(pageIndex, pageSize) => {
                            setParams({
                                ...params,
                                pageIndex,
                                pageSize,
                            })
                        }}
                    />
                </div>
            </div>
            <ConfirmModal
                loading={deleteLoading}
                visible={deleteModal.visible}
                type="danger"
                title={t("serviceConfiguration.history.deleteModal.title")}
                content={t("serviceConfiguration.history.deleteModal.content")}
                onCancel={()=>setDeleteModal({
                    visible: false,
                    serviceId: 0,
                })}
                cancelText={t("common.cancel")}
                confirmText={t("common.delete")}
                onConfirm={() => {
                    setDeleteLoading(true);
                    deleteService(deleteModal.serviceId).then((res) => { 
                        if(res.data){
                            setParams({...params});
                            setDeleteModal({
                                visible: false,
                                serviceId: 0,
                            })
                            CustomMessage.success(t("common.operationSuccess"));
                        } else {
                            CustomMessage.error(t("common.operationFailed"));
                        }
                    }).finally(()=>setDeleteLoading(false));
                }}
            />
            <ConfirmModal
                loading={switchLoading}
                visible={switchModal.visible}
                title={t("serviceConfiguration.history.switchModal.title")}
                content={t("serviceConfiguration.history.switchModal.content", {
                    version: data.items?.find((item) => item.serviceId === switchModal.serviceId)?.version ?? "",
                })}
                onCancel={()=>setSwitchModal({
                    visible: false,
                    serviceId: 0,
                })}
                cancelText={t("common.cancel")}
                confirmText={t("common.confirm")}
                onConfirm={() => {
                    setSwitchLoading(true);
                    getServiceRestore(switchModal.serviceId).then((res) => {
                        if(res.data){
                            setParams({...params});
                            setSwitchModal({
                                visible: false,
                                serviceId: 0,
                            })
                            CustomMessage.success(t("common.operationSuccess"));
                        } else {
                            CustomMessage.error(t("common.operationFailed"));
                        }
                    }).finally(()=>setSwitchLoading(false));
                }}
            />
        </Modal>
    )
}
