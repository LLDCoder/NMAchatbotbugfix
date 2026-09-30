export interface ReaderPageContext {
  route: string;
  query: Record<string, string>;
  view: string;
  selectedRecordKeys: string[];
  browserTimezone: string;
  filters: Array<{ name: string; value: string }>;
  capturedAt: string;
}

// Browser state is a navigation hint. The server verifies catalog membership,
// permissions and live records; no page text or business values are scraped.
export function captureReaderPageContext(
  location: Pick<Location, "pathname" | "search">,
  root: ParentNode,
  browserTimezone: string,
): ReaderPageContext {
  const query: Record<string, string> = {};
  new URLSearchParams(location.search).forEach((value, key) => {
    if (Object.keys(query).length < 30 && key.length <= 100 && value.length <= 500
        && !/token|password|secret|cookie|authorization|email|phone|passport/i.test(key)) {
      query[key] = value;
    }
  });
  const visible = (node: Element) => node.getClientRects().length > 0;
  const tabs = Array.from(root.querySelectorAll('[role="tab"][aria-selected="true"]')).filter(visible);
  const keys = Array.from(root.querySelectorAll(
    '[data-row-key][aria-selected="true"], [data-row-key]:has(input[type="checkbox"]:checked)',
  )).filter(visible).map((node) => node.getAttribute("data-row-key") || "");
  // Page components explicitly publish applied filter state. Never scrape
  // arbitrary form values or treat draft/unsubmitted controls as active filters.
  const filters = Array.from(root.querySelectorAll("[data-reader-filter-name][data-reader-filter-value]"))
    .filter(visible).map((node) => ({
      name: node.getAttribute("data-reader-filter-name") || "",
      value: node.getAttribute("data-reader-filter-value") || "",
    })).filter(({ name, value }) => name.length > 0 && name.length <= 100 && value.length <= 500
      && !/token|password|secret|cookie|authorization|email|phone|passport/i.test(name)).slice(0, 20);
  return {
    route: location.pathname,
    query,
    // A page may publish a locale-independent view key; the server still
    // verifies it against documented views and the freshly observed tab.
    view: tabs.length === 1 ? (tabs[0].getAttribute("data-reader-view")
      || tabs[0].querySelector("[data-reader-view]")?.getAttribute("data-reader-view")
      || tabs[0].textContent || "").trim().slice(0, 300) : "",
    selectedRecordKeys: Array.from(new Set(keys.filter((key) => key && key.length <= 300))).slice(0, 20),
    browserTimezone,
    filters,
    capturedAt: new Date().toISOString(),
  };
}
