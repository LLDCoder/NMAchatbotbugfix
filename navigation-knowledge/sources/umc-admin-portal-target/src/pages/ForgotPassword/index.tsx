
import { useEffect, useState } from 'react';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { history } from '@/utils/history';
import request from '@/utils/request';
import { useForgotPwdStore } from '@/store/forgot-pwd-store';
import {
    getVerificationCountdownKey,
    getVerificationLockKey,
    getVerificationLockMessage,
    getVerificationLockRemaining,
    useVerificationCountdownStore,
    VERIFICATION_LOCK_SECONDS,
    VERIFICATION_RESEND_SECONDS,
} from '@/store/verification-store';
import PublicAuthHeader from '@/components/common/PublicAuthHeader';
import Loading from '@/components/common/Loading';
import {
    FormErrorPrompt,
    getApiErrorMessage,
    getApiResponseMessage,
    isApiResponseFailure,
    isVerificationLockMessage,
} from '@/components/common';

import './index.less';

type ForgotPwdStore = {
    email: string;
    setEmail: (email: string) => void;
    reset: () => void;
};

export default function ForgetPassword() { 
    const { t, i18n } = useTranslation();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const email = useForgotPwdStore((state: ForgotPwdStore) => state.email);
    const setEmail = useForgotPwdStore((state: ForgotPwdStore) => state.setEmail);
    const reset = useForgotPwdStore((state: ForgotPwdStore) => state.reset);
    const startCountdown = useVerificationCountdownStore(
        (state) => state.startCountdown,
    );
    const verificationSendLockKey = getVerificationLockKey(
        'forgot-password',
        email,
        'send',
    );
    const verificationSendLock = useVerificationCountdownStore(
        (state) => state.verificationLocks?.[verificationSendLockKey] ?? null,
    );
    const startLock = useVerificationCountdownStore(
        (state) => state.startLock,
    );
    const clearLock = useVerificationCountdownStore(
        (state) => state.clearLock,
    );
    const [apiError, setApiError] = useState('');
    const [, forceRender] = useState(0);

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const isEmailFormatValid = Boolean(email?.trim() && emailPattern.test(email));
    const sendLockRemaining = getVerificationLockRemaining(
        verificationSendLock,
    );
    const storedSendLockMessage = getVerificationLockMessage(
        verificationSendLock,
    );
    const isSendLocked = sendLockRemaining > 0;
    const sendLockMessage = isSendLocked
        ? storedSendLockMessage || t('verification.locked')
        : '';
    const isContinueDisabled =
        !isEmailFormatValid ||
        Boolean(apiError) ||
        isSendLocked ||
        loading;

    useEffect(() => {
        if (sendLockRemaining <= 0) {
            return;
        }

        const timer = window.setTimeout(() => {
            forceRender((value) => value + 1);
        }, 1000);

        return () => window.clearTimeout(timer);
    }, [sendLockRemaining]);

    useEffect(() => {
        if (!verificationSendLock || sendLockRemaining > 0) {
            return;
        }

        clearLock(verificationSendLockKey);
        setApiError((message) =>
            message === storedSendLockMessage ? '' : message,
        );
    }, [
        clearLock,
        sendLockRemaining,
        storedSendLockMessage,
        verificationSendLock,
        verificationSendLockKey,
    ]);

    useEffect(() => {
        const fieldsWithError = form
            .getFieldsError()
            .filter((field) => field.errors.length > 0)
            .map((field) => field.name);
        if (fieldsWithError.length > 0) {
            void form.validateFields(fieldsWithError).catch(() => undefined);
        }
    }, [form, i18n.language]);

    const handleGoBack = () => {
        reset();
        history.goBack();
    };

    const rememberSendLock = (emailValue: string, message: string) => {
        const text = message.trim();
        if (!isVerificationLockMessage(text)) {
            return false;
        }

        startLock(
            getVerificationLockKey('forgot-password', emailValue, 'send'),
            VERIFICATION_LOCK_SECONDS,
            t('verification.locked'),
        );
        return true;
    };

    async function handleNextStep(){
        if(loading) return ;
        if(!email?.trim()) return;
        if (isSendLocked) return;
        let emailValue = String(email).trim();
        try{
            const values = await form.validateFields(['email']);
            emailValue = values.email?.trim();
            if(!emailValue) return;

            setLoading(true);
            setApiError('');

            const response = await request.post('/api/AdminUser/GetGenerateCode', {
                type: 1,
                email: emailValue,
                phone: '',
                code: ''
            }, { skipErrorMessage: true });
            if (isApiResponseFailure(response)) {
                const responseMessage = getApiResponseMessage(response);
                const isLocked = rememberSendLock(
                    emailValue,
                    responseMessage,
                );
                if (isLocked) {
                    setApiError(t('verification.locked'));
                } else {
                    setApiError(t('request.operation.failed'));
                }
                return;
            }
            clearLock(
                getVerificationLockKey('forgot-password', emailValue, 'send'),
            );
            startCountdown(
                getVerificationCountdownKey('forgot-password', emailValue),
                VERIFICATION_RESEND_SECONDS,
            );
            history.push('/verification?from=forgot-password')
        } catch (error) {
            const responseMessage = getApiErrorMessage(error);
            const isLocked = rememberSendLock(emailValue, responseMessage);
            if (isLocked) {
                setApiError(t('verification.locked'));
            } else {
                setApiError(t('request.operation.failed'));
            }
            console.error('Failed to send verification code:', error);
        } finally{
            setLoading(false);
        }
    }

    return <div className="forgot-password-wrapper">
        <PublicAuthHeader showBack onBack={handleGoBack} />
        <div className="forgot-password-main">
       <div className='forgot-password-box'>
           <div className='forgot-password-content'>
           <div className='title'>
                {t('forgotPwd.forgotPwd')}
           </div>
           <div className='desc'>
                {t('forgotPwd.forgotPwdDesc')}
           </div>
           <Form form={form} initialValues={{email}} requiredMark={false} className='forgot-password-form custorm-form' layout='vertical'>
                <Form.Item label={t('forgotPwd.email')} name='email'
                    rules={[
                        { required: true, message: t('common.required')},
                        { pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, message: t('signup.please.emailFormat') }
                    ]}
                > 
                    <Input placeholder={t('forgotPwd.enterEmail')} onChange={(e)=>{
                        setEmail(e.target.value);
                        setApiError('');
                    }} />
                </Form.Item>
           </Form>
           <div className="forgot-password-actions">
                <div className='forgot-password-footer'>
                    <div className='back-btn' onClick={handleGoBack}>{t('forgotPwd.back')}</div>
                    <div className={`next-step-btn ${isContinueDisabled ? 'disabled': ''}`} onClick={handleNextStep}>
                        <Loading loading={loading}>
                            {t('forgotPwd.send')}
                        </Loading>
                    </div>
                </div>
                <FormErrorPrompt
                    message={apiError || sendLockMessage}
                    className="form-error-prompt--after-footer"
                />
            </div>
           </div>
        </div>
        </div>
    </div>
}
