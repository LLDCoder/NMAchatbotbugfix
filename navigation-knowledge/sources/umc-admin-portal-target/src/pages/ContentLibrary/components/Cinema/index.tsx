import BookTotal from '@/assets/images/book-total.png';
import BookApproved from '@/assets/images/book-approved.png';
import BookRejected from '@/assets/images/book-rejected.png';
import BookPending from '@/assets/images/book-pending.png';
import SortIcon from '@/assets/images/sort.png';
import FilterCountBadge, {
    countAppliedFilters,
} from '@/components/common/FilterCountBadge';
import { Form, Input, Modal, Radio, Row, Select, Table } from 'antd';
import Sousuo from "@/assets/icons/Sousuo";
import { CustomButton, PaginationTotal, ResponsiveFilterModal } from '@/components/common';
import {
    type ResponsiveActionColumnButtonWidthMap,
    useResponsiveActionColumnWidth,
} from '@/hooks/useResponsiveActionColumnWidth';
import './index.less';
import { useEffect, useState } from 'react';
import useKeepAliveActivated from '@/components/KeepAlive/useKeepAliveActivated';
import { getCinemaExportCSV, getCinemaList, getCinemasCount, postChangeCinemaStatus, type ICinemaListRequest, type ICinemaListResponse, type INewsPapersCountResponse } from '@/services/contentLibrary';
import { getLookupData } from '@/services/services';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CustomStatusTag from '@/components/common/CustomStatusTag';
import AlertBanner from '@/components/common/AlertBanner';
import DocumentViewer from '@/components/common/DocumentViewer';
import LanguageListCell from '../LanguageListCell';

type CinemaItem = ICinemaListResponse['items'][0];
type CinemaActionColumnKey = 'changeStatus';

type CinemaLookupOption = {
    id?: number;
    Id?: number;
    nameEn?: string;
    nameAr?: string;
    NameEn?: string;
    NameAr?: string;
};



const CINEMA_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<CinemaActionColumnKey> = {
    changeStatus: {
        default: 144,
        compact: 132,
    },
};

const CINEMA_ACTION_COLUMN_DESKTOP_CONFIG = {
    gap: 0,
    padding: 32,
    minWidth: 112,
    maxWidth: 180,
};

const CINEMA_ACTION_COLUMN_COMPACT_CONFIG = {
    gap: 0,
    padding: 24,
    minWidth: 112,
    maxWidth: 164,
};

const CINEMA_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
    font: '500 16px Inter, sans-serif',
    narrowFont: '500 14px Inter, sans-serif',
    textPadding: 16,
};

export default function Cinema(){
    const { i18n, t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [params, setParams] = useState<Partial<ICinemaListRequest>>({
        PageIndex: 1,
        PageSize: 10,
        SortBy: 'id',
        SortDirection: 1
    });
    const [data, setData] = useState<ICinemaListResponse>({} as ICinemaListResponse);
    const history = useHistory();
    const [cinemasCount, setCinemasCount] = useState<INewsPapersCountResponse>({} as INewsPapersCountResponse);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [changeStatusVisible, setChangeStatusVisible] = useState(false);
    const [selectedBook, setSelectedBook] = useState<ICinemaListResponse['items'][0] | null>(null);
    const [form2] = Form.useForm();
    const [form3] = Form.useForm();
    const [toolbarForm] = Form.useForm();
    const [,update] = useState({});
    const [statusValue, setStatusValue] = useState(null);
    const [changeStatusLoading, setChangeStatusLoading] = useState(false);
    const [confirmModalLoading, setConfirmModalLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [compactFilterVisible, setCompactFilterVisible] = useState(false);
    const [compactFilterValues, setCompactFilterValues] = useState<Record<string, string | undefined>>({});
    const [copyrightsTypeOptions, setCopyrightsTypeOptions] = useState<CinemaLookupOption[]>([]);
    const cinemaActionColumnWidth = useResponsiveActionColumnWidth<
        CinemaItem,
        CinemaActionColumnKey
    >({
        rows: data.items ?? [],
        buttonWidthMap: CINEMA_ACTION_BUTTON_WIDTH_MAP,
        getVisibleActions: (record) =>
            record.status === 'Approved' || record.status === 'Rejected'
                ? ['changeStatus']
                : [],
        getActionLabel: () => t("Content.contentLibrary.actions.changeStatus"),
        desktopConfig: CINEMA_ACTION_COLUMN_DESKTOP_CONFIG,
        compactConfig: CINEMA_ACTION_COLUMN_COMPACT_CONFIG,
        textMeasureConfig: CINEMA_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
    });

    const columns = [
        {
            title: t("Content.contentLibrary.columns.title"),
            dataIndex: 'title',
            key: 'title',
        },
        {
            title: t("Content.contentLibrary.columns.type"),
            dataIndex: i18n.resolvedLanguage === 'ar' ? 'typeNameAr' : 'typeNameEn',
            key: 'type',
        },
        {
            title: t("Content.contentLibrary.columns.language"),
            dataIndex: i18n.resolvedLanguage === 'ar' ? 'languageAr' : 'languageEn',
            key: 'language',
            width: '20rem',
            render(arr: string[]){
                return <LanguageListCell value={arr} />;
            }
        },
        {
            title: t("Content.contentLibrary.columns.copyrightsType"),
            dataIndex: i18n.resolvedLanguage === 'ar' ? 'copyrightsTypeNameAr' : 'copyrightsTypeNameEn',
            key: 'copyrightsType',
        },
        {
            title: t("Content.contentLibrary.columns.status"),
            dataIndex: 'status',
            key: 'status',
            render(t: string){
                return <CustomStatusTag type="newspaperStatus" status={t} />
            }
        },
        {
            title: <span className="content-library-actions-header">{t("Content.contentLibrary.columns.actions")}</span>,
            key: 'action',
            align: "center" as const,
            onHeaderCell: () => ({
                className: 'content-library-actions-column',
            }),
            onCell: () => ({
                className: 'content-library-actions-column',
            }),
            // Design: keep actions reachable while the table scrolls sideways.
            fixed: "right" as const,
            width: cinemaActionColumnWidth,
            render: (text: string, record: CinemaItem) => {
                return <div className='books-table-actions'>
                    {(record.status === 'Approved' || record.status === 'Rejected') ? <CustomButton
                        variant='text'
                        permissionCode={
                            record.status === 'Rejected'
                                ? "Content.ContentLibrary.ConfirmCinema"
                                : "Content.ContentLibrary.ConfirmCinema2"
                        }
                        permissionRoutePath="/content/ContentLibrary"
                        onClick={(e: React.MouseEvent) =>{
                        e.stopPropagation();
                        if(record.status === 'Rejected'){
                            setConfirmModalVisible(true);
                        }
                        if(record.status === 'Approved'){
                            form2.resetFields();
                            setStatusValue(null);
                            setChangeStatusVisible(true);
                        }
                        setSelectedBook(record);
                    }}>{t("Content.contentLibrary.actions.changeStatus")}</CustomButton> : <span className="content-library-actions-empty">-</span>}
                </div>
            },
        },
    ]
    async function pullCinemaList(){
        try{
            setLoading(true);
            const res = await getCinemaList(params);
            if(res.data){
                setData(res.data);
            }
        }finally{
            setLoading(false);
        }
    }
    useKeepAliveActivated({
        onActivated: () => {
            pullCinemaList();
            getCinemasCount().then(res => {
                if(res.data){
                    setCinemasCount(res.data);
                }
            });
        },
    });
    useEffect(() => {
        pullCinemaList();
    }, [params])

    useEffect(() => { 
        getCinemasCount().then(res => {
            if(res.data){
                setCinemasCount(res.data);
            }
        })
    }, []);
    useEffect(() => {
        let cancelled = false;
        getLookupData("CopyrightsTypes").then((res: unknown) => {
            if(cancelled){
                return;
            }
            const payload = Array.isArray(res) ? res : (res as { data?: unknown })?.data;
            setCopyrightsTypeOptions(Array.isArray(payload) ? (payload as CinemaLookupOption[]) : []);
        }).catch(() => {
            if(!cancelled){
                setCopyrightsTypeOptions([]);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    function handleExport(){
        setExportLoading(true);
        getCinemaExportCSV({
            ...params,
            PageIndex: 1,
            PageSize: 10000,
        }).finally(()=>{
            setExportLoading(false);
        });
    }
    // The filter modal edits these two fields, so the badge counts them.
    const appliedFilterCount = countAppliedFilters([
        params.copyrightstypeid,
        params.statuscode,
    ]);

    const openCompactFilter = () => {
        const values = toolbarForm.getFieldsValue(["copyrightstypeid", "statuscode"]);
        setCompactFilterValues(values);
        setCompactFilterVisible(true);
    };
    const updateCompactFilter = (name: string, value: string | undefined) => {
        const values = { ...compactFilterValues, [name]: value };
        setCompactFilterValues(values);
    };
    const applyCompactFilter = () => {
        const values = compactFilterValues;
        toolbarForm.setFieldsValue(values);
        setParams({
            ...params,
            ...values,
            PageIndex: 1,
        });
        setCompactFilterVisible(false);
    };
    const resetFilters = () => {
        toolbarForm.resetFields(["SearchKey", "copyrightstypeid", "statuscode"]);
        setCompactFilterValues({});
        setParams({
            ...params,
            SearchKey: undefined,
            copyrightstypeid: undefined,
            statuscode: undefined,
            PageIndex: 1,
        });
    };
    

    return (
        <div className="newspapers-magazines">
            <div className="books-statistics">
                <div className='books-statistics-item'>
                    <div className='books-statistics-icon'>
                        <img src={BookTotal} alt={t("Content.contentLibrary.stats.total")} />
                    </div>
                    <div className='books-statistics-text'>
                        <div className='books-statistics-text-number'>{cinemasCount.total ?? 0}</div>
                        <div className='books-statistics-text-desc'>{t("Content.contentLibrary.stats.total")}</div>
                    </div>
                </div>
                 <div className='books-statistics-item'>
                    <div className='books-statistics-icon'>
                        <img src={BookApproved} alt={t("Content.contentLibrary.stats.approved")} />
                    </div>
                    <div className='books-statistics-text'>
                        <div className='books-statistics-text-number'>{cinemasCount._approveCount ?? 0}</div>
                        <div className='books-statistics-text-desc'>{t("Content.contentLibrary.stats.approved")}</div>
                    </div>
                </div>
                 <div className='books-statistics-item'>
                    <div className='books-statistics-icon'>
                        <img src={BookRejected} alt={t("Content.contentLibrary.stats.rejected")} />
                    </div>
                    <div className='books-statistics-text'>
                        <div className='books-statistics-text-number'>{cinemasCount._rejectCount ?? 0}</div>
                        <div className='books-statistics-text-desc'>{t("Content.contentLibrary.stats.rejected")}</div>
                    </div>
                </div>
                 <div className='books-statistics-item'>
                    <div className='books-statistics-icon'>
                        <img src={BookPending} alt={t("Content.contentLibrary.stats.pendingReview")} />
                    </div>
                    <div className='books-statistics-text'>
                        <div className='books-statistics-text-number'>{cinemasCount._peddingCount ?? 0}</div>
                        <div className='books-statistics-text-desc'>{t("Content.contentLibrary.stats.pendingReview")}</div>
                    </div>
                </div>
            </div>
            <div className='newspapers-magazines-table-wrapper'>
                <Row className='newspapers-magazines-filter responsive-filter-toolbar content-library-filter-toolbar'>
                    <Form form={toolbarForm} className='custorm-form newspapers-magazines-form responsive-filter-toolbar__controls content-library-filter-toolbar__controls' onValuesChange={(values)=>{
                        setParams({
                            ...params,
                            ...values,
                            PageIndex: 1,
                        })
                    }}>
                        <Form.Item name="SearchKey" className='responsive-filter-toolbar__field responsive-filter-toolbar__field--search content-library-filter-toolbar__field content-library-filter-toolbar__field--search'>
                            <Input
                                placeholder={t("common.search")}
                                prefix={<Sousuo className="search-icon" />}
                                allowClear
                            />
                        </Form.Item>
                        <Form.Item name="copyrightstypeid" className='responsive-filter-toolbar__field content-library-filter-toolbar__field content-library-filter-toolbar__field--select content-library-filter-toolbar__field--secondary'>
                            <Select allowClear className='sources-select' dropdownClassName='content-library-select-dropdown' placeholder={t("Content.contentLibrary.filters.allCopyrightsTypes")}>
                                {copyrightsTypeOptions.map((item) => {
                                    const optionValue = item.id ?? item.Id;
                                    return (
                                        <Select.Option key={optionValue} value={optionValue}>
                                            {(i18n.resolvedLanguage === 'ar' ? (item.nameAr ?? item.NameAr) : (item.nameEn ?? item.NameEn)) || '-'}
                                        </Select.Option>
                                    );
                                })}
                            </Select>
                        </Form.Item>
                         <Form.Item name="statuscode" className='responsive-filter-toolbar__field content-library-filter-toolbar__field content-library-filter-toolbar__field--select content-library-filter-toolbar__field--secondary'>
                            <Select allowClear className='statuses-select' dropdownClassName='content-library-select-dropdown' placeholder={t("Content.contentLibrary.filters.allStatuses")}>
                                <Select.Option value="1">{t("Content.contentLibrary.stats.approved")}</Select.Option>
                                <Select.Option value="0">{t("Content.contentLibrary.stats.rejected")}</Select.Option>
                                <Select.Option value="2">{t("Content.contentLibrary.stats.pendingReview")}</Select.Option>
                            </Select>
                        </Form.Item>
                        <CustomButton
                            variant='outline'
                            customClassName='responsive-filter-toolbar__button responsive-filter-toolbar__filter-button content-library-filter-toolbar__filter-button filter-trigger-with-count'
                            onClick={openCompactFilter}
                        >
                            {t("common.filter")}
                            <img className="filter-trigger-funnel" src={SortIcon} alt="" />
                            <FilterCountBadge count={appliedFilterCount} />
                        </CustomButton>
                        <CustomButton
                            variant='outline'
                            text={t("common.reset")}
                            customClassName='responsive-filter-toolbar__button responsive-filter-toolbar__reset-button content-library-filter-toolbar__reset-button'
                            onClick={resetFilters}
                        />
                    </Form>
                    <div className="responsive-filter-toolbar__action content-library-filter-toolbar__action">
                        <CustomButton
                            variant='outline'
                            text={t("common.export")}
                            customClassName='newspapers-magazines-export content-library-filter-toolbar__export-button'
                            loading={exportLoading}
                            onClick={handleExport}
                            permissionCode="Content.ContentLibrary.ExportCinema"
                            permissionRoutePath="/content/ContentLibrary"
                        />
                    </div>
                </Row>
                <ResponsiveFilterModal
                    visible={compactFilterVisible}
                    onCancel={() => setCompactFilterVisible(false)}
                    onApply={applyCompactFilter}
                    fields={[
                    {
                    key: "copyrightstypeid",
                        label: t("Content.contentLibrary.columns.copyrightsType"),
                        element: (
                        <Select
                        allowClear
                        className='sources-select'
                        dropdownClassName='content-library-select-dropdown'
                        placeholder={t("Content.contentLibrary.filters.allCopyrightsTypes")}
                        value={compactFilterValues.copyrightstypeid}
                        onChange={(value) => updateCompactFilter("copyrightstypeid", value)}
                        >
                        {copyrightsTypeOptions.map((item) => {
                        const optionValue = item.id ?? item.Id;
                        return (
                        <Select.Option key={optionValue} value={optionValue}>
                            {(i18n.resolvedLanguage === 'ar' ? (item.nameAr ?? item.NameAr) : (item.nameEn ?? item.NameEn)) || '-'}
                        </Select.Option>
                        );
                        })}
                        </Select>
                        ),
                        },
                        {
                            key: "statuscode",
                            label: t("Content.contentLibrary.columns.status"),
                            element: (
                                <Select
                                    allowClear
                                    className='statuses-select'
                                    dropdownClassName='content-library-select-dropdown'
                                    placeholder={t("Content.contentLibrary.filters.allStatuses")}
                                    value={compactFilterValues.statuscode}
                                    onChange={(value) => updateCompactFilter("statuscode", value)}
                                >
                                    <Select.Option value="1">{t("Content.contentLibrary.stats.approved")}</Select.Option>
                                    <Select.Option value="0">{t("Content.contentLibrary.stats.rejected")}</Select.Option>
                                    <Select.Option value="2">{t("Content.contentLibrary.stats.pendingReview")}</Select.Option>
                                </Select>
                            ),
                        },
                    ]}
                />
                <div className='newspapers-magazines-table'>
                    <Table 
                        className='admin-table' 
                        loading={loading}
                        scroll={{x: "max-content"}}
                        onChange={(page, filter, sorter)=>{
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
                            current: data.currentPage ?? 1,
                            pageSize: data.itemsPerPage ?? 10,
                            total: data.totalItems ?? 0,
                            showSizeChanger: true,
                            pageSizeOptions: ["10", "20", "50"],
                            showTotal: (total: number) => `${data.currentPage ?? 1}/${Math.ceil(total / (data.itemsPerPage ?? 10))}`,
                        }}
                        dataSource={data.items}
                        onRow={(data)=>{
                            return {
                                onClick: () => {
                                    history.push(`/content/ContentLibrary/Movies?id=${data.id}`);
                                }
                            }
                        }}
                        columns={columns} 
                    />
                </div>
                <Modal centered className='books-change-status-modal' footer={false} visible={confirmModalVisible} title={t("Content.contentLibrary.modals.changeStatus")} onCancel={()=>{
                    form3.resetFields();
                    setConfirmModalVisible(false);
                }}>
                    <div className='books-change-status-modal-content'>
                        <AlertBanner type='warning' content={t("Content.contentLibrary.modals.changeStatusToPendingReview")} />
                        <Form form={form3} layout='vertical' className='books-status-form custorm-form'>
                            <Form.Item
                                label={t("Content.contentLibrary.modals.attachments")}
                                name="attachmentsURL"
                            >
                                <DocumentViewer
                                    hasDelete
                                    uploadConfig={{
                                        maxCount: 1,
                                        maxSize: 5,
                                        uploadTip: t("Content.contentLibrary.modals.uploadTip"),
                                        accept: ".jpg,.jpeg,.png",
                                    }}
                                />
                            </Form.Item>
                            <Form.Item label={t("Content.contentLibrary.modals.notes")} name="notes" className='form-item-notes'>
                                <Input.TextArea rows={4} placeholder={t("Content.contentLibrary.modals.enterNotes")} onChange={()=>update({})} maxLength={1000} />
                            </Form.Item>
                            <div className='form-item-notes-num'>
                                {form2.getFieldValue("notes")?.length || 0} / 1000
                            </div>
                        </Form>
                    </div>
                    <div className='books-change-status-modal-footer'>
                        <CustomButton variant="outline" text={t("common.cancel")} onClick={()=>{
                            form3.resetFields();
                            setConfirmModalVisible(false);
                        }} />
                        <CustomButton loading={confirmModalLoading} variant="primary" text={t("common.confirm")} onClick={()=>{
                            const id = selectedBook?.id;
                            if(id){
                                const values = form3.getFieldsValue();
                                setConfirmModalLoading(true);
                                postChangeCinemaStatus({
                                    cinemaId: selectedBook.id,
                                    status: 2,
                                    ...values,
                                }).then(()=>{
                                    setConfirmModalVisible(false);
                                    form3.resetFields();
                                    pullCinemaList();
                                }).finally(()=>{
                                    setConfirmModalLoading(false);
                                });
                            }
                        }} />
                    </div>
                </Modal>
                <Modal centered className='books-change-status-modal' footer={false} visible={changeStatusVisible} title={t("Content.contentLibrary.modals.changeStatus")} onCancel={()=>{
                    form2.resetFields();
                    setChangeStatusVisible(false);
                }}>
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
                            <Form.Item
                                label={t("Content.contentLibrary.modals.attachments")}
                                name="attachmentsURL"
                            >
                                <DocumentViewer
                                    hasDelete
                                    uploadConfig={{
                                        maxCount: 1,
                                        maxSize: 5,
                                        uploadTip: t("Content.contentLibrary.modals.uploadTip"),
                                        accept: ".jpg,.jpeg,.png",
                                    }}
                                />
                            </Form.Item>
                            <Form.Item label={t("Content.contentLibrary.modals.notes")} name="notes" className='form-item-notes'>
                                <Input.TextArea rows={4} placeholder={t("Content.contentLibrary.modals.enterNotes")} onChange={()=>update({})} maxLength={1000} />
                            </Form.Item>
                            <div className='form-item-notes-num'>
                                {form2.getFieldValue("notes")?.length || 0} / 1000
                            </div>
                        </Form>
                    </div>
                    <div className='books-change-status-modal-footer'>
                        <CustomButton variant="outline" text={t("common.cancel")} onClick={()=>{
                            form2.resetFields();
                            setChangeStatusVisible(false);
                        }} />
                        <CustomButton loading={changeStatusLoading} disabled={statusValue === null} variant="primary" text={t("common.confirm")} onClick={()=>{
                            const id = selectedBook?.id;
                            if(id){
                                const values = form2.getFieldsValue();
                                setChangeStatusLoading(true);
                                postChangeCinemaStatus({
                                    cinemaId: Number(id),
                                    status: Number(statusValue),
                                    ...values
                                }).then(()=>{
                                    pullCinemaList();
                                    form2.resetFields();
                                    setChangeStatusVisible(false)
                                }).finally(()=>{
                                    setChangeStatusLoading(false);
                                });
                            }
                        }} />
                    </div>
                </Modal>
            </div>
        </div>
    )
}
