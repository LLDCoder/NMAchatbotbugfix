import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import { Table, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TopCustomerRow, TopProfileRow } from "../type";

interface TopTenSectionProps {
  topCustomers: TopCustomerRow[];
  topProfiles: TopProfileRow[];
  customersLoading: boolean;
  profilesLoading: boolean;
}

export default function TopTenSection({
  topCustomers,
  topProfiles,
  customersLoading,
  profilesLoading,
}: TopTenSectionProps) {
  const { t } = useTranslation();
  const history = useHistory();
  const openCustomerDetails = useCallback((id?: string | number) => {
    if (id != null && id !== "") {
      history.push(`/happiness/customerManagement/customer-details?id=${id}`);
    }
  }, [history]);
  const openProfileDetails = useCallback((row: TopProfileRow) => {
    const id = row.profileId ?? row.id;
    if (id != null && id !== "") {
      const type =
        row.profileType.trim().toLowerCase() === "individual"
          ? "individual"
          : "commercial";
      history.push(
        `/happiness/customerManagement/customerProfileDetail?id=${id}&type=${type}`,
      );
    }
  }, [history]);

  const customerColumns = useMemo<ColumnsType<TopCustomerRow>>(
    () => [
      {
        title: t("customerReportsAnalytics.tables.no"),
        dataIndex: "rank",
        key: "rank",
        width: 60,
      },
      {
        title: t("customerReportsAnalytics.tables.accountNo"),
        dataIndex: "accountNo",
        key: "accountNo",
        width: 170,
        className: "customer-reports__identifier-column",
        render: (value: string, row: TopCustomerRow) => {
          const id = row.userId ?? row.customerId ?? row.id;
          return id != null && id !== "" ? (
            <button
              type="button"
              className="customer-reports__identifier-link"
              onClick={() => openCustomerDetails(id)}
            >
              {value}
            </button>
          ) : (
            <span className="customer-reports__identifier-text">{value}</span>
          );
        },
      },
      {
        title: t("customerReportsAnalytics.tables.fullName"),
        dataIndex: "fullName",
        key: "fullName",
        width: 180,
      },
      {
        title: t("customerReportsAnalytics.tables.email"),
        dataIndex: "email",
        key: "email",
        width: 210,
      },
      {
        title: t("customerReportsAnalytics.tables.mobileNumber"),
        dataIndex: "mobileNumber",
        key: "mobileNumber",
        width: 150,
      },
      {
        title: t("customerReportsAnalytics.tables.emirate"),
        dataIndex: "emirate",
        key: "emirate",
        width: 130,
      },
      {
        title: t("customerReportsAnalytics.tables.complaints"),
        dataIndex: "complaintsCount",
        key: "complaintsCount",
        width: 110,
      },
      {
        title: t("customerReportsAnalytics.tables.refunds"),
        dataIndex: "refundsCount",
        key: "refundsCount",
        width: 100,
      },
      {
        title: t("customerReportsAnalytics.tables.appeals"),
        dataIndex: "appealsCount",
        key: "appealsCount",
        width: 100,
      },
      {
        title: t("customerReportsAnalytics.tables.total"),
        dataIndex: "total",
        key: "total",
        width: 80,
      },
    ],
    [openCustomerDetails, t],
  );

  const profileColumns = useMemo<ColumnsType<TopProfileRow>>(
    () => [
      {
        title: t("customerReportsAnalytics.tables.no"),
        dataIndex: "rank",
        key: "rank",
        width: 60,
      },
      {
        title: t("customerReportsAnalytics.tables.mediaFileNo"),
        dataIndex: "mediaFileNo",
        key: "mediaFileNo",
        width: 180,
        className: "customer-reports__identifier-column",
        render: (value: string, row: TopProfileRow) => {
          const id = row.profileId ?? row.id;
          const content = (
            <span className="customer-reports__profile-identifier">
              {/*
                TODO: Enable the VIP star when the VIP feature is launched.
                {row.isVip === true && (
                  <span className="customer-reports__vip-star">★</span>
                )}
              */}
              <span>{value}</span>
            </span>
          );
          return id != null && id !== "" ? (
            <button
              type="button"
              className="customer-reports__identifier-link"
              onClick={() => openProfileDetails(row)}
            >
              {content}
            </button>
          ) : (
            <span className="customer-reports__identifier-text">{content}</span>
          );
        },
      },
      {
        title: t("customerReportsAnalytics.tables.profileType"),
        dataIndex: "profileType",
        key: "profileType",
        width: 130,
      },
      {
        title: t("customerReportsAnalytics.tables.profileName"),
        dataIndex: "profileName",
        key: "profileName",
        width: 180,
      },
      {
        title: t("customerReportsAnalytics.tables.accountHolder"),
        dataIndex: "accountHolder",
        key: "accountHolder",
        width: 180,
      },
      {
        title: t("customerReportsAnalytics.tables.emirate"),
        dataIndex: "emirate",
        key: "emirate",
        width: 120,
      },
      {
        title: t("customerReportsAnalytics.tables.complaints"),
        dataIndex: "complaintsCount",
        key: "complaintsCount",
        width: 110,
      },
      {
        title: t("customerReportsAnalytics.tables.refunds"),
        dataIndex: "refundsCount",
        key: "refundsCount",
        width: 100,
      },
      {
        title: t("customerReportsAnalytics.tables.appeals"),
        dataIndex: "appealsCount",
        key: "appealsCount",
        width: 100,
      },
      {
        title: t("customerReportsAnalytics.tables.total"),
        dataIndex: "total",
        key: "total",
        width: 80,
      },
    ],
    [openProfileDetails, t],
  );

  return (
    <div className="content-reports__card-surface customer-reports__top-ten-card">
      <Tabs className="customer-reports__top-ten-tabs">
        <Tabs.TabPane
          key="customers"
          tab={t("customerReportsAnalytics.tables.topCustomersByCases")}
        >
          <Table<TopCustomerRow>
            className="content-reports__table-container admin-table"
            rowKey="rank"
            loading={customersLoading}
            columns={customerColumns}
            dataSource={topCustomers}
            scroll={{ x: 1320 }}
            pagination={false}
          />
        </Tabs.TabPane>
        <Tabs.TabPane
          key="profiles"
          tab={t("customerReportsAnalytics.tables.topProfilesByCases")}
        >
          <Table<TopProfileRow>
            className="content-reports__table-container admin-table"
            rowKey="rank"
            loading={profilesLoading}
            columns={profileColumns}
            dataSource={topProfiles}
            scroll={{ x: 1270 }}
            pagination={false}
          />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
