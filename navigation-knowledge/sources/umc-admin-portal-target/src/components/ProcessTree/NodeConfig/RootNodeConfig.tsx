import { Button } from '@mantine/core';
import Plus from '@/assets/icons/Plus';
import { useTranslation } from 'react-i18next';

export default function RootNodeConfig(){
    const { t } = useTranslation();

    return <div className='root-node-config'>
        <p className="desc">{t("workflow.nodeConfig.initiatorAccessDescription")}</p>
        <Button className='initiator-select-btn'><div className='initiator-select'><Plus /><span>{t("workflow.nodeConfig.pleaseSelect")}</span></div></Button>
    </div>
}
