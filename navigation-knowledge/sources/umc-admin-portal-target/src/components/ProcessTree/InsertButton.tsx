import { Popover, Button } from '@mantine/core';
import Seal from '../../assets/icons/Seal';
import Navigation from '../../assets/icons/Navigation';
import Conditional from '../../assets/icons/Conditional';
import Parallel from '../../assets/icons/Parallel';
import Clock from '../../assets/icons/Clock';
import Setup from '../../assets/icons/Setup';
import addBtn from '../../assets/images/add-btn.png';
import type {TNodeType} from '.';
import { useTranslation } from 'react-i18next';
interface IInsertButtonProps{
    onInsertNode?: (type: TNodeType) => void;
}
export default function InsertButton({ onInsertNode }: IInsertButtonProps){
    const { t } = useTranslation();
    return (
        <Popover position="bottom-start" width={375} >
            <Popover.Target>
                <img className='insert-btn' src={addBtn} alt={t('workflow.processTree.insert.addButton')} />
            </Popover.Target>
            <Popover.Dropdown className='insert-btn-dropdown'>
                <div className='insert-popover-title'>{t('workflow.processTree.insert.title')}</div>
                <div className='node-select'>
                    <div className='node-select-row'>
                        <div onClick={()=>onInsertNode?.('APPROVAL')}>
                            <div className='icon'>
                                <Seal />
                            </div>
                            <span>{t('workflow.processTree.insert.approver')}</span>
                        </div>
                        {/* <div onClick={()=>onInsertNode?.('CC')}>
                            <div className='icon cc-icon'>
                                <Navigation />
                            </div>
                            <span>Cc</span>
                        </div> */}
                    </div>
                    {/* <div className='node-select-row'>
                        <div onClick={()=>onInsertNode?.('CONDITIONS')}>
                            <div className='icon'>
                                <Conditional />
                            </div>
                            <span>conditional branch</span>
                        </div>
                        <div onClick={()=>onInsertNode?.('CONCURRENTS')}>
                            <div className='icon'>
                                <Parallel />
                            </div>
                            <span>Parallel branch</span>
                        </div>
                    </div>
                    <div className='node-select-row'>
                        <div onClick={()=>onInsertNode?.('DELAY')}>
                            <div className='icon icon-clock'>
                                <Clock />
                            </div>
                            <span>Delay waiting</span>
                        </div>
                        <div onClick={()=>onInsertNode?.('TRIGGER')}>
                            <div className='icon icon-setup'>
                                <Setup />
                            </div>
                            <span>Trigger</span>
                        </div>
                    </div> */}
                </div>
            </Popover.Dropdown>
        </Popover>
    )
}
