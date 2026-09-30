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
import { useTranslation } from "react-i18next"
import FullScreen from "@/components/common/ApplicationOverviewCards/FullScreen/FullScreen"
import ServiceFees from "./components/ServiceFees"
import { useHistory, useLocation } from "react-router-dom"
import { useCallback, useEffect, useMemo, useState } from "react"
import DisableLicenseModal from "../Licenses/components/DisableLicenseModal"
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
import LicenseDownloadPasswordModal from "../Licenses/components/LicenseDownloadPasswordModal"

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
  const location = useLocation<{ licenseNumber?: string }>()
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  )
  const code = searchParams.get("code") || ""
  const [modal, contextHolder] = Modal.useModal()
  const [disableVisible, setDisableVisible] = useState(false)
  const [rowData, setRowData] = useState({} as Partial<LicenseManagementListResponseDto>)
  const [detailsData, setDetailsData] = useState<Partial<LicenseDetail>>({})

  const [documnetVisible, setDocumnetVisible] = useState(false)

  const localizedLicenseTitle = useMemo(() => {
    if (i18n.resolvedLanguage === "ar") {
      return detailsData?.licenseTypeAr || detailsData?.licenseType || ""
    }

    return detailsData?.licenseType || detailsData?.licenseTypeAr || ""
  }, [
    detailsData?.licenseType,
    detailsData?.licenseTypeAr,
    i18n.language,
  ])

  const loadLicenseDetail = useCallback(() => {
    if (!code) {
      return
    }

    getLicenseManagementDetails(code).then((res) => {
      if (res.data) {
        setDetailsData(res.data)
        setRowData({
          id: res.data?.id,
        })
      }
    })
  }, [code])

  useEffect(() => {
    loadLicenseDetail()
  }, [loadLicenseDetail])

  const OverviewContent: React.FC = () => {
    const { profileAndApplicantData } =
      useApplicationOverviewData()
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
        <div className="license-details-fullscreen-shell">
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
          <h3>{t("Licensing.details.licenseDetails")}</h3>
          <ServiceFees historyData={detailsData?.applicationHistory} t={t} />
        </div>
        <div className="details-box_right license-details-overview">
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
          {localizedLicenseTitle}
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
              <div className="_label">{t("Licensing.details.licenseNumber")}</div>
              <div className="_value">
                {location.state?.licenseNumber ||
                  detailsData?.showLicenseNumber ||
                  detailsData?.licenseNumber}
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
              <div className="_label">{t("Licensing.details.issuanceDate")}</div>
              <div className="_value">
                {detailsData?.issuanceDate
                  ? moment(detailsData.issuanceDate).format("DD/MM/YYYY")
                  : ""}
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
              <div className="_label">{t("Licensing.details.effectiveDate")}</div>
              <div className="_value">
                {detailsData?.effectiveDate
                  ? moment(detailsData.effectiveDate).format("DD/MM/YYYY")
                  : ""}
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
              <div className="_label">{t("Licensing.details.expiryDate")}</div>
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
              <div className="_label">{t("Licensing.details.daysRemaining")}</div>
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
            text={t("Licensing.details.back")}
            onClick={() => {
              history.go(-1)
            }}
          />
        </div>
        <div className="license-details__footer-actions">
          <CustomButton
            variant="outline"
            text={t("Licensing.details.download")}
            onClick={() => {
              setDocumnetVisible(true)
            }}
          />
          {detailsData.status === "201" && (
            <CustomButton
              customClassName="_danger-line"
              variant="outline"
              text={t("Licensing.details.disable")}
              onClick={() => {
                setDisableVisible(true)
              }}
              permissionCode="Licensing.Licenses.LicenseDatails.Disable"
              permissionRoutePath="/licensing/license/LicenseDatails"
            />
          )}
          {detailsData.status === "204" && (
            <CustomButton
              variant="outline"
              text={t("Licensing.details.enable")}
              onClick={() => {
                modal.confirm({
                  centered: true,
                  className: "enable-license",
                  title: <div>{t("Licensing.details.enableLicense")}</div>,
                  content: (
                    <div>{t("Licensing.details.enableConfirm")}</div>
                  ),
                  okText: t("Licensing.details.confirm"),
                  onOk: async () => {
                    if (!detailsData.id) {
                      CustomMessage.error(t("Licensing.details.licenseIdMissing"))
                      return
                    }
                    try {
                      const res = await postUpdateCertificateStatus({
                        certificateId: detailsData.id,
                        status: "201",
                      })
                      if (res.data) {
                        loadLicenseDetail()
                        CustomMessage.success(t("Licensing.details.enableSuccess"))
                      } else {
                        CustomMessage.error(t("Licensing.details.enableFailed"))
                      }
                    } catch {
                      CustomMessage.error(t("Licensing.details.enableFailed"))
                    }
                  },
                })
              }}
              permissionCode="Licensing.Licenses.LicenseDatails.Enable"
              permissionRoutePath="/licensing/license/LicenseDatails"
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
          loadLicenseDetail()
        }}
        row={rowData as LicenseManagementListResponseDto}
        confirmPermissionCode="Licensing.Licenses.LicenseDatails.Disable"
        permissionRoutePath="/licensing/license/LicenseDatails"
      />
      <LicenseDownloadPasswordModal
        visible={documnetVisible}
        fileName={
          i18n.resolvedLanguage === "ar"
            ? detailsData.licenseTypeAr || detailsData.licenseType || ""
            : detailsData.licenseType || detailsData.licenseTypeAr || ""
        }
        url={detailsData.certificateUrl ?? ""}
        password={detailsData.certificatePassword ?? ""}
        cancle={() => {
          setDocumnetVisible(false)
        }}
      />
    </div>
  )
}
