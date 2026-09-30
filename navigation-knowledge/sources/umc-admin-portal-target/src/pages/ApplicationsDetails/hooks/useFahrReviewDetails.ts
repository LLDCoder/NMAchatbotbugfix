import { useCallback, useEffect, useRef, useState } from "react";
import { CustomMessage } from "@/components/common";
import {
  getFahrExternalApprovalEligibility,
  getFahrExternalReviewReadiness,
  getFahrApplicationStatus,
  type FahrApplicationStatus,
  type FahrExternalReviewReadiness,
  type FahrReviewRequestDetails,
} from "@/services/fahr";
import { shouldLoadFahrApplicationStatus } from "@/services/fahrPolicy";
import i18n from "@/localization/config";

const tr = (key: string) => i18n.t(`Licensing.fahrReview.messages.${key}`);
export type FahrReviewDetailsLoadResult = "success" | "empty" | "failed";

export function useFahrReviewDetails({
  applicationId,
  enabled,
  readinessEnabled,
}: {
  applicationId?: number;
  enabled: boolean;
  readinessEnabled: boolean;
}) {
  const [reviewDetails, setReviewDetails] =
    useState<FahrReviewRequestDetails | null>(null);
  const [applicationStatus, setApplicationStatus] =
    useState<FahrApplicationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadResult, setLoadResult] =
    useState<FahrReviewDetailsLoadResult>("empty");
  const [readiness, setReadiness] =
    useState<FahrExternalReviewReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [eligibilityLoaded, setEligibilityLoaded] = useState(false);
  const [isFahrRequired, setIsFahrRequired] = useState(false);
  const requestVersionRef = useRef(0);
  const readinessRequestVersionRef = useRef(0);
  const requestContextRef = useRef({ applicationId, enabled });
  requestContextRef.current = { applicationId, enabled };

  const loadFahrReadiness = useCallback(async () => {
    const requestVersion = ++readinessRequestVersionRef.current;
    const isCurrent = () =>
      requestVersion === readinessRequestVersionRef.current &&
      requestContextRef.current.applicationId === applicationId &&
      requestContextRef.current.enabled === enabled;
    if (!enabled || !applicationId) return null;
    if (isCurrent()) setReadinessLoading(true);
    try {
      const eligibilityResponse =
        await getFahrExternalApprovalEligibility(applicationId);
      if (!isCurrent()) return null;

      const eligibility = eligibilityResponse.data;
      const fahrRequired = shouldLoadFahrApplicationStatus(eligibility);
      setEligibilityLoaded(true);
      setIsFahrRequired(fahrRequired);
      if (
        !fahrRequired ||
        eligibility?.status !== "Eligible" ||
        eligibility.eligible !== true
      ) {
        setReadiness(null);
        return { eligibility, readiness: null };
      }
      const response = await getFahrExternalReviewReadiness(applicationId);
      if (!isCurrent()) return null;

      const readinessResult = response.data || null;
      setReadiness(readinessResult);
      return { eligibility, readiness: readinessResult };
    } finally {
      if (isCurrent()) setReadinessLoading(false);
    }
  }, [applicationId, enabled]);

  const loadFahrReviewDetails = useCallback(
    async (): Promise<FahrReviewDetailsLoadResult> => {
      const requestVersion = ++requestVersionRef.current;
      const isCurrent = () =>
        requestVersion === requestVersionRef.current &&
        requestContextRef.current.applicationId === applicationId &&
        requestContextRef.current.enabled === enabled;
      if (!enabled || !applicationId) {
        if (isCurrent()) {
          setApplicationStatus(null);
          setReviewDetails(null);
          setReadiness(null);
          setReadinessLoading(false);
          setEligibilityLoaded(false);
          setIsFahrRequired(false);
          setLoading(false);
          setLoadResult("empty");
        }
        return "empty";
      }
      if (isCurrent()) setLoading(true);
      try {
        const eligibilityResponse =
          await getFahrExternalApprovalEligibility(applicationId);
        const fahrRequired = shouldLoadFahrApplicationStatus(
          eligibilityResponse.data,
        );
        if (isCurrent()) {
          setEligibilityLoaded(true);
          setIsFahrRequired(fahrRequired);
        }
        if (!fahrRequired) {
          if (isCurrent()) {
            setApplicationStatus(null);
            setReviewDetails(null);
            setLoadResult("empty");
          }
          return "empty";
        }

        const response = await getFahrApplicationStatus(applicationId);
        if (!response.data) {
          if (isCurrent()) {
            CustomMessage.error(tr("requestDetailsLoadFailed"));
            setLoadResult("failed");
          }
          return "failed";
        }
        if (response.data.applicationId !== applicationId) {
          if (isCurrent()) {
            CustomMessage.error(tr("applicationMismatch"));
            setLoadResult("failed");
          }
          return "failed";
        }

        const applicationStatusResult = response.data;
        const currentSession = applicationStatusResult.sessions?.[0];
        let readinessResult: FahrExternalReviewReadiness | null = null;
        const shouldLoadReadiness =
          readinessEnabled &&
          eligibilityResponse.data?.status === "Eligible" &&
          eligibilityResponse.data.eligible === true;
        if (shouldLoadReadiness) {
          if (isCurrent()) setReadinessLoading(true);
          try {
            const readinessResponse =
              await getFahrExternalReviewReadiness(applicationId);
            readinessResult = readinessResponse.data || null;
          } catch (error) {
            console.error("Failed to load FAHR review readiness:", error);
            if (isCurrent()) CustomMessage.error(tr("externalDecisionFailed"));
          } finally {
            if (isCurrent()) setReadinessLoading(false);
          }
        }
        if (isCurrent()) {
          setApplicationStatus(applicationStatusResult);
          setReadiness(readinessResult);
          setReviewDetails(
            currentSession
              ? {
                  ...currentSession,
                  applicationId,
                  targets: currentSession.persons || [],
                }
              : null,
          );
        }
        const result = currentSession ? "success" : "empty";
        if (isCurrent()) setLoadResult(result);
        return result;
      } catch (error) {
        if (isCurrent()) {
          const status = (
            error as { response?: { status?: number } }
          )?.response?.status;
          CustomMessage.error(
            status === 401
              ? tr("sessionExpired")
              : status === 404
                ? tr("recordNotFound")
                : tr("recordsLoadFailed"),
          );
          setIsFahrRequired(false);
          setLoadResult("failed");
        }
        return "failed";
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [applicationId, enabled, readinessEnabled],
  );

  useEffect(() => {
    requestVersionRef.current += 1;
    readinessRequestVersionRef.current += 1;
    setApplicationStatus(null);
    setReviewDetails(null);
    setReadiness(null);
    setReadinessLoading(false);
    setEligibilityLoaded(false);
    setIsFahrRequired(false);
    void loadFahrReviewDetails();
  }, [applicationId, enabled, loadFahrReviewDetails]);

  return {
    applicationStatus,
    reviewDetails,
    readiness,
    readinessLoading,
    eligibilityLoaded,
    isFahrRequired,
    loadFahrReadiness,
    loading,
    loadResult,
    loadFahrReviewDetails,
  };
}
