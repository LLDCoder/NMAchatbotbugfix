"""Business-neutral acceptance of attributes, temporal data and form evidence."""
import copy
import json
import pytest

from app.generic_reader import KnowledgeStore, PipelineError, execute_analysis, source_inventory
from app.generic_reader_contracts import AnalysisPlan, TaskSpec
from app.reader_bindings import applicable_bindings, bind_analysis_evidence
from app.reader_context import merge_task, refine_task
from app.reader_requirements import requirements_for
from app.reader_temporal import interval_for, timestamp, filter_interval
from app.reader_forms import assess_form
from app.reader_gaps import gap_items
from app.reader_collection import projection_hash
from test_reader_requirement_coverage import fixture, execute
from test_projected_collection import gateway


def detail_fixture():
    task = TaskSpec(stage='task', businessObject='specimen', requestedScope='unknown', requestedGrain='specimen',
        requestedMeasures=[], requestedAttributes=['color'], groupBy=[], timeRange='unknown', filters=[],
        outputShape='detail', needsLiveData=True, readOnly=True, searchQuery='specimen color', unresolvedSlots=[],
        recordIdentity='DISPLAY-A')
    data = {'data': {'key': 'a', 'display': 'DISPLAY-A', 'color': 'violet', 'events': list(range(40))}}
    sources = {'detail': {'data': data, 'page': '/specimens/detail', 'operationRef': 'GET /api/specimens/{key}',
        'kind': 'api_response', 'completeness': 'bounded', 'truncated': True, 'capturedAt': '2026-09-25',
        'principalScopeRef': 'p', 'verifiedRecord': {'single': True, 'path': '/data', 'field': 'display',
            'identity': 'DISPLAY-A', 'keyFields': ['key']}}}
    sources['detail']['fieldEvidence'] = gateway._reader_field_evidence(data, data)
    knowledge = KnowledgeStore()
    facts = [{'id': kind, 'kind': kind, 'concept': concept, 'fields': fields,
        'operationRef': sources['detail']['operationRef'], 'sourcePath': '/data'}
        for kind, concept, fields in [('object', 'specimen', ['key']), ('grain', 'specimen', ['key']),
                                    ('attribute', 'color', ['color'])]]
    record = {'id': 'specimen.detail', 'kind': 'field_semantics', 'revision': 1, 'status': 'active',
        'applicability': {'portal': 'admin', 'environments': ['local']}, 'sources': [{'reference': '/specimens/detail'}],
        'payload': {'bindings': facts}}
    knowledge.add({'chunks': [{'id': 'detail-facts', 'content': json.dumps({'records': [record]})}]})
    ref = knowledge.prompt()[0]['passages'][0]['sourceId']
    claim = lambda v: {'value': v, 'evidence': [{'sourceId': ref}]}
    plan = AnalysisPlan.model_validate({'stage': 'analysis', 'missing': [],
        'context': {'scope': 'unknown', 'scopeEvidence': [], 'grain': claim('specimen'),
            'population': claim('selected specimen'), 'filterScope': claim('selected record'), 'time': claim('current'), 'caveats': []},
        'steps': [{'id': 'detail', 'op': 'read_rows', 'sourceId': 'detail', 'path': '/data', 'fields': ['key', 'color'],
            'label': 'Specimen color', 'role': 'detail', 'unknownPolicy': 'report', 'evidence': [{'sourceId': ref}]}],
        'requirementBindings': [{'requirementId': rid, 'sourceId': 'detail', 'knowledgeBindingId': 'specimen.detail#' + kind,
            'stepIds': ['detail']} for rid, kind in [('object', 'object'), ('grain', 'grain'), ('attribute_0', 'attribute')]]})
    # Detail shape is program-verifiable once all requested attributes pass.
    return task, plan, sources, knowledge


def test_attribute_is_not_a_measure_and_survives_refinement():
    task, _, _, _ = detail_fixture()
    task = merge_task(task, {})
    other = task.model_copy(deep=True); other.requestedAttributes = []
    other.slotUpdates = [s for s in other.slotUpdates if s.field != 'requestedAttributes']
    assert refine_task(task, other).requestedAttributes == ['color']
    assert any(r['kind'] == 'attribute' for r in requirements_for(task))
    assert not any(r['kind'] == 'measure' for r in requirements_for(task))


def test_binding_program_resolves_citation_and_single_grain():
    task, plan, sources, knowledge = detail_fixture()
    bind_analysis_evidence(plan, task, knowledge, sources)
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    by_kind = {r['kind']: r for r in result['requirementCoverage']}
    assert by_kind['attribute']['status'] == 'satisfied'
    assert by_kind['grain']['status'] == 'satisfied'
    assert by_kind['record']['status'] == 'satisfied'
    assert result['requirementsSatisfied']
    assert plan.requirementBindings[0].evidence[0].quote == ''


def test_retired_unrelated_passage_cannot_crash_evidence_binding():
    task, plan, sources, knowledge = detail_fixture()
    knowledge.passages = {'retired:p0': ('no-longer-present', 'Retired source'), **knowledge.passages}
    bind_analysis_evidence(plan, task, knowledge, sources)
    assert all(binding.evidence for binding in plan.requirementBindings)


def test_conflicting_record_removes_its_addressable_passages():
    _, _, _, knowledge = detail_fixture()
    record = copy.deepcopy(next(iter(knowledge.items.values()))['record'])
    record['revision'] += 1
    old_refs = set(knowledge.passages)
    knowledge.add({'chunks': [{'id': 'new-revision', 'content': json.dumps({'records': [record]})}]})
    assert record['id'] in knowledge.conflicted
    assert not old_refs.intersection(knowledge.passages)


def test_binding_cannot_cross_operations():
    task, plan, sources, knowledge = detail_fixture()
    sources['detail']['operationRef'] = 'GET /api/other'
    assert not applicable_bindings(knowledge, sources)
    with pytest.raises(PipelineError, match='analysis_binding_inapplicable'):
        bind_analysis_evidence(plan, task, knowledge, sources)


def test_count_dimension_is_not_an_additional_detail_attribute():
    from app.reader_context import validate_task_grain
    task, _, _, _ = detail_fixture()
    task.outputShape = 'count'; task.requestedMeasures = ['count']; task.groupBy = ['color']
    with pytest.raises(PipelineError, match='intent_group_attribute_conflict'):
        validate_task_grain(task)
    task.outputShape = 'list'  # Explicit row details can legitimately need the field too.
    validate_task_grain(task)


def test_binding_cannot_change_requested_attribute():
    task, plan, sources, knowledge = detail_fixture(); task.requestedAttributes = ['weight']
    with pytest.raises(PipelineError, match='analysis_binding_inapplicable'):
        bind_analysis_evidence(plan, task, knowledge, sources)


def test_unavailable_attribute_does_not_become_verified_null():
    task, plan, sources, knowledge = detail_fixture(); del sources['detail']['data']['data']['color']
    bind_analysis_evidence(plan, task, knowledge, sources)
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['outputs'][0]['value'][0]['color'] is None
    assert result['outputs'][0]['unavailableFields'] == ['color']
    assert not result['requirementsSatisfied']


def test_scalar_receipt_rejects_changed_or_truncated_field():
    task, plan, sources, knowledge = detail_fixture()
    sources['detail']['fieldEvidence'] = {'/data/key': {'status': 'complete', 'valueHash': projection_hash('a')},
        '/data/color': {'status': 'transformed', 'valueHash': projection_hash('violet')}}
    bind_analysis_evidence(plan, task, knowledge, sources)
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['outputs'][0]['unavailableFields'] == ['color']
    assert result['outputs'][0]['value'][0]['color'] is None


def test_gateway_marks_only_truncated_scalar_and_preserves_other_fields():
    raw = {'data': {'label': 'x' * 2000, 'key': 17, 'items': list(range(100))}}
    bounded, _ = gateway._reader_bounded_api_evidence(raw)
    fields = gateway._reader_field_evidence(raw, bounded)
    assert fields['/data/label']['status'] == 'transformed'
    assert fields['/data/key']['status'] == 'complete'
    assert fields['/data/items']['status'] == 'bounded'


def test_unknown_group_is_reported_without_erasing_total():
    task, plan, sources, knowledge = fixture([{'specimenKey': 'a', 'phase': None, 'zone': 'West'}])
    plan.steps[-1].unknownPolicy = 'report'
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['outputs'][0]['value'] == 1
    assert result['outputs'][0]['role'] == 'total'
    assert result['outputs'][1]['value'] == [{'phase': None, 'count': 1}]
    assert result['outputs'][1]['unknownCount'] == 1
    assert not result['requirementsSatisfied']


def test_zero_groups_require_explicit_domain():
    f = fixture(); f[1].steps[-1].includeZeroGroups = True
    with pytest.raises(PipelineError, match='group_domain_definition_missing'):
        execute(f)


REFERENCE = {'nowUtc': '2024-02-28T12:00:00+00:00', 'businessTimezone': 'Asia/Dubai'}


@pytest.mark.parametrize('expression,start,end', [
    ('today', '2024-02-28T00:00:00+04:00', '2024-02-29T00:00:00+04:00'),
    ('this month', '2024-02-01T00:00:00+04:00', '2024-03-01T00:00:00+04:00'),
    ('next 2 days', '2024-02-28T16:00:00+04:00', '2024-03-01T16:00:00+04:00'),
    ('2024-02-29 to 2024-02-29', '2024-02-29T00:00:00+04:00', '2024-03-01T00:00:00+04:00')])
def test_calendar_ranges_include_leap_day(expression, start, end):
    actual = interval_for(expression, REFERENCE)
    assert (actual['start'], actual['end']) == (start, end)
    assert actual['startInclusive'] and not actual['endInclusive']


def test_time_unknown_never_uses_machine_timezone():
    assert timestamp('2026-09-25T09:00:00', {}) is None
    assert timestamp('2026-11-01T01:30:00', {'sourceTimezone': 'America/New_York'}) is None
    assert timestamp('2026-03-08T02:30:00', {'sourceTimezone': 'America/New_York'}) is None


def test_time_filter_has_explicit_end_and_unknown_count():
    rows = [{'date': '2024-02-28T00:00:00+04:00'}, {'date': '2024-02-29T00:00:00+04:00'}, {'date': None}]
    values, unknown = filter_interval(rows, 'date', {}, interval_for('today', REFERENCE))
    assert values == rows[:1] and unknown == 1


def test_unsupported_time_expression_is_capability_gap():
    with pytest.raises(PipelineError) as exc:
        interval_for('around the holiday', REFERENCE)
    assert exc.value.category == 'engine_capability_gap'


def form_fixture(properties=None, values=None):
    data = {'schema': {'type': 'object', 'properties': properties or {
        'attachment': {'title': 'Attachment', 'x-component': 'FilePicker', 'required': True}}},
        'formValues': values if values is not None else {}}
    source = {'data': {'data': {'entity': {'version': 7}}},
        'verifiedRecord': {'single': True, 'path': '/data/entity', 'identity': 'A'},
        'structuredDocuments': [{'path': '/data/form', 'data': data, 'completeness': 'complete', 'contentHash': 'h'}]}
    fact = {'sourcePath': '/data/form', 'knowledgeBindingId': 'page#form', 'formDefinition': {
        'format': 'schema_values/1', 'versionPath': '/data/entity/version', 'recordPath': '/data/entity',
        'materialComponents': ['FilePicker'], 'applicabilityComplete': True}}
    return source, fact


def test_form_missing_requires_required_schema_and_observed_version():
    rows, gaps, proof = assess_form(*form_fixture())
    assert rows[0]['status'] == 'missing' and not gaps and proof['version'] == '7'


def test_form_presence_does_not_return_submitted_private_values():
    source, fact = form_fixture(values={'attachment': [{'fileName': 'private.txt', 'url': 'private-path'}]})
    rows, gaps, _ = assess_form(source, fact)
    assert rows[0]['status'] == 'present' and not gaps
    assert 'private' not in json.dumps(rows)


def test_form_scripts_remain_unconfirmed():
    properties = {'attachment': {'x-component': 'FilePicker', 'required': True, 'x-reactions': '{{ arbitrary() }}'}}
    rows, gaps, _ = assess_form(*form_fixture(properties))
    assert rows[0]['status'] == 'unknown' and 'form_condition_unsupported' in gaps


@pytest.mark.parametrize('applicability', [False, None])
def test_unverified_external_form_applicability_is_a_knowledge_gap(applicability):
    source, fact = form_fixture()
    if applicability is None:
        fact['formDefinition'].pop('applicabilityComplete')
    else:
        fact['formDefinition']['applicabilityComplete'] = applicability
    rows, gaps, _ = assess_form(source, fact)
    assert rows[0]['status'] == 'unknown' and gaps == ['form_applicability_unverified']
    assert gap_items(gaps)[0]['category'] == 'knowledge_gap'


def test_form_declarative_condition_false_is_not_missing():
    properties = {'attachment': {'x-component': 'FilePicker', 'required': True,
                               'requiredWhen': {'field': 'category', 'equals': 'sample'}}}
    rows, gaps, _ = assess_form(*form_fixture(properties, {'category': 'control'}))
    assert rows[0]['status'] == 'not_required' and not gaps


def test_form_unknown_condition_is_not_missing():
    properties = {'attachment': {'x-component': 'FilePicker', 'requiredWhen': {'field': 'category', 'equals': 'sample'}}}
    rows, gaps, _ = assess_form(*form_fixture(properties, {}))
    assert rows[0]['status'] == 'unknown' and gaps


@pytest.mark.parametrize('mutation,code', [('version', 'form_version_unverified'), ('truncated', 'form_data_unavailable'),
                                        ('record', 'form_record_unverified')])
def test_form_rejects_missing_proof(mutation, code):
    source, fact = form_fixture()
    if mutation == 'version': del source['data']['data']['entity']['version']
    if mutation == 'truncated': source['structuredDocuments'][0]['completeness'] = 'bounded'
    if mutation == 'record': source['verifiedRecord']['single'] = False
    with pytest.raises(PipelineError, match=code):
        assess_form(source, fact)


def test_gateway_decodes_embedded_json_without_executing_it():
    documents = gateway._reader_structured_documents({'data': {'form': json.dumps([{'formData': json.dumps({
        'schema': {'properties': {'file': {'required': '{{ evil() }}'}}}, 'formValues': {}})}])}})
    assert documents[0]['data'][0]['formData']['schema']['properties']['file']['required'] == '{{ evil() }}'
    assert documents[0]['completeness'] == 'complete'


def test_technical_gaps_do_not_request_kb_import():
    items = gap_items(['knowledge_citation_invalid', 'form_condition_unsupported', 'grouping_value_unavailable', 'priority_definition_missing'])
    assert [x['category'] for x in items] == ['planning', 'engine_capability_gap', 'source_data', 'knowledge_gap']
    assert [x['resolvedByKnowledgeImport'] for x in items] == [False, False, False, True]


def add_fact(knowledge, fact, ident='additional.facts'):
    record = {'id': ident, 'kind': 'field_semantics', 'revision': 1, 'status': 'active',
              'applicability': {'portal': 'admin', 'environments': ['local']},
              'sources': [{'reference': '/research/specimens'}], 'payload': {'bindings': [fact]}}
    knowledge.add({'chunks': [{'id': ident, 'content': json.dumps({'records': [record]})}]})
    ref = next(d['passages'][0]['sourceId'] for d in knowledge.prompt() if d['recordId'] == ident)
    return ident + '#' + fact['id'], ref


def test_explicit_group_domain_adds_zero_without_inventing_business_labels():
    task, plan, sources, knowledge = fixture()
    binding_id, ref = add_fact(knowledge, {'id': 'phase-domain', 'kind': 'group', 'concept': 'phase',
        'operationRef': 'POST /api/specimens/list', 'sourcePath': '/data/items', 'fields': ['phase'],
        'values': ['Warm', 'Cold', 'Uncatalogued', 'Untouched']})
    plan.steps[-1].includeZeroGroups = True; plan.steps[-1].knowledgeBindingId = binding_id
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert {'phase': 'Untouched', 'count': 0} in result['outputs'][-1]['value']
    assert result['requirementsSatisfied']


def test_unrequested_filter_cannot_reduce_a_verified_total():
    task, plan, sources, knowledge = fixture()
    from app.generic_reader_contracts import Step
    extra = Step(id='unrequested', op='filter', field='phase', predicate='eq', operand='Warm',
        inputs=['entities'], expose=False, label='Wrong restriction', evidence=plan.steps[0].evidence)
    plan.steps.insert(2, extra)
    plan.steps[-1].inputs = ['unrequested']; plan.steps[-2].inputs = ['unrequested']
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert not result['requirementsSatisfied']
    assert next(c for c in result['requirementCoverage'] if c['kind'] == 'measure')['status'] == 'unfulfilled'


def test_filter_unknown_keeps_a_lower_bound_without_claiming_complete_count():
    task, plan, sources, knowledge = fixture([{'specimenKey': 'a', 'phase': None, 'zone': 'East'},
        {'specimenKey': 'b', 'phase': 'Warm', 'zone': 'East'}])
    from app.generic_reader_contracts import Step
    extra = Step(id='condition', op='filter', field='phase', operand='Warm', inputs=['entities'],
        expose=False, label='Known warm rows', unknownPolicy='report', evidence=plan.steps[0].evidence)
    plan.steps.insert(2, extra); plan.steps[-2].inputs = ['condition']; plan.steps[-2].unknownPolicy = 'report'
    plan.steps[-1].inputs = ['condition']; plan.steps[-1].unknownPolicy = 'report'
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['outputs'][0]['value'] == 1 and result['outputs'][0]['unknownCount'] == 1
    assert not result['requirementsSatisfied']


def test_temporal_operator_executes_and_proves_actual_interval():
    task, plan, sources, knowledge = fixture([{'specimenKey': 'a', 'phase': '2024-02-28T09:00:00Z', 'zone': 'East'},
        {'specimenKey': 'b', 'phase': '2024-03-02T09:00:00Z', 'zone': 'East'}])
    task.timeRange = 'today'; task.timeField = 'collection date'; task.groupBy = []
    binding_id, ref = add_fact(knowledge, {'id': 'collected', 'kind': 'time', 'concept': 'collection date',
        'operationRef': 'POST /api/specimens/list', 'sourcePath': '/data/items', 'fields': ['phase']})
    from app.generic_reader_contracts import Step, RequirementBinding
    plan.steps.pop()
    plan.steps.insert(2, Step(id='period', op='filter_time', inputs=['entities'], field='phase',
        knowledgeBindingId=binding_id, label='Requested period', expose=False, evidence=[{'sourceId': ref}]))
    plan.steps[-1].inputs = ['period']
    plan.requirementBindings = [b for b in plan.requirementBindings if b.requirementId != 'group_0']
    plan.requirementBindings.append(RequirementBinding(requirementId='time', knowledgeBindingId=binding_id,
        sourceId='queue', stepIds=['period']))
    bind_analysis_evidence(plan, task, knowledge, sources)
    result = execute_analysis(plan, sources, knowledge, [], task=task, reference_time=REFERENCE)
    assert result['requirementsSatisfied']
    assert result['outputs'][0]['value'] == 1
    assert result['outputs'][0]['evidence'][0]['timeInterval']['expression'] == 'today'


def test_form_assessment_runs_through_attribute_acceptance():
    task, plan, sources, knowledge = detail_fixture()
    form_source, form_fact = form_fixture()
    sources['detail']['structuredDocuments'] = form_source['structuredDocuments']
    sources['detail']['data']['data']['version'] = 7
    binding_id, ref = add_fact(knowledge, {'id': 'materials', 'kind': 'attribute', 'concept': 'missing materials',
        'operationRef': sources['detail']['operationRef'], 'sourcePath': '/data', 'fields': ['key'],
        'formDefinition': {**form_fact['formDefinition'], 'recordPath': '/data', 'versionPath': '/data/version',
                           'documentPath': '/data/form'}}, 'specimen.form')
    task.requestedAttributes = ['missing materials']; plan.steps[0].op = 'assess_form'
    plan.steps[0].knowledgeBindingId = binding_id; plan.steps[0].fields = []
    plan.steps[0].evidence = []
    plan.requirementBindings[-1].knowledgeBindingId = binding_id
    bind_analysis_evidence(plan, task, knowledge, sources)
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['requirementsSatisfied']
    assert result['outputs'][0]['value'][0]['status'] == 'missing'


def test_post_capture_redaction_invalidates_whole_form_completeness():
    from app.generic_reader import safe_documents
    documents = [{'data': {'schema': {'properties': {'email': {'required': True}}}}, 'completeness': 'complete'}]
    result = safe_documents(documents)
    assert result[0]['completeness'] == 'bounded'


def test_unrelated_indexing_changes_do_not_invalidate_consumed_document():
    import asyncio
    from app.reader_knowledge import hydrate_packages
    from test_reader_routing_v03 import package, chunks_for
    chunks, manifest = chunks_for(package())
    class Client:
        count = 0
        async def files(self, *args, **kwargs):
            self.count += 1
            return {'items': [manifest, {'id': 'unrelated', 'name': 'other.json', 'size': 20,
                'status': 'processing', 'updated_at': str(self.count)}]}
        async def _post(self, *args, **kwargs):
            return {'chunks': chunks}
    result = asyncio.run(hydrate_packages(Client(), {'chunks': chunks[:1]}, 'folder', 20))
    assert result['documentVersions'][0]['documentId'] == manifest['id']
    assert result['consistency'] == 'referenced_documents'
    assert 'unrelated' not in result['pinnedVersions']


def test_previously_consumed_document_change_is_detected_on_another_search():
    import asyncio
    from app.reader_knowledge import KNOWLEDGE_PINNED, hydrate_packages, manifest_version
    from test_reader_routing_v03 import package, chunks_for
    chunks, manifest = chunks_for(package())
    class Client:
        async def files(self, *args, **kwargs):
            return {'items': [{**manifest, 'updated_at': 'changed'}]}
    token = KNOWLEDGE_PINNED.set({manifest['id']: list(manifest_version(manifest))})
    try:
        result = asyncio.run(hydrate_packages(Client(), {'chunks': []}, 'folder', 20))
    finally:
        KNOWLEDGE_PINNED.reset(token)
    assert result['consistencyError'] == 'knowledge_document_changed'
    assert result['chunks'] == []


def test_processing_document_does_not_become_reference_text():
    import asyncio
    from app.reader_knowledge import hydrate_packages
    class Client:
        async def files(self, *args, **kwargs):
            return {'items': [{'id': 'doc', 'name': 'manual.txt', 'size': 20, 'status': 'processing', 'updated_at': '1'}]}
    result = asyncio.run(hydrate_packages(Client(), {'chunks': [{'document_id': 'doc', 'source_name': 'manual.txt',
        'content': 'Unstable definition'}]}, 'folder', 20))
    assert not result['chunks'] and not result['pinnedVersions']


def test_hidden_sibling_attribute_binding_requests_plan_correction():
    from app.generic_reader_contracts import Step
    task, plan, sources, knowledge = detail_fixture()
    plan.steps.append(Step(id='hidden', op='project', inputs=['detail'], fields=['color'],
                           label='Color', expose=False, evidence=plan.steps[0].evidence))
    plan.requirementBindings[-1].stepIds = ['hidden']
    with pytest.raises(PipelineError, match='requirement_output_unreachable') as exc:
        bind_analysis_evidence(plan, task, knowledge, sources)
    assert exc.value.category == 'planning'
    # Repair only the output topology, without changing any page facts.
    plan.steps[0].expose = False
    plan.steps[-1].expose = True
    plan.steps[-1].role = 'detail'
    plan.steps[-1].evidence = plan.steps[0].evidence
    bind_analysis_evidence(plan, task, knowledge, sources)
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['requirementsSatisfied']


def test_count_phrase_factors_only_independently_verified_population():
    from app.reader_requirements import builtin_measure
    task, plan, sources, knowledge = fixture()
    task.requestedMeasures = ['open specimen count']
    assert builtin_measure(task, task.requestedMeasures[0]) == 'count'
    assert execute_analysis(plan, sources, knowledge, [], task=task)['requirementsSatisfied']
    task.requestedMeasures = ['overdue specimen count']
    assert builtin_measure(task, task.requestedMeasures[0]) is None
    task.requestedMeasures = ['open specimen count', 'overdue specimen count']
    assert builtin_measure(task, task.requestedMeasures[0]) is None


@pytest.mark.parametrize('value,expected', [(True, True), (1, False), (1.0, False), ('true', False), (None, False)])
def test_boolean_filter_keeps_json_type(value, expected):
    from app.reader_scalars import scalar_compare
    assert scalar_compare(value, 'eq', True) is expected
    assert scalar_compare(value, 'ne', True) is not expected
    with pytest.raises(TypeError):
        scalar_compare(value, 'gt', True)


def conditional_fixture():
    from app.generic_reader_contracts import Step, RequirementBinding
    task, plan, sources, knowledge = fixture()
    task.requestedMeasures.append('warm specimen count')
    fact = {'id': 'warm', 'kind': 'measure', 'concept': 'warm specimen count',
        'operationRef': sources['queue']['operationRef'], 'sourcePath': '/data/items', 'fields': ['phase'],
        'operator': 'count', 'conditions': [{'field': 'phase', 'predicate': 'eq', 'value': 'Warm'}]}
    record = {'id': 'specimen.measure', 'kind': 'field_semantics', 'revision': 1, 'status': 'active',
        'applicability': {'portal': 'admin', 'environments': ['local']},
        'sources': [{'reference': '/research/specimens'}], 'payload': {'bindings': [fact]}}
    knowledge.add({'chunks': [{'id': 'measure-fact', 'content': json.dumps({'records': [record]})}]})
    citation = plan.steps[0].evidence
    plan.steps.extend([
        Step(id='warm', op='filter', field='phase', operand='Warm', inputs=['entities'], label='Warm', expose=False, evidence=citation),
        Step(id='warm_total', op='count', inputs=['warm'], label='Warm total', role='total', evidence=citation)])
    plan.requirementBindings.append(RequirementBinding(requirementId='measure_1', sourceId='queue',
        knowledgeBindingId='specimen.measure#warm', stepIds=['warm_total']))
    next(b for b in plan.requirementBindings if b.requirementId == 'group_0').stepIds = ['entities']
    return task, plan, sources, knowledge


def test_conditional_measure_requires_its_own_requested_breakdown():
    task, plan, sources, knowledge = conditional_fixture()
    bind_analysis_evidence(plan, task, knowledge, sources)
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert 'requested_total_group_context_mismatch' in result['missing']
    assert not result['requirementsSatisfied']


def test_multiple_conditional_measures_each_group_same_population():
    from app.generic_reader_contracts import Step
    task, plan, sources, knowledge = conditional_fixture()
    plan.steps.append(Step(id='warm_phases', op='group_count', inputs=['warm'], fields=['phase'],
        role='breakdown', label='Warm by phase', evidence=plan.steps[0].evidence))
    bind_analysis_evidence(plan, task, knowledge, sources)
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['requirementsSatisfied']


def test_one_document_fetch_failure_preserves_other_verified_documents():
    import asyncio
    import httpx
    from app.reader_knowledge import hydrate_packages
    from test_reader_routing_v03 import package, chunks_for
    chunks, manifest = chunks_for(package())
    bad = {**manifest, 'id': 'failed-doc', 'name': 'failed.json'}
    broken = {**chunks[0], 'document_id': bad['id'], 'source_name': bad['name'], 'content': '{"records": ['}
    class Client:
        async def files(self, *args, **kwargs):
            return {'items': [manifest, bad]}
        async def _post(self, path, body, **kwargs):
            if body['query'] == bad['name']:
                raise httpx.ReadTimeout('sensitive upstream details')
            return {'chunks': chunks}
    result = asyncio.run(hydrate_packages(Client(), {'chunks': [chunks[0], broken]}, 'folder', 20))
    assert result['documentVersions'][0]['documentId'] == manifest['id']
    assert all(c['document_id'] != bad['id'] for c in result['chunks'])
    assert result['hydrationGaps'][0]['errorType'] == 'ReadTimeout'
    assert 'sensitive' not in json.dumps(result)


def test_conditional_material_rule_overrides_static_validator_only_when_proven():
    properties = {'attachment': {'x-component': 'FilePicker', 'x-validator': [{'required': True}],
        'requiredWhen': {'field': 'category', 'equals': True}}}
    rows, gaps, _ = assess_form(*form_fixture(properties, {'category': 1}))
    assert rows[0]['status'] == 'not_required' and not gaps


def test_root_form_condition_is_not_silently_ignored():
    source, fact = form_fixture()
    source['structuredDocuments'][0]['data']['schema']['if'] = {'properties': {}}
    rows, gaps, _ = assess_form(source, fact)
    assert rows[0]['status'] == 'unknown' and 'form_condition_unsupported' in gaps


def test_last_month_crosses_year_and_elapsed_hours_cross_dst():
    from datetime import datetime, timezone
    interval = interval_for('last month', {'nowUtc': '2026-01-15T12:00:00Z', 'businessTimezone': 'UTC'})
    assert interval['start'].startswith('2025-12-01') and interval['end'].startswith('2026-01-01')
    interval = interval_for('next 2 hours', {'nowUtc': '2026-11-01T04:30:00Z', 'businessTimezone': 'America/New_York'})
    start, end = (datetime.fromisoformat(interval[k]).astimezone(timezone.utc) for k in ('start', 'end'))
    assert (end - start).total_seconds() == 7200


def test_unverified_inferred_view_does_not_erase_population_or_user_view():
    from app.reader_context import constrain_inferred_view
    from app.generic_reader_contracts import SlotUpdate
    task, _, _, _ = fixture()
    proposal = task.model_copy(deep=True)
    proposal.view = 'unregistered-view'
    proposal.slotUpdates = [SlotUpdate(field='view', source='knowledge', value=proposal.view)]
    assert constrain_inferred_view(task, proposal, [])
    assert proposal.view == '' and proposal.businessFocus == task.businessFocus
    proposal.view = 'user-selected-view'
    proposal.slotUpdates = [SlotUpdate(field='view', source='current', value=proposal.view)]
    assert not constrain_inferred_view(task, proposal, [])
    assert proposal.view == 'user-selected-view'
    task.view = 'inherited-view'
    proposal.slotUpdates[0].source = 'knowledge'
    assert not constrain_inferred_view(task, proposal, [])


def test_registered_inferred_view_remains_subject_to_live_verification():
    from app.reader_context import constrain_inferred_view
    from app.generic_reader_contracts import SlotUpdate
    task, _, _, _ = fixture(); proposal = task.model_copy(deep=True)
    proposal.view = 'Archived'
    proposal.slotUpdates = [SlotUpdate(field='view', source='knowledge', value='Archived')]
    assert not constrain_inferred_view(task, proposal, [{'id': 'archived', 'label': 'Archived'}])
    assert proposal.view == 'Archived'


def test_grain_dimension_conflict_requests_correction_without_changing_intent():
    from app.reader_context import validate_task_grain
    task, _, _, _ = fixture()
    task.requestedGrain = 'phase'
    with pytest.raises(PipelineError, match='intent_grain_dimension_conflict'):
        validate_task_grain(task)
    assert task.requestedGrain == 'phase' and task.groupBy == ['phase']
    task.requestedGrain = 'specimen'
    validate_task_grain(task)
    task.businessObject = 'phase'; task.requestedGrain = 'phase'
    validate_task_grain(task)


def test_requested_attribute_does_not_become_an_extra_population_requirement():
    from app.reader_context import validate_task_grain
    task, _, _, _ = detail_fixture()
    task.businessFocus = 'color'
    with pytest.raises(PipelineError, match='intent_population_attribute_conflict'):
        validate_task_grain(task)
    task.businessFocus = 'open'
    validate_task_grain(task)


def test_exact_dotted_field_definitions_are_valid_collection_proofs():
    from app.generic_reader import collection_definition_proofs
    from app.generic_reader_contracts import CollectionSpec
    task, plan, sources, knowledge = fixture()
    record = {'id': 'specimen.nested', 'kind': 'field_semantics', 'revision': 1, 'status': 'active',
        'applicability': {'portal': 'admin', 'environments': ['local'], 'pageRefs': ['/research/specimens']},
        'sources': [{'reference': '/research/specimens'}], 'payload': {
            'sourceBinding': {'operationRef': 'POST /api/specimens/list', 'sourcePath': '/data/items'},
            'fields': {'condition.flag': 'Observed boolean; null is unknown'}, 'bindings': []}}
    knowledge.add({'chunks': [{'id': 'nested', 'content': json.dumps({'records': [record]})}]})
    spec = CollectionSpec(sourceId='queue', rowsPath='/data/items', totalPath='/data/total',
        fields=['condition.flag'], identityFields=['specimenKey'], pageField='pageIndex', sizeField='pageSize',
        evidence=[plan.requirementBindings[0].evidence[0]])
    proof = collection_definition_proofs(knowledge, '/research/specimens', 'POST /api/specimens/list', spec)
    assert 'condition.flag' in proof
    spec.fields = ['condition.other']
    assert 'condition.other' not in collection_definition_proofs(knowledge, '/research/specimens', 'POST /api/specimens/list', spec)


def test_projected_collection_reports_bad_non_identity_fields_without_leaking():
    spec = gateway.ProjectedCollectionRequest(operationKey='GET /api/specimens', contextRef='a'*64,
        rowsPath='/items', totalPath='/total', fields=['key', 'label', 'weight'], identityFields=['key'],
        pageField='pageIndex', sizeField='pageSize', unknownPolicy='report')
    payload = {'items': [{'key': 1, 'label': 'password: private-value'}], 'total': 1}
    statuses = {}
    rows, total = gateway._collection_project(payload, spec, statuses)
    assert rows == [{'key': 1, 'label': None, 'weight': None}] and total == 1
    assert statuses == {'key': 'complete', 'label': 'collection_value_not_safe', 'weight': 'collection_field_missing'}
    assert 'private-value' not in json.dumps([rows, statuses])
    payload['items'][0]['key'] = 'password: private-identifier'
    with pytest.raises(ValueError, match='collection_value_not_safe'):
        gateway._collection_project(payload, spec)


def test_projected_collection_field_failure_does_not_erase_verified_entity_total():
    task, plan, sources, knowledge = fixture([{'specimenKey': 'a', 'phase': None, 'zone': 'West'}])
    sources['queue'].update(kind='projected_collection', collectionReceipt={
        'fields': ['specimenKey', 'phase', 'zone'],
        'fieldStatus': {'specimenKey': 'complete', 'phase': 'collection_value_not_safe', 'zone': 'complete'}})
    plan.steps[-1].unknownPolicy = 'report'
    result = execute_analysis(plan, sources, knowledge, [], task=task)
    assert result['outputs'][0]['value'] == 1 and result['outputs'][0]['role'] == 'total'
    assert result['outputs'][-1]['unavailableFields'] == ['phase']
    assert not result['requirementsSatisfied']


def test_gateway_load_failure_is_not_a_route_or_knowledge_error():
    from app.generic_reader import portal_result_failure
    error = portal_result_failure({'status': 'load_failed', 'limitations': ['TimeoutError', 'https://private/token']})
    assert error.code == 'page_load_failed' and error.category == 'runtime'
    assert error.details == {'gatewayReasons': ['TimeoutError']}
    assert portal_result_failure({'status': 'no_permission'}).category == 'permission'
    assert portal_result_failure({'status': 'not_confirmed', 'observation': {}}) is None


@pytest.mark.parametrize('code,status,category,calls', [
    ('permission_denied', 403, 'permission', 1), ('tool_error', 502, 'runtime', 2),
    ('tool_unavailable', None, 'runtime', 2)])
def test_identity_dependency_failure_is_not_reported_as_account_denial(code, status, category, calls):
    import asyncio
    from app.generic_reader import GenericKnowledgeReader
    from app.principal import Principal
    from test_generic_reader_v3 import Gateway, Planner
    class FailedIdentity(Gateway):
        count = 0
        async def get_user_info(self, principal):
            self.count += 1
            return {'ok': False, 'code': code, 'status': status, 'error': 'ReadTimeout'}
    gateway = FailedIdentity()
    result = asyncio.run(GenericKnowledgeReader(gateway, Planner(), portal_base_url='https://portal.test').run(
        Principal('person-1', 'tenant', 'request'), 'Show the current crystal summary.'))
    assert result.audit_evidence['failureCategory'] == category and gateway.count == calls
    assert not result.audit_evidence.get('plans')


@pytest.mark.parametrize('unknown_identity', [False, True])
@pytest.mark.parametrize('gateway_failure', [None, 403, 503])
def test_unsupported_projection_preserves_known_fields_but_never_drops_identity(unknown_identity, gateway_failure):
    import asyncio, time
    from app.generic_reader import GenericKnowledgeReader
    from app.generic_reader_contracts import CollectionPlan
    from app.portal_reader import PortalReadRequest
    task, _, sources, knowledge = fixture()
    task.groupBy.append('unmapped dimension')
    record = {'id': 'specimen.collection', 'kind': 'field_semantics', 'revision': 1, 'status': 'active',
        'applicability': {'portal': 'admin', 'environments': ['local'], 'pageRefs': ['/research/specimens']},
        'sources': [{'reference': '/research/specimens'}], 'payload': {
            'sourceBinding': {'operationRef': 'POST /api/specimens/list', 'sourcePath': '/data/items'},
            'fields': {'specimenKey': 'Entity key', 'phase': 'Phase'},
            'pagination': {'pageIndex': 'Page', 'pageSize': 'Size', 'totalPath': '/data/total', 'rowsPath': '/data/items'}}}
    knowledge.add({'chunks': [{'id': 'collection', 'content': json.dumps({'records': [record]})}]})
    ref = knowledge.prompt()[0]['passages'][0]['sourceId']
    sources['queue']['collectionContext'].update(contextRef='a'*64, requestFields=['pageIndex', 'pageSize'],
        rowSchemas=[{'path': '/data/items', 'fields': ['specimenKey', 'phase', 'unmapped']}])
    class ObservedProjection(Exception): pass
    class Gateway:
        async def invoke(self, principal, name, payload, **kwargs):
            assert payload['collections'][0]['fields'] == ['specimenKey', 'phase']
            if gateway_failure:
                return {'ok': False, 'code': 'permission_denied' if gateway_failure == 403 else 'tool_error',
                        'status': gateway_failure, 'error': 'https://private.test/?token=synthetic-secret'}
            raise ObservedProjection()
    reader = GenericKnowledgeReader(Gateway(), None, portal_base_url='https://portal.test')
    reader.page = '/research/specimens'; reader.knowledge = knowledge; reader.deadline = time.monotonic() + 60
    async def planned(contract, instruction, data, validator):
        result = CollectionPlan.model_validate({'stage': 'collection', 'missing': [], 'collections': [{
            'sourceId': 'queue', 'fields': ['specimenKey', 'phase', 'unmapped'],
            'identityFields': ['unmapped' if unknown_identity else 'specimenKey'],
            'rowsPath': '/data/items', 'totalPath': '/data/total', 'pageField': 'pageIndex', 'sizeField': 'pageSize',
            'evidence': [{'sourceId': ref}]}]})
        validator(result)
        assert 'collection_field_semantics_missing' in result.missing
        return result
    reader.structured = planned
    with pytest.raises(PipelineError if unknown_identity or gateway_failure else ObservedProjection) as exc:
        asyncio.run(reader.collect_sources(None, task, PortalReadRequest(reader.page, ({'type': 'observe'},)), {}, sources))
    if unknown_identity:
        assert exc.value.code == 'collection_field_semantics_missing'
    elif gateway_failure:
        assert exc.value.category == ('permission' if gateway_failure == 403 else 'runtime')
        assert 'synthetic-secret' not in json.dumps(reader.audit)
        assert reader.audit['executionFailures'][-1]['status'] == gateway_failure
    assert task.groupBy == ['phase', 'unmapped dimension']


@pytest.mark.parametrize('blocked_stage', ['identity', 'queue'])
def test_gateway_total_budget_includes_identity_and_queue(monkeypatch, blocked_stage):
    import asyncio
    async def identity(*args, **kwargs):
        if blocked_stage == 'identity':
            await asyncio.sleep(3)
        return {}
    monkeypatch.setattr(gateway, '_umc_request', identity)
    monkeypatch.setattr(gateway, '_validate_gateway_permissions', lambda *args: {
        'pages': ['/specimens'], 'subpages': [], 'buttons': [], 'dataScope': [], 'userId': 'person'})
    async def run():
        lock = asyncio.Lock()
        monkeypatch.setattr(gateway, 'READER_LOCK', lock)
        if blocked_stage == 'queue':
            await lock.acquire()
        request = gateway.AdminPortalReadRequest(startPath='/specimens', actions=[{'type': 'observe'}], timeoutSeconds=1)
        start = asyncio.get_running_loop().time()
        result = await gateway.admin_portal_read(request, 'Bearer synthetic-token', 'trace', 'person')
        assert result['status'] == 'load_failed'
        assert result['limitations'] == ['reader_total_timeout']
        assert result['diagnostics']['stage'] == blocked_stage
        assert gateway.READER_PROGRESS.get() is None
        assert asyncio.get_running_loop().time() - start < 1.5
        if lock.locked(): lock.release()
    asyncio.run(run())


def test_gateway_navigation_has_separate_budget_and_safe_stage_error(monkeypatch):
    import asyncio
    from types import SimpleNamespace
    from contextlib import asynccontextmanager
    captured = {}
    class TimeoutError(Exception): pass
    class Page:
        def on(self, *args): pass
        def set_default_timeout(self, value): captured['action'] = value
        def set_default_navigation_timeout(self, value): captured['navigation'] = value
        async def goto(self, *args, **kwargs):
            raise TimeoutError('Page.goto failed at https://private.test/?token=synthetic-secret')
    class Context:
        async def add_init_script(self, *args): pass
        async def route(self, *args): pass
        async def new_page(self): return Page()
    class Browser:
        async def new_context(self, **kwargs): return Context()
        async def close(self): captured['closed'] = True
    async def launch(**kwargs): return Browser()
    @asynccontextmanager
    async def playwright(): yield SimpleNamespace(chromium=SimpleNamespace(launch=launch))
    async def identity(*args, **kwargs): return {}
    monkeypatch.setattr(gateway, 'async_playwright', playwright)
    monkeypatch.setattr(gateway, '_umc_request', identity)
    monkeypatch.setattr(gateway, '_validate_gateway_permissions', lambda *args: {
        'pages': ['/specimens'], 'subpages': [], 'buttons': [], 'dataScope': [], 'userId': 'person'})
    monkeypatch.setattr(gateway, 'READER_LOCK', asyncio.Lock())
    request = gateway.AdminPortalReadRequest(startPath='/specimens', actions=[{'type': 'observe'}])
    result = asyncio.run(gateway.admin_portal_read(request, 'Bearer synthetic-token', 'trace', 'person'))
    assert result['status'] == 'load_failed' and result['limitations'] == ['reader_navigation_timeout']
    assert captured['navigation'] == 30_000 and captured['action'] <= 15_000 and captured['closed']
    assert 'synthetic-secret' not in json.dumps(result)


def test_grain_reuses_declared_entity_alias_only_with_same_record_mapping():
    from app.reader_requirements import semantic_bindings
    task, plan, sources, knowledge = detail_fixture()
    original = copy.deepcopy(next(iter(knowledge.items.values()))['record'])
    original['payload']['bindings'][0]['aliases'] = ['laboratory specimen']
    old_ref = knowledge.prompt()[0]['passages'][0]['sourceId']
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'id': 'aliased-entity', 'content': json.dumps({'records': [original]})}]})
    new_ref = knowledge.prompt()[0]['passages'][0]['sourceId']
    plan = AnalysisPlan.model_validate_json(plan.model_dump_json().replace(old_ref, new_ref))
    task.businessObject = task.requestedGrain = 'laboratory specimen'
    plan.context.grain.value = task.requestedGrain
    catalog = semantic_bindings(knowledge)
    grain = next(f for f in catalog if f['kind'] == 'grain')
    assert 'laboratory specimen' in grain['aliases']
    assert grain['aliasEvidenceBindingIds'] == ['specimen.detail#object']
    assert 'aliases' not in original['payload']['bindings'][1]
    outcome = execute_analysis(bind_analysis_evidence(plan, task, knowledge, sources), sources, knowledge, [], task=task)
    assert outcome['requirementsSatisfied'] is True, outcome['requirementCoverage']


@pytest.mark.parametrize('mismatch', ['record', 'path', 'operation', 'fields', 'concept', 'context', 'conditions'])
def test_grain_alias_composition_rejects_different_mappings(mismatch):
    from app.reader_requirements import semantic_bindings
    _, _, _, knowledge = detail_fixture()
    record = copy.deepcopy(next(iter(knowledge.items.values()))['record'])
    anchor = record['payload']['bindings'][0]
    anchor['aliases'] = ['laboratory specimen']
    changes = {'path': ('sourcePath', '/elsewhere'), 'operation': ('operationRef', 'GET /api/other'),
               'fields': ('fields', ['otherKey']), 'concept': ('concept', 'other entity'),
               'context': ('contextParameters', {'view': 'different'}),
               'conditions': ('conditions', [{'field': 'key', 'predicate': 'eq', 'value': 'a'}])}
    records = [record]
    if mismatch == 'record':
        other = copy.deepcopy(record); other['id'] = 'separate-record'
        other['payload']['bindings'] = [anchor]
        record['payload']['bindings'] = record['payload']['bindings'][1:]
        records.append(other)
    else:
        key, value = changes[mismatch]; anchor[key] = value
    knowledge = KnowledgeStore()
    knowledge.add({'chunks': [{'id': 'different-entity', 'content': json.dumps({'records': records})}]})
    grain = next(f for f in semantic_bindings(knowledge) if f['kind'] == 'grain')
    assert 'laboratory specimen' not in grain.get('aliases', [])


@pytest.mark.parametrize('omit_grain', [False, True])
def test_builtin_count_cites_contributing_rows_but_still_needs_entity_grain(omit_grain):
    task, plan, sources, knowledge = fixture()
    binding = next(b for b in plan.requirementBindings if b.requirementId == 'measure_0')
    binding.evidence = []
    if omit_grain:
        plan.requirementBindings = [b for b in plan.requirementBindings if b.requirementId != 'grain']
    bind_analysis_evidence(plan, task, knowledge, sources)
    assert binding.evidence and not binding.knowledgeBindingId
    result = execute((task, plan, sources, knowledge))
    assert result['requirementsSatisfied'] is (not omit_grain)
    if omit_grain:
        assert next(c for c in result['requirementCoverage'] if c['id'] == 'measure_0')['status'] == 'unfulfilled'


def test_count_cannot_borrow_citation_from_an_unrelated_source():
    task, plan, sources, knowledge = fixture()
    binding = next(b for b in plan.requirementBindings if b.requirementId == 'measure_0')
    binding.evidence = []; binding.sourceId = 'unrelated'
    bind_analysis_evidence(plan, task, knowledge, sources)
    assert binding.evidence == []
    assert not execute((task, plan, sources, knowledge))['requirementsSatisfied']


def test_later_null_field_remains_unknown_and_unread_receipt_fields_are_excluded():
    task, plan, sources, knowledge = fixture([
        {'specimenKey': 'a', 'phase': 'Warm', 'zone': 'East'},
        {'specimenKey': 'b', 'phase': None, 'zone': 'West'}])
    for step in plan.steps: step.unknownPolicy = 'report'
    sources['queue']['collectionReceipt'] = {'fieldStatus': {'unreadColumn': 'null'}}
    result = execute((task, plan, sources, knowledge))
    assert 'phase' in result['outputs'][-1]['unavailableFields']
    assert 'unreadColumn' not in result['outputs'][-1]['unavailableFields']
    assert not result['requirementsSatisfied']


@pytest.mark.parametrize('wrong_dimension', [False, True])
def test_one_group_requirement_can_reference_separate_exposed_measure_branches(wrong_dimension):
    from app.generic_reader_contracts import Step
    task, plan, sources, knowledge = conditional_fixture()
    plan.steps.append(Step(id='warm_phases', op='group_count', inputs=['warm'],
        fields=['zone' if wrong_dimension else 'phase'], role='breakdown', label='Warm breakdown',
        evidence=plan.steps[0].evidence))
    next(b for b in plan.requirementBindings if b.requirementId == 'group_0').stepIds = ['phases', 'warm_phases']
    bind_analysis_evidence(plan, task, knowledge, sources)
    result = execute((task, plan, sources, knowledge))
    assert result['requirementsSatisfied'] is (not wrong_dimension)
    group = next(r for r in result['requirementCoverage'] if r['kind'] == 'group')
    assert group['outputStepIds']['phases'] == ['phases']
    if not wrong_dimension:
        assert group['outputStepIds']['warm_phases'] == ['warm_phases']


@pytest.mark.parametrize('view_verified', [False, True])
def test_model_binding_cannot_replace_runtime_view_proof(view_verified):
    from app.generic_reader_contracts import RequirementBinding
    task, plan, sources, knowledge = fixture(); task.view = 'observed_view'
    plan.requirementBindings.append(RequirementBinding(requirementId='view', sourceId='queue',
        knowledgeBindingId='specimen.fields#scope', fields=['specimenKey'], stepIds=['rows']))
    if view_verified: sources['queue']['verifiedView'] = task.view
    bind_analysis_evidence(plan, task, knowledge, sources)
    assert not any(b.requirementId == 'view' for b in plan.requirementBindings)
    result = execute((task, plan, sources, knowledge))
    assert result['requirementsSatisfied'] is view_verified
    assert next(r for r in result['requirements'] if r['kind'] == 'view')['value'] == task.view


@pytest.mark.parametrize('explicit_expose', [False, True])
def test_unset_intermediate_visibility_is_compiled_but_explicit_visibility_is_preserved(explicit_expose):
    from app.generic_reader_contracts import Step
    task, plan, sources, knowledge = fixture()
    raw = plan.steps[0].model_dump(); raw.pop('expose')
    if explicit_expose: raw['expose'] = True
    plan.steps[0] = Step.model_validate(raw)
    bind_analysis_evidence(plan, task, knowledge, sources)
    assert plan.steps[0].expose is explicit_expose


@pytest.mark.parametrize('available', [False, True])
def test_observed_collection_operation_retrieves_missing_page_definition_once_per_attempt(available):
    import asyncio
    from app.generic_reader import GenericKnowledgeReader
    from app.generic_reader_contracts import CollectionPlan
    from app.portal_reader import PortalReadRequest
    task, _, sources, knowledge = fixture()
    source = sources['queue']
    source['collectionContext'].update(requestFields=['pageIndex', 'pageSize'],
        rowSchemas=[{'path': '/data/items', 'fields': ['specimenKey', 'phase']}])
    reader = GenericKnowledgeReader(None, None, portal_base_url='https://portal.test')
    reader.page = '/research/specimens'; reader.knowledge = knowledge
    queries = []
    async def search(principal, query):
        queries.append(query)
        if not available: return
        record = {'id': 'specimen.pagination', 'kind': 'field_semantics', 'revision': 1, 'status': 'active',
            'applicability': {'portal': 'admin', 'environments': ['local'], 'pageRefs': ['/research/specimens']},
            'sources': [{'reference': '/research/specimens'}], 'payload': {
                'sourceBinding': {'operationRef': source['operationRef'], 'sourcePath': '/data/items'},
                'fields': {'specimenKey': 'Entity key', 'phase': 'Phase'},
                'pagination': {'pageIndex': 'Page', 'pageSize': 'Size', 'rowsPath': '/data/items', 'totalPath': '/data/total'}}}
        knowledge.add({'chunks': [{'id': 'hydrated-pagination', 'content': json.dumps({'records': [record]})}]})
    async def plan(*args):
        return CollectionPlan(stage='collection', collections=[], missing=['synthetic_skip'])
    reader.search = search; reader.structured = plan
    async def run():
        for _ in range(3):
            await reader.collect_sources(None, task, PortalReadRequest(reader.page, ({'type': 'observe'},)), {}, sources)
    asyncio.run(run())
    assert len(queries) == (1 if available else 2) and 'POST /api/specimens/list' in queries[0]
    assert len(reader.audit['collectionKnowledgeLookups']) == len(queries)


@pytest.mark.parametrize('phrase,accepted', [
    ('count of warm specimens', True), ('number of warm specimens', True), ('warm specimen count', True),
    ('count of overdue specimens', False), ('count of all specimens', False)])
def test_measure_operator_grammar_preserves_business_conditions(phrase, accepted):
    from app.reader_requirements import semantic_bindings, _semantic_match
    task, plan, sources, knowledge = conditional_fixture()
    fact = next(f for f in semantic_bindings(knowledge) if f['kind'] == 'measure')
    binding = plan.requirementBindings[-1]
    binding.sourcePath = fact['sourcePath']; binding.fields = fact['fields']
    assert _semantic_match(binding, {'kind': 'measure', 'value': phrase}, sources['queue'],
                           {fact['knowledgeBindingId']: fact}) is accepted

@pytest.mark.parametrize('mode', ['collected', 'not_collected', 'visible', 'wrong_source', 'wrong_path'])
def test_internal_projection_closure_uses_only_bound_collected_fields(mode):
    task, plan, sources, knowledge = fixture()
    # Remove a needed field from the internal projection while preserving the
    # source and its exact page binding; use an existing synthetic dimension.
    read = plan.steps[0]
    read.fields.remove('phase')
    sources['queue']['collectionReceipt'] = {'fieldStatus': {'phase': 'complete'}}
    if mode == 'not_collected': sources['queue']['collectionReceipt']['fieldStatus'] = {}
    elif mode == 'visible': read.expose = True
    elif mode == 'wrong_source': read.sourceId = 'unrelated'
    elif mode == 'wrong_path': read.path = '/data/other'
    bind_analysis_evidence(plan, task, knowledge, sources)
    assert ('phase' in read.fields) is (mode == 'collected')
    assert plan.steps[1].fields == ['specimenKey']
    if mode == 'collected':
        result = execute((task, plan, sources, knowledge))
        assert result['requirementsSatisfied']
        assert all('zone' not in str(o['value']) for o in result['outputs'])


def test_projection_closure_preserves_unknown_data():
    task, plan, sources, knowledge = fixture([{'specimenKey': 'a', 'phase': None, 'zone': 'East'}])
    plan.steps[0].fields.remove('phase')
    sources['queue']['collectionReceipt'] = {'fieldStatus': {'phase': 'null'}}
    for step in plan.steps: step.unknownPolicy = 'report'
    bind_analysis_evidence(plan, task, knowledge, sources)
    result = execute((task, plan, sources, knowledge))
    assert 'phase' in result['outputs'][-1]['unavailableFields']
    assert not result['requirementsSatisfied']

@pytest.mark.parametrize('mismatch', ['field', 'predicate', 'operand'])
def test_conditional_measure_planning_requires_declared_filter(mismatch):
    task, plan, sources, knowledge = conditional_fixture()
    step = next(s for s in plan.steps if s.op == 'filter')
    setattr(step, mismatch, {'field': 'zone', 'predicate': 'ne', 'operand': 'Cold'}[mismatch])
    with pytest.raises(PipelineError, match='analysis_measure_condition_missing') as exc:
        bind_analysis_evidence(plan, task, knowledge, sources)
    assert exc.value.category == 'planning'
    assert exc.value.details['conditions']

@pytest.mark.parametrize('focus,measures,reject', [
    ('warm and cold', ['count of warm specimens', 'count of cold specimens'], True),
    ('warm and cold', ['count'], False),
    ('warm', ['count', 'sum of weight'], False),
    ('open and assigned', ['count', 'sum of weight'], False),
    ('warm and cold', ['count of warm and cold specimens', 'sum of warm and cold specimen weight'], False)])
def test_separate_measure_populations_do_not_form_an_invented_shared_conjunction(focus, measures, reject):
    from app.reader_context import validate_task_grain
    task, _, _, _ = fixture()
    task.businessFocus, task.requestedMeasures = focus, measures
    before = task.model_dump()
    if reject:
        with pytest.raises(PipelineError, match='intent_population_measure_conflict'):
            validate_task_grain(task)
    else:
        validate_task_grain(task)
    assert task.model_dump() == before

@pytest.mark.parametrize('required_for', ['optional', 'identity', 'lookup'])
def test_unobserved_optional_field_does_not_erase_observed_population(required_for):
    import asyncio, time
    from app.generic_reader import GenericKnowledgeReader
    from app.generic_reader_contracts import CollectionPlan
    from app.portal_reader import PortalReadRequest
    task, _, sources, knowledge = fixture()
    record = {'id': 'specimen.collection', 'kind': 'field_semantics', 'revision': 1, 'status': 'active',
        'applicability': {'portal': 'admin', 'environments': ['local'], 'pageRefs': ['/research/specimens']},
        'sources': [{'reference': '/research/specimens'}], 'payload': {
            'sourceBinding': {'operationRef': sources['queue']['operationRef'], 'sourcePath': '/data/items'},
            'fields': {'specimenKey': 'Key', 'phase': 'Phase', 'aux.code': 'Optional linked code'},
            'pagination': {'pageIndex': 'Page', 'pageSize': 'Size', 'totalPath': '/data/total', 'rowsPath': '/data/items'}}}
    knowledge.add({'chunks': [{'id': 'projection', 'content': json.dumps({'records': [record]})}]})
    ref = knowledge.prompt()[0]['passages'][0]['sourceId']
    sources['queue']['collectionContext'].update(contextRef='a'*64, requestFields=['pageIndex', 'pageSize'],
        rowSchemas=[{'path': '/data/items', 'fields': ['specimenKey', 'phase', 'aux']}])
    class ObservedProjection(Exception): pass
    class Gateway:
        async def invoke(self, principal, name, payload, **kwargs):
            assert payload['collections'][0]['fields'] == ['specimenKey', 'phase']
            raise ObservedProjection()
    reader = GenericKnowledgeReader(Gateway(), None, portal_base_url='https://portal.test')
    reader.page = '/research/specimens'; reader.knowledge = knowledge; reader.deadline = time.monotonic() + 60
    async def planned(contract, instruction, data, validator):
        plan = CollectionPlan.model_validate({'stage': 'collection', 'missing': [], 'collections': [{
            'sourceId': 'queue', 'fields': ['specimenKey', 'phase', 'aux.code'],
            'identityFields': ['aux.code' if required_for == 'identity' else 'specimenKey'],
            'rowsPath': '/data/items', 'totalPath': '/data/total', 'pageField': 'pageIndex', 'sizeField': 'pageSize',
            'evidence': [{'sourceId': ref}]}]})
        validator(plan)
        assert plan.missing == ['source_field_unobserved']
        return plan
    reader.structured = planned
    lookup = {sources['queue']['operationRef']: ['specimenKey', 'phase', 'aux.code']} if required_for == 'lookup' else {}
    with pytest.raises(ObservedProjection if required_for == 'optional' else PipelineError) as exc:
        asyncio.run(reader.collect_sources(None, task, PortalReadRequest(reader.page, ({'type': 'observe'},)), {}, sources,
                                          lookup_fields=lookup))
    if required_for != 'optional':
        assert exc.value.code == 'collection_projection_not_observed' and exc.value.category == 'source_data'
    else:
        assert reader.audit['excludedProjectionFields'][0]['fields'] == ['aux.code']
        assert gap_items(['source_field_unobserved'])[0]['category'] == 'source_data'
    assert task.groupBy == ['phase']

@pytest.mark.parametrize('code,category', [
    ('analysis_measure_condition_missing', 'planning'),
    ('intent_population_measure_conflict', 'planning'),
    ('knowledge_answer_coverage_unverified', 'acceptance')])
def test_planning_and_coverage_diagnostics_cannot_be_uploaded_as_page_rules(code, category):
    gap = gap_items([code])[0]
    assert gap['category'] == category
    assert gap['resolvedByKnowledgeImport'] is False

@pytest.mark.parametrize('failure', ['computed_input', 'unknown_source'])
def test_source_reader_contract_failure_is_a_repairable_plan_error(failure):
    from app.generic_reader_contracts import Step
    task, plan, sources, knowledge = fixture()
    if failure == 'computed_input':
        step = plan.steps[0].model_copy(deep=True)
        step.id = 'second_read'; step.inputs = ['rows']; plan.steps.insert(1, step)
    else:
        plan.steps[0].sourceId = 'invented'
    with pytest.raises(PipelineError, match='invalid_source_binding') as exc:
        execute((task, plan, sources, knowledge))
    assert exc.value.category == 'planning'
    assert exc.value.details['allowedSourceIds'] == ['queue']
    assert 'inputs=[]' in exc.value.details['correction']
    assert gap_items(['invalid_source_binding'])[0]['resolvedByKnowledgeImport'] is False

@pytest.mark.parametrize('field,empty,invented', [
    ('businessFocus', '', 'team workload summary of warm and cold specimens'),
    ('filters', [], ['zone=West']), ('groupBy', [], ['phase']),
    ('requestedMeasures', [], ['count']), ('requestedAttributes', [], ['color']),
    ('timeRange', '', 'next 10 days')])
def test_knowledge_refinement_cannot_invent_empty_requested_conditions(field, empty, invented):
    from app.generic_reader_contracts import SlotUpdate
    task, _, _, _ = fixture(); setattr(task, field, empty)
    draft = merge_task(task, {})
    candidate = draft.model_copy(deep=True)
    setattr(candidate, field, invented)
    candidate.slotUpdates = [x for x in candidate.slotUpdates if x.field != field]
    # Re-labelling the suggestion as current input cannot bypass preservation.
    candidate.slotUpdates.append(SlotUpdate(field=field, value=invented, source='current'))
    result = refine_task(draft, candidate)
    assert getattr(result, field) == empty
    assert next(x for x in result.slotUpdates if x.field == field).value == empty


def test_explicit_unresolved_condition_can_still_be_resolved_from_knowledge():
    from app.generic_reader_contracts import SlotUpdate
    task, _, _, _ = fixture(); task.businessFocus = ''; task.unresolvedSlots = ['businessFocus']
    draft = merge_task(task, {})
    candidate = draft.model_copy(deep=True); candidate.businessFocus = 'open'
    candidate.slotUpdates = [x for x in candidate.slotUpdates if x.field != 'businessFocus']
    candidate.slotUpdates.append(SlotUpdate(field='businessFocus', value='open', source='knowledge', evidence='page rule'))
    assert refine_task(draft, candidate).businessFocus == 'open'


def form_analysis_fixture(applicability=True):
    from app.generic_reader_contracts import Step, RequirementBinding
    task, plan, sources, knowledge = detail_fixture()
    task.requestedAttributes = ['materials']
    source = sources['detail']; source['data']['data']['version'] = 7
    source['structuredDocuments'] = [{'path': '/data/formData', 'completeness': 'complete', 'contentHash': 'synthetic',
        'data': {'schema': {'properties': {'attachment': {'x-component': 'FilePicker', 'required': True}}}, 'formValues': {}}}]
    fact = {'id': 'materials', 'kind': 'attribute', 'concept': 'materials', 'fields': ['formData'],
        'operationRef': source['operationRef'], 'sourcePath': '/data', 'formDefinition': {
            'format': 'schema_values/1', 'recordPath': '/data', 'versionPath': '/data/version',
            'documentPath': '/data/formData', 'materialComponents': ['FilePicker'], 'applicabilityComplete': applicability}}
    ident, ref = add_fact(knowledge, fact, 'specimen.materials')
    plan.steps[0].expose = False; plan.steps[0].role = 'observation'
    plan.steps.append(Step(id='materials', op='assess_form', sourceId='detail', path='/data', fields=['formData'],
        knowledgeBindingId=ident, label='Materials', role='detail', unknownPolicy='report', evidence=[]))
    plan.requirementBindings = [b for b in plan.requirementBindings if b.requirementId != 'attribute_0']
    plan.requirementBindings.append(RequirementBinding(requirementId='attribute_0', sourceId='detail', sourcePath='/data',
        knowledgeBindingId=ident, stepIds=['materials']))
    return task, plan, sources, knowledge


@pytest.mark.parametrize('applicability', [False, True])
def test_form_output_inherits_only_verified_single_parent_identity(applicability):
    task, plan, sources, knowledge = form_analysis_fixture(applicability)
    bind_analysis_evidence(plan, task, knowledge, sources)
    for b in plan.requirementBindings:
        if b.requirementId in {'object', 'grain'}: assert b.stepIds == ['materials']
    result = execute((task, plan, sources, knowledge))
    coverage = {r['id']: r for r in result['requirementCoverage']}
    assert coverage['object']['status'] == coverage['grain']['status'] == coverage['record']['status'] == 'satisfied'
    assert result['requirementsSatisfied'] is applicability
    if not applicability:
        assert result['outputs'][0]['value'][0]['status'] == 'unknown'
        assert 'form_applicability_unverified' in result['missing']


@pytest.mark.parametrize('proof_error', ['not_single', 'other_key', 'other_path', 'other_source'])
def test_form_parent_identity_does_not_bypass_source_or_record_proof(proof_error):
    task, plan, sources, knowledge = form_analysis_fixture()
    proof = sources['detail']['verifiedRecord']
    if proof_error == 'not_single': proof['single'] = False
    elif proof_error == 'other_key': proof['keyFields'] = ['otherKey']
    elif proof_error == 'other_path': proof['path'] = '/data/other'
    else: plan.steps[-1].sourceId = 'other'
    expected = 'analysis_form_operator_required' if proof_error == 'other_source' else 'requirement_output_unreachable'
    with pytest.raises(PipelineError, match=expected):
        bind_analysis_evidence(plan, task, knowledge, sources)

@pytest.mark.parametrize('version_path', [None, ''])
def test_service_identity_cannot_substitute_for_an_unverified_form_version(version_path):
    source, fact = form_fixture()
    source['data']['data']['entity']['serviceId'] = 17
    fact['formDefinition']['versionPath'] = version_path
    with pytest.raises(PipelineError, match='form_version_unverified'):
        assess_form(source, fact)


def test_raw_form_projection_gets_operator_correction_before_parent_lineage_failure():
    task, plan, sources, knowledge = form_analysis_fixture(False)
    plan.steps[-1].op = 'read_rows'
    with pytest.raises(PipelineError, match='analysis_form_operator_required') as exc:
        bind_analysis_evidence(plan, task, knowledge, sources)
    assert exc.value.category == 'planning'
    assert exc.value.details['sourceId'] == 'detail'
    assert 'assess_form' in exc.value.details['correction']
    assert 'unresolved applicability must remain unknown' in exc.value.details['correction']
    assert gap_items(['analysis_form_operator_required'])[0]['resolvedByKnowledgeImport'] is False


def test_form_adapter_compiles_declared_document_pointer_without_exposing_raw_form():
    from app.generic_reader_contracts import Step
    task, plan, sources, knowledge = form_analysis_fixture()
    form = plan.steps[-1]
    form.path = '/data/formData'
    attribute = next(b for b in plan.requirementBindings if b.requirementId == 'attribute_0')
    attribute.sourcePath='/data/formData';attribute.fields=['inventedRawFormColumn']
    plan.steps.insert(1,Step(id='unused_document_read',op='read_rows',sourceId='detail',path='/data/formData',
                            fields=['schema'],label='Unneeded form read',expose=False,evidence=[]))
    corrections=[]
    bind_analysis_evidence(plan,task,knowledge,sources,corrections=corrections)
    assert form.path == '/data'
    assert attribute.stepIds == ['materials'] and attribute.fields == ['formData']
    assert not any(s.id=='unused_document_read' for s in plan.steps)
    result=execute((task,plan,sources,knowledge))
    assert result['requirementsSatisfied']
    assert result['outputs'][0]['value'][0]['status']=='missing'


def test_form_adapter_does_not_normalize_unrelated_pointer():
    task, plan, sources, knowledge = form_analysis_fixture()
    plan.steps[-1].path = '/data/anotherForm'
    with pytest.raises(PipelineError, match='analysis_form_binding_mismatch'):
        bind_analysis_evidence(plan,task,knowledge,sources)


def test_form_adapter_preserves_missing_version_gap():
    task, plan, sources, knowledge = form_analysis_fixture()
    plan.steps[-1].path='/data/formData'
    del sources['detail']['data']['data']['version']
    bind_analysis_evidence(plan,task,knowledge,sources)
    result=execute((task,plan,sources,knowledge))
    assert not result['requirementsSatisfied'] and 'form_version_unverified' in result['missing']
