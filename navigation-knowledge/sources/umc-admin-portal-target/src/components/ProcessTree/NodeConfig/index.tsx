import type { INode, INodeProps } from '@/components/ProcessTree';
import Approval from './ApprovalNodeConfig';
import { useTranslation } from 'react-i18next';
import './index.less';

interface INodeConfig{
    selectNode: INode<keyof INodeProps> | null;
    onProceessChange: (newProcess: INode<keyof INodeProps>) => void;
    process: INode<keyof INodeProps>;
}
const components: { [key: string]: React.FC<any> } = {
    Root: Approval,
    Approval,
    Cc: Approval,
    Condition: Approval,
}
export default function NodeConfig({ process, selectNode, onProceessChange }: INodeConfig){
    const { t } = useTranslation();
    const { type = '' } = selectNode || {};
    const componentKey = type.charAt(0) + type.slice(1).toLowerCase();
    const Component = components[componentKey] || Approval;
    return (
        <div className='node-config'>
            <div className='node-config-title'>
                <div className='title'>{t("workflow.nodeConfig.title")}</div>
            </div>
            <div className='node-config-body'>
                {!!selectNode && <Component onProceessChange={onProceessChange} process={process} selectNode={selectNode} />}
            </div>
        </div>
    )
}