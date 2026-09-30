"""Unknown object identity cannot authorize an invented identifier lookup chain."""
import copy
from datetime import datetime, timezone

import pytest

from app.generic_reader import PipelineError
from app.generic_reader_contracts import RouteHop
from app.reader_routing import validate_decision
import test_reader_routing_v03 as routing_fixture


def fixture():
    original = routing_fixture.RoutingTests()
    original.setUp()
    decision = original.decision()
    first = decision.candidates[0]
    other = first.model_copy(deep=True)
    other.candidateId = 'detail'
    decision.candidates.append(other)
    candidate = {**original.c, 'candidateId': 'detail'}
    decision.routePlan = [RouteHop(candidateId=original.c['candidateId'], purpose='locate_record',
                                  parameterBindingIds=['crystals.fields#code']),
                          RouteHop(candidateId='detail', purpose='read_final',
                                   parameterBindingIds=['crystals.fields#code'])]
    # This fixture reaches the entity guard before the independent next-hop
    # previous_record contract. The latter must still reject an invented chain.
    original.k.add({'chunks': [{'source_name': 'Another-page', 'content': 'The current permitted page is /work/another.'}]})
    original.k.prompt()
    ref = {'sourceId': next(pid for pid, (_, text) in original.k.passages.items() if '/work/another' in text)}
    current = first.model_copy(deep=True)
    current.candidateId = 'current'
    current.evidence = [type(first.evidence[0]).model_validate(ref)]
    decision.candidates.append(current)
    return original, decision, [original.c, candidate, {**original.c, 'candidateId': 'current', 'route': '/work/another'}]


def current_hint():
    return {'route': '/work/another', 'source': 'browser_hint', 'routeAuthorized': True,
            'capturedAt': datetime.now(timezone.utc).isoformat()}


def test_unknown_entity_lookup_rejected_before_any_execution():
    original, decision, candidates = fixture()
    with pytest.raises(PipelineError, match='routing_lookup_entity_unproven'):
        validate_decision(decision, original.task, candidates, original.k, current_page=current_hint())


@pytest.mark.parametrize('supported', ['object', 'grain', 'record'])
def test_documented_identity_relationship_still_requires_normal_parameter_contract(supported):
    original, decision, candidates = fixture()
    condition = next(c for c in decision.candidates[0].conditions if c.requirementId == supported)
    condition.status = 'supported'
    condition.evidence = copy.deepcopy(decision.candidates[0].evidence)
    with pytest.raises(PipelineError, match='routing_lookup_dependency_missing'):
        validate_decision(decision, original.task, candidates, original.k, current_page=current_hint())


def test_single_page_discovery_and_unknown_output_fields_are_preserved():
    original = routing_fixture.RoutingTests()
    original.setUp()
    decision = original.decision()
    decision.routePlan[0].parameterBindingIds = ['crystals.fields#code']
    validate_decision(decision, original.task, original.candidates, original.k)
    for condition in decision.candidates[0].conditions:
        if condition.requirementId in {'object', 'grain', 'record'}:
            condition.status = 'supported'
            condition.evidence = copy.deepcopy(decision.candidates[0].evidence)
    validate_decision(decision, original.task, original.candidates, original.k)


def test_same_page_chain_and_absent_hint_preserve_existing_lookup_validation():
    original, decision, candidates = fixture()
    for hint in [None, {**current_hint(), 'route': original.c['route']}]:
        with pytest.raises(PipelineError, match='routing_lookup_dependency_missing'):
            validate_decision(decision, original.task, candidates, original.k, current_page=hint)
