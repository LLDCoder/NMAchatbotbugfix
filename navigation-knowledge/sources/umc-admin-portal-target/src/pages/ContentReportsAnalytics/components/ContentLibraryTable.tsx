import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Table } from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PaginationTotal } from "@/components/common";
import TableToolbar from "./TableToolbar";
import MetricTrend from "./MetricTrend";
import { CONTENT_LIBRARY_SORT_KEYS, TABLE_PAGE_SIZE_OPTIONS } from "../constants";
import type {
  AnalyticsTableChange,
  AnalyticsSortOrder,
  ContentLibraryRow,
} from "../type";

interface ContentLibraryTableProps {
  loading: boolean;
  rows: ContentLibraryRow[];
  total: number;
  pageIndex: number;
  pageSize: number;
  sortField?: string;
  sortOrder?: AnalyticsSortOrder;
  onTableChange: (change: AnalyticsTableChange) => void;
  onExport: () => void;
}

export default function ContentLibraryTable({
  loading,
  rows,
  total,
  pageIndex,
  pageSize,
  sortField,
  sortOrder,
  onTableChange,
  onExport,
}: ContentLibraryTableProps) {
  const { t: translate } = useTranslation();

  const resolveSortOrder = useCallback(
    (key: string) => {
      if (sortField !== key || !sortOrder) {
        return null;
      }
      return sortOrder === "asc" ? "ascend" : "descend";
    },
    [sortField, sortOrder],
  );

  const columns = useMemo<ColumnsType<ContentLibraryRow>>(
    () => [
      {
        title: translate("contentReportsAnalytics.tables.contentCategory"),
        dataIndex: "contentCategory",
        key: "contentCategory",
        width: 220,
        showSorterTooltip: false,
      },
      {
        title: translate("contentReportsAnalytics.tables.libraryItems"),
        dataIndex: "libraryItems",
        key: CONTENT_LIBRARY_SORT_KEYS.libraryItems,
        width: 160,
        sorter: true,
        sortOrder: resolveSortOrder(CONTENT_LIBRARY_SORT_KEYS.libraryItems),
        showSorterTooltip: false,
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("contentReportsAnalytics.tables.approved"),
        dataIndex: "approved",
        key: CONTENT_LIBRARY_SORT_KEYS.approved,
        width: 140,
        sorter: true,
        sortOrder: resolveSortOrder(CONTENT_LIBRARY_SORT_KEYS.approved),
        showSorterTooltip: false,
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("contentReportsAnalytics.tables.rejected"),
        dataIndex: "rejected",
        key: CONTENT_LIBRARY_SORT_KEYS.rejected,
        width: 140,
        sorter: true,
        sortOrder: resolveSortOrder(CONTENT_LIBRARY_SORT_KEYS.rejected),
        showSorterTooltip: false,
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("contentReportsAnalytics.tables.approvalRate"),
        dataIndex: "approvedRate",
        key: CONTENT_LIBRARY_SORT_KEYS.approvedRate,
        width: 160,
        sorter: true,
        sortOrder: resolveSortOrder(CONTENT_LIBRARY_SORT_KEYS.approvedRate),
        showSorterTooltip: false,
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("contentReportsAnalytics.tables.applications"),
        dataIndex: "applications",
        key: CONTENT_LIBRARY_SORT_KEYS.applications,
        width: 140,
        sorter: true,
        sortOrder: resolveSortOrder(CONTENT_LIBRARY_SORT_KEYS.applications),
        showSorterTooltip: false,
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("contentReportsAnalytics.tables.local"),
        dataIndex: "local",
        key: CONTENT_LIBRARY_SORT_KEYS.local,
        width: 130,
        sorter: true,
        sortOrder: resolveSortOrder(CONTENT_LIBRARY_SORT_KEYS.local),
        showSorterTooltip: false,
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("contentReportsAnalytics.tables.import"),
        dataIndex: "import",
        key: CONTENT_LIBRARY_SORT_KEYS.import,
        width: 130,
        sorter: true,
        sortOrder: resolveSortOrder(CONTENT_LIBRARY_SORT_KEYS.import),
        showSorterTooltip: false,
        render: (value) => <MetricTrend metric={value} />,
      },
    ],
    [translate, resolveSortOrder],
  );

  const handleTableChange: TableProps<ContentLibraryRow>["onChange"] = (
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
    <div className="content-reports__table-section content-reports__card-surface content-reports__content-table-card">
      <div className="content-reports__card-title content-reports__content-table-title">
        {translate("contentReportsAnalytics.tables.contentStatisticsByCategory")}
      </div>
      <TableToolbar
        exportLabel={translate("common.export")}
        onExport={onExport}
      />
      <Table<ContentLibraryRow>
        className="content-reports__table-container admin-table"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1220 }}
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
