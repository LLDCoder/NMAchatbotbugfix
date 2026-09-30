"""Reader boundaries use synthetic entities; no business page rules in code."""
import copy
import pytest
from types import SimpleNamespace
from app.generic_reader import execute_analysis, PipelineError, render_generic_answer
from app.reader_bindings import bind_analysis_evidence
from app.reader_collection import checked_collections, observed_projection_fields, validate_analysis_sources
from test_projected_collection import gateway, setup_rows, collect
from test_reader_generic_completion import detail_fixture


def test_scan_order_is_not_a_population_change():
    rows, captured, spec = setup_rows(25)
    result, _ = collect(rows, captured, spec, lambda payload, params, n:
        {**payload, 'data': {**payload['data'], 'items': list(reversed(payload['data']['items']))}} if n == 2 else payload)
    assert result['completeness'] == 'complete'
    assert result['comparison']['orderChanged'] is True
    assert result['rows'][0]['specimenKey'] == '0'


def test_changed_values_remain_rejected_with_bounded_diagnostics():
    rows, captured, spec = setup_rows(25)
    def change(payload, params, n):
        payload = copy.deepcopy(payload)
        if n == 2:
            payload['data']['items'][0]['phase'] = 'PRIVATE_MUTATED_VALUE'
        return payload
    result, _ = collect(rows, captured, spec, change)
    checked = checked_collections([result])[0]
    assert checked['reason'] == 'collection_changed_between_passes'
    assert checked['comparison']['changedFields'] == ['phase']
    assert checked['comparison']['changedIdentityCount'] == 1
    assert checked['pagesRead'] == 2
    assert 'rows' not in checked and 'PRIVATE_MUTATED_VALUE' not in str(checked)


def test_duplicate_multiplicity_is_not_hidden_by_order_normalization():
    first = [{'key': 'a', 'state': 'x'}, {'key': 'a', 'state': 'x'}, {'key': 'b', 'state': 'y'}]
    second = [{'key': 'a', 'state': 'x'}, {'key': 'b', 'state': 'y'}, {'key': 'b', 'state': 'y'}]
    assert not gateway._collection_comparison(first, second, ['key','state'], ['key'])['equivalent']


def test_later_visible_rows_contribute_nested_schema():
    value = {'data': {'items': [{'id': str(i), 'clock': None} for i in range(5)] +
                              [{'id': '6', 'clock': {'late': True}}]}}
    schema = gateway._collection_row_schemas(value)
    assert 'clock.late' in schema[0]['fields']
    assert schema[0]['sampledRows'] == 6


def test_null_parent_allows_only_documented_child_projection():
    schema = gateway._collection_row_schemas({'items': [{'id': 'a', 'clock': None}]})
    observed = observed_projection_fields(schema, '/items', ['clock.late','clock.invented'], {'clock.late'})
    assert 'clock.late' in observed and 'clock.invented' not in observed


def test_uncollected_field_is_not_observed_null():
    plan = SimpleNamespace(steps=[SimpleNamespace(op='read_rows', sourceId='s', id='read', fields=['id','clock.late'])])
    sources = {'s': {'kind':'projected_collection','collectionReceipt':{'fields':['id']}}}
    with pytest.raises(PipelineError, match='analysis_projection_not_collected') as error:
        validate_analysis_sources(plan, sources)
    assert error.value.details['missingFields'] == ['clock.late']


def test_collection_failure_precedes_an_unrelated_bad_semantic_plan():
    task, plan, sources, knowledge = detail_fixture()
    sources['detail']['collectionFailure'] = 'collection_changed_between_passes'
    plan.requirementBindings[0].knowledgeBindingId = 'invented'
    with pytest.raises(PipelineError, match='collection_changed_between_passes'):
        bind_analysis_evidence(plan, task, knowledge, sources)


def test_observed_object_projection_does_not_create_record_identity_proof():
    task, plan, sources, knowledge = detail_fixture()
    sources['detail'].pop('verifiedRecord')
    result = execute_analysis(plan, sources, knowledge, [], task=None)
    assert result['outputs'][0]['value'][0]['color'] == 'violet'
    assert 'verifiedRecord' not in sources['detail']
    sources['detail']['fieldEvidence']['/data/color']['valueHash'] = 'forged'
    plan.steps[0].unknownPolicy = 'reject'
    with pytest.raises(PipelineError, match='field_evidence_incomplete'):
        execute_analysis(plan, sources, knowledge, [], task=None)


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_unknown_filter_cannot_render_verified_empty(language):
    evidence = {'outputs':[{'label':'Matching records','value':[],'role':'detail','unknownCount':2,
                           'evidence':[{'completeness':'partial'}]}]}
    answer = render_generic_answer(evidence, language)
    assert 'No matching rows.' not in answer and 'لم يتم العثور على سجلات مطابقة.' not in answer


def test_navigation_failure_keeps_paths_but_never_query_values():
    from app.generic_reader import portal_result_failure
    failure = portal_result_failure({'status': 'load_failed', 'limitations': ['reader_undeclared_navigation'],
        'diagnostics': {'stage': 'read', 'navigation': {'requestedPath': '/detail?id=PRIVATE',
            'actualPath': '/list', 'queryKeys': ['id'], 'rawToken': 'PRIVATE'}}})
    assert failure.details['navigation'] == {'requestedPath': '/detail', 'actualPath': '/list', 'queryKeys': ['id']}
    assert 'PRIVATE' not in str(failure.details)


def dependency_fixture():
    from test_reader_requirement_coverage import fixture
    task, _, sources, knowledge = fixture()
    item = next(v for v in knowledge.items.values() if v.get('record'))
    item['record']['applicability']['pageRefs'] = ['/research/specimens']
    return task, sources['queue'], knowledge, item['record']


def test_required_field_dependencies_follow_exact_page_semantics():
    from app.reader_requirements import collection_dependencies
    task, source, knowledge, record = dependency_fixture()
    facts, ambiguous = collection_dependencies(task, knowledge, '/research/specimens', source, '/data/items')
    assert not ambiguous
    assert next(f for f in facts if f['requirementId'] == 'group_0')['fields'] == ['phase']
    assert not any('zone' in f['fields'] for f in facts)
    assert not collection_dependencies(task, knowledge, '/different', source, '/data/items')[0]
    assert not collection_dependencies(task, knowledge, '/research/specimens', source, '/other')[0]


def test_ambiguous_dependencies_do_not_choose_a_business_mapping():
    from app.reader_requirements import collection_dependencies
    task, source, knowledge, record = dependency_fixture()
    fact = next(f for f in record['payload']['bindings'] if f['kind'] == 'group' and f['concept'] == 'phase')
    record['payload']['bindings'].append({**fact, 'id': 'other-phase', 'fields': ['otherPhase']})
    facts, ambiguous = collection_dependencies(task, knowledge, '/research/specimens', source, '/data/items')
    assert not any(f['requirementId'] == 'group_0' for f in facts)
    assert ambiguous[0]['requirementId'] == 'group_0'


def test_context_conflict_cannot_supply_projection_dependencies():
    from app.reader_requirements import collection_dependencies
    task, source, knowledge, record = dependency_fixture()
    source['collectionContext']['parameterHashes'] = {'zone': 'unmatched-hash'}
    facts, _ = collection_dependencies(task, knowledge, '/research/specimens', source, '/data/items')
    assert not any(f['requirementId'] == 'group_0' for f in facts)


@pytest.mark.parametrize('lookup,forbidden', [(False,None),(True,None),(False,'restricted'),(False,'budget')])
def test_collector_closes_required_projection_before_gateway_execution(lookup, forbidden):
    import asyncio, time
    from app.generic_reader import GenericKnowledgeReader
    from app.generic_reader_contracts import CollectionPlan
    from app.portal_reader import PortalReadRequest
    task, source, knowledge, record = dependency_fixture()
    record['payload'].update(sourceBinding={'operationRef': source['operationRef'], 'sourcePath': '/data/items'},
        fields={'specimenKey': 'Entity key', 'phase': 'Phase'},
        pagination={'pageIndex': 'Page', 'pageSize': 'Size', 'totalPath': '/data/total', 'rowsPath': '/data/items'})
    if forbidden:
        fact = next(f for f in record['payload']['bindings'] if f['kind'] == 'group' and f['concept'] == 'phase')
        fact['fields'] = ['accessToken'] if forbidden == 'restricted' else ['field'+str(n) for n in range(20)]
    source['collectionContext'].update(contextRef='a'*64, requestFields=['pageIndex','pageSize'],
        rowSchemas=[{'path':'/data/items','fields':['specimenKey','phase']}])
    class ReachedGateway(Exception): pass
    class Gateway:
        async def invoke(self, principal, name, payload, **kwargs):
            assert payload['collections'][0]['fields'] == (['specimenKey'] if lookup else ['specimenKey','phase'])
            raise ReachedGateway()
    reader = GenericKnowledgeReader(Gateway(), None, portal_base_url='https://portal.test')
    reader.page = '/research/specimens'; reader.knowledge = knowledge; reader.deadline = time.monotonic() + 60
    ref = knowledge.prompt()[0]['passages'][0]['sourceId']
    async def planned(contract, instruction, data, validator):
        plan = CollectionPlan.model_validate({'stage':'collection', 'collections':[{
            'sourceId':'queue','rowsPath':'/data/items','totalPath':'/data/total','fields':['specimenKey'],
            'identityFields':['specimenKey'],'pageField':'pageIndex','sizeField':'pageSize','evidence':[{'sourceId':ref}]}]})
        validator(plan)
        return plan
    reader.structured = planned
    with pytest.raises(PipelineError if forbidden else ReachedGateway) as exc:
        asyncio.run(reader.collect_sources(None, task, PortalReadRequest(reader.page, ({'type':'observe'},)), {},
            {'queue':source}, lookup_fields={source['operationRef']:['specimenKey']} if lookup else None))
    if forbidden:
        assert exc.value.code == ('collection_projection_field_not_permitted' if forbidden == 'restricted'
                                  else 'collection_projection_budget_exceeded')
        return
    assert bool(reader.audit.get('projectionDependencies')) is not lookup


def test_nested_array_projection_requests_a_correct_plan_without_stringifying():
    task, plan, sources, knowledge = detail_fixture()
    sources['detail']['data']['data']['color'] = [{'name':'violet'}]
    sources['detail']['fieldEvidence'] = gateway._reader_field_evidence(sources['detail']['data'], sources['detail']['data'])
    with pytest.raises(PipelineError, match='nested_projection_requires_leaf_fields') as exc:
        execute_analysis(plan, sources, knowledge, [], task=None)
    assert exc.value.category == 'planning'
    assert any(s['path'] == '/data/color' and s['fields'] == ['name'] for s in exc.value.details['observedShapes'])
    plan.steps[0].path = '/data/color'; plan.steps[0].fields = ['name']
    result = execute_analysis(plan, sources, knowledge, [], task=None)
    assert result['outputs'][0]['value'] == [{'name':'violet'}]
