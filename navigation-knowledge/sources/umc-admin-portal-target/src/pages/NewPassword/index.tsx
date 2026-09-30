import { useState } from 'react';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { history } from '@/utils/history';
import eye from '@/assets/images/eye.png';
import eyeClosure from '@/assets/images/eyeClosure.png';
import request from '@/utils/request';
import { useForgotPwdStore } from '@/store/forgot-pwd-store';
import aesEncrypt from '@/utils/aesEncrypt';
import {
  isMandatoryAdminPasswordResetPending,
  wipeAuthForReturningToLogin,
} from '@/utils/authSession';
import { updateAdminPassWordAsync } from '@/services/userManagement';
import Loading from '@/components/common/Loading';
import PublicAuthHeader from '@/components/common/PublicAuthHeader';

import './index.less';
export default function NewPassword() { 
    const { t } = useTranslation();
    const location = useLocation();
    const [pwdValidateRes, setPwdValidateRes] = useState([false, false, false, false, false]);
    const [form] = Form.useForm();
    const [,update] = useState({});
    const [loading, setLoading] = useState(false);
    const emailFromStore = useForgotPwdStore((state) => state.email);
    const rawEmailQuery = new URLSearchParams(location.search).get('email');
    const emailFromQuery =
      rawEmailQuery != null && rawEmailQuery.trim() !== ''
        ? rawEmailQuery.trim()
        : '';
    /** ForgetPassWord fallback email (verification flow puts this in session store). */
    const email = emailFromQuery || emailFromStore;
    const mandatoryAdminPwdResetPending = isMandatoryAdminPasswordResetPending();
    const useAdminPassWordEndpoint =
      Boolean(emailFromQuery) || mandatoryAdminPwdResetPending;
    const reset = useForgotPwdStore((state) => state.reset);

     const validatePassword = (password: string) => { 
        if(password && password.length >= 8 && password.length <= 16){
            pwdValidateRes[0] = true;
        } else {    
            pwdValidateRes[0] = false;
        }
        if(/^.*[a-z].*$/.test(password)){
            pwdValidateRes[1] = true;
        } else {
            pwdValidateRes[1] = false;
        }
        if(/^.*[0-9].*$/.test(password)){
            pwdValidateRes[2] = true;
        } else {
            pwdValidateRes[2] = false;
        }
        if(/^.*[A-Z].*$/.test(password)){
            pwdValidateRes[3] = true;
        } else {
            pwdValidateRes[3] = false;
        }
        if (/[!@#$_.]/.test(password)) {
            pwdValidateRes[4] = true;
        } else {
            pwdValidateRes[4] = false;
        }
        setPwdValidateRes(pwdValidateRes.slice());
    };
    function handleResetPassword(){
        if(loading) return ;
        form.validateFields().then(async (values) => {
            if(pwdValidateRes.filter(Boolean).length !== pwdValidateRes.length) return ;
            try{
                setLoading(true);
                const pwd = aesEncrypt(values.password);
                if (useAdminPassWordEndpoint) {
                    await updateAdminPassWordAsync(pwd);
                    wipeAuthForReturningToLogin();
                } else {
                    await request.post('/api/AdminUser/ForgetPassWord', {
                        pwd,
                        email,
                    });
                }
                reset();
                history.push('/login?passwordResetSuccess=1');
            }finally{
                setLoading(false);
            }
            
        });
        
    }

    const isDisabled = () => {
        const { password, confirmPassword } = form.getFieldsValue();
        if(!password || !confirmPassword || password !== confirmPassword || pwdValidateRes.filter(Boolean).length !== pwdValidateRes.length){
            return true;
        }
        return false;
    }
    return <div className="new-password-wrapper">
        <PublicAuthHeader showBack onBack={() => history.goBack()} />
        <div className="new-password-main">
       <div className='new-password-box'>
            <div className='title'>{t("newPassword.resetPassword")}</div>
            <div className='desc'>{t("newPassword.please.securePassword")}</div>
            <Form form={form} className='forgot-password-form custorm-form' layout='vertical'>
                <Form.Item
                    className='mb-8'
                    label={t("newPassword.new.passwordLabel")}
                    name='password'
                    rules={[
                    { required: true, message: t('common.required') },
                    {
                        validator: (_rule, value, callback) => {
                            const latestConfirmPassword =
                                form.getFieldValue('confirmPassword');

                            if (!latestConfirmPassword) {
                                callback();
                                return;
                            }

                            if (value && value !== latestConfirmPassword) {
                                form.setFields([
                                    {
                                        name: 'confirmPassword',
                                        errors: [],
                                    },
                                ]);
                                callback(t("newPassword.please.twoPassword"));
                            } else {
                                form.setFields([
                                    {
                                        name: 'confirmPassword',
                                        errors: [],
                                    },
                                ]);
                                callback();
                            }
                        },
                    }
                ]}>
                    <Input.Password autoComplete="new-password" onChange={(e)=>{
                        validatePassword(e.target.value);
                    }} placeholder={t("newPassword.new.password")} allowClear iconRender={(visible) => <img className='pwd-eye' src={visible ? eye : eyeClosure} alt="" />} />
                </Form.Item>
                <div className='pwd-validate'>
                    {[t('newPassword.passwordValidator.charactersLength'), t('newPassword.passwordValidator.lowercase'), t('newPassword.passwordValidator.number'), t('newPassword.passwordValidator.uppercase'), t('newPassword.passwordValidator.special')].map((item, index)=>{
                        return <div key={index} className={`pwd-validate-item ${pwdValidateRes[index] ? 'pwd-validate-ok' : ''}`}>{item}</div>;
                    })}
                </div>
                <Form.Item
                    label={t('newPassword.new.confirmPasswordLabel')}
                    name='confirmPassword'
                    rules={[
                    { required: true, message: t('common.required') },
                    {
                        validator: (_rule, value, callback) => {
                            const latestPassword = form.getFieldValue('password');

                            if (!latestPassword) {
                                callback();
                                return;
                            }

                            if (value && value !== latestPassword) {
                                form.setFields([
                                    {
                                        name: 'password',
                                        errors: [],
                                    },
                                ]);
                                callback(t("newPassword.please.twoPassword"));
                            } else {
                                form.setFields([
                                    {
                                        name: 'password',
                                        errors: [],
                                    },
                                ]);
                                callback();
                            }
                        },
                    }
                ]}>
                    <Input.Password autoComplete="new-password" onChange={()=>update({})} placeholder={t('newPassword.new.confirmPassword')} allowClear iconRender={(visible) => <img className='pwd-eye' src={visible ? eye : eyeClosure} alt="" />} />
                </Form.Item>
            </Form>
            <div className='new-password-footer'>
                <div className='back-btn' onClick={()=>history.goBack()}>{t('newPassword.back')}</div>
                    <div className={`next-step-btn ${isDisabled() ? 'disabled': ''}`} onClick={handleResetPassword}>
                        <Loading loading={loading}>
                            {t('newPassword.continue')}
                        </Loading>
                    </div>
            </div>
        </div>
        </div>
    </div>
}
