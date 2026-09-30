import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import PaginationTotal from "@/components/common/PaginationTotal";
import { Table, Select, Button, Input } from "antd";
import ReactECharts from "echarts-for-react";
import AnalyticsUp from "@/assets/images/analyticsUp.png";
import AnalyticsAed from "@/assets/images/analyticsAed.png";
import AnalyticsBook from "@/assets/images/analyticsBook.png";
import AnalyticsFile from "@/assets/images/analyticsFile.png";
import AnalyticsUser from "@/assets/images/analyticsUser.png";
import AnalyticsTime from "@/assets/images/analyticsTime.png";
import Sousuo from "@/assets/icons/Sousuo";

const OverviewTab: React.FC = () => {
  const { t } = useTranslation();
  const [analyticsData] = useState([
    {
      value: "5,183",
      label: "Published Services",
      iconType: <img src={AnalyticsFile} />,
    },
    {
      value: "1680",
      label: "Total Applications",
      iconType: <img src={AnalyticsBook} />,
    },
    {
      value: "₹8,888K",
      label: "Total Applications",
      iconType: <img src={AnalyticsAed} />,
    },
    {
      value: "27.3%",
      label: "Approval Rate",
      iconType: <img src={AnalyticsUp} />,
    },
    {
      value: "3.2d",
      label: "Avg Processing Time",
      iconType: <img src={AnalyticsTime} />,
    },
    {
      value: "94.2%",
      label: "Avg Satisfaction",
      iconType: <img src={AnalyticsUser} />,
    },
    {
      value: "300",
      label: "Refund Applications",
      iconType: <img src={AnalyticsBook} />,
    },
    {
      value: "₹1, 627.00",
      label: "Total Refunds",
      iconType: <img src={AnalyticsAed} />,
    },
  ]);
  const [tableData] = useState([
    {
      servicename: "Ground Photography Permit",
      applications: "123\n+8.5%",
      totalrevenue: "88K\n+8.5%",
      approvalrate: "87.3%\n+8.5%",
      avgprocessingtime: "3.2d\n+8.5%",
      avgsatisfaction: "87.3%\n+8.5%",
      refundapplications: "3\n+8.5%",
      totalrefund: "1,500\n+8.5%",
      refundrate: "3.3%\n+8.5%",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123\n+8.5%",
      totalrevenue: "88K\n+8.5%",
      approvalrate: "87.3%\n+8.5%",
      avgprocessingtime: "3.2d\n+8.5%",
      avgsatisfaction: "87.3%\n+8.5%",
      refundapplications: "3\n+8.5%",
      totalrefund: "1,500\n+8.5%",
      refundrate: "3.3%\n+8.5%",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123\n+8.5%",
      totalrevenue: "88K\n+8.5%",
      approvalrate: "87.3%\n+8.5%",
      avgprocessingtime: "3.2d\n+8.5%",
      avgsatisfaction: "87.3%\n+8.5%",
      refundapplications: "3\n+8.5%",
      totalrefund: "1,500\n+8.5%",
      refundrate: "3.3%\n+8.5%",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123\n+8.5%",
      totalrevenue: "88K\n+8.5%",
      approvalrate: "87.3%\n+8.5%",
      avgprocessingtime: "3.2d\n+8.5%",
      avgsatisfaction: "87.3%\n+8.5%",
      refundapplications: "3\n+8.5%",
      totalrefund: "1,500\n+8.5%",
      refundrate: "3.3%\n+8.5%",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123\n+8.5%",
      totalrevenue: "88K\n+8.5%",
      approvalrate: "87.3%\n+8.5%",
      avgprocessingtime: "3.2d\n+8.5%",
      avgsatisfaction: "87.3%\n+8.5%",
      refundapplications: "3\n+8.5%",
      totalrefund: "1,500\n+8.5%",
      refundrate: "3.3%\n+8.5%",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123\n+8.5%",
      totalrevenue: "88K\n+8.5%",
      approvalrate: "87.3%\n+8.5%",
      avgprocessingtime: "3.2d\n+8.5%",
      avgsatisfaction: "87.3%\n+8.5%",
      refundapplications: "3\n+8.5%",
      totalrefund: "1,500\n+8.5%",
      refundrate: "3.3%\n+8.5%",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123\n+8.5%",
      totalrevenue: "88K\n+8.5%",
      approvalrate: "87.3%\n+8.5%",
      avgprocessingtime: "3.2d\n+8.5%",
      avgsatisfaction: "87.3%\n+8.5%",
      refundapplications: "3\n+8.5%",
      totalrefund: "1,500\n+8.5%",
      refundrate: "3.3%\n+8.5%",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123\n+8.5%",
      totalrevenue: "88K\n+8.5%",
      approvalrate: "87.3%\n+8.5%",
      avgprocessingtime: "3.2d\n+8.5%",
      avgsatisfaction: "87.3%\n+8.5%",
      refundapplications: "3\n+8.5%",
      totalrefund: "1,500\n+8.5%",
      refundrate: "3.3%\n+8.5%",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123\n+8.5%",
      totalrevenue: "88K\n+8.5%",
      approvalrate: "87.3%\n+8.5%",
      avgprocessingtime: "3.2d\n+8.5%",
      avgsatisfaction: "87.3%\n+8.5%",
      refundapplications: "3\n+8.5%",
      totalrefund: "1,500\n+8.5%",
      refundrate: "3.3%\n+8.5%",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123\n+8.5%",
      totalrevenue: "88K\n+8.5%",
      approvalrate: "87.3%\n+8.5%",
      avgprocessingtime: "3.2d\n+8.5%",
      avgsatisfaction: "87.3%\n+8.5%",
      refundapplications: "3\n+8.5%",
      totalrefund: "1,500\n+8.5%",
      refundrate: "3.3%\n+8.5%",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123\n+8.5%",
      totalrevenue: "88K\n+8.5%",
      approvalrate: "87.3%\n+8.5%",
      avgprocessingtime: "3.2d\n+8.5%",
      avgsatisfaction: "87.3%\n+8.5%",
      refundapplications: "3\n+8.5%",
      totalrefund: "1,500\n+8.5%",
      refundrate: "3.3%\n+8.5%",
    },
  ]);
  const columns = [
    {
      title: t("performanceanalytics.servicename"),
      dataIndex: "servicename",
      key: "servicename",
      width: 280,
    },
    {
      title: t("performanceanalytics.applications"),
      dataIndex: "applications",
      key: "applications",
      width: 140,
      render: (text: string) => {
        const [main, rate] = text.split("\n");
        return (
          <div className="table-cell">
            <p className="title-span">{main}</p>
            <span className="growth-rate">{rate}</span>
          </div>
        );
      },
    },
    {
      title: t("performanceanalytics.totalrefund"),
      dataIndex: "totalrefund",
      key: "totalrefund",
      width: 140,
      render: (text: string) => {
        const [main, rate] = text.split("\n");
        return (
          <div className="table-cell">
            <p className="title-span">{main}</p>
            <span className="growth-rate">{rate}</span>
          </div>
        );
      },
    },
    {
      title: t("performanceanalytics.approvalrate"),
      dataIndex: "approvalrate",
      key: "approvalrate",
      width: 140,
      render: (text: string) => {
        const [main, rate] = text.split("\n");
        return (
          <div className="table-cell">
            <p className="title-span">{main}</p>
            <span className="growth-rate">{rate}</span>
          </div>
        );
      },
    },
    {
      title: t("performanceanalytics.avgprocessingtime"),
      dataIndex: "avgprocessingtime",
      key: "avgprocessingtime",
      width: 180,
      render: (text: string) => {
        const [main, rate] = text.split("\n");
        return (
          <div className="table-cell">
            <p className="title-span">{main}</p>
            <span className="growth-rate">{rate}</span>
          </div>
        );
      },
    },
    {
      title: t("performanceanalytics.avgsatisfaction"),
      dataIndex: "avgsatisfaction",
      key: "avgsatisfaction",
      width: 140,
      render: (text: string) => {
        const [main, rate] = text.split("\n");
        return (
          <div className="table-cell">
            <p className="title-span">{main}</p>
            <span className="growth-rate">{rate}</span>
          </div>
        );
      },
    },
    {
      title: t("performanceanalytics.refundapplications"),
      dataIndex: "refundapplications",
      key: "refundapplications",
      width: 160,
      render: (text: string) => {
        const [main, rate] = text.split("\n");
        return (
          <div className="table-cell">
            <p className="title-span">{main}</p>
            <span className="growth-rate">{rate}</span>
          </div>
        );
      },
    },
    {
      title: t("performanceanalytics.totalrefund"),
      dataIndex: "totalrefund",
      key: "totalrefund",
      width: 140,
      render: (text: string) => {
        const [main, rate] = text.split("\n");
        return (
          <div className="table-cell">
            <p className="title-span">{main}</p>
            <span className="growth-rate">{rate}</span>
          </div>
        );
      },
    },
    {
      title: t("performanceanalytics.refundrate"),
      dataIndex: "refundrate",
      key: "refundrate",
      width: 152,
      render: (text: string) => {
        const [main, rate] = text.split("\n");
        return (
          <div className="table-cell">
            <p className="title-span">{main}</p>
            <span className="growth-rate">{rate}</span>
          </div>
        );
      },
    },
  ];
  const LineChart = () => {
    return {
      tooltip: {
        trigger: "axis",
      },
      legend: {
        data: ["Applications", "Approvals", "Rejections"],
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
          name: "Applications",
          type: "line",
          stack: "Total",
          data: [120, 132, 101, 134, 90, 230, 210, 250, 220, 180, 200, 230],
          itemStyle: {
            color: "#7ECB92",
          },
        },
        {
          name: "Approvals",
          type: "line",
          stack: "Total",
          data: [820, 932, 901, 934, 1290, 1330, 1320, 1400, 1350, 1200, 1250, 1300],
          itemStyle: {
            color: "#FDD835",
          },
        },
        {
          name: "Rejections",
          type: "line",
          stack: "Total",
          data: [320, 332, 301, 334, 390, 430, 420, 450, 420, 380, 400, 430],
          itemStyle: {
            color: "#F48FB1",
          },
        },
      ],
    };
  };

  return (
    <div className="overview-container">
      <div className="two-card">
        {analyticsData.map((item, index) => (
          <div key={index} className="analytics-card">
            <span className="card-icon">{item.iconType}</span>
            <div className="text-box">
              <div className="card-value">{item.value}</div>
              <div className="card-label">{t(item.label)}</div>
            </div>
          </div>
        ))}
      </div>
      {/* chart */}
      <div className="chart-container">
        <div className="chart-card">
          <p className="echarts-title">Revenue Trend</p>
          <ReactECharts option={LineChart()} className="echarts-dom" />
        </div>
        <div className="chart-card">
          <p className="echarts-title">Service Applications Trend</p>
          <ReactECharts option={LineChart()} className="echarts-dom" />
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
            <Select defaultValue="revenue" className="Select">
              <Select.Option value="revenue">
                {t("dashboard.table.sortByRevenue")}
              </Select.Option>
              <Select.Option value="applications">
                {t("dashboard.table.sortByApplications")}
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
          columns={columns}
          dataSource={tableData}
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

export default OverviewTab;
