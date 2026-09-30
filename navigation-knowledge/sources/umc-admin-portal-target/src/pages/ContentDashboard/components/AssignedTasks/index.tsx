import { TablePanel } from "@/components/common"
import { Tooltip } from "antd"
import type { ColumnType } from "antd/lib/table"
import { useTranslation } from "react-i18next"
import './index.less'

export const AssignedTasks = () => {
  const { t } = useTranslation()
  const columns: ColumnType<Record<string, any>>[] = [
    {
      title: t("Content.contentApplications.table.applicationNo"),
      dataIndex: "applicationNumber",
      key: "applicationNumber",
      align: "center",
    },
    {
      title: t("Content.contentApplications.table.serviceName"),
      dataIndex: "serviceNameEn",
      key: "serviceNameEn",
      ellipsis: {
        showTitle: false,
      },
      render: (text: string) => {
        return (
          <Tooltip
            title={text}
            color={"#fff"}
            overlayInnerStyle={{ backgroundColor: "#fff", color: "#000" }}
            placement="topLeft"
          >
            {text || "-"}
          </Tooltip>
        )
      },
    },
    {
      title: t("Content.contentApplications.table.applyFor"),
      dataIndex: "applyForEn",
      width: 200,
      key: "applyForEn",
      render: (text: string) => {
        return (
          <div className="user-name">
            <img
              src={""}
              alt=""
            />
            <span>{text}</span>
          </div>
        )
      },
    },
    {
      title: t("Content.contentApplications.table.status"),
      dataIndex: "status",
      key: "status",
      width: 150,
    },
    {
      title: t("Content.contentApplications.table.sla"),
      dataIndex: "slaDescription",
      key: "slaDescription",
      sorter: true,
    },
  ]

  return <div className="assigned-tasks">
    <div className="tasks-title">
      <b>{t("adminDashboard.sections.recentlyAssignedTasks")}</b>
      <span>{"->"}</span>
    </div>
    <TablePanel tableProps={{ columns }} />
  </div>
}
