import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Table } from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PaginationTotal } from "@/components/common";
import TableToolbar from "./TableToolbar";
import { TABLE_PAGE_SIZE_OPTIONS } from "../constants";
import type {
  AnalyticsSortOrder,
  AnalyticsTableChange,
  PermitDistributionItem,
  PermitRow,
} from "../type";

interface PermitTableProps {
  loading: boolean;
  rows: PermitRow[];
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

export default function PermitTable({
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
}: PermitTableProps) {
  const { t: translate } = useTranslation();

  const resolveDistributionColumns = (
    items: PermitDistributionItem[][],
    prefix: string,
    accessor: "geographicDistribution" | "userTypeDistribution",
    dividerLabel?: string,
  ) => {
    const columnLabels = items.reduce<string[]>((result, distributions) => {
      distributions.forEach(({ label }) => {
        if (!result.includes(label)) {
          result.push(label);
        }
      });

      return result;
    }, []);

    return columnLabels.map((label) => ({
      title: label,
      key: `${prefix}-${label}`,
      width: 120,
      align: "center" as const,
      render: (_value: unknown, record: PermitRow) => {
        const match = record[accessor].find((entry) => entry.label === label);

        return `${(match?.percentage ?? 0).toFixed(2)}%`;
      },
      className: dividerLabel && label === dividerLabel
        ? "content-reports__license-divider-cell"
        : "",
    }));
  };

  const columns = useMemo<ColumnsType<PermitRow>>(
    () => {
      const resolveSortOrder = (key: string) => {
        if (sortField !== key || !sortOrder) {
          return null;
        }

        return sortOrder === "asc" ? "ascend" : "descend";
      };

      const mainColumns: ColumnsType<PermitRow> = [
        {
          title: translate("contentReportsAnalytics.tables.permit"),
          dataIndex: "license",
          key: "license",
          width: 280,
          sorter: true,
          sortOrder: resolveSortOrder("license"),
        },
        {
          title: translate("contentReportsAnalytics.tables.issued"),
          dataIndex: "issued",
          key: "issued",
          width: 100,
          align: "center",
          sorter: true,
          sortOrder: resolveSortOrder("issued"),
        },
        {
          title: translate("contentReportsAnalytics.tables.active"),
          dataIndex: "active",
          key: "active",
          width: 100,
          align: "center",
          sorter: true,
          sortOrder: resolveSortOrder("active"),
        },
        {
          title: translate("contentReportsAnalytics.tables.expiringSoon"),
          dataIndex: "expiringSoon",
          key: "expiringSoon",
          width: 140,
          align: "center",
          sorter: true,
          sortOrder: resolveSortOrder("expiringSoon"),
        },
        {
          title: translate("contentReportsAnalytics.tables.expired"),
          dataIndex: "expired",
          key: "expired",
          width: 100,
          align: "center",
          sorter: true,
          sortOrder: resolveSortOrder("expired"),
          className: "content-reports__license-divider-cell",
        },
      ];

      const geographicColumns: ColumnsType<PermitRow> = [
        {
          title: translate("contentReportsAnalytics.tables.geographicDistribution"),
          key: "geographicDistribution",
          className: "content-reports__license-group-divider-header",
          children: rows.length
            ? resolveDistributionColumns(
                rows.map((row) => row.geographicDistribution),
                "geo",
                "geographicDistribution",
                "Foreign",
              )
            : [],
        },
      ];

      const userTypeColumns: ColumnsType<PermitRow> = [
        {
          title: translate("contentReportsAnalytics.tables.userTypeDistribution"),
          key: "userTypeDistribution",
          children: rows.length
            ? resolveDistributionColumns(
                rows.map((row) => row.userTypeDistribution),
                "userType",
                "userTypeDistribution",
              )
            : [],
        },
      ];

      return [...mainColumns, ...geographicColumns, ...userTypeColumns];
    },
    [rows, sortField, sortOrder, translate]
  );

  const handleTableChange: TableProps<PermitRow>["onChange"] = (
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
        ? (resolvedSorter?.columnKey as string) ?? undefined
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
    <div className="content-reports__table-section content-reports__card-surface content-reports__license-table-card">
      <TableToolbar
        keyword={keyword}
        onKeywordChange={onKeywordChange}
        exportLabel={translate("common.export")}
        onExport={onExport}
      />
      <Table<PermitRow>
        className="content-reports__table-container admin-table"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 2300 }}
        showSorterTooltip={false}
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
