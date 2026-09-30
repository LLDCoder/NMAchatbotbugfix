import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { CustomMessage } from "@/components/common";
import { isArabicLanguage } from "@/localization/language";
import FahrReviewActionConfirmModal, {
  type FahrReviewConfirmAction,
} from "@/pages/ApplicationsDetails/components/FahrReviewActionConfirmModal";
import FahrReviewDetailsModal, {
  type FahrReviewAction,
  type FahrReviewTimelineItem,
} from "@/pages/ApplicationsDetails/components/FahrReviewDetailsModal";
import {
  buildFahrInteractionTimeline,
  buildFahrReviewTimeline,
} from "@/pages/ApplicationsDetails/components/FahrReviewDetailsModal/fahrReviewViewModel";
import FahrReviewStatusTag from "@/pages/ApplicationsDetails/components/FahrReviewStatusTag";
import FahrReviewSubmissionModal, {
  type FahrReviewSubmissionMode,
  type FahrReviewSubmissionPayload,
} from "@/pages/ApplicationsDetails/components/FahrReviewSubmissionModal";
import {
  downloadFahrPermit,
  viewFahrPermit,
} from "@/pages/ApplicationsDetails/fahrPermit";
import {
  getFahrApplicationStatus,
  getFahrPersonStatus,
  type FahrReviewTarget,
} from "@/services/fahr";

interface FahrReviewTargetStatusProps {
  applicationId?: number;
  target: FahrReviewTarget;
  staticMode?: boolean;
  isActionAvailable?: (
    action: FahrReviewAction,
    target: FahrReviewTarget,
  ) => boolean;
  onAction?: (
    action: FahrReviewAction,
    target: FahrReviewTarget,
    payload?: FahrReviewSubmissionPayload,
  ) => Promise<void> | void;
}

const submissionMode = (
  action: FahrReviewAction | null,
): FahrReviewSubmissionMode => {
  if (action === "submitReconsideration") return "reconsider";
  return "resubmit";
};

const PERSON_LIST_TYPES = new Set([
  "EstablishmentPartner",
  "NewIndividualPartner",
]);

const FahrReviewTargetStatus: React.FC<FahrReviewTargetStatusProps> = ({
  applicationId,
  target,
  staticMode = false,
  isActionAvailable,
  onAction,
}) => {
  const { t, i18n } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [currentTarget, setCurrentTarget] = useState(target);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<FahrReviewAction | null>(null);
  const currentLanguage = i18n.language;

  useEffect(() => setCurrentTarget(target), [target]);

  const refreshTarget = async () => {
    if (staticMode) {
      setCurrentTarget(target);
      return target;
    }
    if (!applicationId) return null;
    const refreshedTarget = PERSON_LIST_TYPES.has(target.personType)
      ? target.personRefId
        ? await refreshTargetByPerson(applicationId, target)
        : await refreshTargetByApplication(applicationId, target.targetId)
      : await refreshSingleFormTarget(applicationId, target);
    if (!refreshedTarget) return null;
    setCurrentTarget(refreshedTarget);
    return refreshedTarget;
  };

  const openDetails = async () => {
    if (loading) return;
    if (staticMode) {
      setModalVisible(true);
      return;
    }
    if (!applicationId) return;
    setLoading(true);
    try {
      const refreshedTarget = await refreshTarget();
      if (!refreshedTarget) throw new Error("FAHR person status unavailable");
      setModalVisible(true);
    } catch (error) {
      console.error("Failed to load FAHR person status:", error);
      CustomMessage.error(t("Licensing.fahrReview.messages.recordsLoadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const timelineItems = useMemo<FahrReviewTimelineItem[]>(() => {
    const milestoneItems = currentTarget.interactionLogs?.length
      ? buildFahrInteractionTimeline(
          currentTarget.interactionLogs,
          currentTarget,
          currentLanguage,
        )
      : [];
    const items = milestoneItems.length
      ? milestoneItems
      : buildFahrReviewTimeline(currentTarget);
    return items.map((item) => ({
      ...item,
      actions: item.actions?.filter((timelineAction) =>
        timelineAction.disabled
          ? true
          : isActionAvailable
          ? isActionAvailable(timelineAction.action, currentTarget)
          : Boolean(onAction),
      ),
    }));
  }, [currentLanguage, currentTarget, isActionAvailable, onAction]);

  const handleTimelineAction = (action: FahrReviewAction) => {
    if (!onAction) return;
    if (isActionAvailable && !isActionAvailable(action, currentTarget)) return;
    setActiveAction(action);
  };

  const runAction = async (payload?: FahrReviewSubmissionPayload) => {
    if (!activeAction || !onAction || actionLoading) return;
    const action = activeAction;
    setActionLoading(true);
    try {
      await onAction(action, currentTarget, payload);
      await refreshTarget();
      if (
        action === "cancelTransaction" ||
        action === "applyTransaction" ||
        action === "unapplyTransaction" ||
        action === "resubmitApplication" ||
        action === "submitReconsideration"
      ) {
        setActiveAction(null);
      }
    } catch (error) {
      console.error("Failed to complete FAHR action:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const permit = useMemo(() => {
    const permits = currentTarget.permits || [];
    const currentDecision = currentTarget.status?.trim().toLowerCase();
    return (
      permits.find(
        (item) => item.decision?.trim().toLowerCase() === currentDecision,
      ) || permits[permits.length - 1]
    );
  }, [currentTarget.permits, currentTarget.status]);
  const confirmAction =
    activeAction === "cancelTransaction" ||
    activeAction === "applyTransaction" ||
    activeAction === "unapplyTransaction"
      ? (activeAction as FahrReviewConfirmAction)
      : null;
  const submissionVisible =
    activeAction === "resubmitApplication" ||
    activeAction === "submitReconsideration";

  return (
    <>
      <FahrReviewStatusTag
        status={currentTarget.status}
        label={
          isArabicLanguage(currentLanguage)
            ? currentTarget.statusLabel?.ar
            : currentTarget.statusLabel?.en
        }
        permit={
          !PERSON_LIST_TYPES.has(currentTarget.personType) && permit
            ? {
                name: permit.fileName || permit.name || undefined,
                onDownload: () => void downloadFahrPermit(permit),
              }
            : undefined
        }
        onClick={() => void openDetails()}
      />
      <FahrReviewDetailsModal
        visible={modalVisible}
        itimadNumber={currentTarget.fahrReferenceNo || "-"}
        timelineItems={timelineItems}
        permit={
          permit
            ? {
                name:
                  permit.fileName ||
                  permit.name ||
                  t("Licensing.fahrReview.permitFallback"),
                onView: () => void viewFahrPermit(permit),
                onDownload: () => void downloadFahrPermit(permit),
              }
            : null
        }
        onCancel={() => setModalVisible(false)}
        onAction={onAction ? handleTimelineAction : undefined}
      />
      <FahrReviewActionConfirmModal
        visible={Boolean(confirmAction)}
        action={confirmAction}
        loading={actionLoading}
        onCancel={() => setActiveAction(null)}
        onConfirm={() => void runAction()}
      />
      <FahrReviewSubmissionModal
        visible={submissionVisible}
        mode={submissionMode(activeAction)}
        loading={actionLoading}
        onCancel={() => setActiveAction(null)}
        onConfirm={runAction}
      />
    </>
  );
};

const refreshSingleFormTarget = async (
  applicationId: number,
  target: FahrReviewTarget,
) => {
  const response = await getFahrPersonStatus(
    applicationId,
    target.personRefId,
    target.personType,
  );
  return response.data?.[0];
};

const refreshTargetByPerson = async (
  applicationId: number,
  target: FahrReviewTarget,
) => {
  const response = await getFahrPersonStatus(
    applicationId,
    target.personRefId,
    target.personType,
  );
  return response.data?.find((item) => item.targetId === target.targetId);
};

const refreshTargetByApplication = async (
  applicationId: number,
  targetId: number,
) => {
  const response = await getFahrApplicationStatus(applicationId);
  return response.data?.sessions
    ?.flatMap((session) => session.persons || [])
    .find((item) => item.targetId === targetId);
};

export default FahrReviewTargetStatus;
