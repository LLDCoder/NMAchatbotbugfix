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
        title: translate("licenseReportsAnalytics.tables.serviceName"),
        dataIndex: "serviceName",
        key: "serviceName",
        width: 220,
        render: (_, record) => record.serviceName,
      },
      {
        title: translate("licenseReportsAnalytics.tables.applications"),
        dataIndex: "applications",
        key: "applications",
        width: 130,
        sorter: true,
        sortOrder: resolveSortOrder("applications"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("licenseReportsAnalytics.tables.totalRevenueAed"),
        dataIndex: "totalRevenue",
        key: "totalrevenue",
        width: 150,
        sorter: true,
        sortOrder: resolveSortOrder("totalrevenue"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("licenseReportsAnalytics.tables.approvalRate"),
        dataIndex: "approvalRate",
        key: "approvalrate",
        width: 140,
        sorter: true,
        sortOrder: resolveSortOrder("approvalrate"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("licenseReportsAnalytics.tables.avgProcessingTime"),
        dataIndex: "avgProcessingTime",
        key: "avgprocessingtime",
        width: 160,
        sorter: true,
        sortOrder: resolveSortOrder("avgprocessingtime"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("licenseReportsAnalytics.tables.avgSatisfaction"),
        dataIndex: "avgSatisfaction",
        key: "avgsatisfaction",
        width: 140,
        sorter: true,
        sortOrder: resolveSortOrder("avgsatisfaction"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("licenseReportsAnalytics.tables.refundApplications"),
        dataIndex: "refundApplications",
        key: "refundapplications",
        width: 160,
        sorter: true,
        sortOrder: resolveSortOrder("refundapplications"),
        render: (value) => <MetricTrend metric={value} />,
      },
      // Total Refunds removed per spec §7. Refund Applications and Refund Rate
      // stay — the spec only names this one column.
      {
        title: translate("licenseReportsAnalytics.tables.refundRate"),
        dataIndex: "refundRate",
        key: "refundrate",
        width: 130,
        sorter: true,
        sortOrder: resolveSortOrder("refundrate"),
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
    <div className="reports-table-section">
      <TableToolbar
        keyword={keyword}
        onKeywordChange={onKeywordChange}
        exportLabel={translate("common.export")}
        onExport={onExport}
      />
      <Table<ServicePerformanceRow>
        className="reports-table-container admin-table"
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
