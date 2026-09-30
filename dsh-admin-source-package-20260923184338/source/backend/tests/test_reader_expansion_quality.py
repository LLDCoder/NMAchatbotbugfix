"""Bilingual recall and stage acceptance: no page-specific business fixtures."""
import asyncio
import copy
import json
import time
import pytest
from app.generic_reader import GenericKnowledgeReader, PipelineError, render_generic_answer
from app.reader_expansion import QueryExpansion, validate_expansion, search_variants
from app.reader_quality import QualityLedger, STAGES
from app.reader_requirements import requirements_for, _words, _semantic_match
from app.reader_retrieval import terms, retrieve_evidence, RETRIEVAL_BUDGET, rank_documents
from app.reader_knowledge_selection import rank_items
from app.reader_routing import task_fingerprint, recall_candidates
from app.principal import Principal
from test_generic_reader_v3 import Planner, Gateway, expansion_fixture, store
from test_reader_context_v3 import task
from test_reader_retrieval_coverage import Client, chunk


def simple_task(**changes):
    return task(businessObject='crystals', requestedGrain='crystal', requestedScope='personal',
                requestedMeasures=['count'], groupBy=['status'], filters=[], timeRange='unknown', **changes)


def expansion(t):
    translated = {'crystals': 'البلورات', 'crystal': 'بلورة', 'personal': 'شخصي',
                  'count': 'عدد', 'status': 'الحالة'}
    data = expansion_fixture({'requirements': requirements_for(t)})
    for item in data['terms']:
        item['arabic'] = translated.get(item['sourceText'], item['arabic'])
    return QueryExpansion.model_validate(data)


def test_arabic_lexical_evidence_is_retained_and_distinct_business_words_never_match_empty():
    assert terms('حَالَة البـلورات ٣٠') == terms('حالة البلورات 30')
    assert _words('حالة') != _words('أولوية')
    assert terms('Expired records') == {'expired', 'record'}
    a = {'text': 'أولوية البلورات', 'sourceName': 'Generic'}
    b = {'text': 'حَالَة البـلورات', 'sourceName': 'Generic'}
    assert rank_items([a, b], ['حالة البلورات'])[0] is b
    manifests = [{'id': 'one', 'status': 'done', 'name': 'أولوية.md'},
                 {'id': 'two', 'status': 'done', 'name': 'حالة.md'}]
    assert rank_documents(manifests, 'حالة')[0]['id'] == 'two'


@pytest.mark.parametrize('mutation,code', [
    (lambda p: p.terms.pop(), 'expansion_requirement_coverage_invalid'),
    (lambda p: p.terms.append(p.terms[0]), 'expansion_requirement_coverage_invalid'),
    (lambda p: setattr(p.terms[0], 'sourceText', 'other objects'), 'expansion_source_changed'),
    (lambda p: setattr(p.terms[0], 'english', 'crystals 99'), 'expansion_numeric_constraint_changed'),
    (lambda p: setattr(p.terms[0], 'arabic', 'crystals'), 'expansion_arabic_missing'),
    (lambda p: setattr(p.terms[0], 'alternatives', ['/invented/page']), 'expansion_route_invented'),
])
def test_invalid_expansion_cannot_reach_retrieval(mutation, code):
    t = simple_task(); p = expansion(t); mutation(p)
    with pytest.raises(PipelineError, match=code):
        validate_expansion(p, t, 'Count my crystals by status.')


def test_identifier_and_numeric_constraints_preserved_in_every_variant():
    t = simple_task(recordIdentity='AB-407', requestedAttributes=['age in last 30 days'])
    p = expansion(t)
    validate_expansion(p, t, 'Count AB-407 during the last 30 days.')
    identity = next(x for x in p.terms if x.requirementId == 'record')
    identity.arabic = 'AB-٤٠٧'
    with pytest.raises(PipelineError, match='expansion_identifier_changed'):
        validate_expansion(p, t, 'Count AB-407 during the last 30 days.')


def test_explicit_route_remains_literal_in_arabic_search_terms():
    t=simple_task(view='/viewer/items');p=expansion(t)
    term=next(x for x in p.terms if x.requirementId=='view')
    term.english=term.arabic=term.sourceText;term.alternatives=[]
    validate_expansion(p,t,'Read /viewer/items.')
    term.arabic='عرض العناصر'
    with pytest.raises(PipelineError,match='expansion_identifier_changed'):
        validate_expansion(p,t,'Read /viewer/items.')


def test_same_canonical_intent_uses_same_bilingual_queries_without_granting_business_aliases():
    t = simple_task(); before = task_fingerprint(t); p = expansion(t)
    p.terms[0].alternatives = ['gem specimens']
    en = search_variants(p, t, 'my crystals status count', 'business')
    ar = search_variants(p, t, 'my crystals status count', 'business')
    assert en == ar and len(en) == 2 and 'البلورات' in en[0]
    assert all('gem specimens' not in q for q in en)  # Unverified business synonym is not applied.
    assert task_fingerprint(t) == before
    assert search_variants(p, t, 'a focused missing condition', 'coverage_supplement') == []
    field_queries = search_variants(p, t, '/work/crystals fields', 'page_fields')
    assert all(q.startswith('/work/crystals fields') for q in field_queries)
    changed = t.model_copy(update={'businessObject': 'meteorites'})
    assert all('البلورات' not in q for q in search_variants(p, changed, 'meteorites', 'business'))


def test_expansion_does_not_make_unrelated_arabic_binding_equivalent():
    from types import SimpleNamespace
    fact = {'kind': 'attribute', 'concept': 'الأولوية', 'operationRef': 'GET /items',
            'sourcePath': '/rows', 'fields': ['priority']}
    binding = SimpleNamespace(knowledgeBindingId='b', sourcePath='/rows', fields=['priority'])
    assert not _semantic_match(binding, {'kind': 'attribute', 'value': 'الحالة'},
                               {'operationRef': 'GET /items'}, {'b': fact})


def test_expanded_retrieval_recovers_an_arabic_document_and_keeps_authorized_versions():
    class BilingualClient(Client):
        async def _post(self, path, body, **kwargs):
            if body['query'] == 'شروط النموذج':
                self.requests.append(body)
                return {'completed_channels': ['vector', 'bm25', 'graph'],
                        'chunks': [chunk('rules', 1, 'Schema version determines applicability.', 'Form Conditions.md')]}
            return await super()._post(path, body, **kwargs)
    client = BilingualClient()
    result = asyncio.run(retrieve_evidence(client, 'generic inquiry', 'root', 3,
        {'purpose': 'business', 'queryVariants': ['شروط النموذج']}))
    assert any(c['document_id'] == 'rules' for c in result['chunks'])
    assert result['pinnedVersions']['rules'][1] == '1'
    assert result['retrievalPlan']['queries'][1]['stage'] == 'expanded_search'
    assert result['retrievalPlan']['fusion'] == 'reciprocal_rank_then_document_diversity'


def test_optional_expansion_failure_and_budget_stay_visible_without_faking_channels():
    import httpx
    class FailedExpansion(Client):
        async def _post(self, path, body, **kwargs):
            if body['query'] == 'شروط النموذج':
                raise httpx.ConnectError('private transport error')
            return await super()._post(path, body, **kwargs)
    async def run():
        token = RETRIEVAL_BUDGET.set({'remaining': 1, 'lanes': {'business': 1}})
        try:
            return await retrieve_evidence(FailedExpansion(), 'generic', 'root', 10,
                {'purpose': 'business', 'queryVariants': ['شروط النموذج', 'form conditions']})
        finally:
            RETRIEVAL_BUDGET.reset(token)
    result = asyncio.run(run())
    assert result['chunks']
    codes = {f['code'] for f in result['retrievalPlan']['supplementFailures']}
    assert 'knowledge_supplement_fetch_failed' in codes and 'knowledge_supplement_budget_exhausted' in codes
    assert 'private transport error' not in json.dumps(result)


@pytest.mark.parametrize('alternate_ok', [True, False])
def test_failed_primary_still_tries_bilingual_recall_but_requires_a_verified_query(alternate_ok):
    import httpx
    class RecoveryClient(Client):
        async def _post(self, path, body, **kwargs):
            self.requests.append(body)
            if body['query'] == 'شروط النموذج' and alternate_ok:
                return {'completed_channels': ['vector', 'bm25', 'graph'],
                        'chunks': [chunk('rules', 1, 'Applicable form conditions.', 'Form Conditions.md')]}
            response = httpx.Response(424, json={'detail': {
                'code': 'knowledge_retrieval_channels_incomplete',
                'requiredChannels': ['vector', 'bm25', 'graph'], 'completedChannels': ['vector', 'bm25'],
                'missingChannels': ['graph'], 'channels': {'graph': {'status': 'error', 'count': 0}}}},
                request=httpx.Request('POST', 'https://kb.test/search'))
            raise httpx.HTTPStatusError('private body', request=response.request, response=response)
    client = RecoveryClient()
    result = asyncio.run(retrieve_evidence(client, 'form question', 'root', 8,
        {'purpose': 'business', 'queryVariants': ['شروط النموذج']}))
    assert len(client.requests) >= 2
    assert result['retrievalPlan']['primaryRecovered'] is alternate_ok
    assert any(q.get('status') == 'failed' for q in result['retrievalPlan']['queries'])
    assert bool(result['chunks']) is alternate_ok
    if not alternate_ok:
        assert result['consistencyError'] == 'knowledge_retrieval_channels_incomplete'
    assert 'private body' not in json.dumps(result)


def test_permission_failure_never_falls_back_to_an_expanded_query():
    import httpx
    class Denied(Client):
        async def _post(self, path, body, **kwargs):
            self.requests.append(body)
            r = httpx.Response(403, request=httpx.Request('POST', 'https://kb.test/search'))
            raise httpx.HTTPStatusError('denied', request=r.request, response=r)
    client = Denied()
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(retrieve_evidence(client, 'form question', 'root', 8,
            {'purpose': 'business', 'queryVariants': ['شروط النموذج']}))
    assert len(client.requests) == 1


def test_interruption_preserves_completed_checks_and_marks_the_active_stage():
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test')
    reader.secrets = ()
    reader.quality.record('identity_context', 'passed')
    reader.active_quality_stage = 'knowledge_retrieval'
    outcome = reader.interrupted_outcome()
    statuses = {c['stage']: c['status'] for c in outcome.result.public_json()['executionStatus']}
    assert statuses['identity_context'] == 'passed'
    assert statuses['knowledge_retrieval'] == 'failed'
    assert statuses['page_observation'] == 'not_run'


def test_stage_success_is_not_quality_acceptance_and_failure_keeps_downstream_not_run():
    class BadPlanner(Planner):
        async def generic_reader_json(self, **kwargs):
            if kwargs['schema']['properties']['stage']['const'] == 'query_expansion':
                value = expansion_fixture(kwargs['data']); value['terms'].pop()
                return value
            return await super().generic_reader_json(**kwargs)
    g = Gateway()
    outcome = asyncio.run(GenericKnowledgeReader(g, BadPlanner(), portal_base_url='https://portal.test').run(
        Principal('person-1', 'tenant', 'r'), 'Count my crystals by status.'))
    assert g.events == ['identity']
    evidence = outcome.result.public_json()
    statuses = {c['stage']: c['status'] for c in evidence['executionStatus']}
    assert statuses['query_expansion'] == 'failed'
    assert statuses['page_observation'] == statuses['knowledge_retrieval'] == 'not_run'
    assert evidence['analysisStatus'] == 'failed'
    assert any(s['stage'] == 'QueryExpansion' and s['status'] == 'completed'
               and s['checkType'] == 'execution' for s in outcome.audit_evidence['stages'])


def test_omitted_original_clause_is_repaired_once_and_reviewed_before_search():
    class RepairPlanner(Planner):
        async def generic_reader_json(self, **kwargs):
            kind = kwargs['schema']['properties']['stage']['const']; data = kwargs['data']
            if kind == 'query_expansion' and not data['task']['requestedAttributes']:
                return {'stage': kind, 'intentStatus': 'needs_revision',
                        'issues': [{'quote': 'include age', 'reason': 'Requested attribute missing.'}], 'terms': []}
            value = await super().generic_reader_json(**kwargs)
            if kind == 'task' and data.get('phase') in {'intent_repair', 'knowledge_refinement'}:
                value['requestedAttributes'] = ['age']
                value['slotUpdates'] = [{'field': 'requestedAttributes', 'source': 'current', 'value': ['age']}]
            return value
    g = Gateway()
    reader = GenericKnowledgeReader(g, RepairPlanner(), portal_base_url='https://portal.test')
    outcome = asyncio.run(reader.run(Principal('person-1', 'tenant', 'r'), 'Count crystals; include age.'))
    assert 'knowledge.search' in g.events
    assert outcome.result.public_json()['intentState']['task']['requestedAttributes'] == ['age']
    assert sum(r['reason'] == 'intent_clause_mismatch' for r in reader.recovery) == 1
    assert reader.audit['queryExpansions'][0]['intentStatus'] == 'needs_revision'
    assert reader.audit['queryExpansions'][1]['intentStatus'] == 'consistent'


def test_final_acceptance_cannot_skip_a_stage_or_hide_incomplete_knowledge():
    ledger = QualityLedger(); t = simple_task()
    for stage in STAGES:
        if stage != 'page_observation':
            ledger.record(stage, 'passed')
    assert ledger.blockers(t) == ['page_observation']
    ledger.record('page_observation', 'passed')
    ledger.record('knowledge_coverage', 'partial', code='missing_condition')
    assert ledger.blockers(t) == ['knowledge_coverage']
    ledger.record('knowledge_coverage', 'passed')
    ledger.record('knowledge_retrieval', 'partial', code='optional_translation_failed')
    assert ledger.blockers(t) == []  # Independently covered; optional error remains in receipt.
    ledger.record('knowledge_retrieval', 'failed', code='mandatory_channel_failed')
    assert ledger.blockers(t) == ['knowledge_retrieval']
    assert all(x['status'] == 'not_required' for x in ledger.snapshot(t.model_copy(update={'needsLiveData': False}))
               if x['stage'] in {'page_observation', 'data_collection', 'analysis'})


def test_arabic_and_english_render_same_values_unknowns_failure_and_stage_coverage():
    evidence = {'outputs': [{'id': 'n', 'label': 'عدد', 'value': 71, 'unknownCount': 2,
                            'evidence': [{'completeness': 'partial'}]}],
                'completeness': 'bounded', 'requirementsSatisfied': False,
                'context': {'scope': 'personal'}, 'missing': ['requested_grouping_unfulfilled'],
                'executionStatus': [{'stage': 'data_collection', 'status': 'partial'}]}
    en, ar = [render_generic_answer(copy.deepcopy(evidence), lang, include_diagnostics=True) for lang in ('en', 'ar')]
    for text in [en, ar]:
        assert '71' in text and '2' in text and 'requested_grouping_unfulfilled' in text
    assert 'بيانات' in ar and 'Scope:' not in ar and 'Current page results:' not in ar
    assert 'جمع البيانات' in ar and 'data_collection' in en
    failure = render_generic_answer({'failureCategory': 'runtime'}, 'ar')
    assert 'تعطلت خدمة' in failure


def test_canonical_primary_query_is_identical_for_same_task_despite_free_query_wording():
    from app.reader_retrieval import business_query
    a = simple_task()
    b = a.model_copy(update={'searchQuery': 'current crystal requests owned by me grouped by state'})
    assert business_query(a, include_planner_query=False) == business_query(b, include_planner_query=False)
    assert business_query(a) != business_query(b)
    assert business_query(b) in search_variants(expansion(b), b,
        business_query(b, include_planner_query=False), 'business')


def test_normalization_covers_the_entire_source_and_keeps_ids_numbers_and_dates():
    from app.reader_expansion import InputNormalization, validate_normalization
    question = 'اعرض AB-407 بتاريخ 2026-09-27، ولا تعرض أكثر من 3 سجلات.'
    plan = InputNormalization(stage='input_normalization', clauses=[{
        'sourceQuote': question,
        'english': 'Show AB-407 dated 2026-09-27, and do not show more than 3 records.'}])
    validate_normalization(plan, question)
    plan.clauses[0].english = 'Show AC-407 dated 2026-09-27, and do not show more than 3 records.'
    with pytest.raises(PipelineError, match='normalization_literal_changed'):
        validate_normalization(plan, question)


@pytest.mark.parametrize('fault,code', [
    ('omitted_tail', 'normalization_source_coverage_invalid'),
    ('invented_quote', 'normalization_source_coverage_invalid'),
    ('changed_number', 'normalization_numeric_constraint_changed'),
])
def test_normalization_rejects_partial_or_changed_source(fault, code):
    from app.reader_expansion import InputNormalization, validate_normalization
    question = 'اعرض 3 سجلات. مع الحالة.'
    plan = InputNormalization(stage='input_normalization', clauses=[
        {'sourceQuote': 'اعرض 3 سجلات.', 'english': 'Show 3 records.'},
        {'sourceQuote': 'مع الحالة.', 'english': 'Include status.'}])
    if fault == 'omitted_tail': plan.clauses.pop()
    if fault == 'invented_quote': plan.clauses[0].sourceQuote = 'نص مختلف'
    if fault == 'changed_number': plan.clauses[0].english = 'Show 4 records.'
    with pytest.raises(PipelineError, match=code):
        validate_normalization(plan, question)


def test_arabic_is_normalized_before_taskspec_and_original_remains_available_to_review():
    class BilingualPlanner(Planner):
        def __init__(self):
            super().__init__(); self.inputs=[]
        async def generic_reader_json(self, **kwargs):
            self.inputs.append(kwargs['data'])
            if kwargs['schema']['properties']['stage']['const'] == 'input_normalization':
                return {'stage':'input_normalization','clauses':[{
                    'sourceQuote': kwargs['data']['question'],
                    'english':'Count my crystals by status.'}]}
            if kwargs['schema']['properties']['stage']['const'] == 'analysis':
                value = await super().generic_reader_json(**kwargs)
                for step in value['steps']: step['label'] = 'عدد'
                return value
            return await super().generic_reader_json(**kwargs)
    planner = BilingualPlanner()
    question = 'احسب بلوراتي حسب الحالة.'
    reader = GenericKnowledgeReader(Gateway(), planner, portal_base_url='https://portal.test')
    result = asyncio.run(reader.run(Principal('person-1','tenant','r'), question))
    initial = next(d for d in planner.inputs if d.get('phase')=='initial')
    assert initial['question'] == 'Count my crystals by status.'
    assert initial['originalQuestion'] == question
    assert reader.audit['queryExpansions']
    assert result.result.public_json()['intentState']['originalQuestion'] == question


def test_stage_quality_failure_never_generates_a_business_knowledge_patch():
    from app.reader_gaps import gap_items
    gap = gap_items(['stage_quality_incomplete'])[0]
    assert gap['category'] == 'acceptance' and not gap['resolvedByKnowledgeImport']


def test_coverage_started_before_a_failed_supplement_is_partial_not_unexecuted():
    class FollowupPlanner(Planner):
        async def generic_reader_json(self, **kwargs):
            if kwargs['schema']['properties']['stage']['const'] == 'knowledge_coverage':
                return {'stage':'knowledge_coverage','checks':[{
                    'requirementId':r['id'],'status':'partial','evidence':[],
                    'reason':'A required definition is missing.','followupQuery':'crystal field definitions'}
                    for r in kwargs['data']['requirements']]}
            return await super().generic_reader_json(**kwargs)
    class Unavailable(Gateway):
        async def invoke(self, *args, **kwargs):
            return {'ok':False}
    reader = GenericKnowledgeReader(Unavailable(), FollowupPlanner(), portal_base_url='https://portal.test')
    reader.knowledge=store(); reader.deadline=time.monotonic()+30
    with pytest.raises(PipelineError, match='knowledge_dependency_unavailable'):
        asyncio.run(reader.check_knowledge(Principal('person-1','tenant','r'), simple_task()))
    receipt = next(c for c in reader.quality.snapshot(simple_task()) if c['stage']=='knowledge_coverage')
    assert receipt['status']=='partial' and receipt['code']=='coverage_review_in_progress'


def test_catalog_recall_receives_original_qualifiers_even_when_a_task_slot_omits_them():
    from app.generic_reader_contracts import CatalogRecall
    class Capture:
        async def generic_reader_json(self, **kwargs):
            self.data = kwargs['data']
            return {'stage':'catalog_recall','candidateIds':[],'reason':'No applicable candidate.'}
    planner=Capture(); reader=GenericKnowledgeReader(None, planner, portal_base_url='https://portal.test')
    reader.current_question='مهام الفريق الذي أديره'
    reader.canonical_question='Tasks of the team that I manage.'
    reader.deadline=time.monotonic()+10
    asyncio.run(reader.structured(CatalogRecall, 'Recall authorized pages.', {'task':simple_task().model_dump()}))
    assert planner.data['originalQuestion']==reader.current_question
    assert planner.data['canonicalQuestion']==reader.canonical_question


def test_explicit_measure_entity_repairs_grouping_grain_without_losing_dimensions():
    from app.reader_context import normalize_measure_grain, validate_task_grain
    t = task(businessObject='specimen', requestedGrain='keeper', groupBy=['keeper'],
             requestedMeasures=['blue specimen count','warm specimen count'], businessFocus='',
             slotUpdates=[{'field':'requestedGrain','source':'current','value':'keeper'}])
    fixed, receipt = normalize_measure_grain(t)
    assert fixed.requestedGrain=='specimen' and fixed.groupBy==['keeper']
    assert fixed.requestedMeasures==t.requestedMeasures and fixed.filters==t.filters
    assert next(s for s in fixed.slotUpdates if s.field=='requestedGrain').value=='specimen'
    assert receipt['measureEvidence']==t.requestedMeasures
    validate_task_grain(fixed)


@pytest.mark.parametrize('entity,measures', [
    ('course',['student count']), ('unknown',['count']), ('specimen',['overdue count']),
])
def test_grain_correction_cannot_guess_an_unproven_measured_entity(entity, measures):
    from app.reader_context import normalize_measure_grain
    t=task(businessObject=entity,requestedGrain='keeper',groupBy=['keeper'],requestedMeasures=measures)
    fixed,receipt=normalize_measure_grain(t)
    assert fixed is t and receipt is None


def test_selected_clarification_reaches_independent_intent_review_without_erasing_unchanged_slots():
    from app.reader_context import merge_task
    original = simple_task().model_copy(update={'requestedMeasures': ['count of finished crystals']})
    choice = {'clarificationId': 'c1', 'choiceId': 'archived', 'updates': [
        {'field': 'requestedMeasures', 'value': ['count of archived crystals'], 'source': 'knowledge'}]}
    history = {'previousIntent': {'task': original.model_dump(), 'originalQuestion':
        'Count my finished crystals by status.'}}
    resolved = merge_task(original, history, choice)
    class SelectedPlanner(Planner):
        async def generic_reader_json(self, **kwargs):
            data = kwargs['data']
            assert data.get('clarificationAnswer') == choice
            assert data['task']['requestedMeasures'] == ['count of archived crystals']
            assert data['task']['groupBy'] == ['status']
            assert data['task']['requestedScope'] == 'personal'
            return expansion_fixture(data)
    reader = GenericKnowledgeReader(Gateway(), SelectedPlanner(), portal_base_url='https://portal.test')
    reader.current_question = '1'
    reader.deadline = time.monotonic() + 60
    result = asyncio.run(reader.expand_task(resolved, history, choice))
    assert result == resolved
    assert reader.audit['queryExpansions'][-1]['intentStatus'] == 'consistent'


def test_pending_clarification_reuses_only_identical_previously_reviewed_clauses():
    from app.reader_expansion import clarification_expansion
    from app.generic_reader_contracts import ClarificationRequest
    t = simple_task()
    pending = t.model_copy(update={'unresolvedSlots': ['requestedMeasures'],
        'clarification': ClarificationRequest(question='Which count definition?', missingSlots=['requestedMeasures'], options=[])})
    original = expansion(t)
    carried = clarification_expansion(original, t, pending)
    assert carried is not None
    validate_expansion(carried, pending, 'Count my crystals by status.')
    assert len(carried.terms) == len(original.terms) + 1
    assert original.terms == [x for x in carried.terms if x.requirementId != 'unresolved_0']
    for key, value in [('filters', ['new population']), ('requestedScope', 'team'),
                       ('groupBy', []), ('requestedAttributes', ['new field']),
                       ('needsLiveData', False), ('readOnly', False)]:
        changed = pending.model_copy(update={key: value})
        assert clarification_expansion(original, t, changed) is None
    assert clarification_expansion(None, t, pending) is None
    assert clarification_expansion(original.model_copy(update={'intentStatus': 'needs_revision'}), t, pending) is None
