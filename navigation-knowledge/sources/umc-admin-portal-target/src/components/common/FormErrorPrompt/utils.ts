/** Extract user-facing message from axios / request wrapper errors. */
export function getApiErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const response = (error as { response?: { data?: { message?: unknown } } })
      .response;
    const message = response?.data?.message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return '';
}

type ApiResponseBody = {
  isSuccess?: unknown;
  message?: unknown;
};

export function isApiResponseFailure(response: unknown): boolean {
  return (
    typeof response === 'object' &&
    response !== null &&
    (response as ApiResponseBody).isSuccess === false
  );
}

export function getApiResponseMessage(response: unknown): string {
  if (typeof response !== 'object' || response === null) {
    return '';
  }

  const message = (response as ApiResponseBody).message;
  return typeof message === 'string' ? message.trim() : '';
}

/** Whether the backend message includes a forgot-password hint (show link in error box). */
export function hasForgotPasswordHint(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('forgot password') ||
    normalized.includes('نسيت كلمة المرور')
  );
}

/** Split backend copy so "Forgot password?" can render as an inline link on one line. */
export function splitForgotPasswordHint(message: string): {
  prefix: string;
  linkText: string | null;
} {
  const trimmed = message.trim();
  if (!trimmed) {
    return { prefix: '', linkText: null };
  }

  const lower = trimmed.toLowerCase();
  const hint =
    lower.includes('forgot password')
      ? 'forgot password'
      : lower.includes('نسيت كلمة المرور')
        ? 'نسيت كلمة المرور'
        : null;
  const idx = hint ? lower.indexOf(hint) : -1;
  if (idx === -1) {
    return { prefix: trimmed, linkText: null };
  }

  const prefix = trimmed.slice(0, idx).trimEnd();
  const linkText = trimmed.slice(idx).trim();
  return { prefix, linkText: linkText || null };
}

/** Whether resend / generate-code should stay disabled (e.g. rate limit from GetGenerateCode). */
export function isVerificationResendBlocked(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('access has been restricted') ||
    normalized.includes('multiple failed verification') ||
    normalized.includes('try again in')
  );
}

export function isVerificationLockMessage(message: string): boolean {
  return message
    .toLowerCase()
    .includes('access has been restricted due to multiple failed verification attempts');
}

/** Whether the message should show as plain text under the OTP inputs (not the boxed prompt). */
export function isVerificationCodeInlineError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('incorrect verification code') ||
    normalized.includes('invalid verification code') ||
    (normalized.includes('verification') && normalized.includes('expired')) ||
    normalized.includes('verification code expired') ||
    normalized.includes('code has expired')
  );
}
