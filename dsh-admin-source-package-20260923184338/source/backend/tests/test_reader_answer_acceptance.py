import copy
import pytest
from app.generic_reader import GenericKnowledgeReader, PipelineError
from app.reader_answers import KnowledgeAnswerReview, validate_answer_review
from app.reader_knowledge_coverage import knowledge_requirements
from test_reader_context_v3 import task
from test_generic_reader_v3 import Gateway, Planner


def fixture():
    t = task(needsLiveData=False, requestedScope='unknown', timeRange='unknown',
             requestedMeasures=[], groupBy=[], filters=[], recordIdentity='')
    prior = [{'requirementId': r['id'], 'status': 'covered'} for r in knowledge_requirements(t)]
    plan = KnowledgeAnswerReview(stage='knowledge_answer_review', checks=[{
        **c, 'quoteIndexes': [0], 'reason': 'The final extract explicitly explains this requirement.'} for c in prior])
    quotes = [{'text': 'The crystal handbook defines the entity and its fields.', 'source': 'Handbook'}]
    return t, prior, plan, quotes


def test_verified_knowledge_answer_can_complete_without_live_data():
    t, prior, plan, quotes = fixture()
    validate_answer_review(plan, t, quotes, prior)
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test')
    reader.secrets = (); reader.knowledge_requirement_coverage = prior
    # This unit tests final acceptance given verified prerequisite receipts.
    for stage in ('identity_context', 'intent', 'query_expansion', 'knowledge_retrieval', 'knowledge_coverage'):
        reader.quality.record(stage, 'passed')
    result = reader.finish(task=t, knowledge_quotes=quotes,
        answer_coverage=[c.model_dump() for c in plan.checks]).result.public_json()
    assert result['analysisStatus'] == 'complete' and result['requirementsSatisfied']
    assert not result['missing'] and not result['outputs']


def test_final_review_cannot_certify_skipped_prerequisite_checks():
    t, prior, plan, quotes = fixture()
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test')
    reader.knowledge_requirement_coverage = prior
    result = reader.finish(task=t, knowledge_quotes=quotes,
        answer_coverage=[c.model_dump() for c in plan.checks]).result.public_json()
    assert not result['requirementsSatisfied']
    assert 'stage_quality_incomplete' in result['missing']
    assert 'query_expansion' in result['qualityBlockers']


@pytest.mark.parametrize('fault', ['omitted_requirement', 'duplicate_requirement', 'unknown_quote'])
def test_answer_review_cannot_hide_missing_requirements_or_invent_evidence(fault):
    t, prior, plan, quotes = fixture()
    if fault == 'omitted_requirement': plan.checks.pop()
    if fault == 'duplicate_requirement': plan.checks.append(copy.deepcopy(plan.checks[0]))
    if fault == 'unknown_quote': plan.checks[0].quoteIndexes = [9]
    with pytest.raises(PipelineError):
        validate_answer_review(plan, t, quotes, prior)


def test_prior_missing_knowledge_cannot_be_upgraded_or_discard_other_supported_blocks():
    t, prior, plan, quotes = fixture()
    prior[0].update(status='partial', reason='Required policy remains undocumented.')
    validate_answer_review(plan, t, quotes, prior)
    assert plan.checks[0].status == 'partial'
    assert 'undocumented' in plan.checks[0].reason
    assert all(c.status == 'covered' for c in plan.checks[1:])
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test')
    reader.secrets = (); reader.knowledge_requirement_coverage = prior
    result = reader.finish(task=t, knowledge_quotes=quotes,
        answer_coverage=[c.model_dump() for c in plan.checks],
        answer_blocks=[{'text': 'The supported boundary remains readable.'}]).result.public_json()
    assert not result['requirementsSatisfied']
    assert result['knowledgeAnswer'][0]['text'] == 'The supported boundary remains readable.'


def test_one_unsupported_claim_is_downgraded_without_losing_supported_requirements():
    t, prior, plan, quotes = fixture()
    plan.checks[0].quoteIndexes = []
    validate_answer_review(plan, t, quotes, prior)
    assert plan.checks[0].status == 'not_yet_verified'
    assert all(c.status == 'covered' for c in plan.checks[1:])


def test_extracts_alone_do_not_prove_answer_completeness():
    t, prior, _, quotes = fixture()
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test')
    reader.secrets = (); reader.knowledge_requirement_coverage = prior
    result = reader.finish(task=t, knowledge_quotes=quotes).result.public_json()
    assert result['analysisStatus'] == 'partial'
    assert 'knowledge_answer_coverage_unverified' in result['missing']


def test_output_checks_do_not_overwrite_actual_failure_stage():
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test')
    reader.secrets = ()
    reader.trace.append({'stage': 'readonly_execution', 'status': 'passed'})
    result = reader.finish(error=PipelineError('source_shape_invalid', 'source_data'))
    assert result.result.public_json()['failureStage'] == 'readonly_execution'
    assert result.audit_evidence['failureStage'] == 'readonly_execution'
    assert result.audit_evidence['stages'][-1]['stage'] == 'output_permissions'


@pytest.mark.parametrize('failed_flag', ['supported', 'languageMatches', 'customerFacing'])
def test_one_bad_block_does_not_erase_independent_prose_or_certify_removed_requirement(failed_flag):
    from app.reader_answers import KnowledgeAnswerDraft, AnswerBlockCheck, verified_answer_blocks
    t, prior, review, quotes = fixture()
    requirements = [c.requirementId for c in review.checks]
    draft = KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[
        {'id': 'supported_rule', 'text': 'The documented rule applies to this object.',
         'requirementIds': requirements[1:], 'quoteIndexes': [0]},
        {'id': 'bad_navigation', 'text': 'Use an undocumented navigation path.',
         'requirementIds': requirements[:1], 'quoteIndexes': [0]}])
    review.blockChecks = [AnswerBlockCheck(
        blockId=b.id, supported=True, languageMatches=True, customerFacing=True,
        reason='Reviewed against cited evidence.') for b in draft.blocks]
    setattr(review.blockChecks[1], failed_flag, False)
    validate_answer_review(review, t, quotes, prior, draft.blocks)
    kept = verified_answer_blocks(draft, review)
    assert [b.id for b in kept] == ['supported_rule']
    assert review.checks[0].status == 'partial'
    assert all(c.status == 'covered' for c in review.checks[1:])
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test')
    reader.secrets = (); reader.knowledge_requirement_coverage = prior
    result = reader.finish(task=t, knowledge_quotes=quotes,
        answer_blocks=[b.model_dump() for b in kept],
        answer_coverage=[c.model_dump() for c in review.checks]).result.public_json()
    assert not result['requirementsSatisfied']
    assert result['knowledgeAnswer'][0]['text'] == draft.blocks[0].text
    assert 'undocumented navigation' not in str(result['knowledgeAnswer'])


def test_removing_shared_claim_does_not_upgrade_an_incomplete_answer():
    from app.reader_answers import KnowledgeAnswerDraft, AnswerBlockCheck, verified_answer_blocks
    _, _, review, _ = fixture()
    ids = [c.requirementId for c in review.checks]
    draft = KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[
        {'id': 'known', 'text': 'Known rule.', 'requirementIds': ids, 'quoteIndexes': [0]},
        {'id': 'extra', 'text': 'Unsupported condition.', 'requirementIds': ids[:1], 'quoteIndexes': [0]}])
    review.blockChecks = [AnswerBlockCheck(blockId=b.id, supported=b.id == 'known',
        languageMatches=True, customerFacing=True, reason='Checked.') for b in draft.blocks]
    assert len(verified_answer_blocks(draft, review)) == 1
    assert review.checks[0].status == 'partial'
    review.blockChecks[0].supported = False
    assert verified_answer_blocks(draft, review) == []
    assert not any(c.status == 'covered' for c in review.checks)


def test_review_context_cannot_borrow_an_uncited_rule_or_renumber_evidence():
    from app.reader_answers import KnowledgeAnswerDraft, answer_review_input
    t, prior, _, _ = fixture()
    ids = [r['id'] for r in knowledge_requirements(t)]
    draft = KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[{
        'id': 'known', 'text': 'A documented condition.',
        'requirementIds': ids[:1], 'quoteIndexes': [2]}])
    data = {'requirements': knowledge_requirements(t), 'question': 'Explain the conditions.',
        'previousDraft': {'text': 'Unreviewed old response'}, 'correction': {'text': 'Old rule'},
        'finalQuotes': [{'quoteIndex': 0, 'text': 'An uncited rule from another process.'},
                        {'quoteIndex': 2, 'text': 'The actual cited condition.'}]}
    before = copy.deepcopy(data)
    result = answer_review_input(data, draft, prior)
    assert result['finalQuotes'] == [data['finalQuotes'][1]]
    assert result['requirementAnswers'][0]['answerQuoteIndexes'] == [2]
    assert result['requirementAnswers'][1]['answerBlockIds'] == []
    assert result['requirementAnswers'][1]['answerQuoteIndexes'] == []
    assert 'previousDraft' not in result and 'correction' not in result
    assert data == before


def test_one_matching_citation_does_not_allow_a_second_uncited_claim():
    from app.reader_answers import AnswerBlock, AnswerBlockCheck
    t, prior, review, quotes = fixture()
    quotes.append({'text': 'A different process has an additional condition.', 'source': 'Other'})
    block = AnswerBlock(id='answer', text='Only the first rule was actually answered.',
        requirementIds=[c.requirementId for c in review.checks], quoteIndexes=[0])
    review.blockChecks = [AnswerBlockCheck(blockId='answer', supported=True,
        languageMatches=True, customerFacing=True, reason='The first rule is supported.')]
    review.checks[0].quoteIndexes = [0, 1]
    validate_answer_review(review, t, quotes, prior, [block])
    assert review.checks[0].status == 'partial'
    assert all(c.status == 'covered' for c in review.checks[1:])


def test_review_schema_preserves_sparse_global_quote_indexes():
    import asyncio
    import time
    from app.reader_answers import KnowledgeAnswerDraft, answer_review_input
    t, prior, review, quotes = fixture()
    quotes = [*quotes, {'text': 'Unused rule.', 'source': 'Other'},
              {'text': 'The actual cited condition.', 'source': 'Actual'}]
    ids = [c.requirementId for c in review.checks]
    draft = KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[{
        'id': 'answer', 'text': 'The actual cited condition.',
        'requirementIds': ids, 'quoteIndexes': [2]}])
    for check in review.checks:
        check.quoteIndexes = [2]
    from app.reader_answers import AnswerBlockCheck
    review.blockChecks = [AnswerBlockCheck(blockId='answer', supported=True,
        languageMatches=True, customerFacing=True, reason='Supported by the cited condition.')]
    class CapturePlanner:
        async def generic_reader_json(self, **kwargs):
            self.call = kwargs
            return review.model_dump()
    async def run():
        planner = CapturePlanner()
        reader = GenericKnowledgeReader(Gateway(), planner, portal_base_url='https://portal.test')
        reader.deadline = time.monotonic() + 30
        data = answer_review_input({'requirements': knowledge_requirements(t),
            'finalQuotes': [dict(q, quoteIndex=i) for i, q in enumerate(quotes)]}, draft, prior)
        result = await reader.structured(KnowledgeAnswerReview, 'Review the answer.', data,
            lambda p: validate_answer_review(p, t, quotes, prior, draft.blocks))
        return result, planner.call
    result, call = asyncio.run(run())
    schema = call['schema']['$defs']['AnswerCheck']['properties']['quoteIndexes']['items']
    assert schema['enum'] == [2]
    assert 'maximum' not in schema
    branches = call['schema']['properties']['checks']['items']['oneOf']
    assert {b['allOf'][1]['properties']['requirementId']['const'] for b in branches} == set(ids)
    assert all(b['allOf'][1]['properties']['quoteIndexes']['items']['enum'] == [2]
               for b in branches)
    assert all(c.quoteIndexes == [2] and c.status == 'covered' for c in result.checks)


@pytest.mark.parametrize('model_corrects_handle', [True, False])
def test_citation_spelling_hint_never_automatically_accepts_invalid_evidence(model_corrects_handle):
    import asyncio, time, json
    from app.reader_knowledge_coverage import KnowledgeCoverage, validate_coverage
    from test_generic_reader_v3 import store, reference
    t, _, _, _ = fixture()
    k = store(); ref = reference(k)['sourceId']; base, passage = ref.split(':')
    invalid = base[:-1] + ':' + passage
    class CapturePlanner:
        def __init__(self): self.calls = []
        async def generic_reader_json(self, **kwargs):
            self.calls.append(kwargs)
            source_id = ref if model_corrects_handle and len(self.calls) == 2 else invalid
            return {'stage': 'knowledge_coverage', 'checks': [
                {'requirementId': r['id'], 'status': 'covered',
                 'evidence': [{'sourceId': source_id}], 'reason': 'Documented by this passage.'}
                for r in knowledge_requirements(t)]}
    planner = CapturePlanner()
    async def run():
        reader = GenericKnowledgeReader(Gateway(), planner, portal_base_url='https://portal.test')
        reader.knowledge = k; reader.deadline = time.monotonic() + 30
        return await reader.structured(KnowledgeCoverage, 'Verify coverage.',
            {'requirements': knowledge_requirements(t), 'knowledge': k.prompt()},
            lambda p: validate_coverage(p, t, k))
    if model_corrects_handle:
        result = asyncio.run(run())
        assert all(c.evidence[0].sourceId == ref for c in result.checks)
    else:
        with pytest.raises(PipelineError, match='knowledge_citation_invalid'):
            asyncio.run(run())
    assert len(planner.calls) == 2
    hint = json.loads(planner.calls[1]['correction'])
    assert hint['visibleCitationCandidates'] == [ref]
    assert 'spelling hints only, not semantic matches' in hint['correction']


@pytest.mark.parametrize('missing,accepted', [([], False), (['attribute_2'], True),
    (['current_record_eligibility_unverified'], False), (['attribute_2', 'attribute_2'], False)])
def test_extract_selection_preserves_exact_reviewed_requirements(missing, accepted):
    from app.generic_reader_contracts import KnowledgeResolution
    from app.reader_answers import validate_resolution_requirements
    resolution = KnowledgeResolution(stage='knowledge_resolution', route='', pageName='',
        routeEvidence=[], answerEvidence=[], missing=missing)
    coverage = [{'requirementId': 'object', 'status': 'covered'},
                {'requirementId': 'attribute_2', 'status': 'partial'}]
    if accepted:
        validate_resolution_requirements(resolution, coverage)
    else:
        with pytest.raises(PipelineError, match='knowledge_resolution_requirements_invalid'):
            validate_resolution_requirements(resolution, coverage)
    assert resolution.missing == missing


def test_extract_selection_cannot_reintroduce_a_live_check_into_completed_static_coverage():
    from app.generic_reader_contracts import KnowledgeResolution
    from app.reader_answers import validate_resolution_requirements
    coverage = [{'requirementId': 'object', 'status': 'covered'}]
    resolution = KnowledgeResolution(stage='knowledge_resolution', route='', pageName='',
        routeEvidence=[], answerEvidence=[], missing=['current_record_eligibility_unverified'])
    with pytest.raises(PipelineError, match='knowledge_resolution_requirements_invalid'):
        validate_resolution_requirements(resolution, coverage)
    resolution.missing = []
    validate_resolution_requirements(resolution, coverage)


@pytest.mark.parametrize('refs,accepted', [([0], False), ([0, 1], True), ([2], False)])
def test_navigation_requires_exact_route_evidence_not_another_module_or_route_prefix(refs, accepted):
    from app.reader_answers import KnowledgeAnswerDraft, validate_answer_draft
    t, _, _, _ = fixture()
    requirement = knowledge_requirements(t)[0]['id']
    quotes = [{'text': 'Unrelated page /other-module/items'},
              {'sourceId': 'k_page', 'text': '{"routes": ["/example/items"]}'},
              {'text': 'A separate detail route /example/items/detail'}]
    draft = KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[{
        'id': 'navigation', 'text': 'Open [Items](/example/items).',
        'requirementIds': [requirement], 'quoteIndexes': refs}])
    if accepted:
        validate_answer_draft(draft, t, quotes, ['/example/items'])
    else:
        with pytest.raises(PipelineError, match='knowledge_answer_navigation_citation_missing'):
            validate_answer_draft(draft, t, quotes, ['/example/items'])


@pytest.mark.parametrize('value', [False, 'false'])
def test_duplicate_control_metadata_keeps_the_write_request_blockable(value):
    import copy
    from app.reader_guidance import remove_duplicate_control_annotations, guidance_task
    from app.generic_reader_contracts import TaskSpec
    raw = fixture()[0].model_copy(update={'readOnly': False, 'needsLiveData': True}).model_dump()
    raw['slotUpdates'].append({'field': 'readOnly', 'value': value, 'source': 'current'})
    before = copy.deepcopy(raw)
    corrected, removed = remove_duplicate_control_annotations(raw)
    assert raw == before and removed == ['readOnly']
    parsed = TaskSpec.model_validate(corrected)
    assert parsed.readOnly is False and parsed.needsLiveData is True
    alternative = guidance_task(parsed)
    assert alternative.readOnly is True and alternative.needsLiveData is False


@pytest.mark.parametrize('slot', [
    {'field': 'readOnly', 'value': True, 'source': 'current'},
    {'field': 'readOnly', 'value': False, 'source': 'history'},
    {'field': 'inventedFlag', 'value': False, 'source': 'current'},
    {'field': ['readOnly'], 'value': False, 'source': 'current'}])
def test_conflicting_or_unknown_control_annotations_still_fail_contract(slot):
    from pydantic import ValidationError
    from app.reader_guidance import remove_duplicate_control_annotations
    from app.generic_reader_contracts import TaskSpec
    raw = fixture()[0].model_copy(update={'readOnly': False, 'needsLiveData': True}).model_dump()
    raw['slotUpdates'].append(slot)
    corrected, removed = remove_duplicate_control_annotations(raw)
    assert removed == []
    with pytest.raises(ValidationError):TaskSpec.model_validate(corrected)


def test_invalid_link_correction_identifies_the_block_and_exact_bad_target():
    from app.reader_answers import KnowledgeAnswerDraft, validate_answer_draft
    t = fixture()[0]
    draft = KnowledgeAnswerDraft(stage='knowledge_answer_draft', blocks=[{
        'id': 'navigation', 'text': 'Open [list](/example) then [detail](/example/detail).',
        'requirementIds': [knowledge_requirements(t)[0]['id']], 'quoteIndexes': [0]}])
    with pytest.raises(PipelineError, match='knowledge_answer_navigation_unverified') as exc:
        validate_answer_draft(draft, t, [{'text': 'Routes /example /example/detail'}], ['/example'])
    assert exc.value.details['blockId'] == 'navigation'
    assert exc.value.details['invalidPath'] == '/example/detail'
    assert 'Remove the hyperlink' in exc.value.details['correction']


def test_guidance_prompt_does_not_reintroduce_the_inactive_live_write_plan():
    from app.reader_guidance import guidance_prompt_context, guidance_task, validate_guidance_task
    requested = fixture()[0].model_copy(update={'readOnly': False, 'needsLiveData': True,
                                               'recordIdentity': 'REF-1'})
    alternative = {'originalQuestion': 'Reject REF-1 without a reason.',
        'canonicalQuestion': 'Reject REF-1 without a reason.',
        'requestedTask': requested.model_dump(), 'requestedActionExecuted': False}
    original = copy.deepcopy(alternative)
    prompt = guidance_prompt_context(alternative)
    assert alternative == original
    assert 'requestedTask' not in prompt and prompt['requestedActionExecuted'] is False
    assert prompt['originalQuestion'] == original['originalQuestion']
    assert prompt['activeMode'] == 'documented_workflow_explanation_only'
    explanation = guidance_task(requested, alternative['canonicalQuestion'])
    validate_guidance_task(explanation, alternative)
    with pytest.raises(PipelineError, match='readonly_guidance_execution_forbidden'):
        validate_guidance_task(explanation.model_copy(update={'needsLiveData': True}), alternative)
