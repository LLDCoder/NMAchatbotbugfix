import React from "react";
import { Table } from "antd";
import type { TableProps } from "antd/es/table";
import "./index.less";

export type TablePanelStatus = "default" | "success" | "warning" | "error";

export interface TableSummaryItem {
  label?: React.ReactNode;
  value?: React.ReactNode;
  description?: React.ReactNode;
  status?: TablePanelStatus;
  onClick?: () => void;
}

export interface TablePanelProps<RecordType extends Object = any> {
  summaryItems?: TableSummaryItem[];
  tableProps: TableProps<RecordType>;
  className?: string;
  style?: React.CSSProperties;
}

const TablePanel = <RecordType extends object = any>(
  props: TablePanelProps<RecordType>
) => {
  const { summaryItems, tableProps, className = "", style } = props;

  return (
    <div className={`table-panel admin-table ${className}`} style={style}>
      {summaryItems && summaryItems.length > 0 && (
        <div className="stats-row">
          {summaryItems.map((item, index) => {
            return (
              <div key={index} className={`stat-item stat-${item.status}`}>
                <span className="stat-label">{item.label}</span>
                <span className="stat-count">{item.value}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="table-panel-body">
        <Table {...tableProps} />
      </div>
    </div>
  );
};

export default TablePanel;
