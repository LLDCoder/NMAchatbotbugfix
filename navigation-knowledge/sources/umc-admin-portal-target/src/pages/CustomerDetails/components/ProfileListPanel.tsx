import React from "react";
import { Empty, Form, Input } from "antd";
import { useTranslation } from "react-i18next";
import Sousuo from "@/assets/icons/Sousuo";
import type { ProfileItem } from "../types";
import DetailSection from "./DetailSection";
import { AllProfilesCard, ProfileCard } from "./ProfileCards";

const ProfileListPanel: React.FC<{
  profiles: ProfileItem[];
  searchKey: string;
  onSearchKeyChange: (value: string) => void;
  selectedProfileId: string;
  onSelectProfileId: (id: string) => void;
  individualCount: number;
  establishmentCount: number;
  // onViewProfileDetails: (id: string) => void;
}> = ({
  profiles,
  searchKey,
  onSearchKeyChange,
  selectedProfileId,
  onSelectProfileId,
  individualCount,
  establishmentCount,
  // onViewProfileDetails,
}) => {
  const { t } = useTranslation();
  return (
    <DetailSection
      title={t("Customer.customerDetails.profilesList.title")}
      extra={
        <Form className="profile-search-form">
          <Form.Item>
            <Input
              allowClear
              prefix={<Sousuo className="search-icon" />}
              placeholder={t("Customer.customerDetails.common.search")}
              value={searchKey}
              onChange={(e) => onSearchKeyChange(e.target.value)}
            />
          </Form.Item>
        </Form>
      }
    >
      <div className="profile-list">
        <AllProfilesCard
          individualCount={individualCount}
          establishmentCount={establishmentCount}
          selected={selectedProfileId === "all"}
          onSelect={() => onSelectProfileId("all")}
        />
        {profiles.length > 0 ? (
          profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              selected={selectedProfileId === profile.id}
              onSelect={onSelectProfileId}
              // onViewDetails={onViewProfileDetails}
            />
          ))
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("Customer.customerDetails.common.noData")}
          />
        )}
      </div>
    </DetailSection>
  );
};

export default ProfileListPanel;
