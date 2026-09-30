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
          title: translate("contentReportsAnalytics.tables.teamMembers"),
          dataIndex: "teamMember",
          key: "teamMember",
          width: 220,
        },
        {
          title: translate("contentReportsAnalytics.tables.applicationTasks"),
          dataIndex: "applicationTasks",
          key: "ApplicationTasks",
          width: 160,
          sorter: true,
          sortOrder: resolveSortOrder("ApplicationTasks"),
          render: (value) => <MetricTrend metric={value} />,
        },
        {
          title: translate("contentReportsAnalytics.tables.approvedApplications"),
          dataIndex: "approvedApplications",
          key: "ApprovedApplications",
          width: 170,
          sorter: true,
          sortOrder: resolveSortOrder("ApprovedApplications"),
          render: (value) => <MetricTrend metric={value} />,
        },
        {
          title: translate("contentReportsAnalytics.tables.rejectedApplications"),
          dataIndex: "rejectedApplications",
          key: "RejectedApplications",
          width: 170,
          sorter: true,
          sortOrder: resolveSortOrder("RejectedApplications"),
          render: (value) => <MetricTrend metric={value} />,
        },
        {
          title: translate("contentReportsAnalytics.tables.approvalRate"),
          dataIndex: "approvalRate",
          key: "ApprovalRate",
          width: 150,
          sorter: true,
          sortOrder: resolveSortOrder("ApprovalRate"),
          render: (value) => <MetricTrend metric={value} />,
        },
        {
          title: translate("contentReportsAnalytics.tables.avgProcessingTime"),
          dataIndex: "avgProcessingTime",
          key: "AvgProcessingTime",
          width: 170,
          sorter: true,
          sortOrder: resolveSortOrder("AvgProcessingTime"),
          render: (value) => <MetricTrend metric={value} />,
        },
        {
          title: translate("contentReportsAnalytics.tables.sla"),
          dataIndex: "sla",
          key: "SLA",
          width: 120,
          sorter: true,
          sortOrder: resolveSortOrder("SLA"),
          render: (value) => <MetricTrend metric={value} />,
        },
        {
          // Not sortable: the API's orderby enum (see services/api.md) covers
          // ApplicationTasks / ApprovedApplications / RejectedApplications /
          // ApprovalRate / AvgProcessingTime / SLA only, so sorting here would
          // send a value the backend rejects.
          title: translate("contentReportsAnalytics.tables.slaBreaches"),
          dataIndex: "slaBreaches",
          key: "SLABreaches",
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
    <div className="content-reports__table-section">
      <StatCards items={summary} compact variant="outlined" />
      <TableToolbar
        keyword={keyword}
        onKeywordChange={onKeywordChange}
        exportLabel={translate("common.export")}
        onExport={onExport}
      />
      <Table<TeamPerformanceRow>
        className="content-reports__table-container admin-table"
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
