import Line from './Line';
import type { TNodeType } from '.';
import workflowStart from '@/assets/images/workflow-start.png';
import { useTranslation } from 'react-i18next';
import type { INode, INodeProps } from '.';

interface IRootProps {
    node: INode<keyof INodeProps>,
    active: boolean;
    props: any,
    onInsertNode: (type: TNodeType) => void,
    onDelNode: () => void,
    onFresh: () => void;
}

export default function Root({ active, onInsertNode }: IRootProps) { 
  const { t } = useTranslation();
  return <div className={`node-start root-node ${active ? 'node-active' : ''}`}>
    <div className='root-node-body'>
      <div className='root-node-header'>
        <div className='root-node-img'>
          <img src={workflowStart} alt={t('workflow.root.title')} />
        </div>
        <div className='root-node-title'>{t('workflow.root.title')}</div>
      </div>
    </div>
    <Line onInsertNode={onInsertNode} />
  </div>
}
