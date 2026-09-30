export const COMPACT_TOOLBAR_MEDIA_QUERY = "(max-width: 1919.98px)";
export const NARROW_TOOLBAR_MEDIA_QUERY = "(max-width: 1439.98px)";
export const RESPONSIVE_DESKTOP_FILTER_COUNT = 3;
export const RESPONSIVE_NARROW_FILTER_COUNT = 1;

export const splitResponsiveFilterItems = <T>(
  items: readonly T[],
  inlineFilterCount: number,
) => {
  const visibleCount = Math.max(0, inlineFilterCount);

  return {
    inlineItems: items.slice(0, visibleCount),
    modalItems: items.slice(visibleCount),
  };
};

export const getResponsiveFilterTableLayout = (viewportWidth: number) => {
  const isCompact = viewportWidth < 1920;
  const isNarrow = viewportWidth < 1440;

  return {
    inlineFilterCount: isNarrow
      ? RESPONSIVE_NARROW_FILTER_COUNT
      : RESPONSIVE_DESKTOP_FILTER_COUNT,
    searchWidth: isNarrow || !isCompact ? 320 : 240,
    controlHeight: isCompact ? 40 : 48,
    showModalLabels: isNarrow,
  };
};
