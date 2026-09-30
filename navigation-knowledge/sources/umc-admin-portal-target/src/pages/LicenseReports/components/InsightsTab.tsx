import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Table, Input, Button } from "antd";
import { CustomButton } from "@/components/common";
import PaginationTotal from "@/components/common/PaginationTotal";
import SortIcon from "@/assets/images/sort.png";
import ReactECharts from "echarts-for-react";
import AnalyticsUp from "@/assets/images/analyticsUp.png";
import AnalyticsBook from "@/assets/images/analyticsBook.png";
import AnalyticsFile from "@/assets/images/analyticsFile.png";
import Sousuo from "@/assets/icons/Sousuo";

const InsightsTab: React.FC = () => {
  const { t } = useTranslation();
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
  const [insightsData] = useState([
    {
      servicename: "Ground Photography Permit",
      applications: "1,498",
      dubai: "20%",
      abudhabi: "20%",
      sharjah: "20%",
      ajman: "20%",
      rak: "5%",
      fujairah: "5%",
      uaq: "5%",
      foreign: "5%",
      individual: "1,000(5%)",
      commercial: "1,000(5%)",
      government: "1,000(5%)",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "1,498",
      dubai: "20%",
      abudhabi: "20%",
      sharjah: "20%",
      ajman: "20%",
      rak: "5%",
      fujairah: "5%",
      uaq: "5%",
      foreign: "5%",
      individual: "1,000(5%)",
      commercial: "1,000(5%)",
      government: "1,000(5%)",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "1,498",
      dubai: "20%",
      abudhabi: "20%",
      sharjah: "20%",
      ajman: "20%",
      rak: "5%",
      fujairah: "5%",
      uaq: "5%",
      foreign: "5%",
      individual: "1,000(5%)",
      commercial: "1,000(5%)",
      government: "1,000(5%)",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "1,498",
      dubai: "20%",
      abudhabi: "20%",
      sharjah: "20%",
      ajman: "20%",
      rak: "5%",
      fujairah: "5%",
      uaq: "5%",
      foreign: "5%",
      individual: "1,000(5%)",
      commercial: "1,000(5%)",
      government: "1,000(5%)",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "1,498",
      dubai: "20%",
      abudhabi: "20%",
      sharjah: "20%",
      ajman: "20%",
      rak: "5%",
      fujairah: "5%",
      uaq: "5%",
      foreign: "5%",
      individual: "1,000(5%)",
      commercial: "1,000(5%)",
      government: "1,000(5%)",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "1,498",
      dubai: "20%",
      abudhabi: "20%",
      sharjah: "20%",
      ajman: "20%",
      rak: "5%",
      fujairah: "5%",
      uaq: "5%",
      foreign: "5%",
      individual: "1,000(5%)",
      commercial: "1,000(5%)",
      government: "1,000(5%)",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "1,498",
      dubai: "20%",
      abudhabi: "20%",
      sharjah: "20%",
      ajman: "20%",
      rak: "5%",
      fujairah: "5%",
      uaq: "5%",
      foreign: "5%",
      individual: "1,000(5%)",
      commercial: "1,000(5%)",
      government: "1,000(5%)",
    },
    {
      servicename: "Ground Photography Permit",
      applications: "1,498",
      dubai: "20%",
      abudhabi: "20%",
      sharjah: "20%",
      ajman: "20%",
      rak: "5%",
      fujairah: "5%",
      uaq: "5%",
      foreign: "5%",
      individual: "1,000(5%)",
      commercial: "1,000(5%)",
      government: "1,000(5%)",
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
      width: 150,
    },
    {
      title: "Geographical Distribution",
      key: "geographical",
      children: [
        {
          title: "Dubai",
          dataIndex: "dubai",
          key: "dubai",
          width: 100,
        },
        {
          title: "Abu Dhabi",
          dataIndex: "abudhabi",
          key: "abudhabi",
          width: 100,
        },
        {
          title: "Sharjah",
          dataIndex: "sharjah",
          key: "sharjah",
          width: 100,
        },
        {
          title: "Ajman",
          dataIndex: "ajman",
          key: "ajman",
          width: 100,
        },
        {
          title: "RAK",
          dataIndex: "rak",
          key: "rak",
          width: 100,
        },
        {
          title: "Fujairah",
          dataIndex: "fujairah",
          key: "fujairah",
          width: 100,
        },
        {
          title: "UAQ",
          dataIndex: "uaq",
          key: "uaq",
          width: 100,
        },
        {
          title: "Foreign",
          dataIndex: "foreign",
          key: "foreign",
          width: 100,
        },
      ],
    },
    {
      title: "",
      key: "segments",
      children: [
        {
          title: "Individual",
          dataIndex: "individual",
          key: "individual",
          width: 150,
          render: (text: string) => {
            const [value, percentage] = text.split("(");
            return (
              <div className="table-cell">
                <p className="title-span">{value}</p>
                <p className="growth-rate">{percentage.replace(")", "")}</p>
              </div>
            );
          },
        },
        {
          title: "Commercial",
          dataIndex: "commercial",
          key: "commercial",
          width: 150,
          render: (text: string) => {
            const [value, percentage] = text.split("(");
            return (
              <div className="table-cell">
                <p className="title-span">{value}</p>
                <p className="growth-rate">{percentage.replace(")", "")}</p>
              </div>
            );
          },
        },
        {
          title: "Government",
          dataIndex: "government",
          key: "government",
          width: 150,
          render: (text: string) => {
            const [value, percentage] = text.split("(");
            return (
              <div className="table-cell">
                <p className="title-span">{value}</p>
                <p className="growth-rate">{percentage.replace(")", "")}</p>
              </div>
            );
          },
        },
      ],
    },
  ];
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
      </div>
      <div className="echarts-container">
        <div className="distribution">
          <p className="echarts-title">Users by Device</p>
          <ReactECharts option={Distribution()} className="echarts-dom" />
        </div>
        <div className="user-type">
          <p className="echarts-title">
            Applications by User Type
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
          bordered
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

export default InsightsTab;
