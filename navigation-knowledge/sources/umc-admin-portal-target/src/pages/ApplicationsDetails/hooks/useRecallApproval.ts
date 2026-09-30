import { useCallback, useEffect, useState } from "react";
import type { AxiosError } from "axios";
import { CustomMessage } from "@/components/common";
import {
  getRecallApprovalEligibility,
  submitRecallApproval,
} from "@/services/application";

interface RecallErrorPayload {
  message?: unknown;
  data?: {
    message?: unknown;
  } | null;
}

interface UseRecallApprovalParams {
  applicationId?: number;
  readOnly: boolean;
  onSuccess?: (newTaskId: string | null) => void;
}

export const getRecallBackendMessage = (error: unknown) => {
  const payload = (error as AxiosError<RecallErrorPayload>).response?.data;
  const message = payload?.message ?? payload?.data?.message;
  return typeof message === "string" ? message.trim() : "";
};

export const createIdempotencyKey = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
};

export const useRecallApproval = ({
  applicationId,
  readOnly,
  onSuccess,
}: UseRecallApprovalParams) => {
  const [eligible, setEligible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    setEligible(false);
    setSubmitting(false);
    setModalVisible(false);

    if (!applicationId || readOnly) {
      return;
    }

    let cancelled = false;
    getRecallApprovalEligibility(applicationId)
      .then((response) => {
        if (!cancelled) {
          setEligible(response.data?.isEligible === true);
        }
      })
      .catch((error) => {
        console.error("Failed to load recall approval eligibility:", error);
        if (!cancelled) {
          setEligible(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, readOnly]);

  const openModal = useCallback(() => {
    if (!eligible || submitting) return;
    setModalVisible(true);
  }, [eligible, submitting]);

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalVisible(false);
  }, [submitting]);

  const submit = useCallback(
    async (reason: string) => {
      const normalizedReason = reason.trim();
      if (!applicationId || !normalizedReason || submitting) {
        return;
      }

      setSubmitting(true);
      try {
        const response = await submitRecallApproval(
          applicationId,
          normalizedReason,
          createIdempotencyKey(),
        );

        if (!response.isSuccess) {
          const backendMessage = response.message?.trim();
          if (backendMessage) {
            CustomMessage.error(backendMessage);
          }
          return;
        }

        const newTaskId =
          typeof response.data?.newTaskId === "string"
            ? response.data.newTaskId.trim()
            : "";

        setModalVisible(false);
        onSuccess?.(newTaskId || null);
      } catch (error) {
        console.error("Failed to submit recall approval:", error);
        const backendMessage = getRecallBackendMessage(error);
        if (backendMessage) {
          CustomMessage.error(backendMessage);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [applicationId, submitting, onSuccess],
  );

  return {
    buttonVisible: eligible,
    submitting,
    modalVisible,
    openModal,
    closeModal,
    submit,
  };
};