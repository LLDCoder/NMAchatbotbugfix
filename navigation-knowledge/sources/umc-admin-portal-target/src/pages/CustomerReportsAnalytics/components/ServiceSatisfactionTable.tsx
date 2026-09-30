import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/localization/config";
import { Button, Input, Table } from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PaginationTotal } from "@/components/common";
import type { ServiceSatisfactionRow, AnalyticsSortOrder } from "../type";
import Sousuo from "@/assets/icons/Sousuo";

interface ServiceSatisfactionTableProps {
  loading: boolean;
  rows: ServiceSatisfactionRow[];
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

export default function ServiceSatisfactionTable({
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
}: ServiceSatisfactionTableProps) {
  const { t: translate } = useTranslation();

  const columns = useMemo<ColumnsType<ServiceSatisfactionRow>>(() => {
    const resolveSortOrder = (key: string) => {
      if (sortBy !== key) return null;
      if (sortDirection === "asc") return "ascend";
      if (sortDirection === "desc") return "descend";
      return null;
    };

    return [
      {
        title: translate("customerReportsAnalytics.tables.serviceName"),
        key: "serviceName",
        width: 200,
        render: (_: unknown, row: ServiceSatisfactionRow) =>
          i18n.resolvedLanguage === "ar" ? (row.serviceNameAr || row.serviceNameEn) : row.serviceNameEn,
      },
      {
        title: translate("customerReportsAnalytics.tables.satisfactionRate"),
        dataIndex: "satisfactionRate",
        key: "satisfactionRate",
        width: 140,
        sorter: true,
        sortOrder: resolveSortOrder("satisfactionRate"),
        render: (value: number) => `${Number(value).toFixed(1)}%`,
      },
      {
        title: translate("customerReportsAnalytics.tables.avgRating"),
        dataIndex: "avgRating",
        key: "avgRating",
        width: 110,
        sorter: true,
        sortOrder: resolveSortOrder("avgRating"),
        render: (value: number) => Number(value).toFixed(1),
      },
      {
        title: translate("customerReportsAnalytics.tables.complaint"),
        dataIndex: "complaintCount",
        key: "complaintCount",
        width: 110,
        sorter: true,
        sortOrder: resolveSortOrder("complaintCount"),
      },
      {
        title: translate("customerReportsAnalytics.tables.suggestion"),
        dataIndex: "suggestionCount",
        key: "suggestionCount",
        width: 110,
        sorter: true,
        sortOrder: resolveSortOrder("suggestionCount"),
      },
      {
        title: translate("customerReportsAnalytics.tables.inquiry"),
        dataIndex: "inquiryCount",
        key: "inquiryCount",
        width: 100,
        sorter: true,
        sortOrder: resolveSortOrder("inquiryCount"),
      },
      {
        title: translate("customerReportsAnalytics.tables.refund"),
        dataIndex: "refundCount",
        key: "refundCount",
        width: 90,
        sorter: true,
        sortOrder: resolveSortOrder("refundCount"),
      },
      {
        title: translate("customerReportsAnalytics.tables.refundRate"),
        dataIndex: "refundRate",
        key: "refundRate",
        width: 110,
        sorter: true,
        sortOrder: resolveSortOrder("refundRate"),
        render: (value: number) => `${Number(value).toFixed(2)}%`,
      },
    ];
  }, [translate, sortBy, sortDirection]);

  const handleTableChange: TableProps<ServiceSatisfactionRow>["onChange"] = (
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
      <Table<ServiceSatisfactionRow>
        className="content-reports__table-container admin-table"
        rowKey="serviceId"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 970 }}
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
