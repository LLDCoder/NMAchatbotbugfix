import type { ReactNode } from 'react';
import shrinkIcon from '@/assets/images/shrink_icon.svg';
import cardHeaderCollapseIcon from '@/pages/CustomerRefundsDetails/assets/icons/card_header_collapse.svg';
import cardHeaderExpandIcon from '@/pages/CustomerRefundsDetails/assets/icons/card_header_expand.svg';

import './DetailCardHeader.less';

export type DetailCardHeaderProps = {
  title: ReactNode;
  open: boolean;
  onToggle?: () => void;
  showChevron?: boolean;
  showExpandIcon?: boolean;
  onExpand?: () => void;
  showShrinkIcon?: boolean;
  onShrink?: () => void;
  isPreview?: boolean;
  rootClassName?: string;
  rootPreviewClassName?: string;
  titleClassName?: string;
  actionsClassName?: string;
  chevronClassName?: string;
  chevronOpenClassName?: string;
  expandClassName?: string;
  expandButtonAriaLabel?: string;
  shrinkClassName?: string;
  shrinkButtonAriaLabel?: string;
};

export function DetailCardHeader({
  title,
  open,
  onToggle,
  showChevron,
  showExpandIcon = false,
  onExpand,
  showShrinkIcon = false,
  onShrink,
  isPreview = false,
  rootClassName = 'inspection-task-details__section-header',
  rootPreviewClassName = 'inspection-task-details__section-header--preview',
  titleClassName = 'inspection-task-details__section-title',
  actionsClassName = 'inspection-task-details__section-actions',
  chevronClassName = 'inspection-task-details__section-chevron',
  chevronOpenClassName = 'is-open',
  expandClassName = 'inspection-task-details__section-expand',
  expandButtonAriaLabel,
  shrinkClassName = 'inspection-task-details__section-shrink',
  shrinkButtonAriaLabel,
}: DetailCardHeaderProps) {
  const isToggleable = Boolean(onToggle);
  const shouldShowChevron = showChevron ?? isToggleable;
  const shouldShowExpand = Boolean(showExpandIcon && onExpand);
  const shouldShowShrink = Boolean(showShrinkIcon && onShrink);
  const mergedRootClassName = [
    'inspection-common-detail-card-header',
    rootClassName,
    !isToggleable ? 'inspection-common-detail-card-header--static' : '',
    isPreview ? `inspection-common-detail-card-header--preview ${rootPreviewClassName}`.trim() : '',
  ].join(' ').trim();
  const mergedTitleClassName = `inspection-common-detail-card-header__title ${titleClassName}`.trim();
  const mergedActionsClassName = `inspection-common-detail-card-header__actions ${actionsClassName}`.trim();
  const mergedChevronClassName = `inspection-common-detail-card-header__chevron ${chevronClassName}`.trim();
  const mergedExpandClassName = `inspection-common-detail-card-header__expand ${expandClassName}`.trim();
  const mergedShrinkClassName = `inspection-common-detail-card-header__shrink ${shrinkClassName}`.trim();

  const content = (
    <>
      <span className={mergedTitleClassName}>{title}</span>
      <span className={mergedActionsClassName}>
        {shouldShowChevron ? (
          <span
            className={`${mergedChevronClassName} ${open ? chevronOpenClassName : ''}`.trim()}
            aria-hidden="true"
          >
            <img src={cardHeaderCollapseIcon} alt="" />
          </span>
        ) : null}
        {shouldShowExpand ? (
          <span
            className={mergedExpandClassName}
            onClick={(event) => {
              event.stopPropagation();
              onExpand?.();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onExpand?.();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={expandButtonAriaLabel}
          >
            <img src={cardHeaderExpandIcon} alt="" />
          </span>
        ) : null}
        {shouldShowShrink ? (
          <span
            className={mergedShrinkClassName}
            onClick={(event) => {
              event.stopPropagation();
              onShrink?.();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onShrink?.();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={shrinkButtonAriaLabel}
          >
            <img src={shrinkIcon} alt="" />
          </span>
        ) : null}
      </span>
    </>
  );

  if (isToggleable) {
    return (
      <button
        type="button"
        className={mergedRootClassName}
        onClick={onToggle}
        aria-expanded={open}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={mergedRootClassName}>
      {content}
    </div>
  );
}
