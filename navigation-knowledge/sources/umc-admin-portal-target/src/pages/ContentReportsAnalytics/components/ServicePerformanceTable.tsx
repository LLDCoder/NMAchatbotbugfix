import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Table } from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PaginationTotal } from "@/components/common";
import TableToolbar from "./TableToolbar";
import MetricTrend from "./MetricTrend";
import type {
  AnalyticsTableChange,
  AnalyticsSortOrder,
  ServicePerformanceRow,
} from "../type";
import { TABLE_PAGE_SIZE_OPTIONS } from "../constants";

interface ServicePerformanceTableProps {
  loading: boolean;
  rows: ServicePerformanceRow[];
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

export default function ServicePerformanceTable({
  loading,
  rows,
  total,
  pageIndex,
  pageSize,
  keyword,
  sortField,
  sortOrder,
  onKeywordChange,
  onTableChange,
  onExport,
}: ServicePerformanceTableProps) {
  const { t: translate } = useTranslation();

  const columns = useMemo<ColumnsType<ServicePerformanceRow>>(() => {
    const resolveSortOrder = (key: string) => {
      if (sortField !== key) {
        return null;
      }

      return sortOrder === "asc" ? "ascend" : "descend";
    };

    return [
      {
        title: translate("contentReportsAnalytics.tables.serviceName"),
        dataIndex: "serviceName",
        key: "serviceName",
        width: 220,
        render: (_, record) => record.serviceName,
      },
      {
        title: translate("contentReportsAnalytics.tables.applications"),
        dataIndex: "applications",
        key: "Applications",
        width: 130,
        sorter: true,
        sortOrder: resolveSortOrder("Applications"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("contentReportsAnalytics.tables.totalRevenueAed"),
        dataIndex: "totalRevenue",
        key: "TotalRevenue",
        width: 150,
        sorter: true,
        sortOrder: resolveSortOrder("TotalRevenue"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("contentReportsAnalytics.tables.approvalRate"),
        dataIndex: "approvalRate",
        key: "ApprovalRate",
        width: 140,
        sorter: true,
        sortOrder: resolveSortOrder("ApprovalRate"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("contentReportsAnalytics.tables.avgProcessingTime"),
        dataIndex: "avgProcessingTime",
        key: "AvgProcessingTime",
        width: 160,
        sorter: true,
        sortOrder: resolveSortOrder("AvgProcessingTime"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("contentReportsAnalytics.tables.avgSatisfaction"),
        dataIndex: "avgSatisfaction",
        key: "AvgSatisfaction",
        width: 140,
        sorter: true,
        sortOrder: resolveSortOrder("AvgSatisfaction"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("contentReportsAnalytics.tables.refundApplications"),
        dataIndex: "refundApplications",
        key: "RefundApplications",
        width: 160,
        sorter: true,
        sortOrder: resolveSortOrder("RefundApplications"),
        render: (value) => <MetricTrend metric={value} />,
      },
      // Total Refunds removed per spec §7. Refund Applications and Refund Rate
      // stay — the spec only names this one column.
      {
        title: translate("contentReportsAnalytics.tables.refundRate"),
        dataIndex: "refundRate",
        key: "RefundRate",
        width: 130,
        sorter: true,
        sortOrder: resolveSortOrder("RefundRate"),
        render: (value) => <MetricTrend metric={value} />,
      },
    ];
  }, [sortField, sortOrder, translate]);

  const handleTableChange: TableProps<ServicePerformanceRow>["onChange"] = (
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
      <TableToolbar
        keyword={keyword}
        onKeywordChange={onKeywordChange}
        exportLabel={translate("common.export")}
        onExport={onExport}
      />
      <Table<ServicePerformanceRow>
        className="content-reports__table-container admin-table"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1480 }}
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
