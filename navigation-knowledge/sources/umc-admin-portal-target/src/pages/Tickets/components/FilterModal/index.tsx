import { CustomButton } from "@/components/common";
import { Form, Modal, Select } from "antd";
import { useEffect, useMemo, useState, forwardRef, useImperativeHandle } from "react";
import './index.less';
import DatePicker from "@/components/common/LocalizedDatePicker";
import {
    getEnquirySource,
    getPriorityTypes,
    type IEnquirySourceResponse,
    type IEnquiryStatus,
    type IEnquiryType,
} from "@/services/tickets";
import { useTranslation } from "react-i18next";
import type { Moment } from "moment";

const ALLOWED_ENQUIRY_SOURCE_IDS = [1, 3, 5, 6, 7, 8, 9, 10] as const;

interface IFilterFormValues {
    EnquiryType?: number;
    PriorityId?: number;
    EnquirySourceId?: number;
    status?: number[];
    date?: [Moment, Moment];
}

interface IPriorityOption {
    label: string;
    value: number;
}

interface IFilterModalProps{
    visible: boolean;
    onCancel: () => void;
    isCustomerHappness: boolean;
    onSave: (values: IFilterFormValues) => void;
    enquiryTypes: IEnquiryType[];
    enquiryStatus?: IEnquiryStatus[];
    statusFilterIds?: readonly number[];
    showResponsiveFilters?: boolean;
}
interface IFilterModalRef {
    resetFields: () => void;
    getFieldsValue: () => IFilterFormValues;
    setFieldsValue: (values: Partial<IFilterFormValues>) => void;
}

const FilterModal = forwardRef<IFilterModalRef, IFilterModalProps>(({ enquiryTypes, enquiryStatus = [], statusFilterIds = [], showResponsiveFilters = false, isCustomerHappness, onSave, visible, onCancel }, ref) => {
    const [form] = Form.useForm<IFilterFormValues>();
    const { i18n, t } = useTranslation();
    const isArabic = i18n.language?.startsWith("ar");
    const [priorityOptions, setPriorityOptions] = useState<IPriorityOption[]>([]);
    const [enquirySource, setEnquirySource] = useState<IEnquirySourceResponse[]>([]);
    const [,update] = useState({});
    const enquiryType = useMemo(
        () => {
            const safeTypes = Array.isArray(enquiryTypes) ? enquiryTypes : [];
            return isCustomerHappness ? safeTypes : safeTypes.filter(item => ![3,5].includes(item.id));
        },
        [enquiryTypes, isCustomerHappness],
    );
    
    useImperativeHandle(ref, () => ({
        resetFields: () => form.resetFields(),
        getFieldsValue: () => form.getFieldsValue(true),
        setFieldsValue: (values) => form.setFieldsValue(values),
    }));
    
    useEffect(()=>{
        getPriorityTypes().then(res=>{
            if(res.data){
                setPriorityOptions(res.data.map(item => ({
                    label: i18n.resolvedLanguage === 'ar'? item.nameAr : item.nameEn,
                    value: item.id,
                })));
            }
        });
        getEnquirySource().then(res=>{
            if(res.data){
                setEnquirySource(
                    res.data.filter((item) =>
                        (ALLOWED_ENQUIRY_SOURCE_IDS as readonly number[]).includes(item.id),
                    ),
                );
            }
        });
    },[i18n.language]);
    
    return <Modal title={t("serviceConfiguration.filters.filter")} visible={visible} width={960} centered className={`tickets-filter-modal${isArabic ? " tickets-filter-modal--rtl" : ""}`} onCancel={onCancel} footer={<div className="tickets-filter-modal-footer-actions">
        <CustomButton onClick={onCancel} variant="outline" text={t("common.cancel")} />
        <CustomButton onClick={()=>onSave(form.getFieldsValue(true))} text={t("common.apply")} />
    </div>}>
        <Form className="tickets-filter-form" form={form} layout="vertical" onValuesChange={()=>update({})}>
            {showResponsiveFilters && !isCustomerHappness && (
            <Form.Item
                className="tickets-filter-form-responsive-field"
                name="EnquiryType"
                label={t("Customer.tickets.table.type")}
            >
                <Select placeholder={t("Customer.tickets.placeholders.allTypes")} allowClear>
                    {enquiryType.map(item=><Select.Option key={item.id} value={item.id}>{i18n.resolvedLanguage === 'ar'? item.nameAr : item.nameEn}</Select.Option>)}
                </Select>
            </Form.Item>
            )}
            {showResponsiveFilters && isCustomerHappness && (
            <Form.Item
                className="tickets-filter-form-responsive-field"
                name="status"
                label={t("Customer.tickets.table.status")}
            >
                <Select
                    mode="multiple"
                    maxTagCount={1}
                    maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
                    placeholder={t("Customer.tickets.placeholders.allStatuses")}
                    allowClear
                >
                    {enquiryStatus
                        .filter((item) => statusFilterIds.includes(item.id))
                        .map((item) => (
                            <Select.Option key={item.id} value={item.id}>
                                {i18n.resolvedLanguage === "ar" ? item.nameAr : item.nameEn}
                            </Select.Option>
                        ))}
                </Select>
            </Form.Item>
            )}
            {showResponsiveFilters && <Form.Item
                className="tickets-filter-form-responsive-field"
                name="date"
                label={t("Customer.tickets.table.lastUpdated")}
            >
                <DatePicker.RangePicker
                    getPopupContainer={(node) => node}
                    placeholder={[
                        t("Customer.tickets.placeholders.startDate"),
                        t("Customer.tickets.placeholders.endDate"),
                    ]}
                    separator="-"
                    allowClear
                />
            </Form.Item>}
            {isCustomerHappness && (
            <Form.Item name="EnquiryType" label={t("Customer.tickets.table.type")}>
                <Select placeholder={t("Customer.tickets.placeholders.allTypes")} allowClear>
                    {enquiryType.map(item=><Select.Option key={item.id} value={item.id}>{i18n.resolvedLanguage === 'ar'? item.nameAr : item.nameEn}</Select.Option>)}
                </Select>
            </Form.Item>
            )}
            <Form.Item name="PriorityId" label={t("Customer.tickets.filterModal.priority")}>
                <Select placeholder={t("Customer.tickets.filterModal.allPriority")} allowClear>
                    {
                        priorityOptions.map(item => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)
                    }
                </Select>
            </Form.Item>

            <Form.Item name="EnquirySourceId" label={t("Customer.tickets.filterModal.source")}>
                <Select placeholder={t("Customer.tickets.filterModal.allSource")} allowClear>
                    {enquirySource.map(item=><Select.Option key={item.id} value={item.id}>{i18n.resolvedLanguage === 'ar'? item.nameAr : item.nameEn}</Select.Option>)}
                </Select>
            </Form.Item>

            {/* <Form.Item name="IssueCategoryId" label={t("Customer.tickets.table.issueCategory")}>
                <Select placeholder={t("Customer.tickets.placeholders.allIssueCategory")} allowClear>
                    {enquiryIssueCategory.map(item=><Select.Option key={item.id} value={item.id}>{i18n.resolvedLanguage === 'ar'? item.nameAr : item.nameEn}</Select.Option>)}
                </Select>
            </Form.Item> */}
        </Form>
    </Modal>
})

export default FilterModal;
