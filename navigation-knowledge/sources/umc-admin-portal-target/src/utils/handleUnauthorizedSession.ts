import type { AxiosError } from "axios";
import i18next from "@/localization/config";
import { CustomMessage } from "@/components/common";
import { setBlockOtherErrorToasts } from "@/utils/blockOtherErrorToasts";
import { getApiErrorMessage } from "@/components/common/FormErrorPrompt/utils";
import { performAuthenticatedLogout } from "@/utils/authSession";

/** Server message when the same account signs in on another device/browser. */
const LOGGED_IN_ELSEWHERE_HINT = "logged in elsewhere";

let capturedServerMessage = "";
let unauthorizedSessionHandled = false;
let flushScheduled = false;

function extractUnauthorizedMessage(error: unknown): string {
  const fromHelper = getApiErrorMessage(error);
  if (fromHelper) {
    return fromHelper;
  }

  if (!error || typeof error !== "object") {
    return "";
  }

  const data = (error as AxiosError<{ message?: unknown; Message?: unknown }>)
    .response?.data;

  if (!data || typeof data !== "object") {
    return "";
  }

  for (const key of ["message", "Message", "error", "msg"] as const) {
    const value = (data as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function isLoggedInElsewhereMessage(message: string): boolean {
  return message.toLowerCase().includes(LOGGED_IN_ELSEWHERE_HINT);
}

export function isUnauthorizedResponse(error: AxiosError): boolean {
  const body = error.response?.data;

  if (error.response?.status === 401) {
    return true;
  }

  if (!body || typeof body !== "object") {
    return false;
  }

  const statusCode = Number((body as { statusCode?: unknown }).statusCode);
  return Number.isFinite(statusCode) && statusCode === 401;
}

export function resetUnauthorizedSessionHandling() {
  unauthorizedSessionHandled = false;
  capturedServerMessage = "";
  flushScheduled = false;
  setBlockOtherErrorToasts(false);
}

function handleLoggedInElsewhere(serverMessage: string) {
  if (unauthorizedSessionHandled) {
    return;
  }

  unauthorizedSessionHandled = true;
  setBlockOtherErrorToasts(true);

  CustomMessage.destroy();
  setBlockOtherErrorToasts(false);
  setBlockOtherErrorToasts(true);

  performAuthenticatedLogout({
    bypassInspectionLeaveConfirm: true,
    saveInspectionExecutionDraft: true,
    loginNotice: serverMessage,
  });
}

function flushUnauthorizedSession() {
  if (unauthorizedSessionHandled) {
    return;
  }

  unauthorizedSessionHandled = true;
  flushScheduled = false;

  const content =
    capturedServerMessage || i18next.t("response.error.401");

  CustomMessage.destroy();
  performAuthenticatedLogout({
    bypassInspectionLeaveConfirm: true,
    saveInspectionExecutionDraft: true,
    loginNotice: content,
  });
}

export function handleUnauthorizedSession(error: unknown) {
  const serverMessage = extractUnauthorizedMessage(error);
  if (serverMessage) {
    capturedServerMessage = capturedServerMessage || serverMessage;
  }

  if (isLoggedInElsewhereMessage(serverMessage || capturedServerMessage)) {
    handleLoggedInElsewhere(serverMessage || capturedServerMessage);
    return;
  }

  if (unauthorizedSessionHandled) {
    return;
  }

  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flushUnauthorizedSession);
  }
}
