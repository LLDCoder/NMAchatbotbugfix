import type { TNodeType, INode, INodeProps } from '.';
import Line from './Line'
import approvalPng from '@/assets/images/approval.png';
import { useDictStore } from "@/store/dict-store";
import { useTranslation } from 'react-i18next';
import warning from '@/assets/images/warning.png';
import menu from '@/assets/images/menu.svg';
import { Dropdown, Menu, Modal, Tooltip } from 'antd'
import Warning from '@/assets/icons/Warning';
import { validateUserTask } from '@/components/common/ProcessDesign';
import { useMemo } from 'react';

export interface INodeComponentProps<T extends keyof INodeProps>{
    node: INode<T>,
    active: boolean;
    onClick: () => {},
    onInsertNode: (type: TNodeType) => {},
    onDelNode: () => void;
    onFresh: () => void;
    onCopy: () => void;
    props?: {
        level: number;
        size: number;
    };
    leftMove?: () => void;
    rightMove?: () => void;
}
interface IOptionDropdownProps{
    onDelNode: () => void;
    onCopy: () => void;
}
export function OptionDropdown({ onDelNode, onCopy }: IOptionDropdownProps) {
  const { t } = useTranslation();
   function showDeleteConfirm(){
    Modal.confirm({
      centered: true,
      className: 'delete-confirm-modal',
      title: t("node.delete.title"),
      icon: <Warning className='anticon anticon-exclamation-circle delete-confirm-icon' />,
      content: t("node.delete.desc"),
      okText: t("node.delete.confirm"),
      cancelText: t("node.delete.cancel"),
      onOk() {
        onDelNode();
      },
    })
  }
   function handleMenuClick(key: string) { 
    if(key === 'delete'){
      showDeleteConfirm();
    }
    if(key === 'duplicate'){
      onCopy();
    }
  }
  return <Dropdown 
    trigger={['click']}
    overlay={<Menu
      onClick={({ key, domEvent }) => {
        domEvent.stopPropagation();
        handleMenuClick(key);
      }}
      items={[
          {
              key: "duplicate",
              label: t("workflow.nodeActions.duplicate"),
          },
          {
              key: "delete",
              label: t("workflow.nodeActions.delete"),
              danger: true,
          },
      ]}
  />}>
    <img src={menu} alt="" />
  </Dropdown>
}
export default function Approval({active, node, onClick, onInsertNode, onDelNode, onCopy }: INodeComponentProps<'approval'>) { 
  const { t, i18n } = useTranslation();
  const { ApprovalRoleDepartment} = useDictStore((state)=>({
      ApprovalRoleDepartment: state.ApprovalRoleDepartment
  }));
 
  const dept = node.props?.approvalDepartment;
  const role = node.props?.approvalRole;
  const approvalDepartmentRole = useMemo(()=>{
    for (let i = 0; i < ApprovalRoleDepartment.length; i++) {
      const element = ApprovalRoleDepartment[i];
      if(element.departmentId === Number(dept) && element.id === role){
        return i18n.resolvedLanguage === 'ar' ? element.departmentNameAr + '/' + element.nameAr  : element.departmentNameEn + '/' + element.nameEn;
      }
    }
  },[ApprovalRoleDepartment, dept, i18n.language, role])
  
  return <div className={`base-node approval-node node-before ${active ? 'node-active': ''}`}>
    <div className='root-node-body' onClick={onClick}>
      <div className='root-node-actions'>
        {!validateUserTask(node.props) && <Tooltip color='#fff' title={t('workflow.nodeConfig.tooltip.approval')}><img src={warning} alt="" /></Tooltip>}
        <OptionDropdown onDelNode={onDelNode} onCopy={onCopy} />
      </div>
      <div className='root-node-header'>
          <div className='root-node-img'>
            <img src={approvalPng} />
          </div>
          <div className='root-node-title'>{node.name}</div>
      </div>
      <div className='root-node-content'>
        {!node?.props?.approvalRole ? t('workflow.nodeConfig.enter.deptRole') : <>
          <div className='root-node-text'>{approvalDepartmentRole}</div>
        </>}
      </div>
    </div>
    <Line onInsertNode={onInsertNode} />
  </div>
}
