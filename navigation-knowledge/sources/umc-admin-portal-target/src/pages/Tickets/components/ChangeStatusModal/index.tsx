import { DatePicker, Form, Input, Modal, Radio, Select } from "antd";
import datePickerEnUS from "antd/lib/date-picker/locale/en_US";
import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import type { Moment } from "moment";
import { useTranslation } from "react-i18next";
import CustomButton from "@/components/common/CustomButton";
import { CustomMessage } from "@/components/common";
import DepartmentProcessing from "@/assets/images/DepartmentProcessing.svg";
import {
    getDepartmentsAndRoles,
    getPriorityTypes,
    postCustomerTransfer,
    type IDepartmentRoleGroupResponse,
    type IEnquiryType,
} from "@/services/tickets";
import './index.less';

interface IChangeStatusModalProps {
    visible: boolean;
    onCancel: () => void;
    row: {
        id: number;
        enquiryTypeId: number;
        priorityId?: number | null;
        enquiryStatusId?: number;
        slaEndTime?: string | null;
    };
    onSave: () => void;
    enquiryTypes: IEnquiryType[];
}

interface ChangeStatusFormValues {
    enquiryStatusId?: number;
    enquiryTypeId?: number;
    priorityId?: number;
    departmentId?: number;
    roleId?: string;
    assignedDepartment?: string;
    deadLine?: Moment | string | null;
    note?: string;
}

interface SelectOption {
    label: string;
    value: number;
}

export default function ChangeStatusModal({ enquiryTypes, row, visible, onCancel, onSave }: IChangeStatusModalProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { i18n, t } = useTranslation();
    const isArabic = i18n.language?.startsWith("ar");
    const [depts, setDepts] = useState<IDepartmentRoleGroupResponse[]>([]);
    const [formValues, setFormValues] = useState<ChangeStatusFormValues>({});
    const [priorityOptions, setPriorityOptions] = useState<SelectOption[]>([]);
    console.log(row)
    const typeOptions = useMemo(
        () => {
            const safeTypes = Array.isArray(enquiryTypes) ? enquiryTypes : [];
            return safeTypes
                .filter((item) => item && item.id !== undefined && item.id !== null)
                .map((item) => {
                    const primaryLabel = i18n.resolvedLanguage === 'ar' ? item.nameAr : item.nameEn;
                    const fallbackLabel = i18n.resolvedLanguage === 'ar' ? item.nameEn : item.nameAr;

                    return {
                        label: primaryLabel || fallbackLabel || "",
                        value: item.id,
                    };
                });
        },
        [enquiryTypes, i18n.language],
    );

    const statusOptions = useMemo(() => [
        { value: 1, label: t("Customer.tickets.statusOptions.open") },
        { value: 2, label: t("Customer.tickets.statusOptions.pendingCustomer") },
        { value: 3, label: t("Customer.tickets.statusOptions.departmentProcessing") },
        { value: 5, label: t("Customer.tickets.statusOptions.resolved") },
    ], [t]);

    const statusRelatedFieldsMap: Record<number, Array<"enquiryTypeId" | "priorityId" | "assignedDepartment" | "deadLine" | "note">> = {
        1: ["enquiryTypeId", "priorityId"],
        2: ["enquiryTypeId", "priorityId"],
        3: ["enquiryTypeId", "priorityId", "assignedDepartment", "deadLine", "note"],
        5: [],
    };

    useEffect(() => {
        if (!visible) return;

        const initialValues = {
            enquiryStatusId: row.enquiryStatusId || undefined,
            enquiryTypeId: row.enquiryTypeId || undefined,
            priorityId: row.priorityId || undefined,
        };

        form.resetFields();
        form.setFieldsValue(initialValues);
        setFormValues(initialValues);
    }, [form, row.enquiryStatusId, row.enquiryTypeId, row.priorityId, visible]);

    useEffect(() => {
        getDepartmentsAndRoles().then((res) => {
            if (Array.isArray(res.data)) {
                setDepts(res.data);
            }
        });
    }, []);

    useEffect(() => {
        getPriorityTypes().then((res) => {
            if (res.data) {
                setPriorityOptions(
                    res.data.map((item) => ({
                        label: i18n.resolvedLanguage === 'ar' ? item.nameAr : item.nameEn,
                        value: item.id,
                    }))
                );
            }
        });
    }, [i18n.language]);

    const enquiryStatusId = formValues.enquiryStatusId;
    const visibleRelatedFields = enquiryStatusId ? statusRelatedFieldsMap[enquiryStatusId] || [] : [];
    const hasRelatedFields = visibleRelatedFields.length > 0;
    const modalStateClassName = hasRelatedFields
        ? "change-status-modal--complex"
        : "change-status-modal--simple";
    const wrapperStateClassName = hasRelatedFields
        ? "change-status-modal-wrapper--complex"
        : "change-status-modal-wrapper--simple";
    const slaDeadline = useMemo(() => {
        if (!row.slaEndTime) return null;
        const parsed = moment(row.slaEndTime);
        return parsed.isValid() ? parsed : null;
    }, [row.slaEndTime]);
    const selectedDeadline = formValues.deadLine ? moment(formValues.deadLine) : null;
    const showSlaDeadlineWarning =
        Boolean(
            selectedDeadline &&
            selectedDeadline.isValid() &&
            slaDeadline &&
            selectedDeadline.isAfter(slaDeadline),
        );
    function disabledDeadlineDate(current: Moment | null) {
        return Boolean(current && current < moment().startOf('day'));
    }

    function disabledDeadlineTime(current: Moment | null) {
        if (!current) return {};

        const now = moment();
        if (!current.isSame(now, 'day')) return {};

        return {
            disabledHours: () => Array.from({ length: now.hour() }, (_, i) => i),
            disabledMinutes: (selectedHour: number) =>
                selectedHour === now.hour()
                    ? Array.from({ length: now.minute() }, (_, i) => i)
                    : [],
            disabledSeconds: (selectedHour: number, selectedMinute: number) =>
                selectedHour === now.hour() && selectedMinute === now.minute()
                    ? Array.from({ length: now.second() }, (_, i) => i)
                    : [],
        };
    }

    async function handleSave() {
        try {
            setLoading(true);
            const values = await form.validateFields();
            const { assignedDepartment, ...transferValues } = values;
            const selectedDepartment = depts.find((group) =>
                group.roles?.some((role) => role.id === assignedDepartment),
            );
            const res = await postCustomerTransfer(row.id, {
                ...transferValues,
                departmentId: selectedDepartment?.departmentId ?? undefined,
                roleId: assignedDepartment,
                deadLine: values.deadLine ? moment(values.deadLine).format('YYYY-MM-DDTHH:mm:ss') : undefined,
            });
            if (res.data) {
                onSave();
                onCancel();
                CustomMessage.success(t("common.operationSuccess"));
            } else {
                CustomMessage.error(t("common.operationFailed"));
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal
            centered
            className={`change-status-modal ${modalStateClassName}${isArabic ? " change-status-modal--rtl" : ""}`}
            title={t("Customer.tickets.actions.changeStatus")}
            visible={visible}
            onCancel={onCancel}
            footer={(
                <div className="change-status-modal-footer-actions">
                    <CustomButton text={t("common.cancel")} variant="outline" onClick={onCancel} />
                    <CustomButton loading={loading} text={t("common.confirm")} onClick={handleSave} />
                </div>
            )}
        >
            <Form
                form={form}
                layout="vertical"
                onValuesChange={(_, allValues) => setFormValues(allValues)}
                className="change-status-modal-form"
            >
                <div className={`change-status-modal-wrapper ${wrapperStateClassName}`}>
                    <div className="change-status-modal-left">
                        <Form.Item
                            name="enquiryStatusId"
                            label={t("Customer.tickets.changeStatusModal.selectNewStatus")}
                            required
                            rules={[{ required: true, message: t("common.required") }]}
                        >
                            <Radio.Group
                                className="change-status-modal-status-group"
                                onChange={(event) => {
                                    const nextStatus = event.target.value;
                                    const clearedValues = {
                                        enquiryStatusId: nextStatus,
                                        departmentId: undefined,
                                        roleId: undefined,
                                        assignedDepartment: undefined,
                                        deadLine: undefined,
                                        note: undefined,
                                    };
                                    form.setFieldsValue(clearedValues);
                                    setFormValues((current) => ({
                                        ...current,
                                        ...clearedValues,
                                    }));
                                }}
                            >
                                {statusOptions.map((item) => (
                                    <Radio key={item.value} value={item.value}>
                                        {item.label}
                                    </Radio>
                                ))}
                            </Radio.Group>
                        </Form.Item>
                    </div>
                    {visibleRelatedFields.length > 0 && (
                        <div className="change-status-modal-right">
                            {visibleRelatedFields.includes("enquiryTypeId") && (
                                <Form.Item
                                    name="enquiryTypeId"
                                    label={t("Customer.tickets.changeStatusModal.type")}
                                    required
                                    rules={[{ required: true, message: t("common.required") }]}
                                >
                                    <Select placeholder={t("Customer.tickets.changeStatusModal.selectType")} allowClear>
                                        {typeOptions.map((item) => (
                                            <Select.Option key={item.value} value={item.value}>
                                                {item.label}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            )}
                            {visibleRelatedFields.includes("priorityId") && (
                                <Form.Item
                                    name="priorityId"
                                    label={t("Customer.tickets.changeStatusModal.priority")}
                                    required
                                    rules={[{ required: true, message: t("common.required") }]}
                                >
                                    <Select placeholder={t("Customer.tickets.changeStatusModal.selectPriority")} allowClear>
                                        {priorityOptions.map((item) => (
                                            <Select.Option key={item.value} value={item.value}>
                                                {item.label}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            )}
                            {visibleRelatedFields.includes("assignedDepartment") && (
                                <Form.Item
                                    name="assignedDepartment"
                                    label={t("Customer.tickets.changeStatusModal.assignedDepartment")}
                                    required
                                    rules={[{ required: true, message: t("common.required") }]}
                                >
                                    <Select
                                        dropdownClassName="change-status-modal__department-select-dropdown"
                                        placeholder={t("Customer.tickets.changeStatusModal.selectDepartment")}
                                        allowClear
                                    >
                                        {depts.map((group) => {
                                            if (group.departmentId === null || group.departmentId === undefined) {
                                                return null;
                                            }
                                            const departmentName = i18n.language === "ar"
                                                ? group.departmentNameAr || group.departmentNameEn
                                                : group.departmentNameEn || group.departmentNameAr;
                                            return (
                                                <Select.OptGroup
                                                    key={String(group.departmentId)}
                                                    label={
                                                        <span className="change-status-modal__department-group-label">
                                                            <img
                                                                className="change-status-modal__department-group-icon"
                                                                src={DepartmentProcessing}
                                                                alt=""
                                                                aria-hidden="true"
                                                            />
                                                            <span className="change-status-span">
                                                                {departmentName || String(group.departmentId)}
                                                            </span>
                                                        </span>
                                                    }
                                                >
                                                    {(group.roles ?? [])
                                                        .filter((role) => role.id)
                                                        .map((role) => (
                                                            <Select.Option key={role.id} value={role.id}>
                                                                {i18n.language === "ar"
                                                                    ? role.nameAr || role.nameEn
                                                                    : role.nameEn || role.nameAr}
                                                            </Select.Option>
                                                        ))}
                                                </Select.OptGroup>
                                            );
                                        })}
                                    </Select>
                                </Form.Item>
                            )}
                            {visibleRelatedFields.includes("deadLine") && (
                                <Form.Item
                                    className="deadline-form-item"
                                    label={t("Customer.tickets.changeStatusModal.responseDeadline")}
                                    required
                                    extra={
                                        showSlaDeadlineWarning ? (
                                            <div className="sla-deadline-warning">
                                                {t("Customer.tickets.changeStatusModal.slaDeadlineWarning")}
                                            </div>
                                        ) : undefined
                                    }
                                >
                                    <div className="change-status-deadline-picker-root">
                                        <Form.Item
                                            name="deadLine"
                                            noStyle
                                            rules={[{ required: true, message: t("common.required") }]}
                                        >
                                            <DatePicker
                                                className="deadline-picker"
                                                dropdownClassName="change-status-deadline-picker-dropdown"
                                                locale={datePickerEnUS}
                                                popupStyle={{ direction: "ltr" }}
                                                panelRender={(panelNode) => <div dir="ltr">{panelNode}</div>}
                                                getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
                                                placeholder={t("Customer.tickets.changeStatusModal.deadlinePlaceholder")}
                                                showTime={{
                                                    showHour: true,
                                                    showMinute: true,
                                                    showSecond: false,
                                                }}
                                                disabledDate={disabledDeadlineDate}
                                                disabledTime={disabledDeadlineTime}
                                                format="DD/MM/YYYY HH:mm"
                                            />
                                        </Form.Item>
                                    </div>
                                </Form.Item>
                            )}
                            {visibleRelatedFields.includes("note") && (
                                <div className="cs-transfer-notes-wrapper">
                                    <Form.Item
                                        className="cs-transfer-notes"
                                        name="note"
                                        label={t("Customer.tickets.common.notes")}
                                        required
                                        rules={[{ required: true, message: t("common.required") }]}
                                    >
                                        <Input.TextArea
                                            placeholder={t("Customer.tickets.common.enterNotes")}
                                            className="transfer-notes"
                                            rows={4}
                                            maxLength={1000}
                                        />
                                    </Form.Item>
                                    <div className="notes-num">{formValues.note?.length || 0}/1000</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Form>
        </Modal>
    );
}
