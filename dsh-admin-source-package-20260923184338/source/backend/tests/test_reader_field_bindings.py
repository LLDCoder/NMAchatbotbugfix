import json
import pytest

from app.portal_reader import observation_result_from_plan
from app.portal_reader import _native_sample_value_facts


def test_bounded_value_summary_supports_occurrences_without_weakening_record_identity():
    observation = structured_observation()
    node = observation['sectionSummaries'][0]
    node['rowFields'].append({'Ticket No.': 'T-2', 'Status': 'Open', 'Current Handler': 'Bob'})
    fact = 'Values of Status in the bounded row sample: ["Open"]'
    assert fact in _native_sample_value_facts(node)
    result = resolve({**list_plan(fact), 'answerShape': 'detail'}, observation)
    assert result is not None and result.completeness == 'bounded'
    assert resolve(list_plan(fact), observation) is None
    assert resolve({**list_plan(fact), 'answerShape': 'count'}, observation) is None
    assert resolve({**list_plan('{"Status":"Open"}'), 'answerShape': 'detail'}, observation) is None
    assert resolve({**list_plan(fact.replace('Open', 'Closed')), 'answerShape': 'detail'}, observation) is None
    assert resolve({**list_plan(fact), 'answerShape': 'attention'}, observation) is None
    observation['readHealth'] = {'healthy': False}
    assert resolve({**list_plan(fact), 'answerShape': 'detail'}, observation) is None


def test_sample_values_do_not_merge_tables_or_infer_complete_enums():
    observation = structured_observation()
    observation['sectionSummaries'].append({'nodeId': 'other', 'kind': 'table',
                                           'rowFields': [{'Status': 'Closed'}]})
    for fact in ['Values of Status in the bounded row sample: ["Open", "Closed"]',
                 'All possible Status values: ["Open"]', 'Total 1']:
        assert resolve({**list_plan(fact), 'answerShape': 'detail'}, observation) is None


@pytest.mark.parametrize('healthy', [True, False])
def test_partial_sample_value_summary_still_requires_settled_data(healthy):
    observation = structured_observation()
    observation['readHealth'] = {'healthy': healthy}
    fact = 'Values of Status in the bounded row sample: ["Open"]'
    result = resolve({**list_plan(fact), 'answerShape': 'detail', 'result': 'not_confirmed',
                      'missing': ['remaining_fields_unavailable']}, observation)
    if healthy:
        assert result is not None and result.status == 'not_confirmed'
        assert result.facts == (fact,)
    else:
        assert result is None


def structured_observation(*, selected_state: str = "To Do") -> dict:
    return {
        "regionSummaries": [{
            "nodeId": "observation-region-001",
            "kind": "region",
            "heading": "Queue",
            "selectedState": selected_state,
        }],
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "parentRef": "observation-region-001",
            "heading": "Queue",
            "columnHeaders": ["Ticket No.", "Status", "Current Handler"],
            "rowSummaries": ["T-1 Open Alice"],
            "rowFields": [{"Ticket No.": "T-1", "Status": "Open", "Current Handler": "Alice"}],
        }],
    }


def list_plan(fact: str, *, selected_state: str = "") -> dict:
    plan = {
        "mode": "observation_result",
        "result": "success",
        "page": "/queue",
        "section": "Queue",
        "sourceSection": "observation-table-001",
        "answerShape": "list",
        "facts": [fact],
        "missing": [],
    }
    if selected_state:
        plan["selectedState"] = selected_state
    return plan


def resolve(plan: dict, observation: dict):
    return observation_result_from_plan(
        plan,
        observation,
        observed_page="/queue",
        permitted_paths=("/queue",),
    )


@pytest.mark.parametrize('shape',['detail','overview','attention','due'])
def test_native_field_bindings_support_non_list_row_answers(shape):
    plan={**list_plan(json.dumps({'Ticket No.':'T-1','Status':'Open'})), 'answerShape':shape}
    assert resolve(plan,structured_observation()) is not None
    bad={**plan,'facts':[json.dumps({'Ticket No.':'T-1','Status':'Alice'})]}
    assert resolve(bad,structured_observation()) is None


def test_table_overview_can_use_its_own_summary_but_not_other_table_totals():
    observation=structured_observation()
    observation['sectionSummaries'][0]['summaries']=['Total 200']
    plan={**list_plan('Total 200'),'answerShape':'overview'}
    assert resolve(plan,observation) is not None
    assert resolve({**plan,'facts':['Total 201']},observation) is None


def test_plain_label_value_still_requires_native_json_binding():
    assert resolve({**list_plan('Status: Open'),'answerShape':'detail'},structured_observation()) is None


def test_claimed_selected_state_must_match_the_scoped_node_or_parent() -> None:
    fact = json.dumps({"Ticket No.": "T-1", "Status": "Open", "Current Handler": "Alice"})

    assert resolve(list_plan(fact, selected_state="Completed"), structured_observation()) is None


def test_missing_selected_state_inherits_the_verified_parent_state() -> None:
    fact = json.dumps({"Ticket No.": "T-1", "Status": "Open", "Current Handler": "Alice"})

    result = resolve(list_plan(fact), structured_observation())

    assert result is not None
    assert result.selected_state == "To Do"
    assert result.completeness == "bounded"


def test_native_object_fact_retains_json_bindings_instead_of_python_repr() -> None:
    fields = {"Ticket No.": "T-1", "Status": "Open", "Current Handler": "Alice"}
    result = resolve(list_plan(fields), structured_observation())
    assert result is not None
    assert json.loads(result.facts[0]) == fields


def test_native_object_fact_cannot_swap_observed_fields() -> None:
    assert resolve(list_plan({"Ticket No.": "T-1", "Status": "Alice"}), structured_observation()) is None


def test_nested_object_fact_is_rejected() -> None:
    assert resolve(list_plan({"Ticket No.": {"value": "T-1"}}), structured_observation()) is None


def test_oversized_object_fact_is_not_truncated_into_invalid_json() -> None:
    assert resolve(list_plan({"Ticket No.": "T-1", "Description": "x" * 500}), structured_observation()) is None


def test_unobserved_selected_state_is_not_kept_from_the_plan() -> None:
    observation = structured_observation(selected_state="")
    observation["regionSummaries"] = []
    fact = json.dumps({"Ticket No.": "T-1", "Status": "Open", "Current Handler": "Alice"})

    result = resolve(list_plan(fact, selected_state="Completed"), observation)

    assert result is not None
    assert result.selected_state == ""


def test_ambiguous_table_rejects_guessed_column_value_mapping() -> None:
    observation = {
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "heading": "Queue",
            "columnHeaders": ["Ticket No.", "Status", "Current Handler"],
            "rowSummaries": ["T-1 Open Alice"],
            "rowFields": [],
        }],
    }

    assert resolve(list_plan("Status: Alice; Current Handler: Open"), observation) is None


def test_ambiguous_table_allows_only_the_direct_unlabeled_row() -> None:
    observation = {
        "sectionSummaries": [{
            "nodeId": "observation-table-001",
            "kind": "table",
            "heading": "Queue",
            "columnHeaders": ["Ticket No.", "Status", "Current Handler"],
            "rowSummaries": ["T-1 Open Alice"],
            "rowFields": [],
        }],
    }

    result = resolve(list_plan("T-1 Open Alice"), observation)

    assert result is not None
    assert result.facts == ("T-1 Open Alice",)
    assert result.completeness == "bounded"
