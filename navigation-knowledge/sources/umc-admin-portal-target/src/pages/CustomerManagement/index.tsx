import { Tabs } from "antd";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import useKeepAliveRouteState from "@/components/KeepAlive/useKeepAliveRouteState";
import { CUSTOMER_TAB_LABEL, type TKeyOfCustomerTabLabel } from "./type";
import "./index.less";
import Accounts from "./components/Accounts";
import Profiles from "./components/Profiles";

function parseCustomerTab(search: string): TKeyOfCustomerTabLabel {
  const raw = new URLSearchParams(search).get("tab");
  if (raw === "profiles") return "profiles";
  return "accounts";
}

export default function CustomerManagement() {
  const { t } = useTranslation();
  const history = useHistory();
  const { effectivePathname, effectiveSearch } = useKeepAliveRouteState({
    restorePathname: "/happiness/customerManagement",
    restoreFrom: [
      "/happiness/customerManagement/customer-details",
      "/happiness/customerManagement/customerProfileDetail",
    ],
  });
  const customerTab = useMemo(
    () => parseCustomerTab(effectiveSearch),
    [effectiveSearch],
  );

  const handleTabChange = useCallback(
    (key: string) => {
      const next = key as TKeyOfCustomerTabLabel;
      const params = new URLSearchParams(effectiveSearch);
      if (next === "accounts") {
        params.delete("tab");
      } else {
        params.set("tab", "profiles");
      }
      const qs = params.toString();
      history.replace({
        pathname: effectivePathname,
        search: qs ? `?${qs}` : "",
      });
    },
    [effectivePathname, effectiveSearch, history],
  );

  return (
    <div className="customers-container">
      <Tabs
        className="customers-tabs"
        activeKey={customerTab}
        onChange={handleTabChange}
      >
        {Object.keys(CUSTOMER_TAB_LABEL).map((key: string) => (
          <Tabs.TabPane
            tab={t(
              `Customer.customerManagement.tabs.${CUSTOMER_TAB_LABEL[key as TKeyOfCustomerTabLabel]}`,
            )}
            key={key}
          />
        ))}
      </Tabs>
      <div className="customers-content">
        {customerTab === "accounts" && <Accounts />}
        {customerTab === "profiles" && <Profiles />}
      </div>
    </div>
  );
}
