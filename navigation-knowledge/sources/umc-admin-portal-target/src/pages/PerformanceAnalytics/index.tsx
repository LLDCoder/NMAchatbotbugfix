import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.less";
import AnalyticsUp from "@/assets/images/analyticsUp.png";
import AnalyticsAed from "@/assets/images/analyticsAed.png";
import AnalyticsBook from "@/assets/images/analyticsBook.png";
import AnalyticsFile from "@/assets/images/analyticsFile.png";
import AnalyticsUser from "@/assets/images/analyticsUser.png";
import AnalyticsTime from "@/assets/images/analyticsTime.png";
import { Table, Select, Button, Input, Progress } from "antd";
import { CustomButton } from "@/components/common";
import PaginationTotal from "@/components/common/PaginationTotal";
import SortIcon from "@/assets/images/sort.png";
import ReactECharts from "echarts-for-react";
import Sousuo from "@/assets/icons/Sousuo";

export default function License() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const [analyticsData] = useState([
    {
      value: "195",
      label: "performanceanalytics.publishedservices",
      iconType: <img src={AnalyticsFile} />,
    },
    {
      value: "168",
      label: "performanceanalytics.totalapplications",
      iconType: <img src={AnalyticsBook} />,
    },
    {
      value: "₹8,888K",
      label: "performanceanalytics.totalrevenue",
      iconType: <img src={AnalyticsAed} />,
    },
    {
      value: "27",
      label: "performanceanalytics.approvalrate",
      iconType: <img src={AnalyticsUp} />,
    },
    {
      value: "195",
      label: "performanceanalytics.avgprocessingtime",
      iconType: <img src={AnalyticsTime} />,
    },
    {
      value: "168",
      label: "performanceanalytics.avgsatisfaction",
      iconType: <img src={AnalyticsUser} />,
    },
    {
      value: "86.2%",
      label: "performanceanalytics.refundapplications",
      iconType: <img src={AnalyticsBook} />,
    },
    {
      value: "₹27",
      label: "performanceanalytics.totalrefund",
      iconType: <img src={AnalyticsAed} />,
    },
  ]);
  const [insights] = useState([
    {
      value: "168",
      label: "performanceanalytics.totalapplications",
      iconType: <img src={AnalyticsBook} />,
    },
    {
      value: "62%",
      label: "performanceanalytics.individual",
      iconType: <img src={AnalyticsFile} />,
    },
    {
      value: "27%",
      label: "performanceanalytics.establishment",
      iconType: <img src={AnalyticsUp} />,
    },
    {
      value: "4.6",
      label: "performanceanalytics.averagecustomerrating",
      iconType: <img src={AnalyticsUp} />,
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
  const [IndividualList] = useState([
    {
      name: "performanceanalytics.foreignmedia&correspondents",
      value: 35,
      color: "#D7BC6D",
    },
    {
      name: "performanceanalytics.film&contentproduction",
      value: 25,
      color: "#A0D5AB",
    },
    {
      name: "performanceanalytics.digital&socialmedia",
      value: 10,
      color: "#F5AC7C",
    },
    {
      name: "performanceanalytics.publication&distribution",
      value: 10,
      color: "#FAAAA7",
    },
    { name: "performanceanalytics.videogames", value: 10, color: "#FAD44F" },
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
  const [insightsData] = useState([
    {
      servicename: "Ground Photography Permit",
      applications: "123",
      top3emirates: "Dubai 42%/Abu Dhabi 30%/Sharjah 15%",
      individual: "1,150 (38%)",
      establishment: "1,200 (62%)",
      averagecustomerrating: "4.6",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123",
      top3emirates: "Dubai 42%/Abu Dhabi 30%/Sharjah 15%",
      individual: "1,150 (38%)",
      establishment: "1,200 (62%)",
      averagecustomerrating: "4.6",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123",
      top3emirates: "Dubai 42%/Abu Dhabi 30%/Sharjah 15%",
      individual: "1,150 (38%)",
      establishment: "1,200 (62%)",
      averagecustomerrating: "4.6",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123",
      top3emirates: "Dubai 42%/Abu Dhabi 30%/Sharjah 15%",
      individual: "1,150 (38%)",
      establishment: "1,200 (62%)",
      averagecustomerrating: "4.6",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123",
      top3emirates: "Dubai 42%/Abu Dhabi 30%/Sharjah 15%",
      individual: "1,150 (38%)",
      establishment: "1,200 (62%)",
      averagecustomerrating: "4.6",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123",
      top3emirates: "Dubai 42%/Abu Dhabi 30%/Sharjah 15%",
      individual: "1,150 (38%)",
      establishment: "1,200 (62%)",
      averagecustomerrating: "4.6",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123",
      top3emirates: "Dubai 42%/Abu Dhabi 30%/Sharjah 15%",
      individual: "1,150 (38%)",
      establishment: "1,200 (62%)",
      averagecustomerrating: "4.6",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "123",
      top3emirates: "Dubai 42%/Abu Dhabi 30%/Sharjah 15%",
      individual: "1,150 (38%)",
      establishment: "1,200 (62%)",
      averagecustomerrating: "4.6",
    },
  ]);
  const insightscolumns = [
    {
      title: t("performanceanalytics.servicename"),
      dataIndex: "servicename",
      key: "servicename",
      width: 312,
    },
    {
      title: t("performanceanalytics.applications"),
      dataIndex: "applications",
      key: "applications",
      width: 200,
    },
    {
      title: t("performanceanalytics.top3emirates"),
      dataIndex: "top3emirates",
      key: "top3emirates",
      width: 240,
      render: (text: string) => {
        const [t1, t2, t3] = text.split("/");
        return (
          <div className="table-cell">
            <p className="title-span">{t1}</p>
            <p className="title-span">{t2}</p>
            <p className="title-span">{t3}</p>
          </div>
        );
      },
    },
    {
      title: t("performanceanalytics.individual"),
      dataIndex: "individual",
      key: "individual",
      width: 240,
    },
    {
      title: t("performanceanalytics.establishment"),
      dataIndex: "establishment",
      key: "establishment",
      width: 240,
    },
    {
      title: t("performanceanalytics.averagecustomerrating"),
      dataIndex: "averagecustomerrating",
      key: "averagecustomerrating",
      width: 240,
    },
  ];
  const handleTabClick = (tabKey: string) => {
    setActiveTab(tabKey);
  };
  const Distribution = () => {
    return {
      legend: {
        orient: "vertical",
        left: "50%",
        top: "center",
        itemWidth: 14,
        icon: "circle",
        itemGap: 14,
        itemHeight: 14,
        textStyle: {
          rich: {
            name: {
              width: 150,
              align: "left",
            },
            value: {
              width: 40,
              align: "right",
              color: "#797E86",
            },
          },
        },
        formatter: function (name: string) {
          const data = [
            { name: "Web", icon: "circle", value: 94 },
            { name: "Mobile", icon: "circle", value: 4 },
            { name: "Ipad", icon: "circle", value: 2 },
          ];
          const item = data.find((item) => item.name === name);
          if (item) {
            return `{name|${item.name}}{value|${item.value}%}`;
          }
          return name;
        },
      },
      series: [
        {
          type: "pie",
          radius: ["70%", "90%"],
          center: ["30%", "50%"],
          avoidLabelOverlap: false,
          label: {
            show: false,
            position: "center",
          },
          emphasis: {
            label: {
              show: false,
            },
          },
          labelLine: {
            show: false,
          },
          data: [
            { value: 94, name: "Web", itemStyle: { color: "#7ECB92" } },
            { value: 4, name: "Mobile", itemStyle: { color: "#FDD835" } },
            { value: 2, name: "Ipad", itemStyle: { color: "#F48FB1" } },
          ],
        },
      ],
    };
  };
  const UserType = () => {
    const legendData = [
      { name: "Individual", value: "8%" },
      { name: "Commercial", value: "70%" },
      { name: "Free Zone", value: "2%" },
      { name: "Talent Agency", value: "2%" },
      { name: "Government", value: "6%" },
      { name: "Embassy", value: "12%" },
      { name: "Consulate", value: "8%" },
      { name: "Cultural Clubs", value: "2%" },
    ];
    const column1 = legendData.slice(0, 4);
    const column2 = legendData.slice(4);
    return {
      legend: [
        {
          orient: "vertical",
          left: "45%",
          top: "center",
          itemWidth: 14,
          itemHeight: 14,
          itemGap: 14,
          data: column1.map((item) => ({ name: item.name, icon: "circle" })),
          textStyle: {
            rich: {
              name: { width: 100, align: "left" },
              value: { width: 40, align: "right", color: "#797E86" },
            },
          },
          formatter: (name: string) => {
            const item = column1.find((i) => i.name === name);
            return item ? `{name|${item.name}}{value|${item.value}}` : name;
          },
        },
        {
          orient: "vertical",
          left: "75%",
          top: "center",
          itemWidth: 14,
          itemGap: 14,
          itemHeight: 14,
          data: column2.map((item) => ({ name: item.name, icon: "circle" })),
          textStyle: {
            rich: {
              name: {
                width: 100,
                align: "left",
                color: "#361E12",
                fontWeight: 500,
                fongSize: 14,
              },
              value: { width: 40, align: "right", color: "#797E86" },
            },
          },
          formatter: (name: string) => {
            const item = column2.find((i) => i.name === name);
            return item ? `{name|${item.name}}{value|${item.value}}` : name;
          },
        },
      ],
      series: [
        {
          type: "pie",
          radius: ["70%", "90%"],
          center: ["20%", "50%"],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          data: [
            { value: 8, name: "Individual", itemStyle: { color: "#AED581" } },
            { value: 70, name: "Commercial", itemStyle: { color: "#D4AF37" } },
            { value: 2, name: "Free Zone", itemStyle: { color: "#FFD700" } },
            {
              value: 2,
              name: "Talent Agency",
              itemStyle: { color: "#F08080" },
            },
            { value: 6, name: "Government", itemStyle: { color: "#F4A460" } },
            { value: 12, name: "Embassy", itemStyle: { color: "#C0C0C0" } },
            { value: 8, name: "Consulate", itemStyle: { color: "#EE82EE" } },
            {
              value: 2,
              name: "Cultural Clubs",
              itemStyle: { color: "#87CEEB" },
            },
          ],
        },
      ],
    };
  };
  return (
    <div className="performanceanalytics-container">
      <div className="one-card">
        <div
          className={`tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => handleTabClick("overview")}
        >
          {t("performanceanalytics.overview")}
        </div>
        <div
          className={`tab ${activeTab === "insights" ? "active" : ""}`}
          onClick={() => handleTabClick("insights")}
        >
          {t("performanceanalytics.insights")}
        </div>
      </div>
      {activeTab === "overview" ? (
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
                <Select defaultValue="All Services" className="Select">
                  <Select.Option value="All Services">
                    {t("performanceanalytics.allservices")}
                  </Select.Option>
                </Select>
                <Select defaultValue="All Departments" className="Select">
                  <Select.Option value="All Departments">
                    {t("performanceanalytics.alldepartment")}
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
      ) : (
        <div className="insights-container">
          <div className="two-card">
            {insights.map((item, index) => (
              <div key={index} className="analytics-card">
                <span className="card-icon">{item.iconType}</span>
                <div className="text-box">
                  <div className="card-value">{item.value}</div>
                  <div className="card-label">{t(item.label)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="progress-div">
            <div className="individual">
              <p className="progress-title">
                {t("performanceanalytics.individual")}
              </p>
              <p className="progress-content">
                {t("performanceanalytics.individualtext")}
              </p>
              <div className="progress-container">
                {IndividualList.map((item, index) => (
                  <div key={index} className="progress-card">
                    <span className="progress-name">{t(item.name)}</span>
                    <Progress
                      strokeColor={{
                        "100%": item.color,
                      }}
                      percent={item.value}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="establishment">
              <p className="progress-title">
                {t("performanceanalytics.establishment")}
              </p>
              <p className="progress-content">
                {t("performanceanalytics.establishmenttext")}
              </p>
              <div className="progress-container">
                {IndividualList.map((item, index) => (
                  <div key={index} className="progress-card">
                    <span className="progress-name">{t(item.name)}</span>
                    <Progress
                      strokeColor={{
                        "100%": item.color,
                      }}
                      percent={item.value}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="echarts-container">
            <div className="distribution">
              <p className="echarts-title">
                {t("performanceanalytics.echartstext1")}
              </p>
              <ReactECharts option={Distribution()} className="echarts-dom" />
            </div>
            <div className="user-type">
              <p className="echarts-title">
                {t("performanceanalytics.echartstext2")}
              </p>
              <ReactECharts option={UserType()} className="echarts-dom" />
            </div>
          </div>
          <div className="three-table">
            <div className="table-header">
              <div className="table-controls">
                <Input
                  className="input Insights-input"
                  prefix={<Sousuo className="search-icon" />}
                  placeholder={t("common.search")}
                />
                <CustomButton
                  text={t("serviceConfiguration.filters.filter")}
                  variant="outline"
                  icon={SortIcon}
                  iconPosition="right"
                />
              </div>

              <Button type="default" className="export-btn">
                {t("common.export")}
              </Button>
            </div>
            <Table
              columns={insightscolumns}
              dataSource={insightsData}
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
      )}
    </div>
  );
}
