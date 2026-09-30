import { Fragment } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Result } from "antd";
import KeepAlive from "./index";
import KeepAliveItem from "./KeepAliveItem";
import { normalizeRoutePath } from "@/routes/access";

export type KeepAliveRouteGroupItem = {
  path: string;
  element: ReactNode;
  cache: boolean;
};

type KeepAliveRouteGroupProps = {
  routes: KeepAliveRouteGroupItem[];
};

export default function KeepAliveRouteGroup({
  routes,
}: KeepAliveRouteGroupProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const activePath = normalizeRoutePath(location.pathname);
  // Include query params so activation hooks can inspect the previous route context.
  const activeLocationKey = `${activePath}${location.search}`;
  const hasActiveRoute = routes.some(
    (route) => normalizeRoutePath(route.path) === activePath,
  );

  if (!hasActiveRoute) {
    return (
      <div className="route-status">
        <Result
          status="404"
          title="404"
          subTitle={t("routeStatus.pageUnavailable")}
        />
      </div>
    );
  }

  return (
    <KeepAlive activeKey={activePath} activeLocationKey={activeLocationKey}>
      {routes.map((route) => {
        const normalizedRoutePath = normalizeRoutePath(route.path);
        const active = normalizedRoutePath === activePath;

        if (route.cache) {
          // Cache routes keep their subtree mounted across sibling route switches.
          return (
            <KeepAliveItem
              key={route.path}
              cacheKey={normalizedRoutePath}
              active={active}
            >
              {route.element}
            </KeepAliveItem>
          );
        }

        // Non-cached routes still participate in activation tracking, but remount normally.
        return active ? (
          <Fragment key={route.path}>{route.element}</Fragment>
        ) : null;
      })}
    </KeepAlive>
  );
}
