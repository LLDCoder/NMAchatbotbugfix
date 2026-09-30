import { useRef, useState, useEffect } from 'react';
import { Input } from 'antd';
import type { InputRef } from 'antd/lib/input';
import { Trans, useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import Timer from '@/assets/icons/Timer';
import { history } from '@/utils/history';
import request from '@/utils/request';
import { useForgotPwdStore } from '@/store/forgot-pwd-store';
import {
    getVerificationCountdownKey,
    getVerificationCountdownRemaining,
    getVerificationLockKey,
    getVerificationLockMessage,
    getVerificationLockRemaining,
    useVerificationCountdownStore,
    VERIFICATION_LOCK_SECONDS,
    VERIFICATION_RESEND_SECONDS,
} from '@/store/verification-store';
import PublicAuthHeader from '@/components/common/PublicAuthHeader';
import Loading from '@/components/common/Loading';
import FormErrorPrompt, {
    getApiErrorMessage,
    getApiResponseMessage,
    isApiResponseFailure,
    isVerificationCodeInlineError,
    isVerificationLockMessage,
} from '@/components/common/FormErrorPrompt';
import './index.less';

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

export default function Verification() {
    const { t } = useTranslation();
    const location = useLocation();
    const [codeYzm, setCodeYzm] = useState(['', '', '', '', '', '']);
    const inputsRef = useRef<Array<InputRef | null>>([]);
    const [loading, setLoading] = useState(false);
    const [, forceRender] = useState(0);
    const email = useForgotPwdStore((state: { email: string }) => state.email);
    const [sendLoading, setSendLoading] = useState(false);
    const [resendBlocked, setResendBlocked] = useState(false);
    const [codeError, setCodeError] = useState('');
    const [generalError, setGeneralError] = useState('');
    const verificationSource = new URLSearchParams(location.search).get('from');
    const verificationCountdownKey = getVerificationCountdownKey(
        verificationSource,
        email,
    );
    const verificationCodeLockKey = getVerificationLockKey(
        verificationSource,
        email,
        'code',
    );
    const verificationSendLockKey = getVerificationLockKey(
        verificationSource,
        email,
        'send',
    );
    const resendDeadline = useVerificationCountdownStore(
        (state) => state.resendDeadlines[verificationCountdownKey] ?? null,
    );
    const verificationCodeLock = useVerificationCountdownStore(
        (state) => state.verificationLocks?.[verificationCodeLockKey] ?? null,
    );
    const verificationSendLock = useVerificationCountdownStore(
        (state) => state.verificationLocks?.[verificationSendLockKey] ?? null,
    );
    const startCountdown = useVerificationCountdownStore(
        (state) => state.startCountdown,
    );
    const clearCountdown = useVerificationCountdownStore(
        (state) => state.clearCountdown,
    );
    const startLock = useVerificationCountdownStore(
        (state) => state.startLock,
    );
    const clearLock = useVerificationCountdownStore(
        (state) => state.clearLock,
    );
    const countdown = getVerificationCountdownRemaining(resendDeadline);
    const verificationCodeLockRemaining = getVerificationLockRemaining(
        verificationCodeLock,
    );
    const verificationSendLockRemaining = getVerificationLockRemaining(
        verificationSendLock,
    );
    const storedVerificationCodeLockMessage = getVerificationLockMessage(
        verificationCodeLock,
    );
    const storedVerificationSendLockMessage = getVerificationLockMessage(
        verificationSendLock,
    );
    const isVerificationCodeLocked = verificationCodeLockRemaining > 0;
    const isVerificationSendLocked = verificationSendLockRemaining > 0;
    const verificationCodeLockMessage = isVerificationCodeLocked
        ? storedVerificationCodeLockMessage || t('verification.locked')
        : '';
    const verificationSendLockMessage = isVerificationSendLocked
        ? storedVerificationSendLockMessage || t('verification.locked')
        : '';

    const setVerificationError = (
        message: string,
        fallback: 'invalid' | 'request',
    ) => {
        const text = message.trim();
        if (isVerificationLockMessage(text)) {
            startLock(
                verificationCodeLockKey,
                VERIFICATION_LOCK_SECONDS,
                text,
            );
            setCodeError('');
            setGeneralError(text);
            return;
        }
        if (isVerificationCodeInlineError(text)) {
            setCodeYzm(['', '', '', '', '', '']);
            setCodeError(text);
            setGeneralError('');
            return;
        }
        if (text) {
            setCodeError('');
            setGeneralError(text);
            return;
        }
        if (fallback === 'invalid') {
            setCodeYzm(['', '', '', '', '', '']);
            setCodeError(t('verification.invalidCode'));
            setGeneralError('');
            return;
        }
        setCodeError('');
        setGeneralError(t('request.operation.failed'));
    };

    const clearVerificationErrors = () => {
        setCodeError('');
        if (!isVerificationCodeLocked && !isVerificationSendLocked) {
            setGeneralError('');
        }
    };

    const currentEmail: string = email;
    const isCodeComplete = codeYzm.every((digit) => digit !== '');

    function handleInputChange(value: string, index: number) {
        if (!/^\d?$/.test(value)) return;

        const nextCode = [...codeYzm];
        nextCode[index] = value;
        setCodeYzm(nextCode);
        clearVerificationErrors();

        if (value && index < codeYzm.length - 1) {
            inputsRef.current[index + 1]?.focus();
        }
    }

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        index: number,
    ) => {
        if (e.key === 'Backspace' && !codeYzm[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text');
        const numbers = pastedData
            .replace(/\D/g, '')
            .split('')
            .slice(0, codeYzm.length);

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

    useEffect(() => {
        if (
            countdown <= 0 &&
            verificationCodeLockRemaining <= 0 &&
            verificationSendLockRemaining <= 0
        ) {
            return;
        }

        const timer = window.setTimeout(() => {
            forceRender((value) => value + 1);
        }, 1000);

        return () => window.clearTimeout(timer);
    }, [
        countdown,
        verificationCodeLockRemaining,
        verificationSendLockRemaining,
    ]);

    useEffect(() => {
        if (!verificationCodeLock || verificationCodeLockRemaining > 0) {
            return;
        }

        clearLock(verificationCodeLockKey);
        setGeneralError((message) =>
            message === storedVerificationCodeLockMessage ? '' : message,
        );
    }, [
        clearLock,
        verificationCodeLock,
        verificationCodeLockKey,
        verificationCodeLockRemaining,
        storedVerificationCodeLockMessage,
    ]);

    useEffect(() => {
        if (!verificationSendLock || verificationSendLockRemaining > 0) {
            return;
        }

        clearLock(verificationSendLockKey);
        setGeneralError((message) =>
            message === storedVerificationSendLockMessage ? '' : message,
        );
    }, [
        clearLock,
        verificationSendLock,
        verificationSendLockKey,
        verificationSendLockRemaining,
        storedVerificationSendLockMessage,
    ]);

    async function hanldeContinue() {
        if (loading || isVerificationCodeLocked) return;
        if (codeYzm.join('').length === 6) {
            try {
                setLoading(true);
                clearVerificationErrors();
                const verifyResult = await request.post(
                    '/api/AdminUser/VerificationCode',
                    { type: 1, email, code: codeYzm.join('') },
                    { skipErrorMessage: true },
                );
                if (!isUserVerificationCodeAccepted(verifyResult)) {
                    setVerificationError(
                        getApiResponseMessage(verifyResult),
                        'invalid',
                    );
                    return;
                }
                clearCountdown(verificationCountdownKey);
                history.push('/new-password');
            } catch (error) {
                setVerificationError(getApiErrorMessage(error), 'request');
                console.error('Failed to verify code:', error);
            } finally {
                setLoading(false);
            }
        }
    }

    async function resend() {
        if (
            sendLoading ||
            countdown > 0 ||
            resendBlocked ||
            isVerificationSendLocked
        ) {
            return;
        }
        try {
            setSendLoading(true);
            const response = await request.post(
                '/api/AdminUser/GetGenerateCode',
                {
                    type: 1,
                    email: currentEmail,
                    phone: '',
                    code: '',
                },
                { skipErrorMessage: true },
            );
            if (isApiResponseFailure(response)) {
                const responseMessage = getApiResponseMessage(response);
                const isLocked = isVerificationLockMessage(responseMessage);
                if (isLocked) {
                startLock(
                verificationSendLockKey,
                VERIFICATION_LOCK_SECONDS,
                responseMessage,
                );
                setGeneralError(responseMessage);
                } else {
                setResendBlocked(true);
                setGeneralError(
                responseMessage || t('request.operation.failed'),
                );
                }
                setCodeError('');
                return;
            }
            clearLock(verificationSendLockKey);
            setResendBlocked(false);
            if (!isVerificationCodeLocked) {
                setGeneralError('');
            }
            startCountdown(
                verificationCountdownKey,
                VERIFICATION_RESEND_SECONDS,
            );
        } catch (error) {
            const responseMessage = getApiErrorMessage(error);
            const isLocked = isVerificationLockMessage(responseMessage);
            if (isLocked) {
            startLock(
            verificationSendLockKey,
            VERIFICATION_LOCK_SECONDS,
            responseMessage,
            );
            setGeneralError(responseMessage);
            } else {
            setResendBlocked(true);
            setGeneralError(
            responseMessage || t('request.operation.failed'),
            );
            }
            setCodeError('');
            console.error('Failed to resend verification code:', error);
        } finally {
            setSendLoading(false);
        }
    }

    const countdownLabel = `${countdown}s`;
    const isContinueDisabled =
        !isCodeComplete || loading || isVerificationCodeLocked;

    return (
        <div className="verification-wrapper">
            <PublicAuthHeader showBack onBack={() => history.goBack()} />
            <div className="verification-main">                <div className="verification-box">
                    <div className="verification-content">
                        <div className="verification-title">
                            {t('verification.verification')}
                        </div>
                        <div className="verification-desc">
                            <Trans
                                i18nKey="verification.verificationDesc"
                                values={{ email: currentEmail }}
                                components={{
                                    bold: <span className="verification-email" />,
                                }}
                            />
                        </div>
                        <div className="verification-code-section">
                            <div className="verification-input-group">
                                {codeYzm.map((item, index) => (
                                    <Input
                                        key={index}
                                        className={`verification-otp-input${
                                            codeError ? ' error' : ''
                                        }`}
                                        maxLength={1}
                                        inputMode="numeric"
                                        onKeyDown={(e) =>
                                            handleKeyDown(e, index)
                                        }
                                        onPaste={handlePaste}
                                        ref={(el) =>
                                            (inputsRef.current[index] = el)
                                        }
                                        value={item}
                                        onChange={(e) =>
                                            handleInputChange(
                                                e.target.value,
                                                index,
                                            )
                                        }
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
                            <span className="verification-text">
                                {t('verification.notRecieved')}
                            </span>
                            {countdown > 0 ? (
                                <span className="time">
                                    <Timer />
                                    {countdownLabel}
                                </span>
                            ) : null}
                            <span
                                className={`resend ${
                                    countdown > 0 ||
                                    sendLoading ||
                                    resendBlocked ||
                                    isVerificationSendLocked
                                        ? 'disabled'
                                        : ''
                                }`}
                                onClick={resend}
                            >
                                <Loading loading={sendLoading}>
                                    {t('verification.resend')}
                                </Loading>
                            </span>
                        </div>
                        <div className="verification-actions">
                            <div className="verification-footer">
                                <div
                                    className="verification-back-btn"
                                    onClick={() => history.goBack()}
                                >
                                    {t('verification.back')}
                                </div>
                                <div
                                    className={`verification-continue-btn ${
                                        isContinueDisabled ? 'disabled' : ''
                                    }`}
                                    onClick={hanldeContinue}
                                >
                                    <Loading loading={loading}>
                                        {t('verification.continue')}
                                    </Loading>
                                </div>
                            </div>
                            <FormErrorPrompt
                                message={
                                    generalError ||
                                    verificationCodeLockMessage ||
                                    verificationSendLockMessage
                                }
                                className="form-error-prompt--after-footer"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
