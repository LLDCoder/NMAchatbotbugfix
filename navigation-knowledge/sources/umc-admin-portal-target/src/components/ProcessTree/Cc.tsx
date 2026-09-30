import Line from './Line'
import { useDictStore, type IDict } from "@/store/dict-store";
import { useTranslation } from 'react-i18next';
import warning from '@/assets/images/warning.png';
import menu from '@/assets/images/menu.svg';
import { Dropdown, Menu, Modal, Tooltip } from 'antd'
import Warning from '@/assets/icons/Warning';
import { validateUserTask } from '@/components/common/ProcessDesign';
import type { INodeComponentProps } from './Approval'
import Navigation from "@/assets/icons/Navigation";

export default function Cc({active, node, onClick, onInsertNode, onDelNode, onCopy }: INodeComponentProps<'cc'>) { 
  const { t, i18n } = useTranslation();
  const { ApprovalRole, ApprovalDepartment} = useDictStore((state: any)=>({
      ApprovalRole: state.ApprovalRole,
      ApprovalDepartment: state.ApprovalDepartment
  }));
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
  const dept = node.props?.approvalDepartment;
  const role = node.props?.approvalRole;
  let approvalDepartmentRole = '';
  if(dept && role){
    const roleInfo = ApprovalRole?.find((item: IDict) => item.id === role);
    const deptInfo = ApprovalDepartment.find((item: IDict)=>String(item.code) === String(dept));
    const roleTitle = i18n.resolvedLanguage === 'ar' ? roleInfo?.nameAr : roleInfo?.nameEn;
    const departmentTiltle = i18n.resolvedLanguage === 'ar' ? deptInfo?.nameAr : deptInfo?.nameEn;
    approvalDepartmentRole = `${departmentTiltle}/${roleTitle}`;
  }
  return <div className={`base-node approval-node node-before ${active ? 'node-active': ''}`}>
    <div className='root-node-body' onClick={onClick}>
      <div className='root-node-actions'>
        {!validateUserTask(node.props) && <Tooltip color='#fff' title={t('workflow.nodeConfig.tooltip.cc')}><img src={warning} alt="" /></Tooltip>}
        <Dropdown 
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
      </div>
      <div className='root-node-header'>
          <div className='root-node-img'>
            <Navigation />
          </div>
          <div className='root-node-title'>{node.name}</div>
      </div>
      <div className='root-node-content'>
        {!node?.props?.approvalRole ? t('workflow.nodeConfig.enter.cc') : <>
          <div className='root-node-text'>{approvalDepartmentRole}</div>
        </>}
      </div>
    </div>
    <Line onInsertNode={onInsertNode} />
  </div>
}
