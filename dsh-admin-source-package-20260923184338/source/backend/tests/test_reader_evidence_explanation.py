import asyncio
import copy
import json
from pathlib import Path
from types import SimpleNamespace
import pytest
from app.generic_reader import PipelineError, render_generic_answer
from app.generic_reader_contracts import TaskSpec, EvidenceExplanation
from app.reader_evidence_explanation import (validate_declarations, partition, provenance_output,
    merge_results, split_knowledge_coverage, compose_guidance)
from app.reader_requirements import requirements_for
from app.reader_context import refine_task
from app.reader_output_scope import confirmed_output_contexts


def fixture():
    raw = json.loads((Path(__file__).parent / 'fixtures/evidence_explanation_b11.json').read_text())
    task = TaskSpec.model_validate(raw['task'])
    quote = 'explain which source and observation time your answer uses'
    task.evidenceExplanations = [
        EvidenceExplanation(attribute=task.requestedAttributes[1], kind='source', aboutAttribute='status', questionQuote=quote),
        EvidenceExplanation(attribute=task.requestedAttributes[2], kind='observation_time', aboutAttribute='status', questionQuote=quote),
        *[EvidenceExplanation(attribute=a, kind='knowledge_guidance', questionQuote='tell me how to refresh or verify the discrepancy')
          for a in task.requestedAttributes[3:]]]
    assignment = partition(task, raw['prompt'], raw['prompt'])
    output = raw['actualOutputs'][-1]
    coverage = [{**r, 'status': 'satisfied', 'outputIds': [output['id']], 'stepIds': ['read_detail']}
                for r in requirements_for(assignment['liveTask'])]
    next(c for c in coverage if c['id'] == 'attribute_0').update(raw['statusRequirementCoverage'])
    analysis = {'outputs': [output], 'requirementCoverage': coverage,
                'requirements': requirements_for(assignment['liveTask']), 'requirementsSatisfied': True, 'missing': []}
    source = copy.deepcopy(raw['statusSourceReceipt']); source['ready'] = True
    source['fieldEvidence'] = {'/data/detail/status': source.pop('statusFieldEvidence')}
    sources = {source['sourceId']: source}
    catalog = [{'name': 'Application Details', 'routes': ['/licensing/applications/applicationsDetails'], 'module': 'Licensing'}]
    return raw, assignment, analysis, sources, source['principalScopeRef'], catalog


def test_actual_audit_failure_is_preserved_while_responsibilities_keep_every_original_id():
    raw, a, analysis, sources, principal, catalog = fixture()
    assert [r['reason'] for r in raw['unfulfilledRequirements']] == ['field_semantic_binding_unverified'] * 4
    assert a['liveTask'].requestedAttributes == ['status']
    assert a['knowledgeTask'].requestedAttributes == ['status', *a['originalTask'].requestedAttributes[3:]]
    assert len(requirements_for(a['originalTask'])) == 9
    assert a['liveMap']['attribute_0'] == 'attribute_0'
    assert a['knowledgeMap']['attribute_1'] == 'attribute_3'
    result = merge_results(a, analysis, sources, principal, catalog, 'en', {'blocks': [], 'coverage': []})
    assert [r['id'] for r in result['requirementCoverage'] if r['status'] != 'satisfied'] == ['attribute_3', 'attribute_4']
    assert result['requirementsSatisfied'] is False
    assert result['outputs'][-1]['value'] == [{'Observed at': raw['statusSourceReceipt']['capturedAt']}]
    accepted, withheld = confirmed_output_contexts(result['outputs'], result['requirementCoverage'])
    assert not withheld and len(accepted) == 3


@pytest.mark.parametrize('kind,label,question', [
    ('source', 'source of funds', 'What is the status and source of funds?'),
    ('observation_time', 'business last updated', 'Show status and business last updated.'),
    ('observation_time', 'historical observation time of status', 'Show status and historical observation time of status.'),
    ('source', 'source of another record observation', 'Show status and source of another record observation.'),
    ('knowledge_guidance', 'business last updated', 'Show status and business last updated.'),
])
def test_model_cannot_assign_business_origins_dates_or_other_records_to_runtime_metadata(kind, label, question):
    _, a, *_ = fixture(); task = a['originalTask'].model_copy(deep=True)
    task.requestedAttributes = ['status', label]
    task.evidenceExplanations = [EvidenceExplanation(attribute=label, kind=kind, aboutAttribute='status', questionQuote=question)]
    with pytest.raises(PipelineError): validate_declarations(task, question, question)


@pytest.mark.parametrize('change', ['other_record', 'other_principal', 'other_time', 'other_observation',
    'unmatched_output', 'missing_capture', 'naive_time', 'unknown_field', 'unverified_status', 'record_partial',
    'wrong_field', 'unknown_page', 'ambiguous_page', 'not_ready', 'only_business_time'])
def test_provenance_requires_this_verified_field_output_and_its_exact_record_receipt(change):
    _, a, analysis, sources, principal, catalog = fixture()
    source = next(iter(sources.values())); ref = analysis['outputs'][0]['evidence'][0]
    if change == 'other_record': source['verifiedRecord']['identity'] = 'OTHER'
    if change == 'other_principal': source['principalScopeRef'] = 'other'
    if change == 'other_time': source['capturedAt'] = '2020-01-01T00:00:00+00:00'
    if change == 'other_observation': source['observationRef'] = 'previous_read'
    if change == 'unmatched_output': analysis['outputs'][0]['id'] = 'other'
    if change == 'missing_capture': source.pop('capturedAt')
    if change == 'naive_time': source['capturedAt'] = ref['capturedAt'] = '2026-09-28T08:53:16'
    if change == 'unknown_field': ref['fieldStatus']['status'] = 'unknown'
    if change == 'unverified_status': next(c for c in analysis['requirementCoverage'] if c['id'] == 'attribute_0')['status'] = 'unfulfilled'
    if change == 'record_partial': next(c for c in analysis['requirementCoverage'] if c['id'] == 'record')['status'] = 'unfulfilled'
    if change == 'wrong_field': ref['fieldBinding'] = '/data/payment'
    if change == 'unknown_page': catalog = []
    if change == 'ambiguous_page': catalog.append({**catalog[0], 'name': 'Other Page'})
    if change == 'not_ready': source['ready'] = False
    if change == 'only_business_time': source['lastUpdated'] = source.pop('capturedAt')
    assert provenance_output(a, a['assigned'][1], analysis, sources, principal, catalog, 'en') is None


def test_refinement_cannot_replace_declared_responsibilities_or_original_attributes():
    _, a, *_ = fixture(); draft = a['originalTask']; candidate = draft.model_copy(deep=True)
    candidate.evidenceExplanations = []; candidate.requestedAttributes = ['status']
    result = refine_task(draft, candidate)
    assert result.requestedAttributes == draft.requestedAttributes
    assert result.evidenceExplanations == draft.evidenceExplanations


def test_unrelated_read_failure_is_never_removed_by_successful_provenance():
    _, a, analysis, sources, principal, catalog = fixture(); analysis['missing'] = ['existing_source_failure']
    result = merge_results(a, analysis, sources, principal, catalog, 'en', {'blocks': [], 'coverage': []})
    assert 'existing_source_failure' in result['missing']
    assert a['originalTask'].requestedAttributes == fixture()[1]['originalTask'].requestedAttributes


def test_runtime_explanation_uses_arabic_labels_and_never_exposes_internal_operation_paths():
    _, a, analysis, sources, principal, catalog = fixture()
    output = provenance_output(a, a['assigned'][0], analysis, sources, principal, catalog, 'ar')
    assert output['value'] == [{'صفحة المصدر': 'Application Details'}]
    assert '/api/' not in json.dumps(output['value'])


def test_missing_current_quote_or_retained_fact_never_partitions_the_request():
    raw, a, *_ = fixture(); task = a['originalTask'].model_copy(deep=True)
    task.evidenceExplanations[0].questionQuote = 'invented request'
    with pytest.raises(PipelineError): partition(task, raw['prompt'])
    task = a['originalTask'].model_copy(deep=True); task.evidenceExplanations[0].aboutAttribute = 'other field'
    with pytest.raises(PipelineError): partition(task, raw['prompt'])


def test_default_empty_does_not_change_existing_read_tasks():
    raw, a, *_ = fixture(); task = a['originalTask'].model_copy(update={'evidenceExplanations': []})
    assert partition(task, raw['prompt']) is None


@pytest.mark.parametrize('fault', ['', 'rejected', 'prior_missing', 'uncited', 'record_fact'])
def test_guidance_uses_real_answer_contracts_and_independent_review(fault):
    raw, a, analysis, sources, principal, catalog = fixture()
    text = 'Reload the current Applications page, reopen the same application and compare the displayed status. Contact the authorized owner if it still differs.'
    kb = SimpleNamespace(items={}, cite=lambda refs: None, citation_text=lambda ref: text,
                         source=lambda ref: {'sourceName': 'Current Applications guide'})
    coverage = [{'requirementId': d['requirementId'], 'status': 'covered', 'evidence': [{'sourceId': 'manual:p1'}]}
                for d in a['assigned'] if d['kind'] == 'knowledge_guidance']
    if fault == 'prior_missing': coverage[-1].update(status='partial', reason='No documented discrepancy escalation.')
    previous = [{'requirementId': 'attribute_0', 'status': 'covered'}]
    calls = []
    async def structured(contract, prompt, data, validate):
        calls.append((contract.__name__, copy.deepcopy(data)))
        if contract.__name__ == 'KnowledgeAnswerDraft':
            value = {'stage': 'knowledge_answer_draft', 'blocks': [
                {'id': 'refresh', 'text': 'Reload the current Applications page and reopen the same application.',
                 'requirementIds': ['attribute_3'], 'quoteIndexes': [0]},
                {'id': 'verify', 'text': 'Compare the displayed status; contact the authorized owner if it still differs.',
                 'requirementIds': ['attribute_4'], 'quoteIndexes': [0]}]}
        else:
            value = {'stage': 'knowledge_answer_review', 'checks': [
                {'requirementId': c['requirementId'], 'status': 'covered', 'quoteIndexes': [] if fault == 'uncited' else [0],
                 'reason': 'The actual cited answer states the documented read-only procedure.'} for c in coverage],
                'blockChecks': [{'blockId': name, 'supported': not (fault == 'rejected' and name == 'verify'),
                    'languageMatches': True, 'customerFacing': True,
                    'containsUnverifiedRecordFacts': fault == 'record_fact' and name == 'verify',
                    'reason': 'Checked actual answer against its cited passage.'} for name in ['refresh', 'verify']]}
        plan = contract.model_validate(value);validate(plan);return plan
    reader = SimpleNamespace(current_question=raw['prompt'], knowledge=kb, audit={},
                             knowledge_requirement_coverage=previous, structured=structured, secrets=())
    guidance = asyncio.run(compose_guidance(reader, a, coverage, catalog, SimpleNamespace(roles=['Reviewer']), principal_ref=principal))
    assert reader.knowledge_requirement_coverage is previous
    assert {c[0] for c in calls} == {'KnowledgeAnswerDraft', 'KnowledgeAnswerReview'}
    assert all({r['id'] for r in data['requirements']} == {'attribute_3', 'attribute_4'} for _, data in calls)
    assert all(data['task']['requestedAttributes'] == a['originalTask'].requestedAttributes for _, data in calls)
    result = merge_results(a, analysis, sources, principal, catalog, 'en', guidance)
    assert len(result['requirements']) == 9
    if not fault:
        assert result['requirementsSatisfied'] and not result['missing']
    else:
        assert not result['requirementsSatisfied'] and 'attribute_4' in result['missing']
    if fault in {'rejected', 'record_fact'}:
        assert [b['id'] for b in guidance['blocks']] == ['refresh']


def finished_reader(a):
    from app.generic_reader import GenericKnowledgeReader
    from app.reader_evidence_explanation import assignment_receipt
    from app.reader_quality import STAGES
    from test_generic_reader_v3 import Gateway, Planner
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test')
    reader.secrets = ();reader.evidence_assignment = a;reader.evidence_original_intent = {'task': a['originalTask'].model_dump(), 'status': 'ready', 'clarificationRounds': 0}
    reader.audit['evidenceExplanationAssignment'] = assignment_receipt(a)
    reader.knowledge_requirement_coverage = [{'requirementId': r['id'], 'status': 'covered'} for r in requirements_for(a['liveTask'])]
    reader.evidence_knowledge_coverage = [{'requirementId': v, 'status': 'covered'} for v in a['knowledgeMap'].values()]
    for stage in STAGES: reader.quality.record(stage, 'passed')
    return reader


def test_final_payload_uses_full_original_knowledge_coverage_and_retains_missing_guidance():
    _, a, analysis, sources, principal, catalog = fixture()
    reader = finished_reader(a)
    reader.evidence_knowledge_coverage[-1]['status'] = 'partial'
    result = merge_results(a, analysis, sources, principal, catalog, 'en', {'blocks': [], 'coverage': []})
    payload = reader.finish(task=a['liveTask'], analysis=result).result.public_json()
    assert not payload['knowledgeRequirementsSatisfied']
    assert 'knowledge_requirements_incomplete' in payload['missing']
    assert [r['id'] for r in payload['requirements']] == [r['id'] for r in requirements_for(a['originalTask'])]
    assert payload['analysisStatus'] == 'partial'


def test_early_branch_error_restores_all_original_requirements_and_intent():
    _, a, *_ = fixture();reader = finished_reader(a)
    result = reader.finish(task=a['liveTask'], error=PipelineError('original_source_failure', 'runtime')).result.public_json()
    assert result['result'] == 'load_failed' and 'original_source_failure' in result['missing']
    assert [r['id'] for r in result['requirements']] == [r['id'] for r in requirements_for(a['originalTask'])]
    assert all(r['status'] == 'unfulfilled' for r in result['requirementCoverage'])
    assert reader.intent_state['task']['requestedAttributes'] == a['originalTask'].requestedAttributes


def test_latest_unrelated_capture_cannot_replace_status_output_capture():
    _, a, analysis, sources, principal, catalog = fixture()
    newer = copy.deepcopy(next(iter(sources.values())))
    newer.update(sourceId='unrelated', capturedAt='2026-09-28T23:00:00+00:00')
    sources['unrelated'] = newer
    value = provenance_output(a, a['assigned'][1], analysis, sources, principal, catalog, 'en')
    assert value['value'] == [{'Observed at': analysis['outputs'][0]['evidence'][0]['capturedAt']}]


def test_actual_pipeline_reviews_full_intent_then_routes_only_live_fact_and_restores_original(tmp_path):
    from app.generic_reader import GenericKnowledgeReader
    from app.principal import Principal
    from test_generic_reader_v3 import Gateway, expansion_fixture
    raw, a, *_ = fixture(); original=a['originalTask'].model_copy(deep=True, update={'contextRelation':'new', 'slotUpdates':[]});reviews=[]
    class Planner:
        async def generic_reader_json(self, *, schema, data, **kwargs):
            stage=schema['properties']['stage']['const']
            if stage=='query_expansion':
                reviews.append(copy.deepcopy(data['task']));return expansion_fixture(data)
            assert stage=='task',stage
            return original.model_dump()
    class ReadBoundary(GenericKnowledgeReader):
        async def route_task(self, principal, task, question, catalog, current_page):
            assert task.requestedAttributes==['status']
            assert self.evidence_assignment['originalTask'].requestedAttributes==original.requestedAttributes
            assert self.intent_state['task']['requestedAttributes']==original.requestedAttributes
            assert [t.sourceText for t in self.expansion.terms if t.requirementId.startswith('attribute_')]==['status']
            raise PipelineError('offline_stop_before_route_read','runtime')
    (tmp_path/'page-catalog.json').write_text(json.dumps([{'name':'Application Details','routes':[{'path':'/work/crystals','title':'Applications','isMenu':True}]}]))
    reader=ReadBoundary(Gateway(),Planner(),portal_base_url='https://portal.test',artifacts_dir=str(tmp_path))
    result=asyncio.run(reader.run(Principal('person-1','tenant','r'),raw['prompt']+' Application '+original.recordIdentity)).result.public_json()
    assert reviews and all(t['requestedAttributes']==original.requestedAttributes for t in reviews), result['missing']
    assert result['missing']==['offline_stop_before_route_read']
    assert result['intentState']['task']['requestedAttributes']==original.requestedAttributes
    assert len(result['requirements'])==9 and not result['requirementsSatisfied']


def test_arabic_original_quote_with_canonical_meaning_retains_the_same_responsibility_map():
    raw, a, *_=fixture();task=a['originalTask'].model_copy(deep=True)
    source_quote='بيّن مصدر الملاحظة ووقت الملاحظة الذي تعتمد عليه إجابتك'
    guidance_quote='وكيف أحدث السجل أو أتحقق من اختلاف الحالة'
    question=source_quote+'، '+guidance_quote
    for d in task.evidenceExplanations:
        d.questionQuote=guidance_quote if d.kind=='knowledge_guidance' else source_quote
    current=partition(task,question,raw['prompt'])
    assert current['liveMap']==a['liveMap'] and current['knowledgeMap']==a['knowledgeMap']
    assert current['originalTask'].requestedAttributes==a['originalTask'].requestedAttributes


@pytest.mark.parametrize('quote',[
    'مصدر الملاحظة للسجل الآخر','وقت الملاحظة لسجل آخر','مصدر القراءة للسجل السابق',
    'وقت القراءة السابقة','وقت الملاحظة التاريخية','وقت الملاحظة القديمة','وقت ملاحظة أمس',
])
def test_arabic_other_prior_or_historical_quote_cannot_become_present_read_metadata(quote):
    _,a,*_=fixture();task=a['originalTask'].model_copy(deep=True)
    task.requestedAttributes=['status','observation time'];task.evidenceExplanations=[EvidenceExplanation(
        attribute='observation time',kind='observation_time',aboutAttribute='status',questionQuote=quote)]
    # Even an incomplete/incorrect English canonical cannot license a negative original quote.
    with pytest.raises(PipelineError,match='evidence_explanation_meaning_unverified'):
        validate_declarations(task,quote,'Explain status observation time from your answer.')


def test_real_arabic_guidance_label_is_explicit_how_to_and_anchor_feedback_retains_attributes():
    raw,a,*_=fixture();task=a['originalTask'].model_copy(deep=True)
    old=task.requestedAttributes[-1];new='guidance on how to update or verify the status discrepancy'
    task.requestedAttributes[-1]=new;task.evidenceExplanations[-1].attribute=new
    assert partition(task,raw['prompt'])['originalTask'].requestedAttributes==task.requestedAttributes
    task.evidenceExplanations[0].aboutAttribute=''
    with pytest.raises(PipelineError) as failure:validate_declarations(task,raw['prompt'])
    assert failure.value.details['retainedAttributes']==task.requestedAttributes
    assert failure.value.details['allowedLiveAnchorAttributes']==['status']
    assert 'Preserve every original requested attribute' in failure.value.details['correction']
