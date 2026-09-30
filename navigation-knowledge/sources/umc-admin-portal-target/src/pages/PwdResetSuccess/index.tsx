
import { useTranslation } from 'react-i18next';
import { history } from '@/utils/history';
import { wipeAuthForReturningToLogin } from '@/utils/authSession';
import registrationSuccessfulPng from '@/assets/images/registration-successful.png';
import PublicAuthHeader from '@/components/common/PublicAuthHeader';

import './index.less';
export default function PwdResetSuccess() { 
    const { t } = useTranslation();

    return <div className="pwd-reset-success-wrapper">
        <PublicAuthHeader showBack onBack={() => history.goBack()} />
        <div className="pwd-reset-success-main">
       <div className='pwd-reset-success-box'>
             <div className='pwd-reset-success-content'>
                <img className='pwd-reset-success-image' src={registrationSuccessfulPng} alt="" />
                <div className='title'>{t("pwdResetSuccess.title")}</div>
                <div className='desc'>{t("pwdResetSuccess.desc")}</div>
                <div className='login-btn' onClick={()=>{ wipeAuthForReturningToLogin(); history.push('/login'); }}>{t("pwdResetSuccess.btn")}</div>
            </div>
        </div>
        </div>
    </div>
}
