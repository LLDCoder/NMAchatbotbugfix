import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input, Table, Tabs, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { TableProps } from "antd";
import type { ColumnsType, ColumnType } from "antd/es/table";
import { CustomButton, PaginationTotal } from "@/components/common";
import { downloadBlobFile, downloadCsvFile } from "@/pages/InspectionCommon/csvExport";
import Sousuo from "@/assets/icons/Sousuo";
import type {
  EmirateBreakdownRow,
  RiskProfileRow,
  TeamPerformanceRow,
} from "../types";
import type {
  TeamPerformancePage,
  TeamPerformanceQueryOptions,
  TeamPerformanceSortField,
} from "../services/api";
import {
  formatCount,
  formatCurrency,
  formatDuration,
  formatPercentage,
} from "../utils";
import { AnalyticsCard } from "./AnalyticsCards";
import { PERMISSION_CODES } from "@/constants/permissionCodes";

const INSPECTION_REPORTS_PATH = "/inspection/reports-analytics";

type SortDirection = "asc" | "desc";
type OperationalTableTab = "emirate" | "team";
type TeamSortKey =
  | "inspectionTasks"
  | "accessSuccessfulRate"
  | "violationsFound"
  | "avgProcessingHours"
  | "slaCompliance"
  | "slaBreaches";

const TEAM_SORT_FIELDS: Record<TeamSortKey, TeamPerformanceSortField> = {
  inspectionTasks: "InspectionTasks",
  accessSuccessfulRate: "AccessSuccessfulRate",
  violationsFound: "ViolationsFound",
  avgProcessingHours: "AvgProcessingTimeMinutes",
  slaCompliance: "SlaCompliance",
  slaBreaches: "SlaBreaches",
};

const compareValues = <T extends object>(
  left: T,
  right: T,
  key: keyof T,
  direction: SortDirection,
) => {
  const leftValue = left[key];
  const rightValue = right[key];
  const multiplier = direction === "asc" ? 1 : -1;

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return (leftValue - rightValue) * multiplier;
  }

  return String(leftValue).localeCompare(String(rightValue)) * multiplier;
};

function SearchToolbar({
  value,
  placeholder,
  onChange,
  onExport,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onExport: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="inspection-reports__table-toolbar">
      <Input
        allowClear
        value={value}
        prefix={<Sousuo className="search-icon" />}
        placeholder={placeholder}
        className="inspection-reports__table-search"
        onChange={(event) => onChange(event.target.value)}
      />
      <CustomButton
        variant="outline"
        size="medium"
        text={t("inspection.common.export")}
        customClassName="inspection-reports__export-button"
        onClick={onExport}
        permissionCode={PERMISSION_CODES.inspection.reports.export}
        permissionRoutePath={INSPECTION_REPORTS_PATH}
      />
    </div>
  );
}

function RiskFactorTags({ factors }: { factors: string[] }) {
  const visibleFactors = factors.slice(0, 2);
  const hiddenFactors = factors.slice(2);
  const tags = (
    <div className="inspection-reports__factor-tags">
      {visibleFactors.map((factor, index) => (
        <span key={`${factor}-${index}`} className="inspection-reports__factor-tag">
          {factor}
        </span>
      ))}
      {hiddenFactors.length > 0 ? (
        <span className="inspection-reports__factor-tag inspection-reports__factor-tag--more">
          {`+${hiddenFactors.length}`}
        </span>
      ) : null}
    </div>
  );

  if (hiddenFactors.length === 0) {
    return tags;
  }

  return (
    <Tooltip
      placement="bottomRight"
      overlayClassName="inspection-reports__factor-tooltip"
      destroyTooltipOnHide
      title={(
        <div className="inspection-reports__factor-tooltip-content">
          {hiddenFactors.map((factor, index) => (
            <span key={`${factor}-${index}`} className="inspection-reports__factor-tooltip-tag">
              {factor}
            </span>
          ))}
        </div>
      )}
    >
      {tags}
    </Tooltip>
  );
}

function EmirateBreakdownContent({
  rows,
  onQuery,
  onExport,
}: {
  rows: EmirateBreakdownRow[];
  onQuery?: (search: string) => Promise<EmirateBreakdownRow[]>;
  onExport?: (search: string) => Promise<Blob>;
}) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [sourceRows, setSourceRows] = useState(rows);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<{ key: keyof EmirateBreakdownRow; direction: SortDirection }>(
    { key: "inspections", direction: "desc" },
  );
  const queryId = useRef(0);

  const requestRows = useCallback(
    (search: string) => {
      if (!onQuery) return;

      const requestId = queryId.current + 1;
      queryId.current = requestId;
      setLoading(true);
      void onQuery(search)
        .then((nextRows) => {
          if (queryId.current === requestId) setSourceRows(nextRows);
        })
        .catch(() => undefined)
        .finally(() => {
          if (queryId.current === requestId) setLoading(false);
        });
    },
    [onQuery],
  );

  useEffect(() => {
    queryId.current += 1;
    setSourceRows(rows);
    setKeyword("");

    if (!onQuery) {
      setLoading(false);
      return undefined;
    }

    requestRows("");
    return () => {
      queryId.current += 1;
    };
  }, [onQuery, requestRows, rows]);

  const data = useMemo(
    () =>
      sourceRows
        .filter((row) => row.emirate.toLowerCase().includes(keyword.trim().toLowerCase()))
        .sort((left, right) => compareValues(left, right, sort.key, sort.direction)),
    [keyword, sourceRows, sort],
  );

  const columns = useMemo<ColumnsType<EmirateBreakdownRow>>(
    () => {
      const sortable = (
        key: keyof EmirateBreakdownRow,
      ): Pick<ColumnType<EmirateBreakdownRow>, "sorter" | "sortOrder"> => ({
        sorter: true,
        sortOrder: sort.key === key ? (sort.direction === "asc" ? "ascend" : "descend") : null,
      });

      return [
        { title: t("inspection.reportsAnalytics.columns.emirate"), dataIndex: "emirate", key: "emirate", width: 220 },
        {
          title: t("inspection.reportsAnalytics.columns.inspections"),
          dataIndex: "inspections",
          key: "inspections",
          width: 160,
          ...sortable("inspections"),
          render: (value: number) => formatCount(value),
        },
        {
          title: t("inspection.reportsAnalytics.columns.violations"),
          dataIndex: "violations",
          key: "violations",
          width: 160,
          ...sortable("violations"),
          render: (value: number) => formatCount(value),
        },
        {
          title: t("inspection.reportsAnalytics.columns.violationRate"),
          dataIndex: "violationRate",
          key: "violationRate",
          width: 170,
          ...sortable("violationRate"),
          render: (value: number) => formatPercentage(value, 1),
        },
        {
          title: t("inspection.reportsAnalytics.columns.finesAed"),
          dataIndex: "fines",
          key: "fines",
          width: 170,
          ...sortable("fines"),
          render: (value: number) => formatCurrency(value),
        },
        {
          title: t("inspection.reportsAnalytics.columns.collected"),
          dataIndex: "collectedRate",
          key: "collectedRate",
          width: 150,
          ...sortable("collectedRate"),
          render: (value: number) => formatPercentage(value, 1),
        },
      ];
    },
    [sort, t],
  );

  const onTableChange: TableProps<EmirateBreakdownRow>["onChange"] = (
    _pagination,
    _filters,
    sorter,
    extra,
  ) => {
    if (extra.action !== "sort") return;
    const result = Array.isArray(sorter) ? sorter[0] : sorter;
    if (typeof result.columnKey !== "string") return;
    const key = result.columnKey as keyof EmirateBreakdownRow;

    setSort((previous) => ({
      key,
      direction:
        result.order === "ascend"
          ? "asc"
          : result.order === "descend"
            ? "desc"
            : previous.key === key && previous.direction === "desc"
              ? "asc"
              : "desc",
    }));
  };

  const exportRows = () => {
    if (onExport) {
      void onExport(keyword.trim())
        .then((file) => downloadBlobFile("Breakdown_By_Emirate_Export.xlsx", file))
        .catch(() => undefined);
      return;
    }

    downloadCsvFile("inspection-emirate-breakdown.csv", [
      [
        t("inspection.reportsAnalytics.columns.emirate"),
        t("inspection.reportsAnalytics.columns.inspections"),
        t("inspection.reportsAnalytics.columns.violations"),
        t("inspection.reportsAnalytics.columns.violationRate"),
        t("inspection.reportsAnalytics.columns.finesAed"),
        t("inspection.reportsAnalytics.columns.collected"),
      ],
      ...data.map((row) => [
        row.emirate,
        row.inspections,
        row.violations,
        formatPercentage(row.violationRate, 1),
        formatCurrency(row.fines),
        formatPercentage(row.collectedRate, 1),
      ]),
    ]);
  };

  const handleSearch = (value: string) => {
    setKeyword(value);
    requestRows(value.trim());
  };

  return (
    <>
      <SearchToolbar
        value={keyword}
        placeholder={t("inspection.common.search")}
        onChange={handleSearch}
        onExport={exportRows}
      />
      <Table<EmirateBreakdownRow>
        className="inspection-reports__table admin-table"
        rowKey="emirate"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        scroll={{ x: 1030 }}
        onChange={onTableChange}
      />
    </>
  );
}

function TeamPerformanceContent({
  rows,
  totalCount,
  onQuery,
  onExport,
}: {
  rows: TeamPerformanceRow[];
  totalCount: number;
  onQuery?: (options: TeamPerformanceQueryOptions) => Promise<TeamPerformancePage>;
  onExport?: (options: TeamPerformanceQueryOptions) => Promise<Blob>;
}) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(1);
  const [sourceRows, setSourceRows] = useState(rows);
  const [sourceTotalCount, setSourceTotalCount] = useState(totalCount);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<{ key: TeamSortKey; direction: SortDirection }>(
    { key: "inspectionTasks", direction: "desc" },
  );
  const queryId = useRef(0);

  useEffect(() => {
    queryId.current += 1;
    setSourceRows(rows);
    setSourceTotalCount(totalCount);
    setKeyword("");
    setPageIndex(1);
    setPageSize(10);
    setSort({ key: "inspectionTasks", direction: "desc" });

    if (!onQuery) {
      setLoading(false);
      return undefined;
    }

    const requestId = queryId.current + 1;
    queryId.current = requestId;
    setLoading(true);
    void onQuery({
      pageIndex: 1,
      pageSize: 10,
      sortField: "InspectionTasks",
      sortOrder: "desc",
    })
      .then((result) => {
        if (queryId.current !== requestId) return;
        setSourceRows(result.rows);
        setSourceTotalCount(result.totalCount);
      })
      .catch(() => undefined)
      .finally(() => {
        if (queryId.current === requestId) setLoading(false);
      });

    return () => {
      queryId.current += 1;
    };
  }, [onQuery, rows, totalCount]);

  const data = useMemo(
    () => {
      if (onQuery) return sourceRows;

      return sourceRows
        .filter((row) => row.teamMember.toLowerCase().includes(keyword.trim().toLowerCase()))
        .sort((left, right) => compareValues(left, right, sort.key, sort.direction));
    },
    [keyword, onQuery, sourceRows, sort],
  );

  const requestPage = (options: TeamPerformanceQueryOptions) => {
    if (!onQuery) return;

    const requestId = queryId.current + 1;
    queryId.current = requestId;
    setLoading(true);
    void onQuery(options)
      .then((result) => {
        if (queryId.current !== requestId) return;
        setSourceRows(result.rows);
        setSourceTotalCount(result.totalCount);
      })
      .catch(() => undefined)
      .finally(() => {
        if (queryId.current === requestId) setLoading(false);
      });
  };

  const createQuery = (
    overrides: Partial<TeamPerformanceQueryOptions> = {},
  ): TeamPerformanceQueryOptions => ({
    search: keyword.trim() || undefined,
    pageIndex,
    pageSize,
    sortField: TEAM_SORT_FIELDS[sort.key],
    sortOrder: sort.direction,
    ...overrides,
  });

  const columns = useMemo<ColumnsType<TeamPerformanceRow>>(
    () => {
      const sortable = (
        key: TeamSortKey,
      ): Pick<ColumnType<TeamPerformanceRow>, "sorter" | "sortOrder"> => ({
        sorter: true,
        sortOrder: sort.key === key ? (sort.direction === "asc" ? "ascend" : "descend") : null,
      });

      return [
        { title: t("inspection.reportsAnalytics.columns.teamMember"), dataIndex: "teamMember", key: "teamMember", width: 250 },
        {
          title: t("inspection.reportsAnalytics.columns.inspectionTasks"),
          dataIndex: "inspectionTasks",
          key: "inspectionTasks",
          width: 170,
          ...sortable("inspectionTasks"),
          render: (value: number) => formatCount(value),
        },
        {
          title: t("inspection.reportsAnalytics.columns.successfulAccessRate"),
          dataIndex: "accessSuccessfulRate",
          key: "accessSuccessfulRate",
          width: 205,
          ...sortable("accessSuccessfulRate"),
          render: (value: number) => formatPercentage(value, 1),
        },
        {
          title: t("inspection.reportsAnalytics.columns.violationsFound"),
          dataIndex: "violationsFound",
          key: "violationsFound",
          width: 175,
          ...sortable("violationsFound"),
          render: (value: number) => formatCount(value),
        },
        {
          title: t("inspection.reportsAnalytics.columns.avgProcessingTime"),
          dataIndex: "avgProcessingHours",
          key: "avgProcessingHours",
          width: 190,
          ...sortable("avgProcessingHours"),
          render: (value: number) => formatDuration(value),
        },
        {
          title: t("inspection.reportsAnalytics.columns.slaCompliance"),
          dataIndex: "slaCompliance",
          key: "slaCompliance",
          width: 160,
          ...sortable("slaCompliance"),
          render: (value: number) => formatPercentage(value, 1),
        },
        {
          title: t("inspection.reportsAnalytics.columns.slaBreaches"),
          dataIndex: "slaBreaches",
          key: "slaBreaches",
          width: 145,
          ...sortable("slaBreaches"),
          render: (value: number) => formatCount(value),
        },
      ];
    },
    [sort, t],
  );

  const onTableChange: TableProps<TeamPerformanceRow>["onChange"] = (
    pagination,
    _filters,
    sorter,
    extra,
  ) => {
    const isSort = extra.action === "sort";
    const nextPageSize = pagination.pageSize || pageSize;
    const nextPageIndex = isSort ? 1 : pagination.current || 1;
    let nextSort = sort;

    if (isSort) {
      const result = Array.isArray(sorter) ? sorter[0] : sorter;
      if (typeof result.columnKey === "string") {
        const key = result.columnKey as TeamSortKey;
        nextSort = {
          key,
          direction:
            result.order === "ascend"
              ? "asc"
              : result.order === "descend"
                ? "desc"
                : sort.key === key && sort.direction === "desc"
                  ? "asc"
                  : "desc",
        };
        setSort(nextSort);
      }
    }

    setPageIndex(nextPageIndex);
    setPageSize(nextPageSize);
    requestPage({
      search: keyword.trim() || undefined,
      pageIndex: nextPageIndex,
      pageSize: nextPageSize,
      sortField: TEAM_SORT_FIELDS[nextSort.key],
      sortOrder: nextSort.direction,
    });
  };

  const exportRows = () => {
    if (onExport) {
      void onExport(createQuery())
        .then((file) => downloadBlobFile("Team_Performance_Export.xlsx", file))
        .catch(() => undefined);
      return;
    }

    downloadCsvFile("inspection-team-performance.csv", [
      [
        t("inspection.reportsAnalytics.columns.teamMember"),
        t("inspection.reportsAnalytics.columns.inspectionTasks"),
        t("inspection.reportsAnalytics.columns.successfulAccessRate"),
        t("inspection.reportsAnalytics.columns.violationsFound"),
        t("inspection.reportsAnalytics.columns.avgProcessingTime"),
        t("inspection.reportsAnalytics.columns.slaCompliance"),
        t("inspection.reportsAnalytics.columns.slaBreaches"),
      ],
      ...data.map((row) => [
        row.teamMember,
        row.inspectionTasks,
        formatPercentage(row.accessSuccessfulRate, 1),
        row.violationsFound,
        formatDuration(row.avgProcessingHours),
        formatPercentage(row.slaCompliance, 1),
        row.slaBreaches,
      ]),
    ]);
  };

  return (
    <>
      <SearchToolbar
        value={keyword}
        placeholder={t("inspection.common.search")}
        onChange={(value) => {
          setKeyword(value);
          setPageIndex(1);
          requestPage({
            ...createQuery({ search: value.trim() || undefined, pageIndex: 1 }),
            pageIndex: 1,
          });
        }}
        onExport={exportRows}
      />
      <Table<TeamPerformanceRow>
        className="inspection-reports__table admin-table"
        rowKey={(record, index) => `${record.id}-${index ?? 0}`}
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 1295 }}
        pagination={{
          size: "default",
          current: pageIndex,
          pageSize,
          total: onQuery ? sourceTotalCount : data.length,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50"],
          showTotal: (total) => (
            <PaginationTotal label={t("common.total")} total={total} current={pageIndex} pageSize={pageSize} />
          ),
        }}
        onChange={onTableChange}
      />
    </>
  );
}

export function OperationalAnalyticsTable({
  emirateRows,
  teamRows,
  teamTotalCount,
  onEmirateQuery,
  onEmirateExport,
  onTeamQuery,
  onTeamExport,
}: {
  emirateRows: EmirateBreakdownRow[];
  teamRows: TeamPerformanceRow[];
  teamTotalCount: number;
  onEmirateQuery?: (search: string) => Promise<EmirateBreakdownRow[]>;
  onEmirateExport?: (search: string) => Promise<Blob>;
  onTeamQuery?: (options: TeamPerformanceQueryOptions) => Promise<TeamPerformancePage>;
  onTeamExport?: (options: TeamPerformanceQueryOptions) => Promise<Blob>;
}) {
  const [activeTab, setActiveTab] = useState<OperationalTableTab>("emirate");
  const { t } = useTranslation();

  return (
    <section className="inspection-reports__card inspection-reports__operational-table-card">
      <Tabs
        activeKey={activeTab}
        className="inspection-reports__operational-table-tabs"
        animated={false}
        onChange={(key) => setActiveTab(key as OperationalTableTab)}
      >
        <Tabs.TabPane
          tab={t("inspection.reportsAnalytics.tabs.breakdownByEmirate")}
          key="emirate"
        />
        <Tabs.TabPane
          tab={t("inspection.reportsAnalytics.tabs.teamPerformance")}
          key="team"
        />
      </Tabs>
      <div className="inspection-reports__operational-table-content">
        {activeTab === "emirate" ? (
          <EmirateBreakdownContent
            rows={emirateRows}
            onQuery={onEmirateQuery}
            onExport={onEmirateExport}
          />
        ) : (
          <TeamPerformanceContent
            rows={teamRows}
            totalCount={teamTotalCount}
            onQuery={onTeamQuery}
            onExport={onTeamExport}
          />
        )}
      </div>
    </section>
  );
}

export function HighRiskProfilesTable({ rows }: { rows: RiskProfileRow[] }) {
  const { t } = useTranslation();
  const columns = useMemo<ColumnsType<RiskProfileRow>>(
    () => [
      { title: "", dataIndex: "rank", key: "rank", width: 56 },
      { title: t("inspection.reportsAnalytics.columns.profile"), dataIndex: "profile", key: "profile", width: 265 },
      { title: t("inspection.reportsAnalytics.columns.emirate"), dataIndex: "emirate", key: "emirate", width: 170 },
      {
        title: t("inspection.reportsAnalytics.columns.triggeredFactors"),
        dataIndex: "factors",
        key: "factors",
        render: (factors: string[]) => <RiskFactorTags factors={factors} />,
      },
      {
        title: t("inspection.reportsAnalytics.columns.riskScore"),
        dataIndex: "riskScore",
        key: "riskScore",
        width: 160,
        render: (value: number) => value,
      },
      {
        title: t("inspection.reportsAnalytics.columns.riskLevel"),
        dataIndex: "riskLevel",
        key: "riskLevel",
        width: 150,
        render: (value: RiskProfileRow["riskLevel"]) => (
          <span className={"inspection-reports__risk-tag inspection-reports__risk-tag--" + value.toLowerCase()}>
            {value === "Critical"
              ? t("inspection.reportsAnalytics.labels.critical")
              : t("inspection.reportsAnalytics.labels.high")}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <AnalyticsCard
      title={t("inspection.reportsAnalytics.titles.topHighRiskProfiles")}
      className="inspection-reports__risk-table-card"
    >
      <Table<RiskProfileRow>
        className="inspection-reports__table inspection-reports__table--risk admin-table"
        rowKey="id"
        columns={columns}
        dataSource={rows}
        scroll={{ x: 980 }}
        /* Top-10 list: no pagination (Figma node 44500:74417 annotation). */
        pagination={false}
      />
    </AnalyticsCard>
  );
}
