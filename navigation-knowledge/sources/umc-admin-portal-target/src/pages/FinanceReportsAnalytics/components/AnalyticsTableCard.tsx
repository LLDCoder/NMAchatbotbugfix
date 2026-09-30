import type { TableProps } from "antd";
import type { SortOrder } from "antd/es/table/interface";
import type { ColumnsType } from "antd/es/table";
import { Table } from "antd";
import { useTranslation } from "react-i18next";
import { CustomButton } from "@/components/common";
import type { FinanceReportsTranslationKey } from "../type";

interface AnalyticsTableCardProps<T extends object> {
  titleKey: FinanceReportsTranslationKey;
  rows: T[];
  columns: ColumnsType<T>;
  onExport: () => void;
  onTableChange?: TableProps<T>["onChange"];
  isExporting?: boolean;
  sortField?: string;
  sortOrder?: SortOrder;
}

export default function AnalyticsTableCard<T extends object>({
  titleKey,
  rows,
  columns,
  onExport,
  onTableChange,
  isExporting,
  sortField,
  sortOrder,
}: AnalyticsTableCardProps<T>) {
  const { t: translate } = useTranslation();
  const resolvedColumns = columns.map((column) => {
    if (typeof column.key !== "string") {
      return column;
    }

    return {
      ...column,
      sortOrder: sortField === column.key ? sortOrder : null,
    };
  });

  return (
    <div className="finance-reports__table-card finance-reports__card-surface">
      <div className="finance-reports__table-header">
        <div className="finance-reports__card-title">{translate(titleKey)}</div>
        <CustomButton
          variant="outline"
          size="medium"
          text={isExporting ? translate("common.loading") : translate("common.export")}
          customClassName="finance-reports__export-btn"
          onClick={onExport}
          disabled={isExporting}
        />
      </div>
      <Table<T>
        className="finance-reports__table admin-table"
        rowKey={(row) => (row as { id?: string }).id || JSON.stringify(row)}
        columns={resolvedColumns}
        dataSource={rows}
        pagination={false}
        onChange={onTableChange}
      />
    </div>
  );
}
