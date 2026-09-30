import type { FC } from "react";
import "./index.less";

/** A cleared select, an empty range picker and a blank input all read as "not filtered". */
export const isAppliedFilterValue = (value: unknown): boolean => {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) {
    return (
      value.length > 0 &&
      value.some((entry) => entry !== undefined && entry !== null && entry !== "")
    );
  }
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
};

/** How many of these values count as an applied filter. */
export const countAppliedFilters = (values: unknown[]): number =>
  values.filter(isAppliedFilterValue).length;

interface FilterCountBadgeProps {
  /** Number of filters currently applied. Nothing renders when it is 0. */
  count?: number | null;
  className?: string;
}

/**
 * Trailing count on a "Filter" trigger, telling the user how many attributes
 * are filtered inside the panel the button opens. The inline filters a page
 * already shows are deliberately not counted — the badge exists to surface the
 * state that is hidden behind the button.
 */
const FilterCountBadge: FC<FilterCountBadgeProps> = ({ count, className }) => {
  if (!count || count <= 0) return null;

  return (
    <span className={["filter-count-badge", className].filter(Boolean).join(" ")}>
      {count}
    </span>
  );
};

export default FilterCountBadge;
