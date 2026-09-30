import { Card, Modal } from "antd"
import {
  ApplicationOverviewCards,
  ApplicationOverviewDataProvider,
  type ApplicationOverviewProfileData,
  CustomButton,
  CustomMessage,
  useApplicationOverviewFullScreenController,
  useApplicationOverviewData,
} from "@/components/common"
import FullScreen from "@/components/common/ApplicationOverviewCards/FullScreen/FullScreen"
import ServiceFees from "./components/ServiceFees"
import { useHistory } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"
import DisableLicenseModal from "../Licenses/components/DisableLicenseModal"
import { urlParsing } from "@/utils/history"
import {
  getLicenseManagementDetails,
  postUpdateCertificateStatus,
  type LicenseDetail,
  type LicenseManagementListResponseDto,
} from "@/services/license"
import {
  getEstablishment,
  getUserIndividual,
  type IEstablishmentOverview,
  type IUserIndividualProfile,
} from "@/services/userProfile"
import {
  hasExplicitUserTypeId,
  isIndividualUserType,
} from "@/components/common/ApplicationOverviewCards/utils/userType"
import "./index.less"
import moment from "moment"
import { DISPLAY_DATE, fmt } from "@/utils/gstTime"
import licenseDatails1 from "@/assets/images/licenseDatails1.svg"
import licenseDatails2 from "@/assets/images/licenseDatails2.svg"
import licenseDatails5 from "@/assets/images/licenseDatails5.svg"
import CustomStatusTag from "@/components/common/CustomStatusTag"
import DocumentDown from "../Licenses/components/DocumentDown"
import { useTranslation } from "react-i18next"

/** Portal account id for GetUserIndividual: prefer detail payload, fall back to profileAndApplicant data. */
function readPortalUserId(
  detail: Partial<LicenseDetail>,
  profile: ApplicationOverviewProfileData | null,
): string | undefined {
  const fromDetail = detail?.userId
  if (fromDetail != null && String(fromDetail).trim() !== "") {
    return String(fromDetail)
  }
  const p = profile as { userId?: string | number } | null | undefined
  if (p?.userId != null && String(p.userId).trim() !== "") {
    return String(p.userId)
  }
  return undefined
}

export default function LicenseDetails() {
  const { t, i18n } = useTranslation()
  const history = useHistory()
  const [modal, contextHolder] = Modal.useModal()
  const [disableVisible, setDisableVisible] = useState(false as boolean)
  const [rowData, setRowData] = useState({} as Partial<LicenseManagementListResponseDto>)
  const [detailsData, setDetailsData] = useState<Partial<LicenseDetail>>({})
  const [documnetVisible, setDocumnetVisible] = useState(false)

  const localizedPermitTitle = useMemo(() => {
    if (i18n.resolvedLanguage === "ar") {
      return (
        detailsData?.licenseTypeAr ||
        detailsData?.licenseType ||
        t("Content.permitsDetails.title")
      )
    }
    return (
      detailsData?.licenseType ||
      detailsData?.licenseTypeAr ||
      t("Content.permitsDetails.title")
    )
  }, [
    detailsData?.licenseType,
    detailsData?.licenseTypeAr,
    i18n.resolvedLanguage,
    t,
  ])

  const getDetails = () => {
    const local = urlParsing(history.location.search)
    getLicenseManagementDetails(local.code).then((res) => {
      if (res.data) {
        setDetailsData(res.data)
        setRowData({
          id: res.data?.id,
        })
      }
    })
  }
  useEffect(() => {
    getDetails()
  }, [])

  const OverviewContent: React.FC = () => {
    const { profileAndApplicantData } = useApplicationOverviewData()
    const overviewFullScreen = useApplicationOverviewFullScreenController()
    const [establishment, setEstablishment] = useState<IEstablishmentOverview>()
    const [applicant, setApplicant] = useState<IUserIndividualProfile>()
    const portalUserId = useMemo(
      () => readPortalUserId(detailsData, profileAndApplicantData),
      [detailsData, profileAndApplicantData],
    )

    useEffect(() => {
      const loadEstablishment = async () => {
        try {
          if (
            detailsData.profileId &&
            hasExplicitUserTypeId(detailsData.userTypeId) &&
            !isIndividualUserType(detailsData.userTypeId)
          ) {
            const res = await getEstablishment(detailsData.profileId)
            setEstablishment(res?.data)
            return
          }
          setEstablishment(undefined)
        } catch {
          setEstablishment(undefined)
        }
      }
      void loadEstablishment()
    }, [detailsData.profileId, detailsData.userTypeId])

    useEffect(() => {
      const loadApplicant = async () => {
        if (!portalUserId) {
          setApplicant(undefined)
          return
        }
        try {
          const res = await getUserIndividual(portalUserId)
          setApplicant(res?.data)
        } catch {
          setApplicant(undefined)
        }
      }
      void loadApplicant()
    }, [portalUserId])

    if (overviewFullScreen.isFullScreen) {
      return (
        <div className="permits-details-fullscreen-shell">
          <FullScreen
            type={overviewFullScreen.fullScreenType}
            applicant={applicant}
            establishment={establishment}
            userId={portalUserId}
            userProfileId={detailsData?.userProfileId ?? detailsData?.profileId}
            profileId={detailsData.profileId}
            {...overviewFullScreen.fullScreenProps}
          />
        </div>
      )
    }

    return (
      <div className="details-box">
        <div className="details-box_left">
          <h3>{t("Content.permitsDetails.licenseDetails")}</h3>
          <ServiceFees historyData={detailsData?.applicationHistory} />
        </div>
        <div className="details-box_right permits-details-overview">
          <ApplicationOverviewCards
            profileOverviewDefaultExpanded
            {...overviewFullScreen.applicationOverviewCardProps}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="license-details">
      <Card className="service-name-card">
        <h3>
          {localizedPermitTitle}
          {detailsData.status && (
            <CustomStatusTag
              type="licenseStatus"
              status={Number(detailsData.status)}
            />
          )}
        </h3>
        <div className="base-info_grid">
          <div className="info-card">
            <div className="_img">
              <img
                style={{ width: 20, height: 20 }}
                src={licenseDatails1}
                alt=""
              />
            </div>
            <div>
              <div className="_label">{t("Content.permitsDetails.baseInfo.licenseNumber")}</div>
              <div className="_value">{detailsData?.licenseNumber || "-"}</div>
            </div>
          </div>
          <div className="info-card">
            <div className="_img">
              <img
                style={{ width: 20, height: 20 }}
                src={licenseDatails2}
                alt=""
              />
            </div>
            <div>
              <div className="_label">{t("Content.permitsDetails.baseInfo.issuanceDate")}</div>
              <div className="_value">
                {moment(detailsData?.issuanceDate).format("DD/MM/YYYY")}
              </div>
            </div>
          </div>
          <div className="info-card">
            <div className="_img">
              <img
                style={{ width: 20, height: 20 }}
                src={licenseDatails2}
                alt=""
              />
            </div>
            <div>
              <div className="_label">{t("Content.permitsDetails.baseInfo.effectiveDate")}</div>
              <div className="_value">
                {moment(detailsData?.effectiveDate).format("DD/MM/YYYY")}
              </div>
            </div>
          </div>
          <div className="info-card">
            <div className="_img">
              <img
                style={{ width: 20, height: 20 }}
                src={licenseDatails2}
                alt=""
              />
            </div>
            <div>
              <div className="_label">{t("Content.permitsDetails.baseInfo.expiryDate")}</div>
              <div className="_value">
                {fmt(detailsData?.expiryDate, DISPLAY_DATE)}
              </div>
            </div>
          </div>
          <div className="info-card">
            <div className="_img">
              <img
                style={{ width: 20, height: 20 }}
                src={licenseDatails5}
                alt=""
              />
            </div>
            <div>
              <div className="_label">{t("Content.permitsDetails.baseInfo.daysRemaining")}</div>
              <div className="_value">
                {detailsData?.daysRemaining == null
                  ? "-"
                  : detailsData.daysRemaining}
              </div>
            </div>
          </div>
        </div>
      </Card>
      <ApplicationOverviewDataProvider
        userProfileId={detailsData?.userProfileId ?? detailsData?.profileId}
      >
        <OverviewContent />
      </ApplicationOverviewDataProvider>
      <div className="_white-space"></div>
      <div className="form-footer detail-action-footer">
        <div className="license-details__footer-back">
          <CustomButton
            variant="outline"
            text={t("common.back")}
            onClick={() => {
              history.go(-1)
            }}
          />
        </div>
        <div className="license-details__footer-actions">
          <CustomButton
            variant="outline"
            text={t("common.download")}
            onClick={() => {
              setDocumnetVisible(true)
            }}
          />
          {detailsData.status === "201" && (
            <CustomButton
              customClassName="_danger-line"
              variant="outline"
              text={t("Content.permits.actions.disable")}
              onClick={() => {
                setDisableVisible(true)
              }}
              permissionCode="Content.Permits.PermitsDetails.Disable"
              permissionRoutePath="/content/Permits/PermitsDetails"
            />
          )}
          {detailsData.status === "204" && (
            <CustomButton
              variant="outline"
              text={t("Content.permits.actions.enable")}
              onClick={() => {
                modal.confirm({
                  centered: true,
                  className: "enable-license",
                  title: <div>{t("Content.permits.modals.enableTitle")}</div>,
                  content: (
                    <div>{t("Content.permits.modals.enableConfirm")}</div>
                  ),
                  okText: t("common.confirm"),
                  onOk: async () => {
                    if (!detailsData.id) {
                      CustomMessage.error(t("Content.permits.messages.licenseIdMissing"));
                      return;
                    }
                    try {
                      const res = await postUpdateCertificateStatus({
                        certificateId: detailsData.id,
                        status: "201",
                      });
                      if (res.data) {
                        getDetails();
                        CustomMessage.success(t("Content.permits.messages.enableSuccess"));
                      } else {
                        CustomMessage.error(t("Content.permits.messages.enableFailed"));
                      }
                    } catch {
                      CustomMessage.error(t("Content.permits.messages.enableFailed"));
                    }
                  },
                });
              }}
              permissionCode="Content.Permits.PermitsDetails.Enable"
              permissionRoutePath="/content/Permits/PermitsDetails"
            />
          )}
        </div>
      </div>
      {contextHolder}
      <DisableLicenseModal
        visible={disableVisible}
        cencelFun={() => {
          setDisableVisible(false)
        }}
        onOk={() => {
          setDisableVisible(false)
          getDetails()
        }}
        row={rowData as LicenseManagementListResponseDto}
        confirmPermissionCode="Content.Permits.PermitsDetails.Disable"
        permissionRoutePath="/content/Permits/PermitsDetails"
      />
      <DocumentDown
        visible={documnetVisible}
        fileName={detailsData.licenseType ?? ""}
        url={detailsData.certificateUrl ?? ""}
        password={detailsData.certificatePassword ?? ""}
        cancle={() => {
          setDocumnetVisible(false)
        }}
      />
    </div>
  )
}
