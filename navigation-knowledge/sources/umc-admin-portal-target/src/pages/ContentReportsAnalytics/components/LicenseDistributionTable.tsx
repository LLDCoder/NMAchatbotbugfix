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
  LicenseDistributionRegionKey,
  LicenseDistributionRow,
  LicenseDistributionUserTypeKey,
} from "../type";

const TEXT = {
  columns: {
    license: "reportsanalytics.tables.license",
    issued: "reportsanalytics.tables.issued",
    active: "reportsanalytics.tables.active",
    expiringSoon: "reportsanalytics.tables.expiringSoon",
    expired: "reportsanalytics.tables.expired",
    geographicDistribution: "reportsanalytics.tables.geographicDistribution",
    userTypeDistribution: "reportsanalytics.tables.userTypeDistribution",
  },
  locations: {
    dubai: "reportsanalytics.options.locations.dubai",
    abuDhabi: "reportsanalytics.options.locations.abuDhabi",
    sharjah: "reportsanalytics.options.locations.sharjah",
    ajman: "reportsanalytics.options.locations.ajman",
    rak: "reportsanalytics.options.locations.rak",
    fujairah: "reportsanalytics.options.locations.fujairah",
    uaq: "reportsanalytics.options.locations.uaq",
    foreign: "reportsanalytics.options.locations.foreign",
  },
  userTypes: {
    commercial: "reportsanalytics.options.userTypes.commercial",
    individual: "reportsanalytics.options.userTypes.individual",
    establishment: "reportsanalytics.options.userTypes.establishment",
    government: "reportsanalytics.options.userTypes.government",
    freeZone: "reportsanalytics.options.userTypes.freeZone",
    talentAgency: "reportsanalytics.options.userTypes.talentAgency",
    embassy: "reportsanalytics.options.userTypes.embassy",
    consulate: "reportsanalytics.options.userTypes.consulate",
    culturalClubs: "reportsanalytics.options.userTypes.culturalClubs",
  },
} as const;

const REGION_COLUMNS: Array<{
  key: LicenseDistributionRegionKey;
  textKey: string;
}> = [
  { key: "dubai", textKey: TEXT.locations.dubai },
  { key: "abuDhabi", textKey: TEXT.locations.abuDhabi },
  { key: "sharjah", textKey: TEXT.locations.sharjah },
  { key: "ajman", textKey: TEXT.locations.ajman },
  { key: "rak", textKey: TEXT.locations.rak },
  { key: "fujairah", textKey: TEXT.locations.fujairah },
  { key: "uaq", textKey: TEXT.locations.uaq },
  { key: "foreign", textKey: TEXT.locations.foreign },
];

const USER_TYPE_COLUMNS: Array<{
  key: LicenseDistributionUserTypeKey;
  textKey: string;
}> = [
  { key: "commercial", textKey: TEXT.userTypes.commercial },
  { key: "individual", textKey: TEXT.userTypes.individual },
  { key: "establishment", textKey: TEXT.userTypes.establishment },
  { key: "government", textKey: TEXT.userTypes.government },
  { key: "freeZone", textKey: TEXT.userTypes.freeZone },
  { key: "talentAgency", textKey: TEXT.userTypes.talentAgency },
  { key: "embassy", textKey: TEXT.userTypes.embassy },
  { key: "consulate", textKey: TEXT.userTypes.consulate },
  { key: "culturalClubs", textKey: TEXT.userTypes.culturalClubs },
];

interface LicenseDistributionTableProps {
  loading: boolean;
  rows: LicenseDistributionRow[];
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

export default function LicenseDistributionTable({
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
}: LicenseDistributionTableProps) {
  const { t: translate } = useTranslation();

  const columns = useMemo<ColumnsType<LicenseDistributionRow>>(
    () => {
      const resolveSortOrder = (key: string) => {
        if (sortField !== key) {
          return null;
        }

        return sortOrder === "asc" ? "ascend" : "descend";
      };

      return [
        {
          title: translate(TEXT.columns.license),
          dataIndex: "license",
          key: "license",
          fixed: "left",
          width: 280,
        },
        {
          title: translate(TEXT.columns.issued),
          dataIndex: "issued",
          key: "issued",
          width: 110,
          sorter: true,
          sortOrder: resolveSortOrder("issued"),
        },
        {
          title: translate(TEXT.columns.active),
          dataIndex: "active",
          key: "active",
          width: 110,
          sorter: true,
          sortOrder: resolveSortOrder("active"),
        },
        {
          title: translate(TEXT.columns.expiringSoon),
          dataIndex: "expiringSoon",
          key: "expiringsoon",
          width: 140,
          sorter: true,
          sortOrder: resolveSortOrder("expiringsoon"),
        },
        {
          title: translate(TEXT.columns.expired),
          dataIndex: "expired",
          key: "expired",
          width: 110,
          sorter: true,
          sortOrder: resolveSortOrder("expired"),
          className: "content-reports__license-divider-col",
          onCell: () => ({
            className: "content-reports__license-divider-cell",
          }),
          onHeaderCell: () => ({
            className: "content-reports__license-divider-cell",
          }),
        },
        {
          title: translate(TEXT.columns.geographicDistribution),
          className: "content-reports__license-group-divider-col",
          onHeaderCell: () => ({
            className: "content-reports__license-group-divider-header",
          }),
          children: REGION_COLUMNS.map((item) => ({
            title: translate(item.textKey),
            key: item.key,
            width: 95,
            className:
              item.key === "foreign"
                ? "content-reports__license-group-divider-col"
                : "",
            onCell: () => ({
              className:
                item.key === "foreign"
                  ? "content-reports__license-group-divider-cell"
                  : "",
            }),
            onHeaderCell: () => ({
              className:
                item.key === "foreign"
                  ? "content-reports__license-group-divider-cell"
                  : "",
            }),
            render: (_: unknown, record: LicenseDistributionRow) =>
              record.geographicDistribution[item.key],
          })),
        },
        {
          title: translate(TEXT.columns.userTypeDistribution),
          children: USER_TYPE_COLUMNS.map((item) => ({
            title: translate(item.textKey),
            key: item.key,
            width: 130,
            render: (_: unknown, record: LicenseDistributionRow) =>
              record.userTypeDistribution[item.key],
          })),
        },
      ];
    },
    [sortField, sortOrder, translate],
  );

  const handleTableChange: TableProps<LicenseDistributionRow>["onChange"] = (
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
    <div className="content-reports__card content-reports__card-surface content-reports__license-table-card">
      <TableToolbar
        keyword={keyword}
        onKeywordChange={onKeywordChange}
        exportLabel={translate("common.export")}
        onExport={onExport}
      />
      <Table<LicenseDistributionRow>
        className="content-reports__table-container admin-table"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 2360 }}
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
