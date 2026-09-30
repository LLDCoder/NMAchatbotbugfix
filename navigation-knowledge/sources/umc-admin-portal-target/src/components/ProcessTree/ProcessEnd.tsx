import workflowComplete from "@/assets/images/workflow-complete.png";
import { useTranslation } from 'react-i18next';


export default function ProcessEnd() { 
      const { t } = useTranslation();
    
    return <div className='process-end node-before'>
        <div className='root-node-body'>
            <div className='root-node-header'>
                <div className='root-node-img'>
                <img src={workflowComplete} alt={t('workflow.processEnd.title')} />
                </div>
                <div className='root-node-title'>{t('workflow.processEnd.title')}</div>
            </div>
        </div>
    </div>
}
