import BookTotal from '@/assets/images/book-total.png';
import BookApproved from '@/assets/images/book-approved.png';
import BookRejected from '@/assets/images/book-rejected.png';
import BookPending from '@/assets/images/book-pending.png';
import SortIcon from '@/assets/images/sort.png';
import FilterCountBadge, {
    countAppliedFilters,
} from '@/components/common/FilterCountBadge';
import Sousuo from '@/assets/icons/Sousuo';
import { Form, Input, Modal, Radio, Row, Select, Table} from 'antd';
import { CustomButton, PaginationTotal, ResponsiveFilterModal } from '@/components/common';
import {
    type ResponsiveActionColumnButtonWidthMap,
    useResponsiveActionColumnWidth,
} from '@/hooks/useResponsiveActionColumnWidth';
import { useEffect, useMemo, useState } from 'react';
import useKeepAliveActivated from '@/components/KeepAlive/useKeepAliveActivated';
import AlertBanner from '@/components/common/AlertBanner';
import { history } from '@/utils/history';
import { getBookList, getBooksCount, type IBookItem, type IBookCountResponse, type IBookListRequest, type IBookListResponse, postChangeBookStatus, getContentLibraryExportCSV } from '@/services/contentLibrary';
import { getSubjectList } from '@/services/services';
import CustomStatusTag from '@/components/common/CustomStatusTag';
import OverflowTooltip from '@/components/common/OverflowTooltip';
import debounce from 'lodash/debounce';
import DocumentViewer from '@/components/common/DocumentViewer';
import { useTranslation } from 'react-i18next';
import LanguageListCell from './LanguageListCell';
type BooksActionColumnKey = 'changeStatus';

type BooksSubjectOption = {
    id: number;
    nameEn?: string;
    nameAr?: string;
};



const BOOKS_ACTION_BUTTON_WIDTH_MAP: ResponsiveActionColumnButtonWidthMap<BooksActionColumnKey> = {
    changeStatus: {
        default: 144,
        compact: 132,
    },
};
const BOOKS_ACTION_COLUMN_DESKTOP_CONFIG = {
    gap: 0,
    padding: 32,
    minWidth: 112,
    maxWidth: 180,
};
const BOOKS_ACTION_COLUMN_COMPACT_CONFIG = {
    gap: 0,
    padding: 24,
    minWidth: 112,
    maxWidth: 164,
};
const BOOKS_ACTION_COLUMN_TEXT_MEASURE_CONFIG = {
    font: '500 16px Inter, sans-serif',
    narrowFont: '500 14px Inter, sans-serif',
    textPadding: 16,
};

export default function Books() { 
    const { i18n, t } = useTranslation();
    const [form1] = Form.useForm();
    const [form2] = Form.useForm();
    const [form3] = Form.useForm();
    const [data, setData] = useState<IBookListResponse>({} as IBookListResponse);
    const [params, setParams] = useState<IBookListRequest>({
        Title: '',
        AuthorName: '',
        ISBN: '',
        PageSize: 10,
        PageIndex: 1,
        SortBy: 'id',
        SortDirection: 1,
        SearchKey: '',
        statuscode: null,
        subjectid: null,
        printyear: null,
    })
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [changeStatusVisible, setChangeStatuasVisible] = useState(false);
    const [statusValue, setStatusValue] = useState(null);
    const [selectedBook, setSelectedBook] = useState<IBookItem | null>(null);
    const [booksCount, setBooksCount] = useState<IBookCountResponse>({} as IBookCountResponse);
    const [confirmModalLoading, setConfirmModalLoading] = useState(false);
    const [changeStatusLoading, setChangeStatusLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [compactFilterVisible, setCompactFilterVisible] = useState(false);
    const [compactFilterValues, setCompactFilterValues] = useState<Record<string, string | undefined>>({});
    const [subjectOptions, setSubjectOptions] = useState<BooksSubjectOption[]>([]);

    const [,update] = useState({});
    const handleFilterValuesChange = useMemo(
        () => debounce((_changedValues, values) => {
            setParams((current) => ({
                ...current,
                ...values,
                PageIndex: 1,
            }));
        }, 300),
        [],
    );
    const booksActionColumnWidth = useResponsiveActionColumnWidth<
        IBookItem,
        BooksActionColumnKey
    >({
        rows: data.items ?? [],
        buttonWidthMap: BOOKS_ACTION_BUTTON_WIDTH_MAP,
        getVisibleActions: (record) =>
            record.status === 'Approved' || record.status === 'Rejected'
                ? ['changeStatus']
                : [],
        getActionLabel: () => t("Content.contentLibrary.actions.changeStatus"),
        desktopConfig: BOOKS_ACTION_COLUMN_DESKTOP_CONFIG,
        compactConfig: BOOKS_ACTION_COLUMN_COMPACT_CONFIG,
        textMeasureConfig: BOOKS_ACTION_COLUMN_TEXT_MEASURE_CONFIG,
    });
    // Align the overflow tooltip to the text start edge (flips for RTL).
    const overflowTooltipPlacement = i18n.resolvedLanguage === 'ar' ? 'topRight' : 'topLeft';
    const columns = [
        {
            title: t("Content.contentLibrary.columns.isbn"),
            dataIndex: 'isbn',
            key: 'isbn',
        },
        {
            title: t("Content.contentLibrary.columns.bookTitle"),
            dataIndex: 'title',
            key: 'title',
            render(text: string){
            return <OverflowTooltip className='book-title clamp-2' title={text} placement={overflowTooltipPlacement}>
            {text}
            </OverflowTooltip>
            }
        },
        {
            title: t("Content.contentLibrary.columns.authorName"),
            dataIndex: 'authorName',
            key: 'authorName',
            render(text: string){
            return <OverflowTooltip className='book-title clamp-2' title={text} placement={overflowTooltipPlacement}>
            {text}
            </OverflowTooltip>
            }
        },
        {
        title: t("Content.contentLibrary.columns.language"),
        dataIndex: 'language',
            key: 'language',
            render(text: string[]){
            return <LanguageListCell value={text} />;
            }
        },
        {
        title: t("Content.contentLibrary.columns.subjectCategory"),
        dataIndex: i18n.resolvedLanguage === 'ar' ? 'subjectNameAr' : 'subjectNameEn',
        key: 'subjectCategory',
        render(text: string | null){
            return text || '-';
        }
        },
        {
        title: t("Content.contentLibrary.columns.versionNumber"),
        dataIndex: 'versionNumber',
        key: 'versionNumber',
        render(text: number | null){
            return text ?? '-';
        }
        },
        {
        title: t("Content.contentLibrary.columns.printYear"),
        dataIndex: 'printYear',
        key: 'printYear',
        render(text: number | null){
            return text ?? '-';
        }
        },
        {
        title: t("Content.contentLibrary.columns.status"),
        dataIndex: 'status',
        key: 'status',
        render(text: string){
            return <CustomStatusTag type="contentLibraryStatus" status={text} />
        }
        },
        {
            title: <span className="content-library-actions-header">{t("Content.contentLibrary.columns.actions")}</span>,
            key: 'Actions',
            align: 'center' as const,
            onHeaderCell: () => ({
                className: 'content-library-actions-column',
            }),
            onCell: () => ({
                className: 'content-library-actions-column',
            }),
            // Design: keep actions reachable while the table scrolls sideways.
            fixed: 'right' as const,
            width: booksActionColumnWidth,
            render(_text: string, record: any){
                return <div className='books-table-actions'>
                    {(record.status === 'Approved' || record.status === 'Rejected') ? <CustomButton
                        variant='text'
                        permissionCode={
                            record.status === 'Rejected'
                                ? "Content.ContentLibrary.Confirm"
                                : "Content.ContentLibrary.ConfirmContentLibrary"
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
                            setChangeStatuasVisible(true);
                        }
                        setSelectedBook(record);
                    }}>{t("Content.contentLibrary.actions.changeStatus")}</CustomButton> : <span className="content-library-actions-empty">-</span>}
                </div>
            }
        }
    ];
    function pullBooksList() { 
        setLoading(true);
        getBookList(params).then(res => { 
            if(res.data){
                setData(res.data);
            }
        }).finally(() => setLoading(false));
    }
    // The filter modal edits these two fields, so the badge counts them.
    const appliedFilterCount = countAppliedFilters([
        params.subjectid,
        params.statuscode,
    ]);

    const openCompactFilter = () => {
        const values = form1.getFieldsValue(["subjectid", "statuscode"]);
        setCompactFilterValues(values);
        setCompactFilterVisible(true);
    };
    const updateCompactFilter = (name: string, value: string | undefined) => {
        const values = { ...compactFilterValues, [name]: value };
        setCompactFilterValues(values);
    };
    const applyCompactFilter = () => {
        handleFilterValuesChange.cancel();
        const values = compactFilterValues;
        form1.setFieldsValue(values);
        setParams((current) => ({
            ...current,
            ...values,
            PageIndex: 1,
        }));
        setCompactFilterVisible(false);
    };
    const resetFilters = () => {
        handleFilterValuesChange.cancel();
        form1.resetFields(["SearchKey", "subjectid", "statuscode"]);
        setCompactFilterValues({});
        setParams((current) => ({
            ...current,
            SearchKey: "",
            subjectid: null,
            statuscode: null,
            PageIndex: 1,
        }));
    };
    useKeepAliveActivated({
        onActivated: () => {
            pullBooksList();
            getBooksCount().then(res => {
                if(res.data){
                    setBooksCount(res.data);
                }
            });
        },
    });
    useEffect(()=>{
        getBooksCount().then(res => {
            if(res.data){
                setBooksCount(res.data);
            }
        })
    },[]);
    useEffect(() => {
        let cancelled = false;
        getSubjectList().then((res: unknown) => {
            if(cancelled){
                return;
            }
            const payload = Array.isArray(res)
                ? res
                : (res as { data?: unknown })?.data;
            setSubjectOptions(Array.isArray(payload) ? (payload as BooksSubjectOption[]) : []);
        }).catch(() => {
            if(!cancelled){
                setSubjectOptions([]);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => { 
        pullBooksList();
    }, [params])
    useEffect(() => {
        return () => handleFilterValuesChange.cancel();
    }, [handleFilterValuesChange]);
    return (
        <div className="books-container">
            <div className="books-statistics">
                <div className='books-statistics-item'>
                    <div className='books-statistics-icon'>
                        <img src={BookTotal} alt={t("Content.contentLibrary.stats.total")} />
                    </div>
                    <div className='books-statistics-text'>
                        <div className='books-statistics-text-number'>{booksCount.total ?? 0}</div>
                        <div className='books-statistics-text-desc'>{t("Content.contentLibrary.stats.total")}</div>
                    </div>
                </div>
                 <div className='books-statistics-item'>
                    <div className='books-statistics-icon'>
                        <img src={BookApproved} alt={t("Content.contentLibrary.stats.approved")} />
                    </div>
                    <div className='books-statistics-text'>
                        <div className='books-statistics-text-number'>{booksCount._approveCount ?? 0}</div>
                        <div className='books-statistics-text-desc'>{t("Content.contentLibrary.stats.approved")}</div>
                    </div>
                </div>
                 <div className='books-statistics-item'>
                    <div className='books-statistics-icon'>
                        <img src={BookRejected} alt={t("Content.contentLibrary.stats.rejected")} />
                    </div>
                    <div className='books-statistics-text'>
                        <div className='books-statistics-text-number'>{booksCount._rejectCount ?? 0}</div>
                        <div className='books-statistics-text-desc'>{t("Content.contentLibrary.stats.rejected")}</div>
                    </div>
                </div>
                 <div className='books-statistics-item'>
                    <div className='books-statistics-icon'>
                        <img src={BookPending} alt={t("Content.contentLibrary.stats.pendingReview")} />
                    </div>
                    <div className='books-statistics-text'>
                        <div className='books-statistics-text-number'>{booksCount._peddingCount ?? 0}</div>
                        <div className='books-statistics-text-desc'>{t("Content.contentLibrary.stats.pendingReview")}</div>
                    </div>
                </div>
            </div>
            <div className='books-table-container'>
                <Row className='books-table-header responsive-filter-toolbar content-library-filter-toolbar'>
                    <Form
                        form={form1}
                        className='custorm-form books-form responsive-filter-toolbar__controls content-library-filter-toolbar__controls'
                        onValuesChange={handleFilterValuesChange}
                    >
                        <Form.Item name="SearchKey" className='responsive-filter-toolbar__field responsive-filter-toolbar__field--search content-library-filter-toolbar__field content-library-filter-toolbar__field--search'>
                            <Input allowClear prefix={<Sousuo className='books-search-icon' />} placeholder={t("common.search")} />
                        </Form.Item>
                        <Form.Item name="subjectid" className='responsive-filter-toolbar__field content-library-filter-toolbar__field content-library-filter-toolbar__field--select content-library-filter-toolbar__field--secondary'>
                        <Select allowClear className='sources-select' dropdownClassName='content-library-select-dropdown' placeholder={t("Content.contentLibrary.filters.allSubjectCategories")}>
                        {subjectOptions.map((item) => (
                        <Select.Option key={item.id} value={item.id}>
                        {(i18n.resolvedLanguage === 'ar' ? item.nameAr : item.nameEn) || '-'}
                        </Select.Option>
                        ))}
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
                            variant="outline"
                            customClassName='responsive-filter-toolbar__button responsive-filter-toolbar__filter-button content-library-filter-toolbar__filter-button filter-trigger-with-count'
                            onClick={openCompactFilter}
                        >
                            {t("common.filter")}
                            <img className="filter-trigger-funnel" src={SortIcon} alt="" />
                            <FilterCountBadge count={appliedFilterCount} />
                        </CustomButton>
                        <CustomButton
                            variant="outline"
                            text={t("common.reset")}
                            customClassName='responsive-filter-toolbar__button responsive-filter-toolbar__reset-button content-library-filter-toolbar__reset-button'
                            onClick={resetFilters}
                        />
                    </Form>
                    <div className="responsive-filter-toolbar__action content-library-filter-toolbar__action">
                        <CustomButton
                            variant="outline"
                            text={t("common.export")}
                            customClassName="content-library-filter-toolbar__export-button"
                            permissionCode="Content.ContentLibrary.Export"
                            permissionRoutePath="/content/ContentLibrary"
                            onClick={()=>{
                                getContentLibraryExportCSV("Content-Library.csv", params);
                            }} />
                    </div>
                </Row>
                <ResponsiveFilterModal
                    visible={compactFilterVisible}
                    onCancel={() => setCompactFilterVisible(false)}
                    onApply={applyCompactFilter}
                    fields={[
                        {
                        key: "subjectid",
                        label: t("Content.contentLibrary.columns.subjectCategory"),
                        element: (
                        <Select
                        allowClear
                        className='sources-select'
                        dropdownClassName='content-library-select-dropdown'
                        placeholder={t("Content.contentLibrary.filters.allSubjectCategories")}
                        value={compactFilterValues.subjectid}
                        onChange={(value) => updateCompactFilter("subjectid", value)}
                        >
                        {subjectOptions.map((item) => (
                        <Select.Option key={item.id} value={item.id}>
                        {(i18n.resolvedLanguage === 'ar' ? item.nameAr : item.nameEn) || '-'}
                        </Select.Option>
                        ))}
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
                <div className="books-table">
                    <Table loading={loading} className='admin-table' columns={columns} dataSource={data.items} 
                        pagination={{
                            size: "default",
                            total: data.totalItems,
                            pageSize: data.itemsPerPage,
                            current: data.currentPage,
                            showTotal: (total: number) => <PaginationTotal label={t("common.total")} total={total} current={data.currentPage} pageSize={data.itemsPerPage} />,
                            pageSizeOptions: ["10", "20", "50"],
                            onChange: (page: number, size: number) => { 
                                params.PageIndex = page;
                                params.PageSize = size;
                                setParams({...params});
                            }
                        }}
                        onRow={(record)=>{
                            return {
                                onClick: () => {
                                    history.push(`/content/ContentLibrary/Books?id=${record.id}`);
                                },
                            };
                        }
                    } />
                </div>
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
                            postChangeBookStatus({
                                bookId: selectedBook.id,
                                status: 2,
                                ...values,
                            }).then(()=>{
                                setConfirmModalVisible(false);
                                form3.resetFields();
                                pullBooksList();
                            }).finally(()=>{
                                setConfirmModalLoading(false);
                            });
                        }
                    }} />
                </div>
            </Modal>
            <Modal centered className='books-change-status-modal' footer={false} visible={changeStatusVisible} title={t("Content.contentLibrary.modals.changeStatus")} onCancel={()=>{
                form2.resetFields();
                setChangeStatuasVisible(false);
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
                        setChangeStatuasVisible(false);
                    }} />
                    <CustomButton loading={changeStatusLoading} disabled={statusValue === null} variant="primary" text={t("common.confirm")} onClick={()=>{
                        const id = selectedBook?.id;
                         if(id){
                            const values = form2.getFieldsValue();
                            setChangeStatusLoading(true);
                            postChangeBookStatus({
                                bookId: Number(id),
                                status: Number(statusValue),
                                ...values
                            }).then(()=>{
                                pullBooksList();
                                form2.resetFields();
                                setChangeStatuasVisible(false)
                            }).finally(()=>{
                                setChangeStatusLoading(false);
                            });
                        }
                    }} />
                </div>
            </Modal>
        </div>
    )
}
