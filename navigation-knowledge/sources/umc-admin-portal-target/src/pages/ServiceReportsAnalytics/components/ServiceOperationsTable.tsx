import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Table } from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PaginationTotal } from "@/components/common";
import CurrencyLabel from "@/components/common/CurrencyLabel";
import { TABLE_PAGE_SIZE_OPTIONS } from "../constants";
import type {
  AnalyticsSortOrder,
  AnalyticsTableChange,
  SelectOption,
  ServiceDepartmentOption,
  ServiceOperationsRow,
  ServiceScopeOption,
} from "../type";
import MetricTrend from "./MetricTrend";
import TableToolbar from "./TableToolbar";

interface ServiceOperationsTableProps {
  loading: boolean;
  rows: ServiceOperationsRow[];
  total: number;
  pageIndex: number;
  pageSize: number;
  keyword: string;
  scope: ServiceScopeOption;
  scopeOptions: SelectOption<ServiceScopeOption>[];
  department: ServiceDepartmentOption;
  departmentOptions: SelectOption<ServiceDepartmentOption>[];
  sortField?: string;
  sortOrder?: AnalyticsSortOrder;
  onKeywordChange: (value: string) => void;
  onScopeChange: (value: ServiceScopeOption) => void;
  onDepartmentChange: (value: ServiceDepartmentOption) => void;
  onTableChange: (change: AnalyticsTableChange) => void;
  onExport: () => void;
  isExporting?: boolean;
}

export default function ServiceOperationsTable({
  loading,
  rows,
  total,
  pageIndex,
  pageSize,
  keyword,
  scope,
  scopeOptions,
  department,
  departmentOptions,
  sortField,
  sortOrder,
  onKeywordChange,
  onScopeChange,
  onDepartmentChange,
  onTableChange,
  onExport,
  isExporting,
}: ServiceOperationsTableProps) {
  const { t: translate } = useTranslation();

  const columns = useMemo<ColumnsType<ServiceOperationsRow>>(() => {
    const resolveSortOrder = (key: string) => {
      if (sortField !== key) {
        return null;
      }

      return sortOrder === "asc" ? "ascend" : "descend";
    };

    return [
      {
        title:
          scope === "AllCategories"
            ? translate("serviceReportsAnalytics.tables.serviceCategory")
            : translate("serviceReportsAnalytics.tables.serviceName"),
        dataIndex: "serviceName",
        key: "serviceName",
        width: 218,
        render: (_, record) =>
          scope === "AllCategories"
            ? record.serviceCategory
            : record.serviceName,
      },
      {
        title: translate("serviceReportsAnalytics.tables.applications"),
        dataIndex: "applications",
        key: "Applications",
        width: 129,
        sorter: true,
        sortOrder: resolveSortOrder("Applications"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: (
          <CurrencyLabel
            label={translate("serviceReportsAnalytics.tables.totalRevenueAed")}
          />
        ),
        dataIndex: "totalRevenue",
        key: "TotalRevenue",
        width: 170,
        sorter: true,
        sortOrder: resolveSortOrder("TotalRevenue"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("serviceReportsAnalytics.tables.approvalRate"),
        dataIndex: "approvalRate",
        key: "ApprovalRate",
        width: 140,
        sorter: true,
        sortOrder: resolveSortOrder("ApprovalRate"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("serviceReportsAnalytics.tables.avgProcessingTime"),
        dataIndex: "avgProcessingTime",
        key: "AvgProcessingTime",
        width: 185,
        sorter: true,
        sortOrder: resolveSortOrder("AvgProcessingTime"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("serviceReportsAnalytics.tables.avgSatisfaction"),
        dataIndex: "avgSatisfaction",
        key: "AvgSatisfaction",
        width: 154,
        sorter: true,
        sortOrder: resolveSortOrder("AvgSatisfaction"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("serviceReportsAnalytics.tables.refundApplications"),
        dataIndex: "refundApplications",
        key: "RefundApplications",
        width: 180,
        sorter: true,
        sortOrder: resolveSortOrder("RefundApplications"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: (
          <CurrencyLabel
            label={translate("serviceReportsAnalytics.tables.totalRefundsAed")}
          />
        ),
        dataIndex: "totalRefunds",
        key: "TotalRefunds",
        width: 167,
        sorter: true,
        sortOrder: resolveSortOrder("TotalRefunds"),
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("serviceReportsAnalytics.tables.refundRate"),
        dataIndex: "refundRate",
        key: "RefundRate",
        width: 129,
        sorter: true,
        sortOrder: resolveSortOrder("RefundRate"),
        render: (value) => <MetricTrend metric={value} />,
      },
    ];
  }, [scope, sortField, sortOrder, translate]);

  const handleTableChange: TableProps<ServiceOperationsRow>["onChange"] = (
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
    <div className="service-reports__table-section">
      <TableToolbar
        keyword={keyword}
        onKeywordChange={onKeywordChange}
        onExport={onExport}
        isExporting={isExporting}
        selects={[
          {
            value: scope,
            options: scopeOptions,
            onChange: (value) => onScopeChange(value as ServiceScopeOption),
          },
          ...(scope === "AllServices"
            ? [
                {
                  value: department,
                  options: departmentOptions,
                  onChange: (value: string) =>
                    onDepartmentChange(value as ServiceDepartmentOption),
                },
              ]
            : []),
        ]}
      />
      <Table<ServiceOperationsRow>
        className="service-reports__table-container service-reports__table-container--service-operations admin-table"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1472 }}
        pagination={{
          size: "default",
          current: pageIndex,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
          showTotal: (totalValue) => (
            <PaginationTotal label={translate("common.total")} total={totalValue} current={pageIndex} pageSize={pageSize} />
          ),
        }}
        onChange={handleTableChange}
      />
    </div>
  );
}
