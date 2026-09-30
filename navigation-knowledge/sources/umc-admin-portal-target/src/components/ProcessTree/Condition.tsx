
import InsertButton from './InsertButton';
import ArrowLeft from '@/assets/icons/ArrowLeft';
import ArrowRight from '@/assets/icons/ArrowRight';
import { OptionDropdown } from './Approval';
import type { INodeComponentProps } from './Approval';
import { useTranslation } from 'react-i18next';

export default function Condition({ active, onClick, node, onInsertNode, onCopy, onDelNode, props, leftMove, rightMove }: INodeComponentProps<'condition'>){
    const { t } = useTranslation();
    const { level = 1, size = 0 } = props || {};
    return <div className={`base-node condition ${active ? 'node-active': ''}`}>
        <div className={`condition-node`}>
            <div onClick={onClick} className={`condition-node-body root-node-body`}>
                {level > 1 && <div className='node-body-left' onClick={leftMove}>
                    <ArrowLeft />
                </div>}
                <div className='condition-node-body-main'>
                    <div className='condition-node-body-main-header'>
                        <div className='title'>
                            {node?.name ? node.name : t('workflow.processTree.condition.name', { level })}
                        </div>
                        <div> 
                            <span className='level'>{t('workflow.processTree.condition.priority', { level })}</span>
                            <span className='option'>
                                <OptionDropdown onDelNode={onDelNode} onCopy={onCopy} />
                            </span>
                        </div>
                        
                    </div>
                    <div className='condition-node-body-main-content'>
                        <span className='placeholder'>
                            {level == size && size != 0
                                ? t('workflow.processTree.condition.otherConditions')
                                : t('workflow.processTree.condition.placeholder')}
                        </span>
                    </div>
                </div>
                {level < size && <div className='node-body-right' onClick={rightMove}>
                    <ArrowRight />
                </div>}
            </div>
            <div className='condition-node-footer'>
                <div className='btn'>
                    <InsertButton onInsertNode={onInsertNode} />
                </div>
            </div>
        </div>
    </div>
    
}
