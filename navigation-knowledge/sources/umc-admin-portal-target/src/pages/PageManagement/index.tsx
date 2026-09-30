import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tabs } from 'antd';
import { TablePanel, PermissionGuard } from "@/components/common";
import CustomStatusTag from '@/components/common/CustomStatusTag';
import type { ColumnType } from "antd/lib/table/interface";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import Sousuo from "@/assets/icons/Sousuo";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import { 
    type PulishedPageParam,
    getPulishedPageList,
    getDraftPageList,
} from "@/services/cms";
import moment from 'moment';
import RejectModal from './components/RejectModal';
import ApproveModal from './components/ApproveModal';
import {
    type ResponsiveActionColumnButtonWidthMap,
    useResponsiveActionColumnWidth,
} from "@/hooks/useResponsiveActionColumnWidth";
import { useButtonPermission } from "@/routes/access";
import "./index.less";

interface PageManagementInfo {
    pageCode: string;
    status: number;
    updateUser: string;
    updateTime: string;
    id: number;
    hasDraft: boolean;
}

type PageManagementActionKey = "reject" | "approve" | "edit";

const PAGE_MANAGEMENT_ACTION_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<PageManagementActionKey> = {};

const PAGE_MANAGEMENT_ACTION_COLUMN_DESKTOP_CONFIG = {
    gap: 12,
    padding: 32,
    minWidth: 96,
    maxWidth: 180,
};

const PAGE_MANAGEMENT_ACTION_COLUMN_COMPACT_CONFIG = {
    gap: 8,
    padding: 24,
    minWidth: 88,
    maxWidth: 160,
};

const PAGE_MANAGEMENT_ACTION_TEXT_MEASURE_CONFIG = {
    font: "500 16px Inter, sans-serif",
    narrowFont: "500 14px Inter, sans-serif",
    textPadding: 0,
};

const PageManagement = () => {
    const { t } = useTranslation();
    const history = useHistory();
    const { canRenderButton } = useButtonPermission("/cms/pageManagement");
    // The editor pages link back with ?tab=2 so Leave lands on the Draft view
    const [crrentTab, setCrrentTab] = useState(
        new URLSearchParams(window.location.search).get('tab') === '2' ? '2' : '1'
    );
    const initialTabRef = useRef(crrentTab);
    const [loading, setLoading] = useState(false);
    const [hasPending, setHasPending] = useState(false);
    const [tableList, setTableList] = useState<PageManagementInfo[]>([]);
    const [approveModal, setApproveModal] = useState<{ id: number | null, visible: boolean }>({
        id: null,
        visible: false,
    });
    const [rejectModal, setRejectModal] = useState<{ id: number | null, visible: boolean }>({
        id: null,
        visible: false,
    });
    const [listParam, setListParam] = useState<PulishedPageParam>({
        pageIndex: 1,
        pageSize: 10,
        keyWords: ''
    });
    const [dateRange, setDateRange] = useState<[moment.Moment | null, moment.Moment | null] | null>([null, null]);
    const [activationRevision, setActivationRevision] = useState(0);
    const latestRequestIdRef = useRef(0);
    const latestPendingRequestIdRef = useRef(0);
    const getVisiblePageManagementActions = useCallback(
        (record: PageManagementInfo): PageManagementActionKey[] => {
            if (record.status == 50) {
                const actions: PageManagementActionKey[] = [];

                if (canRenderButton("CMS.Pages.Reject")) {
                    actions.push("reject");
                }

                if (canRenderButton("CMS.Pages.Approve")) {
                    actions.push("approve");
                }

                return actions;
            }

            if (crrentTab !== '1' || !record.hasDraft) {
                return ["edit"];
            }

            return [];
        },
        [canRenderButton, crrentTab],
    );
    const getPageManagementActionLabel = useCallback(
        (actionKey: PageManagementActionKey) => {
            if (actionKey === "reject") {
                return t("CMS.common.reject");
            }

            if (actionKey === "approve") {
                return t("CMS.common.approve");
            }

            return t("CMS.common.edit");
        },
        [t],
    );
    const pageManagementActionColumnWidth = useResponsiveActionColumnWidth<
        PageManagementInfo,
        PageManagementActionKey
    >({
        rows: tableList,
        buttonWidthMap: PAGE_MANAGEMENT_ACTION_WIDTH_MAP,
        getVisibleActions: getVisiblePageManagementActions,
        getActionLabel: getPageManagementActionLabel,
        desktopConfig: PAGE_MANAGEMENT_ACTION_COLUMN_DESKTOP_CONFIG,
        compactConfig: PAGE_MANAGEMENT_ACTION_COLUMN_COMPACT_CONFIG,
        textMeasureConfig: PAGE_MANAGEMENT_ACTION_TEXT_MEASURE_CONFIG,
    });
    const refreshHasPending = () => {
        const requestId = latestPendingRequestIdRef.current + 1;
        latestPendingRequestIdRef.current = requestId;
        getDraftPageList({
            pageIndex: 1,
            pageSize: 10
        }).then((res) => {
            if (requestId !== latestPendingRequestIdRef.current) return;
            setHasPending(res.data.totalItems > 0)
        })
    };
    useKeepAliveActivated({
        onActivated: () => {
            const tab = new URLSearchParams(history.location.search).get("tab");
            if (tab === "1" || tab === "2") {
                setCrrentTab(tab);
            }
            setActivationRevision((revision) => revision + 1);
            if (tab !== "2") {
                refreshHasPending();
            }
        },
        onDeactivated: () => {
            latestRequestIdRef.current += 1;
            latestPendingRequestIdRef.current += 1;
            setLoading(false);
            setApproveModal({ id: null, visible: false });
            setRejectModal({ id: null, visible: false });
        },
    });
    const tableColumns: ColumnType<PageManagementInfo>[] = [
        {
            title: t("CMS.pageManagement.table.pageName"),
            dataIndex: "pageCode",
            key: "pageCode",
            width: 250,
        },
        {
            title: t("CMS.pageManagement.table.status"),
            dataIndex: "status",
            key: "status",
            width: 250,
            render: (status: string) => <CustomStatusTag type='pageManagement' status={status} />
        },
        {
            title: t("CMS.pageManagement.table.updatedBy"),
            dataIndex: "updateUserInfo",
            key: "updateUserInfo",
            width: 250,
            render: (record) => record?.name
        },
        {
            title: t("CMS.pageManagement.table.lastUpdated"),
            dataIndex: "updateTime",
            key: "updateTime",
            width: 250,
            render: (updatedTime: string) => moment(updatedTime).format('DD/MM/YYYY HH:mm:ss')
        },
        {
            title: t("CMS.pageManagement.table.actions"),
            width: pageManagementActionColumnWidth,
            render: (_, record) =>  (
            <div className='btn-group'>
                {record.status == 50 ? 
                    <>
                        <PermissionGuard
                            permissionCode="CMS.Pages.Reject"
                            routePath="/cms/pageManagement"
                        >
                            <div className='text-btn'
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setRejectModal({ visible: true, id: record.id })
                                }}
                            >{t("CMS.common.reject")}</div>
                        </PermissionGuard>
                        <PermissionGuard
                            permissionCode="CMS.Pages.Approve"
                            routePath="/cms/pageManagement"
                        >
                            <div className='text-btn'
                            onClick={(e) => {
                                e.stopPropagation();
                                setApproveModal({ visible: true, id: record.id })
                            }}
                            >{t("CMS.common.approve")}</div>
                        </PermissionGuard>
                    </> :
                    <>
                        {(crrentTab !== '1' || !record.hasDraft) ?
                            <div className='text-btn' onClick={(e) => editPage(e, record)}>{t("CMS.common.edit")}</div>:
                            <span>-</span>
                        }
                    </>
                }
            </div>)
        }
    ];
    useEffect(() => {
        if (crrentTab == '1') {
            setTableList([])
            getPulishedList()
        } else {
            setTableList([])
            getDraftList()
        }
    }, [activationRevision, crrentTab, listParam, dateRange])
    useEffect(() => {
        if (initialTabRef.current !== "2") {
            refreshHasPending()
        }
    }, [])
    const viewPage = (e: React.MouseEvent, record: PageManagementInfo) => {
        e.stopPropagation()
        if (record.pageCode == 'Homepage') {
            history.push(`/cms/pageManagement/PageManagementHome?id=${record.id}&isView=true`)
        } else if (record.pageCode == 'About NMA') {
            history.push(`/cms/pageManagement/PageManagementAbout?id=${record.id}&isView=true`)
        } else if (record.pageCode == 'Leadership') {
           history.push(`/cms/pageManagement/PageManagementLeadership?id=${record.id}&isView=true`)
        }
    };
    const editPage = (e: React.MouseEvent, record: PageManagementInfo) => {
        e.stopPropagation()
        if (record.pageCode == 'Homepage') {
            history.push('/cms/pageManagement/PageManagementHome?id=' + record.id)
        } else if (record.pageCode == 'About NMA') {
            history.push('/cms/pageManagement/PageManagementAbout?id=' + record.id)
        } else if (record.pageCode == 'Leadership') {
            history.push('/cms/pageManagement/PageManagementLeadership?id=' + record.id)
        }
    };
    const getPulishedList = () => {
        const requestId = latestRequestIdRef.current + 1;
        latestRequestIdRef.current = requestId;
        setLoading(true)
        getPulishedPageList({
            ...listParam,
            startTime: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : null,
            endTime: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : null
        }).then(res => {
            if (requestId !== latestRequestIdRef.current) return;
            setTableList(res.data.items)
        }).finally(() => {
            if (requestId === latestRequestIdRef.current) {
                setLoading(false)
            }
        })
    };
    const getDraftList = () => {
        const requestId = latestRequestIdRef.current + 1;
        latestRequestIdRef.current = requestId;
        setLoading(true)
        getDraftPageList({
            ...listParam,
            startTime: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : null,
            endTime: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : null
        }).then(res => {
            if (requestId !== latestRequestIdRef.current) return;
            setTableList(res.data.items)
            setHasPending(res.data.totalItems > 0)

        }).finally(() => {
            if (requestId === latestRequestIdRef.current) {
                setLoading(false)
            }
        })
    };
    return (
    <div className='management-container'>
        <Tabs className={`content-tabs ${hasPending && 'tabs-dot'}`} activeKey={crrentTab} onChange={(val) => {
            setListParam({
                pageIndex: 1,
                pageSize: 10,
                keyWords: ''
            })
            setDateRange([null, null])
            setCrrentTab(val)
        }}>
            <Tabs.TabPane tab={t("CMS.pageManagement.tabs.published")} key="1" />
            <Tabs.TabPane className='' tab={t("CMS.pageManagement.tabs.draft")} key="2" />
        </Tabs>
        <div className="content-table">
            {/* <div className="filters">
                <Input
                    placeholder={t("common.search")}
                    prefix={<Sousuo className="search-icon" />}
                    value={listParam.keyWords}
                    onChange={(e) => setListParam({...listParam, keyWords: e.target.value})}
                    className="search-input"
                />
                <RangePicker
                    placeholder={["Start time", "End time"]}
                    format={["DD/MM/YYYY"]}
                    className="search-input"
                    value={dateRange}
                    onChange={(value) => setDateRange(value)}
                    allowClear={true}
                />
            </div> */}
            <TablePanel
                tableProps={{
                    columns: tableColumns,
                    dataSource: tableList,
                    loading: loading,
                    onRow: (record) => ({
                        onClick: (e: React.MouseEvent) => viewPage(e, record)
                    }),
                }}
            />
        </div>
        {/* Approve Modal */}
        <ApproveModal
            visible={approveModal.visible}
            id={approveModal.id}
            onCancel={() => setApproveModal({ visible: false, id: null })}
            refresh={getDraftList}
        />
        {/* Reject Modal */}
        <RejectModal
            visible={rejectModal.visible}
            id={rejectModal.id}
            oncancel={() => setRejectModal({ visible: false, id: null })}
            refresh={getDraftList}
        />
        
    </div>
)
};

export default PageManagement;
