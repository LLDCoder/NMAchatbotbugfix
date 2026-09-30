import { Form, Input, Popover, Progress, Select, Table } from "antd";
import Sousuo from "@/assets/icons/Sousuo";
import "./index.less";
import { CustomButton } from "@/components/common";
import PaginationTotal from "@/components/common/PaginationTotal";
import useKeepAliveActivated from "@/components/KeepAlive/useKeepAliveActivated";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getPaymentMethodAndFail, getPaymentsExport, getStatistics, getTransactions, getTransactionStatus, getTransactionType, type IPaymentMethodAndFailResponse, type IStatisticsResponse, type ITransactionsRequest, type ITransactionsResponse, type ITransactionStatusResponse, type ITransactionTypeResponse } from "@/services/finance";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import moment from "moment";
import debounce from "lodash/debounce";
import aedTableIcon from "@/assets/images/aed_table.svg";
import aedTitleIcon from "@/assets/images/aed_title.svg";
import Individual from "@/assets/icons/Individual";
import Establishment from "@/assets/icons/Establishment";
import Tips from "@/assets/images/transactions-info.svg";
import Wallet from "@/assets/images/transactions-wallet.svg";
import Credit from "@/assets/images/transactions-credit-card.svg";
import Failed from "@/assets/images/transactions-failed.svg";
import FailedRefund from "@/assets/images/transactions-failed-refund.svg";
import formatMoney from "@/utils/formatMoney";
import formatAmountToKMEnhanced from "@/utils/formatAmountToKMEnhanced";
import { useHistory } from "react-router-dom";
import SortIcon from "@/assets/images/sort.png";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { NARROW_TOOLBAR_MEDIA_QUERY } from "@/components/common/FilterTable/responsiveLayout";
import FilterCountBadge, {
  countAppliedFilters,
  isAppliedFilterValue,
} from "@/components/common/FilterCountBadge";
import FilterModal from "../FilterModal";
import ReactECharts from "echarts-for-react"
import type { CallbackDataParams } from "echarts/types/dist/shared";
import Decline from "@/assets/icons/Decline";
import createViewportEdgeTooltipPosition from "@/utils/createViewportEdgeTooltipPosition";

type PaymentStatisticCategory = "serviceApplication" | "fines" | "refunds";
type EChartsComponentInstance = InstanceType<typeof ReactECharts>;

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const formatPaymentsTooltip = (params: CallbackDataParams) => {
    const label = escapeHtml(String(params.name ?? ""));
    const value = Number(params.value ?? 0).toLocaleString();
    const percentage = Number(params.percent ?? 0).toFixed(2);
    const color = typeof params.color === "string" ? params.color : "#A0D5AB";

    return `
        <div class="payments-statistics-chart-tooltip-content">
            <span class="payments-statistics-chart-tooltip-marker" style="background-color: ${color};"></span>
            <span class="payments-statistics-chart-tooltip-text">${label}: ${value} (${percentage}%)</span>
        </div>
    `;
};

function getInitialPaymentParams(): Partial<ITransactionsRequest> {
    return {
        KeyWord: "",
        PageSize: 10,
        PageIndex: 1,
        SortBy: "updateOn",
        SortDirection: "desc",
        PaymentMethodId: null,
    };
}

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

export default function PaymentsList() {
    const { t, i18n } = useTranslation();
    const [filterForm] = Form.useForm();
    const [data, setData] = useState<ITransactionsResponse>({} as ITransactionsResponse);
    const [params, setParams] = useState<Partial<ITransactionsRequest>>(getInitialPaymentParams);
    const [transactionTypes, setTransactionTypes] = useState<ITransactionTypeResponse[]>([]);
    const [transactionStatus, setTransactionStatus] = useState<ITransactionStatusResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [statistics, setStatistics] = useState<IStatisticsResponse>({} as IStatisticsResponse);
    const [paymentMethodAndFail, setPaymentMethodAndFail] = useState<IPaymentMethodAndFailResponse>({} as IPaymentMethodAndFailResponse);
    const history = useHistory();
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const chartRef = useRef<EChartsComponentInstance | null>(null);
    const tooltipPosition = useMemo(
        () => createViewportEdgeTooltipPosition(
            () => chartRef.current?.getEchartsInstance().getDom(),
        ),
        [],
    );
    /**
     * The modal always carries payment method and a date range; type and status
     * only fold into it on narrow layouts, so they are counted only there. The
     * start/end pair reads as one range to the user.
     */
    const isNarrowToolbar = useMediaQuery(NARROW_TOOLBAR_MEDIA_QUERY);
    const appliedFilterCount =
        countAppliedFilters([
            params.PaymentMethodId,
            ...(isNarrowToolbar
                ? [params.TransactionTypeId, params.StatusId]
                : []),
        ]) +
        (isAppliedFilterValue(params.StartDate) ||
        isAppliedFilterValue(params.EndDate)
            ? 1
            : 0);
    const [filterModalIncludesInlineFilters, setFilterModalIncludesInlineFilters] =
        useState(false);
    const [filterResetKey, setFilterResetKey] = useState(0);
    const [filterResetToken, setFilterResetToken] = useState(0);
    const [visiblePieCategories, setVisiblePieCategories] = useState<Record<PaymentStatisticCategory, boolean>>({
        serviceApplication: true,
        fines: true,
        refunds: true,
    });
    const handleFilterValuesChange = useMemo(
        () => debounce((values: Partial<ITransactionsRequest>) => {
            setParams((previous) => ({
                ...previous,
                ...values,
                PageIndex: 1,
            }));
        }, 500),
        [],
    );
    const resetFilters = () => {
        handleFilterValuesChange.cancel();
        filterForm.resetFields();
        setFilterResetKey((value) => value + 1);
        setFilterResetToken((value) => value + 1);
        setParams((previous) => ({
            ...previous,
            KeyWord: "",
            TransactionTypeId: undefined,
            StatusId: undefined,
            PaymentMethodId: null,
            StartDate: undefined,
            EndDate: undefined,
            PageIndex: 1,
        }));
    };
    function queryPaymentsList(){
        setLoading(true);
        getTransactions(params).then(res => {
            if(res.data){
                setData(res.data);
            }
        }).finally(()=>{
            setLoading(false);
        });
    }
    useKeepAliveActivated({
        onActivated: () => {
            queryPaymentsList();
        },
    });
    useEffect(()=>{
        queryPaymentsList();
    },[params]);
    useEffect(() => {
        return () => handleFilterValuesChange.cancel();
    }, [handleFilterValuesChange]);
    useEffect(()=>{
        getTransactionType().then(res => {
            if(res.data){
                setTransactionTypes(res.data);
            }
        });
        getTransactionStatus().then(res => {
            if(res.data){
                setTransactionStatus(res.data);
            }
        });
        getStatistics().then(res => {
            if(res.data){
                setStatistics(res.data);
            }
        });
        getPaymentMethodAndFail().then(res => {
            if(res.data){
                setPaymentMethodAndFail(res.data);
            }
        })
    }, []);
    const columns = [
        {
            title: t("Finance.transactions.table.transactionNo"),
            dataIndex: "transactionNo",
            key: "transactionNo",
        },
        {
            title: t("Finance.transactions.table.type"),
            key: "type",
            render(_text: string, record: ITransactionsResponse['items'][0]){
                return getLocalizedName(record.transactionTypeObj, record.transactionType, i18n.language);
            }
        },
        {
            title: t("Finance.transactions.table.applyFor"),
            dataIndex: ['applyForObj', i18n.resolvedLanguage === 'en' ? 'nameEn' : 'nameAr'],
            key: "applyFor",
            render(t: string, record: ITransactionsResponse['items'][0]){
                return <div className="todo-tabpanel-custormer">
                    {!record?.applyForObj?.userTypeId ? '' : record.applyForObj.userTypeId === 1 ? <div className="todo-tabpanel-custormer-icon"><Individual /></div> : <div className="todo-tabpanel-custormer-icon"><Establishment /></div>}
                    {t}
                </div>
            }
        },
        {
            title: t("Finance.transactions.table.paymentMethod"),
            key: "paymentMethod",
            render(_text: string, record: ITransactionsResponse['items'][0]){
                return getLocalizedName(record.paymentMethodObj ?? record.walletVauleObj, record.paymentMethod, i18n.language);
            }
        },
        {
            title: <div className="table-amount">{t("Finance.transactions.table.amount")}<img src={aedTableIcon} alt="AED" className="table-amount-icon" /></div>,
            dataIndex: "amount",
            key: "amount",
            render(amount: number, record: ITransactionsResponse['items'][0]){
                const amountText = String(amount);
                const [integerPart, rawDecimalPart] = amountText.split('.');
                const decimalPart = rawDecimalPart?.padEnd(2, '0') || '00';
                return <div className={`${record.transactionTypeId !== 4 ? 'amount-success' : 'amount-error'}`}>{integerPart + '.' + decimalPart}</div>

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
            title: t("Finance.transactions.table.transactionTime"),
            dataIndex: "updateOn",
            key: "updateOn",
            sorter: true,
            render(updateOn: string){
                return <div>{updateOn ? moment(updateOn).format('DD/MM/YYYY HH:mm:ss') : '-'}</div>
            }
        }
    ]
    function handleExport(){
        setExportLoading(true);
        getPaymentsExport({
            ...params,
            PageSize: 10000,
        }).finally(()=>{
            setExportLoading(false);
        });
    }
    const serviceApplicationPayments = statistics?.serviceApplicationPayments || 0;
    const fines = statistics?.fines || 0;
    const refunds = statistics?.refunds || 0;
    const totalPayments = statistics?.totalPayments || 0;
    const totalRevenue = statistics?.totalRevenue || 0;
    const paymentsLast7DaysTotal = statistics?.paymentsDataStatistics?.last7DaysTotal;
    const paymentsGrowthCount = statistics?.paymentsDataStatistics?.growthCount;
    const revenuesLast7DaysTotal = statistics?.revenuesDataStatistics?.last7DaysTotal;
    const revenueAmount = statistics?.revenuesDataStatistics?.revenueAmount;
    const hasPaymentsLast7DaysTotal = typeof paymentsLast7DaysTotal === "number";
    const hasRevenuesLast7DaysTotal = typeof revenuesLast7DaysTotal === "number";
    const hasPieData = serviceApplicationPayments > 0 || fines > 0 || refunds > 0;

    const togglePieCategory = (category: PaymentStatisticCategory) => {
        setVisiblePieCategories((previous) => ({
            ...previous,
            [category]: !previous[category],
        }));
    };

    function getPieChartOption(){
        const pieItems = [
            {
                category: "serviceApplication" as const,
                value: serviceApplicationPayments,
                name: t("Finance.transactions.statistics.serviceApplication"),
                color: "#A0D5AB",
            },
            {
                category: "fines" as const,
                value: fines,
                name: t("Finance.transactions.statistics.fines"),
                color: "#FAAAA7",
            },
            {
                category: "refunds" as const,
                value: refunds,
                name: t("Finance.transactions.statistics.refunds"),
                color: "#FAD44F",
            },
        ];
        const visiblePieItems = pieItems.filter(({ category, value }) => (
            visiblePieCategories[category] && value > 0
        ));
        const hasVisiblePieData = hasPieData && visiblePieItems.length > 0;
        const pieData = hasPieData
            ? visiblePieItems.map(({ value, name, color }) => ({
                value,
                name,
                itemStyle: { color },
            }))
            : [
                { value: 1, name: t("Finance.transactions.common.noData") },
            ];

        return {
            tooltip: {
                show: hasVisiblePieData,
                trigger: 'item',
                renderMode: "html",
                appendTo: "body",
                confine: false,
                position: tooltipPosition,
                className: "payments-statistics-chart-tooltip",
                formatter: hasVisiblePieData ? formatPaymentsTooltip : undefined,
            },
            series: [
                {
                    name: 'Access From',
                    type: 'pie',
                    radius: ['78%', '92%'],
                    minAngle: 3,
                    avoidLabelOverlap: false,
                    label: {
                        show: false,
                        position: 'center'
                    },
                    labelLine: {
                        show: false
                    },
                    silent: !hasVisiblePieData,
                    data: pieData,
                    color: hasPieData ? undefined : ['#EFEDE8'],
                }
            ],
            graphic: [
                {
                    type: 'text',
                    silent: true,
                    left: 'center',
                    top: '42%',
                    style: {
                    text: totalPayments,
                        textAlign: 'center',
                        fill: '#333',        
                        fontSize: 20,
                        fontWeight: 'bold'
                    }
                },
                {
                    type: 'text',
                    silent: true,
                    left: 'center',
                    top: '58%', 
                    style: {
                    text: t("Finance.transactions.statistics.total"),      
                        textAlign: 'center',
                        fill: '#999',        
                        fontSize: 12
                    }
                }
            ]
        };
    }

    let total = Math.max(serviceApplicationPayments, fines, refunds);
    total += total * 0.2;
    const limit = formatAmountToKMEnhanced(total);
    const refundsProgressPercent = refunds > 0
        ? Math.max(refunds / total * 100, 2)
        : 0;
    const paginationTotal = data?.totalCount ?? data?.total ?? 0;
    const paginationPageSize = data?.pageSize ?? params.PageSize ?? 10;
    const paginationPageIndex = data?.pageIndex ?? params.PageIndex ?? 1;
    return (
        <>
        <div className="payments-statistics">
            <div className="payments-statistics-card">
                <div className="payments-statistics-title payments-statistics-title-mb">
                    <div className="payments-statistics-title-text">
                       {t("Finance.transactions.statistics.payments")}
                        <Popover
                            arrowPointAtCenter
                            content={t("Finance.transactions.statistics.onlyCompletedHint")}
                            getPopupContainer={() => document.body}
                            placement="top"
                            overlayClassName="payments-statistics-tooltip"
                        >
                            <span className="payments-statistics-info-trigger">
                                <img src={Tips} alt="" />
                            </span>
                        </Popover>
                    </div>
                    <div className="payments-statistics-last7">
                        {hasPaymentsLast7DaysTotal ? <>
                            {typeof paymentsGrowthCount === "number" && paymentsGrowthCount !== 0 && <Decline className={paymentsGrowthCount > 0 ? "amount-rise" : undefined} />}
                            +{paymentsLast7DaysTotal} {t("Finance.transactions.statistics.inLast7Days")}
                        </> : <>
                            - {t("Finance.transactions.statistics.inLast7Days")}
                        </>}
                    </div>
                </div>
                <div className="payments-statistics-main">
                    <div className="payments-statistics-pie">
                        <ReactECharts ref={chartRef} option={getPieChartOption()} style={{ height: "10rem" }} />
                    </div>
                    <div className="payments-statistics-items">
                        <button
                            type="button"
                            className={`payments-statistics-item${visiblePieCategories.serviceApplication ? "" : " payments-statistics-item--inactive"}`}
                            onClick={() => togglePieCategory("serviceApplication")}
                            aria-pressed={visiblePieCategories.serviceApplication}
                        >
                            <div className="payments-statistics-item-left">
                                <div className="green-dot"></div>
                                <div>{t("Finance.transactions.statistics.serviceApplication")}</div>
                            </div>
                            <div className="payments-statistics-item-right">{formatMoney(serviceApplicationPayments, false)}</div>
                        </button>
                        <button
                            type="button"
                            className={`payments-statistics-item${visiblePieCategories.fines ? "" : " payments-statistics-item--inactive"}`}
                            onClick={() => togglePieCategory("fines")}
                            aria-pressed={visiblePieCategories.fines}
                        >
                            <div className="payments-statistics-item-left">
                                <div className="red-dot"></div>
                                <div>{t("Finance.transactions.statistics.fines")}</div>
                            </div>
                            <div className="payments-statistics-item-right">{formatMoney(fines, false)}</div>
                        </button>
                        <button
                            type="button"
                            className={`payments-statistics-item${visiblePieCategories.refunds ? "" : " payments-statistics-item--inactive"}`}
                            onClick={() => togglePieCategory("refunds")}
                            aria-pressed={visiblePieCategories.refunds}
                        >
                            <div className="payments-statistics-item-left">
                                <div className="yellow-dot"></div>
                                <div>{t("Finance.transactions.statistics.refunds")}</div>
                            </div>
                            <div className="payments-statistics-item-right">{formatMoney(refunds, false)}</div>
                        </button>
                    </div>
                </div>
            </div>
            <div className="payments-statistics-card">
                <div className="payments-statistics-title">
                    <div className="payments-statistics-title-text">
                        {t("Finance.transactions.statistics.revenue")}
                        <img src={aedTitleIcon} alt="AED" className="payments-statistics-revenue-currency" />
                        <Popover
                            arrowPointAtCenter
                            content={t("Finance.transactions.statistics.onlyCompletedHint")}
                            getPopupContainer={() => document.body}
                            placement="top"
                            overlayClassName="payments-statistics-tooltip"
                        >
                            <span className="payments-statistics-info-trigger">
                                <img src={Tips} alt="" />
                            </span>
                        </Popover>
                    </div>
                    <div className="payments-statistics-last7">
                        {hasRevenuesLast7DaysTotal ? <>
                            {typeof revenueAmount === "number" && revenueAmount !== 0 && <Decline className={revenueAmount > 0 ? "amount-rise" : undefined} />}
                            {formatAmountToKMEnhanced(revenuesLast7DaysTotal)} {t("Finance.transactions.statistics.inLast7Days")}
                        </> : <>
                            - {t("Finance.transactions.statistics.inLast7Days")}
                        </>}
                    </div>
                </div>
                <div className="payments-statistics-revenue-main">
                    <div className="payments-statistics-revenue-item">
                        <div className="payments-statistics-revenue-item-name">
                            {t("Finance.transactions.statistics.total")}
                            <Popover
                                arrowPointAtCenter
                                content={t("Finance.transactions.statistics.calculationRule")}
                                getPopupContainer={() => document.body}
                                placement="top"
                                overlayClassName="payments-statistics-tooltip"
                            >
                                <span className="payments-statistics-info-trigger">
                                    <img src={Tips} alt="" />
                                </span>
                            </Popover>
                        </div>
                        <div className="payments-statistics-revenue-item-value">
                            {formatAmountToKMEnhanced(totalRevenue)}
                        </div>
                    </div>
                    <div className="payments-statistics-revenue-bars">
                        <div className="payments-statistics-revenue-item">
                            <div className="payments-statistics-revenue-item-name">
                                {t("Finance.transactions.statistics.serviceApplicationFees")}
                            </div>
                            <div className="payments-statistics-revenue-item-value">
                                {formatAmountToKMEnhanced(serviceApplicationPayments)}
                            </div>
                            <div className="payments-statistics-revenue-item-bar">
                                <div className="payments-statistics-revenue-item-bar-left"><Progress showInfo={false} percent={0} /></div>
                                <div className="payments-statistics-revenue-item-bar-right"><Progress showInfo={false} percent={serviceApplicationPayments / total * 100} strokeColor="#B7DFBF" /></div>
                            </div>
                        </div>
                         <div className="payments-statistics-revenue-item">
                            <div className="payments-statistics-revenue-item-name">
                                {t("Finance.transactions.statistics.fines")}
                            </div>
                            <div className="payments-statistics-revenue-item-value">
                                {formatAmountToKMEnhanced(fines)}
                            </div>
                            <div className="payments-statistics-revenue-item-bar">
                                <div className="payments-statistics-revenue-item-bar-left"><Progress showInfo={false} percent={0} /></div>
                                <div className="payments-statistics-revenue-item-bar-right"><Progress showInfo={false} percent={fines / total * 100} strokeColor="#FAAAA7" /></div>
                            </div>
                        </div>
                         <div className="payments-statistics-revenue-item">
                            <div className="payments-statistics-revenue-item-name">
                                {t("Finance.transactions.statistics.refunds")}
                            </div>
                            <div className="payments-statistics-revenue-item-value">
                                {formatAmountToKMEnhanced(refunds)}
                            </div>
                            <div className="payments-statistics-revenue-item-bar">
                                <div className="payments-statistics-revenue-item-bar-left"><Progress showInfo={false} percent={refundsProgressPercent} strokeColor="#FAD44F" /></div>
                                <div className="payments-statistics-revenue-item-bar-right"><Progress showInfo={false}  /></div>
                            </div>
                        </div>
                        <div className="payments-statistics-revenue-item">
                            <div className="payments-statistics-revenue-limit">
                                -{limit}
                            </div>
                            <div className="payments-statistics-revenue-item-zero payments-statistics-revenue-limit">0</div>
                            <div className="payments-statistics-revenue-limit">
                                {limit}
                            </div>
                        </div>
                        <div className="payments-statistics-revenue-graduation-mark"></div>
                    </div>
                   
                </div>
            </div>
            <div className="payments-statistics-info">
                <div className="payments-statistics-balance">
                    <div className="balance-item">
                        <div className="balance-icon balance-icon--wallet">
                            <img src={Wallet} alt="" />
                        </div>
                        <div className="balance-text">
                            <div className="balance-value">{formatMoney(paymentMethodAndFail?.walletTotal || 0, false)}</div>
                            <div className="balance-title">{t("Finance.transactions.statistics.wallet")}</div>
                        </div>
                    </div>
                    <div className="balance-item">
                        <div className="balance-icon balance-icon--credit-card">
                            <img src={Credit} alt="" />
                        </div>
                        <div className="balance-text">
                            <div className="balance-value">{formatMoney(paymentMethodAndFail?.cardTotal || 0, false)}</div>
                            <div className="balance-title">{t("Finance.transactions.statistics.creditDebitCard")}</div>
                        </div>
                    </div>
                </div>
                 <div className="payments-statistics-balance">
                    <div className="balance-item">
                        <div className="balance-icon balance-icon--failed">
                            <img src={Failed} alt="" />
                        </div>
                        <div className="balance-text">
                            <div className="balance-value">{paymentMethodAndFail?.failedTotal || 0}</div>
                            <div className="balance-title">{t("Finance.transactions.statistics.failed")}</div>
                        </div>
                    </div>
                    <div className="balance-item">
                        <div className="balance-icon balance-icon--failed-refund">
                            <img src={FailedRefund} alt="" />
                        </div>
                        <div className="balance-text">
                            <div className="balance-value">{paymentMethodAndFail?.failedRefundTotal || 0}</div>
                            <div className="balance-title">{t("Finance.transactions.statistics.failedRefund")}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div className="payments-list">
            <div className="filter responsive-filter-toolbar">
                <Form
                    form={filterForm}
                    className="custorm-form payments-list-form responsive-filter-toolbar__controls transactions-filter-toolbar__controls"
                    onValuesChange={handleFilterValuesChange}
                >
                    <Form.Item name="KeyWord" className="responsive-filter-toolbar__field responsive-filter-toolbar__field--search transactions-filter-toolbar__field transactions-filter-toolbar__field--search">
                        <Input
                            placeholder={t("Finance.transactions.common.search")}
                            prefix={<Sousuo className="search-icon" />}
                            allowClear
                        />
                    </Form.Item>
                    <Form.Item name="TransactionTypeId" className="responsive-filter-toolbar__field transactions-filter-toolbar__field transactions-filter-toolbar__field--secondary">
                        <Select
                            className="transactions-filter-select"
                            dropdownClassName="payments-list__select-dropdown"
                            placeholder={t("Finance.transactions.common.allTypes")}
                            allowClear
                        >
                            {transactionTypes.filter(item=>item.id === 2 || item.id === 3 || item.id === 4).map(item=>{
                                return <Select.Option key={item.id} value={item.id}>{getLocalizedName(item, undefined, i18n.language)}</Select.Option>
                            })}
                        </Select>
                    </Form.Item>
                    <Form.Item name="StatusId" className="responsive-filter-toolbar__field transactions-filter-toolbar__field transactions-filter-toolbar__field--secondary">
                        <Select
                            className="transactions-filter-select"
                            dropdownClassName="payments-list__select-dropdown"
                            placeholder={t("Finance.transactions.common.allStatuses")}
                            allowClear
                        >
                            {transactionStatus.filter(item=>item.id === 3 || item.id === 4 || item.id === 8).map(item=>{
                                return <Select.Option key={item.id} value={item.id}>{getLocalizedName(item, undefined, i18n.language)}</Select.Option>
                            })}
                        </Select>
                    </Form.Item>
                    <FilterModal visible={filterModalVisible} onCancel={()=>{
                        setFilterModalVisible(false);
                    }} onSearch={(values) => {
                        handleFilterValuesChange.cancel();
                        const compactFilters = filterModalIncludesInlineFilters
                            ? {
                                TransactionTypeId: values.TransactionTypeId,
                                StatusId: values.StatusId,
                            }
                            : {};
                        if (filterModalIncludesInlineFilters) {
                            filterForm.setFieldsValue(compactFilters);
                        }
                        const date = values.date;
                        if(date){
                            setParams((previous) => ({
                                ...previous,
                                PaymentMethodId: values.PaymentMethodId,
                                StartDate: date[0].format('YYYY-MM-DD'),
                                EndDate: date[1].format('YYYY-MM-DD'),
                                ...compactFilters,
                                PageIndex: 1,
                            }));
                        } else {
                            setParams((previous) => ({
                                ...previous,
                                PaymentMethodId: values.PaymentMethodId,
                                StartDate: undefined,
                                EndDate: undefined,
                                ...compactFilters,
                                PageIndex: 1,
                            }));
                        }
                        setFilterModalVisible(false);
                    }}
                    transactionTypes={transactionTypes}
                    transactionStatus={transactionStatus}
                    initialTransactionTypeId={filterForm.getFieldValue("TransactionTypeId")}
                    initialStatusId={filterForm.getFieldValue("StatusId")}
                    includeInlineFilters={filterModalIncludesInlineFilters}
                    resetKey={filterResetKey}
                    resetToken={filterResetToken}
                    />
                    <CustomButton
                        variant="outline"
                        customClassName="filters-filterBtn responsive-filter-toolbar__button responsive-filter-toolbar__filter-button filter-trigger-with-count"
                        onClick={() => {
                            setFilterModalIncludesInlineFilters(
                                window.matchMedia("(max-width: 1439.98px)").matches,
                            );
                            setFilterModalVisible(true);
                        }}
                    >
                        {t("Finance.transactions.actions.filter")}
                        <img className="filter-trigger-funnel" src={SortIcon} alt="" />
                        <FilterCountBadge count={appliedFilterCount} />
                    </CustomButton>
                    <CustomButton
                        text={t("common.reset")}
                        variant="outline"
                        customClassName="filters-filterBtn responsive-filter-toolbar__button responsive-filter-toolbar__reset-button"
                        onClick={resetFilters}
                    />
                </Form>
                <div className="responsive-filter-toolbar__action">
                    <CustomButton
                        loading={exportLoading}
                        text={t("Finance.transactions.actions.export")}
                        variant="outline"
                        onClick={handleExport}
                        permissionCode="Finance.Transactions.Export"
                        permissionRoutePath="/financial-payment/transactions"
                    />
                </div>
            </div>
            <div className="table admin-table">
                <Table 
                    rowKey="transactionNo"
                    onChange={(page, _filter, sorter)=>{
                        //@ts-expect-error antd sorter type can be a single sorter object here.
                        const { field, order } = sorter;
                        setParams({
                            ...params,
                            SortBy: order ? field : 'updateOn',
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
        </div></>
    )
}
