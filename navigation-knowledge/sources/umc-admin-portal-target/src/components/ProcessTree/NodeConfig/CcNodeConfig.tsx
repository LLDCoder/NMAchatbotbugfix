import { Button, Checkbox } from '@mantine/core';
import Plus from '@/assets/icons/Plus';
import type { INode } from '@/components/ProcessTree';
import { useTranslation } from 'react-i18next';

interface ICcNodeConfigProps {
    onProceessChange: (process: INode) => void;
    selectNode: INode;
    process: INode;
}
export default function CcNodeConfig({onProceessChange, selectNode, process}: ICcNodeConfigProps){
    const { t } = useTranslation();

    return (
        <div className='cc-node-config'>
            <Button className='plus-btn mt15'><div className='plus-btn'><Plus /><span>{t("workflow.nodeConfig.pleaseSelect")}</span></div></Button>
            <div className='cc-node-config-option'>
                <Checkbox
                    checked={selectNode?.props?.shouldAdd}
                    onChange={(e)=>{
                        if(selectNode?.props?.shouldAdd !== undefined){
                            selectNode.props.shouldAdd = e.target.checked
                            onProceessChange({...process})
                        }
                    }}
                    label={t("workflow.nodeConfig.allowInitiatorCc")}
                />
            </div>
        </div>
    );
}
