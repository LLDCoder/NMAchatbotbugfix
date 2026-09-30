import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Table } from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PaginationTotal } from "@/components/common";
import MetricTrend from "./MetricTrend";
import StatCards from "./StatCards";
import TableToolbar from "./TableToolbar";
import { TABLE_PAGE_SIZE_OPTIONS } from "../constants";
import type {
  AnalyticsSortOrder,
  AnalyticsTableChange,
  TeamPerformanceRow,
  TeamPerformanceSummary,
} from "../type";

interface TeamPerformanceTableProps {
  loading: boolean;
  rows: TeamPerformanceRow[];
  summary: TeamPerformanceSummary[];
  total: number;
  pageIndex: number;
  pageSize: number;
  keyword: string;
  sortField?: string;
  sortOrder?: AnalyticsSortOrder;
  onKeywordChange: (value: string) => void;
  onTableChange: (change: AnalyticsTableChange) => void;
  onExport: () => void;
}

export default function TeamPerformanceTable({
  loading,
  rows,
  summary,
  total,
  pageIndex,
  pageSize,
  keyword,
  sortField,
  sortOrder,
  onKeywordChange,
  onTableChange,
  onExport,
}: TeamPerformanceTableProps) {
  const { t: translate } = useTranslation();

  const columns = useMemo<ColumnsType<TeamPerformanceRow>>(
    () => {
      const resolveSortOrder = (key: string) => {
        if (sortField !== key) {
          return null;
        }

        return sortOrder === "asc" ? "ascend" : "descend";
      };

      return [
        {
          title: translate("licenseReportsAnalytics.tables.teamMembers"),
          dataIndex: "memberName",
          key: "memberName",
          width: 220,
        },
        {
          title: translate("licenseReportsAnalytics.tables.applicationTasks"),
          dataIndex: "applicationTasks",
          key: "applicationtasks",
          width: 160,
          sorter: true,
          sortOrder: resolveSortOrder("applicationtasks"),
          render: (value) => <MetricTrend metric={value} />,
        },
        {
          title: translate("licenseReportsAnalytics.tables.approvedApplications"),
          dataIndex: "approvedApplications",
          key: "approvedapplications",
          width: 170,
          sorter: true,
          sortOrder: resolveSortOrder("approvedapplications"),
          render: (value) => <MetricTrend metric={value} />,
        },
        {
          title: translate("licenseReportsAnalytics.tables.rejectedApplications"),
          dataIndex: "rejectedApplications",
          key: "rejectedapplications",
          width: 170,
          sorter: true,
          sortOrder: resolveSortOrder("rejectedapplications"),
          render: (value) => <MetricTrend metric={value} />,
        },
        {
          title: translate("licenseReportsAnalytics.tables.approvalRate"),
          dataIndex: "approvalRate",
          key: "approvalrate",
          width: 150,
          sorter: true,
          sortOrder: resolveSortOrder("approvalrate"),
          render: (value) => <MetricTrend metric={value} />,
        },
        {
          title: translate("licenseReportsAnalytics.tables.avgProcessingTime"),
          dataIndex: "avgProcessingTime",
          key: "avgprocessingtime",
          width: 170,
          sorter: true,
          sortOrder: resolveSortOrder("avgprocessingtime"),
          render: (value) => <MetricTrend metric={value} />,
        },
        {
          title: translate("licenseReportsAnalytics.tables.sla"),
          dataIndex: "sla",
          key: "sla",
          width: 120,
          sorter: true,
          sortOrder: resolveSortOrder("sla"),
          render: (value) => <MetricTrend metric={value} />,
        },
        {
          // Not sortable: the API's orderby enum (see services/api.md) covers
          // ApplicationTasks / ApprovedApplications / RejectedApplications /
          // ApprovalRate / AvgProcessingTime / SLA only, so sorting here would
          // send a value the backend rejects.
          title: translate("licenseReportsAnalytics.tables.slaBreaches"),
          dataIndex: "slaBreaches",
          key: "slabreaches",
          width: 150,
          render: (value) => <MetricTrend metric={value} />,
        },
      ];
    },
    [sortField, sortOrder, translate]
  );

  const handleTableChange: TableProps<TeamPerformanceRow>["onChange"] = (
    pagination,
    _filters,
    sorter,
    extra,
  ) => {
    const resolvedSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const isSortAction = extra.action === "sort";

    onTableChange({
      action: extra.action,
      pageIndex: pagination.current || 1,
      pageSize: pagination.pageSize || pageSize,
      sortKey: isSortAction
        ? typeof resolvedSorter?.columnKey === "string"
          ? resolvedSorter.columnKey
          : undefined
        : sortField,
      sort: isSortAction
        ? resolvedSorter?.order === "ascend"
          ? "asc"
          : resolvedSorter?.order === "descend"
            ? "desc"
            : undefined
        : sortOrder,
    });
  };

  return (
    <div className="reports-table-section">
      <StatCards items={summary} compact variant="outlined" />
      <TableToolbar
        keyword={keyword}
        onKeywordChange={onKeywordChange}
        exportLabel={translate("common.export")}
        onExport={onExport}
      />
      <Table<TeamPerformanceRow>
        className="reports-table-container admin-table"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1180 }}
        pagination={{
          size: "default",
          current: pageIndex,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
          showTotal: () => (
            <PaginationTotal
              label={translate("common.total")}
              total={total}
              current={pageIndex}
              pageSize={pageSize}
            />
          ),
        }}
        onChange={handleTableChange}
      />
    </div>
  );
}
