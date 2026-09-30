import React from "react";
import { useTranslation } from "react-i18next";
import PaginationTotal from "@/components/common/PaginationTotal";
import { Table, Select, Button, Input } from "antd";
import ReactECharts from "echarts-for-react";
import Sousuo from "@/assets/icons/Sousuo";

interface LicenseTabProps {}

const LicenseTab: React.FC<LicenseTabProps> = () => {
  const { t } = useTranslation();

  const [licenseData] = React.useState([
    {
      licenseType: "Ground Photography Permit",
      totalIssued: "1,234",
      pending: "56",
      expired: "120",
      revoked: "12",
      revenue: "₹1,234,567",
    },
    {
      licenseType: "Film Shooting Permit",
      totalIssued: "567",
      pending: "23",
      expired: "45",
      revoked: "5",
      revenue: "₹890,123",
    },
    {
      licenseType: "Event Permit",
      totalIssued: "890",
      pending: "34",
      expired: "78",
      revoked: "8",
      revenue: "₹567,890",
    },
  ]);

  const licenseColumns = [
    {
      title: "License Type",
      dataIndex: "licenseType",
      key: "licenseType",
      width: 200,
    },
    {
      title: "Total Issued",
      dataIndex: "totalIssued",
      key: "totalIssued",
      width: 150,
    },
    {
      title: "Pending",
      dataIndex: "pending",
      key: "pending",
      width: 100,
    },
    {
      title: "Expired",
      dataIndex: "expired",
      key: "expired",
      width: 100,
    },
    {
      title: "Revoked",
      dataIndex: "revoked",
      key: "revoked",
      width: 100,
    },
    {
      title: "Revenue",
      dataIndex: "revenue",
      key: "revenue",
      width: 150,
    },
  ];

  const LicenseTrend = () => {
    return {
      tooltip: {
        trigger: "axis",
      },
      legend: {
        data: ["New Licenses", "Renewals", "Expirations"],
        top: 0,
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      },
      yAxis: {
        type: "value",
      },
      series: [
        {
          name: "New Licenses",
          type: "line",
          data: [120, 132, 101, 134, 90, 230, 210, 250, 220, 180, 200, 230],
          itemStyle: {
            color: "#7ECB92",
          },
        },
        {
          name: "Renewals",
          type: "line",
          data: [820, 932, 901, 934, 1290, 1330, 1320, 1400, 1350, 1200, 1250, 1300],
          itemStyle: {
            color: "#FDD835",
          },
        },
        {
          name: "Expirations",
          type: "line",
          data: [320, 332, 301, 334, 390, 430, 420, 450, 420, 380, 400, 430],
          itemStyle: {
            color: "#F48FB1",
          },
        },
      ],
    };
  };

  return (
    <div className="license-container">
      <div className="chart-container">
        <div className="chart-card">
          <p className="echarts-title">License Trend</p>
          <ReactECharts option={LicenseTrend()} className="echarts-dom" />
        </div>
      </div>
      <div className="three-table">
        <div className="table-header">
          <div className="table-controls">
            <Input
              className="input"
              prefix={<Sousuo className="search-icon" />}
              placeholder={t("common.search")}
            />
            <Select defaultValue="totalIssued" className="Select">
              <Select.Option value="totalIssued">
                {t("Total Issued")}
              </Select.Option>
              <Select.Option value="revenue">
                {t("Revenue")}
              </Select.Option>
            </Select>
            <Select defaultValue="desc" className="Select">
              <Select.Option value="desc">
                {t("performanceanalytics.descending")}
              </Select.Option>
            </Select>
          </div>

          <Button type="default" className="export-btn">
            {t("common.export")}
          </Button>
        </div>
        <Table
          columns={licenseColumns}
          dataSource={licenseData}
          className="admin-table"
          pagination={{
            size: "default",
            total: 100,
            pageSize: 10,
            current: 1,
            showSizeChanger: true,
            showTotal: (total) => <PaginationTotal label={t("common.total")} total={total} current={1} pageSize={10} />,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
        />
      </div>
    </div>
  );
};

export default LicenseTab;
