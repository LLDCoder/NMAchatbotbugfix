import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Table } from "antd";
import type { TableProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PaginationTotal } from "@/components/common";
import { TABLE_PAGE_SIZE_OPTIONS } from "../constants";
import type {
  AnalyticsSortOrder,
  AnalyticsTableChange,
  CustomerProfileInsightsRow,
  ServiceScopeOption,
  SelectOption,
} from "../type";
import MetricTrend from "./MetricTrend";
import TableToolbar from "./TableToolbar";

interface CustomerProfileInsightsTableProps {
  loading: boolean;
  rows: CustomerProfileInsightsRow[];
  total: number;
  pageIndex: number;
  pageSize: number;
  keyword: string;
  scope: ServiceScopeOption;
  scopeOptions: SelectOption<ServiceScopeOption>[];
  sortField?: string;
  sortOrder?: AnalyticsSortOrder;
  onKeywordChange: (value: string) => void;
  onScopeChange: (value: ServiceScopeOption) => void;
  onTableChange: (change: AnalyticsTableChange) => void;
  onExport: () => void;
  isExporting?: boolean;
}

export default function CustomerProfileInsightsTable({
  loading,
  rows,
  total,
  pageIndex,
  pageSize,
  keyword,
  scope,
  scopeOptions,
  sortField,
  sortOrder,
  onKeywordChange,
  onScopeChange,
  onTableChange,
  onExport,
  isExporting,
}: CustomerProfileInsightsTableProps) {
  const { t: translate } = useTranslation();

  const columns = useMemo<ColumnsType<CustomerProfileInsightsRow>>(
    () => [
      {
        title:
          scope === "AllCategories"
            ? translate("serviceReportsAnalytics.tables.serviceCategory")
            : translate("serviceReportsAnalytics.tables.serviceName"),
        dataIndex: "serviceName",
        key: "serviceName",
        width: 200,
        render: (_, row) =>
          scope === "AllCategories" ? row.serviceCategory : row.serviceName,
      },
      {
        title: translate("serviceReportsAnalytics.tables.applications"),
        dataIndex: "applications",
        key: "Applications",
        width: 137,
        sorter: true,
        sortOrder:
          sortField === "Applications"
            ? sortOrder === "asc"
              ? "ascend"
              : "descend"
            : null,
        className: "service-reports__customer-divider-cell",
        render: (value) => <MetricTrend metric={value} />,
      },
      {
        title: translate("serviceReportsAnalytics.tables.geographicDistribution"),
        className: "service-reports__customer-group-divider-header",
        children: [
          {
            title: translate("serviceReportsAnalytics.options.locations.dubai"),
            dataIndex: ["geographicDistribution", "dubai"],
            key: "dubai",
            width: 100,
          },
          {
            title: translate("serviceReportsAnalytics.options.locations.abuDhabi"),
            dataIndex: ["geographicDistribution", "abuDhabi"],
            key: "abuDhabi",
            width: 100,
          },
          {
            title: translate("serviceReportsAnalytics.options.locations.sharjah"),
            dataIndex: ["geographicDistribution", "sharjah"],
            key: "sharjah",
            width: 100,
          },
          {
            title: translate("serviceReportsAnalytics.options.locations.ajman"),
            dataIndex: ["geographicDistribution", "ajman"],
            key: "ajman",
            width: 100,
          },
          {
            title: translate("serviceReportsAnalytics.options.locations.rak"),
            dataIndex: ["geographicDistribution", "rak"],
            key: "rak",
            width: 100,
          },
          {
            title: translate("serviceReportsAnalytics.options.locations.fujairah"),
            dataIndex: ["geographicDistribution", "fujairah"],
            key: "fujairah",
            width: 100,
          },
          {
            title: translate("serviceReportsAnalytics.options.locations.uaq"),
            dataIndex: ["geographicDistribution", "uaq"],
            key: "uaq",
            width: 100,
          },
          {
            title: translate("serviceReportsAnalytics.options.locations.foreign"),
            dataIndex: ["geographicDistribution", "foreign"],
            key: "foreign",
            width: 100,
            className: "service-reports__customer-group-divider-cell",
          },
        ],
      },
      {
        title: translate("serviceReportsAnalytics.tables.userTypeDistribution"),
        children: [
          {
            title: translate("serviceReportsAnalytics.options.userTypes.individual"),
            dataIndex: ["userTypeDistribution", "individual"],
            key: "individual",
            width: 120,
          },
          {
            title: translate("serviceReportsAnalytics.options.userTypes.commercial"),
            dataIndex: ["userTypeDistribution", "commercial"],
            key: "commercial",
            width: 120,
          },
          {
            title: translate("serviceReportsAnalytics.options.userTypes.government"),
            dataIndex: ["userTypeDistribution", "government"],
            key: "government",
            width: 120,
          },
          {
            title: translate("serviceReportsAnalytics.options.userTypes.freeZone"),
            dataIndex: ["userTypeDistribution", "freeZone"],
            key: "freeZone",
            width: 120,
          },
          {
            title: translate("serviceReportsAnalytics.options.userTypes.talentAgency"),
            dataIndex: ["userTypeDistribution", "talentAgency"],
            key: "talentAgency",
            width: 127,
          },
          {
            title: translate("serviceReportsAnalytics.options.userTypes.embassy"),
            dataIndex: ["userTypeDistribution", "embassy"],
            key: "embassy",
            width: 120,
          },
          {
            title: translate("serviceReportsAnalytics.options.userTypes.consulate"),
            dataIndex: ["userTypeDistribution", "consulate"],
            key: "consulate",
            width: 120,
          },
          {
            title: translate("serviceReportsAnalytics.options.userTypes.culturalClubs"),
            dataIndex: ["userTypeDistribution", "culturalClubs"],
            key: "culturalClubs",
            width: 125,
          },
        ],
      },
    ],
    [scope, sortField, sortOrder, translate],
  );

  const handleTableChange: TableProps<CustomerProfileInsightsRow>["onChange"] = (
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
    <div className="service-reports__table-section service-reports__table-section--customer-profile">
        <TableToolbar
        keyword={keyword}
        onKeywordChange={onKeywordChange}
        onExport={onExport}
        isExporting={isExporting}
        selects={[
          {
            value: scope,
            options: scopeOptions,
            onChange: (value) =>
              onScopeChange(value as ServiceScopeOption),
          },
        ]}
      />
      <Table<CustomerProfileInsightsRow>
        className="service-reports__table-container service-reports__table-container--customer-profile admin-table"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 2310 }}
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
