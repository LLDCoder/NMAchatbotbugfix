type ErrorPayload = Record<string, unknown>;

const SMS_RECIPIENT_MOBILE_MISSING_CODE = "SMS_RECIPIENT_MOBILE_MISSING";
const LEGACY_SMS_RECIPIENT_MOBILE_MISSING_MESSAGE =
  "recipient mobile number is missing on the customer profile";

const asPayload = (value: unknown): ErrorPayload | null =>
  value !== null && typeof value === "object" ? (value as ErrorPayload) : null;

const getErrorPayloads = (source: unknown) => {
  const root = asPayload(source);
  const response = asPayload(root?.response);
  const responseData = asPayload(response?.data);

  return [
    root,
    asPayload(root?.data),
    responseData,
    asPayload(responseData?.data),
  ].filter((payload): payload is ErrorPayload => Boolean(payload));
};

export const isSmsRecipientMobileMissingError = (source: unknown) =>
  getErrorPayloads(source).some((payload) => {
    const rawCode = payload.errorCode ?? payload.code;
    if (
      typeof rawCode === "string" &&
      rawCode.trim().toUpperCase() === SMS_RECIPIENT_MOBILE_MISSING_CODE
    ) {
      return true;
    }

    // Older responses expose only this diagnostic sentence. It is classified,
    // never rendered, so the visible message still comes from i18n resources.
    return (
      typeof payload.message === "string" &&
      payload.message
        .trim()
        .toLowerCase()
        .includes(LEGACY_SMS_RECIPIENT_MOBILE_MISSING_MESSAGE)
    );
  });
