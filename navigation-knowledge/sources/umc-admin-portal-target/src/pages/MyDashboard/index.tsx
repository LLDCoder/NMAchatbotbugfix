import { useState } from "react";
import { Card, Table, Select } from "antd";
import ReactECharts from "echarts-for-react";
import { useTranslation } from "react-i18next";
import MenuIcon from "@/assets/images/menu.png";
import CheckListIcon from "@/assets/images/checkList.png";
import CheckedIcon from "@/assets/images/checked.png";
import CardIcon from "@/assets/images/card.png";
import PercentIcon from "@/assets/images/percent.png";
import FileClockIcon from "@/assets/images/fileClock.png";
import SmileIcon from "@/assets/images/smile.png";
import TaskListIcon from "@/assets/images/taskList.png";
import JizheIcon from "@/assets/images/jizhe.png";
import MoivesIcon from "@/assets/images/movies.png";
import GameIcon from "@/assets/images/game.png";
import WwwwIcon from "@/assets/images/www.png";
import XiaJiangIcon from "@/assets/images/xiajiang.png";
import ShangShengIcon from "@/assets/images/shangsheng.png";
import AEDIcon from "@/assets/images/AED.png";
import AEDHuiIcon from "@/assets/images/aed_table.svg";

import "./index.less";
import { CustomButton } from "@/components/common";
import * as echarts from "echarts";

const PIE_CHART_COLORS = [
  "#D7BC6D",
  "#A0D5AB",
  "#FAAAA7",
  "#F5AC7C",
  "#F0ABFC",
  "#81C1FF",
];

interface StatCardData {
  value: string;
  label: string;
  icon: string;
}

interface ServiceData {
  key: string;
  order: number;
  serviceName: string;
  category: string;
  applications: number;
  revenue: string;
  approvalRate: string;
  avgTime: string;
  satisfaction: string;
  growth: string;
}

function MyDashboard() {
  const { t } = useTranslation();

  const [revenueData] = useState([
    { category: "mediaLicensing", value: 198, growth: 18.2, color: "#C9A961" },
    {
      category: "filmProduction",
      value: 98,
      growth: -3.4,
      color: "#C9A961",
    },
    {
      category: "foreignMedia",
      value: 198,
      growth: 18.2,
      color: "#C9A961",
    },
    {
      category: "publication",
      value: 148,
      growth: 18.2,
      color: "#C9A961",
    },
    { category: "videoGames", value: 98, growth: 18.2, color: "#C9A961" },
    {
      category: "digitalMedia",
      value: 98,
      growth: 18.2,
      color: "#C9A961",
    },
  ]);

  const getBarChartOption = () => {
    return {
      grid: {
        left: "50px",
        right: "20px",
        top: "40px",
        bottom: "120px",
      },
      xAxis: {
        type: "category",
        data: revenueData.map((item) =>
          t(`dashboard.categories.${item.category}`)
        ),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          show: true,
          interval: 0,
          rotate: 0,
          fontSize: 10,
          color: "#999",
          formatter: function (value: string) {
            if (value.length > 10) {
              return value.replace(/\s&\s/, "\n&\n");
            }
            return value;
          },
        },
      },
      yAxis: {
        type: "value",
        max: 250,
        interval: 50,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 12,
          color: "#999",
          formatter: "{value}K",
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: "dashed",
            color: "#e8e8e8",
          },
        },
      },
      series: [
        {
          type: "bar",
          data: revenueData.map((item) => ({
            value: item.value,
            itemStyle: {
              borderRadius: [6, 6, 0, 0],
              color: new echarts.graphic.LinearGradient(
                  0, 1, 0, 0,
                  [
                      { offset: 0, color: '#CBA344' },
                      { offset: 1, color: '#D7BC6D' }
                  ]
              ),
            },
          })),
          barWidth: "60%",
          label: {
            show: true,
            position: "top",
            fontSize: 14,
            fontWeight: 600,
            color: "#92722A",
            formatter: "{c}K",
          },
        },
      ],
    };
  };

  const [serviceDistribution] = useState([
    { name: "mediaLicensing", value: 8, percentage: 16 },
    { name: "filmProduction", value: 8, percentage: 16 },
    { name: "foreignMedia", value: 8, percentage: 16 },
    { name: "publication", value: 8, percentage: 16 },
    { name: "videoGames", value: 8, percentage: 16 },
    { name: "digitalMedia", value: 8, percentage: 16 },
  ]);

  const [selectedLegends, setSelectedLegends] = useState<{
    [key: string]: boolean;
  }>(() => {
    const initial: { [key: string]: boolean } = {};
    serviceDistribution.forEach((item) => {
      initial[item.name] = true;
    });
    return initial;
  });

  const toggleLegend = (name: string) => {
    setSelectedLegends((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const getPieChartOption = () => {
    const filteredData = serviceDistribution
      .map((item, index) => ({
        name: item.name,
        value: selectedLegends[item.name] ? item.value : 0,
        itemStyle: {
          color: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
          opacity: selectedLegends[item.name] ? 1 : 0,
        },
      }))
      .filter((item) => item.value > 0);

    const totalValue = filteredData.reduce((sum, item) => sum + item.value, 0);

    return {
      tooltip: {
        trigger: "item",
        appendTo: "body",
        formatter: (params: { name: string; value: number; percent: number }) =>
          `${t(`dashboard.categories.${params.name}`)}: ${params.value} (${params.percent}%)`,
      },
      legend: {
        show: false,
      },
      series: [
        {
          type: "pie",
          radius: ["80%", "100%"],
          center: ["50%", "50%"],
          startAngle: 90,
          minAngle: 3,
          data: filteredData,
          label: {
            show: false,
          },
          labelLine: {
            show: false,
          },
          emphasis: {
            scale: false,
            scaleSize: 5,
          },
        },
      ],
      graphic: [
        {
          type: "text",
          left: "center",
          top: "35%",
          style: {
            text: totalValue.toString(),
            textAlign: "center",
            fill: "#361E12",
            fontSize: 26,
            fontWeight: 800,
          },
        },
        {
          type: "text",
          left: "center",
          top: "57%",
          style: {
            text: t("dashboard.charts.totalServices"),
            textAlign: "center",
            fill: "#5F646D",
            fontSize: 14,
            fontWeight: 500,
          },
        },
      ],
    };
  };

  const [tableData] = useState<ServiceData[]>([
    {
      key: "1",
      order: 1,
      serviceName: "filmProductionLicense",
      category: "filmProduction",
      applications: 111,
      revenue: "888,888",
      approvalRate: "96.3%",
      avgTime: "3.5 days",
      satisfaction: "96.3%",
      growth: "+8.5%",
    },
    {
      key: "2",
      order: 2,
      serviceName: "newspaperMagazineLicense",
      category: "mediaLicensing",
      applications: 102,
      revenue: "788,888",
      approvalRate: "96.8%",
      avgTime: "3.5 days",
      satisfaction: "96.8%",
      growth: "-7.3%",
    },
    {
      key: "3",
      order: 3,
      serviceName: "bookTradingDistribution",
      category: "publication",
      applications: 123,
      revenue: "688,888",
      approvalRate: "96.3%",
      avgTime: "3.5 days",
      satisfaction: "96.3%",
      growth: "-8.1%",
    },
    {
      key: "4",
      order: 4,
      serviceName: "pressCardForeignJournalists",
      category: "foreignMedia",
      applications: 98,
      revenue: "542,888",
      approvalRate: "93.3%",
      avgTime: "3.5 days",
      satisfaction: "93.3%",
      growth: "+8.5%",
    },
    {
      key: "5",
      order: 5,
      serviceName: "tvRadioLicense",
      category: "mediaLicensing",
      applications: 122,
      revenue: "293,112",
      approvalRate: "87.5%",
      avgTime: "3.5 days",
      satisfaction: "87.5%",
      growth: "+8.4%",
    },
  ]);

  const statCards: StatCardData[] = [
    { value: "6", label: t("dashboard.stats.totalCategories"), icon: MenuIcon },
    { value: "57", label: t("dashboard.stats.totalServices"), icon: TaskListIcon },
    { value: "50", label: t("dashboard.stats.publishedServices"), icon: CheckedIcon },
    { value: "5,183", label: t("dashboard.stats.totalApplications"), icon: CheckListIcon },
    { value: "D 8,888K", label: t("dashboard.stats.totalRevenue"), icon: CardIcon },
    { value: "87.3%", label: t("dashboard.stats.approvalRate"), icon: PercentIcon },
    { value: "3.2d", label: t("dashboard.stats.avgProcessingTime"), icon: FileClockIcon },
    { value: "94.2%", label: t("dashboard.stats.avgSatisfaction"), icon: SmileIcon },
  ];

  const columns = [
    {
      title: t("dashboard.table.order"),
      dataIndex: "order",
      key: "order",
      width: 80,
    },
    {
      title: t("dashboard.table.serviceName"),
      dataIndex: "serviceName",
      key: "serviceName",
      width: 250,
      render: (text: string) => t(`dashboard.services.${text}`),
    },
    {
      title: t("dashboard.table.category"),
      dataIndex: "category",
      key: "category",
      width: 200,
      render: (text: string) => t(`dashboard.categories.${text}`),
    },
    {
      title: t("dashboard.table.applications"),
      dataIndex: "applications",
      key: "applications",
      width: 120,
    },
    {
      title: t("dashboard.table.revenue"),
      dataIndex: "revenue",
      key: "revenue",
      width: 120,
    },
    {
      title: t("dashboard.table.approvalRate"),
      dataIndex: "approvalRate",
      key: "approvalRate",
      width: 120,
    },
    {
      title: t("dashboard.table.avgTime"),
      dataIndex: "avgTime",
      key: "avgTime",
      width: 100,
    },
    {
      title: t("dashboard.table.satisfaction"),
      dataIndex: "satisfaction",
      key: "satisfaction",
      width: 120,
    },
    {
      title: t("dashboard.table.growth"),
      dataIndex: "growth",
      key: "growth",
      width: 100,
      render: (text: string) => (
        <span style={{ color: text.startsWith("+") ? "#52c41a" : "#ff4d4f" }}>
          {text}{" "}
          {text.startsWith("+") ? (
            <img src={ShangShengIcon} className="table-icon" />
          ) : (
            <img src={XiaJiangIcon} className="table-icon" />
          )}
        </span>
      ),
    },
  ];

  return (
  <div className="dashboard-container">
    {/* Stat Cards */}
    <div className="stat-cards-grid">
      {statCards.map((card, index) => (
        <Card key={index} className="stat-card">
          <div className="stat-icon">
            <img src={card.icon} />
          </div>

          <div className="stat-content">
            <div className="stat-value">{card.value}</div>
            <div className="stat-label">{card.label}</div>
          </div>
        </Card>
      ))}
    </div>

    {/* Charts Section */}
    <div className="charts-section">
      {/* Revenue Performance Chart */}
      <Card className="chart-card revenue-chart">
        <div className="chart-header">
          <h3>
            {t("dashboard.charts.revenuePerformance")}{" "}
            (<img src={AEDIcon} className="echarts-icon aed-icon" />)
          </h3>
        </div>
        <ReactECharts
          option={getBarChartOption()}
          style={{ height: "400px" }}
        />
        {/* Growth indicators below chart */}
        <div className="growth-indicators">
          {revenueData.map((item, index) => (
            <div key={index} className="growth-item">
              <span
                className="growth-value"
                style={{ color: item.growth > 0 ? "#52c41a" : "#ff4d4f" }}
              >
                {item.growth > 0 ? (
                  <img src={ShangShengIcon} className="echarts-icon" />
                ) : (
                  <img src={XiaJiangIcon} className="echarts-icon" />
                )}
                {Math.abs(item.growth)}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Service Distribution Chart */}
      <Card className="chart-card distribution-chart">
        <h3>{t("dashboard.charts.serviceDistribution")}</h3>
        <div className="distribution-content">
          <div className="distribution-pie">
            <ReactECharts
              option={getPieChartOption()}
              className="distribution-pie-chart"
            />
          </div>
          <div className="distribution-legend">
            {serviceDistribution.map((item, index) => {
              const isSelected = selectedLegends[item.name];
              return (
                <div
                  key={index}
                  onClick={() => toggleLegend(item.name)}
                  className={`distribution-legend-item${
                    isSelected ? "" : " is-disabled"
                  }`}
                >
                  <div className="distribution-legend-info">
                    <span
                      className="distribution-legend-marker"
                      style={{
                        backgroundColor: PIE_CHART_COLORS[index],
                      }}
                    />
                    <span className="distribution-legend-label">
                      {t(`dashboard.categories.${item.name}`)}
                    </span>
                  </div>
                  <span className="distribution-legend-value">
                    {item.value}({item.percentage}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>

    {/* Top Services Table */}
    <Card className="table-card">
      <div className="table-header">
        <h3>{t("dashboard.table.title")}</h3>
        <div className="table-controls">
          <Select
            defaultValue="revenue"
            getPopupContainer={(triggerNode) => triggerNode.parentNode}
            className="select-revenue"
          >
            <Select.Option value="revenue">
              {t("dashboard.table.sortByRevenue")}
            </Select.Option>
            <Select.Option value="applications">
              {t("dashboard.table.sortByApplications")}
            </Select.Option>
          </Select>
          <Select
            getPopupContainer={(triggerNode) => triggerNode.parentNode}
            defaultValue="desc"
            className="select-desc"
          >
            <Select.Option value="desc">{t("dashboard.table.descending")}</Select.Option>
            <Select.Option value="asc">{t("dashboard.table.ascending")}</Select.Option>
          </Select>

          <CustomButton
            customClassName="table-header-btn"
            text={t("dashboard.table.viewAll")}
            variant="outline"
          />
        </div>
      </div>
      <Table
        columns={columns}
        dataSource={tableData}
        pagination={false}
        className="services-table admin-table"
      />
    </Card>

    {/* Performance by Service Category */}
    <Card className="performance-card">
      <h3 className="performance-title">
        {t("dashboard.performance.title")}
      </h3>
      <div className="performance-grid">
        {/* Media Licensing */}
        <div className="category-card">
          <div className="category-header">
            <div className="category-icon">
              <img
                src={JizheIcon}
                alt={t("dashboard.categories.mediaLicensing")}
              />
            </div>
            <h4>{t("dashboard.categories.mediaLicensing")}</h4>
          </div>
          <div className="category-stats">
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.applications")}</span>
              <span className="stat-value">11,233</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">
                {t("dashboard.performance.revenue")} <img src={AEDHuiIcon} className="echarts-icon aed-icon" />
              </span>
              <span className="stat-value">145K</span>
            </div>
          </div>
          <div className="category-stats">
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.approvalRate")}</span>
              <span className="stat-value">96.3%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.satisfaction")}</span>
              <span className="stat-value">95.2%</span>
            </div>
          </div>
        </div>

        {/* Film & Content Production */}
        <div className="category-card">
          <div className="category-header">
            <div className="category-icon">
              <img
                src={MoivesIcon}
                alt={t("dashboard.categories.filmProduction")}
              />
            </div>
            <h4>{t("dashboard.categories.filmProduction")}</h4>
          </div>
          <div className="category-stats">
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.applications")}</span>
              <span className="stat-value">11,233</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">
                {t("dashboard.performance.revenue")} <img src={AEDHuiIcon} className="echarts-icon aed-icon" />
              </span>
              <span className="stat-value">145K</span>
            </div>
          </div>
          <div className="category-stats">
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.approvalRate")}</span>
              <span className="stat-value">96.3%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.satisfaction")}</span>
              <span className="stat-value">95.2%</span>
            </div>
          </div>
        </div>

        {/* Foreign Media & Correspondents */}
        <div className="category-card">
          <div className="category-header">
            <div className="category-icon">
              <img
                src={JizheIcon}
                alt={t("dashboard.categories.foreignMedia")}
              />
            </div>
            <h4>{t("dashboard.categories.foreignMedia")}</h4>
          </div>
          <div className="category-stats">
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.applications")}</span>
              <span className="stat-value">11,233</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">
                {t("dashboard.performance.revenue")} <img src={AEDHuiIcon} className="echarts-icon aed-icon" />
              </span>
              <span className="stat-value">145K</span>
            </div>
          </div>
          <div className="category-stats">
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.approvalRate")}</span>
              <span className="stat-value">96.3%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.satisfaction")}</span>
              <span className="stat-value">95.2%</span>
            </div>
          </div>
        </div>

        {/* Publication & Distribution */}
        <div className="category-card">
          <div className="category-header">
            <div className="category-icon">
              <img
                src={TaskListIcon}
                alt={t("dashboard.categories.publication")}
              />
            </div>
            <h4>{t("dashboard.categories.publication")}</h4>
          </div>
          <div className="category-stats">
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.applications")}</span>
              <span className="stat-value">11,233</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">
                {t("dashboard.performance.revenue")} <img src={AEDHuiIcon} className="echarts-icon aed-icon" />
              </span>
              <span className="stat-value">145K</span>
            </div>
          </div>
          <div className="category-stats">
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.approvalRate")}</span>
              <span className="stat-value">96.3%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.satisfaction")}</span>
              <span className="stat-value">95.2%</span>
            </div>
          </div>
        </div>

        {/* Video Games */}
        <div className="category-card">
          <div className="category-header">
            <div className="category-icon">
              <img
                src={GameIcon}
                alt={t("dashboard.categories.videoGames")}
              />
            </div>
            <h4>{t("dashboard.categories.videoGames")}</h4>
          </div>
          <div className="category-stats">
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.applications")}</span>
              <span className="stat-value">11,233</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">
                {t("dashboard.performance.revenue")} <img src={AEDHuiIcon} className="echarts-icon aed-icon" />
              </span>
              <span className="stat-value">145K</span>
            </div>
          </div>
          <div className="category-stats">
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.approvalRate")}</span>
              <span className="stat-value">96.3%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.satisfaction")}</span>
              <span className="stat-value">95.2%</span>
            </div>
          </div>
        </div>

        {/* Digital & Social Media */}
        <div className="category-card">
          <div className="category-header">
            <div className="category-icon">
              <img
                src={WwwwIcon}
                alt={t("dashboard.categories.digitalMedia")}
              />
            </div>
            <h4>{t("dashboard.categories.digitalMedia")}</h4>
          </div>
          <div className="category-stats">
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.applications")}</span>
              <span className="stat-value">11,233</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">
                {t("dashboard.performance.revenue")} <img src={AEDHuiIcon} className="echarts-icon aed-icon" />
              </span>
              <span className="stat-value">145K</span>
            </div>
          </div>
          <div className="category-stats">
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.approvalRate")}</span>
              <span className="stat-value">96.3%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">{t("dashboard.performance.satisfaction")}</span>
              <span className="stat-value">95.2%</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  </div>
);
}

export default MyDashboard;
