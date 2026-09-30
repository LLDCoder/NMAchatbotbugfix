import searchStroke1 from "../assets/icons/search_stroke_1.svg";
import searchStroke2 from "../assets/icons/search_stroke_2.svg";
import filterFunnelStroke from "../assets/icons/filter_funnel_stroke.svg";
import expandArrow from "../assets/icons/expand_arrow.svg";

export function SearchIcon() {
  return (
    <span className="refund-inline-icon refund-search-icon" aria-hidden="true">
      <img src={searchStroke1} alt="" className="refund-search-icon-handle" />
      <img src={searchStroke2} alt="" className="refund-search-icon-body" />
    </span>
  );
}

export function FilterIcon() {
  return (
    <span className="refund-inline-icon refund-filter-icon" aria-hidden="true">
      <img src={filterFunnelStroke} alt="" />
    </span>
  );
}

export function ExpandArrowIcon({ open = false }: { open?: boolean }) {
  return (
    <span
      className={`refund-inline-icon refund-expand-arrow ${open ? "is-open" : ""}`}
      aria-hidden="true"
    >
      <img src={expandArrow} alt="" />
    </span>
  );
}
