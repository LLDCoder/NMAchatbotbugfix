import ReactECharts from "echarts-for-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import './index.less'

export const StatusBreakdown = () => {
  const { t } = useTranslation()
  const serviceDistribution = [
    { id: "onTime", label: t("Content.contentDashboard.sla.onTime"), value: 58, percentage: 94.3 },
    { id: "exceeded", label: t("Content.contentDashboard.sla.exceeded"), value: 3, percentage: 5.7 },
  ]

  const [selectedLegends, setSelectedLegends] = useState<{
    [key: string]: boolean;
  }>(() => {
    const initial: { [key: string]: boolean } = {};
    serviceDistribution.forEach((item) => {
      initial[item.id] = true;
    });
    return initial;
  });

  const toggleLegend = (id: string) => {
    setSelectedLegends((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getPieChartOption = () => {
    const colors = [
      "#F5A5A5",
      "#C9A961",
      "#E8B88B",
      "#A8D5A8",
      "#98CFC8",
      "#B8D8B8",
    ];

    const filteredData = serviceDistribution.map((item, index) => ({
        name: item.label,
        value: selectedLegends[item.id] ? item.value : 0,
        itemStyle: {
          color: colors[index % colors.length],
          opacity: selectedLegends[item.id] ? 1 : 0,
        },
      }))
      .filter((item) => item.value > 0);

    const totalValue = filteredData.reduce((sum, item) => sum + item.value, 0);

    return {
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
      legend: {
        show: false,
      },
      series: [
        {
          type: "pie",
          radius: ["60%", "75%"],
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
          top: "42%",
          style: {
            text: totalValue.toString(),
            fill: "#000",
            fontSize: 26,
            fontWeight: 500,
          },
        },
        {
          type: "text",
          left: "center",
          top: "58%",
          style: {
            text: t("Content.contentDashboard.sla.total"),
            textAlign: "center",
            fill: "#999",
            fontSize: 14,
          },
        },
      ],
    };
  };

  return (
    <div className="status-breakdown">
      <div className="breakdown-title">
        <b>{t("Content.contentDashboard.sections.slaStatusBreakdown")}</b>
      </div>
      <div className="breakdown-content">
        <div className="breakdown-item">
          <ReactECharts
            option={getPieChartOption()}
            style={{ height: "120px", width: "120px" }}
          />
          <div>
            {serviceDistribution.map((item, index) => {
              const isSelected = selectedLegends[item.id];
              return (
                <div
                  key={index}
                  onClick={() => toggleLegend(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                    fontSize: "14px",
                    cursor: "pointer",
                    opacity: isSelected ? 1 : 0.4,
                    transition: "opacity 0.3s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        width: "10px",
                        height: "10px",
                        minWidth: "10px",
                        minHeight: "10px",
                        borderRadius: "50%",
                        backgroundColor: [
                          "#F5A5A5",
                          "#C9A961",
                          "#E8B88B",
                          "#A8D5A8",
                          "#98CFC8",
                          "#B8D8B8",
                        ][index],
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    ></span>
                    <span style={{ color: "#333" }}>{item.label}</span>
                  </div>
                  <span style={{ color: "#999", marginLeft: "20px" }}>
                    {item.value}({item.percentage}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
