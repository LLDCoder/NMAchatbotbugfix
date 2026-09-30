import type { ReactNode } from 'react';
import warningIcon from '@/assets/images/warning_red.svg';
import { hasForgotPasswordHint, splitForgotPasswordHint } from './utils';
import './index.less';

export type FormErrorPromptVariant = 'boxed' | 'inline';

export interface FormErrorPromptProps {
  /** When empty, nothing is rendered. */
  message?: string | null;
  /** Optional action below the message (e.g. Forgot password). */
  action?: ReactNode;
  /** Splits "Forgot password?" from the message and renders it as an inline link on one line. */
  onInlineActionClick?: () => void;
  className?: string;
  /** `boxed` — icon + tinted background; `inline` — message text only. */
  variant?: FormErrorPromptVariant;
}

export default function FormErrorPrompt({
  message,
  action,
  onInlineActionClick,
  className = '',
  variant = 'boxed',
}: FormErrorPromptProps) {
  const text = String(message ?? '').trim();
  if (!text) {
    return null;
  }

  const useInlineForgotLink =
    Boolean(onInlineActionClick) && hasForgotPasswordHint(text);
  const { prefix, linkText } = useInlineForgotLink
    ? splitForgotPasswordHint(text)
    : { prefix: text, linkText: null };

  if (variant === 'inline') {
    return (
      <div
        className={`form-error-prompt form-error-prompt--inline ${className}`.trim()}
        role="alert"
      >
        {text}
      </div>
    );
  }

  return (
    <div
      className={`form-error-prompt form-error-prompt--boxed ${className}`.trim()}
      role="alert"
    >
      <img className="form-error-prompt__icon" src={warningIcon} alt="" />
      <div className="form-error-prompt__body">
        {useInlineForgotLink && linkText ? (
          <div className="form-error-prompt__message form-error-prompt__message--with-link">
            {prefix ? (
              <span className="form-error-prompt__message-text">{prefix}</span>
            ) : null}
            <button
              type="button"
              className="form-error-prompt__action-link"
              onClick={onInlineActionClick}
            >
              {linkText}
            </button>
          </div>
        ) : (
          <div className="form-error-prompt__message">{text}</div>
        )}
        {action && !useInlineForgotLink ? (
          <div className="form-error-prompt__action">{action}</div>
        ) : null}
      </div>
    </div>
  );
}
