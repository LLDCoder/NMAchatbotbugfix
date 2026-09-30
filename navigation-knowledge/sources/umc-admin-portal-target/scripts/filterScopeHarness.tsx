// Local browser fixture for the production FilterTable; no business API calls.
import React, { useMemo } from "react";
import ReactDOM from "react-dom";
import { Input, Select } from "antd";
import "antd/dist/antd.css";
import { FilterTable, useFilter } from "../src/components/common/FilterTable";

export function mountFilterScopeHarness() {
  const host = document.getElementById("filter-scope-harness") || document.body.appendChild(document.createElement("div"));
  host.id = "filter-scope-harness";
  host.style.cssText = "position:fixed;left:30px;top:100px;width:500px;background:white;z-index:901";
  document.getElementById("boundary-harness")!.style.zIndex = "900";
  (window as any).__filterScopeRequests = [];
  function Harness() {
    const [store] = useFilter();
    const filters = useMemo(() => [
      { element: <Input key="input-keyword" data-testid="scope-search" placeholder="Search" />, requestDebounceMs: 500 },
      { element: <Select key="select-status" data-testid="scope-status" options={[{ value: "Pending", label: "Pending" }, { value: "Completed", label: "Completed" }]} />, label: "Status" },
      { element: <Select key="select-department" data-testid="scope-department" options={[{ value: "licensing", label: "Licensing" }, { value: "content", label: "Content" }]} />, label: "Department" },
    ], []);
    return <FilterTable filterStore={store} tableFilters={filters} maxVisibleFilters={1}
      request={async () => { (window as any).__filterScopeRequests.push({ ...store.getFieldsValue() }); }}
      columns={[{ title: "Record", dataIndex: "record" }]} dataSource={[]} pagination={false} />;
  }
  ReactDOM.unmountComponentAtNode(host);
  ReactDOM.render(<Harness />, host);
}
