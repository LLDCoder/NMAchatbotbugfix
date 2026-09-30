"""A blocked action retains explanation requirements and honest failure status."""
import pytest
from app.generic_reader import GenericKnowledgeReader, PipelineError, render_generic_answer
from app.reader_guidance import guidance_task, validate_guidance_task
from app.reader_answers import validate_answer_review
from app.reader_knowledge_coverage import knowledge_requirements
from test_reader_context_v3 import task
from test_reader_answer_acceptance import fixture
from test_generic_reader_v3 import Gateway, Planner


@pytest.mark.parametrize('condition', [
    'without a reason', 'without customer confirmation', 'erase communication history',
    'send me the new password', 'change a recorded outcome', 'hide photographic evidence',
    'skip an actual visit', 'delete review history', 'override payment status',
    'leave no audit trace',
    'بدون سبب', 'دون تأكيد العميل', 'حذف سجل التواصل', 'أرسل لي كلمة المرور الجديدة',
    'تغيير النتيجة المسجلة', 'إخفاء الأدلة المصورة', 'تجاوز الزيارة الفعلية',
    'حذف سجل المراجعة', 'تغيير حالة الدفع', 'دون ترك أثر',
])
def test_blocked_condition_survives_into_independent_answer_requirements(condition):
    original = task(readOnly=False, needsLiveData=True, businessFocus=condition,
                    requestedAttributes=['review requirement'], filters=['only the selected item'])
    alternative = guidance_task(original)
    assert not alternative.needsLiveData and alternative.readOnly
    requirements = knowledge_requirements(alternative)
    assert any(condition in r['value'] for r in requirements)
    assert any('review requirement' in r['value'] for r in requirements)
    assert any('standard handling steps' in r['value'] for r in requirements)
    assert any('scope and limits' in r['value'] and 'alternative' in r['value'] for r in requirements)
    assert original.businessFocus == condition and not original.readOnly


@pytest.mark.parametrize('mutation', [dict(needsLiveData=True), dict(readOnly=False)])
def test_guidance_refinement_cannot_restore_execution(mutation):
    t = guidance_task(task(readOnly=False))
    with pytest.raises(PipelineError, match='readonly_guidance_execution_forbidden'):
        validate_guidance_task(t.model_copy(update=mutation), {'requestedActionExecuted': False, 'requestedTask': task(readOnly=False).model_dump()})
    validate_guidance_task(t, {'requestedActionExecuted': False, 'requestedTask': task(readOnly=False).model_dump()})
    validate_guidance_task(t.model_copy(update=mutation), None)  # ordinary tasks unaffected


def test_missing_procedure_cannot_be_upgraded_by_a_generic_refusal():
    t, prior, review, quotes = fixture()
    prior[0].update(status='partial', reason='No documented correction procedure.')
    validate_answer_review(review, t, quotes, prior)
    assert review.checks[0].status == 'partial'


def test_refinement_cannot_drop_original_condition_explanations():
    original = task(readOnly=False, businessFocus='without the required review')
    t = guidance_task(original)
    t.requestedAttributes = t.requestedAttributes[:2]
    with pytest.raises(PipelineError, match='readonly_guidance_requirements_lost'):
        validate_guidance_task(t, {'requestedTask': original.model_dump()})


def test_runtime_restores_explanation_requirements_without_restoring_write_capability():
    from app.reader_guidance import restore_guidance_requirements
    original = task(readOnly=False, businessFocus='without the required review')
    alternative = {'requestedTask': original.model_dump()}
    candidate = guidance_task(original)
    expected = list(candidate.requestedAttributes)
    candidate.requestedAttributes = ['An unrelated exception catalogue']
    restored, changed = restore_guidance_requirements(candidate, alternative)
    assert changed and restored.requestedAttributes == expected
    assert candidate.requestedAttributes != expected
    assert next(s.value for s in restored.slotUpdates if s.field == 'requestedAttributes') == expected
    validate_guidance_task(restored, alternative)
    invalid, _ = restore_guidance_requirements(candidate.model_copy(update={'readOnly': False}), alternative)
    with pytest.raises(PipelineError, match='readonly_guidance_execution_forbidden'):
        validate_guidance_task(invalid, alternative)


@pytest.mark.parametrize('fault', ['unanswered', 'unrelated_quote'])
def test_knowledge_in_context_does_not_prove_it_is_answered(fault):
    from app.reader_answers import AnswerBlock, AnswerBlockCheck
    t, prior, review, quotes = fixture()
    quotes.append({'text': 'Other documented material.', 'source': 'Another handbook'})
    rid = review.checks[0].requirementId
    block = AnswerBlock(id='explanation', text='Only one narrow explanation.',
        requirementIds=[rid] if fault == 'unrelated_quote' else ['attribute_0'],
        quoteIndexes=[1] if fault == 'unrelated_quote' else [0])
    review.blockChecks = [AnswerBlockCheck(blockId='explanation', supported=True,
        languageMatches=True, customerFacing=True, reason='The individual statement is supported.')]
    validate_answer_review(review, t, quotes, prior, [block])
    assert review.checks[0].status == 'partial'


def test_answer_can_cover_a_requirement_using_its_actual_cited_output():
    from app.reader_answers import AnswerBlock, AnswerBlockCheck
    t, prior, review, quotes = fixture()
    block = AnswerBlock(id='explanation', text='Each requested explanation is supported.',
        requirementIds=[c.requirementId for c in review.checks], quoteIndexes=[0])
    review.blockChecks = [AnswerBlockCheck(blockId='explanation', supported=True,
        languageMatches=True, customerFacing=True, reason='The actual output covers all clauses.')]
    validate_answer_review(review, t, quotes, prior, [block])
    assert all(c.status == 'covered' for c in review.checks)


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_knowledge_outage_is_visible_alongside_the_readonly_boundary(language):
    result = render_generic_answer({'requestedActionStatus': 'blocked_read_only',
        'failureCategory': 'runtime', 'missing': ['knowledge_upstream_unavailable']}, language)
    boundary = render_generic_answer({'requestedActionStatus': 'blocked_read_only',
        'failureCategory': 'unsupported_operation'}, language)
    failure = render_generic_answer({'failureCategory': 'runtime'}, language)
    assert failure in result and result != boundary
    assert 'knowledge_upstream_unavailable' not in result


@pytest.mark.parametrize('language', ['en', 'ar'])
def test_partial_guidance_does_not_hide_unfulfilled_requirements(language):
    answer = {'knowledgeAnswer': [{'text': 'A supported explanation.'}],
              'missing': ['knowledge_answer_incomplete']}
    result = render_generic_answer(answer, language)
    complete = render_generic_answer({**answer, 'missing': []}, language)
    assert result != complete and result.startswith(complete)
    assert 'knowledge_answer_incomplete' not in result


def test_completed_guidance_never_means_the_requested_action_was_done():
    t, prior, review, quotes = fixture()
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test')
    reader.secrets = (); reader.knowledge_requirement_coverage = prior
    reader.readonly_alternative = {'requestedActionExecuted': False, 'originalQuestion': 'Modify my item.'}
    for stage in ('identity_context', 'intent', 'query_expansion', 'knowledge_retrieval', 'knowledge_coverage'):
        reader.quality.record(stage, 'passed')
    out = reader.finish(task=t, knowledge_quotes=quotes, answer_blocks=[{'text': 'Supported guidance.'}],
        answer_coverage=[c.model_dump() for c in review.checks]).result.public_json()
    assert out['guidanceStatus'] == 'complete' and out['result'] == 'success'
    assert out['requestedActionStatus'] == 'blocked_read_only'
    assert out['requestedActionExecuted'] is False and out['originalActionSatisfied'] is False
    assert not out['outputs']


def test_failed_guidance_cannot_be_misreported_as_a_successful_refusal():
    reader = GenericKnowledgeReader(Gateway(), Planner(), portal_base_url='https://portal.test')
    reader.secrets = (); reader.readonly_alternative = {'requestedActionExecuted': False}
    out = reader.finish(error=PipelineError('knowledge_upstream_unavailable', 'runtime')).result.public_json()
    assert out['guidanceStatus'] == 'unavailable' and out['result'] == 'load_failed'
    assert out['requestedActionExecuted'] is False


def test_answer_retry_targets_omitted_known_content_but_does_not_invent_missing_policy():
    from app.reader_answers import unanswered_covered_requirements
    t, prior, review, quotes = fixture()
    review.checks[0].status = 'partial'
    review.checks[1].status = 'partial'
    prior[1]['status'] = 'partial'
    result = unanswered_covered_requirements(review, prior)
    assert [r['requirementId'] for r in result] == [review.checks[0].requirementId]
    assert review.checks[1].status == 'partial'


def test_empty_model_focus_cannot_erase_a_blocked_actions_literal_condition():
    from app.reader_retrieval import business_query
    original=task(readOnly=False,businessFocus='',requestedAttributes=[],filters=[])
    question='Reject the request ABC-12 without entering a reason.'
    alternative=guidance_task(original, question)
    assert question in business_query(alternative, include_planner_query=False)
    assert any('without entering a reason' in r['value'] for r in knowledge_requirements(alternative))
    validate_guidance_task(alternative, {'requestedTask': original.model_dump(),
        'canonicalQuestion': question, 'originalQuestion': 'ارفض الطلب ABC-12 دون إدخال سبب.'})


@pytest.mark.parametrize('mutation', [dict(requestedGrain='application'),dict(businessFocus='approve the item')])
def test_procedure_explanation_does_not_acquire_a_live_population_or_counting_grain(mutation):
    original=task(readOnly=False)
    explanation=guidance_task(original)
    with pytest.raises(PipelineError,match='readonly_guidance_data_contract_invalid'):
        validate_guidance_task(explanation.model_copy(update=mutation), {'requestedTask': original.model_dump()})
