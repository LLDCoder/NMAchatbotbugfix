import asyncio
import importlib.util
import os
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException
from pydantic import ValidationError


os.environ["UMC_PORTAL"] = "admin"
MODULE_PATH = Path(__file__).parents[2] / "platform-gateway" / "app.py"
SPEC = importlib.util.spec_from_file_location("admin_reader_platform_gateway", MODULE_PATH)
assert SPEC and SPEC.loader
gateway = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = gateway
SPEC.loader.exec_module(gateway)


def read_request(actions=None, **overrides):
    payload = {
        "startPath": "/licensing",
        "actions": actions or [{"type": "observe"}],
        "expectedFields": [],
    }
    payload.update(overrides)
    return gateway.AdminPortalReadRequest.model_validate(payload)


@pytest.mark.parametrize("settings", [{"value": "R-1"}, {"value": ""}, {"values": ["R-1"]},
                                      {"filters": {"Search": "R-1"}}, {"parameters": {"Search": "R-1"}}])
def test_query_rejects_filter_values_instead_of_silently_ignoring_them(settings):
    with pytest.raises(HTTPException) as error:
        gateway._validate_reader_request(read_request([{"type": "query", "field": "Search", **settings}]))
    assert error.value.status_code == 422
    assert error.value.detail["code"] == "reader_query_cannot_apply_filters"


def test_openapi_documents_query_filter_value_boundary():
    properties = gateway.app.openapi()["components"]["schemas"]["PortalReadAction"]["properties"]
    assert "query reads existing values" in properties["type"]["description"]
    assert "Not permitted on query" in properties["value"]["description"]
    assert "not permitted on query" in properties["values"]["description"]


def test_settle_waits_for_pending_read_response_without_clearing_its_health():
    class Page:
        _reader_health = {'pending': {1:'/api/example/list'}, 'failed': {}}
    async def run():
        async def finish():
            await asyncio.sleep(0.01)
            Page._reader_health['pending'].clear()
        task=asyncio.create_task(finish())
        await gateway._settle_reader_requests(Page(),0.5)
        await task
        assert not Page._reader_health['pending']
    asyncio.run(run())


def test_settle_timeout_retains_pending_and_failed_evidence():
    class Page:
        _reader_health = {'pending': {1:'/api/example/list'}, 'failed': {'/api/example/failure':1}}
    asyncio.run(gateway._settle_reader_requests(Page(),0.01))
    assert Page._reader_health['pending'] == {1:'/api/example/list'}
    assert Page._reader_health['failed'] == {'/api/example/failure':1}


def test_settle_ignores_explicit_background_paths():
    class Page:
        _reader_health = {'pending': {1:'/api/clientlog/report'}}
    asyncio.run(gateway._settle_reader_requests(Page(),0.5))
    assert Page._reader_health['pending']


def test_settle_adapter_without_health_is_compatible():
    asyncio.run(gateway._settle_reader_requests(object(),0.5))


def test_settle_waits_for_read_started_after_tab_click_returns():
    class Page:
        _reader_health = {'pending': {}, 'failed': {}}
    async def run():
        finished = asyncio.Event()
        async def delayed_read():
            await asyncio.sleep(0.05)
            Page._reader_health['pending'][1] = '/api/example/list'
            await asyncio.sleep(0.1)
            Page._reader_health['pending'].clear()
            finished.set()
        task = asyncio.create_task(delayed_read())
        await gateway._settle_reader_requests(Page(),1)
        assert finished.is_set()
        await task
    asyncio.run(run())


def test_settle_stable_window_restarts_for_second_read_wave():
    class Page:
        _reader_health = {'pending': {}, 'failed': {}}
    async def run():
        finished = asyncio.Event()
        async def waves():
            for request_id in [1,2]:
                await asyncio.sleep(0.15)
                Page._reader_health['pending'][request_id] = '/api/example/list'
                await asyncio.sleep(0.1)
                Page._reader_health['pending'].clear()
            finished.set()
        task = asyncio.create_task(waves())
        await gateway._settle_reader_requests(Page(),1.5)
        assert finished.is_set()
        await task
    asyncio.run(run())


def admin_user_info(*, roles=True, pages=True):
    return {
        "data": {
            "id": "admin-7",
            "rolesInfo": [{"roleName": "Licensing Manager"}] if roles else [],
            "listRoles": [{"nameEn": "Manager"}] if roles else [],
            "listSysPermission": [
                {
                    "frontendRoute": "/licensing",
                    "children": [{"frontendRoute": "/licensing/tasks/:id"}],
                    "buttonList": [{"permissionCode": "licensing.view_detail"}],
                }
            ] if pages else [],
            "dataScope": {"scope": "team"},
        }
    }


def error_code(exc: HTTPException) -> str:
    return exc.detail["code"]


class FakeRequest:
    def __init__(self, method, url, resource_type="xhr"):
        self.method = method
        self.url = url
        self.resource_type = resource_type


class FakeRoute:
    def __init__(self, method, url, resource_type="xhr"):
        self.request = FakeRequest(method, url, resource_type)
        self.result = None

    async def abort(self, reason):
        self.result = ("abort", reason)

    async def continue_(self):
        self.result = ("continue", None)


class FakeLocator:
    def __init__(
        self, *, descriptor="Next", role="", tag="button", rel=None, aria_controls=None,
        aria_expanded=None, aria_selected=None, aria_sort=None, input_type=None, visible=True,
    ):
        self.first = self
        self.last = self
        self.descriptor = descriptor
        self.attributes = {
            "aria-label": descriptor,
            "title": None,
            "role": role,
            "rel": rel,
            "aria-controls": aria_controls,
            "aria-expanded": aria_expanded,
            "aria-selected": aria_selected,
            "aria-sort": aria_sort,
            "type": input_type,
        }
        self.tag = tag
        self.visible = visible
        self.clicked = False
        self.filled = None
        self.selected = None

    async def count(self):
        return 1

    def nth(self, index):
        return self

    async def get_attribute(self, name):
        return self.attributes.get(name)

    async def inner_text(self):
        return self.descriptor

    async def is_visible(self):
        return self.visible

    async def evaluate(self, script):
        return self.tag

    async def click(self, timeout):
        self.clicked = True

    async def fill(self, value, timeout):
        self.filled = value

    async def select_option(self, *, label, timeout):
        self.selected = label

    def locator(self, selector):
        return self

    def get_by_label(self, label, exact=True):
        return self

    def get_by_role(self, role, **kwargs):
        return self


class FakeLocatorGroup:
    def __init__(self, *locators):
        self.locators = locators
        self.first = locators[0] if locators else FakeLocator()
        self.last = locators[-1] if locators else FakeLocator()

    async def count(self):
        return len(self.locators)

    def nth(self, index):
        return self.locators[index]

    def get_by_role(self, role, **kwargs):
        matches = []
        for locator in self.locators:
            nested = locator.get_by_role(role, **kwargs)
            matches.extend(nested.locators)
        return FakeLocatorGroup(*matches)


class FakeBadgedTab(FakeLocator):
    def __init__(self, descriptor, *, parts=None, active=False, on_click=True, aria_selected=None, state_class="item--active", data_state=None):
        super().__init__(descriptor=descriptor, role="tab", aria_selected=aria_selected)
        self.parts = parts
        self.attributes["class"] = state_class if active else "item"
        self.attributes["data-state"] = data_state
        self.state_class = state_class
        self.on_click = on_click
        self.group = [self]
        self.scripts = []

    def active(self):
        if self.attributes.get("aria-selected") is not None:
            return self.attributes["aria-selected"] == "true"
        return self.attributes.get("data-state") in {"active", "selected"} or any(
            token in {"active", "selected", "is-active", "is-selected"} or token.endswith(("--active", "--selected"))
            for token in self.attributes.get("class", "").split()
        )

    async def evaluate(self, script):
        self.scripts.append(script)
        if "looseText" in script:
            return self.parts
        if "groupLabels" in script:
            active = [tab for tab in self.group if tab.visible and tab.active()]
            return {"selected": len(self.group) >= 2 and len(active) == 1 and active[0] is self,
                    "native": False, "groupSize": len(self.group), "groupLabels": [tab.descriptor for tab in self.group]}
        return self.tag

    async def click(self, timeout):
        self.clicked = True
        if self.on_click:
            for tab in self.group:
                tab.attributes["class"] = "item"
                tab.attributes["data-state"] = None
            self.attributes["class"] = self.state_class


class FakeTabHeading(FakeLocator):
    def __init__(self, scope=None, visible=True):
        super().__init__(role="heading", visible=visible)
        self.scope = scope
        self.selectors = []

    def locator(self, selector):
        self.selectors.append(selector)
        assert selector == "xpath=ancestor::*[self::section or @role='region'][1]"
        return FakeLocatorGroup(self.scope) if self.scope else FakeLocatorGroup()


class FakeTabPage:
    def __init__(self, tabs=(), sections=None, headings=None, visible=True):
        self.tabs = tabs
        self.sections = sections or {}
        self.headings = headings or {}
        self.visible = visible
        self.lookups = []
        for tab in tabs:
            tab.group = list(tabs)

    def get_by_role(self, role, name=None, exact=False):
        self.lookups.append((role, name, exact))
        if role == "region":
            region = self.sections.get(name)
            return FakeLocatorGroup(*(region if isinstance(region, list) else [region] if region else []))
        if role == "heading":
            return FakeLocatorGroup(*self.headings.get(name, []))
        return FakeLocatorGroup(*(tab for tab in self.tabs if tab.attributes.get("role") == role and (
            name.search(tab.descriptor) if hasattr(name, "search") else tab.descriptor == name
        )))

    def locator(self, selector):
        if selector == "[role='tab'][aria-selected='true']":
            return FakeLocatorGroup(*(tab for tab in self.tabs if tab.attributes.get("aria-selected") == "true"))
        if selector == "[role='tab']:not([aria-selected])":
            return FakeLocatorGroup(*(tab for tab in self.tabs if tab.attributes.get("aria-selected") is None))
        return FakeLocatorGroup()

    async def is_visible(self):
        return self.visible


class FakeDetailRow:
    def __init__(self, *, visible=True, text="Record row", count=1):
        self.first = self
        self.visible = visible
        self.text = text
        self.row_count = count

    async def count(self):
        return self.row_count

    async def is_visible(self):
        return self.visible

    async def inner_text(self):
        return self.text


class FakeDetailCell(FakeLocator):
    def __init__(self, *, descriptor="APP-123", tag="td", visible=True, row_visible=True, row_text="APP-123 Active", row_count=1, count=1):
        super().__init__(descriptor=descriptor, tag=tag, visible=visible)
        self.row = FakeDetailRow(visible=row_visible, text=row_text, count=row_count)
        self.cell_count = count

    async def count(self):
        return self.cell_count

    def locator(self, selector):
        return self.row if selector == "xpath=ancestor::tr[1]" else super().locator(selector)


class FakeDetailNavigationPage:
    def __init__(self, url, *, detail_identity="APP-123", identity_visible=True):
        self.url = url
        self.detail_identity = detail_identity
        self.identity_visible = identity_visible

    def get_by_text(self, text, exact=True):
        return FakeQueryLocator([(text, self.identity_visible and text == self.detail_identity)])


class FakePage:
    def __init__(self, locator):
        self.result = locator

    def locator(self, selector):
        return self.result

    def get_by_role(self, role, **kwargs):
        return self.result

    def get_by_label(self, label, exact=True):
        return self.result

    def get_by_text(self, text, exact=True):
        return self.result


class FakeQueryLocator:
    def __init__(self, values, index=0):
        self.values = values
        self.index = index

    async def count(self):
        return len(self.values)

    def nth(self, index):
        return FakeQueryLocator(self.values, index)

    async def is_visible(self):
        value = self.values[self.index]
        return value[1] if isinstance(value, tuple) else True

    async def inner_text(self):
        value = self.values[self.index]
        return value[0] if isinstance(value, tuple) else value


class FakeObservationLocator:
    def __init__(self, values, index=0):
        self.values = values
        self.index = index

    async def count(self):
        return len(self.values)

    def nth(self, index):
        return FakeObservationLocator(self.values, index)

    async def is_visible(self):
        return self.values[self.index][1]

    async def inner_text(self):
        return self.values[self.index][0]

    async def get_attribute(self, name):
        value = self.values[self.index]
        return value[2].get(name) if len(value) > 2 else None

    def locator(self, selector):
        return FakeObservationLocator([])


class FakeObservationContainer:
    def __init__(self, rows, *, tag="table", visible=True, aria_busy=None, heading="", parent_index=None):
        self.rows = rows
        self.tag = tag
        self.visible = visible
        self.aria_busy = aria_busy
        self.heading = heading
        self.parent_index = parent_index

    async def is_visible(self):
        return self.visible

    async def get_attribute(self, name):
        if name == "aria-busy":
            return self.aria_busy
        if name == "role" and self.tag == "grid":
            return "grid"
        return None

    async def evaluate(self, script):
        if script == gateway.READER_TABLE_TAB_PATH_SCRIPT:
            return []  # This adapter has no DOM ancestry; covered by browser fixtures.
        if "tagName" in script:
            return self.tag
        if "let panel = element.closest" in script:
            return ""
        if "parentIndex" in script:
            return {"heading": self.heading, "parentIndex": self.parent_index}
        return self.heading

    def locator(self, selector):
        if selector in {"thead th,[role='columnheader']", ".ant-empty-description,[role='status']", ".ant-table-placeholder"}:
            return FakeObservationLocator([])
        return FakeObservationLocator(self.rows)


class FakePaginationContainer(FakeObservationContainer):
    async def evaluate(self, script):
        if script == gateway.READER_TABLE_PAGINATION_SCRIPT:
            return ["Total 36", "password=secret-value", "x" * 400, "Other 4", "ignored"]
        return await super().evaluate(script)


def test_observation_includes_bounded_sanitized_table_pagination():
    container = FakePaginationContainer([("REF-4 Open", True)], heading="Records")
    observed = asyncio.run(gateway._observe_semantics(FakeObservationPage({}, containers=[container]), 20))
    summaries = observed["sectionSummaries"][0]["summaries"]
    assert summaries[0] == "Total 36"
    assert len(summaries) == 4
    assert all(len(value) <= 200 for value in summaries)
    assert "secret-value" not in str(summaries)


class FakeObservationContainers:
    def __init__(self, containers, index=0):
        self.containers = containers
        self.index = index

    async def count(self):
        return len(self.containers)

    def nth(self, index):
        return self.containers[index]


class FakeSemanticSection:
    def __init__(
        self,
        heading,
        controls,
        *,
        aria_label="",
        card_summaries=(),
        selected_states=(),
        empty_state="",
        visible=True,
    ):
        self.heading = heading
        self.controls = controls
        self.aria_label = aria_label
        self.card_summaries = card_summaries
        self.selected_states = selected_states
        self.empty_state = empty_state
        self.visible = visible
        self.selectors = []

    async def is_visible(self):
        return self.visible

    async def get_attribute(self, name):
        return self.aria_label if name == "aria-label" else None

    def locator(self, selector):
        self.selectors.append(selector)
        if selector == "h1,h2,h3,[role='heading']":
            return FakeObservationLocator([(self.heading, True)] if self.heading else [])
        if selector == "[role='tab'],[role='button'],button[aria-label],a[aria-label]":
            return FakeObservationLocator([(value, True) for value in self.controls])
        if selector == "[role='tab'][aria-selected='true']":
            return FakeObservationLocator(self.selected_states)
        if selector == ".stat-card:not([class*='skeleton']):not(:has([class*='skeleton']))":
            return FakeObservationLocator([(value, True) for value in self.card_summaries])
        if selector == ".ant-empty-description,[role='status']":
            return FakeObservationLocator([(self.empty_state, True)] if self.empty_state else [])
        return FakeObservationLocator([])


class FakeStructuredRow:
    def __init__(self, cells, *, visible=True):
        self.cells = cells
        self.visible = visible

    async def is_visible(self):
        return self.visible

    async def inner_text(self):
        return " ".join(value[0] for value in self.cells)

    def locator(self, selector):
        return FakeObservationLocator(self.cells)


class FakeStructuredRows:
    def __init__(self, rows, index=0):
        self.rows = rows
        self.index = index

    async def count(self):
        return len(self.rows)

    def nth(self, index):
        return self.rows[index]


class FakeStructuredContainer(FakeObservationContainer):
    def __init__(self, headers, rows, *, heading="", empty_state="", parent_index=None):
        super().__init__([], tag="table", heading=heading, parent_index=parent_index)
        self.headers = headers
        self.structured_rows = rows
        self.empty_state = empty_state

    def locator(self, selector):
        if selector == "thead th,[role='columnheader']":
            return FakeObservationLocator(self.headers)
        if selector == ".ant-empty-description,[role='status']":
            return FakeObservationLocator([(self.empty_state, True)] if self.empty_state else [])
        if selector == ".ant-table-placeholder":
            return FakeObservationLocator([])
        return FakeStructuredRows(self.structured_rows)


class FakeObservationPage:
    def __init__(self, values_by_selector, *, containers=None, sections=None, card_collections=None, metric_collections=None):
        self.values_by_selector = values_by_selector
        self.containers = containers or []
        self.sections = sections or []
        self.selectors = []
        self.card_collections = card_collections or []
        self.metric_collections = metric_collections or []

    async def evaluate(self, script, *args):
        if args:
            assert len(args) == 1
            if args[0] is None:
                return 'stable-table-fingerprint'
            return {"filterControls": [], "metrics": []}
        if script == gateway.READER_LABELED_METRICS_SCRIPT:
            return self.metric_collections
        assert script == gateway.READER_CARD_COLLECTION_SCRIPT
        return self.card_collections

    def locator(self, selector):
        self.selectors.append(selector)
        if selector == "table,[role='grid']":
            return FakeObservationContainers(self.containers)
        if selector == "section,[role='region']":
            return FakeObservationContainers(self.sections)
        return FakeObservationLocator(self.values_by_selector.get(selector, []))


class FakeQueryPage:
    def __init__(self, values, *, empty_state_present=False, empty_state_visible=False, failure_states=(), body_text=""):
        self.values = values
        self.empty_state_present = empty_state_present or empty_state_visible
        self.empty_state_visible = empty_state_visible
        self.failure_states = failure_states
        self.body_text = body_text

    def locator(self, selector):
        if selector == "[role='dialog']:visible,[role='alertdialog']:visible,.ant-drawer-content:visible":
            return FakeQueryLocator([])
        if selector == gateway.READER_FAILURE_STATE_SELECTOR:
            return FakeQueryLocator(self.failure_states)
        if selector == "body":
            return FakeQueryLocator([(self.body_text, True)]) if self.body_text else FakeQueryLocator([])
        return FakeQueryLocator(self.values)

    def get_by_text(self, text, exact=True):
        return FakeQueryLocator([(text, self.empty_state_visible)] if self.empty_state_present else [])


def guard(method, path, *, resource_type="xhr"):
    route = FakeRoute(method, f"https://admin.example.test{path}", resource_type)
    asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test"))
    return route.result


def test_gateway_action_enum_matches_runtime_contract() -> None:
    assert gateway.READER_ACTIONS == {
        "observe", "navigate", "query", "filter", "paginate", "switch_tab", "expand_details",
        "show_filter", "apply_filter", "reset_filter", "sort", "show_detail", "dismiss_overlay",
    }


def test_column_header_is_a_bounded_query_role() -> None:
    request = read_request([{"type": "query", "role": "columnheader", "name": "Status"}])

    gateway._validate_reader_request(request)


def test_query_field_is_observed_only_with_a_value_or_explicit_empty_state() -> None:
    action = gateway.PortalReadAction(
        type="query",
        selector="[class*='field']",
        label="Status",
        emptyState="No data",
    )

    missing = asyncio.run(gateway._query_page_values(FakeQueryPage([]), action, 20))
    empty = asyncio.run(gateway._query_page_values(FakeQueryPage([], empty_state_visible=True), action, 20))
    present = asyncio.run(gateway._query_page_values(FakeQueryPage(["Pending Review"]), action, 20))

    assert missing == ("Status", [], False)
    assert empty == ("Status", [], True)
    assert present == ("Status", ["Pending Review"], False)


def test_query_returns_only_visible_values_and_redacts_credentials() -> None:
    action = gateway.PortalReadAction(type="query", selector="[class*='field']", label="Result")
    page = FakeQueryPage([
        ("Hidden stale record", False),
        ("Authorization: Bearer abc.def", True),
        ("A normal token status", True),
        ("access_token=secret-value", True),
    ])

    _, values, confirmed_empty = asyncio.run(gateway._query_page_values(page, action, 20))

    assert values == [
        "Authorization: [redacted]",
        "A normal token status",
        "access_token=[redacted]",
    ]
    assert not confirmed_empty


def test_hidden_empty_state_or_visible_failure_state_cannot_confirm_no_data() -> None:
    action = gateway.PortalReadAction(
        type="query",
        selector="[class*='field']",
        label="Status",
        emptyState="No data",
    )

    hidden_empty = FakeQueryPage([], empty_state_present=True, empty_state_visible=False)
    loading = FakeQueryPage([], empty_state_visible=True, failure_states=[("Loading...", True)])
    error_page = FakeQueryPage([], empty_state_visible=True, body_text="503 Server Error - Retry")

    assert asyncio.run(gateway._query_page_values(hidden_empty, action, 20))[2] is False
    assert asyncio.run(gateway._query_page_values(loading, action, 20))[2] is False
    assert asyncio.run(gateway._query_page_values(error_page, action, 20))[2] is False


def test_blocked_relevant_data_request_cannot_confirm_visible_no_data() -> None:
    action = gateway.PortalReadAction(
        type="query", selector="[class*='field']", label="Refunds", emptyState="No data",
    )
    page = FakeQueryPage([], empty_state_visible=True)
    page.url = "https://admin.example.test/happiness/refunds"
    page._reader_blocked_api_paths = ["/api/Refund/Admin/Tickets"]

    assert asyncio.run(gateway._query_page_values(page, action, 20))[2] is False


def test_blocked_unrelated_data_request_does_not_invalidate_empty_result() -> None:
    action = gateway.PortalReadAction(
        type="query", selector="[class*='field']", label="Refunds", emptyState="No data",
    )
    page = FakeQueryPage([], empty_state_visible=True)
    page.url = "https://admin.example.test/happiness/refunds"
    page._reader_blocked_api_paths = ["/api/clientlog/report"]

    assert asyncio.run(gateway._query_page_values(page, action, 20))[2] is True


def test_blocked_query_label_matches_current_data_surface_generically() -> None:
    action = gateway.PortalReadAction(
        type="query", selector="[class*='field']", label="Enquiries & Complaints", emptyState="No data",
    )
    page = FakeQueryPage([], empty_state_visible=True)
    page.url = "https://admin.example.test/happiness/tickets"
    page._reader_blocked_api_paths = ["/api/Enquiry/Management/List"]

    assert asyncio.run(gateway._query_page_values(page, action, 20))[2] is False


def test_observation_empty_state_is_not_confirmed_when_surface_request_is_blocked(monkeypatch) -> None:
    class Page:
        url = "https://admin.example.test/happiness/refunds"

    async def fake_observe(page, limit):
        return {
            "rowSummaries": [],
            "regionSummaries": [{"emptyState": "No data"}],
            "readHealth": {"healthy": False, "blocked": ["/api/Refund/Admin/Tickets"]},
        }

    monkeypatch.setattr(gateway, "_observe_semantics", fake_observe)
    async def fake_settle(page):
        return None
    monkeypatch.setattr(gateway, "_settle_page", fake_settle)
    request = gateway.AdminPortalReadRequest(
        startPath="/happiness/refunds",
        actions=(gateway.PortalReadAction(type="observe"),),
    )
    facts, pages, fields, confirmed_empty, observation = asyncio.run(
        gateway._execute_reader_actions(Page(), request, "https://admin.example.test")
    )

    assert confirmed_empty is False
    assert observation["readHealth"]["healthy"] is False


@pytest.mark.parametrize("health_key", ["failed", "pending"])
def test_surface_health_blocks_no_data_for_failed_or_pending_surface_request(health_key) -> None:
    class Page:
        url = "https://admin.example.test/happiness/refunds"

    page = Page()
    page._reader_health = {
        "blocked": [],
        "failed": {"/api/Refund/Admin/Tickets": 1} if health_key == "failed" else {},
        "pending": {101: "/api/Refund/Admin/Tickets", 102: "/api/Refund/Admin/Tickets"} if health_key == "pending" else {},
    }
    result = gateway._reader_surface_health(page, "Refunds")

    assert result["healthy"] is False
    assert result[health_key] == ["/api/Refund/Admin/Tickets"]


def test_surface_health_ignores_only_exact_blocked_notification_background_paths() -> None:
    class Page:
        url = "https://admin.example.test/happiness/tickets"

    page = Page()
    page._reader_health = {
        "blocked": [
            "/api/SignalR/GetNotificationInfoList",
            "/api/SignalR/GetNotificationInfoListShowBox",
        ],
        "failed": [],
        "pending": [],
    }

    assert gateway._reader_surface_health(page, "Enquiries & Complaints") == {
        "blocked": [],
        "failed": [],
        "pending": [],
        "uncertain": [],
        "healthy": True,
    }

    page._reader_health["blocked"] = ["/api/SignalR/GetNotificationInfoList/extra"]
    result = gateway._reader_surface_health(page, "Enquiries & Complaints")
    assert result["healthy"] is False
    assert result["uncertain"] == ["/api/SignalR/GetNotificationInfoList/extra"]


def test_report_page_does_not_treat_explicitly_blocked_telemetry_as_business_data():
    class Page:
        url = 'https://admin.example.test/content/reports-analytics'
        _reader_health = {'blocked': ['/api/clientlog/report'], 'failed': [], 'pending': []}
    page = Page()
    assert gateway._reader_surface_health(page)['healthy'] is True
    page._reader_health = {'blocked': ['/api/clientlog/report/unknown'], 'failed': [], 'pending': []}
    assert gateway._reader_surface_health(page)['healthy'] is False
    page._reader_health = {'blocked': [], 'failed': ['/api/ContentReports/GetData'], 'pending': []}
    assert gateway._reader_surface_health(page)['healthy'] is False


@pytest.mark.parametrize(
    "locator",
    [
        {"field": "Password"},
        {"name": "Access Token", "role": "status"},
        {"selector": "[data-field='authorization']"},
        {"selector": "[class*='api_key']"},
        {"section": "Cookie value", "role": "listitem"},
        {"label": "Credential", "role": "status"},
    ],
)
def test_gateway_rejects_sensitive_query_locators(locator) -> None:
    request = read_request([{"type": "query", **locator}])

    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(request)

    assert error_code(raised.value) == "reader_sensitive_locator_forbidden"


def test_reader_text_sanitizer_preserves_normal_token_word_and_redacts_values() -> None:
    value = gateway._sanitize_reader_text(
        "Token status is active; password: hunter2; api_key=abc; "
        "JWT eyJabcdefgh.abcdefgh.abcdefgh; cookie is session=secret"
    )

    assert "Token status is active" in value
    assert "hunter2" not in value
    assert "api_key=[redacted]" in value
    assert "eyJabcdefgh.abcdefgh.abcdefgh" not in value
    assert "cookie is [redacted]" in value


def test_reader_text_sanitizer_redacts_basic_auth_and_all_cookie_pairs() -> None:
    value = gateway._sanitize_reader_text(
        "Authorization Basic abc123; Cookie: session=abc; Secure; refresh=def; "
        "access token xyz789; refresh token secretvalue; access token policy; Token status is active"
    )

    assert "abc123" not in value
    assert "session=abc" not in value
    assert "refresh=def" not in value
    assert "xyz789" not in value
    assert "secretvalue" not in value
    assert "access token policy" in value
    assert "Token status is active" in value


def test_observe_semantics_preserves_bounded_card_collection_as_separate_node() -> None:
    page = FakeObservationPage({}, card_collections=[{
        'heading': 'Members', 'cardSummaries': [f'Person {index} | Completed | 7' for index in range(8)],
    }])
    result = asyncio.run(gateway._observe_semantics(page, 20))
    node = result['sectionSummaries'][0]
    assert node['nodeId'] == 'observation-cards-001'
    assert node['kind'] == 'cards'
    assert node['heading'] == 'Members'
    assert len(node['cardSummaries']) == 4
    assert not result['rowSummaries']
    assert 'summaries' not in node


def test_card_collection_does_not_use_generic_landmark_as_business_heading() -> None:
    page = FakeObservationPage({}, card_collections=[{
        'heading': 'scrollable content', 'cardSummaries': ['Person A | Completed | 7'],
    }])
    result = asyncio.run(gateway._observe_semantics(page, 20))
    assert result['sectionSummaries'][0]['heading'] == ''


def test_labeled_metrics_remain_separate_from_table_pagination_totals() -> None:
    page = FakeObservationPage({}, metric_collections=[{'heading':'Category', 'summaries':['Total 40', 'Approved 17']}])
    result = asyncio.run(gateway._observe_semantics(page,20))
    assert result['sectionSummaries'] == [{
        'nodeId':'observation-metrics-001', 'kind':'metrics', 'heading':'Category',
        'sourceSection':'Category', 'summaries':['Total 40','Approved 17'], 'selectedState':'',
    }]
    assert not result['rowSummaries']


def test_observe_semantics_collects_only_visible_native_table_rows_within_bounds() -> None:
    rows = [("Hidden row", False), ("No data found", True), ("Loading...", True)] + [
        (f"Row {index} " + ("x" * 450), True)
        for index in range(25)
    ]
    page = FakeObservationPage({
        "h1,h2,h3,[role='heading']": [("Hidden heading", False), ("Dashboard", True)],
    }, containers=[FakeObservationContainer(rows)])

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert observation["headings"] == ["Dashboard"]
    assert "table,[role='grid']" in page.selectors
    assert len(observation["rowSummaries"]) == 10
    assert all("Hidden row" not in row for row in observation["rowSummaries"])
    assert all("No data" not in row and "Loading" not in row for row in observation["rowSummaries"])
    assert all(len(row) == 400 for row in observation["rowSummaries"])


def test_observe_semantics_uses_only_first_visible_table_with_data_rows() -> None:
    page = FakeObservationPage({}, containers=[
        FakeObservationContainer([("Hidden table row", True)], visible=False),
        FakeObservationContainer([("No data found", True)]),
        FakeObservationContainer([("First table row 1", True), ("First table row 2", True)]),
        FakeObservationContainer([("Second table row", True)]),
    ])

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert observation["rowSummaries"] == ["First table row 1", "First table row 2"]


def test_observe_semantics_keeps_rows_bound_to_their_dashboard_section() -> None:
    page = FakeObservationPage({}, containers=[
        FakeStructuredContainer([], [FakeStructuredRow([("Service Applications 15", True)])], heading="My Tasks"),
        FakeStructuredContainer(
            [],
            [
                FakeStructuredRow([("ML-1 Pending Modification Customer", True)]),
                FakeStructuredRow([("ML-2 Pending Modification Customer", True)]),
            ],
            heading="Needs Your Attention",
        ),
    ])

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert observation["sectionSummaries"] == [
        {
            "nodeId": "observation-table-001",
            "kind": "table",
            "heading": "My Tasks",
            "sourceSection": "My Tasks",
            "columnHeaders": [],
            "rowSummaries": ["Service Applications 15"],
            "rowFields": [],
            "emptyState": "",
        },
        {
            "nodeId": "observation-table-002",
            "kind": "table",
            "heading": "Needs Your Attention",
            "sourceSection": "Needs Your Attention",
            "columnHeaders": [],
            "rowSummaries": ["ML-1 Pending Modification Customer", "ML-2 Pending Modification Customer"],
            "rowFields": [],
            "emptyState": "",
        },
    ]


def test_observe_semantics_preserves_explicit_empty_state_with_section_identity() -> None:
    page = FakeObservationPage({}, containers=[
        FakeStructuredContainer(
            [("Task No.", True), ("Service Name", True)],
            [],
            heading="Needs Your Attention",
            empty_state="No data",
        ),
    ])

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert observation["sectionSummaries"] == [{
        "nodeId": "observation-table-001",
        "kind": "table",
        "heading": "Needs Your Attention",
        "sourceSection": "Needs Your Attention",
        "columnHeaders": ["Task No.", "Service Name"],
        "rowSummaries": [],
        "rowFields": [],
        "emptyState": "No data",
    }]


def test_observe_semantics_binds_controls_to_visible_semantic_sections() -> None:
    page = FakeObservationPage({}, sections=[
        FakeSemanticSection("Hidden", ["Hidden 99"], visible=False),
        FakeSemanticSection("My Tasks", ["Service Application 14", "Profile Verification 0"]),
        FakeSemanticSection("Needs Your Attention", ["All 2", "Pending Modification 2"]),
    ])

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert observation["regionSummaries"] == [
        {
            "nodeId": "observation-region-002",
            "kind": "region",
            "heading": "My Tasks",
            "sourceSection": "My Tasks",
            "controls": ["Service Application 14", "Profile Verification 0"],
            "emptyState": "",
        },
        {
            "nodeId": "observation-region-003",
            "kind": "region",
            "heading": "Needs Your Attention",
            "sourceSection": "Needs Your Attention",
            "controls": ["All 2", "Pending Modification 2"],
            "emptyState": "",
        },
    ]


def test_observe_semantics_binds_cards_to_their_semantic_section() -> None:
    page = FakeObservationPage({}, sections=[
        FakeSemanticSection("Queue Overview", [], card_summaries=("Open 8", "Closed 3")),
        FakeSemanticSection("Other Overview", [], card_summaries=("Waiting 2",)),
    ])

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert observation["regionSummaries"] == [
        {
            "nodeId": "observation-region-001",
            "kind": "region",
            "heading": "Queue Overview",
            "sourceSection": "Queue Overview",
            "controls": [],
            "emptyState": "",
            "cardSummaries": ["Open 8", "Closed 3"],
            "summaries": ["Open 8", "Closed 3"],
        },
        {
            "nodeId": "observation-region-002",
            "kind": "region",
            "heading": "Other Overview",
            "sourceSection": "Other Overview",
            "controls": [],
            "emptyState": "",
            "cardSummaries": ["Waiting 2"],
            "summaries": ["Waiting 2"],
        },
    ]


def test_observe_semantics_assigns_stable_parent_refs_to_nested_tables() -> None:
    page = FakeObservationPage(
        {},
        containers=[FakeStructuredContainer([], [FakeStructuredRow([("REF-101 Open", True)])], heading="Queue", parent_index=0)],
        sections=[FakeSemanticSection("Queue", [])],
    )

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert observation["regionSummaries"][0]["nodeId"] == "observation-region-001"
    assert observation["regionSummaries"][0]["kind"] == "region"
    assert observation["regionSummaries"][0]["controls"] == []
    assert observation["sectionSummaries"][0]["nodeId"] == "observation-table-001"
    assert observation["sectionSummaries"][0]["kind"] == "table"
    assert observation["sectionSummaries"][0]["parentRef"] == "observation-region-001"


def test_observe_semantics_keeps_aria_label_only_region_referenced_by_table() -> None:
    page = FakeObservationPage(
        {},
        containers=[FakeStructuredContainer([], [FakeStructuredRow([("REF-101 Open", True)])], heading="Queue", parent_index=0)],
        sections=[FakeSemanticSection("", [], aria_label="Queue")],
    )

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert observation["regionSummaries"] == [{
        "nodeId": "observation-region-001",
        "kind": "region",
        "heading": "Queue",
        "sourceSection": "Queue",
        "controls": [],
        "emptyState": "",
    }]
    assert observation["sectionSummaries"][0]["parentRef"] == "observation-region-001"


def test_observe_semantics_includes_only_bounded_visible_dialog_content() -> None:
    page = FakeObservationPage({
        gateway.READER_OVERLAY_SELECTOR: [
            ("Hidden filter", False),
            ("Application Status Pending Review Apply Reset", True),
            *((f"Dialog {index} " + "x" * 900, True) for index in range(5)),
        ],
    })

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert len(observation["dialogs"]) == 4
    assert "Hidden filter" not in observation["dialogs"]
    assert all(len(value) <= 800 for value in observation["dialogs"])


def test_observe_semantics_excludes_the_visible_actions_column_by_cell_index() -> None:
    container = FakeStructuredContainer(
        [("Application No.", True), ("Service Name", True), ("Actions", True)],
        [
            FakeStructuredRow([
                ("ML-1", True),
                ("Application for Media Export", True),
                ("Approve Reject", True),
            ])
        ],
    )
    page = FakeObservationPage({}, containers=[container])

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert observation["rowSummaries"] == ["ML-1 Application for Media Export"]


def test_observe_semantics_binds_multiword_cell_values_to_native_headers() -> None:
    container = FakeStructuredContainer(
        [
            ("Ticket No.", True),
            ("Customer", True),
            ("Issue Category", True),
            ("Status", True),
            ("Actions", True),
        ],
        [FakeStructuredRow([
            ("T-100", True),
            ("Acme Media Group", True),
            ("Business", True),
            ("Open", True),
            ("View Assign", True),
        ])],
    )

    observation = asyncio.run(gateway._observe_semantics(FakeObservationPage({}, containers=[container]), 20))

    assert observation["sectionSummaries"][0]["rowFields"] == [{
        "Ticket No.": "T-100",
        "Customer": "Acme Media Group",
        "Issue Category": "Business",
        "Status": "Open",
    }]
    assert observation["rowSummaries"] == ["T-100 Acme Media Group Business Open"]


@pytest.mark.parametrize('blank_indexes', [[0], [2], [0, 3]])
def test_unlabelled_utility_columns_are_excluded_without_losing_native_bindings(blank_indexes):
    headers=[('Reference', True), ('Status', True)]
    cells=[('R-1', True), ('Open', True)]
    for index in blank_indexes:
        headers.insert(index, ('', True))
        cells.insert(index, ('unlabelled-content-must-not-leak', True))
    container=FakeStructuredContainer(headers,[FakeStructuredRow(cells)])
    observation=asyncio.run(gateway._observe_semantics(FakeObservationPage({},containers=[container]),20))
    assert observation['sectionSummaries'][0]['rowFields']==[{'Reference':'R-1','Status':'Open'}]
    assert observation['rowSummaries']==['R-1 Open']
    assert 'unlabelled-content' not in str(observation)


def test_reader_leaf_headers_preserves_grouped_labels_and_rowspan_identity():
    def cell(text, width=1, height=1):
        return {"text": text, "colSpan": width, "rowSpan": height, "visible": True}
    assert gateway._reader_leaf_headers([
        [cell("Reference", height=2), cell("Distribution", width=2)],
        [cell("North"), cell("South")],
    ]) == ["Reference", "Distribution / North", "Distribution / South"]


@pytest.mark.parametrize("rows", [
    [[{"text": "Group", "colSpan": 2, "rowSpan": 1, "visible": True}], []],
    [[{"text": "Group", "colSpan": 2, "rowSpan": 1, "visible": True}],
     [{"text": "Same", "colSpan": 1, "rowSpan": 1, "visible": True}] * 2],
    [[{"text": "Group", "colSpan": 1, "rowSpan": 3, "visible": True}], []],
    [[{"text": "", "colSpan": 1, "rowSpan": 2, "visible": True}], []],
    [[{"text": "Group", "colSpan": 1, "rowSpan": 2, "visible": False}], []],
])
def test_reader_leaf_headers_rejects_incomplete_ambiguous_or_hidden_grids(rows):
    assert gateway._reader_leaf_headers(rows) is None


def test_blank_header_with_colspan_still_rejects_ambiguous_field_alignment():
    container=FakeStructuredContainer([('',True,{'colspan':'2'}),('Reference',True)],
                                      [FakeStructuredRow([('',True),('R-1',True)])])
    observation=asyncio.run(gateway._observe_semantics(FakeObservationPage({},containers=[container]),20))
    assert observation['sectionSummaries'][0]['rowFields']==[]


@pytest.mark.parametrize('text,visible,expected', [
    ('No records found',True,'No records found'), ('No results',True,'No results'),
    ('Loading...',True,''), ('Request failed',True,''), ('No records found',False,''),
])
def test_table_placeholder_empty_text_is_visible_explicit_and_not_a_failure(text,visible,expected):
    class PlaceholderContainer(FakeStructuredContainer):
        def locator(self,selector):
            if selector=='.ant-table-placeholder':
                return FakeObservationLocator([(text,visible)])
            return super().locator(selector)
    container=PlaceholderContainer([('Reference',True)],[],heading='Queue')
    observation=asyncio.run(gateway._observe_semantics(FakeObservationPage({},containers=[container]),20))
    nodes=observation['sectionSummaries']
    assert (nodes[0]['emptyState'] if nodes else '')==expected


@pytest.mark.parametrize(
    ("headers", "cells"),
    [
        (
            [("Ticket No.", True), ("Status", False), ("Customer", True)],
            [("T-100", True), ("Open", False), ("Acme Media Group", True)],
        ),
        (
            [("Status", True), ("Status", True)],
            [("Open", True), ("Closed", True)],
        ),
        (
            [("Ticket No.", True, {"colspan": "2"}), ("Status", True)],
            [("T-100", True), ("Open", True)],
        ),
        (
            [("Ticket No.", True), ("Status", True)],
            [("T-100", True, {"rowspan": "2"}), ("Open", True)],
        ),
        (
            [("Ticket No.", True), ("Status", True)],
            [("T-100", True)],
        ),
    ],
)
def test_observe_semantics_does_not_bind_ambiguous_table_structures(headers, cells) -> None:
    container = FakeStructuredContainer(headers, [FakeStructuredRow(cells)])

    observation = asyncio.run(gateway._observe_semantics(FakeObservationPage({}, containers=[container]), 20))

    assert observation["sectionSummaries"][0]["rowFields"] == []
    assert observation["sectionSummaries"][0]["rowSummaries"]


def test_observe_semantics_bounds_and_sanitizes_structured_row_fields() -> None:
    headers = [("Notes" if index == 1 else f"Field {index}", True) for index in range(14)]
    rows = []
    for row_index in range(15):
        cells = [
            (("x" * 350) if column_index == 0 else (
                "password: field-secret" if column_index == 1 else f"row {row_index} value {column_index}"
            ), True)
            for column_index in range(14)
        ]
        rows.append(FakeStructuredRow(cells))
    container = FakeStructuredContainer(headers, rows)

    observation = asyncio.run(gateway._observe_semantics(FakeObservationPage({}, containers=[container]), 20))
    row_fields = observation["sectionSummaries"][0]["rowFields"]

    assert len(row_fields) == 10
    assert all(len(row) == 12 for row in row_fields)
    assert all(len(row["Field 0"]) == 300 for row in row_fields)
    assert all(row["Notes"] == "password: [redacted]" for row in row_fields)
    assert [row["Field 2"] for row in row_fields] == [f"row {index} value 2" for index in range(10)]
    assert "row 10 value" not in str(row_fields)
    assert "field-secret" not in str(row_fields)


def test_observe_semantics_excludes_action_and_sensitive_columns_from_row_fields() -> None:
    container = FakeStructuredContainer(
        [("Ticket No.", True), ("Password", True), ("Actions", True)],
        [FakeStructuredRow([("T-100", True), ("opaque-secret", True), ("Open", True)])],
    )

    observation = asyncio.run(gateway._observe_semantics(FakeObservationPage({}, containers=[container]), 20))

    assert observation["sectionSummaries"][0]["rowFields"] == [{"Ticket No.": "T-100"}]
    assert observation["rowSummaries"] == ["T-100"]
    assert "opaque-secret" not in str(observation)


def test_observe_semantics_collects_bounded_visible_non_error_stat_cards() -> None:
    summary_selector = ".stat-card:not([class*='skeleton']):not(:has([class*='skeleton']))"
    summaries = [
        ("Hidden 1", False),
        ("Loading...", True),
        ("Error 500", True),
        ("Retry 503", True),
        *((f"Status {index} " + "x" * 220, True) for index in range(14)),
    ]
    page = FakeObservationPage({summary_selector: summaries})

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert summary_selector in page.selectors
    assert len(observation["summaries"]) == 12
    assert all(len(value) == 200 for value in observation["summaries"])
    assert all(
        marker not in " ".join(observation["summaries"])
        for marker in ("Hidden", "Loading", "Error", "Retry")
    )


def test_hidden_operation_column_does_not_discard_visible_native_fields():
    container = FakeStructuredContainer(
        [("Record No.", True), ("Status", True), ("Action", False)],
        [FakeStructuredRow([("R-17", True), ("Awaiting Documents", True), ("", False)])],
    )
    observation = asyncio.run(gateway._observe_semantics(FakeObservationPage({}, containers=[container]), 20))
    assert observation["sectionSummaries"][0]["rowFields"] == [{"Record No.": "R-17", "Status": "Awaiting Documents"}]


@pytest.mark.parametrize("stable", [True, False])
def test_observation_retries_table_changes_without_returning_mixed_rows(monkeypatch, stable):
    class Page:
        calls = 0

        async def evaluate(self, script, arg):
            self.calls += 1
            return min(self.calls, 2) if stable else self.calls

    observations = []
    async def observe(page, limit):
        result = {"rowSummaries": ["old" if not observations else "new"]}
        observations.append(result)
        return result
    async def settle(page):
        pass
    monkeypatch.setattr(gateway, "_observe_semantics_once", observe)
    monkeypatch.setattr(gateway, "_settle_page", settle)
    result = asyncio.run(gateway._observe_semantics(Page(), 20))
    if stable:
        assert result["rowSummaries"] == ["new"]
        assert len(observations) == 2
    else:
        assert not result["rowSummaries"]
        assert result["readHealth"]["healthy"] is False


def test_observe_semantics_records_selected_tab_per_region() -> None:
    selected_tab_selector = "[role='tab'][aria-selected='true']"
    section = FakeSemanticSection(
        heading="My Work",
        controls=["Applications 14", "Enquiries 2"],
        selected_states=[("Enquiries 2", True)],
    )
    page = FakeObservationPage({}, sections=[section])

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert selected_tab_selector in section.selectors
    assert observation["regionSummaries"][0]["selectedState"] == "Enquiries 2"


def test_observe_semantics_records_the_only_native_active_tab_on_the_only_visible_table() -> None:
    active_tab_selector = "[role='tab'][aria-selected='true']"
    page = FakeObservationPage(
        {active_tab_selector: [("Completed", True)]},
        containers=[FakeStructuredContainer(
            [("Ticket No.", True), ("Status", True)],
            [FakeStructuredRow([("T-100", True), ("Completed", True)])],
        )],
    )

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert observation["sectionSummaries"][0]["selectedState"] == "Completed"


def test_observe_semantics_does_not_assign_table_state_from_multiple_active_tabs() -> None:
    active_tab_selector = "[role='tab'][aria-selected='true']"
    page = FakeObservationPage(
        {active_tab_selector: [("To Do", True), ("Completed", True)]},
        containers=[FakeStructuredContainer(
            [("Ticket No.", True), ("Status", True)],
            [FakeStructuredRow([("T-100", True), ("Open", True)])],
        )],
    )

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert "selectedState" not in observation["sectionSummaries"][0]


def test_observe_semantics_does_not_assign_table_state_when_multiple_tables_are_visible() -> None:
    active_tab_selector = "[role='tab'][aria-selected='true']"
    page = FakeObservationPage(
        {active_tab_selector: [("Completed", True)]},
        containers=[
            FakeStructuredContainer(
                [("Ticket No.", True), ("Status", True)],
                [FakeStructuredRow([("T-100", True), ("Completed", True)])],
            ),
            FakeStructuredContainer(
                [("Ticket No.", True), ("Status", True)],
                [FakeStructuredRow([("T-200", True), ("Completed", True)])],
            ),
        ],
    )

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert all("selectedState" not in section for section in observation["sectionSummaries"])


def test_observe_semantics_does_not_assign_empty_active_tab_text_to_table() -> None:
    active_tab_selector = "[role='tab'][aria-selected='true']"
    page = FakeObservationPage(
        {active_tab_selector: [("", True)]},
        containers=[FakeStructuredContainer(
            [("Ticket No.", True), ("Status", True)],
            [FakeStructuredRow([("T-100", True), ("Open", True)])],
        )],
    )

    observation = asyncio.run(gateway._observe_semantics(page, 20))

    assert "selectedState" not in observation["sectionSummaries"][0]


def test_observe_semantics_redacts_credentials_in_all_text_collections() -> None:
    selectors = {
        "h1,h2,h3,[role='heading']": [("Authorization: Bearer heading-secret", True)],
        "label": [("password: label-secret", True)],
        "th,[role='columnheader']": [("api_key=column-secret", True)],
        "[role='region'][aria-label],section[aria-label]": [("access_token: region-secret", True)],
        "[role='tab'],.ant-pagination button,.ant-pagination a,button[aria-label],a[aria-label]": [("cookie=session-secret", True)],
        ".stat-card:not([class*='skeleton']):not(:has([class*='skeleton']))": [("secret: summary-secret", True)],
    }
    page = FakeObservationPage(
        selectors,
        containers=[FakeObservationContainer([("credential: row-secret", True)])],
    )

    observation = asyncio.run(gateway._observe_semantics(page, 20))
    encoded = str(observation)

    for secret in (
        "heading-secret", "label-secret", "column-secret", "region-secret",
        "session-secret", "summary-secret", "row-secret",
    ):
        assert secret not in encoded
    assert encoded.count("[redacted]") >= 7


def test_auth_init_script_executes_and_uses_portal_storage_shape() -> None:
    script = gateway._auth_init_script('token"value')

    assert script.lstrip().startswith("(() => {")
    assert script.rstrip().endswith("})();")
    assert "JSON.stringify({ value, timestamp: Date.now() })" in script
    assert 'const token = "token\\\"value";' in script


@pytest.mark.parametrize("action", ["approve", "export", "download", "delete", "submit"])
def test_gateway_rejects_dangerous_action_types(action) -> None:
    request = read_request([{"type": action}])

    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(request)

    assert error_code(raised.value) == "action_not_read_only"


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
def test_gateway_rejects_model_supplied_non_get_method(method) -> None:
    request = read_request([{"type": "query", "field": "Status", "method": method}])

    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(request)

    assert error_code(raised.value) == "method_not_read_only"


@pytest.mark.parametrize(
    "path",
    ["/licensing/export", "/licensing/%64ownload", "/api/Document/Download", "/api/Document/Dowload"],
)
def test_gateway_rejects_export_and_download_paths(path) -> None:
    request = read_request([{"type": "navigate", "path": path}])

    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(request)

    assert error_code(raised.value) == "invalid_reader_path"


@pytest.mark.parametrize("selector", ["html", "body", "main", "table", "*", "#root", "#app"])
def test_gateway_rejects_full_page_selectors(selector) -> None:
    request = read_request([{"type": "query", "selector": selector}])

    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(request)

    assert error_code(raised.value) == "reader_selector_too_broad"


def test_gateway_requires_semantic_locators_for_interactions() -> None:
    request = read_request([{"type": "expand_details", "name": "Details"}])

    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(request)

    assert error_code(raised.value) == "reader_semantic_locator_required"


@pytest.mark.parametrize(
    "action",
    [
        {"type": "show_filter", "role": "button", "name": "Filter"},
        {"type": "apply_filter", "role": "button", "name": "Apply"},
        {"type": "reset_filter", "role": "button", "name": "Reset"},
        {"type": "sort", "role": "columnheader", "name": "Submission Time", "direction": "ascending"},
        {"type": "dismiss_overlay", "role": "button", "name": "Close"},
    ],
)
def test_dashboard_and_licensing_read_only_interactions_are_accepted(action) -> None:
    gateway._validate_reader_request(read_request([action], startPath="/dashboard"))
    gateway._validate_reader_request(read_request([action], startPath="/licensing/applications"))


def test_extended_read_only_interactions_are_generic_for_permitted_pages() -> None:
    request = read_request(
        [{"type": "show_filter", "role": "button", "name": "Filter"}],
        startPath="/customer-happiness",
    )

    gateway._validate_reader_request(request)


@pytest.mark.parametrize("label", ["Refunds 2", "Appeals", "Open tasks", "Approval tasks"])
def test_gateway_allows_read_only_resource_and_status_tab_labels(label) -> None:
    gateway._validate_reader_request(read_request([
        {"type": "switch_tab", "role": "tab", "name": label},
    ]))


@pytest.mark.parametrize("path", ["/refunds", "/appeals", "/open-tasks", "/approval-tasks"])
def test_gateway_allows_read_only_resource_and_status_routes(path) -> None:
    gateway._validate_reader_request(read_request([
        {"type": "navigate", "path": path},
    ], startPath="/refunds"))


@pytest.mark.parametrize("label", ["Approve record", "Reject", "Submit", "Export all tasks", "Download report", "Close record"])
def test_gateway_rejects_explicit_mutation_control_labels(label) -> None:
    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(read_request([{"type": "query", "label": label}]))

    assert error_code(raised.value) == "action_not_read_only"


@pytest.mark.parametrize(
    "path",
    ["/licensing/approve-record", "/licensing/open-record", "/licensing/refund-record", "/licensing/tasks/123/close"],
)
def test_gateway_rejects_explicit_mutation_routes(path) -> None:
    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(read_request([{"type": "navigate", "path": path}]))

    assert error_code(raised.value) == "invalid_reader_path"


def test_gateway_dismiss_overlay_does_not_exempt_a_mutation_selector() -> None:
    request = read_request([
        {
            "type": "dismiss_overlay",
            "role": "button",
            "label": "Close",
            "selector": "[data-action='approve']",
        },
    ])

    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(request)

    assert error_code(raised.value) == "action_not_read_only"


def test_filter_requires_an_explicit_value() -> None:
    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(read_request([{"type": "filter", "field": "Status"}]))

    assert error_code(raised.value) == "reader_filter_value_required"


@pytest.mark.parametrize(
    "action",
    [
        {"type": "expand_details", "role": "button", "name": "Details"},
        {"type": "expand_details", "selector": "[data-action='details']", "role": "button", "name": "Details"},
    ],
)
def test_expand_details_requires_permission_code_for_semantic_and_selector_clicks(action) -> None:
    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(read_request([action]))

    assert error_code(raised.value) == "button_permission_required"


def test_show_detail_requires_permission_code() -> None:
    action = {"type": "show_detail", "role": "link", "name": "ML-123", "value": "ML-123"}

    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(read_request([action]))

    assert error_code(raised.value) == "button_permission_required"


def test_show_detail_requires_stable_record_identity() -> None:
    action = {
        "type": "show_detail",
        "role": "link",
        "name": "Details",
        "permissionCode": "licensing.view_detail",
    }

    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(read_request([action]))

    assert error_code(raised.value) == "reader_detail_identity_required"


def cell_detail_action(**overrides):
    action = {
        "type": "show_detail",
        "role": "cell",
        "name": "APP-123",
        "value": "APP-123",
        "path": "/licensing/applications/detail",
    }
    action.update(overrides)
    return action


def test_gateway_allows_a_visible_record_cell_detail_without_button_permission() -> None:
    gateway._validate_reader_request(read_request(
        [cell_detail_action()], startPath="/licensing/applications",
    ))


@pytest.mark.parametrize(
    ("action", "expected"),
    [
        (cell_detail_action(path="/licensing/applications"), "reader_detail_destination_not_distinct"),
        (cell_detail_action(path="/licensing/applications/detail?taskId=opaque-uuid"), "reader_detail_destination_query_forbidden"),
        (cell_detail_action(name="OTHER-9"), "reader_detail_cell_identity_mismatch"),
        (cell_detail_action(permissionCode="licensing.approve"), "reader_click_target_not_detail"),
    ],
)
def test_gateway_rejects_unbounded_or_forged_cell_detail_requests(action, expected) -> None:
    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(read_request([action], startPath="/licensing/applications"))

    assert error_code(raised.value) == expected


def test_gateway_accepts_observation_bound_cell_detail_without_a_model_destination() -> None:
    gateway._validate_reader_request(read_request([cell_detail_action(path=None)]))


def test_gateway_permission_route_matching_accepts_frontend_case_variants() -> None:
    assert gateway._path_is_permitted(
        "/licensing/license/licenseDatails",
        ("/licensing/license/LicenseDatails",),
    )


def test_runtime_cell_detail_requires_visible_native_cell_and_row_with_exact_identity() -> None:
    action = gateway.PortalReadAction.model_validate(cell_detail_action())
    valid = FakeDetailCell()

    asyncio.run(gateway._safe_click(FakePage(valid), action))

    assert valid.clicked
    for locator, expected in (
        (FakeDetailCell(descriptor="OTHER-9"), "reader_detail_cell_identity_mismatch"),
        (FakeDetailCell(visible=False), "reader_detail_cell_not_visible"),
        (FakeDetailCell(tag="div"), "reader_detail_cell_not_native"),
        (FakeDetailCell(row_visible=False), "reader_detail_row_not_visible"),
        (FakeDetailCell(row_count=0), "reader_detail_row_not_visible"),
        (FakeDetailCell(count=2), "reader_detail_cell_not_unique"),
    ):
        with pytest.raises(RuntimeError, match=expected):
            asyncio.run(gateway._safe_click(FakePage(locator), action))


def test_runtime_cell_detail_accepts_an_exact_numeric_identity() -> None:
    action = gateway.PortalReadAction.model_validate(cell_detail_action(
        name="8929867",
        value="8929867",
    ))
    target = FakeDetailCell(descriptor="8929867")

    asyncio.run(gateway._safe_click(FakePage(target), action))

    assert target.clicked


def test_runtime_cell_detail_rechecks_destination_and_identity_after_click() -> None:
    action = gateway.PortalReadAction.model_validate(cell_detail_action())
    before_url = "https://admin.example.test/licensing/applications"

    asyncio.run(gateway._validate_cell_detail_navigation(
        FakeDetailNavigationPage("https://admin.example.test/licensing/applications/detail?taskId=opaque-uuid"),
        action,
        before_url,
    ))
    observation_bound_action = gateway.PortalReadAction.model_validate(cell_detail_action(path=None))
    asyncio.run(gateway._validate_cell_detail_navigation(
        FakeDetailNavigationPage("https://admin.example.test/licensing/applications/detail?taskId=opaque-uuid"),
        observation_bound_action,
        before_url,
    ))
    for page, expected in (
        (FakeDetailNavigationPage("https://admin.example.test/licensing/other?taskId=opaque-uuid"), "reader_detail_destination_mismatch"),
        (FakeDetailNavigationPage("https://admin.example.test/licensing/applications/detail?taskId=other-opaque-uuid", detail_identity="APP-999"), "reader_detail_identity_mismatch"),
        (FakeDetailNavigationPage("https://admin.example.test/licensing/applications/detail?taskId=opaque-uuid", identity_visible=False), "reader_detail_identity_mismatch"),
    ):
        with pytest.raises(RuntimeError, match=expected):
            asyncio.run(gateway._validate_cell_detail_navigation(page, action, before_url))

    license_action = gateway.PortalReadAction.model_validate({
        "type": "show_detail",
        "role": "cell",
        "name": "LIC-900",
        "value": "LIC-900",
        "path": "/licensing/licenses/detail",
    })
    asyncio.run(gateway._validate_cell_detail_navigation(
        FakeDetailNavigationPage("https://admin.example.test/licensing/licenses/detail?code=42", detail_identity="LIC-900"),
        license_action,
        "https://admin.example.test/licensing/licenses",
    ))


def test_sort_requires_closed_direction() -> None:
    action = {"type": "sort", "role": "columnheader", "name": "Submission Time"}

    with pytest.raises(HTTPException) as raised:
        gateway._validate_reader_request(read_request([action]))
    assert error_code(raised.value) == "reader_sort_direction_required"

    action["direction"] = "ascending"
    gateway._validate_reader_request(read_request([action]))


def test_filter_sets_supported_text_and_native_select_controls() -> None:
    text_locator = FakeLocator(tag="input")
    select_locator = FakeLocator(tag="select")

    asyncio.run(gateway._set_filter_value(FakePage(text_locator), gateway.PortalReadAction(type="filter", field="Search", value="ML-123")))
    asyncio.run(gateway._set_filter_value(FakePage(select_locator), gateway.PortalReadAction(type="filter", field="Status", value="Pending Review")))

    assert text_locator.filled == "ML-123"
    assert select_locator.selected == ["Pending Review"]


@pytest.mark.parametrize("selected", [["Under Review"], []])
def test_input_combobox_clicks_exact_option_and_verifies_selection(selected):
    class Combo(FakeLocator):
        async def element_handle(self):
            return self

        def locator(self, selector):
            return FakeLocatorGroup()

        async def evaluate(self, script):
            return selected if "selection-item" in script else "input"

    combo = Combo(descriptor="Status", tag="input", role="combobox")
    option = FakeLocator(descriptor="Under Review", role="option")

    class Page(FakePage):
        def locator(self, selector):
            return FakeLocatorGroup() if "dialog" in selector else combo

        def get_by_role(self, role, **kwargs):
            assert role == "option" and kwargs == {"name": "Under Review", "exact": True}
            return option

    operation = gateway._set_filter_value(Page(combo), gateway.PortalReadAction(type="filter", field="Status", value="Under Review"))
    if selected:
        asyncio.run(operation)
    else:
        with pytest.raises(RuntimeError, match="reader_filter_value_not_confirmed"):
            asyncio.run(operation)
    assert combo.clicked and option.clicked
    assert combo.filled is None


def test_filter_surface_is_bounded_and_redacts_sensitive_labels_and_values():
    class Page:
        async def evaluate(self, script, limit):
            assert limit == 12
            return {"filterControls": [{"label": "Password", "selected": ["secret"]},
                                       {"label": "Status", "selected": ["Under Review"], "options": ["x"] * 25}],
                    "metrics": [{"label": "Under Review", "value": "13"}] * 25}
    result = asyncio.run(gateway._observe_filter_surface(Page(), 20))
    assert len(result["filterControls"]) == 1
    assert len(result["filterControls"][0]["options"]) == 20
    assert len(result["metrics"]) == 12
    assert result["metrics"][0] == {"label": "Under Review", "value": "13"}


def test_inline_apply_filter_uses_page_but_overlay_apply_stays_scoped():
    page = FakePage(FakeLocator(descriptor="Filter"))
    action = gateway.PortalReadAction(type="apply_filter", role="button", name="Filter")
    assert gateway._semantic_locator(page, action) is page.result
    # Overlay scoping remains explicit, so a page button cannot shadow a dialog button.
    overlay = FakeLocator(descriptor="Apply")
    class OverlayPage(FakePage):
        def locator(self, selector):
            return overlay
    assert gateway._semantic_locator(OverlayPage(page.result), action, prefer_overlay=True) is overlay


def test_filter_sets_bounded_native_multiselect_values() -> None:
    select_locator = FakeLocator(tag="select")

    asyncio.run(gateway._set_filter_value(
        FakePage(select_locator),
        gateway.PortalReadAction(type="filter", field="Status", values=["Pending Review", "Completed"]),
    ))

    assert select_locator.selected == ["Pending Review", "Completed"]


class FakeFilterSearchPage(FakePage):
    def __init__(self, *, labels=(), textboxes=(), placeholders=(), overlay=None):
        super().__init__(FakeLocatorGroup())
        self.labels=FakeLocatorGroup(*labels)
        self.textboxes=FakeLocatorGroup(*textboxes)
        self.placeholders=FakeLocatorGroup(*placeholders)
        self.overlay=overlay
    def locator(self, selector):
        return FakeLocatorGroup(self.overlay) if self.overlay else FakeLocatorGroup()
    def get_by_label(self, label, exact=True):
        return self.labels
    def get_by_role(self, role, **kwargs):
        return self.textboxes if role=='textbox' else FakeLocatorGroup()
    def get_by_placeholder(self, name, exact=True):
        return self.placeholders


@pytest.mark.parametrize('source', ['textboxes','placeholders'])
def test_filter_field_falls_back_to_exact_unique_visible_name(source):
    control=FakeLocator(tag='input',input_type='search')
    page=FakeFilterSearchPage(**{source:[control]})
    asyncio.run(gateway._set_filter_value(page,gateway.PortalReadAction(type='filter',field='Search',value='R-1')))
    assert control.filled=='R-1'


@pytest.mark.parametrize('source', ['labels','textboxes','placeholders'])
def test_filter_rejects_multiple_visible_matches(source):
    controls=[FakeLocator(tag='input'),FakeLocator(tag='input')]
    page=FakeFilterSearchPage(**{source:controls})
    with pytest.raises(RuntimeError,match='reader_filter_control_not_unique'):
        asyncio.run(gateway._set_filter_value(page,gateway.PortalReadAction(type='filter',field='Search',value='R-1')))
    assert all(x.filled is None for x in controls)


def test_filter_ignores_hidden_name_but_keeps_exact_visible_match():
    hidden=FakeLocator(tag='input',visible=False)
    visible=FakeLocator(tag='input')
    page=FakeFilterSearchPage(textboxes=[hidden,visible])
    asyncio.run(gateway._set_filter_value(page,gateway.PortalReadAction(type='filter',field='Search',value='R-1')))
    assert visible.filled=='R-1' and hidden.filled is None


@pytest.mark.parametrize('source',['labels','textboxes'])
def test_filter_fallback_does_not_drop_an_explicit_region_constraint(source):
    control=FakeLocator(tag='input')
    page=FakeFilterSearchPage(**{source:[control]})
    with pytest.raises(RuntimeError,match='reader_filter_scope_not_unique'):
        asyncio.run(gateway._set_filter_value(page,gateway.PortalReadAction(type='filter',field='Search',section='Missing',value='R-1')))
    assert control.filled is None


def test_filter_fallback_does_not_escape_an_open_overlay():
    class EmptyOverlay(FakeLocator):
        def get_by_label(self,*args,**kwargs):return FakeLocatorGroup()
        def get_by_role(self,*args,**kwargs):return FakeLocatorGroup()
        def get_by_placeholder(self,*args,**kwargs):return FakeLocatorGroup()
    control=FakeLocator(tag='input')
    page=FakeFilterSearchPage(textboxes=[control],placeholders=[control],overlay=EmptyOverlay())
    with pytest.raises(RuntimeError,match='reader_selector_not_found'):
        asyncio.run(gateway._set_filter_value(page,gateway.PortalReadAction(type='filter',field='Search',value='R-1')))
    assert control.filled is None


@pytest.mark.parametrize('input_type',['password','file','checkbox','radio','hidden','submit'])
def test_filter_name_fallback_never_fills_nonquery_or_sensitive_controls(input_type):
    control=FakeLocator(tag='input',input_type=input_type)
    page=FakeFilterSearchPage(placeholders=[control])
    with pytest.raises(RuntimeError):
        asyncio.run(gateway._set_filter_value(page,gateway.PortalReadAction(type='filter',field='Search',value='R-1')))
    assert control.filled is None


def test_filter_rejects_unknown_or_password_controls() -> None:
    for locator in (FakeLocator(tag="div"), FakeLocator(tag="input", input_type="password")):
        with pytest.raises(RuntimeError):
            asyncio.run(
                gateway._set_filter_value(
                    FakePage(locator),
                    gateway.PortalReadAction(type="filter", field="Status", value="Pending Review"),
                )
            )


def test_runtime_click_validation_is_shared_by_selector_and_semantic_locators() -> None:
    for action in (
        gateway.PortalReadAction(type="paginate", selector="[aria-label='Next']", role="link", name="Next"),
        gateway.PortalReadAction(type="paginate", role="link", name="Next"),
    ):
        locator = FakeLocator(descriptor="Next", tag="a", rel="next")
        asyncio.run(gateway._safe_click(FakePage(locator), action))
        assert locator.clicked


def test_runtime_click_verifies_tab_and_sort_state() -> None:
    tab = FakeLocator(descriptor="To Do", role="tab", aria_selected="true")
    sort = FakeLocator(descriptor="Submission Time", role="columnheader", tag="th", aria_sort="ascending")

    asyncio.run(gateway._safe_click(FakePage(tab), gateway.PortalReadAction(type="switch_tab", role="tab", name="To Do")))
    asyncio.run(gateway._safe_click(FakePage(sort), gateway.PortalReadAction(
        type="sort", role="columnheader", name="Submission Time", direction="ascending",
    )))

    assert tab.clicked
    assert sort.clicked


def test_runtime_switch_tab_requires_one_visible_semantic_target() -> None:
    action = gateway.PortalReadAction(type="switch_tab", role="tab", name="Movies")
    visible = FakeLocator(descriptor="Movies", role="tab", aria_selected="true")
    hidden = FakeLocator(descriptor="Movies", role="tab", aria_selected="false", visible=False)

    asyncio.run(gateway._safe_click(FakePage(FakeLocatorGroup(hidden, visible)), action))

    assert visible.clicked
    assert not hidden.clicked


def test_runtime_switch_tab_rejects_ambiguous_visible_semantic_targets() -> None:
    action = gateway.PortalReadAction(type="switch_tab", role="tab", name="Movies")
    first = FakeLocator(descriptor="Movies", role="tab", aria_selected="true")
    second = FakeLocator(descriptor="Movies", role="tab", aria_selected="false")

    with pytest.raises(RuntimeError, match="reader_switch_tab_ambiguous"):
        asyncio.run(gateway._safe_click(FakePage(FakeLocatorGroup(first, second)), action))

    assert not first.clicked
    assert not second.clicked


def test_runtime_switch_tab_keeps_missing_target_error() -> None:
    action = gateway.PortalReadAction(type="switch_tab", role="tab", name="Movies")

    with pytest.raises(RuntimeError, match="reader_selector_not_found"):
        asyncio.run(gateway._safe_click(FakePage(FakeLocatorGroup()), action))


def test_switch_tab_matches_separate_numeric_badge_and_confirms_unique_bem_active_transition():
    initial = FakeBadgedTab("Urgent 0", parts=["Urgent", "0"], active=True)
    target = FakeBadgedTab("Blocked 4", parts=["Blocked", "4"])
    page = FakeTabPage([initial, target])
    asyncio.run(gateway._safe_click(page, gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked")))
    assert target.clicked and not initial.clicked
    assert target.active() and not initial.active()
    assert asyncio.run(gateway._reader_selected_tab_texts(page)) == ["Blocked 4"]


def test_switch_tab_exact_visible_match_wins_over_badged_candidate():
    exact = FakeBadgedTab("Blocked", aria_selected="true")
    badged = FakeBadgedTab("Blocked 4", parts=["Blocked", "4"])
    page = FakeTabPage([exact, badged])
    asyncio.run(gateway._safe_click(page, gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked")))
    assert exact.clicked and not badged.clicked
    assert all(isinstance(name, str) for role, name, _ in page.lookups if role == "tab")


@pytest.mark.parametrize("descriptor,parts", [
    ("Blocked tasks 4", ["Blocked tasks", "4"]),
    ("Blocked 4 more", ["Blocked", "4 more"]),
    ("Blocked4", ["Blocked", "4"]),
    ("Blocked 4", None),
    ("Blocked 4", ["Blocked 4"]),
    ("Blocked 4", ["Blocked", "4", "other"]),
    ("Blocked 4", ["Other", "4"]),
    ("Blocked 4", ["Blocked", "4 pending"]),
])
def test_switch_tab_badge_fallback_does_not_accept_arbitrary_prefix_or_unproven_number(descriptor, parts):
    target = FakeBadgedTab(descriptor, parts=parts, aria_selected="true")
    with pytest.raises(RuntimeError, match="reader_selector_not_found"):
        asyncio.run(gateway._safe_click(FakeTabPage([target]), gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked")))
    assert not target.clicked


def test_numeric_label_is_not_stripped_as_a_count_but_can_have_its_own_badge():
    label_only = FakeBadgedTab("Phase 2", parts=["Phase 2"], aria_selected="true")
    with pytest.raises(RuntimeError, match="reader_selector_not_found"):
        asyncio.run(gateway._safe_click(FakeTabPage([label_only]), gateway.PortalReadAction(type="switch_tab", role="tab", name="Phase")))
    numbered = FakeBadgedTab("Phase 2 4", parts=["Phase 2", "4"], aria_selected="true")
    asyncio.run(gateway._safe_click(FakeTabPage([numbered]), gateway.PortalReadAction(type="switch_tab", role="tab", name="Phase 2")))
    assert numbered.clicked


def test_badged_tab_fallback_is_unique_visible_and_preserves_exact_region_scope():
    hidden = FakeBadgedTab("Blocked 3", parts=["Blocked", "3"], aria_selected="true")
    hidden.visible = False
    selected = FakeBadgedTab("Blocked 4", parts=["Blocked", "4"], aria_selected="true")
    unrelated = FakeBadgedTab("Blocked 9", parts=["Blocked", "9"], aria_selected="true")
    region = FakeTabPage([hidden, selected])
    page = FakeTabPage([unrelated], sections={"My Work": region})
    action = gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked", section="My Work")
    asyncio.run(gateway._safe_click(page, action))
    assert selected.clicked and not unrelated.clicked and not hidden.clicked
    assert all(role == "region" and name == "My Work" and exact for role, name, exact in page.lookups)
    selected.clicked = False
    hidden.visible = True
    with pytest.raises(RuntimeError, match="reader_switch_tab_ambiguous"):
        asyncio.run(gateway._safe_click(page, action))
    assert not selected.clicked and not hidden.clicked


def test_tab_scope_prefers_visible_named_region_to_same_named_heading():
    target = FakeBadgedTab("Blocked 4", parts=["Blocked", "4"], aria_selected="true")
    unrelated = FakeBadgedTab("Blocked 9", parts=["Blocked", "9"], aria_selected="true")
    heading = FakeTabHeading(FakeTabPage([unrelated]))
    page = FakeTabPage(sections={"Needs Review": FakeTabPage([target])}, headings={"Needs Review": [heading]})
    asyncio.run(gateway._safe_click(page, gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked", section="Needs Review")))
    assert target.clicked and not unrelated.clicked
    assert not heading.selectors
    assert not any(role == "heading" for role, _, _ in page.lookups)


@pytest.mark.parametrize("badged", [True, False])
def test_tab_scope_uses_unique_visible_exact_heading_nearest_semantic_ancestor(badged):
    target = FakeBadgedTab("Blocked 4" if badged else "Blocked", parts=["Blocked", "4"] if badged else None, aria_selected="true")
    extra_badge = FakeBadgedTab("Blocked 7", parts=["Blocked", "7"], aria_selected="true")
    scope = FakeTabPage([target] if badged else [target, extra_badge])
    heading = FakeTabHeading(scope)
    hidden_heading = FakeTabHeading(FakeTabPage(), visible=False)
    global_tab = FakeBadgedTab("Blocked", aria_selected="true")
    page = FakeTabPage([global_tab], headings={"Needs Review": [hidden_heading, heading]})
    asyncio.run(gateway._safe_click(page, gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked", section="Needs Review")))
    assert target.clicked and not global_tab.clicked and not extra_badge.clicked
    assert heading.selectors == ["xpath=ancestor::*[self::section or @role='region'][1]"]
    assert all(exact and name == "Needs Review" for role, name, exact in page.lookups if role in {"region", "heading"})
    assert not any(role == "tab" for role, _, _ in page.lookups)


@pytest.mark.parametrize("multiple", ["regions", "headings"])
def test_tab_scope_rejects_multiple_visible_scope_candidates(multiple):
    targets = [FakeBadgedTab("Blocked 4", parts=["Blocked", "4"], aria_selected="true") for _ in range(2)]
    scopes = [FakeTabPage([target]) for target in targets]
    page = FakeTabPage(sections={"Needs Review": scopes} if multiple == "regions" else {},
                       headings={"Needs Review": [FakeTabHeading(scope) for scope in scopes]} if multiple == "headings" else {})
    with pytest.raises(RuntimeError, match="reader_switch_tab_ambiguous"):
        asyncio.run(gateway._safe_click(page, gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked", section="Needs Review")))
    assert not any(target.clicked for target in targets)


@pytest.mark.parametrize("headings", [[], [FakeTabHeading()], [FakeTabHeading(FakeTabPage(visible=False))]])
def test_tab_scope_falls_back_to_one_global_tab_when_planner_section_is_not_a_dom_scope(headings):
    global_tab = FakeBadgedTab("Blocked 4", parts=["Blocked", "4"], aria_selected="true")
    page = FakeTabPage([global_tab], headings={"Needs Review": headings})
    asyncio.run(gateway._safe_click(
        page,
        gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked", section="Needs Review"),
    ))
    assert global_tab.clicked


def test_heading_scope_fallback_does_not_apply_to_non_tab_actions():
    target = FakeBadgedTab("Blocked", aria_selected="true")
    heading = FakeTabHeading(FakeTabPage([target]))
    page = FakeTabPage(headings={"Needs Review": [heading]})
    action = gateway.PortalReadAction(type="paginate", role="link", name="Next", section="Needs Review")
    assert asyncio.run(gateway._reader_tab_fallback_targets(page, action)) == []
    assert not heading.selectors and not target.clicked


def test_badged_mutation_tab_still_fails_before_click():
    target = FakeBadgedTab("Approve 4", parts=["Approve", "4"], aria_selected="true")
    with pytest.raises(RuntimeError, match="action_not_read_only"):
        asyncio.run(gateway._safe_click(FakeTabPage([target]), gateway.PortalReadAction(type="switch_tab", role="tab", name="Approve")))
    assert not target.clicked


@pytest.mark.parametrize("aria_selected", ["false", ""])
def test_explicit_aria_state_wins_over_active_class(aria_selected):
    target = FakeBadgedTab("Blocked", aria_selected=aria_selected, active=True)
    page = FakeTabPage([target, FakeBadgedTab("Urgent")])
    with pytest.raises(RuntimeError, match="reader_tab_state_not_confirmed"):
        asyncio.run(gateway._safe_click(page, gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked")))
    assert asyncio.run(gateway._reader_selected_tab_texts(page)) == []


@pytest.mark.parametrize("state_class", ["item--active", "item--selected", "active", "selected", "is-active", "is-selected"])
def test_missing_aria_tab_state_accepts_only_explicit_unique_selection_classes(state_class):
    target = FakeBadgedTab("Blocked", state_class=state_class)
    page = FakeTabPage([target, FakeBadgedTab("Urgent")])
    asyncio.run(gateway._safe_click(page, gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked")))
    assert asyncio.run(gateway._reader_selected_tab_texts(page)) == ["Blocked"]


@pytest.mark.parametrize("state_class", ["inactive", "unselected", "active-ish", "item--active-other", "item"])
def test_missing_aria_tab_state_rejects_ambiguous_or_absent_selection_classes(state_class):
    target = FakeBadgedTab("Blocked", state_class=state_class)
    page = FakeTabPage([target, FakeBadgedTab("Urgent")])
    with pytest.raises(RuntimeError, match="reader_tab_state_not_confirmed"):
        asyncio.run(gateway._safe_click(page, gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked")))
    assert asyncio.run(gateway._reader_selected_tab_texts(page)) == []


def test_missing_aria_does_not_pass_unchanged_unselected_or_ambiguous_group():
    target = FakeBadgedTab("Blocked", on_click=False)
    other = FakeBadgedTab("Urgent", active=True)
    page = FakeTabPage([target, other])
    action = gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked")
    with pytest.raises(RuntimeError, match="reader_tab_state_not_confirmed"):
        asyncio.run(gateway._safe_click(page, action))
    target.attributes["class"] = "item--active"
    with pytest.raises(RuntimeError, match="reader_tab_state_not_confirmed"):
        asyncio.run(gateway._safe_click(page, action))
    assert asyncio.run(gateway._reader_selected_tab_texts(page)) == []


@pytest.mark.parametrize("state", ["active", "selected"])
def test_selected_data_state_is_observable_without_aria(state):
    target = FakeBadgedTab("Blocked", data_state=state, on_click=False)
    page = FakeTabPage([target, FakeBadgedTab("Urgent")])
    asyncio.run(gateway._safe_click(page, gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked")))
    assert asyncio.run(gateway._reader_selected_tab_texts(page)) == ["Blocked"]


def test_observation_attaches_unique_fallback_tab_state_to_region_and_single_table():
    target = FakeBadgedTab("Blocked 4", active=True)
    tabs = FakeTabPage([target, FakeBadgedTab("Urgent 0")])
    section = FakeSemanticSection("Needs Review", ["Blocked 4", "Urgent 0"])
    section_locator = section.locator
    section.locator = lambda selector: tabs.locator(selector) if selector == "[role='tab']:not([aria-selected])" else section_locator(selector)
    page = FakeObservationPage({}, sections=[section], containers=[FakeStructuredContainer(
        [("Task No.", True)], [FakeStructuredRow([("T-100", True)])],
    )])
    page_locator = page.locator
    page.locator = lambda selector: tabs.locator(selector) if selector == "[role='tab']:not([aria-selected])" else page_locator(selector)
    observation = asyncio.run(gateway._observe_semantics(page, 20))
    assert observation["regionSummaries"][0]["selectedState"] == "Blocked 4"
    assert observation["sectionSummaries"][0]["selectedState"] == "Blocked 4"


@pytest.mark.parametrize("native", [True, False])
def test_switch_tab_waits_for_bounded_asynchronous_selection_update(monkeypatch, native):
    target = FakeBadgedTab("Blocked", on_click=False, aria_selected="false" if native else None)
    page = FakeTabPage([target, FakeBadgedTab("Urgent")])
    waits = []

    async def update_after_render(delay):
        waits.append(delay)
        if len(waits) == 2:
            if native:
                target.attributes["aria-selected"] = "true"
            else:
                target.attributes["class"] = "item--active"

    monkeypatch.setattr(gateway.asyncio, "sleep", update_after_render)
    asyncio.run(gateway._safe_click(page, gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked")))
    assert waits == [0.1, 0.1]
    assert target.clicked


def test_switch_tab_selection_wait_is_bounded(monkeypatch):
    target = FakeBadgedTab("Blocked", on_click=False)
    page = FakeTabPage([target, FakeBadgedTab("Urgent")])
    waits = []

    async def unchanged_after_render(delay):
        waits.append(delay)

    monkeypatch.setattr(gateway.asyncio, "sleep", unchanged_after_render)
    with pytest.raises(RuntimeError, match="reader_tab_state_not_confirmed"):
        asyncio.run(gateway._safe_click(page, gateway.PortalReadAction(type="switch_tab", role="tab", name="Blocked")))
    assert len(waits) == 10 and sum(waits) <= 1.01


@pytest.mark.parametrize("descriptor", ["Suspend", "Archive", "Enable", "Disable", "Close", "Open", "Activate", "Deactivate"])
def test_runtime_click_rejects_additional_write_descriptors(descriptor) -> None:
    action = gateway.PortalReadAction(type="paginate", role="link", name=descriptor)
    locator = FakeLocator(descriptor=descriptor, tag="a", rel="next")

    with pytest.raises(RuntimeError, match="action_not_read_only"):
        asyncio.run(gateway._safe_click(FakePage(locator), action))


@pytest.mark.parametrize("descriptor", ["Refunds 2", "Appeals", "Open tasks", "Approval tasks"])
def test_runtime_click_allows_read_only_resource_and_status_tabs(descriptor) -> None:
    action = gateway.PortalReadAction(type="switch_tab", role="tab", name=descriptor)
    locator = FakeLocator(descriptor=descriptor, role="tab", aria_selected="true")

    asyncio.run(gateway._safe_click(FakePage(locator), action))

    assert locator.clicked


def test_runtime_click_rejects_role_descriptor_and_aria_mismatch() -> None:
    cases = (
        (gateway.PortalReadAction(type="switch_tab", role="tab", name="Licensing"), FakeLocator(descriptor="Licensing", role="button"), "reader_click_role_mismatch"),
        (gateway.PortalReadAction(type="paginate", role="link", name="Next"), FakeLocator(descriptor="Previous", tag="a", rel="next"), "reader_click_descriptor_mismatch"),
        (gateway.PortalReadAction(type="expand_details", role="button", name="Details", permissionCode="licensing.view_detail"), FakeLocator(descriptor="Details", tag="button"), "reader_click_target_not_expandable"),
    )
    for action, locator, error in cases:
        with pytest.raises(RuntimeError, match=error):
            asyncio.run(gateway._safe_click(FakePage(locator), action))


@pytest.mark.parametrize(
    "overrides",
    [
        {"maxPages": gateway.READER_MAX_PAGES + 1},
        {"timeoutSeconds": gateway.READER_TIMEOUT_SECONDS + 1},
        {"maxOutputItems": gateway.READER_MAX_OUTPUT_ITEMS + 1},
    ],
)
def test_gateway_schema_caps_page_timeout_and_output_limits(overrides) -> None:
    with pytest.raises(ValidationError):
        read_request(**overrides)


def test_gateway_schema_caps_actions() -> None:
    with pytest.raises(ValidationError):
        read_request([{"type": "observe"}] * (gateway.READER_MAX_ACTIONS + 1))


def test_gateway_permission_parser_handles_real_admin_shape() -> None:
    context = gateway._gateway_permission_context(admin_user_info())

    assert context["userId"] == "admin-7"
    assert "Licensing Manager" in context["roles"]
    assert "/licensing" in context["pages"]
    assert "/licensing/tasks/:id" in context["subpages"]
    assert context["departments"] == ()
    assert "licensing.view_detail" in context["buttons"]


def test_gateway_permission_context_includes_department_and_identity_free_fingerprint() -> None:
    first = admin_user_info()
    first["data"]["listRoles"][0]["departmentId"] = 42
    second = admin_user_info()
    second["data"]["listRoles"][0]["departmentId"] = 42
    second["data"]["id"] = "another-admin"

    first_context = gateway._gateway_permission_context(first)
    second_context = gateway._gateway_permission_context(second)

    assert "42" in first_context["departments"]
    assert gateway._permission_fingerprint(first_context) == gateway._permission_fingerprint(second_context)


def test_gateway_permission_fingerprint_covers_every_authorization_dimension() -> None:
    context = gateway._gateway_permission_context(admin_user_info())
    baseline = gateway._permission_fingerprint(context)

    for key in ("departments", "roles", "pages", "subpages", "buttons", "dataScope"):
        changed = {**context, key: (*context[key], "changed")}
        assert gateway._permission_fingerprint(changed) != baseline


def test_gateway_permissions_fail_closed_when_ui_claims_access_but_tree_is_empty() -> None:
    payload = admin_user_info(roles=False, pages=False)
    payload["uiAppearsAccessible"] = True

    with pytest.raises(HTTPException) as raised:
        gateway._validate_gateway_permissions(payload, "/licensing", "admin-7")

    assert error_code(raised.value) == "reader_permission_context_incomplete"


def test_default_post_allowlist_is_exact() -> None:
    assert gateway.READER_READ_ONLY_POST_PATHS == {
        "/api/AdminUser/GetUserInfo",
        "/api/Role/GetRolesGroupedByDepartmentId",
        "/api/Application/MyComplatedPage",
        "/api/Application/MyTodoPage",
        "/api/Content/MyTodoPage",
        "/api/Content/MyComplatedPage",
        "/api/content/team-management/tasks/query",
        "/api/LicenseManagement/list",
        "/api/licensing/team-management/tasks/query",
        "/api/inspection/team-management/tasks/query",
        "/api/customer-happiness/team-management/tasks/query",
    }


@pytest.mark.parametrize(
    "path",
    [
        "/api/AdminUser/GetUserInfo",
        "/api/Application/MyComplatedPage",
        "/api/Application/MyTodoPage",
        "/api/LicenseManagement/list",
        "/api/licensing/team-management/tasks/query",
        "/api/inspection/team-management/tasks/query",
    ],
)
def test_guard_allows_only_configured_read_only_posts(path) -> None:
    assert guard("POST", path) == ("continue", None)


def test_default_get_allowlist_is_server_owned_and_exact() -> None:
    assert gateway.READER_READ_ONLY_GET_PATHS == {
        "/api/content/team-management/members",
        "/api/customer-happiness/team-management/members",
        "/api/Team/MyTeamMembers",
        "/api/license/dashboard/overview",
        "/api/Content/MyReviewDetail/:taskId",
        "/api/content/team-management/metadata",
        "/api/content/team-management/summary",
        "/api/TypeDictionary/GetTypeDictionaries/ModificationReason",
        "/api/TypeDictionary/GetTypeDictionaries/RejectionReason",
        "/api/license/dashboard/license-distribution",
        "/api/license/dashboard/performance",
        "/api/license/dashboard/performance-trend",
        "/api/license/dashboard/members-needing-coaching",
        "/api/license/dashboard/members-on-leave",
        "/api/license/dashboard/needs-attention",
        "/api/Content/Dashboard/Overview",
        "/api/Content/Dashboard/TaskList",
        "/api/ContentLibrary/GetBookList",
        "/api/ContentLibrary/GetBooksCount",
        "/api/ContentLibrary/GetCinemaList",
        "/api/ContentLibrary/GetCinemasCount",
        "/api/Lookup/GetLookupData",
        "/api/Lookup/GetSubjectList",
        "/api/Inspection/Dashboard/Overview",
        "/api/Inspection/Dashboard/TaskList",
        "/api/inspection/reportsAnalytics/riskInsights",
        "/api/inspection/team-management/metadata",
        "/api/inspection/team-management/members",
        "/api/inspection/team-management/summary",
        "/api/admin/inspection/lookup/inspectors",
        "/api/admin/inspection/lookup/reasons",
        "/api/admin/inspection/lookup/task-statuses",
        "/api/admin/inspection/lookup/inspection-methods",
        "/api/admin/inspection/lookup/emirates",
        "/api/admin/inspection/lookup/priorities",
        "/api/admin/inspection/tasks",
        "/api/admin/inspection/tasks/:id",
        "/api/admin/inspection/tasks/:id/checklist-template",
        "/api/admin/inspection/tasks/created-by-users",
        "/api/admin/inspection/tasks/stats",
        "/api/admin/inspection/violations",
        "/api/admin/inspection/violations/stats",
        "/api/admin/finance/transactions",
        "/api/admin/finance/lookups/payment-methods",
        "/api/admin/finance/lookups/transaction-types",
        "/api/admin/finance/lookups/transaction-statuses",
        "/api/admin/finance/transactions/statistics",
        "/api/admin/finance/transactions/payment-method-statistics",
        "/api/CustomerHappiness/Dashboard/Overview",
        "/api/CustomerHappiness/Dashboard/TaskList",
        "/api/customer-happiness/team-management/metadata",
        "/api/customer-happiness/team-management/summary",
        "/api/AdminUser/LoginMethod",
        "/api/UserManagement/GetAdminUserAsync",
        "/api/UserManagement/GetCustomerUsersAsync",
        "/api/UserManagement/GetCustomerInfoCountDto",
        "/api/TypeDictionary/GetTypeDictionaries/LoginMethod",
        "/api/TypeDictionary/GetTypeDictionaries/ServiceConfigServiceType",
        "/api/Application/UrgenCount",
        "/api/UserManagement/UserProfile/Approves",
        "/api/UserManagement/UserProfile/UserTypes",
        "/api/UserManagement/UserProfile/Status",
        "/api/UserManagement/UserProfile/Type/Count",
        "/api/LicenseManagement/statistics",
        "/api/Refund/Admin/Tickets",
        "/api/Refund/Admin/Tickets/Statistics",
        "/api/Refund/Admin/Tickets/CustomerService",
        "/api/Refund/Admin/Types/Status",
        "/api/Refund/Admin/Types/Categories",
        "/api/Refund/Admin/Types/SourceType",
        "/api/Refund/Admin/User/Departments",
        "/api/Refund/Admin/Departments",
        "/api/Enquiry/Management/List",
        "/api/Enquiry/Management/UserInfo",
        "/api/Enquiry/Management/TeamTask/List",
        "/api/Enquiry/Management/Status/Count",
        "/api/Enquiry/Management/EnquiryStatus",
        "/api/Enquiry/EnquiryTypes",
        "/api/Enquiry/PriorityType",
        "/api/Enquiry/EnquirySource",
        "/api/Enquiry/ProblemCauses",
        "/api/serviceInfo/GetAllUserType",
        "/api/Application/dashboard/statistics",
        "/api/Application/dashboard/service/list",
        "/api/Application/dashboard/team/list",
        "/api/UserManagement/dashboard/profile/statistics",
        "/api/UserManagement/dashboard/list",
        "/api/LicenseManagement/dashboard/statistics",
        "/api/LicenseManagement/dashboard/report",
        "/api/licensing/team-management/members",
        "/api/licensing/team-management/metadata",
        "/api/licensing/team-management/summary",
        "/api/TypeDictionary/GetTypeDictionaries/CertificateStatus",
        "/api/Application/MyReviewDetail/:taskId",
        "/api/UserManagement/UserProfile/:id/Personal",
        "/api/UserManagement/UserProfile/:id/Establishment",
        "/api/UserManagement/UserProfile/:id/Partners",
        "/api/LicenseManagement/:id",
        "/api/admin/finance/transactions/:transactionNo",
        "/api/admin/payments/refunds",
        "/api/admin/payments/refunds/statistics",
        "/api/admin/payments/refunds/:refundNo",
        "/api/admin/inspection/violations/:id",
        "/api/admin/inspection/violations/:id/penalty-standard",
        "/api/admin/inspection/violations/:id/timeline",
        "/api/admin/inspection/violations/:id/target-overview",
        "/api/UserManagement/GetEmirateList",
        "/api/UserManagement/GetRegionList/:id",
        "/api/UserManagement/GetAreaList/:id",
        "/api/UserManagement/GetEstablishmentByProfileId/:profileId",
        "/api/UserManagement/:userProfileId/ProfileAndApplicant",
        "/api/UserManagement/:userProfileId/Relate",
        "/api/TypeDictionary/GetTypeDictionaries/RejectDispositionReason",
        "/api/TypeDictionary/GetTypeDictionaries/CertificateDisableReason",
        "/api/Lookup/GetArtistWorkTypes",
        "/api/ServiceInfo/GetEconomicActivitys",
        "/api/Enquiry/Management/:enquiryId/EnquiryInfo",
        "/api/Enquiry/Management/:enquiryId/Timeline",
        "/api/Enquiry/Management/EnquiryInfo/:enquiryId/Relate",
        "/api/Enquiry/Management/EnquiryInfo/:enquiryId/Applicants",
        "/api/admin/application/:applicationId",
        "/api/Refund/Admin/Tickets/:refundId/Detail",
        "/api/Refund/Admin/Tickets/:refundId/Timeline",
        "/api/User/GetUserIndividual",
        "/api/User/GetNationalityList",
        "/api/User/GetEmirateList",
        "/api/User/GetRegionList",
        "/api/User/GetAreaList",
        "/api/User/GetUserEstablishmentByID/:id",
        "/api/Application/:applicationId/recall-approval/eligibility",
    }


@pytest.mark.parametrize("path", sorted(gateway.READER_READ_ONLY_GET_PATHS))
def test_guard_allows_configured_read_only_gets(path) -> None:
    concrete_path = path.replace(":taskId", "task-42").replace(":id", "record-42").replace("{id}", "42")
    assert guard("GET", concrete_path, resource_type="fetch") == ("continue", None)


@pytest.mark.parametrize(
    "path",
    [
        "/api/AdminUser/GetUserInfo",
        "/api/Application/details",
        "/data/read",
        "/api/LicenseManagement",
        "/api/LicenseManagement/record-without-number",
        "/api/LicenseManagement/42/extra",
        "/api/Application/MyReviewDetail",
        "/api/UserManagement/UserProfile/42",
    ],
)
def test_guard_blocks_every_unverified_or_malformed_get_api_or_fetch(path) -> None:
    assert guard("GET", path, resource_type="fetch")[0] == "abort"


def test_guard_matches_get_path_without_using_query_as_a_prefix_escape() -> None:
    assert guard("GET", "/api/license/dashboard/overview?days=7") == ("continue", None)
    assert guard("GET", "/api/license/dashboard/overview/extra?days=7")[0] == "abort"


@pytest.mark.parametrize(
    "path",
    [
        "/api/Application/dashboard/statistics",
        "/api/Application/dashboard/service/list",
        "/api/Application/dashboard/team/list",
        "/api/UserManagement/dashboard/profile/statistics",
        "/api/UserManagement/dashboard/list",
        "/api/LicenseManagement/dashboard/statistics",
        "/api/LicenseManagement/dashboard/report",
    ],
)
def test_guard_allows_only_get_for_verified_dashboard_reads(path) -> None:
    assert guard("GET", path, resource_type="fetch") == ("continue", None)
    assert guard("POST", path, resource_type="fetch")[0] == "abort"
    assert guard("GET", f"{path}/extra", resource_type="fetch")[0] == "abort"


@pytest.mark.parametrize(
    "path",
    [
        "/api/Enquiry/Management/UserInfo",
        "/api/Enquiry/Management/TeamTask/List",
        "/api/Enquiry/Management/Status/Count",
        "/api/Enquiry/Management/EnquiryStatus",
        "/api/Enquiry/EnquiryTypes",
        "/api/Enquiry/PriorityType",
        "/api/Enquiry/EnquirySource",
        "/api/serviceInfo/GetAllUserType",
    ],
)
def test_guard_allows_only_get_for_verified_enquiry_ticket_page_reads(path) -> None:
    assert guard("GET", path, resource_type="fetch") == ("continue", None)
    assert guard("POST", path, resource_type="fetch")[0] == "abort"
    assert guard("GET", f"{path}/extra", resource_type="fetch")[0] == "abort"


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/SignalR/GetNotificationInfoListShowBox"),
        ("GET", "/api/SignalR/GetNotificationInfoList"),
    ],
)
def test_guard_keeps_degraded_ticket_fallback_and_background_reads_blocked(method, path) -> None:
    assert guard(method, path, resource_type="fetch")[0] == "abort"


@pytest.mark.parametrize(('method','path'),[
    ('POST','/api/Role/GetRolesGroupedByDepartmentId'),
    ('GET','/api/Enquiry/ProblemCauses'),
])
def test_verified_ticket_metadata_reads_are_exact_and_cannot_write(method,path):
    # Admin source inspection: role grouping selects roles/departments and
    # ProblemCauses uses AsNoTracking; neither performs business mutations.
    assert guard(method,path,resource_type='fetch') == ('continue',None)
    assert guard('DELETE',path,resource_type='fetch')[0] == 'abort'
    assert guard(method,path+'/update',resource_type='fetch')[0] == 'abort'
    assert guard('POST' if method=='GET' else 'GET',path,resource_type='fetch')[0] == 'abort'


def test_notification_background_paths_are_explicitly_blocked_not_allowed() -> None:
    notification_paths = {
        "/api/SignalR/GetNotificationInfoList",
        "/api/SignalR/GetNotificationInfoListShowBox",
    }

    assert notification_paths <= gateway.READER_BLOCKED_EXACT_PATHS
    assert notification_paths.isdisjoint(gateway.READER_READ_ONLY_GET_PATHS)
    assert all(guard("GET", path, resource_type="fetch")[0] == "abort" for path in notification_paths)


@pytest.mark.parametrize(
    "path",
    [
        "/api/licensing/team-management/members",
        "/api/licensing/team-management/metadata",
        "/api/licensing/team-management/summary",
    ],
)
def test_guard_allows_only_get_for_verified_team_management_reads(path) -> None:
    assert guard("GET", path, resource_type="fetch") == ("continue", None)
    assert guard("POST", path, resource_type="fetch")[0] == "abort"
    assert guard("GET", f"{path}/extra", resource_type="fetch")[0] == "abort"


def test_guard_allows_only_post_for_verified_team_management_task_query() -> None:
    path = "/api/licensing/team-management/tasks/query"

    assert guard("POST", path, resource_type="fetch") == ("continue", None)
    assert guard("GET", path, resource_type="fetch")[0] == "abort"
    assert guard("POST", f"{path}/extra", resource_type="fetch")[0] == "abort"


@pytest.mark.parametrize(
    "path",
    [
        "/api/ContentLibrary/GetBookList",
        "/api/ContentLibrary/GetBooksCount",
        "/api/ContentLibrary/GetCinemaList",
        "/api/ContentLibrary/GetCinemasCount",
        "/api/Lookup/GetLookupData",
        "/api/Lookup/GetSubjectList",
        "/api/inspection/team-management/metadata",
        "/api/inspection/team-management/members",
        "/api/inspection/team-management/summary",
        "/api/admin/inspection/lookup/inspectors",
        "/api/admin/inspection/lookup/reasons",
        "/api/admin/inspection/lookup/task-statuses",
        "/api/admin/inspection/lookup/inspection-methods",
        "/api/admin/inspection/lookup/emirates",
        "/api/admin/inspection/lookup/priorities",
        "/api/admin/inspection/tasks",
        "/api/admin/inspection/tasks/stats",
        "/api/admin/finance/transactions",
        "/api/admin/finance/lookups/payment-methods",
        "/api/admin/finance/lookups/transaction-types",
        "/api/admin/finance/lookups/transaction-statuses",
        "/api/admin/finance/transactions/statistics",
        "/api/admin/finance/transactions/payment-method-statistics",
    ],
)
def test_guard_allows_only_get_for_verified_content_inspection_and_finance_reads(path) -> None:
    assert guard("GET", path, resource_type="fetch") == ("continue", None)
    assert guard("POST", path, resource_type="fetch")[0] == "abort"
    assert guard("GET", f"{path}/extra", resource_type="fetch")[0] == "abort"


def test_guard_allows_only_post_for_verified_inspection_team_management_task_query() -> None:
    path = "/api/inspection/team-management/tasks/query"

    assert guard("POST", path, resource_type="fetch") == ("continue", None)
    assert guard("GET", path, resource_type="fetch")[0] == "abort"
    assert guard("POST", f"{path}/extra", resource_type="fetch")[0] == "abort"


def test_guard_keeps_inspection_task_creation_and_exports_blocked() -> None:
    task_path = "/api/admin/inspection/tasks"

    assert guard("GET", task_path, resource_type="fetch") == ("continue", None)
    assert guard("POST", task_path, resource_type="fetch")[0] == "abort"
    assert guard("GET", f"{task_path}/export", resource_type="fetch")[0] == "abort"
    assert guard("POST", f"{task_path}/export", resource_type="fetch")[0] == "abort"


def test_health_reports_fixed_allowlist_counts() -> None:
    health = asyncio.run(gateway.healthz())

    assert health["readOnlyGetPathCount"] == 130
    assert health["readOnlyPostPathCount"] == 11


@pytest.mark.parametrize(
    ("path", "resource_type"),
    [
        ("/licensing", "document"),
        ("/assets/app.js", "script"),
        ("/assets/vendor-wangeditor.js", "script"),
        ("/assets/app.css", "stylesheet"),
        ("/assets/font.woff2", "font"),
        ("/assets/icon.png", "image"),
    ],
)
def test_guard_allows_same_origin_static_reads(path, resource_type) -> None:
    assert guard("GET", path, resource_type=resource_type) == ("continue", None)


def test_guard_allows_only_the_code_owned_static_fetch() -> None:
    assert guard("GET", "/config.json", resource_type="fetch") == ("continue", None)
    assert guard("GET", "/runtime.json", resource_type="fetch")[0] == "abort"


def test_post_allowlist_cannot_be_extended_from_environment(monkeypatch) -> None:
    monkeypatch.setenv("PORTAL_READER_READ_ONLY_POST_PATHS", "/api/anything-else")

    assert "/api/anything-else" not in gateway.READER_READ_ONLY_POST_PATHS


@pytest.mark.parametrize(
    ("method", "path", "resource_type"),
    [
        ("POST", "/api/Document/OriginalNames", "xhr"),
        ("POST", "/api/clientlog/report", "xhr"),
        ("POST", "/api/anything-else", "xhr"),
        ("GET", "/api/Document/Download", "xhr"),
        ("GET", "/api/Document/%44ownload", "xhr"),
        ("GET", "/socket", "websocket"),
    ],
)
def test_guard_blocks_unapproved_posts_downloads_and_streams(method, path, resource_type) -> None:
    assert guard(method, path, resource_type=resource_type)[0] == "abort"


def test_guard_blocks_cross_origin_requests() -> None:
    route = FakeRoute("GET", "https://outside.example.test/api/data")

    asyncio.run(gateway._guard_reader_request(route, "https://admin.example.test"))

    assert route.result[0] == "abort"


def test_gateway_rechecks_get_user_info_before_browser(monkeypatch) -> None:
    calls = []

    async def fake_umc_request(method, path, **kwargs):
        calls.append((method, path))
        return admin_user_info(roles=False, pages=False)

    monkeypatch.setattr(gateway, "_umc_request", fake_umc_request)
    request = read_request()

    with pytest.raises(HTTPException) as raised:
        asyncio.run(gateway.admin_portal_read(
            request,
            authorization="Bearer token",
            x_request_id="request",
            x_user_id="admin-7",
        ))

    assert error_code(raised.value) == "reader_permission_context_incomplete"
    assert calls == [("POST", "/api/AdminUser/GetUserInfo")]


def test_gateway_rechecks_cell_detail_destination_permission_before_browser(monkeypatch) -> None:
    calls = []
    user_info = admin_user_info()
    user_info["data"]["listSysPermission"] = [{
        "frontendRoute": "/licensing/applications",
        "children": [],
        "buttonList": [{"permissionCode": "licensing.approve"}],
    }]

    async def fake_umc_request(method, path, **kwargs):
        calls.append((method, path))
        return user_info

    monkeypatch.setattr(gateway, "_umc_request", fake_umc_request)
    request = read_request([cell_detail_action()], startPath="/licensing/applications")

    with pytest.raises(HTTPException) as raised:
        asyncio.run(gateway.admin_portal_read(
            request,
            authorization="Bearer token",
            x_request_id="request",
            x_user_id="admin-7",
        ))

    assert error_code(raised.value) == "page_not_permitted"
    assert calls == [("POST", "/api/AdminUser/GetUserInfo")]
