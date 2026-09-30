import searchStrokeHandle from "../assets/icons/toolbar_search_handle.svg";
import searchStrokeBody from "../assets/icons/toolbar_search_body.svg";
import filterFunnelBase from "../assets/icons/toolbar_filter_base.svg";
import filterFunnelOverlay from "../assets/icons/toolbar_filter_overlay.svg";
import expandArrow from "../assets/icons/expand_arrow.svg";

export function AppealSearchIcon() {
  return (
    <span className="appeal-inline-icon appeal-search-icon" aria-hidden="true">
      <img
        src={searchStrokeHandle}
        alt=""
        className="appeal-search-icon__handle"
      />
      <img
        src={searchStrokeBody}
        alt=""
        className="appeal-search-icon__body"
      />
    </span>
  );
}

export function AppealFilterIcon() {
  return (
    <span className="appeal-inline-icon appeal-filter-icon" aria-hidden="true">
      <img
        src={filterFunnelBase}
        alt=""
        className="appeal-filter-icon__base"
      />
      <img
        src={filterFunnelOverlay}
        alt=""
        className="appeal-filter-icon__overlay"
      />
    </span>
  );
}

export function AppealExpandArrowIcon({ open = false }: { open?: boolean }) {
  return (
    <span
      className={`appeal-inline-icon appeal-expand-arrow ${
        open ? "is-open" : ""
      }`}
      aria-hidden="true"
    >
      <img src={expandArrow} alt="" />
    </span>
  );
}
