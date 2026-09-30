import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Form, Input } from 'antd';
import type { InputRef } from 'antd/lib/input';
import { Trans, useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
    ChangePasswordCommon,
    CustomMessage,
    FormErrorPrompt,
    getApiErrorMessage,
    getApiResponseMessage,
    isApiResponseFailure,
    isVerificationCodeInlineError,
    isVerificationResendBlocked,
} from '@/components/common';
import Loading from '@/components/common/Loading';
import { performAuthenticatedLogout } from '@/utils/authSession';
import warnIcon from '@/assets/images/warnIcon.svg';
import Timer from '@/assets/icons/Timer';
import eye from '@/assets/images/eye.png';
import eyeClosure from '@/assets/images/eyeClosure.png';
import {
    getVerificationCountdownKey,
    getVerificationCountdownRemaining,
    useVerificationCountdownStore,
    VERIFICATION_RESEND_SECONDS,
} from '@/store/verification-store';
import { useUserStore } from '@/store/user';
import { useCurrentAdminUser } from '@/store/currentAdminUser';
import request from '@/utils/request';
import aesEncrypt from '@/utils/aesEncrypt';
import type { ApiResponse } from '@/services/userManagement';
import './index.less';

type Step = 'email' | 'verification' | 'password';
type PasswordMismatchField = 'password' | 'confirmPassword' | null;
const CHANGE_PASSWORD_VERIFICATION_TYPE = 3;

interface UserVerificationCodeResponseBody {
    isSuccess?: boolean;
    statusCode?: number;
    message?: string;
    data?: boolean;
}

function isUserVerificationCodeAccepted(
    body: unknown,
): body is UserVerificationCodeResponseBody & { data: true } {
    return (
        typeof body === 'object' &&
        body !== null &&
        (body as UserVerificationCodeResponseBody).data === true
    );
}

interface ChangePasswordProps {
    visible?: boolean;
    onCancel?: () => void;
    resumeToVerification?: boolean;
    onVerificationSessionStart?: () => void;
    onVerificationSessionReset?: () => void;
}

const formatEmail = (email: string): string => {
    if (!email) return '';
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return email;
    
    const prefix = email.substring(0, atIndex);
    const suffix = email.substring(atIndex);
    
    if (prefix.length <= 3) {
        return prefix + '**' + suffix;
    }
    
    return prefix.substring(0, 3) + '**' + suffix;
};


const EMPTY_CODE = ['', '', '', '', '', ''];
const EMPTY_PASSWORD_VALIDATE_RESULT = [false, false, false, false, false];

export default function ChangePassword({
    visible: externalVisible,
    onCancel,
    resumeToVerification = false,
    onVerificationSessionStart,
    onVerificationSessionReset,
}: ChangePasswordProps = {}){
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const isArabic = i18n.resolvedLanguage === 'ar';

    const searchParams = new URLSearchParams(location.search);
    
    const isFromLogin = searchParams.get('from') === 'FirstLogin';
    const userInfo = useUserStore((state) => state.userInfo);
    const currentAdminUserEnabled = externalVisible === undefined || externalVisible;
    const { data: currentAdminUser } = useCurrentAdminUser(
        userInfo?.id,
        currentAdminUserEnabled,
    );
    
    const [visible, setVisible] = useState(externalVisible !== undefined ? externalVisible : true);
    const [step, setStep] = useState<Step>('email');
    const [form] = Form.useForm();
    const [emailFromApi, setEmailFromApi] = useState<string>('');
    
    const rawEmail = emailFromApi;
    const displayEmail = formatEmail(rawEmail);
    const verificationCountdownKey = getVerificationCountdownKey(
        'change-password',
        rawEmail,
    );
    
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Verification code state
    const [codeYzm, setCodeYzm] = useState(EMPTY_CODE);
    const inputsRef = useRef<Array<InputRef | null>>([]);
    const [sendLoading, setSendLoading] = useState(false);
    const [resendBlocked, setResendBlocked] = useState(false);
    const [codeError, setCodeError] = useState('');
    const [generalError, setGeneralError] = useState('');
    const [emailStepError, setEmailStepError] = useState('');
    const resendDeadline = useVerificationCountdownStore(
        (state) => state.resendDeadlines[verificationCountdownKey] ?? null,
    );
    const startCountdown = useVerificationCountdownStore(
        (state) => state.startCountdown,
    );
    const clearCountdown = useVerificationCountdownStore(
        (state) => state.clearCountdown,
    );
    const [, forceRender] = useState(0);
    const countdown = getVerificationCountdownRemaining(resendDeadline);

    const setVerificationError = (
        message: string,
        fallback: 'invalid' | 'request',
    ) => {
        const text = message.trim();
        if (isVerificationResendBlocked(text)) {
            setResendBlocked(true);
            setCodeError('');
            setGeneralError(t('request.operation.failed'));
            return;
        }
        if (isVerificationCodeInlineError(text)) {
            setCodeYzm(EMPTY_CODE);
            setCodeError(text);
            setGeneralError('');
            return;
        }
        if (text) {
            if (fallback === 'invalid') {
                setCodeYzm(EMPTY_CODE);
            }
            setCodeError('');
            setGeneralError(text);
            return;
        }
        setCodeError('');
        setGeneralError(t('request.operation.failed'));
    };

    const clearVerificationErrors = () => {
        setCodeError('');
        if (!resendBlocked) {
            setGeneralError('');
        }
    };

    // Password validation state
    const [pwdValidateRes, setPwdValidateRes] = useState(
        EMPTY_PASSWORD_VALIDATE_RESULT,
    );
    const [loading, setLoading] = useState(false);
    const [passwordMismatchField, setPasswordMismatchField] =
        useState<PasswordMismatchField>(null);
    
    // Watch form values to trigger re-render when password changes
    const password = Form.useWatch('password', form);
    const confirmPassword = Form.useWatch('confirmPassword', form);
    const currentPassword = Form.useWatch('currentPassword', form);
 
    const handleConfirm = () => {
        if (step === 'email') {
            handleSendCode();
        } else if (step === 'verification') {
            handleVerifyCode();
        } else if (step === 'password') {
            handleChangePassword();
        }
    };

    const forceLogoutAfterPasswordChange = useCallback(
        (showSuccessMessage = false) => {
            onVerificationSessionReset?.();
            if (showSuccessMessage) {
                CustomMessage.success(t('PersonalCenter.operationSuccessful'));
            }
            performAuthenticatedLogout({});
        },
        [onVerificationSessionReset, t],
    );

    const handleSendCode = async () => {
        if (!rawEmail) return;
        try {
            setSendLoading(true);
            setEmailStepError('');
            const response = await request.post(
                '/api/AdminUser/GetGenerateCode',
                {
                    type: CHANGE_PASSWORD_VERIFICATION_TYPE,
                    email: rawEmail,
                    phone: '',
                    code: ''
                },
                { skipErrorMessage: true },
            );
            if (isApiResponseFailure(response)) {
                setEmailStepError(
                    getApiResponseMessage(response) ||
                        t('request.operation.failed'),
                );
                return;
            }
            onVerificationSessionStart?.();
            setStep('verification');
            setCodeYzm(EMPTY_CODE);
            setCodeError('');
            setGeneralError('');
            setResendBlocked(false);
            startCountdown(
                verificationCountdownKey,
                VERIFICATION_RESEND_SECONDS,
            );
        } catch (error) {
            setEmailStepError(
                getApiErrorMessage(error) || t('request.operation.failed'),
            );
            console.error('Failed to send verification code:', error);
        } finally {
            setSendLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (codeYzm.join('').length !== 6 || !rawEmail) return;
        try {
            setLoading(true);
            clearVerificationErrors();
            const verifyResult = await request.post(
                '/api/AdminUser/VerificationCode',
                {
                    type: CHANGE_PASSWORD_VERIFICATION_TYPE,
                    email: rawEmail,
                    code: codeYzm.join('')
                },
                { skipErrorMessage: true },
            );
            if (!isUserVerificationCodeAccepted(verifyResult)) {
                setVerificationError(
                    getApiResponseMessage(verifyResult),
                    'invalid',
                );
                return;
            }
            onVerificationSessionReset?.();
            clearCountdown(verificationCountdownKey);
            clearVerificationErrors();
            setStep('password');
        } catch (error) {
            setVerificationError(getApiErrorMessage(error), 'request');
            console.error('Failed to verify code:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!rawEmail) return;
        
        // Check password validation before starting loading
        if (pwdValidateRes.filter(Boolean).length !== pwdValidateRes.length) {
            return;
        }
        
        try {
            const values = await form.validateFields();

            setLoading(true);

            const encryptedPwd = aesEncrypt(values.password);
            
            if (isFromLogin) {
                const res = await request.post<ApiResponse<unknown>>('/api/AdminUser/ForgetPassWord', {
                    pwd: encryptedPwd,
                    email: rawEmail
                });
    
                if((res as unknown as ApiResponse<unknown>)?.isSuccess){
                    forceLogoutAfterPasswordChange();
                }
            } else {
                // Verify current password before changing password
                const encryptedCurrentPwd = aesEncrypt(values.currentPassword);
                const checkResult = await request.get<ApiResponse<boolean>>('/api/UserManagement/CheckAdminPassWord', {
                    pwd: encryptedCurrentPwd
                }) as unknown as ApiResponse<boolean>;
                
                if (!checkResult?.isSuccess || !checkResult?.data) {
                    CustomMessage.error(
                        t(
                            'PersonalCenter.changePasswordErrors.currentPasswordIncorrect',
                        ),
                    );
                    return;
                }
                
                const res = await request.post('/api/AdminUser/ForgetPassWord', {
                    pwd: encryptedPwd,
                    email: rawEmail
                });
                if(res.data){
                    forceLogoutAfterPasswordChange(true);
                } else {
                    CustomMessage.error(t('PersonalCenter.operationFailed'));
                }
            }
            
        } catch (error) {
            console.error('Failed to change password:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (sendLoading || countdown > 0 || resendBlocked || !rawEmail) return;
        try {
            setSendLoading(true);
            await request.post(
                '/api/AdminUser/GetGenerateCode',
                {
                    type: CHANGE_PASSWORD_VERIFICATION_TYPE,
                    email: rawEmail,
                    phone: '',
                    code: '',
                },
                { skipErrorMessage: true },
            );
            onVerificationSessionStart?.();
            setResendBlocked(false);
            setGeneralError('');
            startCountdown(
                verificationCountdownKey,
                VERIFICATION_RESEND_SECONDS,
            );
        } catch (error) {
            setCodeError('');
            setGeneralError(t('request.operation.failed'));
            setResendBlocked(true);
            console.error('Failed to resend verification code:', error);
        } finally {
            setSendLoading(false);
        }
    };

    const handleInputChange = (value: string, index: number) => {
        if (!/^\d?$/.test(value)) return;
        const newCode = [...codeYzm];
        newCode[index] = value;
        setCodeYzm(newCode);
        clearVerificationErrors();
        if (value && index < codeYzm.length - 1) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === 'Backspace' && !codeYzm[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text');
        const numbers = pastedData.replace(/\D/g, '').split('').slice(0, codeYzm.length);
        const newCode = [...codeYzm];
        numbers.forEach((num: string, index: number) => {
            newCode[index] = num;
        });
        setCodeYzm(newCode);
        clearVerificationErrors();
        const lastFilledIndex = numbers.length - 1;
        if (lastFilledIndex < codeYzm.length - 1) {
            inputsRef.current[numbers.length]?.focus();
        }
    };

    const validatePassword = (password: string) => {
        const newPwdValidateRes = [...pwdValidateRes];
        if (password && password.length >= 8 && password.length <= 16) {
            newPwdValidateRes[0] = true;
        } else {
            newPwdValidateRes[0] = false;
        }
        if (/^.*[a-z].*$/.test(password)) {
            newPwdValidateRes[1] = true;
        } else {
            newPwdValidateRes[1] = false;
        }
        if (/^.*[0-9].*$/.test(password)) {
            newPwdValidateRes[2] = true;
        } else {
            newPwdValidateRes[2] = false;
        }
        if (/^.*[A-Z].*$/.test(password)) {
            newPwdValidateRes[3] = true;
        } else {
            newPwdValidateRes[3] = false;
        }
        if (/[!@#$_.]/.test(password)) {
            newPwdValidateRes[4] = true;
        } else {
            newPwdValidateRes[4] = false;
        }
        setPwdValidateRes(newPwdValidateRes);
    };

    const handlePasswordChange = (passwordValue: string) => {
        setPasswordMismatchField('password');
        validatePassword(passwordValue);
        const latestConfirmPassword = form.getFieldValue('confirmPassword');
        if (!latestConfirmPassword) {
            form.setFields([
                {
                    name: 'confirmPassword',
                    errors: [],
                },
            ]);
            return;
        }
        form.validateFields(['confirmPassword']).catch(() => undefined);
    };

    const handleConfirmPasswordChange = () => {
        setPasswordMismatchField('confirmPassword');
        const latestPassword = form.getFieldValue('password');
        if (!latestPassword) {
            form.setFields([
                {
                    name: 'password',
                    errors: [],
                },
            ]);
            return;
        }
        form.validateFields(['password']).catch(() => undefined);
    };

    useEffect(() => {
        if (step !== 'verification' || countdown <= 0) {
            return;
        }

        const timer = window.setTimeout(() => {
            forceRender((value) => value + 1);
        }, 1000);

        return () => window.clearTimeout(timer);
    }, [countdown, step]);

    const getContainer = useCallback(() => {
        const container = containerRef.current || document.querySelector('.change-password-wrapper') || document.body;
        return container as HTMLElement;
    }, []);

    const resetModalStepState = useCallback(
        (nextStep: Step) => {
            setStep(nextStep);
            setEmailStepError('');
            setCodeYzm(EMPTY_CODE);
            setCodeError('');
            setGeneralError('');
            setResendBlocked(false);
            setPwdValidateRes(EMPTY_PASSWORD_VALIDATE_RESULT);
            setPasswordMismatchField(null);
            form.resetFields(['currentPassword', 'password', 'confirmPassword']);
        },
        [form],
    );

    const getResetStep = useCallback(
        (): Step => (resumeToVerification ? 'verification' : 'email'),
        [resumeToVerification],
    );

    useEffect(() => {
        if (externalVisible !== undefined) {
            setVisible(externalVisible);
        }
    }, [externalVisible]);

    const previousExternalVisibleRef = useRef(externalVisible);

    useEffect(() => {
        if (externalVisible === undefined) {
            return;
        }

        const wasVisible = previousExternalVisibleRef.current;
        if (wasVisible !== externalVisible) {
            resetModalStepState(getResetStep());
        }

        previousExternalVisibleRef.current = externalVisible;
    }, [externalVisible, getResetStep, resetModalStepState]);

    useEffect(() => {
        if (currentAdminUser?.email) {
            setEmailFromApi(currentAdminUser.email);
        }
    }, [currentAdminUser?.email]);

    useEffect(() => {
        const formattedEmail = formatEmail(emailFromApi);
        form.setFieldsValue({ email: formattedEmail });
    }, [emailFromApi, form]);

    const handleCancel = () => {
        resetModalStepState(getResetStep());
        if (onCancel) {
            onCancel();
        } else {
            setVisible(false);
        }
    };

    const renderEmailStep = () => (
        <div className="change-password-content">
            <div className="change-password-banner">
                <img src={warnIcon} alt="" className="banner-icon" />
                <span className={`banner-text ${isFromLogin ? '' : 'black-banner-text'}`}>
                    {isFromLogin
                        ? t(
                              'PersonalCenter.changePasswordMessages.firstLoginEmailNotice',
                          )
                        : t(
                              'PersonalCenter.changePasswordMessages.normalEmailNotice',
                          )}
                </span>
            </div>
            <Form form={form} layout="vertical" className="change-password-form" initialValues={{ email: displayEmail }}>
                <Form.Item label={t('PersonalCenter.email')} name="email">
                    <Input 
                        disabled
                        dir="ltr"
                        className="change-password-input change-password-email-input"
                    />
                </Form.Item>
                <FormErrorPrompt
                    message={emailStepError}
                    className="form-error-prompt--after-input"
                />
            </Form>
        </div>
    );

    const renderVerificationStep = () => {
        const countdownLabel = `${countdown}s`;
        return (
            <div className="change-password-content verification-step">
                <div className="verification-title">
                    {t('verification.verification')}
                </div>
                <div className="verification-desc">
                    <Trans
                        i18nKey="verification.verificationDesc"
                        values={{ email: displayEmail }}
                        components={{
                            bold: (
                                <span
                                    className="verification-desc-email"
                                    dir="ltr"
                                />
                            ),
                        }}
                    />
                </div>
                <div className="verification-step-center">
                    <div className="verification-code-section">
                        <div className="verification-input-group">
                            {codeYzm.map((item, index) => (
                                <Input
                                    key={index}
                                    onKeyDown={(e) => handleKeyDown(e, index)}
                                    onPaste={handlePaste}
                                    ref={(el) => (inputsRef.current[index] = el)}
                                    value={item}
                                    onChange={(e) => handleInputChange(e.target.value, index)}
                                    className={`verification-input${codeError ? ' error' : ''}`}
                                    maxLength={1}
                                    inputMode="numeric"
                                />
                            ))}
                        </div>
                        {codeError ? (
                            <div
                                className="verification-code-inline-error"
                                role="alert"
                            >
                                {codeError}
                            </div>
                        ) : null}
                    </div>
                    <div className="verification-resend">
                        <div className="verification-text">
                            {t('verification.notRecieved')}
                        </div>
                        <div className="resend-wrapper">
                            {countdown > 0 && (
                                <span className="time">
                                    <Timer />{countdownLabel}
                                </span>
                            )}
                            <span
                                className={`resend ${
                                    countdown > 0 || sendLoading || resendBlocked
                                        ? 'disabled'
                                        : ''
                                }`}
                                onClick={handleResendCode}
                            >
                                <Loading loading={sendLoading}>
                                    {t('verification.resend')}
                                </Loading>
                            </span>
                        </div>
                    </div>
                    <FormErrorPrompt
                        message={generalError}
                        className="form-error-prompt--after-footer"
                    />
                </div>
            </div>
        );
    };

    const renderPasswordStep = () => {
        return (
            <div className="change-password-content password-step">
                <div className="change-password-banner">
                    <img src={warnIcon} alt="" className="banner-icon" />
                    <span className="banner-text">
                        {isFromLogin 
                            ? t(
                                  'PersonalCenter.changePasswordMessages.firstLoginPasswordNotice',
                              )
                            : t(
                                  'PersonalCenter.changePasswordMessages.normalPasswordNotice',
                              )
                        }
                    </span>
                </div>
                <Form form={form} layout="vertical" className="change-password-form">
                    {!isFromLogin && (
                        <Form.Item
                            label={t(
                                'PersonalCenter.changePasswordFields.currentPassword',
                            )}
                            name="currentPassword"
                            rules={[
                                {
                                    required: true,
                                    message: t(
                                        'PersonalCenter.changePasswordValidation.enterCurrentPassword',
                                    ),
                                },
                            ]}
                        >
                            <Input.Password 
                                placeholder={t(
                                    'PersonalCenter.changePasswordPlaceholders.currentPassword',
                                )}
                                className="change-password-input"
                                allowClear
                                iconRender={(visible) => <img className="pwd-eye" src={visible ? eye : eyeClosure} alt="" />}
                            />
                        </Form.Item>
                    )}
                    <Form.Item
                        label={t(
                            'PersonalCenter.changePasswordFields.newPassword',
                        )}
                        name="password"
                        dependencies={
                            isFromLogin ? undefined : ['currentPassword']
                        }
                        rules={[
                            {
                                required: true,
                                message: t(
                                    'PersonalCenter.changePasswordValidation.enterNewPassword',
                                ),
                            },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (isFromLogin || !value) {
                                        return Promise.resolve();
                                    }

                                    const latestCurrentPassword =
                                        getFieldValue('currentPassword');

                                    if (
                                        !latestCurrentPassword ||
                                        latestCurrentPassword !== value
                                    ) {
                                        return Promise.resolve();
                                    }

                                    return Promise.reject(
                                        new Error(
                                            t(
                                                'PersonalCenter.changePasswordValidation.newPasswordSameAsCurrent',
                                            ),
                                        ),
                                    );
                                },
                            }),
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    const latestConfirmPassword =
                                        getFieldValue('confirmPassword');

                                    if (!latestConfirmPassword) {
                                        return Promise.resolve();
                                    }

                                    if (
                                        passwordMismatchField === 'password' &&
                                        value &&
                                        value !== latestConfirmPassword
                                    ) {
                                        return Promise.reject(
                                            new Error(
                                                t(
                                                    'PersonalCenter.changePasswordValidation.passwordsDoNotMatch',
                                                ),
                                            ),
                                        );
                                    }

                                    return Promise.resolve();
                                },
                            }),
                        ]}
                        className="mb-8"
                    >
                        <Input.Password 
                            placeholder={t(
                                'PersonalCenter.changePasswordPlaceholders.newPassword',
                            )}
                            className="change-password-input"
                            allowClear
                            onChange={(e) =>
                                handlePasswordChange(e.target.value)
                            }
                            iconRender={(visible) => <img className="pwd-eye" src={visible ? eye  : eyeClosure} alt="" />}
                        />
                    </Form.Item>
                    <div className="password-requirements">
                        <div className={`requirement ${pwdValidateRes[0] ? 'met' : ''}`}>
                            {t('newPassword.passwordValidator.charactersLength')}
                        </div>
                        <div className={`requirement ${pwdValidateRes[1] ? 'met' : ''}`}>
                            {t('newPassword.passwordValidator.lowercase')}
                        </div>
                        <div className={`requirement ${pwdValidateRes[2] ? 'met' : ''}`}>
                            {t('newPassword.passwordValidator.number')}
                        </div>
                        <div className={`requirement ${pwdValidateRes[3] ? 'met' : ''}`}>
                            {t('newPassword.passwordValidator.uppercase')}
                        </div>
                        <div className={`requirement ${pwdValidateRes[4] ? 'met' : ''}`}>
                            {t('newPassword.passwordValidator.special')}
                        </div>
                    </div>
                    <Form.Item
                        label={t('PersonalCenter.changePasswordFields.confirmPassword')}
                        name="confirmPassword"
                        rules={[
                        {
                            required: true,
                            message: t(
                                'PersonalCenter.changePasswordValidation.enterConfirmPassword',
                            ),
                        },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                const latestPassword = getFieldValue('password');

                                if (!latestPassword) {
                                    return Promise.resolve();
                                }

                                if (
                                    passwordMismatchField ===
                                        'confirmPassword' &&
                                    value &&
                                    value !== latestPassword
                                ) {
                                    return Promise.reject(
                                        new Error(
                                            t(
                                                'PersonalCenter.changePasswordValidation.passwordsDoNotMatch',
                                            ),
                                        ),
                                    );
                                }

                                if (!value || latestPassword === value) {
                                    return Promise.resolve();
                                }
                                return Promise.resolve();
                            },
                        }),
                    ]}>
                        <Input.Password 
                            placeholder={t(
                                'PersonalCenter.changePasswordPlaceholders.confirmPassword',
                            )}
                            className="change-password-input"
                            allowClear
                            onChange={handleConfirmPasswordChange}
                            iconRender={(visible) => <img className="pwd-eye" src={visible ? eye : eyeClosure} alt="" />}
                        />
                    </Form.Item>
                </Form>
            </div>
        );
    };

    const getConfirmText = () => {
        if (step === 'verification') {
            return t('PersonalCenter.verifyCode');
        }
        return t('PersonalCenter.confirm');
    };

    const isConfirmDisabled = useMemo(() => {
        if (step === 'verification') {
            return (
                codeYzm.join('').length !== 6 ||
                !!codeError ||
                !!generalError
            );
        }
        if (step === 'password') {
            // Check if all password requirements are met
            const allRequirementsMet = pwdValidateRes.filter(Boolean).length === pwdValidateRes.length;
            
            if (isFromLogin) {
                return !password || !confirmPassword || 
                       password !== confirmPassword || 
                       !allRequirementsMet;
            } else {
                return !currentPassword || !password || !confirmPassword || 
                       password !== confirmPassword || 
                       !allRequirementsMet;
            }
        }
        return false;
    }, [step, codeYzm, codeError, generalError, password, confirmPassword, currentPassword, pwdValidateRes, isFromLogin]);

    const isComponentMode = onCancel !== undefined;
    
    return (
        <div
            className={`change-password-wrapper${
                isArabic ? ' change-password-wrapper--rtl' : ''
            }`}
            ref={containerRef}
            dir={isArabic ? 'rtl' : 'ltr'}
        >
            <ChangePasswordCommon
                visible={visible}
                width={640}
                title={t('PersonalCenter.changePassword')}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                confirmText={getConfirmText()}
                cancelText={undefined}
                confirmLoading={loading || sendLoading}
                confirmDisabled={isConfirmDisabled}
                confirmButtonVariant={isConfirmDisabled ? 'secondary' : 'primary'}
                getContainer={getContainer}
                closable={isComponentMode}
                maskClosable={isComponentMode}
            >
                {step === 'email' && renderEmailStep()}
                {step === 'verification' && renderVerificationStep()}
                {step === 'password' && renderPasswordStep()}
            </ChangePasswordCommon>
        </div>
    )
}
