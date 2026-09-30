import copy
import json
import pytest
from app.generic_reader import KnowledgeStore, PipelineError, render_generic_answer
from app.reader_answers import (KnowledgeAnswerDraft, KnowledgeAnswerReview, validate_answer_draft,
                                validate_answer_review)
from app.reader_drafts import ReplyDraft, validate_reply_draft
from app.reader_guidance import guidance_task
from app.reader_context import refine_task
from test_reader_context_v3 import task
from test_reader_routing_v03 import package
from test_reader_answer_acceptance import fixture


def test_nested_business_evidence_survives_full_transport_over_sixty_fields():
    from test_projected_collection import gateway
    from app.portal_reader import bounded_portal_read_result
    from app.generic_reader import source_inventory, row_scalar
    from app.reader_collection import projection_hash
    raw = {'data': {'detail': {**{f'field{i}': i for i in range(65)},
        'options': json.dumps({'review': {'label': 'Review current item'}})},
        'events': [{'kind': 'Submission', 'actor': 'Reader A'}]}}
    evidence, truncated = gateway._reader_bounded_api_evidence(raw)
    candidate = {'operationKey': 'GET /api/work/{key}', 'policyState': 'allowed', 'status': 200,
        'responseEvidence': evidence, 'responseEvidenceTruncated': truncated,
        'fieldEvidence': gateway._reader_field_evidence(raw, evidence),
        'structuredDocuments': gateway._reader_structured_documents(raw)}
    observed = bounded_portal_read_result({'observation': {'apiDiscovery': {'candidates': [candidate]}}})['observation']
    source = next(iter(source_inventory(observed, '/work', 'now', 'principal').values()))
    assert row_scalar(source['data']['data']['detail'], 'options.review.label') == 'Review current item'
    assert source['fieldEvidence']['/data/events/0/actor']['valueHash'] == projection_hash('Reader A')
    assert source['fieldEvidence']['/data/events']['status'] == 'complete'
    assert source['decodedDocuments'][0]['path'] == '/data/detail/options'


def test_transport_never_replaces_a_changed_value_with_its_receipt():
    from app.portal_reader import bounded_portal_read_result
    from app.reader_collection import projection_hash
    candidate = {'operationKey': 'GET /api/work', 'responseEvidence': {'x': '[redacted]'},
        'fieldEvidence': {'/x': {'status': 'complete', 'kind': 'scalar', 'valueHash': projection_hash('raw')},
                          '/password': {'status': 'complete', 'kind': 'scalar', 'valueHash': projection_hash('secret')}}}
    out = bounded_portal_read_result({'observation': {'apiDiscovery': {'candidates': [candidate]}}})
    result = out['observation']['apiDiscovery']['candidates'][0]
    assert '/password' not in result['fieldEvidence']
    assert result['fieldEvidence']['/x']['valueHash'] != projection_hash(result['responseEvidence'].get('x'))


@pytest.mark.parametrize('predicate', ['verified', 'wrong', 'absent'])
def test_conditional_attribute_requires_row_predicate_but_not_predicate_display(predicate):
    from test_reader_parent_properties import fixture as parent_fixture, run
    from test_projected_collection import gateway
    from app.generic_reader_contracts import AnalysisPlan
    t, plan, sources, knowledge = parent_fixture()
    record = copy.deepcopy(next(iter(knowledge.items.values()))['record'])
    fact = next(b for b in record['payload']['bindings'] if b['id'] == 'groups')
    fact['fields'] = ['name', 'kind']
    fact['conditions'] = [{'field': 'kind', 'predicate': 'eq', 'value': 'Membership'}]
    knowledge = KnowledgeStore();knowledge.add({'chunks': [{'id': 'viewer', 'content': json.dumps({'records': [record]})}]})
    ref = knowledge.prompt()[0]['passages'][0]['sourceId']
    for row, kind in zip(sources['profile']['data']['data']['groups'], ['Membership', 'Review']):row['kind'] = kind
    raw = sources['profile']['data'];sources['profile']['fieldEvidence'] = gateway._reader_field_evidence(raw, raw)
    data = plan.model_dump();data['steps'][0].update(fields=['name', 'kind'], expose=False)
    if predicate != 'absent':
        data['steps'].append({'id': 'chosen', 'op': 'filter', 'inputs': ['groups'], 'field': 'kind',
            'operand': 'Membership' if predicate == 'verified' else 'Review', 'predicate': 'eq',
            'label': 'Selected event', 'expose': False, 'evidence': [{'sourceId': ref}]})
    data['steps'].append({'id': 'visible', 'op': 'project', 'inputs': ['groups' if predicate == 'absent' else 'chosen'],
        'fields': ['name'], 'role': 'detail', 'label': 'Group', 'expose': True, 'evidence': [{'sourceId': ref}]})
    # Source citations change when the synthetic record changes.
    for step in data['steps']:step['evidence'] = [{'sourceId': ref}]
    for b in data['requirementBindings']:b['evidence'] = [{'sourceId': ref}]
    for k, v in data['context'].items():
        if isinstance(v, dict) and 'evidence' in v:v['evidence'] = [{'sourceId': ref}]
    data['context']['scopeEvidence'] = [{'sourceId': ref}]
    result = run((t, AnalysisPlan.model_validate(data), sources, knowledge))
    coverage = next(c for c in result['requirementCoverage'] if c['id'] == 'attribute_0')
    assert (coverage['status'] == 'satisfied') is (predicate == 'verified')
    if predicate == 'verified':assert next(o for o in result['outputs'] if o['id'] == 'visible')['value'] == [{'name': 'Blue'}]


def definition(origin, revision, field='key'):
    value = package();value['records'][0]['revision'] = revision
    value['records'][0]['payload']['bindings'][0]['fields'] = [field]
    return {'content': json.dumps(value), 'source_name': 'Crystal definition.json',
            **({'source_type': 'local_page_knowledge'} if origin == 'local' else {'document_id': origin})}


def test_literal_attribute_field_still_requires_exact_documented_source():
    from types import SimpleNamespace
    from app.reader_requirements import _semantic_match
    fact = {'kind': 'attribute', 'concept': 'public reference', 'fields': ['publicRef'],
            'operationRef': 'GET /api/specimens', 'sourcePath': '/data/items'}
    binding = SimpleNamespace(knowledgeBindingId='ref', sourcePath='/data/items', fields=['publicRef'])
    requirement = {'kind': 'attribute', 'value': 'publicRef'}
    assert _semantic_match(binding, requirement, {'operationRef': 'GET /api/specimens'}, {'ref': fact})
    assert not _semantic_match(binding, requirement, {'operationRef': 'GET /api/other'}, {'ref': fact})
    assert not _semantic_match(binding, {'kind': 'group', 'value': 'publicRef'},
                               {'operationRef': 'GET /api/specimens'}, {'ref': fact})


@pytest.mark.parametrize('raw,captured,complete', [
    ('جديد\r\n', 'جديد', True), ('Pending\n  Review', 'Pending Review', True),
    ('Alpha Extra', 'Alpha', False), ('token: sensitive', 'token: [redacted]', False),
    ('<b>Pending</b>', 'Pending', False)])
def test_transport_attests_only_exact_values_or_whitespace_normalization(raw, captured, complete):
    from test_projected_collection import gateway
    proof = gateway._reader_field_evidence({'x': raw}, {'x': captured})['/x']
    assert (proof['status'] == 'complete') is complete


def test_qualitative_explanation_does_not_invent_a_counting_grain():
    from app.reader_knowledge_coverage import knowledge_requirements
    t = task(needsLiveData=False, requestedGrain='unknown', requestedMeasures=[], groupBy=[])
    assert 'grain' not in {r['kind'] for r in knowledge_requirements(t)}
    assert 'object' in {r['kind'] for r in knowledge_requirements(t)}
    for changed in [t.model_copy(update={'needsLiveData': True}),
                    t.model_copy(update={'requestedGrain': 'specimen'}),
                    t.model_copy(update={'groupBy': ['phase']})]:
        assert 'grain' in {r['kind'] for r in knowledge_requirements(changed)}


@pytest.mark.parametrize('order', [('local', 'remote'), ('remote', 'local')])
def test_current_remote_definitions_replace_bundled_local_in_both_orders(order):
    store = KnowledgeStore()
    for origin in order:
        store.add({'chunks': [definition(origin, 1 if origin == 'local' else 2)]})
        store.prompt()
    assert not store.conflicted
    assert len(store.items) == 1
    record = next(iter(store.items.values()))
    assert record['revision'] == '2' and record['definitionOrigin'] == 'remote'
    assert store.rejected == ['local_definition_superseded:crystals.fields']


def test_remote_conflict_is_not_silently_resolved_by_higher_revision():
    store = KnowledgeStore()
    for origin, revision, field in [('remote_a', 1, 'key'), ('remote_b', 2, 'other')]:
        store.add({'chunks': [definition(origin, revision, field)]})
    assert store.conflicted == {'crystals.fields'} and not store.items


def test_invalid_remote_does_not_remove_valid_local():
    store = KnowledgeStore();store.add({'chunks': [definition('local', 1)]})
    invalid = definition('remote', 2)
    data = json.loads(invalid['content']);data['records'][0]['status'] = 'draft'
    invalid['content'] = json.dumps(data);store.add({'chunks': [invalid]})
    assert next(iter(store.items.values()))['revision'] == '1'
    assert not store.conflicted


def draft(text='The current handbook defines a crystal record.'):
    return KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[{
        'id': 'meaning', 'text': text, 'requirementIds': ['object'], 'quoteIndexes': [0]}])


@pytest.mark.parametrize('bad', ['Raw operation /api/records', 'Source File ID: abcdef',
                                 'observation-table-004', 'sha256: e2e3', '```json\n{}'])
def test_customer_prose_rejects_implementation_metadata(bad):
    t, prior, plan, quotes = fixture()
    with pytest.raises(PipelineError):validate_answer_draft(draft(bad), t, quotes)


@pytest.mark.parametrize('link', ['https://other.example/crystals', '/work/crystals?id=4',
                                 '/work/hidden', '//other.example/work/crystals'])
def test_narrative_cannot_invent_navigation(link):
    t, prior, plan, quotes = fixture()
    with pytest.raises(PipelineError):
        validate_answer_draft(draft('Open [the page]('+link+').'), t, quotes, ['/work/crystals'])


def test_narrative_accepts_only_catalog_route_and_reviews_actual_blocks():
    t, prior, plan, quotes = fixture();p = draft('Open [Crystal work](/work/crystals).')
    quotes[p.blocks[0].quoteIndexes[0]]['text'] += ' Authorized route: /work/crystals'
    validate_answer_draft(p, t, quotes, ['/work/crystals'])
    with pytest.raises(PipelineError):validate_answer_review(plan, t, quotes, prior, p.blocks)
    review = plan.model_copy(update={'blockChecks': []})
    from app.reader_answers import AnswerBlockCheck
    review.blockChecks = [AnswerBlockCheck(blockId='meaning', supported=False, languageMatches=True,
        customerFacing=True, reason='The draft adds an unsupported business rule.')]
    validate_answer_review(review, t, quotes, prior, p.blocks)
    assert not review.blockChecks[0].supported  # semantic rejection survives structural validation


def test_quotes_remain_audit_only_while_verified_customer_blocks_are_rendered():
    value = {'knowledgeQuotes': [{'text': 'File ID: private-hash /api/hidden', 'source': 'internal.json'}],
             'knowledgeAnswer': [{'text': 'You can read the current authorized records.'}]}
    answer = render_generic_answer(value)
    assert answer == 'You can read the current authorized records.'
    assert 'private-hash' not in answer
    assert '/api/hidden' in render_generic_answer(value, include_diagnostics=True)


def test_guidance_never_retains_mutation_or_claims_completion():
    original = task(readOnly=False, needsLiveData=True, businessObject='specimen', recordIdentity='SP-20')
    alternative = guidance_task(original)
    assert alternative.readOnly and not alternative.needsLiveData
    assert alternative.businessObject == original.businessObject and alternative.recordIdentity == 'SP-20'
    assert any('authorized page navigation' in value for value in alternative.requestedAttributes)
    # The original condition is an explanation requirement, not a live population.
    assert alternative.businessFocus == ''
    assert 'formal workflow requirements' not in alternative.requestedAttributes
    text = render_generic_answer({'requestedActionStatus': 'blocked_read_only',
                                  'knowledgeAnswer': [{'text': 'Open the documented work page.'}]}, 'ar')
    assert 'لم يُجرَ أي تعديل' in text and 'Open the documented' in text


def test_expansion_numeric_repair_preserves_constraint_without_relaxing_validation():
    from app.reader_expansion import validate_expansion
    from test_reader_expansion_quality import expansion, simple_task
    t = simple_task(requestedAttributes=['age in last 12 days'])
    p = expansion(t)
    term = next(x for x in p.terms if x.requirementId == 'attribute_0')
    term.arabic = 'العمر خلال اثني عشر يوما'
    with pytest.raises(PipelineError, match='expansion_numeric_constraint_changed') as failure:
        validate_expansion(p, t, 'Age in last 12 days')
    assert failure.value.details['requiredNumericLiterals'] == ['12']
    assert failure.value.details['requirementId'] == 'attribute_0'
    term.arabic = 'العمر خلال ١٢ يوما'
    validate_expansion(p, t, 'Age in last 12 days')
    term.alternatives = ['age in last 13 days']
    with pytest.raises(PipelineError, match='expansion_numeric_constraint_changed'):
        validate_expansion(p, t, 'Age in last 12 days')


def test_document_continuation_retains_observed_operation_anchor():
    from app.reader_knowledge import document_query
    assert document_query('Work fields.json', '/work POST /api/work page size') == 'Work fields.json /work POST /api/work page size'
    assert document_query('Work fields.json', 'Work fields.json') == 'Work fields.json'
    assert len(document_query('Work fields.json', 'x' * 4000)) == 2000


def test_draft_mode_survives_knowledge_refinement():
    original = task(responseMode='draft');candidate = original.model_copy(update={'responseMode': 'answer'})
    assert refine_task(original, candidate).responseMode == 'draft'


def test_message_draft_cannot_cite_unverified_observations():
    reply = ReplyDraft(stage='reply_draft', message='The record is waiting for information.',
                       explanation='The record is not confirmed complete.', outputIds=['state'])
    observed = [{'id': 'state', 'role': 'observation', 'evidence': [{'sourceId': 's'}]}]
    with pytest.raises(PipelineError):validate_reply_draft(reply, observed)
    observed[0]['role'] = 'detail';validate_reply_draft(reply, observed)


def document_source():
    from app.reader_collection import projection_hash
    raw = '{"choice":{"label":"Check"},"enabled":true}'
    decoded = json.loads(raw)
    return {'kind': 'api_response', 'data': {'details': {'config': raw}},
        'fieldEvidence': {'/details/config': {'status': 'complete', 'valueHash': projection_hash(raw)}},
        'structuredDocuments': [{'path': '/details/config', 'encoding': 'json', 'data': decoded,
            'completeness': 'complete', 'contentHash': projection_hash(decoded)}]}


@pytest.mark.parametrize('fault', ['raw_hash', 'decoded_hash', 'changed_data', 'bounded', 'sanitized', 'non_api'])
def test_json_materialization_requires_both_exact_receipts_and_safe_complete_data(fault):
    from app.reader_documents import materialize_documents
    from app.reader_collection import projection_hash
    source = document_source();doc = source['structuredDocuments'][0]
    if fault == 'raw_hash':source['fieldEvidence']['/details/config']['valueHash'] = 'wrong'
    if fault == 'decoded_hash':doc['contentHash'] = 'wrong'
    if fault == 'changed_data':doc['data']['enabled'] = False
    if fault == 'bounded':doc['completeness'] = 'bounded'
    if fault == 'non_api':source['kind'] = 'page_section'
    if fault == 'sanitized':
        doc['data']['password'] = 'should remain hidden'
        source['data']['details']['config'] = json.dumps(doc['data'])
        source['fieldEvidence']['/details/config']['valueHash'] = projection_hash(source['data']['details']['config'])
        doc['contentHash'] = projection_hash(doc['data'])
    before = source['data']['details']['config']
    materialize_documents(source)
    assert source['data']['details']['config'] == before
    assert not source.get('decodedDocuments')


def test_json_materialization_proves_scalar_leaf_without_executing_values():
    from app.reader_documents import materialize_documents
    from app.reader_collection import projection_hash
    source = document_source();materialize_documents(source)
    assert source['data']['details']['config']['enabled'] is True
    assert source['fieldEvidence']['/details/config/choice/label']['valueHash'] == projection_hash('Check')
    assert len(source['decodedDocuments']) == 1
    materialize_documents(source)
    assert len(source['decodedDocuments']) == 1


def test_reply_pipeline_waits_for_validated_analysis_before_drafting():
    import asyncio
    from app.generic_reader import GenericKnowledgeReader
    from app.principal import Principal
    from test_generic_reader_v3 import Gateway, Planner
    class DraftPlanner(Planner):
        async def generic_reader_json(self, **kwargs):
            result = await super().generic_reader_json(**kwargs)
            if result.get('stage') == 'task': result['responseMode'] = 'draft'
            return result
    planner = DraftPlanner()
    outcome = asyncio.run(GenericKnowledgeReader(Gateway(), planner, portal_base_url='https://portal.test',
        knowledge_folder_id='folder').run(Principal('person-1','tenant','req',umc_token='session'),
        'Draft a summary of my current crystal queue for human review.'))
    result = outcome.result.public_json()
    assert 'source_selection' in planner.calls
    assert 'analysis' in planner.calls
    assert 'reply_draft' not in planner.calls  # This fixture has incomplete business evidence.
    assert 'reply_draft_source_unconfirmed' in result['missing']
    assert result.get('replyDraft') is None


def test_boolean_filter_binds_only_observed_list_control_and_closed_values():
    from app.portal_reader import _observed_filter_action
    selector = 'section [role="switch"]'
    state = {'filterControls': [{'label': 'Current items only', 'role': 'switch',
        'selector': selector, 'filterSurface': True, 'selected': ['true'], 'options': ['true','false']}]}
    bound, reason = _observed_filter_action({'type':'filter','name':'Current items only','value':'false'}, state)
    assert not reason and bound == {'type':'filter','selector':selector,'value':'false'}
    assert _observed_filter_action({'type':'filter','name':'Current items only','value':'toggle'}, state)[0] is None
    state['filterControls'].append(copy.deepcopy(state['filterControls'][0]))
    assert _observed_filter_action({'type':'filter','name':'Current items only','value':'false'}, state)[0] is None


def test_expansion_selects_existing_valid_translation_and_audits_without_inventing_one():
    from app.reader_expansion import select_numeric_safe_variants, validate_expansion
    from test_reader_expansion_quality import expansion, simple_task
    task = simple_task(requestedAttributes=['age in last 12 days'])
    plan = expansion(task)
    term = next(x for x in plan.terms if x.requirementId == 'attribute_0')
    term.arabic = 'العمر خلال اثني عشر يوما'
    term.alternatives = ['العمر خلال 12 يوما', 'age in last 13 days']
    result, audit = select_numeric_safe_variants(plan)
    validate_expansion(result, task, 'Age in last 12 days')
    changed = next(x for x in result.terms if x.requirementId == 'attribute_0')
    assert changed.arabic == 'العمر خلال 12 يوما'
    assert changed.alternatives == ['العمر خلال 12 يوما']
    assert audit[0]['before']['arabic'] != audit[0]['after']['arabic']
    assert term.arabic == 'العمر خلال اثني عشر يوما'
    term.alternatives = ['العمر خلال 13 يوما']
    result, _ = select_numeric_safe_variants(plan)
    with pytest.raises(PipelineError, match='expansion_numeric_constraint_changed'):
        validate_expansion(result, task, 'Age in last 12 days')


def test_canonical_query_finishes_before_variants_and_keeps_document_anchor():
    import asyncio
    from app.reader_retrieval import retrieve_evidence
    from test_reader_retrieval_coverage import Client
    async def run():
        started = asyncio.Event()
        primary_finished = False
        class OverlapClient(Client):
            async def _post(self, path, body, **kwargs):
                nonlocal primary_finished
                if body['query'] == 'form input requirements':
                    assert primary_finished
                    started.set()
                result = await super()._post(path, body, **kwargs)
                if body['query'] == 'form conditions schema' and body['folder_id'] == 'root':
                    primary_finished = True
                return result
        client = OverlapClient()
        result = await retrieve_evidence(client, 'form conditions schema', 'root', 32,
            {'purpose': 'business', 'queryVariants': ['form input requirements']})
        assert result['chunks'] and started.is_set()
        assert any(q['query'] == 'Form Conditions.md form conditions schema' for q in client.requests)
    asyncio.run(run())

@pytest.mark.parametrize('count,expected_error', [(250, None), (1001, 'field_evidence_incomplete')])
def test_detail_list_limit_is_distinct_from_group_limit(count, expected_error):
    from test_reader_parent_properties import fixture as parent_fixture, run
    from test_projected_collection import gateway
    f = parent_fixture(); source = f[2]['profile']
    source['data']['data']['groups'] = [{'name': 'Group '+str(i)} for i in range(count)]
    source['fieldEvidence'] = gateway._reader_field_evidence(source['data'], source['data'])
    if expected_error:
        with pytest.raises(PipelineError, match=expected_error): run(f)
    else:
        result = run(f)
        assert len(result['outputs'][0]['value']) == count

@pytest.mark.parametrize('valid_receipt', [True, False])
def test_hidden_object_dependencies_can_use_exact_observed_field_receipts(valid_receipt):
    from app.generic_reader_contracts import AnalysisPlan, TaskSpec
    from app.reader_bindings import bind_analysis_evidence
    from test_projected_collection import gateway
    source = {'operationRef': 'GET /api/crystal', 'data': {'data': {'key': 3, 'kind': 'crystal', 'name': 'Blue'}}}
    source['fieldEvidence'] = gateway._reader_field_evidence(source['data'], source['data'])
    if not valid_receipt:source['fieldEvidence']['/data/kind']['valueHash'] = 'wrong'
    knowledge = KnowledgeStore()
    record = {'id':'crystal.object', 'kind':'field_semantics', 'status':'active', 'revision':1,
      'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/crystal']}, 'sources':[{'reference':'/crystal'}],
      'payload':{'bindings':[{'id':'object','kind':'object','concept':'crystal',
          'fields':['key','kind'],'sourcePath':'/data','operationRef':'GET /api/crystal'}]}}
    knowledge.add({'chunks':[{'id':'definition','content':json.dumps({'records':[record]})}]})
    ref = knowledge.prompt()[0]['passages'][0]['sourceId']; claim=lambda x:{'value':x,'evidence':[{'sourceId':ref}]}
    plan=AnalysisPlan.model_validate({'stage':'analysis','missing':[], 'context':{'scope':'unknown','scopeEvidence':[], 'caveats':[], 'grain':claim('crystal'),
      'population':claim('crystal'),'filterScope':claim('current'),'time':claim('current')},
      'steps':[{'id':'read','op':'read_rows','sourceId':'live','path':'/data','fields':['key','name'],'expose':False,'label':'Read','evidence':[{'sourceId':ref}]},
        {'id':'show','op':'project','inputs':['read'],'fields':['name'],'role':'detail','label':'Name','evidence':[{'sourceId':ref}]}],
      'requirementBindings':[{'requirementId':'object','sourceId':'live','knowledgeBindingId':'crystal.object#object','stepIds':['read']}]})
    intent=task(businessObject='crystal',requestedGrain='crystal',requestedScope='unknown',
      requestedAttributes=['name'],requestedMeasures=[],groupBy=[],filters=[],timeRange='unknown', outputShape='detail',readOnly=True,needsLiveData=True,searchQuery='crystal name')
    bind_analysis_evidence(plan,intent,knowledge,{'live':source})
    assert ('kind' in plan.steps[0].fields) == valid_receipt
    assert plan.steps[1].fields == ['name']


def test_retrieval_cancellation_drains_all_inflight_searches():
    import asyncio
    from app.reader_retrieval import retrieve_evidence
    from test_reader_retrieval_coverage import Client
    async def run():
        both_started=asyncio.Event();live=set();finished=[]
        class SlowClient(Client):
            async def _post(self,path,body,**kwargs):
                if body['query'] == 'primary':
                    return {'chunks': []}
                live.add(body['query'])
                if len(live)==2:both_started.set()
                try:await asyncio.Event().wait()
                finally:live.remove(body['query']);finished.append(body['query'])
        parent=asyncio.create_task(retrieve_evidence(SlowClient(),'primary','root',8,
            {'purpose':'business','queryVariants':['alternate','another']}))
        await asyncio.wait_for(both_started.wait(),1);parent.cancel()
        with pytest.raises(asyncio.CancelledError):await parent
        assert not live and set(finished)=={'alternate','another'}
    asyncio.run(run())


@pytest.mark.parametrize('extra_field,correct_predicate,should_expose', [(False,True,True),(True,True,False),(False,False,False)])
def test_only_requested_typed_leaf_projection_can_be_exposed(extra_field, correct_predicate, should_expose):
    from app.reader_bindings import expose_requested_projections
    from app.generic_reader_contracts import AnalysisPlan
    from test_reader_parent_properties import fixture as parent_fixture
    t, plan, sources, knowledge = parent_fixture()
    t.requestedAttributes=['groups']; t.requestedScope='unknown'
    fact={'knowledgeBindingId':'group_fact','kind':'attribute','concept':'groups','aliases':[],
          'fields':['name','kind'],'sourcePath':'/data/groups','operationRef':'GET /api/viewer',
          'conditions':[{'field':'kind','predicate':'eq','value':'Membership'}]}
    ref=knowledge.prompt()[0]['passages'][0]['sourceId'];data=plan.model_dump()
    data['steps']=[{'id':'read','op':'read_rows','sourceId':'profile','path':'/data/groups','fields':['name','kind','privateNote'],'expose':False,'label':'Read','evidence':[{'sourceId':ref}]},
      {'id':'select','op':'filter','inputs':['read'],'field':'kind','operand':'Membership' if correct_predicate else 'Other','expose':False,'label':'Select','evidence':[{'sourceId':ref}]},
      {'id':'visible','op':'project','inputs':['select'],'fields':['name','privateNote'] if extra_field else ['name'],'expose':False,'role':'detail','label':'Groups','evidence':[{'sourceId':ref}]}]
    data['requirementBindings']=[{'requirementId':'attribute_0','sourceId':'profile','knowledgeBindingId':'group_fact','stepIds':['read','select','visible']}]
    plan=AnalysisPlan.model_validate(data)
    changes=expose_requested_projections(plan,t,{'group_fact':fact},sources)
    assert plan.steps[-1].expose is should_expose
    assert bool(changes) is should_expose


def test_customer_answer_does_not_expose_implementation_flag_assignments():
    from app.reader_answers import KnowledgeAnswerDraft, validate_answer_draft
    from app.reader_knowledge_coverage import knowledge_requirements
    t=task(needsLiveData=False,requestedAttributes=['review requirements'])
    rid=knowledge_requirements(t)[0]['id']
    p=KnowledgeAnswerDraft(stage='knowledge_answer_draft',blocks=[{'id':'rule','text':'The inspected flow sets canSkip=false.', 'requirementIds':[rid],'quoteIndexes':[0]}])
    with pytest.raises(PipelineError,match='knowledge_answer_implementation_text'):
        validate_answer_draft(p,t,[{'text':'A mandatory review remains required.'}])
    p.blocks[0].text='The documented mandatory review remains required.'
    validate_answer_draft(p,t,[{'text':'A mandatory review remains required.'}])


def test_single_property_table_uses_its_user_facing_label():
    answer=render_generic_answer({'outputs':[{'id':'actor','label':'Submitter','role':'detail','value':[{'displayActor':'Reader A'}]}], 'requirementsSatisfied':True},'en')
    assert '| Submitter |' in answer and 'displayActor' not in answer
    assert 'Reader A' in answer


@pytest.mark.parametrize('text,finish', [('{"a":1,', 'stop'), ('{"a":', 'stop'), ('{"a":"unfinished', 'stop'), ('{"a":1]', 'stop'), ('{"a":1} trailing', 'stop'), ('{"a":1', 'length')])
def test_json_container_repair_never_invents_values_or_accepts_truncation(text, finish):
    from app.llm import _parse_stage_object
    with pytest.raises(ValueError):_parse_stage_object(text,finish)


def test_json_container_repair_only_closes_finished_values_and_still_checks_contract():
    from app.llm import _parse_stage_object
    from app.reader_expansion import QueryExpansion
    from pydantic import ValidationError
    raw='{"checks":[{"reason":"a bracket } stays in its string","count":2}'
    value=_parse_stage_object(raw,'stop')
    assert value=={'checks':[{'reason':'a bracket } stays in its string','count':2}]}
    assert value.syntax_repair['appendedContainers']==2
    with pytest.raises(ValidationError):QueryExpansion.model_validate(value)
    strict=_parse_stage_object('{"safe":true}','stop')
    assert strict=={'safe':True} and not hasattr(strict,'syntax_repair')


@pytest.mark.parametrize('fault', ['', 'receipt', 'identity', 'absent'])
def test_visible_detail_privately_closes_only_verified_record_context(fault):
    from app.generic_reader_contracts import AnalysisPlan
    from app.reader_bindings import bind_analysis_evidence
    from test_projected_collection import gateway
    source={'operationRef':'GET /api/stone', 'data':{'data':{'key':3,'kind':'stone','name':'Blue'}},
      'verifiedRecord':{'single':True,'path':'/data','identity':'ST-3','keyFields':['key']}}
    source['fieldEvidence']=gateway._reader_field_evidence(source['data'],source['data'])
    if fault=='receipt':source['fieldEvidence']['/data/kind']['valueHash']='wrong'
    if fault=='identity':source['verifiedRecord']['identity']='ST-4'
    if fault=='absent':del source['data']['data']['kind']
    record={'id':'stone.fields','kind':'field_semantics','status':'active','revision':1,
      'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/stone']},
      'sources':[{'reference':'/stone'}], 'payload':{'bindings':[
        {'id':'object','kind':'object','concept':'stone','fields':['key','kind'],'sourcePath':'/data','operationRef':'GET /api/stone'},
        {'id':'name','kind':'attribute','concept':'name','fields':['name'],'sourcePath':'/data','operationRef':'GET /api/stone'}]}}
    k=KnowledgeStore();k.add({'chunks':[{'id':'fields','content':json.dumps({'records':[record]})}]})
    ref=k.prompt()[0]['passages'][0]['sourceId'];c=lambda v:{'value':v,'evidence':[{'sourceId':ref}]}
    plan=AnalysisPlan.model_validate({'stage':'analysis','missing':[],'context':{'scope':'unknown','scopeEvidence':[],
      'grain':c('stone'),'population':c('one stone'),'filterScope':c('ST-3'),'time':c('current'),'caveats':[]},
      'steps':[{'id':'read','op':'read_rows','sourceId':'live','path':'/data','role':'detail','fields':['key','name'],
        'expose':True,'label':'Name','evidence':[{'sourceId':ref}]}],
      'requirementBindings':[{'requirementId':'object','sourceId':'live','stepIds':['read'],'knowledgeBindingId':'stone.fields#object'},
        {'requirementId':'attribute_0','sourceId':'live','stepIds':['read'],'knowledgeBindingId':'stone.fields#name'}]})
    intent=task(businessObject='stone',requestedGrain='stone',recordIdentity='ST-3',requestedScope='unknown',
      requestedAttributes=['name'],requestedMeasures=[],groupBy=[],filters=[],timeRange='unknown',outputShape='detail',readOnly=True,needsLiveData=True,searchQuery='stone ST-3 name')
    bind_analysis_evidence(plan,intent,k,{'live':source})
    assert ('kind' in plan.steps[0].fields)==(not fault)
    assert plan.steps[0].expose is False
    assert [s.fields for s in plan.steps if s.expose]==[['name']]


@pytest.mark.parametrize('actual,expected,missing', [(True,False,False),(False,False,False),(True,False,True)])
def test_source_selection_must_report_or_correct_documented_filter_conflict(actual,expected,missing):
    from app.generic_reader_contracts import SourceSelection
    from app.reader_bindings import selection_context_gaps
    from app.reader_collection import projection_hash
    source={'operationRef':'POST /api/stone/list','data':{'data':{'items':[]}},
      'collectionContext':{'parameterHashes':{'currentOnly':projection_hash(actual)}}}
    record={'id':'stone.scope','kind':'field_semantics','status':'active','revision':1,
      'applicability':{'portal':'admin','environments':['local']},'sources':[{'reference':'/stone'}],
      'payload':{'bindings':[{'id':'scope','kind':'scope','concept':'team','fields':['key'],
        'operationRef':'POST /api/stone/list','sourcePath':'/data/items','contextParameters':{'currentOnly':expected}}]}}
    k=KnowledgeStore();k.add({'chunks':[{'id':'scope','content':json.dumps({'records':[record]})}]})
    plan=SourceSelection(stage='source_selection',sourceIds=['live'],nextActions=[],rationale=[],missing=['control_missing'] if missing else [])
    gaps=selection_context_gaps(task(requestedScope='team'),plan,{'live':source},k)
    assert bool(gaps)==(actual!=expected and not missing)
    if gaps:assert gaps[0]['requirementId']=='scope'
    assert not selection_context_gaps(task(requestedScope='team'),plan,{'live':dict(source,operationRef='POST /api/other')},k)


def test_validated_computed_rows_are_not_cut_to_metadata_discovery_limit():
    from app.generic_reader import GenericKnowledgeReader, render_generic_answer
    from test_reader_generic_completion import detail_fixture
    from app.reader_bindings import bind_analysis_evidence
    from app.generic_reader import execute_analysis
    t,plan,sources,k=detail_fixture();bind_analysis_evidence(plan,t,k,sources)
    analysis=execute_analysis(plan,sources,k,[],task=t)
    rows=[{'color':'Color '+str(i)} for i in range(604)]
    analysis['outputs'][0]['value']=rows
    reader=GenericKnowledgeReader(None,None,portal_base_url='https://portal.test',knowledge_folder_id='folder')
    result=reader.finish(task=t,analysis=analysis).result.public_json()
    assert len(result['outputs'][0]['value'])==604
    answer=render_generic_answer(result)
    assert '| Color 603 |' in answer


def test_answer_navigation_excludes_contextual_child_and_required_parameter_routes(tmp_path):
    from app.reader_context import load_catalog
    from app.reader_answers import standalone_answer_routes
    pages=[{'name':'Stone','routes':[{'path':'/stone'},{'path':'/stone/inspect','activeMenuPath':'/stone'}]}]
    (tmp_path/'page-catalog.json').write_text(json.dumps(pages))
    catalog,_=load_catalog(tmp_path,lambda route:True)
    assert catalog[0]['routes']==['/stone','/stone/inspect']
    k=KnowledgeStore()
    assert standalone_answer_routes(catalog,k)==['/stone']
    record={'id':'stone.route','kind':'page','status':'active','revision':1,
      'applicability':{'portal':'admin','environments':['local'],'pageRefs':['/stone']},'sources':[{'reference':'/stone'}],
      'payload':{'routing':{'parameters':[{'id':'key','name':'key','required':True}]}}}
    k.add({'chunks':[{'id':'entry','content':json.dumps({'records':[record]})}]})
    assert standalone_answer_routes(catalog,k)==[]


@pytest.mark.parametrize('message', ['We will review this tomorrow.', "We’ll send a reply.", 'سنواصل مراجعة طلبك.', 'سوف نتواصل معك.'])
def test_reply_draft_never_pledges_future_staff_action(message):
    from app.reader_drafts import ReplyDraft,validate_reply_draft
    message=message.replace('’',"'")
    plan=ReplyDraft(stage='reply_draft',explanation='Current state only',message=message,outputIds=['status'])
    with pytest.raises(PipelineError,match='reply_draft_action_pledge'):
        validate_reply_draft(plan,[{'id':'status','role':'detail','evidence':[{'sourceId':'live'}]}])


def test_detail_shape_error_explains_empty_binding_without_relaxing_attribute_mapping():
    from test_reader_generic_completion import detail_fixture
    from app.generic_reader_contracts import RequirementBinding
    from app.reader_bindings import bind_analysis_evidence
    t,p,s,k=detail_fixture();t.outputShape='list';t.requestedAttributes=[]
    p.requirementBindings=[b for b in p.requirementBindings if b.requirementId!='attribute_0']
    p.requirementBindings.append(RequirementBinding(requirementId='detail',sourceId='detail',stepIds=['detail'],
        knowledgeBindingId='specimen.detail#attribute',sourcePath='/data',fields=['color']))
    with pytest.raises(PipelineError,match='analysis_detail_binding_is_structural') as err:bind_analysis_evidence(p,t,k,s)
    assert err.value.details['knowledgeBindingId']==''


def test_read_continuation_discards_stale_sources_but_does_not_authorize_controls():
    from app.generic_reader_contracts import SourceSelection
    from app.reader_bindings import prepare_read_continuation
    from app.portal_reader import _observed_filter_action
    selection=SourceSelection(stage='source_selection',sourceIds=['before-action'],rationale=[],missing=[],
      nextActions=[{'type':'filter','selector':'#only','value':'false','evidence':[{'sourceId':'doc:p0'}]}, {'type':'filter','selector':'#category','value':'all','evidence':[{'sourceId':'doc:p1'}]}])
    receipt=prepare_read_continuation(selection)
    assert selection.sourceIds==[] and len(selection.nextActions)==1
    assert selection.nextActions[0].selector=='#only'
    assert receipt['discardedSourceIds']==['before-action'] and receipt['deferredActionCount']==1
    # A model selector remains unusable without the actual page control.
    assert _observed_filter_action(selection.nextActions[0].model_dump(), {'filterControls':[]})[0] is None
    plain=SourceSelection(stage='source_selection',sourceIds=['current'],rationale=[],nextActions=[],missing=[])
    assert prepare_read_continuation(plain) is None and plain.sourceIds==['current']


@pytest.mark.parametrize('message', [
    'وسنوافيكم بأي تحديث يطرأ على حالة التذكرة.',
    'فسنبلغكم بالنتيجة لاحقاً.',
    'سنخبركم عند اكتمال المراجعة.',
])
def test_arabic_attached_future_staff_pledges_require_correction(message):
    draft=ReplyDraft(stage='reply_draft', explanation='Current state only.', message=message, outputIds=['state'])
    with pytest.raises(PipelineError) as error:
        validate_reply_draft(draft, [{'id':'state','role':'detail','evidence':[{'sourceId':'read'}]}])
    assert error.value.code == 'reply_draft_action_pledge'


@pytest.mark.parametrize('actions', [[],
    [{'type':'filter','selector':'input[placeholder="Find"]','value':'ABC'}],
    [{'type':'switch_tab','role':'tab','name':'Waiting'},
     {'type':'filter','selector':'input[placeholder="Find"]','value':'ABC'}]])
def test_continuation_wire_request_matches_strict_gateway_contract(actions):
    from app.generic_reader import observation_request
    from test_projected_collection import gateway
    request=observation_request('/work', actions)
    payload=request.as_payload()
    gateway._validate_reader_request(gateway.AdminPortalReadRequest.model_validate(payload))
    assert payload['actions'] == (actions or [{'type':'observe'}])
    # Do not relax the gateway to accept the erroneous compound observation.
    if actions:
        bad=dict(payload, actions=actions+[{'type':'observe'}])
        with pytest.raises(gateway.HTTPException) as error:
            gateway._validate_reader_request(gateway.AdminPortalReadRequest.model_validate(bad))
        assert error.value.detail['code']=='invalid_observation_plan'


def test_customer_draft_review_must_establish_consistent_recipient():
    from app.reader_drafts import ReplyDraftReview, reply_review_accepted
    from pydantic import ValidationError
    data=dict(stage='reply_draft_review', factsSupported=True, noUnverifiedState=True,
              noActionClaim=True, languageMatches=True, reason='Audience must be verified.')
    with pytest.raises(ValidationError):
        ReplyDraftReview.model_validate(data)
    assert not reply_review_accepted(ReplyDraftReview(**data, customerFacing=False))
    assert reply_review_accepted(ReplyDraftReview(**data, customerFacing=True))


@pytest.mark.parametrize('prose', ['The live result (output project_ticket) says Pending.',
                                   'The project_ticket confirms Pending.'])
def test_draft_internal_output_reference_must_be_corrected(prose):
    draft=ReplyDraft(stage='reply_draft', explanation=prose, message='The current status is Pending.', outputIds=['project_ticket'])
    with pytest.raises(PipelineError, match='reply_draft_internal_reference'):
        validate_reply_draft(draft,[{'id':'project_ticket','role':'detail','evidence':[{'sourceId':'source'}]}])
