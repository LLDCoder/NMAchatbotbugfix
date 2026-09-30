import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchOutlined } from "@ant-design/icons";
import { Card, Empty, Input, Modal } from "antd";
import { useTranslation } from "react-i18next";
import moment from "moment";
import CustomButton from "@/components/common/CustomButton";
import CustomMessage from "@/components/common/CustomMessage";
import DocumentViewer from "@/components/common/DocumentViewer";
import ProfileIDIcon from "@/assets/images/number.svg";
import PartnerCountryFlagIcon from "@/assets/images/partner-country-flag.svg";
import JigouIcon from "@/assets/images/jigou.svg";
import AvatarIcon from "@/assets/images/Avatar.svg";
import YonghuIcon from "@/assets/images/yonghu.svg";
import { getPartnerById, type IPartnerInfo } from "@/services/userManagement";
import type { PartnerItem } from "../OrganizationProfileDetails/type";
import "./index.less";

const translationBase = "sharedComponents.partnerList";

interface ProfilePartnerListProps {
  params: PartnerItem[];
  detailsPermissionCode?: string;
  detailsPermissionRoutePath?: string;
}

interface PartnerCardProps {
  item: PartnerItem;
  detailsPermissionCode?: string;
  detailsPermissionRoutePath?: string;
  getCachedDetails: (id: number) => IPartnerInfo | undefined;
  setCachedDetails: (id: number, details: IPartnerInfo) => void;
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function safeText(value: unknown): string {
  return normalizeText(value) || "-";
}


function getLocalizedText(
  nameEn: unknown,
  nameAr: unknown,
  isArabic: boolean,
  fallback?: unknown,
): string {
  const primary = normalizeText(isArabic ? nameAr : nameEn);
  const secondary = normalizeText(isArabic ? nameEn : nameAr);
  return primary || secondary || normalizeText(fallback) || "-";
}

function formatDate(value?: string | null): string {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return "-";

  const date = moment(normalizedValue);
  return date.isValid() ? date.format("DD/MM/YYYY") : "-";
}

function getValidPartnerId(id: unknown): number | null {
  if (typeof id === "number") return Number.isFinite(id) ? id : null;
  if (typeof id === "string") {
    const normalizedId = id.trim();
    if (!normalizedId) return null;
    const parsedId = Number(normalizedId);
    return Number.isFinite(parsedId) ? parsedId : null;
  }
  return null;
}

function isArabicLanguage(language?: string): boolean {
  return language?.startsWith("ar") === true;
}

function PartnerDetailRow({
  label,
  value,
  isArabicValue,
}: {
  label: string;
  value: React.ReactNode;
  isArabicValue?: boolean;
}) {
  return (
    <div className="profile-partner-detail-row">
      <div className="profile-partner-detail-label">{label}</div>
      <div
        className={`profile-partner-detail-value${
          isArabicValue ? " profile-partner-detail-value-ar" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function CompanyPartnerDetails({ details }: { details: IPartnerInfo }) {
  const { i18n, t } = useTranslation();
  const isArabic = isArabicLanguage(i18n.resolvedLanguage || i18n.language);

  return (
    <div className="profile-partner-detail">
      <PartnerDetailRow
        label={t(`${translationBase}.labels.partnerType`)}
        value={getLocalizedText(
          details?.partnerTypeCodeInfo?.nameEn,
          details?.partnerTypeCodeInfo?.nameAr,
          isArabic,
        )}
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.nationality`)}
        value={getLocalizedText(
          details?.nationalityIdInfo?.nameEn,
          details?.nationalityIdInfo?.nameAr,
          isArabic,
        )}
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.establishmentNameAr`)}
        value={safeText(details?.fullNameAr)}
        isArabicValue
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.establishmentNameEn`)}
        value={safeText(details?.fullNameEn)}
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.representativeNameEn`)}
        value={safeText(details?.representativeNameEn)}
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.representativeNameAr`)}
        value={safeText(details?.representativeNameAr)}
        isArabicValue
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.representativeEmiratesId`)}
        value={safeText(details?.representativeEmiratesId)}
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.memorandumOfAssociation`)}
        value={
          details?.memorandumOfAssociationUrl ? (
            <DocumentViewer
              hasDownload
              fileName={details.memorandumOfAssociationUrl}
            />
          ) : (
            "-"
          )
        }
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.powerOfAttorney`)}
        value={
          details?.powerOfAttorneyUrl ? (
            <DocumentViewer hasDownload fileName={details.powerOfAttorneyUrl} />
          ) : (
            "-"
          )
        }
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.statement`)}
        value={
          details?.statementUrl ? (
            <DocumentViewer hasDownload fileName={details.statementUrl} />
          ) : (
            "-"
          )
        }
      />
    </div>
  );
}

function IndividualPartnerDetails({ details }: { details: IPartnerInfo }) {
  const { i18n, t } = useTranslation();
  const isArabic = isArabicLanguage(i18n.resolvedLanguage || i18n.language);
  const verificationType = {
    methodText: "-",
    urlText: "-",
    idText: "-",
    expiryText: "-",
    idValue: "-",
    documentUrl: "",
    expiryValue: null as string | null,
  };

  if (details?.verificationMethodCode === "1") {
    verificationType.methodText = t(
      `${translationBase}.verificationMethods.emiratesId`,
    );
    verificationType.urlText = t(`${translationBase}.documents.emiratesId`);
    verificationType.idText = t(`${translationBase}.labels.emiratesId`);
    verificationType.expiryText = t(`${translationBase}.labels.expiryDate`);
    verificationType.idValue = safeText(details?.emiratesId);
    verificationType.documentUrl = normalizeText(details?.emiratesIdurl);
    verificationType.expiryValue = details?.expiryDate;
  } else if (details?.verificationMethodCode === "2") {
    verificationType.methodText = t(`${translationBase}.verificationMethods.uid`);
    verificationType.urlText = t(`${translationBase}.documents.passport`);
    verificationType.idText = t(`${translationBase}.labels.uid`);
    verificationType.expiryText = t(`${translationBase}.labels.visaExpiryDate`);
    verificationType.idValue = safeText(details?.uaeNumber);
    verificationType.documentUrl = normalizeText(details?.passportUrl);
    verificationType.expiryValue = details?.visaExpiryDate || details?.expiryDate;
  } else if (details?.verificationMethodCode === "3") {
    verificationType.methodText = t(
      `${translationBase}.verificationMethods.passport`,
    );
    verificationType.urlText = t(`${translationBase}.documents.passportScan`);
    verificationType.idText = t(`${translationBase}.labels.passportNumber`);
    verificationType.expiryText = t(`${translationBase}.labels.visaExpiryDate`);
    verificationType.idValue = safeText(details?.passportNumber);
    verificationType.documentUrl =
      normalizeText(details?.passportScanUrl) || normalizeText(details?.passportUrl);
    verificationType.expiryValue = details?.visaExpiryDate || details?.expiryDate;
  }

  return (
    <div className="profile-partner-detail">
      <PartnerDetailRow
        label={t(`${translationBase}.labels.partnerType`)}
        value={getLocalizedText(
          details?.partnerTypeCodeInfo?.nameEn,
          details?.partnerTypeCodeInfo?.nameAr,
          isArabic,
        )}
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.verificationMethod`)}
        value={verificationType.methodText}
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.dateOfBirth`)}
        value={formatDate(details?.dateBirth)}
      />
      <PartnerDetailRow label={verificationType.idText} value={verificationType.idValue} />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.fullNameAr`)}
        value={safeText(details?.fullNameAr)}
        isArabicValue
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.fullNameEn`)}
        value={safeText(details?.fullNameEn)}
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.nationality`)}
        value={getLocalizedText(
          details?.nationalityIdInfo?.nameEn,
          details?.nationalityIdInfo?.nameAr,
          isArabic,
        )}
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.gender`)}
        value={getLocalizedText(
          details?.genderIdInfo?.nameEn,
          details?.genderIdInfo?.nameAr,
          isArabic,
        )}
      />
      {details?.verificationMethodCode === "3" && (
        <PartnerDetailRow
          label={t(`${translationBase}.labels.passportExpiryDate`)}
          value={formatDate(details?.passportExpiryDate)}
        />
      )}
      <PartnerDetailRow
        label={verificationType.expiryText}
        value={formatDate(verificationType.expiryValue)}
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.occupation`)}
        value={safeText(details?.occupation)}
      />
      <PartnerDetailRow
        label={t(`${translationBase}.labels.personalPhoto`)}
        value={
          details?.personalPhotoUrl ? (
            <DocumentViewer
              hasDownload
              uploadConfig={{
                maxCount: 1,
                maxSize: 5,
                uploadTip: t(`${translationBase}.uploadTip`),
              }}
              fileName={details.personalPhotoUrl}
            />
          ) : (
            "-"
          )
        }
      />
      <PartnerDetailRow
        label={verificationType.urlText}
        value={
          verificationType.documentUrl ? (
            <DocumentViewer
              hasDownload
              uploadConfig={{
                maxCount: 1,
                maxSize: 5,
                uploadTip: t(`${translationBase}.uploadTip`),
              }}
              fileName={verificationType.documentUrl}
            />
          ) : (
            "-"
          )
        }
      />
      {details?.visaUrl && (
        <PartnerDetailRow
          label={t(`${translationBase}.documents.visa`)}
          value={
            <DocumentViewer
              hasDownload
              uploadConfig={{
                maxCount: 1,
                maxSize: 5,
                uploadTip: t(`${translationBase}.uploadTip`),
              }}
              fileName={details.visaUrl}
            />
          }
        />
      )}
    </div>
  );
}

function getPartnerLocation(item: PartnerItem, isArabic: boolean): string {
  const emirateName = isArabic
    ? item.emirateObj?.nameAr || item.emirateObj?.nameEn
    : item.emirateObj?.nameEn || item.emirateObj?.nameAr;

  return safeText(emirateName || item.location || item.nationalityName);
}

function getPartnerAvatarIcon(item: PartnerItem): string {
  return item.partnerTypeCode === "1" ? JigouIcon : AvatarIcon;
}

function PartnerCard({
  item,
  detailsPermissionCode,
  detailsPermissionRoutePath,
  getCachedDetails,
  setCachedDetails,
}: PartnerCardProps) {
  const { i18n, t } = useTranslation();
  const isArabic = isArabicLanguage(i18n.resolvedLanguage || i18n.language);
  const isMountedRef = useRef(true);
  const requestLockRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState<IPartnerInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleDetails = useCallback(async () => {
    const partnerId = getValidPartnerId(item.id);
    if (partnerId === null) {
      CustomMessage.error(t(`${translationBase}.messages.invalidPartnerId`));
      return;
    }

    const cachedDetails = getCachedDetails(partnerId);
    if (cachedDetails) {
      setDetails(cachedDetails);
      setVisible(true);
      return;
    }

    if (requestLockRef.current) return;

    requestLockRef.current = true;
    setLoading(true);
    try {
      const response = await getPartnerById(partnerId);
      if (!isMountedRef.current) return;

      const nextDetails = response?.data;
      if (!nextDetails) {
        CustomMessage.error(t(`${translationBase}.messages.detailsUnavailable`));
        return;
      }

      setCachedDetails(partnerId, nextDetails);
      setDetails(nextDetails);
      setVisible(true);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error("Failed to load partner details", error);
      CustomMessage.error(t(`${translationBase}.messages.loadDetailsFailed`));
    } finally {
      requestLockRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [getCachedDetails, item.id, setCachedDetails, t]);

  return (
    <Card
      bordered={false}
      className={`profile-partner-card${
        item.isOwner ? " profile-partner-card--license-owner" : ""
      }`}
    >
      {item.isOwner && (
        <div className="service-card-Featured">
          <div className="service-card-Featured-text">
            {t("establishmentProfile.actions.licenseOwnerBadge")}
          </div>
        </div>
      )}
      <div className="profile-partner-card-content">
        <div className="profile-partner-info">
          <div className="profile-partner-name" title={item.name}>
            {safeText(item.name)}
          </div>
          <div className="profile-partner-meta-list">
            {item.partnerTypeName && (
              <div className="profile-partner-meta-row">
                <span className="profile-partner-meta-icon">
                  <img src={YonghuIcon} alt="" />
                </span>
                <span className="profile-partner-meta-text">
                  {safeText(item.partnerTypeName)}
                </span>
              </div>
            )}
            {item.partnerTypeCode !== "1" && (
              <div className="profile-partner-meta-row">
                <span className="profile-partner-meta-icon">
                  <img src={ProfileIDIcon} alt="" />
                </span>
                <span className="profile-partner-meta-text">
                  {safeText(item.identifier)}
                </span>
              </div>
            )}
            <div className="profile-partner-meta-row">
              <span className="profile-partner-meta-icon">
                <img src={PartnerCountryFlagIcon} alt="" />
              </span>
              <span className="profile-partner-meta-text">
                {getPartnerLocation(item, isArabic)}
              </span>
            </div>
          </div>
        </div>
        <div className="profile-partner-side">
          <div className="profile-partner-avatar">
            <img src={getPartnerAvatarIcon(item)} alt="" />
          </div>
        </div>
      </div>
      <div className="profile-partner-card-footer">
        <CustomButton
          loading={loading}
          disabled={loading}
          text={t(`${translationBase}.buttons.details`)}
          variant="primary"
          size="small"
          customClassName="profile-partner-action"
          permissionCode={detailsPermissionCode}
          permissionRoutePath={detailsPermissionRoutePath}
          onClick={handleDetails}
        />
      </div>
      <Modal
        centered
        className="profile-partner-details-modal"
        title={t(`${translationBase}.modal.partnerDetails`)}
        footer={false}
        visible={visible}
        destroyOnClose
        onCancel={() => setVisible(false)}
      >
        {details?.partnerTypeCode === "1" && <CompanyPartnerDetails details={details} />}
        {details?.partnerTypeCode === "2" && (
          <IndividualPartnerDetails details={details} />
        )}
        {details && details.partnerTypeCode !== "1" && details.partnerTypeCode !== "2" && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t(`${translationBase}.messages.detailsUnavailable`)}
          />
        )}
      </Modal>
    </Card>
  );
}

const ProfilePartnerList: React.FC<ProfilePartnerListProps> = ({
  params,
  detailsPermissionCode,
  detailsPermissionRoutePath,
}) => {
  const { t } = useTranslation();
  const detailsCacheRef = useRef<Map<number, IPartnerInfo>>(new Map());
  const [searchKeyword, setSearchKeyword] = useState("");
  const visiblePartners = useMemo(() => {
    const safeParams = Array.isArray(params) ? params : [];
    const keyword = searchKeyword.trim().toLocaleLowerCase();
    if (!keyword) return safeParams;

    return safeParams.filter((partner) =>
      [
        partner.name,
        partner.identifier,
        partner.representativeNameEn,
        partner.representativeNameAr,
        partner.representativeEmiratesId,
      ].some((value) => normalizeText(value).toLocaleLowerCase().includes(keyword)),
    );
  }, [params, searchKeyword]);

  const getCachedDetails = useCallback((id: number) => {
    return detailsCacheRef.current.get(id);
  }, []);

  const setCachedDetails = useCallback((id: number, details: IPartnerInfo) => {
    detailsCacheRef.current.set(id, details);
  }, []);

  return (
    <div className="profile-partner-list">
      <Card bordered={false} className="profile-partner-section">
        <div className="profile-partner-section-header">
          <div className="profile-partner-section-title">
            {t(`${translationBase}.title`)}
          </div>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t("common.search")}
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
          />
        </div>
        <div className="profile-partner-section-body">
          {visiblePartners.length > 0 ? (
            <div className="profile-partner-grid">
              {visiblePartners.map((item, index) => (
                <PartnerCard
                  key={normalizeText(item.key) || `partner-${index}`}
                  item={item}
                  detailsPermissionCode={detailsPermissionCode}
                  detailsPermissionRoutePath={detailsPermissionRoutePath}
                  getCachedDetails={getCachedDetails}
                  setCachedDetails={setCachedDetails}
                />
              ))}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t(`${translationBase}.empty.noPartners`)}
            />
          )}
        </div>
      </Card>
    </div>
  );
};

export default ProfilePartnerList;
