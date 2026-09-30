import { useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { normalizeRoutePath } from "@/routes/access";
import { KeepAliveContext, KeepAliveItemContext } from "./context";

type FrozenLocation = {
  pathname: string;
  search: string;
};

type KeepAliveRouteStateOptions = {
  restorePathname: string;
  restoreFrom: string[];
  requireEmptySearch?: boolean;
  restoreStateKey?: string;
};

export default function useKeepAliveRouteState({
  restorePathname,
  restoreFrom,
  requireEmptySearch = true,
  restoreStateKey,
}: KeepAliveRouteStateOptions) {
  const location = useLocation();
  const history = useHistory();
  const { activeKey, prevActiveKey } = useContext(KeepAliveContext);
  const { cacheKey } = useContext(KeepAliveItemContext);
  const activated = activeKey === cacheKey;
  const [restoreConsumed, setRestoreConsumed] = useState(false);
  const [pendingRestoredLocation, setPendingRestoredLocation] =
    useState<FrozenLocation | null>(null);
  const [frozenLocation, setFrozenLocation] = useState<FrozenLocation>(() => ({
    pathname: location.pathname,
    search: location.search,
  }));
  const restoreState =
    location.state && typeof location.state === "object"
      ? (location.state as Record<string, unknown>)
      : null;
  const allowRestore =
    restoreStateKey === undefined ? true : restoreState?.[restoreStateKey] === true;
  const normalizedRestorePathname = normalizeRoutePath(restorePathname);
  const normalizedLocationPathname = normalizeRoutePath(location.pathname);
  const canRestoreFromPreviousRoute = restoreFrom.some(
    (path) => normalizeRoutePath(path) === prevActiveKey,
  );

  // Reuse the last cached search state only for explicit "back to list" restores.
  const shouldRestoreRouteState =
    activated &&
    !restoreConsumed &&
    normalizedLocationPathname === normalizedRestorePathname &&
    (!requireEmptySearch || !location.search) &&
    canRestoreFromPreviousRoute &&
    allowRestore &&
    Boolean(frozenLocation.search);

  const isWaitingForRestoredLocation =
    Boolean(pendingRestoredLocation) &&
    (location.pathname !== pendingRestoredLocation?.pathname ||
      location.search !== pendingRestoredLocation?.search);
  const isRestoringRouteState =
    shouldRestoreRouteState || isWaitingForRestoredLocation;

  useEffect(() => {
    if (activated) return;

    setRestoreConsumed(false);
    setPendingRestoredLocation(null);
  }, [activated]);

  useEffect(() => {
    if (!shouldRestoreRouteState) return;

    const restoredLocation = frozenLocation;
    setRestoreConsumed(true);
    setPendingRestoredLocation(restoredLocation);
    history.replace({
      pathname: restoredLocation.pathname,
      search: restoredLocation.search,
      state: location.state,
    });
  }, [
    frozenLocation,
    history,
    location.state,
    shouldRestoreRouteState,
  ]);

  useEffect(() => {
    if (
      !pendingRestoredLocation ||
      location.pathname !== pendingRestoredLocation.pathname ||
      location.search !== pendingRestoredLocation.search
    ) {
      return;
    }

    setPendingRestoredLocation(null);
  }, [location.pathname, location.search, pendingRestoredLocation]);

  useEffect(() => {
    if (!activated || isRestoringRouteState) return;

    // Keep the latest live location so the cached page can resume from it later.
    setFrozenLocation({
      pathname: location.pathname,
      search: location.search,
    });
  }, [
    activated,
    isRestoringRouteState,
    location.pathname,
    location.search,
  ]);

  const effectiveLocation = useMemo(
    () =>
      activated && !isRestoringRouteState
        ? {
            pathname: location.pathname,
            search: location.search,
          }
        : frozenLocation,
    [
      activated,
      frozenLocation,
      isRestoringRouteState,
      location.pathname,
      location.search,
    ],
  );

  return {
    activated,
    effectiveLocation,
    effectivePathname: effectiveLocation.pathname,
    effectiveSearch: effectiveLocation.search,
    isRestoringRouteState,
  };
}
