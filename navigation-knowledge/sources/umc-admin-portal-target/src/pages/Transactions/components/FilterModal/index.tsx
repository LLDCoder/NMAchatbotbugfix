import { CustomButton } from "@/components/common";
import { DatePicker, Form, Modal, Select } from "antd";
import { useTranslation } from "react-i18next";

import './index.less';
import { useCallback, useEffect, useRef, useState } from "react";
import {
    getPaymentMethod,
    type IPaymentMethodResponse,
    type ITransactionStatusResponse,
    type ITransactionTypeResponse,
} from "@/services/finance";

interface IProps{
    visible: boolean;
    onCancel: () => void;
    onSearch: (values: FilterValues) => void;
    transactionTypes: ITransactionTypeResponse[];
    transactionStatus: ITransactionStatusResponse[];
    initialTransactionTypeId?: number;
    initialStatusId?: number;
    includeInlineFilters?: boolean;
    resetKey?: number;
    resetToken?: number;
}

type FilterDateValue = Array<{ format: (template: string) => string }>;

interface FilterValues {
    PaymentMethodId?: number;
    date?: FilterDateValue;
    TransactionTypeId?: number;
    StatusId?: number;
}

function normalizeFilterValues(values: FilterValues): FilterValues {
    const normalizedValues = { ...values };
    if (normalizedValues.PaymentMethodId === 0) {
        delete normalizedValues.PaymentMethodId;
    }
    return normalizedValues;
}

function hasFilterValues(values: FilterValues) {
    const normalizedValues = normalizeFilterValues(values);
    return normalizedValues.PaymentMethodId != null
        || normalizedValues.TransactionTypeId != null
        || normalizedValues.StatusId != null
        || Boolean(normalizedValues.date?.some(Boolean));
}

function getLocalizedName(
    value?: { name?: string; nameEn?: string; nameAr?: string } | null,
    language = 'en'
) {
    if(!value){
        return '-';
    }

    return language === "en"
        ? value.nameEn || value.name || '-'
        : value.nameAr || value.nameEn || value.name || '-';
}

export default function FilterModal({
    visible,
    onCancel,
    onSearch,
    transactionTypes,
    transactionStatus,
    initialTransactionTypeId,
    initialStatusId,
    includeInlineFilters = false,
    resetKey = 0,
    resetToken = 0,
}: IProps){
    const { t, i18n } = useTranslation();
    const [form] = Form.useForm();
    const [params, setParams] = useState<FilterValues>({});
    const [isApplyEnabled, setIsApplyEnabled] = useState(false);
    const [paymentMethodList, setPaymentMethodList] = useState<IPaymentMethodResponse[]>([]);
    const dataRef = useRef<FilterValues>({});
    const setFormValues = useCallback((values: FilterValues) => {
        const normalizedValues = normalizeFilterValues(values);
        form.setFieldsValue({
            PaymentMethodId: normalizedValues.PaymentMethodId,
            date: normalizedValues.date,
            TransactionTypeId: includeInlineFilters
                ? normalizedValues.TransactionTypeId
                : undefined,
            StatusId: includeInlineFilters
                ? normalizedValues.StatusId
                : undefined,
        });
    }, [form, includeInlineFilters]);
    function handleSearch() { 
        const values = normalizeFilterValues(form.getFieldsValue() as FilterValues);
        if (!includeInlineFilters) {
            delete values.TransactionTypeId;
            delete values.StatusId;
        }
        setFormValues(values);
        setParams(values);
        dataRef.current = values;
        setIsApplyEnabled(hasFilterValues(values));
        onSearch(values);
    }
    function handleCancel() {
        setFormValues(dataRef.current);
        setParams(dataRef.current);
        setIsApplyEnabled(hasFilterValues(dataRef.current));
        onCancel();
    }
    useEffect(()=>{
        if(visible){
            const initialValues = normalizeFilterValues({
                ...params,
                ...(includeInlineFilters
                    ? {
                        TransactionTypeId: initialTransactionTypeId,
                        StatusId: initialStatusId,
                    }
                    : {}),
            });
            setFormValues(initialValues);
            dataRef.current = initialValues;
            setIsApplyEnabled(hasFilterValues(initialValues));
        }
    },[
        form,
        visible,
        includeInlineFilters,
        initialStatusId,
        initialTransactionTypeId,
        params,
        setFormValues,
    ]);
    useEffect(() => {
        form.resetFields();
        setParams({});
        dataRef.current = {};
        setIsApplyEnabled(false);
    }, [form, resetKey, resetToken]);
    useEffect(()=>{ 
        getPaymentMethod().then(res=>{
            if(res.data){
                setPaymentMethodList(res.data);
            }
        })
    },[]);
    return <Modal
        visible={visible}
        title={t("Finance.transactions.filterModal.title")}
        onCancel={handleCancel}
        width={960}
        centered
        footer={<div className="filter-modal-footer">
            <CustomButton
                text={t("common.cancel")}
                variant="outline"
                onClick={handleCancel}
                customClassName="filter-cancel-btn"
            />
            <CustomButton
                text={t("common.apply")}
                variant="primary"
                onClick={handleSearch}
                customClassName="filter-search-btn"
                disabled={!isApplyEnabled}
            />
        </div>}
        className={`payments-filter-modal${
        includeInlineFilters
            ? " payments-filter-modal--compact-inline-filters"
            : ""
    }`}>
        <Form
            form={form}
            layout="vertical"
            className="custorm-form payments-filter-form"
            onValuesChange={(_changedValues, values: FilterValues) => {
                setIsApplyEnabled(
                    hasFilterValues(values) || hasFilterValues(dataRef.current),
                );
            }}
        >
            {includeInlineFilters && (
                <>
                    <Form.Item label={t("Finance.transactions.table.type")} name="TransactionTypeId">
                        <Select allowClear placeholder={t("Finance.transactions.common.allTypes")}>
                            {transactionTypes
                                .filter((item) => item.id === 2 || item.id === 3 || item.id === 4)
                                .map((item) => (
                                    <Select.Option key={item.id} value={item.id}>
                                        {getLocalizedName(item, i18n.language)}
                                    </Select.Option>
                                ))}
                        </Select>
                    </Form.Item>
                    <Form.Item label={t("Finance.transactions.table.status")} name="StatusId">
                        <Select allowClear placeholder={t("Finance.transactions.common.allStatuses")}>
                            {transactionStatus
                                .filter((item) => item.id === 3 || item.id === 4 || item.id === 8)
                                .map((item) => (
                                    <Select.Option key={item.id} value={item.id}>
                                        {getLocalizedName(item, i18n.language)}
                                    </Select.Option>
                                ))}
                        </Select>
                    </Form.Item>
                </>
            )}
            <Form.Item label={t("Finance.transactions.filterModal.paymentMethod")} name="PaymentMethodId">
                <Select allowClear placeholder={t("Finance.transactions.filterModal.allPaymentMethods")}>
                    {[{
                        id: 0,
                        nameEn: t("Finance.transactions.filterModal.allPaymentMethods"),
                        nameAr: t("Finance.transactions.filterModal.allPaymentMethods")
                    },...paymentMethodList].map(item=>(
                        <Select.Option key={item.id} value={item.id}>
                            {getLocalizedName(item, i18n.language)}
                        </Select.Option>
                    ))}
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
}
