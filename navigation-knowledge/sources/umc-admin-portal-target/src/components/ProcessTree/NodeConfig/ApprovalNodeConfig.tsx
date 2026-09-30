import { Divider, Form, Input, Select, Switch, Checkbox, Modal, Tooltip } from 'antd';
import type { INode, INodeProps } from '@/components/ProcessTree';
import Question from '@/assets/icons/Question';
import { useTranslation } from 'react-i18next';
import { useDictStore } from "@/store/dict-store";
import Tick from '@/assets/icons/Tick';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isArabicLanguage } from "@/localization/language";
import {
    DEFAULT_APPROVE_ACTION,
    DEFAULT_REJECT_ACTION,
    getWorkflowApproveActionOptions,
    getWorkflowRejectActionOptions,
    type WorkflowActionConfig,
    type WorkflowActionOption,
    resolveWorkflowActionConfig,
} from '@/constants/workflowActions';
const { Option, OptGroup } = Select;
interface IApprovalNodeConfigProps {
    onProceessChange: (process: INode<keyof INodeProps>) => void;
    selectNode: INode<'approval'>;
    process: INode<keyof INodeProps>;
}

// Collect all Approval Nodes in process order
function collectApprovalNodes(node: INode<keyof INodeProps>, nodes: INode<'approval'>[] = []): INode<'approval'>[] {
    // Skip ROOT and PROCESSEND nodes, only collect APPROVAL nodes
    if (node.type === 'APPROVAL') {
        nodes.push(node as INode<'approval'>);
    }
    
    // If it's a branch node, process branches first, then process subsequent nodes
    if (node.branchs && Array.isArray(node.branchs)) {
        // Process each branch
        node.branchs.forEach(branch => {
            collectApprovalNodes(branch, nodes);
        });
        // After processing branches, process nodes after branches
        if (node.children) {
            collectApprovalNodes(node.children, nodes);
        }
    } else {
        // For non-branch nodes, directly process child nodes
        if (node.children) {
            collectApprovalNodes(node.children, nodes);
        }
    }
    
    return nodes;
}

// Check if the node is the first Approval Node
function isFirstApprovalNode(process: INode<keyof INodeProps>, selectNode: INode<'approval'>): boolean {
    const approvalNodes = collectApprovalNodes(process);
    if (approvalNodes.length === 0) return false;
    
    // Find the first Approval Node (in process order)
    const firstApprovalNode = approvalNodes[0];
    return firstApprovalNode?.id === selectNode?.id;
}

interface IOptions{
    label: string;
    value: string;
    id: string;
}
export interface IDeptOpts{
    id: number;
    label: string;
    options: IOptions[];
}

export default function ApprovalNodeConfig({process, onProceessChange, selectNode}: IApprovalNodeConfigProps){
    const { i18n, t } = useTranslation();
    const currentLanguage = i18n.resolvedLanguage || i18n.language;
    const isArabic = isArabicLanguage(currentLanguage);
    const { ApprovalRoleDepartment} = useDictStore((state)=>({
        ApprovalRoleDepartment: state.ApprovalRoleDepartment
    }));
   
    
    const deptId = selectNode.props?.approvalDepartment;
    const roleId = selectNode.props?.approvalRole;
    const deptSelected = useMemo(()=>{
        for(let i = 0; i < ApprovalRoleDepartment.length; i++){
            const element = ApprovalRoleDepartment[i];
            if(element.departmentId === Number(deptId) && element.id === roleId){
                return {
                    label: isArabic ? element.departmentNameAr + '/' + element.nameAr  : element.departmentNameEn + '/' + element.nameEn,
                    value: deptId + '/' + roleId,
                    id: roleId
                }
            }
        }
    },[ApprovalRoleDepartment, deptId, isArabic, roleId]);
    const roleDeptOpts = useMemo(()=>{
        const roleOpts: { [key: string]: IOptions[] } = {};
        const deptOpts: { [key: string]: IDeptOpts } = {};
        for(let i = 0; i < ApprovalRoleDepartment.length; i++){
            const element = ApprovalRoleDepartment[i];
            deptOpts[element.departmentId] = {
                id: element.departmentId,
                label: isArabic ? element.departmentNameAr : element.departmentNameEn,
                options: []
            }
            if(roleOpts[element.departmentId]){
                roleOpts[element.departmentId].push({
                    label: isArabic ? element.nameAr  : element.nameEn,
                    value: element.departmentId + '/' + element.id,
                    id: element.id
                })
            } else{
                roleOpts[element.departmentId] = [{
                    label: isArabic ? element.nameAr  : element.nameEn,
                    value: element.departmentId + '/' + element.id,
                    id: element.id
                }]
            }
        }
        return Object.keys(deptOpts).map(key => ({
            ...deptOpts[key],
            options: roleOpts[key] || []
        }));
    },[ApprovalRoleDepartment, isArabic]);

    return <div className='approval-node-config'>
        <Form className='node-config-form custorm-form' layout='vertical'>
            <Form.Item label={t('workflow.nodeConfig.name')} required>
                <Input value={selectNode?.name} onChange={(e)=>{
                    selectNode.name = e.target.value;
                    if (selectNode.props) {
                        if (isArabic) {
                            selectNode.props.nodeNameAr = e.target.value;
                        } else {
                            selectNode.props.nodeNameEn = e.target.value;
                        }
                    }
                    onProceessChange({...process});
                }} />
            </Form.Item>
            <div className='textarea-desc'>
                <Form.Item  label={t('workflow.nodeConfig.desc')}>
                    <Input.TextArea maxLength={200} placeholder={t('workflow.nodeConfig.enter.desc')} value={selectNode?.props?.nodeDescription} onChange={(e)=>{
                        if (selectNode.props) {
                            selectNode.props.nodeDescription = e.target.value;
                        }
                        onProceessChange({...process});
                    }} />
                </Form.Item>
                <div className='textarea-desc-count'>{selectNode?.props?.nodeDescription?.length || 0}/200</div>
            </div>
           
            <Form.Item required label={t('workflow.nodeConfig.role')}>
                <Select placeholder={t('workflow.nodeConfig.enter.dept')} labelInValue className='dept-select' getPopupContainer={(node)=>node.parentNode} value={deptSelected} onChange={(v: { value: string })=>{
                    const {value} = v;
                    if(selectNode?.props){
                        const [deptId, roleId] = value.split('/');
                        selectNode.props.approvalDepartment = Number(deptId);
                        selectNode.props.approvalRole = roleId;
                        onProceessChange({...process});
                    }  
                }} 
            >
                {roleDeptOpts?.map((item)=><OptGroup key={item.id} label={item.label}>
                    {item.options.map(opt => {
                        const value = (selectNode?.props?.approvalDepartment ?? '') + '-' + (selectNode?.props?.approvalRole ?? '');
                        return <Option key={opt.value} value={opt.value}><div className='dept-select-label'><div>{opt.label}</div>{value === opt.value && <div className='dept-select-icon'><Tick /></div>}</div></Option>
                    })}
                </OptGroup>)}
            </Select>
                
            </Form.Item>
            <Form.Item required label={t("workflow.nodeConfig.availableActions")}>
                <AvailableActions 
                    value={selectNode?.props?.propertiesJson ? JSON.parse(selectNode?.props?.propertiesJson): {}} 
                    onChange={(val)=>{
                        if (selectNode.props) {
                            selectNode.props.propertiesJson = JSON.stringify(val);
                        }
                        onProceessChange({...process});
                    }}
                    process={process}
                    selectNode={selectNode}
                />
            </Form.Item>
            <div className='sla-wrapper'>
                <div className='sla-header'>
                    <div className='label'>
                        {t("workflow.nodeConfig.slaTimeLimit")}
                        <Tooltip getPopupContainer={node=>node} color='#fff' title={<div className='sla-time'>
                            <div><b>{t('workflow.nodeConfig.slaTimeDay')}</b>: {t('workflow.nodeConfig.slaTimeDayTip')}</div>
                            <div><b>{t('workflow.nodeConfig.slaTimeHours')}</b>: {t('workflow.nodeConfig.slaTimeHoursTip')}</div>
                            <div><b>{t('workflow.nodeConfig.slaTimeMinutes')}</b>: {t('workflow.nodeConfig.slaTimeMinutesTip')}</div>
                        </div>}>
                            <div className='icon'><Question /></div>
                        </Tooltip>
                    </div>
                </div>
                <div className='form-area'>
                    <Input maxLength={3} value={selectNode?.props?.slaTime} onChange={(e)=>{
                        if(selectNode.props){
                            const value = Number(e.target.value);
                            if(!isNaN(value)){
                                selectNode.props.slaTime = value;
                            }
                        }
                        onProceessChange({...process});
                    }} />
                    <Select value={selectNode?.props?.slaType} onChange={(v)=>{
                        if (selectNode.props) {
                            selectNode.props.slaType = v;
                        }
                        onProceessChange({...process});
                    }} className='sla-time-select' options={[
                        {label: t("workflow.nodeConfig.Days"), value: 'days'},
                        {label: t("workflow.nodeConfig.Hours"), value: 'hours'},
                        {label: t("workflow.nodeConfig.Minutes"), value: 'minutes'},
                    ]} getPopupContainer={(node)=>node} />
                </div>
            </div>
            <Divider />
            <div className='skip-wrraper'>
                <Checkbox checked={selectNode?.props?.isSkip} onChange={(e)=>{
                    if (selectNode.props) {
                        selectNode.props.isSkip = e.target.checked;
                    }
                    onProceessChange({...process})
                }}>{t("workflow.nodeConfig.skip")}</Checkbox>
            </div>
        </Form>
    </div>
}
type TToggleKey = "externalApproval" | "requestModification" | "sendBack";
type BooleanMap<T extends string> = {
  [key in T]?: boolean;
};
type RejectConfig = {
  reject?: null | boolean | WorkflowActionConfig;
};
type ValueType = BooleanMap<TToggleKey> & RejectConfig & {
  approve?: boolean | WorkflowActionConfig;
};
interface IAvailableActionsParams{
    value?: ValueType;
    onChange?: (values: ValueType) => void;
    process?: INode<keyof INodeProps>;
    selectNode?: INode<'approval'>;
}
function AvailableActions({value = {
    approve: DEFAULT_APPROVE_ACTION,
    reject: DEFAULT_REJECT_ACTION,
    externalApproval: false,
    requestModification: false,
    sendBack: false
} as ValueType, onChange, process, selectNode}: IAvailableActionsParams){
    const { i18n, t } = useTranslation();
    const currentLanguage = i18n.resolvedLanguage || i18n.language;
    const { search } = useLocation();
    const [actionModalType, setActionModalType] = useState<"approve" | "reject" | null>(null);
    const serviceCode = useMemo(
        () => new URLSearchParams(search).get("serviceCode"),
        [search],
    );
    const approveActionOptions = useMemo(
        () => getWorkflowApproveActionOptions(serviceCode, currentLanguage),
        [currentLanguage, serviceCode],
    );
    const rejectActionOptions = useMemo(
        () => getWorkflowRejectActionOptions(currentLanguage),
        [currentLanguage],
    );
    
    // Calculate whether to show Send Back switch
    const shouldShowSendBack = useMemo(() => {
        if (!process || !selectNode) return false;
        
        const approvalNodes = collectApprovalNodes(process);
        const approvalNodeCount = approvalNodes.length;
        
        // If there's only one Approval Node, don't show Send Back
        if (approvalNodeCount <= 1) {
            return false;
        }
        
        // If there are two or more Approval Nodes, check if the current selected one is the first
        const isFirst = isFirstApprovalNode(process, selectNode);
        
        // If the first box is clicked, don't show Send Back; if other boxes are clicked, show Send Back
        return !isFirst;
    }, [process, selectNode]);
    
    function handleChange(field: TToggleKey, val: boolean){
        const currentValue = value || {
            approve: DEFAULT_APPROVE_ACTION,
            reject: DEFAULT_REJECT_ACTION,
            externalApproval: false,
            requestModification: false,
            sendBack: false
        } as ValueType;
        const newValue = { ...currentValue, [field]: val };
        onChange?.(newValue);
    }
    const [ form ] = Form.useForm();
    const actionOptions = actionModalType === "approve"
        ? approveActionOptions
        : rejectActionOptions;
    const modalTitle = actionModalType === "approve"
        ? t("workflow.nodeConfig.editApproveAction")
        : t("workflow.nodeConfig.editRejectAction");
    const approveAction = resolveWorkflowActionConfig(
        value?.approve,
        DEFAULT_APPROVE_ACTION,
        approveActionOptions,
        currentLanguage
    );
    const rejectAction = resolveWorkflowActionConfig(
        value?.reject,
        DEFAULT_REJECT_ACTION,
        rejectActionOptions,
        currentLanguage
    );
    const openActionModal = (type: "approve" | "reject") => {
        const config = type === "approve" ? approveAction : rejectAction;
        form.setFieldsValue({
            label: config.label,
            action: config.action,
        });
        setActionModalType(type);
    };
    const handleActionChange = (action: number) => {
        const selected = actionOptions.find((item) => item.action === action);
        if (selected) {
            form.setFieldValue("label", selected.label);
        }
    };
    const saveAction = async () => {
        const values: WorkflowActionConfig = await form.validateFields();
        const selected = actionOptions.find(
            (item) => String(item.action) === String(values.action)
        ) as WorkflowActionOption | undefined;
        const nextAction = {
            label: values.label || selected?.label || "",
            action: Number(values.action),
        };
        const currentValue = value || {
            approve: DEFAULT_APPROVE_ACTION,
            reject: DEFAULT_REJECT_ACTION,
            externalApproval: false,
            requestModification: false,
            sendBack: false
        } as ValueType;

        if (actionModalType === "approve") {
            onChange?.({ ...currentValue, approve: nextAction });
        }
        if (actionModalType === "reject") {
            onChange?.({ ...currentValue, reject: nextAction });
        }
        setActionModalType(null);
    };
    return <>
        <Modal centered className='reject-action-modal custorm-modal' maskClosable={false} onCancel={()=>setActionModalType(null)} footer={false} title={modalTitle} visible={Boolean(actionModalType)}>
            <Form form={form} layout='vertical' className='custorm-form'>
                <Form.Item name="label" label={t("workflow.nodeConfig.actionLabel")} rules={[
                    { required: true, message: t('common.required')}
                ]}>
                    <Input />
                </Form.Item>
                <Form.Item name="action" label={t("workflow.nodeConfig.action")} rules={[
                    { required: true, message: t('common.required')}
                ]}>
                    <Select
                        dropdownClassName="workflow-action-select-dropdown"
                        getPopupContainer={() => document.body}
                        placement="bottomLeft"
                        onChange={handleActionChange}
                    >
                        {actionOptions.map((item) => (
                            <Select.Option key={item.action} value={item.action}>
                                {item.label}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
            </Form>
            <div className='reject-action-modal-footer'>
                <div className='btn-cancel' onClick={()=>{
                    setActionModalType(null);
                    form.resetFields();
                }}>{t("common.cancel")}</div>
                <div className='btn-save' onClick={async () => {
                    await saveAction();
                }}>{t("common.save")}</div>
            </div>
        </Modal>
        <div className='action-title'>
            {t("workflow.nodeConfig.requiredActions")}
        </div>
        <div className='action-item'>
            <div className='action-left'>
                <div className='action-name'>{t("workflow.nodeConfig.approve")}</div>
                <div className='edit' onClick={()=>openActionModal("approve")}>{t('common.edit')}</div>
            </div>
        </div>
        <div className='action-item'>
            <div className='action-left'>
                <div className='action-name'>{t("workflow.nodeConfig.reject")}</div>
                <div className='edit' onClick={()=>openActionModal("reject")}>{t('common.edit')}</div>
            </div>
        </div>
        <div className='action-title optional-action'>
            {t("workflow.nodeConfig.optionalActions")}
        </div>
        <div className={`action-item ${value?.externalApproval ? '': 'action-off'}`}>
            <div className='action-left'>
                <div className='action-name'>{t("workflow.nodeConfig.externalApproval")}</div>
            </div>
            <div className='action-right'>
                <Switch checked={value?.externalApproval} onChange={(bool)=>handleChange('externalApproval', bool)} checkedChildren={t("common.on")} unCheckedChildren={t("common.off")} className='action-switch' />
            </div>
        </div>
        <div className={`action-item ${value?.requestModification ? '': 'action-off'}`}>
            <div className='action-left'>
                <div className='action-name'>{t("workflowActions.requestModification")}</div>
            </div>
            <div className='action-right'>
                <Switch checked={value?.requestModification} onChange={(bool)=>handleChange('requestModification', bool)} checkedChildren={t("common.on")} unCheckedChildren={t("common.off")} className='action-switch' />
            </div>
        </div>
        {shouldShowSendBack && (
            <div className={`action-item ${value?.sendBack ? '': 'action-off'}`}>
                <div className='action-left'>
                    <div className='action-name'>{t("workflow.nodeConfig.sendBack")}</div>
                </div>
                <div className='action-right'>
                    <Switch checked={value?.sendBack} onChange={(bool)=>handleChange('sendBack', bool)} checkedChildren={t("common.on")} unCheckedChildren={t("common.off")} className='action-switch' />
                </div>
            </div>
        )}
    </>
}
