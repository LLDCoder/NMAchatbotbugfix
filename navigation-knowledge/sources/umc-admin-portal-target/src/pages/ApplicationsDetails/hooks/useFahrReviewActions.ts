import { useCallback } from "react";

import { CustomMessage } from "@/components/common";
import type { FahrReviewAction } from "@/pages/ApplicationsDetails/components/FahrReviewDetailsModal";
import type { FahrReviewSubmissionPayload } from "@/pages/ApplicationsDetails/components/FahrReviewSubmissionModal";
import {
  applyFahrTransaction,
  cancelFahrTransaction,
  unapplyFahrTransaction,
  submitFahrSupplementaryMaterials,
  type FahrReviewTarget,
} from "@/services/fahr";
import { useUserStore } from "@/store/user";
import i18n from "@/localization/config";

const tr = (key: string) => i18n.t(`Licensing.fahrReview.messages.${key}`);

type FahrReviewActionErrorKey =
  | "actionUnavailable"
  | "oneAttachmentRequired"
  | "notesRequired"
  | "materialsRejected";

class FahrReviewActionError extends Error {
  readonly translationKey: FahrReviewActionErrorKey;
  readonly detail?: string;

  constructor(translationKey: FahrReviewActionErrorKey, detail?: string | null) {
    super(detail || translationKey);
    this.translationKey = translationKey;
    this.detail = detail || undefined;
  }
}

const translateActionError = (key: FahrReviewActionErrorKey): string => {
  switch (key) {
    case "actionUnavailable":
      return tr("actionUnavailable");
    case "oneAttachmentRequired":
      return tr("oneAttachmentRequired");
    case "notesRequired":
      return i18n.t("Licensing.fahrReview.submission.notesRequired");
    case "materialsRejected":
      return tr("materialsRejected");
  }
};

const rejectedMessage = (data?: {
  errorMessage?: string | null;
  replyMessages?: string | null;
} | null) => data?.errorMessage || data?.replyMessages || undefined;

const requireSingleAttachmentReference = (
  payload?: FahrReviewSubmissionPayload,
) => {
  const attachment = payload?.attachments[0];
  if (payload?.attachments.length !== 1 || !attachment?.url) {
    throw new FahrReviewActionError("oneAttachmentRequired");
  }
  return attachment.url;
};

const requireNotes = (payload?: FahrReviewSubmissionPayload) => {
  const notes = payload?.notes?.trim();
  if (!notes) {
    throw new FahrReviewActionError("notesRequired");
  }
  return notes;
};

interface UseFahrReviewActionsParams {
  applicationId?: number;
  requestId?: number;
}

export function useFahrReviewActions({
  applicationId,
}: UseFahrReviewActionsParams) {
  const currentUserEmail = useUserStore((state) => state.userInfo?.email || "");

  const isActionAvailable = useCallback(
    (action: FahrReviewAction, target: FahrReviewTarget) => {
      const actionNames: Record<FahrReviewAction, string> = {
        resubmitApplication: "SubmitRfiResponse",
        cancelTransaction: "CancelApplication",
        submitReconsideration: "ApplyReconsider",
        applyTransaction: "ApplyTransaction",
        unapplyTransaction: "UnapplyTransaction",
      };
      return Boolean(
        target.allowedActions?.includes(actionNames[action]) &&
          (action === "applyTransaction" || action === "unapplyTransaction"
            ? applicationId
            : true),
      );
    },
    [applicationId],
  );

  const submitMaterials = useCallback(async (
      action: Extract<
        FahrReviewAction,
        "resubmitApplication" | "submitReconsideration"
      >,
      target: FahrReviewTarget,
      payload?: FahrReviewSubmissionPayload,
    ) => {
    const isRfiResponse = action === "resubmitApplication";
    const response = await submitFahrSupplementaryMaterials({
      targetId: target.targetId,
      scenario: isRfiResponse ? "RfiResponse" : "ReconsiderationAttachment",
      submittedBy: currentUserEmail || undefined,
      note: requireNotes(payload),
      registrationForm: undefined,
      attachments: [requireSingleAttachmentReference(payload)],
    });
    if (response.data?.outboundAccepted !== true) {
      throw new FahrReviewActionError(
        "materialsRejected",
        rejectedMessage(response.data),
      );
    }
    }, [currentUserEmail]);

  const submitTargetAction = useCallback(async (
      action: Extract<
        FahrReviewAction,
        "cancelTransaction" | "applyTransaction" | "unapplyTransaction"
      >,
      target: FahrReviewTarget,
    ) => {
    const payload = {
      targetId: target.targetId,
      submittedBy: currentUserEmail || undefined,
    };
    const response =
      action === "cancelTransaction"
        ? await cancelFahrTransaction(payload)
        : action === "applyTransaction"
          ? await applyFahrTransaction(applicationId!, payload)
          : await unapplyFahrTransaction(applicationId!, {
              targetId: target.targetId,
              submittedBy: currentUserEmail || undefined,
            });
    if (response.data?.outboundAccepted !== true) {
      throw new FahrReviewActionError(
        "materialsRejected",
        rejectedMessage(response.data),
      );
    }
    }, [applicationId, currentUserEmail]);

  const runAction = useCallback(
    async (
      action: FahrReviewAction,
      target: FahrReviewTarget,
      payload?: FahrReviewSubmissionPayload,
    ) => {
      if (!isActionAvailable(action, target)) {
        CustomMessage.error(translateActionError("actionUnavailable"));
        return;
      }
      try {
        if (
          action === "resubmitApplication" ||
          action === "submitReconsideration"
        ) {
          await submitMaterials(action, target, payload);
        } else {
          await submitTargetAction(action, target);
        }
        CustomMessage.success(tr("actionSuccess"));
      } catch (error) {
        console.error("Failed to complete FAHR review action:", error);
        CustomMessage.error(
          error instanceof FahrReviewActionError
            ? translateActionError(error.translationKey)
            : tr("actionFailed"),
        );
        throw error;
      }
    },
    [
      isActionAvailable,
      submitMaterials,
      submitTargetAction,
    ],
  );

  return { isActionAvailable, runAction };
}
