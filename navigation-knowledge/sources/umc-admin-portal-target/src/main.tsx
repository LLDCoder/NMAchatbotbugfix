import React from "react";
import ReactDOM from "react-dom";
import { Router } from "react-router-dom";
import { Table } from "antd";
import "@/utils/urlParsePolyfill";
import { history } from "@/utils/history";
import App from "./App";

/** Ant Design Table defaults `showSorterTooltip` to true; disable globally so sortable headers (e.g. SLA) do not show hover tooltips. Pass `showSorterTooltip` on a Table to override. */
const TableWithDefaults = Table as typeof Table & {
  defaultProps?: { rowKey?: string; showSorterTooltip?: boolean };
};
TableWithDefaults.defaultProps = {
  ...TableWithDefaults.defaultProps,
  showSorterTooltip: false,
};
import { initAppConfig } from "@/config/appConfig";
import { bootstrapAuthToken } from "@/services/authBootstrap";
import { applyLayoutWideScreenCssVariables } from "@/config/layoutWideScreenMode";
import { installClientErrorReporting } from "@/utils/clientLog";

import "./index.css";

/*
  The app used to scale itself proportionally: the root font-size was set to
  (viewportWidth / baseWidth) * 16 here, and postcss-pxtorem rewrote every
  authored px into rem, so the whole UI shrank as one. That made a fixed 24px --
  which the responsive spec is written in -- impossible to express.

  Both halves are gone now. The root font-size stays at the browser default and
  px mean px, so the breakpoint rules in the stylesheets decide what happens at
  each width. See docs/responsive-migration.md.

  applyLayoutWideScreenCssVariables stays: --layout-wide-screen-base-width
  provides the default width constraints used by the centered and legacy
  layouts. Fluid mode overrides those constraints at the Layout root. This is a
  layout concern and never had anything to do with font scaling.
*/
applyLayoutWideScreenCssVariables();
bootstrapAuthToken();
installClientErrorReporting();

Promise.allSettled([initAppConfig()])
  .finally(() => {
    const tree = (
      <React.StrictMode>
        <Router history={history}>
          <App />
        </Router>
      </React.StrictMode>
    );

    ReactDOM.render(tree, document.getElementById("root"));

    // Hand stale-asset recovery over to lazyWithRetry: the inline script in
    // index.html only backstops failures that happen before this point.
    (
      window as Window & { __ADMIN_PORTAL_APP_MOUNTED__?: boolean }
    ).__ADMIN_PORTAL_APP_MOUNTED__ = true;
  });
