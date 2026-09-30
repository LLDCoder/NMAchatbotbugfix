import React, { useState, useEffect, useRef } from "react";
import { Modal } from "antd";
import {
  CustomButton,
  CustomFooter,
  CustomMessage,
  FooterActionButtons,
  type FooterActionItem,
} from "@/components/common";
import { useHistory, useLocation } from "react-router-dom";
import {
  applicationMyReviewDetail,
  extraTaskApprovalAction,
  type IApplicationDeliveryInfo,
} from "@/services/application";
import { useAppStore } from "@/store/app-store";
import { disableLicensingApplicationActionStatusIds } from "../Applications/constants";
import type { IRejectModalRef } from "../Applications/components/RejectModal/type";
import type { IFieldType as RejectFieldValues } from "../Applications/components/RejectModal/type";
import type { IRequestModalRef } from "../Applications/components/RequestModal/type";
import { RejectModal } from "../Applications/components/RejectModal";
import { RequestModal } from "../Applications/components/RequestModal";
import {
  getEstablishment,
  getUserIndividual,
  type IEstablishmentOverview,
  type IUserIndividualProfile,
} from "@/services/userProfile";
import { ApproveModal } from "../Applications/components/ApproveModal";
import type { IApproveModalRef } from "../Applications/components/ApproveModal/type";
import type { IFieldType as ApproveFieldValues } from "../Applications/components/ApproveModal/type";
import type { ISendBackModalRef } from "@/pages/ContentApplications/components/SendBackModal/type";
import { SendBackModal } from "@/pages/ContentApplications/components/SendBackModal";
import { DispositionDecisionModal } from "../Applications/components/DispositionDecisionModal";
import type { IDispositionDecisionModalRef } from "../Applications/components/DispositionDecisionModal/type";
import { MediaMaterialReportModal } from "../Applications/components/MediaMaterialReportModal";
import type { IMediaMaterialReportModalRef } from "../Applications/components/MediaMaterialReportModal/type";
import {
  resolveApplicationWorkflowAction,
  type WorkflowActionIntent,
} from "../Applications/utils/workflowActionRouting";
import DataCard from "./DataCard";
import MainContent from "./MainContent";
import "./index.less";
import { useTranslation } from "react-i18next";
import { ExternalApprovalModal } from "../ContentApplications/components/ExternalApprovalModal";
import { useButtonPermission } from "@/routes/access";
import type { ITimeline } from "@/services/content";
import {
  TeamTaskDetailReassignAction,
  useTeamTaskDetailContext,
} from "@/pages/TeamManagement/components/TeamTaskDetailReassignAction";

import type {
  IExternalApprovalRef,
  IFieldType as ExternalApprovalFieldValues,
} from "../ContentApplications/components/ExternalApprovalModal/type";
import RecallApprovalModal from "./components/RecallApprovalModal";
import { useRecallApproval } from "./hooks/useRecallApproval";
import { PERMISSION_CODES } from "@/constants/permissionCodes";
import { useFahrReviewDetails } from "./hooks/useFahrReviewDetails";
import { isFahrExternalApprovalService } from "./fahrServiceCodes";
import {
  FahrReviewOperationError,
  getFahrExternalApprovalEligibility,
  submitFahrExternalReviewDecision,
  type FahrExternalReviewDecisionPayload,
} from "@/services/fahr";
import {
  getFahrRejectReasonFile,
  getFahrExternalDecisionDisabledReason,
  resolveFahrExternalApprovalRoute,
  resolveFahrExternalDecisionRoute,
} from "@/services/fahrPolicy";
import WarningGold from "@/assets/icons/WarningGold";
import {
  resolveActiveTaskDeliveryInformation,
  resolveApplicationDeliveryInformation,
} from "./DeliveryInformation/viewModel";

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error("Failed to parse application details payload:", error);
    return fallback;
  }
}

type ApplicationsDetailsProps = {
  readOnly?: boolean;
};

const FOOTER_PERMISSION_ROUTE = "/licensing/applications/applicationsDetails";
const FOOTER_HIDDEN_STATUSES = [
  "Rejected",
  "Completed",
  "Cancelled",
  "Pending Modification",
  "Pending Payment",
];
const ApplicationsDetails: React.FC<ApplicationsDetailsProps> = ({
  readOnly = false,
}) => {
  const { t } = useTranslation();
  const { canRenderButton } = useButtonPermission(FOOTER_PERMISSION_ROUTE);
  const externalApprovalModalRef = useRef<IExternalApprovalRef>(null);
  const fahrExternalApprovalSubmittingRef = useRef(false);
  const completedFahrExternalApprovalKeyRef = useRef<string | null>(null);

  const [timeLineList, setTimeLineList] = useState<ITimeline[]>([]);
  const [details, setDetails] = useState<any>({});
  const [deliveryInfoState, setDeliveryInfoState] = useState<{
    taskId: string;
    data: IApplicationDeliveryInfo | null;
  } | null>(null);
  const [isFahrDecisionFlow, setIsFahrDecisionFlow] = useState(false);
  const [FormilyList, setFormilyList] = useState<any>([]);
  const resetApplicationsDetails = useAppStore(
    (state) => state.resetApplicationsDetails,
  );
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const rejectModalRef = useRef<IRejectModalRef>(null);
  const requestModalRef = useRef<IRequestModalRef>(null);
  const approveModalRef = useRef<IApproveModalRef>(null);
  const dispositionDecisionModalRef =
    useRef<IDispositionDecisionModalRef>(null);
  const mediaMaterialReportModalRef =
    useRef<IMediaMaterialReportModalRef>(null);
  const sendBackModalRef = useRef<ISendBackModalRef>(null);
  const workflowRefreshTimerRef = useRef<number | null>(null);
  const workflowRefreshSequenceRef = useRef(0);
  const detailRequestSequenceRef = useRef(0);
  const taskId = searchParams.get("taskId");
  const deliveryInfo = resolveActiveTaskDeliveryInformation(
    deliveryInfoState,
    taskId,
  );
  const activeTab = searchParams.get("activeTab");
  const effectiveReadOnly =
    readOnly ||
    searchParams.get("readOnly") === "1" ||
    searchParams.get("sourcePage") === "tickets";
  const [establishment, setEstablishment] = useState<IEstablishmentOverview>();
  const [applicant, setApplicant] = useState<IUserIndividualProfile>();
  const [isFahrExternalApprovalFlow, setIsFahrExternalApprovalFlow] =
    useState(false);
  const history = useHistory();
  const teamTaskDetailContext = useTeamTaskDetailContext();
  const getDetails = async () => {
    const requestSequence = ++detailRequestSequenceRef.current;
    if (!taskId) return;
    const requestedTaskId = taskId;

    try {
      const res = await applicationMyReviewDetail(requestedTaskId);
      if (requestSequence !== detailRequestSequenceRef.current) {
        return;
      }
      setTimeLineList(
        Array.isArray(res.data?.applicationTimeline)
          ? res.data.applicationTimeline
          : [],
      );
      setDetails(res.data?.detail || {});
      setDeliveryInfoState({
        taskId: requestedTaskId,
        data: resolveApplicationDeliveryInformation(res.data),
      });
      setFormilyList(safeJsonParse(res.data?.formData, []));

      const serviceId = res.data?.detail?.serviceId;
      if (serviceId !== undefined && serviceId !== null) {
        localStorage.setItem("serviceID", String(serviceId));
      }
    } catch (error) {
      if (requestSequence !== detailRequestSequenceRef.current) {
        return;
      }
      console.error("Failed to load application review detail:", error);
      setTimeLineList([]);
      setDetails({});
      setDeliveryInfoState({ taskId: requestedTaskId, data: null });
      setFormilyList([]);
    }
  };
  const replaceTaskIdIfChanged = (nextTaskId?: string | null) => {
    const normalizedNextTaskId =
      typeof nextTaskId === "string" ? nextTaskId.trim() : "";
    const normalizedCurrentTaskId = taskId?.trim() || "";

    if (
      !normalizedNextTaskId ||
      normalizedNextTaskId === normalizedCurrentTaskId
    ) {
      return false;
    }

    workflowRefreshSequenceRef.current += 1;
    detailRequestSequenceRef.current += 1;
    if (workflowRefreshTimerRef.current !== null) {
      window.clearTimeout(workflowRefreshTimerRef.current);
      workflowRefreshTimerRef.current = null;
    }

    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.set("taskId", normalizedNextTaskId);
    history.replace({
      pathname: location.pathname,
      search: nextSearchParams.toString(),
      hash: location.hash,
    });
    return true;
  };
  const refreshDetailsAfterWorkflowAction = async () => {
    const refreshSequence = ++workflowRefreshSequenceRef.current;

    if (workflowRefreshTimerRef.current !== null) {
      window.clearTimeout(workflowRefreshTimerRef.current);
      workflowRefreshTimerRef.current = null;
    }

    await getDetails();

    if (refreshSequence !== workflowRefreshSequenceRef.current) {
      return;
    }
    workflowRefreshTimerRef.current = window.setTimeout(() => {
      workflowRefreshTimerRef.current = null;
      void getDetails();
    }, 500);
  };
  const handleWorkflowActionSuccess = async (nextTaskId?: string | null) => {
    if (replaceTaskIdIfChanged(nextTaskId)) {
      return;
    }

    await refreshDetailsAfterWorkflowAction();
  };
  const applicationId =
    Number.isFinite(Number(details?.id)) && Number(details?.id) > 0
      ? Number(details.id)
      : undefined;
  const isFahrService = isFahrExternalApprovalService(details?.serviceCode);
  const isFahrEnabled = isFahrService;
  const {
    reviewDetails: fahrReviewDetails,
    readiness: fahrReadiness,
    readinessLoading: fahrReadinessLoading,
    eligibilityLoaded: fahrEligibilityLoaded,
    isFahrRequired,
    loadFahrReviewDetails,
    loadFahrReadiness,
  } = useFahrReviewDetails({
    applicationId,
    enabled: isFahrEnabled,
    readinessEnabled: details?.statusId == 11,
  });
  const isFahrFlowEnabled = isFahrEnabled && isFahrRequired;
  useEffect(() => {
    setIsFahrDecisionFlow(false);
  }, [applicationId, details?.taskId]);
  const recallApproval = useRecallApproval({
    applicationId,
    readOnly: effectiveReadOnly,
    onSuccess: (newTaskId) => {
      const nextTaskId = newTaskId || taskId;
      if (!nextTaskId) return;

      window.location.replace(
        `${location.pathname}?taskId=${encodeURIComponent(
          nextTaskId,
        )}&activeTab=1`,
      );
    },
  });
  const getEstablishmentDetails = async () => {
    try {
      const res = await getEstablishment(details?.profileId);
      setEstablishment(res?.data || {});
    } catch (error) {}
  };

  const getApplicantDetails = async () => {
    try {
      const res = await getUserIndividual(details?.userId);
      setApplicant(res?.data || {});
    } catch (error) {}
  };

  useEffect(() => {
    if (details?.profileId && details?.userTypeId !== 1) {
      getEstablishmentDetails();
    }
  }, [details]);

  useEffect(() => {
    if (details?.userId) {
      getApplicantDetails();
    }
  }, [details]);

  useEffect(() => {
    if (taskId) {
      getDetails();
    }
    return () => {
      workflowRefreshSequenceRef.current += 1;
      detailRequestSequenceRef.current += 1;
      if (workflowRefreshTimerRef.current !== null) {
        window.clearTimeout(workflowRefreshTimerRef.current);
        workflowRefreshTimerRef.current = null;
      }
      resetApplicationsDetails();
    };
  }, [taskId, resetApplicationsDetails]);

  const btnsAuth = safeJsonParse<Record<string, any>>(
    details?.buttonJson,
    {},
  ) as Record<string, any>;

  const handleWorkflowAction = (intent: WorkflowActionIntent) => {
    const resolved = resolveApplicationWorkflowAction(details, intent);

    switch (resolved.route) {
      case "mediaMaterialReportModal":
        mediaMaterialReportModalRef.current?.show(intent);
        break;
      case "dispositionApproveModal":
        dispositionDecisionModalRef.current?.show("approve");
        break;
      case "dispositionRejectModal":
        dispositionDecisionModalRef.current?.show("reject");
        break;
      case "approveApplicationModal":
        approveModalRef.current?.show();
        break;
      case "rejectApplicationModal":
      default:
        rejectModalRef.current?.show();
        break;
    }
  };
  const isExtraApprove = details?.statusId == 11;
  const handleFahrDecisionClick = async (intent: WorkflowActionIntent) => {
    setIsFahrDecisionFlow(false);
    if (isExtraApprove && isFahrEnabled) {
      try {
        const readinessResult = await loadFahrReadiness();
        if (!readinessResult) return;

        const eligibility = readinessResult.eligibility;
        const route = resolveFahrExternalDecisionRoute(
          eligibility,
          readinessResult.readiness,
          intent,
        );
        if (route === "workflow") {
          handleWorkflowAction(intent);
          return;
        }
        if (route === "blocked") {
          const disabledReason = getFahrExternalDecisionDisabledReason(
            readinessResult.readiness,
          );
          CustomMessage.error(
            disabledReason ||
              t("Licensing.fahrReview.messages.externalDecisionFailed"),
          );
          return;
        }
        setIsFahrDecisionFlow(true);
      } catch (error) {
        console.error("Failed to load FAHR review readiness:", error);
        CustomMessage.error(
          t("Licensing.fahrReview.messages.externalDecisionFailed"),
        );
        return;
      }
    }
    handleWorkflowAction(intent);
  };
  const handleFahrExternalApprovalAfterConfirm = async (
    _values?: ExternalApprovalFieldValues,
    nextTaskId?: string | null,
  ): Promise<void> => {
    const normalizedNextTaskId =
      typeof nextTaskId === "string" ? nextTaskId.trim() : "";
    if (normalizedNextTaskId && normalizedNextTaskId !== taskId?.trim()) {
      return;
    }

    const fahrLoadResult = await loadFahrReviewDetails();
    if (fahrLoadResult === "failed") {
      throw new FahrReviewOperationError();
    }
    await getDetails();
  };
  const handleFahrExternalApproval = async () => {
    if (!applicationId) return;
    if (fahrExternalApprovalSubmittingRef.current) return;
    setIsFahrExternalApprovalFlow(false);
    if (!isFahrService) {
      externalApprovalModalRef.current?.show();
      return;
    }
    const workflowKey = `${details.id}:${details.taskId}:externalApproval`;
    fahrExternalApprovalSubmittingRef.current = true;
    try {
      if (completedFahrExternalApprovalKeyRef.current !== workflowKey) {
        const response = await getFahrExternalApprovalEligibility(
          applicationId,
        );
        const route = resolveFahrExternalApprovalRoute(true, response.data);
        if (route === "legacyDialog" || route === "fahrDialog") {
          setIsFahrExternalApprovalFlow(route === "fahrDialog");
          externalApprovalModalRef.current?.show();
          return;
        }
        if (route === "blocked") {
          CustomMessage.error(
            t("Licensing.fahrReview.messages.externalDecisionFailed"),
          );
          return;
        }

        await new Promise<void>((resolve) => {
          Modal.confirm({
            title: t("Licensing.fahrReview.confirm.applyTitle"),
            content: t("Licensing.fahrReview.confirm.applyContent"),
            icon: (
              <WarningGold className="fahr-external-approval-confirm__icon" />
            ),
            okText: t("common.confirm"),
            cancelText: t("common.cancel"),
            width: 600,
            centered: true,
            className: "fahr-external-approval-confirm",
            onOk: async () => {
              try {
                const approvalResponse = await extraTaskApprovalAction({
                  serviceId: details.serviceId,
                  applicationId: details.id,
                  applicationDetailId: details.applicationDetailId,
                  instanceId: details.processInstanceId,
                  taskId: details.taskId,
                  approvalAction: "ExternalApproval",
                  workflowAction: 300,
                });
                completedFahrExternalApprovalKeyRef.current = workflowKey;
                CustomMessage.success(
                  t("Licensing.fahrReview.messages.actionSuccess"),
                );
                if (
                  replaceTaskIdIfChanged(approvalResponse?.data?.nextTaskId)
                ) {
                  resolve();
                  return;
                }
                try {
                  await handleFahrExternalApprovalAfterConfirm();
                } catch (refreshError) {
                  console.error(
                    "Failed to refresh FAHR external approval:",
                    refreshError,
                  );
                  CustomMessage.error(
                    t("Licensing.fahrReview.messages.recordsLoadFailed"),
                  );
                }
                resolve();
              } catch (error) {
                console.error("Failed to apply FAHR external approval:", error);
                CustomMessage.error(
                  t("Licensing.fahrReview.messages.externalDecisionFailed"),
                );
                resolve();
                throw error;
              }
            },
            onCancel: () => resolve(),
          });
        });
        return;
      }
      try {
        await handleFahrExternalApprovalAfterConfirm();
      } catch (refreshError) {
        console.error(
          "Failed to refresh FAHR external approval:",
          refreshError,
        );
        CustomMessage.error(
          t("Licensing.fahrReview.messages.recordsLoadFailed"),
        );
      }
    } catch (error) {
      console.error("Failed to enter FAHR external approval:", error);
      CustomMessage.error(
        t("Licensing.fahrReview.messages.externalDecisionFailed"),
      );
    } finally {
      fahrExternalApprovalSubmittingRef.current = false;
    }
  };
  const submitFahrReviewDecision = async (
    payload: FahrExternalReviewDecisionPayload,
  ) => {
    if (!isFahrService || !isFahrDecisionFlow || !applicationId) {
      CustomMessage.error(
        t("Licensing.fahrReview.messages.invalidApplicationId"),
      );
      throw new FahrReviewOperationError();
    }

    const response = await submitFahrExternalReviewDecision(
      applicationId,
      payload,
    );
    if (!response.data?.success) {
      throw new FahrReviewOperationError();
    }
  };
  const handleFahrExternalApprove = async (values: ApproveFieldValues) => {
    await submitFahrReviewDecision({
      decision: "Approved",
      reason: values.notes,
    });
    CustomMessage.success(
      t("Licensing.fahrReview.messages.externalDecisionSuccess"),
    );
  };
  const handleFahrExternalReject = async (values: RejectFieldValues) => {
    await submitFahrReviewDecision({
      decision: "Rejected",
      reason: values.approvalComment,
      rejectReasonCode: values.rejectReason,
      rejectReasonFile: getFahrRejectReasonFile(values.rejectReasonFile),
      hideFromCustomer: Boolean(values.hideFromCustomer),
    });
    CustomMessage.success(
      t("Licensing.fahrReview.messages.externalDecisionSuccess"),
    );
  };
  const footerActions: FooterActionItem[] = [
    {
      key: "reject",
      label: isExtraApprove
        ? t("applications.buttons.extrareject")
        : t("applications.buttons.reject"),
      visible:
        Boolean(btnsAuth?.reject) &&
        canRenderButton("Licensing.Applications.ApplicationDetails.Reject"),
      variant: "outline",
      customClassName: "reject-btn",
      disabled:
        isExtraApprove &&
        isFahrService &&
        (!fahrEligibilityLoaded ||
          fahrReadinessLoading ||
          (isFahrRequired && fahrReadiness?.externalReviewAction !== "Reject")),
      permissionCode: "Licensing.Applications.ApplicationDetails.Reject",
      onClick: () => void handleFahrDecisionClick("reject"),
    },
    {
      key: "requestModification",
      label: t("applications.buttons.requestModification"),
      visible:
        Boolean(btnsAuth?.requestModification) &&
        !isExtraApprove &&
        canRenderButton(
          "Licensing.Applications.ApplicationDetails.RequestModification",
        ),
      variant: "outline",
      permissionCode:
        "Licensing.Applications.ApplicationDetails.RequestModification",
      onClick: () => requestModalRef?.current?.show(),
    },
    {
      key: "sendBack",
      label: t("applications.buttons.sendBack"),
      visible:
        Boolean(btnsAuth?.sendBack) &&
        !isExtraApprove &&
        canRenderButton(PERMISSION_CODES.licensing.applications.sendBack),
      variant: "outline",
      permissionCode: PERMISSION_CODES.licensing.applications.sendBack,
      onClick: () => sendBackModalRef?.current?.show(),
    },
    {
      key: "approve",
      label: isExtraApprove
        ? t("applications.buttons.extraapprove")
        : t("applications.buttons.approve"),
      visible:
        Boolean(btnsAuth?.approve) &&
        canRenderButton("Licensing.Applications.ApplicationDetails.Approve"),
      variant: "primary",
      disabled:
        details?.status === "Completed" ||
        (isExtraApprove &&
          isFahrService &&
          (!fahrEligibilityLoaded ||
            fahrReadinessLoading ||
            (isFahrRequired &&
              fahrReadiness?.externalReviewAction !== "Approve"))),
      permissionCode: "Licensing.Applications.ApplicationDetails.Approve",
      onClick: () => void handleFahrDecisionClick("approve"),
    },
    {
      key: "externalApproval",
      label: t("applications.buttons.externalApproval"),
      visible:
        Boolean(btnsAuth?.externalApproval) &&
        !isExtraApprove &&
        (!isFahrService || (fahrEligibilityLoaded && !isFahrRequired)) &&
        canRenderButton(
          PERMISSION_CODES.licensing.applications.externalApproval,
        ),
      variant: "primary",
      permissionCode: PERMISSION_CODES.licensing.applications.externalApproval,
      onClick: () => void handleFahrExternalApproval(),
    },
  ];
  const defaultFooterRightContent =
    !effectiveReadOnly &&
    activeTab !== "2" &&
    !disableLicensingApplicationActionStatusIds.includes(
      Number(details?.statusId),
    ) &&
    !FOOTER_HIDDEN_STATUSES.includes(details?.status ?? "") ? (
      <FooterActionButtons
        actions={footerActions}
        permissionRoutePath={FOOTER_PERMISSION_ROUTE}
      />
    ) : null;

  return (
    <div className="applications-details">
      <DataCard details={details} activeTab={activeTab} />

      <MainContent
        FormilyList={FormilyList}
        timeLineList={timeLineList}
        deliveryInfo={deliveryInfo}
        establishment={establishment}
        applicant={applicant}
        userProfileId={details?.userProfileId ?? details?.profileId}
        applicationId={details?.id}
        currentApplicationNumber={details?.applicationNumber}
        currentServiceId={details?.serviceId}
        currentServiceCode={details?.serviceCode}
        fahrReviewDetails={fahrReviewDetails}
        fahrEnabled={isFahrFlowEnabled}
        onFahrReviewChanged={
          isFahrFlowEnabled ? () => loadFahrReviewDetails() : undefined
        }
      />

      <CustomFooter
        rightContent={
          !effectiveReadOnly && recallApproval.buttonVisible ? (
            <CustomButton
              text={t("applications.buttons.recallApproval")}
              variant="danger-outline"
              customClassName="recall-approval-btn"
              onClick={recallApproval.openModal}
            />
          ) : teamTaskDetailContext.shouldHideDefaultActions ? (
            <TeamTaskDetailReassignAction />
          ) : (
            defaultFooterRightContent
          )
        }
      />
      {!effectiveReadOnly && (
        <>
          <RecallApprovalModal
            visible={recallApproval.modalVisible}
            loading={recallApproval.submitting}
            onCancel={recallApproval.closeModal}
            onConfirm={recallApproval.submit}
          />
          <RejectModal
            current={details}
            ref={rejectModalRef}
            onOkCb={async (nextTaskId) => {
              if (replaceTaskIdIfChanged(nextTaskId)) return;
              await refreshDetailsAfterWorkflowAction();
              if (isFahrDecisionFlow) await loadFahrReviewDetails();
            }}
            onExternalReject={
              isFahrDecisionFlow ? handleFahrExternalReject : undefined
            }
            confirmPermissionCode="Licensing.Applications.ApplicationDetails.Reject"
            permissionRoutePath="/licensing/applications/applicationsDetails"
          />
          <RequestModal
            current={details}
            ref={requestModalRef}
            onOkCb={handleWorkflowActionSuccess}
            confirmPermissionCode="Licensing.Applications.ApplicationDetails.RequestModification"
            permissionRoutePath="/licensing/applications/applicationsDetails"
          />
          <ApproveModal
            current={details}
            ref={approveModalRef}
            onOkCb={async (nextTaskId) => {
              if (replaceTaskIdIfChanged(nextTaskId)) return;
              await refreshDetailsAfterWorkflowAction();
              history.push("/licensing/applications");
            }}
            onExternalApprove={
              isFahrDecisionFlow ? handleFahrExternalApprove : undefined
            }
            confirmPermissionCode="Licensing.Applications.ApplicationDetails.Approve"
            permissionRoutePath="/licensing/applications/applicationsDetails"
          />
          <MediaMaterialReportModal
            current={details}
            ref={mediaMaterialReportModalRef}
            onOkCb={handleWorkflowActionSuccess}
            confirmPermissionCode={(intent: WorkflowActionIntent) =>
              intent === "approve"
                ? "Licensing.Applications.ApplicationDetails.Approve"
                : "Licensing.Applications.ApplicationDetails.Reject"
            }
            permissionRoutePath="/licensing/applications/applicationsDetails"
          />
          <DispositionDecisionModal
            current={details}
            ref={dispositionDecisionModalRef}
            onOkCb={refreshDetailsAfterWorkflowAction}
            confirmPermissionCode={(intent: WorkflowActionIntent) =>
              intent === "approve"
                ? "Licensing.Applications.ApplicationDetails.Approve"
                : "Licensing.Applications.ApplicationDetails.Reject"
            }
            permissionRoutePath="/licensing/applications/applicationsDetails"
          />
          <SendBackModal
            current={details}
            ref={sendBackModalRef}
            onOkCb={() => {
              getDetails();
              history.push("/licensing/applications");
            }}
            confirmPermissionCode={
              PERMISSION_CODES.licensing.applications.sendBack
            }
            permissionRoutePath="/licensing/applications/applicationsDetails"
          />
          <ExternalApprovalModal
            current={details}
            ref={externalApprovalModalRef}
            onOkCb={(nextTaskId) => {
              if (replaceTaskIdIfChanged(nextTaskId)) return;
              history.goBack();
            }}
            onAfterConfirm={
              isFahrExternalApprovalFlow
                ? handleFahrExternalApprovalAfterConfirm
                : undefined
            }
            type={1}
            confirmPermissionCode={
              PERMISSION_CODES.licensing.applications.externalApproval
            }
            permissionRoutePath="/licensing/applications/applicationsDetails"
          />
        </>
      )}
    </div>
  );
};

export default ApplicationsDetails;
