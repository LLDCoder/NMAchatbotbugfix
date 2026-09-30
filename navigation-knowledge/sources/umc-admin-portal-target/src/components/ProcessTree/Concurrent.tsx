
import type { INodeComponentProps } from './Approval';
import ArrowLeft from '@/assets/icons/ArrowLeft';
import ArrowRight from '@/assets/icons/ArrowRight';
import Close from '@/assets/icons/Close';
import Copy from '@/assets/icons/Copy';
import InsertButton from './InsertButton';
import { useTranslation } from 'react-i18next';

export default function Concurrent({ node, props, onClick, onDelNode, onCopy, onInsertNode, leftMove, rightMove }: INodeComponentProps<'concurrent'>) { 
    const { t } = useTranslation();
    const { level = 1, size = 0 } = props ?? {};
    console.log({ level, size });
    return <div className='base-node concurrent-node' onClick={onClick}>
        <div className='node-body'>
            {level > 1 && <div className='node-body-left' onClick={leftMove}>
                <ArrowLeft />
            </div>}
            <div className="node-body-main">
                <div className="node-body-main-header">
                    <span className="title">
                        <i className="el-icon-s-operation"></i>
                        <div className='name'>{node.name ? node.name : t('workflow.processTree.concurrent.name', { level })}</div>
                    </span>
                    <span className="option">
                        <Copy onClick={(e)=>{
                            e.stopPropagation();
                            onCopy();
                        }} />
                        <Close onClick={(e) => {
                            e.stopPropagation();
                            onDelNode();
                        }} />  
                    </span>
                </div>
                <div className="node-body-main-content">
                    <span>{t('workflow.processTree.concurrent.description')}</span>
                </div>
            </div>
            {level < size && <div className='node-body-right' onClick={rightMove}>
                <ArrowRight />
            </div>}
        </div>
        <div className="node-footer">
            <div className="btn">
                <InsertButton onInsertNode={onInsertNode} />
            </div>
        </div>
    </div>
}
