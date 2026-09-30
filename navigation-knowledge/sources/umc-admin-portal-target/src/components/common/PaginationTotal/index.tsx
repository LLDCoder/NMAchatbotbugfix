import React from "react";
import "./index.less";

export interface PaginationTotalProps {
  label: React.ReactNode;
  total: number;
  current: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 10;

const toPositiveInt = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;

const PaginationTotal: React.FC<PaginationTotalProps> = ({
  label,
  total,
  current,
  pageSize,
}) => {
  const safeTotal = toPositiveInt(total, 0);
  const safePageSize = toPositiveInt(pageSize, DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safeCurrent = Math.min(toPositiveInt(current, 1), totalPages);

  return (
    <div className="pagination-total">
      <div>
        {label} {safeTotal}
      </div>
      <div>
        {safeCurrent}/{totalPages}
      </div>
    </div>
  );
};

export default PaginationTotal;
