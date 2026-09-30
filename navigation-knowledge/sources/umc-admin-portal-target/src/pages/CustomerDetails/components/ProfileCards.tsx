import React from "react";
import { Card, Checkbox } from "antd";
import { useTranslation } from "react-i18next";
import { FolderOutlined } from "@ant-design/icons";
import type { ProfileItem } from "../types";
import ProfileCircleIcon from "@/assets/images/company.svg";
import CustomStatusTag from "@/components/common/CustomStatusTag";
import ProfileFold from "@/assets/images/ProfileFold.svg";
import ProfileCom from "@/assets/images/ProfileCom.svg";
import ProfileFoldSelect from "@/assets/images/ProfileFoldSelect.svg";
import ProfileComSelect from "@/assets/images/ProfileComSelect.svg";
import { useAuthenticatedDocumentUrl } from "@/hooks/useAuthenticatedDocumentUrl";
import SelfMonitorBadge from "@/components/common/SelfMonitorBadge";
import {
  USER_TYPE_CODE_COMMERCIAL,
  USER_TYPE_CODE_CONSULATE,
  USER_TYPE_CODE_CULTURAL_CLUBS,
  USER_TYPE_CODE_EMBASSY,
  USER_TYPE_CODE_FREE_ZONE,
  USER_TYPE_CODE_GOVERNMENT,
  USER_TYPE_CODE_INDIVIDUAL,
  USER_TYPE_CODE_TALENT_AGENCY,
  normalizeUserTypeCode,
} from "@/utils/userTypeCode";

export const StatChip: React.FC<{ label: string; value: number }> = ({
  label,
  value,
}) => (
  <div className="profile-stat-chip">
    <div className="profile-stat-label">{label}</div>
    <div className="profile-stat-value">{value}</div>
  </div>
);

export const AllProfilesCard: React.FC<{
  individualCount: number;
  establishmentCount: number;
  selected: boolean;
  onSelect: () => void;
}> = ({ individualCount, establishmentCount, selected, onSelect }) => {
  const { t } = useTranslation();
  return (
  <Card
    bordered={false}
    className={`profile-card all-profiles-card${selected ? " selected" : ""}`}
    onClick={onSelect}
  >
    <div className="profile-card-top">
      <div className="profile-card-top-left">
        <div className="profile-avatar all-profiles-avatar">
          <img src={selected ? ProfileFoldSelect : ProfileFold} alt="" />
        </div>
        <div>
          <div className="profile-name">{t("Customer.customerDetails.profileCards.allProfiles")}</div>
          <div className="profile-subtitle">{t("Customer.customerDetails.profileCards.combinedView")}</div>
        </div>
      </div>

      <Checkbox checked={selected}></Checkbox>
    </div>

    <div className="profile-summary-grid">
      <div className="profile-summary-chip">
        <div className="profile-summary-label">{t("Customer.customerDetails.profileCards.individual")}</div>
        <div className="profile-summary-value">{individualCount}</div>
      </div>
      <div className="profile-summary-chip">
        <div className="profile-summary-label">{t("Customer.customerDetails.profileCards.establishment")}</div>
        <div className="profile-summary-value">{establishmentCount}</div>
      </div>
    </div>
  </Card>
  );
};

export const ProfileCard: React.FC<{
  profile: ProfileItem;
  selected: boolean;
  onSelect: (id: string) => void;
}> = ({ profile, selected, onSelect }) => {
  const { t } = useTranslation();
  const avatarSrc = useAuthenticatedDocumentUrl(
    profile.photoUrl,
    selected ? ProfileComSelect : ProfileCom,
  );
  const userTypeCode = normalizeUserTypeCode(profile.userTypeCode);
  const profileTypeKeyByCode: Record<string, string> = {
    [USER_TYPE_CODE_INDIVIDUAL]: "individual",
    [USER_TYPE_CODE_COMMERCIAL]: "commercial",
    [USER_TYPE_CODE_GOVERNMENT]: "government",
    [USER_TYPE_CODE_FREE_ZONE]: "freeZone",
    [USER_TYPE_CODE_TALENT_AGENCY]: "talentAgency",
    [USER_TYPE_CODE_EMBASSY]: "embassy",
    [USER_TYPE_CODE_CONSULATE]: "consulate",
    [USER_TYPE_CODE_CULTURAL_CLUBS]: "culturalClubs",
  };
  const profileTypeKey = profileTypeKeyByCode[userTypeCode];
  const profileTypeLabel = profileTypeKey
    ? t(`Customer.profiles.chart.${profileTypeKey}`)
    : profile.profileType;
  return (
  <Card
    bordered={false}
    className={`profile-card${selected ? " selected" : ""}`}
    onClick={() => onSelect(profile.id)}
    // onDoubleClick={() => onViewDetails(profile.id)}
  >
    <div className="profile-card-top">
      <div className="profile-card-top-left">
        <div className="profile-avatar">
          <img
            className={profile.photoUrl ? "profile-avatar-image is-photo" : undefined}
            src={avatarSrc}
            alt=""
            onError={(event) => {
              const target = event.currentTarget;
              target.onerror = null;
              target.src = selected ? ProfileComSelect : ProfileCom;
              target.className = "";
            }}
          />
        </div>
        <div>
          <div className="profile-name">{profile.profileName}</div>
          <div className="profile-name-ar">{profile.profileNameAr}</div>
        </div>
      </div>
      <Checkbox checked={selected}></Checkbox>
    </div>

    <div className="profile-tags-row">
      <div className="profile-type">{profileTypeLabel}</div>
      <div className="profile-line"></div>
      <CustomStatusTag status={profile.status} type="profileCard" />
      {profile.selfMonitorProgram?.status ? (
        <div className="profile-card__self-monitor-row">
          <SelfMonitorBadge program={profile.selfMonitorProgram} />
        </div>
      ) : null}
    </div>

    <div className="profile-id-row">{profile.emiratesId}</div>

    <div className="profile-stats-grid">
      <StatChip label={t("Customer.customerDetails.profileCards.stats.apps")} value={profile.stats.apps} />
      <StatChip label={t("Customer.customerDetails.profileCards.stats.tickets")} value={profile.stats.tickets} />
      <StatChip label={t("Customer.customerDetails.profileCards.stats.refund")} value={profile.stats.refund} />
      <StatChip label={t("Customer.customerDetails.profileCards.stats.appeal")} value={profile.stats.appeal} />
      <StatChip label={t("Customer.customerDetails.profileCards.stats.violations")} value={profile.stats.violations} />
      <StatChip label={t("Customer.customerDetails.profileCards.stats.fines")} value={profile.stats.fines} />
    </div>
  </Card>
  );
};
