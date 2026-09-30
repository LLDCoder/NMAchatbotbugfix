export const syncPaginationRequestState = <T extends { total: number }>(
  current: T,
  external: T,
): T => ({
  ...external,
  // The external state only carries page/sort intent; the real total comes from
  // the server response tracked in the internal state. Prefer a meaningful
  // external total when one is provided, otherwise keep the last known total.
  total:
    Number.isFinite(external.total) && external.total > 0
      ? external.total
      : current.total,
});
