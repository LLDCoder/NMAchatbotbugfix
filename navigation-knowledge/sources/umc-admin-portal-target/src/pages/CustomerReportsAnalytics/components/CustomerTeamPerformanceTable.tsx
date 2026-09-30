import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Table } from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PaginationTotal } from "@/components/common";
import type { CustomerTeamPerformanceRow, AnalyticsSortOrder } from "../type";
import Sousuo from "@/assets/icons/Sousuo";

interface CustomerTeamPerformanceTableProps {
  loading: boolean;
  rows: CustomerTeamPerformanceRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  searchKeyword: string;
  sortBy?: string;
  sortDirection?: AnalyticsSortOrder;
  onSearchChange: (value: string) => void;
  onTableChange: (page: number, pageSize: number, sortBy?: string, sortDirection?: AnalyticsSortOrder) => void;
  onExport?: () => void;
}

export default function CustomerTeamPerformanceTable({
  loading,
  rows,
  totalCount,
  page,
  pageSize,
  searchKeyword,
  sortBy,
  sortDirection,
  onSearchChange,
  onTableChange,
  onExport,
}: CustomerTeamPerformanceTableProps) {
  const { t: translate } = useTranslation();

  const columns = useMemo<ColumnsType<CustomerTeamPerformanceRow>>(
    () => {
      const resolveSortOrder = (key: string) => {
        if (sortBy !== key) return null;
        if (sortDirection === "asc") return "ascend";
        if (sortDirection === "desc") return "descend";
        return null;
      };

      return [
        {
          title: translate("customerReportsAnalytics.tables.teamMember"),
          dataIndex: "employeeName",
          key: "employeeName",
          width: 180,
        },
        {
          title: translate("customerReportsAnalytics.tables.totalTasks"),
          dataIndex: "totalTasks",
          key: "totalTasks",
          width: 120,
          sorter: true,
          sortOrder: resolveSortOrder("totalTasks"),
        },
        {
          title: translate("customerReportsAnalytics.tables.enquiriesAndComplaints"),
          dataIndex: "complaintsCount",
          key: "complaintsCount",
          width: 180,
          sorter: true,
          sortOrder: resolveSortOrder("complaintsCount"),
        },
        {
          title: translate("customerReportsAnalytics.tables.refunds"),
          dataIndex: "refundsCount",
          key: "refundsCount",
          width: 100,
          sorter: true,
          sortOrder: resolveSortOrder("refundsCount"),
        },
        {
          title: translate("customerReportsAnalytics.tables.appeals"),
          dataIndex: "appealsCount",
          key: "appealsCount",
          width: 100,
          sorter: true,
          sortOrder: resolveSortOrder("appealsCount"),
        },
        {
          title: translate("customerReportsAnalytics.tables.reopenRate"),
          dataIndex: "reopenRate",
          key: "reopenRate",
          width: 130,
          sorter: true,
          sortOrder: resolveSortOrder("reopenRate"),
          render: (value: number) => `${Number(value).toFixed(1)}%`,
        },
        {
          title: translate("customerReportsAnalytics.tables.avgProcessingTime"),
          dataIndex: "avgProcessingTime",
          key: "avgProcessingTime",
          width: 170,
          sorter: true,
          sortOrder: resolveSortOrder("avgProcessingTime"),
          render: (value: { display: string }) => value?.display ?? "-",
        },
        {
          title: translate("customerReportsAnalytics.tables.slaCompliance"),
          dataIndex: "slaComplianceRate",
          key: "slaComplianceRate",
          width: 140,
          sorter: true,
          sortOrder: resolveSortOrder("slaComplianceRate"),
          render: (value: number) => `${Number(value).toFixed(1)}%`,
        },
        {
          title: translate("customerReportsAnalytics.tables.slaBreaches"),
          dataIndex: "slaBreachesCount",
          key: "slaBreachesCount",
          width: 120,
        },
      ];
    },
    [translate, sortBy, sortDirection],
  );

  const handleTableChange: TableProps<CustomerTeamPerformanceRow>["onChange"] = (
    pagination,
    _filters,
    sorter,
    extra,
  ) => {
    const resolvedSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const isSortAction = extra.action === "sort";
    const hasSortOrder =
      resolvedSorter?.order === "ascend" || resolvedSorter?.order === "descend";

    onTableChange(
      pagination.current || 1,
      pagination.pageSize || pageSize,
      isSortAction
        ? hasSortOrder && typeof resolvedSorter?.columnKey === "string"
          ? resolvedSorter.columnKey
          : undefined
        : sortBy,
      isSortAction
        ? resolvedSorter?.order === "ascend"
          ? "asc"
          : resolvedSorter?.order === "descend"
          ? "desc"
          : undefined
        : sortDirection,
    );
  };

  return (
    <>
      <div className="content-reports__toolbar">
        <div className="content-reports__toolbar-left">
          <Input
            allowClear
            value={searchKeyword}
            prefix={<Sousuo className="search-icon" />}
            placeholder={translate("common.search")}
            className="content-reports__search-input"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <div className="content-reports__toolbar-right">
          <Button className="customer-reports__export-btn" onClick={onExport}>
            {translate("customerReportsAnalytics.tables.export")}
          </Button>
        </div>
      </div>
      <Table<CustomerTeamPerformanceRow>
        className="content-reports__table-container admin-table"
        rowKey="rank"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1340 }}
        pagination={{
          size: "default",
          current: page,
          pageSize,
          total: totalCount,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50"],
          showTotal: (total) => (
            <PaginationTotal label={translate("common.total")} total={total} current={page} pageSize={pageSize} />
          ),
        }}
        onChange={handleTableChange}
      />
    </>
  );
}
