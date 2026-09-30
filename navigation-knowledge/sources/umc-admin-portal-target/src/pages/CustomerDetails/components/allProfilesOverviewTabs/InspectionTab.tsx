import React, { useMemo } from "react";
import { Empty, Input, Table } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { overviewFigmaAssets } from "@/components/common/ApplicationOverviewCards/assets/overviewFigmaAssets";
import type { InspectionOverviewItem } from "../../types";
import {
  formatOverviewDateTime,
  renderOverviewPriorityPill,
  renderOverviewSearchPrefix,
  renderOverviewStatusPill,
} from "./overviewTabUtils";
import OverviewRenderBoundary from "./OverviewRenderBoundary";
import { useTranslation } from "react-i18next";
import AllOverviewFilterToolbar from "./AllOverviewFilterToolbar";

const getTargetIcon = (targetType?: string) => {
  const normalized = String(targetType || "").toLowerCase();
  if (normalized.includes("individual")) return overviewFigmaAssets.inspectionTargets.user;
  if (normalized.includes("government")) return overviewFigmaAssets.inspectionTargets.government;
  if (normalized.includes("establishment") || normalized.includes("commercial")) {
    return overviewFigmaAssets.inspectionTargets.company;
  }
  return undefined;
};

const InspectionTab: React.FC<{
  searchKey: string;
  onSearchKeyChange: (value: string) => void;
  inspectionTasks?: InspectionOverviewItem[];
  loading?: boolean;
  pagination?: TablePaginationConfig;
  onTableChange?: (
    pagination: TablePaginationConfig,
    sorter: SorterResult<InspectionOverviewItem> | SorterResult<InspectionOverviewItem>[]
  ) => void;
  showApplyFor?: boolean;
}> = ({
  searchKey,
  onSearchKeyChange,
  inspectionTasks,
  loading,
  pagination,
  onTableChange,
}) => {
  const { t } = useTranslation();
  const rows = useMemo(() => inspectionTasks || [], [inspectionTasks]);

  const columns = useMemo<ColumnsType<InspectionOverviewItem>>(
    () => [
      {
        title: t(
          "Customer.customerDetails.allProfilesOverview.inspectionNoFullScan.columns.taskNo",
        ),
        dataIndex: "taskNo",
        key: "taskNo",
        width: 170,
      },
      {
        title: t(
          "Customer.customerDetails.allProfilesOverview.inspectionNoFullScan.columns.inspectionTarget",
        ),
        dataIndex: "inspectionTarget",
        key: "inspectionTarget",
        width: 250,
        render: (_text, row) => {
          const targetIcon = getTargetIcon(row.inspectionTargetType);

          return (
            <span className="overview-target-cell">
              {targetIcon ? (
                <img
                  className="overview-target-cell__icon"
                  src={targetIcon}
                  alt=""
                />
              ) : null}
              <span className="overview-target-cell__content">
                <span className="overview-target-cell__title">{row.inspectionTarget || "-"}</span>
                {row.inspectionTargetMeta ? (
                  <span className="overview-target-cell__meta">{row.inspectionTargetMeta}</span>
                ) : null}
              </span>
            </span>
          );
        },
      },
      {
        title: t(
          "Customer.customerDetails.allProfilesOverview.inspectionNoFullScan.columns.inspectionReason",
        ),
        dataIndex: "inspectionReason",
        key: "inspectionReason",
        width: 190,
      },
      {
        title: t(
          "Customer.customerDetails.allProfilesOverview.inspectionNoFullScan.columns.priority",
        ),
        dataIndex: "priority",
        key: "priority",
        width: 120,
        sorter: true,
        render: (text: string) => renderOverviewPriorityPill(text),
      },
      {
        title: t(
          "Customer.customerDetails.allProfilesOverview.inspectionNoFullScan.columns.dueDate",
        ),
        dataIndex: "dueDate",
        key: "dueDate",
        width: 160,
        sorter: true,
        render: (text: string) => formatOverviewDateTime(text),
      },
      {
        title: t(
          "Customer.customerDetails.allProfilesOverview.inspectionNoFullScan.columns.status",
        ),
        dataIndex: "status",
        key: "status",
        width: 150,
        render: (text: string) => renderOverviewStatusPill(text),
      },
      {
        title: t(
          "Customer.customerDetails.allProfilesOverview.inspectionNoFullScan.columns.assignedTime",
        ),
        dataIndex: "assignedTime",
        key: "assignedTime",
        width: 180,
        render: (text: string) => formatOverviewDateTime(text),
      },
      {
        title: t(
          "Customer.customerDetails.allProfilesOverview.inspectionNoFullScan.columns.inspector",
        ),
        dataIndex: "inspector",
        key: "inspector",
        width: 180,
        render: (text: string) => <span>{text || "-"}</span>,
      },
    ],
    [t],
  );


  return (
    <>
      <OverviewRenderBoundary dependencies={[searchKey]}>
        <AllOverviewFilterToolbar>
          <Input
            allowClear
            prefix={renderOverviewSearchPrefix()}
            placeholder={t(
              "Customer.customerDetails.allProfilesOverview.inspectionNoFullScan.filters.search",
            )}
            value={searchKey}
            className="all-overview-search responsive-filter-toolbar__field responsive-filter-toolbar__field--search responsive-filter-toolbar__field--single-visible-search"
            onChange={(event) => onSearchKeyChange(event.target.value)}
          />

        </AllOverviewFilterToolbar>
      </OverviewRenderBoundary>

      <Table<InspectionOverviewItem>
        className="admin-table all-overview-table"
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={loading}
        pagination={pagination || { pageSize: 10, showSizeChanger: true }}
        tableLayout="fixed"
        locale={{
          emptyText: (
            <Empty
              description={t(
                "Customer.customerDetails.allProfilesOverview.inspectionNoFullScan.empty.noData",
              )}
            />
          ),
        }}
        onChange={(p, _filters, sorter) => {
          onTableChange?.(p, sorter);
        }}
      />
    </>
  );
};

export default InspectionTab;
