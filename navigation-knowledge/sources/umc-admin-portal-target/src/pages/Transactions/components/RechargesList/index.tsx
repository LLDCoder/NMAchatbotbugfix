import { DatePicker, Form, Input, Modal, Select, Table } from "antd";
import SortIcon from "@/assets/images/sort.png";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";
import "./index.less";
import { CustomButton } from "@/components/common";
import PaginationTotal from "@/components/common/PaginationTotal";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getRecharges, getRechargesExport, getRechargeStatistics, getTransactionStatus, type IRechargesResponse, type IRechargeStatisticsResponse, type ITransactionsRequest, type ITransactionStatusResponse } from "@/services/finance";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import moment from "moment";
import debounce from "lodash/debounce";
import Aed from '@/assets/icons/Aed';
import MenuIcon from "@/assets/images/menu1.png";
import Days from "@/assets/images/days.png";
import Success from "@/assets/images/success.png";
import Forbidden from "@/assets/images/forbidden.png";
import formatMoney from "@/utils/formatMoney";
import formatAmountToKMEnhanced from "@/utils/formatAmountToKMEnhanced";
import { useHistory } from "react-router-dom";
import Sousuo from "@/assets/icons/Sousuo";

function getLocalizedName(
    value?: { name?: string; nameEn?: string; nameAr?: string } | null,
    fallback?: string,
    language = "en"
) {
    if(!value){
        return fallback || '-';
    }

    return language === 'en'
        ? value.nameEn || value.name || fallback || '-'
        : value.nameAr || value.nameEn || value.name || fallback || '-';
}

export default function RechargesList() {
    const { t, i18n } = useTranslation();
    const [data, setData] = useState<IRechargesResponse>({} as IRechargesResponse);
    const [params, setParams] = useState<Partial<ITransactionsRequest>>({
        KeyWord: "",
        PageSize: 10,
        PageIndex: 1,
        SortBy: 'createdOn',
        SortDirection: 'desc',
    });
    const [transactionStatus, setTransactionStatus] = useState<ITransactionStatusResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    // The modal applies status plus a date range; start/end read as one range.
    const appliedFilterCount =
        countAppliedFilters([params.StatusId]) +
        (isAppliedFilterValue(params.StartDate) ||
        isAppliedFilterValue(params.EndDate)
            ? 1
            : 0);
    const [filterForm] = Form.useForm();
    const [modalForm] = Form.useForm();
    const [rechargeStatistics, setRechargeStatistics] = useState<IRechargeStatisticsResponse>({} as IRechargeStatisticsResponse);
    const history = useHistory();
    const handleFilterValuesChange = useMemo(
        () => debounce((_changedValues, values) => {
            setParams((current) => ({
                ...current,
                KeyWord: values.KeyWord,
                StatusId: values.StatusId,
                StartDate: values.date?.[0]?.format('YYYY-MM-DD'),
                EndDate: values.date?.[1]?.format('YYYY-MM-DD'),
                PageIndex: 1,
            }));
        }, 500),
        [],
    );
    function queryRechargesList(){
        setLoading(true);
        getRecharges(params).then(res => {
            if(res.data){
                setData(res.data);
            }
        }).finally(()=>{
            setLoading(false);
        });
    }
    useEffect(()=>{
        queryRechargesList();
    },[params]);
    useEffect(() => {
        return () => handleFilterValuesChange.cancel();
    }, [handleFilterValuesChange]);
    useEffect(()=>{
        getTransactionStatus().then(res => {
            if(res.data){
                setTransactionStatus(res.data);
            }
        });
        getRechargeStatistics().then(res => {
            if(res.data){
                setRechargeStatistics(res.data);
            }
        });
    }, []);
    const columns = [
        {
            title: t("Finance.transactions.table.transactionNo"),
            dataIndex: "transactionNo",
            key: "transactionNo",
        },
        {
            title: t("Finance.transactions.recharges.accountHolder"),
            dataIndex: "accountName",
            key: "accountName",
        },
        {
            title: t("Finance.transactions.recharges.accountEmail"),
            dataIndex: "accountEmail",
            key: "accountEmail",
        },
        {
            title: t("Finance.transactions.recharges.cardHolder"),
            dataIndex: "cardHolder",
            key: "cardHolder",
            render(){
                return '-';
            }
        },
        {
            title: t("Finance.transactions.recharges.cardInformation"),
            dataIndex: "cardInformation",
            key: "cardInformation",
            render(){
                return '-';
            }
        },
        {
            title: <div className="table-amount">{t("Finance.transactionsDetail.fields.amountCharged")} <span className="table-amount-symbol">(<Aed withParentheses={false} className="table-amount-icon" />)</span></div>,
            dataIndex: "amount",
            key: "amount",
            render(amount: number){
                const amountText = String(amount);
                const [integerPart, rawDecimalPart] = amountText.split('.');
                const decimalPart = rawDecimalPart?.padEnd(2, '0') || '00';
                return <div>+{`${integerPart}.${decimalPart}`}</div>

            }
        },
        {
            title: t("Finance.transactions.table.status"),
            dataIndex: "statusId",
            key: "statusId",
            render(statusId: number){
                return <CustomStatusTag type="transaction" status={statusId} />
            }
        },
        {
            title: t("Finance.transactions.recharges.lastUpdatedTime"),
            dataIndex: "createdTime",
            key: "createdTime",
            sorter: true,
            render(updateOn: string){
                return <div>{updateOn ? moment(updateOn).format('DD/MM/YYYY HH:mm:ss') : '-'}</div>
            }
        }
    ]
    function handleExport(){
        setExportLoading(true);
        getRechargesExport({
            ...params,
            PageSize: 10000,
        }).finally(()=>{
            setExportLoading(false);
        });
    }
    function resetFilters(){
        handleFilterValuesChange.cancel();
        filterForm.resetFields();
        modalForm.resetFields();
        setFilterModalVisible(false);
        setParams((current) => ({
            PageSize: current.PageSize ?? 10,
            PageIndex: 1,
            SortBy: current.SortBy ?? 'createdOn',
            SortDirection: current.SortDirection ?? 'desc',
            KeyWord: "",
        }));
    }
    function openFilterModal(){
        const toolbarValues = filterForm.getFieldsValue(["StatusId", "date"]);
        modalForm.setFieldsValue({
            StatusId: toolbarValues.StatusId,
            date: toolbarValues.date,
        });
        setFilterModalVisible(true);
    }
    function applyCompactFilters(){
        handleFilterValuesChange.cancel();
        const values = modalForm.getFieldsValue();
        filterForm.setFieldsValue(values);
        setParams((current) => ({
            ...current,
            StatusId: values.StatusId,
            StartDate: values.date?.[0]?.format('YYYY-MM-DD'),
            EndDate: values.date?.[1]?.format('YYYY-MM-DD'),
            PageIndex: 1,
        }));
        setFilterModalVisible(false);
    }
    const paginationTotal = data?.totalCount ?? data?.total ?? 0;
    const paginationPageSize = data?.pageSize ?? params.PageSize ?? 10;
    const paginationPageIndex = data?.pageIndex ?? params.PageIndex ?? 1;
    return (
        <>
            <div className="recharges-statistics">
                <div className="statistics-item">
                    <div className="statistics-icon">
                        <img src={MenuIcon} alt="" />
                    </div>
                    <div className="statistics-content">
                        <div className="statistics-num">{formatMoney(rechargeStatistics.totalRecharges || 0, false)}</div>
                        <div className="statistics-title">{t("Finance.transactions.recharges.totalRecharges")}</div>
                    </div>
                </div>
                <div className="statistics-item">
                    <div className="statistics-icon">
                        <img src={MenuIcon} alt="" />
                    </div>
                    <div className="statistics-content">
                        <div className="statistics-num">{formatAmountToKMEnhanced(rechargeStatistics.totalRechargeAmount || 0)}</div>
                        <div className="statistics-title">{t("Finance.transactions.statistics.totalAmount")}</div>
                    </div>
                </div>
                <div className="statistics-item">
                    <div className="statistics-icon">
                        <img src={Days} alt="" />
                    </div>
                    <div className="statistics-content">
                        <div className="statistics-num">{formatAmountToKMEnhanced(rechargeStatistics.last7DaysRechangeAmount || 0)}</div>
                        <div className="statistics-title">{t("Finance.transactions.statistics.last7Days")}</div>
                    </div>
                </div>
                 <div className="statistics-item">
                    <div className="statistics-icon">
                        <img src={Success} alt="" />
                    </div>
                    <div className="statistics-content">
                        <div className="statistics-num">{rechargeStatistics.completedRecharges || 0}</div>
                        <div className="statistics-title">{t("Finance.transactions.statistics.completed")}</div>
                    </div>
                </div>
                <div className="statistics-item">
                    <div className="statistics-icon">
                        <img src={Forbidden} alt="" />
                    </div>
                    <div className="statistics-content">
                        <div className="statistics-num">{rechargeStatistics.failRecharges || 0}</div>
                        <div className="statistics-title">{t("Finance.transactions.statistics.failed")}</div>
                    </div>
                </div>
            </div>
            <div className="recharges-list">
            
            <div className="filter">
                <Form
                    form={filterForm}
                    className="custorm-form payments-list-form recharges-filter-toolbar__controls"
                    onValuesChange={handleFilterValuesChange}
                >
                    <Form.Item
                        name="KeyWord"
                        className="recharges-filter-toolbar__field recharges-filter-toolbar__field--search responsive-filter-toolbar__field--single-visible-search"
                    >
                        <Input
                            placeholder={t("Finance.transactions.common.search")}
                            prefix={<Sousuo className="search-icon" />}
                            allowClear
                        />
                    </Form.Item>
                    <Form.Item name="StatusId" className="recharges-filter-toolbar__field recharges-filter-toolbar__field--secondary">
                        <Select
                            className="transactions-filter-select"
                            placeholder={t("Finance.transactions.common.allStatuses")}
                            allowClear
                        >
                            {transactionStatus.filter(item=>item.id === 3 || item.id === 4).map(item=>{
                                return <Select.Option key={item.id} value={item.id}>{getLocalizedName(item, undefined, i18n.language)}</Select.Option>
                            })}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="date"
                        className="recharges-filter-toolbar__field recharges-filter-toolbar__field--range recharges-filter-toolbar__field--secondary"
                    >
                        <DatePicker.RangePicker
                            placeholder={[
                                t("Finance.transactions.filterModal.startDate"),
                                t("Finance.transactions.filterModal.endDate"),
                            ]}
                            separator="-"
                            allowClear
                        />
                    </Form.Item>
                </Form>
                <div className="recharges-filter-toolbar__actions">
                    <CustomButton
                        variant="outline"
                        customClassName="recharges-filter-toolbar__filter-button filter-trigger-with-count"
                        onClick={openFilterModal}
                    >
                        {t("common.filter")}
                        <img className="filter-trigger-funnel" src={SortIcon} alt="" />
                        <FilterCountBadge count={appliedFilterCount} />
                    </CustomButton>
                    <CustomButton
                        text={t("common.reset")}
                        variant="outline"
                        customClassName="recharges-filter-toolbar__reset-button"
                        onClick={resetFilters}
                    />
                    <CustomButton
                        loading={exportLoading}
                        text={t("Finance.transactions.actions.export")}
                        onClick={handleExport}
                        permissionCode="Finance.Transactions.ExportRechargesList"
                        permissionRoutePath="/financial-payment/transactions"
                    />
                </div>
            </div>
            <div className="table admin-table">
                <Table 
                    onChange={(page,_filter,sorter)=>{
                        //@ts-expect-error antd sorter type can be a single sorter object here.
                        const { order } = sorter;
                        setParams({
                            ...params,
                            SortBy: 'createdOn',
                            SortDirection: order === 'ascend' ? 'asc' : 'desc',
                            PageIndex: page.current,
                            PageSize: page.pageSize,
                        })
                    }}
                    loading={loading}
                    columns={columns}
                    dataSource={data?.items}
                    onRow={(item)=>{
                        return {
                            onClick(){
                                history.push(`/financial-payment/transactions/transactions-detail?transactionNo=${item.transactionNo}`);
                            }
                        }
                    }}
                    pagination={{
                        size: "default",
                        total: paginationTotal,
                        pageSize: paginationPageSize,
                        current: paginationPageIndex,
                        showSizeChanger: true,
                        showTotal: (total) => <PaginationTotal label={t("common.total")} total={total} current={paginationPageIndex} pageSize={paginationPageSize} />,
                        pageSizeOptions: ["10", "20", "50", "100"],
                    }}
                />
            </div>
        </div>
        <Modal
            visible={filterModalVisible}
            title={t("Finance.transactions.filterModal.title")}
            onCancel={() => setFilterModalVisible(false)}
            width={960}
            centered
            className="payments-filter-modal recharges-filter-modal"
            footer={
                <div className="filter-modal-footer">
                    <CustomButton
                        text={t("common.cancel")}
                        variant="outline"
                        onClick={() => setFilterModalVisible(false)}
                        customClassName="filter-cancel-btn"
                    />
                    <CustomButton
                        text={t("common.apply")}
                        variant="primary"
                        onClick={applyCompactFilters}
                        customClassName="filter-search-btn"
                    />
                </div>
            }
        >
            <Form form={modalForm} layout="vertical" className="custorm-form payments-filter-form">
                <Form.Item label={t("Finance.transactions.table.status")} name="StatusId">
                    <Select
                        placeholder={t("Finance.transactions.common.allStatuses")}
                        allowClear
                    >
                        {transactionStatus.filter(item=>item.id === 3 || item.id === 4).map(item=>{
                            return <Select.Option key={item.id} value={item.id}>{getLocalizedName(item, undefined, i18n.language)}</Select.Option>
                        })}
                    </Select>
                </Form.Item>
                <Form.Item label={t("Finance.transactions.table.transactionTime")} name="date">
                    <DatePicker.RangePicker
                        placeholder={[
                            t("Finance.transactions.filterModal.startDate"),
                            t("Finance.transactions.filterModal.endDate"),
                        ]}
                        separator="-"
                        allowClear
                    />
                </Form.Item>
            </Form>
        </Modal>
        </>
    )
}
