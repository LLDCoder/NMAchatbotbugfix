import assert from "node:assert/strict";
import test from "node:test";
import { captureReaderPageContext } from "../src/components/AIChatBot/model/readerPageContext.ts";

const element = (text, key = null, shown = true) => ({
  textContent: text,
  getClientRects: () => shown ? [{}] : [],
  getAttribute: () => key,
  querySelector: () => null,
});
const root = (tabs = [], rows = [], filters = []) => ({ querySelectorAll: (query) =>
  query.startsWith('[role="tab"]') ? tabs : query.startsWith('[data-reader-filter-name]') ? filters : rows });

test("captures current route, view and selected identities without row values", () => {
  const result = captureReaderPageContext({ pathname: "/example", search: "?code=REC-123" },
    root([element("To Do")], [element("private business values", "REC-123")]), "Asia/Dubai");
  assert.equal(result.route, "/example");
  assert.deepEqual(result.query, { code: "REC-123" });
  assert.equal(result.view, "To Do");
  assert.deepEqual(result.selectedRecordKeys, ["REC-123"]);
  assert.ok(!JSON.stringify(result).includes("private business values"));
});

test("drops credentials and hidden selection, and does not guess among multiple active tabs", () => {
  const result = captureReaderPageContext({ pathname: "/example", search: "?code=REC-123&accessToken=SECRET" },
    root([element("One"), element("Two")], [element("hidden", "STALE", false)]), "UTC");
  assert.deepEqual(result.query, { code: "REC-123" });
  assert.equal(result.view, "");
  assert.deepEqual(result.selectedRecordKeys, []);
});

test("preserves multiple selections instead of assuming the first row", () => {
  const result = captureReaderPageContext({ pathname: "/example", search: "" },
    root([], [element("", "A"), element("", "B")]), "UTC");
  assert.deepEqual(result.selectedRecordKeys, ["A", "B"]);
});

test("captures only explicitly published applied filters and freezes their values", () => {
  let value = '{"preset":"last_month"}';
  const filter = { getClientRects: () => [{}], getAttribute: (name) =>
    name === "data-reader-filter-name" ? "period" : value };
  const result = captureReaderPageContext({ pathname: "/example", search: "" }, root([], [], [filter]), "UTC");
  value = '{"preset":"today"}';
  assert.deepEqual(result.filters, [{ name: "period", value: '{"preset":"last_month"}' }]);
  assert.ok(Number.isFinite(Date.parse(result.capturedAt)));
});

test("hidden and credential filter values are excluded", () => {
  const filters = [{ getClientRects: () => [], getAttribute: () => "hidden" },
    { getClientRects: () => [{}], getAttribute: (name) => name.endsWith("name") ? "accessToken" : "SECRET" }];
  const result = captureReaderPageContext({ pathname: "/example", search: "" }, root([], [], filters), "UTC");
  assert.deepEqual(result.filters, []);
});


test("department and role switches capture the new selection while prior messages stay frozen", () => {
  let department = "license", role = "officer";
  const filter = (name, read) => ({ getClientRects: () => [{}], getAttribute: (key) =>
    key === "data-reader-filter-name" ? name : read() });
  const page = root([], [], [filter("department", () => department), filter("roleVariant", () => role)]);
  const before = captureReaderPageContext({ pathname: "/dashboard", search: "" }, page, "Asia/Dubai");
  department = "content"; role = "manager";
  const after = captureReaderPageContext({ pathname: "/dashboard", search: "" }, page, "Asia/Dubai");
  assert.deepEqual(before.filters, [{ name: "department", value: "license" }, { name: "roleVariant", value: "officer" }]);
  assert.deepEqual(after.filters, [{ name: "department", value: "content" }, { name: "roleVariant", value: "manager" }]);
  assert.deepEqual(after.selectedRecordKeys, []);
});


test("localized tab labels retain the declared view key without granting scope", () => {
  for (const text of ["To Do", "قيد الإنجاز"]) {
    const tab = { ...element(text), querySelector: () => ({ getAttribute: () => "todo" }) };
    const result = captureReaderPageContext({ pathname: "/example", search: "" }, root([tab]), "UTC");
    assert.equal(result.view, "todo");
    assert.deepEqual(result.selectedRecordKeys, []);
    assert.deepEqual(result.filters, []);
  }
});

test("a stable view key cannot select hidden or ambiguous tab groups", () => {
  const tab = (shown) => ({ ...element("Localized", null, shown), querySelector: () => ({ getAttribute: () => "todo" }) });
  const capture = (tabs) => captureReaderPageContext({ pathname: "/example", search: "" }, root(tabs), "UTC");
  assert.equal(capture([tab(false)]).view, "");
  assert.equal(capture([tab(true), tab(true)]).view, "");
});
