import CustomButton from "@/components/common/CustomButton";
import CustomMessage from "@/components/common/CustomMessage";
import { Empty, Input, Modal, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getPartnerById } from "@/services/userProfile";
import {
  getUserProfilePartners,
  type IPartnerInfo,
  type PartnerInfo,
} from "@/services/userManagement";

import ProfileIDIcon from "@/assets/images/profileID.svg";
import PartnerCountryFlagIcon from "@/assets/images/partner-country-flag.svg";
import PartnerTypeIcon from "@/assets/images/partner-type.svg";
import ProfileCircleIcon from "@/assets/images/ProfileCircle.svg";
import moment from "moment";
import DocumentViewer from "@/components/common/DocumentViewer";
import { useTranslation } from "react-i18next";
import "./PartnerList.less";

const translationBase = "sharedComponents.partnerList";

interface LocalizedName {
  nameEn?: string | null;
  nameAr?: string | null;
}

export interface PartnerListItem {
  id?: string | number | null;
  isOwner?: boolean | null;
  name?: string | null;
  identifier?: string | number | null;
  location?: string | null;
  fullNameEn?: string | null;
  fullNameAr?: string | null;
  representativeNameEn?: string | null;
  representativeNameAr?: string | null;
  representativeEmiratesId?: string | null;
  emirateObj?: LocalizedName | null;
  partnerType?: string | null;
  partnerTypeName?: string | null;
  partnerTypeCode?: string | number | null;
  partnerTypeCodeInfo?: LocalizedName | null;
}

interface PartnerCardProps {
  id?: string | number | null;
  isOwner?: boolean | null;
  name: string;
  partnerType?: string;
  identifier: string;
  location: string;
  isCompany?: boolean;
  detailsPermissionCode?: string;
  detailsPermissionRoutePath?: string;
  statusSlot?: ReactNode;
  hasStatusSlot?: boolean;
  variant?: "default" | "fahrReview";
  showPartnerType?: boolean;
}

export interface PartnerListProps {
  params: PartnerListItem[];
  column?: number;
  enableSearch?: boolean;
  // When true, the search box filters the provided params locally instead of
  // querying the backend (used where no profileId-based search API applies).
  localSearch?: boolean;
  profileId?: number;
  detailsPermissionCode?: string;
  detailsPermissionRoutePath?: string;
  renderStatusSlot?: (partner: PartnerListItem, index: number) => ReactNode;
  variant?: "default" | "fahrReview";
  showPartnerType?: boolean;
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function safeText(value: unknown): string {
  return normalizeText(value) || "-";
}

// Robustly detect a company partner. The establishment partner payload does not
// always populate partnerTypeCode ("1" = company, "2" = individual), so fall
// back to the localized type text (e.g. "Company" / "شركة").
function isCompanyPartner(item: PartnerListItem): boolean {
  const code = normalizeText(item.partnerTypeCode);
  if (code === "1") return true;
  if (code === "2") return false;

  const typeText = [
    item.partnerType,
    item.partnerTypeName,
    item.partnerTypeCodeInfo?.nameEn,
    item.partnerTypeCodeInfo?.nameAr,
  ]
    .map((value) => normalizeText(value).toLowerCase())
    .join(" ");

  return /company|شرك/.test(typeText);
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

function mapPartnerToListItem(item: PartnerInfo): PartnerListItem {
  return {
    id: item?.id,
    identifier: item?.emiratesId,
    fullNameEn: item?.fullNameEn,
    fullNameAr: item?.fullNameAr,
    representativeNameEn: item?.representativeNameEn,
    representativeNameAr: item?.representativeNameAr,
    representativeEmiratesId: item?.representativeEmiratesId,
    emirateObj: item?.emirateObj,
    partnerTypeName: item?.partnerTypeName,
    partnerTypeCodeInfo: item?.partnerTypeCodeInfo,
  };
}

const PartnerListDetailSection: React.FC<{
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, extra, children }) => (
  <section className="detail-section">
    <div className="detail-section-header">
      <div className="section-title">{title}</div>
      {extra && <div className="section-extra">{extra}</div>}
    </div>
    <div className="detail-section-body">{children}</div>
  </section>
);

function CompanyPartnerDetails({ details }: { details: IPartnerInfo }) {
  const { i18n, t } = useTranslation();
  const isArabic =
    i18n.resolvedLanguage?.startsWith("ar") ||
    i18n.language.startsWith("ar");

  return (
    <div className="partner-detail">
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.partnerType`)}
        </div>
        <div className="partner-detail-value">
          {getLocalizedText(
            details?.partnerTypeCodeInfo?.nameEn,
            details?.partnerTypeCodeInfo?.nameAr,
            isArabic,
          )}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.nationality`)}
        </div>
        <div className="partner-detail-value">
          {getLocalizedText(
            details?.nationalityIdInfo?.nameEn,
            details?.nationalityIdInfo?.nameAr,
            isArabic,
          )}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.establishmentNameAr`)}
        </div>
        <div className="partner-detail-value partner-detail-value-ar">
          {safeText(details?.fullNameAr)}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.establishmentNameEn`)}
        </div>
        <div className="partner-detail-value">
          {safeText(details?.fullNameEn)}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.representativeNameEn`)}
        </div>
        <div className="partner-detail-value">
          {safeText(details?.representativeNameEn)}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.representativeNameAr`)}
        </div>
        <div className="partner-detail-value partner-detail-value-ar">
          {safeText(details?.representativeNameAr)}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.representativeEmiratesId`)}
        </div>
        <div className="partner-detail-value">
          {safeText(details?.representativeEmiratesId)}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.memorandumOfAssociation`)}
        </div>
        <div className="partner-detail-value">
          {details?.memorandumOfAssociationUrl ? (
            <DocumentViewer
              hasDownload
              fileName={details.memorandumOfAssociationUrl}
            />
          ) : (
            "-"
          )}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.powerOfAttorney`)}
        </div>
        <div className="partner-detail-value">
          {details?.powerOfAttorneyUrl ? (
            <DocumentViewer hasDownload fileName={details.powerOfAttorneyUrl} />
          ) : (
            "-"
          )}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.statement`)}
        </div>
        <div className="partner-detail-value">
          {details?.statementUrl ? (
            <DocumentViewer hasDownload fileName={details.statementUrl} />
          ) : (
            "-"
          )}
        </div>
      </div>
    </div>
  );
}

function IndividualPartnerDetails({ details }: { details: IPartnerInfo }) {
  const { i18n, t } = useTranslation();
  const isArabic =
    i18n.resolvedLanguage?.startsWith("ar") ||
    i18n.language.startsWith("ar");
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
    verificationType.methodText = t(
      `${translationBase}.verificationMethods.uid`,
    );
    verificationType.urlText = t(`${translationBase}.documents.passport`);
    verificationType.idText = t(`${translationBase}.labels.uid`);
    verificationType.expiryText = t(
      `${translationBase}.labels.visaExpiryDate`,
    );
    verificationType.idValue = safeText(details?.uaeNumber);
    verificationType.documentUrl = normalizeText(details?.passportUrl);
    verificationType.expiryValue =
      details?.visaExpiryDate || details?.expiryDate;
  } else if (details?.verificationMethodCode === "3") {
    verificationType.methodText = t(
      `${translationBase}.verificationMethods.passport`,
    );
    verificationType.urlText = t(`${translationBase}.documents.passportScan`);
    verificationType.idText = t(`${translationBase}.labels.passportNumber`);
    verificationType.expiryText = t(
      `${translationBase}.labels.visaExpiryDate`,
    );
    verificationType.idValue = safeText(details?.passportNumber);
    verificationType.documentUrl =
      normalizeText(details?.passportScanUrl) ||
      normalizeText(details?.passportUrl);
    verificationType.expiryValue =
      details?.visaExpiryDate || details?.expiryDate;
  }

  return (
    <div className="partner-detail">
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.partnerType`)}
        </div>
        <div className="partner-detail-value">
          {getLocalizedText(
            details?.partnerTypeCodeInfo?.nameEn,
            details?.partnerTypeCodeInfo?.nameAr,
            isArabic,
          )}
        </div>
      </div>
      {/* <div className="partner-detail-row"></div> */}
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.verificationMethod`)}
        </div>
        <div className="partner-detail-value">{verificationType.methodText}</div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.dateOfBirth`)}
        </div>
        <div className="partner-detail-value">
          {formatDate(details?.dateBirth)}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">{verificationType.idText}</div>
        <div className="partner-detail-value">{verificationType.idValue}</div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.fullNameAr`)}
        </div>
        <div className="partner-detail-value partner-detail-value-ar">
          {safeText(details?.fullNameAr)}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.fullNameEn`)}
        </div>
        <div className="partner-detail-value">
          {safeText(details?.fullNameEn)}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.nationality`)}
        </div>
        <div className="partner-detail-value">
          {getLocalizedText(
            details?.nationalityIdInfo?.nameEn,
            details?.nationalityIdInfo?.nameAr,
            isArabic,
          )}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.gender`)}
        </div>
        <div className="partner-detail-value">
          {getLocalizedText(
            details?.genderIdInfo?.nameEn,
            details?.genderIdInfo?.nameAr,
            isArabic,
          )}
        </div>
      </div>
      {details?.verificationMethodCode === "3" && (
        <div className="partner-detail-row">
          <div className="partner-detail-label">
            {t(`${translationBase}.labels.passportExpiryDate`)}
          </div>
          <div className="partner-detail-value">
            {formatDate(details?.passportExpiryDate)}
          </div>
        </div>
      )}
      <div className="partner-detail-row">
        <div className="partner-detail-label">{verificationType.expiryText}</div>
        <div className="partner-detail-value">
          {formatDate(verificationType.expiryValue)}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.occupation`)}
        </div>
        <div className="partner-detail-value">
          {safeText(details?.occupation)}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">
          {t(`${translationBase}.labels.personalPhoto`)}
        </div>
        <div className="partner-detail-value">
          {details?.personalPhotoUrl ? (
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
          )}
        </div>
      </div>
      <div className="partner-detail-row">
        <div className="partner-detail-label">{verificationType.urlText}</div>
        <div className="partner-detail-value">
          {verificationType.documentUrl ? (
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
          )}
        </div>
      </div>
      {details?.visaUrl && (
        <div className="partner-detail-row">
          <div className="partner-detail-label">
            {t(`${translationBase}.documents.visa`)}
          </div>
          <div className="partner-detail-value">
            <DocumentViewer
              hasDownload
              uploadConfig={{
                maxCount: 1,
                maxSize: 5,
                uploadTip: t(`${translationBase}.uploadTip`),
              }}
              fileName={details.visaUrl}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PartnerList({
  params,
  column,
  enableSearch = false,
  localSearch = false,
  profileId,
  detailsPermissionCode,
  detailsPermissionRoutePath,
  renderStatusSlot,
  variant = "default",
  showPartnerType = true,
}: PartnerListProps) {
  const { i18n, t } = useTranslation();
  const isArabic =
    i18n.resolvedLanguage?.startsWith("ar") ||
    i18n.language.startsWith("ar");
  const safeParams = Array.isArray(params) ? params : [];
  const safeColumn =
    typeof column === "number" && Number.isFinite(column) && column > 0
      ? Math.max(1, Math.floor(column))
      : 3;
  const partnerGridGapExpression =
    safeColumn > 1
      ? Array.from(
          { length: safeColumn - 1 },
          () => "var(--partner-grid-gap)",
        ).join(" - ")
      : "0px";
  const partnerGridStyle = {
    "--partner-card-min-width": `max(343px, calc((100% - ${partnerGridGapExpression}) / ${safeColumn}))`,
  } as React.CSSProperties;
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchedPartners, setSearchedPartners] = useState<PartnerListItem[]>(
    [],
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const latestSearchRequestIdRef = useRef(0);
  const normalizedSearchKeyword =
    enableSearch || localSearch ? searchKeyword.trim() : "";
  const normalizedProfileId =
    typeof profileId === "number" &&
    Number.isInteger(profileId) &&
    profileId > 0
      ? profileId
      : undefined;
  const lowerCasedSearchKeyword = normalizedSearchKeyword.toLowerCase();
  const locallyFilteredPartners = normalizedSearchKeyword
    ? safeParams.filter((item) => {
        const searchableValues = [
          item.fullNameEn,
          item.fullNameAr,
          item.name,
          item.representativeNameEn,
          item.representativeNameAr,
          item.representativeEmiratesId,
        ];
        return searchableValues
          .map((value) => normalizeText(value).toLowerCase())
          .join(" ")
          .includes(lowerCasedSearchKeyword);
      })
    : safeParams;
  const displayedPartners = localSearch
    ? locallyFilteredPartners
    : normalizedSearchKeyword
      ? searchedPartners
      : safeParams;

  useEffect(() => {
    const keyword = searchKeyword.trim();
    const requestId = latestSearchRequestIdRef.current + 1;
    latestSearchRequestIdRef.current = requestId;

    if (localSearch || !enableSearch || !keyword || !normalizedProfileId) {
      setSearchedPartners([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await getUserProfilePartners(
          normalizedProfileId,
          keyword,
        );
        const data = response?.data ?? response;
        const items: PartnerInfo[] = Array.isArray(data) ? data : [];

        if (cancelled || requestId !== latestSearchRequestIdRef.current) {
          return;
        }

        setSearchedPartners(items.map(mapPartnerToListItem));
      } catch (error) {
        if (cancelled || requestId !== latestSearchRequestIdRef.current) {
          return;
        }

        console.error("Failed to search partner profiles:", error);
        setSearchedPartners([]);
      } finally {
        if (!cancelled && requestId === latestSearchRequestIdRef.current) {
          setSearchLoading(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enableSearch, normalizedProfileId, searchKeyword]);

  const PartnerCard: React.FC<PartnerCardProps> = ({
    name,
    partnerType,
    identifier,
    location,
    isCompany,
    id,
    isOwner,
    detailsPermissionCode: cardDetailsPermissionCode,
    detailsPermissionRoutePath: cardDetailsPermissionRoutePath,
    statusSlot,
    hasStatusSlot,
    variant: cardVariant,
    showPartnerType: cardShowPartnerType,
  }) => {
    const [visible, setVisible] = useState(false);
    const [details, setDetails] = useState<IPartnerInfo | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleDetails() {
      const partnerId = normalizeText(id);
      if (!partnerId) {
        CustomMessage.error(
          t(`${translationBase}.messages.invalidPartnerId`),
        );
        return;
      }

      setLoading(true);
      try {
        const res = await getPartnerById(partnerId);
        if (!res?.data) {
          CustomMessage.error(
            t(`${translationBase}.messages.detailsUnavailable`),
          );
          return;
        }

        setDetails(res.data as unknown as IPartnerInfo);
        setVisible(true);
      } catch {
        CustomMessage.error(
          t(`${translationBase}.messages.loadDetailsFailed`),
        );
      } finally {
        setLoading(false);
      }
    }

    return (
      <>
        <article
          className={`partner-card${
            hasStatusSlot ? " partner-card--with-status" : ""
          }${
            cardVariant === "fahrReview"
              ? " partner-card--fahr-review"
              : ""
          }`}
        >
          {isOwner && (
            <div className="partner-card__badge">
              <span className="partner-card__badge-text">
                {t("establishmentProfile.actions.licenseOwnerBadge")}
              </span>
            </div>
          )}
          <div className="partner-card__content">
            <div className="partner-card__info">
              <div className="partner-card__name" title={name}>
                {name}
              </div>
              <div className="partner-card__meta-list">
                {cardShowPartnerType && partnerType ? (
                  <div className="partner-card__meta-row">
                    <span className="partner-card__meta-icon">
                      <img src={PartnerTypeIcon} alt="" />
                    </span>
                    <span
                      className="partner-card__meta-text"
                      title={partnerType}
                    >
                      {partnerType}
                    </span>
                  </div>
                ) : null}
                {!isCompany && (
                  <div className="partner-card__meta-row">
                    <span className="partner-card__meta-icon">
                      <img src={ProfileIDIcon} alt="" />
                    </span>
                    <span className="partner-card__meta-text" title={identifier}>
                      {identifier}
                    </span>
                  </div>
                )}
                <div className="partner-card__meta-row">
                  <span className="partner-card__meta-icon">
                    <img src={PartnerCountryFlagIcon} alt="" />
                  </span>
                  <span className="partner-card__meta-text" title={location}>
                    {location}
                  </span>
                </div>
              </div>
            </div>
            <div className="partner-card__avatar">
              <img src={ProfileCircleIcon} alt="" />
            </div>
          </div>
          <div className="partner-card__actions">
            <CustomButton
              loading={loading}
              text={t(`${translationBase}.buttons.details`)}
              variant="primary"
              size="small"
              customClassName="partner-card__action"
              permissionCode={cardDetailsPermissionCode}
              permissionRoutePath={cardDetailsPermissionRoutePath}
              onClick={handleDetails}
            />
          </div>
          {hasStatusSlot ? (
            <div className="partner-card__status-slot">{statusSlot}</div>
          ) : null}
        </article>
        <Modal
          centered
          className="partner-detials-modal"
          title={t(`${translationBase}.modal.partnerDetails`)}
          footer={false}
          visible={visible}
          onCancel={() => setVisible(false)}
        >
          {details?.partnerTypeCode === "1" && (
            <CompanyPartnerDetails details={details} />
          )}
          {details?.partnerTypeCode === "2" && (
            <IndividualPartnerDetails details={details} />
          )}
        </Modal>
      </>
    );
  };

  return (
    <div
      className={`partnerList${
        variant === "fahrReview" ? " partnerList--fahr-review" : ""
      }`}
    >
      <PartnerListDetailSection
        title={t(`${translationBase}.title`)}
        extra={
        enableSearch || localSearch ? (
            <Input
              allowClear
              className="partner-search"
              placeholder={t("common.search")}
              prefix={<SearchOutlined />}
              value={searchKeyword}
              onChange={(event) => {
                const nextKeyword = event.target.value;
                setSearchKeyword(nextKeyword);
                setSearchLoading(Boolean(nextKeyword.trim()));
              }}
            />
          ) : undefined
        }
      >
        {searchLoading ? (
          <div className="partner-search-loading">
            <Spin />
          </div>
        ) : displayedPartners.length > 0 ? (
          <div className="partner-grid" style={partnerGridStyle}>
            {displayedPartners.map((item, index) => {
              const statusSlot = renderStatusSlot?.(item, index);
              const hasStatusSlot =
                statusSlot !== null &&
                statusSlot !== undefined &&
                statusSlot !== false;
              const name = getLocalizedText(
                item.fullNameEn,
                item.fullNameAr,
                isArabic,
                item.name,
              );
              const location = getLocalizedText(
                item.emirateObj?.nameEn,
                item.emirateObj?.nameAr,
                isArabic,
                item.location,
              );
              const partnerType = getLocalizedText(
                item.partnerTypeCodeInfo?.nameEn,
                item.partnerTypeCodeInfo?.nameAr,
                isArabic,
                item.partnerTypeName || item.partnerType,
              );

              return (
                <PartnerCard
                  key={normalizeText(item.id) || `partner-${index}`}
                  id={item.id}
                  isOwner={item.isOwner}
                  name={name}
                  partnerType={partnerType}
                  identifier={safeText(item.identifier)}
                  location={location}
                  isCompany={isCompanyPartner(item)}
                  detailsPermissionCode={detailsPermissionCode}
                  detailsPermissionRoutePath={detailsPermissionRoutePath}
                  statusSlot={statusSlot}
                  hasStatusSlot={hasStatusSlot}
                  variant={variant}
                  showPartnerType={showPartnerType}
                />
              );
            })}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t(`${translationBase}.empty.noPartners`)}
          />
        )}
      </PartnerListDetailSection>
    </div>
  );
}
