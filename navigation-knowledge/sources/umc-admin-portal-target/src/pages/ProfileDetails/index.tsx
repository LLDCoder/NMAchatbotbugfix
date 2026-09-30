import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { message, Spin } from "antd";
import { useHistory, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CustomButton, RejectModal } from "@/components/common";
import ConfirmModal from "@/components/common/ConfirmModal";
import approvalIcon from "@/assets/images/profile-details-status.svg";
import BaseNum from "@/assets/images/profile-details-application-number.svg";
import ApplicantIcon from "@/assets/images/profile-details-applicant.svg";
import SLAIcon from "@/assets/images/profile-details-sla.svg";
import {
  getUserProfileEstablishment,
  getUserProfilePersonal,
  processUserProfile,
  type ApiResponse,
  type EstablishmentInfoDto,
  type UserProfileInfoDto,
} from "@/services/userManagement";
import {
  TeamTaskDetailReassignAction,
  useTeamTaskDetailContext,
} from "@/pages/TeamManagement/components/TeamTaskDetailReassignAction";
import IndividualProfileDetails from "./components/IndividualProfileDetails";
import OrganizationProfileDetails from "./components/OrganizationProfileDetails";
import {
  getEstablishmentApplicationTitle,
  getEstablishmentOverviewSectionTitle,
  resolveEstablishmentProfileView,
} from "./components/OrganizationProfileDetails/utils";
import {
  APPROVE_STATUS_ID,
  PARTNER_DETAILS_PERMISSION_CODE,
  PENDING_PROCESS_STATUS_ID,
  PROFILE_DETAILS_PATH,
  PROFILE_LIST_PATH,
  REJECT_STATUS_ID,
} from "./constants";
import type { ProfileDetailsLocationState, SummaryItem, ViewType } from "./type";
import {
  getLocalizedStatusLabel,
  getSlaDisplayText,
  getStatusTone,
  isArabicLanguage,
  normalizeLegacyViewType,
  resolveProfileViewByUserTypeId,
  resolveViewFromUserType,
  safeText,
} from "./utils";
import "./index.less";

type ProfilePayloadWithRejectReason<T> = T & {
  rejectReason?: string | null;
};

const ProfileDetailsPage: React.FC = () => {
  const { i18n, t } = useTranslation();
  const location = useLocation();
  const history = useHistory();
  const teamTaskDetailContext = useTeamTaskDetailContext();
  const locationState = location.state as ProfileDetailsLocationState;
  const isMountedRef = useRef(true);
  const fetchSequenceRef = useRef(0);

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const hasBackToListState = useMemo(
    () =>
      typeof locationState?.from === "string" &&
      locationState.from.trim().length > 0,
    [locationState],
  );
  const canNavigateToPreviousPage = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.history.length > 1;
  }, []);
  const backToListPath = useMemo(() => {
    if (!hasBackToListState) return PROFILE_LIST_PATH;
    return locationState?.from?.trim() || PROFILE_LIST_PATH;
  }, [hasBackToListState, locationState]);
  const navigateBackToList = useCallback(() => {
    if (hasBackToListState || canNavigateToPreviousPage) {
      history.goBack();
      return;
    }
    history.push(backToListPath);
  }, [backToListPath, canNavigateToPreviousPage, hasBackToListState, history]);
  const navigateBackToListAfterApprove = useCallback(() => {
    if (hasBackToListState || canNavigateToPreviousPage) {
      history.goBack();
      return;
    }
    history.replace(backToListPath);
  }, [backToListPath, canNavigateToPreviousPage, hasBackToListState, history]);

  const profileId = useMemo(() => {
    const idParam = searchParams.get("id");
    if (!idParam) return null;
    const parsed = Number(idParam);
    return Number.isNaN(parsed) ? null : parsed;
  }, [searchParams]);

  const applicationNo = useMemo(() => {
    const numParam = searchParams.get("applicationNo");
    if (!numParam) return null;
    return numParam;
  }, [searchParams]);

  const requestedUserTypeId = useMemo(() => {
    const userTypeIdParam = searchParams.get("userTypeId");
    if (!userTypeIdParam) return null;
    const parsed = Number(userTypeIdParam);
    return Number.isNaN(parsed) ? null : parsed;
  }, [searchParams]);

  const requestedView = useMemo<ViewType | null>(() => {
    const resolvedView = resolveProfileViewByUserTypeId(requestedUserTypeId);
    if (resolvedView) {
      return resolvedView;
    }

    return normalizeLegacyViewType(searchParams.get("type"));
  }, [requestedUserTypeId, searchParams]);

  const [currentView, setCurrentView] = useState<ViewType>(
    requestedView ?? "commercial",
  );
  const [personalData, setPersonalData] = useState<UserProfileInfoDto | null>(
    null,
  );
  const [establishmentData, setEstablishmentData] =
    useState<EstablishmentInfoDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [approveVisible, setApproveVisible] = useState(false);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      fetchSequenceRef.current += 1;
    };
  }, []);

  const canCommitRequest = useCallback((sequence: number) => {
    return isMountedRef.current && fetchSequenceRef.current === sequence;
  }, []);

  const fetchPersonalDetails = useCallback(async () => {
    if (profileId === null) return;
    const sequence = fetchSequenceRef.current + 1;
    fetchSequenceRef.current = sequence;
    setLoading(true);
    try {
      const rawResponse = await getUserProfilePersonal(profileId);
      if (!canCommitRequest(sequence)) return;

      const response = rawResponse as unknown as ApiResponse<
        ProfilePayloadWithRejectReason<UserProfileInfoDto>
      >;
      const personalPayload = response.data;
      setRejectReason(personalPayload?.rejectReason ?? "");

      if (!personalPayload) {
        message.error(t("Profile.details.messages.profileUnavailable"));
        history.replace(PROFILE_LIST_PATH);
        return;
      }
      setPersonalData(personalPayload);
      setEstablishmentData(null);
    } catch (error) {
      if (!canCommitRequest(sequence)) return;
      console.error("Failed to load individual profile details", error);
      message.error(t("Profile.details.messages.failedToLoadPersonalDetails"));
    } finally {
      if (canCommitRequest(sequence)) {
        setLoading(false);
      }
    }
  }, [canCommitRequest, history, profileId, t]);

  const fetchEstablishmentDetails = useCallback(async () => {
    if (profileId === null) return;
    const sequence = fetchSequenceRef.current + 1;
    fetchSequenceRef.current = sequence;
    setLoading(true);
    try {
      const rawResponse = await getUserProfileEstablishment(profileId);
      if (!canCommitRequest(sequence)) return;

      const response = rawResponse as unknown as ApiResponse<
        ProfilePayloadWithRejectReason<EstablishmentInfoDto>
      >;
      const establishmentPayload = response.data;
      setRejectReason(establishmentPayload?.rejectReason ?? "");

      if (!establishmentPayload) {
        message.error(t("Profile.details.messages.profileUnavailable"));
        history.replace(PROFILE_LIST_PATH);
        return;
      }

      setEstablishmentData(establishmentPayload);
      setPersonalData(null);
    } catch (error) {
      if (!canCommitRequest(sequence)) return;
      console.error("Failed to load establishment details", error);
      message.error(t("Profile.details.messages.failedToLoadProfileDetails"));
    } finally {
      if (canCommitRequest(sequence)) {
        setLoading(false);
      }
    }
  }, [canCommitRequest, history, profileId, t]);

  useEffect(() => {
    if (profileId === null) {
      message.error(t("Profile.details.messages.invalidProfileIdentifier"));
      history.replace(PROFILE_LIST_PATH);
      return;
    }

    if (requestedView === "individual") {
      fetchPersonalDetails();
      return;
    }

    fetchEstablishmentDetails();
  }, [
    fetchEstablishmentDetails,
    fetchPersonalDetails,
    history,
    profileId,
    requestedView,
    t,
  ]);

  const preferAr = isArabicLanguage(i18n.language);

  useEffect(() => {
    if (requestedUserTypeId !== null || requestedView) {
      setCurrentView(requestedView ?? "commercial");
    } else if (personalData?.userTypeObj) {
      setCurrentView(resolveViewFromUserType(personalData.userTypeObj));
    } else if (establishmentData) {
      setCurrentView(
        resolveEstablishmentProfileView(
          establishmentData.establishment,
          establishmentData.userTypeId,
        ),
      );
    }
  }, [requestedUserTypeId, requestedView, personalData, establishmentData]);

  const individualSummaryItems = useMemo<SummaryItem[]>(() => {
    const rawStatusName =
      personalData?.statusObj?.nameEn || personalData?.statusObj?.nameAr || "-";
    const statusName = getLocalizedStatusLabel(
      personalData?.statusObj,
      preferAr,
      t,
    );
    return [
      {
        key: "application",
        icon: BaseNum,
        label: t("Profile.details.summary.applicationNumber"),
        value: applicationNo ?? "-",
      },
      {
        key: "applicant",
        icon: ApplicantIcon,
        label: t("Profile.details.summary.applicant"),
        value: safeText(personalData?.applicant),
      },
      {
        key: "sla",
        icon: SLAIcon,
        label: t("Profile.details.summary.sla"),
        value: getSlaDisplayText(personalData?.sla?.displayText),
        valueClassName:
          personalData?.sla?.isOverdue === true ? "sla-overdue" : undefined,
      },
      {
        key: "status",
        icon: approvalIcon,
        label: t("Profile.details.summary.status"),
        value: safeText(statusName),
        tone: getStatusTone(rawStatusName),
      },
    ];
  }, [personalData, applicationNo, preferAr, t]);

  const organizationSummaryItems = useMemo<SummaryItem[]>(() => {
    const rawStatusName =
      establishmentData?.statusObj?.nameEn ||
      establishmentData?.statusObj?.nameAr ||
      personalData?.statusObj?.nameEn ||
      personalData?.statusObj?.nameAr ||
      "-";
    const statusName = getLocalizedStatusLabel(
      establishmentData?.statusObj || personalData?.statusObj,
      preferAr,
      t,
    );
    return [
      {
        key: "application",
        icon: BaseNum,
        label: t("Profile.details.summary.applicationNumber"),
        value: applicationNo ?? "-",
      },
      {
        key: "applicant",
        icon: ApplicantIcon,
        label: t("Profile.details.summary.applicant"),
        value: safeText(establishmentData?.applicant || personalData?.applicant),
      },
      {
        key: "sla",
        icon: SLAIcon,
        label: t("Profile.details.summary.sla"),
        value: getSlaDisplayText(
          establishmentData?.sla?.displayText || personalData?.sla?.displayText,
        ),
        valueClassName:
          establishmentData?.sla?.isOverdue === true ||
          personalData?.sla?.isOverdue === true
            ? "sla-overdue"
            : undefined,
      },
      {
        key: "status",
        icon: approvalIcon,
        label: t("Profile.details.summary.status"),
        value: safeText(statusName),
        tone: getStatusTone(rawStatusName),
      },
    ];
  }, [establishmentData, personalData, applicationNo, preferAr, t]);

  const individualApplicationTitle = useMemo((): string => {
    return t("Profile.details.summary.individualApplication");
  }, [t]);

  const establishmentApplicationTitle = useMemo((): string => {
    return getEstablishmentApplicationTitle(
      currentView,
      establishmentData,
      i18n.language,
      t,
    );
  }, [currentView, establishmentData, i18n.language, t]);

  const establishmentOverviewSectionTitle = useMemo((): string => {
    return getEstablishmentOverviewSectionTitle(currentView, establishmentData, t);
  }, [currentView, establishmentData, t]);

  const handleApprove = useCallback(async () => {
    if (profileId === null || actionLoading) return;
    let shouldNavigate = false;
    setActionLoading(true);
    try {
      await processUserProfile(profileId, { statusId: APPROVE_STATUS_ID });
      if (!isMountedRef.current) return;
      message.success(t("Profile.messages.approveSuccess"));
      setApproveVisible(false);
      shouldNavigate = true;
      navigateBackToListAfterApprove();
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error("Failed to approve application", error);
      message.error(t("Profile.messages.approveFailed"));
    } finally {
      if (isMountedRef.current && !shouldNavigate) {
        setActionLoading(false);
      }
    }
  }, [actionLoading, navigateBackToListAfterApprove, profileId, t]);

  const handleReject = useCallback(
    async (remarks: string) => {
      if (profileId === null || rejectLoading) return;
      setRejectLoading(true);
      try {
        await processUserProfile(profileId, {
          statusId: REJECT_STATUS_ID,
          remark: remarks,
        });
        if (!isMountedRef.current) return;
        message.success(t("Profile.messages.rejectSuccess"));
        setRejectVisible(false);
        if (currentView === "individual") {
          await fetchPersonalDetails();
        } else {
          await fetchEstablishmentDetails();
        }
      } catch (error) {
        if (!isMountedRef.current) return;
        console.error("Failed to reject application", error);
        message.error(t("Profile.messages.rejectFailed"));
      } finally {
        if (isMountedRef.current) {
          setRejectLoading(false);
        }
      }
    },
    [
      currentView,
      fetchEstablishmentDetails,
      fetchPersonalDetails,
      profileId,
      rejectLoading,
      t,
    ],
  );

  const currentStatusId =
    currentView === "individual"
      ? personalData?.statusId ?? null
      : establishmentData?.statusId ?? personalData?.statusId ?? null;

  const isRejected = currentStatusId === REJECT_STATUS_ID;
  const canProcess = currentStatusId === PENDING_PROCESS_STATUS_ID;
  const isActionDisabled =
    loading || actionLoading || rejectLoading || !canProcess;

  return (
    <div className="profile-details-page">
      <Spin spinning={loading}>
        <div className="details-content">
          {currentView === "individual" ? (
            <IndividualProfileDetails
              data={personalData}
              summaryItems={individualSummaryItems}
              applicationTitle={individualApplicationTitle}
              showRejectReason={isRejected}
              rejectReason={rejectReason}
              preferAr={preferAr}
              t={t}
            />
          ) : (
            <OrganizationProfileDetails
              data={establishmentData}
              viewType={currentView}
              summaryItems={organizationSummaryItems}
              applicationTitle={establishmentApplicationTitle}
              establishmentOverviewTitle={establishmentOverviewSectionTitle}
              showRejectReason={isRejected}
              rejectReason={rejectReason}
              preferAr={preferAr}
              t={t}
              i18n={i18n}
              partnerDetailsPermissionCode={PARTNER_DETAILS_PERMISSION_CODE}
              partnerDetailsPermissionRoutePath={PROFILE_DETAILS_PATH}
            />
          )}
        </div>
      </Spin>

      {(teamTaskDetailContext.shouldHideDefaultActions || canProcess) && (
        <div className="details-footer detail-action-footer">
        <div>
          <CustomButton
            text={t("Profile.details.buttons.back")}
            variant="outline"
            onClick={navigateBackToList}
            disabled={loading}
          />
        </div>
        <div className="footer-inner">
          {teamTaskDetailContext.shouldHideDefaultActions ? (
            <div className="footer-actions">
              <TeamTaskDetailReassignAction />
            </div>
          ) : canProcess ? (
            <div className="footer-actions">
              <CustomButton
                text={t("Profile.details.buttons.reject")}
                variant="danger"
                onClick={() => setRejectVisible(true)}
                disabled={isActionDisabled}
              />
              <CustomButton
                text={t("Profile.details.buttons.approve")}
                variant="primary"
                onClick={() => setApproveVisible(true)}
                disabled={isActionDisabled}
              />
            </div>
          ) : null}
        </div>
        </div>
      )}

      <ConfirmModal
        visible={approveVisible}
        type="success"
        title={t("Profile.details.modal.approveApplication")}
        content={t("Profile.details.modal.approveConfirm")}
        cancelText={t("Profile.details.modal.cancel")}
        confirmText={t("Profile.details.modal.confirm")}
        onCancel={() => setApproveVisible(false)}
        onConfirm={handleApprove}
        loading={actionLoading}
      />
      <RejectModal
        visible={rejectVisible}
        initialRemarks=""
        onCancel={() => setRejectVisible(false)}
        onConfirm={handleReject}
        loading={rejectLoading}
      />
    </div>
  );
};

export default ProfileDetailsPage;
