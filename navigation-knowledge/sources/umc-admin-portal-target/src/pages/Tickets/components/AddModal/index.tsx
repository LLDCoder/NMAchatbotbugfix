import { Divider, Form, Input, Modal, Radio, Select } from "antd";
import { CustomButton, CustomMessage } from "@/components/common";
import DocumentViewer from "@/components/common/DocumentViewer";
import { useTranslation } from "react-i18next";
import './index.less';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { IApplicationsResponse, IEnquirySourceResponse, IEnquiryType } from "@/services/tickets";
import { getApplications, getEnquirySource, postEnquiryNew, getPriorityTypes, getEstablishmentinformation } from "@/services/tickets";
import type { UserManagementValueObject } from "@/services/userManagement";
import { inspectionFigmaAssets } from "@/pages/InspectionCommon/assets";
import {
    FormMobileNumberInput,
    buildContactNumberFields,
    createContactNumberSnapshot,
    createMobileNumberFormRule,
    DEFAULT_COUNTRY_DIAL_CODE,
    readContactFormValue,
    toContactFormValue,
    validateMobileNumber,
} from '@/components/common/MobileNumberInput';
import AttachmentFormLabel from "../AttachmentFormLabel";
interface IAddModalProps {
  visible: boolean;
  onCancel: () => void;
  onSave: () => void;
  enquiryTypes: IEnquiryType[];
}

interface AddTicketFormValues {
    enquiryTypeId?: number;
    enquirySourceId?: number;
    hasApplicationNumber?: "yes" | "no";
    application?: string;
    priority?: number;
    description?: string;
    userTypeCode?: string;
    subUserTypeCode?: string;
    fullName?: string;
    email?: string;
    mobileNumber?: Record<string, unknown>;
}

const ALLOWED_ENQUIRY_SOURCE_IDS = [1, 2, 4, 6, 7, 8, 9];
const mobileFieldNames = {
    countryCode: 'mobileCountryCode',
    phoneNumber: 'mobileLocalNumber',
};
const initialMobile = createContactNumberSnapshot({
    countryCode: DEFAULT_COUNTRY_DIAL_CODE,
    localNumber: '',
    fullNumber: '',
});

export default function AddModal({ enquiryTypes, visible, onCancel, onSave }: IAddModalProps){
    const { t, i18n } = useTranslation();
    const isArabic = i18n.language?.startsWith("ar");
    const [form] = Form.useForm();
    const [enquirySource, setEnquirySource] = useState<IEnquirySourceResponse[]>([]);
    const [,update] = useState({});
    const [applications, setApplications] = useState<IApplicationsResponse[]>([]);
    const [applicationsLoading, setApplicationsLoading] = useState(false);
    const [applicationNumberSearch, setApplicationNumberSearch] = useState("");
    const [applicationDropdownOpen, setApplicationDropdownOpen] = useState(false);
    const [userTypes, setUserTypes] = useState<UserManagementValueObject[]>([]);
    const [loading, setLoading] = useState(false);
    const [isFormValid, setIsFormValid] = useState(false);
    const [priorityOptions, setPriorityOptions] = useState<Array<{
        label: string;
        value: number;
    }>>([]);
    const applicationSearchTimerRef = useRef<number | null>(null);
    const applicationRequestIdRef = useRef(0);
    const applicationSearchInputRef = useRef<HTMLInputElement>(null);
    const enquiryType = useMemo(
        () => {
            const safeTypes = Array.isArray(enquiryTypes) ? enquiryTypes : [];
            return safeTypes;
        },
        [enquiryTypes],
    );
    const applicationOptions = useMemo(
        () => applications.map((item) => ({
            label: item.applicationNumber || "",
            value: `${item.applicationDetailId}-${item.serviceId}`,
        })),
        [applications],
    );

    const loadApplications = useCallback(async (keyword = "") => {
        const requestId = applicationRequestIdRef.current + 1;
        applicationRequestIdRef.current = requestId;
        setApplicationsLoading(true);

        try{
            const res = await getApplications({
                applicatinNo: keyword.trim() || undefined,
            });

            if(requestId !== applicationRequestIdRef.current){
                return;
            }

            setApplications(Array.isArray(res.data) ? res.data : []);
        }catch{
            if(requestId !== applicationRequestIdRef.current){
                return;
            }

            setApplications([]);
        }finally{
            if(requestId === applicationRequestIdRef.current){
                setApplicationsLoading(false);
            }
        }
    }, []);

    const handleApplicationSearch = useCallback((value: string) => {
        const searchValue = value.slice(0, 200);
        setApplicationNumberSearch(searchValue);

        if(applicationSearchTimerRef.current){
            window.clearTimeout(applicationSearchTimerRef.current);
        }

        applicationSearchTimerRef.current = window.setTimeout(() => {
            applicationSearchTimerRef.current = null;
            void loadApplications(searchValue);
        }, 300);
    }, [loadApplications]);

    const handleApplicationClear = useCallback(() => {
        if(applicationSearchTimerRef.current){
            window.clearTimeout(applicationSearchTimerRef.current);
            applicationSearchTimerRef.current = null;
        }

        setApplicationNumberSearch("");
        void loadApplications();
    }, [loadApplications]);

    const handleApplicationDropdownVisibleChange = useCallback((open: boolean) => {
        setApplicationDropdownOpen(open);

        if(!open && applicationNumberSearch){
            handleApplicationClear();
        }
    }, [applicationNumberSearch, handleApplicationClear]);

    const handleApplicationSelect = useCallback(() => {
        if(applicationSearchTimerRef.current){
            window.clearTimeout(applicationSearchTimerRef.current);
            applicationSearchTimerRef.current = null;
        }

        setApplicationNumberSearch("");
        setApplicationDropdownOpen(false);
    }, []);

    const renderApplicationDropdown = useCallback((menu: ReactElement) => {
        const searchRowClassName = applicationNumberSearch
            ? "add-ticket-modal__application-dropdown-search add-ticket-modal__application-dropdown-search--active"
            : "add-ticket-modal__application-dropdown-search";
        const dropdownPanelClassName = applicationOptions.length
            ? "add-ticket-modal__application-dropdown-panel"
            : "add-ticket-modal__application-dropdown-panel add-ticket-modal__application-dropdown-panel--empty";

        return <div className={dropdownPanelClassName}>
            <div
                className={searchRowClassName}
                onClick={() => applicationSearchInputRef.current?.focus()}
                onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                }}
            >
                <img
                    src={inspectionFigmaAssets.createTask.searchIcon}
                    alt=""
                    className="add-ticket-modal__application-dropdown-search-icon"
                />
                <input
                    ref={applicationSearchInputRef}
                    className="add-ticket-modal__application-dropdown-search-input"
                    value={applicationNumberSearch}
                    maxLength={200}
                    placeholder={t("common.search")}
                    onChange={(event) => handleApplicationSearch(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                />
                {applicationNumberSearch ? <button
                    type="button"
                    className="add-ticket-modal__application-dropdown-clear"
                    onClick={handleApplicationClear}
                    onMouseDown={(event) => event.preventDefault()}
                    aria-label={t("common.reset")}
                >
                    <img src={inspectionFigmaAssets.createTask.clearIcon} alt="" />
                </button> : null}
            </div>
            <div className="add-ticket-modal__application-dropdown-menu">
                {menu}
            </div>
        </div>;
    }, [applicationNumberSearch, applicationOptions.length, handleApplicationClear, handleApplicationSearch, t]);

    useEffect(() => {
        if(!applicationDropdownOpen){
            return undefined;
        }

        const focusTimer = window.setTimeout(() => {
            applicationSearchInputRef.current?.focus();
        });

        return () => {
            window.clearTimeout(focusTimer);
        };
    }, [applicationDropdownOpen]);

    useEffect(()=>{
        if(visible){
            form.resetFields();
            form.setFieldValue('hasApplicationNumber', 'yes');
            form.setFieldValue('userTypeCode', '1');
            form.setFieldValue('mobileNumber', toContactFormValue(initialMobile, mobileFieldNames));
            setIsFormValid(false);
            setApplicationNumberSearch("");
            setApplicationDropdownOpen(false);
            update({});
            void loadApplications();
        }

        return () => {
            if(applicationSearchTimerRef.current){
                window.clearTimeout(applicationSearchTimerRef.current);
                applicationSearchTimerRef.current = null;
            }

            applicationRequestIdRef.current += 1;
        };
    },[form, loadApplications, visible]);
    useEffect(()=>{
        getEnquirySource().then(res=>{ 
            if(res.data){
                setEnquirySource(res.data.filter((item) => ALLOWED_ENQUIRY_SOURCE_IDS.includes(item.id)));
            }
        });
        getEstablishmentinformation().then(res=>{
            if(res.data){
                setUserTypes(res.data.filter((item) => item.code !== '1'));
            }
        });
    },[]);

    useEffect(()=>{
        getPriorityTypes().then(res=>{
            if(res.data){
                setPriorityOptions(res.data.map(item => ({
                    label: i18n.resolvedLanguage === 'ar'? item.nameAr : item.nameEn,
                    value: item.id,
                })));
            }
        });
    },[i18n.language, i18n.resolvedLanguage]);

    function hasRequiredValue(value: unknown){
        return typeof value === "string"
            ? value.trim().length > 0
            : value !== undefined && value !== null;
    }

    function checkFormValidity(){
        const values = form.getFieldsValue(true) as AddTicketFormValues;
        const requiredFieldNames: Array<keyof AddTicketFormValues> = [
            "enquiryTypeId",
            "enquirySourceId",
            "hasApplicationNumber",
            "priority",
            "description",
        ];

        if(values.hasApplicationNumber === "yes"){
            requiredFieldNames.push("application");
        }

        if(values.hasApplicationNumber === "no"){
            requiredFieldNames.push("userTypeCode", "fullName", "email", "mobileNumber");

            if(values.userTypeCode === "2"){
                requiredFieldNames.push("subUserTypeCode");
            }
        }

        const hasAllRequiredValues = requiredFieldNames.every((fieldName) =>
            hasRequiredValue(values[fieldName]),
        );
        const hasValidationErrors = form
            .getFieldsError(requiredFieldNames)
            .some(({ errors }) => errors.length > 0);
        const hasValidMobileNumber = values.hasApplicationNumber !== "no" || validateMobileNumber(
            readContactFormValue(values.mobileNumber, mobileFieldNames),
        ).isValid;

        setIsFormValid(hasAllRequiredValues && hasValidMobileNumber && !hasValidationErrors);
    }

    async function handleSave(){
        const values = await form.validateFields();
        const [applicationDetailId, serviceId] = values.application?.split('-') ?? [];
        const userTypeCode = values.userTypeCode === '2' ? values.subUserTypeCode : values.userTypeCode;
        const mobileValue = readContactFormValue(values.mobileNumber, mobileFieldNames);
        const mobileFields = buildContactNumberFields({
            value: mobileValue,
            initial: initialMobile,
            keys: {
                fullNumber: 'mobileNumber',
                countryCode: 'mobileCountryCode',
                localNumber: 'mobileLocalNumber',
            },
        });


        const req = {
            applicationDetailId: values.application ? Number(applicationDetailId) : undefined,
            priorityId: values.priority,
            serviceId: values.application ? Number(serviceId) : undefined,
            attachmentUrls: Array.isArray(values.attachmentUrls) ? values.attachmentUrls : (values.attachmentUrls ? [values.attachmentUrls] : []),
            description: values.description,
            // enquiryIssueCategoryId: Number(values.enquiryIssueCategoryId),
            enquirySourceId: Number(values.enquirySourceId),
            enquiryTypeId: Number(values.enquiryTypeId),
            userTypeCode,
            fullName: values.fullName,
            email: values.email,
            ...(values.hasApplicationNumber === 'no' ? mobileFields : {}),
        }

        if (values.hasApplicationNumber === 'yes'){
            delete req.userTypeCode
        }
        try{
            setLoading(true);
            const res = await postEnquiryNew(req);
            if(res.data){
                CustomMessage.success(t("common.operationSuccess"));
                onSave();
                onCancel();
            }
        }finally{
            setLoading(false);
        }
    }
    return <>
        <Modal
        centered
        title={t("Customer.tickets.addModal.addNew")} 
        width={960}
        className={`add-ticket-modal${isArabic ? " add-ticket-modal--rtl" : ""}`} 
        visible={visible} 
        onCancel={onCancel} 
        maskClosable={false} 
        footer={<div className="add-ticket-modal__footer">
            <CustomButton
                onClick={onCancel}
                variant="outline"
                text={t("common.cancel")}
                customClassName="add-ticket-modal__footer-button"
            />
            <CustomButton
                loading={loading}
                disabled={!isFormValid || loading}
                onClick={handleSave}
                text={t("common.save")}
                customClassName="add-ticket-modal__footer-button"
                permissionCode="CustomerModule.Tickets.Save"
                permissionRoutePath="/happiness/tickets"
            />
        </div>}>
            <div className="add-ticket-wrapper">
                <div className="add-ticket-title">
                    {t("Customer.tickets.addModal.ticketInfo")}
                </div>
                <Form
                    form={form}
                    layout="vertical"
                    className="add-ticket-modal__form custorm-form"
                    onFieldsChange={checkFormValidity}
                    onValuesChange={()=>{
                        update({});
                    }}
                >
                    <Form.Item label={t("Customer.tickets.addModal.enquiryType")} name="enquiryTypeId" required rules={[
                        { required: true, message: t("common.required") }
                    ]}> 
                        <Select
                            placeholder={t("Customer.tickets.addModal.selectEnquiryType")}
                            allowClear
                        >
                            {enquiryType.map(item=>(
                                <Select.Option key={item.id} value={item.id}>
                                    {i18n.resolvedLanguage === 'ar' ? item.nameAr : item.nameEn}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>   
                    <Form.Item label={t("Customer.tickets.addModal.enquirySource")} name="enquirySourceId" required rules={[
                        { required: true, message: t("common.required") }
                    ]}> 
                        <Select
                            placeholder={t("Customer.tickets.addModal.selectEnquirySource")}
                            allowClear
                        >
                            {enquirySource.map(item=>(
                                <Select.Option key={item.id} value={item.id}>
                                    {i18n.resolvedLanguage === 'ar' ? item.nameAr : item.nameEn}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>   
                    <Form.Item label={t("Customer.tickets.addModal.hasApplicationNumber")} name="hasApplicationNumber" required rules={[
                        { required: true, message: t("common.required") }
                    ]}> 
                        <Radio.Group onChange={() => {
                            setApplicationNumberSearch("");
                            setApplicationDropdownOpen(false);
                            update({});
                        }}>
                            <Radio value={'yes'}>{t("addNewService.loginRequired.yes")}</Radio>
                            <Radio value={'no'}>{t("addNewService.loginRequired.no")}</Radio>
                        </Radio.Group>
                    </Form.Item>  
                    {form.getFieldValue('hasApplicationNumber') === 'yes' && <Form.Item name="application" label={t("Customer.tickets.addModal.applicationNumber")} required rules={[
                        { required: true, message: t("common.required") }
                    ]}> 
                        <Select
                            showSearch={false}
                            filterOption={false}
                            onClear={handleApplicationClear}
                            onSelect={handleApplicationSelect}
                            onDropdownVisibleChange={handleApplicationDropdownVisibleChange}
                            open={applicationDropdownOpen}
                            dropdownClassName="add-ticket-modal__application-select-dropdown"
                            dropdownRender={renderApplicationDropdown}
                            listHeight={280}
                            menuItemSelectedIcon={null}
                            virtual={false}
                            loading={applicationsLoading}
                            options={applicationOptions}
                            optionLabelProp="label"
                            placeholder={t("Customer.tickets.addModal.selectApplicationNumber")}
                            allowClear
                        />
                    </Form.Item>}
                     {/* <Form.Item label={t("Customer.tickets.table.issueCategory")} name="enquiryIssueCategoryId" required rules={[
                        { required: true, message: t("common.required") }
                    ]}> 
                        <Select
                            placeholder={t("Customer.tickets.addModal.selectIssueCategory")}
                            allowClear
                        >
                            {enquiryIssueCategory.map(item=>{
                                return <Select.Option key={item.id} value={item.id}>
                                    {i18n.resolvedLanguage === 'ar' ? item.nameAr : item.nameEn}
                                </Select.Option>
                            })}
                        </Select>
                    </Form.Item>   */}

                    <Form.Item label={t("Customer.tickets.addModal.priority")} name="priority" required rules={[
                        { required: true, message: t("common.required") }
                    ]}> 
                        <Select
                            placeholder={t("Customer.tickets.addModal.selectPriority")}
                            allowClear
                        >
                            {priorityOptions.map(item => <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>)}
                            </Select>
                    </Form.Item>   
                    {form.getFieldValue('hasApplicationNumber') === 'yes' && <Form.Item name="attachmentUrls" label={<AttachmentFormLabel />}> 
                        <DocumentViewer
                            hasDelete={true}
                            uploadConfig={{
                                maxSize: 5,
                                maxCount: 3,
                                uploadTip: "",
                            }} 
                        />
                    </Form.Item>}
                    <div className="add-ticket-description">
                        <Form.Item name="description" className="add-tickets-desc" label={t("Customer.tickets.addModal.problemDescription")} required rules={[
                            { required: true, message: t("common.required") }
                        ]}> 
                            <Input.TextArea maxLength={1000} placeholder={t("Customer.tickets.addModal.enterProblemDescription")} rows={3} />
                        </Form.Item>  
                        <div className="description-num">{form.getFieldValue('description')?.length ?? 0}/1000</div>
                    </div>
                    {form.getFieldValue('hasApplicationNumber') === 'no' && <Form.Item name="attachmentUrls" className="add-tickets-attachments" label={<AttachmentFormLabel />}> 
                        <DocumentViewer
                            hasDelete={true}
                            uploadConfig={{
                                maxSize: 5,
                                maxCount: 3,
                                uploadTip: "",
                            }} 
                        />
                    </Form.Item>}
                    {form.getFieldValue('hasApplicationNumber') === 'no' && <>
                        <Divider style={{borderColor: '#E1E3E5'}} />
                        <div className="add-ticket-title">
                            {t("Customer.tickets.addModal.customerInformation")}
                        </div>
                        <Form.Item className={`${form.getFieldValue('userTypeCode') !== '2' ? 'user-type-form-item' : ''} `} name="userTypeCode" label={t("Customer.tickets.addModal.userType")} required rules={[
                            { required: true, message: t("common.required") }
                        ]}> 
                            <Radio.Group defaultValue={'1'} onChange={() => update({})}>
                                <Radio value={'1'}>{t("Customer.tickets.addModal.individual")}</Radio>
                                <Radio value={'2'}>{t("Customer.tickets.addModal.establishmentSubTypes")}</Radio>
                            </Radio.Group>
                        </Form.Item>
                        {
                            form.getFieldValue('userTypeCode') === '2' && (
                                <Form.Item label={t("Customer.tickets.addModal.establishmentSubTypes")} name="subUserTypeCode"  required rules={[
                                    { required: true, message: t("common.required") }
                                ]}> 
                                    <Select
                                        placeholder={t("Customer.tickets.addModal.selectEstablishmentSubTypes")}
                                        allowClear
                                    >
                                        {userTypes.map(item=>{
                                            return <Select.Option key={item.id} value={item.code}>
                                                {i18n.resolvedLanguage === 'ar' ? item.nameAr : item.nameEn}
                                            </Select.Option>
                                        })}
                                    </Select>
                                </Form.Item>  
                            )
                        }    
                        <Form.Item name="fullName" label={t("Customer.tickets.addModal.fullName")} required rules={[
                            { required: true, message: t("common.required") }
                        ]}> 
                            <Input placeholder={t("Customer.tickets.addModal.enterName")} maxLength={200} />
                        </Form.Item>  
                        <Form.Item label={t("Customer.tickets.addModal.email")} name="email" required rules={[
                            { required: true, message: t("common.required") },
                            { type: 'email', message: t("signup.please.emailFormat") }
                        ]}> 
                            <Input placeholder={t("Customer.tickets.addModal.enterEmail")} maxLength={200} />
                        </Form.Item>
                        <Form.Item 
                            label={t("Customer.tickets.addModal.mobileNumber")} 
                            name="mobileNumber"
                            required
                            className="add-ticket-modal__mobile-number"
                            rules={[
                                createMobileNumberFormRule({
                                    fieldNames: mobileFieldNames,
                                    required: true,
                                }),
                            ]}
                        >
                            <FormMobileNumberInput
                                fieldNames={mobileFieldNames}
                                placeholder={t("Customer.tickets.addModal.enterMobileNumber")}
                                searchPlaceholder={t("common.search")}
                                emptyText={t("common.noData")}
                            />
                        </Form.Item>  
                    </>}
                </Form>
            </div>
        </Modal>
    </>
}
