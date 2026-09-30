import TicketNumber from "@/assets/images/ticket-number.png";
import TicketDetailStatus from "@/assets/images/ticket-detail-status.png";
import IssueCategory from "@/assets/images/issue-category.png";
import Type from "@/assets/images/type.png";
import Sla from "@/assets/images/sla.png";
import Submission from "@/assets/images/submission.png";
import "./index.less";
import BasicInfo from "./components/BasicInfo";
import CommunicationRecords from "./components/CommunicationRecords";
import ApplicantInformation from "./components/ApplicantInformation";
// import ApplicantOverview from "@/components/common/ApplicationOverviewCards/ApplicantOverview";
import EstablishmentOverview from "@/pages/TicketsDetails/components/EstablishmentOverview";
import type {
  IExpandContext,
  TWhichExpanded,
} from "@/pages/ContentApplicationsDetails/type";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import { useLocation } from "react-router-dom";
import TicketTimeline from "./components/TicketTimeline";
import {
  getCachedEnquiryTypes,
  getEnquiryInfo,
  getUserInfo,
  type IEnquiryCustomerInfo,
  type IEnquiryInfoResponse,
  type IEnquiryType,
  type IUserInfoResponse,
} from "@/services/tickets";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import { useTranslation } from "react-i18next";
import moment from "moment";
import {
  CustomButton,
  CustomFooter,
  PermissionGuard,
} from "@/components/common";
import ChangeStatusModal from "@/pages/Tickets/components/ChangeStatusModal";
// import TransferModal from "@/pages/Tickets/components/TransferModal";
import SendBackModal from "@/pages/Tickets/components/SendBackModal";
import ProcessModal from "@/pages/Tickets/components/ProcessModal";
import { ReassignTaskModal } from "../Tickets/components/TeamTasks/ReassignTaskModal";
import {
  ApplicationOverviewCards,
  ApplicationOverviewDataProvider,
  type ApplicationOverviewProfileData,
  useApplicationOverviewFullScreenController,
  useApplicationOverviewData,
} from "@/components/common";
import FullScreen from "@/components/common/ApplicationOverviewCards/FullScreen/FullScreen";
import {
  hasExplicitUserTypeId,
  isIndividualUserType,
} from "@/components/common/ApplicationOverviewCards/utils/userType";
import {
  getEstablishment,
  getUserIndividual,
  type IEstablishmentOverview,
  type IUserIndividualProfile,
} from "@/services/userProfile";
import {
  createContactNumberSnapshot,
  getContactNumberDisplay,
} from "@/components/common/MobileNumberInput";

import type { IReassignTaskModalRef } from "../Tickets/components/TeamTasks/ReassignTaskModal/type";
import {
  TeamTaskDetailReassignAction,
  useTeamTaskDetailContext,
} from "@/pages/TeamManagement/components/TeamTaskDetailReassignAction";
import {
  canShowDepartmentProcessActions,
  canShowTeamTaskReassignAction,
} from "@/pages/Tickets/utils/ticketVisibility";

export const ExpandContext = React.createContext<IExpandContext | null>(null);

const hasMeaningfulValue = (value: unknown): boolean => {
  if (typeof value === "string") {
    return value.trim() !== "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return value !== undefined && value !== null;
};

const toPositiveNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : undefined;
};

const toApplicantOverviewDataOverride = (
  enquiryCustomerInfo?: IEnquiryCustomerInfo | null,
): ApplicationOverviewProfileData | undefined => {
  if (!enquiryCustomerInfo) {
    return undefined;
  }

  const {
    id,
    fullName,
    email,
    mobileNumber,
    mobileCountryCode,
    mobileLocalNumber,
  } = enquiryCustomerInfo;
  const mobileDisplay = getContactNumberDisplay(
    createContactNumberSnapshot({
      countryCode: mobileCountryCode,
      localNumber: mobileLocalNumber,
      fullNumber: mobileNumber,
    }),
  );
  const hasDisplayValue =
    hasMeaningfulValue(fullName) ||
    hasMeaningfulValue(email) ||
    hasMeaningfulValue(mobileDisplay);

  if (!hasDisplayValue) {
    return undefined;
  }

  const normalizedUserId =
    typeof id === "string" || typeof id === "number" ? id : undefined;

  return {
    userId: normalizedUserId,
    userName: fullName ?? undefined,
    userEmail: email ?? undefined,
    phoneNumber: mobileDisplay || undefined,
    personalName: fullName ?? undefined,
    personalEmail: email ?? undefined,
    personalPhoneNumber: mobileDisplay || undefined,
  };
};

const getProfileAndApplicantPhoneDisplay = (
  data?: ApplicationOverviewProfileData | null,
): string | undefined => {
  if (!data) {
    return undefined;
  }

  const phoneDisplay = getContactNumberDisplay(
    createContactNumberSnapshot({
      countryCode: data.phoneCountryCode,
      localNumber: data.phoneLocalNumber,
      fullNumber: data.phoneNumber,
    }),
  );

  return phoneDisplay || data.personalPhoneNumber || undefined;
};

const RELATED_ENQUIRY_SOURCE = "ApplicationOverviewRelatedEnquiries";

interface DepartmentProcessActionsProps {
  enquiryInfo: IEnquiryInfoResponse;
  userInfo: IUserInfoResponse;
  onSave: () => void;
}

const DepartmentProcessActions: React.FC<DepartmentProcessActionsProps> = ({
  enquiryInfo,
  userInfo,
  onSave,
}) => {
  const { t } = useTranslation();
  const [sendBackModalVisible, setSendBackModalVisible] = useState(false);
  const [processModalVisible, setProcessModalVisible] = useState(false);
  const showActions = canShowDepartmentProcessActions({
    enquiryStatusId: enquiryInfo.enquiryStatusId,
    isCustomerHappiness: userInfo.isCustomerHappness,
    reopenTimes: enquiryInfo.reopenTimes,
    isCurrentHandler: enquiryInfo.isCurrentHandler,
    requireCurrentHandler: true,
  });

  return (
    <>
      <SendBackModal
        row={enquiryInfo}
        visible={sendBackModalVisible}
        onCancel={() => setSendBackModalVisible(false)}
        onSave={onSave}
      />
      <ProcessModal
        row={enquiryInfo}
        visible={processModalVisible}
        onCancel={() => setProcessModalVisible(false)}
        onSave={onSave}
      />
      {showActions && (
        <>
          <PermissionGuard
            permissionCode="CustomerModule.Tickets.ConfirmSendBackModal"
            routePath="/happiness/tickets"
          >
            <CustomButton
              variant="outline"
              customClassName="tickets-details-send-back-btn"
              text={t("Customer.tickets.actions.sendBack")}
              onClick={() => setSendBackModalVisible(true)}
            />
          </PermissionGuard>
          <PermissionGuard
            permissionCode="CustomerModule.Tickets.ConfirmProcessModal"
            routePath="/happiness/tickets"
          >
            <CustomButton
              text={t("Customer.tickets.actions.process")}
              onClick={() => setProcessModalVisible(true)}
              permissionCode="CustomerModule.Tickets.Process"
              permissionRoutePath="/happiness/tickets"
            />
          </PermissionGuard>
        </>
      )}
    </>
  );
};

interface TicketsDetailsContentProps {
  enquiryInfo: IEnquiryInfoResponse;
  userInfo: IUserInfoResponse;
  whichIsExpanded: TWhichExpanded;
  appOverviewProfileId?: number;
  enquiryCustomerOverviewData?: ApplicationOverviewProfileData;
  resolvedOverviewProfileId?: number;
  isCommunicationExpanded: boolean;
  onCommunicationExpand: () => void;
  onCommunicationCollapse: () => void;
  scrollToInputRequest: number;
  onRefresh: () => void;
}

const TicketsDetailsContent: React.FC<TicketsDetailsContentProps> = ({
  enquiryInfo,
  userInfo,
  whichIsExpanded,
  appOverviewProfileId,
  enquiryCustomerOverviewData,
  resolvedOverviewProfileId,
  isCommunicationExpanded,
  onCommunicationExpand,
  onCommunicationCollapse,
  scrollToInputRequest,
  onRefresh,
}) => {
  const {
    profileAndApplicantData,
    applicationOverviewRelatedProfileType,
    applicationOverviewRelatedSectionData,
  } = useApplicationOverviewData();
  const overviewFullScreen = useApplicationOverviewFullScreenController();
  const [establishment, setEstablishment] =
    useState<IEstablishmentOverview>();
  const [applicant, setApplicant] = useState<IUserIndividualProfile>();
  const applicantOverviewDataOverride = appOverviewProfileId
    ? undefined
    : enquiryCustomerOverviewData;
  const applicantPhoneNumberOverride = useMemo(
    () => getProfileAndApplicantPhoneDisplay(profileAndApplicantData),
    [profileAndApplicantData],
  );

  useEffect(() => {
    let active = true;
    const profileId = resolvedOverviewProfileId;
    const userTypeId = enquiryInfo?.curstomerUserObj?.userTypeId;
    const shouldLoadCommercialProfile =
      applicationOverviewRelatedProfileType === "Commercial" ||
      (hasExplicitUserTypeId(userTypeId) &&
        !isIndividualUserType(userTypeId));

    if (!profileId || !shouldLoadCommercialProfile) {
      setEstablishment(undefined);
      return () => {
        active = false;
      };
    }

    void getEstablishment(profileId)
      .then((res: { data?: IEstablishmentOverview }) => {
        if (!active) return;
        setEstablishment(res?.data ?? ({} as IEstablishmentOverview));
      })
      .catch(() => {
        if (!active) return;
        setEstablishment(undefined);
      });

    return () => {
      active = false;
    };
  }, [
    applicationOverviewRelatedProfileType,
    enquiryInfo?.curstomerUserObj?.userTypeId,
    resolvedOverviewProfileId,
  ]);

  useEffect(() => {
    let active = true;

    if (!enquiryInfo?.userId) {
      setApplicant(undefined);
      return () => {
        active = false;
      };
    }

    void getUserIndividual(enquiryInfo.userId)
      .then((res: { data?: IUserIndividualProfile }) => {
        if (!active) return;
        setApplicant(res?.data ?? ({} as IUserIndividualProfile));
      })
      .catch(() => {
        if (!active) return;
        setApplicant(undefined);
      });

    return () => {
      active = false;
    };
  }, [enquiryInfo?.userId]);

  if (overviewFullScreen.isFullScreen) {
    return (
      <div className="tickets-details__fullscreen-wrap">
        <div className="tickets-details__target-overview-fullscreen">
          <FullScreen
            type={overviewFullScreen.fullScreenType}
            applicant={applicant}
            establishment={establishment}
            {...overviewFullScreen.fullScreenProps}
            visualVariant="figmaOverview"
          />
        </div>
      </div>
    );
  }
  if (whichIsExpanded?.establishment) {
    return (
      <div className="collapse-content">
        <EstablishmentOverview
          details={{
            profileId: enquiryInfo.userProfileId,
          }}
        />
      </div>
    );
  }
  if (whichIsExpanded?.applicantInformation) {
    return (
      <div className="collapse-content">
        <ApplicantInformation />
      </div>
    );
  }

  return (
    <div className="tickets-details-content">
      <div className="tickets-details-content-left">
        <BasicInfo details={enquiryInfo} />
        <CommunicationRecords
          isCustomerHappness={userInfo?.isCustomerHappness}
          status={enquiryInfo?.enquiryStatusId}
          refresh={onRefresh}
          records={enquiryInfo?.enquiryConversations || []}
          isExpanded={isCommunicationExpanded}
          onExpand={onCommunicationExpand}
          onCollapse={onCommunicationCollapse}
          isCanMessage={enquiryInfo?.isCanMessage}
          canAddInternalNote={enquiryInfo?.canAddInternalNote}
          scrollToInputRequest={scrollToInputRequest}
        />
      </div>
      <div className="tickets-details-content-right">
        <ApplicationOverviewCards
          profileOverviewDefaultExpanded
          additionalCards={
            <TicketTimeline enquiryStatusId={enquiryInfo?.enquiryStatusId} />
          }
          {...overviewFullScreen.applicationOverviewCardProps}
          applicantOverviewDataOverride={applicantOverviewDataOverride}
          applicantPhoneNumberOverride={applicantPhoneNumberOverride}
          enquiryInfo={enquiryInfo}
          applicationOverviewRelatedSectionData={
            applicationOverviewRelatedSectionData ?? undefined
          }
          currentEnquiryNumber={enquiryInfo?.enquiryNumber}
          isTicketApplicationOverviewExpanded={false}
          onTicketApplicationOverviewShrink={
            overviewFullScreen.closeFullScreen
          }
        />
      </div>
    </div>
  );
};

interface TicketsDetailsPageProps {
  enquiryId: string | null;
  isTeamTaskTodo: boolean;
  isFromRelatedEnquiry: boolean;
}

function TicketsDetailsPage({
  enquiryId,
  isTeamTaskTodo,
  isFromRelatedEnquiry,
}: TicketsDetailsPageProps) {
  const [whichIsExpanded, setWhichIsExpanded] = useState<TWhichExpanded>({});
  const teamTaskDetailContext = useTeamTaskDetailContext();
  const { i18n, t } = useTranslation();
  const [pageData, setPageData] = useState<{
    enquiryInfo: IEnquiryInfoResponse;
    userInfo: IUserInfoResponse;
  }>({
    enquiryInfo: {} as IEnquiryInfoResponse,
    userInfo: {} as IUserInfoResponse,
  });
  const { enquiryInfo, userInfo } = pageData;
  const [changeStatusModalVisible, setChangeStatusModalVisible] =
    useState(false);
  // const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [enquiryTypes, setEnquiryTypes] = useState<IEnquiryType[]>([]);
  const [isCommunicationExpanded, setIsCommunicationExpanded] = useState(false);
  const [scrollToInputRequest, setScrollToInputRequest] = useState(0);
  const reAssignTaskModalRef = useRef<IReassignTaskModalRef>(null);
  const enquiryInfoRequestIdRef = useRef(0);
  const initialPageLoadCompletedRef = useRef(false);
  const dispatch = useCallback((whichToCollapse: TWhichExpanded) => {
    setWhichIsExpanded(whichToCollapse);
  }, []);

  const queryEnquiryInfo = useCallback(() => {
    if (!enquiryId || !initialPageLoadCompletedRef.current) return;

    const requestId = enquiryInfoRequestIdRef.current + 1;
    enquiryInfoRequestIdRef.current = requestId;

    void getEnquiryInfo(enquiryId)
      .then((res) => {
        if (requestId !== enquiryInfoRequestIdRef.current) return;

        setPageData((current) => ({
          ...current,
          enquiryInfo: res?.data ?? ({} as IEnquiryInfoResponse),
        }));
      })
      .catch(() => undefined);
  }, [enquiryId]);

  useEffect(() => {
    let active = true;
    const requestId = enquiryInfoRequestIdRef.current + 1;
    enquiryInfoRequestIdRef.current = requestId;

    void Promise.all([
      enquiryId
        ? getEnquiryInfo(enquiryId).catch(() => null)
        : Promise.resolve(null),
      getUserInfo().catch(() => null),
    ]).then(([enquiryRes, userRes]) => {
      if (!active || requestId !== enquiryInfoRequestIdRef.current) return;

      initialPageLoadCompletedRef.current = true;
      setPageData({
        enquiryInfo: enquiryRes?.data ?? ({} as IEnquiryInfoResponse),
        userInfo: userRes?.data ?? ({} as IUserInfoResponse),
      });
    });

    return () => {
      active = false;
      enquiryInfoRequestIdRef.current += 1;
    };
  }, [enquiryId]);

  useEffect(() => {
    let active = true;

    void getCachedEnquiryTypes()
      .then((types) => {
        if (!active) {
          return;
        }

        setEnquiryTypes(Array.isArray(types) ? types : []);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setEnquiryTypes([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const canShowChangeStatusSection =
    [1, 2, 4].includes(enquiryInfo.enquiryStatusId) &&
    userInfo.isCustomerHappness;
  const shouldShowChangeStatusButton =
    canShowChangeStatusSection &&
    (!isFromRelatedEnquiry || enquiryInfo?.isCurrentHandler === true);
  const canShowDepartmentActions = canShowDepartmentProcessActions({
    enquiryStatusId: enquiryInfo.enquiryStatusId,
    isCustomerHappiness: userInfo.isCustomerHappness,
    reopenTimes: enquiryInfo.reopenTimes,
    isCurrentHandler: enquiryInfo.isCurrentHandler,
    requireCurrentHandler: true,
  });
  const canShowTeamTaskReassign = canShowTeamTaskReassignAction({
    enquiryStatusId: enquiryInfo.enquiryStatusId,
    isLeader: userInfo.isLeader,
    isTeamTaskTodo,
  });
  const enquiryCustomerOverviewData = useMemo(
    () => toApplicantOverviewDataOverride(enquiryInfo?.enquiryCustomerInfo),
    [enquiryInfo?.enquiryCustomerInfo],
  );
  const appOverviewProfileId = useMemo(
    () => toPositiveNumber(enquiryInfo?.appUserProfileId),
    [enquiryInfo?.appUserProfileId],
  );
  const fallbackOverviewProfileId = useMemo(
    () => toPositiveNumber(enquiryInfo?.userProfileId),
    [enquiryInfo?.userProfileId],
  );
  const resolvedOverviewProfileId = useMemo(() => {
    if (appOverviewProfileId) {
      return appOverviewProfileId;
    }

    if (enquiryCustomerOverviewData) {
      return undefined;
    }

    return fallbackOverviewProfileId;
  }, [
    appOverviewProfileId,
    enquiryCustomerOverviewData,
    fallbackOverviewProfileId,
  ]);

  return (
    <div className="tickets-details">
      <div className="tickets-details-hender-box">
        <div className="tickets-details-tag">
          <div>
            {enquiryInfo?.platformObj
              ? t("Customer.ticketsDetails.header.fromPlatform", {
                  platform: enquiryInfo.platformObj.nameEn,
                })
              : "-"}
          </div>
        </div>
        <div className="tickets-details-header-scroll">
          <div className="tickets-details-header">
            <div className="tickets-details-header-item tickets-details-header-item--ticket-number">
              <div className="tickets-details-header-icon">
                <img src={TicketNumber} />
              </div>
              <div className="tickets-details-header-content">
                <div className="tickets-details-header-field">
                  {t("Customer.ticketsDetails.header.ticketNumber")}
                </div>
                <div className="tickets-details-header-value">
                  {enquiryInfo?.enquiryNumber ? enquiryInfo?.enquiryNumber : "-"}
                </div>
              </div>
            </div>
            <div className="tickets-details-header-item tickets-details-header-item--compact">
              <div className="tickets-details-header-icon">
                <img src={Type} />
              </div>
              <div className="tickets-details-header-content">
                <div className="tickets-details-header-field">
                  {t("Customer.ticketsDetails.header.type")}
                </div>
                <div className="tickets-details-header-value">
                  {i18n.resolvedLanguage === "ar"
                    ? enquiryInfo?.enquiryTypeObj?.nameAr
                      ? enquiryInfo?.enquiryTypeObj?.nameAr
                      : "-"
                    : enquiryInfo?.enquiryTypeObj?.nameEn
                    ? enquiryInfo?.enquiryTypeObj?.nameEn
                    : "-"}
                </div>
              </div>
            </div>
            <div className="tickets-details-header-item tickets-details-header-item--compact">
              <div className="tickets-details-header-icon">
                <img src={IssueCategory} />
              </div>
              <div className="tickets-details-header-content">
                <div className="tickets-details-header-field">
                  {t("Customer.ticketsDetails.header.priority")}
                </div>
                <div className="tickets-details-header-value">
                  {i18n.resolvedLanguage === "ar"
                    ? enquiryInfo?.priorityObj?.nameAr
                      ? enquiryInfo?.priorityObj?.nameAr
                      : "-"
                    : enquiryInfo?.priorityObj?.nameEn
                    ? enquiryInfo?.priorityObj?.nameEn
                    : "-"}
                </div>
              </div>
            </div>
            <div className="tickets-details-header-item tickets-details-header-item--compact">
              <div className="tickets-details-header-icon">
                <img src={Sla} />
              </div>
              <div className="tickets-details-header-content">
                <div className="tickets-details-header-field">
                  {t("Customer.ticketsDetails.header.sla")}
                </div>
                <div
                  className={`tickets-details-header-value ${
                    enquiryInfo?.isOverDue ? "tickets-details-header-value--overdue" : ""
                  }`}
                >
                  {enquiryInfo?.sla ? enquiryInfo?.sla : "-"}
                </div>
              </div>
            </div>
            <div className="tickets-details-header-item tickets-details-header-item--status">
              <div className="tickets-details-header-icon">
                <img src={TicketDetailStatus} alt="" />
              </div>
              <div className="tickets-details-header-content">
                <div className="tickets-details-header-field">
                  {t("Customer.ticketsDetails.header.status")}
                </div>
                <div className="tickets-details-header-value">
                  <CustomStatusTag
                    type="enquiryStatus"
                    status={enquiryInfo?.enquiryStatusId}
                  />
                </div>
              </div>
            </div>
            <div className="tickets-details-header-item tickets-details-header-item--last-updated">
              <div className="tickets-details-header-icon">
                <img src={Submission} />
              </div>
              <div className="tickets-details-header-content">
                <div className="tickets-details-header-field">
                  {t("Customer.tickets.table.lastUpdated")}
                </div>
                <div className="tickets-details-header-value">
                  {enquiryInfo?.updatedOn
                    ? moment(enquiryInfo?.updatedOn).format("DD/MM/YYYY HH:mm:ss")
                    : "-"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ExpandContext.Provider
        value={{
          whichIsExpanded,
          dispatch,
        }}
      >
        <ApplicationOverviewDataProvider
          userProfileId={resolvedOverviewProfileId}
          enquiryId={enquiryInfo?.id}
        >
          <TicketsDetailsContent
            enquiryInfo={enquiryInfo}
            userInfo={userInfo}
            whichIsExpanded={whichIsExpanded}
            appOverviewProfileId={appOverviewProfileId}
            enquiryCustomerOverviewData={enquiryCustomerOverviewData}
            resolvedOverviewProfileId={resolvedOverviewProfileId}
            isCommunicationExpanded={isCommunicationExpanded}
            onCommunicationExpand={() => {
              setIsCommunicationExpanded(true);
              setScrollToInputRequest((request) => request + 1);
            }}
            onCommunicationCollapse={() => {
              setIsCommunicationExpanded(false);
            }}
            scrollToInputRequest={scrollToInputRequest}
            onRefresh={queryEnquiryInfo}
          />
        </ApplicationOverviewDataProvider>
      </ExpandContext.Provider>
      {teamTaskDetailContext.shouldHideDefaultActions ? (
        <CustomFooter
          rightContent={<TeamTaskDetailReassignAction />}
          onBack={() => window.history.go(-1)}
        />
      ) : canShowTeamTaskReassign ? (
        <CustomFooter
          onBack={() => window.history.go(-1)}
          rightContent={
            <>
              <PermissionGuard
                permissionCode="CustomerModule.Tickets.ConfirmReassignTaskModal"
                routePath="/happiness/tickets"
              >
                <CustomButton
                  onClick={(e: React.MouseEvent<HTMLElement>) => {
                    e.stopPropagation();
                    reAssignTaskModalRef.current?.show();
                  }}
                  text={t("Customer.tickets.actions.reassign")}
                  permissionCode="CustomerModule.Tickets.Reassign"
                  permissionRoutePath="/happiness/tickets"
                />
              </PermissionGuard>
              <ReassignTaskModal
                id={enquiryInfo.id}
                onOkCb={() => {
                  queryEnquiryInfo();
                }}
                ref={reAssignTaskModalRef}
              />
            </>
          }
        />
      ) : ![5, 6, 7].includes(enquiryInfo.enquiryStatusId) &&
        (shouldShowChangeStatusButton || canShowDepartmentActions) ? (
        <CustomFooter
          onBack={() => window.history.go(-1)}
          rightContent={
            <div className="tickets-details-right-btn">
              <ChangeStatusModal
                enquiryTypes={enquiryTypes}
                onSave={queryEnquiryInfo}
                row={{
                  id: enquiryInfo.id,
                  enquiryTypeId: enquiryInfo.enquiryTypeId,
                  priorityId: enquiryInfo.priorityId ?? 0,
                  slaEndTime: enquiryInfo.slaEndTime,
                  enquiryStatusId:enquiryInfo.enquiryStatusId
                }}
                visible={changeStatusModalVisible}
                onCancel={() => setChangeStatusModalVisible(false)}
              />
              {shouldShowChangeStatusButton && (
                <>
                  <div>
                    <span className="ticket-status-text">
                      {t("Customer.ticketsDetails.ticketStatus")}:
                    </span>{" "}
                    <span className="ticket-status-value">
                      {i18n.resolvedLanguage === "ar"
                        ? enquiryInfo?.enquiryStatusObj?.nameAr
                          ? enquiryInfo?.enquiryStatusObj?.nameAr
                          : "-"
                        : enquiryInfo?.enquiryStatusObj?.nameEn
                        ? enquiryInfo?.enquiryStatusObj?.nameEn
                        : "-"}
                    </span>
                  </div>
                  <PermissionGuard
                    permissionCode="CustomerModule.Tickets.Confirm"
                    routePath="/happiness/tickets"
                  >
                    <CustomButton
                      text={t("Customer.tickets.actions.changeStatus")}
                      onClick={() => setChangeStatusModalVisible(true)}
                      permissionCode="CustomerModule.Tickets.ChangeStatus"
                      permissionRoutePath="/happiness/tickets"
                    />
                  </PermissionGuard>
                </>
              )}
              {/* <TransferModal onSave={queryEnquiryInfo} row={enquiryInfo} visible={transferModalVisible} onCancel={()=>setTransferModalVisible(false)} /> */}
              {/* {enquiryInfo?.enquiryStatusId === 3 && !userInfo.isCustomerHappness && <CustomButton text={t("Customer.tickets.actions.transfer")} onClick={() => setTransferModalVisible(true)} />} */}
              <DepartmentProcessActions
                enquiryInfo={enquiryInfo}
                userInfo={userInfo}
                onSave={queryEnquiryInfo}
              />
            </div>
          }
        />
      ) : (
        <CustomFooter
          rightContent={<></>}
          onBack={() => window.history.go(-1)}
        />
      )}
    </div>
  );
}

export default function TicketsDetails() {
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);
  const enquiryId = urlParams.get("id");
  const source = urlParams.get("from");

  return (
    <TicketsDetailsPage
      key={`${enquiryId ?? "tickets-details"}:${source ?? ""}`}
      enquiryId={enquiryId}
      isTeamTaskTodo={source === "TeamTasks-todo"}
      isFromRelatedEnquiry={source === RELATED_ENQUIRY_SOURCE}
    />
  );
}
