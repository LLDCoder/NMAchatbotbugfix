import json
import pytest
from app.generic_reader import execute_analysis, PipelineError
from app.generic_reader_contracts import Step
from app.reader_bindings import bind_analysis_evidence
from app.reader_collection import projection_hash
from app.reader_related import bind_related_records, redundant_parent_relation_reads
from test_projected_collection import gateway
from test_reader_generic_completion import detail_fixture


def setup():
    task, plan, sources, kb = detail_fixture()
    parent = sources['detail']
    parent['data'] = {'data': {'transaction': parent['data']['data'], 'links': [{'key': 'a', 'display': 'Link A'}]}}
    parent['fieldEvidence'] = gateway._reader_field_evidence(parent['data'], parent['data'])
    parent['verifiedRecord']['path'] = '/data/transaction'
    parent['verifiedProperties'] = {'/data/links': {'parentPath': '/data/transaction', 'keyFields': ['key']}}
    for item in kb.items.values():
        for fact in item['record']['payload']['bindings']:
            fact['sourcePath'] = '/data/transaction'
    receipt = {'operationKey': 'GET /api/specimens/{key}/attributes', 'parentOperationKey': parent['operationRef'],
        'parentPath': '/data/links', 'parentField': 'key', 'parameter': 'key', 'responseKeyPath': '/data/parentKey',
        'verified': True, 'keyHash': projection_hash('a'), 'parentValueHash': projection_hash({'key': 'a'})}
    data = {'data': {'parentKey': 'a', 'color': 'violet'}}
    sources['child'] = {**{k: parent[k] for k in ['page', 'capturedAt', 'principalScopeRef']},
        'operationRef': receipt['operationKey'], 'kind': 'api_response', 'completeness': 'bounded',
        'data': data, 'fieldEvidence': gateway._reader_field_evidence(data, data), 'relatedReadReceipt': receipt}
    assert bind_related_records(sources)
    kb.add({'chunks': [{'content': json.dumps({'records': [{'id': 'specimen.child', 'kind': 'field_semantics',
        'revision': 1, 'status': 'active', 'sources': [{'reference': '/specimens/detail'}],
        'applicability': {'portal': 'admin', 'environments': ['local']}, 'payload': {'bindings': [
        {'id': 'color', 'kind': 'attribute', 'concept': 'color', 'operationRef': receipt['operationKey'],
         'sourcePath': '/data', 'fields': ['color']}]}}]})}]})
    read = plan.steps[0]; read.sourceId = 'child'; read.fields = ['color']
    plan.requirementBindings[2].sourceId = 'child'
    plan.requirementBindings[2].knowledgeBindingId = 'specimen.child#color'
    for id, path, fields in [('parent_key', '/data/transaction', ['key']), ('relation_key', '/data/links', ['key', 'display'])]:
        plan.steps.append(Step(id=id, op='read_rows', sourceId='detail', path=path, fields=fields,
            expose=False, label=id, evidence=list(read.evidence)))
    for binding in plan.requirementBindings[:2]:
        binding.stepIds = ['parent_key', 'relation_key']
    return task, plan, sources, kb


def test_verified_parent_relation_provenance_preserves_child_attribute_and_identity():
    task, plan, sources, kb = setup(); corrections = []
    bind_analysis_evidence(plan, task, kb, sources, corrections=corrections)
    result = execute_analysis(plan, sources, kb, [], task=task)
    assert result['requirementsSatisfied'], result['requirementCoverage']
    assert result['outputs'][0]['value'] == [{'color': 'violet'}]
    assert len([c for c in corrections if c.get('reason') == 'parent_relation_lookup_already_proven_by_runtime']) == 2
    assert all(b.stepIds == ['detail'] for b in plan.requirementBindings[:2])


@pytest.mark.parametrize('change', ['unverified', 'other_principal', 'old_capture', 'wrong_parent', 'wrong_identity',
    'wrong_path', 'missing_key', 'derived_lookup', 'missing_principal', 'missing_capture'])
def test_unverified_or_different_lookup_cannot_be_removed(change):
    task, plan, sources, kb = setup(); child = sources['child']; lookup = plan.steps[-1]
    if change == 'unverified': child['relatedReadReceipt']['verified'] = False
    if change == 'other_principal': child['principalScopeRef'] = 'other'
    if change == 'old_capture': child['capturedAt'] = 'old'
    if change == 'wrong_parent': child['verifiedRecord']['parentSourceId'] = 'another'
    if change == 'wrong_identity': child['verifiedRecord']['identity'] = 'another-record'
    if change == 'wrong_path': lookup.path = '/data/unrelated'
    if change == 'missing_key': lookup.fields = ['display']
    if change == 'derived_lookup': lookup.inputs = ['parent_key']
    if change == 'missing_principal':
        for source in sources.values(): source['principalScopeRef'] = ''
    if change == 'missing_capture':
        for source in sources.values(): source['capturedAt'] = ''
    with pytest.raises(PipelineError): bind_analysis_evidence(plan, task, kb, sources)


@pytest.mark.parametrize('kind', ['attribute', 'measure', 'scope', 'population', 'filter', 'time'])
def test_parent_relation_does_not_satisfy_other_requirement_kinds(kind):
    task, plan, sources, kb = setup()
    fact = {'kind': kind, 'sourcePath': '/data/transaction', 'fields': ['key']}
    assert redundant_parent_relation_reads(task, plan.requirementBindings[0], fact, sources,
        {s.id: s for s in plan.steps}, {'detail': ['detail']}) == []
