import pytest

from app.portal_reader import observation_result_from_plan, observation_fallback_result


def observation(total=None, **extra):
    return {"sectionSummaries": [{
        "nodeId": "observation-table-001", "kind": "table", "heading": "Records",
        "rowSummaries": ["REF-4 Open", "REF-8 Closed"],
        "columnHeaders": ["Reference", "Status"],
        "summaries": [f"Total {total}"] if total is not None else [],
        **extra,
    }]}


def plan(fact):
    return {"mode": "observation_result", "result": "success", "page": "/work",
            "section": "Records", "sourceSection": "observation-table-001", "answerShape": "count",
            "scope": "unknown", "facts": [fact], "missing": []}


@pytest.mark.parametrize("total", [0, 1, 2, 9, 10, 11, 36, 99, 100, 1001, 100000])
def test_table_count_uses_explicit_summary(total):
    result = observation_result_from_plan(plan(f"Total {total}"), observation(total))
    assert result is not None
    assert result.status == "success"
    assert result.facts == (f"Total {total}",)


@pytest.mark.parametrize("fact", ["4", "8", "2", "Total 4", "Total 8", "Total 2", "REF-4 Open"])
def test_record_and_sample_values_do_not_establish_a_total(fact):
    assert observation_result_from_plan(plan(fact), observation(36)) is None


@pytest.mark.parametrize("extra", [{}, {"controls": ["4", "10 / page", "1/4"]}, {"rowFields": [{"Count": "4"}]}])
def test_missing_total_does_not_use_rows_or_page_controls(extra):
    assert observation_result_from_plan(plan("4"), observation(**extra)) is None


def test_total_stays_bound_to_its_own_table():
    observed = observation(36)
    observed["sectionSummaries"].append({
        "nodeId": "observation-table-002", "kind": "table", "heading": "Other Records",
        "summaries": ["Total 91"], "rowSummaries": ["REF-91 Open"],
    })
    assert observation_result_from_plan(plan("Total 91"), observed) is None
