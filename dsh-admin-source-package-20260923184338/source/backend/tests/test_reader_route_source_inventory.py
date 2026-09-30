"""Route evidence keeps every permitted capture without weakening verification."""
import pytest
from app.generic_reader import source_inventory
from app.reader_routing import verify_route
from test_reader_context_v3 import task
from test_reader_routing_v03 import knowledge

@pytest.mark.parametrize("count", [11, 35, 128])
def test_verified_tab_retains_all_sources_without_certifying_unmapped_data(count):
    sources = {f"source_{i}": {"data": {}, "verifiedView": "stale"} for i in range(count)}
    value = task(view="open", recordIdentity="")
    result = verify_route(value, "/work/crystals", "/work/crystals", {
        "tabControls": [{"name": "To Do", "selected": True}]}, sources, knowledge())
    assert result.passed
    assert len(sources) == count  # Preserve the inventory; do not grant unknown API view ownership.
    assert result.checks[1].sourceIds == []
    assert all("verifiedView" not in s for s in sources.values())

@pytest.mark.parametrize("tabs", [[], [{"name":"Completed", "selected":True}],
    [{"name":"To Do", "selected":True}, {"name":"Completed", "selected":True}]])
def test_populated_page_still_requires_unambiguous_selected_view(tabs):
    sources = {f"source_{i}": {"verifiedView": "stale"} for i in range(35)}
    result = verify_route(task(view="open", recordIdentity=""), "/work/crystals", "/work/crystals",
        {"tabControls": tabs}, sources, knowledge())
    assert not result.passed and result.checks[1].sourceIds == []
    assert all("verifiedView" not in s for s in sources.values())

def test_route_checks_do_not_reintroduce_denied_or_unapproved_captures():
    candidates = [{"operationKey": f"GET /api/example/{i}", "trigger": "page_load", "status": 200,
        "policyState": "allowed", "responseEvidence": {"value":i}} for i in range(12)]
    candidates += [{**candidates[0], "operationKey":"GET /api/denied", "status":403},
                   {**candidates[0], "operationKey":"GET /api/unapproved", "policyState":"blocked"}]
    observation = {"apiDiscovery":{"candidates":candidates},
                   "tabControls":[{"name":"To Do", "selected":True}]}
    sources = source_inventory(observation, "/work/crystals", "2026-09-28T00:00:00Z", "principal")
    result = verify_route(task(view="open", recordIdentity=""), "/work/crystals", "/work/crystals",
        observation, sources, knowledge())
    assert result.passed and len(sources) == 12
    assert result.checks[1].sourceIds == []
    assert all("verifiedView" not in s for s in sources.values())
    assert not any(s["operationRef"] in {"GET /api/denied", "GET /api/unapproved"} for s in sources.values())
