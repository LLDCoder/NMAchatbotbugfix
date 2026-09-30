import type { ReactNode } from "react";
import shrinkIcon from "@/assets/images/shrink_icon.svg";
import collapseIcon from "./assets/collapse.svg";
import expandIcon from "./assets/expand.svg";
import "./index.less";

export interface CollapsibleCardHeaderAction {
  ariaLabel: string;
  onClick: () => void;
  kind?: "expand" | "shrink";
  icon?: string;
}

export interface CollapsibleCardHeaderProps {
  title: ReactNode;
  toggleAriaLabel?: string;
  expanded: boolean;
  onToggle: () => void;
  action?: CollapsibleCardHeaderAction;
  extra?: ReactNode;
  className?: string;
  titleClassName?: string;
}

export default function CollapsibleCardHeader({
  title,
  toggleAriaLabel,
  expanded,
  onToggle,
  action,
  extra,
  className = "",
  titleClassName = "",
}: CollapsibleCardHeaderProps) {
  const hasExtra = extra !== undefined && extra !== null;
  const rootClassName = [
    "collapsible-card-header",
    action ? "collapsible-card-header--with-action" : "",
    hasExtra ? "collapsible-card-header--with-extra" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const renderAction = () =>
    action ? (
      <button
        type="button"
        className="collapsible-card-header__action"
        onClick={action.onClick}
        aria-label={action.ariaLabel}
      >
        <img
          src={
            action.icon ??
            (action.kind === "shrink" ? shrinkIcon : expandIcon)
          }
          alt=""
        />
      </button>
    ) : null;

  if (hasExtra) {
    return (
      <div className={rootClassName}>
        <button
          type="button"
          className="collapsible-card-header__toggle"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={toggleAriaLabel}
        >
          <span
            className={[
              "collapsible-card-header__title",
              titleClassName,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {title}
          </span>
        </button>

        <div className="collapsible-card-header__controls">
          <div className="collapsible-card-header__extra">{extra}</div>
          {renderAction()}
          <button
            type="button"
            className="collapsible-card-header__toggle-icon"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={toggleAriaLabel}
          >
            <span
              className={[
                "collapsible-card-header__chevron",
                expanded
                  ? "collapsible-card-header__chevron--expanded"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden="true"
            >
              <img src={collapseIcon} alt="" />
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <button
        type="button"
        className="collapsible-card-header__toggle"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={toggleAriaLabel}
      >
        <span
          className={[
            "collapsible-card-header__title",
            titleClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {title}
        </span>
        <span
          className={[
            "collapsible-card-header__chevron",
            expanded
              ? "collapsible-card-header__chevron--expanded"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        >
          <img src={collapseIcon} alt="" />
        </span>
      </button>

      {renderAction()}
    </div>
  );
}
